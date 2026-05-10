param(
    [switch]$Detached
)

# Start podman machine on Windows if available
if (Get-Command podman -ErrorAction SilentlyContinue) {
    try {
        podman machine start 2>$null | Out-Null
    } catch {
        # ignore if machine not present
    }

    $composeCmd = "podman compose -f backend/podman-compose.yml up --build"
    if ($Detached) { $composeCmd += " -d" }
    Write-Host "Running: $composeCmd"
    Invoke-Expression $composeCmd
} else {
    Write-Error "podman not found. Install Podman Desktop or the Podman CLI first."
}
