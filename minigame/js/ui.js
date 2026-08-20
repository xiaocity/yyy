/* Canvas 绘制与交互基础件。
   小游戏没有 DOM，圆角、文本、按钮命中、场景栈这些都得自己实现一遍。
   配色与网页版 :root 里的 CSS 变量一一对应。 */
(function () {
  var C = {
    ink: '#264D33', forest: '#2E6B3E', leaf: '#4C9A5A', grass: '#7DBB6E',
    mint: '#D3E8C6', cream: '#F6FAF0', paper: '#FFFFFF', line: '#E2EDD8',
    soil: '#8A6B4A', sun: '#F6C445', dim: '#8AA085', danger: '#B4714E'
  };

  var FONT = 'PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif';

  function font(ctx, size, bold) {
    ctx.font = (bold ? '700 ' : '400 ') + size + 'px ' + FONT;
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fillRound(ctx, x, y, w, h, r, color) {
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function strokeRound(ctx, x, y, w, h, r, color, lw) {
    roundRect(ctx, x, y, w, h, r);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw || 1.5;
    ctx.stroke();
  }

  function text(ctx, s, x, y, opt) {
    opt = opt || {};
    font(ctx, opt.size || 14, opt.bold);
    ctx.fillStyle = opt.color || C.ink;
    ctx.textAlign = opt.align || 'left';
    ctx.textBaseline = opt.baseline || 'middle';
    ctx.fillText(s, x, y);
  }

  /* 简单的中文换行：canvas 没有排版，只能逐字量宽 */
  function wrapText(ctx, s, maxW, size) {
    font(ctx, size || 13, false);
    var out = [], cur = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch === '\n') { out.push(cur); cur = ''; continue; }
      if (ctx.measureText(cur + ch).width > maxW && cur) { out.push(cur); cur = ch; }
      else cur += ch;
    }
    if (cur) out.push(cur);
    return out;
  }

  /* --- 点击热区：每帧重建，命中取最后注册（最上层） --- */
  function HitLayer() {
    this.items = [];
  }
  HitLayer.prototype.clear = function () { this.items.length = 0; };
  HitLayer.prototype.add = function (x, y, w, h, fn, pad) {
    pad = pad || 0;
    this.items.push({ x: x - pad, y: y - pad, w: w + pad * 2, h: h + pad * 2, fn: fn });
  };
  HitLayer.prototype.hit = function (px, py) {
    for (var i = this.items.length - 1; i >= 0; i--) {
      var it = this.items[i];
      if (px >= it.x && px <= it.x + it.w && py >= it.y && py <= it.y + it.h) return it;
    }
    return null;
  };

  /* --- 场景栈 --- */
  function Stage(plat) {
    this.plat = plat;
    this.ctx = plat.ctx;
    this.hits = new HitLayer();
    this.scene = null;
    this.pending = null;
    this.toastMsg = '';
    this.toastUntil = 0;
    this.now = 0;
    var self = this;
    plat.onTouch({
      start: function (x, y) { self._down = [x, y]; self._downAt = Date.now(); },
      end: function (x, y) {
        if (!self._down) return;
        var dx = x - self._down[0], dy = y - self._down[1];
        self._down = null;
        if (Math.abs(dx) > 12 || Math.abs(dy) > 12) return;   // 滑动不算点击
        var h = self.hits.hit(x, y);
        if (h && h.fn) h.fn(x, y);
      },
      move: function (x, y) {
        if (self.scene && self.scene.onMove && self._down) self.scene.onMove(x, y, self._down);
      }
    });
  }
  Stage.prototype.go = function (scene) { this.pending = scene; };
  Stage.prototype.toast = function (msg, ms) {
    this.toastMsg = msg;
    this.toastUntil = Date.now() + (ms || 1600);
  };
  Stage.prototype.start = function () {
    var self = this;
    var loop = function () {
      self.now = Date.now();
      if (self.pending) {
        if (self.scene && self.scene.exit) self.scene.exit();
        self.scene = self.pending;
        self.pending = null;
        if (self.scene.enter) self.scene.enter(self);
      }
      self.hits.clear();
      var ctx = self.ctx;
      ctx.fillStyle = C.cream;
      ctx.fillRect(0, 0, self.plat.W, self.plat.H);
      if (self.scene) {
        if (self.scene.update) self.scene.update(self.now);
        self.scene.draw(ctx, self);
      }
      self._drawToast(ctx);
      self.plat.raf(loop);
    };
    self.plat.raf(loop);
  };
  Stage.prototype._drawToast = function (ctx) {
    if (!this.toastMsg || Date.now() > this.toastUntil) return;
    var w = this.plat.W;
    font(ctx, 12.5, false);
    var tw = ctx.measureText(this.toastMsg).width + 36;
    var x = (w - tw) / 2, y = this.plat.H - 190;
    fillRound(ctx, x, y, tw, 36, 18, 'rgba(38,77,51,0.92)');
    text(ctx, this.toastMsg, w / 2, y + 18, { size: 12.5, color: '#fff', align: 'center' });
  };

  /* --- 通用按钮 --- */
  function button(ctx, stage, x, y, w, h, label, fn, opt) {
    opt = opt || {};
    var bg = opt.bg || C.forest, fg = opt.fg || '#fff';
    fillRound(ctx, x, y, w, h, opt.r == null ? h / 2 : opt.r, bg);
    if (opt.border) strokeRound(ctx, x, y, w, h, opt.r == null ? h / 2 : opt.r, opt.border, 1.5);
    text(ctx, label, x + w / 2, y + h / 2, { size: opt.size || 15, bold: true, color: fg, align: 'center' });
    if (fn) stage.hits.add(x, y, w, h, fn, 4);
  }

  var UI = {
    C: C, FONT: FONT, font: font, roundRect: roundRect, fillRound: fillRound,
    strokeRound: strokeRound, text: text, wrapText: wrapText,
    HitLayer: HitLayer, Stage: Stage, button: button
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = UI;
  else if (typeof globalThis !== 'undefined') globalThis.UI = UI;
})();
