# Draws the LDC Bids app icons: "LDC" in white over "Bids" in orange, bold, on solid black.
# Windows only (uses the built-in System.Drawing).
# Run:  powershell -ExecutionPolicy Bypass -File scripts\make_icons.ps1
Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot '..\icons'
$lines = @(
  @{ text = 'LDC';  color = [System.Drawing.Color]::White },
  @{ text = 'Bids'; color = [System.Drawing.ColorTranslator]::FromHtml('#FF7A00') }
)
$family = New-Object System.Drawing.FontFamily 'Segoe UI'
$style = [System.Drawing.FontStyle]::Bold
$maxWidth = 0.66   # widest line, as a share of the icon (stays inside the round mask on Android)
$gap = 0.06        # space between the lines, as a share of the icon

function Draw-Icon([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([System.Drawing.Color]::Black)

  # Lay each line out at a trial size, then scale both together so the wider one fits.
  $fmt = [System.Drawing.StringFormat]::GenericTypographic
  $paths = foreach ($l in $lines) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddString($l.text, $family, [int]$style, 100, (New-Object System.Drawing.PointF 0, 0), $fmt)
    $p
  }
  $widest = ($paths | ForEach-Object { $_.GetBounds().Width } | Measure-Object -Maximum).Maximum
  $k = ($size * $maxWidth) / $widest
  $heights = $paths | ForEach-Object { $_.GetBounds().Height * $k }
  $total = ($heights | Measure-Object -Sum).Sum + $gap * $size
  $y = ($size - $total) / 2

  for ($i = 0; $i -lt $paths.Count; $i++) {
    $p = $paths[$i]; $b = $p.GetBounds()
    $m = New-Object System.Drawing.Drawing2D.Matrix
    # Centre each line by its actual ink, not the font's box.
    $m.Translate(($size - $b.Width * $k) / 2, $y)
    $m.Scale($k, $k)
    $m.Translate(-$b.X, -$b.Y)
    $p.Transform($m)
    $g.FillPath((New-Object System.Drawing.SolidBrush $lines[$i].color), $p)
    $y += $heights[$i] + $gap * $size
  }

  $path = Join-Path $out "icon-$size.png"
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "wrote $path"
}

foreach ($s in 180, 192, 512) { Draw-Icon $s }
