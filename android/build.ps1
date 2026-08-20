# 打包 AAB（上传 Google Play 用）+ universal APK（本地安装验证用）。
# 游戏本体改完之后，直接跑这个脚本就能出新包。
#   powershell -ExecutionPolicy Bypass -File D:\games\yyy\android\build.ps1
#
# 依赖：
#   JDK 17（javac / jar / jarsigner / keytool）
#   D:\android-sdk —— cmdline-tools + platforms;android-36 + build-tools;36.0.0
#   D:\android-sdk\bundletool\bundletool-all.jar
#     下载：https://github.com/google/bundletool/releases
#
# 为什么是 AAB 而不是 APK：2021 年 8 月起 Google Play 的新应用只收 Android App
# Bundle，传 .apk 会被直接拒收。APK 仍然产出，但只用于 adb install 自测。
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$sdk  = 'D:\android-sdk'

# 工具链版本：优先用新的，没有就退回旧的。compileSdk 只需要提供我们用到的符号
# （最高 API 30），比 targetSdk 低也能编过，但对齐了更省心。
$bt = if (Test-Path "$sdk\build-tools\36.0.0") { "$sdk\build-tools\36.0.0" } else { "$sdk\build-tools\34.0.0" }
$jar = $null
foreach ($v in 36, 35, 34) {
  if (Test-Path "$sdk\platforms\android-$v\android.jar") { $jar = "$sdk\platforms\android-$v\android.jar"; break }
}
if (-not $jar) { throw "找不到 android.jar，请先装 platforms;android-36" }

$bundletool = "$sdk\bundletool\bundletool-all.jar"
if (-not (Test-Path $bundletool)) {
  throw "缺少 bundletool：$bundletool`n" +
        "  从 https://github.com/google/bundletool/releases 下载 bundletool-all-*.jar，`n" +
        "  改名成 bundletool-all.jar 放到该路径。"
}

# 输出名要和软件全称一致：曾经这里写的是「草原牧歌.apk」，而实际交付的包叫
# 「羊羊羊之草原牧歌.apk」，跑一次脚本就会多出一个同内容不同名的包
$aab = 'D:\games\yyy\羊羊羊之草原牧歌.aab'
$apk = 'D:\games\yyy\羊羊羊之草原牧歌.apk'
$ks  = "$root\build\release.keystore"

# 签名口令不写在脚本里 —— 这个文件要进 git，而进了历史的口令就等于泄露。
# 优先读同目录的 keystore.local.ps1（已 gitignore），其次读环境变量。
$local = "$root\keystore.local.ps1"
if (Test-Path $local) { . $local }
if (-not $env:CAOYUAN_KS_PASS) {
  throw "缺少签名口令。请任选其一：`n" +
        "  1) 新建 $local，内容：`$env:CAOYUAN_KS_PASS = '你的口令'`n" +
        "  2) 设置环境变量 CAOYUAN_KS_PASS"
}
$kp = $env:CAOYUAN_KS_PASS

Remove-Item "$root\build\res","$root\build\classes","$root\build\dex","$root\build\stage","$root\build\apks" -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force "$root\assets","$root\build\res","$root\build\classes","$root\build\dex","$root\build\stage" | Out-Null

# 游戏本体：每次都从 index.html 重新取，避免包里是旧版
Copy-Item 'D:\games\yyy\index.html' "$root\assets\index.html" -Force

Write-Host '[1/7] 编译资源'
Get-ChildItem "$root\res" -Recurse -File | ForEach-Object {
  & "$bt\aapt2.exe" compile $_.FullName -o "$root\build\res"
}

# --proto-format 是 AAB 的入口：bundle 里的资源表是 protobuf 的 resources.pb，
# 不是 APK 那种二进制 resources.arsc。少了这个开关 bundletool 会拒绝收料。
Write-Host '[2/7] 链接资源与 assets（proto 格式）'
$flats = Get-ChildItem "$root\build\res\*.flat" | ForEach-Object { $_.FullName }
& "$bt\aapt2.exe" link --proto-format -o "$root\build\proto.apk" -I $jar `
    --manifest "$root\AndroidManifest.xml" -A "$root\assets" `
    --min-sdk-version 21 --target-sdk-version 36 --auto-add-overlay $flats
if ($LASTEXITCODE -ne 0) { throw 'aapt2 link 失败' }

Write-Host '[3/7] 编译 Java 并 dex'
& javac -encoding UTF-8 -source 8 -target 8 -nowarn -bootclasspath $jar -classpath $jar `
    -d "$root\build\classes" (Get-ChildItem "$root\java" -Recurse -Filter *.java | ForEach-Object { $_.FullName })
if ($LASTEXITCODE -ne 0) { throw 'javac 失败' }
$cls = Get-ChildItem "$root\build\classes" -Recurse -Filter *.class | ForEach-Object { $_.FullName }
& "$bt\d8.bat" --release --lib $jar --min-api 21 --output "$root\build\dex" $cls
if ($LASTEXITCODE -ne 0) { throw 'd8 失败' }

# bundle 模块的目录结构和 APK 不一样，必须手工摆：
#   manifest/AndroidManifest.xml   （proto apk 里它在根目录）
#   dex/classes.dex                （proto apk 里根本没有）
#   res/  assets/  resources.pb    （原样保留）
Write-Host '[4/7] 摆 bundle 模块目录'
$stage = "$root\build\stage"
Copy-Item "$root\build\proto.apk" "$root\build\proto.zip" -Force
Expand-Archive -Path "$root\build\proto.zip" -DestinationPath $stage -Force
New-Item -ItemType Directory -Force "$stage\manifest","$stage\dex" | Out-Null
Move-Item "$stage\AndroidManifest.xml" "$stage\manifest\AndroidManifest.xml" -Force
Copy-Item "$root\build\dex\classes.dex" "$stage\dex\classes.dex" -Force

$moduleZip = "$root\build\base.zip"
Remove-Item $moduleZip -Force -ErrorAction SilentlyContinue
$entries = @('manifest','dex','resources.pb')
foreach ($d in 'res','assets') { if (Test-Path "$stage\$d") { $entries += $d } }
Push-Location $stage
# -M 不要 jar 自己那份 META-INF/MANIFEST.MF，bundletool 不认识多出来的文件
& jar cMf $moduleZip $entries
Pop-Location
if (-not (Test-Path $moduleZip)) { throw 'base.zip 打包失败' }

Write-Host '[5/7] 组 AAB'
& java -jar $bundletool build-bundle --modules=$moduleZip --output=$aab --overwrite
if ($LASTEXITCODE -ne 0) { throw 'bundletool build-bundle 失败' }

Write-Host '[6/7] 签名 AAB'
if (-not (Test-Path $ks)) {
  & keytool -genkeypair -v -keystore $ks -alias caoyuan -keyalg RSA -keysize 2048 -validity 10000 `
      -storepass $kp -keypass $kp `
      -dname 'CN=Caoyuan Muge, OU=Personal, O=Personal, L=NA, S=NA, C=CN'
}
# AAB 用 jarsigner 签，不是 apksigner —— apksigner 只认 APK 的 v2/v3 方案。
# 这把钥匙将来是 Play App Signing 里的「上传密钥」。
& jarsigner -keystore $ks -storepass $kp -keypass $kp -digestalg SHA-256 -sigalg SHA256withRSA $aab caoyuan
if ($LASTEXITCODE -ne 0) { throw 'jarsigner 签名失败' }

# 顺手从 AAB 生成一个 universal APK：既能 adb install 自测，也等于让 bundletool
# 把这个 bundle 完整走了一遍，AAB 有结构问题这一步就会炸，不用等传到 Play 才知道。
Write-Host '[7/7] 从 AAB 生成 universal APK（自测用）'
$apks = "$root\build\app.apks"
$btArgs = @(
  '-jar', $bundletool, 'build-apks',
  "--bundle=$aab", "--output=$apks", '--overwrite', '--mode=universal',
  "--ks=$ks", "--ks-pass=pass:$kp", '--ks-key-alias=caoyuan', "--key-pass=pass:$kp"
)
& java $btArgs
if ($LASTEXITCODE -ne 0) { throw 'bundletool build-apks 失败' }
Copy-Item $apks "$root\build\app.apks.zip" -Force
Expand-Archive -Path "$root\build\app.apks.zip" -DestinationPath "$root\build\apks" -Force
Copy-Item "$root\build\apks\universal.apk" $apk -Force

Write-Host ''
Write-Host ('  AAB（传 Play）  {0}  {1:N2} MB' -f $aab, ((Get-Item $aab).Length / 1MB))
Write-Host ('  APK（自测装机）  {0}  {1:N2} MB' -f $apk, ((Get-Item $apk).Length / 1MB))
