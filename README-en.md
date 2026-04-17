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
