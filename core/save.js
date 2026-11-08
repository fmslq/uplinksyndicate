import {CONFIG} from './config.js';
import {migrateBalance} from './balance.js';
// Один корневой ключ ct1, schemaVersion, миграции, резерв предыдущего состояния, debounce.
// v2 (rework): + story, map, base, tutorial, ui и расширенные settings. Ничего из v1 не теряется.
export const SETTINGS_V2=()=>({sfx:.7,music:.3,fx:'full',crt:true,trail:false,shake:1,tick:true,
 soundStatus:true,soundUi:true,synthAmbient:false,hum:true,nowPlaying:true,storyMode:'full',autoGain:true});
const baseStageOf=d=>d>=11?3:d>=8?2:d>=4?1:0;
export const SaveManager={key:'ct1',store:()=>globalThis.localStorage,t:0,
 migrations:{
  1(r){const d=SaveManager.defaults(),dist=(r.game&&r.game.district)||1;
   for(const k of ['story','map','base','tutorial','ui'])if(!r[k])r[k]=d[k];
   r.settings=Object.assign({},d.settings,r.settings||{});
   r.map.open=Array.from({length:dist},(_,i)=>i+1);r.map.pos=dist;r.base.stage=r.base.seenStage=baseStageOf(dist);
   r.v1=true;return r}},
 defaults:()=>({schemaVersion:CONFIG.schemaVersion,balanceVersion:1,game:null,settings:SETTINGS_V2(),fingerprint:null,callLog:[],scriptTabs:[],
  story:{mode:'full',seen:{},prologue:false,queue:[]},map:{open:[1],pos:1,fog:{},capturedAt:{}},base:{stage:0,seenStage:0},
  tutorial:{done:false,steps:{},hints:{},range:false},ui:{panelTab:'shift',compact:'auto',cols:[30,45,25],protocol:true}}),
 migrate(r){if((r.schemaVersion|0)>CONFIG.schemaVersion)throw new Error('Сохранение из более новой версии игры (схема '+r.schemaVersion+'). Обнови игру.');
  while((r.schemaVersion|0)<CONFIG.schemaVersion){const f=this.migrations[r.schemaVersion|0];if(f)r=f(r);r.schemaVersion=(r.schemaVersion|0)+1}
  const d=this.defaults();r.settings=Object.assign({},d.settings,r.settings||{});migrateBalance(r);return r},
 load(){const s=this.store();for(const k of [this.key,this.key+'_bak']){try{const raw=s.getItem(k);if(!raw)continue;const r=JSON.parse(raw);if(r&&typeof r==='object')return Object.assign(this.defaults(),this.migrate(r))}catch(e){}}return this.defaults()},
 save(root){try{const s=this.store(),old=s.getItem(this.key);if(old)s.setItem(this.key+'_bak',old);s.setItem(this.key,JSON.stringify(root));return true}catch(e){return false}},
 soon(root,ms=500){clearTimeout(this.t);this.t=setTimeout(()=>this.save(root),ms)},
 install(get){const f=()=>this.save(get());addEventListener('visibilitychange',()=>document.hidden&&f());addEventListener('beforeunload',f)},
 exportJson:root=>JSON.stringify(root,null,1)};
// Второй слой хранения: зеркало в IndexedDB (7 дневных копий), экспорт/импорт файлом, запрос «постоянного» хранилища.
SaveManager.idb=()=>new Promise((ok,no)=>{const q=indexedDB.open('ct_backup',1);q.onupgradeneeded=()=>q.result.createObjectStore('b',{keyPath:'k'});q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});
SaveManager.mirror=async function(root){try{const db=await this.idb(),st=db.transaction('b','readwrite').objectStore('b'),j=JSON.stringify(root),t=Date.now();st.put({k:'latest',t,j});st.put({k:'d-'+new Date(t).toISOString().slice(0,10),t,j});
 const ks=await new Promise(r=>{const q=st.getAllKeys();q.onsuccess=()=>r(q.result)});ks.filter(k=>k.startsWith('d-')).sort().slice(0,-7).forEach(k=>st.delete(k));this.lastMirror=t;return true}catch(e){return false}};
SaveManager.latest=async function(){try{const db=await this.idb();return await new Promise(r=>{const q=db.transaction('b').objectStore('b').get('latest');q.onsuccess=()=>r(q.result||null);q.onerror=()=>r(null)})}catch(e){return null}};
SaveManager.exportFile=function(root){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([this.exportJson(root)],{type:'application/json'}));a.download='uplink-syndicate-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};
SaveManager.parseImport=function(text){const r=JSON.parse(text);if(!r||typeof r!=='object'||r.schemaVersion==null)throw new Error('это не сохранение Corporate Takeover');return this.migrate(r)};
SaveManager.persist=async()=>{try{return navigator.storage&&navigator.storage.persist?await navigator.storage.persist():false}catch(e){return false}};
