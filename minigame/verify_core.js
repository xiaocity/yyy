/* 校验抽取出来的 core.js 是否与网页版行为一致：
   对每一关生成盘面，然后回放它自己算出的必胜顺序，
   并严格执行全部规则——遮挡、牌堆、冰冻、锁链/补给、炸弹倒数、
   彩虹独立槽、卡槽上限、终局三处全空。
   任何一步走不通都说明抽取过程丢了东西。

   用法: node verify_core.js [每关局数]
*/
const CORE = require('./js/core.js');

function replay(gen, slotN) {
  const tiles = gen.tiles, queues = gen.queues, order = gen.order;
  const tray = [];          // 普通卡槽
  const rain = [];          // 彩虹槽
  let matches = 0;

  const covered = (t) => {
    if (t.q >= 0) {
      const q = queues[t.q];
      let smaller = false, larger = false;
      for (const o of q) {
        if (o.removed || o === t) continue;
        if (o.qp < t.qp) smaller = true; else larger = true;
      }
      return t.biq ? (smaller && larger) : smaller;
    }
    return tiles.some(o => !o.removed && o.q < 0 && o.layer > t.layer && CORE.overlap(o, t));
  };
  const locked = (t) => {
    if (t.sp === 'freeze' && t.frozen) return 'freeze';
    if (t.sp === 'chain' && matches < t.chainN) return 'chain';
    if (t.sp === 'supply' && matches < t.chainN) return 'supply';
    return null;
  };
  const thaw = (t) => {
    if (t.q >= 0) return;
    tiles.forEach(o => {
      if (o.removed || o.sp !== 'freeze' || !o.frozen || o.layer !== t.layer) return;
      if ((Math.abs(o.x - t.x) === 2 && o.y === t.y) ||
          (Math.abs(o.y - t.y) === 2 && o.x === t.x)) o.frozen = false;
    });
  };

  for (let i = 0; i < order.length; i++) {
    const t = order[i];
    if (t.removed) return 'step ' + i + ': 牌已被移除';
    if (covered(t)) return 'step ' + i + ': 被压住 (layer ' + t.layer + ')';
    const lk = locked(t);
    if (lk) return 'step ' + i + ': 被锁 (' + lk + ')';

    if (t.sp === 'dbl' && t.shell) t.shell = false;   // 双层牌先拆壳，与网页版一致

    if (t.sp === 'rain') {
      if (rain.length >= 3) return 'step ' + i + ': 彩虹槽已满';
      t.removed = true; rain.push(t); thaw(t);
      if (rain.length === 3) { rain.length = 0; matches++; }
      continue;
    }

    if (tray.length >= slotN) return 'step ' + i + ': 卡槽溢出 (' + tray.length + '/' + slotN + ')';
    t.removed = true; tray.push(t); thaw(t);
    if (t.sp === 'bomb') t.bombLeft = t.bombK;   // 入槽才开始倒数，与网页版一致

    // 炸弹倒数：每有一张牌入槽，槽里其它炸弹减 1
    for (const x of tray) {
      if (x === t || x.sp !== 'bomb') continue;
      x.bombLeft--;
      if (x.bombLeft <= 0) return 'step ' + i + ': 炸弹倒数归零';
    }

    const same = tray.filter(x => x.type === t.type);
    if (same.length >= 3) {
      const trio = same.slice(0, 3);
      trio.forEach(x => tray.splice(tray.indexOf(x), 1));
      matches++;
    }
  }

  const left = tiles.filter(t => !t.removed).length;
  if (left) return '终局仍有 ' + left + ' 张牌未消';
  if (tray.length) return '终局卡槽残留 ' + tray.length + ' 张';
  if (rain.length) return '终局彩虹槽残留 ' + rain.length + ' 张';
  return null;
}

function main() {
  const per = parseInt(process.argv[2] || '8', 10);
  let boards = 0, fails = [];
  for (let lv = 1; lv <= 50; lv++) {
    for (let k = 0; k < per; k++) {
      CORE.G.mode = 'normal';
      const seed = lv * 1000 + k;
      CORE.seedRNG(seed);
      const gen = CORE.genLevel(lv);
      const slotN = (CORE.levelDef(lv).cfg.slots) || CORE.BASE_SLOT;
      const err = replay(gen, slotN);
      boards++;
      if (err) fails.push('lv' + lv + ' seed' + seed + ': ' + err);
    }
  }
  console.log('闯关 1-50，每关 ' + per + ' 局，共 ' + boards + ' 个盘面');
  console.log(fails.length ? ('失败 ' + fails.length + ' 例:\n  ' + fails.slice(0, 10).join('\n  '))
                           : '全部通过：0 例失败');

  // 暗号往返
  let bad = 0;
  for (let lv = 1; lv <= 50; lv++) {
    for (const sd of [0, 7, 123456, 16777215]) {
      const c = CORE.makeCode(lv, sd, { time: 60600, combo: 9 });
      const p = CORE.parseCode(c);
      if (!p || p.lv !== lv || p.seed !== (sd >>> 0) % 16777216 ||
          p.target.time !== 60600 || p.target.combo !== 9) bad++;
    }
  }
  console.log('暗号往返 200 组：' + (bad ? bad + ' 例不符' : '全部一致'));

  // 同种子必须复现同一盘面
  CORE.seedRNG(4242); const a = CORE.genLevel(13);
  CORE.seedRNG(4242); const b = CORE.genLevel(13);
  const same = a.tiles.length === b.tiles.length &&
    a.tiles.every((t, i) => t.type === b.tiles[i].type && t.sp === b.tiles[i].sp &&
                            t.x === b.tiles[i].x && t.y === b.tiles[i].y);
  console.log('同种子复现：' + (same ? '一致' : '***不一致***'));
  process.exit(fails.length || bad || !same ? 1 : 0);
}

main();
