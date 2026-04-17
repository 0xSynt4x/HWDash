# 用户指令记忆

本文件记录了用户的指令、偏好和教导，用于在未来的交互中提供参考。

## 格式

### 用户指令条目
用户指令条目应遵循以下格式：

[用户指令摘要]
- Date: [YYYY-MM-DD]
- Context: [提及的场景或时间]
- Instructions:
  - [用户教导或指示的内容，逐行描述]

### 项目知识条目
Agent 在任务执行过程中发现的条目应遵循以下格式：

[项目知识摘要]
- Date: [YYYY-MM-DD]
- Context: Agent 在执行 [具体任务描述] 时发现
- Category: [代码结构|代码模式|代码生成|构建方法|测试方法|依赖关系|环境配置]
- Instructions:
  - [具体的知识点，逐行描述]

## 去重策略
- 添加新条目前，检查是否存在相似或相同的指令
- 若发现重复，跳过新条目或与已有条目合并
- 合并时，更新上下文或日期信息
- 这有助于避免冗余条目，保持记忆文件整洁

## 条目

[README 改写偏好]
- Date: 2026-04-17
- Context: 用户要求重写项目 README
- Instructions:
  - 重写 README 时去除迁移过程内容，只介绍当前项目。

[HWDash 项目结构与运行方式]
- Date: 2026-04-17
- Context: Agent 在执行 README 改写任务时发现
- Category: 代码结构
- Instructions:
  - 项目采用 Tauri + React + Vite 结构，前端代码位于 `src/`，Rust 桌面端代码位于 `src-tauri/`。
  - 前端主要通过 `src/hooks/useAida64.ts` 调用 Tauri `invoke` 读取硬件数据，通过 `src/hooks/useWeather.ts` 读取天气信息。
  - 开发命令为 `npm run tauri dev`，构建命令为 `npm run tauri build`。
