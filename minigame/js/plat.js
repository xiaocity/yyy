/* 平台适配层。
   小游戏没有 DOM，也没有 localStorage；浏览器没有 wx。
   把差异全压在这一层，上面的绘制与玩法代码两边完全一致 ——
   否则没有开发者工具时，画面就没有任何办法验证。 */
(function () {
  var isWx = (typeof wx !== 'undefined' && typeof wx.createCanvas === 'function');

  var P = {
    isWx: isWx,
    canvas: null,
    ctx: null,
    W: 390,          // 设计宽度，与网页版一致
    H: 844,
    dpr: 1,
    scale: 1,        // 设计坐标 → 物理像素
    safeTop: 0,
    safeBottom: 0
  };

  P.init = function (opt) {
    opt = opt || {};
    var cw, ch;
    if (isWx) {
      var info = wx.getSystemInfoSync();
      cw = info.windowWidth;
      ch = info.windowHeight;
      P.dpr = info.pixelRatio || 1;
      var sa = info.safeArea;
      if (sa) {
        P.safeTop = sa.top;
        P.safeBottom = ch - sa.bottom;
      }
      P.canvas = wx.createCanvas();
    } else {
      P.canvas = opt.canvas;
      cw = opt.width || 390;
      ch = opt.height || 844;
      P.dpr = opt.dpr || (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1);
    }
    P.W = cw;
    P.H = ch;
    P.canvas.width = Math.round(cw * P.dpr);
    P.canvas.height = Math.round(ch * P.dpr);
    if (!isWx && P.canvas.style) {
      P.canvas.style.width = cw + 'px';
      P.canvas.style.height = ch + 'px';
    }
    P.ctx = P.canvas.getContext('2d');
    P.ctx.scale(P.dpr, P.dpr);   // 之后一律用逻辑像素作图
    return P;
  };

  /* --- 触摸：统一成 (x, y) 逻辑坐标 --- */
  P.onTouch = function (handlers) {
    var start = handlers.start, move = handlers.move, end = handlers.end;
    if (isWx) {
      if (start) wx.onTouchStart(function (e) { var t = e.touches[0]; start(t.clientX, t.clientY); });
      if (move) wx.onTouchMove(function (e) { var t = e.touches[0]; move(t.clientX, t.clientY); });
      if (end) wx.onTouchEnd(function (e) {
        var t = (e.changedTouches && e.changedTouches[0]) || {};
        end(t.clientX, t.clientY);
      });
      return;
    }
    var cv = P.canvas;
    var pos = function (ev) {
      var r = cv.getBoundingClientRect();
      var p = ev.touches ? (ev.touches[0] || ev.changedTouches[0]) : ev;
      return [p.clientX - r.left, p.clientY - r.top];
    };
    cv.addEventListener('mousedown', function (e) { var p = pos(e); start && start(p[0], p[1]); });
    cv.addEventListener('mousemove', function (e) { var p = pos(e); move && move(p[0], p[1]); });
    cv.addEventListener('mouseup', function (e) { var p = pos(e); end && end(p[0], p[1]); });
    cv.addEventListener('touchstart', function (e) { e.preventDefault(); var p = pos(e); start && start(p[0], p[1]); }, { passive: false });
    cv.addEventListener('touchmove', function (e) { e.preventDefault(); var p = pos(e); move && move(p[0], p[1]); }, { passive: false });
    cv.addEventListener('touchend', function (e) { e.preventDefault(); var p = pos(e); end && end(p[0], p[1]); }, { passive: false });
  };

  /* --- 帧循环 --- */
  P.raf = function (fn) {
    if (isWx) return requestAnimationFrame(fn);          // 小游戏全局就有
    return window.requestAnimationFrame(fn);
  };

  /* --- 存档 --- */
  P.load = function (key) {
    try {
      var raw = isWx ? wx.getStorageSync(key) : localStorage.getItem(key);
      if (!raw) return null;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) { return null; }
  };
  P.save = function (key, obj) {
    try {
      var s = JSON.stringify(obj);
      if (isWx) wx.setStorageSync(key, s); else localStorage.setItem(key, s);
      return true;
    } catch (e) { return false; }
  };

  P.vibrate = function () {
    if (isWx && wx.vibrateShort) { try { wx.vibrateShort({ type: 'light' }); } catch (e) {} }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = P;
  else if (typeof globalThis !== 'undefined') globalThis.PLAT = P;
})();
