# 诊断 docx 与 HTML 页数不一致：报出每张表格所在页、每页的行数与内容起止。
# 只读打开，不修改文件。
$ErrorActionPreference = 'Stop'
$dir = 'D:\games\yyy\软著'
$log = Join-Path $dir 'diag_pages.log'
'start' | Out-File $log -Encoding utf8

$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
try {
  $p = Join-Path $dir '文档鉴别材料.docx'
  $d = $w.Documents.Open($p, $false, $true)
  $pages = $d.ComputeStatistics(2)          # wdStatisticPages
  ("总页数 = {0}" -f $pages) | Out-File $log -Append -Encoding utf8

  ("表格数 = {0}" -f $d.Tables.Count) | Out-File $log -Append -Encoding utf8
  for ($i = 1; $i -le $d.Tables.Count; $i++) {
    $t = $d.Tables.Item($i)
    # wdActiveEndPageNumber = 3
    $pg = $t.Range.Information(3)
    ("  表格 {0} 位于第 {1} 页，高 {2:N1} pt" -f $i, $pg, $t.Rows.Item(1).Height) |
      Out-File $log -Append -Encoding utf8
  }

  # 每页的首行文字，用来看哪一页被挤开了
  '每页首行：' | Out-File $log -Append -Encoding utf8
  for ($i = 1; $i -le $pages; $i++) {
    $rng = $d.GoTo(1, 1, $i)                # wdGoToPage
    $end = $d.GoTo(1, 1, $i + 1)
    $stop = [Math]::Max($rng.Start, $end.Start - 1)
    $txt = $d.Range($rng.Start, $stop).Text
    $lines = ($txt -split "`r") | Where-Object { $_.Trim() -ne '' }
    $first = if ($lines.Count) { $lines[0] } else { '（空页）' }
    if ($first.Length -gt 26) { $first = $first.Substring(0, 26) }
    ("  第 {0,2} 页  文字行 {1,3}  首行: {2}" -f $i, $lines.Count, $first) |
      Out-File $log -Append -Encoding utf8
  }
  $d.Close(0)
  'done' | Out-File $log -Append -Encoding utf8
} catch {
  ('ERROR: ' + $_.Exception.Message) | Out-File $log -Append -Encoding utf8
} finally {
  $w.Quit()
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($w)
}
