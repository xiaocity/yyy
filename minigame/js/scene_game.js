/* 牌局场景。
   规则判定（遮挡、牌堆、冰冻解冻、锁链/补给、炸弹倒数、彩虹独立槽、卡槽上限）
   逐条照网页版搬过来，只是把 DOM 换成 canvas 绘制。 */
(function () {
  var CORE = (typeof require !== 'undefined') ? require('./core.js') : globalThis.CORE;
  var UI = (typeof require !== 'undefined') ? require('./ui.js') : globalThis.UI;
  var SAVE = (typeof require !== 'undefined') ? require('./save.js') : globalThis.SAVE;
  var SFX = (typeof require !== 'undefined') ? require('./sfx.js') : globalThis.SFX;
  var C = UI.C;

  var ANIM = 260;          // 入槽飞行时间(ms)
  var CLEAR = 300;         // 三连消除停留(ms)

  function GameScene(lv, seed, mode) {
    this.lv = lv;
    this.seed = seed;
    this.mode = mode || 'normal';
    this.stage = null;
  }

  GameScene.prototype.enter = function (stage) {
    this.stage = stage;
    this.reset();
  };

  GameScene.prototype.reset = function () {
    CORE.G.mode = this.mode;
    CORE.G.wave = this.wave || 1;
    CORE.G.buffs = this.buffs || null;
    CORE.G.lv = this.lv;
    CORE.G.toolLv = SAVE.d.toolLv;
    // 每日/周常用固定种子，全服同题
    if (this.mode === 'daily') this.seed = CORE.dailySeed();
    else if (this.mode === 'weekly') this.seed = CORE.weekIndex() * 7919;
    else if (this.seed == null) this.seed = (Math.random() * 16777216) | 0;
    CORE.seedRNG(this.seed);
    var gen = CORE.genLevel(this.lv);
    this.tiles = gen.tiles;
    this.queues = gen.queues;
    this.order = gen.order;
    this.def = CORE.levelDef(this.lv);
    this.slotN = this.def.cfg.slots || CORE.BASE_SLOT;
    this.tray = [];
    this.rain = [];
    this.matches = 0;
    this.total = this.tiles.length;
    this.over = 0;           // 0 进行中 1 胜 -1 负
    this.combo = 0;
    this.maxCombo = 0;
    this.lastMatch = 0;
    this.startAt = Date.now();
    this.flying = [];        // {t, x0,y0,x1,y1, t0}
    this.clearing = null;    // {trio, t0}
    this.history = [];       // 撤回用
    this.toolUsed = 0;
    this.goal = gen.goal || (CORE.G.goal = null);
    this.limit = (this.mode === 'daily' || this.mode === 'weekly' || CORE.isBoss(this.lv)) ? 150 : 0;
    // 洗牌要用本局真实配置，直接查 levelDef 会在每日/周常里回落到第 1 关
    CORE.G.rcfg = { types: this.def.cfg.types, d: this.def.cfg.d };
    this.syncCore();
    this.layout();
  };

  /* 有解洗牌读的是 CORE.G，调用前必须同步 */
  GameScene.prototype.syncCore = function () {
    CORE.G.tiles = this.tiles;
    CORE.G.queues = this.queues;
    CORE.G.tray = this.tray;
    CORE.G.rain = this.rain;
    CORE.G.matches = this.matches;
    CORE.G.lv = this.lv;
    CORE.G.goal = this.goal;
    CORE.G.toolLv = SAVE.d.toolLv;
  };

  /* --- 三个道具 --- */
  GameScene.prototype.useShuffle = function () {
    if (this.over) return;
    var S = SAVE.d;
    if (!S.tools.shuffle) { this.stage.toast('洗牌用完了，去商店补一点'); SFX.deny(); return; }
    this.syncCore();
    var r = CORE.reshuffleSolvable();
    if (r !== 'ok') {
      // 洗不出有解排布就如实告诉玩家，并且不扣道具
      this.stage.toast(r === 'empty' ? '牌太少了，洗不动' : '这个局面洗不出有解排布，没有扣道具');
      SFX.deny();
      return;
    }
    S.tools.shuffle--; SAVE.save();
    this.toolUsed++;
    this.stage.toast('已重新洗牌 · 保证仍有解');
    SFX.coin();
  };
  GameScene.prototype.useUndo = function () {
    if (this.over) return;
    var S = SAVE.d;
    if (!S.tools.undo) { this.stage.toast('撤回用完了'); SFX.deny(); return; }
    var n = S.toolLv.undo || 1, done = 0;
    for (var i = 0; i < n; i++) {
      // 只能撤回还留在槽里的牌。history 里也有已经消掉的，
      // 照单全收会把消掉的牌复活回盘面，那是比撤不动更糟的错
      var t = null;
      while (this.history.length) {
        var cand = this.history[this.history.length - 1];
        this.history.pop();
        if (this.tray.indexOf(cand) >= 0 || this.rain.indexOf(cand) >= 0) { t = cand; break; }
      }
      if (!t) break;
      var idx = this.tray.indexOf(t);
      if (idx < 0) { var ri = this.rain.indexOf(t); if (ri >= 0) this.rain.splice(ri, 1); }
      else this.tray.splice(idx, 1);
      t.removed = false;
      if (t.sp === 'bomb') t.bombLeft = t.bombK;   // 退回盘面，倒数重置
      done++;
    }
    if (!done) { this.stage.toast('还没有可撤回的操作'); SFX.deny(); return; }
    S.tools.undo--; SAVE.save();
    this.toolUsed++;
    this.stage.toast('已撤回 ' + done + ' 步');
  };
  GameScene.prototype.useOut = function () {
    if (this.over) return;
    var S = SAVE.d;
    if (!S.tools.out) { this.stage.toast('移出用完了'); SFX.deny(); return; }
    var n = 2 + (S.toolLv.out || 1);
    var list = this.tray.filter(function (t) { return true; }).slice(0, n);
    if (!list.length) { this.stage.toast('卡槽是空的'); SFX.deny(); return; }
    var self = this;
    list.forEach(function (t) {
      self.tray.splice(self.tray.indexOf(t), 1);
      t.removed = false;
      if (t.sp === 'bomb') t.bombLeft = t.bombK;
      var h = self.history.indexOf(t); if (h >= 0) self.history.splice(h, 1);
    });
    S.tools.out--; SAVE.save();
    this.toolUsed++;
    this.stage.toast('已移出 ' + list.length + ' 块');
  };

  /* --- 几何：与网页版 computeT 同一套算法 --- */
  GameScene.prototype.layout = function () {
    var P = this.stage.plat;
    var boardTop = 108;
    var boardH = P.H - boardTop - 250;
    var W = P.W - 24;
    var rows = this.queues.length;
    var maxLen = 0;
    for (var i = 0; i < this.queues.length; i++) maxLen = Math.max(maxLen, this.queues[i].length);
    var T = Math.min(W / 7, (boardH - rows * 6 - 8) / (7 + rows * 1.12));
    if (maxLen > 1) T = Math.min(T, W / (1 + 0.30 * (maxLen - 1)));
    T = Math.max(26, Math.floor(T));
    this.T = T;
    this.boardX = (P.W - 7 * T) / 2;
    this.boardY = boardTop;
    this.qStep = T * 0.30;
    this.qY = boardTop + 7 * T + 10;
    this.slotY = P.H - 150;
    this.rainY = P.H - 200;
  };

  GameScene.prototype.tileRect = function (t) {
    var T = this.T;
    if (t.q >= 0) {
      var q = this.queues[t.q];
      var w = T + this.qStep * (q.length - 1);
      return { x: (this.stage.plat.W - w) / 2 + t.qp * this.qStep, y: this.qY + t.q * (T + 6), w: T, h: T };
    }
    return { x: this.boardX + t.x * T / 2, y: this.boardY + t.y * T / 2, w: T, h: T };
  };

  /* --- 规则判定（照搬网页版） --- */
  GameScene.prototype.isCovered = function (t) {
    if (t.q >= 0) {
      var q = this.queues[t.q], smaller = false, larger = false;
      for (var i = 0; i < q.length; i++) {
        var o = q[i];
        if (o.removed || o === t) continue;
        if (o.qp < t.qp) smaller = true; else larger = true;
      }
      return t.biq ? (smaller && larger) : smaller;
    }
    for (var j = 0; j < this.tiles.length; j++) {
      var b = this.tiles[j];
      if (!b.removed && b.q < 0 && b.layer > t.layer && CORE.overlap(b, t)) return true;
    }
    return false;
  };
  GameScene.prototype.lockedBy = function (t) {
    if (t.sp === 'freeze' && t.frozen) return 'freeze';
    if (t.sp === 'chain' && this.matches < t.chainN) return 'chain';
    if (t.sp === 'supply' && this.matches < t.chainN) return 'supply';
    return null;
  };
  GameScene.prototype.thawAround = function (t) {
    if (t.q >= 0) return;
    var self = this;
    this.tiles.forEach(function (o) {
      if (o.removed || o.sp !== 'freeze' || !o.frozen || o.layer !== t.layer) return;
      if ((Math.abs(o.x - t.x) === 2 && o.y === t.y) || (Math.abs(o.y - t.y) === 2 && o.x === t.x)) o.frozen = false;
    });
  };

  /* --- 点击一张牌 --- */
  GameScene.prototype.tap = function (t) {
    if (this.over || this.clearing) return;
    if (t.removed || this.isCovered(t)) return;
    var lk = this.lockedBy(t);
    if (lk) {
      this.stage.toast(lk === 'freeze' ? '这张牌被冰封了，先消掉它旁边的牌'
        : '还没解锁，再多消几组');
      return;
    }
    if (t.sp === 'dbl' && t.shell) {          // 双层牌：第一下只拆壳
      t.shell = false;
      return;
    }
    if (t.sp === 'rain') {
      if (this.rain.length >= 3) return;
      t.removed = true;
      this.rain.push(t);
      this.history.push(t);
      SFX.pick();
      this.thawAround(t);
      if (this.rain.length === 3) { this.rain.length = 0; this.registerMatch(); }
      this.checkEnd();
      return;
    }
    if (this.tray.length >= this.slotN) return;

    t.removed = true;
    this.tray.push(t);
    this.history.push(t);
    SFX.pick();
    this.thawAround(t);
    if (t.sp === 'bomb') t.bombLeft = t.bombK;

    var r = this.tileRect(t);
    var slot = this.slotRect(this.tray.length - 1);
    this.flying.push({ t: t, x0: r.x, y0: r.y, x1: slot.x, y1: slot.y, t0: Date.now() });

    // 炸弹倒数：每有一张牌入槽，槽里其它炸弹减 1
    for (var i = 0; i < this.tray.length; i++) {
      var x = this.tray[i];
      if (x === t || x.sp !== 'bomb') continue;
      x.bombLeft--;
      if (x.bombLeft <= 0) { this.lose('bomb'); return; }
    }

    var same = this.tray.filter(function (o) { return o.type === t.type; });
    if (same.length >= 3) {
      this.clearing = { trio: same.slice(0, 3), t0: Date.now() };
    } else {
      this.checkEnd();
    }
  };

  GameScene.prototype.registerMatch = function () {
    var now = Date.now();
    this.combo = (now - this.lastMatch < CORE.COMBO_WINDOW) ? this.combo + 1 : 1;
    this.lastMatch = now;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.matches++;
    CORE.G.matches = this.matches;      // 锁链/补给要看这个数
    SFX.match(this.combo);
  };

  GameScene.prototype.win = function () {
    if (this.over) return;
    this.over = 1;
    SFX.win();
    var secs = Math.round((Date.now() - this.startAt) / 1000);
    if (this.mode === 'normal') {
      this.reward = SAVE.winLevel(this.lv, secs, this.maxCombo, this.matches, this.toolUsed === 0);
      this.newAch = SAVE.achDone();
    } else if (this.mode === 'daily' || this.mode === 'weekly') {
      var store = this.mode === 'weekly' ? SAVE.d.weekly : SAVE.d.daily;
      var key = String(this.mode === 'weekly' ? CORE.weekIndex() : CORE.dailySeed());
      var prev = store[key];
      store[key] = {
        time: (!prev || secs * 1000 < prev.time) ? secs * 1000 : prev.time,
        combo: Math.max((prev && prev.combo) || 0, this.maxCombo), done: 1
      };
      SAVE.d.coins += 120;
      SAVE.save();
      this.reward = { coin: 120, wool: 0, stars: 3 };
    }
  };
  GameScene.prototype.lose = function (why) {
    if (this.over) return;
    this.over = -1;
    this.deathBy = why;
    SFX.fail();
    if (this.mode === 'endless') {
      var total = (this.score || 0) + this.matches;
      if (total > SAVE.d.endless) SAVE.d.endless = total;
      SAVE.d.endlessLog.unshift({ score: total, wave: this.wave || 1, t: '' });
      SAVE.d.endlessLog = SAVE.d.endlessLog.slice(0, 10);
      SAVE.d.coins += total * 2;
      SAVE.save();
    }
  };

  GameScene.prototype.checkEnd = function () {
    var left = 0;
    for (var i = 0; i < this.tiles.length; i++) if (!this.tiles[i].removed) left++;
    if (!left && !this.tray.length && !this.rain.length) {
      if (this.mode === 'endless') { this.nextWave(); return; }
      this.win();
      return;
    }
    if (this.tray.length >= this.slotN) {
      // 卡槽满且没有任何两张同色 → 死局
      var cnt = {};
      for (var j = 0; j < this.tray.length; j++) cnt[this.tray[j].type] = (cnt[this.tray[j].type] || 0) + 1;
      var can = false;
      for (var k in cnt) if (cnt[k] >= 2) can = true;
      if (!can) this.lose('full');
    }
  };

  /* 无尽：清完一波接下一波，卡槽此刻必空，串联是安全的 */
  GameScene.prototype.nextWave = function () {
    this.score = (this.score || 0) + this.matches;
    this.wave = (this.wave || 1) + 1;
    this.seed = (Math.random() * 16777216) | 0;
    this.stage.toast('第 ' + this.wave + ' 波');
    this.reset();
  };

  GameScene.prototype.update = function (now) {
    var i;
    if (this.limit && !this.over) {
      var left = this.limit - Math.floor((now - this.startAt) / 1000);
      if (left <= 0) this.lose('time');
    }
    for (i = this.flying.length - 1; i >= 0; i--) {
      if (now - this.flying[i].t0 > ANIM) this.flying.splice(i, 1);
    }
    if (this.clearing && now - this.clearing.t0 > CLEAR) {
      var trio = this.clearing.trio, self = this;
      trio.forEach(function (x) {
        var idx = self.tray.indexOf(x);
        if (idx >= 0) self.tray.splice(idx, 1);
      });
      this.clearing = null;
      this.registerMatch();
      this.checkEnd();
    }
  };

  /* --- 绘制 --- */
  GameScene.prototype.slotRect = function (i) {
    var P = this.stage.plat;
    var n = this.slotN, gap = 4;
    var w = Math.min(40, (P.W - 36 - gap * (n - 1)) / n);
    var total = w * n + gap * (n - 1);
    return { x: (P.W - total) / 2 + i * (w + gap), y: this.slotY, w: w, h: w * 1.12 };
  };

  GameScene.prototype.drawTile = function (ctx, t, x, y, w, covered) {
    var r = w * 0.18;
    UI.fillRound(ctx, x, y, w, w, r, covered ? '#EEF4EA' : C.paper);
    UI.strokeRound(ctx, x, y, w, w, r, covered ? '#DCE7D2' : C.line, 2);
    var def = CORE.TYPE_DEFS[t.type % CORE.TYPE_DEFS.length];
    ctx.globalAlpha = covered ? 0.35 : 1;
    UI.text(ctx, def.e, x + w / 2, y + w / 2 + 1, { size: w * 0.46, align: 'center' });
    ctx.globalAlpha = 1;
    if (t.sp && t.sp !== 'plain') this.drawBadge(ctx, t, x, y, w, covered);
  };

  GameScene.prototype.drawBadge = function (ctx, t, x, y, w, covered) {
    var sp = CORE.SPECIALS[t.sp];
    if (!sp) return;
    var s = Math.max(13, w * 0.34);
    var bx = x + w - s * 0.55, by = y - s * 0.2;
    if (t.sp === 'bomb') {
      var left = (t.bombLeft != null && t.bombLeft > 0) ? t.bombLeft : t.bombK;
      UI.fillRound(ctx, bx - s / 2, by, s, s, s / 2, left <= 3 ? C.danger : C.soil);
      UI.text(ctx, String(left), bx, by + s / 2, { size: s * 0.62, bold: true, color: '#fff', align: 'center' });
      return;
    }
    if (t.sp === 'chain' || t.sp === 'supply') {
      UI.fillRound(ctx, bx - s / 2, by, s, s, s / 2, C.soil);
      UI.text(ctx, String(t.chainN), bx, by + s / 2, { size: s * 0.58, bold: true, color: '#fff', align: 'center' });
      return;
    }
    ctx.globalAlpha = covered ? 0.4 : 1;
    UI.fillRound(ctx, bx - s / 2, by, s, s, s / 2, '#FFFFFF');
    UI.strokeRound(ctx, bx - s / 2, by, s, s, s / 2, C.line, 1.2);
    UI.text(ctx, sp.emo, bx, by + s / 2, { size: s * 0.6, align: 'center' });
    ctx.globalAlpha = 1;
  };

  GameScene.prototype.draw = function (ctx, stage) {
    var P = stage.plat, self = this;
    var T = this.T;

    // 顶部：关卡名与进度
    UI.text(ctx, this.def.name || CORE.levelName(this.lv), P.W / 2, 44, { size: 16, bold: true, align: 'center' });
    if (this.limit) {
      var left = Math.max(0, this.limit - Math.floor((stage.now - this.startAt) / 1000));
      UI.text(ctx, '⏱ ' + Math.floor(left / 60) + ':' + ('0' + (left % 60)).slice(-2), P.W - 16, 44,
        { size: 13, bold: true, color: left <= 20 ? C.danger : C.soil, align: 'right' });
    } else {
      UI.text(ctx, this.mode === 'normal' ? ('第 ' + this.lv + ' 关') : ('第 ' + (this.wave || 1) + ' 波'),
        P.W - 16, 44, { size: 12, color: C.dim, align: 'right' });
    }
    var done = this.total - this.tiles.filter(function (t) { return !t.removed; }).length;
    var pw = P.W - 32;
    UI.fillRound(ctx, 16, 62, pw, 8, 4, C.mint);
    UI.fillRound(ctx, 16, 62, pw * (done / this.total), 8, 4, C.leaf);
    UI.text(ctx, done + '/' + this.total, P.W - 16, 82, { size: 11, color: C.dim, align: 'right' });
    if (this.combo > 1) UI.text(ctx, '连击 ×' + this.combo, 16, 82, { size: 11, color: C.soil });

    // 盘面：按层从下往上画，飞行中的牌单独画
    var flying = {};
    this.flying.forEach(function (f) { flying[f.t.id] = f; });
    var board = this.tiles.filter(function (t) { return t.q < 0; })
      .sort(function (a, b) { return a.layer - b.layer; });
    board.forEach(function (t) {
      if (t.removed && !flying[t.id]) return;
      if (flying[t.id]) return;
      var r = self.tileRect(t);
      var cov = self.isCovered(t) || !!self.lockedBy(t);
      self.drawTile(ctx, t, r.x, r.y, T, cov);
      if (!cov && !t.removed) stage.hits.add(r.x, r.y, T, T, function () { self.tap(t); });
    });

    // 底部牌堆
    this.queues.forEach(function (q) {
      q.slice().sort(function (a, b) { return b.qp - a.qp; }).forEach(function (t) {
        if (t.removed && !flying[t.id]) return;
        if (flying[t.id]) return;
        var r = self.tileRect(t);
        var cov = self.isCovered(t) || !!self.lockedBy(t);
        self.drawTile(ctx, t, r.x, r.y, T, cov);
        if (!cov && !t.removed) stage.hits.add(r.x, r.y, T, T, function () { self.tap(t); });
      });
    });

    // 彩虹槽
    var rw = P.W - 32;
    UI.fillRound(ctx, 16, this.rainY, rw, 34, 17, '#F3ECFB');
    UI.text(ctx, '彩虹槽', 30, this.rainY + 17, { size: 11, bold: true, color: '#7A5AA8' });
    for (var i = 0; i < 3; i++) {
      var bx = 80 + i * 32;
      UI.strokeRound(ctx, bx, this.rainY + 5, 24, 24, 6, '#C9B3E6', 1.2);
      if (this.rain[i]) UI.text(ctx, '🌈', bx + 12, this.rainY + 17, { size: 14, align: 'center' });
    }

    // 卡槽
    for (var s = 0; s < this.slotN; s++) {
      var sr = this.slotRect(s);
      UI.fillRound(ctx, sr.x, sr.y, sr.w, sr.w, sr.w * 0.18, '#F1F6EC');
      UI.strokeRound(ctx, sr.x, sr.y, sr.w, sr.w, sr.w * 0.18, C.line, 1.2);
    }
    this.tray.forEach(function (t, i) {
      if (flying[t.id]) return;
      var sr = self.slotRect(i);
      var fading = self.clearing && self.clearing.trio.indexOf(t) >= 0;
      ctx.globalAlpha = fading ? 0.45 : 1;
      self.drawTile(ctx, t, sr.x, sr.y, sr.w, false);
      ctx.globalAlpha = 1;
    });

    // 飞行中的牌
    this.flying.forEach(function (f) {
      var k = Math.min(1, (stage.now - f.t0) / ANIM);
      var e = 1 - Math.pow(1 - k, 3);
      var sr = self.slotRect(self.tray.indexOf(f.t));
      var x = f.x0 + (sr.x - f.x0) * e, y = f.y0 + (sr.y - f.y0) * e;
      var w = T + (sr.w - T) * e;
      self.drawTile(ctx, f.t, x, y, w, false);
    });

    // 三个道具
    var S = SAVE.d;
    var tools = [['🔀', '洗牌', S.tools.shuffle, function () { self.useShuffle(); }],
                 ['↩️', '撤回', S.tools.undo, function () { self.useUndo(); }],
                 ['📤', '移出', S.tools.out, function () { self.useOut(); }]];
    var tw = 64, gap = 18, tx0 = (P.W - tw * 3 - gap * 2) / 2, ty = P.H - 76;
    tools.forEach(function (t, i) {
      var x = tx0 + i * (tw + gap);
      UI.fillRound(ctx, x, ty, tw, 52, 15, C.paper);
      UI.strokeRound(ctx, x, ty, tw, 52, 15, C.line, 1.5);
      UI.text(ctx, t[0], x + tw / 2, ty + 19, { size: 19, align: 'center' });
      UI.text(ctx, t[1], x + tw / 2, ty + 41, { size: 10.5, align: 'center', color: C.dim });
      // 剩余数量角标
      UI.fillRound(ctx, x + tw - 16, ty - 7, 22, 18, 9, t[2] > 0 ? C.sun : '#D8DED4');
      UI.text(ctx, String(t[2]), x + tw - 5, ty + 2, { size: 11, bold: true, align: 'center', color: t[2] > 0 ? '#6B4E12' : '#8B958A' });
      stage.hits.add(x, ty, tw, 52, t[3], 4);
    });

    // 返回
    UI.text(ctx, '‹ 返回', 16, 44, { size: 13, color: C.forest });
    stage.hits.add(8, 28, 66, 34, function () { stage.nav(self.mode === 'normal' ? 'levels' : 'home'); });

    if (this.over) this.drawResult(ctx, stage);
  };

  GameScene.prototype.drawResult = function (ctx, stage) {
    var P = stage.plat, self = this;
    ctx.fillStyle = 'rgba(38,60,45,0.45)';
    ctx.fillRect(0, 0, P.W, P.H);
    var w = P.W - 64, h = 292, x = 32, y = (P.H - h) / 2;
    UI.fillRound(ctx, x, y, w, h, 22, C.paper);
    var win = this.over === 1;
    UI.text(ctx, win ? '通关！' : '这一局没过去', P.W / 2, y + 48, { size: 22, bold: true, align: 'center', color: win ? C.forest : C.soil });
    var secs = Math.round((Date.now() - this.startAt) / 1000);
    UI.text(ctx, win ? ('用时 ' + Math.floor(secs / 60) + ':' + ('0' + (secs % 60)).slice(-2) + '　最高连击 ×' + this.maxCombo)
      : (this.deathBy === 'bomb' ? '炸弹倒数归零了'
        : this.deathBy === 'time' ? '时间到了'
        : '卡槽被占满，没有可消的三张'),
      P.W / 2, y + 88, { size: 13, color: C.dim, align: 'center' });

    if (win && this.reward) {
      var st = '';
      for (var s = 0; s < 3; s++) st += (s < this.reward.stars ? '★' : '☆');
      UI.text(ctx, st, P.W / 2, y + 116, { size: 20, color: C.sun, align: 'center' });
      UI.text(ctx, '金币 +' + this.reward.coin + (this.reward.wool ? '　羊毛 +' + this.reward.wool : ''),
        P.W / 2, y + 142, { size: 12.5, color: C.forest, align: 'center' });
      if (this.newAch && this.newAch.length) {
        UI.text(ctx, '解锁成就：' + this.newAch[0][1], P.W / 2, y + 162, { size: 11, color: C.soil, align: 'center' });
      }
    } else if (!win) {
      UI.text(ctx, '这一局是有解的，换个取牌顺序再试试', P.W / 2, y + 118, { size: 11.5, color: C.dim, align: 'center' });
    }

    var by = y + 180;
    if (win && this.mode === 'normal') {
      UI.button(ctx, stage, x + 24, by, w - 48, 46, '下一关', function () {
        self.lv = Math.min(CORE.MAX_LEVEL, self.lv + 1); self.seed = null; self.reset();
      }, { bg: C.forest });
    } else if (win) {
      UI.button(ctx, stage, x + 24, by, w - 48, 46, '回到首页', function () { stage.nav('home'); }, { bg: C.forest });
    } else {
      UI.button(ctx, stage, x + 24, by, w - 48, 46, '再试一次', function () { self.seed = null; self.reset(); }, { bg: C.forest });
    }
    UI.button(ctx, stage, x + 24, by + 54, w - 48, 38, self.mode === 'normal' ? '关卡地图' : '回到首页',
      function () { stage.nav(self.mode === 'normal' ? 'levels' : 'home'); }, { bg: C.mint, fg: C.forest });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = GameScene;
  else if (typeof globalThis !== 'undefined') globalThis.GameScene = GameScene;
})();
