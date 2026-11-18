// Звуки статусов СТАРОГО дайлера: перенесены дословно (tone/noise/SND/FXT/SDESC/sndLoad), чтобы ничего не потерялось.
// Свои звуки из папки (имя файла = имя звука, варианты ching_2.mp3 …), handle в IndexedDB «pd» ключ «snd», громкость P.vol, мьют P.mute (pd2).
let VOL=.5,MUTE=false,PITCH=1,PT=0,AC=null,NB=null,AB={},SD=null;export let sndNeed=0;
export const setVol=v=>{VOL=v},setMute=m=>{MUTE=!!m},getState=()=>({vol:VOL,mute:MUTE,files:Object.values(AB).reduce((a,b)=>a+b.length,0),need:sndNeed,dir:!!SD});
export const setCtx=c=>{AC=c};
// A3/D4: тон статусных звуков растёт с серией (1.0 → 1.25), через 1,6 с возвращается к 1
export const setPitch=k=>{PITCH=Math.max(.8,Math.min(1.3,k||1));clearTimeout(PT);PT=setTimeout(()=>{PITCH=1},1600)};
const ac=()=>{try{if(!AC)AC=new(window.AudioContext||window.webkitAudioContext)();if(AC.state=="suspended")AC.resume()}catch(e){AC=null}return AC};
let toast=()=>{};export const onToast=f=>{toast=f};
function tone(f,t,d,ty,g,f2){const a=ac();if(!a)return;const T=a.currentTime+t,o=a.createOscillator(),v=a.createGain();o.type=ty||"sine";f*=PITCH;if(f2)f2*=PITCH;o.frequency.setValueAtTime(f,T);if(f2)o.frequency.exponentialRampToValueAtTime(f2,T+d);
 v.gain.setValueAtTime(.0001,T);v.gain.exponentialRampToValueAtTime(Math.max(.0002,g*VOL),T+.006);v.gain.exponentialRampToValueAtTime(.0001,T+d);o.connect(v);v.connect(a.destination);o.start(T);o.stop(T+d+.03)}
function noise(t,d,g,fc,q){const a=ac();if(!a)return;if(!NB){NB=a.createBuffer(1,a.sampleRate*2,a.sampleRate);const b=NB.getChannelData(0);for(let i=0;i<b.length;i++)b[i]=Math.random()*2-1}
 const T=a.currentTime+t,s=a.createBufferSource(),f=a.createBiquadFilter(),v=a.createGain();s.buffer=NB;f.type="bandpass";f.frequency.value=fc;f.Q.value=q||1;
 v.gain.setValueAtTime(Math.max(.0002,g*VOL),T);v.gain.exponentialRampToValueAtTime(.0001,T+d);s.connect(f);f.connect(v);v.connect(a.destination);s.start(T,Math.random());s.stop(T+d+.03)}
const SND={
 rewardsoft(){tone(660,0,.12,"sine",.055);tone(880,.075,.16,"sine",.035)},
 // кусок 26в: предупреждение о норме — чем дольше не звонишь, тем неприятнее (0 — мягкий сигнал, 3 — резкая сирена)
 warn0(){tone(440,0,.22,"triangle",.22);tone(349,.22,.3,"triangle",.2)},
 warn1(){tone(311,0,.3,"square",.12);tone(440,0,.3,"square",.1);tone(294,.32,.38,"square",.12);tone(415,.32,.38,"square",.1)},
 warn2(){for(let i=0;i<3;i++){tone(220,i*.26,.22,"sawtooth",.16,207);tone(311,i*.26,.22,"sawtooth",.12,293)}noise(0,.8,.06,400,.6)},
 warn3(){for(let i=0;i<4;i++){tone(880,i*.3,.15,"sawtooth",.16,620);tone(587,i*.3+.15,.15,"sawtooth",.16,415)}tone(55,0,1.2,"square",.2,48);noise(0,1.2,.1,300,.5)},
 dialgo(){tone(90,0,.18,"sine",.5,45);noise(0,.06,.35,1800,1.2);tone(520,.02,.16,"triangle",.18,1040);tone(1560,.09,.12,"sine",.08,2100);tone(780,.14,.22,"sine",.07,1170)}, // I9: нажатие «Позвонить» — удар, взлёт, искра
 dialhover(){noise(0,.014,.05,3400,2.5);tone(210,.006,.035,"square",.018,140);noise(.03,.01,.035,5200,3)},   // кусок 22: тихий механический щелчок взвода
 tick(){noise(0,.04,.25,3000,1);tone(180,0,.05,"square",.12,90)},
 whoosh(){noise(0,.22,.16,900,.4)},
 whip(){noise(0,.16,.4,3500,.7);tone(1400,0,.14,"sawtooth",.18,300)},
 stamp(){tone(80,0,.2,"sine",.9,40);noise(0,.06,.5,700,.7)},
 ching(){noise(0,.05,.3,6000,.8);tone(1568,.02,.7,"sine",.35);tone(2349,.02,.8,"sine",.25);tone(3136,.05,.6,"triangle",.12);[.18,.26,.33,.4].forEach((t,i)=>{tone(2600+i*180,t,.12,"triangle",.14);noise(t,.03,.12,7000,2)})},
 chime(){tone(988,0,.35,"sine",.3);tone(1319,.09,.4,"sine",.25);tone(1760,.18,.6,"sine",.2)},
 disc(){tone(659,0,.25,"triangle",.28);tone(880,.1,.25,"triangle",.28);tone(1175,.2,.5,"triangle",.28);noise(.2,.08,.1,6000,2)},
 burn(){for(let i=0;i<14;i++)noise(i*.05+Math.random()*.03,.03,.25,2000+Math.random()*3000,2);noise(0,.7,.1,500,.4)},
 crumple(){for(let i=0;i<16;i++)noise(i*.028+Math.random()*.012,.025+.03*Math.random(),.34,1200+Math.random()*3400,2.4);noise(0,.42,.12,900,.5);noise(.3,.12,.3,600,.8);tone(95,.3,.16,"sine",.55,45)},  // смачнее: плотный хруст + шорох + глухой «шмяк» в конце
 reload(){noise(0,.06,.4,1800,3);tone(220,0,.07,"square",.25,120);noise(.08,.14,.1,900,.6);noise(.26,.06,.4,2600,3);tone(330,.26,.07,"square",.25,160)},
 jackpot(){[523,659,784,1047,1319,1568].forEach((f,i)=>tone(f,i*.07,.25,"triangle",.25));SND.ching()},
 ringbeep(){[0,.2,.5,.7].forEach(t=>tone(1000,t,.12,"sine",.28));tone(1000,1,.28,"sine",.35)},
 del(){tone(700,0,.09,"square",.14,260);noise(0,.05,.15,2500,1)},
 hangup(){noise(0,.03,.55,2500,2);tone(320,0,.07,"square",.3,110);tone(180,.04,.08,"square",.2,90)},
 sent(){noise(0,.22,.15,1500,.5);tone(1500,.14,.3,"sine",.2);tone(2000,.22,.45,"sine",.18)},
 slash(){noise(0,.12,.5,5000,.6);tone(2200,0,.1,"sawtooth",.2,400);tone(3400,.08,.5,"sine",.12)},
 beepsend(){tone(1000,0,.2,"sine",.3);noise(.25,.22,.12,1800,.5)},
 dtmf(){const L=[697,770,852,941],H=[1209,1336,1477];for(let i=0;i<3;i++){const l=L[Math.random()*4|0],h=H[Math.random()*3|0];tone(l,i*.11,.09,"sine",.2);tone(h,i*.11,.09,"sine",.2)}},
 static(){noise(0,.5,.3,1500,.2);noise(.05,.4,.2,5000,.3);tone(120,0,.4,"sawtooth",.08)},
 sit(){tone(913,0,.27,"sine",.28);tone(1371,.28,.27,"sine",.28);tone(1777,.56,.4,"sine",.28)},
 boing(){tone(200,0,.35,"sine",.4,700);tone(700,.35,.22,"sine",.3,150)},
 ringup(){tone(800,0,.1,"sine",.25);tone(1000,.14,.1,"sine",.25);tone(1200,.28,.22,"sine",.25)},
 bin(){tone(130,0,.18,"sine",.7,55);noise(0,.08,.3,500,.8);tone(900,.03,.12,"triangle",.15)},
 levelup(){noise(0,.06,.3,3000,.8);tone(110,0,.22,"sine",.55,50);[523,659,784,1047,1319].forEach((f,i)=>tone(f,.04+i*.07,.3,"triangle",.28));tone(2093,.4,.6,"sine",.18);tone(2637,.48,.7,"sine",.14);for(let i=0;i<6;i++)noise(.35+i*.05,.04,.1,7000,3)},
 fanfare(){noise(0,1.6,.35,7000,.4);tone(90,0,.7,"sine",.9,35);[[262,330,392,523,0],[349,440,523,698,.35],[392,494,587,784,.7]].forEach(([a,b,c,d,t])=>[a,b,c,d].forEach(f=>tone(f,t,t>.5?1.1:.4,"sawtooth",.13)));[1.0,1.15,1.3,1.45,1.6].forEach(t=>{tone(2093,t,.3,"sine",.22);noise(t,.04,.15,7000,2)});setTimeout(()=>SND.ching(),900)}};

// ---- кусок 34: звуки находок по редкости, праздник на сотню (3 уровня), новый ранг. Всё синтезируется кодом; свои файлы кладутся по тем же именам.
const arp=(base,notes,t0,step,d,ty,g)=>notes.forEach((m,i)=>tone(base*Math.pow(2,m/12),t0+i*step,d,ty,g));
const riser=(t0,d,g)=>{for(let i=0;i<14;i++)noise(t0+i*d/14,d/9,g*(.4+i/14),700+i*i*42,1.2)};
const chord=(ms,base,t,d,ty,g)=>ms.forEach(m=>tone(base*Math.pow(2,m/12),t,d,ty,g));
const party=L=>{const bpm=126+8*L,b=60/bpm,beats=Math.round((5.2+1.5*(L-1))/b);
 for(let i=0;i<beats;i++){const t=i*b;tone(100,t,.2,"sine",.7,42);if(i%2===1){noise(t,.12,.32,1800,.8);tone(200,t,.1,"triangle",.2,120)}noise(t+b/2,.04,.12,8000,1);if(L>=2&&i%4===3)noise(t+b*.75,.05,.2,2400,1)}
 const sc=[0,2,4,7,9,12,14,16,19,21,24];
 for(let i=0;i<beats*2;i++)tone(392*Math.pow(2,sc[(i*3+(i>>2))%sc.length]/12),i*b/2,b*.45,L>=3?"sawtooth":"triangle",.09+.02*L);
 for(let i=0;i<beats;i+=2)tone(98*(i%8<4?1:1.335),i*b,b*1.8,"sawtooth",.13);
 [0,.6,1.3,2.1].slice(0,1+L).forEach(t=>{noise(t,.22,.5,1500,.5);tone(180,t,.16,"sine",.6,60);for(let k=0;k<8;k++)noise(t+.04+k*.03,.03,.14,5000+k*400,2)});
 const T=beats*b;chord([0,4,7,12,16],262,T,1.4+.4*L,"sawtooth",.1);tone(55,T,1.2,"sine",.9,30);if(L>=3)riser(T-1.6,1.6,.3);
 for(let i=0;i<10+6*L;i++)noise(T+.1+i*.07,.05,.14,6000+Math.random()*3000,3);setTimeout(()=>SND.ching(),T*1000)};
Object.assign(SND,{
 dropc(){tone(520,0,.09,"triangle",.18);tone(390,.05,.1,"triangle",.14)},
 dropu(){SND.ching()},
 dropr(){SND.chime();setTimeout(()=>SND.ching(),170)},
 drope(){SND.levelup();tone(60,0,1,"sine",.8,30);arp(523,[0,4,7,12,16,19],.35,.07,.5,"triangle",.22);for(let i=0;i<8;i++)noise(.8+i*.06,.04,.14,7000,2)},
 dropl(){noise(0,.5,.5,300,.4);tone(48,0,1.6,"sine",1,28);tone(96,0,.5,"sine",.8,40);riser(0,1.1,.28);
  [[0,4,7,12],[5,9,12,17],[7,11,14,19]].forEach((c,j)=>chord(c,262,.9+j*.42,j===2?1.5:.5,"sawtooth",.12));
  arp(1046,[0,4,7,12,16,19,24,28,31],1.2,.06,.45,"triangle",.22);
  chord([0,7,12,16],131,2.1,1.9,"sawtooth",.15);tone(523,2.1,1.8,"square",.1);tone(1046,2.1,1.8,"triangle",.18);
  for(let i=0;i<26;i++)noise(2.2+i*.08,.05,.15,6000+Math.random()*3000,3);setTimeout(()=>SND.ching(),2100)},
 rankup(){tone(55,0,1.2,"sine",.9,30);noise(0,.3,.4,500,.5);arp(330,[0,4,7,12,16,19,24],.15,.09,.5,"triangle",.26);chord([0,4,7,12],262,.85,1.8,"sawtooth",.12);tone(1046,.9,1.6,"sine",.25);for(let i=0;i<10;i++)noise(1+i*.07,.05,.14,7000,2);setTimeout(()=>SND.ching(),1000)},
 party1(){party(1)},party2(){party(2)},party3(){party(3)}});

export {SND};
export const FXT=[["VOICEMAIL","#d9a07a","ring",[["ringbeep",0]]],["SKIP","#e5603b","down",[["del",0]]],["HUNG UP","#f76808","crumple",[["hangup",0],["crumple",330],["bin",1300]]],["PITCHED","#f5a524","plane",[["sent",300]]],["SECURED","#34d17a","triumph",[["stamp",0],["ching",120]]],["BLOCKED","#e5484d","slash",[["slash",300]]],["NOTED","#e8d44d","fade",[["tick",0]]],["VM LEFT","#e5826e","flyup",[["beepsend",0]]],["MENU","#e6c84c","down",[["dtmf",0]]],["NO CONNECT","#6aa5c4","glitch",[["static",300]]],["TRASH","#b9793a","burn",[["sit",0],["burn",340]]],["???","#9aa0ad","spin",[["boing",300]]],["CALLBACK","#a58be0","swing",[["ringup",0]]],["FOLLOW-UP","#7c5cd6","right",[["chime",0]]],["DISCOVERY","#4aa3ff","triumph",[["disc",0],["chime",200]]]];
export const SDESC={rewardsoft:"Мягкий звук награды за статус",ching:"CALL BOOKED (кассовый аппарат)",stamp:"удар штампа SECURED",disc:"CONDUCTED DISCOVERY CALL",chime:"Follow up in future",whip:"GATEKEEPER (хлыст)",slash:"GATEKEEPER (разрез)",hangup:"Owner hung up: трубка",crumple:"Owner hung up: бумага мнётся",bin:"Owner hung up: мусорка",sent:"Owner pitched & Hang Up",ringbeep:"Автоответчик: Были гудки",del:"Автоответчик: Не перезванивать",beepsend:"Автоответчик (leaved vm)",dtmf:"Menu",static:"Не соединяет",sit:"Номер не рабочий: тон",burn:"Номер не рабочий: огонь",boing:"Непонятная",ringup:"Call back",tick:"Другое / клики",levelup:"конец двадцатки",fanfare:"каждые 100 звонков",whoosh:"(зарезервировано)",reload:"(зарезервировано)",jackpot:"(зарезервировано)"};
Object.assign(SDESC,{dropc:"находка: хлам",dropu:"находка: годное",dropr:"находка: редкое",drope:"находка: эпик",dropl:"находка: ЛЕГЕНДА (самый мощный)",rankup:"новый ранг",party1:"праздник: первая сотня за день",party2:"праздник: вторая сотня",party3:"праздник: третья и дальше"});
export const snd=n=>{if(MUTE)return;try{const b=AB[n];if(b&&b.length){playBuf(b[Math.random()*b.length|0]);return}SND[n]&&SND[n]()}catch(e){}};
// статус (индекс 0–14) → звуки по таймингам, как в старом
export const statusSound=i=>{const f=FXT[i];if(!f)return;for(const [n,t] of f[3])setTimeout(()=>snd(n),t)};
function playBuf(buf){const a=ac();if(!a)return;const s=a.createBufferSource(),g=a.createGain();s.buffer=buf;g.gain.value=VOL;s.connect(g);g.connect(a.destination);s.start()}
export async function sndLoad(ask){if(!SD)return;
 try{let p=await SD.queryPermission({mode:"read"});if(p!="granted"&&ask)p=await SD.requestPermission({mode:"read"});if(p!="granted"){sndNeed=1;return}
  sndNeed=0;const a=ac();if(!a)return;const nb={};let n=0;
  for await(const [nm,h] of SD.entries()){if(h.kind!="file")continue;const m=nm.match(/^(.+?)(?:[ _-]?(\d+))?\.(mp3|wav|m4a|ogg|aac|flac)$/i);if(!m)continue;const key=m[1].toLowerCase();if(!(key in SND))continue;
   try{const buf=await a.decodeAudioData(await(await h.getFile()).arrayBuffer());(nb[key]=nb[key]||[]).push(buf);n++}catch(e){}}
  AB=nb;toast(n?"Звуков из папки: "+n:"В папке нет подходящих файлов. Список имён: ⋯ → Имена звуков")}
 catch(e){toast("Не удалось прочитать папку со звуками")}}
export async function sndPick(kv){try{SD=await showDirectoryPicker({mode:"read"});if(kv)await kv("put","snd",SD);await sndLoad(1)}catch(e){}}
export async function sndInit(kv){try{SD=kv?await kv("get","snd"):null;if(SD){const p=await SD.queryPermission({mode:"read"});if(p=="granted")await sndLoad(0);else sndNeed=1}}catch(e){}}
export const sndNamesText=()=>"Положи в папку файлы с такими именами (mp3, wav, m4a, ogg). Для вариантов добавь номер: ching_2.mp3, ching_3.mp3, будет играть случайный.\n\n"+Object.keys(SND).map(k=>k+" — "+(SDESC[k]||"")).join("\n");
