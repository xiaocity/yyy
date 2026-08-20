/* 启动自检：在真实运行环境里跑一遍核心，把结果写进存储。
   没有自动化通路时，这是唯一能拿到「它在 wx 里确实跑通了」的证据。
   发布前把 game.js 里的调用去掉即可，本文件不参与玩法。 */
(function () {
  var CORE = (typeof require !== 'undefined') ? require('./core.js') : globalThis.CORE;
  var PLAT = (typeof require !== 'undefined') ? require('./plat.js') : globalThis.PLAT;

  function replay(gen, slotN) {
    var tiles = gen.tiles, queues = gen.queues, order = gen.order;
    var tray = [], rain = [], matches = 0;
    var covered = function (t) {
      if (t.q >= 0) {
        var q = queues[t.q], sm = false, la = false;
        for (var i = 0; i < q.length; i++) {
          var o = q[i];
          if (o.removed || o === t) continue;
          if (o.qp < t.qp) sm = true; else la = true;
        }
        return t.biq ? (sm && la) : sm;
      }
      for (var j = 0; j < tiles.length; j++) {
        var b = tiles[j];
        if (!b.removed && b.q < 0 && b.layer > t.layer && CORE.overlap(b, t)) return true;
      }
      return false;
    };
    var locked = function (t) {
      if (t.sp === 'freeze' && t.frozen) return 1;
      if ((t.sp === 'chain' || t.sp === 'supply') && matches < t.chainN) return 1;
      return 0;
    };
    var thaw = function (t) {
      if (t.q >= 0) return;
      tiles.forEach(function (o) {
        if (o.removed || o.sp !== 'freeze' || !o.frozen || o.layer !== t.layer) return;
        if ((Math.abs(o.x - t.x) === 2 && o.y === t.y) || (Math.abs(o.y - t.y) === 2 && o.x === t.x)) o.frozen = false;
      });
    };
    for (var i = 0; i < order.length; i++) {
      var t = order[i];
      if (t.removed || covered(t) || locked(t)) return 'step' + i;
      if (t.sp === 'dbl' && t.shell) t.shell = false;
      if (t.sp === 'rain') {
        t.removed = true; rain.push(t); thaw(t);
        if (rain.length === 3) { rain.length = 0; matches++; }
        continue;
      }
      if (tray.length >= slotN) return 'slotfull' + i;
      t.removed = true; tray.push(t); thaw(t);
      if (t.sp === 'bomb') t.bombLeft = t.bombK;
      for (var k = 0; k < tray.length; k++) {
        var x = tray[k];
        if (x === t || x.sp !== 'bomb') continue;
        x.bombLeft--;
        if (x.bombLeft <= 0) return 'bomb' + i;
      }
      var same = tray.filter(function (o) { return o.type === t.type; });
      if (same.length >= 3) {
        same.slice(0, 3).forEach(function (x) { tray.splice(tray.indexOf(x), 1); });
        matches++;
      }
    }
    if (tiles.filter(function (t) { return !t.removed; }).length || tray.length || rain.length) return 'residue';
    return null;
  }

  function run() {
    var t0 = Date.now(), boards = 0, fails = [];
    for (var lv = 1; lv <= 50; lv++) {
      for (var k = 0; k < 2; k++) {
        CORE.G.mode = 'normal';
        CORE.seedRNG(lv * 100 + k);
        var gen = CORE.genLevel(lv);
        var slotN = (CORE.levelDef(lv).cfg.slots) || CORE.BASE_SLOT;
        var e = replay(gen, slotN);
        boards++;
        if (e) fails.push('lv' + lv + ':' + e);
      }
    }
    var code = CORE.makeCode(7, 123456, { time: 60600, combo: 9 });
    var p = CORE.parseCode(code);
    var res = {
      env: PLAT.isWx ? 'wx' : 'browser',
      wxApi: (typeof wx !== 'undefined'),
      canvas: !!(PLAT.canvas && PLAT.ctx),
      screen: PLAT.W + 'x' + PLAT.H + '@' + PLAT.dpr,
      safe: PLAT.safeTop + '/' + PLAT.safeBottom,
      boards: boards,
      fails: fails.length,
      firstFail: fails[0] || '',
      code: code,
      codeOK: !!(p && p.lv === 7 && p.seed === 123456 && p.target.time === 60600 && p.target.combo === 9),
      storage: (function () {
        try {
          PLAT.save('__probe', { v: 1 });
          var got = PLAT.load('__probe');
          return !!(got && got.v === 1);
        } catch (e) { return 'ERR'; }
      })(),
      ms: Date.now() - t0,
      at: new Date().toString()
    };
    PLAT.save('__selftest', res);
    if (typeof console !== 'undefined') console.log('[SELFTEST]', JSON.stringify(res));
    return res;
  }

  var T = { run: run };
  if (typeof module !== 'undefined' && module.exports) module.exports = T;
  else if (typeof globalThis !== 'undefined') globalThis.SELFTEST = T;
})();
