# -*- coding: utf-8 -*-
"""逐页核对 PDF 的页眉与页脚：
   每页应只出现一次页眉、一次「第 N 页」，且 N 等于该页的实际页序。
   页脚溢出到下一页时，下一页会出现两个页码（上一页的和自己的），
   或者本页缺页码 —— 两种都能在这里被抓到。

   同时报出每页最底/最顶元素的 y 坐标，便于判断是否贴边溢出。
"""
import re, sys
import fitz

PATH = sys.argv[1] if len(sys.argv) > 1 else u'D:/games/yyy/软著/文档鉴别材料.pdf'
doc = fitz.open(PATH)
print(u'%s：%d 页' % (PATH.split('/')[-1], doc.page_count))

HEAD = u'羊羊羊之草原牧歌休闲消除游戏软件'
bad = []
for i in range(doc.page_count):
    pg = doc[i]
    h_mm = pg.rect.height / 72 * 25.4
    txt = pg.get_text()
    # 只数页眉带里的：正文的「软件全称：××」与封面标题含同一串，
    # 按整页统计会把它们当成页眉重复。
    heads = 0
    for blk in pg.get_text('dict')['blocks']:
        for ln in blk.get('lines', []):
            if ln['bbox'][1] / 72 * 25.4 > 20:
                continue
            if HEAD in u''.join(sp['text'] for sp in ln['spans']):
                heads += 1
    nums = re.findall(u'第\\s*(\\d+)\\s*页', txt)
    want = str(i + 1)

    # 页码所在的 y 位置：正常应贴近页面下沿
    ys = []
    for blk in pg.get_text('dict')['blocks']:
        for ln in blk.get('lines', []):
            s = u''.join(sp['text'] for sp in ln['spans'])
            if re.search(u'第\\s*\\d+\\s*页', s):
                ys.append(round(ln['bbox'][1] / 72 * 25.4, 1))

    issue = []
    if heads != 1:
        issue.append(u'页眉出现 %d 次' % heads)
    if len(nums) != 1:
        issue.append(u'页码出现 %d 次：%s' % (len(nums), nums))
    elif nums[0] != want:
        issue.append(u'页码为 %s，应为 %s' % (nums[0], want))
    for y in ys:
        if y < h_mm * 0.5:
            issue.append(u'页码出现在页面上半部（y=%.0fmm，页高 %.0fmm）' % (y, h_mm))
    if issue:
        bad.append((i + 1, issue, ys))

if bad:
    print(u'\n发现 %d 页异常：' % len(bad))
    for p, iss, ys in bad:
        print(u'  第 %2d 页  %s  页码y=%s' % (p, u'；'.join(iss), ys))
else:
    print(u'\n全部 %d 页：页眉一次、页码一次且与页序相符、页码均在页面下半部' % doc.page_count)
doc.close()
