// ДЕПЛОЙ НА GITHUB PAGES (кусок 23). Собирает сайт, ставит в index.html import map с хешем каждого модуля
// (браузер не смешает старые и новые файлы после обновления: у изменённого файла новый адрес ?v=хеш),
// сравнивает с тем, что уже лежит в репозитории (/data/work/gh-pushed.json — git blob sha), и пишет пачки
// для GitHub MCP push_files (/data/work/gh-push-N.json). Лимит одного вызова MCP — 64 КБ, поэтому: .js и .css сжимаются (esbuild, без
// переименования переменных — ошибки на сайте читаемые), пачка ≤ 58 КБ, а модуль больше 50 КБ режется на куски .pN.txt + загрузчик
// (загрузчик склеивает куски, переводит относительные import в абсолютные — import map продолжает работать — и реэкспортирует имена).
// Бинарные файлы push_files не умеет — их список печатается отдельно.
// Запуск: node tools/deploy.mjs "сообщение коммита"   ·   после успешного пуша: node tools/deploy.mjs --mark
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'),DIRS=['art','assets','audio','core','dialer','story','tests','ui'],MAN='/data/work/gh-pushed.json';
const TEXT=/\.(js|css|html|json|txt|md|svg|command)$/i;
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const p=path.join(d,e.name);return e.isDirectory()?walk(p):[p]});
const blob=b=>crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
const files=DIRS.flatMap(d=>walk(path.join(ROOT,d))).map(p=>path.relative(ROOT,p).split(path.sep).join('/')).filter(f=>!f.startsWith('tests/')||f.endsWith('.js')).sort();   // tests/: только .js (Debug → «Все тесты»), фикстуры CSV не выкладываются
const short=b=>crypto.createHash('sha1').update(b).digest('hex').slice(0,10);
// index.html: import map для всех .js и ?v= для всех .css
let html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8').replace(/<script type="importmap">[\s\S]*?<\/script>\n?/,'');
const {createRequire}=await import('node:module');const esb=createRequire('/data/node_modules/')('esbuild');
const PART=50000,PACK=58000,src={};
for(const f of files){let b=fs.readFileSync(path.join(ROOT,f));
 if(/\.(js|css)$/.test(f)&&!f.startsWith('dialer/')){const c=b.toString('utf8');b=Buffer.from(esb.transformSync(c,{loader:f.endsWith('.css')?'css':'js',minifyWhitespace:true,minifySyntax:true,charset:'utf8',...(f.endsWith('.js')?{format:'esm'}:{})}).code)}
 src[f]=b}
// большие модули → куски + загрузчик
const extra={};
for(const f of files){if(!f.endsWith('.js')||Buffer.byteLength(JSON.stringify(src[f].toString('utf8')))<=PART)continue;
 const code=src[f].toString('utf8'),ex=esb.buildSync({stdin:{contents:code,loader:'js',sourcefile:f},write:false,metafile:true,format:'esm',outfile:'x.js',bundle:false}).metafile.outputs['x.js'].exports;
 const parts=[];let cur='';for(const ch of code){cur+=ch;if(cur.length>=PART/2.2&&Buffer.byteLength(JSON.stringify(cur))>=PART-200){parts.push(cur);cur=''}}if(cur)parts.push(cur);
 const base=path.posix.basename(f,'.js'),urls=parts.map((c,i)=>{const n=`${path.posix.dirname(f)}/${base}.p${i+1}.txt`;extra[n]=Buffer.from(c);return `./${base}.p${i+1}.txt?v=${short(Buffer.from(c))}`});
 const names=ex.filter(n=>n!=='default');
 src[f]=Buffer.from(`// загрузчик: модуль разрезан на куски из-за лимита деплоя (tools/deploy.mjs)\nconst B=import.meta.url.split('?')[0],t=(await Promise.all(${JSON.stringify(urls)}.map(u=>fetch(new URL(u,B)).then(r=>{if(!r.ok)throw new Error('${f}: '+u+' '+r.status);return r.text()})))).join('').replace(/(from\\s*|import\\s*\\(\\s*|import\\s*)(["'])(\\.{1,2}\\/[^"']+)\\2/g,(m,a,q,s)=>a+q+new URL(s,B).href+q);\nconst m=await import(URL.createObjectURL(new Blob([t],{type:'text/javascript'})));\nexport const {${names.join(',')}}=m;${ex.includes('default')?'export default m.default;':''}\n`)}
Object.assign(src,extra);const all=Object.keys(src).sort();
const map={};for(const f of all)if(f.endsWith('.js'))map['./'+f]='./'+f+'?v='+short(src[f]);
html=html.replace(/href="([^"?]+\.css)(\?v=[^"]*)?"/g,(m,h)=>src[h]?`href="${h}?v=${short(src[h])}"`:m);
html=html.replace('</head>','<script type="importmap">'+JSON.stringify({imports:map})+'</script>\n</head>');
const out={};for(const f of all)out[f]=src[f];out['index.html']=Buffer.from(html);
// копия сайта для локальной проверки: /data/work/site-out
fs.rmSync('/data/work/site-out',{recursive:true,force:true});for(const f in out){const d=path.join('/data/work/site-out',f);fs.mkdirSync(path.dirname(d),{recursive:true});fs.writeFileSync(d,out[f])}
const man=fs.existsSync(MAN)?JSON.parse(fs.readFileSync(MAN,'utf8')):{};
if(process.argv[2]==='--mark'){for(const f in out)man[f]=blob(out[f]);fs.writeFileSync(MAN,JSON.stringify(man));console.log('отмечено',Object.keys(out).length);process.exit(0)}
const ch=Object.keys(out).filter(f=>man[f]!==blob(out[f])),txt=ch.filter(f=>TEXT.test(f)),bin=ch.filter(f=>!TEXT.test(f));
for(const f of fs.readdirSync('/data/work'))if(/^gh-push-\d+\.json$/.test(f))fs.unlinkSync('/data/work/'+f);
const msg=process.argv[2]||'Обновление игры';let packs=[],cur=[],sz=0;
const ord=txt.filter(f=>f!=='index.html').concat(txt.includes('index.html')?['index.html']:[]);   // index.html — последним: новая import map только когда все модули уже лежат
for(const f of ord){const c=out[f].toString('utf8'),n=Buffer.byteLength(JSON.stringify({path:f,content:c}))+2;if(n>PACK)throw new Error('слишком большой файл для деплоя: '+f+' '+n);if(sz+n>PACK-600&&cur.length){packs.push(cur);cur=[];sz=0}cur.push({path:f,content:c});sz+=n}if(cur.length)packs.push(cur);
packs.forEach((p,i)=>fs.writeFileSync(`/data/work/gh-push-${i+1}.json`,JSON.stringify({owner:'fmslq',repo:'power-dialer',branch:'main',message:packs.length>1?`${msg} (${i+1}/${packs.length})`:msg,files:p})));
console.log(JSON.stringify({changed:ch.length,text:txt.length,packs:packs.length,binary:bin}));
