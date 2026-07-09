# Build script for hwdash-sidecar
# Requires .NET 8 SDK installed
# Run from the hwmon-sidecar directory

param(
    [switch]$Release = $true,
    [string]$Output = "../src-tauri/binaries"
)

$config = if ($Release) { "Release" } else { "Debug" }

Write-Host "Building hwdash-sidecar ($config)..."

dotnet publish -c $config -r win-x64 --self-contained false -o "$Output" /p:DebugType=None /p:DebugSymbols=false

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build successful! Output: $Output"
} else {
    Write-Host "Build failed with exit code $LASTEXITCODE"
}
