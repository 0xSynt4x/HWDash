# HWDash UI 优化说明

## 已完成的优化

### 1. 主题系统增强 (`src/assets/main.css`)
- **4个完整主题**: Dark (默认)、Light、Tesla、Ferrari
- **丰富的CSS变量**:
  - 核心颜色 (bg-main, bg-panel, text-primary, text-secondary)
  - 强调色 (accent, accent-secondary, accent-tertiary)
  - 状态色 (success, warning, danger, info)
  - 图表色 (chart-cpu, chart-gpu, chart-fps)
  - 阴影系统 (shadow-sm, shadow-md, shadow-lg, shadow-glow)
  - 玻璃效果 (glass-bg, glass-border)

### 2. UI组件现代化 (`src/components/UIComponents.tsx`)
- **Panel**: 玻璃态卡片、悬停抬升效果、平滑阴影
- **PanelHeader**: 可编辑标题、图标支持、渐变背景
- **StatRow**: 整洁的数据行、悬停高亮
- **BarGraph**: 动态条形图、渐变透明度
- **DynamicLineGraph**: 平滑贝塞尔曲线、发光效果、图例

### 3. Widget设计改进 (`src/components/Widgets.tsx`)
- **CPU Widget**:
  - 温度柱状指示器（带发光效果）
  - Chip/VRM 额外温度显示
  - 风扇转速监控
  - 负载历史图表
  
- **GPU Widget**:
  - 核心/显存双温度显示
  - 风扇百分比指示
  - 显存使用进度条
  - 功耗监控
  
- **RAM Widget**:
  - 动态背景进度条
  - 使用百分比大字体
  - 详细使用/空闲显示
  - 闪光动画效果
  
- **Network Widget**:
  - 下载/上传状态指示
  - 动态脉冲效果
  - 总流量显示
  - 本地IP地址

### 4. 设置菜单重构 (`src/components/SettingsMenu.tsx`)
- 现代化玻璃态设计
- 视觉主题预览选择器
- 布局切换图标按钮
- ESC键关闭、点击外部关闭
- 平滑动画过渡

### 5. 主应用布局优化 (`src/App.tsx`)
- **竖版布局** (300x980):
  - 顶部天气+时间
  - 4个硬件Widget垂直排列
  - 底部性能监控图表
  
- **横版布局** (900x500):
  - 左侧：天气时间、RAM、Network
  - 右侧：CPU/GPU并排、性能监控
  - 更好的空间利用

### 6. 动画系统 (`src/index.css`)
- **进入动画**: fadeIn, scaleIn, slideIn
- **微交互**: shimmer, pulseGlow, bounceSubtle
- **工具类**: glass, glow, text-gradient, border-gradient
- **特效**: scanline, crt

### 7. 颜色工具增强 (`src/utils/colors.ts`)
- 动态温度颜色计算
- 负载/电压/风扇状态颜色
- 颜色插值函数
- 渐变生成器

## 使用方法

### 切换主题
右键点击任意位置 → 选择主题（Dark/Light/Tesla/Ferrari）

### 切换布局
右键点击任意位置 → 选择布局（Vertical/Horizontal）

### 缩放
滚动鼠标滚轮进行缩放（0.3x - 3.0x）

### 编辑硬件名称
点击Widget标题可编辑CPU/GPU/Network名称

### 切换网卡
右键点击Network Widget选择网卡

## 文件变更
- `src/assets/main.css` - 主题系统
- `src/assets/base.css` - 基础重置样式
- `src/index.css` - 动画和工具类
- `src/App.css` - 清理简化
- `src/App.tsx` - 布局优化
- `src/components/UIComponents.tsx` - 全新设计
- `src/components/Widgets.tsx` - 组件增强
- `src/components/SettingsMenu.tsx` - 重构
- `src/utils/colors.ts` - 工具函数
