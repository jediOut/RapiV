Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

function New-BrandDirectory {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Convert-HexColor {
  param([string]$Hex, [int]$Alpha = 255)
  $value = $Hex.TrimStart("#")
  return [System.Drawing.Color]::FromArgb(
    $Alpha,
    [Convert]::ToInt32($value.Substring(0, 2), 16),
    [Convert]::ToInt32($value.Substring(2, 2), 16),
    [Convert]::ToInt32($value.Substring(4, 2), 16)
  )
}

function New-RoundedRectanglePath {
  param([float]$X, [float]$Y, [float]$W, [float]$H, [float]$R)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $R * 2
  $path.AddArc($X, $Y, $d, $d, 180, 90)
  $path.AddArc($X + $W - $d, $Y, $d, $d, 270, 90)
  $path.AddArc($X + $W - $d, $Y + $H - $d, $d, $d, 0, 90)
  $path.AddArc($X, $Y + $H - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function Save-Png {
  param([System.Drawing.Bitmap]$Bitmap, [string]$Path)
  $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $Bitmap.Dispose()
}

function Draw-Route {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Accent,
    [float]$Scale = 1,
    [float]$OffsetX = 0,
    [float]$OffsetY = 0
  )

  $linePen = New-Object System.Drawing.Pen -ArgumentList (Convert-HexColor "#FFFFFF" 178), (30 * $Scale)
  $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  $points = @(
    [System.Drawing.PointF]::new($OffsetX + (250 * $Scale), $OffsetY + (686 * $Scale)),
    [System.Drawing.PointF]::new($OffsetX + (390 * $Scale), $OffsetY + (585 * $Scale)),
    [System.Drawing.PointF]::new($OffsetX + (512 * $Scale), $OffsetY + (640 * $Scale)),
    [System.Drawing.PointF]::new($OffsetX + (678 * $Scale), $OffsetY + (505 * $Scale)),
    [System.Drawing.PointF]::new($OffsetX + (782 * $Scale), $OffsetY + (568 * $Scale))
  )
  $Graphics.DrawLines($linePen, $points)

  $dotBrush = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor $Accent)
  $whiteBrush = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor "#FFFFFF")
  foreach ($point in @($points[0], $points[3], $points[4])) {
    $Graphics.FillEllipse($whiteBrush, $point.X - (34 * $Scale), $point.Y - (34 * $Scale), 68 * $Scale, 68 * $Scale)
    $Graphics.FillEllipse($dotBrush, $point.X - (22 * $Scale), $point.Y - (22 * $Scale), 44 * $Scale, 44 * $Scale)
  }

  $linePen.Dispose()
  $dotBrush.Dispose()
  $whiteBrush.Dispose()
}

function Draw-Badge {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Kind,
    [string]$Accent
  )

  $badgePath = New-RoundedRectanglePath 660 138 200 200 58
  $badgeBrush = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor "#FFFFFF" 238)
  $Graphics.FillPath($badgeBrush, $badgePath)

  $pen = New-Object System.Drawing.Pen -ArgumentList (Convert-HexColor $Accent), 20
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $brush = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor $Accent)

  if ($Kind -eq "client") {
    $Graphics.DrawLine($pen, 708, 204, 742, 270)
    $Graphics.DrawLine($pen, 742, 270, 820, 270)
    $Graphics.DrawLine($pen, 754, 228, 828, 228)
    $Graphics.DrawEllipse($pen, 752, 292, 20, 20)
    $Graphics.DrawEllipse($pen, 806, 292, 20, 20)
  } elseif ($Kind -eq "business") {
    $Graphics.DrawLine($pen, 704, 224, 824, 224)
    $Graphics.DrawLine($pen, 724, 224, 724, 300)
    $Graphics.DrawLine($pen, 804, 224, 804, 300)
    $Graphics.DrawLine($pen, 704, 300, 824, 300)
    $Graphics.FillRectangle($brush, 726, 180, 98, 34)
  } elseif ($Kind -eq "courier") {
    $Graphics.DrawLine($pen, 704, 278, 826, 278)
    $Graphics.DrawLine($pen, 790, 236, 826, 278)
    $Graphics.DrawLine($pen, 790, 320, 826, 278)
    $Graphics.DrawEllipse($pen, 708, 218, 38, 38)
    $Graphics.DrawEllipse($pen, 748, 302, 38, 38)
  }

  $badgePath.Dispose()
  $badgeBrush.Dispose()
  $pen.Dispose()
  $brush.Dispose()
}

function Draw-AppRoleIcon {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Kind,
    [string]$Accent,
    [float]$Scale = 1,
    [float]$OffsetX = 0,
    [float]$OffsetY = 0
  )

  $panel = New-RoundedRectanglePath ($OffsetX + (210 * $Scale)) ($OffsetY + (430 * $Scale)) (604 * $Scale) (390 * $Scale) (96 * $Scale)
  $panelBrush = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor "#FFFFFF" 242)
  $Graphics.FillPath($panelBrush, $panel)

  $pen = New-Object System.Drawing.Pen -ArgumentList (Convert-HexColor $Accent), (34 * $Scale)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $thinPen = New-Object System.Drawing.Pen -ArgumentList (Convert-HexColor $Accent), (22 * $Scale)
  $thinPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $thinPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $thinPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $brush = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor $Accent)

  if ($Kind -eq "client") {
    $bagPath = New-RoundedRectanglePath ($OffsetX + (340 * $Scale)) ($OffsetY + (560 * $Scale)) (344 * $Scale) (170 * $Scale) (40 * $Scale)
    $Graphics.DrawPath($pen, $bagPath)
    $Graphics.DrawArc($pen, $OffsetX + (420 * $Scale), $OffsetY + (494 * $Scale), 184 * $Scale, 146 * $Scale, 200, 140)
    $Graphics.DrawLine($thinPen, $OffsetX + (392 * $Scale), $OffsetY + (646 * $Scale), $OffsetX + (632 * $Scale), $OffsetY + (646 * $Scale))
    $Graphics.FillEllipse($brush, $OffsetX + (382 * $Scale), $OffsetY + (590 * $Scale), 28 * $Scale, 28 * $Scale)
    $Graphics.FillEllipse($brush, $OffsetX + (614 * $Scale), $OffsetY + (590 * $Scale), 28 * $Scale, 28 * $Scale)
    $bagPath.Dispose()
  } elseif ($Kind -eq "business") {
    $Graphics.DrawLine($pen, $OffsetX + (326 * $Scale), $OffsetY + (558 * $Scale), $OffsetX + (698 * $Scale), $OffsetY + (558 * $Scale))
    $Graphics.DrawLine($pen, $OffsetX + (360 * $Scale), $OffsetY + (556 * $Scale), $OffsetX + (310 * $Scale), $OffsetY + (646 * $Scale))
    $Graphics.DrawLine($pen, $OffsetX + (456 * $Scale), $OffsetY + (556 * $Scale), $OffsetX + (432 * $Scale), $OffsetY + (646 * $Scale))
    $Graphics.DrawLine($pen, $OffsetX + (550 * $Scale), $OffsetY + (556 * $Scale), $OffsetX + (576 * $Scale), $OffsetY + (646 * $Scale))
    $Graphics.DrawLine($pen, $OffsetX + (644 * $Scale), $OffsetY + (556 * $Scale), $OffsetX + (704 * $Scale), $OffsetY + (646 * $Scale))
    $Graphics.DrawLine($thinPen, $OffsetX + (344 * $Scale), $OffsetY + (680 * $Scale), $OffsetX + (680 * $Scale), $OffsetY + (680 * $Scale))
    $Graphics.DrawLine($thinPen, $OffsetX + (368 * $Scale), $OffsetY + (680 * $Scale), $OffsetX + (368 * $Scale), $OffsetY + (746 * $Scale))
    $Graphics.DrawLine($thinPen, $OffsetX + (656 * $Scale), $OffsetY + (680 * $Scale), $OffsetX + (656 * $Scale), $OffsetY + (746 * $Scale))
    $Graphics.DrawRectangle($thinPen, $OffsetX + (460 * $Scale), $OffsetY + (690 * $Scale), 104 * $Scale, 56 * $Scale)
  } elseif ($Kind -eq "courier") {
    $Graphics.DrawEllipse($pen, $OffsetX + (330 * $Scale), $OffsetY + (672 * $Scale), 90 * $Scale, 90 * $Scale)
    $Graphics.DrawEllipse($pen, $OffsetX + (606 * $Scale), $OffsetY + (672 * $Scale), 90 * $Scale, 90 * $Scale)
    $Graphics.DrawLine($pen, $OffsetX + (406 * $Scale), $OffsetY + (718 * $Scale), $OffsetX + (548 * $Scale), $OffsetY + (718 * $Scale))
    $Graphics.DrawLine($pen, $OffsetX + (496 * $Scale), $OffsetY + (626 * $Scale), $OffsetX + (610 * $Scale), $OffsetY + (718 * $Scale))
    $Graphics.DrawLine($pen, $OffsetX + (500 * $Scale), $OffsetY + (626 * $Scale), $OffsetX + (638 * $Scale), $OffsetY + (626 * $Scale))
    $Graphics.DrawLine($pen, $OffsetX + (546 * $Scale), $OffsetY + (634 * $Scale), $OffsetX + (458 * $Scale), $OffsetY + (560 * $Scale))
    $Graphics.DrawLine($thinPen, $OffsetX + (290 * $Scale), $OffsetY + (586 * $Scale), $OffsetX + (442 * $Scale), $OffsetY + (586 * $Scale))
    $Graphics.DrawLine($thinPen, $OffsetX + (330 * $Scale), $OffsetY + (526 * $Scale), $OffsetX + (480 * $Scale), $OffsetY + (526 * $Scale))
  } else {
    Draw-Route $Graphics $Accent $Scale $OffsetX $OffsetY
  }

  foreach ($item in @($panel, $panelBrush, $pen, $thinPen, $brush)) {
    if ($item -ne $null) { $item.Dispose() }
  }
}

function Draw-CleanMark {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Accent,
    [string]$Kind = "main",
    [float]$Scale = 1,
    [float]$OffsetX = 0,
    [float]$OffsetY = 0
  )

  $fontFamily = New-Object System.Drawing.FontFamily "Segoe UI"
  $markScale = if ($Kind -eq "main") { $Scale } else { $Scale * 0.62 }
  $markOffsetX = if ($Kind -eq "main") { $OffsetX } else { $OffsetX + (140 * $Scale) }
  $markOffsetY = if ($Kind -eq "main") { $OffsetY } else { $OffsetY - (78 * $Scale) }
  $fontR = New-Object System.Drawing.Font -ArgumentList $fontFamily, (320 * $markScale), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $fontV = New-Object System.Drawing.Font -ArgumentList $fontFamily, (276 * $markScale), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $white = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor "#FFFFFF")
  $Graphics.DrawString("R", $fontR, $white, $markOffsetX + (266 * $markScale), $markOffsetY + (230 * $markScale))
  $Graphics.DrawString("V", $fontV, $white, $markOffsetX + (494 * $markScale), $markOffsetY + (272 * $markScale))

  if ($Kind -eq "main") {
    Draw-Route $Graphics $Accent $Scale $OffsetX $OffsetY
  } else {
    Draw-AppRoleIcon $Graphics $Kind $Accent $Scale $OffsetX $OffsetY
  }

  foreach ($item in @($fontFamily, $fontR, $fontV, $white)) {
    if ($item -ne $null) { $item.Dispose() }
  }
}

function Draw-FontAwesome6Icon {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$GlyphCode,
    [string]$Color,
    [float]$Size,
    [float]$CenterX,
    [float]$CenterY
  )

  $rootPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
  $fontPath = Join-Path $rootPath "cliente-frontend\node_modules\@expo\vector-icons\build\vendor\react-native-vector-icons\Fonts\FontAwesome6_Solid.ttf"
  $fontCollection = New-Object System.Drawing.Text.PrivateFontCollection
  $fontCollection.AddFontFile($fontPath)
  $iconFamily = $fontCollection.Families[0]
  $glyph = [char]::ConvertFromUtf32($GlyphCode)
  $iconPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $iconPath.AddString(
    $glyph,
    $iconFamily,
    [int][System.Drawing.FontStyle]::Regular,
    $Size,
    [System.Drawing.PointF]::new(0, 0),
    [System.Drawing.StringFormat]::GenericDefault
  )
  $bounds = $iconPath.GetBounds()
  $matrix = New-Object System.Drawing.Drawing2D.Matrix
  $matrix.Translate($CenterX - ($bounds.X + ($bounds.Width / 2)), $CenterY - ($bounds.Y + ($bounds.Height / 2)))
  $iconPath.Transform($matrix)
  $brush = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor $Color)
  $Graphics.FillPath($brush, $iconPath)

  foreach ($item in @($fontCollection, $iconPath, $matrix, $brush)) {
    if ($item -ne $null) { $item.Dispose() }
  }
}

function Draw-AppStoreStyleIcon {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Kind,
    [string]$Background,
    [string]$Accent,
    [bool]$Transparent = $false,
    [float]$Scale = 1,
    [float]$OffsetX = 0,
    [float]$OffsetY = 0
  )

  if (-not $Transparent) {
    $Graphics.Clear((Convert-HexColor $Background))
    $highlight = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor "#FFFFFF" 36)
    $shade = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor "#0F172A" 26)
    $Graphics.FillEllipse($highlight, $OffsetX + (648 * $Scale), $OffsetY + (-190 * $Scale), 520 * $Scale, 520 * $Scale)
    $Graphics.FillEllipse($shade, $OffsetX + (-230 * $Scale), $OffsetY + (750 * $Scale), 520 * $Scale, 520 * $Scale)
    $highlight.Dispose()
    $shade.Dispose()
  }

  $softWhite = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor "#FFFFFF" 232)
  $rootPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
  $fontPath = Join-Path $rootPath "cliente-frontend\node_modules\@expo\vector-icons\build\vendor\react-native-vector-icons\Fonts\FontAwesome6_Solid.ttf"
  $fontCollection = New-Object System.Drawing.Text.PrivateFontCollection
  $fontCollection.AddFontFile($fontPath)
  $iconFamily = $fontCollection.Families[0]

  $glyphCode = switch ($Kind) {
    "client" { 62096 }
    "business" { 62798 }
    "courier" { 61980 }
    default { 62096 }
  }
  $glyph = [char]::ConvertFromUtf32($glyphCode)
  $glyphSize = switch ($Kind) {
    "client" { 390 * $Scale }
    "business" { 380 * $Scale }
    "courier" { 410 * $Scale }
    default { 390 * $Scale }
  }
  $iconPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $iconPath.AddString(
    $glyph,
    $iconFamily,
    [int][System.Drawing.FontStyle]::Regular,
    $glyphSize,
    [System.Drawing.PointF]::new(0, 0),
    [System.Drawing.StringFormat]::GenericDefault
  )
  $bounds = $iconPath.GetBounds()
  $targetCenterX = $OffsetX + (512 * $Scale)
  $targetCenterY = $OffsetY + (392 * $Scale)
  $matrix = New-Object System.Drawing.Drawing2D.Matrix
  $matrix.Translate($targetCenterX - ($bounds.X + ($bounds.Width / 2)), $targetCenterY - ($bounds.Y + ($bounds.Height / 2)))
  $iconPath.Transform($matrix)
  $Graphics.FillPath($softWhite, $iconPath)

  $fontFamily = New-Object System.Drawing.FontFamily "Segoe UI"
  $brandPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $brandPath.AddString(
    "RapiV",
    $fontFamily,
    [int][System.Drawing.FontStyle]::Bold,
    118 * $Scale,
    [System.Drawing.PointF]::new(0, 0),
    [System.Drawing.StringFormat]::GenericDefault
  )
  $brandBounds = $brandPath.GetBounds()
  $brandMatrix = New-Object System.Drawing.Drawing2D.Matrix
  $brandCenterX = $OffsetX + (512 * $Scale)
  $brandCenterY = $OffsetY + (760 * $Scale)
  $brandMatrix.Translate($brandCenterX - ($brandBounds.X + ($brandBounds.Width / 2)), $brandCenterY - ($brandBounds.Y + ($brandBounds.Height / 2)))
  $brandPath.Transform($brandMatrix)
  $Graphics.FillPath($softWhite, $brandPath)

  foreach ($item in @($softWhite, $fontCollection, $iconPath, $matrix, $fontFamily, $brandPath, $brandMatrix)) {
    if ($item -ne $null) { $item.Dispose() }
  }
}

function New-Icon {
  param(
    [string]$Path,
    [string]$Background,
    [string]$Accent,
    [string]$Badge,
    [bool]$Transparent = $false
  )

  $bitmap = New-Object System.Drawing.Bitmap 1024, 1024, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  if ($Transparent) {
    $graphics.Clear([System.Drawing.Color]::Transparent)
  }

  if ($Badge -eq "main") {
    if (-not $Transparent) {
      $graphics.Clear((Convert-HexColor $Background))
      $overlay = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor "#FFFFFF" 28)
      $graphics.FillEllipse($overlay, 520, -220, 620, 620)
      $graphics.FillEllipse($overlay, -240, 690, 520, 520)
      $overlay.Dispose()
    }
    Draw-CleanMark $graphics $Accent $Badge
  } else {
    Draw-AppStoreStyleIcon $graphics $Badge $Background $Accent $Transparent
  }

  $graphics.Dispose()
  Save-Png $bitmap $Path
}

function New-Favicon {
  param([string]$SourcePath, [string]$Path)
  $source = [System.Drawing.Image]::FromFile($SourcePath)
  $bitmap = New-Object System.Drawing.Bitmap 48, 48
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.DrawImage($source, 0, 0, 48, 48)
  $graphics.Dispose()
  $source.Dispose()
  Save-Png $bitmap $Path
}

function New-Splash {
  param(
    [string]$Path,
    [string]$Background,
    [string]$Accent,
    [string]$Badge,
    [string]$Title,
    [string]$Subtitle
  )

  $bitmap = New-Object System.Drawing.Bitmap 1242, 2436, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear((Convert-HexColor "#FFFFFF"))

  $card = New-RoundedRectanglePath 321 780 600 600 148
  $cardBrush = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor $Background)
  $graphics.FillPath($cardBrush, $card)
  $splashMarkScale = 0.52
  $splashMarkSize = 1024 * $splashMarkScale
  $splashMarkX = 321 + ((600 - $splashMarkSize) / 2)
  $splashMarkY = 780 + ((600 - $splashMarkSize) / 2)
  Draw-AppStoreStyleIcon $graphics $Badge $Background $Accent $true $splashMarkScale $splashMarkX $splashMarkY

  $fontFamily = New-Object System.Drawing.FontFamily "Segoe UI"
  $titleFont = New-Object System.Drawing.Font($fontFamily, 76, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $subtitleFont = New-Object System.Drawing.Font($fontFamily, 34, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $textBrush = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor "#111827")
  $mutedBrush = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor "#4B5563")
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $graphics.DrawString($Title, $titleFont, $textBrush, [System.Drawing.RectangleF]::new(0, 1440, 1242, 110), $format)
  $graphics.DrawString($Subtitle, $subtitleFont, $mutedBrush, [System.Drawing.RectangleF]::new(0, 1544, 1242, 80), $format)

  foreach ($item in @($card, $cardBrush, $fontFamily, $titleFont, $subtitleFont, $textBrush, $mutedBrush, $format, $graphics)) {
    if ($item -ne $null) { $item.Dispose() }
  }
  Save-Png $bitmap $Path
}

function New-SocialProfile {
  param([string]$Path)
  $bitmap = New-Object System.Drawing.Bitmap 1024, 1024, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear((Convert-HexColor "#2563EB"))

  $greenBrush = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor "#22C55E")
  $orangeBrush = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor "#EA580C")
  $blueBrush = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor "#2563EB")
  $darkOverlay = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor "#0F172A" 34)
  $whiteBrush = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor "#FFFFFF")
  $shadowBrush = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor "#0F172A" 82)

  $graphics.FillPolygon($greenBrush, @(
    [System.Drawing.PointF]::new(0, 0),
    [System.Drawing.PointF]::new(1024, 0),
    [System.Drawing.PointF]::new(1024, 292),
    [System.Drawing.PointF]::new(0, 422)
  ))
  $graphics.FillPolygon($blueBrush, @(
    [System.Drawing.PointF]::new(0, 326),
    [System.Drawing.PointF]::new(1024, 198),
    [System.Drawing.PointF]::new(1024, 704),
    [System.Drawing.PointF]::new(0, 826)
  ))
  $graphics.FillPolygon($orangeBrush, @(
    [System.Drawing.PointF]::new(0, 734),
    [System.Drawing.PointF]::new(1024, 604),
    [System.Drawing.PointF]::new(1024, 1024),
    [System.Drawing.PointF]::new(0, 1024)
  ))

  $graphics.FillRectangle($darkOverlay, 0, 0, 1024, 1024)

  $fontFamily = New-Object System.Drawing.FontFamily "Segoe UI"
  $brandPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $brandPath.AddString(
    "RapiV",
    $fontFamily,
    [int][System.Drawing.FontStyle]::Bold,
    220,
    [System.Drawing.PointF]::new(0, 0),
    [System.Drawing.StringFormat]::GenericDefault
  )
  $bounds = $brandPath.GetBounds()
  $matrix = New-Object System.Drawing.Drawing2D.Matrix
  $matrix.Translate(512 - ($bounds.X + ($bounds.Width / 2)), 506 - ($bounds.Y + ($bounds.Height / 2)))
  $brandPath.Transform($matrix)
  $shadowMatrix = New-Object System.Drawing.Drawing2D.Matrix
  $shadowMatrix.Translate(0, 15)
  $shadowPath = $brandPath.Clone()
  $shadowPath.Transform($shadowMatrix)
  $graphics.FillPath($shadowBrush, $shadowPath)
  $graphics.FillPath($whiteBrush, $brandPath)

  foreach ($item in @($greenBrush, $orangeBrush, $blueBrush, $darkOverlay, $whiteBrush, $shadowBrush, $fontFamily, $brandPath, $matrix, $shadowMatrix, $shadowPath, $graphics)) {
    if ($item -ne $null) { $item.Dispose() }
  }
  Save-Png $bitmap $Path
}

function New-SocialCover {
  param([string]$Path)
  $bitmap = New-Object System.Drawing.Bitmap 1640, 624, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear((Convert-HexColor "#2563EB"))

  $overlay = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor "#0F172A" 72)
  $graphics.FillRectangle($overlay, 0, 0, 1640, 624)
  $accent = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor "#22C55E" 218)
  $graphics.FillEllipse($accent, 1380, -170, 390, 390)
  $orangeBrush = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor "#F97316" 205)
  $graphics.FillEllipse($orangeBrush, 1360, 368, 330, 330)

  $iconPath = New-RoundedRectanglePath 110 112 400 400 96
  $iconBrush = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor "#2563EB")
  $graphics.FillPath($iconBrush, $iconPath)
  Draw-FontAwesome6Icon $graphics 62798 "#FFFFFF" 202 310 312

  $fontFamily = New-Object System.Drawing.FontFamily "Segoe UI"
  $white = New-Object System.Drawing.SolidBrush -ArgumentList (Convert-HexColor "#FFFFFF")

  $titleFont = New-Object System.Drawing.Font($fontFamily, 88, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $subtitleFont = New-Object System.Drawing.Font($fontFamily, 36, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $graphics.DrawString("RapiV Vega de Alatorre", $titleFont, $white, 580, 178)
  $graphics.DrawString("La app para restaurantes, productos y negocios locales", $subtitleFont, $white, 586, 310)

  foreach ($item in @($overlay, $accent, $orangeBrush, $iconPath, $iconBrush, $fontFamily, $white, $titleFont, $subtitleFont, $graphics)) {
    if ($item -ne $null) { $item.Dispose() }
  }
  Save-Png $bitmap $Path
}

function New-LogoSvg {
  param([string]$Path)
  $svg = @'
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" rx="188" fill="#2563EB"/>
  <circle cx="831" cy="119" r="310" fill="white" fill-opacity=".11"/>
  <circle cx="52" cy="994" r="250" fill="white" fill-opacity=".10"/>
  <text x="266" y="528" fill="white" font-family="Segoe UI, Arial, sans-serif" font-size="320" font-weight="800">R</text>
  <text x="494" y="548" fill="white" font-family="Segoe UI, Arial, sans-serif" font-size="276" font-weight="800">V</text>
  <path d="M294 724L420 666L522 708L642 650L760 708" stroke="white" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" opacity=".82"/>
  <circle cx="294" cy="724" r="28" fill="white"/>
  <circle cx="294" cy="724" r="18" fill="#22C55E"/>
  <circle cx="642" cy="650" r="28" fill="white"/>
  <circle cx="642" cy="650" r="18" fill="#22C55E"/>
  <circle cx="760" cy="708" r="28" fill="white"/>
  <circle cx="760" cy="708" r="18" fill="#22C55E"/>
</svg>
'@
  Set-Content -LiteralPath $Path -Value $svg -Encoding UTF8
}

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$brandDir = Join-Path $root "brand-assets"
$socialDir = Join-Path $brandDir "social"
$logoDir = Join-Path $brandDir "logos"

New-BrandDirectory $brandDir
New-BrandDirectory $socialDir
New-BrandDirectory $logoDir
New-BrandDirectory (Join-Path $root "negocio-frontend\assets")
New-BrandDirectory (Join-Path $root "repartidor-frontend\assets")

New-LogoSvg (Join-Path $logoDir "rapiv-logo.svg")
New-SocialProfile (Join-Path $socialDir "profile-rapiv-vega.png")
New-SocialCover (Join-Path $socialDir "cover-rapiv-vega.png")

$apps = @(
  @{ Dir = "cliente-frontend"; Bg = "#2563EB"; Accent = "#22C55E"; Badge = "client"; Title = "RapiV Cliente"; Subtitle = "Tus favoritos de Vega" },
  @{ Dir = "negocio-frontend"; Bg = "#0F766E"; Accent = "#F59E0B"; Badge = "business"; Title = "RapiV Negocios"; Subtitle = "Pedidos y ventas en un solo lugar" },
  @{ Dir = "repartidor-frontend"; Bg = "#EA580C"; Accent = "#2563EB"; Badge = "courier"; Title = "RapiV Repartidor"; Subtitle = "Entregas locales al momento" }
)

foreach ($app in $apps) {
  $assetsDir = Join-Path $root "$($app.Dir)\assets"
  New-Icon (Join-Path $assetsDir "icon.png") $app.Bg $app.Accent $app.Badge $false
  New-Icon (Join-Path $assetsDir "adaptive-icon.png") $app.Bg $app.Accent $app.Badge $true
  New-Favicon (Join-Path $assetsDir "icon.png") (Join-Path $assetsDir "favicon.png")
  New-Splash (Join-Path $assetsDir "splash.png") $app.Bg $app.Accent $app.Badge $app.Title $app.Subtitle
}
