fn main() {
    tauri_build::build();

    // 请求管理员权限 (LibreHardwareMonitor 需要 admin 才能读取 AMD CPU 的温度/电压/功耗/频率传感器)
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    if target_os == "windows" {
        let mut res = tauri_winres::WindowsResource::new();
        res.set_manifest(r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="requireAdministrator" uiAccess="false"/>
      </requestedPrivileges>
    </security>
  </trustInfo>
</assembly>"#);
        if let Err(e) = res.compile() {
            println!("cargo:warning=Failed to compile winres manifest: {}", e);
        }
    }
}
