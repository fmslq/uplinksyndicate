// Кусок 28: ПЕРЕЗВОНЫ (follow-ups). «Когда перезвонить» в карточке — окно выбора дня и времени по часам лида;
// игра помнит перезвон (save.fu в ct1), за 10 минут показывает уведомление, которое не исчезает само (только крестик),
// а кнопка «Перезвоны» в верхней полосе открывает список: просроченные, сегодня, завтра, позже, сделанные.
// В колонку таблицы Callback? пишется понятный текст: «2026-11-06 10:30 AM CST · заметка».
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const MIN=6e4,H=36e5,DAY=864e5;export const FU={pre:10,max:600,keepDays:60};
const PF={};const parts=(ms,tz)=>{const f=PF[tz]||(PF[tz]=new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',weekday:'short',hour12:false}));const o={};for(const x of f.formatToParts(new Date(ms)))o[x.type]=x.value;
 return{y:+o.year,mo:+o.month,d:+o.day,h:(+o.hour)%24,mi:+o.minute,wd:{Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[o.weekday]}};
export const tzOff=(ms,tz)=>{const p=parts(ms,tz);return(Date.UTC(p.y,p.mo-1,p.d,p.h,p.mi)-Math.floor(ms/MIN)*MIN)/MIN};
// «настенное» время в поясе tz → момент времени (мс)
export function wallToMs(w,tz){const g=Date.UTC(w.y,w.mo-1,w.d,w.h,w.mi);let ms=g-tzOff(g,tz)*MIN;ms=g-tzOff(ms,tz)*MIN;return ms}
export const wall=parts;
export const abbr=(ms,tz)=>{try{return new Intl.DateTimeFormat('en-US',{timeZone:tz,timeZoneName:'short'}).formatToParts(new Date(ms)).find(p=>p.type==='timeZoneName').value}catch(e){return''}};
export const myTz=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}catch(e){return'UTC'}};
export const tzCity=tz=>/Kiev|Kyiv/.test(tz)?'Киев':({'Europe/Warsaw':'Варшава','Europe/Berlin':'Берлин','Europe/Lisbon':'Лиссабон','Europe/London':'Лондон','America/New_York':'Нью-Йорк','America/Chicago':'Чикаго'})[tz]||String(tz).split('/').pop().replace(/_/g,' ');
const MON=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'],WD=['вс','пн','вт','ср','чт','пт','сб'];
const hm=p=>p.h+':'+String(p.mi).padStart(2,'0');
export const fmtAt=(ms,tz,short)=>{const p=parts(ms,tz);return`${WD[p.wd]}, ${p.d} ${short?MON[p.mo-1].slice(0,3):MON[p.mo-1]}, ${hm(p)}`};
export const rel=(ms,now)=>{const d=ms-now,a=Math.abs(d),m=Math.round(a/MIN),t=m<60?m+' мин':m<1440?Math.floor(m/60)+' ч'+(m%60?' '+m%60+' мин':''):Math.floor(m/1440)+' д'+(Math.floor(m%1440/60)?' '+Math.floor(m%1440/60)+' ч':'');return d>=0?(m<1?'сейчас':'через '+t):'просрочен на '+t};
export const sheetText=(ms,tz,note)=>{const p=parts(ms,tz),h12=p.h%12||12;return`${p.y}-${String(p.mo).padStart(2,'0')}-${String(p.d).padStart(2,'0')} ${h12}:${String(p.mi).padStart(2,'0')} ${p.h<12?'AM':'PM'} ${abbr(ms,tz)}${note?' · '+note:''}`};
const n10=p=>String(p||'').replace(/\D/g,'').slice(-10);
// ---- данные (чистые функции, тесты ниже) ----
export const fuRoot=save=>save.fu||(save.fu={list:[],seq:0});
export function fuSet(save,{phone,biz,st,tz,at,note},now){const R=fuRoot(save),ph=n10(phone);R.list=R.list.filter(x=>!(x.ph===ph&&!x.done));const e={id:++R.seq,ph,biz,st,tz,at,note:note||'',made:now,done:0,seen:0};R.list.push(e);fuTrim(save,now);return e}
export const fuOf=(save,phone)=>{const ph=n10(phone);return fuRoot(save).list.find(x=>x.ph===ph&&!x.done)||null};
export function fuTrim(save,now){const R=fuRoot(save);R.list=R.list.filter(x=>!x.done||now-x.at<FU.keepDays*DAY);if(R.list.length>FU.max)R.list.splice(0,R.list.length-FU.max)}
export const fuDue=(save,now)=>fuRoot(save).list.filter(x=>!x.done&&!x.seen&&now>=x.at-FU.pre*MIN);
// статус поставлен лиду, которому был назначен перезвон, и время уже подошло (за 30 мин и позже) — считаем перезвон сделанным
export function fuAuto(save,phone,now){const e=fuOf(save,phone);if(e&&now>=e.at-30*MIN){e.done=1;e.doneAt=now;return e}return null}
export function fuGroups(save,now,myZ){const L=fuRoot(save).list,p=parts(now,myZ),key=ms=>{const q=parts(ms,myZ);return Date.UTC(q.y,q.mo-1,q.d)},today=Date.UTC(p.y,p.mo-1,p.d);
 const g={late:[],today:[],tom:[],later:[],done:[]};for(const x of L){if(x.done){g.done.push(x);continue}if(x.at<now)g.late.push(x);else{const k=key(x.at);(k===today?g.today:k===today+DAY?g.tom:g.later).push(x)}}
 for(const k in g)g[k].sort((a,b)=>k==='done'?b.at-a.at:a.at-b.at);return g}
// ---- интерфейс ----
const fill=(w,h)=>{w.querySelectorAll(':scope>:not(.ct-bolt)').forEach(e=>e.remove());w.insertAdjacentHTML('beforeend',h)};   // перерисовать окно, не теряя уголков рамки
const IC_CAL='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 13v3l2 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>';
const X='<svg class="ic" viewBox="0 0 16 16"><path d="M3 3l10 10M13 3L3 13"/></svg>';
export function makeFollowUp({save,d,persist,openOv,closeOv,toast=()=>{},sfx=()=>{},now=Date.now,mem=false}){
 const me=myTz(),city=tzCity(me),R=()=>fuRoot(save);
 const leadZ=L=>(L&&L.zone)||'America/Chicago';
 const both=(x)=>`<b>${hm(parts(x.at,x.tz))} ${esc(abbr(x.at,x.tz))}</b> у лида · ${hm(parts(x.at,me))} у тебя (${esc(city)})`;
 // поле в карточке
 const field=L=>{const e=L&&fuOf(save,L.phone),t=now();
  if(e)return`<div class="fu-f on ${e.at<t?'late':''}" id="wk-cb"><button class="fu-fb" data-fu="pick">${IC_CAL}<span><b>${esc(fmtAt(e.at,e.tz,1))} у лида</b><em>${hm(parts(e.at,me))} у тебя · ${esc(rel(e.at,t))}${e.note?' · '+esc(e.note):''}</em></span></button><button class="fu-fx" data-fu="clr" title="Убрать перезвон">${X}</button></div>`;
  return`<div class="fu-f" id="wk-cb"><button class="fu-fb" data-fu="pick">${IC_CAL}<span>${L&&L.callback?`<b>${esc(L.callback)}</b><em>нажми, чтобы выбрать точное время</em>`:'<b class="ph">Назначить перезвон</b><em>день и время по часам лида</em>'}</span></button></div>`};
 const refreshField=()=>{const el=document.getElementById('wk-cb');if(el){const v=d.view();el.outerHTML=field(v.lead)}chip()};
 const leadIdx=ph=>{const t=d.t;if(!t||!t.L)return -1;return t.L.findIndex(l=>n10(t.ph(l))===ph)};
 const writeSheet=(ph,v)=>{const v0=d.view();if(v0.lead&&n10(v0.lead.phone)===ph){d.setCallback(v);return}const i=leadIdx(ph);if(i>=0){d.t.put(d.t.L[i],'Callback?',v);d.persistSoon&&d.persistSoon()}};
 const keep=()=>{if(!mem)persist()};
 // окно выбора времени. src: {ph,biz,st,tz,note,at}
 const pick=src=>{const tz=src.tz,t=now(),p0=parts(src.at||t,tz);let sel={y:p0.y,mo:p0.mo,d:p0.d,h:src.at?p0.h:Math.min(17,Math.max(8,p0.h+1)),mi:src.at?p0.mi:0};
  if(!src.at){const tp=parts(t,tz);if(tp.h>=17){const n=parts(t+DAY,tz);sel={y:n.y,mo:n.mo,d:n.d,h:9,mi:0}}}
  const days=Array.from({length:14},(_,i)=>parts(t+i*DAY,tz)),times=[];for(let m=7*60;m<=18*60;m+=30)times.push(m);
  const draw=()=>{const at=wallToMs(sel,tz),q=parts(at,tz),bad=q.wd===0||q.wd===6?'У лида это выходной день':q.h<8||q.h>=17?'У лида это нерабочее время':'',past=at<t;
   return`<div class="wk-wh"><h3>КОГДА ПЕРЕЗВОНИТЬ</h3><button class="wk-x" data-fu="x">${X}</button></div><div class="wk-wb fu-pk">
    <p class="fu-who"><b>${esc(src.biz||'Лид')}</b> · ${esc(src.st||'')} · время по часам лида (${esc(abbr(t,tz))})</p>
    <div class="fu-q"><button data-q="60">Через час</button><button data-q="120">Через 2 часа</button><button data-q="day">Завтра в это же время</button><button data-q="mon">Понедельник 10:00</button></div>
    <div class="fu-k">День у лида</div><div class="fu-days">${days.map((x,i)=>`<button data-day="${x.y}-${x.mo}-${x.d}" class="${x.y===sel.y&&x.mo===sel.mo&&x.d===sel.d?'on':''} ${x.wd===0||x.wd===6?'we':''}"><em>${i===0?'сегодня':i===1?'завтра':WD[x.wd]}</em><b>${x.d}</b><small>${MON[x.mo-1].slice(0,3)}</small></button>`).join('')}<label class="fu-dt">другой день<input type="date" data-fu="date" value="${sel.y}-${String(sel.mo).padStart(2,'0')}-${String(sel.d).padStart(2,'0')}"></label></div>
    <div class="fu-k">Время у лида</div><div class="fu-times">${times.map(m=>`<button data-tm="${m}" class="${sel.h*60+sel.mi===m?'on':''}">${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}</button>`).join('')}<label class="fu-dt">точно<input type="time" data-fu="time" value="${String(sel.h).padStart(2,'0')}:${String(sel.mi).padStart(2,'0')}"></label></div>
    <div class="fu-pv ${past?'past':''}"><div><span>У лида</span><b>${esc(fmtAt(at,tz))}</b><em>${esc(abbr(at,tz))}</em></div><i>=</i><div><span>У тебя (${esc(city)})</span><b>${esc(fmtAt(at,me))}</b><em>${esc(rel(at,t))}</em></div></div>
    ${past?'<p class="fu-warn">Это время уже прошло. Выбери позже.</p>':bad?`<p class="fu-warn soft">${bad}. Можно оставить, если так договорились.</p>`:''}
    <input class="fu-note" data-fu="note" maxlength="120" placeholder="О чём договорились (по желанию): «просил после обеда», «говорить с женой»" value="${esc(src.note||'')}">
    <div class="fu-act"><button class="wk-btn pri" data-fu="save" ${past?'disabled':''}>Сохранить перезвон</button>${src.at?'<button class="wk-btn" data-fu="del">Убрать перезвон</button>':''}<span>За ${FU.pre} минут до звонка игра покажет напоминание</span></div></div>`};
  openOv('fu-set',draw(),true);const box=document.querySelector('#ov .wk-win');
  const re=()=>{src.note=box.querySelector('[data-fu=note]').value;fill(box,draw())};
  box.onclick=e=>{const b=e.target.closest('button');if(!b)return;
   if(b.dataset.day){const [y,mo,dd]=b.dataset.day.split('-').map(Number);sel={...sel,y,mo,d:dd};re()}
   else if(b.dataset.tm){const m=+b.dataset.tm;sel={...sel,h:Math.floor(m/60),mi:m%60};re()}
   else if(b.dataset.q){const q=b.dataset.q,t2=now();let at;if(q==='day')at=t2+DAY;else if(q==='mon'){let x=t2;for(let i=1;i<8;i++){x=t2+i*DAY;if(parts(x,tz).wd===1)break}const w=parts(x,tz);at=wallToMs({y:w.y,mo:w.mo,d:w.d,h:10,mi:0},tz)}else at=t2+(+q)*MIN;const w=parts(at,tz);sel={y:w.y,mo:w.mo,d:w.d,h:w.h,mi:Math.round(w.mi/5)*5%60};re()}
   else if(b.dataset.fu==='x')closeOv();
   else if(b.dataset.fu==='del'){del(src.ph);closeOv()}
   else if(b.dataset.fu==='save'){const at=wallToMs(sel,tz),note=box.querySelector('[data-fu=note]').value.trim();fuSet(save,{phone:src.ph,biz:src.biz,st:src.st,tz,at,note},now());writeSheet(src.ph,sheetText(at,tz,note));keep();sfx('ching');toast(`Перезвон: ${fmtAt(at,tz,1)} у лида (${hm(parts(at,me))} у тебя)`);closeOv();refreshField();if(listOpen())list()}};
  box.onchange=e=>{const x=e.target;if(x.dataset.fu==='date'&&x.value){const [y,mo,dd]=x.value.split('-').map(Number);sel={...sel,y,mo,d:dd};re()}else if(x.dataset.fu==='time'&&x.value){const [h,mi]=x.value.split(':').map(Number);sel={...sel,h,mi};re()}}};
 const del=ph=>{const R_=R();R_.list=R_.list.filter(x=>!(x.ph===ph&&!x.done));writeSheet(ph,'');keep();refreshField();if(listOpen())list()};
 const openCur=()=>{const v=d.view();if(!v.lead){toast('Нет лида на экране','bad');return}const e=fuOf(save,v.lead.phone);pick({ph:n10(v.lead.phone),biz:v.lead.biz,st:v.lead.state,tz:e?e.tz:leadZ(v.lead),note:e?e.note:'',at:e?e.at:0})};
 // открыть карточку лида
 const openLead=ph=>{const i=leadIdx(ph);if(i<0){toast('Этого лида нет в открытой таблице','bad');return false}const f=d.view().filter||{};d.pickLead(i,{type:f.type,state:f.state,tz:f.tz});closeOv();return true};
 // уведомления
 let box=null;const shown=new Set();
 const notes=()=>{const t=now(),due=listOpen()?[]:fuDue(save,t);if(!due.length){if(box){box.remove();box=null}return}
  if(!box){box=document.createElement('div');box.className='fu-nots';document.body.appendChild(box);box.onclick=e=>{const c=e.target.closest('[data-id]');if(!c)return;const x=R().list.find(y=>y.id===+c.dataset.id);if(!x)return;const b=e.target.closest('button');
   if(b&&b.dataset.n==='x'){x.seen=1;keep();notes();return}if(b&&b.dataset.n==='ok'){x.done=1;x.doneAt=now();keep();notes();refreshField();toast('Перезвон отмечен: сделано');return}openLead(x.ph)}}
  let fresh=false;box.innerHTML=due.slice(0,4).map(x=>{if(!shown.has(x.id)){shown.add(x.id);fresh=true}const m=(x.at-t)/MIN,late=m<0;
   return`<div class="fu-n ${late?'late':''}" data-id="${x.id}" role="alert"><i class="fu-ni">${IC_CAL}</i><div><em>${late?'Перезвон просрочен':m<1?'Пора перезванивать':'Перезвон через '+Math.ceil(m)+' мин'}</em><b>${esc(x.biz||'Лид')} · ${esc(x.st||'')}</b><span>Назначено на ${both(x)}</span>${x.note?`<small>${esc(x.note)}</small>`:''}
    <p><button class="pri" data-n="open">Открыть карточку</button><button data-n="ok">Уже перезвонил</button></p></div><button class="fu-nx" data-n="x" title="Закрыть напоминание (перезвон останется в списке)">${X}</button></div>`}).join('')+(due.length>4?`<div class="fu-more">и ещё ${due.length-4}: открой «Перезвоны»</div>`:'');
  if(fresh)sfx('chime')};
 // кнопка в верхней полосе
 const chip=()=>{const pk=document.getElementById('b-pick');if(!pk)return;let b=document.getElementById('b-fu');
  if(!b){b=document.createElement('button');b.className='wk-tb fu-tb';b.id='b-fu';b.title='Перезвоны: кому и когда ты обещал позвонить';b.onclick=()=>list();pk.insertAdjacentElement('afterend',b)}
  const g=fuGroups(save,now(),me),n=g.late.length+g.today.length,h=`${IC_CAL}<span class="lbl">Перезвоны</span>${n?`<i class="fu-bd ${g.late.length?'late':''}">${n}</i>`:''}`;if(b.innerHTML!==h)b.innerHTML=h};
 // список
 const listOpen=()=>{const o=document.getElementById('ov');return!!(o&&o.classList.contains('open')&&o.dataset.k==='fu')};
 const row=(x,t)=>`<div class="fu-r ${x.done?'d'+x.done:x.at<t?'late':''}" data-id="${x.id}"><div class="fu-rt"><b>${hm(parts(x.at,x.tz))}</b><em>${esc(abbr(x.at,x.tz))} · ${esc(fmtAt(x.at,x.tz,1).split(',').slice(0,2).join(','))}</em><small>${hm(parts(x.at,me))} у тебя</small></div>
  <div class="fu-rb"><b>${esc(x.biz||'Лид')}</b><span>${esc(x.st||'')} · ${x.done?(x.done===1?'перезвонил':'не вышло'):esc(rel(x.at,t))}</span>${x.note?`<small>${esc(x.note)}</small>`:''}</div>
  <div class="fu-ra"><button data-r="open">Открыть</button><span class="fu-seg"><button data-r="d1" class="${x.done===1?'on':''}" title="Перезвонил">Фолоуапил</button><button data-r="d2" class="${x.done===2?'on':''}" title="Не дозвонился или не стал">Не вышло</button></span>${x.done?'':'<button data-r="move" title="Перенести">Перенести</button>'}<button data-r="del" class="fu-del" title="Удалить из списка">${X}</button></div></div>`;
 const list=()=>{const t=now(),g=fuGroups(save,t,me),sec=(k,n,L,cls='')=>L.length?`<section class="fu-s ${cls}"><h4>${n}<i>${L.length}</i></h4>${L.map(x=>row(x,t)).join('')}</section>`:'';
  const empty=!R().list.length;
  const html=`<div class="wk-wh"><h3>ПЕРЕЗВОНЫ</h3><span class="fu-sub">время у лида и у тебя (${esc(city)})</span><button class="wk-x" data-r="x">${X}</button></div><div class="wk-wb fu-list">
   ${empty?'<p class="fu-empty">Пока пусто. Открой карточку лида, нажми «Назначить перезвон» в поле «Когда перезвонить» и выбери день и время по его часам. За 10 минут игра напомнит.</p>':''}
   ${sec('late','Просрочены',g.late,'late')}${sec('today','Сегодня',g.today)}${sec('tom','Завтра',g.tom)}${sec('later','Позже',g.later)}
   ${g.done.length?`<details class="fu-s done"><summary><h4>Сделано и закрыто<i>${g.done.length}</i></h4></summary>${g.done.slice(0,80).map(x=>row(x,t)).join('')}</details>`:''}</div>`;
  if(listOpen()){const w=document.querySelector('#ov .wk-win');const sc=(w.querySelector('.fu-list')||{}).scrollTop||0;const op=!!w.querySelector('details.fu-s[open]');fill(w,html);const l=w.querySelector('.fu-list');l.scrollTop=sc;if(op){const dd=w.querySelector('details.fu-s');dd&&(dd.open=true)}}else{openOv('fu',html);notes()}
  const w=document.querySelector('#ov .wk-win');w.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.r==='x'){closeOv();notes();return}const r=e.target.closest('[data-id]');if(!r)return;const x=R().list.find(y=>y.id===+r.dataset.id);if(!x)return;
   const k=b.dataset.r;if(k==='open'){openLead(x.ph);return}if(k==='d1'||k==='d2'){const v=+k[1];x.done=x.done===v?0:v;x.doneAt=now();if(!x.done)x.seen=0}else if(k==='del'){R().list=R().list.filter(y=>y!==x)}else if(k==='move'){pick({ph:x.ph,biz:x.biz,st:x.st,tz:x.tz,note:x.note,at:x.at});return}
   keep();list();refreshField();notes()}};
 // статус поставлен лиду с назначенным перезвоном
 const onStatus=meta=>{if(!meta||!meta.lead)return;const e=fuAuto(save,meta.lead.phone,now());if(e){keep();toast('Перезвон «'+(e.biz||'лид')+'» отмечен: сделано');notes()}};
 document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('#wk-cb [data-fu]');if(!b)return;e.preventDefault();if(b.dataset.fu==='clr'){const v=d.view();if(v.lead)del(n10(v.lead.phone))}else openCur()});
 const tick=()=>{chip();notes();const el=document.getElementById('wk-cb');if(el&&el.classList.contains('on')){const v=d.view();if(v.lead){const h=field(v.lead);if(el.outerHTML!==h)el.outerHTML=h}}};
 setInterval(tick,5e3);setTimeout(tick,800);document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});
 return{field,openCur,list,notes,chip,onStatus,tick}}
export function runFollowUpTests(){const o=[],T=(nm,f)=>{try{o.push([nm,!!f()])}catch(e){o.push([nm+' ('+e.message+')',false])}};
 T('перезвоны: время лида → момент → время Киева (и через смену летнего времени)',()=>{const at=wallToMs({y:2026,mo:11,d:6,h:10,mi:30},'America/Chicago'),k=parts(at,'Europe/Kyiv');const at2=wallToMs({y:2026,mo:3,d:9,h:9,mi:0},'America/New_York');
  return new Date(at).toISOString()==='2026-11-06T16:30:00.000Z'&&k.h===18&&k.mi===30&&new Date(at2).toISOString()==='2026-03-09T13:00:00.000Z'});
 T('перезвоны: текст в таблицу и отсчёт',()=>{const at=Date.UTC(2026,10,6,16,30);return sheetText(at,'America/Chicago','после обеда')==='2026-11-06 10:30 AM CST · после обеда'&&rel(at,at-90*MIN)==='через 1 ч 30 мин'&&rel(at,at+5*MIN)==='просрочен на 5 мин'});
 T('перезвоны: один активный на номер, напоминание за 10 мин, автоотметка после статуса',()=>{const s={},t0=Date.UTC(2026,10,6,12);fuSet(s,{phone:'+1 501-838-9095',biz:'A',tz:'America/Chicago',at:t0+H},t0);fuSet(s,{phone:'5018389095',biz:'A',tz:'America/Chicago',at:t0+2*H},t0);
  const a=s.fu.list.length===1&&s.fu.list[0].at===t0+2*H,b=!fuDue(s,t0+H).length&&fuDue(s,t0+2*H-9*MIN).length===1,c=!fuAuto(s,'5018389095',t0)&&!!fuAuto(s,'5018389095',t0+2*H-20*MIN)&&s.fu.list[0].done===1;return a&&b&&c});
 T('перезвоны: группы — просрочены, сегодня, завтра, позже, сделано',()=>{const s={},z='Europe/Kyiv',t0=wallToMs({y:2026,mo:11,d:6,h:12,mi:0},z);fuSet(s,{phone:'1',at:t0-H,tz:z},t0);fuSet(s,{phone:'2',at:t0+H,tz:z},t0);fuSet(s,{phone:'3',at:t0+DAY,tz:z},t0);fuSet(s,{phone:'4',at:t0+3*DAY,tz:z},t0);fuSet(s,{phone:'5',at:t0+H,tz:z},t0).done=1;
  const g=fuGroups(s,t0,z);return[g.late,g.today,g.tom,g.later,g.done].map(x=>x.length).join()==='1,1,1,1,1'});
 return o}
