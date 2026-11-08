// БОНУСЫ ПРЕДМЕТОВ БАЗЫ (STORY_BIBLE §8). Предмет из узла «ТИШИНЫ» — усилитель несущей: маленький постоянный бонус.
// Виды: xAll/mAll — % ко всему XP/$; x/m — % к XP/$ одного класса статуса; fast — +секунды к окну серии быстрых статусов;
// first10 — % XP за первые 10 звонков дня; night — % XP, когда у лида после 16:00 (кусок 28: по часам лида, не ноутбука). Бонусы к наградам складываются без потолка; ограничения времени нужны только для окна серии и Overdrive.
// Цифры — черновик до общего пересмотра баланса (Q24).
// v2 (кусок 18): сила растёт от района к району — средний предмет района d ≈ 1,25·1,16^(d−1) «процента дохода»
// (дешёвый ×0,7, средний ×1, редкий ×1,15, showpiece ×1,45, ±8%). Бонус к одному статусу пересчитан по доле статуса в доходе,
// секунды окна — ×1,6. Новые виды: hh — % XP и $ в счастливые часы, odSec — секунды Overdrive.
export const CAP={fast:35,hh:30,odSec:60};
export const ITEM_BUFF={
 d1t0:{first10:4},d1t1:{xAll:1},d1t2:{fast:3},
 d2t0:{x:{GATEKEEPER:4}},d2t2:{x:{TALK:6}},
 d3t0:{m:{BOOKED:3}},d3t1:{fast:3},d3t2:{mAll:2},
 d4t0:{fast:2},d4t1:{night:5},d2t1:{xAll:2},d4t2:{x:{TRASH:9}},
 d5t0:{mAll:2},d5t1:{m:{DISCOVERY:9}},d5t2:{x:{BOOKED:6}},
 d6t0:{mAll:2},d6t1:{m:{CALLBACK:12}},
 d7t0:{xAll:2},d6t2:{xAll:3},d7t1:{x:{CALLBACK:14}},d7t2:{x:{GATEKEEPER:15}},
 d8t0:{mAll:3},d8t1:{m:{BOOKED:7}},d8t2:{fast:8},
 d9t0:{fast:5},d9t1:{x:{TALK:11}},n9:{hh:12},d9t2:{xAll:6},
 d10t0:{xAll:3},d10t1:{fast:7},d10t2:{mAll:7},
 d11t0:{mAll:4},d11t1:{xAll:6},d11t2:{x:{BOOKED:15}},
 d12t0:{xAll:2,mAll:2},n12:{odSec:35},d12t1:{mAll:6},d12t2:{xAll:9}};
// «сила» предмета в процентах дохода — для проверки, что предметы растут от района к району
const CF={TRASH:3,GATEKEEPER:3.5,TALK:2.5,CALLBACK:4,BOOKED:2,DISCOVERY:4};
export function power(id){const b=ITEM_BUFF[id]||{};let p=(b.xAll||0)+(b.mAll||0)+(b.first10||0)/4+(b.night||0)/2.5+(b.fast||0)/1.6+(b.hh||0)/3+(b.odSec||0)/5;
 for(const[k,v]of Object.entries({...(b.x||{})}))p+=v/(CF[k]||3);for(const[k,v]of Object.entries(b.m||{}))p+=v/(CF[k]||3);return p}
// бонус счастливых часов от предметов (применяется в core/addict.js withAd, где известно, идёт ли счастливый час)
export const itemHH=owned=>Math.min(CAP.hh,Object.keys(owned||{}).reduce((s,id)=>s+((owned[id]&&ITEM_BUFF[id]&&ITEM_BUFF[id].hh)||0),0));
const CLS_RU={TRASH:'«мимо»',GATEKEEPER:'гейткиперов',MINOR:'мелких',TALK:'разговоров',CALLBACK:'перезвонов',BOOKED:'встреч',DISCOVERY:'DISCOVERY'};
// подпись для карточки рынка
export function buffText(id){const b=ITEM_BUFF[id];if(!b)return'';const o=[];
 if(b.xAll)o.push(`+${b.xAll}% XP ко всем звонкам`);if(b.mAll)o.push(`+${b.mAll}% $ ко всем звонкам`);
 for(const[k,v]of Object.entries(b.x||{}))o.push(`+${v}% XP за ${CLS_RU[k]||k}`);for(const[k,v]of Object.entries(b.m||{}))o.push(`+${v}% $ за ${CLS_RU[k]||k}`);
 if(b.fast)o.push(`+${b.fast} с к окну серии`);if(b.hh)o.push(`+${b.hh}% XP и $ в счастливые часы`);if(b.odSec)o.push(`Overdrive +${b.odSec} с`);if(b.first10)o.push(`+${b.first10}% XP за первые 10 звонков дня`);if(b.night)o.push(`+${b.night}% XP, когда у лида после 16:00`);return o.join(' · ')}
// сумма бонусов купленного (owned — meta.owned); n — звонков сегодня до этого статуса; hour — местный час
export function itemTotals(owned,n=99,hour=12){const t={xAll:0,mAll:0,x:{},m:{},fast:0,odSec:0};
 for(const id in owned||{}){const b=ITEM_BUFF[id];if(!owned[id]||!b)continue;
  t.xAll+=(b.xAll||0)+(b.first10&&n<10?b.first10:0)+(b.night&&hour>=16?b.night:0);t.mAll+=b.mAll||0;t.fast+=b.fast||0;t.odSec+=b.odSec||0;
  for(const[k,v]of Object.entries(b.x||{}))t.x[k]=(t.x[k]||0)+v;for(const[k,v]of Object.entries(b.m||{}))t.m[k]=(t.m[k]||0)+v}
 t.fast=Math.min(CAP.fast,t.fast);t.odSec=Math.min(CAP.odSec,t.odSec);return t}
// сливает бонусы предметов в модификаторы директивы дня (missions.modsFor): множители перемножаются, секунды складываются
export function withItems(mods,owned,n,hour){const t=itemTotals(owned,n,hour),r={m:{...(mods.m||{})},x:{...(mods.x||{})},mAll:(mods.mAll||1)*(1+t.mAll/100),xAll:(mods.xAll||1)*(1+t.xAll/100),fast:(mods.fast||0)+t.fast,odSec:(mods.odSec||0)+t.odSec};
 for(const k in t.x)r.x[k]=(r.x[k]||1)*(1+t.x[k]/100);for(const k in t.m)r.m[k]=(r.m[k]||1)*(1+t.m[k]/100);return r}
export function runBuffTests(ids,DIST_OF=()=>0){const o=[],t=(n,f)=>{try{o.push([n,!!f()])}catch(e){o.push([n+' ('+e.message+')',false])}};
 t('бонус у каждого из 38 предметов и подпись',()=>ids.length===38&&ids.every(id=>ITEM_BUFF[id]&&buffText(id).length>5));
 t('бонусы: лампа только первые 10 звонков, все предметы дают полный XP',()=>itemTotals({d1t0:1},3).xAll===4&&itemTotals({d1t0:1},12).xAll===0&&itemTotals(Object.fromEntries(ids.map(i=>[i,1])),3,20).xAll===43);
 t('сила предметов растёт: средняя по району выше прошлого, без скачка больше ×1,5',()=>{const av=[];for(let d=1;d<=12;d++){const L=ids.filter(id=>DIST_OF(id)===d);av.push(L.reduce((a,id)=>a+power(id),0)/L.length)}return av.every((v,i)=>!i||(v>av[i-1]&&v<av[i-1]*1.5))});
 t('бонусы сливаются с директивой',()=>{const r=withItems({m:{TALK:1.4},mAll:1,fast:15},{d3t2:1,d1t2:1,d2t2:1,n12:1});return Math.abs(r.mAll-1.02)<1e-9&&r.fast===18&&Math.abs(r.x.TALK-1.06)<1e-9&&r.m.TALK===1.4&&r.odSec===35});
 return o}
