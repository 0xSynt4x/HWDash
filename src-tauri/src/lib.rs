use std::collections::HashMap;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use winreg::enums::*;
use winreg::RegKey;

#[tauri::command]
fn get_hardware_data() -> Result<HashMap<String, String>, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = r#"Software\FinalWire\AIDA64\SensorValues"#;

    let key = hkcu.open_subkey(path).map_err(|e| e.to_string())?;
    let mut data = HashMap::new();

    for value in key.enum_values().filter_map(Result::ok) {
        let name = value.0;
        if let Ok(val_str) = key.get_value::<String, _>(&name) {
            data.insert(name, val_str);
        }
    }
    Ok(data)
}

#[tauri::command]
fn get_weather() -> Result<String, String> {
    let url = "https://api.open-meteo.com/v1/forecast?latitude=43.80&longitude=87.60&current=temperature_2m,weather_code&timezone=Asia/Shanghai";

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        )
        .send()
        .map_err(|e| e.to_string())?;

    let body = response.text().map_err(|e| e.to_string())?;

    let json: serde_json::Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;
    let temp = json["current"]["temperature_2m"]
        .as_f64()
        .map(|t| format!("{:.0}", t))
        .unwrap_or_else(|| "N/A".to_string());
    let code = json["current"]["weather_code"].as_i64().unwrap_or(0);

    let icon = match code {
        0 => "☀️",
        1 | 2 | 3 => "⛅",
        45 | 48 => "🌫",
        51 | 53 | 55 => "🌧",
        61 | 63 | 65 => "🌧",
        71 | 73 | 75 => "❄",
        80 | 81 | 82 => "🌦",
        95 | 96 | 99 => "⛈",
        _ => "☁",
    };

    Ok(format!("{}|{}°C", icon, temp))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .menu_on_left_click(false)
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
        .invoke_handler(tauri::generate_handler![get_hardware_data, get_weather])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
