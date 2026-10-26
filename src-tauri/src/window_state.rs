//! 窗口位置持久化 —— 记住上次退出时窗口的位置，以及它当时在哪块显示器上。
//!
//! 为什么不直接用官方 `tauri-plugin-window-state`：
//! 那个插件固定把状态写进 `app_config_dir()`（即 `%APPDATA%\com.dylan.hwdash`），
//! 与本项目「不写 AppData、数据全部落在 exe 同目录」的目标直接冲突；
//! 它只提供 `with_filename()` 改文件名，改不了目录。所以这里自己实现一份。
//!
//! 存储文件：`<exe 同目录>/window-state.json`

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Monitor, PhysicalPosition, Runtime};

const FILE_NAME: &str = "window-state.json";

/// 拖动窗口时 `Moved` 事件非常密集（每帧一次），写盘做节流。
const WRITE_THROTTLE: Duration = Duration::from_secs(2);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    /// 窗口外框左上角的绝对物理坐标
    pub x: i32,
    pub y: i32,
    /// 窗口所在显示器的设备名（Windows 上形如 `\\.\DISPLAY1`）。
    /// 显示器布局变了以后靠它把窗口重新放回原来那块屏。
    #[serde(default)]
    pub monitor_name: Option<String>,
    /// 窗口相对该显示器原点的偏移量。显示器整体挪位时靠它跟随。
    #[serde(default)]
    pub offset_x: i32,
    #[serde(default)]
    pub offset_y: i32,
}

/// 内存中最后一次已知位置。
/// 窗口销毁后再去问系统已经问不到了，所以退出时用这份缓存落盘。
static LAST_STATE: Mutex<Option<WindowState>> = Mutex::new(None);

/// 上次写盘时间，用于节流。
static LAST_WRITE: Mutex<Option<Instant>> = Mutex::new(None);

static CACHED_PATH: OnceLock<PathBuf> = OnceLock::new();

// ─── 路径 ────────────────────────────────────────────

fn state_path() -> PathBuf {
    if let Some(p) = CACHED_PATH.get() {
        return p.clone();
    }
    let resolved = resolve_state_path();
    // OnceLock::set 仅第一次成功，后续返回 Err — 直接忽略，以已写入值为准
    let _ = CACHED_PATH.set(resolved.clone());
    resolved
}

/// 与 settings.json 一样：固定 exe 同目录，便携模式，不写 AppData。
fn resolve_state_path() -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            return dir.join(FILE_NAME);
        }
    }
    // 仅当拿不到 current_exe 时才会走到这里
    PathBuf::from(FILE_NAME)
}

// ─── 读写 ────────────────────────────────────────────

fn load() -> Option<WindowState> {
    let path = state_path();
    let content = fs::read_to_string(&path).ok()?;
    match serde_json::from_str::<WindowState>(&content) {
        Ok(state) => Some(state),
        Err(e) => {
            eprintln!(
                "[HWDash] window-state.json parse error at {}: {e}. Ignoring.",
                path.display()
            );
            None
        }
    }
}

/// 原子写：临时文件名带 PID，避免多实例并发互相踩。
fn save(state: &WindowState) {
    let path = state_path();
    let json = match serde_json::to_string_pretty(state) {
        Ok(j) => j,
        Err(e) => {
            eprintln!("[HWDash] Failed to serialize window state: {e}");
            return;
        }
    };

    let tmp = path.with_extension(format!("json.tmp.{}", std::process::id()));
    if let Err(e) = fs::write(&tmp, json) {
        eprintln!("[HWDash] Failed to write window state: {e}");
        return;
    }

    // Windows 上 rename 到已存在的目标会失败，先删目标
    #[cfg(windows)]
    if path.exists() {
        let _ = fs::remove_file(&path);
    }

    if let Err(e) = fs::rename(&tmp, &path) {
        eprintln!("[HWDash] Failed to commit window state: {e}");
        let _ = fs::remove_file(&tmp);
    }
}

// ─── 显示器辅助 ──────────────────────────────────────

fn monitor_name(monitor: &Monitor) -> Option<&str> {
    monitor.name().map(|n| n.as_str())
}

/// 点 (x, y) 是否落在某块显示器的矩形范围内。
fn monitor_at(monitors: &[Monitor], x: i32, y: i32) -> bool {
    monitors.iter().any(|m| {
        let p = m.position();
        let s = m.size();
        x >= p.x && x < p.x + s.width as i32 && y >= p.y && y < p.y + s.height as i32
    })
}

// ─── 对外接口 ────────────────────────────────────────

/// 计算启动时的初始位置。返回 `None` 表示没有可用记录，交给系统默认（主屏）。
///
/// 三级回退：
/// 1. 保存时那块显示器还在 → 用「显示器当前位置 + 相对偏移」还原，
///    这样即使显示器整体挪了位，窗口也跟着走；
/// 2. 显示器认不出来了，但保存的绝对坐标仍落在某块屏上 → 直接用绝对坐标；
/// 3. 都对不上（拔了屏 / 换了布局）→ `None`，让系统把窗口放主屏。
pub fn resolve_position<R: Runtime>(app: &AppHandle<R>) -> Option<PhysicalPosition<i32>> {
    let saved = load()?;
    let monitors = app.available_monitors().ok()?;
    if monitors.is_empty() {
        return None;
    }

    // 1) 同名显示器还在
    if let Some(name) = saved.monitor_name.as_deref() {
        if let Some(m) = monitors.iter().find(|m| monitor_name(m) == Some(name)) {
            let p = m.position();
            return Some(PhysicalPosition::new(p.x + saved.offset_x, p.y + saved.offset_y));
        }
    }

    // 2) 绝对坐标仍有效
    if monitor_at(&monitors, saved.x, saved.y) {
        return Some(PhysicalPosition::new(saved.x, saved.y));
    }

    // 3) 兜底
    None
}

/// 窗口移动时调用：更新内存状态，并按节流写盘。
pub fn record(position: PhysicalPosition<i32>, monitor: Option<Monitor>) {
    let name = monitor.as_ref().and_then(monitor_name).map(str::to_string);
    let (offset_x, offset_y) = match monitor.as_ref() {
        Some(m) => {
            let p = m.position();
            (position.x - p.x, position.y - p.y)
        }
        None => (0, 0),
    };

    let state = WindowState {
        x: position.x,
        y: position.y,
        monitor_name: name,
        offset_x,
        offset_y,
    };

    if let Ok(mut guard) = LAST_STATE.lock() {
        *guard = Some(state.clone());
    }

    let now = Instant::now();
    let should_write = match LAST_WRITE.lock() {
        Ok(mut last) => match *last {
            Some(t) if now.duration_since(t) < WRITE_THROTTLE => false,
            _ => {
                *last = Some(now);
                true
            }
        },
        Err(_) => false,
    };

    if should_write {
        save(&state);
    }
}

/// 退出前调用：无视节流，把内存里最后的位置落一次盘。
pub fn flush() {
    let state = match LAST_STATE.lock() {
        Ok(guard) => guard.clone(),
        Err(_) => None,
    };
    if let Some(state) = state {
        save(&state);
    }
}
