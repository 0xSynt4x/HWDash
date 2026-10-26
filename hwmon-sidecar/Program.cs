using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Management;
using System.Net;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using LibreHardwareMonitor.Hardware;

namespace HwMonitorSidecar;

class Program
{
    static Computer? _computer;
    static readonly object _lock = new();
    static Dictionary<string, string>? _cachedData;
    static Dictionary<string, float>? _cachedRaw;
    static DateTime _lastUpdate = DateTime.MinValue;
    // 传感器缓存时长。
    //
    // 前端 useHardware 是 500ms 轮询,所以这个值必须 **小于 500ms** ——
    // 否则每隔一拍就会命中缓存、把上一拍的数据原样返回:前端刷新率翻倍了,
    // 拿到的却有一半是重复值,等于白刷。
    //
    // 原来的 900ms 是配合前端 1000ms 轮询的(请求间隔 > TTL ⇒ 每次都是真读),
    // 那时缓存实际上只在并发请求/重试时才起作用。
    static readonly TimeSpan CacheTtl = TimeSpan.FromMilliseconds(400);

    const int DefaultPort = 7453;

    static void Main(string[] args)
    {
        var isAdmin = IsRunningAsAdmin();
        Console.Error.WriteLine($"[hwdash-sidecar] Initializing LibreHardwareMonitor... (Admin: {isAdmin})");

        if (!isAdmin)
        {
            Console.Error.WriteLine("[hwdash-sidecar] WARNING: Not running as Administrator! CPU/GPU temperature, voltage, power, and clock sensors may not be available.");
        }

        _computer = new Computer
        {
            IsCpuEnabled = true,
            IsGpuEnabled = true,
            IsMemoryEnabled = true,
            IsMotherboardEnabled = true,
            IsNetworkEnabled = true,
            IsStorageEnabled = true,
        };
        _computer.Open();

        // 传感器首次更新较慢,需要多次采样。
        // 必须递归更新子硬件(SuperIO),见 UpdateAndCollect 的说明。
        for (int i = 0; i < 5; i++)
        {
            var warmup = new Dictionary<string, float>();
            foreach (var hw in _computer.Hardware)
                UpdateAndCollect(hw, warmup);
            Thread.Sleep(200);
        }

        // HDD 温度首次读取偶发失败(LHM 的 SMART 就绪慢,实测首轮温度为 null)。
        // 运行期 HDD 永不自动刷新(见 HddRefreshInterval),这个值不会再被补上,
        // 面板会一直显示 "--",所以必须在预热阶段就重试到拿到为止。
        for (int retry = 0; retry < 10; retry++)
        {
            var missing = new List<IHardware>();
            foreach (var hw in _computer.Hardware)
            {
                var ident = hw.Identifier?.ToString() ?? "";
                if (!ident.StartsWith("/hdd/", StringComparison.OrdinalIgnoreCase)) continue;
                var hasTemp = hw.Sensors.Any(s =>
                    s.SensorType == SensorType.Temperature && s.Value.HasValue && s.Value.Value > 0);
                if (!hasTemp) missing.Add(hw);
            }
            if (missing.Count == 0) break;
            foreach (var hw in missing) hw.Update();
            Thread.Sleep(300);
        }

        var port = args.Length > 0 && int.TryParse(args[0], out var p) ? p : DefaultPort;

        // 父进程监控:父进程(hwdash)一旦消失就自行退出。
        // hwdash 被强杀/崩溃时它的清理代码跑不到,靠这里兜底,避免本进程变成
        // 孤儿进程一直占着内存和 7453 端口。
        var parentPid = ParseParentPid(args);
        if (parentPid.HasValue)
        {
            Console.Error.WriteLine($"[hwdash-sidecar] Watching parent process (PID: {parentPid.Value})");
            StartParentWatchdog(parentPid.Value);
        }

        // 端口被占用时:不换端口,但留在原地等一会儿重试(见 BindListenerWithRetry)。
        //
        // 为什么不让主程序去重启本进程:
        //   主程序是在 setup() 里等 sidecar 的,而 setup() 不返回,Tauri 就不会
        //   启动事件循环 → 窗口建出来也没有消息泵 → WebView2 初始化推不动 →
        //   整个窗口一片透明,等得越久透明越久(原来最坏 3×10s + 2×1.5s)。
        //   所以把"等端口释放"这件事留在 sidecar 自己做,主程序那一次 spawn
        //   就能直接成功。
        //
        // 为什么每次重试都要新建 HttpListener:
        //   Start() 一旦失败,内部已经 Close() 掉自己,此时再访问它的成员
        //   (如 Prefixes)会抛 ObjectDisposedException —— 那不是 HttpListenerException,
        //   catch 不住 → 进程直接崩,还会把真正的错误信息一起吞掉。
        using var listener = BindListenerWithRetry(port);

        Console.Error.WriteLine($"[hwdash-sidecar] Listening on http://localhost:{port}");
        Console.WriteLine("READY");
        Console.Out.Flush();

        while (true)
        {
            try
            {
                var ctx = listener.GetContext();
                var path = ctx.Request.Url?.AbsolutePath ?? "/";

                ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*");
                ctx.Response.Headers.Add("Access-Control-Allow-Methods", "GET, OPTIONS");

                if (ctx.Request.HttpMethod == "OPTIONS")
                {
                    ctx.Response.StatusCode = 204;
                    ctx.Response.Close();
                    continue;
                }

                if (path == "/api/hardware" || path == "/" || path == "/api/hardware/")
                {
                    var data = ReadSensors();
                    data["__admin"] = isAdmin.ToString().ToLowerInvariant();
                    var json = JsonSerializer.Serialize(data, new JsonSerializerOptions
                    {
                        WriteIndented = false
                    });
                    var buffer = Encoding.UTF8.GetBytes(json);
                    ctx.Response.ContentType = "application/json; charset=utf-8";
                    ctx.Response.ContentLength64 = buffer.Length;
                    ctx.Response.OutputStream.Write(buffer);
                    ctx.Response.OutputStream.Flush();
                }
                else if (path == "/api/hdd-refresh" || path == "/api/hdd-refresh/")
                {
                    // 手动刷新机械盘:POST(或 GET,前端 fetch 偷懒时也能用)。
                    // 只刷 HDD 一次,刷完照常走缓存读;返回刷新后的完整数据,
                    // 前端拿返回值直接更新,不用等下一个 500ms 轮询拍。
                    Dictionary<string, string> data;
                    lock (_lock)
                    {
                        ForceRefreshHdds();
                        var raw = ReadRawSensors();
                        var result = new Dictionary<string, string>();
                        MapSensors(raw, result);
                        _cachedData = result;
                        _cachedRaw = raw;
                        _lastUpdate = DateTime.UtcNow;
                        data = new Dictionary<string, string>(result);
                    }
                    data["__admin"] = isAdmin.ToString().ToLowerInvariant();
                    var json = JsonSerializer.Serialize(data, new JsonSerializerOptions
                    {
                        WriteIndented = false
                    });
                    var buffer = Encoding.UTF8.GetBytes(json);
                    ctx.Response.ContentType = "application/json; charset=utf-8";
                    ctx.Response.ContentLength64 = buffer.Length;
                    ctx.Response.OutputStream.Write(buffer);
                    ctx.Response.OutputStream.Flush();
                }
                else if (path == "/api/sensors" || path == "/api/sensors/")
                {
                    var raw = ReadRawSensors();
                    var json = JsonSerializer.Serialize(raw, new JsonSerializerOptions
                    {
                        WriteIndented = true
                    });
                    var buffer = Encoding.UTF8.GetBytes(json);
                    ctx.Response.ContentType = "application/json; charset=utf-8";
                    ctx.Response.ContentLength64 = buffer.Length;
                    ctx.Response.OutputStream.Write(buffer);
                    ctx.Response.OutputStream.Flush();
                }
                else if (path == "/health" || path == "/api/health")
                {
                    var buffer = Encoding.UTF8.GetBytes("{\"ok\":true}");
                    ctx.Response.ContentType = "application/json";
                    ctx.Response.ContentLength64 = buffer.Length;
                    ctx.Response.OutputStream.Write(buffer);
                    ctx.Response.OutputStream.Flush();
                }
                else
                {
                    ctx.Response.StatusCode = 404;
                }
                ctx.Response.Close();
            }
            catch (HttpListenerException)
            {
                break;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[hwdash-sidecar] Request error: {ex.Message}");
            }
        }
    }

    /// <summary>
    /// 从命令行参数解析 --parent-pid=NNN(hwdash 启动本进程时传入)。
    /// 解析不到返回 null,此时不启用父进程监控(独立运行场景)。
    /// </summary>
    /// <summary>
    /// 绑定监听端口;被占用时留在原地重试。
    ///
    /// 上一个 sidecar 刚被强杀(TerminateProcess)时,http.sys 的 URL 前缀注册
    /// (http://localhost:7453/)还要几十~几百毫秒才释放,立刻绑定必然失败 ——
    /// "覆盖后第一次启动窗口透明"就是这么来的。在这里自己等,主程序就不必进入
    /// 10s×3 的重试链(那段时间窗口是空的)。
    ///
    /// 每次重试都新建 HttpListener:Start() 失败时内部已 Close() 掉自己,
    /// 复用同一个实例会抛 ObjectDisposedException。
    /// </summary>
    static HttpListener BindListenerWithRetry(int port, int maxAttempts = 10, int delayMs = 500)
    {
        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            var candidate = new HttpListener();
            candidate.Prefixes.Add($"http://localhost:{port}/");
            try
            {
                candidate.Start();
                if (attempt > 1)
                {
                    Console.Error.WriteLine($"[hwdash-sidecar] Port {port} bound on attempt {attempt}.");
                    Console.Out.Flush();
                }
                return candidate;
            }
            catch (HttpListenerException ex)
            {
                try { candidate.Close(); } catch { /* 已 dispose,忽略 */ }

                Console.Error.WriteLine(
                    $"[hwdash-sidecar] Failed to bind port {port} (attempt {attempt}/{maxAttempts}): {ex.Message}");
                Console.Out.Flush();

                if (attempt == maxAttempts)
                {
                    Console.Error.WriteLine(
                        $"[hwdash-sidecar] Gave up binding port {port} after {maxAttempts} attempts.");
                    Console.Out.Flush();
                    Environment.Exit(2);
                }

                Thread.Sleep(delayMs);
            }
        }

        throw new InvalidOperationException("unreachable: BindListenerWithRetry loop exited without returning");
    }

    static int? ParseParentPid(string[] args)
    {
        const string prefix = "--parent-pid=";
        foreach (var arg in args)
        {
            if (arg.StartsWith(prefix, StringComparison.Ordinal) &&
                int.TryParse(arg.Substring(prefix.Length), out var pid) && pid > 0)
            {
                return pid;
            }
        }
        return null;
    }

    /// <summary>
    /// 盯住父进程。父进程消失后自行退出,避免 hwdash 被强杀/崩溃时本进程变孤儿。
    /// 用进程启动时间做二次校验,防止 PID 被系统复用后误判成"父进程还活着"。
    /// </summary>
    static void StartParentWatchdog(int parentPid)
    {
        DateTime parentStart;
        try
        {
            using var proc = Process.GetProcessById(parentPid);
            parentStart = proc.StartTime;
        }
        catch (Exception ex)
        {
            // 拿不到父进程信息就放弃监控(宁可残留,也不要误杀自己)。
            Console.Error.WriteLine($"[hwdash-sidecar] Parent watchdog disabled: {ex.Message}");
            return;
        }

        var watchdog = new Thread(() =>
        {
            while (true)
            {
                Thread.Sleep(1000);
                try
                {
                    using var proc = Process.GetProcessById(parentPid);
                    bool sameProcess;
                    try
                    {
                        sameProcess = proc.StartTime == parentStart;
                    }
                    catch
                    {
                        // 读不到启动时间时保守处理,继续下一轮。
                        continue;
                    }
                    if (!sameProcess) break;
                }
                catch (ArgumentException)
                {
                    break; // 进程已不存在
                }
                catch
                {
                    // 权限/竞态等异常忽略,下一轮再判。
                }
            }

            Console.Error.WriteLine($"[hwdash-sidecar] Parent process {parentPid} is gone, exiting.");
            Environment.Exit(0);
        })
        {
            IsBackground = true,
            Name = "parent-watchdog",
        };

        watchdog.Start();
    }

    static bool IsRunningAsAdmin()
    {
        try
        {
            using var identity = WindowsIdentity.GetCurrent();
            var principal = new WindowsPrincipal(identity);
            return principal.IsInRole(WindowsBuiltInRole.Administrator);
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// 机械盘单独降频:默认 **完全不读**(间隔 0 = 永不自动 Update)。
    ///
    /// 历史:最初 10 秒读一次(每次 Update 实测 320ms,占整轮 76%);
    /// 后来寒哥反馈周期性读取会一直"激活" HDD(磁头动作、噪音、
    /// 永远安静不下来),干脆改成 0 —— 只在启动预热时读一次,之后
    /// 传感器值常驻内存,前端照常展示(最多就是"旧"),要新数据走
    /// POST /api/hdd-refresh 手动触发。
    ///
    /// 判据用 LHM 的 Identifier 前缀,实测它自己已经分好类:
    ///   /hdd/  = 机械盘   ← 只降这一类
    ///   /ssd/  = SATA 固态
    ///   /nvme/ = NVMe 固态
    /// 不能用硬件名(换块盘就失效),也不能用实现类名(实测四块盘都是 StorageDevice)。
    ///
    /// 跳过 Update() 不会丢数据:传感器对象还在,Value 保持上次读到的值,
    /// 调用方照常收集。
    ///
    /// ⚠️ 只在 ReadRawSensors() 的 _lock 内被调用,所以这里不再单独加锁。
    /// </summary>
    static readonly TimeSpan HddRefreshInterval = TimeSpan.Zero;   // 0 = 永不自动读

    static readonly Dictionary<string, DateTime> _hddLastUpdate =
        new(StringComparer.OrdinalIgnoreCase);

    static bool ShouldSkipHdd(IHardware hw)
    {
        if (hw.HardwareType != HardwareType.Storage) return false;

        var ident = hw.Identifier?.ToString() ?? "";
        if (!ident.StartsWith("/hdd/", StringComparison.OrdinalIgnoreCase)) return false;

        if (HddRefreshInterval <= TimeSpan.Zero) return true;   // 永不自动读

        var now = DateTime.UtcNow;
        if (_hddLastUpdate.TryGetValue(ident, out var last) && (now - last) < HddRefreshInterval)
            return true;

        _hddLastUpdate[ident] = now;
        return false;
    }

    /// <summary>
    /// 手动刷新所有机械盘(POST /api/hdd-refresh)。
    /// 无视 HddRefreshInterval,把每块 HDD 强制 Update 一次并收集新值。
    /// ⚠️ 必须在 _lock 内调用(LHM 对象非线程安全)。
    /// </summary>
    static void ForceRefreshHdds()
    {
        if (_computer == null) return;
        foreach (var hw in _computer.Hardware)
        {
            var ident = hw.Identifier?.ToString() ?? "";
            if (!ident.StartsWith("/hdd/", StringComparison.OrdinalIgnoreCase)) continue;
            hw.Update();
        }
        Console.Error.WriteLine("[hwdash-sidecar] HDD manual refresh done");
    }

    static Dictionary<string, float> ReadRawSensors()
    {
        lock (_lock)
        {
            var raw = new Dictionary<string, float>();
            if (_computer == null) return raw;

            foreach (var hw in _computer.Hardware)
                UpdateAndCollect(hw, raw);

            return raw;
        }
    }

    /// <summary>
    /// 递归更新硬件并收集传感器。
    /// 关键:LHM 的 Motherboard.Update() 是空实现,不会级联到子硬件,
    /// 所以挂在主板下的 SuperIO(如 ITE IT8696E)子硬件必须靠这里手动递归更新,
    /// 否则其电压/温度/风扇传感器永远是 null、一个都读不到。
    /// (LHM 官方用法是 Computer.Accept(new UpdateVisitor()),此处等价手写。)
    /// </summary>
    static void UpdateAndCollect(IHardware hw, Dictionary<string, float> raw)
    {
        // 老机械盘降频 —— 见 ShouldSkipHdd()。
        // 跳过 Update() 时它的传感器值仍是上次读到的,照常收集即可。
        if (!ShouldSkipHdd(hw)) hw.Update();

        // raw 是字典,key 由 {硬件类型}/{硬件名}/... 拼成。
        // 硬盘(Storage)的"硬件名"就是型号字符串,两块同型号的盘会撞名、互相覆盖,
        // 所以这里给硬盘名追加 LHM 的唯一标识(LHM 的 Identifier 形如 "/nvme/0"、"/hdd/1",
        // 取末段数字做后缀 ⇒ "Samsung SSD 990 PRO 2TB #0"),保证 key 唯一。
        var hwName = hw.Name;
        if (hw.HardwareType == HardwareType.Storage)
        {
            var ident = hw.Identifier?.ToString() ?? "";
            var slash = ident.LastIndexOf('/');
            if (slash >= 0 && slash < ident.Length - 1)
                hwName = $"{hw.Name} #{ident.Substring(slash + 1)}";
        }

        foreach (var sensor in hw.Sensors)
        {
            if (sensor.Value.HasValue)
            {
                var key = $"{hw.HardwareType}/{hwName}/{sensor.SensorType}/{sensor.Name}";
                raw[key] = sensor.Value.Value;
            }
        }
        foreach (var sub in hw.SubHardware)
            UpdateAndCollect(sub, raw);
    }

    static Dictionary<string, string> ReadSensors()
    {
        lock (_lock)
        {
            if (_cachedData != null && _cachedRaw != null && (DateTime.UtcNow - _lastUpdate) < CacheTtl)
                return new Dictionary<string, string>(_cachedData);

            var raw = ReadRawSensors();
            var result = new Dictionary<string, string>();
            MapSensors(raw, result);

            _cachedData = result;
            _cachedRaw = raw;
            _lastUpdate = DateTime.UtcNow;
            return new Dictionary<string, string>(result);
        }
    }

    /// <summary>
    /// 从所有 GPU 传感器中筛选出首选(独显)GPU 的传感器。
    /// 优先级: NVIDIA > AMD RX系列 > AMD核显 > Intel
    /// </summary>
    static List<KeyValuePair<string, float>> GetPreferredGpuEntries(Dictionary<string, float> raw)
    {
        var allGpu = raw.Where(kv =>
            kv.Key.StartsWith("GpuNvidia/") ||
            kv.Key.StartsWith("GpuAmd/") ||
            kv.Key.StartsWith("GpuIntel/")).ToList();

        if (allGpu.Count == 0) return allGpu;

        // 获取所有独立 GPU 硬件前缀 (如 "GpuNvidia/NVIDIA GeForce RTX 5070 Ti")
        var gpuPrefixes = allGpu
            .Select(kv => string.Join("/", kv.Key.Split('/').Take(2)))
            .Distinct()
            .ToList();

        // 按优先级排序: NVIDIA > AMD RX > AMD其他 > Intel
        var preferred = gpuPrefixes
            .OrderBy(p =>
            {
                if (p.StartsWith("GpuNvidia/")) return 0;
                if (p.StartsWith("GpuAmd/") && (p.Contains("RX") || p.Contains("Radeon RX"))) return 1;
                if (p.StartsWith("GpuAmd/")) return 2;
                if (p.StartsWith("GpuIntel/")) return 3;
                return 4;
            })
            .First();

        return allGpu.Where(kv => kv.Key.StartsWith(preferred + "/")).ToList();
    }

    static void MapSensors(Dictionary<string, float> raw, Dictionary<string, string> result)
    {
        // ==================== CPU ====================
        var cpuEntries = raw.Where(kv => kv.Key.StartsWith("Cpu/")).ToList();
        // 主板条目提前取出:CPU 电压优先用主板的 Vcore(见下方说明)
        var moboEntries = raw.Where(kv => kv.Key.StartsWith("Motherboard/") ||
                                          kv.Key.StartsWith("SuperIO/")).ToList();

        // CPU 温度: Package > Core Average > Core Max > 所有Core平均
        var cpuTemp = cpuEntries.FirstOrDefault(kv =>
            kv.Key.Contains("/Temperature/CPU Package") ||
            kv.Key.Contains("/Temperature/Package") ||
            kv.Key.Contains("/Temperature/Core Average") ||
            kv.Key.Contains("/Temperature/Core (Tctl/Tdie)"));
        if (cpuTemp.Value > 0)
        {
            result["TCPU"] = cpuTemp.Value.ToString("F0", CultureInfo.InvariantCulture);
        }
        else
        {
            var coreAvgs = cpuEntries
                .Where(kv => kv.Key.Contains("/Temperature/Core Average"))
                .Select(kv => kv.Value)
                .ToList();
            var cores = cpuEntries
                .Where(kv => kv.Key.Contains("/Temperature/Core") && !kv.Key.Contains("Max") && !kv.Key.Contains("Average"))
                .Select(kv => kv.Value)
                .ToList();
            if (coreAvgs.Count > 0)
                result["TCPU"] = coreAvgs.Max().ToString("F0", CultureInfo.InvariantCulture);
            else if (cores.Count > 0)
                result["TCPU"] = cores.Average().ToString("F0", CultureInfo.InvariantCulture);
            else
                result["TCPU"] = "0";
        }

        // CPU 利用率: Total > Core Average > 所有Core平均
        var cpuLoad = cpuEntries.FirstOrDefault(kv =>
            kv.Key.Contains("/Load/CPU Total") ||
            kv.Key.Contains("/Load/Total") ||
            kv.Key.Contains("/Load/Core Average"));
        if (cpuLoad.Value > 0)
        {
            result["SCPUUTI"] = cpuLoad.Value.ToString("F1", CultureInfo.InvariantCulture);
        }
        else
        {
            var coreLoads = cpuEntries
                .Where(kv => kv.Key.Contains("/Load/Core") && !kv.Key.Contains("Max") && !kv.Key.Contains("Average"))
                .Select(kv => kv.Value)
                .ToList();
            result["SCPUUTI"] = coreLoads.Count > 0
                ? coreLoads.Average().ToString("F1", CultureInfo.InvariantCulture)
                : "0";
        }

        // CPU 单核最高负载:16 线程的平均值会把"有核在满载"这件事稀释掉
        // (实测平均 23.2% 的同时,单核最高 53.6%),这个数才反映真实压力。
        var cpuCoreMax = cpuEntries.FirstOrDefault(kv =>
            kv.Key.Contains("/Load/CPU Core Max") ||
            kv.Key.Contains("/Load/Core Max"));
        if (cpuCoreMax.Value > 0)
        {
            result["SCPUMAX"] = cpuCoreMax.Value.ToString("F1", CultureInfo.InvariantCulture);
        }
        else
        {
            var coreLoadsPeak = cpuEntries
                .Where(kv => kv.Key.Contains("/Load/Core") &&
                             !kv.Key.Contains("Max") &&
                             !kv.Key.Contains("Average") &&
                             !kv.Key.Contains("Total"))
                .Select(kv => kv.Value)
                .ToList();
            result["SCPUMAX"] = coreLoadsPeak.Count > 0
                ? coreLoadsPeak.Max().ToString("F1", CultureInfo.InvariantCulture)
                : "0";
        }

        // CPU 频率 (取最高核心频率)
        var cpuClocks = cpuEntries
            .Where(kv => kv.Key.Contains("/Clock/Core") && !kv.Key.Contains("Bus") && !kv.Key.Contains("Cache"))
            .Select(kv => kv.Value)
            .ToList();
        result["SCPUCLK"] = cpuClocks.Count > 0
            ? cpuClocks.Max().ToString("F0", CultureInfo.InvariantCulture)
            : (cpuEntries.FirstOrDefault(kv => kv.Key.Contains("/Clock/")).Value > 0
                ? cpuEntries.First(kv => kv.Key.Contains("/Clock/")).Value.ToString("F0", CultureInfo.InvariantCulture)
                : "0");

        // CPU 有效频率:上面那个是"最高请求频率"(核心向系统申请的频率),
        // 这个才是核心真正在跑的频率。取所有核里**最高**的那个有效频率
        // (LHM 的 key 形如 ".../Clock/Core #3 (Effective)"),
        // 不用 LHM 自带的 "Cores (Average Effective)" —— 那是平均值,轻载时会被其他核拉低。
        var effClocks = cpuEntries
            .Where(kv => kv.Key.Contains("/Clock/") &&
                         kv.Key.Contains("(Effective)") &&
                         !kv.Key.Contains("Cores (Average"))
            .Select(kv => kv.Value)
            .ToList();

        // 兜底:该 CPU 不暴露单核有效频率时,退回 LHM 的平均值
        if (effClocks.Count == 0)
        {
            var avgEff = cpuEntries.FirstOrDefault(kv =>
                kv.Key.Contains("/Clock/Cores (Average Effective)"));
            if (avgEff.Value > 0) effClocks.Add(avgEff.Value);
        }

        result["SCPUCLKEFF"] = effClocks.Count > 0
            ? effClocks.Max().ToString("F0", CultureInfo.InvariantCulture)
            : "0";

        // CPU 电压(Vcore):
        // LHM 对 Zen5(CPU model 0x44) 不暴露 SVI2 电压(源码里显式跳过),
        // 其 "Core #N VID" 是拿 SVI2 公式解码 Zen5 的 CurCpuVid,实测得 0.46V 这类
        // 物理上不可能的值,所以 CPU 侧的 VID 一律不可用。
        // 唯一可信来源是主板 SuperIO 的 Vcore(IT8696E 的 Voltage #1,实测 ~1.0V,
        // 与 AIDA64 快照的 VCPU=1.020 一致)。
        var moboVcore = moboEntries.FirstOrDefault(kv =>
            kv.Key.Contains("/Voltage/") &&
            (kv.Key.Contains("Vcore") || kv.Key.Contains("VCore")));
        if (moboVcore.Value <= 0)
        {
            // 兜底:LHM default 分支下电压传感器是通用占位名 "Voltage #1"
            moboVcore = moboEntries.FirstOrDefault(kv =>
                kv.Key.EndsWith("/Voltage/Voltage #1"));
        }
        result["VCPU"] = moboVcore.Value > 0
            ? moboVcore.Value.ToString("F3", CultureInfo.InvariantCulture)
            : "--";

        // CPU 功耗: Package > PPT > Core Power之和 > CPU Power
        var cpuPower = cpuEntries.FirstOrDefault(kv =>
            kv.Key.Contains("/Power/CPU Package") ||
            kv.Key.Contains("/Power/Package") ||
            kv.Key.Contains("/Power/PPT") ||
            kv.Key.Contains("/Power/CPU Power"));
        if (cpuPower.Value > 0)
        {
            result["PCPUPKG"] = cpuPower.Value.ToString("F1", CultureInfo.InvariantCulture);
        }
        else
        {
            var corePowers = cpuEntries
                .Where(kv => kv.Key.Contains("/Power/Core") && !kv.Key.Contains("Uncore"))
                .Select(kv => kv.Value)
                .ToList();
            result["PCPUPKG"] = corePowers.Count > 0
                ? corePowers.Sum().ToString("F1", CultureInfo.InvariantCulture)
                : (cpuEntries.FirstOrDefault(kv => kv.Key.Contains("/Power/")).Value > 0
                    ? cpuEntries.First(kv => kv.Key.Contains("/Power/")).Value.ToString("F1", CultureInfo.InvariantCulture)
                    : "0");
        }

        // ==================== 主板 (SuperIO: ITE IT8696E) ====================
        // 传感器挂在 "Motherboard/ITE IT8696E/" 下,名字是 LHM 的通用占位名
        // (Voltage #N / Temperature #N / Fan #N),语义按技嘉 IT8696E 标准映射对齐。
        // 依据:1) LHM 源码中同为 IT8696E 的 X870_AORUS_ELITE_WIFI7 分支即用此映射
        //         (System #1 / PCH / CPU / PCIe x16 / VRM MOS / EC);
        //       2) 实测交叉验证:Temperature #3=52 对应 AIDA64 的 TCPU=52,
        //         Voltage #1≈1.0 对应 AIDA64 的 VCPU=1.020,
        //         +3V Standby=3.288 与 AIDA64 的 V3VSB=3.288 完全一致。
        //   温度: #1=System #2=PCH #3=CPU #4=PCIe x16 #5=VRM MOS #6=EC
        //   风扇: #1=CPU Fan #2=System Fan #1 #3=System Fan #2 ...

        // 芯片组温度 (PCH):优先具体型号分支的语义名,兜底 default 的 Temperature #2
        var chipTemp = moboEntries.FirstOrDefault(kv =>
            kv.Key.Contains("/Temperature/") &&
            (kv.Key.Contains("PCH") || kv.Key.Contains("Chipset")));
        if (chipTemp.Value <= 0)
            chipTemp = moboEntries.FirstOrDefault(kv =>
                kv.Key.EndsWith("/Temperature/Temperature #2"));
        result["TCHIP"] = chipTemp.Value > 0
            ? chipTemp.Value.ToString("F0", CultureInfo.InvariantCulture)
            : "0";

        // VRM 温度:优先语义名,兜底 default 的 Temperature #5 (VRM MOS)
        var vrmTemp = moboEntries.FirstOrDefault(kv =>
            kv.Key.Contains("/Temperature/") &&
            (kv.Key.Contains("VRM") || kv.Key.Contains("Voltage Regulator")));
        if (vrmTemp.Value <= 0)
            vrmTemp = moboEntries.FirstOrDefault(kv =>
                kv.Key.EndsWith("/Temperature/Temperature #5"));
        result["TVRM"] = vrmTemp.Value > 0
            ? vrmTemp.Value.ToString("F0", CultureInfo.InvariantCulture)
            : "0";

        // CPU 风扇:优先语义名,兜底 default 的 Fan #1
        var cpuFan = moboEntries.FirstOrDefault(kv =>
            kv.Key.Contains("/Fan/") && kv.Key.Contains("CPU Fan"));
        if (cpuFan.Value <= 0)
            cpuFan = moboEntries.FirstOrDefault(kv =>
                kv.Key.EndsWith("/Fan/Fan #1"));
        result["FCPU"] = cpuFan.Value > 0
            ? cpuFan.Value.ToString("F0", CultureInfo.InvariantCulture)
            : "0";

        // 机箱风扇:优先语义名,兜底 default 的 Fan #2 (System Fan #1)
        var chassisFan = moboEntries.FirstOrDefault(kv =>
            kv.Key.Contains("/Fan/") &&
            (kv.Key.Contains("System Fan #1") || kv.Key.Contains("Chassis")));
        if (chassisFan.Value <= 0)
            chassisFan = moboEntries.FirstOrDefault(kv =>
                kv.Key.EndsWith("/Fan/Fan #2"));
        result["FCHA1"] = chassisFan.Value > 0
            ? chassisFan.Value.ToString("F0", CultureInfo.InvariantCulture)
            : "0";

        // ==================== GPU (优先独显) ====================
        var gpuEntries = GetPreferredGpuEntries(raw);

        if (gpuEntries.Count > 0)
        {
            // GPU 核心温度: 优先精确匹配 "GPU Core",再匹配 "Hot Spot",最后兜底 "GPU"
            var gpuTemp = gpuEntries.FirstOrDefault(kv =>
                kv.Key.Contains("/Temperature/GPU Core"));
            if (gpuTemp.Value <= 0)
                gpuTemp = gpuEntries.FirstOrDefault(kv =>
                    kv.Key.Contains("/Temperature/GPU Hot Spot"));
            if (gpuTemp.Value <= 0)
                gpuTemp = gpuEntries.FirstOrDefault(kv =>
                    kv.Key.Contains("/Temperature/GPU") &&
                    !kv.Key.Contains("Memory") && !kv.Key.Contains("Junction") &&
                    !kv.Key.Contains("VR SoC"));
            result["TGPU1"] = gpuTemp.Value > 0
                ? gpuTemp.Value.ToString("F0", CultureInfo.InvariantCulture)
                : "0";

            // GPU 显存/热点温度
            var gpuMemTemp = gpuEntries.FirstOrDefault(kv =>
                kv.Key.Contains("/Temperature/GPU Hot Spot") ||
                kv.Key.Contains("/Temperature/GPU Memory Junction") ||
                kv.Key.Contains("/Temperature/GPU Memory") ||
                kv.Key.Contains("/Temperature/Hot Spot") ||
                kv.Key.Contains("/Temperature/Memory"));
            // 过滤无效值(如255表示传感器未就绪)
            result["TGPU1MEM"] = (gpuMemTemp.Value > 0 && gpuMemTemp.Value < 250)
                ? gpuMemTemp.Value.ToString("F0", CultureInfo.InvariantCulture)
                : "0";

            // GPU 核心利用率: 优先精确匹配 "GPU Core",再匹配 D3D 3D
            var gpuLoad = gpuEntries.FirstOrDefault(kv =>
                kv.Key.Contains("/Load/GPU Core"));
            if (gpuLoad.Value <= 0)
                gpuLoad = gpuEntries.FirstOrDefault(kv =>
                    kv.Key.Contains("/Load/D3D 3D") || kv.Key.Contains("/Load/D3D"));
            if (gpuLoad.Value <= 0)
                gpuLoad = gpuEntries.FirstOrDefault(kv =>
                    kv.Key.Contains("/Load/GPU") && !kv.Key.Contains("Memory") &&
                    !kv.Key.Contains("Bus") && !kv.Key.Contains("Board") &&
                    !kv.Key.Contains("Power"));
            result["SGPU1UTI"] = gpuLoad.Value > 0
                ? gpuLoad.Value.ToString("F1", CultureInfo.InvariantCulture)
                : "0";

            // GPU 显存利用率
            var gpuMemLoad = gpuEntries.FirstOrDefault(kv =>
                kv.Key.Contains("/Load/GPU Memory") && !kv.Key.Contains("Controller"));
            if (gpuMemLoad.Value <= 0)
                gpuMemLoad = gpuEntries.FirstOrDefault(kv =>
                    kv.Key.Contains("/Load/Memory") || kv.Key.Contains("/Load/VRAM"));
            result["SVMEMUSAGE"] = gpuMemLoad.Value > 0
                ? gpuMemLoad.Value.ToString("F1", CultureInfo.InvariantCulture)
                : "0";

            // GPU 核心时钟
            var gpuClock = gpuEntries.FirstOrDefault(kv =>
                kv.Key.Contains("/Clock/GPU Core") ||
                kv.Key.Contains("/Clock/Core") ||
                kv.Key.Contains("/Clock/GPU Clock"));
            result["SGPU1CLK"] = gpuClock.Value > 0
                ? gpuClock.Value.ToString("F0", CultureInfo.InvariantCulture)
                : "0";

            // GPU 显存时钟
            var gpuMemClock = gpuEntries.FirstOrDefault(kv =>
                kv.Key.Contains("/Clock/GPU Memory") ||
                kv.Key.Contains("/Clock/Memory") ||
                kv.Key.Contains("/Clock/VRAM"));
            result["SGPU1MEMCLK"] = gpuMemClock.Value > 0
                ? gpuMemClock.Value.ToString("F0", CultureInfo.InvariantCulture)
                : "0";

            // GPU 功耗: GPU Package > GPU Power > GPU TGP > PPT > Board Power
            var gpuPower = gpuEntries.FirstOrDefault(kv =>
                kv.Key.Contains("/Power/GPU Package") ||
                kv.Key.Contains("/Power/GPU Power") ||
                kv.Key.Contains("/Power/GPU TGP") ||
                kv.Key.Contains("/Power/PPT") ||
                kv.Key.Contains("/Power/Board Power") ||
                kv.Key.Contains("/Power/Package Power") ||
                kv.Key.Contains("/Power/Power"));
            result["PGPU1"] = gpuPower.Value > 0
                ? gpuPower.Value.ToString("F1", CultureInfo.InvariantCulture)
                : "0";

            // GPU 核心功耗:注意 LHM 把 NVIDIA 的核心功耗挂在 Load 类别下(名字叫 "GPU Power"),
            // 不是 Power 类别 —— 这是 LHM 的历史遗留。它和上面的 "GPU Package"(整卡)是两个口径,
            // 空闲时差距明显(实测核心 ~13W / 整卡 ~40W)。
            var gpuCorePower = gpuEntries.FirstOrDefault(kv =>
                kv.Key.Contains("/Load/GPU Power") ||
                kv.Key.Contains("/Load/GPU Core Power"));
            result["PGPU1CORE"] = gpuCorePower.Value > 0
                ? gpuCorePower.Value.ToString("F1", CultureInfo.InvariantCulture)
                : "0";

            // GPU PCIe 吞吐(bytes/s → MB/s):显卡与 CPU 之间的实时搬运速率
            var pcieRx = gpuEntries.FirstOrDefault(kv =>
                kv.Key.Contains("/Throughput/GPU PCIe Rx") ||
                kv.Key.Contains("/Throughput/PCIe Rx"));
            result["SPCIE1RX"] = pcieRx.Value > 0
                ? Math.Round(pcieRx.Value / 1048576f, 2).ToString("F2", CultureInfo.InvariantCulture)
                : "0.00";

            var pcieTx = gpuEntries.FirstOrDefault(kv =>
                kv.Key.Contains("/Throughput/GPU PCIe Tx") ||
                kv.Key.Contains("/Throughput/PCIe Tx"));
            result["SPCIE1TX"] = pcieTx.Value > 0
                ? Math.Round(pcieTx.Value / 1048576f, 2).ToString("F2", CultureInfo.InvariantCulture)
                : "0.00";

            // GPU 电压
            var gpuVolt = gpuEntries.FirstOrDefault(kv =>
                kv.Key.Contains("/Voltage/GPU Core") ||
                kv.Key.Contains("/Voltage/Core") ||
                kv.Key.Contains("/Voltage/GPU Voltage"));
            result["VGPU1"] = gpuVolt.Value > 0
                ? gpuVolt.Value.ToString("F3", CultureInfo.InvariantCulture)
                : "0";

            // GPU 风扇 1 (优先 Fan 类型,再 Control 类型)
            var gpuFan1 = gpuEntries.FirstOrDefault(kv =>
                kv.Key.Contains("/Fan/GPU Fan") && !kv.Key.Contains("#2") && !kv.Key.Contains("Fan 2"));
            if (gpuFan1.Value <= 0)
                gpuFan1 = gpuEntries.FirstOrDefault(kv =>
                    (kv.Key.Contains("/Control/GPU Fan") || kv.Key.Contains("/Control/Fan")) &&
                    !kv.Key.Contains("#2") && !kv.Key.Contains("Fan 2"));
            result["DGPU1"] = gpuFan1.Value > 0
                ? gpuFan1.Value.ToString("F0", CultureInfo.InvariantCulture)
                : "0";

            // GPU 风扇 2
            var gpuFan2 = gpuEntries.FirstOrDefault(kv =>
                (kv.Key.Contains("/Fan/") || kv.Key.Contains("/Control/")) &&
                (kv.Key.Contains("Fan 2") || kv.Key.Contains("Fan #2")));
            result["DGPU1GPU2"] = gpuFan2.Value > 0
                ? gpuFan2.Value.ToString("F0", CultureInfo.InvariantCulture)
                : "0";

            // GPU 显存用量 (MB)
            var gpuMemUsed = gpuEntries.FirstOrDefault(kv =>
                (kv.Key.Contains("/SmallData/GPU Memory Used") ||
                 kv.Key.Contains("/SmallData/Memory Used") ||
                 kv.Key.Contains("/Data/GPU Memory Used") ||
                 kv.Key.Contains("/Data/Memory Used") ||
                 kv.Key.Contains("/SmallData/VRAM Used") ||
                 kv.Key.Contains("/Data/VRAM Used")) &&
                !kv.Key.Contains("Free") && !kv.Key.Contains("Total") && !kv.Key.Contains("Available"));
            result["SUSEDVMEM"] = gpuMemUsed.Value > 0
                ? Math.Round(gpuMemUsed.Value).ToString("F0", CultureInfo.InvariantCulture)
                : "0";

            // GPU 空闲显存 (MB)
            var gpuMemFree = gpuEntries.FirstOrDefault(kv =>
                kv.Key.Contains("/SmallData/GPU Memory Free") ||
                kv.Key.Contains("/SmallData/Memory Free") ||
                kv.Key.Contains("/Data/GPU Memory Free") ||
                kv.Key.Contains("/Data/Memory Free") ||
                kv.Key.Contains("/SmallData/GPU Memory Available") ||
                kv.Key.Contains("/Data/GPU Memory Available") ||
                kv.Key.Contains("/SmallData/VRAM Free") ||
                kv.Key.Contains("/Data/VRAM Free"));
            result["SFREEVEM"] = gpuMemFree.Value > 0
                ? Math.Round(gpuMemFree.Value).ToString("F0", CultureInfo.InvariantCulture)
                : "0";
        }
        else
        {
            foreach (var key in new[] {
                "TGPU1", "TGPU1MEM", "SGPU1UTI", "SVMEMUSAGE",
                "SGPU1CLK", "SGPU1MEMCLK", "PGPU1", "PGPU1CORE",
                "SPCIE1RX", "SPCIE1TX",
                "VGPU1", "DGPU1", "DGPU1GPU2", "SUSEDVMEM", "SFREEVEM"
            })
            {
                result.TryAdd(key, "0");
            }
        }

        // ==================== 系统内存 ====================
        // 注意: LibreHardwareMonitor 返回的内存值单位是 GB,不是 bytes
        // LHM 0.9.4+ 会同时输出 "Total Memory" 与 "Virtual Memory" 两组,
        // 两组都带 /Data/Memory Used 与 /Data/Memory Available,
        // 必须排除虚拟内存组,否则 FirstOrDefault 可能取到虚拟内存的数值。
        var ramEntries = raw
            .Where(kv => kv.Key.StartsWith("Memory/") &&
                         !kv.Key.StartsWith("Memory/Virtual"))
            .ToList();

        var memUsed = ramEntries.FirstOrDefault(kv =>
            kv.Key.Contains("/Data/Memory Used") ||
            kv.Key.Contains("/Data/Used Memory"));
        // LibreHardwareMonitor 返回 GB,转换为 MB
        result["SUSEDMEM"] = memUsed.Value > 0
            ? Math.Round(memUsed.Value * 1024f) // GB → MB
                .ToString("F0", CultureInfo.InvariantCulture)
            : "0";

        var memAvail = ramEntries.FirstOrDefault(kv =>
            kv.Key.Contains("/Data/Memory Available") ||
            kv.Key.Contains("/Data/Available Memory"));
        result["SFREEMEM"] = memAvail.Value > 0
            ? Math.Round(memAvail.Value * 1024f).ToString("F0", CultureInfo.InvariantCulture) // GB → MB
            : "0";

        // 内存条温度(DDR5 的 SPD Hub 温度传感器):插了几条就有几个。
        // LHM 的 key 形如 "Memory/Acer - BL.9BWWR.661 (#1)/Temperature/DIMM #1",
        // 只认传感器名里带 "DIMM" 的;必须排除 "Thermal Sensor * Limit" 那几条 ——
        // 它们同样是 Temperature 类型,但值是 55/85 这种规格上限,不是实测温度。
        var dimmTemps = raw
            .Where(kv => kv.Key.StartsWith("Memory/") &&
                         !kv.Key.StartsWith("Memory/Virtual") &&
                         kv.Key.Contains("/Temperature/DIMM"))
            .OrderBy(kv => kv.Key, StringComparer.OrdinalIgnoreCase)
            .Select(kv => kv.Value)
            .ToList();
        for (int i = 0; i < 4; i++)
        {
            result[$"TDIMM{i + 1}"] = (i < dimmTemps.Count && dimmTemps[i] > 0)
                ? dimmTemps[i].ToString("F1", CultureInfo.InvariantCulture)
                : "";
        }

        // ==================== 系统运行时间 ====================
        var uptimeSec = Environment.TickCount64 / 1000;
        var uptimeTs = TimeSpan.FromSeconds(uptimeSec);
        result["SUPTIME"] = $"{(int)uptimeTs.TotalDays}d {uptimeTs.Hours:D2}:{uptimeTs.Minutes:D2}:{uptimeTs.Seconds:D2}";

        // ==================== IP 地址 ====================
        result["SPRIIPADDR"] = GetPrimaryIP();

        // ==================== FPS ====================
        // 取"前台窗口那个应用"的实时帧率。
        // 两级来源:RTSS 共享内存(在跑时优先,帧统计是它自己挂钩时算好的) →
        // PresentMon(本机进程,ETW 外部观察,无注入)。
        result["SRTSSFPS"] = ReadRtssFps();
        if (result["SRTSSFPS"] == "0")
            result["SRTSSFPS"] = PresentMonBridge.GetFps();

        // ==================== 前台应用帧指标(PresentMon) ====================
        // 帧时间 / GPU忙时 / GPU延迟 / CPU忙时 —— 同样只统计前台进程。
        // PresentMon 没跑或前台无呈现活动时全部回落 "0",前端照常显示。
        result["SFRAMETIME"] = PresentMonBridge.GetMetric("frametime");
        result["SGPUBUSY"]   = PresentMonBridge.GetMetric("gpubusy");
        result["SGPULATENCY"] = PresentMonBridge.GetMetric("gpulatency");
        result["SCPUBUSY"]   = PresentMonBridge.GetMetric("cpubusy");

        // ==================== 硬盘 ====================
        MapStorageSensors(result);

        // ==================== 网络 ====================
        MapNetworkSensors(raw, result);
    }

    // ==================== FPS(RTSS 共享内存) ====================
    //
    // 为什么这么取:
    //   RTSS(RivaTuner Statistics Server)把每个被它挂钩的 3D 应用的帧统计写在一块
    //   名为 "RTSSSharedMemoryV2" 的共享内存里。以前这个值由 AIDA64 生产(它自己去
    //   读 RTSS),v0.3.0 换成自研 sidecar 后没人接了,于是这里一直写死 "0" ——
    //   前端 SRTSSFPS 永远显示 0 就是这个原因。
    //
    // 取谁的帧率:
    //   **前台窗口的进程**。一块屏幕上 RTSS 会同时挂钩好几个进程(浏览器、聊天软件、
    //   甚至 HWDash 自己的 WebView 都在跑 60fps),按"帧率最高"选会挑错人;
    //   按"当前前台"才等于"你正在玩的那个"。切到桌面/别的窗口自然回落到 0。
    //
    // 帧率怎么算:
    //   RTSS 每约 1 秒把该应用的 dwFrames 归零、把 dwTime0 挪到当前时刻,所以
    //   窗口内 FPS = dwFrames * 1000 / (dwTime1 - dwTime0)。分子分母同步增长,
    //   这个比值在整个窗口内都稳,不是瞬时抖动值。

    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern IntPtr OpenFileMapping(uint dwDesiredAccess, bool bInheritHandle, string lpName);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern IntPtr MapViewOfFile(IntPtr hFileMappingObject, uint dwDesiredAccess,
                                       uint dwFileOffsetHigh, uint dwFileOffsetLow,
                                       UIntPtr dwNumberOfBytesToMap);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool UnmapViewOfFile(IntPtr lpBaseAddress);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool CloseHandle(IntPtr hObject);

    /// <summary>
    /// 读 RTSS 共享内存里"前台应用"的实时 FPS,拿不到就返回 "0"。
    /// RTSS 未运行 / 前台应用没被挂钩 / 读到异常值,都安静回落到 "0"。
    /// </summary>
    static string ReadRtssFps()
    {
        const uint FILE_MAP_READ = 0x0004;

        var hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero) return "0";
        GetWindowThreadProcessId(hwnd, out var fgPid);
        if (fgPid == 0) return "0";

        var hMap = OpenFileMapping(FILE_MAP_READ, false, "RTSSSharedMemoryV2");
        if (hMap == IntPtr.Zero) return "0";   // RTSS 没在跑

        IntPtr view = IntPtr.Zero;
        try
        {
            // 映射整个 section 但**不复制**数据,只按偏移读需要的几个 DWORD,
            // 所以哪怕 section 有几 MB 也不影响采集耗时。
            view = MapViewOfFile(hMap, FILE_MAP_READ, 0, 0, UIntPtr.Zero);
            if (view == IntPtr.Zero) return "0";

            // 头部(RTSS_SHARED_MEMORY,各版本布局稳定):
            //   0 dwSignature / 4 dwVersion / 8 dwAppEntrySize /
            //   12 dwAppArrOffset / 16 dwAppArrSize / 20 dwOSDEntrySize ...
            int appEntrySize = Marshal.ReadInt32(view, 8);
            int appArrOffset = Marshal.ReadInt32(view, 12);
            int appArrSize = Marshal.ReadInt32(view, 16);
            if (appEntrySize <= 0 || appArrSize <= 0) return "0";

            for (int i = 0; i < appArrSize; i++)
            {
                int off = appArrOffset + i * appEntrySize;

                // 应用条目(RTSS_SHARED_MEMORY_APP_ENTRY):
                //   0 dwProcessID / 4 szName[260] / 264 dwFlags /
                //   268 dwTime0 / 272 dwTime1 / 276 dwFrames / 280 dwFrameTime
                int pid = Marshal.ReadInt32(view, off);
                if (pid != (int)fgPid) continue;

                uint t0 = (uint)Marshal.ReadInt32(view, off + 268);
                uint t1 = (uint)Marshal.ReadInt32(view, off + 272);
                uint frames = (uint)Marshal.ReadInt32(view, off + 276);
                if (t1 <= t0 || frames == 0) return "0";

                double fps = frames * 1000.0 / (t1 - t0);
                if (fps <= 0 || fps > 10000) return "0";   // 防异常值
                return fps.ToString("F0", CultureInfo.InvariantCulture);
            }

            return "0";   // 前台应用没被 RTSS 挂钩
        }
        catch
        {
            return "0";
        }
        finally
        {
            if (view != IntPtr.Zero) UnmapViewOfFile(view);
            CloseHandle(hMap);
        }
    }

    /// <summary>
    /// 硬盘温度 + 盘符。
    /// 直接遍历 Computer.Hardware 里的 Storage 硬件,不走 raw 传感器字典 ——
    /// 因为读不到温度时该硬件在 raw 里一条记录都没有(会被误判成"这块盘不存在"),
    /// 而型号名一定要能拿到。
    ///
    /// ⚠️ LHM 枚举硬盘的顺序**不等于**物理磁盘号顺序(实测磁盘 0~3 出来的顺序是 2,3,1,0),
    /// 所以盘符不能按输出序号猜,必须用 LHM 的 Identifier 末段(实测等于物理磁盘号)
    /// 去查 WMI 的"物理磁盘号 → 盘符"映射表。
    ///
    /// 输出 TDISK1..8(温度) / SDISK1..8NAME(型号) / SDISK1..8LETTER(盘符,如 "C:")。
    /// </summary>
    static void MapStorageSensors(Dictionary<string, string> result)
    {
        if (_computer == null) return;

        var letters = GetDiskLetters();
        var disks = new List<(string Model, string Letter, string Temp, string Read, string Write)>();

        foreach (var hw in _computer.Hardware)
        {
            if (hw.HardwareType != HardwareType.Storage) continue;

            // LHM 的 Identifier 形如 "/nvme/2"、"/hdd/0",末段数字即物理磁盘号
            var ident = hw.Identifier?.ToString() ?? "";
            var slash = ident.LastIndexOf('/');
            var diskNo = slash >= 0 && int.TryParse(ident.Substring(slash + 1), out var n) ? n : -1;
            var letter = diskNo >= 0 && letters.TryGetValue(diskNo, out var l) ? l : "";

            // 温度:优先叫 "Temperature" 的,其次是 NVMe 的 "Composite Temperature";
            // 必须排除 Warning/Critical 这类**阈值**传感器 —— 它们也是 Temperature 类型,
            // 值可能是 85 这种上限,误取会让面板显示一个假的"温度"。
            var temp = hw.Sensors.FirstOrDefault(s =>
                s.SensorType == SensorType.Temperature && s.Name == "Temperature");
            if (temp == null)
                temp = hw.Sensors.FirstOrDefault(s =>
                    s.SensorType == SensorType.Temperature && s.Name == "Composite Temperature");
            if (temp == null)
                temp = hw.Sensors.FirstOrDefault(s =>
                    s.SensorType == SensorType.Temperature &&
                    !s.Name.Contains("Warning") && !s.Name.Contains("Critical") &&
                    !s.Name.Contains("Threshold") && !s.Name.Contains("Limit"));

            // 实时读写速率:LHM 单位是 bytes/s,这里换算成 MB/s。
            // 硬盘读写动辄几十~几千 MB/s,用 MB/s 数字最短;空闲时就是 0.0。
            var readRate = hw.Sensors.FirstOrDefault(s =>
                s.SensorType == SensorType.Throughput && s.Name == "Read Rate");
            var writeRate = hw.Sensors.FirstOrDefault(s =>
                s.SensorType == SensorType.Throughput && s.Name == "Write Rate");

            disks.Add((
                hw.Name.Trim(),
                letter,
                (temp?.Value.HasValue == true && temp.Value.Value > 0)
                    ? temp.Value.Value.ToString("F0", CultureInfo.InvariantCulture)
                    : "--",
                (readRate?.Value.HasValue == true && readRate.Value.Value > 0)
                    ? (readRate.Value.Value / 1048576f).ToString("F1", CultureInfo.InvariantCulture)
                    : "0.0",
                (writeRate?.Value.HasValue == true && writeRate.Value.Value > 0)
                    ? (writeRate.Value.Value / 1048576f).ToString("F1", CultureInfo.InvariantCulture)
                    : "0.0"
            ));
        }

        // 按盘符字母升序排(C: → D: → E: → G:);没盘符的排最后、按型号名排。
        // 必须排 —— LHM 枚举硬盘的顺序跟物理磁盘号没关系(实测是 2,3,1,0),
        // 不排的话面板上的格子顺序是乱的。
        disks.Sort((a, b) =>
        {
            var ha = !string.IsNullOrEmpty(a.Letter);
            var hb = !string.IsNullOrEmpty(b.Letter);
            if (ha && hb) return string.Compare(a.Letter, b.Letter, StringComparison.OrdinalIgnoreCase);
            if (ha != hb) return ha ? -1 : 1;
            return string.Compare(a.Model, b.Model, StringComparison.OrdinalIgnoreCase);
        });

        int idx = 1;
        foreach (var d in disks)
        {
            if (idx > 8) break;
            result[$"SDISK{idx}NAME"] = d.Model;
            result[$"SDISK{idx}LETTER"] = d.Letter;
            result[$"TDISK{idx}"] = d.Temp;
            result[$"SDISK{idx}R"] = d.Read;
            result[$"SDISK{idx}W"] = d.Write;
            idx++;
        }
    }

    static Dictionary<int, string>? _diskLettersCache;

    /// <summary>
    /// 物理磁盘号 → 盘符(如 2 → "C:")。
    /// 走 WMI 两级关联:Win32_DiskDrive → Win32_DiskPartition → Win32_LogicalDisk。
    /// 盘符基本不会变,只查一次并缓存(插拔硬盘后重启程序即可)。
    /// 查不到就返回空表,调用方把盘符留空。
    /// </summary>
    static Dictionary<int, string> GetDiskLetters()
    {
        if (_diskLettersCache != null) return _diskLettersCache;

        var map = new Dictionary<int, string>();
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT * FROM Win32_DiskDrive");
            using var disks = searcher.Get();
            foreach (ManagementObject disk in disks)
            {
                using (disk)
                {
                    if (disk["Index"] == null) continue;
                    var index = Convert.ToInt32(disk["Index"]);

                    foreach (ManagementObject part in disk.GetRelated("Win32_DiskPartition"))
                    {
                        using (part)
                        {
                            foreach (ManagementObject vol in part.GetRelated("Win32_LogicalDisk"))
                            {
                                using (vol)
                                {
                                    var letter = vol["DeviceID"] as string;
                                    if (!string.IsNullOrEmpty(letter) && !map.ContainsKey(index))
                                        map[index] = letter;
                                }
                            }
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[hwdash-sidecar] Disk letter lookup failed: {ex.Message}");
        }

        _diskLettersCache = map;
        return map;
    }

    static HashSet<string>? _physicalNicCache;

    /// <summary>
    /// 取"真实物理网卡"的连接名集合(如 "WLAN"、"Realtek PCIe 2.5G")。
    ///
    /// 判据:Win32_NetworkAdapter 的 PNPDeviceID 以 PCI\ 或 USB\ 开头 ——
    /// 这两类是真插在总线上的网卡(板载/独立 PCIe 网卡、USB 网卡)。虚拟适配器各有别的前缀:
    ///   BTH\  = 蓝牙 PAN(没人拿蓝牙上网)
    ///   SWD\  = 软件设备(Wintun / Mihomo 这类代理 TUN)
    ///   ROOT\ = 根枚举虚拟适配器(热点、Wi-Fi Direct、"本地连接* N")
    ///
    /// ⚠️ 不能用 Win32_NetworkAdapter 的 PhysicalAdapter 属性来判断 ——
    ///    实测它把"蓝牙网络连接"和"Mihomo"都标成了 True。
    ///
    /// 查询失败或一个都没查到时返回 null,调用方按"不过滤"处理(宁可多显示,不能全藏)。
    /// </summary>
    static HashSet<string>? GetPhysicalNicNames()
    {
        if (_physicalNicCache != null) return _physicalNicCache;

        try
        {
            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            using var searcher = new ManagementObjectSearcher(
                "SELECT NetConnectionID, PNPDeviceID FROM Win32_NetworkAdapter");
            using var results = searcher.Get();
            foreach (ManagementObject obj in results)
            {
                var connId = obj["NetConnectionID"] as string;
                var pnp = obj["PNPDeviceID"] as string;
                if (string.IsNullOrWhiteSpace(connId) || string.IsNullOrWhiteSpace(pnp)) continue;
                if (pnp.StartsWith("PCI\\", StringComparison.OrdinalIgnoreCase) ||
                    pnp.StartsWith("USB\\", StringComparison.OrdinalIgnoreCase))
                {
                    names.Add(connId.Trim());
                }
            }

            if (names.Count == 0) return null;
            _physicalNicCache = names;
            return names;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[hwdash-sidecar] Physical NIC lookup failed: {ex.Message}");
            return null;
        }
    }

    static void MapNetworkSensors(Dictionary<string, float> raw, Dictionary<string, string> result)
    {
        var netEntries = raw.Where(kv =>
            kv.Key.StartsWith("Network/") || kv.Key.StartsWith("Ethernet/")).ToList();

        // 只留真实物理网卡:代理 TUN、蓝牙 PAN、热点 / Wi-Fi Direct 这类虚拟适配器全部剔掉。
        // 判据见 GetPhysicalNicNames;它返回 null(查询失败)时不过滤,避免把整块网络卡片清空。
        var physicalNics = GetPhysicalNicNames();

        int nicIdx = 1;
        var groups = netEntries
            .GroupBy(kv =>
            {
                var parts = kv.Key.Split('/');
                return parts.Length >= 2 ? parts[1] : "Unknown";
            })
            .Where(g => physicalNics == null || physicalNics.Contains(g.Key))
            .OrderBy(g => g.Key);

        foreach (var group in groups)
        {
            string prefix = $"SNIC{nicIdx}";

            // 网卡真名 —— 前端菜单直接显示它,不再用 "NIC 1 / NIC 2" 这种编号
            // (编号是按网卡名现排的,网卡数量一变(6↔5)整体错位,选中项会漂移)。
            result[$"{prefix}NAME"] = group.Key;

            // 下载速率 (LibreHardwareMonitor 返回 bytes/s,转换为 KB/s)
            var dlRate = group.FirstOrDefault(kv =>
                kv.Key.Contains("/Throughput/Download") ||
                kv.Key.Contains("/Load/Download Speed") ||
                kv.Key.Contains("/Data/Download Speed"));
            result[$"{prefix}DLRATE"] = dlRate.Value > 0
                ? Math.Round(dlRate.Value / 1024f, 2).ToString("F2", CultureInfo.InvariantCulture)
                : "0.00";

            // 上传速率 (KB/s)
            var ulRate = group.FirstOrDefault(kv =>
                kv.Key.Contains("/Throughput/Upload") ||
                kv.Key.Contains("/Load/Upload Speed") ||
                kv.Key.Contains("/Data/Upload Speed"));
            result[$"{prefix}ULRATE"] = ulRate.Value > 0
                ? Math.Round(ulRate.Value / 1024f, 2).ToString("F2", CultureInfo.InvariantCulture)
                : "0.00";

            // 累计下载 (LibreHardwareMonitor 返回 GB,转换为 MB)
            var totDownload = group.FirstOrDefault(kv =>
                kv.Key.Contains("/Data/Data Downloaded") ||
                kv.Key.Contains("/Data/Download") ||
                kv.Key.Contains("/Data/Total Received") ||
                kv.Key.Contains("/Data/Received"));
            result[$"{prefix}TOTDL"] = totDownload.Value > 0
                ? Math.Round(totDownload.Value * 1024f, 1).ToString("F1", CultureInfo.InvariantCulture) // GB → MB
                : "0.0";

            nicIdx++;
        }

        if (nicIdx == 1)
        {
            result["SNIC1DLRATE"] = "0.00";
            result["SNIC1ULRATE"] = "0.00";
            result["SNIC1TOTDL"] = "0.0";
        }
    }

    /// <summary>
    /// 取本机首选 IPv4 地址。
    /// 按"局域网可达性"排序:192.168.x.x > 10.x.x.x > 172.16-31.x.x > 其他,
    /// 并排除回环、APIPA(169.254)、以及代理软件的 TUN 虚拟段(198.18.0.0/15, Mihomo 等会占用)。
    /// </summary>
    static string GetPrimaryIP()
    {
        try
        {
            var candidates = new List<IPAddress>();

            foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (ni.OperationalStatus != OperationalStatus.Up) continue;
                if (ni.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
                if (ni.NetworkInterfaceType == NetworkInterfaceType.Tunnel) continue;

                foreach (var ua in ni.GetIPProperties().UnicastAddresses)
                {
                    var ip = ua.Address;
                    if (ip.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork) continue;
                    if (IPAddress.IsLoopback(ip)) continue;

                    var b = ip.GetAddressBytes();
                    if (b[0] == 169 && b[1] == 254) continue;          // APIPA
                    if (b[0] == 198 && (b[1] == 18 || b[1] == 19)) continue; // TUN 虚拟段

                    candidates.Add(ip);
                }
            }

            if (candidates.Count == 0) return "127.0.0.1";

            return candidates
                .OrderBy(ip =>
                {
                    var b = ip.GetAddressBytes();
                    if (b[0] == 192 && b[1] == 168) return 0;                  // 家用/办公局域网
                    if (b[0] == 10) return 1;                                  // 大型内网
                    if (b[0] == 172 && b[1] >= 16 && b[1] <= 31) return 2;     // 私有段
                    if (b[0] == 100 && b[1] >= 64 && b[1] <= 127) return 4;    // CGNAT
                    return 3;
                })
                .ThenBy(ip => ip.ToString(), StringComparer.Ordinal)
                .First()
                .ToString();
        }
        catch { }
        return "127.0.0.1";
    }
}

/// <summary>
/// PresentMon 桥:后台子进程抓全局呈现事件,按前台进程过滤,提供 FPS/帧时间/GPU忙/延迟。
///
/// 设计要点:
///   - PresentMon 走 ETW(内核事件追踪)从系统外部观察呈现,不注入、不钩任何
///     渲染 API —— 不会重蹈 RTSSHooks64 冻窗口的覆辙。需要管理员权限,
///     而 sidecar 本来就以管理员跑(LHM 读 CPU 温度就要),权限天然满足。
///   - 抓"全部进程"而不是 --process_name 指定目标:前台窗口随焦点切换,
///     逐个重启 PresentMon 子进程切换目标会丢帧且费劲;全局抓再在内存里
///     按前台 PID 过滤,切焦点零成本。
///   - 帧指标只对"有呈现活动的进程"有意义。浏览器/webview 也呈现(60fps),
///     但切到它们看帧时间同样成立 —— 跟 RTSS 共享内存法"取前台"语义一致。
///
/// 数据管线:
///   PresentMon64 --output_stdout --no_console_stats --no_track_gpu 不行 ——
///   GPU 忙时/延迟必须有 --track 默认的 GPU 段。标准参数跑起,CSV 逐行进
///   _framesPerPid[pid] 环形队列(约 2 秒窗口),查询时只取前台 PID。
///
/// 健壮性:
///   - PresentMon64.exe 找不到 ⇒ 永不启动,所有指标返回 "0"(安静降级)。
///   - 子进程死了(被杀/崩溃) ⇒ 下轮查询发现输出流关闭,自动重启(限频)。
///   - 前台进程无呈现(桌面/资源管理器) ⇒ 队列里没它的帧,返回 "0"。
///   - 一切异常吞掉返回 "0",绝不让 FPS 这种锦上添花的指标拖垮整个 /api/hardware。
/// </summary>
static class PresentMonBridge
{
    // user32 前台窗口查询(P/Invoke,Program 类里也有一份 —— static class 不共享,
    // 各自声明各自的,合并进 Program 会把 PresentMon 的文件 IO 类型全拽进去,不值得)。
    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    // PresentMon64.exe 的查找顺序:sidecar 同目录 → D:\tools(寒哥机器的现成位置) → PATH。
    // 打进安装包时不带 PresentMon(体积 + 许可),靠环境里已有的副本。
    static readonly string[] ExeCandidates =
    {
        Path.Combine(AppContext.BaseDirectory, "PresentMon64.exe"),
        @"D:\tools\PresentMon64.exe",
    };

    // ─── Job Object:把 PresentMon 子进程绑死在 sidecar 上 ───────────────
    //
    // 血的教训(2026-10-27 实机):测试脚本 kill 了 sidecar,PresentMon 变成孤儿,
    // 它开的全局 ETW 实时会话一直挂着、CSV 也没人读 —— 之后系统每隔一段时间
    // 整体卡一分多钟,装 HWDash 时每点一步卡 1 分钟。杀掉孤儿进程 + 停掉 ETW
    // 会话后才恢复。
    //
    // 而且 HWDash 覆盖安装时必然强杀 sidecar(提权进程杀不动,只能由安装器
    // 结束),不走正常退出 —— 只靠 ProcessExit 事件根本兜不住。所以用
    // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE:job 句柄随 sidecar 进程一起消亡,
    // 内核负责把子进程一并干掉。sidecar 哪怕被 TerminateProcess 强杀,
    // PresentMon 也活不下来。
    const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;
    const int JobObjectExtendedLimitInformation = 9;

    [StructLayout(LayoutKind.Sequential)]
    struct JOBOBJECT_BASIC_LIMIT_INFORMATION
    {
        public long PerProcessUserTimeLimit;
        public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize;
        public UIntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct IO_COUNTERS
    {
        public ulong ReadOperationCount;
        public ulong WriteOperationCount;
        public ulong OtherOperationCount;
        public ulong ReadTransferCount;
        public ulong WriteTransferCount;
        public ulong OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
    {
        public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
        public IO_COUNTERS IoInfo;
        public UIntPtr ProcessMemoryLimit;
        public UIntPtr JobMemoryLimit;
        public UIntPtr PeakProcessMemoryUsed;
        public UIntPtr PeakJobMemoryUsed;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string? lpName);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool SetInformationJobObject(IntPtr hJob, int infoClass,
        ref JOBOBJECT_EXTENDED_LIMIT_INFORMATION lpInfo, uint cbInfoLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

    static IntPtr _jobHandle = IntPtr.Zero;

    /// <summary>懒创建 job(sidecar 整个生命周期一个)。失败就退化成普通子进程。</summary>
    static IntPtr EnsureJob()
    {
        if (_jobHandle != IntPtr.Zero) return _jobHandle;

        var job = CreateJobObject(IntPtr.Zero, null);
        if (job == IntPtr.Zero)
        {
            Console.Error.WriteLine($"[hwdash-sidecar] CreateJobObject failed: {Marshal.GetLastWin32Error()}");
            return IntPtr.Zero;
        }

        var info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if (!SetInformationJobObject(job, JobObjectExtendedLimitInformation, ref info,
                (uint)Marshal.SizeOf<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>()))
        {
            Console.Error.WriteLine($"[hwdash-sidecar] SetInformationJobObject failed: {Marshal.GetLastWin32Error()}");
        }

        _jobHandle = job;
        return job;
    }

    static Process? _proc;
    static StreamReader? _stdout;
    static readonly object _lock = new();
    static DateTime _lastRestartAttempt = DateTime.MinValue;
    static string[] _csvColumns = Array.Empty<string>();

    // pid → 帧时间戳(ms,双端队列)。查询时只看前台 pid,其余留着也不占多少内存
    // (每个呈现进程每秒最多 ~240 帧 × 3 个小数组)。
    static readonly Dictionary<uint, Queue<FrameRow>> _framesPerPid = new();

    readonly struct FrameRow
    {
        public readonly double MsBetweenPresents;
        public readonly double MsGPUBusy;
        public readonly double MsGPULatency;
        public readonly double MsCPUBusy;

        public FrameRow(double presents, double gpuBusy, double gpuLatency, double cpuBusy)
        {
            MsBetweenPresents = presents;
            MsGPUBusy = gpuBusy;
            MsGPULatency = gpuLatency;
            MsCPUBusy = cpuBusy;
        }
    }

    static bool TryFindExe(out string exe)
    {
        foreach (var candidate in ExeCandidates)
        {
            if (File.Exists(candidate)) { exe = candidate; return true; }
        }
        exe = "";
        return false;
    }

    /// <summary>确保 PresentMon 子进程在跑;没跑且能找到 exe 就拉起。限频重启。</summary>
    static void EnsureRunning()
    {
        if (_proc != null && !_proc.HasExited) return;

        if ((DateTime.UtcNow - _lastRestartAttempt) < TimeSpan.FromSeconds(10)) return;
        _lastRestartAttempt = DateTime.UtcNow;

        if (!TryFindExe(out var exe)) return;

        try
        {
            _framesPerPid.Clear();
            _csvColumns = Array.Empty<string>();

            var psi = new ProcessStartInfo
            {
                FileName = exe,
                // --session_name:独占自己的 ETW 会话名。用默认名 "PresentMon" 的话,
                // 用户自己开着的 PresentMon(或历史孤儿留下的会话)会撞名,启动直接失败。
                // --stop_existing_session:上次被强杀留下的同名会话先停掉再接管,
                // 否则残留会话会一直以 Running 状态在系统里空转采集。
                Arguments = "--output_stdout --no_console_stats --no_track_input " +
                            "--session_name hwdash-fps --stop_existing_session",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
            };
            _proc = Process.Start(psi);
            if (_proc == null) return;

            // 立刻塞进 job:此后 sidecar 无论正常退出还是被强杀,它都跟着死。
            var job = EnsureJob();
            if (job != IntPtr.Zero && !AssignProcessToJobObject(job, _proc.Handle))
            {
                Console.Error.WriteLine($"[hwdash-sidecar] AssignProcessToJobObject failed: {Marshal.GetLastWin32Error()}");
            }

            _stdout = _proc.StandardOutput;
            // stderr 不读会塞满管道缓冲 → 子进程卡死;丢给后台线程排空。
            _ = Task.Run(() => { try { _proc.StandardError.ReadToEnd(); } catch { } });

            var reader = new Thread(ReadLoop) { IsBackground = true, Name = "presentmon-csv" };
            reader.Start();
            Console.Error.WriteLine("[hwdash-sidecar] PresentMon started (PID " + _proc.Id + ")");
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[hwdash-sidecar] PresentMon start failed: {ex.Message}");
            _proc = null;
            _stdout = null;
        }
    }

    /// <summary>
    /// CSV 读取循环:第一行是表头(列序各版本可能不同,按表头建列索引),
    /// 之后每行按索引取值,塞进对应 pid 的队列。队列保留约 2 秒的帧。
    /// </summary>
    static void ReadLoop()
    {
        var stdout = _stdout;
        if (stdout == null) return;

        try
        {
            string? header = stdout.ReadLine();
            if (header != null)
                _csvColumns = header.Split(',');

            int colPid = IndexOf("ProcessID");
            int colPresents = IndexOf("MsBetweenPresents");
            int colGpuBusy = IndexOf("MsGPUBusy");
            int colGpuLatency = IndexOf("MsGPULatency");
            int colCpuBusy = IndexOf("MsCPUBusy");
            // 关键列全缺就别白读了
            if (colPid < 0 || colPresents < 0) return;

            string? line;
            while ((line = stdout.ReadLine()) != null)
            {
                if (line.Length == 0) continue;
                var f = line.Split(',');
                if (f.Length < _csvColumns.Length) continue;
                if (!uint.TryParse(f[colPid], out var pid)) continue;
                if (!TryDouble(f, colPresents, out var presents)) continue;

                TryDouble(f, colGpuBusy, out var gpuBusy);
                TryDouble(f, colGpuLatency, out var gpuLatency);
                TryDouble(f, colCpuBusy, out var cpuBusy);

                lock (_lock)
                {
                    if (!_framesPerPid.TryGetValue(pid, out var q))
                    {
                        q = new Queue<FrameRow>();
                        _framesPerPid[pid] = q;
                    }
                    q.Enqueue(new FrameRow(presents, gpuBusy, gpuLatency, cpuBusy));

                    // 修剪:保留约 2 秒窗口(按帧间隔累计)。1 秒就够算指标,
                    // 取 2 秒是给慢速呈现(桌面 30fps)留余量。
                    var kept = 0.0;
                    var arr = q.ToArray();
                    for (int i = arr.Length - 1; i >= 0; i--)
                    {
                        kept += arr[i].MsBetweenPresents;
                        if (kept > 2000)
                        {
                            // 把更早的全丢掉:队列长度 = i+1
                            while (q.Count > i + 1) q.Dequeue();
                            break;
                        }
                    }
                }
            }
        }
        catch
        {
            // 流关闭(子进程退出) ⇒ EnsureRunning 下轮查询会重启。
        }
    }

    static int IndexOf(string column)
    {
        for (int i = 0; i < _csvColumns.Length; i++)
            if (string.Equals(_csvColumns[i], column, StringComparison.OrdinalIgnoreCase))
                return i;
        return -1;
    }

    static bool TryDouble(string[] f, int col, out double v)
    {
        v = 0;
        if (col < 0 || col >= f.Length) return false;
        return double.TryParse(f[col], NumberStyles.Float, CultureInfo.InvariantCulture, out v) && v > 0;
    }

    /// <summary>
    /// 查询指标。metric ∈ { fps, frametime, gpubusy, gpulatency, cpubusy }。
    /// 取当前前台窗口进程,在它的帧队列上按窗口尾部约 1 秒的帧算指标。
    /// </summary>
    static string Query(string metric)
    {
        EnsureRunning();
        if (_proc == null || _proc.HasExited) return "0";

        var hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero) return "0";
        GetWindowThreadProcessId(hwnd, out var fgPid);
        if (fgPid == 0) return "0";

        lock (_lock)
        {
            if (!_framesPerPid.TryGetValue(fgPid, out var q) || q.Count < 2)
                return "0";

            // 取尾部累计约 1 秒的帧(至少 2 帧)。
            var frames = new List<FrameRow>();
            var acc = 0.0;
            var arr = q.ToArray();
            for (int i = arr.Length - 1; i >= 0; i--)
            {
                frames.Add(arr[i]);
                acc += arr[i].MsBetweenPresents;
                if (acc >= 1000) break;
            }
            if (frames.Count < 2) return "0";

            double value;
            switch (metric)
            {
                case "fps":
                    // FPS = 窗口内帧数 / 窗口时长
                    value = frames.Count * 1000.0 / acc;
                    break;
                case "frametime":
                    value = arr[arr.Length - 1].MsBetweenPresents;
                    break;
                case "gpubusy":
                    value = frames.Average(fr => fr.MsGPUBusy);
                    break;
                case "gpulatency":
                    value = frames.Average(fr => fr.MsGPULatency);
                    break;
                case "cpubusy":
                    value = frames.Average(fr => fr.MsCPUBusy);
                    break;
                default:
                    return "0";
            }

            if (value <= 0 || value > 100000) return "0";
            return value.ToString("F1", CultureInfo.InvariantCulture);
        }
    }

    public static string GetFps() => Query("fps");
    public static string GetMetric(string metric) => Query(metric);
}
