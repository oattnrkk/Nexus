const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const file=process.argv[2]||(fs.existsSync('index.html')?'index.html':'nexus-17.1/index.html');
const html=fs.readFileSync(file,'utf8'),passed=[];
function check(name,value){assert(value,name);passed.push(name);console.log('PASS',name)}
function fn(name){
 const match=new RegExp(`(?:async )?function ${name}\\(`).exec(html);assert(match,name);
 for(let end=html.indexOf('}',match.index);end!==-1;end=html.indexOf('}',end+1)){
   const text=html.slice(match.index,end+1);try{new vm.Script(text);return text}catch{}
 }
 throw Error('Unable to extract '+name);
}
const nodes={};function el(id){return nodes[id]||(nodes[id]={hidden:false,textContent:'',addEventListener(){}})}
const c={console,Map,Set,Date,Math,Number,String,Object,Array,Promise,JSON,Error,
 TMDB_BASE:'https://api.themoviedb.org/3',TMDB_KEY:'test',TMDB_IMG:'https://image.tmdb.org/t/p/w200',ANILIST_BASE:'https://graphql.anilist.co',ANILIST_HEAVY_FIELDS:' HEAVY ',
 window:{nexusUILanguage:'en'},document:{getElementById:el},mode:'anime',withCache:async(key,f)=>f(),tmdbRecPositionWeight:()=>5};
vm.createContext(c);const run=text=>vm.runInContext(text,c);
const start=html.indexOf('let n172AniListUnavailableUntil');const end=html.indexOf('function normalizeAniListMedia',start);
run(html.slice(start,end));
for(const name of ['normalizeMovieItem','normalizeTVItem','getRecommendationsFor','getDetailExtras','nexusRetryDelay'])run(fn(name));
const raw={id:22,name:'Detective Anime',original_name:'探偵',first_air_date:'2024-01-01',title:'Anime Film',original_title:'映画',release_date:'2024-01-01',original_language:'ja',genre_ids:[16,9648],vote_average:8};
c.raw=raw;
(async()=>{
 check('Japanese animation is eligible',run('n172IsJapaneseAnimation(raw)'));
 check('Live-action Japanese title is excluded',!run('n172IsJapaneseAnimation({...raw,genre_ids:[9648]})'));
 check('Non-Japanese animation is excluded',!run("n172IsJapaneseAnimation({...raw,original_language:'en'})"));
 check('Malformed source ID is excluded',!run("n172IsJapaneseAnimation({...raw,id:'bad'})"));
 const tv=run("n172NormalizeTmdbAnime(raw,'tv',{16:'Animation',9648:'Mystery'})");
 const movie=run("n172NormalizeTmdbAnime(raw,'movie',{16:'Animation'})");
 check('Fallback preserves Anime category',tv.provider==='anime');
 check('Fallback has distinct source-qualified identity',tv.uid==='anime:tmdb:tv:22'&&movie.uid==='anime:tmdb:movie:22');
 check('Movie and TV IDs cannot collide',tv.uid!==movie.uid);
 check('Fallback retains original aliases',tv.aliases.includes('探偵'));
 c.item=JSON.parse(JSON.stringify(tv));check('Source marker survives JSON backup round-trip',run('n172IsTmdbAnime(item)'));
 check('AniList record never mistaken for TMDB fallback',!run("n172IsTmdbAnime({provider:'anime',id:22,uid:'anime:22'})"));
 check('Fallback carries no invented schedule',tv.airing===undefined&&tv.nextAiringEpisode===undefined);
 let primary=0,fallback=0;
 const result=await c.n172AnimeSource(async()=>{primary++;return [1]},async()=>{fallback++;return [2]});
 check('Healthy primary catalog wins',result[0]===1&&primary===1&&fallback===0);
 const secondary=await c.n172AnimeSource(async()=>{throw Error('blocked')},async()=>{fallback++;return [2]});
 check('Unavailable primary uses independent catalog',secondary[0]===2&&fallback===1);
 let calls=[];
 c.queuedFetch=async url=>{calls.push(url);if(url.includes('/genre/'))return {genres:[{id:16,name:'Animation'},{id:9648,name:'Mystery'}]};return {results:[raw,{...raw,id:23,original_language:'en'},{...raw,id:24,genre_ids:[18]}]};};
 const catalog=await c.n172TmdbAnimeCatalog('',2);
 check('Backup catalog filters unrelated results',catalog.length===2&&catalog.every(x=>x.id===22));
 check('Catalog requests animation and Japanese language filters',calls.filter(x=>x.includes('/discover/')).every(x=>x.includes('with_genres=16')&&x.includes('with_original_language=ja')));
 calls=[];await c.n172TmdbAnimeCatalog('a & b');
 check('Search query is safely encoded',calls.some(x=>x.includes('query=a%20%26%20b')));
 c.queuedFetch=async url=>{if(url.includes('/genre/'))return {genres:[]};if(url.includes('/tv?'))return {results:[raw]};throw Error('movie source down');};
 check('One failed backup source does not blank the other',(await c.n172TmdbAnimeCatalog()).length===1);
 c.queuedFetch=async()=>{throw Error('both down')};let failed=false;
 try{await c.n172TmdbAnimeCatalog()}catch{failed=true}check('Total backup failure is visible to caller',failed);
 calls=[];c.queuedFetch=async url=>{calls.push(url);return url.includes('/genre/')?{genres:[]}:{results:[raw]}};
 const recs=await c.getRecommendationsFor(tv);
 check('Fallback recommendations stay in Anime category',recs.length===1&&recs[0].item.provider==='anime');
 check('Fallback recommendation ID goes only to TMDB',calls.some(x=>x.includes('/tv/22/recommendations'))&&!calls.some(x=>x.includes('anilist')));
 c.extractTmdbDetailExtras=data=>({tmdb:{episodes:data.number_of_episodes}});
 calls=[];c.queuedFetch=async url=>{calls.push(url);return {number_of_episodes:12}};
 const details=await c.getDetailExtras(tv);
 check('Fallback details retain real episode totals',details.tmdb.episodes===12);
 check('Fallback detail ID never goes to AniList',calls.length===1&&calls[0].includes('/tv/22?'));
 c.n172SyncCatalogNotice([tv]);check('Backup source is visibly disclosed',!el('n172CatalogNotice').hidden&&el('n172CatalogNotice').textContent.includes('TMDB backup'));
 c.n172SyncCatalogNotice([{provider:'anime',id:1}]);check('Primary results do not carry fallback label',el('n172CatalogNotice').hidden);
 c.mode='movie';c.n172SyncCatalogNotice([tv]);check('Source notice clears outside Anime',el('n172CatalogNotice').hidden);
 // The real schedule refresh must skip every fallback ID.
 c.watchlist=new Map([[tv.uid,tv]]);c.nexusAiringDashboard={loading:false};let renders=0;c.nexusRenderAiringDashboard=()=>renders++;
 run(fn('nexusRefreshAiringDashboard'));await c.nexusRefreshAiringDashboard();
 check('Airing refresh skips TMDB IDs instead of inventing AniList identity',renders===1&&!c.nexusAiringDashboard.loading);

 let attempts=0;c.queuedFetch=async(url,options)=>{attempts++;check('AniList request disables automatic retries',options.nexusMaxRetries===0);throw Object.assign(Error('API_ERROR_403'),{status:403})};
 try{await c.anilistQuery('query HEAVY fields',{})}catch{}
 check('Blocked query is not retried as a lighter query',attempts===1);
 try{await c.anilistQuery('another query',{})}catch{}
 check('Unavailable source cooldown prevents repeated blocked requests',attempts===1);
 run('n172AniListUnavailableUntil=0');
 c.queuedFetch=async()=>{attempts++;throw Object.assign(Error('RATE_LIMITED'),{retryAfterMs:120000})};
 try{await c.anilistQuery('query',{})}catch{}
 check('Rate-limit cooldown respects a longer Retry-After',run('n172AniListUnavailableUntil-Date.now()')>119000);
 check('Generic retry delay does not truncate Retry-After to fifteen seconds',c.nexusRetryDelay(0,'120')===120000);
 run('n172AniListUnavailableUntil=0');let queries=[];
 c.queuedFetch=async(url,options)=>{queries.push(JSON.parse(options.body).query);return queries.length===1?{errors:[{message:'Query complexity exceeded'}]}:{data:{Page:{media:[]}}};};
 await c.anilistQuery('query HEAVY fields',{});
 check('Explicit GraphQL complexity error gets one lighter retry',queries.length===2&&!queries[1].includes(' HEAVY '));
 run('n172AniListUnavailableUntil=0');queries=[];
 c.queuedFetch=async()=>{queries.push(1);return {data:null,errors:[{message:'Invalid field'}]}};
 let gql=false;try{await c.anilistQuery('invalid',{})}catch{gql=true}
 check('GraphQL errors never become a successful empty catalog',gql&&queries.length===1);
 // Hold real recommendation work at an await, then switch categories or supersede it.
 let releaseSeed;const progress=[];
 Object.assign(c,{mode:'anime',selected:new Map([[tv.uid,tv]]),votedLikes:new Map(),votedDislikes:new Map(),watchlist:new Map(),
   findBtn:{disabled:false,setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]}},
   filterRow:{style:{}},renderSkeletons(){},setProgress:text=>progress.push(text),n171UpdateGuide(){},
   ensureTags:()=>new Promise(resolve=>releaseSeed=resolve),ensureCollaborators:async()=>{},});
 run('let n172RecommendationVersion=0;');run(fn('computeRecommendations'));
 const stale=c.computeRecommendations();c.mode='movie';releaseSeed();await stale;
 check('Recommendation mode change stops stale progress writes',progress.length===1);
 c.mode='anime';const old=c.computeRecommendations(),releaseOld=releaseSeed;
 const latest=c.computeRecommendations(),releaseNew=releaseSeed;releaseOld();await old;
 check('Older recommendation request cannot unlock the newest request',c.findBtn.disabled&&c.findBtn['aria-busy']==='true');
 c.mode='movie';releaseNew();await latest;
 console.log('TOTAL',passed.length);
})().catch(e=>{console.error(e);process.exitCode=1});
