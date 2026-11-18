// Кусок 34 (r2p25): заметки Алекса. Находки раз в 25–40 неудач (равномерно), единый счёт дня, сутки с 10:00, слив спринта, шкала ранга,
// инструменты меню лидов, редкие уведомления призрака, очередь записи без блокировки «головой».
import * as A from '../core/addict.js';
import {newState} from '../core/engine.js';
import {dayKey,RANKS} from '../core/stats.js';
import {Dialer} from '../dialer/dialer.js';
import {Table} from '../dialer/table.js';
import {SheetsSync} from '../dialer/sheets.js';
import {drainFrame} from '../ui/work/sprint.js';
import {partyLevel,partyMs,partyCount,partyText} from '../ui/work/party.js';
import {rankState,rankHue,rankBarHtml} from '../ui/work/rankbar.js';
import {nextNumbers,numbersMsg,sheetUrl} from '../ui/work/picktools.js';
import {makeGhostGate,important,GATE} from '../ui/work/ghostgate.js';
import {makeNag,makeQuiet,QUIET_MS} from '../ui/work/nag.js';
import {TEASE,READY,BRIEF,briefScene} from '../story/bosslore.js';
import {BEAT_AT} from '../story/beats.js';
import {DIST} from '../core/meta.js';
import {mkS,L as LD,N0} from './addict.tests.js';
const prng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const lt=(y,mo,d,h,mi=0)=>new Date(y,mo,d,h,mi,0).getTime();   // местное время: границы игровых суток зависят от часового пояса ПК
const tick=()=>new Promise(r=>setImmediate(r));
export async function runS34Tests(){const T=[],t=(n,f)=>{try{T.push([n,!!f()])}catch(e){T.push([n+' ('+e.message+')',false])}};

 // ---------- находки: от 25 до 40 неудач, равномерно ----------
 const finds=(cls,total,seed,over={})=>{const root={},G=newState(Date.now());G.district=1;const rnd=prng(seed);let tm=Date.UTC(2026,10,4,15),n=0,gaps=[],first=true,chest=0,spin=0;
  for(let i=0;i<total;i++){tm+=60e3;const c=typeof cls==='function'?cls(i):cls;const r=A.adAfter(root,G,{cls:c,x:1,m:1},tm,{state:'AR',dayN:i,rnd,...over});if(c!=='BOOKED'&&c!=='DISCOVERY')n++;
   if(r&&r.spin&&!r.spin.track){if(!first)gaps.push(n);first=false;n=0;r.spin.chest?chest++:spin++}}
  return{gaps,chest,spin,root}};
 {const r=finds('TRASH',40000,7),cnt={};r.gaps.forEach(g=>cnt[g]=(cnt[g]||0)+1);const mean=r.gaps.reduce((a,b)=>a+b,0)/r.gaps.length,vals=Object.keys(cnt).map(Number);
  t('находки: интервал всегда от 25 до 40 неудач, ни разу меньше 25 и ни разу больше 40',()=>r.gaps.length>800&&Math.min(...r.gaps)>=25&&Math.max(...r.gaps)<=40);
  t('находки: выпадают все значения 25…40 (16 штук), не «всегда одно и то же»',()=>vals.length===16&&vals.every(v=>cnt[v]>25&&cnt[v]<110));
  t('находки: среднее около 32,5 (равномерно по диапазону)',()=>mean>31.6&&mean<33.4);
  t('находки: и рулетка Шума, и сундук гаранта встречаются',()=>r.spin>0&&r.chest>0)}
 {const r=finds(i=>i%11===10?'BOOKED':i%7===3?'TALK':i%5===4?'CALLBACK':'TRASH',30000,11);
  t('находки: встречи (BOOKED) в счёт неудач не идут, остальные классы (разговор, перезвон) считаются',()=>r.gaps.length>500&&Math.min(...r.gaps)>=25&&Math.max(...r.gaps)<=40)}
 t('находки: на разговоре и перезвоне рулетка тоже может выпасть (не только на мусоре)',()=>{const root={},G=newState(Date.now());G.district=1;let hit={TALK:0,CALLBACK:0,MINOR:0};for(const c of Object.keys(hit)){const rt={},Gt=newState(Date.now());Gt.district=1;for(let i=0;i<45;i++){const r=A.adAfter(rt,Gt,{cls:c,x:1,m:1},N0+i*6e4,{state:'AR',dayN:i,rnd:()=>.5});if(r.spin)hit[c]++}}return hit.TALK>0&&hit.CALLBACK>0&&hit.MINOR>0});
 t('находки: Удача и счастливый час сжимают верхнюю границу, но ниже 25 не опускают никогда',()=>{const a={};let lo=99,hi=0,hiLuck=0;for(let k=0;k<=1000;k++){a.gu=k/1000;const n0=A.gapNeed(a,{luck:0,luckK:1},false),n1=A.gapNeed(a,{luck:.3,luckK:2},true);lo=Math.min(lo,n0,n1);hi=Math.max(hi,n0);hiLuck=Math.max(hiLuck,n1)}return lo===25&&hi===40&&hiLuck<hi&&hiLuck>=25});
 t('находки: без Удачи a.gu=0 → 25, a.gu→1 → 40',()=>A.gapNeed({gu:0},{luck:0,luckK:1},false)===25&&A.gapNeed({gu:.9999},{luck:0,luckK:1},false)===40);

 // ---------- единый счёт дня: призрак не уходит вперёд при смене и снятии статуса ----------
 {const o=mkS(N0),k=dayKey(N0),ids=[];let cnt=0;
  const st=(i,had=false)=>{o.clock.t+=70000;const r=o.s.setStatus(0,LD(i),{now:o.clock.t,had});return r};
  for(let i=0;i<6;i++)st(i);
  const same=()=>(o.root.days[k]||{n:0}).n===o.root.gh.t.length;
  t('призрак: после 6 статусов число событий равно числу в заданиях дня',()=>o.root.days[k].n===6&&o.root.gh.t.length===6);
  st(1,true);st(3,true);
  t('призрак: смена статуса на уже обработанном лиде не раздувает счёт («90 против 89»)',()=>o.root.days[k].n===6&&o.root.gh.t.length===6);
  o.clock.t+=70000;o.s.dropLead(LD(2).key,o.clock.t);
  t('призрак: убранный статус снимается и из призрака (было 104 против 99)',()=>o.root.days[k].n===5&&o.root.gh.t.length===5&&same());
  const line=A.ghostLine(o.root,o.clock.t,0,null);
  t('призрак: «сегодня N» в уведомлении берётся из заданий дня',()=>!line||!/Сегодня \d+/.test(line.t)||line.t.includes('Сегодня 5'));
  o.clock.t+=70000;const s2=o.s.setStatus(0,LD(9),{now:o.clock.t});
  t('призрак: после нового статуса снова 6 и 6',()=>o.root.days[k].n===6&&o.root.gh.t.length===6)}
 t('ghostDrop: без записи призрака ничего не ломает',()=>A.ghostDrop({},{gh:{t:1}})===false&&A.ghostDrop({gh:{k:'x',t:[]}},{})===false);
 t('темп к обычному: сравнение с прошлыми днями к тому же часу',()=>{const now=lt(2026,10,3,16,40),root={days:{[dayKey(now)]:{n:70}},gh:{days:{'2026-11-01':{0:10,100:60},'2026-11-02':{0:5,100:50}}}},p=A.paceDelta(root,now);return p&&p.u===55&&p.diff===15&&A.paceDelta({days:{}},now)===null});

 // ---------- дайлер: сутки с 10:00, смена суток, слив спринта ----------
 const mkD=(now0,store)=>{let now=now0;const m=store||new Map(),E={now:()=>now,dayKey,store:{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))},setTimeout:()=>0,clearTimeout:()=>{},zoomSend:()=>{},https:true,fetch:async()=>({json:async()=>({ok:true})})};
  const d=new Dialer(E);d.zoom.ready=true;d.loadText('Business,Phone,State\nA,5015550001,AR\nB,5015550002,AR\nC,5015550003,AR\nD,5015550004,AR\n','x.csv');return{d,E,m,set:v=>now=v}};
 {const a=mkD(lt(2026,10,3,23,30));a.d.auto=false;a.d.setStatus(0);a.d.setStatus(0);
  const evs=[];a.d.bus.on('dayRolled',e=>evs.push(e));
  t('дайлер: счёт дня и спринт растут по статусам',()=>a.d.ses.tot===2&&a.d.ses.sprint===2);
  const b=mkD(lt(2026,10,4,1,0),a.m);
  t('дайлер: после полуночи (но до 10:00) счёт дня и спринт НЕ сбрасываются: сутки игровые',()=>b.d.ses.tot===2&&b.d.ses.sprint===2);
  const c=mkD(lt(2026,10,4,10,5),a.m);
  t('дайлер: с 10:00 новые сутки: счёт 0, спринт 0',()=>c.d.ses.tot===0&&c.d.ses.sprint===0);
  t('дайлер: хвост вчерашнего спринта запоминается для анимации слива и отдаётся один раз',()=>c.d.takeSprLeft()===2&&c.d.takeSprLeft()===0);
  a.set(lt(2026,10,4,10,1));const tp=a.d.tempo();
  t('дайлер: смена суток посреди работы (вкладка открыта): сброс и событие dayRolled со старым спринтом',()=>evs.length===1&&evs[0].left===2&&a.d.ses.tot===0&&a.d.ses.sprint===0)}
 {const a=mkD(lt(2026,10,3,16,0));a.d.auto=false;for(let i=0;i<3;i++)a.d.setStatus(0);const ev=[];a.d.bus.on('sprintDrain',e=>ev.push(e));
  const left=a.d.endSprint();
  t('конец смены: неполный спринт обнуляется, сотня дня (счёт) остаётся, событие слива с прежним значением',()=>left===3&&a.d.ses.sprint===0&&a.d.ses.tot===3&&ev.length===1&&ev[0].left===3);
  t('конец смены при пустой шкале: ничего не происходит',()=>a.d.endSprint()===0&&ev.length===1);
  const b=mkD(lt(2026,10,3,16,5),a.m);
  t('слив шкалы переживает перезагрузку (без возврата 3 из 25)',()=>b.d.ses.sprint===0&&b.d.ses.tot===3)}
 {const a=mkD(lt(2026,10,3,16,0));a.d.auto=false;for(let i=0;i<3;i++)a.d.setStatus(0);const ph=a.d.t.ph(a.d.t.L[0]);
  a.d.untally(ph);
  t('игра не засчитала статус (слишком быстро / нет подтверждения): счёт дня и спринт откатываются',()=>a.d.ses.tot===2&&a.d.ses.sprint===2);
  t('сверка с игрой: число дня берётся из игры, спринт не превышает его',()=>a.d.syncCount(1)&&a.d.ses.tot===1&&a.d.ses.sprint===1&&!a.d.syncCount(1)&&a.d.syncCount(30)&&a.d.ses.tot===30)}
 t('дайлер без env.dayKey остаётся на календарной дате (старое поведение, совместимость)',()=>{const m=new Map(),E={now:()=>lt(2026,10,4,1,0),store:{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)},setTimeout:()=>0,clearTimeout:()=>{},zoomSend:()=>{},https:true,fetch:async()=>({})},d=new Dialer(E);return d.ses.d==='2026-11-04'});
 t('сотня: сброс спринта на сотом статусе остаётся, сотня идёт по счёту дня',()=>{const a=mkD(lt(2026,10,3,16,0));a.d.auto=false;let k=null;a.d.ses.tot=99;a.d.ses.sprint=24;a.d.t.L.forEach((l,i)=>{});const r=a.d.setStatus(0);return r&&r.milestone&&r.milestone.kind==='hundred'&&r.milestone.n===100&&a.d.ses.sprint===0});
 t('слив: кадры идут от прежнего значения к нулю, цвет «остывает»',()=>{const f0=drainFrame(18,0),f1=drainFrame(18,.5),f2=drainFrame(18,1);return f0.n===18&&f2.n===0&&f2.p===0&&f1.n<f0.n&&f1.n>f2.n&&f2.h1>f0.h1&&drainFrame(18,2).n===0&&drainFrame(18,-1).n===18});

 // ---------- праздник на сотню ----------
 t('праздник: уровень = число сотен, чем больше сотен — тем длиннее и больше конфетти, потолок есть',()=>partyLevel(100)===1&&partyLevel(200)===2&&partyLevel(300)===3&&partyLevel(1000)===10&&partyMs(1)>=5000&&partyMs(2)>partyMs(1)&&partyMs(3)>partyMs(2)&&partyMs(9)===partyMs(4)&&partyCount(3)>partyCount(1)&&partyCount(50)<=520);
 t('праздник: тексты есть для любого уровня',()=>[1,2,3,4,7].every(l=>partyText(l).t&&partyText(l).s));

 // ---------- шкала ранга ----------
 {const now=lt(2026,10,3,16,0),k=dayKey(now),mk=pts=>rankState({days:{[k]:{n:5,pts}}},now);
  t('ранг: шкала растёт от порога ранга к порогу следующего, на высшем — полная',()=>{const a=mk(RANKS[1][0]),b=mk((RANKS[1][0]+RANKS[2][0])/2),c=mk(RANKS[2][0]-1),top=mk(RANKS[4][0]+500);return a.ri===1&&a.p===0&&Math.abs(b.p-.5)<.01&&c.p>.95&&top.top&&top.p===1});
  t('ранг: цвет шкалы меняется по мере заполнения',()=>rankHue(0)>rankHue(.5)&&rankHue(.5)>rankHue(1)&&rankHue(-3)===rankHue(0)&&rankHue(9)===rankHue(1));
  const html=rankBarHtml(mk(RANKS[2][0]+20)),tip=(html.match(/title="([^"]*)"/)||[])[1]||'';
  t('ранг: в подсказке нет цифр (только шкала и названия), кнопка открывает вкладку ранга',()=>!/\d/.test(tip)&&/data-ax="rank"/.test(html)&&/aria-label=/.test(html)&&/Enforcer/.test(html))}

 // ---------- меню «Выбрать лида»: 50 номеров и таблица ----------
 {const tb=new Table().loadText('Business,Phone,State,Result\nA,5015550001,AR,\nB,5015550002,AR,CALL BOOKED\nC,5015550003,AR,\nD,5015550004,TX,\nE,5015550005,AR,\nF,123,AR,\nG,5015550003,AR,\nH,5015550008,AR,','x'),L=tb.L;
  const r=nextNumbers(tb,L[0],50);
  t('50 номеров: тот же штат, без статуса, без чужих штатов, плохих номеров и повторов; первый — выбранный лид',()=>r.state==='AR'&&r.phones.join()==='+15015550001,+15015550003,+15015550005,+15015550008'.split(',').join()&&r.phones.length===4);
  t('50 номеров: считаем вперёд от выбранного лида, а не с начала списка',()=>nextNumbers(tb,L[2],50).phones.join()==='+15015550003,+15015550005,+15015550008');
  t('50 номеров: лимит соблюдается',()=>nextNumbers(tb,L[0],2).phones.length===2&&numbersMsg(nextNumbers(tb,L[0],2))==='Скопировано 2 номеров (штат AR)');
  t('50 номеров: меньше лимита — сообщение «в списке меньше 50 подходящих»',()=>/Скопировано 4 номера \(штат AR\): в списке меньше 50 подходящих номеров/.test(numbersMsg(r)));
  t('50 номеров: ровно 50 — просто «Скопировано 50»',()=>numbersMsg({phones:new Array(50).fill('x'),state:'MD',limit:50})==='Скопировано 50 номеров (штат MD)');
  t('50 номеров: нечего копировать и нет лида — понятные сообщения',()=>/Нет подходящих номеров/.test(numbersMsg({phones:[],state:'AR',limit:50}))&&/Нет текущего лида/.test(numbersMsg(nextNumbers(tb,null))));
  t('50 номеров: лид без штата — ничего не копируем',()=>{const t2=new Table().loadText('Business,Phone,State\nZ,5015550009,\n','x');const q=nextNumbers(t2,t2.L[0],50);return q.err==='nostate'&&/не определён штат/.test(numbersMsg(q))});
  t('таблица: адрес из источника (id и gid), иначе последняя ссылка, иначе пусто; чужие адреса не открываем',()=>sheetUrl({t:{src:{id:'abc_1',gid:'77'}}})==='https://docs.google.com/spreadsheets/d/abc_1/edit#gid=77'&&sheetUrl({t:{},P:{lastSheetUrl:'https://docs.google.com/spreadsheets/d/zz/edit'}})==='https://docs.google.com/spreadsheets/d/zz/edit'&&sheetUrl({t:{},P:{lastSheetUrl:'javascript:alert(1)'}})===''&&sheetUrl({t:{},P:{}})==='')}

 // ---------- уведомления призрака: редко и с разбросом ----------
 {const g=makeGhostGate(prng(3)),shown=[];let since=0;for(let i=0;i<4000;i++){since++;if(g.pass({k:'up',h:'Ты против себя обычного',t:'x'})){shown.push(since);since=0}}
  const mean=shown.reduce((a,b)=>a+b,0)/shown.length;
  t('призрак: обычное сравнение — раз в 7–14 звонков, не на каждый',()=>shown.length>200&&Math.min(...shown)>=GATE.routine[0]&&Math.max(...shown)<=GATE.routine[1]&&mean>9.5&&mean<11.5);
  t('призрак: интервал каждый раз разный (разброс, не метроном)',()=>new Set(shown).size>=6);
  const g2=makeGhostGate(prng(5));
  t('призрак: рекорды, встречи и «обогнал рекорд» показываются всегда',()=>[{k:'win',t:'x'},{k:'up',h:'Встреча',t:'x'},{k:'up',h:'Питч',p:1,t:'x'}].every(x=>important(x)&&g2.pass(x))&&!important({k:'near',p:.8})&&!important({k:'up',h:'Питч'}));
  const g3=makeGhostGate(prng(9));let n3=0,seen3=[],s3=0;for(let i=0;i<600;i++){s3++;if(g3.pass({k:'near',h:'Темп',p:.5,t:'x'})){seen3.push(s3);s3=0}}
  t('призрак: «почти рекорд» — не чаще раза в 4 звонка и всё же появляется',()=>seen3.length>40&&Math.min(...seen3)>=GATE.near[0]&&Math.max(...seen3)<=GATE.near[1]);
  t('призрак: пустая строка не показывается и не ломает счёт',()=>makeGhostGate().pass(null)===false)}

 // ---------- очередь записи в таблицу: одна плохая запись не блокирует остальные ----------
 {const mapQ=new Map(),tb=new Table().loadText('Business,Phone,State,Adress,Result,Date Engaged,Notes,Callback?\nBad Lead,5015550001,AR,,,,,\nGood Lead,5015550002,AR,,,,,\nThird,5015550003,AR,,,,,','x'),posts=[],ev=[];
  const fetch=async(u,o)=>{const b=JSON.parse(o.body);posts.push(b);return{json:async()=>b.set&&b.set.Result==='Статус не из списка'?{ok:false,perm:true,code:'validation',err:'нет в списке: '+b.set.Result}:{ok:true}}};
  const x=new SheetsSync({table:tb,cfg:()=>({on:true,url:'https://x',token:'t'}),fileTab:()=>tb.name,store:{getItem:k=>mapQ.get(k),setItem:(k,v)=>mapQ.set(k,v)},fetch,setTimeout:()=>0,clearTimeout:()=>{},now:()=>1700000000000,isEditing:()=>false,confirm:()=>true,busyLocal:()=>false,emit:(...a)=>ev.push(a)});
  tb.put(tb.L[0],'Result','Статус не из списка');x.sync(tb.L[0],1);tb.put(tb.L[1],'Result','CALL BOOKED');x.sync(tb.L[1],1);tb.put(tb.L[2],'Result','GATEKEEPER НЕ ПРОПУСТИЛ');x.sync(tb.L[2],1);
  await tick();await tick();await tick();
  const sentOk=posts.filter(p=>!/5015550001/.test(String(p.phone))).map(p=>p.set.Result);
  t('очередь: отклонённая таблицей запись не блокирует остальные: обе другие записи ушли',()=>sentOk.includes('CALL BOOKED')&&sentOk.includes('GATEKEEPER НЕ ПРОПУСТИЛ'));
  t('очередь: отклонённая запись остаётся в очереди нетронутой (формат pd2q прежний), причина показана',()=>x.SQ.length===1&&x.SQ[0].set.Result==='Статус не из списка'&&JSON.parse(mapQ.get('pd2q')).length===1&&x.fail===1&&/выпадающим списком/.test(x.msg[0])&&x.state().rejected===1);
  const before=posts.length;await x.pump();
  t('очередь: отклонённая запись «отдыхает» и не долбит таблицу при каждом проходе',()=>posts.length===before);
  tb.put(tb.L[0],'Result','CALL BOOKED');x.sync(tb.L[0],1);await tick();await tick();await tick();
  t('очередь: исправил статус у того же лида — запись уходит сразу, очередь пуста, ошибка снята',()=>x.SQ.length===0&&!x.fail&&!x.err&&x.state().rejected===0)}
 {const posts=[],mapQ=new Map(),tb=new Table().loadText('Business,Phone,State\nA,5015550001,AR\nB,5015550002,AR','x'),x=new SheetsSync({table:tb,cfg:()=>({on:true,url:'https://x',token:'t'}),fileTab:()=>tb.name,store:{getItem:k=>mapQ.get(k),setItem:(k,v)=>mapQ.set(k,v)},fetch:async(u,o)=>{posts.push(JSON.parse(o.body));return{json:async()=>({ok:false,code:'secret',err:'secret'})}},setTimeout:()=>0,clearTimeout:()=>{},now:()=>1,isEditing:()=>false,confirm:()=>true,busyLocal:()=>false,emit:()=>{}});
  tb.put(tb.L[0],'Result','CALL BOOKED');x.sync(tb.L[0],1);tb.put(tb.L[1],'Result','CALL BOOKED');x.sync(tb.L[1],1);await tick();await tick();
  t('очередь: неверное секретное слово по-прежнему останавливает проход (общий сбой, не по одной записи), записи целы',()=>posts.length===1&&x.err==='secret'&&x.SQ.length===2)}

 // ---------- упрёк «БЕЗ ЗВОНКОВ»: окна тишины на карте/в базе (60 с) и в меню лидов (15 с) ----------
 {let ctx=null;const q=makeQuiet(()=>ctx);
  t('окна тишины: на главной панели тишины нет; карта/база — 60 с, меню лидов — 15 с',()=>{const r=[];r.push(q(0));ctx='world';r.push(q(1000),q(60999),q(61001));ctx='picker';r.push(q(70000),q(84999),q(85001));ctx=null;r.push(q(90000));return JSON.stringify(r)==='[false,true,true,false,true,true,false,false]'&&QUIET_MS.world===60000&&QUIET_MS.picker===15000});
  t('окна тишины: выход на главную панель снимает тишину сразу, новый вход открывает новое окно',()=>{ctx='world';q(200000);const a=q(230000);ctx=null;const b=q(231000);ctx='world';const c=q(232000);return a===true&&b===false&&c===true})}
 {const kids=[],mkEl=()=>{const e={className:'',classList:{add(){},remove(){}},setAttribute(){},innerHTML:'',remove(){const i=kids.indexOf(e);if(i>=0)kids.splice(i,1)},querySelector:()=>({textContent:''})};return e},old=globalThis.document;globalThis.document={createElement:mkEl};
  try{let now=1700000000000,ctx=null,snd=0;const T0=now,nag=makeNag({now:()=>now,state:()=>({paused:true,onCall:false,pauseAt:T0,lastAct:T0}),sfx:()=>snd++,mount:{appendChild:e=>kids.push(e)},quiet:makeQuiet(()=>ctx)});
   now=T0+3*60000+6000;nag.tick();const shown0   /* 3,1 мин паузы: до порога 5 мин уровень упрёка не меняется */=kids.length,snd0=snd,txt0=kids[0]&&kids[0].innerHTML;
   ctx='world';now+=1000;nag.tick();const hidden=kids.length===0;
   now+=30000;nag.tick();const still=kids.length===0;
   now+=31000;nag.tick();const after60=kids.length===1&&kids[0].innerHTML.includes(txt0.match(/<b>(.*?)<\/b>/)[1]);
   ctx=null;now+=1000;nag.tick();const back=kids.length===1;
   ctx='world';now+=1000;nag.tick();const inW=kids.length===0;ctx=null;now+=2000;nag.tick();const backFast=kids.length===1&&kids[0].innerHTML===txt0.replace(/<em>.*?<\/em>/,m=>kids[0].innerHTML.match(/<em>.*?<\/em>/)[0]);
   ctx='picker';now+=1000;nag.tick();const inP=kids.length===0;now+=16000;nag.tick();const afterP=kids.length===1;
   t('упрёк: появился, ушёл на карту — исчез, через 60 с на карте снова виден с тем же текстом',()=>shown0===1&&hidden&&still&&after60);
   t('упрёк: возврат на главную панель — сразу виден, даже если 60 с не прошло',()=>back&&inW&&backFast);
   t('упрёк: в меню лидов скрыт 15 с, потом снова виден',()=>inP&&afterP);
   t('упрёк: звук только при первом появлении, не при возврате из тихого окна',()=>snd0===1&&snd===1)}
  finally{globalThis.document=old}}

 // ---------- боссы до боя: слух, объявление, досье ----------
 {const all=[...TEASE.map(x=>x.text),...READY,...BRIEF.flat().map(p=>p.text)],bad=/остров|пролив|архипелаг|Тишин|Вер[аыеу]\b/,sent=x=>x.split(/(?<=[.!?…])\s+/).filter(Boolean).length;
  t('боссы: у каждого из 12 есть слух, объявление о выходе и досье из трёх панелей (рассказчик → Лом → Гудок)',()=>TEASE.length===12&&READY.length===12&&BRIEF.length===12&&BRIEF.every(b=>b.length===3&&b[0].who===null&&b[1].who==='lom'&&b[2].who==='guide'));
  t('боссы: слух — не больше двух предложений (идёт по рации), у каждого свой житель',()=>TEASE.every(x=>x.name&&x.text&&sent(x.text)<=2&&x.text.length<=230)&&new Set(TEASE.map(x=>x.name)).size===12);
  t('боссы: тексты не нарушают гайд (нет «остров» и т. п., имена Веры и Председателя не звучат раньше времени, «будто/словно» — в меру)',()=>!all.some(x=>bad.test(x))&&all.join(' ').split(/будто|словно/).length-1<=2);
  t('боссы: объявления и досье не пустые и не короче осмысленной фразы',()=>READY.every(x=>x.length>40)&&BRIEF.flat().every(p=>p.text.length>80));
  t('боссы: слух приходит на 12% пути по району, раньше слуха жителя (25%)',()=>BEAT_AT.boss===.12&&BEAT_AT.boss<BEAT_AT.rumor);
  t('боссы: досье строит панели с фоном района; для района без досье пусто',()=>briefScene(5).length===3&&briefScene(5).every(p=>p.bg&&p.bg.d===5&&p.bg.dark===1)&&briefScene(99).length===0);
  t('боссы: в досье названы реальные черты босса района (проверка привязки текстов к районам)',()=>/магнит|трон|холодильник/i.test(BRIEF[0].map(p=>p.text).join(' '))&&/проходн|штамп|Ржав/i.test(BRIEF[1].map(p=>p.text).join(' '))&&/архив|катан/i.test(BRIEF[6].map(p=>p.text).join(' '))&&/Председател|красный телефон/i.test(BRIEF[11].map(p=>p.text).join(' '))&&DIST.length===12)}
 return T}
