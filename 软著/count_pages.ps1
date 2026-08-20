# 用 Word 实际打开数页数并校验页眉。
# 显式分页符只保证「至少」翻页，行距一超就会溢出到下一页 —— 必须实测。
#
# 版式变更记录（重要，别把旧检查加回来）：
# 一代：页码写在正文每页最后一段，这里扫正文找「第 N 页」，缺了即溢出。
# 二代：页码移进页眉的 PAGE 域，正文不再有页码行 —— 旧检查 100% 误报。
# 三代（当前）：页码移到页脚居中，页眉只留软件全称与版本号。
# 沿用二代的「页眉里找页码域」同样会全部误报。
# 溢出在这三代下都必然表现为页数变多（分页全靠显式分页符），
# 所以「页数 == 期望值」本身就是溢出检查；另外确认页眉有名称+版本、页脚有页码域。
$ErrorActionPreference = 'Stop'
$dir = 'D:\games\yyy\软著'
$log = Join-Path $dir 'count_pages.log'
'start' | Out-File $log -Encoding utf8

# 文件 => 期望页数。传参可覆盖待检文件（用于文件被占用时先验暂存件）
$targets = @{
  '源程序鉴别材料.docx' = 60
  '文档鉴别材料.docx'   = 21
}
if ($args.Count -ge 1) { $targets = @{}; foreach ($a in $args) { $targets[$a] = 0 } }

$w = New-Object -ComObject Word.Application
$w.Visible = $false
$w.DisplayAlerts = 0
try {
  foreach ($f in $targets.Keys) {
    # 必须转成绝对路径：Word 的 COM 按它自己的工作目录（system32）解析相对路径，
    # 传相对路径进去会报「找不到您的文件」，看着像文件没生成
    $p = if (Test-Path $f) { (Resolve-Path $f).Path } else { Join-Path $dir $f }
    if (-not (Test-Path $p)) { ("{0}  跳过：文件不存在" -f $f) | Out-File $log -Append -Encoding utf8; continue }
    $d = $w.Documents.Open($p, $false, $true)   # ReadOnly，被别的程序占用时也能打开
    $pages = $d.ComputeStatistics(2)            # wdStatisticPages

    # 页眉：软件全称 + 版本号；页脚：PAGE 域
    $hdr = $d.Sections(1).Headers(1)            # wdHeaderFooterPrimary
    $ftr = $d.Sections(1).Footers(1)
    $htxt = $hdr.Range.Text
    $hasName = $htxt -match '羊羊羊之草原牧歌休闲消除游戏软件'
    $hasVer  = $htxt -match 'V1\.0'
    $hasNum  = $ftr.Range.Fields.Count -ge 1 -and ($ftr.Range.Fields(1).Type -eq 33)  # wdFieldPage
    # 页码不该再出现在页眉里 —— 两处都有会打印出两个页码
    $numInHdr = $hdr.Range.Fields.Count -ge 1

    $want = $targets[$f]
    $verdict = if ($want -gt 0 -and $pages -ne $want) { "页数不符，期望 $want" }
               elseif (-not ($hasName -and $hasVer)) { '页眉要素缺失' }
               elseif (-not $hasNum) { '页脚缺页码域' }
               elseif ($numInHdr) { '页眉里还残留页码域' }
               else { 'OK' }
    ("{0}  pages={1}  页眉[名称={2} 版本={3}]  页脚[页码域={4}]  {5}" `
      -f $f, $pages, $hasName, $hasVer, $hasNum, $verdict) | Out-File $log -Append -Encoding utf8
    $d.Close(0)
  }
  'done' | Out-File $log -Append -Encoding utf8
} catch {
  ('ERROR: ' + $_.Exception.Message) | Out-File $log -Append -Encoding utf8
} finally {
  $w.Quit()
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($w)
}
