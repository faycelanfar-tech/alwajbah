# نظام مدرسة الوجبة الابتدائية - مشغّل محلي بدون تثبيت أي برنامج
# يشغّل خادماً صغيراً على هذا الجهاز فقط (127.0.0.1) ويفتح النظام في نافذة مستقلة،
# ويحفظ البيانات في ملف alwajbah-data.json الموجود بجانب هذا الملف (داخل مجلد OneDrive المشترك).

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root      = $PSScriptRoot
$indexFile = Join-Path $root "index.html"
$defData   = Join-Path $root "alwajbah-data.json"
$cfgDir    = Join-Path $env:LOCALAPPDATA "Alwajbah"
$cfgFile   = Join-Path $cfgDir "config.json"

if (-not (Test-Path $indexFile)) {
  Write-Host "index.html not found next to this script." -ForegroundColor Red
  Start-Sleep 6; exit 1
}

function Get-DataPath {
  if (Test-Path $cfgFile) {
    try {
      $c = Get-Content $cfgFile -Raw -Encoding UTF8 | ConvertFrom-Json
      if ($c.dataPath) { return [string]$c.dataPath }
    } catch {}
  }
  return $defData
}
function Set-DataPath($p) {
  if (-not (Test-Path $cfgDir)) { New-Item -ItemType Directory -Path $cfgDir -Force | Out-Null }
  @{ dataPath = $p } | ConvertTo-Json | Set-Content -Path $cfgFile -Encoding UTF8
}

# ---- منفذ حر على العنوان المحلي فقط ----
$port = 8123
$listener = $null
for ($i = 0; $i -lt 40; $i++) {
  try {
    $l = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $port)
    $l.Start(); $listener = $l; break
  } catch { $port++ }
}
if (-not $listener) { Write-Host "No free port." -ForegroundColor Red; Start-Sleep 6; exit 1 }

$url = "http://127.0.0.1:$port/"
Write-Host "Alwajbah system running at $url"

# ---- فتح النظام في نافذة تطبيق مستقلة (Edge ثم Chrome ثم المتصفح الافتراضي) ----
$profileDir = Join-Path $env:LOCALAPPDATA "Alwajbah\browser"
$browser = $null
foreach ($cand in @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
)) { if (Test-Path $cand) { $browser = $cand; break } }

if ($browser) {
  $proc = Start-Process -FilePath $browser -PassThru -ArgumentList @(
    "--app=$url", "--user-data-dir=`"$profileDir`"", "--no-first-run", "--window-size=1366,860"
  )
} else {
  $proc = $null
  Start-Process $url
}

# ---- خادم HTTP مبسّط ----
$enc = New-Object System.Text.UTF8Encoding($false)

function Send-Response($stream, $status, $contentType, [byte[]]$body) {
  if ($null -eq $body) { $body = @() }
  $head = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
  $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
  $stream.Write($hb, 0, $hb.Length)
  if ($body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}
function Send-Text($stream, $status, $text) {
  Send-Response $stream $status "text/plain; charset=utf-8" $enc.GetBytes([string]$text)
}

while ($true) {
  # إغلاق الخادم عند إغلاق نافذة النظام
  if ($proc -and $proc.HasExited) { break }
  if (-not $listener.Pending()) { Start-Sleep -Milliseconds 50; continue }

  $client = $listener.AcceptTcpClient()
  try {
    $client.ReceiveTimeout = 15000
    $ns = $client.GetStream()
    $ms = New-Object System.IO.MemoryStream
    $buf = New-Object byte[] 16384
    $headerEnd = -1

    while ($headerEnd -lt 0) {
      $n = $ns.Read($buf, 0, $buf.Length)
      if ($n -le 0) { break }
      $ms.Write($buf, 0, $n)
      $all = $ms.ToArray()
      for ($i = 3; $i -lt $all.Length; $i++) {
        if ($all[$i-3] -eq 13 -and $all[$i-2] -eq 10 -and $all[$i-1] -eq 13 -and $all[$i] -eq 10) { $headerEnd = $i + 1; break }
      }
    }
    if ($headerEnd -lt 0) { $client.Close(); continue }

    $all = $ms.ToArray()
    $headerText = [System.Text.Encoding]::ASCII.GetString($all, 0, $headerEnd)
    $lines = $headerText -split "`r`n"
    $parts = $lines[0] -split " "
    $method = $parts[0]
    $path = $parts[1]
    $len = 0
    foreach ($ln in $lines) { if ($ln -match '^(?i)content-length:\s*(\d+)') { $len = [int]$Matches[1] } }

    $bodyBytes = New-Object System.IO.MemoryStream
    $have = $all.Length - $headerEnd
    if ($have -gt 0) { $bodyBytes.Write($all, $headerEnd, $have) }
    while ($bodyBytes.Length -lt $len) {
      $n = $ns.Read($buf, 0, [Math]::Min($buf.Length, $len - $bodyBytes.Length))
      if ($n -le 0) { break }
      $bodyBytes.Write($buf, 0, $n)
    }
    $body = $enc.GetString($bodyBytes.ToArray())

    switch -Regex ($path) {
      '^/__data/ping' { Send-Text $ns "200 OK" "ok"; break }

      '^/__data/path' {
        if ($method -eq "POST") {
          try {
            $dir = Split-Path -Parent $body
            if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
            Set-DataPath $body
            Send-Text $ns "200 OK" "ok"
          } catch { Send-Text $ns "500 Error" "fail" }
        } else { Send-Text $ns "200 OK" (Get-DataPath) }
        break
      }

      '^/__data/stat' {
        $p = Get-DataPath
        if (Test-Path $p) {
          $t = [Math]::Round(((Get-Item $p).LastWriteTimeUtc - [datetime]'1970-01-01').TotalMilliseconds)
          Send-Text $ns "200 OK" $t
        } else { Send-Text $ns "200 OK" "null" }
        break
      }

      '^/__data/read' {
        $p = Get-DataPath
        if (Test-Path $p) {
          try { Send-Response $ns "200 OK" "application/json; charset=utf-8" ([System.IO.File]::ReadAllBytes($p)) }
          catch { Send-Text $ns "404 Not Found" "" }
        } else { Send-Text $ns "404 Not Found" "" }
        break
      }

      '^/__data/write' {
        $p = Get-DataPath
        $tmp = "$p.tmp-$PID-$(Get-Random)"
        try {
          $dir = Split-Path -Parent $p
          if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
          [System.IO.File]::WriteAllBytes($tmp, $bodyBytes.ToArray())
          Move-Item -LiteralPath $tmp -Destination $p -Force
          Send-Text $ns "200 OK" "ok"
        } catch {
          try { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue } catch {}
          Send-Text $ns "500 Error" "fail"
        }
        break
      }

      default {
        $html = [System.IO.File]::ReadAllBytes($indexFile)
        Send-Response $ns "200 OK" "text/html; charset=utf-8" $html
        break
      }
    }
  } catch {
  } finally {
    try { $client.Close() } catch {}
  }
}

try { $listener.Stop() } catch {}
