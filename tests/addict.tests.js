// Тесты Addiction update (кусок 14+): трофеи, директива, лут, гарант, счастливые часы, заморозка, распад, рейд, дерево.
import {Session,makeCombo,cleanTrophies} from '../core/session.js';
import {ZoomProvider,ManualProvider} from '../core/providers.js';
import {EventBus as Bus} from '../core/eventbus.js';
import * as A from '../core/addict.js';
import * as AL from '../core/allies.js';
import * as K from '../core/keys.js';
import {buy,SHOP_ITEMS} from '../core/meta.js';
import {newState,pause as eP,resume as eR,windowState} from '../core/engine.js';
export const T=[];export const t=(n,f)=>{try{T.push([n,!!f()])}catch(e){T.push([n+' ('+e.message+')',false])}};
export const mkS=(now,root0={})=>{const clock={t:now};const root=Object.assign({days:{},trophies:[],life:null},root0);const bus=new Bus(),zp=new ZoomProvider(bus,()=>clock.t),mp=new ManualProvider(bus,()=>clock.t);
 const s=new Session({root,bus,prov:makeCombo(zp,mp),now:()=>clock.t});return{s,root,clock,zp,bus}};
export const zc=(o,lead,dur)=>{const id='z'+o.clock.t,iso=ms=>new Date(ms).toISOString(),e=(type,ms,x={})=>({type,data:{callId:id,dateTime:iso(ms),direction:'outbound',callee:{phoneNumber:lead.phone},...x}});
 const st=o.clock.t-(dur+15)*1000;o.zp.feed(e('zp-call-ringing-event',st));o.zp.feed(e('zp-call-ended-event',st+(dur+10)*1000));o.zp.feed(e('zp-call-log-completed-event',st+(dur+11)*1000,{callResult:'connected',duration:dur}))};
export const N0=Date.UTC(2026,10,2,16,0,0),L=n=>({key:'50100000'+String(10+n),phone:'+1501000'+String(1000+n),business:'Biz'+n,state:'AR'});
export function runAddictTests(){T.length=0;
 t('трофей: Owner hung up / pitched / Call back — никогда',()=>{const o=mkS(N0);for(const [i,id] of [2,3,12,13,2].entries()){o.clock.t+=70000;zc(o,L(i),400);o.s.setStatus(id,L(i),{now:o.clock.t})}return o.root.trophies.length===0});
 t('трофей: CALL BOOKED и DISCOVERY дают, со статусом в записи',()=>{const o=mkS(N0);o.clock.t+=70000;zc(o,L(1),400);const a=o.s.setStatus(4,L(1),{now:o.clock.t});o.clock.t+=70000;zc(o,L(2),400);const b=o.s.setStatus(14,L(2),{now:o.clock.t});
  return a.trophy&&b.trophy&&o.root.trophies.length===2&&a.trophy.st==='CALL BOOKED'&&b.trophy.kind==='platinum'});
 t('трофей: BOOKED без данных Zoom (не проверен) — нет',()=>{const o=mkS(N0);o.clock.t+=70000;const a=o.s.setStatus(4,L(1),{now:o.clock.t});return !a.trophy&&o.root.trophies.length===0});
 t('чистка: трофей с не победным статусом в журнале удаляется',()=>{const G={undo:[{lead:'a',t:5,id:2},{lead:'b',t:6,id:4}]},root={trophies:[{lead:'a',t:5,kind:'gold'},{lead:'b',t:6,kind:'gold'},{lead:'c',t:7,kind:'gold'}]};return cleanTrophies(root,G)===1&&root.trophies.length===2&&!root.trophies.some(x=>x.lead==='a')});
 const G0=()=>{const G=newState(N0);G.money=1000;G.dxp=500;return G};
 t('withAd: каждый связист повышает XP и деньги даже сверх прежнего потолка',()=>{const root={};A.ensure(root).tree={};root.ad.ops.n=200;const r=A.withAd({xAll:1,mAll:1},root,N0,'ZZ');root.ad.ops.n++;const next=A.withAd({xAll:1,mAll:1},root,N0,'ZZ');return r.xAll>1.8&&r.mAll>1.8&&next.xAll>r.xAll&&next.mAll>r.mAll&&!r.hh});
 t('счастливый час (J14): 8:00 по Арканзасу ×2, 9:00 ×1.5, 16:00 ×1.5, 12:00 и 18:30 нет, суббота нет',()=>{const at=(h,m,d=3)=>Date.UTC(2026,10,d,h+6,m);const k=x=>(A.happy('AR',x)||{k:0}).k;return k(at(8,0))===2&&k(at(9,0))===1.5&&k(at(16,0))===1.5&&k(at(12,0))===0&&k(at(18,30))===0&&k(at(7,20))===0&&!A.happy('AR',at(8,0,7))});
 t('рулетка: rnd=0 на TRASH даёт предмет, на BOOKED нет',()=>{const root={},G=G0();const a=A.adAfter(root,G,{cls:'TRASH',m:0},N0,{dayN:1,rnd:()=>0});const b=A.adAfter(root,G,{cls:'BOOKED',m:0},N0+1,{dayN:2,rnd:()=>0});return a.spin&&!a.spin.chest&&!b.spin});
 t('гарант: после порога неудач — сундук эпик+',()=>{const root={},G=G0();let got=null;for(let i=0;i<80&&!got;i++){const o=A.adAfter(root,G,{cls:'TRASH',m:0},N0+i,{dayN:i+1,rnd:()=>.99});if(o.spin&&o.spin.chest)got=o.spin}return got&&(got.tier==='e'||got.tier==='l')});
 t('заморозка: заряд за 25 наборов, снятие сдвигает дедлайн рейда',()=>{const root={},G=G0();A.adAfter(root,G,{cls:'TRASH',m:0},N0,{dayN:25,rnd:()=>.99});const a=root.ad;if(a.frz.ch!==1)return false;A.raidStart(root,N0);const dl=a.raid.dl;A.freezeOn(root,N0);A.freezeOff(root,N0+60000);return a.frz.ch===0&&a.raid.dl===dl+60000});
 t('разгон: без «Принять» награды нет',()=>{const root={},G=G0();return !A.adAfter(root,G,{cls:'TRASH',m:0},N0,{dayN:5,rnd:()=>.99}).warm});
 t('разгон: вызов раз в день, тестировщику — всегда',()=>{const root={};const a=A.warmOffer(root,N0,0);A.warmAnswer(root,N0,false);return a&&!A.warmOffer(root,N0+1,0)&&A.warmOffer(root,N0+1,0,true)&&!A.warmOffer({},N0,3)&&A.warmOffer(root,N0+864e5,0)});
 t('разгон: ×3 на первые 5 наборов, кроме BOOKED/DISCOVERY',()=>{const root={};A.warmAnswer(root,N0,true);const r=A.withAd({},root,N0,'',2),r5=A.withAd({},root,N0,'',5);return r.x.TRASH===3&&r.m.TALK===3&&!r.x.BOOKED&&!r.m.DISCOVERY&&!(r5.x.TRASH>1)});
 t('разгон: 5 наборов дают деньги один раз',()=>{const root={},G=G0();A.warmAnswer(root,N0,true);const o=A.adAfter(root,G,{cls:'TRASH',m:0},N0,{dayN:5,rnd:()=>.99});const o2=A.adAfter(root,G,{cls:'TRASH',m:0},N0+1,{dayN:6,rnd:()=>.99});return o.warm&&o.warm.money>0&&!o2.warm});
 t('рейд: деньги уходят в буфер, на 100 — вывод ×1.5',()=>{const root={},G=G0();A.ensure(root).pity.at=9999;A.raidStart(root,N0);let m=G.money,last;for(let i=0;i<100;i++){G.money+=10;last=A.adAfter(root,G,{cls:'TRASH',m:10},N0+i*1000,{dayN:0,rnd:()=>.99})}return last.raid&&last.raid.extracted===1500&&G.money===m+1500&&!root.ad.raid});
 t('рейд: просрочка — буфер сгорает',()=>{const root={},G=G0();A.raidStart(root,N0);G.money+=50;A.adAfter(root,G,{cls:'TRASH',m:50},N0,{dayN:1,rnd:()=>.99});const r=A.raidCheck(root,G,N0+999999);return r&&r.burned===50&&G.money===1000});
 t('Ночная чистка: первый запуск не наказывает; прогноз равен списанию',()=>{const root={days:{}},G=G0();A.nightly(root,G,N0);const d1=N0+864e5;root.days[A.dayKeyOf?A.dayKeyOf(N0):Object.keys(root.days)[0]||'x']=0;
   const k=new Date(N0);const key=k.getFullYear()+'-'+String(k.getMonth()+1).padStart(2,'0')+'-'+String(k.getDate()).padStart(2,'0');root.days={};root.days[key]={n:40};root.ad.purge.chk=A.dk(N0-864e5);
   const predicted=A.purgePreview(root,G,N0,40);const out=A.nightly(root,G,d1);const x=out.find(z=>z.k===key);return x&&x.dx===predicted.dx&&G.dxp===500-x.dx&&x.dx===500});
 t('Ночная чистка: щит отменяет',()=>{const root={days:{}},G=G0();A.ensure(root).purge.chk=A.dk(N0-864e5);root.ad.shield=1;const k=new Date(N0);const key=k.getFullYear()+'-'+String(k.getMonth()+1).padStart(2,'0')+'-'+String(k.getDate()).padStart(2,'0');root.days[key]={n:3};
   const out=A.nightly(root,G,N0+864e5);return out[0]&&out[0].shield&&G.dxp===500&&root.ad.shield===0});
 t('дерево: покупка за Сигнал, цена растёт',()=>{const root={};A.ensure(root).sig=1000;const id=A.TREE[0].id;const a=A.buyTree(root,id),b=A.buyTree(root,id);return a.ok&&b.ok&&b.cost>a.cost&&root.ad.tree[id]===2});
 t('перк: каждые 50 — 3 варианта, выбор на час',()=>{const root={},G=G0();const o=A.adAfter(root,G,{cls:'TRASH',m:0},N0,{dayN:50,rnd:()=>.5});if(!o.perk||o.perk.length!==3)return false;const r=A.pickPerk(root,o.perk[0],N0);return r.ok&&root.ad.perk.until===N0+3600000});
 t('бусты: максимум 3 активных, заряд тратится',()=>{const root={},G=G0();for(let i=0;i<4;i++)A.grant(root,G,'tape');[1,2,3,4].forEach(()=>A.activate(root,'tape'));const a=root.ad;const n=a.act.length;A.adAfter(root,G,{cls:'TRASH',m:0},N0,{dayN:1,rnd:()=>.99});return n===3&&a.act[0].left===14&&a.inv.tape===1});
 t('Session: статус даёт Сигнал, undo его снимает',()=>{const o=mkS(N0);o.clock.t+=70000;zc(o,L(1),30);const r=o.s.setStatus(2,L(1),{now:o.clock.t});const s1=o.root.ad.sig;o.clock.t+=600000;o.s.dropLead(L(1).key,o.clock.t);return r.ad&&s1>0&&o.root.ad.sig===0});
 t('Session: рейд + worth-undo возвращает деньги в кошелёк',()=>{const o=mkS(N0);A.raidStart(o.root,N0);o.clock.t+=70000;zc(o,L(1),30);const m0=o.s.G.money;o.s.setStatus(2,L(1),{now:o.clock.t});const inBuf=o.root.ad.raid.m,m1=o.s.G.money;
   o.clock.t+=70000;zc(o,L(2),30);o.s.setStatus(2,L(2),{now:o.clock.t});o.clock.t+=600000;o.s.dropLead(L(1).key,o.clock.t);return inBuf>0&&m1===m0&&o.root.ad.raid.n===1&&o.s.G.money===m0});
 t('Session: adTick — чистка и срыв рейда',()=>{const o=mkS(N0);A.raidStart(o.root,N0);const r=o.s.adTick(N0+20*60000);return r.raid&&!o.root.ad.raid});
 t('ghostLine: строка после 2 дней истории',()=>{const root={};const d0=N0-864e5;for(let i=0;i<20;i++)A.ghostRec(root,d0+i*60000);for(let i=0;i<5;i++)A.ghostRec(root,N0+i*60000);const g=A.ghostLine(root,N0+20*60000);return g&&/рекорд|Обычно|10 минут/i.test(g.t)});
 t('пауза/Заморозка: таймер на экране стоит, lastEnd сдвигается',()=>{const G=newState(N0);G.streak=3;G.step=0;G.last=N0;G.lastEnd=N0;G.lastCls='TRASH';G.lastId=0;eP(G,N0+5000);const a=windowState(G,N0+5000,{zoom:false}).left,b=windowState(G,N0+90000,{zoom:false}).left;eR(G,N0+95000);return a===b&&G.lastEnd===N0+90000&&G.last===N0+90000});
  t('рекорды v3: «лучшие 10 минут» и «быстрые 20» объявляются, только когда побит рекорд прошлых дней; питч сравнивается с рекордом на 100',()=>{
   const d0=new Date(2026,0,12,10,0).getTime(),d1=d0+864e5,root={days:{}};let r,w=[];
   for(let i=0;i<20;i++)r=A.ghostRec(root,d0+i*30000,'VOICEMAIL');const day0=r.ms.length;           // первый день: рекорды ставятся молча
   for(let i=0;i<20;i++){r=A.ghostRec(root,d1+i*20000,'VOICEMAIL');w.push(...r.ms)}
   const f=w.find(x=>x.id==='f20'),b=w.find(x=>x.id==='b10');r=A.ghostRec(root,d1+500000,'TALK');const ln=A.ghostLine(root,d1+500000,0,r);
   r=A.ghostRec(root,d1+520000,'TALK');const ln2=A.ghostLine(root,d1+520000,0,r);
   return day0===0&&f&&/РЕКОРД/.test(f.t)&&w.filter(x=>x.id==='f20').length===1&&/Лучшие 10 минут/.test(ln.t)&&/Питч №2/.test(ln2.t)});
 t('исход босса 2: «журнал» — деньги и скидка 30%, выбор один раз',()=>{const save={meta:{captured:{1:1,2:1},owned:{}},story:{ch:{b1:'crown'}}},G=newState(N0);G.district=3;G.money=0;if(AL.pendingChoice(save,G)!==2)return false;
   const r=AL.choose(save,G,2,'log'),r2=AL.choose(save,G,2,'gate');const it=SHOP_ITEMS.find(x=>x.id==='d2t2');G.money=10e6;const m0=G.money;buy(G,save.meta,'d2t2');
   return r.ok&&!r2.ok&&r.money>0&&m0-G.money===Math.round(it.price*.7)&&AL.pendingChoice(save,G)===null});
 t('исходы: окно, маска, сброс 50 мин, линия 4 работает только с района 7, слот утра',()=>{const save={story:{ch:{b3:'free',b10:'air',b4:'hold',b6:'am'}}},G=newState(N0);G.district=5;
   const at9=Date.UTC(2026,0,5,15),at14=Date.UTC(2026,0,5,20);   // 9:00 и 14:00 по Central (кусок 28: слоты по часам лидов)
  const m=AL.withAllies({},save,G,at9),m2=AL.withAllies({},save,G,at14);G.district=7;const m3=AL.withAllies({},save,G,at14);
   const s2={story:{ch:{b3:'mask'}}};return m.fast===5&&m.maxGap===50&&!m.m.CALLBACK&&Math.abs(m3.m.CALLBACK-1.2)<1e-9&&Math.abs(m.xAll-1.1)<1e-9&&!m2.xAll&&Math.abs(AL.withAllies({},s2,G).m.TALK-1.08)<1e-9});
 t('исходы: Менеджер по встречам района, Барон по выбору в Шпиле, донос только после «сдать», старое «ally» читается',()=>{
   const a={story:{ch:{},dc:{5:{n:40,met:3}}}},b={story:{ch:{},dc:{5:{n:40,met:1}}}},G=newState(N0);AL.choose(a,G,5);AL.choose(b,G,5);
   const c={story:{ch:{b8:'city'}}},e={story:{ch:{b8:'gold'}}};AL.choose(c,G,9);AL.choose(e,G,9);
   const f={story:{ch:{b3:'sell'}}},g={story:{ch:{b3:'free'}}};const leg={story:{ch:{b1:'ally',b2:'trophy'}}};
   return a.story.ch.b5==='deal'&&b.story.ch.b5==='mail'&&c.story.ch.b9==='down'&&e.story.ch.b9==='flee'&&AL.optsFor(f,7).length===3&&AL.optsFor(g,7).length===2
    &&AL.optOf(leg,1).id==='crown'&&AL.optOf(leg,2)===null&&AL.allyCount(leg)===1});
 t('ключ: без ключа прогресс района в keyHold, после получения — в шкалу',()=>{const o=mkS(N0,{keys:{}});const G=o.s.G;G.district=3;G.dxp=0;G.money=1e6;
   for(let i=0;i<12;i++){o.clock.t+=70000;zc(o,L(i),30);o.s.setStatus(2,L(i),{now:o.clock.t})}const hold=G.keyHold,dx=G.dxp;const q=K.keyReqs(o.root,G,K.keyFor(3));const r=K.takeKey(o.root,G,'k1');
   return hold>0&&dx===0&&q.ok&&r.ok&&G.dxp===hold&&G.keyHold===0&&!K.needKey(o.root,G)});
 t('ключ: worth-undo снимает удержанный прогресс',()=>{const o=mkS(N0,{keys:{}});const G=o.s.G;G.district=3;o.clock.t+=70000;zc(o,L(1),30);o.s.setStatus(2,L(1),{now:o.clock.t});o.clock.t+=70000;zc(o,L(2),30);o.s.setStatus(2,L(2),{now:o.clock.t});
   const h=G.keyHold;o.clock.t+=600000;o.s.dropLead(L(1).key,o.clock.t);return h>0&&G.keyHold<h&&G.dxp===0&&!(G.debt>0)});
 t('ключ: обмен удаляет предмет; старый сейв получает ключи пройденных границ',()=>{const save={meta:{owned:{d6t1:1}},story:{ch:{}}},G=newState(N0);G.district=7;G.money=1e6;save.keys={};const k=K.keyFor(7);
   const r=K.takeKey(save,G,'k3');const s2={meta:{owned:{}}},G2=newState(N0);G2.district=8;K.keysInit(s2,G2);return r.ok&&!save.meta.owned.d6t1&&s2.keys.k1.got&&s2.keys.k3.got&&!s2.keys.k4});
 t('styleRank',()=>A.styleRank(65,0)==='SSS'&&A.styleRank(46,1)==='SSS'&&A.styleRank(5,0)==='D');
 return T.slice()}
