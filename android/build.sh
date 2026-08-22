#!/bin/bash
# macOS / Linux 版构建，与 build.ps1 等价：一条命令出 AAB + 自测 APK。
# 两个脚本必须保持同步 —— 改了一个记得改另一个。
#
# 依赖：JDK 17、Android SDK（platforms;android-36 + build-tools;36.0.0）、
#       bundletool-all.jar 放在 $SDK/bundletool/ 下
#
# 首次构建前先新建 android/keystore.local.sh（已在 .gitignore 中）：
#     export CAOYUAN_KS_PASS='你的签名口令'
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"      # android/
REPO="$(cd "$HERE/.." && pwd)"
SDK="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"
BT="$SDK/build-tools/36.0.0"
JH="${JAVA_HOME:-$HOME/Library/Android/jdk17/jdk-17.0.20.1+1/Contents/Home}"
JAR="$SDK/platforms/android-36/android.jar"
BUNDLETOOL="$SDK/bundletool/bundletool-all.jar"

# 这台机器上系统 java 只是占位壳，必须把真 JDK 摆进 PATH：
# d8 / apksigner 都是调 java 的壳脚本
export JAVA_HOME="$JH"
export PATH="$JH/bin:$PATH"

OUT="$HERE/build"
AAB="$OUT/SheepMeadow.aab"
APK="$OUT/SheepMeadow.apk"
KS="$OUT/release.keystore"
ALIAS='caoyuan'

for need in "$BT/aapt2" "$BT/d8" "$JH/bin/javac" "$JAR" "$BUNDLETOOL"; do
  [ -e "$need" ] || { echo "缺少：$need" >&2; exit 1; }
done

# 口令：优先读同目录的 keystore.local.sh（已 gitignore），其次读环境变量。
# 脚本全程不回显它。
[ -f "$HERE/keystore.local.sh" ] && . "$HERE/keystore.local.sh"
KP="${CAOYUAN_KS_PASS:-}"
if [ -z "$KP" ]; then
  echo "缺少签名口令。新建 $HERE/keystore.local.sh，内容：" >&2
  echo "    export CAOYUAN_KS_PASS='你的口令'" >&2
  exit 1
fi

rm -rf "$OUT/res" "$OUT/classes" "$OUT/dex" "$OUT/stage" "$OUT/apks" "$HERE/assets"
mkdir -p "$OUT/res" "$OUT/classes" "$OUT/dex" "$OUT/stage" "$HERE/assets"

echo '[1/7] 复制游戏本体'
# 每次都从 index.html 重新复制，不会打出带旧版资源的包
cp "$REPO/index.html" "$HERE/assets/index.html"

echo '[2/7] 编译并链接资源（proto 格式）'
find "$HERE/res" -type f | while read -r f; do "$BT/aapt2" compile "$f" -o "$OUT/res"; done
# --proto-format 是 AAB 的入口：bundle 里的资源表是 protobuf 的 resources.pb，
# 不是 APK 那种二进制 resources.arsc。少了这个开关 bundletool 会拒绝收料。
"$BT/aapt2" link --proto-format -o "$OUT/proto.apk" -I "$JAR" \
  --manifest "$HERE/AndroidManifest.xml" -A "$HERE/assets" \
  --min-sdk-version 21 --target-sdk-version 36 --auto-add-overlay \
  "$OUT"/res/*.flat

echo '[3/7] 编译 Java 并 dex'
find "$HERE/java" -name '*.java' > "$OUT/srcs.txt"
"$JH/bin/javac" -encoding UTF-8 -source 8 -target 8 -nowarn \
  -bootclasspath "$JAR" -classpath "$JAR" -d "$OUT/classes" @"$OUT/srcs.txt" 2>/dev/null || \
"$JH/bin/javac" -encoding UTF-8 -source 8 -target 8 -nowarn \
  -bootclasspath "$JAR" -classpath "$JAR" -d "$OUT/classes" @"$OUT/srcs.txt"
find "$OUT/classes" -name '*.class' > "$OUT/classes.txt"
"$BT/d8" --release --lib "$JAR" --min-api 21 --output "$OUT/dex" @"$OUT/classes.txt"

echo '[4/7] 摆 bundle 模块目录'
# bundle 模块的目录结构和 APK 不一样，必须手工摆：
#   manifest/AndroidManifest.xml   （proto apk 里它在根目录）
#   dex/classes.dex                （proto apk 里根本没有）
#   res/  assets/  resources.pb    （原样保留）
( cd "$OUT/stage" && unzip -qo "$OUT/proto.apk" )
mkdir -p "$OUT/stage/manifest" "$OUT/stage/dex"
mv "$OUT/stage/AndroidManifest.xml" "$OUT/stage/manifest/AndroidManifest.xml"
cp "$OUT/dex/classes.dex" "$OUT/stage/dex/classes.dex"

MODULE="$OUT/base.zip"; rm -f "$MODULE"
ENTRIES=(manifest dex resources.pb)
for d in res assets; do [ -d "$OUT/stage/$d" ] && ENTRIES+=("$d"); done
# -M 不要 jar 自己那份 META-INF/MANIFEST.MF，bundletool 不认识多出来的文件
( cd "$OUT/stage" && "$JH/bin/jar" cMf "$MODULE" "${ENTRIES[@]}" )

echo '[5/7] 组 AAB'
java -jar "$BUNDLETOOL" build-bundle --modules="$MODULE" --output="$AAB" --overwrite

echo '[6/7] 签名 AAB'
if [ ! -f "$KS" ]; then
  echo '  首次构建：生成签名密钥'
  "$JH/bin/keytool" -genkeypair -v -keystore "$KS" -alias "$ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KP" -keypass "$KP" \
    -dname 'CN=Caoyuan Muge, OU=Personal, O=Personal, L=NA, S=NA, C=CN' >/dev/null 2>&1
fi
# AAB 用 jarsigner 签，不是 apksigner —— apksigner 只认 APK 的 v2/v3 方案。
# 这把钥匙将来是 Play App Signing 里的「上传密钥」。
"$JH/bin/jarsigner" -keystore "$KS" -storepass "$KP" -keypass "$KP" \
  -digestalg SHA-256 -sigalg SHA256withRSA "$AAB" "$ALIAS" >/dev/null

echo '[7/7] 从 AAB 生成 universal APK（自测用）'
# 顺手让 bundletool 把这个 bundle 完整走一遍：AAB 有结构问题这一步就会炸，
# 不用等传到 Play 才知道。
APKS="$OUT/app.apks"
java -jar "$BUNDLETOOL" build-apks --bundle="$AAB" --output="$APKS" --overwrite \
  --mode=universal --ks="$KS" --ks-pass="pass:$KP" --ks-key-alias="$ALIAS" --key-pass="pass:$KP"
rm -rf "$OUT/apks"; mkdir -p "$OUT/apks"
( cd "$OUT/apks" && unzip -qo "$APKS" )
cp "$OUT/apks/universal.apk" "$APK"

echo
echo "AAB  -> $AAB  ($(du -h "$AAB" | cut -f1))"
echo "APK  -> $APK  ($(du -h "$APK" | cut -f1))   仅供 adb install 自测"
