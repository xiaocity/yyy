# 从最终的 .docx 导出 PDF。
# PDF 必须由 docx 导出，不要另从 HTML 打印：两条管线的行距和分页各算各的，
# 出来的页数对不上，交上去的纸稿和电子稿就成了两份不同的东西。
#
# 单独跑一个进程：带图的文档三千多段落，挂在会话里会被超时掐掉，
# 掐掉时 Word 还会留在后台占着文件（曾经挂了两个半小时）。
$ErrorActionPreference = 'Stop'
$dir = 'D:\games\yyy\软著'
$log = Join-Path $dir 'to_pdf.log'
'start ' + (Get-Date -Format 'HH:mm:ss') | Out-File $log -Encoding utf8

$wdExportFormatPDF = 17
$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
try {
  foreach ($n in @('文档鉴别材料', '源程序鉴别材料')) {   # 小的先转，早点有产出
    $src = Join-Path $dir "$n.docx"
    $dst = Join-Path $dir "$n.pdf"
    if (-not (Test-Path $src)) {
      ("{0}  跳过：源文件不存在" -f $n) | Out-File $log -Append -Encoding utf8
      continue
    }
    $d = $w.Documents.Open($src, $false, $true)      # ReadOnly
    $d.ExportAsFixedFormat($dst, $wdExportFormatPDF)
    $pages = $d.ComputeStatistics(2)                 # wdStatisticPages
    $d.Close(0)
    ("{0}.pdf  pages={1}  {2}" -f $n, $pages, (Get-Date -Format 'HH:mm:ss')) |
      Out-File $log -Append -Encoding utf8
  }
  'done' | Out-File $log -Append -Encoding utf8
} catch {
  ('ERROR: ' + $_.Exception.Message) | Out-File $log -Append -Encoding utf8
} finally {
  $w.Quit()
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($w)
}
