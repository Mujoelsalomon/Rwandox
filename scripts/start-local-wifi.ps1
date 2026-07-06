param(
    [string]$LocalIp = $env:LOCAL_PC_IP,
    [switch]$StartServers,
    [switch]$RefreshOnly,
    [int]$RefreshIntervalSeconds = 15
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$FrontendDir = Join-Path $ProjectRoot "Front_end"
$BackendDir = Join-Path $ProjectRoot "backend"

function Get-DefaultRouteIpv4FromRoutePrint {
    foreach ($line in (route print -4)) {
        $trimmed = $line.Trim()
        if ($trimmed -match "^0\.0\.0\.0\s+0\.0\.0\.0\s+([0-9.]+)\s+([0-9.]+)\s+\d+$") {
            $interfaceIp = $Matches[2]
            if ($interfaceIp -match "^(192\.168|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)") {
                return $interfaceIp
            }
        }
    }

    return ""
}

function Get-PrivateIpv4FromIpconfig {
    $adapterName = ""
    $hasGateway = $false
    $ipAddress = ""
    $candidates = @()

    foreach ($line in (ipconfig)) {
        if ($line -match "adapter (.+):$") {
            if ($ipAddress -and ($hasGateway -or $ipAddress -eq "192.168.137.1")) {
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

    if ($ipAddress -and ($hasGateway -or $ipAddress -eq "192.168.137.1")) {
        $candidates += [pscustomobject]@{ Adapter = $adapterName; IPAddress = $ipAddress }
    }

    return ($candidates | Select-Object -First 1).IPAddress
}

function Write-FrontendEnvFile {
    param([string]$Ip)

    $hostName = [System.Net.Dns]::GetHostName()
    $frontendEnv = @"
VITE_API_URL=auto
VITE_LOCAL_IP=$Ip
VITE_LOCAL_FRONTEND_URL=http://$Ip`:5173
VITE_LOCAL_HOSTNAME=$hostName
"@

    Set-Content -Path (Join-Path $FrontendDir ".env.local") -Value $frontendEnv -Encoding UTF8
}

if ($RefreshOnly) {
    while ($true) {
        $detectedIp = Get-PrivateIpv4FromIpconfig
        if (-not $detectedIp) {
            $detectedIp = Get-DefaultRouteIpv4FromRoutePrint
        }

        if ($detectedIp) {
            $LocalIp = $detectedIp
            Write-FrontendEnvFile -Ip $LocalIp
            Write-Host "Updated LAN config for $LocalIp"
        }

        Start-Sleep -Seconds $RefreshIntervalSeconds
    }
}

if (-not $LocalIp) {
    $LocalIp = Get-PrivateIpv4FromIpconfig
}

if (-not $LocalIp) {
    $LocalIp = Get-DefaultRouteIpv4FromRoutePrint
}

if (-not $LocalIp) {
    throw "Could not detect a private PC/LAN IPv4 address. Run this script as: .\scripts\start-local-wifi.ps1 -LocalIp 192.168.1.25"
}

Write-FrontendEnvFile -Ip $LocalIp

Write-Host ""
Write-Host "Local PC IP: $LocalIp"
Write-Host "Frontend URL: http://$LocalIp`:5173"
Write-Host "Backend URL:  http://$LocalIp`:8000"
Write-Host "From another device on the same Wi-Fi, open: http://$LocalIp`:5173"
Write-Host ""

if ($StartServers) {
    $BackendLog = Join-Path $BackendDir "django_local_wifi.log"
    Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-Command",
        "`$env:LOCAL_PC_IP='$LocalIp'; `$env:LOCAL_WIFI_IP='$LocalIp'; `$env:DJANGO_ALLOW_LAN_HOSTS='true'; `$env:DJANGO_ALLOWED_HOSTS='localhost,127.0.0.1,testserver,$LocalIp'; Set-Location '$BackendDir'; ..\.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000 *> '$BackendLog'"
    ) -WindowStyle Hidden

    $FrontendLog = Join-Path $FrontendDir "vite_local_wifi.log"
    Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-Command",
        "`$env:VITE_API_URL='auto'; `$env:VITE_LOCAL_IP='$LocalIp'; `$env:VITE_LOCAL_FRONTEND_URL='http://$LocalIp`:5173'; Set-Location '$FrontendDir'; npm run dev -- --host 0.0.0.0 --port 5173 --strictPort *> '$FrontendLog'"
    ) -WindowStyle Hidden

    $WatcherLog = Join-Path $ProjectRoot "lan_access_watcher.log"
    Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-Command",
        "Set-Location '$ProjectRoot'; .\scripts\start-local-wifi.ps1 -RefreshOnly -LocalIp '$LocalIp' -RefreshIntervalSeconds $RefreshIntervalSeconds *> '$WatcherLog'"
    ) -WindowStyle Hidden

    Write-Host "Started backend and frontend servers in the background."
    Write-Host "Backend log:  $BackendLog"
    Write-Host "Frontend log: $FrontendLog"
    Write-Host "Watcher log:  $WatcherLog"
    Write-Host ""
}
else {
    Write-Host "Open two terminals and run:"
    Write-Host ""
    Write-Host "Terminal 1 - Backend"
    Write-Host "cd `"$BackendDir`""
    Write-Host "`$env:LOCAL_PC_IP='$LocalIp'"
    Write-Host "`$env:LOCAL_WIFI_IP='$LocalIp'"
    Write-Host "..\.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000"
    Write-Host ""
    Write-Host "Terminal 2 - Frontend"
    Write-Host "cd `"$FrontendDir`""
    Write-Host "npm run build"
    Write-Host "npm run preview"
    Write-Host ""
    Write-Host "Or run this script with -StartServers to start both automatically."
}
