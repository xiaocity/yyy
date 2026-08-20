/* 页面外壳：顶部标题、底部导航、可滚动内容区。
   canvas 没有滚动容器，滚动要自己实现：记住偏移量、按内容高度夹住、
   触摸移动时改偏移，并且滚动中不能触发点击。 */
(function () {
  var UI = (typeof require !== 'undefined') ? require('./ui.js') : globalThis.UI;
  var C = UI.C;

  var TABS = [
    { id: 'home', name: '首页', emo: '🏠' },
    { id: 'levels', name: '关卡', emo: '🗺️' },
    { id: 'rank', name: '排行', emo: '🏆' },
    { id: 'shop', name: '商店', emo: '🛍️' },
    { id: 'mine', name: '我的', emo: '🐑' }
  ];
  var TABBAR_H = 62;

  function Page(tab, title) {
    this.tab = tab;
    this.title = title;
    this.scroll = 0;
    this.contentH = 0;
    this._lastY = null;
  }

  Page.prototype.enter = function (stage) {
    this.stage = stage;
    this.scroll = 0;
  };

  /* 触摸拖动改滚动偏移 */
  Page.prototype.onMove = function (x, y, down) {
    if (this._lastY == null) this._lastY = down[1];
    var dy = y - this._lastY;
    this._lastY = y;
    this.scroll -= dy;
    this.clampScroll();
  };
  Page.prototype.clampScroll = function () {
    var P = this.stage.plat;
    var view = P.H - this.topH() - TABBAR_H;
    var max = Math.max(0, this.contentH - view);
    if (this.scroll < 0) this.scroll = 0;
    if (this.scroll > max) this.scroll = max;
  };
  Page.prototype.topH = function () { return 74; };

  Page.prototype.drawChrome = function (ctx, stage) {
    var P = stage.plat;
    // 顶部标题
    UI.text(ctx, this.title, P.W / 2, 44, { size: 17, bold: true, align: 'center' });
    // 底部导航
    var y = P.H - TABBAR_H, w = P.W / TABS.length, self = this;
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, y, P.W, TABBAR_H);
    ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(P.W, y + 0.5); ctx.stroke();
    TABS.forEach(function (t, i) {
      var cx = w * i + w / 2, active = t.id === self.tab;
      ctx.globalAlpha = active ? 1 : 0.42;
      UI.text(ctx, t.emo, cx, y + 22, { size: 19, align: 'center' });
      UI.text(ctx, t.name, cx, y + 44, { size: 10.5, align: 'center', color: active ? C.forest : C.ink, bold: active });
      ctx.globalAlpha = 1;
      stage.hits.add(w * i, y, w, TABBAR_H, function () { stage.nav(t.id); });
    });
  };

  /* 内容区裁剪 + 平移，子类在 body() 里按未滚动坐标作画 */
  Page.prototype.draw = function (ctx, stage) {
    var P = stage.plat, top = this.topH();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, P.W, P.H - top - TABBAR_H);
    ctx.clip();
    ctx.translate(0, -this.scroll);
    this._hitOff = this.scroll;
    this.body(ctx, stage, top);
    ctx.restore();
    this.drawChrome(ctx, stage);
    // 滚动条
    var view = P.H - top - TABBAR_H;
    if (this.contentH > view) {
      var h = Math.max(24, view * view / this.contentH);
      var t = top + (view - h) * (this.scroll / (this.contentH - view));
      UI.fillRound(ctx, P.W - 5, t, 3, h, 1.5, 'rgba(46,107,62,0.18)');
    }
  };

  /* 内容区里注册热区：自动补偿滚动偏移 */
  Page.prototype.hit = function (stage, x, y, w, h, fn) {
    var top = this.topH(), P = stage.plat;
    var sy = y - this.scroll;
    if (sy + h < top || sy > P.H - TABBAR_H) return;    // 滚出可视区就不注册
    stage.hits.add(x, sy, w, h, fn, 3);
  };

  Page.TABS = TABS;
  Page.TABBAR_H = TABBAR_H;

  if (typeof module !== 'undefined' && module.exports) module.exports = Page;
  else if (typeof globalThis !== 'undefined') globalThis.Page = Page;
})();
