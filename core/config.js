// Все числа игры живут здесь. Названия статусов НЕ менять: они уходят в таблицу.
export const CONFIG={
 schemaVersion:2,version:'r2p24',title:'UPLINK SYNDICATE',subtitle:'COLD LINE',tabTitle:'UPLINK SYNDICATE', // название игры и вкладки: рабочее, меняется ТОЛЬКО здесь
 assumedDailyXp:3500,assumedDailyMoney:3900, // 3500/3900 откалиброваны симуляцией (tools/sim.mjs): железный день = ~3560 XP / ~3960 $

 classes:{TRASH:{xp:8,money:6,pts:1,fast:1},GATEKEEPER:{xp:12,money:10,pts:1,fast:1},MINOR:{xp:15,money:10,pts:1,fast:1},
  TALK:{xp:35,money:30,pts:2},CALLBACK:{xp:45,money:40,pts:2},BOOKED:{xp:500,money:600,pts:10,win:1},DISCOVERY:{xp:900,money:1200,pts:15,win:1}},
 hi:['TALK','CALLBACK','BOOKED','DISCOVERY'],crmFrom:['TALK','CALLBACK'],
 heat:{steps:[0,4,10,20],money:[1,1.25,1.5,2],xpShare:.6},
 fastSec:60,crmSec:180,statusGapSec:{2:180,3:300}, // ОБЩЕЕ окно от статуса до следующего звонка, чтобы Heat не упал: обычно 60 с; после «Owner hung up в начале» (id 2) ровно 3 мин; после «Owner pitched & Hang Up» (id 3) ровно 5 мин; после Call back/Follow up 60+180 с
 afterCallSec:{TRASH:30,GATEKEEPER:30,MINOR:45,TALK:60,CALLBACK:180,BOOKED:1200,DISCOVERY:1200,byId:{}}, // окно по логу Zoom: от КОНЦА прошлого звонка до НАЧАЛА следующего (сек), по прошлому статусу. Только в коде, не в настройках (иначе чит)
 maxGapMin:40,winMaxGapMin:40,heatDropMode:'oneStep',
 antispamSec:3,redialMinSec:30,testerCallSec:360,undoKeep:5000,antispamMult:0,undoSec:60,pauseMaxSec:0,bonusCap:.5,
 ulta:{n:5},
 od:{streak:25,sec:300,money:3,xp:2.2,needTalk:1}, // Q10а: 25 звонков серии, среди них хотя бы 1 «владелец на линии» (TALK/CALLBACK/BOOKED/DISCOVERY); 5 минут; предметы/союзники/перк добавляют секунды (mods.odSec). Цифры — на общий пересмотр баланса
 talkBonus:{xp:3.5,money:2.6,cap:18,per:30,after:60},
 minTalkSec:{TALK:15,CALLBACK:20,BOOKED:180,DISCOVERY:300}, // BOOKED/DISCOVERY короче этого по Zoom = статус НЕЛЬЗЯ поставить
 bossPhaseShare:.1,finishFromDistrict:3,
 cancelStatusId:0,countInbound:false,logWaitMin:10,staleRingingMin:60,health:{lagYellowMs:8000,fullYellow:.9,fullRed:.6,minCalls:5},autoStatusOnCancel:false,
 // Баланс v3 (кусок 18): [номер, имя, «рабочих дней» наборов по плану, рост наград за звонок].
 // Пороги пересчитаны по симуляции полных смен с действительными предметами и связистами без потолка.
 // Последовательный рост числа звонков — ориентир, не гарантия: встречи, Волна и перенос XP вносят разброс.
 districts:[[1,'Scrapyard',1.164,1],[2,'Industrial Zone',1.4136,1.2],[3,'Neon Docks',2.19965,1.45],[4,'Night Market',2.18799,1.75],[5,'Commercial Hub',2.94392,2.1],[6,'Chrome Plaza',2.63626,2.5],[7,'Cyber-Downtown',3.85528,3],[8,'Financial Spire',4.0868,3.6],[9,'Sky District',5.3465,4.3],[10,'Airport Ring',8.72508,5.2],[11,'The Station',9.25071,6.2],[12,'The Summit',13.25467,7.5]]
};
// [название (как в таблице), класс, клавиша дайлера]. Порядок = индексы ST в дайлере.
export const STATUS=[
 ['Автоответчик: Были гудки','TRASH','1'],['Автоответчик: Не перезванивать','TRASH','2'],['Owner hung up в начале','TALK','3'],
 ['Owner pitched & Hang Up','TALK','4'],['CALL BOOKED','BOOKED','5'],['GATEKEEPER','GATEKEEPER','6'],['Другое','MINOR','7'],
 ['Автоответчик (leaved vm)','TRASH','8'],['Menu (=not owner mobile number)','TRASH','9'],['Не соединяет','TRASH','0'],
 ['Номер не рабочий','TRASH','Q'],['Непонятная хуйня','MINOR','W'],['Call back','CALLBACK','E'],['Follow up in future','CALLBACK','R'],
 ['CONDUCTED DISCOVERY CALL','DISCOVERY','T']].map(([name,cls,key],id)=>({id,name,cls,key}));
export const classOf=name=>(STATUS.find(s=>s.name===name)||{cls:'MINOR'}).cls; // новый статус = MINOR
// Коэффициент порога от версии E3: меняем кривую районов отдельно, не затрагивая цены.
// Порог растёт вместе с ним, чтобы каждый следующий район требовал чуть больше реальных наборов, а не меньше.
export const BONUS_K=[1,1.06,1.12,1.19,1.26,1.33,1.4,1.46,1.52,1.57,1.61,1.65];
// Мерка для существующих цен и денежных наград; реальный доход зависит от купленных усилений.
export const MONEY_K=BONUS_K;
// «усилие ресурсами» сверх роста дохода: каждая следующая полка рынка и проход стоят на 6% больше дней дохода
export const PRICE_GROW=d=>1+.06*(d-1);
// ожидаемый доход за рабочий день в районе d (с бонусами) — мерка для цен, проходов и денежных наград
export const shiftMoneyAt=d=>CONFIG.assumedDailyMoney*CONFIG.districts[d-1][3]*(MONEY_K[d-1]||1);
export const districtThr=d=>{const x=CONFIG.districts[d-1];return Math.round(x[2]*CONFIG.assumedDailyXp*x[3]*(BONUS_K[d-1]||1))};
STATUS[2].min=3; // «Owner hung up в начале» короткий по природе: свой порог верификации (сек)
