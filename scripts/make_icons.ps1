# Draws the Bohn AgVentures app icons (orange lettering on dark grey).
# Windows only (uses the built-in System.Drawing + Segoe UI fonts).
# Run:  powershell -ExecutionPolicy Bypass -File scripts\make_icons.ps1
Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot '..\icons'
$grey = [System.Drawing.ColorTranslator]::FromHtml('#2E3033')
$orange = [System.Drawing.ColorTranslator]::FromHtml('#F28C28')

function Draw-Icon([int]$size) {
  $k = $size / 180.0
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear($grey)
  $brush = New-Object System.Drawing.SolidBrush $orange
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = 'Center'
  $fmt.LineAlignment = 'Center'

  # Layout is on a 180px grid (matches the approved preview).
  $big = New-Object System.Drawing.Font 'Segoe UI Black', ([single](44 * $k)), ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
  $g.DrawString('BOHN', $big, $brush, (New-Object System.Drawing.RectangleF 0, ([single](49 * $k)), $size, ([single](48 * $k))), $fmt)

  $g.FillRectangle($brush, [single](40 * $k), [single](99 * $k), [single](100 * $k), [single](3.5 * $k))

  $small = New-Object System.Drawing.Font 'Segoe UI Semibold', ([single](22 * $k)), ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
  $g.DrawString('AgVentures', $small, $brush, (New-Object System.Drawing.RectangleF 0, ([single](106 * $k)), $size, ([single](28 * $k))), $fmt)

  $path = Join-Path $out "icon-$size.png"
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "wrote $path"
}

foreach ($s in 180, 192, 512) { Draw-Icon $s }
