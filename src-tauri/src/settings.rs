use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::{AppHandle, Manager};

/// 应用设置:替代 localStorage,便携模式持久化为 JSON
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_layout")]
    pub layout: String,
    #[serde(default = "default_zoom")]
    pub zoom: f64,
    #[serde(default = "default_cpu_name")]
    pub cpu_name: String,
    #[serde(default = "default_gpu_name")]
    pub gpu_name: String,
    #[serde(default = "default_network_name")]
    pub network_name: String,
    #[serde(default = "default_nic_index")]
    pub nic_index: i32,
    #[serde(default = "default_latitude")]
    pub latitude: f64,
    #[serde(default = "default_longitude")]
    pub longitude: f64,
    #[serde(default = "default_location_name")]
    pub location_name: String,
}

fn default_theme() -> String {
    "dark".to_string()
}
fn default_layout() -> String {
    "vertical".to_string()
}
fn default_zoom() -> f64 {
    1.0
}
fn default_cpu_name() -> String {
    "CPU".to_string()
}
fn default_gpu_name() -> String {
    "GPU".to_string()
}
fn default_network_name() -> String {
    "NETWORK".to_string()
}
fn default_nic_index() -> i32 {
    -1
}
// 隐私默认:首次启动不暴露用户大致位置,使用 0,0(空岛)作为占位。
// 用户在设置面板选择城市/输入自定义坐标后才发起天气请求。
fn default_latitude() -> f64 {
    0.0
}
fn default_longitude() -> f64 {
    0.0
}
fn default_location_name() -> String {
    "—".to_string()
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            layout: default_layout(),
            zoom: default_zoom(),
            cpu_name: default_cpu_name(),
            gpu_name: default_gpu_name(),
            network_name: default_network_name(),
            nic_index: default_nic_index(),
            latitude: default_latitude(),
            longitude: default_longitude(),
            location_name: default_location_name(),
        }
    }
}

/// 缓存路径解析结果,避免每次 read/write 都做磁盘 probe
/// (用户调整 zoom 时去抖写入会高频调用此函数)
static CACHED_PATH: OnceLock<PathBuf> = OnceLock::new();

/// 获取设置文件路径:优先 exe 同目录(便携),失败回退到 app_data_dir
fn settings_path(app: &AppHandle) -> PathBuf {
    if let Some(p) = CACHED_PATH.get() {
        return p.clone();
    }

    let resolved = resolve_settings_path(app);
    // OnceLock::set 仅第一次成功,后续返回 Err — 直接忽略,以已写入值为准
    let _ = CACHED_PATH.set(resolved.clone());
    resolved
}

fn resolve_settings_path(app: &AppHandle) -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let portable = dir.join("settings.json");
            // 测试目录是否可写:存在文件直接用,否则尝试创建标记文件
            if portable.exists() {
                return portable;
            }
            // 尝试在该目录写一个临时文件,看是否有写权限
            let probe = dir.join(".hwdash_write_probe");
            if fs::write(&probe, b"").is_ok() {
                let _ = fs::remove_file(&probe);
                return portable;
            }
        }
    }
    // 回退:AppData 目录
    if let Ok(dir) = app.path().app_config_dir() {
        let _ = fs::create_dir_all(&dir);
        return dir.join("settings.json");
    }
    // 最终兜底:当前工作目录
    PathBuf::from("settings.json")
}

#[tauri::command]
pub fn read_settings(app: AppHandle) -> AppSettings {
    let path = settings_path(&app);
    match fs::read_to_string(&path) {
        Ok(content) => match serde_json::from_str::<AppSettings>(&content) {
            Ok(s) => s,
            Err(e) => {
                // 解析失败时打印日志,避免静默吞错导致用户困惑(看到设置全没了)
                eprintln!(
                    "[HWDash] settings.json parse error at {}: {}. Falling back to defaults.",
                    path.display(),
                    e
                );
                AppSettings::default()
            }
        },
        Err(_) => AppSettings::default(),
    }
}

#[tauri::command]
pub fn write_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = settings_path(&app);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;

    // 原子写:临时文件名加 PID,避免多实例并发竞态
    let tmp = path.with_extension(format!("json.tmp.{}", std::process::id()));
    fs::write(&tmp, json).map_err(|e| e.to_string())?;

    // Windows 上 fs::rename 在目标存在时会失败,需要先删除目标
    #[cfg(windows)]
    {
        if path.exists() {
            let _ = fs::remove_file(&path);
        }
    }

    fs::rename(&tmp, &path).map_err(|e| {
        // 失败时清理临时文件,避免残留
        let _ = fs::remove_file(&tmp);
        e.to_string()
    })?;
    Ok(())
}

#[tauri::command]
pub fn settings_file_path(app: AppHandle) -> String {
    settings_path(&app).to_string_lossy().to_string()
}
