#!/bin/bash
# 仅供本机截图使用的 APK 构建。与仓库里的 build.ps1 不是一回事：
#   - build.ps1 出的是签着正式密钥的 AAB，那把密钥不在这台机器上
#   - 这里出的是 debug 签名的 APK，装进模拟器拍图用，绝不上传
# 用法： build_mac.sh [要注入 index.html 的 JS 文件]
set -euo pipefail

# 路径一律相对脚本自身定位，SDK / JDK 可用环境变量覆盖
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"          # 仓库根目录
SDK="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"
BT="$SDK/build-tools/36.0.0"
# 这台机器上系统 java 只是占位壳，装的是解压版 Temurin 17；换机器时设 JAVA_HOME 即可
JH="${JAVA_HOME:-$HOME/Library/Android/jdk17/jdk-17.0.20.1+1/Contents/Home}"
JAR="$SDK/platforms/android-36/android.jar"
OUT="$HERE/apkbuild"

for need in "$BT/aapt2" "$JH/bin/javac" "$JAR"; do
  [ -e "$need" ] || { echo "缺少：$need" >&2; exit 1; }
done
INJECT="${1:-}"

# d8 / apksigner / zipalign 都是调 java 的壳脚本，这台机器上 java 只有占位壳，
# 不把 JDK 摆进 PATH 就会报 "Unable to locate a Java Runtime"
export JAVA_HOME="$JH"
export PATH="$JH/bin:$PATH"

rm -rf "$OUT"; mkdir -p "$OUT/classes" "$OUT/dexout" "$OUT/assets"

# 1) 游戏本体。build.ps1 也是每次重新复制，避免打进旧版资源
cp "$ROOT/index.html" "$OUT/assets/index.html"
if [ -n "$INJECT" ]; then
  # 注入脚本追加在 </body> 之前，只改初始存档，不碰任何游戏逻辑
  python3 - "$OUT/assets/index.html" "$INJECT" <<'PY'
import io,sys
page,inj=sys.argv[1],sys.argv[2]
t=io.open(page,encoding='utf-8').read()
js=io.open(inj,encoding='utf-8').read()
tag='</body>'
assert t.count(tag)==1, '找不到唯一的 </body>'
io.open(page,'w',encoding='utf-8').write(t.replace(tag,'<script>\n'+js+'\n</script>\n'+tag))
print('  已注入截图初始化脚本')
PY
fi

# 2) 资源
"$BT/aapt2" compile --dir "$ROOT/android/res" -o "$OUT/res.zip"
"$BT/aapt2" link -o "$OUT/base.apk" -I "$JAR" \
  --manifest "$ROOT/android/AndroidManifest.xml" \
  -A "$OUT/assets" \
  --min-sdk-version 21 --target-sdk-version 36 \
  "$OUT/res.zip"

# 3) Java -> class -> dex
find "$ROOT/android/java" -name '*.java' > "$OUT/srcs.txt"
"$JH/bin/javac" -nowarn -source 8 -target 8 -bootclasspath "$JAR" \
  -d "$OUT/classes" @"$OUT/srcs.txt" 2>&1 | grep -v '^警告\|^Note\|warning' || true
find "$OUT/classes" -name '*.class' > "$OUT/classes.txt"
"$BT/d8" --min-api 21 --output "$OUT/dexout" --lib "$JAR" @"$OUT/classes.txt"

# 4) dex 塞进 apk
( cd "$OUT/dexout" && zip -q "$OUT/base.apk" classes.dex )

# 5) 对齐 + debug 签名
KS="$OUT/../debug.keystore"
if [ ! -f "$KS" ]; then
  "$JH/bin/keytool" -genkeypair -v -keystore "$KS" -alias debug \
    -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 3650 \
    -dname "CN=Screenshot Debug, OU=local, O=local, L=local, S=local, C=CN" >/dev/null 2>&1
fi
"$BT/zipalign" -f 4 "$OUT/base.apk" "$OUT/aligned.apk"
"$BT/apksigner" sign --ks "$KS" --ks-pass pass:android --key-pass pass:android \
  --out "$OUT/SheepMeadow-debug.apk" "$OUT/aligned.apk"

echo "OK -> $OUT/SheepMeadow-debug.apk  ($(du -h "$OUT/SheepMeadow-debug.apk" | cut -f1))"
