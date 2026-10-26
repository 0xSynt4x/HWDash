// 自定义 Windows manifest，通过 tauri-build 官方通道注入（见 main）。
// 内容 = tauri-build 默认 manifest（Common Controls 6.0）+ 提权 + DPI 感知。
// 注意：app_manifest 会「替换」默认 manifest，所以默认那份里的 Common Controls
// 必须在这里显式保留，否则 Tauri 的对话框控件会退化成旧版外观。
const APP_MANIFEST: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency>
    <dependentAssembly>
      <assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*"/>
    </dependentAssembly>
  </dependency>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="requireAdministrator" uiAccess="false"/>
      </requestedPrivileges>
    </security>
  </trustInfo>
  <application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
      <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2</dpiAwareness>
      <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware>
    </windowsSettings>
  </application>
</assembly>"#;

fn main() {
    // ⚠️ 这里绝对不能再自己调 tauri_winres 编译一份资源。
    //
    // tauri-build 在 Windows 上本来就会调用 tauri_winres，生成 $OUT_DIR/resource.lib
    // 并发出对应的 rustc-link-arg；文件名是固定的 resource.lib，路径也是同一个 OUT_DIR。
    // 我们再手动编译一遍 → 链接器命令行里出现两次同一个 resource.lib →
    //   CVTRES : fatal error CVT1100: 资源重复。类型: VERSION，名称: 1，语言: 0x0409
    //   LINK   : fatal error LNK1123: 转换到 COFF 期间失败
    //
    // 正确做法：把自定义 manifest 交给 tauri-build 统一编译，
    // 这样资源只有一份，提权 / DPI / 图标 / VERSION 信息全由它一次写进去。
    let windows = tauri_build::WindowsAttributes::new().app_manifest(APP_MANIFEST);
    let attrs = tauri_build::Attributes::new().windows_attributes(windows);
    tauri_build::try_build(attrs).expect("failed to run tauri-build");
}
