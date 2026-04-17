# System Monitor App (Tauri Edition)

A sleek, customizable system resource monitor designed to work seamlessly as an AIDA64 sensor panel. It provides real-time hardware monitoring with a beautiful, modern interface. 

This project has been migrated from Electron to **Tauri**, resulting in a dramatically smaller application size (~5MB) and significantly lower CPU/Memory usage, making it perfect for a background monitoring tool.

## Features

- **Real-Time Monitoring:** Displays live data for CPU, GPU, RAM, and Network.
- **Dynamic Graphs:** Visualizes load, power consumption, and FPS with smooth, dynamic line and bar graphs.
- **Multiple Themes:** Choose from Dark, Light, Tesla, and Ferrari themes to match your setup.
- **Customizable Layouts:** Supports both Vertical and Horizontal layouts to fit different secondary screens or sensor panel displays.
- **Persistent Settings:** Automatically saves your layout, theme, and hardware name preferences.
- **Ultra Lightweight:** Built with Rust and Tauri for native performance and minimal resource footprint.

## Open Source Software Used

This project is built upon several excellent open-source technologies:

- **[Tauri](https://tauri.app/)**: A framework for building tiny, blazing fast binaries for all major desktop platforms using Rust.
- **[React](https://reactjs.org/)**: A JavaScript library for building user interfaces.
- **[Vite](https://vitejs.dev/)**: Next-generation frontend tooling for fast development and building.
- **[Tailwind CSS](https://tailwindcss.com/)**: A utility-first CSS framework for rapid UI development.
- **[Lucide React](https://lucide.dev/)**: A beautiful, consistent, and open-source icon set.
- **[winreg](https://crates.io/crates/winreg)**: Rust crate for accessing Windows Registry natively.

## License & Terms

This project is open-source and distributed under the **MIT License**. You are free to use, modify, and distribute this software for personal or commercial purposes, provided that the original copyright notice and permission notice are included in all copies or substantial portions of the software.

## Usage Method (AIDA64 Configuration)

This application relies on **AIDA64** to gather hardware sensor data. You must have AIDA64 running and configured to output data to the Windows Registry.

### Step 1: Configure AIDA64
1. Open **AIDA64** (Extreme or Engineer edition).
2. Go to **File** -> **Preferences**.
3. Navigate to **Hardware Monitoring** -> **External Applications**.
4. Check the box for **"Enable writing sensor values to Registry"**.
5. In the list below, ensure that all relevant sensors (CPU temperatures, GPU temperatures, Fan speeds, Voltages, RAM usage, Network upload/download rates, etc.) are checked so they are exported.
6. Click **Apply** and **OK**.

### Step 2: Run the App
Once AIDA64 is writing to the registry, simply launch the **System Monitor App**. It will automatically detect the registry values and begin displaying your hardware stats in real-time.

---

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

## Project Setup

### Prerequisites

Before you begin, ensure you have the following installed:
1. **Node.js** (v18 or higher)
2. **Rust** (via rustup)
3. **C++ Build Tools** (Visual Studio Desktop development with C++)

### Install Dependencies

```bash
$ npm install
```

### Development

Run the app in development mode (this will start both the Vite frontend server and the Tauri backend):

```bash
$ npm run tauri dev
```

### Build

Build the application for production. The resulting executable will be located in `src-tauri/target/release/bundle/nsis/`.

```bash
$ npm run tauri build
```
# HWDash
