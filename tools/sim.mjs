// Симуляция баланса (GDD §15): вялый 60 / железный 100 / берсерк 250 звонков. Запуск: node tools/sim.mjs [gdd|draft]
import {newState,apply,talkBonus} from '../core/engine.js';
import {CONFIG as C,districtThr,BONUS_K} from '../core/config.js';
const mode=process.argv[2]||'current';
if(mode==='draft'){C.assumedDailyXp=3500;C.assumedDailyMoney=3900;C.od.sec=360;C.od.xp=1.9}
if(mode==='odgdd'){C.assumedDailyXp=3500;C.assumedDailyMoney=3900;C.od.sec=480;C.od.xp=2.2}
if(mode==='gdd'){C.assumedDailyXp=3000;C.assumedDailyMoney=3000;C.od.sec=480;C.od.xp=2.2}
// смесь GDD §15: 45 мусор, 20 GK, 22 TALK, 6 CB, 5 minor, 1 booked, 0.1 disc
const MIX=[[0,45],[5,20],[2,11],[3,11],[12,6],[6,5],[4,1],[14,.1]],TOT=MIX.reduce((a,b)=>a+b[1],0);
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647,pick=()=>{let r=rnd()*TOT;for(const[i,w]of MIX){if((r-=w)<=0)return i}return 0};
export const SC={lazy:{n:60,fast:.78},iron:{n:100,fast:.9},berserk:{n:250,fast:.95}};
export function simulate(D=1500){const out={};
 for(const[k,c]of Object.entries(SC)){let X=0,M=0,OD=0,BX=0;
  for(let d=0;d<D;d++){const s=newState(0);let t=0;
   for(let i=0;i<c.n;i++){const id=pick(),prev=s.lastCls,ok=rnd()<c.fast;t+=ok?(20+rnd()*35):(65+rnd()*200);if(prev==='TALK'||prev==='CALLBACK')t+=ok?rnd()*100:0;
    const e=apply(s,id,t*1000,{});if(e.odStart)OD++;
    if(['TALK','CALLBACK','BOOKED','DISCOVERY'].includes(e.cls)){const r=rnd(),dur=r<.7?15+rnd()*35:r<.9?60+rnd()*120:r<.98?180+rnd()*300:480+rnd()*420;if(dur>=15){const b=talkBonus(s,s.undo[s.undo.length-1],dur);BX+=b.x}}
    s.district=1;s.dxp=0;s.carry=0}
   X+=s.xp;M+=s.money}
  out[k]={xp:Math.round(X/D),money:Math.round(M/D),od:+(OD/D).toFixed(2),bonusPct:+(BX/X*100).toFixed(1)}}
 return out}
if(process.argv[1].endsWith('sim.mjs')){console.warn('ВНИМАНИЕ: это старая оценка одного дня без покупок и полного прохождения; для новой модели запусти node tools/sim-balance.mjs.');const r=simulate();console.log('режим:',mode,'| assumedDailyXp',C.assumedDailyXp,'| OD',C.od.sec+'с x'+C.od.xp);
 for(const[k,v]of Object.entries(r))console.log(k.padEnd(8),'XP/день',String(v.xp).padStart(5),'$/день',String(v.money).padStart(5),'OD/день',v.od,'бонус времени',v.bonusPct+'%');
 const iron=r.iron.xp;console.log('--- баланс v2: рабочих дней на район (железный день). «без» — без бонусов, «с» — с ожидаемыми бонусами BONUS_K. Правило v3: каждый район +10…30% звонков к прошлому, рост разный');
 let prev=0;console.log(C.districts.map((x,i)=>{const raw=districtThr(i+1)/(iron*x[3]),w=raw/(BONUS_K[i]||1),g=prev?w/prev-1:0;prev=w;return (i+1)+': без '+raw.toFixed(2)+' / с '+w.toFixed(2)+(i?` (+${Math.round(g*100)}%${g<.095||g>.305?'!':''})`:'')}).join('\n'));
 console.log('итого дней с бонусами:',C.districts.reduce((a,x,i)=>a+districtThr(i+1)/(iron*x[3])/(BONUS_K[i]||1),0).toFixed(1))}
