import {newState,apply,undo,pause,resume,talkBonus,bossState,gain} from '../core/engine.js';
import {CONFIG as C,districtThr} from '../core/config.js';
const R=[],t=(n,f)=>{try{R.push([n,!!f()])}catch(e){R.push([n+' ('+e.message+')',false])}},S=1000;
const run=(ids,gaps)=>{const s=newState(0);let n=0;ids.forEach((id,i)=>{n+=(gaps[i]??30)*S;apply(s,id,n)});return[s,n]};
export function runTests(){R.length=0;
 t('heat x1.25 на 4-м',()=>run([0,0,0,0],[]).at(0).step===1);
 t('heat x1.5 на 10-м',()=>run(Array(10).fill(0),[]).at(0).step===2);
 t('heat x2.0 на 20-м',()=>run(Array(20).fill(0),[]).at(0).step===3);
 t('срыв окна (J4): серия и множитель сгорают полностью',()=>{const[s]=run(Array(21).fill(0),Array(21).fill(30).map((v,i)=>i==20?100:v));return s.step===0&&s.streak===1});
 t('CRM-надбавка: после TALK 120с ок',()=>{const[s]=run([2,0,0,0,0],[30,120,30,30,30]);return s.streak===5});
 t('>40 мин: сброс',()=>{const[s]=run([0,0,0,0,0],[30,30,30,30,2500]);return s.streak===1&&s.step===0});
 t('антиспам: 50% и серия не растёт',()=>{const s=newState(0);apply(s,4+0,1000);const a=s.xp,e=apply(s,0,2000);return e.spam&&s.streak===1});
 t('Ульта: 5 статусов на x2.0 после BOOKED',()=>{const s=newState(0);apply(s,4,30*S);const e=apply(s,0,1000*S);return e.mult.m===2&&s.ulta===4});
 t('Ульта сгорает >40 мин',()=>{const s=newState(0);apply(s,4,30*S);apply(s,0,3000*S);return s.ulta===0});
 t('Overdrive на '+C.od.streak+'-й серии (не раньше) и только с владельцем на линии (Q10а)',()=>{const T=[2,...Array(C.od.streak-1).fill(0)];const[p]=run(T.slice(0,-1),[]);if(p.od)return false;const[q]=run(Array(C.od.streak).fill(0),[]);if(q.od)return false;const[s]=run(T,[]);return !!s.od&&s.od.until-s.last===C.od.sec*1000});
 t('OD: TALK $x3, мусор x2',()=>{const[s,n]=run([2,...Array(C.od.streak-1).fill(0)],[]);const a=apply(s,2,n+30*S),b=apply(s,0,n+60*S);return a.mult.m===3&&b.mult.m===2});
 t('Undo (full) возвращает всё',()=>{const s=newState(0);apply(s,0,30*S);const snap=JSON.stringify([s.xp,s.money,s.streak]);apply(s,4,60*S);undo(s,70*S);return JSON.stringify([s.xp,s.money,s.streak])===snap});
 t('Undo старого: серия -1 (его вклад), остальное по-прежнему',()=>{const s=newState(0);apply(s,0,30*S);apply(s,0,60*S);apply(s,0,90*S);const st=s.streak;undo(s,500*S,0);return s.streak===st-1})
 t('заморозка (пауза движка) сдвигает окно, серия цела; P-пауза движок не трогает',()=>{const s=newState(0);apply(s,0,30*S);apply(s,0,60*S);const l=s.last;pause(s,70*S);resume(s,250*S);return s.streak===2&&s.last===l+180*S});
 t('заморозка не продлевается сверх 3 минут при закрытой вкладке',()=>{const s=newState(0);apply(s,0,30*S);pause(s,40*S);resume(s,340*S);const e=apply(s,0,360*S);return e.pen==='drop'});
 t('бонус времени: 120с = 2 интервала',()=>{const s=newState(0),e=apply(s,3,30*S),u=s.undo[0],b=talkBonus(s,u,120);return b.x===7&&b.m===5});
 t('Undo старого: вычитаются $, XP аккаунта и XP района ровно на его вклад',()=>{const s=newState(0);apply(s,4,30*S);apply(s,0,60*S);apply(s,0,90*S);const u=s.undo[0],d=s.dxp,x=s.xp,m=s.money;undo(s,500*S,0);return s.dxp===d-u.x&&s.xp===x-u.x&&s.money===m-u.m&&s.ulta===0});
 t('Undo старого после захвата: район остаётся, XP снимается с текущего района',()=>{const s=newState(0);apply(s,4,30*S);s.dxp=districtThr(1)-5;apply(s,4,60*S);const u=s.undo[0],d=s.dxp;undo(s,500*S,0);return s.district===2&&s.dxp===d-u.x&&!s.debt});
 t('Undo старого: не хватает XP в районе = долг, гасится следующими начислениями',()=>{const s=newState(0);apply(s,4,30*S);s.dxp=districtThr(1)-5;apply(s,0,60*S);s.dxp=100;const u=s.undo[0];undo(s,500*S,0);const ok=s.dxp===0&&s.debt===u.x-100;apply(s,4,900*S);const e=s.undo.at(-1);return ok&&s.debt===Math.max(0,u.x-100-e.x)&&s.dxp===Math.max(0,e.x-(u.x-100))});
 t('бонус за разговор захватывает район через единое начисление',()=>{const s=newState(0);apply(s,3,30*S);s.dxp=districtThr(1)-1;const b=talkBonus(s,s.undo[0],600);return b.captured&&s.district===2&&s.dxp>=0&&s.dxp<districtThr(2)});
 t('поздний бонус считается по району звонка, а не текущему',()=>{const s=newState(0);apply(s,3,30*S);const u=s.undo[0];const a=newState(0);apply(a,3,30*S);a.district=5;const bA=talkBonus(a,a.undo[0],600),bS=talkBonus(s,u,600);return bA.x===bS.x});
 t('gain: на районе ≥finish мусор не добивает босса (иммунитет)',()=>{const s=newState(0);s.district=C.finishFromDistrict;s.dxp=districtThr(s.district)-2;const ev={};gain(s,50,1,false,ev);return ev.immune&&s.district===C.finishFromDistrict&&s.carry>0});
 t('бонус времени не для мусора',()=>{const s=newState(0);apply(s,0,30*S);return talkBonus(s,s.undo[0],600).x===0});
 t('OD не перезапускается сразу',()=>{const s=newState(0);let n=0;for(let i=0;i<25;i++)apply(s,0,(n+=30)*S);apply(s,0,(n+=500)*S);let st=0;for(let i=0;i<10;i++){if(apply(s,0,(n+=30)*S).odStart)st++}return st===0});
 t('район 1 захватывается и открывает 2',()=>{const s=newState(0);s.dxp=districtThr(1)-5;apply(s,0,30*S);return s.district===2&&s.dxp===3});
 t('босс: мусор IMMUNE, добивает TALK',()=>{const s=newState(0);s.district=3;s.dxp=districtThr(3)-1;const e=apply(s,0,30*S);const f=bossState(s)==='finish';apply(s,2,60*S);return e.immune&&f&&s.district===4});
 t('босс-фаза с 90%',()=>{const s=newState(0);s.district=3;s.dxp=districtThr(3)*.92;return bossState(s)==='boss'});
 return R}
if(typeof process!=='undefined'&&process.argv[1]&&process.argv[1].endsWith('tests.js')){const r=runTests();r.forEach(([n,ok])=>console.log(ok?'PASS':'FAIL',n));console.log(r.filter(x=>!x[1]).length+' FAIL')}
import {resolveKey} from '../dialer/hotkeys.js';
export function runKeyTests(){const o=[],t=(n,f)=>o.push([n,!!f()]),k=(c,x)=>resolveKey({menu:false,...c},x);
 t('Space/Enter звонят',()=>k({},'Space').a==='dial'&&k({},'Enter').a==='dial');
 t('Shift+Enter подтверждает подсказку (Enter остаётся «Позвонить»)',()=>{const r=k({suggest:7,shift:true},'Enter');return r.a==='status'&&r.id===7&&k({suggest:7},'Enter').a==='dial'});
 t('T без меню = шпаргалка, в меню = DISCOVERY',()=>k({},'KeyT').a==='pad'&&k({menu:true},'KeyT').id===14);
 t('1..6 и 7 8 9 0 Q W E R = статусы',()=>['Digit1','Digit6','Digit7','Digit0','KeyQ','KeyR'].every((x,i)=>k({},x).a==='status')&&k({},'Digit5').id===4&&k({},'KeyR').id===13);
 t('S Z X P / M N',()=>['S','Z','X','P','M','N'].every(x=>k({},'Key'+x).a)&&k({},'Slash').a==='picker');
 t('при вводе текста горячие клавиши молчат',()=>k({typing:true},'Digit1')===null&&k({typing:true},'Escape').a==='blur');
 return o}
if(typeof process!=='undefined'&&process.argv[1]&&process.argv[1].endsWith('tests.js')){const r=runKeyTests();r.forEach(([n,ok])=>console.log(ok?'PASS':'FAIL',n));console.log(r.filter(x=>!x[1]).length+' FAIL (keys)')}
import {runMetaTests} from '../core/meta.js';
if(typeof process!=='undefined'&&process.argv[1]&&process.argv[1].endsWith('tests.js')){const r=runMetaTests();r.forEach(([n,ok])=>console.log(ok?'PASS':'FAIL',n));console.log(r.filter(x=>!x[1]).length+' FAIL (meta)')}
import {bagPick,pickPool,stateOf} from '../audio/music.js';
export function runMusicTests(){const o=[],t=(n,f)=>{try{o.push([n,!!f()])}catch(e){o.push([n+' ('+e.message+')',false])}};
 t('shuffle-bag: все по разу, без повтора подряд на границе',()=>{const all=['a','b','c'],bag=[],seen=[];let last=null;for(let i=0;i<9;i++){last=bagPick(bag,all,last);seen.push(last)}return seen.slice(0,3).sort().join()==='a,b,c'&&seen.every((x,i)=>i===0||x!==seen[i-1])});
 t('пул: свой → calm той же темы → любой по состоянию → любой',()=>{const p={'neon/calm':[1],'industrial/action':[2]};return pickPool(p,'neon','action')==='neon/calm'&&pickPool(p,'blackgold','action')==='industrial/action'&&pickPool({},'neon','calm')===null});
 t('состояния музыки',()=>stateOf({paused:1})==='standby'&&stateOf({od:1})==='overdrive'&&stateOf({step:2})==='action'&&stateOf({step:0})==='calm');
 return o}
if(typeof process!=='undefined'&&process.argv[1]&&process.argv[1].endsWith('tests.js')){const r=runMusicTests();r.forEach(([n,ok])=>console.log(ok?'PASS':'FAIL',n));console.log(r.filter(x=>!x[1]).length+' FAIL (music)')}
