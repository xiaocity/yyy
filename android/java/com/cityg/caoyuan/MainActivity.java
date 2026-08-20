package com.cityg.caoyuan;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Insets;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * 只是一个装游戏的壳：一个全屏 WebView 加载 assets 里的单文件游戏。
 * 没有网络权限，所有资源都在包内。
 */
public class MainActivity extends Activity {

    /** 和页面 CSS 的 --cream 同色：状态栏区域要和页面顶部接上，不能有色差接缝 */
    private static final int CREAM = Color.parseColor("#F6FAF0");
    /** 和页面 CSS 的 --paper 同色：底部 tabbar 是白的，导航栏区域要跟着白 */
    private static final int PAPER = Color.parseColor("#FFFFFF");

    private WebView web;
    /** 垫在导航栏那一条下面的白块，高度由 insets 决定 */
    private View navScrim;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        // 存档全靠 localStorage，这一项不开的话进度一关就没
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        // 音效与背景音乐是合成音，不该要求先点一下才能响
        s.setMediaPlaybackRequiresUserGesture(false);
        // 不跟随系统字体缩放，否则版式会被撑坏
        s.setTextZoom(100);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);

        web.addJavascriptInterface(new Clip(), "AndroidClip");
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView v, String url) {
                // file:// 是不安全来源，navigator.clipboard 根本不存在，
                // 暗号「复制」会静默失败。这里补一个同名实现，页面代码不用改
                v.evaluateJavascript(
                    "(function(){ if(!navigator.clipboard && window.AndroidClip){"
                  + "  navigator.clipboard={writeText:function(t){"
                  + "    try{ AndroidClip.set(String(t)); return Promise.resolve(); }"
                  + "    catch(e){ return Promise.reject(e); } }};"
                  + "}})()", null);
            }
        });
        web.setBackgroundColor(CREAM);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setLongClickable(false);

        setContentView(buildRoot());
        web.loadUrl("file:///android_asset/index.html");
    }

    /**
     * 顶层容器。
     *
     * targetSdk 35 起，Android 15+ 强制 edge-to-edge：窗口一律铺到状态栏和导航栏底下，
     * setStatusBarColor / setNavigationBarColor 变成空操作。页面里 class="statusbar"
     * 那个假状态栏是死 CSS（HTML 里一次都没用），所以顶部没有任何缓冲，不自己让开的话
     * 首页标题会直接被真状态栏压住。
     *
     * 这里的做法是把 insets 吃在原生这一层：容器铺满并涂成 --cream，WebView 按 insets
     * 内缩，导航栏那一条另外垫一块白的。结果和 targetSdk 34 时代的观感一致
     * （米色状态栏 + 白色导航栏），页面一行 CSS 都不用改。
     *
     * API 30 以下不走这条路：那些系统上窗口本来就会自动内缩，保持原来的做法即可。
     */
    private View buildRoot() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(CREAM);
        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        navScrim = new View(this);
        navScrim.setBackgroundColor(PAPER);
        root.addView(navScrim, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, 0, Gravity.BOTTOM));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            // 系统栏交给我们自己涂，别让系统再盖一层灰色对比度蒙版
            getWindow().setStatusBarColor(Color.TRANSPARENT);
            getWindow().setNavigationBarColor(Color.TRANSPARENT);
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
            // 两条栏底下都是浅色，图标必须转深色，否则白图标看不见
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                int light = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                          | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                c.setSystemBarsAppearance(light, light);
            }
            root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
                @Override public WindowInsets onApplyWindowInsets(View v, WindowInsets in) {
                    Insets bar = in.getInsets(WindowInsets.Type.systemBars()
                                            | WindowInsets.Type.displayCutout());
                    // 用外边距而不是 padding 把 WebView 摆进去：WebView 对 padding 的
                    // 处理和普通 View 不一样，实测顶部那一份根本不吃（底部却吃），
                    // 页面照样被状态栏压住。外边距由 FrameLayout 说了算，没有歧义。
                    FrameLayout.LayoutParams lp =
                            (FrameLayout.LayoutParams) web.getLayoutParams();
                    lp.leftMargin = bar.left;
                    lp.topMargin = bar.top;
                    lp.rightMargin = bar.right;
                    lp.bottomMargin = bar.bottom;
                    web.setLayoutParams(lp);
                    navScrim.getLayoutParams().height = bar.bottom;
                    navScrim.requestLayout();
                    // 吃掉不再往下传：WebView 自己也会看 insets 算 env(safe-area-inset-*)，
                    // 不拦住的话底部 tabbar 会在原生 padding 之上再让一次，白留一条
                    return WindowInsets.CONSUMED;
                }
            });
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            getWindow().setStatusBarColor(CREAM);
            getWindow().setNavigationBarColor(PAPER);
            View decor = getWindow().getDecorView();
            decor.setSystemUiVisibility(decor.getSystemUiVisibility()
                    | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }
        return root;
    }

    /**
     * 游戏是单页应用，没有浏览器历史可退。返回键交给页面判断：
     * 不在首页就回首页（在局中先存进度），已在首页才退出。
     */
    @Override
    public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript(
            "(function(){try{"
          + "  if(typeof cur!=='undefined'&&cur!=='s-home'){"
          + "    if(cur==='s-game'&&typeof saveProgress==='function') saveProgress();"
          + "    go('s-home'); return 'stay';"
          + "  }"
          + "}catch(e){} return 'exit';})()",
            new ValueCallback<String>() {
                @Override public void onReceiveValue(String v) {
                    if (v == null || v.contains("exit")) finish();
                }
            });
    }

    /** 切后台时让页面自己存一次盘，防止被系统杀掉丢进度 */
    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) {
            web.evaluateJavascript(
                "try{ if(typeof cur!=='undefined'&&cur==='s-game'&&typeof saveProgress==='function') saveProgress(); }catch(e){}",
                null);
            web.onPause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    /** 只暴露一个写剪贴板的方法，不给页面任何其它系统能力 */
    private class Clip {
        @JavascriptInterface
        public void set(String text) {
            ClipboardManager cm =
                (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("暗号", text));
        }
    }
}
