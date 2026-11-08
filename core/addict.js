// ADDICTION UPDATE (документ пользователя, части 1–3). Чистая логика без DOM, всё состояние в root.ad.
// Сюжет (docs/STORY_BIBLE.md §12): Сигнал — заряд, который Гудок копит в ЭЛТ из каждого импульса; рулетка — «Шум»: в мусорном
// звонке иногда ловится обломок «ТИШИНЫ» (лут); Ночная чистка — ARCHON по ночам стирает линии, по которым прошло меньше нормы;
// Рейд — Гудок держит деньги в буфере ЭЛТ, пока линия не замолчит; связисты — люди, которые услышали тебя и пришли работать.
// Цифры — черновик до общего пересмотра баланса (E3/Q24): все в AD.
import {CONFIG as C,districtThr} from './config.js';
import {dayKey,isWork,RANK_BONUS} from './stats.js';
import {TZ} from '../dialer/geo.js';
import {itemHH} from './buffs.js';
import {colEnsure,capOf,opsBonus,opLeft,build as colBuild} from './collector.js';
export const AD={
 norm:100,                                                         // дневная норма наборов (B4); пользователь может поменять позже
 hh:[{from:450,to:510,k:2,name:'Утренний пик'},{from:510,to:600,k:1.5,name:'Утро'},{from:930,to:1050,k:1.5,name:'Вечер'}], // J14: местное время лида 7:30–8:30 ×2, 8:30–10:00 ×1.5, 15:30–17:30 ×1.5; других окон нет
 sig:{TRASH:1,GATEKEEPER:2,MINOR:1,TALK:3,CALLBACK:4,BOOKED:25,DISCOVERY:40},  // Сигнал за статус. Отказы (TALK) дают больше мусора: «шрамы» (D5)
 roul:{base:.05,perFail:.0006,hh:1.5,cap:.18,from:['TRASH','GATEKEEPER','MINOR'],ms:3600}, // B1: шанс рулетки на мусорном статусе
 w:{c:56,u:26,r:12,e:5,l:1},wChest:{e:80,l:20},                    // веса редкостей; сундук гаранта = эпик+
 gap:25,                                                           // кусок 28: между находками (Шум и сундук) не меньше 25 неудач (всё, кроме CALL BOOKED и Discovery)
 pity:[30,70],                                                     // C1: порог неудач — случайно 30–70
 freeze:{per:25,max:3,sec:180},                                    // E1: заряд за каждые 25 наборов дня, максимум 3, до 3 минут
 warm:{n:5,k:3,share:.05,sig:20,min:10,ask:10,from:[13,55],to:[23,10],retry:60},   // кусок 22: только пн–пт from..to по часам ПК; пропустил — ещё раз через retry мин; принять — за ask мин; бонус — min мин ИЛИ n наборов                                 // C6 v2 (кусок 18): «Разгон» — входящий вызов при 0 наборов за день. Принял → первые 5 наборов ×3 XP и $ (кроме BOOKED/DISCOVERY), после 5-го ещё 5% дневных $ и 20 Сигнала. Отклонил — до завтра
 purge:{share:.10,mShare:.10,maxDays:5,lookback:7},                           // B4: 10% полного пути района или 30 звонков (что больше), деньги — по недобору
 raid:{n:100,k:1.5,gap:{TRASH:180,GATEKEEPER:180,MINOR:180,TALK:300,CALLBACK:360,BOOKED:1500,DISCOVERY:1500}}, // C3
 perk:{every:50,min:60},                                           // D2: каждые 50 наборов — 1 из 3 на час
 normDay:{per:1,max:10}};                                          // серия дней с нормой: +1% XP и $ за день, до +10%
export const TIER={c:['Хлам','#9aa3ad'],u:['Годное','#39d98a'],r:['Редкое','#3ad7ff'],e:['Эпик','#c06bff'],l:['Легенда','#ffc400']};
// Предметы-бусты (B1a). kind: xAll/mAll (%), x/m {класс:%}, fast (с к окну), odSec, sigK (×Сигнал), luck (+доля шанса рулетки),
// мгновенные: jack (доля дневных $ района), sigNow, freeze (+заряд), shield (щит от Ночной чистки). calls — на сколько статусов.
// relic — навсегда (легендарные реликвии).
export const LOOT=[
 {id:'clip',n:'Медная скрепка',r:'c',jack:.03,t:'Немного денег сразу'},
 {id:'fuse',n:'Горсть предохранителей',r:'c',sigNow:15,t:'+15 Сигнала сразу'},
 {id:'tape',n:'Изолента',r:'c',xAll:5,calls:15,t:'+5% XP на 15 звонков'},
 {id:'batt',n:'Батарейка «Крона»',r:'c',mAll:5,calls:15,t:'+5% $ на 15 звонков'},
 {id:'gum',n:'Жвачка Тостера',r:'c',luck:.02,calls:20,t:'Шанс Шума +2% на 20 звонков'},
 {id:'coil',n:'Катушка индуктивности',r:'u',xAll:10,calls:25,t:'+10% XP на 25 звонков'},
 {id:'rj11',n:'Разъём RJ-11',r:'u',mAll:10,calls:25,t:'+10% $ на 25 звонков'},
 {id:'cap',n:'Конденсатор',r:'u',fast:8,calls:30,t:'+8 с к окну серии на 30 звонков'},
 {id:'ear',n:'Наушник с трещиной',r:'u',x:{TALK:20},calls:30,t:'+20% XP за «владельца на линии» на 30 звонков'},
 {id:'gstamp',n:'Штамп проходной',r:'u',x:{GATEKEEPER:40},calls:40,t:'+40% XP за гейткиперов на 40 звонков'},
 {id:'cards',n:'Пачка визиток',r:'u',m:{CALLBACK:15,TALK:10},calls:30,t:'+15% $ за перезвоны, +10% за разговоры на 30 звонков'},
 {id:'quartz',n:'Кристалл кварца',r:'u',sigK:2,calls:20,t:'Сигнал ×2 на 20 звонков'},
 {id:'tube',n:'Лампа-усилитель',r:'r',xAll:20,calls:40,t:'+20% XP на 40 звонков'},
 {id:'meter',n:'Счётчик минут',r:'r',mAll:20,calls:40,t:'+20% $ на 40 звонков'},
 {id:'reso',n:'Резонатор',r:'r',fast:15,calls:40,t:'+15 с к окну серии на 40 звонков'},
 {id:'beacon',n:'Плата с маяком',r:'r',luck:.06,calls:40,t:'Шанс Шума +6% на 40 звонков'},
 {id:'thermos',n:'Термос Лома',r:'r',odSec:60,calls:100,t:'Следующий Overdrive +60 с (на 100 звонков)'},
 {id:'frost',n:'Иней с антенны',r:'r',sigNow:90,t:'+90 Сигнала сразу'},
 {id:'heart',n:'Сердце глушилки',r:'e',xAll:35,calls:60,t:'+35% XP на 60 звонков'},
 {id:'safe',n:'Сейф-ячейка',r:'e',mAll:35,calls:60,jack:.15,t:'+35% $ на 60 звонков и деньги сразу'},
 {id:'flare',n:'Сигнальная ракета',r:'e',sigNow:150,t:'+150 Сигнала сразу'},
 {id:'phone1',n:'Первая трубка города',r:'l',relic:{xAll:2},t:'Реликвия: +2% XP навсегда'},
 {id:'medal',n:'Медаль Станции',r:'l',relic:{mAll:2},t:'Реликвия: +2% $ навсегда'},
 {id:'shard',n:'Камертон обходчика',r:'l',relic:{fast:5},t:'Реликвия: +5 с к окну серии навсегда'},
 {id:'disc',n:'Позолоченный диск',r:'l',jack:.5,sigNow:300,t:'Деньги за полсмены сразу и +300 Сигнала'},
 {id:'watch',n:'Часы Председателя',r:'l',relic:{odSec:60},t:'Реликвия: Overdrive +60 с навсегда'},
 // кусок 19 (документ Addiction): уникальный лут только в счастливые часы — «вещи, которые любят рассвет»
 {id:'dawn',n:'Рассветная катушка',r:'u',hh:1,xAll:15,mAll:15,calls:25,t:'Только в счастливый час: +15% XP и $ на 25 звонков'},
 {id:'dusk',n:'Вечерний штекер',r:'r',hh:1,fast:10,mAll:20,calls:40,t:'Только в счастливый час: +20% $ и +10 с к окну серии на 40 звонков'},
 {id:'sun',n:'Солнечный кварц',r:'e',hh:1,sigK:3,xAll:25,calls:40,t:'Только в счастливый час: Сигнал ×3 и +25% XP на 40 звонков'},
 {id:'rooster',n:'Петух с крыши «Зари»',r:'l',hh:1,relic:{xAll:2,mAll:2},t:'Только в счастливый час. Реликвия: +2% XP и $ навсегда'}];
export const dk=dayKey;
export const lootById=id=>LOOT.find(x=>x.id===id);
// Дерево «Коммутатор» — пульт «Заря-12» из-под брезента в гараже (библия §12, §13) (B3 мид-цель, C4 экспонента): 6 веток × 6 уровней, цена 60 × 2.2^уровень Сигнала.
export const TREE=[
 {id:'res',n:'Резонанс',t:'Больше времени между звонками, чтобы серия не сгорела: +4 секунды за уровень',fx:l=>({fast:4*l})},
 {id:'gold',n:'Добыча',t:'Больше денег за каждый статус: +3% за уровень',fx:l=>({mAll:3*l})},
 {id:'xp',n:'Опыт',t:'Больше опыта за каждый статус: +3% за уровень',fx:l=>({xAll:3*l})},
 {id:'luck',n:'Удача',t:'Находки в Шуме чаще, а гарантированная находка — раньше',fx:l=>({luck:.01*l,pity:3*l})},
 {id:'grit',n:'Стойкость',t:'Ночная чистка забирает меньше: −8% за уровень',fx:l=>({purge:.08*l})},
 {id:'look',n:'Вид',t:'Каждый уровень открывает новую тему оформления',fx:l=>({themes:l})}];
export const THEMES=[['base','Зелёная линия','#39ff14'],['neon','Неон','#ff2bd6'],['gold','Золото','#ffc400'],['ice','Лёд','#3ad7ff'],['rust','Ржавчина','#ff7a2b'],['holo','Голограмма','#b98bff'],['red','Красная тревога','#ff3b4e']];
// память пульта: чем больше линий включено, тем больше Гудок вспоминает (красная нить, библия §13)
export const MEM=[[1,'Гнездо загорелось. Я знаю, как этот пульт работает. Я не должен этого знать.'],
 [3,'Двенадцать рядов по сорок гнёзд. На краю пульта нацарапано: «В. — ночная смена».'],
 [6,'Иногда в помехах кто-то говорит «соединяю». Голос женский. Это эхо. Наверное.'],
 [10,'На пульте есть гнездо, которое никогда не гасло. Номер ноль. Штекер в нём до сих пор.'],
 [15,'Кто-то соединил здесь сто вызовов за одну ночь. До утра. Пульт помнит каждый.'],
 [21,'Сто первый вызов ушёл на номер Председателя. Ответа нет. Штекер так и остался в гнезде.'],
 [28,'Если вытащить штекер из гнезда ноль, я замолчу. Это я знаю точно. Не спрашивай откуда.'],
 [36,'Пульт горит весь. Я вспомнил её имя. Скажу, когда дойдём до Станции. Не раньше.']];
export const treeSum=root=>Object.values(ensure(root).tree||{}).reduce((a,b)=>a+(b|0),0);
export const treeCost=lv=>Math.round(60*Math.pow(2.2,lv));
// Связисты (C5, Q9): операторы в комнатах — пассивные множители; цены растут экспонентой
export const OPS={perOp:.8,roomCap:5,maxRooms:6,roomCost:k=>Math.round(1500*Math.pow(2.6,k)),opCost:k=>Math.round(400*Math.pow(1.28,k))};
// Перки «1 из 3» (D2)
export const PERKS3=[{id:'p_talk',n:'Голос в трубке',t:'+30% $ за «владельца на линии»',m:{TALK:30,CALLBACK:30}},{id:'p_xp',n:'Широкая полоса',t:'+12% XP ко всему',xAll:12},
 {id:'p_m',n:'Платный эфир',t:'+12% $ ко всему',mAll:12},{id:'p_win',n:'Длинный провод',t:'+12 с к окну серии',fast:12},{id:'p_luck',n:'Шумный час',t:'Шанс Шума ×2',luckK:2},
 {id:'p_sig',n:'Полный заряд',t:'Сигнал ×1.5',sigK:1.5},{id:'p_gk',n:'Отмычка',t:'XP за гейткиперов ×2',x:{GATEKEEPER:100}},{id:'p_od',n:'Форсаж',t:'Overdrive +60 с',odSec:60},
 {id:'p_frz',n:'Холодная голова',t:'+15% XP за GATEKEEPER на час',x:{GATEKEEPER:15}}];
// Цели дня со смещёнными порогами (C2): каждый день свой набор
const H=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0},rngOf=seed=>()=>(seed=Math.imul(seed^seed>>>15,2246822519)>>>0)/4294967296;
const VAR=[['talk','Владелец на линии',[6,8,10,12]],['gk','Гейткиперы',[10,14,18]],['hh','Наборы в счастливый час',[20,30,40]],['streak','Лучшая серия дня',[30,40,50]],['sig','Сигнал за день',[150,200,260]]];
export function tracksFor(k){const r=rngOf(H('tr'+k)),pick=a=>a[r()*a.length|0],v=pick(VAR);
 return[{id:'t1',kind:'dials',n:pick([40,60,80]),name:'Наборы',rew:'mult',rt:'×1.1 $ до конца дня'},{id:'tv',kind:v[0],n:pick(v[2]),name:v[1],rew:'sig',rt:'+60 Сигнала'},
  {id:'t2',kind:'dials',n:pick([130,150,170]),name:'Наборы',rew:'chest',rt:'Редкий сундук'},{id:'t3',kind:'dials',n:300,name:'Берсерк',rew:'epic',rt:'Эпический сундук и +200 Сигнала'}]}
export const DEF=()=>({sig:0,sigLife:0,tree:{},inv:{},act:[],relic:{},pity:{n:0,at:0},frz:{ch:0,got:0,k:'',on:0,at:0},shield:0,warm:{k:'',done:0},
 tr:{k:'',done:{}},perk:{k:'',at:0,opts:null,pick:null,until:0},raid:null,purge:{chk:'',log:[]},normDays:0,ops:{rooms:0,n:0},theme:'base',drops:[],stats:{spins:0,chests:0,legend:0}});
export const ensure=root=>{const a=root.ad||(root.ad=DEF()),d=DEF();for(const k in d)if(a[k]===undefined)a[k]=d[k];
 if(!a.noShield){a.noShield=1;if(a.shield>0){a.sig+=150*a.shield;a.sigLife+=150*a.shield}a.shield=0}   // кусок 28: «Ключ от щитовой» убран (пропуск чистки поощрял безделье); старые щиты → по 150 Сигнала
 colEnsure(a);return a};
// местное время лида по штату → минуты от полуночи
export function leadMin(state,now){const z=TZ[String(state||'').toUpperCase()];if(!z)return null;try{const p=new Intl.DateTimeFormat('en-US',{timeZone:z,hour:'numeric',minute:'numeric',hour12:false}).formatToParts(new Date(now));
 const h=+p.find(x=>x.type==='hour').value%24,m=+p.find(x=>x.type==='minute').value;return h*60+m}catch(e){return null}}
// I5 (кусок 20): день недели и минуты — по часам ЛИДА (раньше брался день браузера: в пятницу вечером у Тихого океана уже «суббота» у нас)
const WDN={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
export function zoneClock(z,now){try{const p=new Intl.DateTimeFormat('en-US',{timeZone:z,hour:'numeric',minute:'numeric',weekday:'short',hour12:false}).formatToParts(new Date(now)),g=k=>(p.find(x=>x.type===k)||{}).value;
 return{m:(+g('hour')%24)*60+(+g('minute')),wd:WDN[g('weekday')]??new Date(now).getDay(),sec:new Date(now).getUTCSeconds()}}catch(e){return null}}
const hhAt=(m,wd)=>wd===0||wd===6?null:AD.hh.find(x=>m>=x.from&&m<x.to)||null;
// ближайшее окно после now: {name,k,in (мин)} — ищем до 7 дней вперёд, выходные пропускаем
export function hhNextAt(c){if(!c)return null;for(let d=0;d<8;d++){const wd=(c.wd+d)%7;if(wd===0||wd===6)continue;for(const h of AD.hh){const st=d*1440+h.from-c.m;if(st>0)return{name:h.name,k:h.k,in:st-c.sec/60}}}return null}
export function happy(state,now){const z=TZ[String(state||'').toUpperCase()];if(!z)return null;const c=zoneClock(z,now);if(!c)return null;const h=hhAt(c.m,c.wd);return h?{...h,min:c.m,left:h.to-c.m-c.sec/60}:null}
export function hhNext(state,now){const z=TZ[String(state||'').toUpperCase()];return z?hhNextAt(zoneClock(z,now)):null}
// «Волна»: рассвет идёт с востока на запад — у каждого пояса свой час. Для панели и тостов.
export const HHZ=[['Eastern','America/New_York','ET'],['Central','America/Chicago','CT'],['Mountain','America/Denver','MT'],['Pacific','America/Los_Angeles','PT']];
export function hhZones(now){return HHZ.map(([tz,z,ab])=>{const c=zoneClock(z,now);if(!c)return{tz,ab,on:null,next:null};const h=hhAt(c.m,c.wd);
 return{tz,ab,m:c.m,wd:c.wd,on:h?{name:h.name,k:h.k,left:h.to-c.m-c.sec/60,len:h.to-h.from}:null,next:hhNextAt(c)}})}
// сумма бонусов Addiction (дерево, реликвии, активные бусты, перк, связисты, серия норм) → {xAll,mAll (доли), x,m {cls:%}, fast, odSec, luck, sigK}
export function adTotals(root,now){const a=ensure(root),t={xAll:0,mAll:0,x:{},m:{},fast:0,odSec:0,luck:0,luckK:1,sigK:1,pity:0,purge:0,frz:0,themes:0};
 const add=b=>{if(!b)return;t.xAll+=b.xAll||0;t.mAll+=b.mAll||0;t.fast+=b.fast||0;t.odSec+=b.odSec||0;t.luck+=b.luck||0;t.pity+=b.pity||0;t.purge+=b.purge||0;t.frz+=b.frz||0;t.themes+=b.themes||0;
  if(b.sigK)t.sigK*=b.sigK;if(b.luckK)t.luckK*=b.luckK;for(const[k,v]of Object.entries(b.x||{}))t.x[k]=(t.x[k]||0)+v;for(const[k,v]of Object.entries(b.m||{}))t.m[k]=(t.m[k]||0)+v};
 for(const n of TREE){const l=a.tree[n.id]|0;if(l)add(n.fx(l))}
 for(const id in a.relic){const L=lootById(id);if(L&&L.relic)add(L.relic)}
 for(const x of a.act){const L=lootById(x.id);if(L&&x.left>0)add({xAll:L.xAll,mAll:L.mAll,x:L.x,m:L.m,fast:L.fast,odSec:L.odSec,luck:L.luck,sigK:L.sigK})}
 if(a.perk&&a.perk.pick&&now<a.perk.until){const p=PERKS3.find(x=>x.id===a.perk.pick);if(p)add(p)}
 const ops=opsBonus(a);t.xAll+=ops;t.mAll+=ops;
 const rb=RANK_BONUS[root.rank|0]||0;t.xAll+=rb;t.mAll+=rb;t.rank=rb;
 const nd=Math.min(AD.normDay.max,a.normDays*AD.normDay.per);t.xAll+=nd;t.mAll+=nd;return t}
// Суммируем все заработанные постоянные и временные бонусы; счастливый час применяется сверху.
const WARMC=['TRASH','GATEKEEPER','MINOR','TALK','CALLBACK'];
// Разгон: предложить ли входящий вызов (0 наборов сегодня и сегодня ещё не отвечал; тестировщику — при каждой загрузке)
// I1 v3. warm: {k, ans: 1 принял | -1 отклонил | 0 пропустил (время на принятие вышло), at, n0 — наборов на момент принятия, done — пройден, end — кончился, why, tries}
const minOf=t=>{const d=new Date(t);return d.getHours()*60+d.getMinutes()};
// Кусок 22: вызов — только в рабочий день (пн–пт) и только с 13:55 до 23:10 по часам компьютера (и тестировщику тоже).
// Отклонил — сегодня больше не звонит. Пропустил (10 минут не брал) — ещё один раз, не раньше чем через час.
export function warmWin(now){if(!isWork(now))return false;const m=minOf(now),[a,b]=AD.warm.from,[c,d]=AD.warm.to;return m>=a*60+b&&m<=c*60+d}
export function warmOffer(root,now,dayN,tester=false,loadedAt=now){const a=ensure(root),k=dayKey(now),w=a.warm;if(!warmWin(now))return false;if(dayN>0&&!tester)return false;
 if(tester)return true;if(w.k!==k||w.ans==null)return true;if(w.ans!==0)return false;
 return(w.tries||1)<2&&now-(w.at||0)>=AD.warm.retry*60000}
export function warmAnswer(root,now,yes,dayN=0,miss=false){const a=ensure(root),k=dayKey(now),tries=a.warm.k===k?(a.warm.tries||0)+1:1;a.warm={k,done:0,tries,ans:miss?0:yes?1:-1,at:now,n0:dayN};return a.warm}
// разгон идёт: принят сегодня, не пройден, не кончился, не вышли ни 10 минут, ни 5 наборов
export function warmState(root,now,dayN){const w=ensure(root).warm;if(w.k!==dayKey(now)||w.ans!==1)return null;const n=Math.max(0,dayN-(w.n0||0)),left=AD.warm.min*60000-(now-w.at);
 return{on:!w.done&&!w.end&&left>0&&n<AD.warm.n,n,left:Math.max(0,left),done:!!w.done,end:w.end||0,why:w.why||''}}
// таймер истёк раньше 5 наборов → разгон закончен без награды (вызывает UI раз в секунду)
export function warmTick(root,now,dayN){const w=ensure(root).warm,st=warmState(root,now,dayN);if(!st||w.done||w.end)return null;if(st.left<=0&&st.n<AD.warm.n){w.end=now;w.why='time';return{end:'time',n:st.n}}return null}
export function withAd(mods,root,now,state,dayN=0){const t=adTotals(root,now),hh=happy(state,now),r={...mods,m:{...(mods.m||{})},x:{...(mods.x||{})}};
 r.xAll=(mods.xAll||1)*(1+t.xAll/100);r.mAll=(mods.mAll||1)*(1+t.mAll/100);
 for(const k in t.x)r.x[k]=(r.x[k]||1)*(1+t.x[k]/100);for(const k in t.m)r.m[k]=(r.m[k]||1)*(1+t.m[k]/100);
 const a=ensure(root),k=dayKey(now);if(a.tr.k===k&&a.tr.done.t1)r.mAll*=1.1;          // награда цели «Наборы I»: ×1.1 $ до конца дня
 if(warmState(root,now,dayN)?.on){for(const c of WARMC){r.x[c]=(r.x[c]||1)*AD.warm.k;r.m[c]=(r.m[c]||1)*AD.warm.k}r.warm=AD.warm.k}
 if(hh){const ih=1+itemHH(root.meta&&root.meta.owned)/100;r.xAll*=hh.k*ih;r.mAll*=hh.k*ih;r.hh=hh}r.fast=(mods.fast||0)+t.fast;r.odSec=(mods.odSec||0)+t.odSec;return r}
const rollTier=(w,rnd)=>{const tot=Object.values(w).reduce((a,b)=>a+b,0);let x=rnd()*tot;for(const[k,v]of Object.entries(w)){if((x-=v)<0)return k}return'c'};
// hh — идёт счастливый час: в пул добавляются вещи с hh:1 (двойной вес); вне часа их нет
export function pickLoot(tier,rnd=Math.random,hh=false){const p=LOOT.filter(x=>x.r===tier&&(!x.hh||hh)),q=hh?[...p,...p.filter(x=>x.hh)]:p;return q[rnd()*q.length|0]}
// выдать предмет: мгновенные срабатывают сразу, бусты в рюкзак, реликвии навсегда (повтор реликвии = Сигнал)
export function grant(root,G,id,y=1){const a=ensure(root),L=lootById(id),out={id,instant:[]};if(!L)return out;
 if(L.relic){if(a.relic[id]){a.sig+=200;a.sigLife+=200;out.instant.push('+200 Сигнала (реликвия уже есть)')}else{a.relic[id]=Date.now();out.instant.push('реликвия навсегда')}a.stats.legend++;return out}
 if(L.jack){const m=Math.round(L.jack*C.assumedDailyMoney*y);G.money+=m;out.money=m;out.instant.push('+$'+m)}
 if(L.sigNow){a.sig+=L.sigNow;a.sigLife+=L.sigNow;out.instant.push('+'+L.sigNow+' Сигнала')}
 if(L.freeze){a.frz.ch=Math.min(AD.freeze.max+adTotals(root,0).frz+1,a.frz.ch+L.freeze);out.instant.push('+1 Заморозка')}
 if(L.shield){a.shield+=L.shield;out.instant.push('щит от Ночной чистки')}
 if(L.calls)a.inv[id]=(a.inv[id]||0)+1;if(L.r==='l')a.stats.legend++;return out}
export function activate(root,id){const a=ensure(root),L=lootById(id);if(!L||!L.calls||!(a.inv[id]>0))return{ok:false,why:'нет в рюкзаке'};
 if(a.act.filter(x=>x.left>0).length>=3)return{ok:false,why:'Активно уже 3 буста'};a.inv[id]--;if(!a.inv[id])delete a.inv[id];a.act.push({id,left:L.calls});return{ok:true}}
// ВСЁ, что происходит после засчитанного статуса. Возвращает события для интерфейса. rnd — для тестов.
export function adAfter(root,G,ev,now,{state,dayN=0,lead='',rnd=Math.random,hhMods=null}={}){const a=ensure(root),k=dayKey(now),y=C.districts[G.district-1][3],cls=ev.cls,o={};
 const t=adTotals(root,now),hh=happy(state,now);
 // Сигнал
 const sg=Math.round((AD.sig[cls]||1)*(hh?2:1)*t.sigK);a.sig+=sg;a.sigLife+=sg;o.sig=sg;
 // активные бусты тратят заряд
 for(const x of a.act)if(x.left>0)x.left--;a.act=a.act.filter(x=>x.left>0);
 // заморозка: заряд за каждые 25 наборов дня
 if(a.frz.k!==k){a.frz.k=k;a.frz.got=0}const shouldHave=Math.floor(dayN/AD.freeze.per);if(shouldHave>a.frz.got){const mx=AD.freeze.max+t.frz;const add=shouldHave-a.frz.got;a.frz.got=shouldHave;const b=a.frz.ch;a.frz.ch=Math.min(mx,a.frz.ch+add);if(a.frz.ch>b)o.freeze=a.frz.ch}
 // разгон
 {const ws=warmState(root,now,dayN),w=a.warm;if(ws&&!w.done&&!w.end&&ws.n>=AD.warm.n&&now-w.at<AD.warm.min*60000){w.done=now;w.end=now;w.why='done';const m=Math.round(AD.warm.share*C.assumedDailyMoney*y);G.money+=m;a.sig+=AD.warm.sig;a.sigLife+=AD.warm.sig;o.warm={money:m,sig:AD.warm.sig}}}
 // гарант
 if(!a.pity.at)a.pity.at=AD.pity[0]+Math.floor(rnd()*(AD.pity[1]-AD.pity[0]+1));
 const win=cls==='BOOKED'||cls==='DISCOVERY';if(win)a.pity.n=0;else{a.pity.n++;a.gap=(a.gap==null?AD.gap:a.gap)+1}const gapOk=(a.gap==null?AD.gap:a.gap)>=AD.gap;
 if(!win&&gapOk&&a.pity.n>=Math.max(AD.gap,a.pity.at-t.pity)){a.pity.n=0;a.pity.at=AD.pity[0]+Math.floor(rnd()*(AD.pity[1]-AD.pity[0]+1));const tier=rollTier(AD.wChest,rnd),it=pickLoot(tier,rnd,!!hh);o.spin={chest:1,tier,id:it.id,got:grant(root,G,it.id,y)};a.stats.chests++}
 // рулетка Шума
 else if(gapOk&&AD.roul.from.includes(cls)){const ch=Math.min(AD.roul.cap,(AD.roul.base+a.pity.n*AD.roul.perFail+t.luck)*(hh?AD.roul.hh:1)*t.luckK);
  if(rnd()<ch){const tier=rollTier(AD.w,rnd),it=pickLoot(tier,rnd,!!hh);o.spin={chest:0,tier,id:it.id,got:grant(root,G,it.id,y)};a.stats.spins++}}
 if(o.spin){a.gap=0;a.drops.unshift({t:now,id:o.spin.id,tier:o.spin.tier,chest:o.spin.chest});a.drops=a.drops.slice(0,40)}
 // цели дня
 if(a.tr.k!==k)a.tr={k,done:{},hh:0,sig0:a.sigLife-sg};if(hh)a.tr.hh=(a.tr.hh||0)+1;
 const d=(root.days||{})[k]||{n:0,c:{}},val=x=>x.kind==='dials'?dayN:x.kind==='talk'?(d.c.TALK||0)+(d.c.CALLBACK||0)+(d.c.BOOKED||0)+(d.c.DISCOVERY||0):x.kind==='gk'?(d.c.GATEKEEPER||0):x.kind==='hh'?a.tr.hh:x.kind==='streak'?(d.bs||0):a.sigLife-(a.tr.sig0||0);
 o.tracks=[];for(const x of tracksFor(k))if(!a.tr.done[x.id]&&val(x)>=x.n){a.tr.done[x.id]=now;const r={...x};
  if(x.rew==='sig'){a.sig+=60;a.sigLife+=60}else if(x.rew==='chest'||x.rew==='epic'){const tier=x.rew==='epic'?rollTier(AD.wChest,rnd):rollTier({r:70,e:25,l:5},rnd),it=pickLoot(tier,rnd);r.spin={chest:1,track:x.name+' · '+x.n,tier,id:it.id,got:grant(root,G,it.id,y)};if(x.rew==='epic'){a.sig+=200;a.sigLife+=200}}
  o.tracks.push(r)}
 if(!o.spin){const c=o.tracks.find(x=>x.spin);if(c)o.spin=c.spin}
 // перк 1 из 3
 if(a.perk.k!==k){const old=a.perk,active=old.pick&&now<old.until;a.perk={k,at:0,opts:null,pick:active?old.pick:null,until:active?old.until:0}}
 if(dayN>0&&dayN%AD.perk.every===0&&a.perk.at!==dayN){const pool=PERKS3.slice(),opts=[];while(opts.length<3)opts.push(pool.splice(rnd()*pool.length|0,1)[0].id);a.perk.at=dayN;a.perk.opts=opts;o.perk=opts}
 // рейд
 if(a.raid&&a.raid.on){const R=a.raid;if(now>R.dl){o.raid={burned:R.m,n:R.n};a.raid=null;a.stats.burn=(a.stats.burn||0)+1}
  else{R.n++;R.m+=ev.m||0;G.money-=ev.m||0;o.raidM=ev.m||0;R.dl=now+(AD.raid.gap[cls]||180)*1000;if(R.n>=AD.raid.n){const pay=Math.round(R.m*R.k);G.money+=pay;o.raid={extracted:pay,base:R.m,n:R.n};a.raid=null;a.stats.raids=(a.stats.raids||0)+1}}}
 return o}
// 1 из 3: выбрать
export function pickPerk(root,id,now){const a=ensure(root),p=PERKS3.find(x=>x.id===id);if(!p||!a.perk.opts||!a.perk.opts.includes(id))return{ok:false};
 a.perk.pick=id;a.perk.until=now+AD.perk.min*60000;a.perk.opts=null;if(p.freeze)a.frz.ch=Math.min(AD.freeze.max+adTotals(root,now).frz+1,a.frz.ch+1);return{ok:true,p}}
// дерево
export function buyTree(root,id){const a=ensure(root),n=TREE.find(x=>x.id===id);if(!n)return{ok:false};const l=a.tree[id]|0;if(l>=6)return{ok:false,why:'ветка закрыта до конца'};
 const c=treeCost(l);if(a.sig<c)return{ok:false,why:'нужно '+c+' Сигнала'};a.sig-=c;a.tree[id]=l+1;return{ok:true,lv:l+1,cost:c}}
// Связисты
export function buyRoom(root,G){const a=ensure(root),o=a.ops;if(!o.plot)o.plot=1;const slot=o.bld.findIndex(x=>!x),sl=slot<0?o.bld.length:slot;if(sl>=6)return{ok:false,why:'все комнаты построены'};return colBuild(a,G,sl,'room')}   // старый API: «комната» = Каморка в Коллекторе
export const synOk=root=>{const st=root.story||{};return !!(st.syn||(st.seen||{})['sys-syn']||((root.ad||{}).ops||{}).n>0)};
export function hireOp(root,G){const a=ensure(root);if(!synOk(root))return{ok:false,why:'Связистов пока нет: о них расскажут в районе 2'};if(a.ops.n>=capOf(a.ops))return{ok:false,why:'нет места: построй здание в Коллекторе'};const c=OPS.opCost(a.ops.n);if(G.money<c)return{ok:false,why:'нужно $'+c};G.money-=c;a.ops.n++;return{ok:true,cost:c}}
// заморозка
export function freezeOn(root,now){const a=ensure(root);if(a.frz.on)return{ok:false,why:'уже заморожено'};if(a.frz.ch<1)return{ok:false,why:a.frz.got?'заряды кончились':'первый заряд — после 25 наборов'};a.frz.ch--;a.frz.on=1;a.frz.at=now;a.stats.frz=(a.stats.frz||0)+1;return{ok:true}}
export function freezeOff(root,now){const a=ensure(root);if(!a.frz.on)return 0;const d=Math.min(now-a.frz.at,AD.freeze.sec*1000);a.frz.on=0;if(a.raid&&a.raid.on)a.raid.dl+=d;return d}
// рейд
export function raidStart(root,now){const a=ensure(root);if(a.raid&&a.raid.on)return{ok:false};a.raid={on:1,start:now,n:0,m:0,k:AD.raid.k,dl:now+15*60000};return{ok:true}}
export function raidCheck(root,G,now){const a=ensure(root),R=a.raid;if(!R||!R.on)return null;if(now>R.dl){const r={burned:R.m,n:R.n};a.raid=null;a.stats.burn=(a.stats.burn||0)+1;return r}return null}
export function raidHold(root,now,sec=60){const R=ensure(root).raid;if(R&&R.on)R.dl=Math.max(R.dl,now+sec*1000)}
// Ночная чистка (B4): рабочие дни после последней проверки до вчера включительно
// сколько снимет чистка за день с n наборами: f — доля недобора, red — защита (Стойкость, выбор b7)
const purgeRed=(root,now)=>Math.max(0,1-adTotals(root,now).purge)*(root.story&&root.story.ch&&root.story.ch.b7==='wipe'?.5:1);
// XP: при любой невыполненной норме — 10% всего пути района или цена 30 звонков, что больше.
// Защита применяется после расчёта; нельзя снять больше накопленного прогресса. Деньги по-прежнему зависят от недобора.
const callXp=(root,G,now)=>{let xs=0,ns=0;const days=root.days||{};for(let i=1;i<=7;i++){const d=days[dayKey(now-i*864e5)];if(d&&d.n){xs+=d.xp||0;ns+=d.n}}return ns>=20&&xs>0?xs/ns:C.assumedDailyXp*C.districts[(G.district||1)-1][3]/AD.norm};
const purgeCut=(root,G,now,f,red,a)=>({dx:f>0?Math.min(Math.max(0,G.dxp||0),Math.round(Math.max(districtThr(G.district||1)*AD.purge.share,30*callXp(root,G,now))*red)):0,dm:Math.round(Math.max(0,G.money)*AD.purge.mShare*f*red),op:f>=.5&&a.ops.n>0?1:0});
// ПРЕДПРОСМОТР для предупреждения (кусок 26б): что снимет ночь, если сегодня останется n наборов. Ничего не меняет.
// → {n,norm,left,dx,dm,op,shield,pct — доля пути по району, calls — сколько наборов «стоит» этот XP по твоему среднему}
export function purgePreview(root,G,now,n){const a=ensure(root),f=Math.max(0,1-n/AD.norm),c=purgeCut(root,G,now,f,purgeRed(root,now),a),thr=districtThr(G.district||1);
 const per=callXp(root,G,now);
 return{n,norm:AD.norm,left:Math.max(0,AD.norm-n),...c,shield:a.shield|0,lostStreak:a.normDays|0,pct:thr?c.dx/thr*100:0,calls:Math.round(c.dx/per)}}
export function nightly(root,G,now){const a=ensure(root),today=dayKey(now),days=root.days||{},out=[];
 if(!a.purge.chk){a.purge.chk=dayKey(now-864e5);return out}               // первый запуск после обновления: задним числом не наказываем
 const played=Object.keys(days).filter(k=>days[k]&&days[k].n>0).sort(),first=played[0]||'9999';   // дни до первого звонка вообще не считаются
 let t=now-864e5,keys=[];for(let i=0;i<AD.purge.lookback;i++,t-=864e5){const k=dayKey(t);if(k<=a.purge.chk||k<first)break;keys.push([k,t])}keys.reverse();
 const anyPlay=played.length>0;
 for(const[k,t]of keys){if(!isWork(t)||!anyPlay)continue;const n=(days[k]||{n:0}).n;
  if(n>=AD.norm){a.normDays++;continue}
  const f=1-n/AD.norm,red=purgeRed(root,now);if(a.shield>0){a.shield--;out.push({k,n,shield:1});a.normDays=0;continue}
  if(out.filter(x=>!x.shield).length>=AD.purge.maxDays)continue;
  const {dx,dm,op}=purgeCut(root,G,t,f,red,a);
  G.dxp=Math.max(0,(G.dxp||0)-dx);G.money-=dm;if(op){a.ops.n--;opLeft(a)}const lostStreak=a.normDays;a.normDays=0;out.push({k,n,f,dx,dm,op,lostStreak})}
 {const completed=dayKey(now-864e5);if(completed>a.purge.chk)a.purge.chk=completed}if(out.length){a.purge.log.unshift(...out.map(x=>({...x,at:now})));a.purge.log=a.purge.log.slice(0,30)}return out}
// Сравнения v3 (кусок 17): личные рекорды и «обычный ты», прямо после статуса, когда внимание свободно.
// Рекорды (save.gh.rec): f20 — самые быстрые 20 наборов подряд (мс), b10 — лучшие 10 минут, b60 — лучший час, p100 — больше всего
// питчей (TALK…DISCOVERY) на последние 100 наборов, ft — меньше всего наборов до первого питча дня, day — рекорд наборов за день.
// Порядок показа: побит рекорд (золото, звук) → питч/встреча (как идёшь против обычного) → «идёшь на рекорд» → темп против обычного дня.
const TALKC=['TALK','CALLBACK','BOOKED','DISCOVERY'],MEETC=['BOOKED','DISCOVERY'];
// J1: питч — только «Owner pitched & Hang Up», CALL BOOKED, CONDUCTED DISCOVERY CALL (Owner hung up в начале — не питч)
export const PITCH_IDS=[3,4,14];export const isPitch=(id,cls)=>id!=null?PITCH_IDS.includes(id):TALKC.includes(cls);
const slotOf=now=>Math.floor((now-new Date(new Date(now).toDateString()).getTime())/6e5);
export const mmssR=ms=>{const t=Math.round(ms/1000);return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')};
const REC_N={p20:'Питчей за 20 минут',f20:'Быстрые 20 наборов',b10:'Лучшие 10 минут',b60:'Лучший час',p100:'Питчей на 100 наборов',ft:'Первый питч дня',day:'Наборов за день'};
export function ghostRec(root,now,cls,sid=null){const g=root.gh||(root.gh={k:'',t:[],bestH:0,days:{}}),k=dayKey(now);g.rec=g.rec||{};
 if(g.k!==k){g.k=k;g.t=[];g.pt=[];g.ms=[];g.tl=0;g.mt=0;g.ft=0;g.rec0={...g.rec};g.shown={}}
 g.rec0=g.rec0||{...g.rec};g.shown=g.shown||{};g.tk=g.tk||{};g.t.push(now);g.pt=g.pt||[];const isT=isPitch(sid,cls);if(isT){g.pt.push(now);g.tl=(g.tl||0)+1;if(!g.ft)g.ft=g.t.length}if(MEETC.includes(cls))g.mt=(g.mt||0)+1;
 g.r100=((g.r100||'')+(isT?'1':'0')).slice(-100);
 const T=g.t,n=T.length,h=T.filter(x=>x>now-36e5).length,m10=T.filter(x=>x>now-6e5).length,f20=n>=20?now-T[n-20]:null,p100=g.r100.length>=100?[...g.r100].filter(c=>c==='1').length:null,p20=g.pt.filter(x=>x>now-12e5).length;
 g.bestH=Math.max(g.bestH||0,h);
 const slot=slotOf(now),day=g.days[k]||(g.days[k]={});day[slot]=n;const tk=g.tk[k]||(g.tk[k]={});tk[slot]=g.tl||0;
 const ks=Object.keys(g.days).sort();for(const x of ks.slice(0,-31)){delete g.days[x];delete g.tk[x]}
 // обновить рекорды; объявлять, только если побит рекорд прошлых дней (а не тот, что сам поставил минуту назад) и не чаще раза в 10 мин на рекорд
 const cur={b10:m10,b60:h,day:n,f20,p100,p20,ft:isT&&g.tl===1?g.ft:null},better={p20:(a,b)=>a>b,b10:(a,b)=>a>b,b60:(a,b)=>a>b,day:(a,b)=>a>b,p100:(a,b)=>a>b,f20:(a,b)=>a<b,ft:(a,b)=>a<b};
 const min={p20:3,b10:8,b60:20,day:30,p100:3,f20:1,ft:1},ms=[];
 for(const id in cur){const v=cur[id];if(v==null)continue;const old=g.rec[id];if(old==null||better[id](v,old))g.rec[id]=v;
  const r0=g.rec0[id];if(r0!=null&&better[id](v,r0)&&(id==='f20'||id==='ft'||v>=min[id])&&(!g.shown[id]||now-g.shown[id]>6e5)){g.shown[id]=now;
   const fm=x=>id==='f20'?mmssR(x):x;ms.push({k:'win',id,t:`РЕКОРД · ${REC_N[id]}: ${fm(v)}${id==='ft'?' набора':''} (был ${fm(r0)})`});g.rec0[id]=v}}
 const wc=weekCheck(root,now);if(wc)ms.push(wc);
 return{h,m10,f20,p100,p20,slot,n,cls,ms,pitch:isT}}
const cumAt=(day,slot)=>{let v=0;for(const s in day)if(+s<=slot)v=Math.max(v,day[s]);return v};
const pl3=(n,a,b,c)=>{const m=n%100,k=n%10;return m>10&&m<20?c:k===1?a:k>=2&&k<=4?b:c};
const sg=v=>(v>0?'+':v<0?'−':'±')+Math.abs(v);
// «обычный ты»: среднее по последним 5 дням с наборами к этому же времени
const usual=(src,k,slot)=>{const P=Object.entries(src||{}).filter(([x])=>x<k).slice(-5).map(([,d])=>cumAt(d,slot)).filter(v=>v>0);return P.length?Math.round(P.reduce((a,b)=>a+b,0)/P.length):0};
export function ghostLine(root,now,i=0,rec=null){const g=root.gh;if(!g||!g.t.length)return null;if(rec&&rec.ms&&rec.ms.length)return rec.ms[0];
 const k=dayKey(now),slot=slotOf(now),n=g.t.length,R=g.rec0||{},tm=new Date(now).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'});
 const cls=rec&&rec.cls,m10=rec?rec.m10:g.t.filter(x=>x>now-6e5).length,h=rec?rec.h:g.t.filter(x=>x>now-36e5).length;
 if(cls&&MEETC.includes(cls))return{k:'up',h:'Встреча',t:`Встреча №${g.mt} за сегодня. До неё ты сделал ${n} ${pl3(n,'звонок','звонка','звонков')}`};
 // питч (кусок 18): только хорошие новости — обогнал, сравнялся, почти сравнялся. Если до рекорда далеко — просто счёт за 20 минут.
 if(cls&&(rec&&rec.pitch!=null?rec.pitch:TALKC.includes(cls))){const p=rec&&rec.p100,p20=rec&&rec.p20!=null?rec.p20:(g.pt||[]).filter(x=>x>now-12e5).length;
  if(p!=null&&R.p100){if(p>R.p100)return{k:'up',h:'Питч',t:`Питч №${g.tl}. Из последних 100 звонков питчем закончились ${p} — больше твоего рекорда (${R.p100})`,p:1};
   if(p===R.p100)return{k:'up',h:'Питч',t:`Питч №${g.tl}. Из последних 100 звонков питчем закончились ${p} — столько же, сколько в твоём рекорде`,p:1};
   if(p>=R.p100-2)return{k:'near',h:'Питч',t:`Питч №${g.tl}. Из последних 100 звонков питчем закончились ${p}. До рекорда (${R.p100}) не хватает ${R.p100-p+(p<R.p100?0:1)}`,p:p/R.p100}}
  if(R.p20&&p20>=2){if(p20>R.p20)return{k:'up',h:'Питч',t:`Питч №${g.tl}. За последние 20 минут питчей ${p20} — больше твоего рекорда (${R.p20})`,p:1};
   if(p20===R.p20)return{k:'up',h:'Питч',t:`Питч №${g.tl}. За последние 20 минут питчей ${p20} — столько же, сколько в рекорде`,p:1};
   if(p20===R.p20-1)return{k:'near',h:'Питч',t:`Питч №${g.tl}. За последние 20 минут питчей ${p20}. Ещё один — и ты догонишь рекорд (${R.p20})`,p:p20/R.p20}}
  const u=usual(g.tk,k,slot);if(u&&g.tl>=u)return{k:'up',h:'Питч',t:`Питч №${g.tl}. Обычно к ${tm} у тебя ${u} ${pl3(u,'питч','питча','питчей')}${g.tl>u?`, сегодня ты впереди на ${g.tl-u}`:', сегодня столько же'}`};
  return{k:'up',h:'Питч',t:`Питч №${g.tl} за сегодня${p20>1?`. За последние 20 минут — ${p20}`:''}`}}
 const L=[];
 // идёшь на рекорд
 if(R.b10>=8&&m10>=R.b10-3&&m10<=R.b10)L.push({k:'near',h:'Темп',t:`За последние 10 минут ты сделал ${m10} ${pl3(m10,'звонок','звонка','звонков')}. Твой рекорд — ${R.b10}. Ещё ${R.b10-m10+1}, и он побит`,p:m10/R.b10});
 if(R.f20){const inWin=g.t.filter(x=>x>now-R.f20).length;if(inWin>=14&&inWin<20)L.push({k:'near',h:'Темп',t:`Твой рекорд — 20 звонков за ${mmssR(R.f20)}. Сейчас ты идёшь так же быстро: ${inWin} из 20. Не сбавляй`,p:inWin/20})}
 if(R.b60>=20&&h>=R.b60*.85&&h<=R.b60)L.push({k:'near',h:'Темп',t:`За последний час — ${h} ${pl3(h,'звонок','звонка','звонков')}. Рекорд часа — ${R.b60}: ещё ${R.b60-h+1}, и он побит`,p:h/R.b60});
 if(L.length)return L[i%L.length];
 const u=usual(g.days,k,slot);if(u>0)L.push({k:n>=u?'up':'down',h:'Ты против себя обычного',t:`Обычно к ${tm} ты успеваешь ${u} ${pl3(u,'звонок','звонка','звонков')}. Сегодня ${n} — ${n>=u?(n>u?`на ${n-u} больше`:'столько же'):`на ${u-n} меньше`}`,p:Math.min(1,n/u)});
 return L.length?L[i%L.length]:null}
// неделя: раз в неделю, когда неделя обгоняет лучшую из прошлых (по понедельникам счёт с нуля)
export function weekCheck(root,now){const g=root.gh;if(!g)return null;const days=root.days||{},d=new Date(now),dow=(d.getDay()+6)%7;let w=0;for(let i=0;i<=dow;i++)w+=((days[dayKey(now-i*864e5)]||{}).n||0);
 const wk=dayKey(now-dow*864e5);g.wk=g.wk||{best:0,k:'',told:''};if(g.wk.k!==wk){if(g.wk.k&&g.wk.cur>g.wk.best)g.wk.best=g.wk.cur;g.wk.k=wk;g.wk.b0=g.wk.best}g.wk.cur=w;
 if(g.wk.b0>=50&&w>g.wk.b0&&g.wk.told!==wk){g.wk.told=wk;return{k:'win',t:`Эта неделя уже лучшая: ${w} наборов (прошлый рекорд ${g.wk.b0})`}}return null}
// ранг стиля (D3) по темпу за 15 минут и «владельцу на линии»
export const styleRank=(rate,talk15)=>rate>=60||(rate>=45&&talk15)?'SSS':rate>=50?'SS':rate>=40?'S':rate>=30?'A':rate>=20?'B':rate>=10?'C':'D';
