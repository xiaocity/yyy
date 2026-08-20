/* 首页：问候卡、四个模式入口、吸底的主按钮。
   主按钮直接进当前关，不绕关卡地图——网页版上这一条改过，行为保持一致。 */
(function () {
  var CORE = (typeof require !== 'undefined') ? require('./core.js') : globalThis.CORE;
  var UI = (typeof require !== 'undefined') ? require('./ui.js') : globalThis.UI;
  var Page = (typeof require !== 'undefined') ? require('./page.js') : globalThis.Page;
  var SAVE = (typeof require !== 'undefined') ? require('./save.js') : globalThis.SAVE;
  var C = UI.C;

  function HomeScene() { Page.call(this, 'home', '羊羊羊之草原牧歌'); }
  HomeScene.prototype = Object.create(Page.prototype);
  HomeScene.prototype.constructor = HomeScene;

  HomeScene.prototype.body = function (ctx, stage, top) {
    var P = stage.plat, S = SAVE.d, self = this;
    var y = top + 8, w = P.W - 32;

    // 问候卡
    var hh = new Date().getHours();
    var hi = hh < 6 ? '凌晨好' : hh < 11 ? '早上好' : hh < 14 ? '中午好' : hh < 18 ? '下午好' : '晚上好';
    UI.fillRound(ctx, 16, y, w, 96, 20, '#EDF6E4');
    UI.text(ctx, hi + '，牧羊人', 32, y + 30, { size: 18, bold: true });
    var d = new Date();
    UI.text(ctx, (d.getMonth() + 1) + '月' + d.getDate() + '日', P.W - 32, y + 30, { size: 12, color: C.dim, align: 'right' });
    var say = CORE.SAYINGS ? CORE.SAYINGS[(d.getDate() + d.getMonth()) % CORE.SAYINGS.length] : '';
    UI.wrapText(ctx, say, w - 40, 12).slice(0, 2).forEach(function (line, i) {
      UI.text(ctx, line, 32, y + 58 + i * 18, { size: 12, color: '#54704F' });
    });
    y += 110;

    // 资源
    UI.fillRound(ctx, 16, y, w, 56, 16, C.paper);
    UI.strokeRound(ctx, 16, y, w, 56, 16, C.line, 1.5);
    [['金币', S.coins], ['羊毛', S.wool], ['通关', S.cleared], ['星星', SAVE.starTotal()]].forEach(function (it, i) {
      var cx = 16 + w / 4 * i + w / 8;
      UI.text(ctx, String(it[1]), cx, y + 22, { size: 16, bold: true, color: C.forest, align: 'center' });
      UI.text(ctx, it[0], cx, y + 40, { size: 10, color: C.dim, align: 'center' });
    });
    y += 70;

    // 四个模式
    var modes = [
      ['📅', '每日挑战', '全服同题', function () { stage.startMode('daily'); }],
      ['♾️', '无尽草原', '最佳 ' + SAVE.d.endless + ' 组', function () { stage.startMode('endless'); }],
      ['🗓️', '本周挑战', CORE.weeklyMod().n, function () { stage.startMode('weekly'); }],
      ['📖', '玩法说明', '牌面与规则', function () { stage.nav('help'); }]
    ];
    var bw = (w - 12) / 2;
    modes.forEach(function (m, i) {
      var bx = 16 + (i % 2) * (bw + 12), by = y + Math.floor(i / 2) * 84;
      UI.fillRound(ctx, bx, by, bw, 74, 16, C.paper);
      UI.strokeRound(ctx, bx, by, bw, 74, 16, C.line, 1.5);
      UI.text(ctx, m[0], bx + bw / 2, by + 22, { size: 20, align: 'center' });
      UI.text(ctx, m[1], bx + bw / 2, by + 46, { size: 13, bold: true, align: 'center' });
      UI.text(ctx, m[2], bx + bw / 2, by + 62, { size: 10, color: C.dim, align: 'center' });
      self.hit(stage, bx, by, bw, 74, m[3]);
    });
    y += 84 * 2 + 6;

    // 每日签到
    UI.fillRound(ctx, 16, y, w, 84, 16, C.paper);
    UI.strokeRound(ctx, 16, y, w, 84, 16, C.line, 1.5);
    UI.text(ctx, '7 日签到', 32, y + 22, { size: 13, bold: true });
    var todayKey = String(CORE.dailySeed());
    var got = S.checkin === todayKey;
    UI.text(ctx, got ? '今天已签到' : '点击领取', P.W - 32, y + 22, { size: 11, color: C.dim, align: 'right' });
    for (var i = 0; i < 7; i++) {
      var cx = 32 + i * ((w - 40) / 7), cw = (w - 40) / 7 - 6;
      var on = i < (S.ckStreak || 0);
      UI.fillRound(ctx, cx, y + 38, cw, 32, 8, on ? C.forest : C.mint);
      UI.text(ctx, String(i + 1), cx + cw / 2, y + 54, { size: 12, bold: true, align: 'center', color: on ? '#fff' : C.forest });
    }
    if (!got) this.hit(stage, 16, y, w, 84, function () {
      S.checkin = todayKey;
      S.ckStreak = Math.min(7, (S.ckStreak || 0) + 1);
      S.coins += CORE.CK_COIN[S.ckStreak - 1];
      SAVE.save();
      stage.toast('签到成功，金币 +' + CORE.CK_COIN[S.ckStreak - 1]);
    });
    y += 96;

    this.contentH = y - top + 84;
  };

  /* 主按钮吸在导航栏上方，不随内容滚动 */
  HomeScene.prototype.draw = function (ctx, stage) {
    Page.prototype.draw.call(this, ctx, stage);
    var P = stage.plat, S = SAVE.d;
    var by = P.H - Page.TABBAR_H - 60;
    var grad = ctx.createLinearGradient(0, by - 16, 0, by + 10);
    grad.addColorStop(0, 'rgba(246,250,240,0)');
    grad.addColorStop(1, C.cream);
    ctx.fillStyle = grad;
    ctx.fillRect(0, by - 16, P.W, 26);
    UI.button(ctx, stage, 22, by, P.W - 44, 50,
      S.cleared ? ('继续闯关 · 第 ' + S.level + ' 关') : '开始游戏',
      function () { stage.startLevel(S.level); }, { bg: C.forest, size: 16 });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = HomeScene;
  else if (typeof globalThis !== 'undefined') globalThis.HomeScene = HomeScene;
})();
