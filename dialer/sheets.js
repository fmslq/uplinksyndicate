// Синхронизация с Google Таблицей через Apps Script (перенос sync/post/pump/human/pull/applyPull/mergeField/reconcile/sendArch).
// Без DOM: сеть, хранилище, таймеры, «пользователь печатает», подтверждение и тосты внедряются. Ключи pd2q (очередь) и pd2a (архив) прежние.
import {matchRows,phoneKey,shouldToast,toastText} from './reconcile.js';
const nl2=s=>String(s||"").replace(/\r\n/g,"\n");
export function human(r,op){const e=String(r&&r.err||""),who=op?" («"+(op.biz||op.phone)+"»"+(op.set&&op.set.Result?", статус «"+op.set.Result+"»":"")+")":"";
 if(r&&(r.code=="validation"||/проверк\S* данных|data validation/i.test(e)))return["Ошибка: Статус в дайлере не совпадает с выпадающим списком в таблице"+who,"Открой Настройки → Дайлер → «Какие значения уходят в таблицу» и впиши значение точно как в списке таблицы."];
 if(r&&r.code=="secret")return["Неверное секретное слово","Слово в дайлере и в скрипте должно совпадать. Если менял слово в скрипте, создай новую версию развёртывания."];
 if(r&&r.code=="tab")return["Не нашёл вкладку в таблице","Впиши название вкладки вручную: Настройки → Дайлер → «Вкладка»."];
 if(r&&r.code=="row")return["Этого номера нет в таблице"+who,"Запись сохранена в очереди. Проверь номер в колонке Phone этой вкладки."];
 return["Ошибка Google Sheets: "+e.slice(0,120),"Открой Настройки → Дайлер и нажми «Проверить связь»."]}
export const parseSheetUrl=u=>{const m=String(u).match(/\/spreadsheets\/d\/([\w-]+)/);if(!m)return null;const g=String(u).match(/[#&?]gid=(\d+)/);return{id:m[1],gid:g?g[1]:""}};
const J=(st,k,d)=>{try{return JSON.parse(st.getItem(k)||"null")??d}catch(e){return d}};

export class SheetsSync{
 // o: {table, cfg:()=>P.sheets, fileTab:()=>вкладка для файла, store, fetch, setTimeout, clearTimeout, now, isEditing(l,field), confirm, emit(type,data), busyLocal:()=>bool, kv}
 constructor(o){Object.assign(this,o);this.SQ=J(o.store,"pd2q",[]);this.SA=J(o.store,"pd2a",[]);this.busy=0;this.err="";this.T=0;this.blind=0;this.fail=0;this.msg=null;this.info=null;
  this.syBusy=0;this.syOld=0;this.syLast=0;this.recSkip=null;this.revision=0}
 sqSave(){try{this.store.setItem("pd2q",JSON.stringify(this.SQ))}catch(e){}}
 saSave(){try{this.store.setItem("pd2a",JSON.stringify(this.SA))}catch(e){}}
 get on(){const c=this.cfg();return !!(c.on&&c.url)}
 tabHint(){const t=this.table;return t.src?"sheet:"+t.src.id+":"+t.src.gid:this.fileTab()}
 state(){return{on:!!this.cfg().on,error:this.err,pending:this.SQ.length,rejected:this.badInfo?this.badInfo.size:0,skipped:this.fail,doc:this.info&&this.info.doc,tab:this.info&&this.info.tab,banner:this.msg}}
 changed(){this.emit('sourceStateChanged',this.state())}
 // постановка в очередь изменений лида; withRes = отправить статус и дату
 sync(l,withRes){const c=this.cfg(),t=this.table;if(!c.on||!c.url||!l||!t.ph(l))return;const s={};
  if(withRes){s.Result=t.get(l,"Result");s["Date Engaged"]=t.get(l,"Date Engaged")}
  if(t.get(l,"Notes")!==l.n0)s.Notes=t.get(l,"Notes");if(t.get(l,"Callback?")!==l.c0)s["Callback?"]=t.get(l,"Callback?");
  if(!Object.keys(s).length)return;
  const file=this.tabHint(),phone=t.ph(l),row=l.r||t.L.indexOf(l)+2,o=this.SQ.find(x=>x.file==file&&x.phone==phone&&x.row==row);
  if(o){Object.assign(o.set,s);if(this.cool)this.cool.delete(o);if(this.badInfo)this.badInfo.delete(o)}else this.SQ.push({file,phone,biz:t.get(l,"Business"),row,set:s,...(t.src?{sid:t.src.id,gid:t.src.gid}:{})});
  this.revision++;this.sqSave();this.pump();this.changed()}
 async post(obj){const c=this.cfg(),ac=new AbortController(),tm=this.setTimeout(()=>ac.abort(),25000),o={method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({secret:c.token,...obj}),signal:ac.signal};
  try{const r=await this.fetch(c.url,o);return await r.json()}
  finally{this.clearTimeout(tm)}}
 async pump(){if(this.busy||!this.SQ.length||!this.on)return;this.busy=1;let glob=0;
  // кусок 34: запись, которую таблица отклонила именно из-за себя (perm: «нет в списке», «номер не найден»), больше не блокирует остальные.
  // Она остаётся в очереди нетронутой (pd2q прежнего формата) и на 60 с «отдыхает» (в памяти); общие сбои (секретное слово, нет сети, пустой ответ) по-прежнему останавливают проход.
  const cool=this.cool||(this.cool=new Map()),bad=this.badInfo||(this.badInfo=new Map());
  for(;;){const op=this.SQ.find(x=>!(cool.get(x)>this.now()));if(!op)break;const sent={...op,set:{...op.set}};
   try{const r=await this.post(sent);
    if(r.ok&&!r.blind){this.info=r;cool.delete(op);bad.delete(op);for(const [k,v] of Object.entries(sent.set))if(op.set[k]===v)delete op.set[k];if(!Object.keys(op.set).length){const i=this.SQ.indexOf(op);if(i>=0)this.SQ.splice(i,1)}this.sqSave();this.err="";this.fail=0;if(this.msg)this.msg=null}
    else if(r.perm||r.code=="validation"||/проверк\S* данных|data validation/i.test(String(r.err||""))){cool.set(op,this.now()+60000);bad.set(op,{err:r.code||'ошибка',msg:human(r,op)});continue}
    else{this.err=r.code=="secret"?"secret":(r.err||"ошибка");this.msg=[...human(r,op),"tr"];glob=1;break}}
   catch(e){this.err="нет связи";glob=1;break}
   this.changed()}
  for(const o of [...bad.keys()])if(!this.SQ.includes(o)){bad.delete(o);cool.delete(o)}
  if(bad.size&&!glob){const [,b]=[...bad][0];this.err=b.err;this.fail=1;this.msg=b.msg}
  this.busy=0;this.changed();this.clearTimeout(this.T);if(this.SQ.length)this.T=this.setTimeout(()=>this.pump(),this.err=="secret"||this.fail?60000:8000);else if(!this.err)this.setTimeout(()=>this.pull(),500)}
 retry(){this.err="";this.cool=null;this.badInfo=null;this.pump()}
 // чтение правок из таблицы: раз в 45 с и при возврате во вкладку (если прошло > 8 с)
 async pull(manual){const t=this.table;if(!this.on||!t.L.length||this.syBusy)return;if(this.syOld&&!manual)return;
  if(this.SQ.length||this.busyLocal()||this.busy){if(manual)this.emit('toast',"Сначала дождись отправки в таблицу");return}
  this.syBusy=1;this.syLast=this.now();const revision=this.revision;
  try{const r=await this.post(t.src?{sid:t.src.id,gid:t.src.gid,file:"x",read:1,full:1}:{file:this.tabHint(),read:1});
   if(r.blind)return;
   if(t.src?!r.head:!r.rows){if(r.ok||r.code=="row"){this.syOld=1;this.msg=["В таблице старая версия скрипта","Вставь новый код (Настройки → Дайлер → Apps Script) и создай новую версию развёртывания. Тогда правки из таблицы будут попадать в дайлер."];this.changed()}else if(manual)this.emit('toast',human(r)[0]);return}
   this.syOld=0;if(this.SQ.length||this.busyLocal()||this.revision!==revision)return;
   const n=t.src?this.reconcile(r):this.applyPull(r.rows);if(manual)this.emit('toast',n?"Из таблицы обновлено: "+n:"В таблице ничего нового")}
  catch(e){if(manual)this.emit('toast',"Нет связи с таблицей")}
  finally{this.syBusy=0}}
 // режим «файл + скрипт»: построчные правки {p,r,res,dt,nt,cb}
 applyPull(rows){const t=this.table,by={};t.L.forEach((l,i)=>{const k=phoneKey(t.get(l,"Phone"));if(k.length==10)(by[k]=by[k]||[]).push(i)});
  const used=new Set();let n=0;const touched=[];
  for(const x of rows){const a=by[x.p];if(!a)continue;
   const i=a.includes(x.r-2)&&!used.has(x.r-2)?x.r-2:a.find(j=>!used.has(j));if(i==null)continue;used.add(i);
   const l=t.L[i];let ch=0;
   if(x.res!==null&&x.res!==undefined){const nv=x.res.trim().toLowerCase()=="not called"?"":x.res,old=t.res(l);
    if(nv.trim()!==old.trim()){t.put(l,"Result",nv);ch=1}
    if(x.dt!=null&&(x.dt===""||/^\d{4}-\d{2}-\d{2}( \d{1,2}:\d{2} [AP]M( [A-Z]{2,5})?)?$/.test(x.dt))&&x.dt!==t.get(l,"Date Engaged")){if(t.put(l,"Date Engaged",x.dt))ch=1}}
   if(x.nt!=null&&this.mergeField(l,"Notes",x.nt,"n0"))ch=1;
   if(x.cb!=null&&this.mergeField(l,"Callback?",x.cb,"c0"))ch=1;
   if(ch){n++;touched.push(l)}}
  if(n)this.emit('tableChanged',{leads:touched,from:'pull'});return n}
 // трёхсторонняя сверка текстовых полей (base / local / remote), как в старом дайлере
 mergeField(l,name,remote,bk){const t=this.table;if(t.ix(name)<0)return false;const local=t.get(l,name),base=l[bk]==null?"":l[bk];
  if(nl2(remote)===nl2(local)){l[bk]=remote;return false}
  if(nl2(local)===nl2(base)){t.put(l,name,remote);l[bk]=remote;this.emit('fieldReplaced',{lead:l,name,value:remote});return true}
  if(nl2(remote)===nl2(base))return false;
  (l.hist=l.hist||[]).push({n:name,t:this.now(),v:local});if(l.hist.length>20)l.hist.shift();
  const m=nl2(local).includes(nl2(remote))?local:local+"\n⟲ из таблицы: "+remote;t.put(l,name,m);l[bk]=remote;this.emit('fieldReplaced',{lead:l,name,value:m});
  this.sync(l,0);this.emit('toast',"Заметка менялась и в таблице: объединил");return true}
 // режим «таблица главная»: полный состав строк. ИСПРАВЛЕНО: лиды без телефона больше не «новые» на каждом опросе (см. reconcile.js)
 reconcile(r){const t=this.table,oldH=t.h,newH=r.head,hl=newH.map(x=>x.trim().toLowerCase()),pI=hl.indexOf("phone"),bI=hl.indexOf("business"),aI=hl.findIndex(x=>x=="adress"||x=="address");if(pI<0)return 0;
  const old=t.L.map(l=>({key:phoneKey(t.get(l,"Phone")),r:l.r,biz:t.get(l,"Business"),addr:t.get(l,"Adress")||t.get(l,"Address")}));
  const rows=r.rows.map(x=>({r:x.r,v:newH.map((_,i)=>x.c[i]||"")})),keys=rows.map(x=>({key:phoneKey(x.v[pI]),r:x.r,biz:bI>=0?x.v[bI]:"",addr:aI>=0?x.v[aI]:""}));
  const p=matchRows(old,keys),withPh=old.filter(o=>o.key.length==10).length,removed=p.removed.map(i=>t.L[i]);
  if(removed.length&&(!rows.length||(withPh>=10&&removed.length>=withPh/2))){const sig=removed.length+":"+rows.length;
   if(this.recSkip===sig)return 0;
   if(!this.confirm("В таблице пропало "+removed.length+" из "+withPh+" лидов. Убрать их из игры? Они сохранятся в архиве (вкладка Deleted Power Dialer Leads).")){this.recSkip=sig;return 0}}
  const oN=oldH.findIndex(x=>x.trim().toLowerCase()=="notes"),oC=oldH.findIndex(x=>x.trim().toLowerCase()=="callback?");
  t.h=newH.slice();t.ixc={};const nI=t.ix("Notes"),cI=t.ix("Callback?");let upd=0;const nl=[];
  rows.forEach((x,k)=>{let v=x.v,m=p.match[k]>=0?t.L[p.match[k]]:null;
   if(m){const prot=this.isEditing(m);if(prot){v=v.slice();if(nI>=0&&oN>=0)v[nI]=m.v[oN]||"";if(cI>=0&&oC>=0)v[cI]=m.v[oC]||""}
    if(m.v.join("\u0001")!==v.join("\u0001"))upd++;
    m.v=v;m.r=x.r;delete m.zc;if(!prot){m.n0=nI>=0?v[nI]:"";m.c0=cI>=0?v[cI]:""}}
   else m={v,s:0,r:x.r,n0:nI>=0?v[nI]:"",c0:cI>=0?v[cI]:""};
   nl.push(m)});
  t.L=nl;this.emit('leadsReplaced',{keep:new Set(nl)});
  if(removed.length){const at=new Date(this.now()).toISOString();
   if(this.kv)this.kv("get","del").then(a=>this.kv("put","del",(a||[]).concat(removed.map(l=>({at,tab:t.name,head:oldH,v:l.v}))).slice(-5000))).catch(()=>{});
   this.SA.push({sid:t.src.id,gid:t.src.gid,at,head:oldH,rows:removed.map(l=>l.v)});this.saSave();this.sendArch()}
  const rep={added:p.addedReal,removed:removed.length,updated:upd,blankRows:p.added-p.addedReal};
  this.emit('syncReport',rep);if(shouldToast(p))this.emit('toast',toastText(p));       // тост ТОЛЬКО при реальных изменениях
  if(p.added||upd||removed.length)this.emit('tableChanged',{from:'reconcile'});
  return p.addedReal+upd+removed.length}
 async sendArch(){if(!this.SA.length||!this.on)return;const b=this.SA[0];
  try{const r=await this.post({sid:b.sid,gid:b.gid,file:"x",archive:1,at:b.at,head:b.head,rows:b.rows});if(r&&r.ok){this.SA.shift();this.saSave();if(this.SA.length)this.sendArch()}}catch(e){}}
 // открыть Google Таблицу по ссылке (openSheet): → {ok, error}
 async open(src){const c=this.cfg();if(!c.url||!c.token)return{ok:false,error:"Сначала подключи скрипт: Настройки → Дайлер → Google Sheets",cfg:1};
  try{const r=await this.post({sid:src.id,gid:src.gid,file:"x",read:1,full:1});
   if(r.blind)return{ok:false,error:"Google не вернул ответ. У развёртывания должен быть доступ «Все (Anyone)»"};
   if(!r.ok)return{ok:false,error:r.code=="tab"||r.code=="row"?"Скрипт в таблице старой версии: вставь новый код и выпусти НОВУЮ версию развёртывания":human(r)[0]};
   if(!r.head)return{ok:false,error:"В скрипте старая версия. Вставь новый код: Настройки → Дайлер → Apps Script"};
   if(r.head.findIndex(x=>x.trim().toLowerCase()=="phone")<0)return{ok:false,error:"В таблице нет колонки Phone"};
   return{ok:true,r}}
  catch(e){return{ok:false,error:e instanceof SyntaxError?"Google вернул не ответ скрипта. Проверь доступ «Все (Anyone)»":"Нет связи с Google"}}}
}
// «Проверить связь» (cfgTest): → {ok, level:'ok'|'er', title, text, old}
export async function testConnection(sync,GS_VER=4){const c=sync.cfg(),t=sync.table;
 if(!c.token)return{ok:false,title:"Нет секретного слова.",text:"Заполни шаг 1."};
 if(!/^https:\/\/script\.google\.com\/.+\/exec/.test(c.url))return{ok:false,title:"Ссылка выглядит неправильно.",text:"Она должна начинаться с https://script.google.com/ и оканчиваться на /exec (шаг 3)."};
 try{const r=await sync.post(t.src?{sid:t.src.id,gid:t.src.gid,file:"x",ping:1}:{file:sync.tabHint(),ping:1});
  if(r.blind)return{ok:false,title:"Не удалось прочитать ответ Google.",text:"Скорее всего, в развёртывании стоит доступ не «Все (Anyone)». Создай развёртывание заново."};
  if(r.ok){c.ok={doc:r.doc,tab:r.tab,url:c.url};sync.info=r;sync.changed();return{ok:true,doc:r.doc||"общий скрипт",tab:r.tab||"—",old:(r.v|0)<GS_VER}}
  const h=human(r);return{ok:false,title:h[0],text:h[1]}}
 catch(x){return{ok:false,...(x instanceof SyntaxError?{title:"Google вернул не ответ скрипта.",text:"Обычно это страница входа: у развёртывания должен быть доступ «Все (Anyone)»."}:{title:"Нет связи с Google.",text:"Проверь интернет и что ссылка скопирована целиком."})}}}
