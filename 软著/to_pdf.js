/* 从鉴别材料的 HTML 打印 PDF（headless Chrome）。
 *
 * 原来走 Word COM 的 ExportAsFixedFormat，和更早的「另存为 .doc」栽在同一处：
 * 带十一张内嵌图的文档会让 Word 空转，实测跑满 16 分钟、烧掉 260 秒 CPU
 * 仍然一个字节都没写出来，只能强杀。改用 Chrome 打印。
 *
 * 换渲染引擎不会造成纸稿与电子稿不一致：HTML 和 docx 两条管线的分页同源，
 * 都调 gen.paginate_var 切好页再各自输出，页数与每页内容按构造就是一样的，
 * 差别只在字体渲染细节。打印后会核对页数，对不上直接报错。
 */
const { chromium } = require('C:/Users/cityg/AppData/Roaming/npm/node_modules/openclaw-cn/node_modules/playwright-core');
const path = require('path');

const HERE = __dirname;
const JOBS = [
  { html: '文档鉴别材料.html',   pdf: '文档鉴别材料.pdf',   pages: 21 },
  { html: '源程序鉴别材料.html', pdf: '源程序鉴别材料.pdf', pages: 60 },
];

(async () => {
  // 直接指到 headless shell 的可执行文件。用 channel:'chromium-headless-shell'
  // 会走 playwright 自己的注册表，这个装法下解析不到，报「请先 npx playwright install」
  const browser = await chromium.launch({ executablePath:
    'C:/Users/cityg/AppData/Local/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-win64/chrome-headless-shell.exe' });
  const page = await browser.newPage();
  let bad = 0;
  for (const j of JOBS) {
    const src = 'file:///' + path.join(HERE, j.html).replace(/\\/g, '/');
    await page.goto(src, { waitUntil: 'load' });
    // 页面里的 .page 数就是应有的页数，先和期望值对一次
    const divs = await page.evaluate(() => document.querySelectorAll('.page').length);
    const out = path.join(HERE, j.pdf);
    // 边距全走 CSS 里的 @page，这里给 0，否则会叠加一层导致每页溢出翻倍
    await page.pdf({ path: out, format: 'A4', printBackground: true,
                     margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    const ok = divs === j.pages;
    if (!ok) bad++;
    console.log(`${j.pdf}  页数=${divs}  期望=${j.pages}  ${ok ? 'OK' : '不符！'}`);
  }
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
