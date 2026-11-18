// DIALER: публичный API рабочей логики (без DOM). UI подписывается на события и вызывает методы. Поведение = старый дайлер.
// События: leadChanged, leadsLoaded, sourceStateChanged, callRinging/callConnected/callEnded/callLogged (из ZoomProvider), statusSet, statusCleared,
// pauseChanged, zoomStateChanged, syncReport, toast, milestone, guardMark, openUrl, suggest, saveState, tableChanged.
import {EventBus} from '../core/eventbus.js';
import {Table,today} from './table.js';
import {Queue,pickerData} from './queue.js';
import {SheetsSync,parseSheetUrl,testConnection} from './sheets.js';
import {ZoomBridge} from './zoom.js';
import {HangupGuard} from './hangup.js';
import {BUTTONS,PRIM,WIN,sheetValue,statusIndex,statusColor,SHEET_VALUES} from './statuses.js';
import {tempo} from './tempo.js';
import {localTime,lstate,zone} from './geo.js';
// Date Engaged (кусок 26в, просьба пользователя): дата и время звонка по часам того, кому звонишь — «2026-11-05 3:40 PM CST». Пояс неизвестен — только дата.
export const engaged=(t,l,d)=>{const lt=localTime(t,l,d);return today(d)+(lt?' '+lt.time+' '+lt.tz:'')};
import {getAppsScript} from './apps-script.js';
const J=(st,k,d)=>{try{return JSON.parse(st.getItem(k)||"null")??d}catch(e){return d}};
export {BUTTONS,PRIM,WIN,SHEET_VALUES,parseSheetUrl};
export const SPRINT=25; // спринт: 25 звонков (4 спринта = 100, на сотне — большой праздник)
export class Dialer{
 // env: {store(localStorage), fetch, now, setTimeout, clearTimeout, setInterval, kv(m,k,v) IndexedDB «pd», https, zoomSend(msg), zoomProvider, confirm, isEditing(l), random}
 constructor(env){const E=this.env=Object.assign({now:()=>Date.now(),setTimeout:(f,t)=>setTimeout(f,t),clearTimeout:t=>clearTimeout(t),setInterval:(f,t)=>setInterval(f,t),confirm:()=>true,isEditing:()=>false,random:Math.random},env);
  this.bus=E.bus||new EventBus();this.t=new Table();this.q=new Queue(this.t);this.FH=null;this.recent=[];this.BK=null;
  this.P=Object.assign({files:{},pad:"",padOpen:true,sheets:{}},J(E.store,"pd2",{}));this.P.sheets=Object.assign({url:"",token:"",on:false},this.P.sheets);this.P.srcs=this.P.srcs||[];
  if(this.P.hangupOnStatus==null)this.P.hangupOnStatus=true;if(this.P.hangupOnSkip==null)this.P.hangupOnSkip=true;   // решения пользователя: оба вкл, отключаемы
  this.q.only=this.P.only!==false;this.auto=this.P.auto!==false;this.paused=false;this.calling=false;this.t0=0;this.call=null;
  this.saved=null;this.saveErr="";this.ps=0;this.wB=false;this.wD=false;
  // кусок 34: счёт дня и спринт живут по игровым суткам (с 10:00 по часам ПК, как у игры), а не по календарной полуночи. Дата в pd2s прежнего формата (ГГГГ-ММ-ДД).
  const s=J(E.store,"pd2s",null),d=this.dk(E.now()),same=s&&(s.d==d||(s.d==today(new Date(E.now()))&&new Date(E.now()).getHours()<10));
  this.ses=same?{d,tot:s.tot|0,sprint:s.sprint|0,tFirst:s.tFirst|0,times:s.times||[],dset:new Set(s.dset||[])}:{d,tot:0,sprint:0,tFirst:0,times:[],dset:new Set()};
  this.sprLeft=!same&&s&&(s.sprint|0)>0?(s.sprint|0):0;   // хвост вчерашнего спринта: интерфейс покажет, как шкала падает до нуля
  const em=(k,v)=>this.bus.emit(k,v);
  this.sheets=new SheetsSync({table:this.t,cfg:()=>E.readOnly?{...this.P.sheets,on:false}:this.P.sheets,fileTab:()=>(this.P.files[this.t.name]||{}).tab||this.t.name,store:E.store,fetch:E.fetch,setTimeout:E.setTimeout,clearTimeout:E.clearTimeout,now:E.now,
   isEditing:l=>E.isEditing(l),confirm:m=>E.confirm(m),busyLocal:()=>!!(this.ps||this.wB||this.wD),kv:E.kv,emit:(k,v)=>{if(k=='leadsReplaced')this.q.keep(v.keep);if(k=='tableChanged'){this.persist();em('leadChanged',this.view())}em(k,v)}});
  this.zoom=new ZoomBridge({provider:E.zoomProvider,send:m=>E.zoomSend&&E.zoomSend(m),prefs:()=>this.P,savePrefs:()=>this.sp(),emit:em,https:!!E.https,setTimeout:E.setTimeout,clearTimeout:E.clearTimeout});
  this.hang=new HangupGuard({activeCall:()=>this.call,sendHangup:id=>this.zoom.hangup(id),sendDial:n=>this._send(n),now:E.now});
  this.bus.on('callRinging',c=>{this.call={id:c.callId,ended:null}});
  this.bus.on('callEnded',c=>{if(this.call&&this.call.id===c.callId)this.call.ended=c.at;this.hang.onEnded(c.callId);this.calling=false;em('leadChanged',this.view())});
  this.bus.on('zoomEnded',()=>{this.calling=false});}
 dk(t){const f=this.env&&this.env.dayKey;return f?f(t):today(new Date(t))}   // игровые сутки: env.dayKey (core/stats.js); без него — календарная дата (старое поведение)
 // новые игровые сутки: счёт дня и спринт с нуля; событие dayRolled {left} — шкала спринта падает до нуля (left — сколько было)
 rollDay(){const d=this.dk(this.env.now());if(this.ses.d===d)return false;const left=this.ses.sprint|0;this.ses={d,tot:0,sprint:0,tFirst:0,times:[],dset:new Set()};this.sesSave();this.emit('dayRolled',{left,day:d});return true}
 takeSprLeft(){const n=this.sprLeft|0;this.sprLeft=0;return n}
 // «Закончить смену»: неполный спринт сгорает (шкала падает до нуля). Сотня дня (tot) не трогается. → сколько было в шкале
 endSprint(){const s=this.ses,left=s.sprint|0;if(left<=0)return 0;s.sprint=0;s.spStart=0;this.sesSave();this.emit('sprintDrain',{left,why:'shift'});return left}
 // сверка с игрой: число засчитанных за игровой день статусов главное. Если счёт дайлера разошёлся (старая полночная граница, статус задним числом), берём число игры.
 syncCount(n){const s=this.ses;n=n|0;if(n<0||s.tot===n)return false;s.tot=n;if(s.sprint>=SPRINT)s.sprint=SPRINT-1;if(s.sprint>n)s.sprint=n;this.sesSave();return true}
 sp(){try{this.env.store.setItem("pd2",JSON.stringify(this.P))}catch(e){}}
 sesSave(){if(this.env.readOnly)return;const s=this.ses;try{this.env.store.setItem("pd2s",JSON.stringify({d:s.d||this.dk(this.env.now()),tot:s.tot,sprint:s.sprint,tFirst:s.tFirst,times:s.times,dset:[...s.dset]}))}catch(e){}}
 emit(k,v){this.bus.emit(k,v)}
 get cur(){return this.q.cur}
 // ---- снимок для UI (ничего не рисует) ----
 view(){const t=this.t,l=this.cur,n=this.q.next(),r=l?t.res(l):"";
  return{loaded:t.loaded,name:t.name,source:t.src?'sheet':this.FH?'file':t.loaded?'memory':'none',lead:l?{biz:t.get(l,"Business"),type:t.get(l,"Type of company"),state:lstate(t,l),phone:t.ph(l),rawPhone:t.get(l,"Phone"),
    site:t.get(l,"Website"),map:t.get(l,"Google Maps link"),reviews:t.get(l,"Reviews"),address:t.get(l,"Adress")||t.get(l,"Address"),verification:t.get(l,"Verification"),email:t.get(l,"Email"),other:t.get(l,"Other"),
    notes:t.get(l,"Notes"),callback:t.get(l,"Callback?"),prep:t.prep(l),result:r,resultIndex:statusIndex(r,this.P.map),resultColor:r?statusColor(r,this.P.map):null,local:localTime(t,l,new Date(this.env.now())),zone:(zone(t,l)||{}).z||null}:null,
   next:n?t.get(n,"Business"):null,remaining:this.q.remaining(),calling:this.calling,callSec:this.calling?Math.floor((this.env.now()-this.t0)/1000):0,paused:this.paused,auto:this.auto,only:this.q.only,
   canBack:this.q.hc>0,hasPrep:t.hasPrep(),filter:{...this.q.f},suggest:this.zoom.sug,saved:this.saved,saveErr:this.saveErr,exhausted:t.loaded&&!l}}
 tempo(){this.rollDay();return tempo(this.ses.times.map(x=>x.t),this.env.now(),this.ses.tFirst)}       // UI зовёт раз в 5 с
 // ---- источники ----
 loadText(text,name){this.t.loadText(text,name);const p=this.P.files[name]||{};this.q.start=Math.min(p.start||0,this.t.L.length-1);this.q.f={type:p.type||"",state:p.state||"",tz:p.tz||""};
  this.saved=null;this.saveErr="";this.q.reinit();this.emit('leadsLoaded',{count:this.t.L.length,name,head:this.t.h});this.emit('leadChanged',this.view())}
 async openFile(h){try{if(h.requestPermission&&await h.requestPermission({mode:"readwrite"})!="granted"){this.emit('toast',"Нужен доступ к файлу на запись");return false}
   const f=await h.getFile();this.loadText(await f.text(),h.name);this.FH=h;this.addRecent(h);this.sheets.pump();this.env.setTimeout(()=>this.sheets.pull(),1500);return true}
  catch(e){this.emit('toast',"Не удалось открыть: "+e.message);return false}}
 async addRecent(h){const kv=this.env.kv;if(!kv)return;try{let r=(await kv("get","rc"))||[];const k=await Promise.all(r.map(x=>x.isSameEntry(h).catch(()=>false)));r=r.filter((x,i)=>!k[i]);r.unshift(h);r=r.slice(0,8);await kv("put","rc",r);this.recent=r}catch(e){}}
 async openSheetUrl(u){if(u&&String(u).trim()){this.P.lastSheetUrl=String(u).trim();this.sp()}const s=parseSheetUrl(u);if(!s){this.emit('toast',"Это не ссылка на Google Таблицу");return false}return this.openSheet(s)}
 async openSheet(src){this.emit('toast',"Загружаю таблицу…");const o=await this.sheets.open(src);if(!o.ok){this.emit('toast',o.error);if(o.cfg)this.emit('openSettings',{section:'dialer'});return false}
  const r=o.r;this.P.sheets.on=true;this.t.loadSheet(r,src);this.FH=null;const p=this.P.files[this.t.name]||{};this.q.start=Math.min(p.start||0,Math.max(this.t.L.length-1,0));this.q.f={type:p.type||"",state:p.state||"",tz:p.tz||""};
  this.saved=null;this.saveErr="";this.q.reinit();this.P.srcs=[{id:src.id,gid:r.gid,name:this.t.name},...this.P.srcs.filter(x=>!(x.id==src.id&&x.gid==r.gid))].slice(0,8);this.sp();
  this.emit('leadsLoaded',{count:this.t.L.length,name:this.t.name,head:this.t.h});this.emit('leadChanged',this.view());this.sheets.pump();this.bkSoon(1);return true}
 async switchBase(){try{await this.flush()}catch(e){}this.t.L=[];this.t.src=null;this.FH=null;this.q.hist=[];this.q.hc=-1;this.emit('leadsLoaded',{count:0});this.emit('leadChanged',this.view())}
 // ---- запись в файл (тот же файл, формат сохраняется) и резервная копия в папку ----
 async persist(){this.env.clearTimeout(this.ps);this.ps=0;if(this.env.readOnly)return;if(!this.FH){if(this.t.src)this.bkSoon();return}this.wD=true;if(this.wB)return;this.wB=true;
  try{while(this.wD){this.wD=false;const w=await this.FH.createWritable();await w.write(this.t.serialize());await w.close()}this.saved=new Date(this.env.now());this.saveErr=""}catch(e){this.saveErr=e.message||"ошибка"}
  this.wB=false;this.emit('saveState',{saved:this.saved,error:this.saveErr})}
 persistSoon(){this.env.clearTimeout(this.ps);const l=this.cur;this.ps=this.env.setTimeout(()=>{this.persist();this.sheets.sync(l,0)},1200)}
 async flush(){await this.persist();while(this.wB)await new Promise(r=>this.env.setTimeout(r,40))}
 bkSoon(now){if(!this.t.src)return;this.env.clearTimeout(this.bkT);this.bkT=this.env.setTimeout(()=>this.bkWrite(),now?300:20000)}
 async bkWrite(){if(!this.BK||!this.t.src||this.env.readOnly)return;try{if(await this.BK.queryPermission({mode:"readwrite"})!="granted"){this.bkNeed=1;this.emit('saveState',{needBackupPermission:true});return}
   const nm=(this.t.name||"table").replace(/[\\\/:*?"<>|]/g,"_")+".csv",fh=await this.BK.getFileHandle(nm,{create:true}),w=await fh.createWritable();await w.write(this.t.serializeCsv());await w.close();this.saved=new Date(this.env.now());this.saveErr="";this.bkNeed=0}
  catch(e){this.saveErr=e.message||"ошибка"}this.emit('saveState',{saved:this.saved,error:this.saveErr})}
 async setBackupDir(h){this.BK=h;if(this.env.kv)await this.env.kv("put","bk",h).catch(()=>{});this.bkSoon(1)}
 tsv(){return this.t.serializeTsv()}
 // ---- звонок ----
 dial(){const l=this.cur;if(!l||!this.t.ph(l))return false;this.emit('guardMark',{});this.calling=true;this.t0=this.env.now();this.zoom.sug=-1;this.hang.dial(this.t.ph(l));this.emit('leadChanged',this.view());return true}
 _send(n){const how=this.zoom.call(n);if(how==='app'&&this.env.manualProvider)this.env.manualProvider.ring(n);if(how==='blocked'){this.calling=false;this.emit('leadChanged',this.view())}return how}
 hangup(src='button'){const r=this.hang.request(src);if(r==='sent')this.calling=false;return r}
 lastCallId(){const c=this.call;return c&&c.ended==null?c.id:null}
 _autoHang(kind){if(!(kind=='status'?this.P.hangupOnStatus:this.P.hangupOnSkip))return'off';const c=this.call;if(!c||c.ended!=null)return'none';return this.hang.request('status')}
 // статус по индексу кнопки (0..14). Повтор того же статуса = убрать (как раньше). waitFn(meta) → мс задержки автонабора (праздники игры)
 // env.canStatus(k,lead,opt) => {ok,why,dur,min}: игра может ЗАПРЕТИТЬ статус (встреча короче 3 мин по Zoom). Тогда в таблицу ничего не пишется.
 setStatus(k,waitFn,opt={}){const t=this.t,l=this.cur;if(!l)return null;const had=t.res(l),v=sheetValue(k,this.P.map);
  if(had==v){this.clearStatus(l);return{cleared:true}}
  if(this.env.canStatus){const c=this.env.canStatus(k,{phone:t.ph(l)},opt);if(c&&!c.ok){const r={refused:c.why,dur:c.dur,min:c.min,index:k};this.emit('statusRefused',r);return r}}
  const back=this.env.backAt?this.env.backAt(t.ph(l)):null;t.put(l,"Result",v);t.put(l,"Date Engaged",engaged(t,l,new Date(back||this.env.now())));this.q.touch(l);const wasCalling=this.calling;this.calling=false;
  this.persist();this.sheets.sync(l,1);const hang=wasCalling||this.call&&this.call.ended==null?this._autoHang('status'):'none';
  const ms=had?null:this.tally(l),meta={index:k,name:BUTTONS[k].name,value:v,changed:!!had,prev:had,win:WIN.includes(k),milestone:ms,lead:{biz:t.get(l,"Business"),state:lstate(t,l),phone:t.ph(l)},hangup:hang,back};
  this.emit('statusSet',meta);
  const fresh=this.q.advance(),wait=waitFn?waitFn(meta):(ms&&ms.kind=='hundred')?2800:meta.win?1000:0,tgt=this.cur;this.emit('leadChanged',this.view());
  if(fresh&&this.auto&&!this.paused&&tgt){const go=()=>{if(this.cur!==tgt||this.paused||this.calling)return;if(this.held){this.pend=tgt;return}this.dial()};if(wait)this.env.setTimeout(go,wait);else go()}
  return meta}
 clearStatus(l=this.cur){const t=this.t;if(!l||!t.res(l))return false;const prev=t.res(l);t.put(l,"Result","");t.put(l,"Date Engaged","");this.persist();this.sheets.sync(l,1);
  const p=t.ph(l);if(this.ses.dset.has(p))this.untally(p);this.emit('statusCleared',{lead:t.get(l,"Business"),phone:p,prev});this.emit('toast',"Статус убран");this.emit('leadChanged',this.view());return true}
 // кусок 28: игра держит автонабор, пока открыто окно находки (Шум, сундук, выбор усиления); release() — закрыли окно → звоним
 hold(on){if(on){this.held=true;return}this.held=false;const t=this.pend;this.pend=null;if(t&&this.cur===t&&this.auto&&!this.paused&&!this.calling)this.dial()}
 skip(){const l=this.cur;if(!l)return false;if(this.calling||this.call&&this.call.ended==null)this._autoHang('skip');this.calling=false;this.q.touch(l);this.persist();this.sheets.sync(l,0);this.q.advance();this.emit('leadChanged',this.view());return true}
 back(){if(!this.q.back()){this.emit('toast',"Это первый лид сессии");return false}this.calling=false;this.emit('leadChanged',this.view());return true}
 pause(){this.paused=!this.paused;this.pauseAt=this.paused?this.env.now():0;this.emit('pauseChanged',{paused:this.paused,at:this.pauseAt});this.emit('leadChanged',this.view());
  if(!this.paused&&this.auto&&this.cur&&!this.calling&&!this.t.res(this.cur))this.dial()}
 // ---- счёт дня (смысл старой геймификации: спринт 25 (было 20, просьба пользователя) и праздник на каждые 100 — событие milestone для игры) ----
 tally(l){this.rollDay();const s=this.ses,p=this.t.ph(l),n=this.env.now();s.tot++;s.sprint++;if(s.sprint===1)s.spStart=n;if(!s.tFirst)s.tFirst=n;s.times.push({t:n,p});s.dset.add(p);
  let ms=null;if(s.sprint>=20){const d=n-(s.spStart||n);if(!this.P.best||d<this.P.best){this.P.best=d;this.sp()}}
  if(s.tot%100==0){s.sprint=0;ms={kind:'hundred',n:s.tot}}else if(s.sprint>=SPRINT){s.sprint=0;ms={kind:'sprint',n:s.tot,ms:n-(s.spStart||n)}}
  this.sesSave();return ms}
 untally(p){const s=this.ses;if(s.sprint>0)s.sprint--;else if(s.tot>0)s.sprint=SPRINT-1;s.tot=Math.max(0,s.tot-1);s.times=s.times.filter(x=>x.p!==p);s.dset.delete(p);this.sesSave()}
 // ---- поля лида ----
 setNotes(v){const l=this.cur;if(!l)return;this.t.put(l,"Notes",v);this.persistSoon()}
 setCallback(v){const l=this.cur;if(!l)return;this.t.put(l,"Callback?",v);this.persistSoon()}
 // ---- выбор лида и фильтры ----
 picker(M){return pickerData(this.t,this.q,M,this.cur,this.P.map,this.env.now())}
 unstatus(i){const l=this.t.L[i];return l?this.clearStatus(l):false}
 saveScope(){const p=this.P.files[this.t.name]||(this.P.files[this.t.name]={});p.start=this.q.start;Object.assign(p,this.q.f);this.sp()}
 pickLead(i,f={}){this.q.pick(i,f);this.saveScope();this.calling=false;this.emit('leadChanged',this.view())}
 setFilter(f,clear){this.q.slice(f,clear);this.saveScope();this.emit('leadChanged',this.view())}
 setOnly(v){this.q.only=!!v;this.P.only=this.q.only;this.sp();this.q.reinit();this.emit('leadChanged',this.view())}
 setAuto(v){this.auto=!!v;this.P.auto=this.auto;this.sp();this.emit('leadChanged',this.view())}
 setPref(k,v){this.P[k]=v;this.sp()}
 // ---- шпаргалка (локальная, как раньше в P.pad) и значения статусов в таблицу ----
 openCheatSheet(){this.P.padOpen=!this.P.padOpen;this.sp();this.emit('padToggled',{open:this.P.padOpen});return this.P.padOpen}
 setPad(text){this.P.pad=text;this.sp()}
 setMap(i,v){(this.P.map=this.P.map||{})[BUTTONS[i].name]=String(v).trim();this.sp()}
 resetMap(){this.P.map={};this.sp()}
 mapping(){return BUTTONS.map(b=>({...b,value:sheetValue(b.i,this.P.map)}))}
 // ---- Apps Script и подключение ----
 rndSecret(){const A="abcdefghjkmnpqrstuvwxyz23456789",a=Array.from({length:20},()=>A[Math.floor(this.env.random()*A.length)]);this.P.sheets.token=a.join("");this.sp();return this.P.sheets.token}
 getAppsScript(){return getAppsScript(this.P.sheets.token)}
 setSheets(o){Object.assign(this.P.sheets,o);this.sp();this.sheets.changed()}
 testConnection(){return testConnection(this.sheets)}
 tick(){this.hang.tick()}                                   // UI зовёт ~раз в 250 мс (защита отбоя)
}
