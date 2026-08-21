# -*- coding: utf-8 -*-
"""生成 Play 商店素材：512×512 应用图标 + 1024×500 功能图。

几何全部照抄游戏里的 #sheep symbol（120 视口），和安卓桌面图标同源。
PIL 的绘制不抗锯齿，所以一律 4 倍超采样再 LANCZOS 缩回去。
"""
import io, math, os
from PIL import Image, ImageDraw, ImageFont

INK   = (46, 107, 62)     # #2E6B3E
WOOL  = (255, 255, 255)
FACE  = (251, 253, 247)   # #FBFDF7
BLUSH = (246, 196, 69)    # #F6C445
RING  = (211, 232, 198)   # #D3E8C6
CREAM = (246, 250, 240)   # #F6FAF0
SAGE  = (232, 239, 226)   # #E8EFE2
HILL  = (60, 124, 76)     # #3C7C4C

S = 4  # 超采样倍数
OUT = r'D:\games\yyy\store'
os.makedirs(OUT, exist_ok=True)


def ell(d, cx, cy, rx, ry, fill=None, outline=None, w=0):
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=fill, outline=outline, width=w)


def sheep(img, ox, oy, scale):
    """按 120 视口的坐标画羊；(ox,oy) 是视口左上角在画布上的位置。"""
    d = ImageDraw.Draw(img, 'RGBA')
    def X(v): return ox + v * scale
    def Y(v): return oy + v * scale
    def W(v): return max(1, int(round(v * scale)))

    # 羊毛三团
    # 顺序照抄 SVG：左 -> 中 -> 右，所以右边压中间、中间压左边
    for cx, cy, r in ((42, 56, 16), (60, 48, 18), (78, 56, 16)):
        ell(d, X(cx), Y(cy), r * scale, r * scale, fill=WOOL, outline=INK, w=W(4))
    # 两只角
    for x in (45, 69):
        d.rounded_rectangle([X(x), Y(64), X(x + 6.5), Y(79)], radius=3.2 * scale, fill=INK)
    # 两只耳朵：原 SVG 带 rotate(±24)，单独画在透明层上再旋转
    for cx, cy, rot in ((41.5, 82, 24), (78.5, 82, -24)):
        pad = int(24 * scale)
        lay = Image.new('RGBA', (pad * 2, pad * 2), (0, 0, 0, 0))
        ld = ImageDraw.Draw(lay)
        ell(ld, pad, pad, 5.5 * scale, 9.5 * scale, fill=FACE, outline=INK, w=W(3.5))
        lay = lay.rotate(rot, resample=Image.BICUBIC, center=(pad, pad))
        img.alpha_composite(lay, (int(X(cx)) - pad, int(Y(cy)) - pad))
    # 脸
    ell(d, X(60), Y(86), 16.5 * scale, 13.5 * scale, fill=FACE, outline=INK, w=W(4))
    # 眼睛
    for cx in (53.5, 66.5):
        ell(d, X(cx), Y(85), 2.5 * scale, 2.5 * scale, fill=INK)
    # 嘴：原是 q 曲线，用一段圆弧近似
    d.arc([X(57.4), Y(88.4), X(62.6), Y(92.2)], 20, 160, fill=INK, width=W(2.4))
    # 腮红（原 opacity .65）
    for cx in (45, 75):
        ell(d, X(cx), Y(91), 3.8 * scale, 2.4 * scale, fill=BLUSH + (166,))


def dashed_ring(img, ox, oy, scale, n=14, gap=0.58):
    d = ImageDraw.Draw(img)
    r = 45 * scale
    cx, cy = ox + 60 * scale, oy + 60 * scale
    step = 360.0 / n
    arc = step * (1 - gap)
    for i in range(n):
        a0 = i * step
        d.arc([cx - r, cy - r, cx + r, cy + r], a0, a0 + arc,
              fill=RING, width=max(1, int(round(2.5 * scale))))


# ---------------- 512×512 应用图标 ----------------
# Play 会自己加圆角，所以这里做成铺满的方图。
N = 512 * S
icon = Image.new('RGBA', (N, N), CREAM + (255,))
sc = N / 120.0
dashed_ring(icon, 0, 0, sc)
sheep(icon, 0, -3 * sc, sc)          # 羊中心偏下，整体上移一点
icon = icon.resize((512, 512), Image.LANCZOS)
icon.save(os.path.join(OUT, 'play-icon-512.png'))
print('play-icon-512.png  512x512')

# ---------------- 1024×500 功能图 ----------------
# Play 在部分界面会裁切这张图，所以主体往中间靠，四周留出余量。
import math
FW, FH = 1024 * S, 500 * S
fg = Image.new('RGBA', (FW, FH), SAGE + (255,))
d = ImageDraw.Draw(fg)

# 天光：上浅下深的线性渐变
for y in range(FH):
    k = min(1.0, y / (FH * 0.78))
    d.line([(0, y), (FW, y)], fill=tuple(int(CREAM[i] + (SAGE[i] - CREAM[i]) * k) for i in range(3)))

# 两层草坡：用正弦波画，比多边形拐点柔和
def hill(base, amp, phase, color):
    pts = [(x, base + amp * math.sin(x / float(FW) * math.pi * 2 + phase)) for x in range(0, FW + 1, 8)]
    d.polygon(pts + [(FW, FH), (0, FH)], fill=color)

hill(FH * 0.70, FH * 0.045, 0.6, (214, 231, 205))
hill(FH * 0.83, FH * 0.035, 2.4, HILL)

# 羊：靠右，与文字不相碰
ssc = (FH * 0.66) / 120.0
sheep(fg, FW * 0.665, FH * 0.13, ssc)

# 文字：左侧，右边界卡在羊之前
try:
    f1 = ImageFont.truetype(r'C:\Windows\Fonts\segoeuib.ttf', int(74 * S))
    f2 = ImageFont.truetype(r'C:\Windows\Fonts\segoeui.ttf', int(30 * S))
except Exception:
    f1 = f2 = ImageFont.load_default()
d.text((72 * S, 182 * S), 'Sheep Meadow', font=f1, fill=INK)
d.text((75 * S, 272 * S), 'Match three. Clear the board.', font=f2, fill=(74, 106, 80))
d.text((75 * S, 314 * S), 'Every level is solvable by construction.', font=f2, fill=(74, 106, 80))

fg = fg.convert('RGB').resize((1024, 500), Image.LANCZOS)
fg.save(os.path.join(OUT, 'play-feature-1024x500.png'))
print('play-feature-1024x500.png  1024x500')
