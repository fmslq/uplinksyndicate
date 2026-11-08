// Интерфейс Addiction update: полоса в HUD (Сигнал, Заморозка, Рюкзак, Рейд, счастливый час, Разгон, цели дня, перк),
// рулетка Шума, выбор перка, строка призрака, Ночная чистка, окно «Коммутатор» (дерево, связисты и Мачта, темы, рюкзак, журнал).
// Логика — core/addict.js; здесь только DOM. Сюжет — docs/STORY_BIBLE.md §12.
import {icon} from '../../art/icons.js';
import * as A from '../../core/addict.js';
import {dayKey,isWork} from '../../core/stats.js';
import {ask} from '../kit/ask.js';
import {CLUES} from '../../story/beats.js';
import {hearerOf} from '../../story/systems.js';
import {boardHtml,fitCords} from './switchboard.js';
import {colHtml} from './collector.js';
import * as CO from '../../core/collector.js';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const mmss=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const $m=v=>'$'+Math.round(v).toLocaleString('ru');
const TC=r=>A.TIER[r][1],TN=r=>A.TIER[r][0];
const SV=d=>`<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const IC={c:SV('M8 8h8v8H8z'),u:SV('M12 3l9 9-9 9-9-9z'),r:SV('M12 2l8.7 5v10L12 22l-8.7-5V7z'),e:SV('M12 1l2.6 7.4L22 11l-7.4 2.6L12 21l-2.6-7.4L2 11l7.4-2.6z'),l:SV('M12 2l3 6.9 7.5.6-5.7 4.9 1.8 7.3L12 17.8 5.4 21.7l1.8-7.3L1.5 9.5 9 8.9z')};
const SG='<svg class="sg" viewBox="0 0 12 12" aria-hidden="true"><path fill-rule="evenodd" d="M6 0L12 6 6 12 0 6ZM6 3.2L8.8 6 6 8.8 3.2 6Z"/></svg>';
// кусок 28: полное объяснение находки — что это, зачем, как включить, где лежит
const TIERN={c:'хлам',u:'годное',r:'редкое',e:'эпик',l:'легенда'};
const CLSN={TRASH:'автоответчики и мусор',GATEKEEPER:'гейткиперов',MINOR:'«Другое»',TALK:'разговоры с владельцем',CALLBACK:'перезвоны',BOOKED:'встречи',DISCOVERY:'discovery-звонки'};
export function lootHelp(L){if(!L)return'';const P=[],why=[];
 P.push(`<p><b>${esc(L.n)}</b> · ${TIERN[L.r]||''}. ${esc(L.t)}.</p>`);
 if(L.xAll)why.push(`больше XP за каждый статус: район проходится быстрее`);if(L.mAll)why.push(`больше денег за каждый статус: на них покупаются вещи для базы`);
 if(L.x)why.push(`больше XP только за ${Object.keys(L.x).map(k=>CLSN[k]||k).join(' и ')}`);if(L.m)why.push(`больше денег только за ${Object.keys(L.m).map(k=>CLSN[k]||k).join(' и ')}`);
 if(L.fast)why.push(`дольше окно серии: можно чуть дольше ставить статус, и серия не сгорит`);if(L.luck)why.push(`Шум на линии ловится чаще`);if(L.sigK)why.push(`Сигнал копится быстрее. Сигнал тратится в Коммутаторе на постоянные улучшения`);
 if(L.odSec)why.push(`следующий Overdrive длится дольше`);if(L.jack)why.push(`деньги начисляются сразу`);if(L.sigNow)why.push(`Сигнал добавляется сразу, его тратят в Коммутаторе`);
 if(why.length)P.push(`<p><em>Зачем:</em> ${why.join('; ')}.</p>`);
 if(L.relic)P.push(`<p><em>Как работает:</em> это реликвия. Она уже включена и работает всегда, ничего нажимать не надо. Лежит в Рюкзаке, раздел «Реликвии».</p>`);
 else if(L.calls)P.push(`<p><em>Как работает:</em> бонус действует ${L.calls} статусов подряд. Считаются статусы, а не минуты, так что перерыв бонус не съедает. Одновременно можно держать до 3 таких бонусов.</p><p><em>Как включить:</em> «Включить сейчас» — работает со следующего статуса. «В рюкзак» — вещь полежит, пока не понадобится: Рюкзак открывается клавишей <kbd>B</kbd> или значком рюкзака в верхней полосе, там кнопка «Включить». Выгоднее включать перед счастливым часом или рейдом.</p>`);
 else P.push(`<p><em>Как работает:</em> срабатывает сразу, в рюкзак не кладётся. Нажми «Забрать».</p>`);
 if(L.hh)P.push(`<p>Такие вещи выпадают только в счастливые часы, когда у лидов утро или вечер.</p>`);
 P.push(`<p class="q"><em>Откуда:</em> Гудок ловит Шум на мусорных звонках (автоответчик, гейткипер, «Другое»). Находка бывает не чаще, чем раз в 25 неудачных звонков. После долгой серии без встреч приходит сундук гаранта с вещью получше.</p>`);
 return P.join('')}
export function makeAddict({holdDial=()=>{},holdAuto=()=>{},ses,save,persist,toast,sfx=()=>{},fx=()=>'full',J=null,now=Date.now,lead=()=>null,dayN=()=>0,dPaused=()=>false,extra=()=>'',HH=null,onTab=()=>false,onSys=()=>false,warmDone=null,unl=()=>true,onUnder=null}){
 const a=()=>A.ensure(save),G=()=>ses.G;
 let waitMs=0,spinning=false,frzT=0,ghT=0,ghI=0,sig='';
 // ---------- полоса в HUD ----------
 const html=()=>`<div class="adx" id="adx" aria-label="Сигнал, заморозка, рюкзак, рейд, цели дня"></div><div class="adx-gh" id="adx-gh" aria-live="polite"></div>`;
 const tracks=()=>{const k=dayKey(now()),T=A.tracksFor(k),st=a().tr.k===k?a().tr.done:{},d=(save.days||{})[k]||{n:0,c:{}},n=dayN();
  const val=x=>x.kind==='dials'?n:x.kind==='talk'?['TALK','CALLBACK','BOOKED','DISCOVERY'].reduce((s,c)=>s+((d.c||{})[c]||0),0):x.kind==='gk'?((d.c||{}).GATEKEEPER||0):x.kind==='hh'?(a().tr.k===k?a().tr.hh||0:0):x.kind==='streak'?(d.bs||0):(a().tr.k===k?a().sigLife-(a().tr.sig0||0):0);
  return T.map(x=>({...x,v:Math.min(x.n,val(x)),done:!!st[x.id]}))};
 const render=(force)=>{const el=document.getElementById('adx');if(!el)return;const t=now(),A_=a(),L=lead(),hh=L&&A.happy(L.state,t),n=dayN(),R=A_.raid,F=A_.frz,P=A_.perk;
  const tr=tracks(),cur=tr.find(x=>!x.done),inv=Object.values(A_.inv).reduce((s,v)=>s+v,0),act=A_.act.length;
  const s=[A_.sig,F.ch,F.on?Math.floor((t-F.at)/1000):-1,inv,act,R&&R.on?[R.n,R.m,Math.floor((R.dl-t)/1000)].join():'',HH?HH.sig():'',n,cur?cur.id+cur.v:'',P&&P.pick&&t<P.until?Math.ceil((P.until-t)/60000):'',(ws0=>ws0&&ws0.on?ws0.n+'/'+Math.ceil(ws0.left/1000):'')(A.warmState(save,t,n)),extra()].join('|');
  {const c=document.querySelector('#lead .wk-chip.time'),v=hh?'×'+hh.k+' '+hh.name.toLowerCase():'';if(c&&c.dataset.hh!==v){c.dataset.hh=v;c.classList.toggle('hh',!!hh)}}
  if(s===sig&&!force)return;sig=s;
  const ws=A.warmState(save,t,n),warm=ws&&ws.on;
  const frzLeft=F.on?A.AD.freeze.sec-(t-F.at)/1000:0;
  if(F.on&&frzLeft<=0){setTimeout(()=>unfreeze('время'),0)}else if(F.on&&!document.body.classList.contains('frz-on')){document.body.classList.add('frz-on');holdAuto(true)}
  el.innerHTML=
   (unl('tree')?`<button class="adx-c sig" data-ax="tree" title="Сигнал: Гудок копит его из каждого звонка. Трать в Коммутаторе">${SG}<b>${A_.sig.toLocaleString('ru')}</b></button>`:'')
  +(unl('freeze')?`<button class="adx-c frz${F.on?' on':''}${F.ch?'':' off'}" data-ax="frz" title="Заморозка (F): множитель и Overdrive не сгорают до 3 минут, автонабор на это время выключен. Заряд — только за каждые 25 наборов">❄︎ <b>${F.on?mmss(frzLeft):F.ch}</b><kbd>F</kbd></button>`:'')
  +(unl('bag')?`<button class="adx-c bag${inv?' has':''}" data-ax="bag" title="Рюкзак (B): находки, которые Гудок вылавливает из Шума. Включи буст — работает N звонков, активно до 3">${icon('bag','ic-in')} <b>${inv}</b>${act?`<i>${act} акт.</i>`:''}<kbd>B</kbd></button>`:'')
  +(!unl('raid')?'':R&&R.on?`<button class="adx-c raid on${R.dl-t<45000?' hurry':''}" data-ax="raid" title="Рейд: деньги копятся в буфере. 100 наборов без длинных пауз — вывод ×1.5, сорвёшь — сгорит">РЕЙД <b>${R.n}/${A.AD.raid.n}</b> ${$m(R.m)} · срыв ${mmss((R.dl-t)/1000)}</button>`
    :`<button class="adx-c raid" data-ax="raid" title="Рейд ×1.5: по желанию">РЕЙД</button>`)
  +(HH&&unl('hh')?HH.chip():'')
  +(P&&P.pick&&t<P.until?`<span class="adx-c perk" title="${esc((A.PERKS3.find(x=>x.id===P.pick)||{}).t||'')}">★︎ ${esc((A.PERKS3.find(x=>x.id===P.pick)||{}).n||'')} <i>${Math.ceil((P.until-t)/60000)} мин</i></span>`:'')
  +(warm?`<span class="adx-c warm${ws.left<120000?' hurry':''}" title="Разгон: ×${A.AD.warm.k} XP и $ (кроме BOOKED и DISCOVERY), пока не прошло ${A.AD.warm.min} минут и не сделано ${A.AD.warm.n} наборов">РАЗГОН ×${A.AD.warm.k} <b>${ws.n}/${A.AD.warm.n}</b><i>${Math.floor(ws.left/60000)}:${String(Math.floor(ws.left/1000)%60).padStart(2,'0')}</i></span>`:'')
  +extra()+`<span class="adx-tr" title="Цели дня: ${esc(tr.map(x=>x.name+' '+x.n+' → '+x.rt).join(' · '))}">${tr.map(x=>`<i class="${x.done?'ok':x===cur?'cur':''}" style="--p:${(x.v/x.n*100).toFixed(0)}%"></i>`).join('')}${cur?`<span>${esc(cur.name)} <b>${cur.v}/${cur.n}</b></span>`:'<span>все цели дня ✓</span>'}</span>`;
  el.querySelectorAll('[data-ax]').forEach(b=>b.onclick=()=>act_(b.dataset.ax));{const hb=el.querySelector('[data-hh]');if(hb&&HH)hb.onclick=()=>HH.open(hb)}};
 const act_=k=>{if(k==='frz')freeze();else if(k==='bag')open('bag');else if(k==='tree')open('tree');else if(k==='raid')raid()};
 // ---------- заморозка ----------
 const freeze=()=>{const A_=a();if(A_.frz.on){unfreeze('руками');return}const r=A.freezeOn(save,now());if(!r.ok){toast('Заморозка: '+r.why,'bad');return}
  ses.pause(now());holdAuto(true);document.body.classList.add('frz-on');persist();sfx('chime');toast('❄︎ Заморозка: множитель и Overdrive не сгорают до 3 минут. Автонабор выключен — смени номер спокойно. F — снять');clearTimeout(frzT);frzT=setTimeout(()=>unfreeze('время'),A.AD.freeze.sec*1000);render(1)};
 const unfreeze=(why)=>{if(!a().frz.on)return;clearTimeout(frzT);A.freezeOff(save,now());ses.resume(now());holdAuto(false);document.body.classList.remove('frz-on');persist();if(why!=='статус')toast('❄︎ Заморозка снята ('+why+')');render(1)};
 // ---------- рейд ----------
 const raid=async()=>{if(onSys('raid',()=>raid()))return;const R=a().raid;if(R&&R.on){toast(`Рейд: ${R.n}/${A.AD.raid.n}, в буфере ${$m(R.m)}. Не делай пауз дольше окна — иначе сгорит`);return}
  const ok=await ask({title:'Начать рейд?',tone:'warn',ok:'В рейд',cancel:'Не сейчас',text:`Гудок будет держать все деньги в буфере ЭЛТ. <b>${A.AD.raid.n} наборов</b> без длинных пауз — получишь буфер <b>×${A.AD.raid.k}</b>. Пауза дольше окна (3–25 мин, зависит от статуса) — буфер сгорает. Заморозка время не тратит.`});
  if(!ok)return;A.raidStart(save,now());persist();sfx('levelup');toast('РЕЙД начат: 100 наборов, не останавливайся','gold');render(1)};
 // ---------- рюкзак / дерево / Связисты / темы / журнал ----------
 let tab='bag',win=null,sbInfo=null,sbJust=null,colSel=-1;
 const open=(t)=>{tab=t||tab;if(tab==='ops'?!A.synOk(save):!unl(tab))tab=['bag','tree','look','log'].find(k=>unl(k))||'log';if(onTab(tab,()=>open(tab))){close();return}if(tab==='ops'&&A.synOk(save)&&!(a().ops.plot|0)&&onSys('col',()=>open('ops'))){close();return}if(!win){win=document.createElement('div');win.className='adw-wrap';win.onclick=e=>{if(e.target===win)close()};document.body.appendChild(win);addEventListener('keydown',kd,true)}draw()};
 const close=()=>{if(!win)return;removeEventListener('keydown',kd,true);win.remove();win=null;render(1)};
 const kd=e=>{if(!win)return;if(e.code==='Escape'||(e.code==='KeyB'&&tab==='bag')){e.preventDefault();e.stopPropagation();close()}else if(!['Tab'].includes(e.code))e.stopPropagation()};
 const tabsH=()=>[['bag','Рюкзак'],['tree','Коммутатор'],['ops','Связисты'],['look','Темы'],['log','Журнал']].filter(([k])=>k==='ops'?A.synOk(save):unl(k)).map(([k,n])=>`<button class="${tab===k?'on':''}" data-t="${k}">${n}</button>`).join('');
 const body=()=>{const A_=a(),t=now();
  if(tab==='bag'){const inv=Object.entries(A_.inv),act=A_.act;
   return`<p class="adw-sub">Находки, которые Гудок выловил из Шума: старые детали связи, бонусы и реликвии. Буст работает на N статусов; одновременно — до 3.</p>
    ${act.length?`<h4>Активно</h4><div class="adw-grid">${act.map(x=>{const L=A.lootById(x.id);return`<div class="adw-it on" style="--c:${TC(L.r)}"><b>${IC[L.r]} ${esc(L.n)}</b><span>${esc(L.t)}</span><em>осталось ${x.left}</em></div>`}).join('')}</div>`:''}
    <h4>В рюкзаке</h4>${inv.length?`<div class="adw-grid">${inv.map(([id,n])=>{const L=A.lootById(id);return`<div class="adw-it" style="--c:${TC(L.r)}"><b>${IC[L.r]} ${esc(L.n)}${n>1?' ×'+n:''}</b><span>${esc(L.t)}</span><button data-use="${id}">Включить</button><details class="adw-help"><summary>Что это и как работает</summary>${lootHelp(L)}</details></div>`}).join('')}</div>`:'<p class="adw-empty">Пусто. Шум ловится на мусорных звонках (VOICEMAIL, SKIP, гейткипер) — чаще в счастливые часы.</p>'}
    ${Object.keys(A_.relic).length?`<h4>Реликвии (навсегда)</h4><div class="adw-grid">${Object.keys(A_.relic).map(id=>{const L=A.lootById(id);return`<div class="adw-it relic" style="--c:${TC('l')}"><b>★︎ ${esc(L.n)}</b><span>${esc(L.t)}</span></div>`}).join('')}</div>`:''}
    <p class="adw-foot">Заморозка: <b>${A_.frz.ch}</b> · Гарант: скрыт, но он есть</p>`}
  if(tab==='tree'){const fresh=!(save.story&&(save.story.sw||(save.story.seen||{})['sys-switch']));return`${fresh?`<div class="adw-intro"><p><b>Гудок</b>Слушай. Под брезентом у стены — не хлам. Это ручной пульт телефонной станции. Двенадцать рядов гнёзд, штекеры на шнурах.</p>
    <p><b>Лом</b>«Заря-12». Последний ручной коммутатор города. Гараж стоит на том, что от станции осталось. Не трогай гнездо ноль.</p>
    <p><b>Гудок</b>Сигнал из твоих звонков зажигает гнёзда. Каждое гнездо — линия, по которой мне легче работать. Странно: я знаю, куда втыкать штекеры. Руки помнят. У меня нет рук.</p><button data-sw>Понял</button></div>`:''}<div class="adw-sbh"><p class="adw-sub">Ручной пульт из-под брезента в гараже. Сигнал зажигает гнёзда: каждое — новый штекер в линии, следующий дороже. Чем больше гнёзд горит, тем больше Гудок вспоминает. ⓘ у линии — подробно.</p><div class="adw-sig">${SG}<b>${A_.sig.toLocaleString('ru')}</b><small>Сигнал</small></div></div>
   ${boardHtml({tree:A_.tree,sig:A_.sig,info:sbInfo,SG,just:sbJust})}
   <h4>Память пульта · гнёзд горит ${A.treeSum(save)} из 36</h4><ul class="adw-mem">${A.MEM.map(([n,t])=>A.treeSum(save)>=n?`<li><i>${n}</i>${esc(t)}</li>`:`<li class="lk"><i>${n}</i>· · ·</li>`).join('')}</ul>
   ${(()=>{const seen=(save.story&&save.story.seen)||{},got=Object.keys(CLUES).filter(d=>seen['b-'+d+'-clue']);return`<h4>Обрывки той ночи · ${got.length} из ${Object.keys(CLUES).length}</h4><ul class="adw-mem">${Object.keys(CLUES).map(d=>got.includes(d)?`<li><i>${d}</i><span><b>${esc(CLUES[d].n)}.</b> ${esc(CLUES[d].t)}</span></li>`:`<li class="lk"><i>${d}</i>· · · район ${d}</li>`).join('')}</ul>`})()}
   <p class="adw-foot">Бонусы связистов, предметов и улучшений действуют вместе; счастливые часы усиливают их дополнительно.</p>`}
  if(tab==='ops'){const o=A_.ops,cap=o.rooms*A.OPS.roomCap,h=Math.min(12,Math.floor(A_.sigLife/400));
   if(!A.synOk(save))return`<p class="adw-sub">Связистов пока нет. Кто они и почему придут именно к тебе — узнаешь в районе 2, <b>Industrial Zone</b>.</p><div class="adw-base lk"><p class="adw-foot">Мачта уже растёт из накопленного Сигнала: ${h}/12.</p></div>`;
   return colHtml({o:CO.colEnsure(A_),district:G().district||1})}
  if(tab==='look'){const open_=1+A.adTotals(save,t).themes;return`<p class="adw-sub">Темы оформления открываются линией «Вид» в Коммутаторе (${Math.min(open_,A.THEMES.length)}/${A.THEMES.length}).</p>
   <div class="adw-th">${A.THEMES.map(([id,n,c],i)=>`<button data-th="${id}" ${i>=open_?'disabled':''} class="${A_.theme===id?'on':''}" style="--c:${c}"><i></i>${esc(n)}${i>=open_?' '+icon('lock','ic-in'):''}</button>`).join('')}</div>`}
  const D=A_.drops.slice(0,14),P=A_.purge.log.slice(0,8);
  return`<h4>Последний лут</h4>${D.length?`<ul class="adw-log">${D.map(x=>{const L=A.lootById(x.id);return`<li style="--c:${TC(x.tier)}"><b>${IC[x.tier]} ${esc(L?L.n:x.id)}</b> ${x.chest?'· сундук':''} <span>${new Date(x.t).toLocaleString('ru',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span></li>`}).join('')}</ul>`:'<p class="adw-empty">Пока ничего.</p>'}
   <h4>Ночная чистка</h4>${P.length?`<ul class="adw-log">${P.map(x=>`<li class="${x.shield?'ok':'bad'}"><b>${x.k}</b> ${x.n}/${A.AD.norm} наборов · ${x.shield?'щит сработал':`−${x.dx} прогресса, −${$m(x.dm)}${x.op?', ушёл связист':''}`}</li>`).join('')}</ul>`:'<p class="adw-empty">Пока ARCHON к тебе не приходил.</p>'}
   <p class="adw-foot">Норма: ${A.AD.norm} наборов в рабочий день. Серия дней с нормой: <b>${A_.normDays}</b> (+${Math.min(A.AD.normDay.max,A_.normDays)}% XP и $). Шумов поймано: ${A_.stats.spins}, сундуков: ${A_.stats.chests}, легенд: ${A_.stats.legend}</p>`};
 const draw=()=>{if(!win)return;win.innerHTML=`<div class="adw t-${tab}" role="dialog" aria-label="Коммутатор"><header><b class="adw-ttl"><small>ГАРАЖ</small>«ЗАРЯ-12»</b><nav>${tabsH()}</nav><button class="x" aria-label="Закрыть (Esc)"><svg viewBox="0 0 16 16" width="14" height="14" stroke="currentColor" stroke-width="2"><path d="M3 3l10 10M13 3L3 13"/></svg></button></header><div class="adw-b">${body()}</div></div>`;
  win.querySelector('.x').onclick=close;if(tab==='tree')requestAnimationFrame(()=>fitCords(win));{const sw=win.querySelector('[data-sw]');if(sw)sw.onclick=()=>{(save.story||(save.story={})).sw=1;persist();draw()}}win.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{tab=b.dataset.t;if(onTab(tab,()=>open(tab))){close();return}if(tab==='ops'&&A.synOk(save)&&!(a().ops.plot|0)&&onSys('col',()=>open('ops'))){close();return}draw()});
  win.querySelectorAll('[data-use]').forEach(b=>b.onclick=()=>{const r=A.activate(save,b.dataset.use);if(!r.ok)toast(r.why,'bad');else{sfx('levelup');persist()}draw()});
  win.querySelectorAll('[data-info]').forEach(b=>b.onclick=()=>{const v=b.dataset.info||null;sbInfo=sbInfo===v?null:v;draw()});
  win.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{const s0=A.treeSum(save);const r=A.buyTree(save,b.dataset.buy);if(!r.ok)toast(r.why,'bad');else{sbJust={id:b.dataset.buy,lv:a().tree[b.dataset.buy]|0};setTimeout(()=>{sbJust=null},1200);sfx('levelup');persist();const s1=A.treeSum(save),mm=A.MEM.find(([n])=>n>s0&&n<=s1);if(mm)toast('Гудок: «'+mm[1]+'»','gold');if(b.dataset.buy==='look')toast('Открыта новая тема: вкладка «Темы»','gold')}draw()});
  const rm=win.querySelector('[data-room]');if(rm)rm.onclick=()=>{const r=A.buyRoom(save,G());if(!r.ok)toast(r.why,'bad');else{sfx('ching');persist()}draw()};
  {const ug=win.querySelector('[data-under]');if(ug)ug.onclick=()=>{close();onUnder&&onUnder()}}
  const hr=win.querySelector('[data-hire]');if(hr)hr.onclick=()=>{const r=A.hireOp(save,G());if(!r.ok)toast(r.why,'bad');else{sfx('ching');persist();toast('Новый связист на базе: +'+A.OPS.perOp+'% XP и $','gold')}draw()};
  win.querySelectorAll('[data-th]').forEach(b=>b.onclick=()=>{a().theme=b.dataset.th;persist();theme();draw()})};
 const theme=()=>{const th=A.THEMES.find(x=>x[0]===a().theme)||A.THEMES[0];document.querySelectorAll('.wk').forEach(w=>{if(th[0]==='base')w.style.removeProperty('--v-acc');else w.style.setProperty('--v-acc',th[2])})};
 // ---------- рулетка Шума ----------
 const spin=(S,cb)=>{spinning=true;const off=fx()==='off';
  const pool=S.chest?['e','l']:['c','u','r','e','l'],tile=()=>{const r=S.chest?(Math.random()<.8?'e':'l'):['c','c','c','u','u','r','e','l'][Math.random()*8|0];return A.pickLoot(r)},N=34,win_=30;
  const items=Array.from({length:N},tile);items[win_]=A.lootById(S.id);if(S.tier!=='l'){items[win_+1]=A.pickLoot('l');items[win_-1]=A.pickLoot(S.chest?'l':'e')}   // near-miss: легенда в одном шаге
  const w=document.createElement('div');w.className='adr-wrap'+(S.chest?' chest':'');w.innerHTML=`<div class="adr"><div class="adr-h">${S.track?'НАГРАДА ЗА ЦЕЛЬ ДНЯ':S.chest?'СУНДУК ГАРАНТА':'ШУМ НА ЛИНИИ'}<span>${S.track?'цель выполнена: '+esc(S.track):S.chest?'Гудок долго копил помехи — и выловил крупное':'в мусорном звонке что-то есть…'}</span></div>
   <div class="adr-win"><div class="adr-tape">${items.map(L=>`<div class="adr-t" style="--c:${TC(L.r)}"><i>${IC[L.r]}</i><b>${esc(L.n)}</b></div>`).join('')}</div><u class="adr-needle"></u></div><div class="adr-res"></div></div>`;
  document.body.appendChild(w);const tape=w.querySelector('.adr-tape'),TW=132,vw=w.querySelector('.adr-win').clientWidth,target=win_*TW-vw/2+TW/2+(Math.random()*.5-.25)*TW;
  let done=false,ticks=[];const D=off?300:2900;
  const finish=()=>{if(done)return;done=true;ticks.forEach(clearTimeout);tape.style.transition='none';tape.style.transform=`translateX(${-(win_*TW-vw/2+TW/2)}px)`;const el=tape.children[win_];el.classList.add('win');
   const L=A.lootById(S.id);w.querySelector('.adr-res').innerHTML=`<em style="color:${TC(S.tier)}">${TN(S.tier)}</em><b>${esc(L.n)}</b><span>${esc(L.t)}</span>${S.got&&S.got.instant&&S.got.instant.length?`<i>${esc(S.got.instant.join(' · '))}</i>`:''}
    <div>${L.calls?`<button class="pri" data-on>Включить сейчас</button><button data-k>В рюкзак</button>`:'<button class="pri" data-k>Забрать</button>'}<button class="adr-q" data-q aria-expanded="false">Что это?</button></div><div class="adr-help" hidden>${lootHelp(L)}</div><small class="adr-wait">Автонабор ждёт: следующий звонок начнётся, когда закроешь это окно</small>`;
   sfx(S.tier==='l'||S.tier==='e'?'fanfare':'ching');if(J&&J.burst&&!off){const r=el.getBoundingClientRect();J.burst(r.left+r.width/2,r.top+r.height/2,S.tier==='l'?80:40,{cols:[TC(S.tier),'#fff'],speed:420,g:500,life:1,r:2.4,s:'spark'})}
   const end=(on)=>{if(on){const r=A.activate(save,S.id);if(!r.ok)toast(r.why,'bad')}persist();w.classList.add('out');setTimeout(()=>w.remove(),200);spinning=false;removeEventListener('keydown',k2,true);render(1);if(cb)cb();else holdDial(false)};
   const b1=w.querySelector('[data-on]'),b2=w.querySelector('[data-k]'),bq=w.querySelector('[data-q]');if(b1)b1.onclick=()=>end(1);b2.onclick=()=>end(0);bq.onclick=()=>{const h=w.querySelector('.adr-help');h.hidden=!h.hidden;bq.setAttribute('aria-expanded',String(!h.hidden));bq.textContent=h.hidden?'Что это?':'Скрыть'}};   // кусок 28: само не закрывается — автонабор ждёт
  const k2=e=>{e.stopPropagation();if(e.code==='Slash'||e.key==='?'){e.preventDefault();const q=w.querySelector('[data-q]');q&&q.click();return}if(['Enter','Space','Escape'].includes(e.code)){e.preventDefault();if(!done)finish();else{const b=w.querySelector('[data-k]');b&&b.click()}}};addEventListener('keydown',k2,true);
  w.onclick=e=>{if(!done&&!e.target.closest('button'))finish()};
  requestAnimationFrame(()=>{tape.style.transition=`transform ${D}ms cubic-bezier(.12,.72,.18,1)`;tape.style.transform=`translateX(${-target}px)`});
  if(!off)for(let i=0;i<26;i++){const q=i/26,tt=D*(1-Math.pow(1-q,.55))*.98;ticks.push(setTimeout(()=>sfx('tick'),tt))}
  setTimeout(finish,D+80);waitMs=D+2400};
 // ---------- перк 1 из 3 ----------
 const perk=opts=>{const w=document.createElement('div');w.className='adp-wrap';w.innerHTML=`<div class="adp"><h3>ГУДОК ПЕРЕСТРАИВАЕТ ЛИНИЮ</h3><p>50 наборов подряд — выбери одно усиление на час</p><div class="adp-c">${opts.map(id=>{const p=A.PERKS3.find(x=>x.id===id);return`<button data-p="${id}"><b>${esc(p.n)}</b><span>${esc(p.t)}</span><em>на 60 мин</em></button>`}).join('')}</div><small>Можно выбрать позже: перк ждёт до следующих 50</small></div>`;
  document.body.appendChild(w);const done=id=>{if(id){const r=A.pickPerk(save,id,now());if(r.ok){sfx('levelup');toast('★︎ '+r.p.n+' — на час','gold');persist()}}w.remove();render(1);holdDial(false)};
  w.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>done(b.dataset.p));w.onclick=e=>{if(e.target===w)done(null)};sfx('chime')};
 // ---------- призрак ----------
 const ghost=(rec)=>{const el=document.getElementById('adx-gh');if(!el)return;const g=A.ghostLine(save,now(),ghI++,rec);if(!g){el.className='adx-gh';return}
  el.className='adx-gh on '+g.k;const H=g.h||(g.k==='win'?'Новый рекорд':'Ты против себя'),T=String(g.t).replace(/^РЕКОРД · /,'');el.innerHTML=`<em>${H}</em><span>${T.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</span>${g.p!=null?`<i><b style="width:${Math.round(Math.min(1,g.p)*100)}%"></b></i>`:''}`;clearTimeout(ghT);ghT=setTimeout(()=>{el.className='adx-gh'},g.k==='win'?10000:8000);if(g.k==='win')sfx('chime')};
 // ---------- после статуса ----------
 const pre=()=>{waitMs=0;if(a().frz.on)unfreeze('статус')};
 const onStatus=(out)=>{const o=out&&out.ad;if(!o)return;if(o.spin)waitMs=450+(fx()==='off'?300:2900)+1200;if(o.spin||o.perk)holdDial(true);
  if(o.warm){if(warmDone)warmDone({moneyTxt:$m(o.warm.money),sig:o.warm.sig});else toast(`РАЗГОН пройден: +${$m(o.warm.money)} и +${o.warm.sig} Сигнала. Линия прогрелась`,'gold')}
  if(o.freeze)toast(`❄︎ +1 заряд Заморозки (${o.freeze}) — F`);
  for(const x of o.tracks||[])toast(`Цель дня: ${x.name} ${x.n} ✓ — ${x.rt}`,'gold');
  if(o.raid&&o.raid.extracted){toast(`РЕЙД ВЫВЕДЕН: ${$m(o.raid.base)} ×${A.AD.raid.k} = ${$m(o.raid.extracted)}`,'gold');sfx('fanfare')}
  if(o.raid&&o.raid.burned!=null)toast(`Рейд сорвался: буфер ${$m(o.raid.burned)} сгорел`,'bad');
  if(o.spin)setTimeout(()=>spin(o.spin,o.perk?()=>perk(o.perk):null),450);else if(o.perk)setTimeout(()=>perk(o.perk),600);
  ghost(out.ghost);render(1)};
 // ---------- Ночная чистка и срыв рейда ----------
 const tick=async()=>{if(a().frz.on&&now()-a().frz.at>=A.AD.freeze.sec*1000)unfreeze('время');const r=ses.adTick(now());persist();if(r.raid)toast(`Рейд сорвался: пауза дольше окна. Буфер ${$m(r.raid.burned)} сгорел`,'bad');
  const P=r.purge.filter(x=>!x.shield),S=r.purge.filter(x=>x.shield);
  if(P.length){const dx=P.reduce((s,x)=>s+x.dx,0),dm=P.reduce((s,x)=>s+x.dm,0),op=P.reduce((s,x)=>s+x.op,0),ls=Math.max(...P.map(x=>x.lostStreak||0));
   await ask({title:'Ночная чистка',tone:'bad',ok:'Понял',cancel:'Журнал',text:`ARCHON прошёлся ночью по линиям, где было тихо. ${P.map(x=>`<b>${x.k}</b>: ${x.n} из ${A.AD.norm} наборов`).join(', ')}.<br>Стёрто: <b>−${dx} прогресса района</b>${dm?`, <b>−${$m(dm)}</b>`:''}${op?`, ушёл <b>${op} связист</b>`:''}${ls?`. Серия дней с нормой (${ls}) обнулилась`:''}.<br><br>Каждый звонок уменьшает потерю денег. Чтобы избежать чистки полностью, выполни норму.`}).then(v=>{if(!v)open('log')})}
  if(S.length)toast(`Ночная чистка прошла мимо: щит сработал (${S.map(x=>x.k).join(', ')})`,'gold');render(1)};
 const key=e=>{if(spinning)return true;if(e.code==='KeyF'&&unl('freeze')){freeze();return true}if(e.code==='KeyB'&&unl('bag')){win?close():open('bag');return true}return false};
 const dayLine=n=>{const A_=a();return n>=A.AD.norm?`норма ✓${A_.normDays?` · серия ${A_.normDays} дн.`:''}`:`до нормы ${A.AD.norm-n}`};
 const style=(t,G_)=>{const c=now()-15*60000,talk=(G_.undo||[]).some(u=>u.t>c&&['TALK','CALLBACK','BOOKED','DISCOVERY'].includes(u.cls));return A.styleRank(t.rate||0,talk)};
 // D6 v2: итог смены — что ты сделал сегодня против своих рекордов и «обычного себя». Неделя — только в пятницу (конец рабочей недели).
 const pl=(n,a,b,c)=>{n=Math.abs(n)%100;const m=n%10;return n>10&&n<20?c:m===1?a:m>=2&&m<=4?b:c};
 const summary=()=>{const t=now(),k=dayKey(t),days=save.days||{},g=save.gh||{},A_=a(),dd=days[k]||{n:0,c:{}},n=dd.n,R=g.rec||{},R0=g.rec0||{};
  const T=g.k===k?g.t:[];let b10=0,f20=null;for(let x=0,y=0;x<T.length;x++){while(T[x]-T[y]>6e5)y++;b10=Math.max(b10,x-y+1);if(x>=19){const v=T[x]-T[x-19];if(f20==null||v<f20)f20=v}}
  let p20b=0;{const P=g.k===k?(g.pt||[]):[];for(let x=0,y=0;x<P.length;x++){while(P[x]-P[y]>12e5)y++;p20b=Math.max(p20b,x-y+1)}}
  const ptOf=v=>v.p!=null?v.p:((v.c||{}).BOOKED||0)+((v.c||{}).DISCOVERY||0),pt=ptOf(dd),rate=n?Math.round(pt/n*100):0;   // J1: питч = pitched / booked / discovery
  const past=Object.entries(days).filter(([x,v])=>x<k&&v&&v.n>=20&&v.p!=null).slice(-10).map(([,v])=>ptOf(v)/v.n*100),ur=past.length?Math.round(past.reduce((x,y)=>x+y,0)/past.length):0;
  const broke=Object.keys(g.shown||{}).filter(id=>g.k===k),RN={p20:'питчи за 20 минут',f20:'быстрые 20',b10:'10 минут',b60:'час',p100:'питчи на 100',ft:'первый питч',day:'наборы за день'};
  const fri=new Date(t).getDay()===5;let wk=0;if(fri)for(let x=0;x<5;x++)wk+=((days[dayKey(t-x*864e5)]||{}).n||0);const wb=(g.wk&&g.wk.b0)||0;
  const sigD=A_.tr.k===k?A_.sigLife-(A_.tr.sig0||0):0,drops=A_.drops.filter(x=>dayKey(x.t)===k).length;
  return`<div class="sm-g"><div><span>Рекорды сегодня</span><b>${broke.length}</b><i>${broke.length?broke.map(x=>RN[x]).join(', '):'ни одного — завтра шанс'}</i></div>
   <div><span>Лучшие 10 минут</span><b>${b10} <small>${pl(b10,'звонок','звонка','звонков')}</small></b><i>рекорд: ${R.b10||b10} ${pl(R.b10||b10,'звонок','звонка','звонков')} за 10 минут</i></div>
   <div><span>Быстрые 20 наборов</span><b>${f20!=null?A.mmssR(f20):'—'}</b><i>${R.f20?'рекорд '+A.mmssR(R.f20):'нужно 20 наборов'}</i></div>
   <div><span>Питчи на каждые 100 звонков</span><b>${rate} <small>${pl(rate,'питч','питча','питчей')}</small></b><i>${ur&&rate>=ur?`обычно ${ur} <em class="up">${rate>ur?'+'+(rate-ur):'вровень'}</em>`:`лучшие 20 минут: ${p20b} ${pl(p20b,'питч','питча','питчей')}`}</i></div>
   <div><span>Норма ${A.AD.norm}</span><b>${n>=A.AD.norm?'✓':n+'/'+A.AD.norm}</b><i>${!isWork(t)?'выходной: чистки нет':n>=A.AD.norm?'Ночная чистка не придёт':'ночью придёт ARCHON: −'+A.purgePreview(save,ses.G,t,n).dx.toLocaleString('ru')+' XP района'}</i></div>
   ${fri?`<div><span>Неделя (пн–пт)</span><b>${wk} <small>${pl(wk,'звонок','звонка','звонков')}</small></b><i>${wb?`лучшая неделя ${Math.max(wb,wk)}${wk>wb?' — это она!':''}`:'первая неделя в учёте'}</i></div>`:`<div><span>Сигнал и Шум</span><b>${sigD}</b><i>Шум за день: ${drops}</i></div>`}</div>`};
 addEventListener('resize',()=>{if(win&&tab==='tree')fitCords(win)});
 theme();setTimeout(tick,1500);addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});setInterval(tick,36e5);setInterval(()=>{const R=a().raid;if(R&&R.on&&!a().frz.on&&now()>R.dl)tick()},5000);
 return{summary,html,render,pre,onStatus,key,wait:()=>waitMs,open,close,isOpen:()=>!!win||spinning,dayLine,style,tick,freeze,theme}}
