# -*- coding: utf-8 -*-
"""从网页版 index.html 原样抽出纯逻辑核心，生成小游戏可 require 的 js/core.js。

不重写任何一行算法：小游戏版与网页版共用同一套已经过校验的实现。
网页版改了算法之后重跑本脚本即可同步。
"""
import io, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'index.html')
BS = chr(92)          # 反斜杠，避免字面量在各种管道里被吃掉


def js_source():
    s = io.open(SRC, encoding='utf-8').read()
    return s[s.index("'use strict';"):]


def block(js, kind, name):
    """抽取一个顶层 function / const 声明的完整源码（按括号配平，跳过字符串与注释）"""
    if kind == 'function':
        pat = re.compile(r'^function' + r'\s+' + re.escape(name) + r'\s*\(', re.M)
    else:
        pat = re.compile(r'^(?:const|let)' + r'\s+' + re.escape(name) + r'\b', re.M)
    m = pat.search(js)
    if not m:
        return None
    i = m.start()
    depth = 0
    started = False
    instr = None
    prev = ''
    k = i
    while k < len(js):
        c = js[k]
        if instr:
            if c == instr and prev != BS:
                instr = None
        elif c in '"' + "'" + '`':
            instr = c
        elif c == '/' and js[k:k + 2] == '//':
            nl = js.find(chr(10), k)
            k = len(js) if nl < 0 else nl
        elif c == '/' and js[k:k + 2] == '/*':
            k = js.find('*/', k) + 1
        elif c in '{[(':
            # 只有大括号才算「主体开始」——从参数列表的圆括号开始配平的话，
            # 参数列表一闭合就以为函数结束了，抽出来只有一行签名
            if c == '{':
                started = True
            depth += 1
        elif c in '}])':
            depth -= 1
            if started and depth == 0:
                j = k + 1
                while j < len(js) and js[j] in ' \t':
                    j += 1
                if j < len(js) and js[j] == ';':
                    k = j
                return i, js[i:k + 1]
        elif c == ';' and not started and kind != 'function':
            return i, js[i:k + 1]
        prev = c
        k += 1
    return None


WANT = [
    ('const', 'SLOT_N'), ('const', 'BASE_SLOT'), ('const', 'GRID'), ('const', 'TYPE_DEFS'),
    ('const', 'CH_SIZE'), ('const', 'CHAPTERS'), ('const', 'ROMAN'), ('const', 'SHAPES'),
    ('const', 'GOALS'), ('const', 'SPECIALS'), ('const', 'REWARD_SP'),
    ('const', 'LEVELS'), ('const', 'MAX_LEVEL'), ('const', 'LV_CAP'),
    ('const', 'WEEKLY'), ('const', 'WEEKLY_LV'), ('const', 'COMBO_WINDOW'), ('const', 'BUFFS'),
    ('function', 'mulberry32'), ('function', 'seedRNG'), ('const', 'RNG'), ('const', 'rnd'),
    ('function', 'shuffle'),
    ('function', 'chapterIdx'), ('function', 'chapterOf'), ('function', 'chapterTitle'),
    ('function', 'levelName'), ('function', 'isBoss'), ('function', 'isBonus'),
    ('function', 'shapeOf'),
    ('function', 'rawLevelDef'), ('function', 'levelDef'), ('function', 'goalOf'),
    ('function', 'mkTile'), ('function', 'overlap'), ('function', 'freeIn'), ('function', 'tileNb'),
    ('function', 'neighbors'), ('function', 'planColors'), ('function', 'spMix'),
    ('function', 'waveLevel'),
    ('function', 'solveOrder'), ('function', 'solveOrderLocked'), ('function', 'canonicalStats'),
    ('function', 'paintOrder'), ('function', 'applySpecials'), ('function', 'makeGoal'),
    ('function', 'genLevel'),
    ('function', 'retimeBombs'), ('function', 'verifyPlayable'), ('function', 'reshuffleSolvable'),
    ('const', 'SHEEP'), ('const', 'RARITY'), ('const', 'PASSIVE_TXT'), ('const', 'SHARD_NEED'),
    ('const', 'SHARD_MAX'), ('const', 'PITY_N'), ('const', 'EXCHANGE'),
    ('const', 'TOOL_UP'), ('const', 'PRICE'), ('const', 'TOOL_KEYS'), ('const', 'FARM'),
    ('const', 'ACH'), ('const', 'TITLES'), ('const', 'CK_COIN'), ('const', 'TASKS'),
    ('const', 'HELP_BASE'), ('const', 'HELP_MODES'), ('const', 'SAYINGS'),
    ('function', 'ckChar'), ('function', 'makeCode'), ('function', 'parseCode'),
    ('function', 'weekIndex'), ('function', 'weeklyMod'), ('function', 'dailySeed'),
]

EXPORTS = [
    'G',
    'SLOT_N', 'BASE_SLOT', 'GRID', 'TYPE_DEFS', 'CH_SIZE', 'CHAPTERS', 'SHAPES', 'GOALS',
    'SPECIALS', 'REWARD_SP', 'LEVELS', 'MAX_LEVEL', 'WEEKLY', 'COMBO_WINDOW', 'BUFFS',
    'mulberry32', 'seedRNG', 'rnd', 'shuffle',
    'chapterIdx', 'chapterOf', 'chapterTitle', 'levelName', 'isBoss', 'isBonus',
    'shapeOf', 'rawLevelDef', 'levelDef', 'goalOf', 'makeGoal',
    'mkTile', 'overlap', 'freeIn', 'tileNb', 'neighbors', 'planColors', 'spMix', 'waveLevel',
    'solveOrder', 'solveOrderLocked', 'canonicalStats',
    'genLevel', 'makeCode', 'parseCode', 'weekIndex', 'weeklyMod', 'dailySeed',
    'reshuffleSolvable', 'paintOrder', 'applySpecials',
    'SHEEP', 'RARITY', 'PASSIVE_TXT', 'SHARD_NEED', 'SHARD_MAX', 'PITY_N', 'EXCHANGE',
    'TOOL_UP', 'PRICE', 'TOOL_KEYS', 'FARM', 'ACH', 'TITLES', 'CK_COIN', 'TASKS',
    'HELP_BASE', 'HELP_MODES', 'SAYINGS',
]


def main():
    js = js_source()
    found, missing = [], []
    for kind, name in WANT:
        b = block(js, kind, name)
        if b is None:
            missing.append(name)
        else:
            found.append(b)
    # 按源文件里的原始先后顺序输出：否则 const A = B 这类会踩到暂时性死区
    found.sort(key=lambda x: x[0])
    out = [t for _, t in found]

    GSHIM = (
        u'\n/* levelDef 按模式取配置，网页版直接读全局 G。这里保留原样，\n'
        u'   由游戏层在调用 genLevel 之前写 CORE.G，把耦合摆在明面上。 */\n'
        u'var G = { mode: "normal", wave: 1, buffs: null, matches: 0,\n'
        u'          tiles: [], tray: [], rain: [], goal: null, rcfg: null, lv: 1,\n'
        u'          toolLv: { shuffle: 1, undo: 1, out: 1 } };\n'
        u'\n/* 有解洗牌里会查道具等级，网页版从 save 里读。这里读 G，语义一致。 */\n'
        u'function toolLv(k) { return (G.toolLv && G.toolLv[k]) || 1; }\n'
    )
    header = (
        u'/* eslint-disable */\n'
        u'/* 核心逻辑：由 extract_core.py 从网页版 index.html 原样抽出，未修改任何算法。\n'
        u'   这一层不碰 DOM、不碰 wx API，浏览器与小游戏共用。\n'
        u'   网页版算法有改动时重跑 extract_core.py 同步，不要手改本文件。 */\n'
    )
    tail = (
        u'\n\nvar CORE = {\n  ' +
        u',\n  '.join(u'%s: %s' % (n, n) for n in EXPORTS) +
        u'\n};\n'
        u"if (typeof module !== 'undefined' && module.exports) module.exports = CORE;\n"
        u"else if (typeof globalThis !== 'undefined') globalThis.CORE = CORE;\n"
    )
    text = header + GSHIM + u'\n\n'.join(out) + tail
    dst = os.path.join(HERE, 'js', 'core.js')
    if not os.path.isdir(os.path.dirname(dst)):
        os.makedirs(os.path.dirname(dst))
    io.open(dst, 'w', encoding='utf-8').write(text)
    print('extracted %d blocks, missing: %s' % (len(out), missing or 'none'))
    print('core.js: %d lines, %.1f KB' % (text.count(chr(10)) + 1, len(text) / 1024.0))


if __name__ == '__main__':
    main()
