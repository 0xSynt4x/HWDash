using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
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
    static readonly TimeSpan CacheTtl = TimeSpan.FromMilliseconds(900);

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
            IsStorageEnabled = false,
        };
        _computer.Open();

        // 传感器首次更新较慢,需要多次采样
        for (int i = 0; i < 5; i++)
        {
            foreach (var hw in _computer.Hardware)
                hw.Update();
            Thread.Sleep(200);
        }

        var port = args.Length > 0 && int.TryParse(args[0], out var p) ? p : DefaultPort;
        using var listener = new HttpListener();
        try
        {
            listener.Prefixes.Add($"http://localhost:{port}/");
            listener.Start();
        }
        catch (HttpListenerException ex)
        {
            Console.Error.WriteLine($"[hwdash-sidecar] Failed to bind port {port}: {ex.Message}");
            port = DefaultPort + 1;
            listener.Prefixes.Clear();
            listener.Prefixes.Add($"http://localhost:{port}/");
            listener.Start();
        }

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

    static Dictionary<string, float> ReadRawSensors()
    {
        lock (_lock)
        {
            var raw = new Dictionary<string, float>();
            if (_computer == null) return raw;

            foreach (var hw in _computer.Hardware)
            {
                hw.Update();
                foreach (var sensor in hw.Sensors)
                {
                    if (sensor.Value.HasValue)
                    {
                        var key = $"{hw.HardwareType}/{hw.Name}/{sensor.SensorType}/{sensor.Name}";
                        raw[key] = sensor.Value.Value;
                    }
                }
            }
            return raw;
        }
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

        // CPU 电压: 优先 CPU Core / VCore,否则第一个电压传感器
        var cpuVolt = cpuEntries.FirstOrDefault(kv =>
            kv.Key.Contains("/Voltage/CPU Core") ||
            kv.Key.Contains("/Voltage/VCore") ||
            kv.Key.Contains("/Voltage/Core VID") ||
            kv.Key.Contains("/Voltage/VID") ||
            kv.Key.Contains("/Voltage/Voltage"));
        result["VCPU"] = cpuVolt.Value > 0
            ? cpuVolt.Value.ToString("F3", CultureInfo.InvariantCulture)
            : (cpuEntries.FirstOrDefault(kv => kv.Key.Contains("/Voltage/")).Value > 0
                ? cpuEntries.First(kv => kv.Key.Contains("/Voltage/")).Value.ToString("F3", CultureInfo.InvariantCulture)
                : "0");

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

        // ==================== 主板 (CHIP/VRM temp, 风扇) ====================
        var moboEntries = raw.Where(kv => kv.Key.StartsWith("Motherboard/") ||
                                          kv.Key.StartsWith("SuperIO/")).ToList();

        // 芯片组温度
        var chipTemp = moboEntries.FirstOrDefault(kv =>
            kv.Key.Contains("/Temperature/") &&
            (kv.Key.Contains("Chipset") || kv.Key.Contains("PCH") ||
             kv.Key.Contains("System") || kv.Key.Contains("Motherboard") ||
             kv.Key.Contains("Auxiliary")));
        result["TCHIP"] = chipTemp.Value > 0
            ? chipTemp.Value.ToString("F0", CultureInfo.InvariantCulture)
            : "0";

        // VRM 温度
        var vrmTemp = moboEntries.FirstOrDefault(kv =>
            kv.Key.Contains("/Temperature/") &&
            (kv.Key.Contains("VRM") || kv.Key.Contains("VR ") ||
             kv.Key.Contains("VR_LOOP") || kv.Key.Contains("Voltage Regulator")));
        result["TVRM"] = vrmTemp.Value > 0
            ? vrmTemp.Value.ToString("F0", CultureInfo.InvariantCulture)
            : "0";

        // CPU 风扇
        var cpuFan = moboEntries.FirstOrDefault(kv =>
            (kv.Key.Contains("/Control/") || kv.Key.Contains("/Fan/")) &&
            kv.Key.Contains("CPU") && !kv.Key.Contains("Fan #"));
        result["FCPU"] = cpuFan.Value > 0
            ? cpuFan.Value.ToString("F0", CultureInfo.InvariantCulture)
            : "0";

        // 机箱风扇
        var chassisFan = moboEntries.FirstOrDefault(kv =>
            (kv.Key.Contains("/Control/") || kv.Key.Contains("/Fan/")) &&
            (kv.Key.Contains("Chassis") || kv.Key.Contains("System") ||
             kv.Key.Contains("Fan #1") || kv.Key.Contains("Fan 1")) &&
            !kv.Key.Contains("CPU"));
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

            // GPU TDP 百分比
            var gpuPowerLimit = gpuEntries.FirstOrDefault(kv =>
                kv.Key.Contains("/Power/GPU Power Limit") ||
                kv.Key.Contains("/Power/Power Limit") ||
                kv.Key.Contains("/Power/TGP Limit") ||
                kv.Key.Contains("/Power/PL1 Limit"));
            if (gpuPower.Value > 0 && gpuPowerLimit.Value > 0)
            {
                var tdpPct = (gpuPower.Value / gpuPowerLimit.Value) * 100f;
                result["PGPU1TDPP"] = tdpPct.ToString("F1", CultureInfo.InvariantCulture);
            }
            else
            {
                result["PGPU1TDPP"] = "0";
            }

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
                "SGPU1CLK", "SGPU1MEMCLK", "PGPU1", "PGPU1TDPP",
                "VGPU1", "DGPU1", "DGPU1GPU2", "SUSEDVMEM", "SFREEVEM"
            })
            {
                result.TryAdd(key, "0");
            }
        }

        // ==================== 系统内存 ====================
        // 注意: LibreHardwareMonitor 返回的内存值单位是 GB,不是 bytes
        var ramEntries = raw.Where(kv => kv.Key.StartsWith("Memory/")).ToList();

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

        // ==================== 系统运行时间 ====================
        var uptimeSec = Environment.TickCount64 / 1000;
        var uptimeTs = TimeSpan.FromSeconds(uptimeSec);
        result["SUPTIME"] = $"{(int)uptimeTs.TotalDays}d {uptimeTs.Hours:D2}:{uptimeTs.Minutes:D2}:{uptimeTs.Seconds:D2}";

        // ==================== IP 地址 ====================
        result["SPRIIPADDR"] = GetPrimaryIP();

        // ==================== FPS ====================
        result["SRTSSFPS"] = "0";

        // ==================== 网络 ====================
        MapNetworkSensors(raw, result);
    }

    static void MapNetworkSensors(Dictionary<string, float> raw, Dictionary<string, string> result)
    {
        var netEntries = raw.Where(kv =>
            kv.Key.StartsWith("Network/") || kv.Key.StartsWith("Ethernet/")).ToList();

        int nicIdx = 1;
        var groups = netEntries
            .GroupBy(kv =>
            {
                var parts = kv.Key.Split('/');
                return parts.Length >= 2 ? parts[1] : "Unknown";
            })
            .OrderBy(g => g.Key);

        foreach (var group in groups)
        {
            string prefix = $"SNIC{nicIdx}";

            // 下载速率 (LibreHardwareMonitor 返回 bytes/s,转换为 MB/s)
            var dlRate = group.FirstOrDefault(kv =>
                kv.Key.Contains("/Throughput/Download") ||
                kv.Key.Contains("/Load/Download Speed") ||
                kv.Key.Contains("/Data/Download Speed"));
            result[$"{prefix}DLRATE"] = dlRate.Value > 0
                ? Math.Round(dlRate.Value / 1048576f, 1).ToString("F1", CultureInfo.InvariantCulture)
                : "0.0";

            // 上传速率 (MB/s)
            var ulRate = group.FirstOrDefault(kv =>
                kv.Key.Contains("/Throughput/Upload") ||
                kv.Key.Contains("/Load/Upload Speed") ||
                kv.Key.Contains("/Data/Upload Speed"));
            result[$"{prefix}ULRATE"] = ulRate.Value > 0
                ? Math.Round(ulRate.Value / 1048576f, 1).ToString("F1", CultureInfo.InvariantCulture)
                : "0.0";

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
            result["SNIC1DLRATE"] = "0.0";
            result["SNIC1ULRATE"] = "0.0";
            result["SNIC1TOTDL"] = "0.0";
        }
    }

    static string GetPrimaryIP()
    {
        try
        {
            var host = Dns.GetHostEntry(Dns.GetHostName());
            foreach (var ip in host.AddressList)
            {
                if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork &&
                    !ip.ToString().StartsWith("127.") &&
                    !ip.ToString().StartsWith("169.254."))
                {
                    return ip.ToString();
                }
            }
        }
        catch { }
        return "127.0.0.1";
    }
}
