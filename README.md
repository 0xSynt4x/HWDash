
 [english](https://github.com/0xSynt4x/HWDash/blob/main/README-en.md)
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
