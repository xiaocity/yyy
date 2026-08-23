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
  build.ps1             一条命令出 AAB + 自测 APK
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

## WebView 兼容性

安卓版是个 WebView 壳，界面能不能正常显示取决于**设备上 WebView 的版本**，而不是 Android
版本本身 —— 同一台 Android 11，WebView 更新过和没更新过是两回事。

已知下限：

| 用到的特性 | 最低要求 | 不满足时 |
|---|---|---|
| `inset:` 简写 | Chrome 87 | 曾导致**整页空白**。已补 `top/right/bottom/left` longhand 兜底，现在不再是问题 |
| flex `gap:` | Chrome 84 | 间距失效，文字会挤在一起（如「下午好，牧羊人」与日期贴住）。仍未处理 —— 全文 80 处，改成 margin 风险大于收益 |

在 Chrome 83 的 WebView（Android 11 模拟器自带）上实测：布局完整、可正常游玩，只是
上述间距会偏紧。更旧的 WebView 没测过。

## 构建

### 安卓包

两个脚本等价，出一样的东西，**改了一个记得改另一个**：

| 平台 | 脚本 | 口令文件 |
|---|---|---|
| Windows | `android/build.ps1` | `android/keystore.local.ps1` |
| macOS / Linux | `android/build.sh` | `android/keystore.local.sh` |

依赖 JDK 17、Android SDK（`platforms;android-36` + `build-tools;36.0.0`），
以及 `bundletool-all.jar` 放在 SDK 的 `bundletool/` 子目录下
（从 [bundletool releases](https://github.com/google/bundletool/releases) 下载后改成这个名字）。
SDK 路径 Windows 上写死为 `D:\android-sdk`，mac 上默认 `~/Library/Android/sdk`，
可用 `ANDROID_SDK_ROOT` 覆盖。

签名口令不写在脚本里 —— 脚本要进 git，进了历史的口令就等于泄露。首次构建前先新建
对应的口令文件（两个都已在 `.gitignore` 中）：

```powershell
$env:CAOYUAN_KS_PASS = '你的签名口令'
```

```bash
export CAOYUAN_KS_PASS='你的签名口令'
```

口令至少 6 个字符（`keytool` 的硬限制），建议纯 ASCII —— 这把密钥要跨 Windows 与 mac 用，
中文口令在跨平台工具链里容易踩编码问题。

然后：

```powershell
powershell -ExecutionPolicy Bypass -File android\build.ps1
```

```bash
./android/build.sh
```

产出两个文件：

| 文件 | 用途 |
|---|---|
| `SheepMeadow.aab` | 传 Google Play。2021 年 8 月起新应用只收 App Bundle，传 APK 会被拒收 |
| `SheepMeadow.apk` | 本地 `adb install` 自测。由 bundletool 从 AAB 生成的 universal 包 |

APK 是从 AAB 反过来生成的，不是另走一条流水线 —— 自测装的那个包和传上去的 bundle
同源；而且这一步顺带把 bundle 完整走了一遍，结构有问题在本地就会炸，不用等传到
Play 才知道。

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

`android/build/release.keystore` **不在仓库里**，也不应该进仓库。

上架 Google Play 必须接受 Play 应用签名服务（传 AAB 就绕不开），接受之后密钥是两把，
别把它们当成一回事：

| | 谁持有 | 丢了会怎样 |
|---|---|---|
| 应用签名密钥 | Google | 你丢不了 |
| 上传密钥 —— 就是本地这把 `release.keystore` | 你 | 可向 Google 申请重置 |

所以本地这把是**上传密钥**，不是最终签在用户机器上的那把。丢了不等于这个应用就此
再也发不了更新 —— 走支持工单重置即可，只是一来一回期间发不了版本。仍然请离线备份
该文件与口令，只是不必再当成「丢了就完了」。

泄露的后果也比自签名年代轻：光有上传密钥推不了更新，还得能登进你的 Play Console。
但它依然是一份该保管好的凭据，一旦外泄就去 Console 重置。

**首次「创建版本」时会让你指定应用签名密钥，选「让 Google 生成」。**
若选「用我这把上传密钥同时当应用签名密钥」，上面那层可重置的保险就没有了。

### 自测 APK 装不上 Play 版更新

`build.ps1` 产出的自测 APK 用上传密钥签名，而用户从 Play 装到的包由 Google 用应用
签名密钥重签 —— 内容同源，签名不同。所以本地 `adb install` 过自测包的机器，直接从
Play 装更新会因签名不匹配而失败，先卸载再装即可。
