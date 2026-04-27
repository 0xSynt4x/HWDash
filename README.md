
[中文](https://github.com/0xSynt4x/HWDash/blob/main/README.md)  [english](https://github.com/0xSynt4x/HWDash/blob/main/README-en.md)
# HWDash

HWDash 是一个基于 Tauri、React 和 Vite 构建的桌面硬件监控面板，面向 AIDA64 传感器面板场景。应用通过读取 AIDA64 写入的系统传感器数据，实时展示 CPU、GPU、内存、网络、功耗、风扇和 FPS 等信息，并提供适合副屏常驻显示的紧凑界面。

<img width="260" height="962" alt="image" src="https://github.com/user-attachments/assets/ff9ac4fa-e62c-4f2e-b0e8-bfdc8ba65832" />
<img width="260" height="966" alt="image" src="https://github.com/user-attachments/assets/e45d570c-adac-42cd-9017-3f54231868bb" />
<img width="261" height="964" alt="image" src="https://github.com/user-attachments/assets/985783b8-e47d-4f2c-b9f6-add6a70677e9" />


## 当前项目特性

- 实时读取 AIDA64 硬件数据并刷新状态
- 展示 CPU、GPU、RAM、网络等核心监控模块
- 内置功耗和 FPS 动态曲线
- 全局 7 段数码管字体（Digital-7 Mono），数字读数清晰
- 支持深色、浅色、Tesla、Ferrari 四种主题
- 支持纵向和横向两种布局，滚轮缩放（0.3×–3×）
- 设置以便携模式持久化为 `settings.json`（与 exe 同目录），可直接复制到 U 盘使用
- 系统托盘常驻：左键唤出窗口，右键菜单提供显示/退出
- 集成天气与时间显示，天气服务来自 open-meteo 公共 API（带 60 秒后端缓存）
- 透明无边框窗口，适合做副屏常驻监控面板

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
  hooks/         AIDA64、天气、设置 hooks
  utils/         颜色与展示辅助逻辑
  assets/
    fonts/       Digital-7 Mono 数码管字体
    main.css     全局样式 + 主题变量 + Tailwind
src-tauri/
  src/
    lib.rs       Tauri 入口、托盘、注册表读取、天气接口
    settings.rs  便携模式 settings.json 读写
  capabilities/  Tauri v2 权限声明
  tauri.conf.json  应用配置（含 CSP）
  Cargo.toml     Rust 依赖
```

## 可配置项

应用当前支持以下运行时配置（右键面板任意位置打开设置）：

- 主题切换（Dark / Light / Tesla / Ferrari）
- 布局切换（纵向 / 横向）
- CPU / GPU / 网络名称自定义（点击卡片标题直接编辑）
- 网卡选择（右键 NETWORK 卡片）
- 整体缩放（滚轮调整或 Settings 内拖动滑块，0.3×–3×）
- 位置选择（预设城市或自定义经纬度，用于天气）

设置以便携模式持久化为 exe 同目录的 `settings.json`，可拷贝到任意位置带走。
若 exe 目录无写权限，会自动回退到 `%APPDATA%\com.dylan.hwdash\settings.json`。

## 数据与隐私

- 注册表只读：仅读取 `HKCU\Software\FinalWire\AIDA64\SensorValues`，不写入任何键
- 天气接口：默认坐标为 `0,0`（占位），首次启动**不会**自动联网，需在设置中选择城市才发起请求
- 天气服务：[open-meteo.com](https://open-meteo.com)，免费、无需 API key、不要求账号
- CSP 严格模式：`default-src 'self'`，前端不允许任何外部脚本/连接
- 所有设置保存在本地，不上传任何遥测数据

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
