/* 其余页面：排行、商店、图鉴（我的）、玩法说明。
   数据全部来自本地存档，没有任何编造的榜单——这条在网页版上是刻意定的。 */
(function () {
  var CORE = (typeof require !== 'undefined') ? require('./core.js') : globalThis.CORE;
  var UI = (typeof require !== 'undefined') ? require('./ui.js') : globalThis.UI;
  var Page = (typeof require !== 'undefined') ? require('./page.js') : globalThis.Page;
  var SAVE = (typeof require !== 'undefined') ? require('./save.js') : globalThis.SAVE;
  var SFX = (typeof require !== 'undefined') ? require('./sfx.js') : globalThis.SFX;
  var C = UI.C;

  function fmtTime(ms) {
    var s = Math.round((ms || 0) / 1000);
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }
  function card(ctx, x, y, w, h) {
    UI.fillRound(ctx, x, y, w, h, 16, C.paper);
    UI.strokeRound(ctx, x, y, w, h, 16, C.line, 1.5);
  }

  /* ================= 排行 ================= */
  function RankScene() { Page.call(this, 'rank', '草原羊群榜'); this.tab = 'rank'; this.panel = 'best'; }
  RankScene.prototype = Object.create(Page.prototype);
  RankScene.prototype.constructor = RankScene;
  RankScene.prototype.topH = function () { return 118; };

  RankScene.prototype.drawChrome = function (ctx, stage) {
    Page.prototype.drawChrome.call(this, ctx, stage);
    // 分段控件固定在顶部，不随内容滚动
    var P = stage.plat, self = this;
    var segs = [['best', '纪录墙'], ['daily', '挑战'], ['endless', '无尽'], ['duel', '对战']];
    var w = (P.W - 32) / segs.length, y = 74;
    UI.fillRound(ctx, 16, y, P.W - 32, 34, 10, C.mint);
    segs.forEach(function (s, i) {
      var x = 16 + i * w, on = self.panel === s[0];
      if (on) UI.fillRound(ctx, x + 2, y + 2, w - 4, 30, 8, C.paper);
      UI.text(ctx, s[1], x + w / 2, y + 17, { size: 12, bold: on, align: 'center', color: on ? C.forest : '#6E8A6B' });
      stage.hits.add(x, y, w, 34, function () { self.panel = s[0]; self.scroll = 0; });
    });
  };

  RankScene.prototype.body = function (ctx, stage, top) {
    var P = stage.plat, S = SAVE.d, w = P.W - 32, y = top + 6;
    var rows = [], head = null;

    if (this.panel === 'best') {
      var keys = Object.keys(S.best).map(Number).sort(function (a, b) { return a - b; });
      var timed = keys.filter(function (lv) { return S.best[lv] && S.best[lv].time > 0; });
      if (timed.length) {
        var fast = timed.reduce(function (a, lv) { return (!a || S.best[lv].time < S.best[a].time) ? lv : a; }, 0);
        head = ['最快的一关 · ' + CORE.levelName(fast), fmtTime(S.best[fast].time)];
      }
      rows = keys.map(function (lv) {
        var b = S.best[lv] || {};
        return [String(lv), CORE.levelName(lv), b.time > 0 ? fmtTime(b.time) + '  ×' + (b.combo || 0) : '未记录'];
      });
      if (!rows.length) rows = [['', '还没有任何纪录，通关一次就会记下用时', '']];
    } else if (this.panel === 'daily') {
      var dk = Object.keys(S.daily).sort().reverse();
      rows = dk.slice(0, 20).map(function (k, i) {
        return [String(i + 1), (+k.slice(4, 6)) + '月' + (+k.slice(6)) + '日', fmtTime(S.daily[k].time)];
      });
      if (!rows.length) rows = [['', '还没打过每日挑战，全服同题才有可比性', '']];
    } else if (this.panel === 'endless') {
      head = ['历史最佳', S.endless + ' 组'];
      rows = (S.endlessLog || []).map(function (r, i) {
        return [String(i + 1), '第 ' + r.wave + ' 波结束', r.score + ' 组'];
      });
      if (!rows.length) rows = [['', '还没玩过无尽草原', '']];
    } else {
      var d = S.duel, tot = d.win + d.lose;
      head = ['战绩', d.win + ' 胜 ' + d.lose + ' 负 · ' + (tot ? Math.round(d.win / tot * 100) : 0) + '%'];
      rows = (d.log || []).map(function (r) {
        return [r.win ? '胜' : '负', '第 ' + r.lv + ' 关', fmtTime(r.mine) + ' 对 ' + fmtTime(r.theirs)];
      });
      if (!rows.length) rows = [['', '还没有对战记录', '']];
    }

    if (head) {
      card(ctx, 16, y, w, 54);
      UI.text(ctx, head[0], 32, y + 27, { size: 13 });
      UI.text(ctx, head[1], P.W - 32, y + 27, { size: 15, bold: true, color: C.forest, align: 'right' });
      y += 66;
    }
    card(ctx, 16, y, w, rows.length * 34 + 12);
    rows.forEach(function (r, i) {
      var ry = y + 12 + i * 34;
      UI.text(ctx, r[0], 34, ry + 10, { size: 12, color: C.dim });
      UI.text(ctx, r[1], 62, ry + 10, { size: 12.5 });
      UI.text(ctx, r[2], P.W - 32, ry + 10, { size: 12, bold: true, color: C.forest, align: 'right' });
      if (i < rows.length - 1) {
        ctx.strokeStyle = '#F0F5EA'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(30, ry + 26); ctx.lineTo(P.W - 30, ry + 26); ctx.stroke();
      }
    });
    y += rows.length * 34 + 24;
    this.contentH = y - top;
  };

  /* ================= 商店 ================= */
  function ShopScene() { Page.call(this, 'shop', '草原商店'); }
  ShopScene.prototype = Object.create(Page.prototype);
  ShopScene.prototype.constructor = ShopScene;

  ShopScene.prototype.body = function (ctx, stage, top) {
    var P = stage.plat, S = SAVE.d, w = P.W - 32, y = top + 6, self = this;
    card(ctx, 16, y, w, 46);
    UI.text(ctx, '金币 ' + S.coins + '　羊毛 ' + S.wool, P.W / 2, y + 23, { size: 13, bold: true, align: 'center' });
    y += 58;

    UI.text(ctx, '实用道具', 22, y + 8, { size: 13, bold: true }); y += 22;
    ['shuffle', 'undo', 'out'].forEach(function (k) {
      var t = CORE.TOOL_UP[k], price = CORE.PRICE[k];
      card(ctx, 16, y, w, 60);
      UI.text(ctx, t.n, 34, y + 24, { size: 14, bold: true });
      UI.text(ctx, '持有 ' + (S.tools[k] || 0) + ' 个', 34, y + 43, { size: 11, color: C.dim });
      UI.button(ctx, stage, P.W - 116, y + 14, 84, 32, price + ' 金币', null, { bg: C.mint, fg: C.forest, size: 12 });
      self.hit(stage, P.W - 116, y + 14, 84, 32, function () {
        if (S.coins < price) { stage.toast('金币不够'); SFX.deny(); return; }
        S.coins -= price; S.tools[k] = (S.tools[k] || 0) + 1; SAVE.save();
        stage.toast('买到 1 个' + t.n); SFX.coin();
      });
      y += 70;
    });

    y += 8;
    UI.text(ctx, '道具升级', 22, y + 8, { size: 13, bold: true }); y += 22;
    ['shuffle', 'undo', 'out'].forEach(function (k) {
      var t = CORE.TOOL_UP[k], lv = S.toolLv[k] || 1, cost = t.cost[lv] || 0;
      card(ctx, 16, y, w, 60);
      UI.text(ctx, t.n + ' Lv.' + lv, 34, y + 24, { size: 14, bold: true });
      UI.text(ctx, t.desc[lv - 1], 34, y + 43, { size: 11, color: C.dim });
      if (lv < 3) {
        UI.button(ctx, stage, P.W - 116, y + 14, 84, 32, cost + ' 羊毛', null, { bg: C.mint, fg: C.forest, size: 12 });
        self.hit(stage, P.W - 116, y + 14, 84, 32, function () {
          if (S.wool < cost) { stage.toast('羊毛不够'); SFX.deny(); return; }
          S.wool -= cost; S.toolLv[k] = lv + 1; SAVE.save();
          stage.toast(t.n + ' 升到 Lv.' + (lv + 1)); SFX.coin();
        });
      } else {
        UI.text(ctx, '已满级', P.W - 34, y + 30, { size: 12, color: C.dim, align: 'right' });
      }
      y += 70;
    });
    this.contentH = y - top + 10;
  };

  /* ================= 我的 / 图鉴 ================= */
  function MineScene() { Page.call(this, 'mine', '我的草原'); }
  MineScene.prototype = Object.create(Page.prototype);
  MineScene.prototype.constructor = MineScene;

  MineScene.prototype.body = function (ctx, stage, top) {
    var P = stage.plat, S = SAVE.d, w = P.W - 32, y = top + 6, self = this;
    var own = Object.keys(S.dex).length;

    card(ctx, 16, y, w, 64);
    UI.text(ctx, S.name, 34, y + 26, { size: 15, bold: true });
    UI.text(ctx, '已通关 ' + S.cleared + ' 次 · 成就 ' + S.ach.length + '/' + CORE.ACH.length, 34, y + 46, { size: 11, color: C.dim });
    y += 76;

    UI.text(ctx, '羊图鉴  ' + own + ' / ' + CORE.SHEEP.length, 22, y + 8, { size: 13, bold: true });
    y += 24;
    var cw = (w - 16) / 3;
    CORE.SHEEP.forEach(function (sh, i) {
      var bx = 16 + (i % 3) * (cw + 8), by = y + Math.floor(i / 3) * 96;
      var has = !!S.dex[sh.id];
      UI.fillRound(ctx, bx, by, cw, 88, 14, has ? C.paper : '#F2F5EF');
      UI.strokeRound(ctx, bx, by, cw, 88, 14, S.skin === sh.id ? C.grass : C.line, S.skin === sh.id ? 2.5 : 1.2);
      UI.text(ctx, has ? '🐑' : '❓', bx + cw / 2, by + 28, { size: 24, align: 'center' });
      UI.text(ctx, has ? sh.n : '？？？', bx + cw / 2, by + 56, { size: 11.5, bold: true, align: 'center', color: has ? C.ink : '#A8B8A2' });
      UI.text(ctx, has ? CORE.RARITY[sh.r] : '未收集', bx + cw / 2, by + 72, { size: 9.5, align: 'center', color: C.dim });
      if (has) self.hit(stage, bx, by, cw, 88, function () {
        S.skin = sh.id; SAVE.save();
        stage.toast(sh.n + ' 出战：' + CORE.PASSIVE_TXT[sh.p.t](sh.p.v));
      });
    });
    y += Math.ceil(CORE.SHEEP.length / 3) * 96 + 10;

    UI.button(ctx, stage, 16, y, w, 44, '清空存档（连点两次）', function () {
      if (self._armed && Date.now() - self._armed < 3000) { SAVE.reset(); stage.toast('已清空'); stage.nav('home'); }
      else { self._armed = Date.now(); stage.toast('再点一次确认清空'); }
    }, { bg: '#F7E9E4', fg: '#A8503C', size: 13 });
    y += 56;
    this.contentH = y - top;
  };

  /* ================= 玩法说明 ================= */
  function HelpScene() { Page.call(this, 'home', '玩法说明'); }
  HelpScene.prototype = Object.create(Page.prototype);
  HelpScene.prototype.constructor = HelpScene;

  HelpScene.prototype.body = function (ctx, stage, top) {
    var P = stage.plat, w = P.W - 32, y = top + 6;
    var sections = [
      ['基本规则', CORE.HELP_BASE.map(function (r) { return [r[1], r[2]]; })],
      ['规则牌 · 会改变取牌顺序', ['freeze', 'chain', 'dbl', 'rain', 'bomb', 'mystery', 'supply'].map(function (k) {
        return [CORE.SPECIALS[k].emo + ' ' + CORE.SPECIALS[k].name, CORE.SPECIALS[k].tip];
      })],
      ['奖励牌 · 只在被消掉时给东西', ['coin', 'wool', 'gift', 'torch'].map(function (k) {
        return [CORE.SPECIALS[k].emo + ' ' + CORE.SPECIALS[k].name, CORE.SPECIALS[k].tip];
      })],
      ['模式', CORE.HELP_MODES.map(function (r) { return [r[1], r[2]]; })]
    ];
    sections.forEach(function (sec) {
      UI.text(ctx, sec[0], 22, y + 10, { size: 13, bold: true, color: C.forest });
      y += 26;
      var rows = sec[1];
      var heights = rows.map(function (r) { return 24 + UI.wrapText(ctx, r[1], w - 44, 11.5).length * 17; });
      var total = heights.reduce(function (a, b) { return a + b; }, 0) + 12;
      card(ctx, 16, y, w, total);
      var ry = y + 12;
      rows.forEach(function (r, i) {
        UI.text(ctx, r[0], 32, ry + 8, { size: 12.5, bold: true });
        UI.wrapText(ctx, r[1], w - 44, 11.5).forEach(function (line, j) {
          UI.text(ctx, line, 32, ry + 26 + j * 17, { size: 11.5, color: '#647A60' });
        });
        ry += heights[i];
      });
      y += total + 14;
    });
    this.contentH = y - top;
  };

  var M = { RankScene: RankScene, ShopScene: ShopScene, MineScene: MineScene, HelpScene: HelpScene };
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else if (typeof globalThis !== 'undefined') { globalThis.RankScene = RankScene; globalThis.ShopScene = ShopScene; globalThis.MineScene = MineScene; globalThis.HelpScene = HelpScene; }
})();
