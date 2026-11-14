export type Protocol = { slug:string; name:string; category:string|null; chains:string[]; tvl_usd:number; change_7d:number|null; mcap_usd:number|null; listed_at:string|null; gecko_id:string|null; symbol:string|null };
export type Snapshot = { as_of:string; source:string; floor_usd:number; protocols:Protocol[]; watchlist:string[] };
const VERSION=/\s(?:V\d+(?:\.\d+)?|v\d+(?:\.\d+)?|\d+\.\d+)$/;
const median=(a:number[])=>{a=a.slice().sort((x,y)=>x-y);const n=a.length;return n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2};
const cmp=(a:string,b:string)=>a<b?-1:a>b?1:0;
export const preToken=(p:Protocol)=>p.mcap_usd===null&&p.gecko_id===null&&p.symbol===null;
export const rankable=(p:Protocol)=>preToken(p)&&p.category!=='CEX'&&!VERSION.test(p.name);
const age=(asOf:string,listed:string|null)=>listed===null?null:Math.max(0,Math.floor((Date.parse(asOf+'T00:00:00Z')-Date.parse(listed+'T00:00:00Z'))/86400000));
function farm(p:Protocol,a:number|null){
 const c=p.tvl_usd>=5e9?250:p.tvl_usd>=1e9?150:p.tvl_usd>=1e8?100:50, chain=p.chains[0]||'its main chain', cat=(p.category||'').toLowerCase(), hold=a===null?60:a<180?60:a<365?45:30;
 let action=`Deposit $${c} of USDC into ${p.name} on ${chain} and keep the position open.`;
 if(/dex|yield|leveraged farm/.test(cat)) action=`Provide $${c} of liquidity to ${p.name}'s main pool on ${chain}; keep the LP position open.`;
 else if(/lend|cdp|collateral/.test(cat)) action=`Supply $${c} of USDC to ${p.name} on ${chain}; leave the lending position open.`;
 else if(/rwa/.test(cat)) action=`Buy or deposit $${c} of ${p.name}'s yield asset on ${chain} and retain the receipt.`;
 else if(/basis/.test(cat)) action=`Open a small $${c} basis position through ${p.name} on ${chain}; keep collateral conservative.`;
 else if(/restak|staking/.test(cat)) action=`Stake $${c} of the chain's native asset through ${p.name} on ${chain} and keep the receipt token.`;
 else if(/payment|stable/.test(cat)) action=`Mint or transfer $${c} of the supported stable asset through ${p.name} on ${chain}.`;
 else if(/derivative|perpetual/.test(cat)) action=`Deposit $${c} of USDC as margin on ${p.name} on ${chain}; make one low leverage hedge.`;
 return [
 `Create a fresh wallet for ${p.name} activity; fund it only with planned capital and record the address. Cost: under $3 gas. Time: 5 minutes.`,
 `${action} Cost: $${c} capital plus about $${c>=150?8:4} network gas. Time: 15 minutes.`,
 `Repeat one qualifying protocol action each week, such as a deposit, swap, borrow or vote; keep transaction receipts. Cost: about $2 gas weekly. Time: 10 minutes per week.`,
 `Maintain the position for ${hold} days; this longer window reflects the protocol's age and captures repeated activity. Cost: $${c} remains deployed. Time: ${hold} days.`,
 `Before withdrawing, check ${p.name}'s own points or rewards page and confirm eligibility; never pay to claim. Cost: $0 to check. Time: 10 minutes.`,
 `Log the wallet, dates, positions, fees and transaction IDs, then unwind only after checking withdrawal terms. Cost: $0. Time: 5 minutes.`
 ];
}
export function build(snapshot:Snapshot){
 const live=snapshot.protocols.filter(p=>!preToken(p)&&p.category!=='CEX'&&p.mcap_usd!==null&&p.tvl_usd!==null);
 const all=median(live.map(p=>p.mcap_usd!/p.tvl_usd));
 const byCat=new Map<string,number[]>();for(const p of live){const k=p.category||'Other',a=byCat.get(k)||[];a.push(p.mcap_usd!/p.tvl_usd);byCat.set(k,a)}
 const multiple=(cat:string|null)=>Math.min(2,Math.max(.02,(byCat.get(cat||'Other')?.length||0)>=5?median(byCat.get(cat||'Other')!):all));
 const ageRows=new Map<string,number|null>();
 const pool=snapshot.protocols.filter(rankable).sort((a,b)=>cmp(a.slug,b.slug));
 const scored=pool.map(p=>{const a=age(snapshot.as_of,p.listed_at);ageRows.set(p.slug,a);const comp=multiple(p.category),growth=Math.min(120,Math.max(-60,p.change_7d??0)),gm=1+growth/100*.5,days=a??365,mm=.6+Math.min(days,1095)/1095*.4,cm=1+.03*Math.min(Math.max(p.chains.length-1,0),5),base=p.tvl_usd*comp,value=Math.max(1,Math.round(base*gm*mm*cm));return {p,a,comp,growth,gm,mm,cm,base,value}});
 scored.sort((a,b)=>b.value-a.value||cmp(a.p.slug,b.p.slug));
 const chosen=new Map(scored.slice(0,300).map(x=>[x.p.slug,x]));
 for(const slug of snapshot.watchlist){const x=scored.find(y=>y.p.slug===slug);if(x)chosen.set(slug,x)}
 const rows=[...chosen.values()].sort((a,b)=>b.value-a.value||cmp(a.p.slug,b.p.slug)).map((x,i)=>({rank:i+1,...x.p,token_status:'pre-token',age_days:x.a,implied_value_usd:x.value,model:{comp_multiple:x.comp,base_usd:Math.round(x.base),growth_pct:x.growth,growth_multiplier:+x.gm.toFixed(6),maturity_multiplier:+x.mm.toFixed(6),chains_multiplier:+x.cm.toFixed(6)},farm_steps:farm(x.p,x.a)}));
 const market=live.slice().sort((a,b)=>(b.mcap_usd||0)-(a.mcap_usd||0)||cmp(a.slug,b.slug)).slice(0,24);
 const comps=live.map(p=>({slug:p.slug,name:p.name,category:p.category,chains:p.chains,tvl_usd:p.tvl_usd,mcap_usd:p.mcap_usd}));
 return {rows,live:market,comps,multiples:{...Object.fromEntries([...byCat].map(([k,v])=>[k,multiple(k)])),Other:multiple(null)}};
}
