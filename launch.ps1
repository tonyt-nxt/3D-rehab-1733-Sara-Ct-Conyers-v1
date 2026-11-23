param(
  [int]$Port = 8733,
  [switch]$NoBrowser
)

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Prefix = "http://localhost:$Port/"

$MimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
  ".pdf"  = "application/pdf"
}

$Listener = New-Object System.Net.HttpListener
$Listener.Prefixes.Add($Prefix)
$Listener.Start()

Write-Host "1733 Sara Ct SE 3D Command Center running at $Prefix" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop." -ForegroundColor DarkGray

if (-not $NoBrowser) {
  Start-Process $Prefix
}

try {
  while ($Listener.IsListening) {
    $Context = $Listener.GetContext()
    try {
      $ReqPath = $Context.Request.Url.AbsolutePath.TrimStart("/")
      if ([string]::IsNullOrWhiteSpace($ReqPath)) { $ReqPath = "index.html" }

      $FilePath = Join-Path $Root ($ReqPath -replace "/", "\")
      $Response = $Context.Response

      if (Test-Path $FilePath -PathType Leaf) {
        $Ext = [System.IO.Path]::GetExtension($FilePath).ToLower()
        $Response.ContentType = if ($MimeTypes.ContainsKey($Ext)) { $MimeTypes[$Ext] } else { "application/octet-stream" }
        $Bytes = [System.IO.File]::ReadAllBytes($FilePath)
        $Response.ContentLength64 = $Bytes.Length
        if ($Context.Request.HttpMethod -ne "HEAD") {
          $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
        }
      } else {
        $Response.StatusCode = 404
        $Msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $ReqPath")
        $Response.ContentLength64 = $Msg.Length
        if ($Context.Request.HttpMethod -ne "HEAD") {
          $Response.OutputStream.Write($Msg, 0, $Msg.Length)
        }
      }
      $Response.Close()
    } catch {
      try { $Context.Response.Abort() } catch {}
    }
  }
} finally {
  $Listener.Stop()
}
