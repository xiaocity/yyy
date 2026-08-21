/* 仅用于生成商店截图的初始化脚本。
   只写初始存档并调用游戏自己的 startLevel / tap，不改任何游戏逻辑与渲染。
   正式包不含此脚本。 */
(function(){
  function ready(){
    return typeof startLevel==='function' && typeof go==='function'
        && typeof save==='object' && typeof SPECIALS==='object' && typeof tap==='function';
  }
  function tappable(t){
    return t && !t.removed && !t.inTray && !isCovered(t) && !lockedBy(t);
  }
  function freeRains(){
    return G.tiles.filter(function(t){ return t.sp==='rain' && tappable(t); });
  }
  function fill(){
    try{
      /* 彩虹槽放 2 张：满 3 张会自动消除，就看不到槽里有牌了 */
      freeRains().slice(0,2).forEach(function(t){ tap(t); });
      /* 卡槽放 3 张花色互不相同的普通牌，凑成三连会被自动消掉 */
      var seen={}, picks=[];
      G.tiles.forEach(function(t){
        if(picks.length>=3 || t.sp || !tappable(t) || seen[t.type]) return;
        seen[t.type]=1; picks.push(t);
      });
      picks.forEach(function(t){ tap(t); });
    }catch(e){ console.log('SHOT fill 失败', e); }
  }
  function boot(){
    if(!ready()) return setTimeout(boot,80);
    try{
      save.lang    = '__LANG__';
      save.seenSp  = Object.keys(SPECIALS);  /* 免得每种特殊牌第一次出现都弹教学框 */
      save.guide   = 9;                      /* 跳过新手引导 */
      var LV = __LV__;                      /* 22 关之后十种特殊牌齐全，且都有彩虹牌 */
      save.level   = LV; save.cleared = LV-1;
      save.coins   = 1280; save.wool = 64;
      persist();
      setLang(save.lang);
      /* 开局时彩虹牌不一定有露在外面的，空着的彩虹槽说明不了玩法。
         盘面每次都是重新构造的（且都保证有解），重开到有 2 张彩虹牌可点为止 */
      var tries = 0;
      do { startLevel(LV); tries++; } while (freeRains().length < 2 && tries < 60);
      console.log('SHOT 重开 ' + tries + ' 次，露出彩虹牌 ' + freeRains().length + ' 张');
      go('s-game');
      setTimeout(fill, 500);
    }catch(e){ console.log('SHOT boot 失败', e); }
  }
  boot();
})();
