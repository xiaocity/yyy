# -*- coding: utf-8 -*-
"""
生成软著登记的鉴别材料（源程序 / 文档）打印稿。

依据《计算机软件著作权登记办法》第十条：源程序与任一种文档各取前、后连续 30 页；
不足 60 页的提交全部。程序每页不少于 50 行，文档每页不少于 30 行。
中国版权保护中心实务另要求每页页眉标注软件全称与版本号、页码连续编号。
"""
import io, os, re, html, base64

NAME = u'羊羊羊之草原牧歌休闲消除游戏软件'
VER  = u'V1.0'
HERE = os.path.dirname(os.path.abspath(__file__))

# 配图挂在正文后面，不参与分页、也不占正文行数——
# 「每页不少于 30 行」说的是文字，图只能吃页面剩下的余量（实测 79.6mm）
#
# 锚点用章节标题，不用页码。原来是 {2: 首页图, 3: 模式图, ...} 按页码硬挂的，
# 折行宽度一改、总页数一变，十一张图会整体错位到不相干的章节上，
# 而且错了不会报错。挂在标题文字上，图就跟着它说明的那节走。
# 序号不写死，按锚点在文中出现的先后自动编号，调整顺序不用手改图注。
# 锚点之间必须隔开至少 DOC_LINES_WITH_FIG 行（见 check_fig_spacing）：
# 一页版心 268mm，一张 70mm 的图加图注要吃掉 76mm，剩下只够 30 行文字，
# 所以一页最多挂一张图。锚点凑得太近时，多出来的图只能顺延，
# 十一张图会整体错位一位——「关卡地图」排到讲结算对战的页上。
# 最初按 3.2/3.3/3.4/3.5 逐节挂图正是这个毛病：第三章四节加起来才 34 行。
# 现在改成沿全文铺开，每张图挂在与它内容相符、且与前一张隔得够远的一节上。
FIGS = [
    (u'4.1 首页与每日内容',      u'首页的问候卡',                  'home.png'),
    (u'4.2 关卡地图与章节结构',  u'关卡地图与章节进度',            'levels.png'),
    (u'4.3 对局界面与基本玩法',  u'牌局界面：多层堆叠与特殊牌标记', 'game.png'),
    (u'4.4 卡槽、彩虹槽与胜负',  u'彩虹槽（上）与 7 格卡槽（下）',  'slot.png'),
    (u'4.6 道具系统',            u'三个道具按钮与剩余数量',        'tools.png'),
    (u'4.8 结算与题面暗号',      u'通关结算页',                    'win.png'),
    (u'4.9 游戏模式',            u'首页的四个模式入口',            'modes.png'),
    (u'4.10 排行与记录',         u'排行页的个人纪录墙',            'rank.png'),
    (u'4.11 收集与养成',         u'羊图鉴的收集网格',              'dex.png'),
    (u'4.12 商店与经济',         u'商店：道具购买与升级',          'shop.png'),
    # 4.15 玩法说明页原有一张局部图，但附录七已收录该页的整屏截图，
    # 两者重复；4.14 与 4.15 只隔 18 行也放不下两张。改为在 4.14 放设置开关，
    # 玩法说明页交由附录的整屏截图呈现。
    (u'4.14 设置项与本地存档',   u'四项设置开关',                  'settings.png'),
]

# 附录里的整屏截图，一排三张。正文插图是界面局部，这里是完整页面。
# 竖版整屏宽高比 375:812，满宽一张要占 402mm、装不下；一排两张剩 10 行文字；
# 一排三张（58mm 宽、125mm 高）剩 21 行，是唯一兼顾图幅与行数的排法。
# 六张整屏截图排成两行三列，整体挂在附录开篇那句话之后。
# 拆成两页各一行时，两页都只剩二十行文字、右下大片空白；并成一块之后
# 图幅需从 58mm 收到 46mm，但六张图连在一起、说明文字集中排在其后。
FIG_ROWS = [
    # 按游玩流程排序：首页 → 关卡地图 → 对局 → 羊图鉴 → 商店 → 我的。
    # 原本第六张是玩法说明页，与正文 4.15 节所述重复，换成对局页——
    # 对局是本软件的核心界面，正文却只有局部插图，缺一张整屏。
    (u'附录七 主要界面完整截图', [
        (u'首页',         'home.png'),
        (u'关卡地图页',   'levels.png'),
        (u'对局页',       'game.png'),
        (u'羊图鉴页',     'dex.png'),
        (u'商店页',       'shop.png'),
        (u'我的页',       'mine.png'),
    ]),
]
FIG_ROW_W_MM = 46             # 单张宽度；高 = 宽 / (375/812)
# 两行图区实测约 221mm，版心 254mm 余 33mm ≈ 5 行，正好放下附录标题与开篇一句
DOC_LINES_WITH_ROW = 5
FIGS_FULL_DIR = 'figs-full'

# 「每页不少于 50 行 / 30 行」是下限不是上限。按下限排，一页只用掉一半、
# 下面全空着，既浪费页数也不好看。按版心能装下的实际行数排满：
PROG_LINES_PER_PAGE = 60      # 8.6pt / 行高 1.33，60 行约占 242mm（版心 246mm）
DOC_LINES_PER_PAGE  = 44      # 10.5pt / 行高 1.5，44 行约占 244mm
DOC_LINES_WITH_FIG  = 30      # 带图的页留出 79.6mm 给图，仍满足 30 行下限
WRAP = 96          # 源程序每行硬折宽度，折行照样计入行数
# 文档的折行宽度。单位是「显示宽度」（_w：全角 2、半角 1），不是字符数。
# 原来这里传的是 40，注释写着「中文每行约 40 字」——把单位当成字符数了，
# 实际只折到 20 个中文字，正文占版心 40%，右边空掉一大半。
# 版心 18.6cm ÷ 宋体 10.5pt 全角字宽 0.370cm = 50.3 字 = 100 宽度单位，
# 取 96（48 字）留 0.84cm 余量，避免 Word 里二次折行把页数顶乱。
DOC_WRAP = 96

CSS = u'''
@page { size: A4; margin: 14mm 12mm 12mm 12mm; }
* { box-sizing: border-box; }
body { margin:0; font-family:"SimSun","宋体",serif; }
/* A4 高 297mm，减去 @page 的上下边距 14+12 = 271mm。
   写 273mm 会溢出到下一页，每页后面跟一张空白页（60 页变 120 页）。
   留 3mm 余量吸收取整误差 */
.page { page-break-after: always; height: 268mm; display:flex; flex-direction:column; }
.page:last-child { page-break-after: auto; }
.hd { border-bottom:1px solid #000; padding-bottom:3mm; margin-bottom:4mm;
      font-size:10.5pt; display:flex; justify-content:space-between; align-items:baseline; }
.hd b { font-weight:700; letter-spacing:.5px; }
.hd span { font-size:9.5pt; }
.body { flex:1; }
/* 页码在页脚。.body 是 flex:1，页脚自然被推到版心底部，
   短页（末页、带图页）的页码也仍然贴着页面下沿，不会浮在半空 */
.ft { border-top:1px solid #000; padding-top:2.5mm; margin-top:4mm;
      text-align:center; font-size:9.5pt; }
pre { margin:0; font-family:"Consolas","Courier New",monospace; font-size:8.6pt; line-height:1.33;
      white-space:pre-wrap; word-break:break-all; }
.doc { font-size:10.5pt; line-height:1.5; white-space:pre-wrap; }
.fig { margin-top:5mm; padding-top:3mm; border-top:1px dashed #999; text-align:center; }
/* 附录的整屏截图：两行三列。竖版 375:812 满宽一张要 402mm 高、装不下；
   六张并成一块后图幅取 FIG_ROW_W_MM，剩余高度留给附录标题与开篇一句 */
.figrow { margin-top:5mm; padding-top:3mm; border-top:1px dashed #999;
          display:flex; flex-wrap:wrap; gap:4mm 6mm; }
/* 格子占三分之一版心，图本身窄一些居中：格子定宽才能保证每行正好三张，
   否则六张图会按图宽自由换行，一行挤进四张 */
.figrow figure { margin:0; width:calc((100% - 12mm) / 3); text-align:center; }
.figrow img { width:__FIGW__mm; border:1px solid #999; display:block; margin:0 auto; }
.figrow figcaption { font-size:8.5pt; color:#333; margin-top:1.5mm; line-height:1.35; }
/* 图高上限 64mm 而非 70mm：30 行正文 + 图 + 图注 + 页脚在打印时会差约 5mm，
   页脚被挤到下一页顶部（实测第 4、12、14 页如此，屏幕布局看不出来，
   因为 .body 是 flex:1、三个子元素高度之和恒等于页高）。留足余量吸收取整。 */
.fig img { max-width:140mm; max-height:64mm; border:1px solid #999; }
.fig .cap { font-size:9.5pt; color:#333; margin-top:1.5mm; }
.gap { text-align:center; font-size:11pt; padding:6mm 0; border-top:1px dashed #666; border-bottom:1px dashed #666; margin:4mm 0; }
'''.replace(u'__FIGW__', str(FIG_ROW_W_MM))


def _w(ch):
    """显示宽度：中日韩字符占两格。按字符数折行的话，
       中文注释行在 Word 里会被二次折行，页数就对不上了。"""
    o = ord(ch)
    if (0x1100 <= o <= 0x115F or 0x2E80 <= o <= 0xA4CF or 0xAC00 <= o <= 0xD7A3
            or 0xF900 <= o <= 0xFAFF or 0xFE30 <= o <= 0xFE4F
            or 0xFF00 <= o <= 0xFF60 or 0xFFE0 <= o <= 0xFFE6
            or 0x20000 <= o <= 0x3FFFD):
        return 2
    return 1


def wrap_line(s, width=WRAP):
    """按显示宽度硬折行；空行保留为一行。"""
    s = s.replace('\t', '    ').rstrip()
    if not s:
        return ['']
    out, cur, w = [], [], 0
    for ch in s:
        cw = _w(ch)
        if w + cw > width and cur:
            out.append(''.join(cur))
            cur, w = [], 0
        cur.append(ch)
        w += cw
    if cur:
        out.append(''.join(cur))
    return out


def minigame_files():
    """小游戏版的源码也要进鉴别材料：手册里写了小游戏版本，
       源程序里却找不到对应实现的话，材料自身就是矛盾的。"""
    d = os.path.join(HERE, '..', 'minigame')
    # 核心算法排最前：它是这个软件真正的独创部分，也最该被审查员看到
    order = ['js/core.js', 'js/scene_game.js', 'js/ui.js', 'js/page.js',
             'js/save.js', 'js/plat.js', 'js/sfx.js',
             'js/scene_home.js', 'js/scene_levels.js', 'js/scene_more.js',
             'js/main.js', 'game.js', 'game.json', 'project.config.json']
    out = []
    for rel in order:
        p = os.path.join(d, rel.replace('/', os.sep))
        if not os.path.exists(p):
            continue
        out.append((u'minigame/' + rel, io.open(p, encoding='utf-8').read()))
    return out


def android_files():
    """安卓版的壳与清单。它只有一百多行，但手册第二章写了安卓版本，
       材料里得有对应实现。"""
    d = os.path.join(HERE, '..', 'android')
    order = ['java/com/cityg/caoyuan/MainActivity.java', 'AndroidManifest.xml',
             'res/values/strings.xml', 'res/drawable/ic_launcher.xml']
    out = []
    for rel in order:
        p = os.path.join(d, rel.replace('/', os.sep))
        if os.path.exists(p):
            out.append((u'android/' + rel, io.open(p, encoding='utf-8').read()))
    return out


def load_source():
    src = io.open(os.path.join(HERE, '..', 'index.html'), encoding='utf-8').read()
    # 内嵌的 Font Awesome 字体是第三方作品（CC BY 4.0），且单行 20.8 万字符，
    # 既不是申请人的原创代码，打印出来也只是上百页乱码。折叠成一行说明。
    src = re.sub(
        r'src:url\(data:font/woff2;base64,[A-Za-z0-9+/=]+\)',
        u'src:url(data:font/woff2;base64,'
        u'/* 此处为内嵌的第三方图标字体二进制数据（Font Awesome 6 Free，CC BY 4.0 许可），'
        u'非本软件原创代码，为便于审阅在鉴别材料中折叠标注，实际源程序中为完整的 base64 字符串 */)',
        src, count=1)
    out = []

    # 顺序是有讲究的：只提交前 30 + 后 30 页，取样落在哪一段完全由拼接顺序决定。
    # 网页版是单文件实现，开头 900 多行是 CSS —— 原来把它排在最前，
    # 结果前 30 页里 24 页是样式表、0 页是代码，审查员翻开第一页看不到任何程序。
    # 改成算法在前：小游戏版的核心与玩法逻辑占住前 30 页，
    # 网页版排中间，安卓壳收尾落进后 30 页，三种形态在提交页里都露面。
    for name, text in minigame_files():
        out.append(u'/* ===== 微信小游戏版 ' + name + u' ===== */')
        for ln in text.split('\n'):
            out.extend(wrap_line(ln))
        out.append(u'')

    out.append(u'/* ===== 网页版 index.html（单文件实现，含全部玩法与界面） ===== */')
    for ln in src.split('\n'):
        out.extend(wrap_line(ln))

    for name, text in android_files():
        out.append(u'')
        out.append(u'/* ===== 安卓版 ' + name + u' ===== */')
        for ln in text.split('\n'):
            out.extend(wrap_line(ln))
    return out


def doc_lines(txt):
    """把说明书正文折成行。

    尾部空行必须去掉：文件末尾的换行会折出一个空行，正好溢出成一整张
    只有空白的末页（实测第 22 页只有 1 行且无内容）。
    """
    out = []
    for ln in txt.split('\n'):
        out.extend(wrap_line(ln, DOC_WRAP))
    while out and not out[-1].strip():
        out.pop()
    return out


def _find_anchor(lines, anchor, what):
    idx = next((k for k, l in enumerate(lines) if l.strip().startswith(anchor)), None)
    if idx is None:
        raise ValueError(u'配图锚点未找到：「%s」（%s）——章节标题改过？' % (anchor, what))
    return idx


def locate_figs(lines):
    """把 FIGS 与 FIG_ROWS 的文字锚点解析成「图块」并统一编号。

    图块 = (行号, [(图注, 文件名, 所在目录)...], 该页容量)。
    正文插图每块一张、页容量 30 行；附录整屏截图每块三张、页容量 21 行。
    两者走同一套分页与间距校验，避免新增一种排法时漏掉校验。

    锚点找不到就抛错，不静默丢图——少一张图在二十来页里几乎看不出来，
    等发现已经交上去了。
    """
    blocks = []
    for anchor, cap, fn in FIGS:
        blocks.append((_find_anchor(lines, anchor, fn), [(cap, fn, 'figs')], DOC_LINES_WITH_FIG))
    for anchor, items in FIG_ROWS:
        idx = _find_anchor(lines, anchor, items[0][1])
        blocks.append((idx, [(cap, fn, FIGS_FULL_DIR) for cap, fn in items], DOC_LINES_WITH_ROW))
    blocks.sort(key=lambda b: b[0])
    check_fig_spacing(blocks)

    # 图号在全文连续，跨过正文插图与附录截图两批
    out, n = [], 0
    for idx, items, cap_lines in blocks:
        named = []
        for cap, fn, d in items:
            n += 1
            named.append((u'图 %d  %s' % (n, cap), fn, d))
        out.append((idx, named, cap_lines))
    return out


def check_fig_spacing(blocks):
    """相邻锚点隔得不够远就报错。

    一页只挂得下一个图块，锚点间距小于该页容量时，后面的图排不进自己
    那一页，只能顺延——十一张图会整体错位一位，而且悄无声息。
    间距要求取「靠前那一块」的容量：图块不同，占掉的行数也不同。
    """
    bad = []
    for k in range(1, len(blocks)):
        gap = blocks[k][0] - blocks[k - 1][0]
        need = blocks[k - 1][2]
        if gap < need:
            bad.append((blocks[k - 1][1][0][1], blocks[k][1][0][1], gap, need))
    if bad:
        msg = u'；'.join(u'%s 与 %s 相隔 %d 行（需 >= %d）' % b for b in bad)
        raise ValueError(
            u'配图锚点过近，一页只放得下一个图块：%s。'
            u'请把靠后的图改挂到更远的章节上。' % msg)


def paginate_var(lines, base_cap, figs, fig_cap=None):
    """按页切分，带图的页容量小一些——图要占掉版心下半部分。

    figs 是 locate_figs() 给出的 (行号, [(图注, 文件名, 目录)...], 页容量) 有序表。
    一页最多挂一个图块（版心只留得下一个）；同一页里挤了两个锚点时，
    第二个顺延到下一页。返回 (页列表, {页码: [(图注, 文件名, 目录)...]})。
    """
    q = list(figs)
    pages, by_page, i, no = [], {}, 0, 1
    while i < len(lines):
        a = q[0][0] if q else None
        blk_cap = q[0][2] if q else base_cap      # 每个图块自带它那页的容量
        if a is None or a >= i + base_cap:
            cap = base_cap                       # 本页内没有锚点，排满
        elif a < i + blk_cap:
            cap = blk_cap                        # 锚点在图页容量内，本页留图位
            by_page[no] = q[0][1]
            q.pop(0)
        else:
            # 锚点落在 fig_cap 之后、base_cap 之内：两种排法都不对——
            # 留图位会把锚点挤到下一页（图跑到它说明的内容前面），
            # 不留位则锚点留在本页、图顺延到下一页（图落在下一节的内容上，
            # 实测图 2「关卡地图」会排到讲结算对战的页上）。
            # 改为切在锚点前一行，让锚点成为下一页的首行，图紧跟其后。
            # a - i 必然在 [blk_cap, base_cap) 内，不会跌破每页行数下限。
            cap = a - i
        pages.append(lines[i:i + cap])
        i += cap
        no += 1
    if q:
        raise ValueError(u'有 %d 个图块没排上页：%s'
                         % (len(q), [x[1][0][1] for x in q]))
    return balance_tail(pages, by_page, DOC_LINES_WITH_FIG, base_cap), by_page


def balance_tail(pages, by_page, min_lines, max_lines):
    """末页太短时，把结尾几页的行数摊匀。

    按容量切页，末页剩多少算多少——实测末页只剩 7 行，而规定是每页不少于
    30 行。并进上一页也不行：上一页已经 44 行，合起来 51 行装不下一页。
    改成把结尾连续的无图页合起来重新等分（44+44+44+7 → 35/35/35/34）。
    只动无图页：重排带图页的行数会让图和它的锚点错开。
    """
    n = len(pages)
    if n < 2 or len(pages[-1]) >= min_lines:
        return pages
    start = n                       # 结尾连续无图页的起点（0-based 切片下标）
    while start > 0 and start not in by_page:
        start -= 1
    tail = pages[start:]
    if len(tail) < 2:
        return pages                # 末页紧挨着带图页，动不了
    flat = [l for pg in tail for l in pg]
    k = len(tail)
    while k > 1 and len(flat) < min_lines * k:
        k -= 1                      # 摊不到每页 30 行就少用一页
    if len(flat) > max_lines * k:
        return pages                # 反而装不下，维持原样
    size, extra = divmod(len(flat), k)
    out, i = [], 0
    for j in range(k):
        c = size + (1 if j < extra else 0)
        out.append(flat[i:i + c])
        i += c
    return pages[:start] + out


def paginate(lines, per_page, merge_tail=True, tail_cap=40):
    """按 per_page 切页。末页不足一页时并入上一页——每页「不少于」多少行是下限而非上限，
       并页后仍在一页可容纳的行数内，避免出现只有一两行的末页。"""
    pages = [lines[i:i + per_page] for i in range(0, len(lines), per_page)]
    if (merge_tail and len(pages) > 1 and len(pages[-1]) < per_page
            and len(pages[-2]) + len(pages[-1]) <= tail_cap):
        pages[-2] = pages[-2] + pages[-1]
        pages.pop()
    return pages


def render(pages, kind, out_name, total_pages_note, figs_by_page=None):
    """kind: 'prog' 用等宽，'doc' 用宋体"""
    figs_by_page = figs_by_page or {}
    # 页眉右侧标明材料类别，与 docx 侧一致（参照件的页眉即为
    # 「软件全称 版本号 软件说明书」）
    ver = VER + (u'　' + total_pages_note if kind == 'doc' else u'')
    chunks = []
    for idx, (pageno, lines) in enumerate(pages):
        if lines is None:                      # 中间的省略分隔
            chunks.append(u'<div class="page"><div class="hd"><b>%s</b><span>%s</span></div>'
                          u'<div class="body"><div class="gap">%s</div></div>'
                          u'<div class="ft">— 中略 —</div></div>' % (NAME, VER, lines_gap))
            continue
        body = u'\n'.join(html.escape(x) for x in lines)
        tag = u'pre' if kind == 'prog' else u'div class="doc"'
        end = u'pre' if kind == 'prog' else u'div'
        fig = u''
        if kind == 'doc' and pageno in figs_by_page:
            items = figs_by_page[pageno]
            enc = []
            for cap, fn, d in items:
                fp = os.path.join(HERE, d, fn)
                if os.path.exists(fp):
                    enc.append((cap, base64.b64encode(io.open(fp, 'rb').read()).decode('ascii')))
            if len(enc) == 1:
                fig = (u'<div class="fig"><img src="data:image/png;base64,%s">'
                       u'<div class="cap">%s</div></div>' % (enc[0][1], enc[0][0]))
            elif enc:
                cells = u''.join(
                    u'<figure><img src="data:image/png;base64,%s">'
                    u'<figcaption>%s</figcaption></figure>' % (b, c) for c, b in enc)
                fig = u'<div class="figrow">%s</div>' % cells
        chunks.append(
            u'<div class="page"><div class="hd"><b>%s</b><span>%s</span></div>'
            u'<div class="body"><%s>%s</%s>%s</div>'
            u'<div class="ft">第 %d 页</div></div>'
            % (NAME, ver, tag, body, end, fig, pageno))
    doc = (u'<!doctype html><html><head><meta charset="utf-8">'
           u'<title>%s %s %s</title><style>%s</style></head><body>%s</body></html>'
           % (NAME, VER, total_pages_note, CSS, u''.join(chunks)))
    p = os.path.join(HERE, out_name)
    io.open(p, 'w', encoding='utf-8').write(doc)
    return p


lines_gap = u''

def pick_30_30(all_pages):
    """>60 页取前 30 + 后 30；否则全取。

    页码按「提交件」连续编号 1..N，而不是保留原文件里的编号。
    保留原编号的话，一份 60 页的文件末页会写着「第 139 页」，
    看上去就像装订错了。原文件总页数在申请表里说明。
    """
    n = len(all_pages)
    if n <= 60:
        return [(i + 1, pg) for i, pg in enumerate(all_pages)], n, False
    picked = [all_pages[i] for i in range(30)] + [all_pages[n - 30 + i] for i in range(30)]
    return [(i + 1, pg) for i, pg in enumerate(picked)], n, True


def main():
    # ---------- 源程序 ----------
    src_lines = load_source()
    pages = paginate(src_lines, PROG_LINES_PER_PAGE, merge_tail=False)
    picked, total, cut = pick_30_30(pages)
    p1 = render(picked, 'prog', u'源程序鉴别材料.html', u'源程序')
    print(u'源程序：原始 %d 行 → 共 %d 页，提交 %d 页%s'
          % (len(src_lines), total, len(picked), u'（前30+后30）' if cut else u'（全部）'))

    # ---------- 文档 ----------
    txt = io.open(os.path.join(HERE, u'软件说明书.txt'), encoding='utf-8').read()
    dlines = doc_lines(txt)
    dpages, dfigs = paginate_var(dlines, DOC_LINES_PER_PAGE, locate_figs(dlines))
    dpicked, dtotal, dcut = pick_30_30(dpages)
    p2 = render(dpicked, 'doc', u'文档鉴别材料.html', u'软件说明书', dfigs)
    print(u'文档：%d 行 → 共 %d 页，提交 %d 页%s'
          % (len(dlines), dtotal, len(dpicked), u'（前30+后30）' if dcut else u'（全部）'))
    print(p1); print(p2)


if __name__ == '__main__':
    main()
