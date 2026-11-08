import {SaveManager as SM} from '../core/save.js';
import {oldDistrictThr} from '../core/balance.js';
import {CONFIG,districtThr} from '../core/config.js';
import {newState,undo} from '../core/engine.js';
import {itemTotals,withItems} from '../core/buffs.js';
import * as A from '../core/addict.js';
import {KEYS} from '../core/keys.js';
const T=[],t=(n,f)=>{try{T.push([n,!!f()])}catch(e){T.push([n+' ('+e.message+')',false])}};
export function runS32Tests(){T.length=0;
 t('новая игра не мигрируется повторно',()=>{const r=SM.defaults();SM.migrate(r);return r.balanceVersion===1&&r.game===null});
 t('старый прогресс и накопленные урон/перенос сохраняют свою долю, а деньги и XP не меняются',()=>{const d=7,old=oldDistrictThr(d),n=districtThr(d),g=newState(5);Object.assign(g,{district:d,dxp:Math.round(old*.63),keyHold:333,laterHold:444,carry:222,money:5678,xp:1234,lifeXp:2345});const before=JSON.stringify({...g,undo:undefined});g.undo.push({t:5,id:0,before,x:12,m:6,cls:'TRASH'});const r={schemaVersion:2,game:g};SM.migrate(r);const u=JSON.parse(g.undo[0].before),q=n/old;return Math.abs(g.dxp/n-.63)<.0001&&g.keyHold===Math.round(333*q)&&g.laterHold===Math.round(444*q)&&g.carry===Math.round(222*q)&&g.money===5678&&g.xp===1234&&g.lifeXp===2345&&u.dxp===g.dxp});
 t('миграция выполняется только один раз при повторном открытии и импорте',()=>{const g=newState(5);g.district=5;g.dxp=100;const r={schemaVersion:2,game:g};SM.migrate(r);const v=JSON.stringify(r.game);SM.migrate(r);const copy=SM.parseImport(JSON.stringify(r));return JSON.stringify(r.game)===v&&JSON.stringify(copy.game)===v});
 t('Finish Him не теряется при миграции, полный undo использует пересчитанный снимок',()=>{const old=oldDistrictThr(3),g=newState(100);g.district=3;g.dxp=old-1;const prior={...g,dxp:Math.round(old*.4)};delete prior.undo;g.undo=[{before:JSON.stringify(prior),t:100,id:0,x:10,m:5,cls:'TRASH'}];const r={schemaVersion:2,game:g};SM.migrate(r);if(g.dxp!==districtThr(3)-1)return false;const result=undo(g,105);return result==='full'&&Math.abs(g.dxp/districtThr(3)-.4)<.001});
 t('покупка предмета повышает общий XP сверх старого ограничения',()=>{const a={d1t0:1,d1t1:1,d2t1:1,d7t0:1,d6t2:1,d9t2:1,d10t0:1,d11t1:1,d12t0:1,d4t1:1};const x=itemTotals(a,2,18).xAll;a.d12t2=1;const y=itemTotals(a,2,18).xAll;const r=A.withAd(withItems({},a,2,18),{},0,'');return x>30&&y===x+9&&r.xAll>1});
 t('новый предмет XP и новый предмет денег действуют даже при большой команде',()=>{const root={};A.ensure(root).ops.n=200;const owned={};const m=()=>A.withAd(withItems({},owned,40,12),root,0,'');const before=m();owned.d12t2=1;const xp=m();owned.d12t1=1;const cash=m();return before.xAll>1.8&&xp.xAll>before.xAll&&cash.mAll>xp.mAll});
 t('любой новый связист и обучение увеличивают оба множителя выше старого потолка',()=>{const root={};A.ensure(root);root.ad.ops.n=200;const before=A.withAd({xAll:1.4,mAll:1.4},root,0,'');root.ad.ops.n++;const hired=A.withAd({xAll:1.4,mAll:1.4},root,0,'');root.ad.ops.lv={0:1};const trained=A.withAd({xAll:1.4,mAll:1.4},root,0,'');return before.xAll>1.8&&hired.xAll>before.xAll&&hired.mAll>before.mAll&&trained.xAll>hired.xAll&&trained.mAll>hired.mAll});
 t('норма и финальный проход 100 в день не изменились',()=>A.AD.norm===100&&KEYS.find(k=>k.id==='k6').req.day===100&&CONFIG.districts.length===12);
 return T}
