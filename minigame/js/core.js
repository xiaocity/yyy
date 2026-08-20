/* eslint-disable */
/* 核心逻辑：由 extract_core.py 从网页版 index.html 原样抽出，未修改任何算法。
   这一层不碰 DOM、不碰 wx API，浏览器与小游戏共用。
   网页版算法有改动时重跑 extract_core.py 同步，不要手改本文件。 */

/* levelDef 按模式取配置，网页版直接读全局 G。这里保留原样，
   由游戏层在调用 genLevel 之前写 CORE.G，把耦合摆在明面上。 */
var G = { mode: "normal", wave: 1, buffs: null, matches: 0,
          tiles: [], tray: [], rain: [], goal: null, rcfg: null, lv: 1,
          toolLv: { shuffle: 1, undo: 1, out: 1 } };

/* 有解洗牌里会查道具等级，网页版从 save 里读。这里读 G，语义一致。 */
function toolLv(k) { return (G.toolLv && G.toolLv[k]) || 1; }
function mulberry32(a){
  return function(){
    a|=0; a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}

let RNG=Math.random;

function seedRNG(seed){ RNG = (seed==null) ? Math.random : mulberry32(seed>>>0); }

const rnd = n => Math.floor(RNG()*n);

function shuffle(a){for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}

const LV_CAP=200;

const LEVELS=[
  {name:'晨露坡',   pos:[12,6],  cfg:{n:18, layers:3, types:4, q:[],      d:3}},
  {name:'微光林',   pos:[55,14], cfg:{n:24, layers:3, types:4, q:[],      d:4}},
  {name:'风车草地', pos:[20,22], cfg:{n:30, layers:4, types:5, q:[6],     d:4}},
  {name:'薄荷溪',   pos:[60,30], cfg:{n:36, layers:4, types:6, q:[6],     d:3}},
  {name:'云杉谷',   pos:[14,38], cfg:{n:42, layers:5, types:6, q:[6],     d:3}},
  {name:'阳光丘',   pos:[58,46], cfg:{n:45, layers:5, types:6, q:[6,6],   d:5}},
  {name:'苔藓洞',   pos:[18,54], cfg:{n:48, layers:5, types:6, q:[9,9],   d:6}},
  {name:'松果径',   pos:[56,62], cfg:{n:54, layers:6, types:6.4, q:[9,9], d:4}},
  {name:'野花甸',   pos:[16,70], cfg:{n:60, layers:6, types:7, q:[9,9],   d:3}},
  {name:'远山径',   pos:[58,78], cfg:{n:66, layers:6, types:7, q:[12,12], d:5}},
  {name:'星月原',   pos:[20,86], cfg:{n:72, layers:7, types:7, q:[12,12], d:6}},
  {name:'天空牧场', pos:[55,94], cfg:{n:81, layers:7, types:7.2, q:[12,12], d:4}}
];

const MAX_LEVEL=LV_CAP;

const CH_SIZE=10;

const CHAPTERS=[
  {name:'晨露草原', cls:'ch-dawn', ico:'fa-mountain-sun',
   intro:'天刚亮，露水还挂在草尖上。羊群三三两两地散在坡上，谁也不着急。　|　牧羊人说，这片坡是最好学的地方——摔一跤也不疼。',
   words:['晨露坡','微光林','风车草地','薄荷溪','云杉谷','阳光丘','苔藓洞','松果径','野花甸','远山径']},
  {name:'幽深森林', cls:'ch-forest', ico:'fa-tree',
   intro:'越往里走，树越密，光越少。有些草料被藤蔓缠住了，得先解开才能拿。　|　林子里的羊学会了一件事：看不清的时候，先别急着动手。',
   words:['星月原','天空牧场','低语林','菌菇径','鹿鸣谷','藤蔓崖','萤火沼','古木道','静水潭','暮色岭']},
  {name:'初雪高原', cls:'ch-snow', ico:'fa-snowflake',
   intro:'第一场雪落下来的时候，整片高原都安静了。冻住的草料要靠旁边的温度化开。　|　这里的规矩是：慢一点没关系，但别停下。',
   words:['初雪坡','冰棱谷','白桦道','霜风口','雪兔径','冻湖畔','银松林','寒星台','雪线崖','极光原']},
  {name:'云海之巅', cls:'ch-cloud', ico:'fa-cloud-sun',
   intro:'再往上就出了云层。脚下是翻涌的云海，头顶是从没见过这么近的太阳。　|　这里风大，草却长得格外好 —— 牧羊人说，越难站住的地方，越值得多待一会儿。',
   words:['入云口','金光坡','浮岛渡','霞光谷','风起崖','云中湖','日照原','断云桥','天梯道','云海之巅']},
  {name:'星夜牧场', cls:'ch-night', ico:'fa-moon',
   intro:'再往上就是星夜牧场了。据说走到这里的羊，都能在天上找到属于自己的那一颗。　|　牧羊人没有再说什么，只是把灯点亮，站在原地看着羊群往前走。',
   words:['夜幕坡','银河渡','月牙湾','流星径','梦境园','星尘谷','夜莺林','幻光崖','无垠原','天际牧场']}
];

const ROMAN=['','','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'];

function chapterIdx(lv){ return Math.floor((lv-1)/CH_SIZE); }

function chapterOf(lv){ return CHAPTERS[chapterIdx(lv)%CHAPTERS.length]; }

function chapterTitle(lv){
  const round=Math.floor(chapterIdx(lv)/CHAPTERS.length)+1;
  return chapterOf(lv).name+(round>1?' '+ROMAN[Math.min(round,9)]:'');
}

function isBoss(lv){ return lv%CH_SIZE===0; }

const GOALS=['clear','steps','collect','peel','rescue','sprint'];

function goalOf(lv){
  if(lv<=12||isBoss(lv)||isBonus(lv)) return 'clear';   /* 前 12 关与 Boss/宝箱保持清空 */
  return GOALS[(lv-13)%GOALS.length];
}

function makeGoal(kind,tiles,order,stats){
  const total=stats.groups;
  const idxOfMatch=k=>{                       /* 第 k 组消除发生在顺序的第几步 */
    for(let i=0;i<order.length;i++) if(stats.before[i]>=k) return i;
    return order.length;
  };
  if(kind==='steps'){
    const need=Math.max(6,Math.round(total*0.72));
    const budget=Math.ceil(idxOfMatch(need)*1.09)+1;
    return {t:'steps',need,budget,used:0,got:0};
  }
  if(kind==='collect'){
    const cnt={};
    tiles.forEach(t=>{ if(t.sp!=='rain') cnt[t.type]=(cnt[t.type]||0)+1; });
    const cand=Object.keys(cnt).map(Number).filter(c=>cnt[c]>=9);
    const type=cand.length?cand[rnd(cand.length)]:+Object.keys(cnt)[0];
    const need=Math.min(4,Math.max(3,Math.floor(cnt[type]/3)));
    return {t:'collect',type,need,got:0};
  }
  if(kind==='peel'){
    const layers=Math.max.apply(null,tiles.filter(t=>t.q<0).map(t=>t.layer));
    const from=Math.max(1,layers-3);          /* 最上面四层 */
    const targets=tiles.filter(t=>t.q<0&&t.layer>=from);
    return {t:'peel',from,need:targets.length,got:0};
  }
  if(kind==='rescue'){
    /* 挑一张埋得最深的牌当「被困的小羊」 */
    const board=tiles.filter(t=>t.q<0);
    const deep=board.filter(t=>t.layer===Math.min.apply(null,board.map(x=>x.layer)));
    const pick=deep[rnd(deep.length)];
    if(pick) pick.rescue=true;
    return {t:'rescue',need:1,got:0};
  }
  if(kind==='sprint'){
    /* 模拟器测不了时间压力，所以把「非时间部分」也提上来，实际难度只会更高 */
    const need=Math.max(6,Math.round(total*0.70));
    return {t:'sprint',need,got:0,secs:60+Math.round(need*3.2)};
  }
  return {t:'clear',need:0,got:0};
}

function isBonus(lv){ return lv>12 && lv%CH_SIZE===5; }

const SHAPES=[
  {id:'square',  n:'方阵',   m:()=>true},
  {id:'diamond', n:'菱形',   m:(u,v)=>Math.pow(Math.abs(u-.5),1.6)+Math.pow(Math.abs(v-.5),1.6)<=Math.pow(.56,1.6)},
  {id:'circle',  n:'圆丘',   m:(u,v)=>(u-.5)*(u-.5)+(v-.5)*(v-.5)<=.30},
  {id:'tree',    n:'松树',   m:(u,v)=>(v>=.72 ? Math.abs(u-.5)<=.24 : Math.abs(u-.5)<=.16+v*.62)},
  {id:'cross',   n:'风车',   m:(u,v)=>Math.abs(u-.5)<=.32||Math.abs(v-.5)<=.32},
  {id:'twin',    n:'双峰',   m:(u,v)=>{
      const d1=Math.hypot(u-.30,v-.40), d2=Math.hypot(u-.70,v-.40);
      return d1<=.38||d2<=.38||v>=.66; }},
  {id:'heart',   n:'心形',   m:(u,v)=>{
      const x=(u-.5)*1.85, y=(.82-v)*1.85;
      const a=x*x+y*y-.58;
      return a*a*a - x*x*y*y*.58 <= 0; }},
  {id:'tower',   n:'高塔',   m:(u,v)=>Math.abs(u-.5)<=.22+v*.28}
];

function shapeOf(lv){
  if(lv<=3) return SHAPES[0];                 /* 前三关保持方阵，教学期不要花样 */
  const h=(lv*2654435761)>>>0;
  return SHAPES[h%SHAPES.length];
}

function spMix(lv){
  const m={};
  if(lv>=3)  m.coin=.05;
  if(lv>=4)  m.dbl=.10;
  if(lv>=5)  m.wool=.03;
  if(lv>=6)  m.rain=.09;
  if(lv>=8)  m.freeze=.08;
  if(lv>=9)  m.gift=.02;
  if(lv>=12) m.chain=.05;
  if(lv>=14) m.supply=.05;
  if(lv>=16) m.mystery=.07;
  if(lv>=18) m.torch=.03;
  if(lv>=22) m.bomb=.03;
  if(lv>=34) m.mystery=.09;
  if(lv>=42) m.freeze=.10;
  return m;
}

function levelDef(lv){
  if(G.mode==='endless'){
    const base=JSON.parse(JSON.stringify(rawLevelDef(waveLevel(G.wave)).cfg));
    const b=G.buffs||{};
    if(b.slots) base.slots=BASE_SLOT+b.slots;
    if(b.types) base.types=Math.max(4,+(base.types-b.types).toFixed(2));
    if(b.tiles) base.n=Math.max(18,base.n-b.tiles);
    base.shape=shapeOf(9+G.wave);
    return {name:'无尽草原',cfg:base};
  }
  if(G.mode==='weekly'){
    const base=JSON.parse(JSON.stringify(rawLevelDef(WEEKLY_LV).cfg));
    base.shape=shapeOf(WEEKLY_LV+weekIndex());
    weeklyMod().apply(base);
    return {name:'本周挑战 · '+weeklyMod().n, cfg:base};
  }
  return rawLevelDef(lv);
}

function rawLevelDef(lv){
  if(isBonus(lv)){
    /* 宝箱关：稳赢 + 必掉图鉴，作用是给曲线一个喘息，不是给难度 */
    return { name:'宝箱营地', bonus:true, cfg:{
      n:36, layers:4, types:5, q:[6], d:3, shape:shapeOf(lv),
      sp:{rain:.10, coin:.14, wool:.10, gift:.06}
    }};
  }
  if(lv<=LEVELS.length){
    const L=LEVELS[lv-1];
    L.cfg.shape=shapeOf(lv);
    return L;
  }
  const t=Math.min(1,(lv-12)/38);   /* 设计范围铺到第 50 关，之后进入平台期 */
  return {
    name:chapterOf(lv).words[(lv-1)%CH_SIZE]+(chapterIdx(lv)>=CHAPTERS.length?' '+ROMAN[Math.min(Math.floor(chapterIdx(lv)/CHAPTERS.length)+1,9)]:''),
    cfg:{
      n:Math.round((78+18*t)/3)*3,
      layers:7,
      /* d 必须随关号单调上升。之前按 4/5/6 循环，会让曲线出现锯齿 */
      types:+(7.2+0.8*t).toFixed(2),
      q:[12,12],
      /* Boss 关的压力来源是限时，盘面上不该再叠一层 —— d 封顶 5 */
      d:(isBoss(lv)?Math.min(5,4+Math.round(1.5*t)):4+Math.round(1.5*t)),
      shape:shapeOf(lv),
      biq:lv>=14,          /* 双向牌堆：两端都能取，是约束放宽 */
      sp:spMix(lv)
    }
  };
}

function levelName(lv){ return levelDef(lv).name; }

const TYPE_DEFS=[
  {i:'fa-leaf',        e:'🌿', c:'#4C9A5A'},
  {i:'fa-seedling',    e:'🌱', c:'#7DBB6E'},
  {i:'fa-tree',        e:'🌳', c:'#2E6B3E'},
  {i:'fa-mountain',    e:'⛰️', c:'#8FB98A'},
  {i:'fa-droplet',     e:'💧', c:'#5FB8B0'},
  {i:'fa-sun',         e:'☀️', c:'#F0B429'},
  {i:'fa-cloud',       e:'☁️', c:'#8FB4D8'},
  {i:'fa-apple-whole', e:'🍎', c:'#E2665A'},
  {i:'fa-carrot',      e:'🥕', c:'#E2874A'},
  {i:'fa-wheat-awn',   e:'🌾', c:'#C8A24A'},
  {i:'fa-star',        e:'⭐', c:'#E8B33C'},
  {i:'fa-fish',        e:'🐟', c:'#4FA3C7'},
  {i:'fa-feather',     e:'🪶', c:'#A98BC9'},
  {i:'fa-clover',      e:'🍀', c:'#58A86B'},
  {i:'fa-moon',        e:'🌙', c:'#7B7FC4'},
  {i:'fa-mug-hot',     e:'☕', c:'#A0785A'}
];

const GRID=14;

const BASE_SLOT=7;

let SLOT_N=7;

const COMBO_WINDOW=3000;

function mkTile(id,layer,x,y,q,qp){
  return {id,type:0,layer,x,y,q,qp,
          removed:false,inTray:false,matching:false,el:null,biq:false,
          sp:null,frozen:false,chainN:0,bombK:0,bombLeft:0,shell:false,shown:false};
}

function genLevel(lv){
  const cfg=levelDef(lv).cfg;
  const tiles=[];
  /* 1) 每层可用格位（层与层之间半格错位，形成堆叠感） */
  SLOT_N=cfg.slots||BASE_SLOT;
  const shape=cfg.shape||SHAPES[0];
  /* 层间收缩固定为 k：覆盖率是形状影响难度的真正通道，动它会让已定标的模型失效。
     形状裁掉的容量通过「块数上限留出余量」来吸收，而不是靠放宽收缩 */
  const layerSlots=[];
  for(let k=0;k<cfg.layers;k++){
    const lo=k, hi=GRID-2-k;
    if(hi<lo) break;
    const span=Math.max(1,hi-lo);
    const all=[], keep=[];
    for(let x=lo;x<=hi;x+=2) for(let y=lo;y<=hi;y+=2){
      const p={x,y};
      all.push(p);
      /* 归一化到本层区域的 [0,1]²，用同一个遮罩裁剪，整摞牌轮廓一致 */
      if(shape.m((x-lo)/span,(y-lo)/span)) keep.push(p);
    }
    layerSlots.push(shuffle(keep.length>=Math.min(3,all.length)?keep:all));
  }
  const K=layerSlots.length;
  const caps=layerSlots.map(s=>s.length);
  const totalCap=caps.reduce((a,b)=>a+b,0);
  let N=Math.min(cfg.n,totalCap - totalCap%3);

  /* 2) 分配每层块数：底层最宽、越往上越少且越密，形成金字塔 */
  const w=caps.map((c,k)=>c*(1+0.10*k));
  const sw=w.reduce((a,b)=>a+b,0);
  const counts=caps.map((c,k)=>Math.min(c,Math.max(1,Math.round(N*w[k]/sw))));
  let diff=N-counts.reduce((a,b)=>a+b,0);
  for(let k=0;diff>0&&k<K;k++){ const add=Math.min(diff,caps[k]-counts[k]); counts[k]+=add; diff-=add; }
  for(let k=0;diff<0&&k<K;k++){ const sub=Math.min(-diff,counts[k]-1); counts[k]-=sub; diff+=sub; }

  /* 3) 落位 */
  let uid=0;
  for(let k=0;k<K;k++){
    for(let i=0;i<counts[k];i++){
      const s=layerSlots[k][i];
      tiles.push(mkTile(uid++,k,s.x,s.y,-1,0));
    }
  }
  /* 4) 底部牌堆 */
  const queues=[];
  cfg.q.forEach((len,qi)=>{
    const arr=[];
    for(let p=0;p<len;p++){
      const t=mkTile(uid++,-1,0,0,qi,p);
      t.biq=!!cfg.biq;
      arr.push(t); tiles.push(t);
    }
    queues.push(arr);
  });

  /* 5) 修剪为 3 的倍数（从最上层拿掉多余的） */
  while(tiles.length%3!==0){
    let idx=-1,best=-2;
    for(let i=0;i<tiles.length;i++){ if(tiles[i].q<0&&tiles[i].layer>best){best=tiles[i].layer;idx=i;} }
    if(idx<0) break;
    tiles.splice(idx,1);
  }

  /* 6) 反向求解：先算一条合法的“可消除顺序”，再沿这条顺序染色 —— 保证有解 */
  const order=solveOrder(tiles,queues);
  paintOrder(order,planColors(cfg.types,order.length/3),{},cfg.d||3);
  /* 7) 特殊牌：沿着同一条顺序反推能放在哪，保证不会卡死必胜路线 */
  applySpecials(order,cfg);
  /* 8) 把必胜顺序交出去：关卡目标要用它算配额，失败回放要用它演示 */
  return {tiles,queues,order,stats:canonicalStats(order)};
}

const SPECIALS={
  freeze :{icon:'fa-snowflake',   emo:'❄️', name:'冰冻牌', tip:'被冰封住了，先消掉它同层紧挨着的一张牌就能解冻'},
  chain  :{icon:'fa-link',        emo:'⛓️', name:'锁链牌', tip:'锁着的牌，全场再消够指定组数就会自动解开'},
  dbl    :{icon:'fa-layer-group', emo:'📦', name:'双层牌', tip:'外面裹了一层草垛，要点两下：第一下拆壳，第二下才进卡槽'},
  rain   :{icon:'fa-rainbow',     emo:'🌈', name:'彩虹牌', tip:'不占卡槽格子！单独放在上面的彩虹槽里，凑齐 3 张自动消除'},
  bomb   :{icon:'fa-bomb',        emo:'💣', name:'炸弹牌', tip:'进了卡槽就开始倒数，数完还没消掉就直接失败'},
  mystery:{icon:'fa-question',    emo:'❓', name:'谜之牌', tip:'花色是盖着的，只有进了卡槽才翻开，没法提前规划'},
  /* 以下四种只在「被消除时」给奖励，完全不参与规则判定，对有解性零风险 */
  coin   :{icon:'fa-coins',       emo:'🪙', name:'金币牌', tip:'消掉它会额外掉金币，看到就先拿'},
  wool   :{icon:'fa-feather',     emo:'🪶', name:'羊毛牌', tip:'消掉它会额外掉羊毛，牧场建设就靠它'},
  gift   :{icon:'fa-gift',        emo:'🎁', name:'礼盒牌', tip:'消掉它会随机送一个道具'},
  torch  :{icon:'fa-lightbulb',   emo:'💡', name:'灯笼牌', tip:'消掉它会照亮 3 张谜之牌，把盖着的花色翻开'},
  supply :{icon:'fa-truck-ramp-box', emo:'📥', name:'补给牌', tip:'牌堆里盖着的补给，全场消够指定组数才会送上来'}
};

const REWARD_SP={coin:1,wool:1,gift:1,torch:1};

function canonicalStats(order){
  const tray=[], leave=new Map(), before=new Array(order.length), trios=[];
  let m=0;
  for(let i=0;i<order.length;i++){
    before[i]=m;
    const t=order[i]; tray.push(t);
    const same=tray.filter(x=>x.type===t.type);
    if(same.length>=3){
      const trio=same.slice(0,3);
      trio.forEach(x=>{ leave.set(x,i); tray.splice(tray.indexOf(x),1); });
      trios.push(trio); m++;
    }
  }
  return {leave,before,trios,groups:m};
}

function neighbors(t,tiles){
  return tiles.filter(o=>o!==t && o.q<0 && o.layer===t.layer &&
    ((Math.abs(o.x-t.x)===2 && o.y===t.y) || (Math.abs(o.y-t.y)===2 && o.x===t.x)));
}

function applySpecials(order,cfg){
  const mix=cfg.sp; if(!mix) return;
  const {leave,before,trios}=canonicalStats(order);
  const pos=new Map(); order.forEach((t,i)=>pos.set(t,i));
  const total=order.length;

  const take=(key,ratio,pick)=>{
    if(!ratio) return;
    let want=Math.round(total*ratio);
    const cand=shuffle(order.filter(t=>!t.sp&&pick(t)));
    for(const t of cand){ if(want<=0) break; t.sp=key; want--; }
  };

  /* 彩虹牌：必须整组三张一起转换，否则原花色会少一张、永远配不齐。
     转换整组之后每种花色的张数仍是 3 的倍数，必胜顺序原样成立 */
  if(mix.rain){
    const want=Math.max(1,Math.round(total*mix.rain/3));
    shuffle(trios.filter(g=>g.every(t=>!t.sp))).slice(0,want)
      .forEach(g=>g.forEach(t=>{ t.sp='rain'; }));
  }

  /* 冰冻：必胜顺序里，它之前必须已经消掉过一个同层邻居，否则永远解不开 */
  take('freeze',mix.freeze,t=>{
    if(t.q>=0) return false;
    const i=pos.get(t);
    return neighbors(t,order).some(o=>pos.get(o)<i);
  });
  /* 锁链：锁的组数不能超过它在必胜顺序里之前已完成的组数 */
  take('chain',mix.chain,t=>before[pos.get(t)]>=2);
  order.forEach(t=>{ if(t.sp==='chain'){
    const b=before[pos.get(t)];
    t.chainN=1+rnd(Math.max(1,Math.min(b,4)));
  }});
  /* 炸弹：倒数必须够它在必胜顺序里撑到自己那组消掉 */
  take('bomb',mix.bomb,t=>{
    const i=pos.get(t), lv=leave.get(t);
    return lv!==undefined && lv-i<=6;
  });
  order.forEach(t=>{ if(t.sp==='bomb'){
    t.bombK=(leave.get(t)-pos.get(t))+3+rnd(3);
  }});
  /* 双层：只多花一次点击，不影响顺序 */
  take('dbl',mix.dbl,()=>true);
  order.forEach(t=>{ if(t.sp==='dbl') t.shell=true; });
  /* 谜之：只藏信息 */
  take('mystery',mix.mystery,()=>true);
  /* 补给牌：只放在牌堆后半段，解锁组数由必胜顺序倒推，保证送上来时还来得及取 */
  take('supply',mix.supply,t=>t.q>=0 && before[pos.get(t)]>=2);
  order.forEach(t=>{ if(t.sp==='supply'){
    const b=before[pos.get(t)];
    t.chainN=1+rnd(Math.max(1,Math.min(b,5)));
  }});
  /* 奖励类：纯掉落，不参与任何判定 */
  take('coin',mix.coin,()=>true);
  take('wool',mix.wool,()=>true);
  take('gift',mix.gift,()=>true);
  take('torch',mix.torch,t=>t.q<0);
  /* 迷雾层：整层盖住，用的是同一套隐藏逻辑 */
  if(mix.fogLayer!=null){
    order.forEach(t=>{ if(t.q<0&&t.layer===mix.fogLayer&&!t.sp) t.sp='mystery'; });
  }
  order.forEach(t=>{ if(t.sp==='freeze') t.frozen=true; });
}

function planColors(types,m){
  const full=Math.max(1,Math.floor(types)), frac=types-full;
  const w=[]; for(let i=0;i<full;i++) w.push(1);
  if(frac>0.01) w.push(frac);
  const k=Math.min(w.length,m,TYPE_DEFS.length);
  w.length=k;
  const sw=w.reduce((a,b)=>a+b,0);
  const cnt=w.map(x=>Math.max(1,Math.round(m*x/sw)));
  let diff=m-cnt.reduce((a,b)=>a+b,0), guard=999;
  for(let i=0;diff>0&&guard-->0;i=(i+1)%k){ cnt[i]++; diff--; }
  guard=999;
  for(let i=k-1;diff<0&&guard-->0;i=(i+k-1)%k){ if(cnt[i]>1){ cnt[i]--; diff++; } }
  const palette=shuffle(TYPE_DEFS.map((_,x)=>x)).slice(0,k);
  const remain={};
  palette.forEach((c,j)=>remain[c]=cnt[j]*3);
  return remain;
}

function paintOrder(order,remain,tray0,cap){
  const tray=Object.assign({},tray0);
  let size=0; for(const c in tray) size+=tray[c];
  cap=Math.max(3,Math.min(SLOT_N-1,cap),size);
  const at=c=>tray[c]||0;
  const one=a=>a[rnd(a.length)];
  for(let i=0;i<order.length;i++){
    /* 彩虹牌靠 sp 配对、走独立槽，既不占卡槽也不参与花色配额，直接跳过 */
    if(order[i].sp==='rain') continue;
    const avail=Object.keys(remain).map(Number).filter(c=>remain[c]>0);
    if(!avail.length) break;
    const done =avail.filter(c=>at(c)===2);   /* 放下即三连，槽位 -2 */
    const half =avail.filter(c=>at(c)===1);   /* 放下变成两张，槽位 +1 */
    const fresh=avail.filter(c=>at(c)===0);   /* 开一个新花色，槽位 +1 */
    let c;
    if(size>=cap){
      /* 到顶了必须收缩。下面的 cap-1 规则保证此时 done 一定非空 */
      c = done.length?one(done) : half.length?one(half) : one(fresh);
    }else if(size===cap-1){
      /* 下一步就会顶满，先把某个花色凑到两张，确保届时消得掉 */
      c = half.length?one(half) : fresh.length?one(fresh) : one(done);
    }else{
      /* 还有余量：多开新花色制造压力，偶尔推进已有的 */
      c = (fresh.length && RNG()<.75) ? one(fresh)
        : half.length?one(half) : fresh.length?one(fresh) : one(done);
    }
    order[i].type=c;
    remain[c]--;
    if(at(c)===2){ tray[c]=0; size-=2; } else { tray[c]=at(c)+1; size++; }
  }
}

function overlap(a,b){ return Math.abs(a.x-b.x)<2 && Math.abs(a.y-b.y)<2; }

function freeIn(t,set){
  if(t.q>=0){
    /* 双向牌堆：只要是某一端就能取，是约束放宽，有解性天然保持 */
    let smaller=false, larger=false;
    for(const o of set){
      if(o===t||o.q!==t.q) continue;
      if(o.qp<t.qp) smaller=true; else larger=true;
      if(smaller&&(!t.biq||larger)) break;
    }
    return t.biq ? !(smaller&&larger) : !smaller;
  }
  for(const o of set){ if(o!==t && o.q<0 && o.layer>t.layer && overlap(o,t)) return false; }
  return true;
}

function solveOrder(tiles){
  const set=new Set(tiles);
  const order=[];
  let guard=tiles.length+5;
  while(set.size && guard-->0){
    const free=[];
    for(const t of set) if(freeIn(t,set)) free.push(t);
    if(!free.length){ for(const t of set) order.push(t); break; }
    /* 偏向先取高层，视觉上三连更自然 */
    free.sort((a,b)=>(b.layer-a.layer)||(RNG()-.5));
    const take=free[rnd(Math.max(1,Math.min(free.length,4)))];
    order.push(take); set.delete(take);
  }
  return order;
}

const WEEKLY=[
  {id:'narrow', n:'窄槽周',   d:'卡槽只有 5 格',       apply:c=>{ c.slots=5; c.d=Math.min(c.d,4); }},
  {id:'colors', n:'缤纷周',   d:'花色多一种',           apply:c=>{ c.types=+(c.types+1).toFixed(2); }},
  {id:'fog',    n:'迷雾周',   d:'一半的牌盖着花色',     apply:c=>{ c.sp=Object.assign({},c.sp,{mystery:.42}); }},
  {id:'wide',   n:'宽槽周',   d:'卡槽多两格，但花色翻倍', apply:c=>{ c.slots=9; c.types=+(c.types*1.35).toFixed(2); }},
  {id:'ice',    n:'霜冻周',   d:'冰冻牌大量出现',       apply:c=>{ c.sp=Object.assign({},c.sp,{freeze:.26}); }},
  {id:'boom',   n:'爆破周',   d:'炸弹牌大量出现',       apply:c=>{ c.sp=Object.assign({},c.sp,{bomb:.10}); }}
];

function weekIndex(d){
  d=d||new Date();
  return Math.floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000+4)/7);
}

function weeklyMod(){ return WEEKLY[weekIndex()%WEEKLY.length]; }

const WEEKLY_LV=18;

function ckChar(s){ let h=7; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))%36; return h.toString(36).toUpperCase(); }

function makeCode(lv,seed,res){
  let body=(Math.max(1,Math.min(MAX_LEVEL,lv))*16777216 + ((seed>>>0)%16777216)).toString(36).toUpperCase();
  if(res){
    /* 10ms 精度。原来按整秒四舍五入，最大 ±500ms 误差，
       势均力敌时慢 400ms 也会被判胜 —— 而那正是对战最需要准的区间 */
    const cs=Math.max(0,Math.min(599999,Math.round(res.time/10)));
    const cb=Math.max(0,Math.min(63,res.combo|0));
    body+='.'+(cs*64+cb).toString(36).toUpperCase();
  }
  return body+ckChar(body);
}

function parseCode(c){
  /* 分隔符统一成 '.' 再算校验，这样 . - _ / 四种写法都认 */
  const raw=String(c).toUpperCase().replace(/\s+/g,'').replace(/[\-_/]/g,'.');
  if(raw.length<2) return null;
  const body=raw.slice(0,-1);
  if(ckChar(body)!==raw.slice(-1)) return null;
  const bits=body.split('.').filter(Boolean);
  const head=(bits[0]||'').replace(/[^0-9A-Z]/g,'');
  const n=parseInt(head,36);
  if(!isFinite(n)||n<=0) return null;
  const lv=Math.floor(n/16777216), seed=n%16777216;
  if(lv<1||lv>MAX_LEVEL) return null;
  let target=null;
  if(bits[1]){
    const m=parseInt(bits[1].replace(/[^0-9A-Z]/g,''),36);
    if(isFinite(m)&&m>0) target={time:Math.floor(m/64)*10, combo:m%64};
  }
  return {lv,seed,target};
}

function dailySeed(d){ d=d||new Date(); return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate(); }

function waveLevel(w){ return 6+w*2; }

const TOOL_KEYS=['shuffle','undo','out'];

function tileNb(a,b){
  return a.q<0&&b.q<0&&a.layer===b.layer&&
    ((Math.abs(a.x-b.x)===2&&a.y===b.y)||(Math.abs(a.y-b.y)===2&&a.x===b.x));
}

function solveOrderLocked(rest,startMatches){
  const set=new Set(rest), order=[];
  const frozen=new Map();
  rest.forEach(t=>{ if(t.sp==='freeze'&&t.frozen) frozen.set(t,true); });
  let guard=rest.length+5;
  while(set.size&&guard-->0){
    const m=startMatches+Math.floor(order.length/3);
    const free=[];
    for(const t of set){
      if(!freeIn(t,set)) continue;
      if(t.sp==='freeze'&&frozen.get(t)) continue;
      if((t.sp==='chain'||t.sp==='supply')&&m<t.chainN) continue;
      free.push(t);
    }
    if(!free.length) return null;
    free.sort((a,b)=>(b.layer-a.layer)||(RNG()-.5));
    const t=free[rnd(Math.max(1,Math.min(free.length,4)))];
    set.delete(t); order.push(t);
    for(const o of set) if(o.sp==='freeze'&&frozen.get(o)&&tileNb(o,t)) frozen.set(o,false);
  }
  return set.size?null:order;
}

function retimeBombs(rest,order,held,rainHeld){
  const tray=held.slice(), rainSlot=rainHeld.slice();
  const pos=new Map(); order.forEach((t,i)=>pos.set(t,i));
  const clearAt=new Map();
  for(let i=0;i<order.length;i++){
    const t=order[i];
    if(t.sp==='rain'){
      rainSlot.push(t);
      if(rainSlot.length>=3){ rainSlot.forEach(x=>clearAt.set(x,i)); rainSlot.length=0; }
      continue;
    }
    tray.push(t);
    const by={}; tray.forEach(x=>{ (by[x.type]=by[x.type]||[]).push(x); });
    let trio=null; for(const k in by) if(by[k].length>=3){ trio=by[k].slice(0,3); break; }
    if(trio) trio.forEach(x=>{ clearAt.set(x,i); tray.splice(tray.indexOf(x),1); });
  }
  let ok=true;
  rest.concat(held).forEach(t=>{
    if(t.sp!=='bomb') return;
    const c=clearAt.get(t);
    if(c===undefined){ ok=false; return; }
    const start=pos.has(t)?pos.get(t):-1;
    let ins=0;                                  /* 倒数按「之后有几张牌入槽」走，彩虹牌不入槽 */
    for(let i=start+1;i<=c;i++) if(order[i]&&order[i].sp!=='rain') ins++;
    t.bombK=ins+2;
    if(start<0) t.bombLeft=t.bombK;             /* 已在卡槽里的炸弹，倒数一并重置 */
  });
  return ok;
}

function verifyPlayable(rest,order,held,rainHeld){
  const set=new Set(rest), tray=held.slice(), rainSlot=rainHeld.slice();
  const frozen=new Map(), bomb=new Map();
  rest.forEach(t=>{ if(t.sp==='freeze'&&t.frozen) frozen.set(t,true); });
  tray.forEach(t=>{ if(t.sp==='bomb') bomb.set(t,t.bombLeft||t.bombK); });
  let m=G.matches;
  for(const t of order){
    if(!freeIn(t,set)) return false;
    if(t.sp==='freeze'&&frozen.get(t)) return false;
    if((t.sp==='chain'||t.sp==='supply')&&m<t.chainN) return false;
    set.delete(t);
    for(const o of set) if(o.sp==='freeze'&&frozen.get(o)&&tileNb(o,t)) frozen.set(o,false);
    if(t.sp==='rain'){ rainSlot.push(t); if(rainSlot.length>=3){ rainSlot.length=0; m++; } continue; }
    tray.push(t);
    if(t.sp==='bomb') bomb.set(t,t.bombK);
    let blew=false;
    bomb.forEach((v,k)=>{ if(k!==t&&tray.includes(k)){ bomb.set(k,v-1); if(v-1<=0) blew=true; } });
    const by={}; tray.forEach(x=>{ (by[x.type]=by[x.type]||[]).push(x); });
    let trio=null; for(const k in by) if(by[k].length>=3){ trio=by[k].slice(0,3); break; }
    if(trio){ trio.forEach(x=>{ tray.splice(tray.indexOf(x),1); bomb.delete(x); }); m++; }
    else if(blew) return false;
    if(tray.length>=SLOT_N) return false;
  }
  return set.size===0 && tray.length===0 && rainSlot.length===0;
}

function reshuffleSolvable(){
  const rest=G.tiles.filter(t=>!t.removed);
  if(rest.length<3) return 'empty';
  /* 用本局真正的配置。每日/周常/无尽的 G.lv 都是 1，
     直接 levelDef(G.lv) 会回落到第 1 关，把题面洗成幼儿园难度 */
  const cfg=G.rcfg||{types:levelDef(G.lv).cfg.types,d:levelDef(G.lv).cfg.d};
  const cap=Math.max(3,Math.min(SLOT_N-1,(cfg.d||3)-(toolLv('shuffle')-1)));
  const held=G.tray.filter(x=>!x.matching);
  const rainHeld=G.rain.filter(x=>!x.matching);
  const heldCount={};
  held.forEach(t=>heldCount[t.type]=(heldCount[t.type]||0)+1);

  const plain=rest.filter(t=>t.sp!=='rain');     /* 彩虹牌不参与花色配额 */
  const backup=rest.map(t=>t.type);
  const bombBackup=rest.concat(held).map(t=>[t,t.bombK,t.bombLeft]);

  let needTotal=0;
  for(const c in heldCount) needTotal+=3-heldCount[c];
  const triples=(plain.length-needTotal)/3;
  if(triples<0||triples%1!==0) return 'fail';

  for(let attempt=0;attempt<14;attempt++){
    const order=solveOrderLocked(rest,G.matches);
    if(!order) continue;
    const remain={};
    for(const c in heldCount) remain[c]=3-heldCount[c];
    const pool=planColors(cfg.types,triples);
    for(const c in pool) remain[c]=(remain[c]||0)+(+pool[c]);
    /* collect 目标：保证目标花色还留在盘面上，否则任务被无声废掉。
       搬运量必须是 3 的倍数，否则会破坏「每色总数是 3 的倍数」这条不变量 */
    const g=G.goal;
    if(g&&g.t==='collect'){
      const want=3*Math.max(1,g.need-g.got);
      if((remain[g.type]||0)<want){
        const donor=Object.keys(remain).map(Number)
          .filter(c=>c!==g.type).sort((a,b)=>remain[b]-remain[a])[0];
        if(donor!=null){
          let move=Math.min(want-(remain[g.type]||0),Math.max(0,(remain[donor]||0)-3));
          move=Math.floor(move/3)*3;
          if(move>0){ remain[donor]-=move; remain[g.type]=(remain[g.type]||0)+move; }
        }
      }
    }
    paintOrder(order,remain,heldCount,cap);
    if(!retimeBombs(rest,order,held,rainHeld)) continue;
    if(verifyPlayable(rest,order,held,rainHeld)) return 'ok';
  }
  rest.forEach((t,i)=>{ t.type=backup[i]; });   /* 洗不出可解局面，原样还回去 */
  bombBackup.forEach(([t,k,l])=>{ t.bombK=k; t.bombLeft=l; });
  return 'fail';
}

const SAYINGS=[
  '风把云吹散了，剩下的时间，都用来陪你喜欢的羊吧。',
  '慢一点也没关系，草原上的路从来不催人。',
  '今天的第一缕阳光，已经替你晒暖了牧场。',
  '把烦恼交给风，把青草留给羊。',
  '走得远不如走得稳，羊群会一直等你。'
];

const CK_COIN=[20,25,30,40,50,60,100];

const PRICE={shuffle:120,undo:80,out:200};

const HELP_BASE=[
  ['fa-layer-group','怎么算赢','点击盘面上没被压住的牌，它会飞进下方卡槽；卡槽里凑齐 3 张同花色自动消除。把盘面、卡槽、彩虹槽全部清空就算过关。'],
  ['fa-table-columns','卡槽只有 7 格','卡槽塞满且没有任何三连时判负。这是唯一的失败方式（限时与限步关卡另算）。周常变体会把格子改成 5 格或 9 格。'],
  ['fa-box-open','底部牌堆','盘面下方的牌堆只能取最前面一张；少数关卡的牌堆是双向的，两端都能取。'],
  ['fa-clover','必定有解','每一局都是先算出一条合法的通关顺序，再沿着它铺花色和特殊牌 —— 有解是构造出来的，不是碰运气。卡在死局只会是取牌顺序的问题，失败页可以直接看参考解法回放。']
];

const HELP_MODES=[
  /* 章节数按 CHAPTERS.length 说：50 关 ÷ CH_SIZE(10) = 5 章，原来写的「四个章节」
     与 CHAPTERS 里实际的五个章节对不上。宝箱关 isBonus 排除了前 12 关，第一章没有 */
  ['fa-map','闯关','50 关，五个章节。每章第 10 关是 BOSS 关；第二章起每章第 5 关是宝箱关，金币翻倍、必掉图鉴。'],
  ['fa-calendar-day','每日挑战','全服同一套题面，每天换一次。因为同题，成绩才有可比性。'],
  ['fa-calendar-week','周常挑战','每周一换一套变体规则（窄槽、迷雾、爆破等），同一周内全服相同。'],
  ['fa-infinity','无尽草原','一波清完接下一波，每波更难，中途可选增益。比的是累计消除组数。']
];

const SHEEP=[
  {id:'hat',   n:'草帽羊',   r:1, p:{t:'coin',v:3},   c:['#2E6B3E','#FFFFFF','#FBFDF7','#F6C445','#D3E8C6'], s:'第一只跟着你出门的羊，草帽是它自己叼来的。'},
  {id:'moss',  n:'苔藓羊',   r:1, p:{t:'wool',v:3},   c:['#3D6B4A','#EFF6EC','#F8FCF6','#A8C98F','#CFE3C6'], s:'喜欢在背阴的石头上打盹，毛里总有青苔味。'},
  {id:'cloud', n:'云朵羊',   r:1, p:{t:'coin',v:3},   c:['#5A7A8C','#FBFDFF','#FFFFFF','#BBD5E4','#D8E7F0'], s:'走路很轻，远看像一朵挪动的云。'},
  {id:'wheat', n:'麦穗羊',   r:1, p:{t:'wool',v:3},   c:['#8A6B2A','#FFF9E8','#FFFDF4','#E8C878','#EDE0BE'], s:'秋天最忙，据说能背回半亩地的麦穗。'},
  {id:'mint',  n:'薄荷羊',   r:1, p:{t:'coin',v:4},   c:['#3E8574','#F0FBF7','#F8FEFC','#9FD9C6','#CEEDE3'], s:'路过的地方都会留下一股清凉气。'},
  {id:'clay',  n:'陶土羊',   r:1, p:{t:'wool',v:4},   c:['#8A5A3E','#FFF3EA','#FFFAF5','#DBA07A','#EBD3C2'], s:'在河滩长大，蹄子上永远沾着泥。'},
  {id:'dew',   n:'露珠羊',   r:1, p:{t:'coin',v:4},   c:['#3C7E93','#F0FAFD','#F9FDFF','#9AD2E4','#CDE9F2'], s:'天没亮就出门，只为舔到最新鲜的那滴露水。'},
  {id:'straw', n:'干草羊',   r:1, p:{t:'wool',v:4},   c:['#9A7B36','#FFFBEE','#FFFDF7','#E0C489','#EEE2C4'], s:'冬天的粮仓管理员，睡觉也抱着草垛。'},
  {id:'fern',  n:'蕨叶羊',   r:1, p:{t:'coin',v:4},   c:['#2F6B4E','#EEF8F1','#F7FCF9','#8CC9A4','#C9E6D5'], s:'认得林子里每一株蕨，从不迷路。'},
  {id:'stone', n:'碎石羊',   r:1, p:{t:'wool',v:4},   c:['#5E6670','#F5F6F8','#FBFBFC','#B6BEC8','#DCE0E6'], s:'沉默寡言，撞过的石头比走过的路多。'},
  {id:'peach', n:'蜜桃羊',   r:1, p:{t:'coin',v:5},   c:['#A85A5A','#FFF2F2','#FFF9F9','#F0A9A9','#F3D6D6'], s:'夏天会偷偷去果园，回来时脸是红的。'},
  {id:'lilac', n:'紫丁羊',   r:1, p:{t:'wool',v:5},   c:['#6E5A96','#F7F2FD','#FCFAFF','#C0A8E0','#DED2F0'], s:'黄昏时最好看，毛尖泛着淡淡的紫。'},
  {id:'olive', n:'橄榄羊',   r:1, p:{t:'coin',v:5},   c:['#6B7B36','#F7FAEC','#FCFDF6','#BCCB84','#DDE6C2'], s:'不挑食，据说吃过牧场里所有能吃的东西。'},
  {id:'coral', n:'珊瑚羊',   r:1, p:{t:'wool',v:5},   c:['#B06248','#FFF4F0','#FFFAF8','#F0AE94','#F5D9CE'], s:'从很远的海边走来，还记得潮水的声音。'},

  {id:'scarf', n:'围巾羊',   r:2, p:{t:'combo',v:600},  c:['#2F6C8F','#F4FAFE','#FBFDFF','#EE9A87','#CDE4F2'], s:'围巾是牧羊人织的，它一年四季都不肯摘。'},
  {id:'snow',  n:'初雪羊',   r:2, p:{t:'combo',v:600},  c:['#5C7A96','#FFFFFF','#FBFDFF','#B9D4E8','#DCEAF4'], s:'落雪那天出生，从此不怕冷。'},
  {id:'amber', n:'琥珀羊',   r:2, p:{t:'coin',v:7},     c:['#9A6516','#FFF6E4','#FFFCF2','#E8B34C','#F0DDB0'], s:'毛色像凝固的阳光，靠近会觉得暖。'},
  {id:'ivy',   n:'常春羊',   r:2, p:{t:'wool',v:7},     c:['#2C6A3C','#EDF7EE','#F7FCF8','#82C08E','#C4E2CA'], s:'爬过最高的墙，也蹭掉过最多的毛。'},
  {id:'thaw',  n:'暖阳羊',   r:2, p:{t:'thaw',v:2},     c:['#B07A1E','#FFF8E6','#FFFDF4','#F2C55C','#F2E3B8'], s:'走到哪儿，哪儿的冰就化了。'},
  {id:'peek',  n:'千里羊',   r:2, p:{t:'peek',v:2},     c:['#456B9A','#F2F7FE','#FAFCFF','#A8C3E8','#D3E1F5'], s:'站在坡顶能看清三里外的草，眼神好得离谱。'},
  {id:'lucky', n:'四叶羊',   r:2, p:{t:'drop',v:30},    c:['#3A8A50','#EFFAF1','#F8FDF9','#8FD3A2','#C8EAD2'], s:'总能踩到四叶草，连它自己都觉得奇怪。'},

  {id:'star',  n:'星月羊',   r:3, p:{t:'luck',v:1},     c:['#4B3A78','#F5F1FD','#FCFAFF','#C9A6F0','#DED4F2'], s:'夜里会抬头很久，像在等谁。'},
  {id:'aurora',n:'极光羊',   r:3, p:{t:'coin',v:10},    c:['#2F7A86','#EEFBFB','#F8FEFE','#7ED8D8','#C2ECEC'], s:'极夜里见过天上的光，回来后毛就变了颜色。'},
  {id:'golden',n:'鎏金羊',   r:3, p:{t:'wool',v:10},    c:['#8A6A12','#FFFAE6','#FFFDF3','#F2CE55','#F0E2B4'], s:'传说中被阳光亲吻过的羊，很少有人真的见过。'}
];

const RARITY=['','普通','稀有','传说'];

const PASSIVE_TXT={
  coin:v=>'金币产出 +'+v+'%',
  wool:v=>'羊毛产出 +'+v+'%',
  combo:v=>'连击窗口 +'+(v/1000).toFixed(1)+' 秒',
  thaw:v=>'开局自动解冻 '+v+' 张冰冻牌',
  peek:v=>'开局自动翻开 '+v+' 张谜之牌',
  drop:v=>'图鉴掉落率 +'+v+'%',
  luck:v=>'通关必定掉落一只羊'
};

const SHARD_NEED=[0,3,8];

const SHARD_MAX=8;

const PITY_N=12;

const EXCHANGE={1:6, 2:12, 3:25};

const FARM=[
  {id:'grass', n:'青草地', ico:'fa-seedling', max:5, cost:l=>60+l*40,  desc:l=>'金币产出 +'+(l*2)+'%'},
  {id:'mill',  n:'风车',   ico:'fa-fan',       max:5, cost:l=>80+l*50,  desc:l=>'羊毛产出 +'+(l*2)+'%'},
  {id:'fence', n:'围栏',   ico:'fa-border-all',max:5, cost:l=>70+l*45,  desc:l=>'商店道具便宜 '+(l*3)+'%'},
  {id:'pen',   n:'羊圈',   ico:'fa-house-chimney', max:5, cost:l=>90+l*60, desc:l=>'图鉴掉落率 +'+(l*4)+'%'}
];

const TOOL_UP={
  shuffle:{n:'洗牌',ico:'fa-shuffle',   cost:[0,120,260], desc:['有解洗牌','有解洗牌 · 局面更宽松','有解洗牌 · 洗成最宽松局面']},
  undo:   {n:'撤回',ico:'fa-rotate-left',cost:[0,100,220], desc:['撤回 1 步','连续撤回 2 步','连续撤回 3 步']},
  out:    {n:'移出',ico:'fa-arrow-right-from-bracket',cost:[0,140,300], desc:['移出 3 张','移出 4 张','移出 5 张']}
};

const ACH=[
  ['first','初次放羊','通关第 1 关',s=>s.cleared>=1,20],
  ['c5','小有所成','累计通关 5 关',s=>s.cleared>=5,20],
  ['c15','熟能生巧','累计通关 15 关',s=>s.cleared>=15,30],
  ['c40','牧场老手','累计通关 40 关',s=>s.cleared>=40,50],
  ['c80','草原传说','累计通关 80 关',s=>s.cleared>=80,80],
  ['lv5','越走越远','解锁到第 5 关',s=>s.level>=5,20],
  ['lv12','出了新手村','解锁到第 12 关',s=>s.level>=12,30],
  ['lv21','翻过雪线','解锁到第 21 关',s=>s.level>=21,50],
  ['lv31','走到星夜','解锁到第 31 关',s=>s.level>=31,80],
  ['st10','攒星星','累计 10 颗星',s=>starTotal()>=10,20],
  ['st30','三十而立','累计 30 颗星',s=>starTotal()>=30,40],
  ['st60','星光满地','累计 60 颗星',s=>starTotal()>=60,70],
  ['st99','星河灿烂','累计 99 颗星',s=>starTotal()>=99,120],
  ['perfect','一尘不染','有 1 关拿到三星',s=>Object.values(s.stars||{}).some(v=>v>=3),25],
  ['perfect5','五星连珠','有 5 关拿到三星',s=>Object.values(s.stars||{}).filter(v=>v>=3).length>=5,45],
  ['perfect15','完美主义','有 15 关拿到三星',s=>Object.values(s.stars||{}).filter(v=>v>=3).length>=15,90],
  ['combo5','小连击','单局连击达到 5',s=>(s.st.bestCombo||0)>=5,20],
  ['combo10','连击好手','单局连击达到 10',s=>(s.st.bestCombo||0)>=10,35],
  ['combo20','连击大师','单局连击达到 20',s=>(s.st.bestCombo||0)>=20,70],
  ['m100','消了一百组','累计消除 100 组',s=>(s.st.matches||0)>=100,20],
  ['m500','消了五百组','累计消除 500 组',s=>(s.st.matches||0)>=500,40],
  ['m2000','消除机器','累计消除 2000 组',s=>(s.st.matches||0)>=2000,90],
  ['boss1','初见 Boss','通关 1 个 Boss 关',s=>(s.st.boss||0)>=1,40],
  ['boss3','Boss 克星','通关 3 个 Boss 关',s=>(s.st.boss||0)>=3,80],
  ['notool','徒手过关','不用任何道具通关 1 次',s=>(s.st.noTool||0)>=1,25],
  ['notool10','老手风范','不用道具通关 10 次',s=>(s.st.noTool||0)>=10,60],
  ['daily1','今日打卡','完成 1 次每日挑战',s=>(s.st.daily||0)>=1,25],
  ['daily7','坚持一周','完成 7 次每日挑战',s=>(s.st.daily||0)>=7,70],
  ['endless20','无尽入门','无尽模式消 20 组',s=>(s.endless||0)>=20,25],
  ['endless60','无尽好手','无尽模式消 60 组',s=>(s.endless||0)>=60,60],
  ['dex5','小小收藏家','收集 5 只羊',s=>Object.keys(s.dex||{}).length>=5,30],
  ['dex12','半个图鉴','收集 12 只羊',s=>Object.keys(s.dex||{}).length>=12,60],
  ['dex24','图鉴全满','收集全部 24 只羊',s=>Object.keys(s.dex||{}).length>=24,150],
  ['sr','传说降临','收集到 1 只传说羊',s=>Object.keys(s.dex||{}).some(id=>SHEEP_BY[id]&&SHEEP_BY[id].r===3),80],
  ['farm5','初具规模','牧场建设累计 5 级',s=>Object.values(s.farm||{}).reduce((a,b)=>a+b,0)>=5,40],
  ['farm20','牧场主','牧场全部建满',s=>Object.values(s.farm||{}).reduce((a,b)=>a+b,0)>=20,120]
];

const TITLES=[
  ['',        '牧羊新手',   ()=>true],
  ['c15',     '熟练牧人',   null],
  ['c40',     '牧场老手',   null],
  ['c80',     '草原传说',   null],
  ['perfect15','完美主义者', null],
  ['combo20', '连击大师',   null],
  ['boss3',   'Boss 克星',  null],
  ['daily7',  '风雨无阻',   null],
  ['dex24',   '图鉴收藏家', null],
  ['sr',      '传说饲主',   null],
  ['farm20',  '牧场主',     null],
  ['st99',    '星河灿烂',   null]
];

const TASKS=[
  {id:'match', stat:'matches', goals:[20,30,45], txt:g=>'累计消除 '+g+' 组',      coin:70,  wool:14},
  {id:'clear', stat:'clears',  goals:[1,2,3],    txt:g=>'通关 '+g+' 关',           coin:90,  wool:18},
  {id:'combo', stat:'combo',   goals:[4,5,6],    txt:g=>'单局达成 '+g+' 连击',     coin:80,  wool:16, max:true},
  {id:'play',  stat:'plays',   goals:[3,5,7],    txt:g=>'开局 '+g+' 次',           coin:55,  wool:11},
  {id:'spec',  stat:'spec',    goals:[6,10,15],  txt:g=>'消掉 '+g+' 张特殊牌',     coin:85,  wool:17},
  {id:'daily', stat:'dailyRun',goals:[1],        txt:()=>'完成一次每日挑战',        coin:110, wool:22}
];

const BUFFS=[
  {id:'slot',  ico:'fa-table-columns', n:'多一格卡槽', d:'接下来每一波都多一个格子，效果会叠加'},
  {id:'color', ico:'fa-palette',       n:'少一种花色', d:'下一波开始花色少一种，配对更容易'},
  {id:'small', ico:'fa-compress',      n:'盘面缩小',   d:'下一波少 12 张牌，跑得更快'},
  {id:'tool',  ico:'fa-toolbox',       n:'补给两件',   d:'立刻获得 2 个随机道具'},
  {id:'combo', ico:'fa-fire',          n:'连击更宽松', d:'连击窗口延长 1.5 秒，更容易连起来'}
];

var CORE = {
  G: G,
  SLOT_N: SLOT_N,
  BASE_SLOT: BASE_SLOT,
  GRID: GRID,
  TYPE_DEFS: TYPE_DEFS,
  CH_SIZE: CH_SIZE,
  CHAPTERS: CHAPTERS,
  SHAPES: SHAPES,
  GOALS: GOALS,
  SPECIALS: SPECIALS,
  REWARD_SP: REWARD_SP,
  LEVELS: LEVELS,
  MAX_LEVEL: MAX_LEVEL,
  WEEKLY: WEEKLY,
  COMBO_WINDOW: COMBO_WINDOW,
  BUFFS: BUFFS,
  mulberry32: mulberry32,
  seedRNG: seedRNG,
  rnd: rnd,
  shuffle: shuffle,
  chapterIdx: chapterIdx,
  chapterOf: chapterOf,
  chapterTitle: chapterTitle,
  levelName: levelName,
  isBoss: isBoss,
  isBonus: isBonus,
  shapeOf: shapeOf,
  rawLevelDef: rawLevelDef,
  levelDef: levelDef,
  goalOf: goalOf,
  makeGoal: makeGoal,
  mkTile: mkTile,
  overlap: overlap,
  freeIn: freeIn,
  tileNb: tileNb,
  neighbors: neighbors,
  planColors: planColors,
  spMix: spMix,
  waveLevel: waveLevel,
  solveOrder: solveOrder,
  solveOrderLocked: solveOrderLocked,
  canonicalStats: canonicalStats,
  genLevel: genLevel,
  makeCode: makeCode,
  parseCode: parseCode,
  weekIndex: weekIndex,
  weeklyMod: weeklyMod,
  dailySeed: dailySeed,
  reshuffleSolvable: reshuffleSolvable,
  paintOrder: paintOrder,
  applySpecials: applySpecials,
  SHEEP: SHEEP,
  RARITY: RARITY,
  PASSIVE_TXT: PASSIVE_TXT,
  SHARD_NEED: SHARD_NEED,
  SHARD_MAX: SHARD_MAX,
  PITY_N: PITY_N,
  EXCHANGE: EXCHANGE,
  TOOL_UP: TOOL_UP,
  PRICE: PRICE,
  TOOL_KEYS: TOOL_KEYS,
  FARM: FARM,
  ACH: ACH,
  TITLES: TITLES,
  CK_COIN: CK_COIN,
  TASKS: TASKS,
  HELP_BASE: HELP_BASE,
  HELP_MODES: HELP_MODES,
  SAYINGS: SAYINGS
};
if (typeof module !== 'undefined' && module.exports) module.exports = CORE;
else if (typeof globalThis !== 'undefined') globalThis.CORE = CORE;
