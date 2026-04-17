<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    .lang-switch { position: fixed; top: 1rem; right: 1rem; }
    .lang-switch button { padding: 0.5rem 1rem; cursor: pointer; }
    [data-lang] { display: none; }
    [data-lang].active { display: block; }
    [data-lang-switch] { display: none; }
    [data-lang-switch].active { display: block; }
    pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; }
  </style>
</head>
<body>
  <div class="lang-switch">
    <button onclick="switchLang('en')">English</button>
    <button onclick="switchLang('zh')">中文</button>
  </div>

  <div data-lang="en" class="active">
# HWDash

HWDash is a desktop hardware monitoring panel built with Tauri, React, and Vite, designed for AIDA64 sensor panel scenarios. The app reads system sensor data written by AIDA64 and displays real-time information including CPU, GPU, memory, network, power consumption, fan speed, and FPS, providing a compact interface suitable for secondary screen display.
<img width="260" height="962" alt="image" src="https://github.com/user-attachments/assets/ff9ac4fa-e62c-4f2e-b0e8-bfdc8ba65832" />
<img width="260" height="966" alt="image" src="https://github.com/user-attachments/assets/e45d570c-adac-42cd-9017-3f54231868bb" />
<img width="261" height="964" alt="image" src="https://github.com/user-attachments/assets/985783b8-e47d-4f2c-b9f6-add6a70677e9" />
<img width="256" height="966" alt="image" src="https://github.com/user-attachments/assets/73ece61d-238a-4bbc-a3ec-34299f880fd6" />

## Features

- Real-time reading of AIDA64 hardware data with status refresh
- Core monitoring modules: CPU, GPU, RAM, network, etc.
- Built-in power consumption and FPS dynamic charts
- Four themes: Dark, Light, Tesla, Ferrari
- Portrait and landscape layout support
- Persists theme, layout, hardware names, and network adapter selection locally
- Integrated weather and time display, ideal for desktop monitoring

## Tech Stack

- Tauri 2
- React 19
- Vite 7
- TypeScript
- Tailwind CSS 4
- Rust

## Getting Started

### Prerequisites

Ensure the following are installed:

1. Node.js 18+
2. Rust toolchain
3. Windows C++ Build Tools
4. AIDA64 installed and running

### Install Dependencies

```bash
npm install
```

### Development Mode

```bash
npm run tauri dev
```

### Build Desktop App

```bash
npm run tauri build
```

Build output is located at `src-tauri/target/release/bundle/nsis/`.

## Data Source

HWDash relies on AIDA64 writing sensor data to the Windows Registry. On startup, the app reads this data through the Tauri Rust backend and renders it on the frontend interface.

If AIDA64 is not outputting data properly, the interface will show a waiting for connection or empty registry status.

## Project Structure

```text
src/
  components/    React UI components and monitoring cards
  hooks/         AIDA64 and weather data reading logic
  utils/         Color and display helper utilities
src-tauri/
  Cargo.toml     Rust-side dependencies and project config
```

## Configurable Options

The app supports the following runtime configurations:

- Theme switching
- Layout switching
- CPU / GPU / Network name customization
- Network adapter selection

Settings are saved in local browser storage and automatically restored on next launch.

## Use Cases

- AIDA64 secondary screen sensor panel
- Desktop real-time hardware monitoring
- Compact always-on system status display

## Development Recommendations

Recommended development environment:

- VS Code
- rust-analyzer
- Tauri VS Code plugin
- ESLint

## License

This project uses MIT License.
  </div>

  <div data-lang="zh">
# HWDash

HWDash 是一个基于 Tauri、React 和 Vite 构建的桌面硬件监控面板，面向 AIDA64 传感器面板场景。应用通过读取 AIDA64 写入的系统传感器数据，实时展示 CPU、GPU、内存、网络、功耗、风扇和 FPS 等信息，并提供适合副屏常驻显示的紧凑界面。
<img width="260" height="962" alt="image" src="https://github.com/user-attachments/assets/ff9ac4fa-e62c-4f2e-b0e8-bfdc8ba65832" />
<img width="260" height="966" alt="image" src="https://github.com/user-attachments/assets/e45d570c-adac-42cd-9017-3f54231868bb" />
<img width="261" height="964" alt="image" src="https://github.com/user-attachments/assets/985783b8-e47d-4f2c-b9f6-add6a70677e9" />
<img width="256" height="966" alt="image" src="https://github.com/user-attachments/assets/73ece61d-238a-4bbc-a3ec-34299f880fd6" />

## 当前项目特性

- 实时读取 AIDA64 硬件数据并刷新状态
- 展示 CPU、GPU、RAM、网络等核心监控模块
- 内置功耗和 FPS 动态曲线
- 支持深色、浅色、Tesla、Ferrari 四种主题
- 支持纵向和横向两种布局
- 记住主题、布局、硬件名称和网卡选择等本地设置
- 集成天气与时间显示，适合做桌面监控面板

## 技术栈

- Tauri 2
- React 19
- Vite 7
- TypeScript
- Tailwind CSS 4
- Rust

## 运行方式

### 前置条件

开始前请确保本机已安装：

1. Node.js 18+
2. Rust 工具链
3. Windows C++ Build Tools
4. 已安装并运行 AIDA64

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri dev
```

### 构建桌面应用

```bash
npm run tauri build
```

构建产物默认位于 `src-tauri/target/release/bundle/nsis/`。

## 数据来源

HWDash 依赖 AIDA64 将传感器数据写入 Windows Registry。应用启动后通过 Tauri Rust 后端读取这些数据，再交给前端界面渲染。

如果 AIDA64 没有正常输出数据，界面会显示等待连接或注册表为空的状态。

## 项目结构

```text
src/
  components/    React UI 组件与监控卡片
  hooks/         AIDA64 与天气数据读取逻辑
  utils/         颜色与展示辅助逻辑
src-tauri/
  Cargo.toml     Rust 端依赖与项目配置
```

## 可配置项

应用当前支持以下运行时配置：

- 主题切换
- 布局切换
- CPU / GPU / 网络名称自定义
- 网卡选择

以上设置会保存在本地浏览器存储中，下次启动后自动恢复。

## 适用场景

- AIDA64 副屏传感器面板
- 桌面实时硬件监控
- 紧凑型常驻系统状态展示

## 开发建议

推荐使用以下开发环境：

- VS Code
- rust-analyzer
- Tauri VS Code 插件
- ESLint

## License

本项目使用 MIT License。
  </div>

  <script>
    function switchLang(lang) {
      document.querySelectorAll('[data-lang]').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('[data-lang-switch]').forEach(el => el.classList.remove('active'));
      document.querySelectorAll(`[data-lang="${lang}"]`).forEach(el => el.classList.add('active'));
      localStorage.setItem('lang', lang);
    }
    switchLang(localStorage.getItem('lang') || 'en');
  </script>
</body>
</html>
