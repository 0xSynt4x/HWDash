mod settings;
mod window_state;

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WebviewUrl, WebviewWindowBuilder,
};

/// Sidecar 连接配置
const SIDECAR_PORT: u16 = 7453;
const SIDECAR_URL: &str = "http://localhost:7453/api/hardware";

/// 天气结果缓存
static WEATHER_CACHE: Mutex<Option<WeatherEntry>> = Mutex::new(None);
const WEATHER_TTL: Duration = Duration::from_secs(60);

/// Sidecar 子进程句柄(仅 Windows)
static SIDECAR_CHILD: Mutex<Option<std::process::Child>> = Mutex::new(None);

struct WeatherEntry {
    key: (String, String),
    fetched_at: std::time::Instant,
    value: String,
}

// ─── Sidecar 进程管理 ─────────────────────────────────

/// 查找 sidecar 可执行文件
fn find_sidecar_exe() -> Option<std::path::PathBuf> {
    // 1. exe 同目录
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let p = dir.join("hwdash-sidecar.exe");
            if p.exists() {
                return Some(p);
            }
        }
    }

    // 2. exe 同目录下的 binaries 子目录
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let p = dir.join("binaries").join("hwdash-sidecar.exe");
            if p.exists() {
                return Some(p);
            }
        }
    }

    // 3. 开发模式:相对于 Cargo workspace 根目录
    if let Ok(exe) = std::env::current_exe() {
        let p = exe
            .parent()?
            .parent()?
            .parent()?
            .parent()?
            .parent()?
            .parent()?
            .parent()?
            .join("hwmon-sidecar")
            .join("bin")
            .join("Release")
            .join("net8.0")
            .join("hwdash-sidecar.exe");
        if p.exists() {
            return Some(p);
        }
    }

    None
}

/// 单次启动最多等 sidecar 多久(LHM 初始化 + 5 次预热约 1~3 秒)
const SIDECAR_READY_TIMEOUT: Duration = Duration::from_secs(10);
/// 启动失败后的重试次数
const SIDECAR_MAX_ATTEMPTS: u32 = 3;
/// 两次尝试之间的间隔 —— 留给上一个 sidecar 退出、http.sys 释放端口注册的时间
const SIDECAR_RETRY_DELAY: Duration = Duration::from_millis(1500);

/// 启动 sidecar 并确认它真的起来了,失败自动重试。
///
/// 为什么需要重试:
/// sidecar 监听的是 http.sys 的 URL 前缀注册(`http://localhost:7453/`),
/// 这个注册要等上一个 sidecar 进程**彻底退出**才释放。上一个实例刚被强杀时,
/// 注册还会残留几十~几百毫秒,新实例撞上就会绑定失败直接退出。
/// 所以失败后等一下再试,通常第二次就能成功。
fn ensure_sidecar() -> Result<(), String> {
    let exe = find_sidecar_exe().ok_or_else(|| {
        "Sidecar executable not found. Build hwmon-sidecar first with: cd hwmon-sidecar && dotnet publish -c Release -o ../src-tauri/binaries/"
            .to_string()
    })?;

    let mut last_err = String::new();
    for attempt in 1..=SIDECAR_MAX_ATTEMPTS {
        match spawn_sidecar_once(&exe, attempt) {
            Ok(child) => {
                eprintln!("[HWDash] Sidecar ready (PID: {})", child.id());
                *SIDECAR_CHILD.lock().unwrap() = Some(child);
                return Ok(());
            }
            Err(e) => {
                eprintln!(
                    "[HWDash] Sidecar start attempt {attempt}/{SIDECAR_MAX_ATTEMPTS} failed: {e}"
                );
                last_err = e;
                if attempt < SIDECAR_MAX_ATTEMPTS {
                    std::thread::sleep(SIDECAR_RETRY_DELAY);
                }
            }
        }
    }

    Err(format!(
        "sidecar failed to start after {SIDECAR_MAX_ATTEMPTS} attempts: {last_err}"
    ))
}

/// 单次启动尝试:拉起进程 → 等它的 "READY" 就绪信号 → 成功则返回子进程句柄。
fn spawn_sidecar_once(exe: &std::path::Path, attempt: u32) -> Result<std::process::Child, String> {
    eprintln!("[HWDash] Starting sidecar (attempt {attempt}): {}", exe.display());

    #[cfg(windows)]
    use std::os::windows::process::CommandExt;

    #[cfg(windows)]
    let mut child = std::process::Command::new(exe)
        // 把本进程 PID 传给 sidecar:它据此盯住本进程,一旦本进程消失就自行退出,
        // 避免本进程被强杀/崩溃时 sidecar 变成孤儿。
        .arg(format!("--parent-pid={}", std::process::id()))
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {e}"))?;

    #[cfg(not(windows))]
    let mut child = std::process::Command::new(exe)
        .arg(format!("--parent-pid={}", std::process::id()))
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {e}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "sidecar stdout pipe unavailable".to_string())?;

    // 后台线程持续读 sidecar 的 stdout:
    //   ① 读到 "READY" 就发信号,表示监听已就绪;
    //   ② 必须一直读到进程结束 —— 读端提前关闭的话,sidecar 再往 stdout 写会拿到 EPIPE,
    //      而且管道缓冲区写满会把 sidecar 卡死。
    let (tx, rx) = std::sync::mpsc::channel::<bool>();
    std::thread::spawn(move || {
        use std::io::BufRead;
        let reader = std::io::BufReader::new(stdout);
        let mut ready = false;
        for line in reader.lines() {
            match line {
                Ok(l) => {
                    if !ready && l.trim() == "READY" {
                        ready = true;
                        let _ = tx.send(true);
                    }
                }
                Err(_) => break,
            }
        }
        if !ready {
            // 进程结束或读出错,始终没等到 READY
            let _ = tx.send(false);
        }
    });

    match rx.recv_timeout(SIDECAR_READY_TIMEOUT) {
        Ok(true) => Ok(child),
        Ok(false) | Err(_) => {
            // 提前退出(端口被占等)或超时:两种情况都杀掉重来
            let status = child.try_wait().ok().flatten();
            let _ = child.kill();
            let _ = child.wait();
            Err(match status {
                Some(s) => {
                    format!("sidecar exited early ({s}), port may still be held by a previous instance")
                }
                None => format!("sidecar did not report READY within {SIDECAR_READY_TIMEOUT:?}"),
            })
        }
    }
}

/// 杀死 sidecar 子进程
fn kill_sidecar() {
    if let Ok(mut guard) = SIDECAR_CHILD.lock() {
        if let Some(mut child) = guard.take() {
            let pid = child.id();
            eprintln!("[HWDash] Stopping sidecar (PID: {pid})");
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

// ─── Tauri 命令 ───────────────────────────────────────

#[tauri::command]
async fn get_hardware_data() -> Result<HashMap<String, String>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    match client.get(SIDECAR_URL).send().await {
        Ok(resp) => {
            let data: HashMap<String, String> =
                resp.json().await.map_err(|e| format!("Sidecar JSON error: {e}"))?;
            Ok(data)
        }
        Err(e) => {
            // 如果连接失败,可能是 sidecar 还没起来,尝试重连
            if e.is_connect() {
                // 等一小会儿再试一次
                tokio::time::sleep(Duration::from_millis(500)).await;
                match client.get(SIDECAR_URL).send().await {
                    Ok(resp) => {
                        let data: HashMap<String, String> =
                            resp.json().await.map_err(|e| format!("Sidecar JSON error: {e}"))?;
                        return Ok(data);
                    }
                    Err(e2) => {
                        return Err(format!(
                            "Hardware monitor not available. Is the sidecar running? ({e2})"
                        ));
                    }
                }
            }
            Err(format!("Hardware monitor error: {e}"))
        }
    }
}

#[tauri::command]
async fn check_sidecar_status() -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    match client
        .get("http://localhost:7453/health")
        .send()
        .await
    {
        Ok(_) => Ok("Connected".to_string()),
        Err(e) => Err(format!("Sidecar not reachable: {e}")),
    }
}

/// 腾讯天气 weather_code -> 图标
fn tencent_weather_icon(code: &str) -> &'static str {
    match code {
        "00" => "☀",                                                   // 晴
        "01" => "⛅",                                                  // 多云
        "02" => "☁",                                                   // 阴
        "03" | "21" | "22" | "23" | "24" | "25" => "🌦",               // 阵雨 / 小到中雨…
        "04" | "05" => "⛈",                                            // 雷阵雨(伴冰雹)
        "06" => "🌨",                                                  // 雨夹雪
        "07" | "08" | "09" | "10" | "11" | "12" => "🌧",               // 小雨 ~ 特大暴雨
        "13" | "14" | "15" | "16" | "17" | "26" | "27" | "28" => "❄",  // 阵雪 ~ 大到暴雪
        "18" | "53" => "🌫",                                           // 雾 / 霾
        "19" => "🌧",                                                  // 冻雨
        "20" | "29" | "30" | "31" => "🌪",                             // 沙尘暴 / 浮尘 / 扬沙
        _ => "☁",
    }
}

#[tauri::command]
async fn get_weather(province: String, city: String) -> Result<String, String> {
    let cache_key = (province.clone(), city.clone());

    if let Ok(guard) = WEATHER_CACHE.lock() {
        if let Some(entry) = guard.as_ref() {
            if entry.key == cache_key && entry.fetched_at.elapsed() < WEATHER_TTL {
                return Ok(entry.value.clone());
            }
        }
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent(concat!("HWDash/", env!("CARGO_PKG_VERSION"), " (https://github.com/0xSynt4x/HWDash)"))
        .build()
        .map_err(|e| e.to_string())?;

    // 腾讯天气:国内可直连、免 key、返回 JSON。必须同时给 province + city 才有数据。
    let body = client
        .get("https://wis.qq.com/weather/common")
        .query(&[
            ("source", "pc"),
            ("weather_type", "observe"),
            ("province", province.as_str()),
            ("city", city.as_str()),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;
    let observe = &json["data"]["observe"];
    let degree = observe["degree"].as_str().unwrap_or("");
    let code = observe["weather_code"].as_str().unwrap_or("");

    if degree.is_empty() {
        return Err(format!(
            "Weather source returned empty data for {province}/{city}"
        ));
    }

    let result = format!("{}|{}°C", tencent_weather_icon(code), degree);

    if let Ok(mut guard) = WEATHER_CACHE.lock() {
        *guard = Some(WeatherEntry {
            key: cache_key,
            fetched_at: std::time::Instant::now(),
            value: result.clone(),
        });
    }

    Ok(result)
}

// ─── 应用入口 ─────────────────────────────────────────

/// 前端首帧渲染完成后调用：把主窗口显示出来。
///
/// 配合建窗时的 `.visible(false)`：先让页面在"暗处"把首帧渲染好，
/// 再让窗口可见 —— DWM 拿到的第一帧就是有内容的，不会全透明。
#[tauri::command]
fn show_main_window(window: tauri::WebviewWindow) {
    let _ = window.show();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // ─── 主窗口改为手动创建（不再用 tauri.conf.json 的 app.windows）───
            //
            // 原因：Tauri 会把 WebView2 的数据目录强制设成 %LOCALAPPDATA%\<identifier>
            // （tauri 源码 manager/webview.rs：data_directory 为空时兜底为 app_local_data_dir()）。
            // 而 tauri.conf.json 里的 dataDirectory 只接受「相对路径」，
            // 拼出来永远出不了 LOCALAPPDATA；环境变量 WEBVIEW2_USER_DATA_FOLDER 也会被
            // Tauri 显式传入的路径覆盖。只有 WebviewWindowBuilder::data_directory() 收绝对路径。
            //
            // 所以把数据目录指到 exe 同目录的 webview-data，让程序完全自包含、不写 AppData。
            // ⚠️ 下面的窗口属性必须与原先 tauri.conf.json 里的保持一致，
            //    否则界面行为会变（边框 / 透明 / 任务栏 / 抢焦点）。
            let mut window_builder =
                WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                    .title("HWDash")
                    .inner_size(280.0, 960.0)
                    .decorations(false)
                    .transparent(true)
                    .skip_taskbar(true)
                    // ⚠️ 不能一建窗就 visible(true)：窗口一可见，DWM 就要求
                    // WebView2 立刻交出一帧，而 WebView2 的合成器这时往往还没
                    // 产出首帧，DWM 拿到空 surface ⇒ 整块面板全透明
                    // （且是间歇性的，取决于 WebView2 初始化快慢）。
                    // 改成「先隐藏 → 前端首帧渲染完再 show()」，绕开这段竞态。
                    // 见下面的 show_main_window 命令。
                    .visible(false)
                    .focused(false);

            if let Ok(exe) = std::env::current_exe() {
                if let Some(dir) = exe.parent() {
                    window_builder = window_builder.data_directory(dir.join("webview-data"));
                }
            }

            // 恢复上次退出时的窗口位置（含所在显示器）。
            // 三块屏都是 100% 缩放，逻辑坐标 == 物理坐标，直接按 f64 传即可。
            if let Some(pos) = window_state::resolve_position(app.handle()) {
                window_builder = window_builder.position(pos.x as f64, pos.y as f64);
            }

            let main_window = window_builder.build()?;

            // 兜底：万一前端 JS 出错、show_main_window 永远调不到，窗口会一直
            // 不显示（比"透明"更难排查）。8 秒后强制亮出来，至少能看见内容。
            {
                let w = main_window.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_secs(8));
                    if !w.is_visible().unwrap_or(true) {
                        let _ = w.show();
                    }
                });
            }

            // 建窗后先记一次初始位置：保证从头到尾没拖过窗口也有状态可写。
            if let Ok(position) = main_window.outer_position() {
                let monitor = main_window.current_monitor().ok().flatten();
                window_state::record(position, monitor);
            }

            // 启动 sidecar 子进程（内部会等就绪信号，失败自动重试）。
            //
            // ⚠️ 必须丢到后台线程：setup() 不返回，Tauri 就不会启动事件循环，
            // 窗口虽然已经 build 出来，但没有消息泵，WebView2 的异步初始化推不动
            // ⇒ 窗口一片透明（"覆盖后第一次启动就透明"就是这个原因）。
            // ensure_sidecar 最坏要等 3×10s + 2×1.5s，放主线程等于几十秒空窗。
            // 前端是 1Hz 轮询（useHardware），sidecar 晚几秒起来数据会自己补上。
            std::thread::spawn(move || match ensure_sidecar() {
                Ok(()) => eprintln!("[HWDash] Sidecar started successfully"),
                Err(e) => eprintln!("[HWDash] Warning: Could not start sidecar: {e}"),
            });

            let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let icon = app
                .default_window_icon()
                .cloned()
                .ok_or_else(|| -> Box<dyn std::error::Error> {
                    "missing default window icon".into()
                })?;

            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        // 退出前保存窗口位置 + 清理 sidecar
                        window_state::flush();
                        kill_sidecar();
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_hardware_data,
            check_sidecar_status,
            get_weather,
            show_main_window,
            settings::read_settings,
            settings::write_settings,
            settings::settings_file_path,
        ])
        .on_window_event(|window, event| match event {
            // 拖动 / 被系统挪动时记录最新位置（写盘在模块内部做节流）
            tauri::WindowEvent::Moved(position) => {
                let monitor = window.current_monitor().ok().flatten();
                window_state::record(*position, monitor);
            }
            // 关闭时：先落盘最后位置，再清理 sidecar
            tauri::WindowEvent::Destroyed => {
                window_state::flush();
                kill_sidecar();
            }
            _ => {}
        })
        .run(tauri::generate_context!());

    if let Err(e) = result {
        let msg = format!("HWDash failed to start: {e}");
        eprintln!("{msg}");
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                let log_path = dir.join("hwdash-crash.log");
                let _ = std::fs::write(&log_path, &msg);
            }
        }
        std::process::exit(1);
    }
}
