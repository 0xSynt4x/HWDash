mod settings;

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use winreg::enums::*;
use winreg::RegKey;

const AIDA64_REG_PATH: &str = r"Software\FinalWire\AIDA64\SensorValues";

/// 天气结果缓存:(quantized_lat, quantized_lon) -> (fetched_at, formatted_string)
/// 坐标按 0.01 精度量化(约 1.1 km),避免设置面板里微调坐标导致频繁请求 open-meteo。
static WEATHER_CACHE: Mutex<Option<WeatherEntry>> = Mutex::new(None);
const WEATHER_TTL: Duration = Duration::from_secs(60);

struct WeatherEntry {
    key: (i32, i32),
    fetched_at: Instant,
    value: String,
}

#[tauri::command]
fn get_hardware_data() -> Result<HashMap<String, String>, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key = hkcu.open_subkey(AIDA64_REG_PATH).map_err(|e| e.to_string())?;
    let mut data = HashMap::new();

    for value in key.enum_values().filter_map(Result::ok) {
        let name = value.0;
        if let Ok(val_str) = key.get_value::<String, _>(&name) {
            // 防御:过滤异常 HTML 错误页(例如 SEXTIPADDR 在外网失败时被 AIDA64 写入完整 HTTP 错误响应)
            // 大小写不敏感,因为 AIDA64 偶尔写入 <!doctype html> 等小写形式
            let trimmed = val_str.trim_start();
            let lower_prefix: String = trimmed.chars().take(9).collect::<String>().to_ascii_lowercase();
            if lower_prefix.starts_with("<!doctype") || lower_prefix.starts_with("<html") {
                continue;
            }
            data.insert(name, val_str);
        }
    }
    Ok(data)
}

#[tauri::command]
async fn get_weather(lat: f64, lon: f64) -> Result<String, String> {
    // 量化坐标到 0.01 精度,作为缓存 key
    let qlat = (lat * 100.0).round() as i32;
    let qlon = (lon * 100.0).round() as i32;
    let cache_key = (qlat, qlon);

    // 命中缓存且未过期 → 直接返回
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

    // WMO 4677 weather codes: https://open-meteo.com/en/docs#weathervariables
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

    // 写回缓存
    if let Ok(mut guard) = WEATHER_CACHE.lock() {
        *guard = Some(WeatherEntry {
            key: cache_key,
            fetched_at: Instant::now(),
            value: result.clone(),
        });
    }

    Ok(result)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let icon = app
                .default_window_icon()
                .cloned()
                .ok_or_else(|| -> Box<dyn std::error::Error> { "missing default window icon".into() })?;

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
            get_weather,
            settings::read_settings,
            settings::write_settings,
            settings::settings_file_path,
        ])
        .run(tauri::generate_context!());

    // 不再 .expect() panic;Windows GUI 子系统下 stderr 不可见,改为写入崩溃日志。
    if let Err(e) = result {
        let msg = format!("HWDash failed to start: {e}");
        eprintln!("{msg}");
        // 尝试写一个崩溃日志到 exe 同目录,方便用户排查
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                let log_path = dir.join("hwdash-crash.log");
                let _ = std::fs::write(&log_path, &msg);
            }
        }
        std::process::exit(1);
    }
}
