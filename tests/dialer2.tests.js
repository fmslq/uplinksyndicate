// R1 ч.3: перенос логики дайлера без DOM. Фейковые часы, хранилище, сеть, Zoom.
import {parseZoomHistory,matchCall,matchGroup,viaApp} from '../dialer/zoomcsv.js';
import {readFileSync} from 'node:fs';
import {BUTTONS,SHEET,sheetValue,statusIndex,cleanResult,SHEET_VALUES} from '../dialer/statuses.js';
import {parse,ser,Table} from '../dialer/table.js';
import {localTime,tzk} from '../dialer/geo.js';
import {tempo} from '../dialer/tempo.js';
import {Dialer} from '../dialer/dialer.js';
import {suggestFromLog,ZO} from '../dialer/zoom.js';
import {STATUS} from '../core/config.js';
const T=[],t=(n,f)=>{try{T.push([n,!!f()])}catch(e){T.push([n+' ('+e.message+')',false])}};
const CSV=readFileSync(new URL('./fixture-leads.csv',import.meta.url),'utf8');
function env(over={}){let now=Date.UTC(2026,10,3,15,0,0);const timers=[],m=new Map(),sent=[],posts=[];
 const E={now:()=>now,store:{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))},
  setTimeout:(f,ms)=>{const o={f,at:now+ms,id:timers.length+1};timers.push(o);return o.id},clearTimeout:id=>{const o=timers.find(x=>x.id===id);if(o)o.f=null},
  zoomSend:x=>sent.push(x),https:true,fetch:async(u,o)=>{const b=JSON.parse(o.body);posts.push(b);return{json:async()=>E.reply(b)}},reply:()=>({ok:true}),...over};
 E.adv=ms=>{now+=ms;let o;while((o=timers.filter(x=>x.f&&x.at<=now).sort((a,b)=>a.at-b.at)[0])){const f=o.f;o.f=null;f()}};
 E.m=m;E.sent=sent;E.posts=posts;return E}
const tick=()=>new Promise(r=>setImmediate(r));
export async function runDialer2Tests(){
 // --- статусы: ровно как в старом дайлере
 t('15 кнопок статусов с теми же названиями и порядком, что в старом дайлере и core/config',()=>BUTTONS.length===15&&BUTTONS.every((b,i)=>b.name===STATUS[i].name&&b.key===STATUS[i].key));
 t('в таблицу уходит значение из её выпадающего списка (GATEKEEPER → «GATEKEEPER НЕ ПРОПУСТИЛ» и ещё 4)',()=>sheetValue(5)==='GATEKEEPER НЕ ПРОПУСТИЛ'&&sheetValue(3)==='DM Pitched & Hung up'&&sheetValue(2)==='OWNER HUNG UP/NOT INTERESTED'&&sheetValue(0)==='Автоответчик/Нет ответа'&&sheetValue(4)==='CALL BOOKED');
 t('каждое значение кнопки есть в выпадающем списке таблицы (кроме «Автоответчик: Были гудки»-копий нет)',()=>BUTTONS.every(b=>SHEET_VALUES.includes(sheetValue(b.i))));
 t('значение из таблицы распознаётся обратно в кнопку (все 15)',()=>BUTTONS.every(b=>statusIndex(sheetValue(b.i))===b.i));
 t('ручная замена значения (P.map) работает и распознаётся',()=>{const map={'Другое':'Другое (x)'};return sheetValue(6,map)==='Другое (x)'&&statusIndex('Другое (x)',map)===6});
 t('«Not called» и невидимый «⠀» из таблицы = пустой статус',()=>cleanResult('Not called')===''&&cleanResult('\u2800')===''&&cleanResult(' Call back ')==='Call back');
 // --- таблица
 t('CSV: запись сохраняет формат (CRLF, кавычки, запятые внутри)',()=>{const s='Phone,Notes\r\n5015550000,"a, ""b"""\r\n';const tb=new Table().loadText(s,'x.csv');return tb.serialize().startsWith('Phone,Notes')&&tb.serialize().includes('"a, ""b"""')&&tb.nl==='\r\n'&&tb.tail});
 t('TSV распознаётся по табуляциям',()=>new Table().loadText('Phone\tBusiness\n5015550000\tA\n','x').d==='\t');
 t('нет колонки Phone → понятная ошибка',()=>{try{new Table().loadText('A,B\n1,2','x');return false}catch(e){return /Phone/.test(e.message)}});
 t('недостающие Date Engaged/Result/Notes/Callback? добавляются в конец',()=>{const tb=new Table().loadText('Phone\n5015550000\n','x');return ['Date Engaged','Result','Notes','Callback?'].every(n=>tb.ix(n)>=0)});
 const real=new Table().loadText(CSV,'leads.csv');
 t('твоя таблица: 947 строк, 15 колонок, лиды с телефоном читаются',()=>real.L.length===947&&real.h.length===15&&real.L.filter(l=>real.ph(l)).length>500);
 t('колонка Prep: читается, если есть; без неё блок не показывается',()=>{const tb=new Table().loadText('Phone,Prep,Notes\n5015550000,спросить про зиму,\n','x');return tb.hasPrep()&&tb.prep(tb.L[0])==='спросить про зиму'&&!real.hasPrep()});
 t('местное время: VA = Eastern, у них часы и пометка рабочего времени',()=>{const tb=new Table().loadText('Phone,State,Adress\n5015550000,VA,"1 Main St, Chesapeake, VA 23320"\n','x');const lt=localTime(tb,tb.L[0],new Date(Date.UTC(2026,10,3,15)));return tzk(tb,tb.L[0])==='Eastern'&&lt.state==='VA'&&lt.work===true});
 // --- дайлер целиком
 const mk=(o)=>{const E=env(o);const d=new Dialer(E);d.zoom.ready=true;return{E,d}};
 t('загрузка таблицы: первый необработанный лид с телефоном, «Дальше: …»',()=>{const {d}=mk();d.loadText(CSV,'leads.csv');const v=d.view();return v.loaded&&v.lead&&v.lead.phone.startsWith('+1')&&!v.lead.result&&v.next});
 t('Позвонить: номер уходит во встроенный Zoom командой zp-make-call (как раньше)',()=>{const {E,d}=mk();d.loadText(CSV,'l.csv');d.dial();const m=E.sent.pop();return m.type==='zp-make-call'&&m.data.number===d.view().lead.phone&&m.data.autoDial===true});
 t('статус: пишет значение таблицы и дату, лид уходит, автонабор следующего',()=>{const {E,d}=mk();d.loadText(CSV,'l.csv');const l=d.cur,ph0=d.t.ph(l);d.setStatus(5);const calls=E.sent.filter(x=>x.type==='zp-make-call');return d.t.get(l,'Result')==='GATEKEEPER НЕ ПРОПУСТИЛ'&&/^2026-11-03 \d{1,2}:\d{2} [AP]M [A-Z]{2,5}$/.test(d.t.get(l,'Date Engaged'))&&d.t.ph(d.cur)!==ph0&&calls.length===1});
 t('игра запретила CALL BOOKED (короче 3 мин): в таблицу ничего не пишется, лид остаётся, событие statusRefused',()=>{const {d}=mk({canStatus:(k)=>k===4?{ok:false,why:'short',dur:95,min:180}:{ok:true}});d.loadText(CSV,'l.csv');const l=d.cur;let ev=null;d.bus.on('statusRefused',e=>ev=e);
  const r=d.setStatus(4);const ok1=r.refused==='short'&&d.t.res(l)===''&&d.cur===l&&ev&&ev.dur===95;d.setStatus(0);return ok1&&d.t.res(l)!==''});
 t('история Zoom (твой CSV): 34 звонка, длительность, ожидание, результаты, через приложение Mac',()=>{const z=parseZoomHistory(readFileSync(new URL('./fixture-zoom-history.csv',import.meta.url),'utf8'));const c=z.calls;
  const a=c.find(x=>x.number==='+17572989922');return z.ok&&c.length===34&&c.filter(x=>x.dir==='out').length===27&&a.dur===168&&a.wait===9&&a.connected&&c.find(x=>x.result==='Canceled').dur===0&&viaApp(z.devices)});
 t('история Zoom: повторный набор того же номера = берётся последний звонок до статуса',()=>{const z=parseZoomHistory(readFileSync(new URL('./fixture-zoom-history.csv',import.meta.url),'utf8'));const at=new Date('2026-11-02T11:57:00').getTime();
  const m=matchCall(z.calls,'+17573528923',at);return m&&m.dur===45&&matchCall(z.calls,'+17573528923',new Date('2026-11-02T11:56:08').getTime()).dur===8&&!matchCall(z.calls,'+17573528923',new Date('2026-11-02T11:00:00').getTime())});
 t('история Zoom: 3 набора одного номера между статусами = одна группа; набор 8 с (<30 с) не прибавлен, длительность 45',()=>{const z=parseZoomHistory(readFileSync(new URL('./fixture-zoom-history.csv',import.meta.url),'utf8'));const g=matchGroup(z.calls,'+17573528923',new Date('2026-11-02T11:57:10').getTime(),new Date('2026-11-02T11:48:00').getTime());return g&&g.redials===2&&g.dur===45});
 t('Zoom не подключился: дайлер НЕ звонит молча через приложение, показывает окно; «продолжить» = через приложение с плашкой',()=>{const {E,d}=mk();d.zoom.ready=false;d.loadText(CSV,'l.csv');const g=[];d.bus.on('zoomGate',e=>g.push(e.state));let app=0;d.bus.on('zoomViaApp',()=>app++);
  d.dial();const blocked=!d.calling&&g.includes('failed')&&!E.sent.some(x=>x.type==='zp-make-call');d.zoom.bypass();d.dial();return blocked&&app===1});
 t('Zoom: проверка при старте, подключился за время ожидания = ready',()=>{const {d}=mk();d.zoom.ready=false;const g=[];d.bus.on('zoomGate',e=>g.push(e.state));d.zoom.startGate(15000);d.zoom.onApiReady();return g.join()==='connecting,ready'&&d.zoom.gate==='ready'});
 t('история Zoom: чужой файл не принимается',()=>!parseZoomHistory('a,b\n1,2').ok);
 t('повтор того же статуса снимает его (как раньше)',()=>{const {d}=mk();d.loadText(CSV,'l.csv');d.setOnly(false);const l=d.cur;d.setStatus(0);d.back();d.setStatus(0);return d.t.res(l)===''});
 t('«Убрать статус» (X) очищает статус и дату, счёт дня откатывается',()=>{const {d}=mk();d.loadText(CSV,'l.csv');const l=d.cur;d.setStatus(0);const n=d.ses.tot;d.clearStatus(l);return d.t.res(l)===''&&d.t.get(l,'Date Engaged')===''&&d.ses.tot===n-1});
 t('Отложить (S): лид в конец очереди, не статус',()=>{const {d}=mk();d.loadText(CSV,'l.csv');const l=d.cur;d.skip();return d.cur!==l&&d.t.res(l)===''&&d.q.list().slice(-1)[0]===d.t.L.indexOf(l)});
 t('Прошлый лид (Z) возвращает, на первом лиде тост',()=>{const {d,E}=mk();let toast='';d.bus.on('toast',x=>toast=x);d.loadText(CSV,'l.csv');d.back();const a=/первый/.test(toast);const l=d.cur;d.skip();d.back();return a&&d.cur===l});
 t('Пауза: автонабор не идёт; снятие паузы звонит текущему',()=>{const {d,E}=mk();d.loadText(CSV,'l.csv');d.pause();d.setStatus(0);const n1=E.sent.length;d.pause();return n1===0&&E.sent.length===1});
 t('после CALL BOOKED автонабор ждёт 1 с (игра может задать своё время праздника)',()=>{const {d,E}=mk();d.loadText(CSV,'l.csv');d.setStatus(4);const a=E.sent.length;E.adv(1000);const b=E.sent.length;d.setStatus(0,()=>3000);E.adv(2999);const c=E.sent.length;E.adv(1);return a===0&&b===1&&c===1&&E.sent.length===2});
 t('каждые 25 звонков событие спринта, на 100 праздник (смысл старой геймификации)',()=>{const {d}=mk();d.loadText(CSV,'l.csv');d.pause();const ms=[];for(let i=0;i<100;i++){const r=d.setStatus(0);if(r&&r.milestone)ms.push(r.milestone.kind)}return ms.length===4&&ms.slice(0,3).every(k=>k==='sprint')&&ms[3]==='hundred'});
 t('выбор лида: фильтры штат/тип/пояс есть, поиск по заметкам и Prep, клик стартует очередь с него',()=>{const {d}=mk();d.loadText(CSV,'l.csv');const p=d.picker({q:'',type:'',state:'',tz:''});const r=p.rows[7];d.pickLead(r.i,{});return p.chips.state.includes('VA')&&p.chips.type.length>0&&p.chips.tz.includes('Eastern')&&d.t.L.indexOf(d.cur)===r.i});
 t('фильтр «только VA + Deck builder» сужает очередь',()=>{const {d}=mk();d.loadText(CSV,'l.csv');d.setFilter({state:'VA',type:'Deck builder'});return d.q.list().every(i=>d.t.get(d.t.L[i],'Type of company').trim()==='Deck builder')&&d.q.remaining()>0});
 t('фильтры запоминаются для файла (P.files, ключ pd2 как раньше)',()=>{const {d,E}=mk();d.loadText(CSV,'l.csv');d.setFilter({state:'VA'});const P=JSON.parse(E.m.get('pd2'));return P.files['l.csv'].state==='VA'});
 // --- Google Sheets
 t('статус ставится в очередь pd2q и уходит в Apps Script со значением из списка таблицы',async()=>true);
 { const {d,E}=mk();d.setSheets({on:true,url:'https://script.google.com/x/exec',token:'abc'});d.loadText(CSV,'l.csv');d.setStatus(5);await tick();await tick();
   t('…отправка: Result = «GATEKEEPER НЕ ПРОПУСТИЛ», с секретом и датой',()=>{const b=E.posts[0];return b&&b.secret==='abc'&&b.set.Result==='GATEKEEPER НЕ ПРОПУСТИЛ'&&/^2026-11-03( \d{1,2}:\d{2} [AP]M [A-Z]{2,5})?$/.test(b.set['Date Engaged'])&&d.sheets.SQ.length===0}); }
 { const {d,E}=mk({reply:()=>({ok:false,code:'secret'})});d.setSheets({on:true,url:'https://script.google.com/x/exec',token:'abc'});d.loadText(CSV,'l.csv');d.setStatus(0);await tick();await tick();
   t('неверное слово: запись остаётся в очереди (pd2q) и повторится через 60 с',()=>d.sheets.SQ.length===1&&JSON.parse(E.m.get('pd2q')).length===1&&d.sheets.err==='secret'); }
 { const {d}=mk({reply:()=>({ok:false,code:'validation'})});d.setSheets({on:true,url:'https://script.google.com/x/exec',token:'abc'});d.loadText(CSV,'l.csv');d.setStatus(0);await tick();await tick();
   t('ошибка проверки данных: запись остаётся в очереди с понятным баннером',()=>d.sheets.SQ.length===1&&d.sheets.fail===1&&/выпадающим списком/.test(d.sheets.msg[0])); }
 { const rows=real.L.map((l,i)=>({r:i+2,c:l.v}));const {d}=mk({reply:b=>b.read?{ok:true,head:real.h,rows,doc:'Doc',tab:'Oct',gid:'1'}:{ok:true}});d.setSheets({url:'https://script.google.com/x/exec',token:'abc'});
   const toasts=[];d.bus.on('toast',x=>toasts.push(x));await d.openSheet({id:'S',gid:'1'});await d.sheets.pull();await d.sheets.pull();
   t('таблица по ссылке + 2 автоопроса на ТВОЕЙ таблице: тоста «+N новых» нет',()=>d.t.L.length===947&&!toasts.some(x=>/Таблица: \+/.test(x))); }
 // --- Zoom-окно (исправленный баг «вкл, но не видно»)
 t('Zoom-окно по умолчанию скрыто, переключатель = реальная видимость',()=>{const {d}=mk();return d.zoom.view().enabled&&!d.zoom.view().shown});
 t('кнопка «Спрятать» и переключатель меняют ОДИН флаг: после «Спрятать» в Настройках «выкл»',()=>{const {d}=mk();d.zoom.setShown(true);const a=d.zoom.view().shown;d.zoom.setShown(false);return a&&!d.zoom.view().shown&&d.P.zoomWindow===false});
 t('первый звонок больше НЕ меняет флаг видимости сам',()=>{const {d}=mk();d.zoom.onMessage(ZO,{type:'zp-call-ringing-event',data:{callId:'a',direction:'outbound'}});return d.P.zoomWindow===undefined&&!d.zoom.view().shown});
 t('Zoom не подтвердил звонок за 6 с → окно показывается временно (peek), подтвердил → прячется',()=>{const {d,E}=mk();d.loadText(CSV,'l.csv');d.dial();E.adv(6000);const a=d.zoom.view().shown&&d.zoom.view().peek;d.zoom.onMessage(ZO,{type:'zp-call-ringing-event',data:{direction:'outbound'}});return a&&!d.zoom.view().shown});
 t('подсказка статуса по журналу Zoom (voicemail → 1, wrong number → Q)',()=>suggestFromLog({result:'Voicemail',callee:{number:'+15015550000'}},'+15015550000')===0&&suggestFromLog({result:'Wrong Number',callee:{number:'5015550000'}},'+15015550000')===10);
 t('чужое сообщение (не с applications.zoom.us) игнорируется',()=>{const {d}=mk();d.zoom.onMessage('https://evil.example',{type:'zp-call-ringing-event'});return d.zoom.log.length===0});
 // --- авто-отбой
 t('статус во время звонка: авто-отбой (по умолчанию вкл); выключен → нет',()=>{const a=mk();a.d.P.zoomHangup={type:'zp-x'};a.d.zoom.ready=true;a.d.loadText(CSV,'l.csv');a.d.call={id:'c1',ended:null};const r1=a.d.setStatus(0).hangup;const b=mk();b.d.setPref('hangupOnStatus',false);b.d.loadText(CSV,'l.csv');b.d.call={id:'c2',ended:null};return r1==='sent'&&b.d.setStatus(0).hangup==='off'});
 t('Отложить (S) во время звонка кладёт трубку, следующий набор ждёт подтверждения',()=>{const {d}=mk();d.P.zoomHangup={type:'zp-x'};d.zoom.ready=true;d.loadText(CSV,'l.csv');d.call={id:'c1',ended:null};d.skip();return d.hang.sent.has('c1')});
 t('отбой: Zoom не знает команды → «unsupported», звонок НЕ считается сброшенным, повтор после теста возможен',()=>{const {d}=mk();d.zoom.ready=true;d.loadText(CSV,'l.csv');d.call={id:'c1',ended:null};d.calling=true;const r=d.hangup('button');return r==='unsupported'&&d.calling===true&&!d.hang.sent.has('c1')});
 // --- темп
 t('ТЕМП, регрессия: 84 зв/час после 30 минут простоя больше не висит',()=>{const s=Date.UTC(2026,10,3,12),times=Array.from({length:40},(_,i)=>s+i*43e3);const live=tempo(times,s+40*43e3),later=tempo(times,s+40*43e3+30*60e3);return live.show&&live.rate>60&&!later.show&&later.rate===0});
 t('ТЕМП падает плавно: через 8 мин без звонков заметно ниже',()=>{const s=Date.UTC(2026,10,3,12),times=Array.from({length:40},(_,i)=>s+i*43e3),e=s+40*43e3;return tempo(times,e+8*60e3).rate<tempo(times,e).rate*0.6});
 t('ТЕМП меньше 5 звонков не показывается (как раньше)',()=>!tempo([1,2,3],10).show);
 // --- файл
 { const {d}=mk();let written='';const h={name:'l.csv',requestPermission:async()=>'granted',getFile:async()=>({text:async()=>CSV}),createWritable:async()=>({write:async s=>{written=s},close:async()=>{}})};
   await d.openFile(h);d.setStatus(0);await tick();await tick();
   t('файл: статус записывается обратно в тот же CSV, формат и число строк сохранены',()=>written.split('\n').length===CSV.split('\n').length&&written.includes('Автоответчик/Нет ответа')&&written.slice(0,40)===CSV.slice(0,40)); }
 t('Apps Script отдаётся дословно, со словом пользователя',()=>{const {d}=mk();const s=d.rndSecret();return s.length===20&&d.getAppsScript().includes(s)});
 return T}
