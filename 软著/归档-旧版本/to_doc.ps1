# 把 .docx 另存为 Word 97-2003 的 .doc。
# 单独跑一个进程：这一步慢（三千多段落 + 图片），
# 挂在会话里会被超时掐掉，掐掉时 Word 还会留在后台。
$ErrorActionPreference = 'Stop'
$dir = 'D:\games\yyy\软著'
$log = Join-Path $dir 'to_doc.log'
'start ' + (Get-Date -Format 'HH:mm:ss') | Out-File $log -Encoding utf8

$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
try {
  foreach ($n in @('文档鉴别材料-v2', '源程序鉴别材料')) {   # 小的先转，早点有产出
    $src = Join-Path $dir "$n.docx"
    $dst = Join-Path $dir "$n.doc"
    if (Test-Path $dst) { Remove-Item $dst -Force }
    $d = $w.Documents.Open($src, $false, $false)
    $d.SaveAs2($dst, 0)
    $pages = $d.ComputeStatistics(2)
    $d.Close(0)
    ("{0}.doc  pages={1}  {2}" -f $n, $pages, (Get-Date -Format 'HH:mm:ss')) | Out-File $log -Append -Encoding utf8
  }
  'done' | Out-File $log -Append -Encoding utf8
} catch {
  ('ERROR: ' + $_.Exception.Message) | Out-File $log -Append -Encoding utf8
} finally {
  $w.Quit()
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($w)
}
