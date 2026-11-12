# 11-12 윈도 OCR(Windows.Media.Ocr · 한국어)로 PNG 들의 글자를 읽어요 — 「글자를 다 투명하게 지운 틀 사진」에 글자가 남는지(그림으로 그린 글자) 찾는 데 써요.
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools/site-rig/ocr.ps1 <PNG 폴더> <결과 json>
param([string]$Dir, [string]$Out)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(-1) | Out-Null; $task.Result }
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
$lang = [Windows.Globalization.Language]::new('ko')
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
$res = @{}
foreach ($f in Get-ChildItem -Path $Dir -Filter *.png) {
    $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($f.FullName)) ([Windows.Storage.StorageFile])
    $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bmp = Await ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $r = Await ($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
    $res[$f.BaseName] = @($r.Lines | ForEach-Object { $_.Text })
    $stream.Dispose()
}
$res | ConvertTo-Json -Depth 4 | Out-File -FilePath $Out -Encoding utf8
