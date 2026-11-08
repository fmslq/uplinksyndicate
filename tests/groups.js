// ГРУППЫ ТЕСТОВ (кусок 26): один список для node (tests/run.mjs) и для Debug в браузере (кнопка «Все тесты»).
// Модули грузятся по очереди через import(): группа, которой нужен node (чтение фикстур с диска), в браузере
// не падает целиком — она помечается «только в node», остальные проходят.
const meta=async()=>{const m=await import('../core/meta.js');return m};
export const GROUPS=[
 ['Кусок 33: лиды, очередь, таймеры','./s33.tests.js','runS33Tests'],
 ['Кусок 32: баланс и миграция','./s32.tests.js','runS32Tests'],['Старые проверки ядра','./legacy.tests.js','*'],['Кусок 31','./s31.tests.js','runS31Tests'],['Подсказки Гудка','../ui/work/hints.js','runHintTests'],
 ['Музыкальная библиотека','../ui/work/muslib.js','runMusLibTests'],['Дайлер: таблица и очередь','./dialer2.tests.js','runDialer2Tests'],
 ['Арт: подключение файлов','./arthooks.tests.js',['runArtHookTests','runArtAliasTests','runArtOldNameTests','runGhRepoTests']],
 ['Zoom: самотест a–o','./zoom.tests.js','runZoomTests'],['База и магазин','../core/meta.js','runMetaTests'],['Ачивки','../core/achv.js','runAchvTests'],
 ['Задания и директивы','../core/missions.js','runMissionTests'],['Статистика и ранги','./stats.tests.js','run'],['Дайлер: CSV и Zoom-история','./dialer.tests.js','runDialerTests'],
 ['Интерфейс','./ui.tests.js','runUiTests'],['Карта мира','../core/mapstate.js','runMapTests'],['Материк','../art/land.js','runLandTests'],
 ['Описания предметов','../story/items.js','runItemLoreTests',async()=>{const m=await meta();return[m.SHOP_ITEMS,m.COSMETICS]}],['Захват района','../core/claim.js','runClaimTests'],
 ['Арт базы','../art/base.js','runBaseArtTests',async()=>{const m=await meta();return[m.SHOP_ITEMS,m.COSMETICS]}],['Сцены истории','../story/scenes.js','runStoryTests'],
 ['Гудок: обучение','../story/guide.js','runGuideTests'],['Сюжетные события','../story/beats.js','runBeatTests'],
 ['Бонусы предметов','../core/buffs.js','runBuffTests',async()=>{const m=await meta();return[m.SHOP_ITEMS.map(x=>x.id),id=>m.SHOP_ITEMS.find(x=>x.id===id).district]}],
 ['Окно истории','../ui/story/story.js','runStoryUiTests'],['Боссы: данные','../story/bosses.js','runBossDataTests'],['Боссы: арт','../art/bosses.js','runBossArtTests'],
 ['Арена босса','../ui/boss/arena.js','runArenaTests'],['Удержание и союзники','./addict.tests.js','runAddictTests'],['Системы мира','../story/systems.js','runSysTests'],
 ['Полки зала','../story/shelves.js','runShelfTests'],['Системы куска 19','./sys19.tests.js','runSys19Tests'],['Системы куска 20','./s20.tests.js','runS20Tests'],
 ['Подполье','../ui/under/under.js','runUnderTests'],['Разгон: реплика по времени лида','../ui/work/warmup.js','runWarmLineTests'],['Позывной в репликах','../story/callsign.js','runCallsignTests',async()=>{const S=await import('../story/scenes.js'),B=await import('../story/beats.js'),T=[];S.DISTRICTS.forEach(x=>{const d=x.d;[...(x.intro||[]),...(x.capture||[])].forEach(p=>T.push({d,t:p.text}));T.push({d,t:x.boss.line},{d,t:x.boss.guide},{d,t:x.finish||''},{d,t:x.defeat||''})});B.BEATS.forEach((b,i)=>{const d=i+1;['council','lom','ph2','ph3'].forEach(k=>b[k]&&T.push({d,t:b[k]}));b.call&&T.push({d,t:b.call.text});b.rumor&&T.push({d,t:b.rumor.text})});Object.entries(B.ALLY_SAY).forEach(([d,L])=>L.forEach(t=>T.push({d:+d,t})));return[T]}],['Предупреждение о норме','../ui/work/normwarn.js','runNormWarnTests'],['Журнал и статистика звонков','../core/calllog.js','runCallLogTests'],['Перезвоны','../ui/work/followup.js','runFollowUpTests'],['Кусок 28: время, находки','./s28.tests.js','runS28Tests'],['Кусок 30: норма и ручные встречи','./s30.tests.js','runS30Tests']];
// → [{n, all, fail:[имена], skip:'причина'|null}]
export async function runGroups(onStep){const out=[];
 for(const [n,path,fn,args] of GROUPS){let r=[],skip=null;
  try{const m=await import(path),a=args?await args():[],fs=fn==='*'?Object.entries(m).filter(([k,f])=>typeof f==='function'&&k.startsWith('run')).map(x=>x[1]):[].concat(fn).map(k=>m[k]);
   for(const f of fs){if(typeof f!=='function')throw new Error('нет функции');r.push(...(await f(...a)))}}
  catch(e){if(/node:|fs|readFileSync|process|Failed to fetch|Cannot find/i.test(e.message)&&typeof process==='undefined')skip='только в node';else r=[['запуск: '+e.message,false]]}
  const g={n,all:r.length,fail:r.filter(x=>!x[1]).map(x=>x[0]),skip};out.push(g);if(onStep)onStep(g)}
 return out}
