import {CONFIG as C,STATUS,districtThr} from './config.js';
const MS=1000,steps=C.heat.steps,stepOf=n=>steps.reduce((k,t,i)=>n>=t?i:k,0);
export const xpMult=m=>1+(m-1)*C.heat.xpShare;
export const newState=now=>({xp:0,money:0,lifeXp:0,district:1,dxp:0,carry:0,streak:0,step:0,last:null,lastCls:null,ulta:0,od:null,paused:null,shiftStart:now||0,undo:[],odBase:0});
const snapOf=s=>{const{undo,...r}=s;return JSON.stringify(r)};
export function rate(s,cls,now){const hi=C.hi.includes(cls);
 if(s.od&&now<s.od.until&&hi)return{m:C.od.money,x:C.od.xp,od:1};
 const k=(s.ulta>0||(s.od&&now<s.od.until))?steps.length-1:s.step,m=C.heat.money[k];return{m,x:xpMult(m),od:0}}
// ЕДИНОЕ начисление XP/$ (статусы, бонус за разговор, поздние логи Zoom, директивы): только здесь меняется
// прогресс района и проверяется захват. Возвращает XP, реально ушедший в район.
// Окно серии по логу Zoom (идея пользователя): считается время ОТ КОНЦА прошлого звонка ДО начала следующего,
// время разговора не в счёт. Сколько даётся, зависит от прошлого статуса (жирнее статус = больше времени).
export const afterCall=id=>{const v=C.afterCallSec;return v.byId[id]??v[STATUS[id]?STATUS[id].cls:'TRASH']??v.TRASH};
export function gain(s,x,m,hi,ev={}){const thr=districtThr(s.district);
 if(s.district>=C.finishFromDistrict&&!hi){const cap=Math.max(0,thr-1-s.dxp);if(x>cap){s.carry+=x-cap;ev.immune=true}x=Math.min(x,cap)}
 s.xp+=x;s.money+=m;s.lifeXp+=x;let dx=x;if(s.debt>0){const p=Math.min(s.debt,dx);s.debt-=p;dx-=p}s.dxp+=dx;
 if(s.dxp>=thr){const extra=s.dxp-thr;if(s.district<12){s.district++;s.dxp=s.carry+extra;s.carry=0}else s.dxp=thr;ev.captured=true}
 return x}
export function apply(s,id,now,o={}){const st=STATUS[id],cls=o.cls||st.cls,cc=C.classes[cls],hi=C.hi.includes(cls),before=snapOf(s),ev={cls,pen:null,spam:false,captured:false,odStart:false,odEnd:false,tier:null};
 if(s.od&&now>=s.od.until){ev.odEnd=s.od;s.od=null}
 const gap=o.gapMs!=null?o.gapMs:s.last==null?0:now-s.last,max=((o.mods&&o.mods.maxGap)||C.maxGapMin)*60*MS;
 if(o.re)ev.re=true;
 else if(s.last!=null&&now-s.last<C.antispamSec*MS&&!(o.callStart!=null&&o.callStart>s.last)){ev.spam=true;ev.spamGap=now-s.last} // антиспам: 2 статуса чаще 3 с (награда 0). Если по Zoom был настоящий звонок ПОСЛЕ прошлого статуса — это не спам
 else if(s.last!=null){
  if(gap>max||o.sinceEndedMs>max){s.step=s.ulta=0;s.streak=1;s.od=null;ev.pen='reset'}
  else{const z=o.callStart!=null&&s.lastEnd!=null,g2=z?o.callStart-s.lastEnd:gap;ev.timing=z?'zoom':'status';
   const allowed=z?(afterCall(s.lastId)+(C.classes[s.lastCls].win?0:(o.mods&&o.mods.fast||0)))*MS:C.classes[s.lastCls].win?C.winMaxGapMin*60*MS:(C.fastSec+(o.mods&&o.mods.fast||0)+(C.statusGapSec[s.lastId]!=null?C.statusGapSec[s.lastId]-C.fastSec:C.crmFrom.includes(s.lastCls)?C.crmSec:0))*MS;
   ev.gap=g2;ev.allowed=allowed;
   if(g2<=allowed){if(s.ulta>0)s.ulta--;s.streak++;s.step=stepOf(s.streak)}else{s.step=0;s.ulta=0;s.streak=1;s.od=null;ev.pen='drop'}}   // J4: окно кончилось — серия и множитель сгорают полностью
 }else{s.streak++;s.step=stepOf(s.streak)}
 if(ev.pen){s.odBase=0;s.odTalk=0}
 if(!ev.spam&&!ev.re&&!s.od&&hi)s.odTalk=(s.odTalk||0)+1;   // Q10а: «владелец на линии» внутри набора серии к Overdrive
 if(!ev.spam&&!ev.re&&!ev.pen&&!s.od&&s.streak-s.odBase>=C.od.streak&&(s.odTalk||0)>=(C.od.needTalk||0)){s.od={until:now+(C.od.sec+(o.mods&&o.mods.odSec||0))*MS,n:0,money:0,xp:0};s.odBase=s.streak;s.odTalk=0;ev.odStart=true}
 const r=rate(s,cls,now),y=C.districts[s.district-1][3],d0=s.district,bonus=Math.min(o.bonus||0,C.bonusCap),sp=ev.spam?((o.mods&&o.mods.spamK)||C.antispamMult):1;
 const md=o.mods||{},mx=((md.x&&md.x[cls])||1)*(md.xAll||1),mm=((md.m&&md.m[cls])||1)*(md.mAll||1);let x=Math.round(cc.xp*r.x*y*(1+bonus)*sp*mx),m=Math.round(cc.money*r.m*y*(1+bonus)*sp*mm),thr=districtThr(s.district);
 x=gain(s,x,m,hi,ev);
 if(s.od&&r.od||s.od&&!hi){s.od.n++;s.od.money+=m;s.od.xp+=x}
 if(cc.win&&!ev.re)s.ulta=C.ulta.n;
 if(!ev.spam&&!ev.re){s.last=now;s.lastCls=cls;s.lastId=id;s.lastEnd=o.callEnd!=null?o.callEnd:null}
 s.undo.push({t:now,id,before,x,m,cm:r.m,cx:r.x,cls,d:d0,inc:!ev.spam&&!ev.re&&!ev.pen?1:0,od:ev.odStart?1:0});if(s.undo.length>1)delete s.undo[s.undo.length-2].before;if(s.undo.length>C.undoKeep)s.undo.shift(); // снимок только у последней (полный Undo); остальные лёгкие, чтобы X работал и через недели
 ev.x=x;ev.m=m;ev.mult=r;ev.step=s.step;return ev}
// Undo. Убрать статус = вернуть РОВНО то, что он принёс (решение пользователя):
//  full (последний статус, ≤ undoSec): всё из снимка (как будто статуса не было), включая серию, Heat, Ульту, OD.
//  worth (старый статус): вычитаются $, XP аккаунта, XP района (с учётом бонуса за разговор); его +1 к серии;
//  Ульта/Overdrive, которые он включил, гаснут. Захват района не отменяется (сюжет уже сыгран): если в текущем
//  районе XP меньше, чем надо вернуть, остаток становится долгом (debt) и списывается из следующих начислений.
//  Ачивки, задания, счётчики дня/жизни, трофей откатывает Session.
export function undo(s,now,i=s.undo.length-1){const u=s.undo[i];if(!u)return false;
 if(i===s.undo.length-1&&now-u.t<=C.undoSec*MS){const keep=s.undo.slice(0,-1);Object.assign(s,JSON.parse(u.before));s.undo=keep;return 'full'}
 s.money-=u.m;s.xp=Math.max(0,s.xp-u.x);s.lifeXp=Math.max(0,s.lifeXp-u.x);const take=Math.min(s.dxp,u.x);s.dxp-=take;if(u.x>take)s.debt=(s.debt||0)+u.x-take;
 if(u.inc&&s.streak>0){s.streak--;s.step=Math.min(s.step,stepOf(s.streak));s.odBase=Math.min(s.odBase,s.streak)}
 if(C.classes[u.cls].win&&!s.undo.slice(i+1).some(x=>C.classes[x.cls].win))s.ulta=0;
 if(u.od&&s.od&&!s.undo.slice(i+1).some(x=>x.od))s.od=null;
 s.undo.splice(i,1);return 'worth'}
export function pause(s,now){if(s.paused==null)s.paused=now}
export function resume(s,now){if(s.paused==null)return;const p=s.paused,d=Math.max(0,Math.min(now-p,180000));s.paused=null;
 // J4: старая пауза (поставлена ДО последнего звонка) ничего не сдвигает — иначе «последний звонок» улетал в будущее и серия не сгорала (1416м)
 if(p>=Math.max(s.last||0,s.lastEnd||0)){if(s.last!=null)s.last+=d;if(s.lastEnd!=null)s.lastEnd+=d}if(s.od)s.od.until+=d;heal(s,now)}
// J4: время последнего звонка никогда не в будущем (лечит старые сохранения)
export function heal(s,now){if(s.last!=null&&s.last>now)s.last=now;if(s.lastEnd!=null&&s.lastEnd>now)s.lastEnd=now;return s}
// Бонус за время разговора (5.4): только TALK/CALLBACK/BOOKED/DISCOVERY, можно задним числом.
export function talkBonus(s,entry,dur){if(!C.hi.includes(entry.cls)||!dur)return{x:0,m:0};
 const n=Math.min(C.talkBonus.cap,Math.floor(Math.max(0,dur-C.talkBonus.after)/C.talkBonus.per)),y=C.districts[(entry.d||s.district)-1][3];
 const ev={captured:false},x0=Math.round(n*C.talkBonus.xp*entry.cx*y),m=Math.round(n*C.talkBonus.money*entry.cm*y),x=gain(s,x0,m,true,ev);
 entry.x+=x;entry.m+=m;return{x,m,captured:ev.captured}}
export const verified=(id,dur)=>{const m=STATUS[id].min??C.minTalkSec[STATUS[id].cls];return !m||(dur!=null&&dur>=m)};
export const bossState=s=>{const t=districtThr(s.district),f=s.dxp/t;return f<1-C.bossPhaseShare?'scenery':s.dxp>=t-1&&s.district>=C.finishFromDistrict?'finish':'boss'};

// Индикатор серии для HUD: множитель, сколько до следующей ступени, и таймер окна (когда серия сгорит).
// onLine: сейчас идёт звонок => таймер заморожен (разговор не в счёт). mode: 'zoom' (от конца звонка) | 'status'.
export function windowState(s,now,{onLine=false,zoom=true,callStart=null,fast=0}={}){if(s.paused!=null&&now>s.paused&&s.paused>=Math.max(s.last||0,s.lastEnd||0))now-=Math.min(now-s.paused,180000);   // I2: старая пауза (до последнего звонка) не замораживает таймер   // пауза/Заморозка: таймеры на экране стоят
const k=(s.ulta>0||(s.od&&now<s.od.until))?steps.length-1:s.step,next=steps[s.step+1];
 const base={streak:s.streak,step:s.step,mult:C.heat.money[k],toNext:next!=null?next-s.streak:null,nextMult:next!=null?C.heat.money[s.step+1]:null,ulta:s.ulta,od:s.od&&now<s.od.until?Math.round((s.od.until-now)/MS):0,odProg:Math.max(0,s.streak-s.odBase),odNeed:C.od.streak,odTalk:s.odTalk||0,odTalkNeed:C.od.needTalk||0,debt:s.debt||0};
 if(s.last==null||!s.streak)return{...base,state:'idle',left:null};
 const z=zoom&&s.lastEnd!=null,from=z?s.lastEnd:s.last,allowed=z?afterCall(s.lastId)+(C.classes[s.lastCls].win?0:fast):C.classes[s.lastCls].win?C.winMaxGapMin*60:C.fastSec+fast+(C.statusGapSec[s.lastId]!=null?C.statusGapSec[s.lastId]-C.fastSec:C.crmFrom.includes(s.lastCls)?C.crmSec:0);
 const checkAt=onLine&&callStart!=null?Math.min(now,callStart):now,left=Math.min(allowed,Math.ceil((from+allowed*MS-checkAt)/MS));
 if(onLine&&(callStart==null||checkAt<=from+allowed*MS))return{...base,state:'online',left:null};if(left<=0)return{...base,streak:0,step:0,mult:C.heat.money[0],toNext:steps[1]!=null?steps[1]:null,nextMult:C.heat.money[1]??null,ulta:0,od:0,odProg:0,odTalk:0,state:'lost',left:0,allowed,mode:z?'zoom':'status'};   // J4: сгорело — на экране сразу 0 и x1
 return{...base,state:left>0?(left<=10?'hurry':'ok'):'lost',left:Math.max(0,left),allowed,mode:z?'zoom':'status'}}
