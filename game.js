// ═══════════════════════════════════════════════════════════
// VOID SURVIVORS — Ultimate Edition
// ═══════════════════════════════════════════════════════════

// ──── CONFIG ────
const CFG = {
  ARENA: 4000, P_SIZE: 14, P_INVULN: 0.5,
  GEM_PULL: 480, MAX_ENEMIES: 300,
  CAM_LERP: 0.07, SHAKE_DECAY: 0.87,
  VICTORY_TIME: 1200,
  CHEST_BASE_CHANCE: 0.018,
};

// ──── ONLINE LEADERBOARD ────
// LIVE HTTPS SITES: uses Firestore (firebase-config.js + rules — see firestore.rules.txt).
// Dreamlo is HTTP-only; browsers block it on https:// — kept as fallback for local http:// testing.
const DREAMLO_PRIVATE = 'LUsVfNWpLkaYChxvO3CDVQtvQeVLKZFECLm8ENVCecFA';
const DREAMLO_PUBLIC  = '69c173f38f40bb2f60d17801';
const DREAMLO_ENABLED = DREAMLO_PRIVATE !== 'YOUR_PRIVATE_KEY_HERE';
const DL_RAW='http://www.dreamlo.com/lb';
const FS_LB_COLLECTION='void_survivors_leaderboard';
const GLOBAL_LB_TOP=20;
const PROXIES=[
  url=>'https://corsproxy.io/?url='+url,
  url=>'https://api.allorigins.win/raw?url='+encodeURIComponent(url),
];
function fsDb(){return typeof window!=='undefined'?window.__NK_FB_DB:null}
function hasFirestoreLB(){return!!(fsDb()&&typeof firebase!=='undefined'&&firebase.firestore)}
function hasOnlineLeaderboard(){return hasFirestoreLB()||DREAMLO_ENABLED}
function fetchWithTimeout(url,ms=8000){
  const ctrl=new AbortController();
  const tid=setTimeout(()=>ctrl.abort(),ms);
  return fetch(url,{signal:ctrl.signal}).finally(()=>clearTimeout(tid));
}
async function dlFetch(path){
  const raw=DL_RAW+path;
  if(window.location.protocol!=='https:'){
    try{const r=await fetchWithTimeout(raw);return r;}catch{return null}
  }
  for(const proxy of PROXIES){
    try{const r=await fetchWithTimeout(proxy(raw));if(r.ok)return r;}catch{}
  }
  try{return await fetchWithTimeout(raw)}catch{return null}
}
function xpFor(lv) { return Math.floor(12 + lv * 7 + lv * lv * 0.6); }

// ──── WEAPON DATA ────
const WEAPONS = {
  bolt: {
    name: 'Energy Bolt', icon: '⚡', color: '#00aaff',
    desc: 'Fires bolts at nearest enemy',
    levels: [
      { count:1, dmg:10, cd:.80, spd:420, pierce:0, sz:5 },
      { count:2, dmg:13, cd:.70, spd:440, pierce:0, sz:5 },
      { count:2, dmg:16, cd:.60, spd:460, pierce:1, sz:6 },
      { count:3, dmg:20, cd:.50, spd:480, pierce:1, sz:6 },
      { count:4, dmg:25, cd:.40, spd:520, pierce:2, sz:7 },
    ],
  },
  orbital: {
    name: 'Orbital Shield', icon: '🔮', color: '#ff00ff',
    desc: 'Rotating orbs deal contact damage',
    levels: [
      { count:2, dmg:8,  rad:65,  spd:2.0, sz:8,  hcd:.30 },
      { count:3, dmg:11, rad:75,  spd:2.3, sz:9,  hcd:.28 },
      { count:4, dmg:14, rad:85,  spd:2.5, sz:10, hcd:.25 },
      { count:4, dmg:18, rad:90,  spd:2.8, sz:13, hcd:.22 },
      { count:5, dmg:22, rad:100, spd:3.0, sz:15, hcd:.20 },
    ],
  },
  nova: {
    name: 'Nova Pulse', icon: '💥', color: '#ffaa00',
    desc: 'Periodic AoE explosion',
    levels: [
      { dmg:18, cd:3.8, rad:110 },
      { dmg:25, cd:3.2, rad:130 },
      { dmg:33, cd:2.7, rad:155 },
      { dmg:42, cd:2.2, rad:180 },
      { dmg:55, cd:1.7, rad:210 },
    ],
  },
  lightning: {
    name: 'Chain Lightning', icon: '🌩️', color: '#aaffff',
    desc: 'Chains between nearby enemies',
    levels: [
      { chains:2, dmg:14, cd:1.4, range:160 },
      { chains:3, dmg:18, cd:1.2, range:180 },
      { chains:4, dmg:22, cd:1.0, range:200 },
      { chains:5, dmg:27, cd:.85, range:220 },
      { chains:7, dmg:34, cd:.65, range:250 },
    ],
  },
  missile: {
    name: 'Homing Missile', icon: '🚀', color: '#ff8800',
    desc: 'Heat-seeking missiles',
    levels: [
      { count:1, dmg:18, cd:1.2, spd:260, sz:6, homing:3.5 },
      { count:1, dmg:23, cd:1.0, spd:280, sz:6, homing:4.0 },
      { count:2, dmg:28, cd:.90, spd:300, sz:7, homing:4.5 },
      { count:2, dmg:35, cd:.80, spd:320, sz:7, homing:5.0 },
      { count:3, dmg:42, cd:.65, spd:350, sz:8, homing:5.5 },
    ],
  },
  flame: {
    name: 'Flame Aura', icon: '🔥', color: '#ff4400',
    desc: 'Burns nearby enemies constantly',
    levels: [
      { dmg:6,  rad:60,  tick:.40 },
      { dmg:9,  rad:72,  tick:.35 },
      { dmg:13, rad:85,  tick:.30 },
      { dmg:18, rad:100, tick:.25 },
      { dmg:24, rad:120, tick:.20 },
    ],
  },
  boomerang: {
    name: 'Boomerang', icon: '🪃', color: '#44ddaa',
    desc: 'Returns after thrown, hits twice',
    levels: [
      { count:1, dmg:14, cd:1.4, spd:320, sz:8,  maxDist:200 },
      { count:1, dmg:18, cd:1.2, spd:340, sz:9,  maxDist:230 },
      { count:2, dmg:23, cd:1.1, spd:360, sz:10, maxDist:260 },
      { count:2, dmg:28, cd:.90, spd:380, sz:11, maxDist:290 },
      { count:3, dmg:35, cd:.75, spd:400, sz:12, maxDist:330 },
    ],
  },
  holywater: {
    name: 'Holy Water', icon: '💧', color: '#4488ff',
    desc: 'Creates damaging zones on ground',
    levels: [
      { dmg:8,  cd:3.2, rad:50,  dur:2.5, count:1 },
      { dmg:12, cd:2.8, rad:60,  dur:3.0, count:1 },
      { dmg:17, cd:2.4, rad:72,  dur:3.0, count:2 },
      { dmg:23, cd:2.0, rad:85,  dur:3.5, count:2 },
      { dmg:30, cd:1.5, rad:100, dur:4.0, count:3 },
    ],
  },
};

// ──── PASSIVE DATA ────
const PASSIVES = {
  maxHp:     { name:'Vitality',     icon:'❤️',  desc:'+25 Max HP',             max:5 },
  speed:     { name:'Swift Boots',  icon:'👟',  desc:'+12% Move Speed',        max:5 },
  magnet:    { name:'Magnet',       icon:'🧲',  desc:'+40% Pickup Range',      max:5 },
  power:     { name:'Power Up',     icon:'⚔️',  desc:'+15% Damage',            max:5 },
  armor:     { name:'Armor',        icon:'🛡️',  desc:'-3 Damage Taken',        max:5 },
  regen:     { name:'Regen',        icon:'💚',  desc:'+1 HP/s',                max:3 },
  luck:      { name:'Lucky',        icon:'🍀',  desc:'+Chest Drop Chance',     max:3 },
  cooldown:  { name:'Haste',        icon:'⏱️',  desc:'-8% Weapon Cooldowns',   max:5 },
};

// ──── EVOLUTION DATA ────
const EVOLUTIONS = {
  bolt:      { passive:'power',  name:'Plasma Cannon',  icon:'🔫', color:'#00ddff',
    stats:{ count:6, dmg:45, cd:.28, spd:620, pierce:99, sz:10 }},
  orbital:   { passive:'armor',  name:'Doom Ring',      icon:'💀', color:'#ff44ff',
    stats:{ count:6, dmg:38, rad:125, spd:3.5, sz:20, hcd:.12 }},
  nova:      { passive:'maxHp',  name:'Supernova',      icon:'🌟', color:'#ffdd00',
    stats:{ dmg:90, cd:1.0, rad:320 }},
  lightning: { passive:'speed',  name:'Thunder Storm',  icon:'⛈️', color:'#88ffff',
    stats:{ chains:12, dmg:55, cd:.35, range:320 }},
  missile:   { passive:'magnet', name:'Seeker Swarm',   icon:'🐝', color:'#ffaa22',
    stats:{ count:5, dmg:50, cd:.35, spd:420, sz:5, homing:7 }},
  flame:     { passive:'regen',  name:'Inferno',        icon:'🌋', color:'#ff6600',
    stats:{ dmg:40, rad:190, tick:.12 }},
};

// ──── ENEMY DATA ────
const ENEMY_DEFS = {
  crawler:  { hp:22,  spd:55,  dmg:8,  sz:12, col:'#ff4444', xp:1,  minT:0   },
  runner:   { hp:14,  spd:125, dmg:6,  sz:10, col:'#ff8844', xp:2,  minT:25  },
  brute:    { hp:110, spd:32,  dmg:18, sz:22, col:'#cc2222', xp:5,  minT:55  },
  spitter:  { hp:30,  spd:48,  dmg:10, sz:13, col:'#ff44ff', xp:3,  minT:80  },
  swarm:    { hp:8,   spd:95,  dmg:4,  sz:7,  col:'#ffff44', xp:1,  minT:100 },
  exploder: { hp:18,  spd:70,  dmg:6,  sz:11, col:'#ff6622', xp:2,  minT:60,  explodes:true },
  shielder: { hp:60,  spd:42,  dmg:12, sz:16, col:'#6688ff', xp:4,  minT:90,  shield:30 },
};

// ──── BOSS DATA ────
const BOSS_DEFS = [
  { name:'Mega Brute',  hp:2000, spd:28, dmg:30, sz:45, col:'#ff2200', ability:'summon',   abCd:5  },
  { name:'Storm Lord',  hp:1600, spd:55, dmg:22, sz:38, col:'#8844ff', ability:'barrage',  abCd:3.5 },
  { name:'Void King',   hp:2800, spd:40, dmg:28, sz:42, col:'#ff0066', ability:'teleport', abCd:6  },
];

// ──── CHARACTER DATA ────
const CHARACTERS = {
  voidwalker: { name:'Void Walker', icon:'👤', desc:'Balanced fighter',
    color:'#00ffcc', hp:100, speed:210, dmg:1, weapon:'bolt', unlock:null },
  irongolem:  { name:'Iron Golem',  icon:'🛡️', desc:'+50% HP, -20% Speed',
    color:'#ff6644', hp:150, speed:168, dmg:1, weapon:'nova', unlock:{ type:'time', val:300, text:'Survive 5 minutes' }},
  phaserunner:{ name:'Phase Runner', icon:'⚡', desc:'-30% HP, +40% Speed',
    color:'#ffcc00', hp:70,  speed:294, dmg:1, weapon:'orbital', unlock:{ type:'kills', val:500, text:'Kill 500 total enemies' }},
  stormmage:  { name:'Storm Mage',  icon:'🔮', desc:'-20% HP, +30% Damage',
    color:'#aa66ff', hp:80,  speed:210, dmg:1.3, weapon:'lightning', unlock:{ type:'level', val:20, text:'Reach level 20' }},
};

// ──── META UPGRADE DATA ────
const META = {
  metaHp:    { name:'Constitution', icon:'❤️',  desc:'+10% Max HP per level',      max:5, costs:[200,500,1200,2800,6000] },
  metaDmg:   { name:'Strength',     icon:'⚔️',  desc:'+10% Damage per level',      max:5, costs:[200,500,1200,2800,6000] },
  metaSpd:   { name:'Agility',      icon:'👟',  desc:'+10% Speed per level',       max:5, costs:[200,500,1200,2800,6000] },
  metaXp:    { name:'Wisdom',       icon:'📖',  desc:'+12% XP Gain per level',     max:5, costs:[150,400,1000,2200,5000] },
  metaRange: { name:'Magnetism',    icon:'🧲',  desc:'+20% Pickup Range per level',max:5, costs:[120,350,800,1800,4000] },
  metaStart: { name:'Head Start',   icon:'🎯',  desc:'+1 Starting Level',          max:3, costs:[800,2500,6000] },
};

// ──── UTILS ────
function lerp(a,b,t){return a+(b-a)*t}
function clamp(v,lo,hi){return v<lo?lo:v>hi?hi:v}
function dst(a,b){return Math.hypot(b.x-a.x,b.y-a.y)}
function ang(a,b){return Math.atan2(b.y-a.y,b.x-a.x)}
function rnd(lo,hi){return Math.random()*(hi-lo)+lo}
function rndI(lo,hi){return Math.floor(rnd(lo,hi+1))}
function pick(a){return a[Math.floor(Math.random()*a.length)]}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=rndI(0,i);[a[i],a[j]]=[a[j],a[i]]}return a}
function fmtTime(t){const m=Math.floor(t/60),s=Math.floor(t%60);return m+':'+String(s).padStart(2,'0')}
function getRunScore(){return kills+Math.floor(gtime)*10}

// ──── AUDIO ────
let actx;
function initAudio(){try{actx=new(window.AudioContext||window.webkitAudioContext)}catch{}}
function tone(f,d,ty,v){if(!actx)return;const o=actx.createOscillator(),g=actx.createGain();o.type=ty;o.frequency.value=f;g.gain.value=v;g.gain.exponentialRampToValueAtTime(.001,actx.currentTime+d);o.connect(g);g.connect(actx.destination);o.start();o.stop(actx.currentTime+d)}
function sfxShoot(){tone(700,.04,'square',.04)}
function sfxHit(){tone(180,.06,'sawtooth',.025)}
function sfxPickup(){tone(650,.06,'sine',.04)}
function sfxLvl(){tone(440,.15,'sine',.06);setTimeout(()=>tone(660,.15,'sine',.06),80);setTimeout(()=>tone(880,.2,'sine',.06),160)}
function sfxDeath(){tone(250,.25,'sawtooth',.07);setTimeout(()=>tone(120,.4,'sawtooth',.05),150)}
function sfxNova(){tone(200,.18,'sine',.04);tone(400,.12,'triangle',.03)}
function sfxBoss(){tone(100,.4,'sawtooth',.08);setTimeout(()=>tone(80,.5,'sawtooth',.06),200)}
function sfxEvo(){tone(523,.2,'sine',.08);setTimeout(()=>tone(659,.2,'sine',.08),120);setTimeout(()=>tone(784,.3,'sine',.08),240);setTimeout(()=>tone(1047,.4,'sine',.06),360)}
function sfxChest(){tone(800,.1,'sine',.06);setTimeout(()=>tone(1000,.1,'sine',.05),80);setTimeout(()=>tone(1200,.15,'sine',.04),160)}

// ──── MUSIC ────
let musicPlaying=false, musicNodes=[];
function startMusic(){
  if(!actx||musicPlaying)return; musicPlaying=true;
  const bass=actx.createOscillator(),bGain=actx.createGain(),bFilt=actx.createBiquadFilter();
  bass.type='sawtooth';bass.frequency.value=55;bFilt.type='lowpass';bFilt.frequency.value=180;
  bGain.gain.value=.035;bass.connect(bFilt);bFilt.connect(bGain);bGain.connect(actx.destination);bass.start();
  musicNodes.push(bass);
  const notes=[220,261,330,261,220,196,220,330];let ni=0;
  function arp(){
    if(!musicPlaying)return;
    if((state==='playing'||state==='levelup')&&!gamePaused){
      tone(notes[ni%notes.length],.18,'triangle',.014);
    }
    ni++;setTimeout(arp,280);
  }
  function kick(){
    if(!musicPlaying)return;
    if((state==='playing'||state==='levelup')&&!gamePaused){
      const o=actx.createOscillator(),g=actx.createGain();
      o.type='sine';o.frequency.value=80;o.frequency.exponentialRampToValueAtTime(30,actx.currentTime+.1);
      g.gain.value=.05;g.gain.exponentialRampToValueAtTime(.001,actx.currentTime+.15);
      o.connect(g);g.connect(actx.destination);o.start();o.stop(actx.currentTime+.15);
    }
    setTimeout(kick,560);
  }
  arp();setTimeout(kick,140);
}
function stopMusic(){musicPlaying=false;musicNodes.forEach(n=>{try{n.stop()}catch{}});musicNodes=[];}

// ──── PERSISTENCE (+ cloud sync when signed into Firebase on same site) ────
const SAVE_KEY='void_survivors_save';
const CLOUD_DEBOUNCE_MS=1500;
let cloudSaveTimer=null,pendingCloudPayload=null;

function defaultSave(){return{coins:0,totalKills:0,maxTime:0,maxLevel:0,meta:{},leaderboard:[],username:'',updatedAt:0}}
function normalizeSave(raw){
  const d=defaultSave();
  if(!raw||typeof raw!=='object')return d;
  d.coins=Math.max(0,Math.floor(Number(raw.coins)||0));
  d.totalKills=Math.max(0,Math.floor(Number(raw.totalKills)||0));
  d.maxTime=Math.max(0,Number(raw.maxTime)||0);
  d.maxLevel=Math.max(0,Math.floor(Number(raw.maxLevel)||0));
  d.meta={};
  if(raw.meta&&typeof raw.meta==='object'){
    for(const[id,def]of Object.entries(META)){
      const v=Math.floor(Number(raw.meta[id])||0);
      if(v>0)d.meta[id]=Math.min(def.max,v);
    }
  }
  d.leaderboard=Array.isArray(raw.leaderboard)?raw.leaderboard.slice(0,10):[];
  d.username=(typeof raw.username==='string'?raw.username:'').replace(/[^a-zA-Z0-9_ -]/g,'').slice(0,16)||'';
  d.updatedAt=Math.floor(Number(raw.updatedAt)||0);
  return d;
}
function loadSave(){try{const d=JSON.parse(localStorage.getItem(SAVE_KEY));return normalizeSave(d)}catch{return defaultSave()}}
function saveSave(s,opts){
  opts=opts||{};
  if(!opts.preserveTimestamp)s.updatedAt=Date.now();
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(s))}catch{}
  if(!opts.skipCloud){
    if(opts.immediateCloud)pushSaveToCloud(normalizeSave(s));
    else scheduleCloudPush(s);
  }
}
function scheduleCloudPush(s){
  if(typeof firebase==='undefined'||typeof firebase.auth!=='function'||!firebase.auth().currentUser||!window.__NK_FB_DB)return;
  pendingCloudPayload=normalizeSave(s);
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer=setTimeout(()=>{pushSaveToCloud(pendingCloudPayload);pendingCloudPayload=null},CLOUD_DEBOUNCE_MS);
}
async function pushSaveToCloud(s){
  const u=firebase.auth().currentUser,db=window.__NK_FB_DB;
  if(!u||!db||!s)return;
  try{
    const payload=normalizeSave(s);
    payload.updatedAt=payload.updatedAt||Date.now();
    await db.collection('users').doc(u.uid).set({
      voidSurvivorsSave:payload,
      voidSaveUpdatedAt:payload.updatedAt
    },{merge:true});
  }catch(e){console.warn('Cloud save failed:',e)}
}
async function pullSaveFromCloud(){
  const u=firebase.auth().currentUser,db=window.__NK_FB_DB;
  if(!u||!db)return null;
  try{
    const doc=await db.collection('users').doc(u.uid).get();
    if(!doc.exists)return null;
    const d=doc.data();
    const raw=d.voidSurvivorsSave;
    if(!raw||typeof raw!=='object')return null;
    const s=normalizeSave(raw);
    const topT=Math.max(s.updatedAt||0,Math.floor(Number(d.voidSaveUpdatedAt)||0));
    if(topT)s.updatedAt=topT;
    return s;
  }catch(e){console.warn('Cloud load failed:',e);return null}
}
function initCloudSaveSync(){
  if(typeof firebase==='undefined'||!window.__NK_FB_DB||typeof firebase.auth!=='function')return;
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden'&&pendingCloudPayload&&firebase.auth().currentUser)
      pushSaveToCloud(pendingCloudPayload);
  });
  firebase.auth().onAuthStateChanged(async user=>{
    if(!user)return;
    if(state==='playing'){
      pushSaveToCloud(loadSave());
      return;
    }
    try{
      const local=loadSave();
      const localT=local.updatedAt||0;
      const cloud=await pullSaveFromCloud();
      const cloudT=cloud?cloud.updatedAt||0:0;
      if(cloud&&cloudT>localT){
        saveSave(cloud,{preserveTimestamp:true,skipCloud:true});
        if(state==='title')showTitle();
        else if(state==='shop')showShop();
        else if(state==='charselect')showCharSelect();
      }else{
        await pushSaveToCloud(local);
      }
    }catch(e){console.warn('Save sync:',e)}
  });
}
function getCoins(){return loadSave().coins}
function addCoins(n){const s=loadSave();s.coins+=n;saveSave(s);return s.coins}
function isCharUnlocked(id){
  const c=CHARACTERS[id];if(!c.unlock)return true;
  const s=loadSave();
  if(c.unlock.type==='time')return s.maxTime>=c.unlock.val;
  if(c.unlock.type==='kills')return s.totalKills>=c.unlock.val;
  if(c.unlock.type==='level')return s.maxLevel>=c.unlock.val;
  return false;
}
function getUsername(){return loadSave().username||'Player'}
function setUsername(name){const s=loadSave();s.username=name.trim().slice(0,16)||'Player';saveSave(s,{immediateCloud:true});return s.username}

// ──── ONLINE LEADERBOARD ────
let globalLB=[];
let globalLBFetched=false;
async function submitOnlineScore(name,score,seconds,text){
  const safeName=name.replace(/[^a-zA-Z0-9_ -]/g,'').slice(0,16)||'Player';
  const safeText=(text||'').slice(0,30);
  const sc=Math.floor(Number(score)||0);
  const sec=Math.floor(Number(seconds)||0);

  if(hasFirestoreLB()){
    try{
      await fsDb().collection(FS_LB_COLLECTION).add({
        name:safeName,
        score:sc,
        seconds:sec,
        text:safeText,
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('Score saved to Firestore');
      await fetchGlobalLB();
      return;
    }catch(e){console.warn('Firestore score submit failed:',e)}
  }

  if(!DREAMLO_ENABLED)return;
  const path=`/${DREAMLO_PRIVATE}/add-json/${encodeURIComponent(safeName)}/${sc}/${sec}/${encodeURIComponent(safeText)}`;
  try{
    const r=await dlFetch(path);
    if(r){
      const data=await r.json();
      console.log('Score submit OK:',data);
      const entries=data?.dreamlo?.leaderboard?.entry;
      if(entries){
        const arr=Array.isArray(entries)?entries:[entries];
        globalLB=arr.map(e=>({name:e.name,score:parseInt(e.score)||0,time:parseInt(e.seconds)||0,text:e.text||'',date:e.date||''}));
        globalLB.sort((a,b)=>b.score-a.score);
        globalLB=globalLB.slice(0,GLOBAL_LB_TOP);
        globalLBFetched=true;
      }
    }else{console.warn('Score submit: no response from any proxy')}
  }catch(e){console.warn('Score submit failed:',e)}
}
async function fetchGlobalLB(){
  if(hasFirestoreLB()){
    try{
      const snap=await fsDb().collection(FS_LB_COLLECTION).orderBy('score','desc').limit(GLOBAL_LB_TOP).get();
      globalLBFetched=true;
      globalLB=snap.docs.map(d=>{
        const x=d.data();
        let dateStr='';
        try{if(x.createdAt&&x.createdAt.toDate)dateStr=x.createdAt.toDate().toLocaleString()}catch{}
        return{name:String(x.name||'Player').slice(0,24),score:parseInt(x.score,10)||0,time:parseInt(x.seconds,10)||0,text:String(x.text||'').slice(0,40),date:dateStr};
      });
      return globalLB;
    }catch(e){
      console.warn('Firestore leaderboard fetch failed:',e);
      globalLBFetched=true;
      globalLB=[];
      return globalLB;
    }
  }

  if(!DREAMLO_ENABLED){globalLBFetched=true;return[]}
  try{
    const res=await dlFetch(`/${DREAMLO_PUBLIC}/json`);
    if(!res){globalLBFetched=true;return[]}
    const data=await res.json();
    globalLBFetched=true;
    const entries=data?.dreamlo?.leaderboard?.entry;
    if(!entries){globalLB=[];return[]}
    const arr=Array.isArray(entries)?entries:[entries];
    globalLB=arr.map(e=>({name:e.name,score:parseInt(e.score)||0,time:parseInt(e.seconds)||0,text:e.text||'',date:e.date||''}));
    globalLB.sort((a,b)=>b.score-a.score);
    globalLB=globalLB.slice(0,GLOBAL_LB_TOP);
    return globalLB;
  }catch(e){console.warn('Leaderboard fetch failed:',e);globalLBFetched=true;return[]}
}
function renderGlobalLB(containerId,highlightName){
  const el=document.getElementById(containerId);if(!el)return;
  if(!hasOnlineLeaderboard()){
    el.innerHTML='<div class="recap-section"><div class="recap-title">Global Leaderboard</div><div class="lb-loading">Firebase not loaded — check firebase-config.js on your server</div></div>';
    return;
  }
  if(!globalLBFetched){el.innerHTML='<div class="recap-section"><div class="recap-title">🌍 Global Leaderboard</div><div class="lb-loading">Loading...</div></div>';return}
  if(!globalLB.length){el.innerHTML='<div class="recap-section"><div class="recap-title">🌍 Global Leaderboard</div><div class="lb-loading">No scores yet — play a game to be #1!</div></div>';return}
  let html='<div class="recap-section"><div class="recap-title">🌍 Global Leaderboard — Top '+GLOBAL_LB_TOP+'</div>';
  html+='<div class="lb-row lb-header"><span class="lb-rank">#</span><span class="lb-name">Player</span><span class="lb-time">Time</span><span class="lb-kills">Score</span></div>';
  globalLB.slice(0,GLOBAL_LB_TOP).forEach((r,i)=>{
    const isYou=highlightName&&r.name===highlightName;
    const medal=i===0?'lb-gold':i===1?'lb-silver':i===2?'lb-bronze':'';
    html+=`<div class="lb-row ${medal} ${isYou?'lb-you lb-new':''}">
      <span class="lb-rank">${i+1}</span><span class="lb-name">${r.name}${isYou?' ← YOU':''}</span>
      <span class="lb-time">${fmtTime(r.time)}</span><span class="lb-kills">${r.score}</span></div>`;
  });
  html+='</div>';el.innerHTML=html;
}

// ──── MOBILE DETECTION ────
// Narrow window or real phone/tablet — not "any PC with a touchscreen"
const isMobile=/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  ||Math.min(window.innerWidth,window.innerHeight)<=640;
const MOB={
  sizeScale:isMobile?1.5:1,
  pickupScale:isMobile?1.6:1,
  enemySpeedScale:isMobile?0.88:1,
  gemScale:isMobile?1.4:1,
  joystickSize:isMobile?60:40,
  joystickKnob:isMobile?20:14,
  joystickDeadzone:isMobile?8:12,
};

// ──── GLOBALS ────
let canvas,ctx,W,H,dpr;
let state='title', gamePaused=false, gtime=0, lastTs=0, kills=0, bossesKilled=0;
let player,enemies,projectiles,gems,particles,dmgNums,lightningArcs,groundZones,chests;
let camera,input,spawnTimer;
let wTimers,orbAngle,orbHits,pendingLvls,bossLevels;
let damageDealt,selectedChar,screenFlash,freezeFrames;

// ──── INIT GAME ────
function initGame(charId){
  selectedChar=charId||'voidwalker';
  const ch=CHARACTERS[selectedChar];
  const sv=loadSave();const m=sv.meta||{};
  gtime=0;kills=0;bossesKilled=0;spawnTimer=2.5;
  orbAngle=0;orbHits=new Map();pendingLvls=0;bossLevels=new Set();
  damageDealt={};screenFlash=0;freezeFrames=0;

  const hpMult=1+(m.metaHp||0)*.1;
  const spdMult=1+(m.metaSpd||0)*.1;
  const dmgMult=1+(m.metaDmg||0)*.1;
  const rangeMult=1+(m.metaRange||0)*.2;

  player={
    x:CFG.ARENA/2, y:CFG.ARENA/2,
    speed:ch.speed*spdMult,
    health:ch.hp*hpMult, maxHealth:ch.hp*hpMult,
    size:CFG.P_SIZE*MOB.sizeScale, xp:0, level:1, xpNeeded:xpFor(1),
    pickupRange:55*rangeMult*MOB.pickupScale,
    dmgMult:ch.dmg*dmgMult, armor:0, regen:0,
    xpMult:1+(m.metaXp||0)*.12,
    invuln:0, facing:0,
    weapons:{}, passives:{}, evolved:{},
    charColor:ch.color,
  };
  player.weapons[ch.weapon]=1;

  enemies=[];projectiles=[];gems=[];particles=[];dmgNums=[];
  lightningArcs=[];groundZones=[];chests=[];
  wTimers={bolt:0,orbital:0,nova:0,lightning:0,missile:0,flame:0,boomerang:0,holywater:0};

  camera={x:CFG.ARENA/2,y:CFG.ARENA/2,sx:0,sy:0};

  const startLv=m.metaStart||0;
  if(startLv>0)pendingLvls=startLv;
}

// ──── INPUT ────
function setupInput(){
  input={keys:{},touch:null};
  window.addEventListener('keydown',e=>{
    if(document.activeElement&&document.activeElement.tagName==='INPUT')return;
    const key=e.key.toLowerCase();
    if((key==='escape'||key==='p')&&state==='playing'){
      if(key==='escape'||!e.repeat){toggleGamePause();e.preventDefault();return}
    }
    input.keys[key]=true;
    if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))e.preventDefault();
  });
  window.addEventListener('keyup',e=>{if(document.activeElement&&document.activeElement.tagName==='INPUT')return;input.keys[e.key.toLowerCase()]=false});
  canvas.addEventListener('touchstart',e=>{e.preventDefault();const t=e.touches[0];input.touch={sx:t.clientX,sy:t.clientY,cx:t.clientX,cy:t.clientY}},{passive:false});
  canvas.addEventListener('touchmove',e=>{e.preventDefault();if(input.touch){const t=e.touches[0];input.touch.cx=t.clientX;input.touch.cy=t.clientY}},{passive:false});
  canvas.addEventListener('touchend',e=>{e.preventDefault();input.touch=null},{passive:false});
}
function getMov(){
  let dx=0,dy=0;const k=input.keys;
  if(k['w']||k['arrowup']||k['z'])dy=-1;
  if(k['s']||k['arrowdown'])dy=1;
  if(k['a']||k['arrowleft']||k['q'])dx=-1;
  if(k['d']||k['arrowright'])dx=1;
  if(input.touch){const tdx=input.touch.cx-input.touch.sx,tdy=input.touch.cy-input.touch.sy,tl=Math.hypot(tdx,tdy);if(tl>MOB.joystickDeadzone){dx=tdx/tl;dy=tdy/tl}}
  const l=Math.hypot(dx,dy);if(l>0){dx/=l;dy/=l}return{dx,dy};
}

// ──── HELPERS ────
function wStat(id){
  if(player.evolved[id])return EVOLUTIONS[id].stats;
  const lv=player.weapons[id];if(!lv)return null;
  return WEAPONS[id].levels[lv-1];
}
function adjCd(cd){return cd*Math.pow(.92,player.passives.cooldown||0)}
function addP(x,y,col,n,sMin,sMax,life){
  for(let i=0;i<n;i++){const a=rnd(0,Math.PI*2),s=rnd(sMin,sMax);
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life,maxLife:life,size:rnd(2,5),col})}
}
function addDN(x,y,val,col){dmgNums.push({x,y,val:Math.round(val),life:.8,maxLife:.8,col:col||'#fff'})}
function trackDmg(wId,amt){damageDealt[wId]=(damageDealt[wId]||0)+amt}

function dealDmg(e,amt,col,wId){
  if(e.shieldHp&&e.shieldHp>0){
    e.shieldHp-=amt;
    addDN(e.x+rnd(-8,8),e.y-e.size,'🛡️','#6688ff');
    if(e.shieldHp<=0){addP(e.x,e.y,'#6688ff',8,50,150,.4)}
    return;
  }
  e.hp-=amt;e.hitFlash=.1;
  addDN(e.x+rnd(-10,10),e.y-e.size,amt,col);
  addP(e.x,e.y,col||'#fff',3,40,100,.3);
  if(wId)trackDmg(wId,amt);
}

function hurtPlayer(dmg){
  const actual=Math.max(1,dmg-player.armor);
  player.health-=actual;player.invuln=isMobile?0.8:CFG.P_INVULN;
  camera.sx+=rnd(-6,6);camera.sy+=rnd(-6,6);
  addP(player.x,player.y,'#ff3333',8,50,150,.4);
  addDN(player.x,player.y-player.size-10,actual,'#ff3333');
}

// ──── SPAWN ────
function getSpawnPos(){
  const mg=90,side=rndI(0,3);let x,y;
  const cl=camera.x-W/2,cr=camera.x+W/2,ct=camera.y-H/2,cb=camera.y+H/2;
  switch(side){
    case 0:x=rnd(cl-mg,cr+mg);y=ct-mg;break;
    case 1:x=cr+mg;y=rnd(ct-mg,cb+mg);break;
    case 2:x=rnd(cl-mg,cr+mg);y=cb+mg;break;
    default:x=cl-mg;y=rnd(ct-mg,cb+mg);break;
  }
  return{x:clamp(x,30,CFG.ARENA-30),y:clamp(y,30,CFG.ARENA-30)};
}

function spawnEnemies(dt){
  spawnTimer-=dt;if(spawnTimer>0||enemies.length>=CFG.MAX_ENEMIES)return;
  const mins=gtime/60;
  const diff=1+mins*0.5+mins*mins*0.02;
  const batch=Math.min(Math.floor(diff*1.8)+1,30);
  spawnTimer=Math.max(.12,1.1-mins*0.05);
  const avail=Object.entries(ENEMY_DEFS).filter(([,d])=>gtime>=d.minT);
  for(let i=0;i<batch;i++){
    const[type,def]=pick(avail);const pos=getSpawnPos();
    const hpS=1+mins*0.3+mins*mins*0.015;
    const dmgS=1+mins*0.2+mins*mins*0.01;
    const spdS=1+Math.min(mins*0.02,0.6);
    const e={x:pos.x,y:pos.y,hp:def.hp*hpS,maxHp:def.hp*hpS,speed:def.spd*rnd(.85,1.15)*spdS*MOB.enemySpeedScale,
      dmg:def.dmg*dmgS,size:def.sz,col:def.col,xp:def.xp,type,hitFlash:0,isBoss:false};
    if(def.explodes)e.explodes=true;
    if(def.shield)e.shieldHp=def.shield*hpS;
    enemies.push(e);
  }
}

function spawnBoss(lvl){
  const idx=Math.floor((lvl/10-1)%BOSS_DEFS.length);
  const def=BOSS_DEFS[idx];const sc=1+(lvl-10)/10;
  const pos=getSpawnPos();
  enemies.push({
    x:pos.x,y:pos.y,hp:def.hp*sc,maxHp:def.hp*sc,speed:def.spd,
    dmg:def.dmg*sc,size:def.sz,col:def.col,xp:50*sc,type:'boss',hitFlash:0,
    isBoss:true,bossName:def.name,ability:def.ability,abTimer:def.abCd,abCd:def.abCd,
  });
  showBanner('boss-warning',2500);sfxBoss();
}

// ──── WEAPONS ────
function fireBolt(dt){
  const s=wStat('bolt');if(!s)return;
  wTimers.bolt-=dt;if(wTimers.bolt>0)return;
  wTimers.bolt=adjCd(s.cd);if(!enemies.length)return;
  const sorted=[...enemies].sort((a,b)=>dst(player,a)-dst(player,b));
  const targets=sorted.slice(0,s.count);
  targets.forEach(t=>{
    const a=ang(player,t)+rnd(-.06,.06);
    projectiles.push({x:player.x,y:player.y,vx:Math.cos(a)*s.spd,vy:Math.sin(a)*s.spd,
      dmg:s.dmg*player.dmgMult,size:s.sz,col:player.evolved.bolt?EVOLUTIONS.bolt.color:WEAPONS.bolt.color,
      life:2.5,pierce:s.pierce,hits:[],wId:'bolt'});
  });sfxShoot();
}

function updateOrbital(dt){
  const s=wStat('orbital');if(!s)return;
  orbAngle+=s.spd*dt;
  const col=player.evolved.orbital?EVOLUTIONS.orbital.color:WEAPONS.orbital.color;
  for(let i=0;i<s.count;i++){
    const a=orbAngle+(Math.PI*2/s.count)*i;
    const ox=player.x+Math.cos(a)*s.rad,oy=player.y+Math.sin(a)*s.rad;
    for(const e of enemies){
      if(Math.hypot(ox-e.x,oy-e.y)<s.sz+e.size){
        const last=orbHits.get(e)||0;
        if(gtime-last>=s.hcd){orbHits.set(e,gtime);dealDmg(e,s.dmg*player.dmgMult,col,'orbital')}
      }
    }
  }
}

function fireNova(dt){
  const s=wStat('nova');if(!s)return;
  wTimers.nova-=dt;if(wTimers.nova>0)return;
  wTimers.nova=adjCd(s.cd);sfxNova();
  const col=player.evolved.nova?EVOLUTIONS.nova.color:WEAPONS.nova.color;
  addP(player.x,player.y,col,22,100,300,.6);
  for(let i=0;i<36;i++){const a=(Math.PI*2/36)*i;
    particles.push({x:player.x+Math.cos(a)*15,y:player.y+Math.sin(a)*15,
      vx:Math.cos(a)*s.rad*2.5,vy:Math.sin(a)*s.rad*2.5,life:.32,maxLife:.32,size:4,col})}
  for(const e of enemies){if(dst(player,e)<=s.rad)dealDmg(e,s.dmg*player.dmgMult,col,'nova')}
}

function fireLightning(dt){
  const s=wStat('lightning');if(!s)return;
  wTimers.lightning-=dt;if(wTimers.lightning>0||!enemies.length)return;
  wTimers.lightning=adjCd(s.cd);
  const col=player.evolved.lightning?EVOLUTIONS.lightning.color:WEAPONS.lightning.color;
  let first=enemies[0];for(const e of enemies)if(dst(player,e)<dst(player,first))first=e;
  if(dst(player,first)>500)return;
  const chain=[first];dealDmg(first,s.dmg*player.dmgMult,col,'lightning');
  let cur=first;
  for(let i=1;i<s.chains;i++){
    let best=null,bestD=s.range;
    for(const e of enemies){if(chain.includes(e))continue;const d=dst(cur,e);if(d<bestD){bestD=d;best=e}}
    if(!best)break;chain.push(best);dealDmg(best,s.dmg*player.dmgMult*(1-i*.08),col,'lightning');cur=best;
  }
  lightningArcs.push({pts:[{x:player.x,y:player.y},...chain.map(e=>({x:e.x,y:e.y}))],life:.2,maxLife:.2,col});
}

function fireMissile(dt){
  const s=wStat('missile');if(!s)return;
  wTimers.missile-=dt;if(wTimers.missile>0||!enemies.length)return;
  wTimers.missile=adjCd(s.cd);
  const col=player.evolved.missile?EVOLUTIONS.missile.color:WEAPONS.missile.color;
  for(let i=0;i<s.count;i++){
    const a=rnd(0,Math.PI*2);
    projectiles.push({x:player.x,y:player.y,vx:Math.cos(a)*s.spd,vy:Math.sin(a)*s.spd,
      dmg:s.dmg*player.dmgMult,size:s.sz,col,life:4,pierce:0,hits:[],wId:'missile',homing:s.homing});
  }sfxShoot();
}

function updateFlame(dt){
  const s=wStat('flame');if(!s)return;
  wTimers.flame-=dt;if(wTimers.flame>0)return;
  wTimers.flame=s.tick;
  const col=player.evolved.flame?EVOLUTIONS.flame.color:WEAPONS.flame.color;
  for(const e of enemies){if(dst(player,e)<=s.rad)dealDmg(e,s.dmg*player.dmgMult,col,'flame')}
  for(let i=0;i<4;i++){const a=rnd(0,Math.PI*2),r=rnd(s.rad*.4,s.rad);
    particles.push({x:player.x+Math.cos(a)*r,y:player.y+Math.sin(a)*r,
      vx:rnd(-15,15),vy:rnd(-40,-10),life:.3,maxLife:.3,size:rnd(2,4),col})}
}

function fireBoomerang(dt){
  const s=wStat('boomerang');if(!s)return;
  wTimers.boomerang-=dt;if(wTimers.boomerang>0)return;
  wTimers.boomerang=adjCd(s.cd);
  if(!enemies.length)return;
  const sorted=[...enemies].sort((a,b)=>dst(player,a)-dst(player,b));
  for(let i=0;i<Math.min(s.count,sorted.length);i++){
    const t=sorted[i];const a=ang(player,t);
    projectiles.push({x:player.x,y:player.y,vx:Math.cos(a)*s.spd,vy:Math.sin(a)*s.spd,
      dmg:s.dmg*player.dmgMult,size:s.sz,col:WEAPONS.boomerang.color,
      life:5,pierce:99,hits:[],wId:'boomerang',
      isBoomerang:true,returning:false,originX:player.x,originY:player.y,maxDist:s.maxDist,bSpd:s.spd});
  }sfxShoot();
}

function fireHolyWater(dt){
  const s=wStat('holywater');if(!s)return;
  wTimers.holywater-=dt;if(wTimers.holywater>0)return;
  wTimers.holywater=adjCd(s.cd);
  for(let i=0;i<s.count;i++){
    let tx,ty;
    if(enemies.length){const t=pick(enemies);tx=t.x+rnd(-25,25);ty=t.y+rnd(-25,25)}
    else{tx=player.x+rnd(-80,80);ty=player.y+rnd(-80,80)}
    groundZones.push({x:tx,y:ty,rad:s.rad,dmg:s.dmg,life:s.dur,maxLife:s.dur,
      col:WEAPONS.holywater.color,tickTimer:0,tickRate:.5,wId:'holywater'});
  }
}

// ──── BOSS ABILITIES ────
function updateBossAbility(e,dt){
  if(!e.isBoss||!e.ability)return;
  e.abTimer-=dt;if(e.abTimer>0)return;
  e.abTimer=e.abCd;
  if(e.ability==='summon'){
    const sm=gtime/60;const shp=1+sm*0.3+sm*sm*0.015;const sdm=1+sm*0.2+sm*sm*0.01;
    for(let i=0;i<5+Math.floor(sm);i++){const a=rnd(0,Math.PI*2);
      const def=ENEMY_DEFS.crawler;
      enemies.push({x:e.x+Math.cos(a)*50,y:e.y+Math.sin(a)*50,
        hp:def.hp*shp,maxHp:def.hp*shp,speed:def.spd*rnd(.9,1.1)*MOB.enemySpeedScale,
        dmg:def.dmg*sdm,size:def.sz,col:def.col,xp:def.xp,type:'crawler',hitFlash:0,isBoss:false})}
  }
  if(e.ability==='barrage'){
    for(let i=0;i<12;i++){const a=(Math.PI*2/12)*i;
      projectiles.push({x:e.x,y:e.y,vx:Math.cos(a)*220,vy:Math.sin(a)*220,
        dmg:e.dmg*.35,size:5,col:'#8844ff',life:3,pierce:0,hits:[],isEnemy:true})}
    addP(e.x,e.y,'#8844ff',12,60,180,.4);
  }
  if(e.ability==='teleport'){
    const a=rnd(0,Math.PI*2);e.x=player.x+Math.cos(a)*120;e.y=player.y+Math.sin(a)*120;
    e.x=clamp(e.x,e.size,CFG.ARENA-e.size);e.y=clamp(e.y,e.size,CFG.ARENA-e.size);
    addP(e.x,e.y,'#ff0066',20,100,300,.5);
    if(dst(e,player)<100)hurtPlayer(e.dmg*.5);
  }
}

// ──── CHEST SYSTEM ────
function trySpawnChest(x,y){
  const luckLv=player.passives.luck||0;
  const chance=CFG.CHEST_BASE_CHANCE*(1+luckLv*.4);
  if(Math.random()<chance){
    chests.push({x:x+rnd(-10,10),y:y+rnd(-10,10),size:10,life:20,col:'#ffcc00'});
  }
}
function collectChest(c){
  sfxChest();addP(c.x,c.y,'#ffcc00',15,60,200,.5);
  const roll=Math.random();
  if(roll<.35){
    player.health=Math.min(player.maxHealth,player.health+player.maxHealth*.25);
    addDN(c.x,c.y-15,'HEAL','#33ff66');
  }else if(roll<.65){
    const bonus=Math.floor(5+gtime/30);
    player.xp+=bonus;addDN(c.x,c.y-15,'+'+bonus+' XP','#4488ff');
  }else{
    const coinBonus=rndI(5,15);addCoins(coinBonus);
    addDN(c.x,c.y-15,'+'+coinBonus+' 💰','#ffcc00');
  }
}

// ──── UPDATE ────
function update(dt){
  if(freezeFrames>0){freezeFrames--;return}
  gtime+=dt;
  screenFlash=Math.max(0,screenFlash-dt*3);

  

  // Movement
  const mv=getMov();
  if(mv.dx||mv.dy)player.facing=Math.atan2(mv.dy,mv.dx);
  player.x+=mv.dx*player.speed*dt;player.y+=mv.dy*player.speed*dt;
  player.x=clamp(player.x,player.size,CFG.ARENA-player.size);
  player.y=clamp(player.y,player.size,CFG.ARENA-player.size);
  player.invuln=Math.max(0,player.invuln-dt);

  // Regen
  if(player.regen>0)player.health=Math.min(player.maxHealth,player.health+player.regen*dt);

  // Visual size growth
  player.size=(CFG.P_SIZE+Math.min(player.level*.25,8))*MOB.sizeScale;

  // Trail particles
  if((mv.dx||mv.dy)&&Math.random()<.25){
    particles.push({x:player.x+rnd(-4,4),y:player.y+rnd(-4,4),
      vx:-mv.dx*20+rnd(-10,10),vy:-mv.dy*20+rnd(-10,10),
      life:.25,maxLife:.25,size:rnd(1.5,3),col:player.charColor})}

  // Camera
  camera.x=lerp(camera.x,player.x,CFG.CAM_LERP);camera.y=lerp(camera.y,player.y,CFG.CAM_LERP);
  camera.sx*=CFG.SHAKE_DECAY;camera.sy*=CFG.SHAKE_DECAY;

  // Weapons
  if(player.weapons.bolt)fireBolt(dt);
  if(player.weapons.orbital)updateOrbital(dt);
  if(player.weapons.nova)fireNova(dt);
  if(player.weapons.lightning)fireLightning(dt);
  if(player.weapons.missile)fireMissile(dt);
  if(player.weapons.flame)updateFlame(dt);
  if(player.weapons.boomerang)fireBoomerang(dt);
  if(player.weapons.holywater)fireHolyWater(dt);

  // Projectiles
  for(const p of projectiles){
    if(p.homing&&!p.isEnemy&&enemies.length){
      let closest=enemies[0];for(const e of enemies)if(dst(p,e)<dst(p,closest))closest=e;
      const desired=Math.atan2(closest.y-p.y,closest.x-p.x);
      const cur=Math.atan2(p.vy,p.vx);
      const diff=Math.atan2(Math.sin(desired-cur),Math.cos(desired-cur));
      const turn=clamp(diff,-p.homing*dt,p.homing*dt);
      const na=cur+turn,spd=Math.hypot(p.vx,p.vy);
      p.vx=Math.cos(na)*spd;p.vy=Math.sin(na)*spd;
    }
    if(p.isBoomerang){
      const dFromOrigin=Math.hypot(p.x-p.originX,p.y-p.originY);
      if(!p.returning&&dFromOrigin>=p.maxDist){p.returning=true;p.hits=[];}
      if(p.returning){
        const a=Math.atan2(player.y-p.y,player.x-p.x);
        p.vx=Math.cos(a)*p.bSpd*1.2;p.vy=Math.sin(a)*p.bSpd*1.2;
        if(Math.hypot(p.x-player.x,p.y-player.y)<player.size+8)p.life=0;
      }
    }
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;
  }
  projectiles=projectiles.filter(p=>p.life>0);

  // Ground zones
  for(const z of groundZones){
    z.life-=dt;z.tickTimer-=dt;
    if(z.tickTimer<=0){z.tickTimer=z.tickRate;
      for(const e of enemies){if(dst(z,e)<=z.rad)dealDmg(e,z.dmg*player.dmgMult,z.col,z.wId)}
    }
    if(Math.random()<.2)particles.push({x:z.x+rnd(-z.rad*.6,z.rad*.6),y:z.y+rnd(-z.rad*.6,z.rad*.6),
      vx:rnd(-10,10),vy:rnd(-30,-5),life:.4,maxLife:.4,size:rnd(2,4),col:z.col});
  }
  groundZones=groundZones.filter(z=>z.life>0);

  // Enemies
  for(const e of enemies){
    const a=ang(e,player);
    e.x+=Math.cos(a)*e.speed*dt;e.y+=Math.sin(a)*e.speed*dt;
    e.x=clamp(e.x,e.size,CFG.ARENA-e.size);e.y=clamp(e.y,e.size,CFG.ARENA-e.size);
    e.hitFlash=Math.max(0,e.hitFlash-dt);
    updateBossAbility(e,dt);

    if(e.type==='spitter'&&dst(e,player)<300){
      if(!e.shotTimer)e.shotTimer=rnd(1.5,2.5);
      e.shotTimer-=dt;
      if(e.shotTimer<=0){e.shotTimer=rnd(1.8,3);const sa=ang(e,player);
        projectiles.push({x:e.x,y:e.y,vx:Math.cos(sa)*200,vy:Math.sin(sa)*200,
          dmg:e.dmg*.5,size:4,col:'#ff66ff',life:2,pierce:0,hits:[],isEnemy:true})}
    }
  }

  // Projectile-enemy collision
  for(const p of projectiles){
    if(p.isEnemy){
      if(dst(p,player)<p.size+player.size&&player.invuln<=0){hurtPlayer(p.dmg);p.life=0}
      continue;
    }
    for(const e of enemies){
      if(p.hits.includes(e))continue;
      if(dst(p,e)<p.size+e.size){
        dealDmg(e,p.dmg,p.col,p.wId);sfxHit();p.hits.push(e);
        if(p.hits.length>p.pierce){p.life=0;break}
      }
    }
  }

  // Enemy-player collision
  for(const e of enemies){
    if(dst(e,player)<e.size+player.size&&player.invuln<=0){
      hurtPlayer(e.dmg);
      const pa=ang(e,player);player.x+=Math.cos(pa)*30;player.y+=Math.sin(pa)*30;
    }
  }

  // Kill dead enemies
  for(const e of enemies){
    if(e.hp<=0){
      kills++;
      addP(e.x,e.y,e.col,10,60,200,.5);
      trySpawnChest(e.x,e.y);

      if(e.explodes){
        addP(e.x,e.y,'#ff6622',18,80,250,.5);sfxNova();
        for(const other of enemies){if(other!==e&&dst(e,other)<80)dealDmg(other,15,e.col,'exploder')}
        if(dst(e,player)<80&&player.invuln<=0)hurtPlayer(e.dmg*1.5);
      }

      if(e.isBoss){
        bossesKilled++;freezeFrames=6;camera.sx=rnd(-15,15);camera.sy=rnd(-15,15);
        addP(e.x,e.y,e.col,40,120,450,.9);screenFlash=.6;
        const gemC=12;for(let i=0;i<gemC;i++){
          gems.push({x:e.x+rnd(-30,30),y:e.y+rnd(-30,30),xp:Math.ceil(e.xp/gemC),size:6*MOB.gemScale,col:'#44ff44',life:40})}
      }else{
        const gc=e.xp>3?3:(e.xp>1?2:1);
        for(let i=0;i<gc;i++){
          gems.push({x:e.x+rnd(-12,12),y:e.y+rnd(-12,12),xp:Math.ceil(e.xp/gc),size:4*MOB.gemScale,col:'#44ff44',life:30})}
      }
      orbHits.delete(e);
    }
  }
  enemies=enemies.filter(e=>e.hp>0);

  // Gems
  for(const g of gems){
    g.life-=dt;
    const d=dst(player,g);
    if(d<player.pickupRange){
      const a=ang(g,player);const pull=CFG.GEM_PULL*(1-d/player.pickupRange);
      g.x+=Math.cos(a)*pull*dt;g.y+=Math.sin(a)*pull*dt;
    }
    if(d<player.size+g.size){
      player.xp+=Math.round(g.xp*player.xpMult);g.life=0;sfxPickup();
      addP(g.x,g.y,'#44ff44',4,30,80,.3);
      while(player.xp>=player.xpNeeded){
        player.xp-=player.xpNeeded;player.level++;player.xpNeeded=xpFor(player.level);
        pendingLvls++;sfxLvl();addP(player.x,player.y,'#00ffcc',25,80,250,.7);
        const bl=Math.floor(player.level/10)*10;
        if(bl>=10&&!bossLevels.has(bl)){bossLevels.add(bl);setTimeout(()=>spawnBoss(bl),1500)}
      }
    }
  }
  gems=gems.filter(g=>g.life>0);

  // Chests
  for(const c of chests){
    c.life-=dt;
    if(dst(player,c)<player.size+c.size+(isMobile?20:5)){collectChest(c);c.life=0}
  }
  chests=chests.filter(c=>c.life>0);

  // Level up
  if(pendingLvls>0&&state==='playing'){pendingLvls--;showLevelUp();return}

  // Particles
  for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt}
  particles=particles.filter(p=>p.life>0);
  for(const d of dmgNums){d.y-=40*dt;d.life-=dt}
  dmgNums=dmgNums.filter(d=>d.life>0);
  for(const a of lightningArcs)a.life-=dt;
  lightningArcs=lightningArcs.filter(a=>a.life>0);

  // Spawn
  spawnEnemies(dt);

  // Death
  if(player.health<=0){sfxDeath();state='gameover';endRun(false)}
}

// ──── LEVEL UP ────
function upgradeWeight(upgLevel,playerLv){
  const minLv=[0,4,10,18,28];
  const req=minLv[Math.min(upgLevel-1,minLv.length-1)];
  if(playerLv<req)return 0;
  const rarity=[1,.45,.2,.08,.03];
  return rarity[Math.min(upgLevel-1,rarity.length-1)];
}
function weightedPick(pool,count){
  const result=[];
  const remaining=[...pool];
  for(let i=0;i<count&&remaining.length;i++){
    const total=remaining.reduce((s,o)=>s+o.weight,0);
    if(total<=0)break;
    let r=Math.random()*total;
    for(let j=0;j<remaining.length;j++){
      r-=remaining[j].weight;
      if(r<=0){result.push(remaining[j]);remaining.splice(j,1);break}
    }
  }
  return result;
}
function showLevelUp(){
  state='levelup';
  const pool=[];
  for(const[id,def]of Object.entries(WEAPONS)){
    const cur=player.weapons[id]||0;
    if(!player.evolved[id]&&cur<def.levels.length){
      const w=upgradeWeight(cur+1,player.level);
      if(w>0)pool.push({type:'weapon',id,name:def.name,icon:def.icon,desc:def.desc,level:cur+1,color:def.color,weight:w});
    }
  }
  for(const[id,def]of Object.entries(PASSIVES)){
    const cur=player.passives[id]||0;
    if(cur<def.max){
      const w=upgradeWeight(cur+1,player.level);
      if(w>0)pool.push({type:'passive',id,name:def.name,icon:def.icon,desc:def.desc,level:cur+1,weight:w});
    }
  }
  const opts=weightedPick(pool,3);
  if(!opts.length){state='playing';return}
  const ctr=document.getElementById('upgrade-cards');ctr.innerHTML='';
  opts.forEach(o=>{
    const card=document.createElement('div');card.className='upgrade-card';
    const isNew=o.type==='weapon'&&o.level===1;
    card.innerHTML=`<div class="icon">${o.icon}</div><div class="card-name">${o.name}</div>
      <div class="card-level">${isNew?'✦ NEW':'Level '+o.level}</div><div class="card-desc">${o.desc}</div>`;
    card.onclick=()=>{
      applyUpgrade(o);checkEvolutions();
      document.getElementById('levelup-screen').classList.add('hidden');
      state='playing';
      if(pendingLvls>0){pendingLvls--;setTimeout(()=>{if(state==='playing')showLevelUp()},120)}
    };ctr.appendChild(card);
  });
  document.getElementById('levelup-screen').classList.remove('hidden');
}

function applyUpgrade(o){
  if(o.type==='weapon'){player.weapons[o.id]=o.level}
  else{
    player.passives[o.id]=o.level;
    switch(o.id){
      case'maxHp':player.maxHealth+=25;player.health=Math.min(player.health+25,player.maxHealth);break;
      case'speed':player.speed*=1.12;break;
      case'magnet':player.pickupRange*=1.4;break;
      case'power':player.dmgMult+=.15;break;
      case'armor':player.armor+=3;break;
      case'regen':player.regen+=1;break;
    }
  }
}

// ──── EVOLUTION ────
function checkEvolutions(){
  for(const[wId,evo]of Object.entries(EVOLUTIONS)){
    if(player.evolved[wId])continue;
    if(player.weapons[wId]===5&&player.passives[evo.passive]){
      player.evolved[wId]=true;
      screenFlash=.8;freezeFrames=8;
      addP(player.x,player.y,evo.color,40,100,400,.8);
      sfxEvo();
      showBanner('evolution-banner',3000,'⚡ '+evo.name+' ⚡');
    }
  }
}

// ──── END RUN ────
function endRun(victory){
  gamePaused=false;
  stopMusic();
  const sv=loadSave();
  const coinsEarned=kills+Math.floor(gtime/60)*5+bossesKilled*50;
  sv.coins+=coinsEarned;
  sv.totalKills+=kills;
  if(gtime>sv.maxTime)sv.maxTime=gtime;
  if(player.level>sv.maxLevel)sv.maxLevel=player.level;
  sv.leaderboard.push({name:getUsername(),time:gtime,kills,level:player.level,char:selectedChar,date:new Date().toLocaleDateString()});
  sv.leaderboard.sort((a,b)=>b.time-a.time);
  sv.leaderboard=sv.leaderboard.slice(0,10);
  saveSave(sv,{immediateCloud:true});

  const uname=getUsername();
  const onlineScore=getRunScore();
  submitOnlineScore(uname,onlineScore,Math.floor(gtime),`Lv${player.level} ${kills}kills`);

  showGameOverScreen(coinsEarned);

  fetchGlobalLB().then(()=>{
    renderGlobalLB('go-global-lb',uname);
  });
}

function showVictory(){
  state='victory';endRun(true);
}

function showVictoryScreen(coins){
  const el=document.getElementById('victory-stats');
  el.innerHTML=`
    <div class="stat-row"><span class="label">Enemies Killed</span><span class="value">${kills}</span></div>
    <div class="stat-row"><span class="label">Level Reached</span><span class="value">${player.level}</span></div>
    <div class="stat-row"><span class="label">Bosses Defeated</span><span class="value">${bossesKilled}</span></div>
    <div class="stat-row coins-row"><span class="label">Coins Earned</span><span class="value">+${coins} 💰</span></div>
  `;
  document.getElementById('victory-screen').classList.remove('hidden');
}

function showGameOverScreen(coins){
  const sv=loadSave();
  const el=document.getElementById('final-stats');
  el.innerHTML=`
    <div class="stat-row"><span class="label">Survived</span><span class="value">${fmtTime(gtime)}</span></div>
    <div class="stat-row"><span class="label">Enemies Killed</span><span class="value">${kills}</span></div>
    <div class="stat-row"><span class="label">Level</span><span class="value">${player.level}</span></div>
    <div class="stat-row"><span class="label">Bosses Defeated</span><span class="value">${bossesKilled}</span></div>
    <div class="stat-row coins-row"><span class="label">Coins Earned</span><span class="value">+${coins} 💰</span></div>
  `;

  // Damage recap
  const recEl=document.getElementById('damage-recap');
  const entries=Object.entries(damageDealt).sort((a,b)=>b[1]-a[1]);
  const maxDmg=entries.length?entries[0][1]:1;
  if(entries.length){
    let html='<div class="recap-section"><div class="recap-title">Damage Breakdown</div>';
    entries.forEach(([wId,val])=>{
      const def=WEAPONS[wId]||EVOLUTIONS[wId]||{name:wId,color:'#888'};
      const name=player.evolved[wId]?EVOLUTIONS[wId].name:def.name;
      const col=player.evolved[wId]?EVOLUTIONS[wId].color:def.color;
      const pct=Math.round(val/maxDmg*100);
      html+=`<div class="recap-bar-row"><span class="rname">${name}</span>
        <span class="rbar"><span class="rbar-fill" style="width:${pct}%;background:${col}"></span></span>
        <span class="rval">${Math.round(val)}</span></div>`;
    });
    html+='</div>';recEl.innerHTML=html;
  }else recEl.innerHTML='';

  // Leaderboard
  const lbEl=document.getElementById('run-leaderboard');
  const lb=sv.leaderboard;
  if(lb.length){
    let html='<div class="recap-section"><div class="recap-title">Top Runs</div>';
    html+='<div class="lb-row lb-header"><span class="lb-rank">#</span><span class="lb-name">Player</span><span class="lb-time">Time</span><span class="lb-kills">Kills</span><span class="lb-lv">Lv</span><span class="lb-char">Char</span></div>';
    lb.forEach((r,i)=>{
      const isNew=Math.abs(r.time-gtime)<.5&&r.kills===kills;
      const ch=CHARACTERS[r.char];
      const pName=r.name||'Player';
      html+=`<div class="lb-row ${isNew?'lb-new':''}"><span class="lb-rank">${i+1}</span><span class="lb-name">${pName}</span><span class="lb-time">${fmtTime(r.time)}</span><span class="lb-kills">${r.kills}</span><span class="lb-lv">${r.level}</span><span class="lb-char">${ch?ch.icon:''}</span></div>`;
    });
    html+='</div>';lbEl.innerHTML=html;
  }else lbEl.innerHTML='';

  document.getElementById('gameover-screen').classList.remove('hidden');
}

// ──── UI SCREENS ────
function showBanner(id,dur,text){
  const el=document.getElementById(id);
  if(!el)return;
  if(text)el.textContent=text;
  el.classList.remove('hidden');
  setTimeout(()=>el.classList.add('hidden'),dur);
}

function showTitle(){
  try{
    hideAll();
    const coinsEl=document.getElementById('title-coins')?.querySelector('span');
    if(coinsEl)coinsEl.textContent=getCoins();
    const nameInput=document.getElementById('username-input');
    if(nameInput)nameInput.value=getUsername()==='Player'?'':getUsername();
  }catch(e){
    console.error('showTitle:',e);
  }finally{
    document.getElementById('title-screen')?.classList.remove('hidden');
  }
}

function showCharSelect(){
  hideAll();
  const ctr=document.getElementById('char-cards');ctr.innerHTML='';
  for(const[id,ch]of Object.entries(CHARACTERS)){
    const unlocked=isCharUnlocked(id);
    const card=document.createElement('div');
    card.className='char-card'+(unlocked?'':' locked');
    card.innerHTML=`<div class="icon">${ch.icon}</div><div class="card-name">${ch.name}</div>
      <div class="card-desc">${ch.desc}</div>
      <div class="card-stats">Starts with: ${WEAPONS[ch.weapon].name}</div>
      ${unlocked?'':'<div class="lock-text">🔒 '+ch.unlock.text+'</div>'}`;
    if(unlocked)card.onclick=()=>startGame(id);
    ctr.appendChild(card);
  }
  document.getElementById('char-screen').classList.remove('hidden');
}

function showShop(){
  hideAll();
  const sv=loadSave();
  document.getElementById('shop-coins').querySelector('span').textContent=sv.coins;
  const ctr=document.getElementById('shop-items');ctr.innerHTML='';
  for(const[id,def]of Object.entries(META)){
    const cur=sv.meta[id]||0;const maxed=cur>=def.max;
    const cost=maxed?'MAX':def.costs[cur];
    const canBuy=!maxed&&sv.coins>=cost;
    const item=document.createElement('div');item.className='shop-item';
    let pips='';for(let i=0;i<def.max;i++)pips+=`<span class="pip${i<cur?' filled':''}"></span>`;
    item.innerHTML=`<span class="si-icon">${def.icon}</span>
      <div class="si-info"><div class="si-name">${def.name}</div><div class="si-desc">${def.desc}</div><div class="si-pips">${pips}</div></div>
      <button class="buy-btn" ${canBuy?'':'disabled'}>${maxed?'MAX':'💰 '+cost}</button>`;
    if(canBuy){
      item.querySelector('.buy-btn').onclick=()=>{
        const s2=loadSave();if(s2.coins<def.costs[s2.meta[id]||0])return;
        s2.coins-=def.costs[s2.meta[id]||0];s2.meta[id]=(s2.meta[id]||0)+1;saveSave(s2,{immediateCloud:true});showShop();
      };
    }
    ctr.appendChild(item);
  }
  document.getElementById('shop-screen').classList.remove('hidden');
}

function hideAll(){
  ['title-screen','char-screen','shop-screen','levelup-screen','gameover-screen','victory-screen','lb-screen','pause-screen'].forEach(id=>{
    document.getElementById(id)?.classList.add('hidden');
  });
}

function syncPauseUi(){
  const btn=document.getElementById('pause-toggle');
  const overlay=document.getElementById('pause-screen');
  if(!btn||!overlay)return;
  if(state==='levelup')gamePaused=false;
  if(state==='playing'){
    btn.classList.remove('hidden');
    if(gamePaused)overlay.classList.remove('hidden');
    else overlay.classList.add('hidden');
  }else{
    btn.classList.add('hidden');
    overlay.classList.add('hidden');
  }
}

function toggleGamePause(){
  if(state!=='playing')return;
  gamePaused=!gamePaused;
  if(gamePaused){
    for(const k of Object.keys(input.keys))input.keys[k]=false;
    input.touch=null;
  }
  syncPauseUi();
}
function showGlobalLBScreen(){
  hideAll();
  globalLBFetched=false;
  const el=document.getElementById('global-lb-list');
  el.innerHTML='<div class="lb-loading">Loading global leaderboard...</div>';
  document.getElementById('lb-screen').classList.remove('hidden');
  fetchGlobalLB().then(()=>renderGlobalLB('global-lb-list',getUsername()));
}

function startGame(charId){
  const nameVal=document.getElementById('username-input').value;
  setUsername(nameVal||'Player');
  hideAll();initAudio();initGame(charId);gamePaused=false;state='playing';lastTs=0;startMusic();syncPauseUi();
}

// ──── RENDER ────
function render(){
  ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#080818';ctx.fillRect(0,0,W,H);
  const ox=-camera.x+W/2+camera.sx,oy=-camera.y+H/2+camera.sy;
  ctx.translate(ox,oy);

  // Grid
  ctx.strokeStyle='rgba(255,255,255,.03)';ctx.lineWidth=1;
  const gs=80,sx=Math.floor((camera.x-W/2)/gs)*gs,sy=Math.floor((camera.y-H/2)/gs)*gs;
  for(let x=sx;x<camera.x+W/2+gs;x+=gs){ctx.beginPath();ctx.moveTo(x,sy);ctx.lineTo(x,sy+H+gs*2);ctx.stroke()}
  for(let y=sy;y<camera.y+H/2+gs;y+=gs){ctx.beginPath();ctx.moveTo(sx,y);ctx.lineTo(sx+W+gs*2,y);ctx.stroke()}

  // Arena border
  ctx.strokeStyle='rgba(0,255,204,.12)';ctx.lineWidth=2;ctx.strokeRect(0,0,CFG.ARENA,CFG.ARENA);

  // Ground zones
  for(const z of groundZones){
    const alpha=clamp(z.life/z.maxLife,.2,1)*.3;
    ctx.fillStyle=z.col;ctx.globalAlpha=alpha;
    ctx.beginPath();ctx.arc(z.x,z.y,z.rad,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
  }

  // Gems
  ctx.shadowColor='#44ff44';ctx.shadowBlur=8;
  for(const g of gems){ctx.fillStyle=g.col;ctx.beginPath();ctx.arc(g.x,g.y,g.size,0,Math.PI*2);ctx.fill()}
  ctx.shadowBlur=0;

  // Chests
  for(const c of chests){
    ctx.fillStyle=c.col;ctx.shadowColor=c.col;ctx.shadowBlur=12;
    ctx.fillRect(c.x-c.size,c.y-c.size*.7,c.size*2,c.size*1.4);
    ctx.shadowBlur=0;ctx.strokeStyle='#aa8800';ctx.lineWidth=1;ctx.strokeRect(c.x-c.size,c.y-c.size*.7,c.size*2,c.size*1.4);
  }

  // Enemies
  for(const e of enemies){
    if(e.shieldHp&&e.shieldHp>0){
      ctx.strokeStyle='rgba(100,136,255,.5)';ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(e.x,e.y,e.size+5,0,Math.PI*2);ctx.stroke();
    }
    ctx.fillStyle=e.hitFlash>0?'#fff':e.col;ctx.shadowColor=e.col;ctx.shadowBlur=e.hitFlash>0?15:6;
    ctx.beginPath();ctx.arc(e.x,e.y,e.size,0,Math.PI*2);ctx.fill();
    if(e.isBoss){
      ctx.strokeStyle=e.col;ctx.lineWidth=2;ctx.stroke();
      ctx.shadowBlur=0;
      const bw=60,bh=5;
      ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(e.x-bw/2,e.y-e.size-14,bw,bh);
      ctx.fillStyle=e.col;ctx.fillRect(e.x-bw/2,e.y-e.size-14,bw*clamp(e.hp/e.maxHp,0,1),bh);
      ctx.font='bold 9px system-ui';ctx.textAlign='center';ctx.fillStyle='#fff';
      ctx.fillText(e.bossName||'BOSS',e.x,e.y-e.size-18);
    }
    if(e.explodes){ctx.strokeStyle='rgba(255,102,34,.4)';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(e.x,e.y,e.size+3+Math.sin(gtime*8)*2,0,Math.PI*2);ctx.stroke()}
  }
  ctx.shadowBlur=0;

  // Projectiles
  for(const p of projectiles){
    ctx.fillStyle=p.col;ctx.shadowColor=p.col;ctx.shadowBlur=10;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
    if(p.isBoomerang){ctx.strokeStyle=p.col;ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(p.x,p.y,p.size+2,0,Math.PI*1.3);ctx.stroke()}
  }
  ctx.shadowBlur=0;

  // Flame aura visual
  if(player.weapons.flame){
    const fs=wStat('flame');if(fs){
      const fc=player.evolved.flame?EVOLUTIONS.flame.color:WEAPONS.flame.color;
      ctx.strokeStyle=fc;ctx.globalAlpha=.15+Math.sin(gtime*6)*.05;ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(player.x,player.y,fs.rad,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
  }

  // Player
  const pA=player.invuln>0?(Math.sin(gtime*30)>.5?1:.3):1;
  ctx.globalAlpha=pA;

  // Evolved aura
  const evoCount=Object.keys(player.evolved).length;
  if(evoCount>0){
    ctx.strokeStyle=player.charColor;ctx.globalAlpha=pA*(.15+Math.sin(gtime*3)*.05);
    ctx.lineWidth=2;ctx.beginPath();ctx.arc(player.x,player.y,player.size+10+evoCount*3,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=pA;
  }

  ctx.fillStyle=player.charColor;ctx.shadowColor=player.charColor;ctx.shadowBlur=18;
  ctx.beginPath();ctx.arc(player.x,player.y,player.size,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff';ctx.shadowBlur=0;
  const ex=player.x+Math.cos(player.facing)*player.size*.5,ey=player.y+Math.sin(player.facing)*player.size*.5;
  ctx.beginPath();ctx.arc(ex,ey,3,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=1;ctx.shadowBlur=0;

  // Orbitals
  if(player.weapons.orbital){
    const os=wStat('orbital');if(os){
      const oc=player.evolved.orbital?EVOLUTIONS.orbital.color:WEAPONS.orbital.color;
      ctx.fillStyle=oc;ctx.shadowColor=oc;ctx.shadowBlur=12;
      for(let i=0;i<os.count;i++){const a=orbAngle+(Math.PI*2/os.count)*i;
        ctx.beginPath();ctx.arc(player.x+Math.cos(a)*os.rad,player.y+Math.sin(a)*os.rad,os.sz,0,Math.PI*2);ctx.fill()}
      ctx.shadowBlur=0}
  }

  // Lightning arcs
  for(const arc of lightningArcs){
    const al=arc.life/arc.maxLife;ctx.strokeStyle=arc.col;ctx.lineWidth=3*al;
    ctx.shadowColor=arc.col;ctx.shadowBlur=15*al;ctx.globalAlpha=al;
    ctx.beginPath();
    for(let i=0;i<arc.pts.length;i++){const p=arc.pts[i];
      if(i===0)ctx.moveTo(p.x,p.y);
      else{const mx=(arc.pts[i-1].x+p.x)/2+rnd(-8,8),my=(arc.pts[i-1].y+p.y)/2+rnd(-8,8);ctx.lineTo(mx,my);ctx.lineTo(p.x,p.y)}}
    ctx.stroke();ctx.globalAlpha=1;ctx.shadowBlur=0;
  }

  // Particles
  for(const p of particles){const al=p.life/p.maxLife;ctx.globalAlpha=al;ctx.fillStyle=p.col;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size*al,0,Math.PI*2);ctx.fill()}
  ctx.globalAlpha=1;

  // Damage numbers
  for(const d of dmgNums){const al=d.life/d.maxLife;ctx.globalAlpha=al;
    ctx.font=`bold ${14+(1-al)*6}px system-ui`;ctx.fillStyle=d.col;ctx.textAlign='center';
    ctx.fillText(d.val,d.x,d.y)}
  ctx.globalAlpha=1;ctx.restore();

  // ── HUD ──
  ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);

  const ms=isMobile?1.4:1;
  const barR=6,rGap=Math.round(8*ms);
  const hbH=Math.round((isMobile?15:24)*ms);
  const hbW=Math.min((isMobile?240:400)*ms,W*(isMobile?0.44:0.55));
  let hbX, hbY;
  if(isMobile){
    hbX=12;hbY=8;
  }else{
    hbX=(W-hbW)/2;
    const weaponWy=H-Math.round(40*ms);
    const clearance=Math.round(22*ms);
    hbY=weaponWy-clearance-(hbH*2+rGap);
  }
  const drawBarBack=(x,y,w,h)=>{ctx.fillStyle='rgba(0,0,0,.55)';rr(ctx,x-2,y-2,w+4,h+4,barR+2);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=2;rr(ctx,x-2,y-2,w+4,h+4,barR+2);ctx.stroke()};
  drawBarBack(hbX,hbY,hbW,hbH);
  ctx.fillStyle='rgba(255,0,0,.22)';rr(ctx,hbX,hbY,hbW,hbH,barR);ctx.fill();
  const hpP=clamp(player.health/player.maxHealth,0,1);
  ctx.fillStyle=hpP>.3?'#2ee86a':'#ff4444';rr(ctx,hbX,hbY,hbW*hpP,hbH,barR);ctx.fill();
  ctx.font=`bold ${Math.round((isMobile?11:15)*ms)}px system-ui`;ctx.fillStyle='#fff';ctx.textAlign='center';
  ctx.shadowColor='#000';ctx.shadowBlur=4;ctx.fillText(`${Math.ceil(player.health)} / ${Math.round(player.maxHealth)}`,hbX+hbW/2,hbY+hbH-Math.round(5*ms));ctx.shadowBlur=0;

  const xbY=hbY+hbH+rGap;
  drawBarBack(hbX,xbY,hbW,hbH);
  ctx.fillStyle='rgba(30,80,200,.28)';rr(ctx,hbX,xbY,hbW,hbH,barR);ctx.fill();
  const xpP=player.xpNeeded>0?clamp(player.xp/player.xpNeeded,0,1):0;
  ctx.fillStyle='#4da3ff';rr(ctx,hbX,xbY,hbW*xpP,hbH,barR);ctx.fill();
  ctx.fillStyle='#fff';ctx.shadowColor='#000';ctx.shadowBlur=4;
  ctx.fillText(`Lv.${player.level}  ${player.xp}/${player.xpNeeded} XP`,hbX+hbW/2,xbY+hbH-Math.round(5*ms));ctx.shadowBlur=0;

  const scoreY=xbY+hbH+Math.round(16*ms);
  ctx.font=`bold ${Math.round((isMobile?12:14)*ms)}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#ffcc00';
  ctx.shadowColor='#000';ctx.shadowBlur=3;
  ctx.fillText(`Score ${getRunScore()}`,hbX+hbW/2,scoreY);ctx.shadowBlur=0;

  ctx.font=`bold ${Math.round(18*ms)}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#fff';
  ctx.fillText(fmtTime(gtime),W/2,Math.round(28*ms));
  ctx.font=`${Math.round(13*ms)}px system-ui`;ctx.fillStyle='rgba(255,255,255,.5)';ctx.fillText(`${kills} kills`,W/2,Math.round(48*ms));
  ctx.font=`bold ${Math.round(11*ms)}px system-ui`;ctx.fillStyle='rgba(0,255,204,.5)';ctx.textAlign='right';
  ctx.fillText(getUsername(),W-15,Math.round(22*ms));

  // Weapon bar
  const wKeys=Object.keys(player.weapons);
  const wSz=Math.round(32*ms),wGap=Math.round(42*ms);
  wKeys.forEach((wk,i)=>{
    const def=WEAPONS[wk];if(!def)return;
    const wx=Math.round(30*ms)+i*wGap,wy=H-Math.round(40*ms);
    const half=wSz/2;
    ctx.fillStyle=player.evolved[wk]?'rgba(255,204,0,.15)':'rgba(255,255,255,.08)';
    rr(ctx,wx-half,wy-half,wSz,wSz,6);ctx.fill();
    if(player.evolved[wk]){ctx.strokeStyle='rgba(255,204,0,.4)';ctx.lineWidth=1;rr(ctx,wx-half,wy-half,wSz,wSz,6);ctx.stroke()}
    ctx.font=`${Math.round(18*ms)}px system-ui`;ctx.textAlign='center';ctx.fillText(def.icon,wx,wy+Math.round(6*ms));
    ctx.font=`bold ${Math.round(9*ms)}px system-ui`;ctx.fillStyle=player.evolved[wk]?'#ffcc00':'#00ffcc';
    ctx.fillText(player.evolved[wk]?'EVO':player.weapons[wk],wx,wy+Math.round(18*ms));
  });

  // Minimap
  const msz=Math.min(110,W*.15),mpad=10,mx=W-msz-mpad,my=H-msz-mpad,mscale=msz/CFG.ARENA;
  ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(mx,my,msz,msz);
  ctx.strokeStyle='rgba(255,255,255,.15)';ctx.lineWidth=1;ctx.strokeRect(mx,my,msz,msz);
  ctx.fillStyle='rgba(255,50,50,.5)';
  for(const e of enemies){if(!e.isBoss)ctx.fillRect(mx+e.x*mscale-1,my+e.y*mscale-1,2,2)}
  ctx.fillStyle='#ff0066';
  for(const e of enemies){if(e.isBoss)ctx.fillRect(mx+e.x*mscale-2,my+e.y*mscale-2,4,4)}
  ctx.fillStyle='#00ffcc';ctx.fillRect(mx+player.x*mscale-2,my+player.y*mscale-2,4,4);

  // Touch joystick
  if(input.touch){
    const jr=MOB.joystickSize,jk=MOB.joystickKnob,jm=jr*.75;
    ctx.strokeStyle='rgba(255,255,255,.2)';ctx.lineWidth=isMobile?3:2;
    ctx.beginPath();ctx.arc(input.touch.sx,input.touch.sy,jr,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.06)';ctx.fill();
    const jdx=clamp(input.touch.cx-input.touch.sx,-jm,jm),jdy=clamp(input.touch.cy-input.touch.sy,-jm,jm);
    ctx.fillStyle='rgba(255,255,255,.25)';ctx.beginPath();ctx.arc(input.touch.sx+jdx,input.touch.sy+jdy,jk,0,Math.PI*2);ctx.fill();
  }

  // Screen flash
  if(screenFlash>0){ctx.fillStyle=`rgba(255,255,255,${screenFlash*.5})`;ctx.fillRect(0,0,W,H)}

  ctx.restore();
}

function rr(ctx,x,y,w,h,r){if(w<0)w=0;ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath()}

// ──── MAIN LOOP ────
function gameLoop(ts){
  requestAnimationFrame(gameLoop);
  const now=ts/1000;if(lastTs===0){lastTs=now;return}
  const dt=Math.min(now-lastTs,.1);lastTs=now;
  if(state==='playing'&&!gamePaused)update(dt);
  syncPauseUi();
  if(state!=='title'&&state!=='charselect'&&state!=='shop')render();
}

// ──── RESIZE ────
function resize(){
  dpr=window.devicePixelRatio||1;W=window.innerWidth;H=window.innerHeight;
  canvas.width=W*dpr;canvas.height=H*dpr;canvas.style.width=W+'px';canvas.style.height=H+'px';
}

// ──── BOOT ────
window.addEventListener('load',()=>{
  try{
    canvas=document.getElementById('game-canvas');
    ctx=canvas&&canvas.getContext('2d');
    if(ctx){
      resize();window.addEventListener('resize',resize);setupInput();
      initCloudSaveSync();
    }else{
      console.error('Canvas 2D not available');
    }
    showTitle();
  }catch(e){
    console.error('Game boot failed:',e);
    document.getElementById('title-screen')?.classList.remove('hidden');
  }

  document.getElementById('play-btn').onclick=()=>showCharSelect();
  document.getElementById('shop-btn').onclick=()=>showShop();
  document.getElementById('lb-btn').onclick=()=>showGlobalLBScreen();
  document.getElementById('back-char-btn').onclick=()=>showTitle();
  document.getElementById('back-shop-btn').onclick=()=>showTitle();
  document.getElementById('back-lb-btn').onclick=()=>showTitle();
  document.getElementById('restart-btn').onclick=()=>showTitle();
  document.getElementById('victory-btn').onclick=()=>showTitle();

  document.getElementById('pause-toggle').onclick=()=>toggleGamePause();
  document.getElementById('resume-btn').onclick=()=>{if(gamePaused)toggleGamePause()};

  if(ctx)requestAnimationFrame(gameLoop);
});
