import {copyFileSync,existsSync,mkdirSync,readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from './lib/model.ts';
import {buildDossier} from './vendor/makefun-board.ts';
const root=fileURLToPath(new URL('.',import.meta.url));
function arg(n:string,d:string){const i=process.argv.indexOf('--'+n);return i>=0?process.argv[i+1]||d:d}
const inp=arg('input','/input'), input=inp.endsWith('.json')?inp:join(inp,'snapshot.json'),out=arg('output',process.env.MAKEFUN_OUTPUT_DIR||'/output');
if(!existsSync(input)){console.error(`Missing snapshot: ${input}`);process.exit(2)}
const snap=JSON.parse(readFileSync(input,'utf8'));
const {rows,live,comps,multiples}=build(snap),watch=new Set(snap.watchlist),slugs=new Set(rows.map((r:any)=>r.slug));
const issue=rows.length<100||rows.length>4000?'row count':snap.watchlist.some((s:string)=>!slugs.has(s))?'watchlist coverage':rows.some((r:any,i:number)=>r.rank!==i+1||r.farm_steps.length<3||r.farm_steps.some((s:string)=>s.trim().length<20||s.trim().length>600)||(i>0&&r.implied_value_usd>rows[i-1].implied_value_usd))?'rank, value order or farm plan':new Set(rows.map((r:any)=>r.implied_value_usd)).size<2?'all values equal':null;
if(issue){console.error(`Board self-check failed: ${issue}`);process.exit(1)}
mkdirSync(out,{recursive:true});
writeFileSync(join(out,'board.json'),JSON.stringify({rows})+'\n');
const data={as_of:snap.as_of,source:snap.source,floor_usd:snap.floor_usd,protocol_count:snap.protocols.length,watchlist_size:snap.watchlist.length,board_size:rows.length,model_version:'radar-2',formula:'TVL × category comp × growth × maturity × chain breadth',multiples,rows,live,comps};
writeFileSync(join(out,'data.js'),'window.RADAR='+JSON.stringify(data)+';\n');
function copyDir(from:string,to:string){mkdirSync(to,{recursive:true});for(const n of readdirSync(from)){if(n.startsWith('.'))continue;const a=join(from,n),b=join(to,n);if(statSync(a).isFile())copyFileSync(a,b)}}
copyDir(join(root,'dashboard'),join(out,'dashboard'));copyDir(join(root,'screenshots'),join(out,'screenshots'));
writeFileSync(join(out,'dossier.json'),buildDossier(out,{text_max_bytes:65536,screenshots:{max:4,max_bytes:524288},dashboard:{max_files:400,max_bytes:4194304}}));
console.log(`Radar ${snap.as_of}: ${snap.protocols.length} protocols, ${snap.watchlist.length} watchlist, ${rows.length} ranked, ${live.length} live comps.`);
