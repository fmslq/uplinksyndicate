// Session: игровой контроллер без DOM. Объединяет engine + flow + stats + achv + missions + трофеи.
// Бывший мост (bridge.js) делал это поверх старого дайлера; теперь это отдельный, тестируемый слой.
// ПОЛНЫЙ UNDO (ТЗ rework §15): вместе с ресурсами откатываются открытые ачивки, выполненные задания
// (и деньги за них), запись recent, максимумы дня, запечатанный трофей. Для этого перед каждым статусом
// снимается «боковой снимок» (side) только для ПОСЛЕДНЕЙ записи undo (старые не хранят его: сохранение не пухнет).
import {newState,undo as gUndo,pause as gPause,resume as gResume,heal as gHeal} from './engine.js';
import {statusFlow,lateLog,winCheck,group} from './flow.js';
import {record,unrecord,dominance,rankOf,levelOf,dayKey,usHour} from './stats.js';
import {evaluate} from './achv.js';
import {checkMissions,modsFor} from './missions.js';
import {withItems} from './buffs.js';
import {STATUS,CONFIG as C} from './config.js';
import {withAllies,allyTrack} from './allies.js';
import {keysInit,needKey,keyTrack} from './keys.js';
import {laterHoldOf} from './bosslater.js';
import {withAd,adAfter,ghostRec,ensure as adEnsure,nightly,raidCheck,freezeOff,AD} from './addict.js';

// Чистка: трофей, у которого в журнале статусов найден НЕ победный статус того же лида и времени, убирается.
export function cleanTrophies(root,G){const T=root.trophies;if(!T||!T.length||!G||!G.undo)return 0;const n=T.length;
  root.trophies=T.filter(t=>{const u=G.undo.find(x=>x.lead===t.lead&&x.t===t.t);return !u||STATUS[u.id]&&STATUS[u.id].cls===(t.kind==='gold'?'BOOKED':'DISCOVERY')});return n-root.trophies.length}
const J=x=>JSON.stringify(x===undefined?null:x);
export function sideSnapshot(root,now){const k=dayKey(now);
  return J({k,day:(root.days||{})[k]||null,life:root.life||null,recent:root.recent||null,ach:root.ach||null,
   mdone:(root.mdone||{})[k]||null,trophies:root.trophies||null,wasNobody:root.wasNobody||0,rank:root.rank??null,lvl:root.lvl??null,ad:root.ad||null,gh:root.gh||null})}
export function sideRestore(root,snap){const o=JSON.parse(snap),put=(obj,key,v)=>{if(v==null)delete obj[key];else obj[key]=v};
  root.days=root.days||{};put(root.days,o.k,o.day);put(root,'life',o.life);put(root,'recent',o.recent);put(root,'ach',o.ach);
  root.mdone=root.mdone||{};put(root.mdone,o.k,o.mdone);put(root,'trophies',o.trophies);root.wasNobody=o.wasNobody;put(root,'rank',o.rank);put(root,'lvl',o.lvl);put(root,'ad',o.ad);put(root,'gh',o.gh)}

// Два провайдера (Zoom приоритетен, ручной «Позвонить» запасной): статус закрывает оба.
export const makeCombo=(zp,mp)=>({takeCall(now){const z=zp.takeCall(now),m=mp.takeCall(now);return z&&(!m||z.ringing>=m.ringing-15000)?z:m},
  bind(id,st){if(zp.calls.has(id))zp.bind(id,st);else{const c=zp.takeCall(Infinity);if(c)zp.bind(c.id,st)}const m=mp.takeCall(Infinity);if(m)mp.bind(m.id,st)},health:()=>zp.health(),zoom:zp});

export class Session{
  constructor({root,bus,prov,now=Date.now,gate=null}){this.root=root;this.bus=bus;this.prov=prov;this.now=now;this.gate=gate;
    if(root.dayStartVersion!==10){const d=new Date(now()),old=new Date(now()-5*36e5),oldKey=old.getFullYear()+'-'+String(old.getMonth()+1).padStart(2,'0')+'-'+String(old.getDate()).padStart(2,'0');if(d.getHours()>=5&&d.getHours()<10&&root.manualWins&&root.manualWins.day===oldKey)root.manualWins.day=dayKey(now());root.dayStartVersion=10}
    const g=root.game;this.G=g&&Array.isArray(g.undo)?g:newState(now());root.game=this.G;gHeal(this.G,now());if(this.G.paused!=null&&!(root.ad&&root.ad.frz&&root.ad.frz.on))this.G.paused=null;
    root.meta=Object.assign({owned:{},bossIntro:{},staggered:{},captured:{}},root.meta||{});cleanTrophies(root,this.G);keysInit(root,this.G)}
  emit(t,d){this.bus&&this.bus.emit(t,d)}
  // lead: {key, phone, business, state}; had: текущий статус лида (смена статуса = «re»)
  // Guard на уровне логики (не только оверлей): gate() => {ok,code}. Пока таблица не подтверждена, статус
  // в таблицу пишет дайлер, но игра ничего не начисляет. Приложение ОБЯЗАНО передать gate (ui/app в части 4).
  setGate(fn){this.gate=fn}
  mods(now,state){const d=(this.root.days||{})[dayKey(now)]||{n:0},dir=this.root.dir&&this.root.dir.k===dayKey(now)?this.root.dir.pick:null;return withAd(withAllies(withItems(modsFor(dir||'',d.n),this.root.meta&&this.root.meta.owned,d.n,usHour(now,state)),this.root,this.G,now),this.root,now,state,d.n)}
  // Можно ли поставить статус (дайлер спрашивает ДО записи в таблицу): {ok, why, dur, min}
  manualLeft(now=this.now()){const q=this.root.manualWins;return Math.max(0,5-(q&&q.day===dayKey(now)?q.used:0))}
  precheck(id,lead,{now=this.now(),late=false,manualWin=false}={}){if(manualWin){const g=this.gate?this.gate():{ok:true};if(this.G.last!=null&&now-this.G.last<C.antispamSec*1000)return{ok:false,why:'manualWait'};return{ok:!!(g&&g.ok&&STATUS[id]&&C.classes[STATUS[id].cls].win&&this.manualLeft(now)>0),why:'manualLimit'}}const c=group(this.prov.zoom||this.prov,this.prov.takeCall(now),this.G.last),w=winCheck(id,c,{phone:lead&&lead.phone},now,{late});
    return{ok:w.v==='ok'||w.v==='nodata',why:w.v,dur:w.dur,min:w.min,unverified:w.v==='nodata'}}
  setStatus(id,lead,{had=false,now=this.now(),isKnown,late=false,back=null,manualWin=false}={}){const root=this.root,G=this.G;
    const g=this.gate?this.gate():{ok:true};if(!g||!g.ok){const out={ev:null,meta:null,blocked:g&&g.code||'locked',achv:[],missions:[]};this.emit('blocked',out.blocked);return out}
    if(manualWin&&(!STATUS[id]||!C.classes[STATUS[id].cls].win||!this.manualLeft(now)))return{ev:null,blocked:'manualLimit',achv:[],missions:[]};
    if(manualWin&&G.last!=null&&now-G.last<C.antispamSec*1000)return{ev:null,blocked:'manualWait',achv:[],missions:[]};
    if(had)this.dropLead(lead.key,now);
    const side=sideSnapshot(root,now),d0=(root.days||{})[dayKey(now)]||{n:0},dir=root.dir&&root.dir.k===dayKey(now)?root.dir.pick:null;
    const dx0=G.dxp,dd0=G.district;
    const r=statusFlow(G,id,now,this.prov,{phone:lead.phone},{re:!!had,isKnown,late,manualWin,mods:this.mods(now,lead.state)});
    if(r.blocked){const out={ev:null,meta:r.meta,blocked:r.blocked,dur:r.dur,min:r.min,achv:[],missions:[]};this.emit('statusRefused',out);return out}
    const out={ev:r.ev,meta:r.meta,achv:[],missions:[],rankUp:null,levelUp:null,trophy:null};
    if(!r.ev){this.emit('offList',r.meta);return out}
    if(manualWin){const k=dayKey(now),q=root.manualWins&&root.manualWins.day===k?root.manualWins:{day:k,used:0};q.used++;root.manualWins=q}
    const u=r.entry;u.lead=lead.key;if(back!=null&&back<now)u.rt=back;out.back=u.rt||null;   // I8: звонили в прошлый день — статус в статистику того дня
    // E4: без ключа прогресс района копится в G.keyHold (XP и $ игроку идут как обычно)
    if(needKey(root,G)){const h=G.district===dd0?Math.max(0,G.dxp-dx0):G.dxp;if(h>0){G.dxp-=h;G.keyHold=(G.keyHold||0)+h;u.held=h;out.held=h}}
    else{const lh=laterHoldOf(G,dx0,dd0);if(lh){u.lh=lh;out.later=lh}}   // I6: бой отложен — урон боссу копится
    for(const x of G.undo)if(x!==u)delete x.side;         // боковой снимок только у последней записи
    u.side=side;
    // re-статус тоже записывается: старая запись только что снята dropLead, иначе звонок пропадал из дня (баг черновика);
    // а перевод лида в CALL BOOKED/DISCOVERY раньше вообще не создавал трофей.
    if(!r.ev.spam)this.after(r,u,lead,out,now);
    this.emit('status',r.ev);return out}
  after(r,u,lead,out,now){const root=this.root,G=this.G,ev=r.ev,sinceBefore=(root.life||{}).since||0;
    const d=record(root,{...ev,sid:u.id},u.rt||now,G.streak);if(!d)return;u.rec=1;
    const sc=STATUS[u.id]&&STATUS[u.id].cls;   // трофей ТОЛЬКО за CALL BOOKED / CONDUCTED DISCOVERY CALL: и класс события, и сам статус кнопки
    if((ev.cls==='BOOKED'||ev.cls==='DISCOVERY')&&sc===ev.cls){const t={st:STATUS[u.id].name,id:'t'+now,kind:ev.cls==='BOOKED'?'gold':'platinum',company:lead.business||'?',state:lead.state||'',t:now,lead:lead.key,sealed:0,
      verified:r.meta.verified||u.verified||null,mode:r.meta.mode};(root.trophies||(root.trophies=[])).push(t);out.trophy=t}
    // Addiction: Сигнал, лут, гарант, цели дня, перк, рейд, призрак. Деньги, которые addict двинул (разгон, джекпот, рейд), — в u.adM для undo.
    const m0=G.money;out.ad=adAfter(root,G,ev,now,{state:lead.state,dayN:d.n,lead:lead.key});u.adM=G.money-m0;u.adSig=out.ad.sig||0;if(out.ad.raidM)u.raidM=out.ad.raidM;
    out.ghost=ghostRec(root,now,ev&&ev.cls,u.id);out.key=keyTrack(root,G,ev,d.n);if(!ev||!ev.spam)allyTrack(root,G,ev);
    const dm=dominance(root,now),rk=rankOf(dm.pts),lv=levelOf(G.lifeXp);if(dm.idle)root.wasNobody=1;
    if(root.rank!=null&&rk>root.rank)out.rankUp=rk;if(root.lvl!=null&&lv>root.lvl)out.levelUp=lv;
    out.achv=evaluate({root,G,ev,now,d,st:lead&&lead.state,L:root.life,rank:rk,meta:root.meta,lvl:lv,sinceBefore});
    if(out.achv.some(a=>a.id==='ret'))root.wasNobody=0;root.rank=rk;root.lvl=lv;
    out.missions=checkMissions(root,G,now);u.ach=out.achv.map(a=>a.id);u.mis=out.missions.map(m=>({id:m.id,k:m.k,money:m.money,lx:m.lx}));
    out.achv.forEach(a=>this.emit('achv',a));out.missions.forEach(m=>this.emit('mission',m));
    if(out.rankUp!=null)this.emit('rankUp',out.rankUp);if(out.levelUp!=null)this.emit('levelUp',out.levelUp);if(out.trophy)this.emit('trophy',out.trophy);this.emit('ad',out.ad)}
  // Снять статус / откатить: «full» (последний, ≤undoSec) откатывает всё по снимку, иначе «worth»: ровно то, что статус принёс.
  dropLead(key,now=this.now()){const G=this.G,root=this.root;
    for(let i=G.undo.length-1;i>=0;i--){const u=G.undo[i];if(u.lead!==key)continue;
      if(u.held&&!(i===G.undo.length-1&&now-u.t<=C.undoSec*1000)){const b=Math.min(u.held,G.keyHold||0);G.keyHold-=b;G.dxp+=b}
      if(u.lh&&!(i===G.undo.length-1&&now-u.t<=C.undoSec*1000)){const b=Math.min(u.lh,G.laterHold||0);G.laterHold-=b;G.dxp+=b}   // worth-undo: вернуть удержанное ключом в шкалу, чтобы откат снял его
      const side=u.side,how=gUndo(G,now,i);
      if(how==='full'&&side)sideRestore(root,side);                    // полный откат: ачивки, задания, recent, максимумы, трофей
      else{if(u.rec)unrecord(root,u);root.trophies=(root.trophies||[]).filter(t=>t.lead!==key||t.t!==u.t); // старый статус: ВСЁ, что он принёс
        for(const a of u.ach||[])if(root.ach)delete root.ach[a];                       // ачивки, открытые этим статусом
        for(const m of u.mis||[]){if(root.mdone&&root.mdone[m.k])delete root.mdone[m.k][m.id];G.money-=m.money;G.lifeXp=Math.max(0,G.lifeXp-(m.lx||0))}
        const A=root.ad;if(A){A.sig=Math.max(0,A.sig-(u.adSig||0));A.sigLife=Math.max(0,A.sigLife-(u.adSig||0));if(u.raidM&&A.raid&&A.raid.on){A.raid.m=Math.max(0,A.raid.m-u.raidM);A.raid.n=Math.max(0,A.raid.n-1)}}
        if(u.adM)G.money-=u.adM}                                       // деньги addict (разгон/джекпот/рейд); при full их уже вернул снимок движка
      this.emit('undo',{how,key});return how}
    return false}
  // Ночная чистка и срыв рейда: при старте и раз в час (приложение)
  adTick(now=this.now()){const root=this.root,G=this.G;const a=adEnsure(root);if(a.frz.on&&now-a.frz.at>=AD.freeze.sec*1000){freezeOff(root,now);gResume(G,now)}const purge=nightly(root,G,now),raid=a.frz.on?null:raidCheck(root,G,now);
    if(purge.length)this.emit('purge',purge);if(raid)this.emit('raidBurn',raid);return{purge,raid}}
  pause(now=this.now()){gPause(this.G,now);this.emit('pauseChanged',{paused:true})}
  resume(now=this.now()){gResume(this.G,now);this.emit('pauseChanged',{paused:false})}
  lateLog(callId,dur,now=this.now()){const r=lateLog(this.G,callId,dur,now);if(r&&r.bonus&&r.bonus.captured)this.emit('captured',{district:this.G.district-1,late:true});return r}
}
