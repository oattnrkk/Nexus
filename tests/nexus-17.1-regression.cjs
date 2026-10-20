const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(process.argv[2]||(fs.existsSync('index.html')?'index.html':'nexus-17.1/index.html'),'utf8');
const passed=[];
function test(name,condition){assert(condition,name);passed.push(name);console.log('PASS',name)}
function fn(name){const match=new RegExp(`^(?:async )?function ${name}\\([^]*?^}`, 'm').exec(html);assert(match,`Missing ${name}`);return match[0]}
function element(){return {hidden:false,checked:false,disabled:false,style:{},textContent:'',innerHTML:'',value:'',setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},addEventListener(){},scrollIntoView(){}}}
const ids={};const el=id=>ids[id]||(ids[id]=element());
const sandbox={n172IsTmdbAnime:()=>false,n172TmdbAnimeKind:()=> 'tv',TMDB_BASE:"https://api.themoviedb.org/3",TMDB_KEY:"test",console,Date,Map,Set,Number,Math,Promise,Array,JSON,String,Error,window:{nexusUILanguage:'en',addEventListener(){}},document:{getElementById:el,addEventListener(){}},votedDislikes:new Map(),votedLikes:new Map(),selected:new Map(),watchlist:new Map(),nexusGetListStatus:()=> 'planned',n173KnownCheckbox:el('n173IncludeKnown'),mode:'movie'};
vm.createContext(sandbox);
const run=s=>vm.runInContext(s,sandbox);
let syntax=0;
for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))if(match[1].trim()){new vm.Script(match[1]);syntax++}
test('All five application scripts parse',syntax===5);
const idsInHTML=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
test('Every HTML id is unique',idsInHTML.length===new Set(idsInHTML).size);
test('Advanced analytics follow discovery',html.indexOf('id="analyticsSection"')>html.indexOf('id="searchSection"'));
test('Existing preference database identity is preserved',html.includes('const DB_NAME = "ReelMatchDB"')&&html.includes('const DB_VERSION = 1'));
test('Movie and music categories remain reachable',html.includes('data-mode="movie"')&&html.includes('data-mode="music"'));

const start=html.indexOf('// NEXUS 17.1: TMDB-backed');
const end=html.indexOf('async function n108NetflixThailand',start);
run(html.slice(start,end));
test('Netflix supports exactly screen categories',run("['movie','anime','series','kdrama'].every(n171SupportsNetflix)&&!n171SupportsNetflix('manga')&&!n171SupportsNetflix('music')"));
const calls=[];
sandbox.queuedFetch=async url=>{calls.push(url);if(url.includes('/12/'))return {results:{TH:{flatrate:[{provider_id:8}]}}};if(url.includes('/13/'))return {results:{TH:{flatrate:[{provider_id:9}]}}};return {results:{}}};
(async()=>{
  test('Netflix movie positive requires Thai subscription offer',await run("n111NetflixThailandStatus({uid:'movie:12',provider:'movie',id:12})")==='confirmed');
  test('Movie checks use movie endpoint',calls[0].includes('/movie/12/watch/providers'));
  test('Series without Netflix offer is not_listed',await run("n111NetflixThailandStatus({uid:'series:13',provider:'series',id:13})")==='not_listed');
  test('Series checks use TV endpoint',calls[1].includes('/tv/13/watch/providers'));
  test('Missing Thai data remains unknown',await run("n111NetflixThailandStatus({uid:'kdrama:14',provider:'kdrama',id:14})")==='unknown');
  test('Unsupported content cannot pass Netflix filter',await run("n111NetflixThailandStatus({uid:'music:12',provider:'music',id:12})")==='unknown');
  test('Invalid TMDB IDs remain unknown',await run("n111NetflixThailandStatus({uid:'movie:bad',provider:'movie',id:'bad'})")==='unknown');
  const before=calls.length;await run("n111NetflixThailandStatus({uid:'movie:12',provider:'movie',id:12})");
  test('Availability cache avoids duplicate provider calls',before===calls.length);
  sandbox.queuedFetch=async()=>{throw new Error('unavailable')};
  test('Provider failure remains unknown',await run("n111NetflixThailandStatus({uid:'movie:15',provider:'movie',id:15})")==='unknown');
  sandbox.queuedFetch=async()=>({results:[{id:7,name:'Other Anime',original_language:'ja',genre_ids:[16],first_air_date:'2024-01-01'}]});
  test('Unmatched anime is never verified',await run("n111NetflixThailandStatus({uid:'anime:unmatched',provider:'anime',id:90,title:'Mystery Story',animeFormat:'TV',year:2024})")==='unknown');
  test('Missing anime format remains unknown',await run("n111NetflixThailandStatus({uid:'anime:format',provider:'anime',id:91,title:'Story',year:2024})")==='unknown');

  run('const n116SurpriseNetflixBox=document.getElementById("n116SurpriseNetflixOnly"); const n116SurpriseNetflixWrap=document.getElementById("n116SurpriseNetflixWrap"); const n116SurpriseNetflixStatus=document.getElementById("n116SurpriseNetflixStatus");');
  run(fn('n116SyncSurpriseNetflix'));
  for(const category of ['movie','series','anime','kdrama','manga','music']){
    sandbox.mode=category;run('n116SyncSurpriseNetflix()');
    test(`Netflix visibility agrees with ${category}`,el('n116SurpriseNetflixWrap').hidden===!['movie','series','anime','kdrama'].includes(category));
  }
  test('Mode transition calls Netflix sync after restoring preferences',/nexusRestoreDiscovery\(nexusDiscoveryByMode.get\(mode\)\);[\s\S]*?n116SyncSurpriseNetflix\(\);/.test(fn('executeModeChange')));
  test('Old pre-animation click observer removed',!html.includes("queueMicrotask(n116SyncSurpriseNetflix)"));
  test('Category transition refreshes selection button',fn('executeModeChange').includes('renderSelectedStrip();'));

  // Exercise the complete shared shuffle handler with known candidate states.
  Object.assign(sandbox,{
    surpriseBtn:el('surpriseBtn'),searchBox:el('searchBox'),poolGrid:el('poolGrid'),poolCount:el('poolCount'),loadMoreBtn:el('loadMoreBtn'),
    surpriseRequestVersion:0,SURPRISE_PICK_COUNT:9,SURPRISE_RECENT_LIMIT:45,surpriseRecentByMode:new Map(),
    restoreSurpriseButton(){el('surpriseBtn').disabled=false;el('n171Tonight').disabled=false},
    renderPoolSkeletons(){},getSurprisePoolByMode:async()=>sandbox.testPool,resolveOngoingFlags:async p=>p,applyModernFilter:p=>p,
    buildSurpriseTasteProfile:()=>({}),scoreSurpriseCandidate:item=>({rejected:item.reject,matchedGenres:['Mystery']}),
    n13TasteExplorationSample:(c,count,profile,existing=[])=>c.filter(x=>!existing.some(e=>e.item.uid===x.item.uid)).slice(0,count-existing.length),
    n116SurpriseNetflixEnabled:()=>sandbox.netflixEnabled,
    n116FilterSurpriseNetflix:async scored=>scored.filter(x=>x.item.verified),
    renderSearchResults:items=>sandbox.rendered=items,indexItems(){},
    mode:'movie',netflixEnabled:false,testPool:Array.from({length:16},(_,i)=>({uid:'movie:'+i,provider:'movie',title:'Film '+i,verified:i<2,reject:i===15})),
  });
  run(html.slice(html.indexOf('function n173SameTitle'),html.indexOf('function n172IsTmdbAnime')));
  run(fn('n171RunSurprise'));
  await run('n171RunSurprise(3)');
  test('Quick picks return three titles',sandbox.rendered.length===3);
  test('Every quick pick carries an explanation',sandbox.rendered.every(x=>x._surpriseReason.includes('Mystery')));
  test('Quick button unlocks after completion',!el('n171Tonight').disabled);
  const first=sandbox.rendered.map(x=>x.uid);await run('n171RunSurprise(3)');
  test('Repeat quick picks prefer fresh titles',sandbox.rendered.every(x=>!first.includes(x.uid)));
  await run('n171RunSurprise(9)');
  test('Original shuffle still returns nine',sandbox.rendered.length===9);
  test('Rejected titles do not enter shuffle results',sandbox.rendered.every(x=>!x.reject));
  sandbox.netflixEnabled=true;await run('n171RunSurprise(3)');
  test('Netflix shortfall never uses unknown filler',sandbox.rendered.length===2&&sandbox.rendered.every(x=>x.verified));
  test('Netflix quick count uses target three',el('n116SurpriseNetflixStatus').textContent.includes('2/3'));
  let release;sandbox.getSurprisePoolByMode=()=>new Promise(resolve=>release=resolve);
  const pending=run('n171RunSurprise(3)');
  sandbox.mode='series';sandbox.surpriseRequestVersion++;sandbox.restoreSurpriseButton();sandbox.rendered=[];release(sandbox.testPool);await pending;
  test('Category cancellation cannot render stale picks',sandbox.rendered.length===0);
  test('Category cancellation does not relock entry buttons',!el('n171Tonight').disabled);

  console.log('TOTAL',passed.length);
  if(fs.existsSync('nexus-17.1'))fs.writeFileSync('nexus-17.1/regression-results.json',JSON.stringify({passed:passed.length,checks:passed,scope:'Node VM behavioral tests with deterministic API fixtures; not a real-browser or live-catalog test.'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
