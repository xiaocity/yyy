/* 存档。字段与网页版对齐，读取时做类型清洗——
   脏数据能把整页渲染打崩，这一课在网页版排行页上已经付过学费了。 */
(function () {
  var PLAT = (typeof require !== 'undefined') ? require('./plat.js') : globalThis.PLAT;
  var CORE = (typeof require !== 'undefined') ? require('./core.js') : globalThis.CORE;

  var KEY = 'sheep-mini-save-v1';
  var LV_CAP = 200;

  function def() {
    return {
      coins: 300, wool: 0, level: 1, cleared: 0, stars: {}, best: {},
      tools: { shuffle: 3, undo: 3, out: 2 },
      toolLv: { shuffle: 1, undo: 1, out: 1 },
      dex: { hat: { s: 0 } }, skin: 'hat', pity: 0,
      farm: {}, ach: [], daily: {}, weekly: {}, endless: 0, endlessLog: [],
      duel: { win: 0, lose: 0, log: [] },
      st: { matches: 0, bestCombo: 0, boss: 0, noTool: 0, daily: 0 },
      sound: true, name: '小羊牧歌', title: '牧羊新手', plays: 0, seenSp: []
    };
  }

  var num = function (v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; };
  var obj = function (o) { return (o && typeof o === 'object' && !(o instanceof Array)) ? o : {}; };

  function clean(s) {
    var d = def(), k;
    if (!s || typeof s !== 'object' || s instanceof Array) return d;
    for (k in d) if (!(k in s)) s[k] = d[k];
    s.coins = num(s.coins, 300); s.wool = num(s.wool, 0);
    s.level = Math.max(1, Math.min(LV_CAP, num(s.level, 1)));
    s.cleared = num(s.cleared, 0);
    s.tools = Object.assign({ shuffle: 0, undo: 0, out: 0 }, obj(s.tools));
    s.toolLv = Object.assign({ shuffle: 1, undo: 1, out: 1 }, obj(s.toolLv));
    s.st = Object.assign(d.st, obj(s.st));
    s.duel = Object.assign({ win: 0, lose: 0, log: [] }, obj(s.duel));
    s.duel.log = (s.duel.log instanceof Array ? s.duel.log : []).slice(0, 20);
    s.endlessLog = (s.endlessLog instanceof Array ? s.endlessLog : []).slice(0, 10);
    s.ach = (s.ach instanceof Array) ? s.ach : [];
    s.seenSp = (s.seenSp instanceof Array) ? s.seenSp : [];
    s.dex = obj(s.dex); s.farm = obj(s.farm);
    s.daily = obj(s.daily); s.weekly = obj(s.weekly);
    // 只保留合法的整数关号，越界或小数会让关卡表查询炸掉
    ['stars', 'best'].forEach(function (f) {
      var src = obj(s[f]), out = {};
      Object.keys(src).forEach(function (x) {
        var lv = Number(x);
        if (lv === Math.floor(lv) && lv > 0 && lv <= LV_CAP) out[lv] = src[x];
      });
      s[f] = out;
    });
    return s;
  }

  var S = clean(PLAT.load(KEY));

  var API = {
    get d() { return S; },
    save: function () { PLAT.save(KEY, S); },
    reset: function () { S = def(); API.save(); },

    starTotal: function () {
      var n = 0; for (var k in S.stars) n += S.stars[k] || 0; return n;
    },
    /* 通关结算：星级、最佳纪录、金币羊毛 */
    winLevel: function (lv, secs, combo, matches, noTool) {
      var stars = 3;
      if (secs > 180) stars = 2;
      if (secs > 300) stars = 1;
      S.stars[lv] = Math.max(S.stars[lv] || 0, stars);
      var b = S.best[lv] || {};
      S.best[lv] = {
        time: (!b.time || secs * 1000 < b.time) ? secs * 1000 : b.time,
        combo: Math.max(b.combo || 0, combo)
      };
      S.cleared++;
      if (S.level === lv && lv < CORE.MAX_LEVEL) S.level = lv + 1;
      var coin = Math.round(30 + matches * 4 + Math.max(0, combo - 1) * 6);
      if (CORE.isBonus(lv)) coin *= 2;
      S.coins += coin;
      var wool = CORE.isBoss(lv) ? 12 : 4;
      S.wool += wool;
      S.st.matches += matches;
      S.st.bestCombo = Math.max(S.st.bestCombo, combo);
      if (CORE.isBoss(lv)) S.st.boss++;
      if (noTool) S.st.noTool++;
      API.save();
      return { stars: stars, coin: coin, wool: wool };
    },
    achDone: function () {
      var got = [];
      CORE.ACH.forEach(function (a) {
        if (S.ach.indexOf(a[0]) >= 0) return;
        var ok = false;
        try { ok = !!a[3](S); } catch (e) { ok = false; }
        if (ok) { S.ach.push(a[0]); S.wool += a[4]; got.push(a); }
      });
      if (got.length) API.save();
      return got;
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else if (typeof globalThis !== 'undefined') globalThis.SAVE = API;
})();
