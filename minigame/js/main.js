/* 启动与导航。浏览器测试壳与小游戏走同一份代码，只有 plat.js 里的实现不同。 */
(function () {
  var req = (typeof require !== 'undefined');
  var PLAT = req ? require('./plat.js') : globalThis.PLAT;
  var UI = req ? require('./ui.js') : globalThis.UI;
  var SAVE = req ? require('./save.js') : globalThis.SAVE;
  var SFX = req ? require('./sfx.js') : globalThis.SFX;
  var GameScene = req ? require('./scene_game.js') : globalThis.GameScene;
  var HomeScene = req ? require('./scene_home.js') : globalThis.HomeScene;
  var LevelsScene = req ? require('./scene_levels.js') : globalThis.LevelsScene;
  var More = req ? require('./scene_more.js') : null;
  var RankScene = More ? More.RankScene : globalThis.RankScene;
  var ShopScene = More ? More.ShopScene : globalThis.ShopScene;
  var MineScene = More ? More.MineScene : globalThis.MineScene;
  var HelpScene = More ? More.HelpScene : globalThis.HelpScene;

  function boot(opt) {
    PLAT.init(opt || {});
    var stage = new UI.Stage(PLAT);

    stage.nav = function (id) {
      if (id === 'home') stage.go(new HomeScene());
      else if (id === 'levels') stage.go(new LevelsScene());
      else if (id === 'rank') stage.go(new RankScene());
      else if (id === 'shop') stage.go(new ShopScene());
      else if (id === 'mine') stage.go(new MineScene());
      else if (id === 'help') stage.go(new HelpScene());
    };
    stage.startLevel = function (lv, seed) {
      stage.go(new GameScene(lv, seed, 'normal'));
    };
    stage.startMode = function (mode) {
      var lv = mode === 'endless' ? 9 : mode === 'weekly' ? 18 : 12;
      var sc = new GameScene(lv, null, mode);
      if (mode === 'endless') { sc.wave = 1; sc.score = 0; }
      stage.go(sc);
    };

    SFX.enabled(SAVE.d.sound !== false);
    stage.nav('home');
    stage.start();
    return stage;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { boot: boot };
  else if (typeof globalThis !== 'undefined') globalThis.MAIN = { boot: boot };
})();
