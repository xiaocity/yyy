# 羊羊羊之草原牧歌

一款草原牧歌风格的三消解谜游戏。点击盘面上没被压住的牌，凑齐三张同花色即可消除，把盘面、卡槽与彩虹槽全部清空即为通关。

**纯本地运行**：全部资源内嵌在单个 HTML 文件里，运行期间不请求任何外部资源，安卓版未申请任何系统权限。

支持简体中文 / 繁體中文 / English 三种语言，在「我的 → 设置」里切换。

## 三种发布形态

| 形态 | 位置 | 说明 |
|---|---|---|
| 网页 | `index.html` | 单文件，双击即可运行 |
| 安卓 | `android/` | 极简 WebView 容器加载同一份 `index.html` |
| 微信小游戏 | `minigame/` | 界面改为 Canvas 绘制，核心算法由脚本从网页版抽取 |

三种形态共用同一份算法实现，不存在重复维护造成的行为差异。

## 核心设计：构造式有解保证

盘面不是先随机铺牌再去检验是否可解，而是**先算出一条合法的通关顺序，再沿着这条顺序铺花色与特殊牌**。有解性是构造出来的，不是碰运气碰上的。

因此玩家卡住只可能是取牌顺序的问题，失败页可以直接播放参考解法。洗牌道具同理——它洗出来的一定还是有解的局面。

## 目录

```
index.html              游戏本体（单文件，约 500 KB）
android/                安卓工程
  build.ps1             一条命令出包
  java/                 WebView 容器
minigame/               微信小游戏
  extract_core.py       从 index.html 抽取核心算法
  verify_core.js        校验抽取结果与网页版行为一致
  pack.ps1              打上传件
软著/                    软件著作权登记材料
  软件说明书.txt          正文源头
  gen.py                生成 HTML 版鉴别材料
  gen_docx.py           生成 Word 版
  to_pdf.js             导出 PDF
  pdf_check.py          校验成品 PDF 的页眉页脚与页码
.claude/agents/         专职审查 agent（逻辑 / UI / 本地化）
```

## 构建

### 安卓包

依赖 JDK 17 与 `D:\android-sdk`（`platforms;android-34` + `build-tools;34.0.0`）。

首次构建前先新建 `android/keystore.local.ps1`（该文件已在 `.gitignore` 中）：

```powershell
$env:CAOYUAN_KS_PASS = '你的签名口令'
```

然后：

```powershell
powershell -ExecutionPolicy Bypass -File android\build.ps1
```

脚本每次都从 `index.html` 重新复制游戏本体，不会打出带旧版资源的包。

### 微信小游戏

```powershell
python minigame\extract_core.py; node minigame\verify_core.js 8; powershell -File minigame\pack.ps1
```

`verify_core.js` 会对 50 关各生成若干盘面，回放各自算出的必胜顺序并严格执行全部规则（遮挡、牌堆、冰冻、锁链、炸弹倒数、彩虹槽、卡槽上限、终局三处全空）。任何一步走不通都说明抽取过程丢了东西。

### 软著材料

```powershell
cd 软著; python gen.py; python gen_docx.py; node to_pdf.js; python pdf_check.py
```

## 签名密钥

`android/build/release.keystore` **不在仓库里**，也不应该进仓库。它一旦泄露，别人就能签出被 Android 当作本应用正式更新的包，而且无法吊销——换密钥等于换应用，老用户装不了更新。

请自行离线备份该文件与口令。丢失后无法为已发布的应用再发更新。
