param(
    [string]$LocalIp = $env:LOCAL_WIFI_IP
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$FrontendDir = Join-Path $ProjectRoot "Front_end"
$BackendDir = Join-Path $ProjectRoot "backend"

function Get-PrivateIpv4FromIpconfig {
    $adapterName = ""
    $hasGateway = $false
    $ipAddress = ""
    $candidates = @()

    foreach ($line in (ipconfig)) {
        if ($line -match "adapter (.+):$") {
            if ($ipAddress -and $hasGateway) {
                $candidates += [pscustomobject]@{ Adapter = $adapterName; IPAddress = $ipAddress }
            }
            $adapterName = $Matches[1].Trim()
            $hasGateway = $false
            $ipAddress = ""
            continue
        }

        if ($line -match "IPv4 Address.*:\s*([0-9.]+)") {
            $candidateIp = $Matches[1].Trim()
            if ($candidateIp -match "^(192\.168|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)") {
                $ipAddress = $candidateIp
            }
            continue
        }

        if ($line -match "Default Gateway.*:\s*(.+)$" -and $Matches[1].Trim()) {
            $hasGateway = $true
        }
    }

    if ($ipAddress -and $hasGateway) {
        $candidates += [pscustomobject]@{ Adapter = $adapterName; IPAddress = $ipAddress }
    }

    $wifi = $candidates | Where-Object { $_.Adapter -match "Wi-Fi|Wireless" } | Select-Object -First 1
    if ($wifi) {
        return $wifi.IPAddress
    }

    return ($candidates | Select-Object -First 1).IPAddress
}

if (-not $LocalIp) {
    $LocalIp = Get-PrivateIpv4FromIpconfig
}

if (-not $LocalIp) {
    throw "Could not detect a private Wi-Fi IPv4 address. Run this script as: .\scripts\start-local-wifi.ps1 -LocalIp 192.168.1.25"
}

$frontendEnv = @"
VITE_API_URL=http://$LocalIp`:8000
VITE_LOCAL_IP=$LocalIp
VITE_LOCAL_FRONTEND_URL=http://$LocalIp`:5173
"@

Set-Content -Path (Join-Path $FrontendDir ".env.local") -Value $frontendEnv -Encoding UTF8

Write-Host ""
Write-Host "Local Wi-Fi IP: $LocalIp"
Write-Host "Frontend URL: http://$LocalIp`:5173"
Write-Host "Backend URL:  http://$LocalIp`:8000"
Write-Host ""
Write-Host "Open two terminals and run:"
Write-Host ""
Write-Host "Terminal 1 - Backend"
Write-Host "cd `"$BackendDir`""
Write-Host "`$env:LOCAL_WIFI_IP='$LocalIp'"
Write-Host "python manage.py runserver 0.0.0.0:8000"
Write-Host ""
Write-Host "Terminal 2 - Frontend"
Write-Host "cd `"$FrontendDir`""
Write-Host "npm run dev -- --host 0.0.0.0"
