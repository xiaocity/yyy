/* 关卡地图：按章节分组，蜿蜒排布的节点，锁住的关卡看得见但点不进去。
   地图至少铺满全部设计关卡——网页版上「只能看到当前进度后一章」是修过的 bug。 */
(function () {
  var CORE = (typeof require !== 'undefined') ? require('./core.js') : globalThis.CORE;
  var UI = (typeof require !== 'undefined') ? require('./ui.js') : globalThis.UI;
  var Page = (typeof require !== 'undefined') ? require('./page.js') : globalThis.Page;
  var SAVE = (typeof require !== 'undefined') ? require('./save.js') : globalThis.SAVE;
  var C = UI.C;

  var DESIGN = 50;

  function LevelsScene() {
    Page.call(this, 'levels', '关卡地图');
  }
  LevelsScene.prototype = Object.create(Page.prototype);
  LevelsScene.prototype.constructor = LevelsScene;

  LevelsScene.prototype.enter = function (stage) {
    Page.prototype.enter.call(this, stage);
    // 打开时滚到当前进度附近
    var lv = SAVE.d.level;
    this.scroll = Math.max(0, (lv - 1) * 72 - 260);
    this._want = lv;
  };

  LevelsScene.prototype.body = function (ctx, stage, top) {
    var P = stage.plat, S = SAVE.d, self = this;
    var maxLv = Math.max(DESIGN, S.level);
    var y = top + 6;
    var lastCh = -1;

    for (var lv = 1; lv <= maxLv; lv++) {
      var ch = CORE.chapterIdx(lv);
      if (ch !== lastCh) {
        lastCh = ch;
        UI.fillRound(ctx, 16, y, P.W - 32, 34, 10, C.mint);
        UI.text(ctx, CORE.chapterTitle(lv), 30, y + 17, { size: 13, bold: true, color: C.forest });
        y += 44;
      }
      var wave = (lv % 2 === 0) ? 44 : -44;
      var cx = P.W / 2 + wave, cy = y + 26;
      var locked = lv > S.level;
      var stars = S.stars[lv] || 0;
      var boss = CORE.isBoss(lv), bonus = CORE.isBonus(lv);

      // 连线
      if (lv > 1) {
        ctx.strokeStyle = '#DCE9D2';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 6]);
        ctx.beginPath();
        ctx.moveTo(P.W / 2 - wave, cy - 62);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      var r = boss ? 27 : 23;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = locked ? '#E9EFE3' : (boss ? C.soil : bonus ? C.sun : C.forest);
      ctx.fill();
      ctx.strokeStyle = locked ? '#DCE7D2' : C.paper;
      ctx.lineWidth = 3;
      ctx.stroke();
      UI.text(ctx, locked ? '🔒' : String(lv), cx, cy, {
        size: locked ? 15 : 15, bold: true, align: 'center',
        color: locked ? '#A8B8A2' : '#fff'
      });
      if (boss && !locked) UI.text(ctx, 'BOSS', cx, cy + 38, { size: 9, bold: true, color: C.soil, align: 'center' });
      if (bonus && !locked) UI.text(ctx, '宝箱', cx, cy + 38, { size: 9, bold: true, color: '#9C7A12', align: 'center' });

      // 星级
      if (stars) {
        for (var s = 0; s < 3; s++) {
          UI.text(ctx, s < stars ? '★' : '☆', cx - 16 + s * 16, cy - 34,
            { size: 11, align: 'center', color: s < stars ? C.sun : '#D6E2CC' });
        }
      }
      // 关卡名
      UI.text(ctx, CORE.levelName(lv), cx + (wave > 0 ? -44 : 44), cy,
        { size: 11.5, color: locked ? '#A8B8A2' : C.ink, align: wave > 0 ? 'right' : 'left' });

      if (!locked) {
        (function (n) {
          self.hit(stage, cx - 30, cy - 30, 60, 60, function () { stage.startLevel(n); });
        })(lv);
      }
      y += 62;
    }
    this.contentH = y - top + 20;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = LevelsScene;
  else if (typeof globalThis !== 'undefined') globalThis.LevelsScene = LevelsScene;
})();
