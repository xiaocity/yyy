# 打包 APK。游戏本体改完之后，直接跑这个脚本就能出新包。
#   powershell -ExecutionPolicy Bypass -File D:\games\yyy\android\build.ps1
# 依赖：JDK 17（javac / jar / keytool）+ D:\android-sdk（cmdline-tools / platforms;android-34 / build-tools;34.0.0）
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$sdk  = 'D:\android-sdk'
$bt   = "$sdk\build-tools\34.0.0"
$jar  = "$sdk\platforms\android-34\android.jar"
# 输出名要和软件全称一致：曾经这里写的是「草原牧歌.apk」，而实际交付的包叫
# 「羊羊羊之草原牧歌.apk」，跑一次脚本就会多出一个同内容不同名的包
$out  = 'D:\games\yyy\羊羊羊之草原牧歌.apk'
$ks   = "$root\build\release.keystore"

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

Remove-Item "$root\build\res","$root\build\classes","$root\build\dex" -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force "$root\assets","$root\build\res","$root\build\classes","$root\build\dex" | Out-Null

# 游戏本体：每次都从 index.html 重新取，避免包里是旧版
Copy-Item 'D:\games\yyy\index.html' "$root\assets\index.html" -Force

Write-Host '[1/5] 编译资源'
Get-ChildItem "$root\res" -Recurse -File | ForEach-Object {
  & "$bt\aapt2.exe" compile $_.FullName -o "$root\build\res"
}

Write-Host '[2/5] 链接资源与 assets'
$flats = Get-ChildItem "$root\build\res\*.flat" | ForEach-Object { $_.FullName }
& "$bt\aapt2.exe" link -o "$root\build\base.apk" -I $jar `
    --manifest "$root\AndroidManifest.xml" -A "$root\assets" `
    --min-sdk-version 21 --target-sdk-version 34 --auto-add-overlay $flats

Write-Host '[3/5] 编译 Java 并 dex'
& javac -encoding UTF-8 -source 8 -target 8 -nowarn -bootclasspath $jar -classpath $jar `
    -d "$root\build\classes" (Get-ChildItem "$root\java" -Recurse -Filter *.java | ForEach-Object { $_.FullName })
$cls = Get-ChildItem "$root\build\classes" -Recurse -Filter *.class | ForEach-Object { $_.FullName }
& "$bt\d8.bat" --release --lib $jar --min-api 21 --output "$root\build\dex" $cls

Write-Host '[4/5] 组包'
Copy-Item "$root\build\base.apk" "$root\build\unsigned.apk" -Force
Push-Location "$root\build\dex"
& jar uf "$root\build\unsigned.apk" classes.dex
Pop-Location

Write-Host '[5/5] 对齐与签名'
if (-not (Test-Path $ks)) {
  & keytool -genkeypair -v -keystore $ks -alias caoyuan -keyalg RSA -keysize 2048 -validity 10000 `
      -storepass $kp -keypass $kp `
      -dname 'CN=Caoyuan Muge, OU=Personal, O=Personal, L=NA, S=NA, C=CN'
}
& "$bt\zipalign.exe" -p -f 4 "$root\build\unsigned.apk" "$root\build\aligned.apk"
& "$bt\apksigner.bat" sign --ks $ks --ks-pass "pass:$kp" --key-pass "pass:$kp" `
    --out $out "$root\build\aligned.apk"

'{0}  {1:N2} MB' -f $out, ((Get-Item $out).Length / 1MB)
