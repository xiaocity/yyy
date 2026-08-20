/* 音效：与网页版一样用 WebAudio 现场合成，不带任何音频文件。
   小游戏用 wx.createWebAudioContext()，浏览器用 AudioContext。 */
(function () {
  var PLAT = (typeof require !== 'undefined') ? require('./plat.js') : globalThis.PLAT;
  var AC = null, dead = false;

  function ctx() {
    if (dead) return null;
    if (AC) return AC;
    try {
      if (PLAT.isWx && wx.createWebAudioContext) AC = wx.createWebAudioContext();
      else if (typeof AudioContext !== 'undefined') AC = new AudioContext();
      else dead = true;
    } catch (e) { dead = true; }
    return AC;
  }

  function beep(freq, dur, type, gain) {
    var a = ctx();
    if (!a) return;
    try {
      var o = a.createOscillator(), g = a.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(gain == null ? 0.06 : gain, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
      o.connect(g); g.connect(a.destination);
      o.start(); o.stop(a.currentTime + dur);
    } catch (e) {}
  }

  var on = true;
  var SFX = {
    enabled: function (v) { if (v != null) on = !!v; return on; },
    pick: function () { if (on) beep(520, 0.08, 'sine', 0.05); },
    match: function (n) { if (on) beep(600 + Math.min(6, n || 1) * 70, 0.16, 'triangle', 0.07); },
    win: function () { if (!on) return; [523, 659, 784].forEach(function (f, i) { setTimeout(function () { beep(f, 0.22, 'sine', 0.07); }, i * 110); }); },
    fail: function () { if (on) beep(180, 0.4, 'sawtooth', 0.05); },
    deny: function () { if (on) beep(150, 0.12, 'square', 0.04); },
    coin: function () { if (on) { beep(880, 0.1, 'sine', 0.05); setTimeout(function () { beep(1180, 0.1, 'sine', 0.04); }, 70); } }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SFX;
  else if (typeof globalThis !== 'undefined') globalThis.SFX = SFX;
})();
