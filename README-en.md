[中文](https://github.com/0xSynt4x/HWDash/blob/main/README.md)  [english](https://github.com/0xSynt4x/HWDash/blob/main/README-en.md)
# HWDash

HWDash is a desktop hardware monitoring panel built with Tauri, React, and Vite, designed for AIDA64 sensor panel scenarios. The app reads system sensor data written by AIDA64 and displays real-time information including CPU, GPU, memory, network, power consumption, fan speed, and FPS, providing a compact interface suitable for secondary screen display.

<img width="260" height="962" alt="image" src="https://github.com/user-attachments/assets/ff9ac4fa-e62c-4f2e-b0e8-bfdc8ba65832" />
<img width="260" height="966" alt="image" src="https://github.com/user-attachments/assets/e45d570c-adac-42cd-9017-3f54231868bb" />
<img width="261" height="964" alt="image" src="https://github.com/user-attachments/assets/985783b8-e47d-4f2c-b9f6-add6a70677e9" />

## Features

- Real-time reading of AIDA64 hardware data with status refresh
- Core monitoring modules: CPU, GPU, RAM, network, etc.
- Built-in power consumption and FPS dynamic charts
- Global 7-segment digital font (Digital-7 Mono) for crisp numeric readings
- Four themes: Dark, Light, Tesla, Ferrari
- Portrait and landscape layouts, mouse-wheel zoom (0.3×–3×)
- Portable settings: stored as `settings.json` next to the exe; copy the folder to a USB stick and run anywhere
- System tray: left-click to summon the window, right-click for show/quit menu
- Integrated weather and time display via open-meteo public API (60-second backend cache)
- Transparent borderless window, ideal as a secondary-monitor overlay

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
  hooks/         AIDA64, weather, and settings hooks
  utils/         Color and display helper utilities
  assets/
    fonts/       Digital-7 Mono 7-segment font
    main.css     Global styles + theme variables + Tailwind
src-tauri/
  src/
    lib.rs       Tauri entry, tray, registry reader, weather endpoint
    settings.rs  Portable settings.json read/write
  capabilities/  Tauri v2 permission declarations
  tauri.conf.json  App config (with CSP)
  Cargo.toml     Rust dependencies
```

## Configurable Options

The app supports the following runtime configurations (right-click anywhere on the panel to open Settings):

- Theme switching (Dark / Light / Tesla / Ferrari)
- Layout switching (Vertical / Horizontal)
- CPU / GPU / Network name customization (click card title to edit inline)
- Network adapter selection (right-click NETWORK card)
- Global zoom (mouse wheel or Settings slider, 0.3×–3×)
- Location (preset cities or custom lat/lon for weather)

Settings are persisted as `settings.json` next to the exe (portable mode).
You can copy the entire folder anywhere and your config follows.
If the exe directory is read-only, it falls back to `%APPDATA%\com.dylan.hwdash\settings.json`.

## Data & Privacy

- Registry read-only: only reads `HKCU\Software\FinalWire\AIDA64\SensorValues`, never writes
- Weather: default coordinates are `0,0` (placeholder); the app does **not** make any network request on first launch until you pick a city
- Weather service: [open-meteo.com](https://open-meteo.com) — free, no API key, no account required
- Strict CSP: `default-src 'self'`, no external scripts/connections allowed in the frontend
- All settings stored locally; no telemetry, no upload

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
