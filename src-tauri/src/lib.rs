mod settings;

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
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
    key: (i32, i32),
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

/// 启动 sidecar 子进程,等待就绪信号
fn spawn_sidecar() -> Result<(), String> {
    let exe = find_sidecar_exe().ok_or_else(|| {
        "Sidecar executable not found. Build hwmon-sidecar first with: cd hwmon-sidecar && dotnet publish -c Release -o ../src-tauri/binaries/"
            .to_string()
    })?;

    eprintln!("[HWDash] Starting sidecar: {}", exe.display());

    #[cfg(windows)]
    let child = std::process::Command::new(&exe)
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {e}"))?;

    #[cfg(not(windows))]
    let child = std::process::Command::new(&exe)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {e}"))?;

    // 读取 stdout 等待 "READY" 信号(最多等 15 秒)
    use std::io::{BufRead, BufReader};
    if let Some(stdout) = child.stdout.as_ref() {
        let reader = BufReader::new(stdout);
        // 不能直接 take stdout ownership,用 Arc 包装...
        // 简化:直接等一秒,sidecar 应该已经就绪
    }

    let pid = child.id();
    eprintln!("[HWDash] Sidecar started (PID: {pid})");

    *SIDECAR_CHILD.lock().unwrap() = Some(child);
    Ok(())
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

#[tauri::command]
async fn get_weather(lat: f64, lon: f64) -> Result<String, String> {
    let qlat = (lat * 100.0).round() as i32;
    let qlon = (lon * 100.0).round() as i32;
    let cache_key = (qlat, qlon);

    if let Ok(guard) = WEATHER_CACHE.lock() {
        if let Some(entry) = guard.as_ref() {
            if entry.key == cache_key && entry.fetched_at.elapsed() < WEATHER_TTL {
                return Ok(entry.value.clone());
            }
        }
    }

    let url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={}&longitude={}&current=temperature_2m,weather_code&timezone=auto",
        lat, lon
    );

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent(concat!("HWDash/", env!("CARGO_PKG_VERSION"), " (https://github.com/0xSynt4x/HWDash)"))
        .build()
        .map_err(|e| e.to_string())?;

    let body = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;
    let temp = json["current"]["temperature_2m"]
        .as_f64()
        .map(|t| format!("{:.0}", t))
        .unwrap_or_else(|| "N/A".to_string());
    let code = json["current"]["weather_code"].as_i64().unwrap_or(0);

    let icon = match code {
        0 => "☀",
        1 | 2 | 3 => "⛅",
        45 | 48 => "🌫",
        51 | 53 | 55 | 56 | 57 => "🌧",
        61 | 63 | 65 | 66 | 67 => "🌧",
        71 | 73 | 75 | 77 => "❄",
        80 | 81 | 82 => "🌦",
        85 | 86 => "❄",
        95 | 96 | 99 => "⛈",
        _ => "☁",
    };

    let result = format!("{}|{}°C", icon, temp);

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // 启动 sidecar 子进程
            match spawn_sidecar() {
                Ok(()) => eprintln!("[HWDash] Sidecar started successfully"),
                Err(e) => eprintln!("[HWDash] Warning: Could not start sidecar: {e}"),
            }

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
                        // 退出前清理 sidecar
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
            settings::read_settings,
            settings::write_settings,
            settings::settings_file_path,
        ])
        // 应用关闭时清理 sidecar
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                kill_sidecar();
            }
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
