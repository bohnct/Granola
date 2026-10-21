# Draws the Bohn AgVentures app icons: a white canola flower on solid black.
# Windows only (uses the built-in System.Drawing).
# Run:  powershell -ExecutionPolicy Bypass -File scripts\make_icons.ps1
Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot '..\icons'
$black = [System.Drawing.Color]::Black
$white = [System.Drawing.Color]::White

# One petal pointing straight up from the centre, on a 180px grid centred at (90, 90).
# Narrow at the base, wide and rounded at the tip with a soft notch, like a canola petal.
function Petal-Path {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $pts = [System.Drawing.PointF[]]@(
    (New-Object System.Drawing.PointF 90, 86),
    (New-Object System.Drawing.PointF 82, 76), (New-Object System.Drawing.PointF 63, 54), (New-Object System.Drawing.PointF 64, 34),
    (New-Object System.Drawing.PointF 65, 17), (New-Object System.Drawing.PointF 82, 12), (New-Object System.Drawing.PointF 90, 17),
    (New-Object System.Drawing.PointF 98, 12), (New-Object System.Drawing.PointF 115, 17), (New-Object System.Drawing.PointF 116, 34),
    (New-Object System.Drawing.PointF 117, 54), (New-Object System.Drawing.PointF 98, 76), (New-Object System.Drawing.PointF 90, 86)
  )
  $p.AddBeziers($pts)
  $p.CloseFigure()
  return $p
}

function Draw-Icon([int]$size) {
  $k = $size / 180.0
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.PixelOffsetMode = 'HighQuality'
  $g.Clear($black)
  $g.ScaleTransform($k, $k)

  $whiteBrush = New-Object System.Drawing.SolidBrush $white
  $blackBrush = New-Object System.Drawing.SolidBrush $black
  $vein = New-Object System.Drawing.Pen $black, 1.4
  $vein.StartCap = 'Round'; $vein.EndCap = 'Round'

  # Four petals in an X, the way canola flowers sit.
  foreach ($angle in 45, 135, 225, 315) {
    $petal = Petal-Path
    $m = New-Object System.Drawing.Drawing2D.Matrix
    $m.RotateAt($angle, (New-Object System.Drawing.PointF 90, 90))
    $petal.Transform($m)
    $g.FillPath($whiteBrush, $petal)

    # Centre vein, drawn in black so it reads as a fine groove.
    $veinPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $veinPath.AddLine(90, 66, 90, 40)
    $veinPath.Transform($m)
    $g.DrawPath($vein, $veinPath)
  }

  # Centre: a plain round opening where the petals meet.
  $g.FillEllipse($blackBrush, 79, 79, 22, 22)

  $path = Join-Path $out "icon-$size.png"
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "wrote $path"
}

foreach ($s in 180, 192, 512) { Draw-Icon $s }
