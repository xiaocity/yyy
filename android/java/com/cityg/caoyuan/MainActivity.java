package com.cityg.caoyuan;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * 只是一个装游戏的壳：一个全屏 WebView 加载 assets 里的单文件游戏。
 * 没有网络权限，所有资源都在包内。
 */
public class MainActivity extends Activity {

    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        getWindow().setStatusBarColor(Color.parseColor("#F6FAF0"));
        getWindow().setNavigationBarColor(Color.parseColor("#FFFFFF"));
        // 状态栏是浅色底，图标要转成深色，否则白字看不见
        View decor = getWindow().getDecorView();
        decor.setSystemUiVisibility(decor.getSystemUiVisibility()
                | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);

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
        web.setBackgroundColor(Color.parseColor("#F6FAF0"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setLongClickable(false);

        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
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
