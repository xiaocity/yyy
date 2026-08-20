# -*- coding: utf-8 -*-
"""检查 core.js 是否真的自洽：列出它引用了、但自己没有定义的标识符。
   抽取式移植最容易出的错就是「抽了函数、漏了它依赖的全局」。"""
import io, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'js', 'core.js')

BUILTIN = set('''
Math JSON Object Array String Number Boolean Date RegExp Map Set WeakMap WeakSet Promise Symbol
Error TypeError RangeError isFinite isNaN parseInt parseFloat undefined null true false NaN Infinity
console module exports globalThis require this typeof new delete void in of instanceof
if else for while do return function var let const class extends switch case break continue
try catch finally throw yield await async default export import static get set
'''.split())


def strip_strings_comments(s):
    out = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c == '/' and s[i:i + 2] == '//':
            j = s.find(chr(10), i)
            i = n if j < 0 else j
        elif c == '/' and s[i:i + 2] == '/*':
            j = s.find('*/', i)
            i = n if j < 0 else j + 2
        elif c in '"' + "'" + '`':
            q = c
            i += 1
            while i < n:
                if s[i] == chr(92):
                    i += 2
                    continue
                if s[i] == q:
                    i += 1
                    break
                i += 1
        else:
            out.append(c)
            i += 1
    return ''.join(out)


def main():
    raw = io.open(SRC, encoding='utf-8').read()
    code = strip_strings_comments(raw)

    defined = set()
    for m in re.finditer(r'\bfunction\s+([A-Za-z_$][\w$]*)', code):
        defined.add(m.group(1))
    for m in re.finditer(r'\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)', code):
        defined.add(m.group(1))
    # 解构与参数、以及形如 a=>、(a,b)=> 的形参
    for m in re.finditer(r'\b(?:const|let|var)\s*[\[{]([^\]}]*)[\]}]', code):
        for x in re.findall(r'[A-Za-z_$][\w$]*', m.group(1)):
            defined.add(x)
    for m in re.finditer(r'function\s*[A-Za-z_$\w]*\s*\(([^)]*)\)', code):
        for x in re.findall(r'[A-Za-z_$][\w$]*', m.group(1)):
            defined.add(x)
    for m in re.finditer(r'\(([^()]*)\)\s*=>', code):
        for x in re.findall(r'[A-Za-z_$][\w$]*', m.group(1)):
            defined.add(x)
    for m in re.finditer(r'\b([A-Za-z_$][\w$]*)\s*=>', code):
        defined.add(m.group(1))
    for m in re.finditer(r'\bfor\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)', code):
        defined.add(m.group(1))
    for m in re.finditer(r'\bcatch\s*\(\s*([A-Za-z_$][\w$]*)', code):
        defined.add(m.group(1))

    used = {}
    for m in re.finditer(r'(?<![.\w$])([A-Za-z_$][\w$]*)', code):
        name = m.group(1)
        # 跳过对象字面量的键（形如  name:  ）
        after = code[m.end():m.end() + 3]
        if re.match(r'\s*:', after):
            continue
        used.setdefault(name, 0)
        used[name] += 1

    unknown = {k: v for k, v in used.items()
               if k not in defined and k not in BUILTIN and not k.isupper() or
               (k not in defined and k not in BUILTIN and k.isupper())}
    unknown = {k: v for k, v in used.items() if k not in defined and k not in BUILTIN}
    if unknown:
        print('未定义的外部引用（需要补齐或参数化）：')
        for k in sorted(unknown, key=lambda x: -unknown[x]):
            print('  %-18s x%d' % (k, unknown[k]))
    else:
        print('core.js 自洽：没有未定义的外部引用')


if __name__ == '__main__':
    main()
