# 打包微信小游戏上传件。
#
# 不用 Compress-Archive：Windows PowerShell 5.1 的实现会把子目录条目写成
# 「js\core.js」，而 ZIP 规范（APPNOTE 4.4.17.1）要求路径分隔符一律是正斜杠。
# 反斜杠条目在部分解包器里会被当成一个带反斜杠的文件名，解出来是平铺的怪文件，
# 没有 js/ 目录，小游戏加载不到模块。这里手工建条目，显式写正斜杠。
#
# 只装运行需要的文件：check_core.py / extract_core.py / verify_core.js / test.html
# 是开发脚本，曾经被一起打进包里。
$ErrorActionPreference = 'Stop'
$src = 'D:\games\yyy\minigame'
$out = 'D:\games\yyy\羊羊羊之草原牧歌-小游戏.zip'

$files = @()
Get-ChildItem "$src\js" -Filter *.js -File | ForEach-Object { $files += @{ p = $_.FullName; n = 'js/' + $_.Name } }
foreach ($f in @('game.js', 'game.json', 'project.config.json')) {
  $files += @{ p = Join-Path $src $f; n = $f }
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path $out) { Remove-Item $out -Force }
$fs = [IO.File]::Open($out, 'Create')
$zip = New-Object IO.Compression.ZipArchive($fs, [IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($f in $files) {
    $entry = $zip.CreateEntry($f.n, [IO.Compression.CompressionLevel]::Optimal)
    $es = $entry.Open()
    $bytes = [IO.File]::ReadAllBytes($f.p)
    $es.Write($bytes, 0, $bytes.Length)
    $es.Close()
  }
} finally {
  $zip.Dispose(); $fs.Close()
}
'{0}  {1} 项  {2:N0} KB' -f $out, $files.Count, ((Get-Item $out).Length / 1KB)
