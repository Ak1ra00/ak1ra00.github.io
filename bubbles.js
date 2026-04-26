
'use strict';

// Bitcoin Bubble Burst – self-contained game script
// Reuses Atlas Arcade audio + UI patterns but is independent from other games.

// ── AUDIO ───────────────────────────────────────────────────────────────
let audioCtx = null, soundEnabled = true;

function toggleSound(){
  soundEnabled = !soundEnabled;
  const btn = document.getElementById('sndBtn');
  if(!btn) return;
  btn.textContent = soundEnabled ? '🔊 SFX' : '🔇 SFX';
  btn.className = 'snd-btn' + (soundEnabled ? '' : ' off');
  btn.setAttribute('aria-pressed', soundEnabled ? 'true' : 'false');
}

function getAudio(){
  if(!soundEnabled) return null;
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }catch(e){ return null; }
}

function playNote(freq,type='sine',dur=0.12,vol=0.25,t0=0){
  const a=getAudio(); if(!a) return;
  try{
    const osc=a.createOscillator();
    const g=a.createGain();
    osc.connect(g);g.connect(a.destination);
    osc.type=type;
    osc.frequency.setValueAtTime(freq,a.currentTime+t0);
    g.gain.setValueAtTime(vol,a.currentTime+t0);
    g.gain.exponentialRampToValueAtTime(0.0001,a.currentTime+t0+dur);
    osc.start(a.currentTime+t0);
    osc.stop(a.currentTime+t0+dur+0.05);
  }catch(ex){}
}

const SFX = {
  fire(){ playNote(880,'square',0.08,0.2); },
  pop(){ [880,1180,1460].forEach((f,i)=>playNote(f,'sine',0.1,0.24,i*0.04)); },
  drop(){ [260,200,150].forEach((f,i)=>playNote(f,'sawtooth',0.16,0.32,i*0.06)); },
  level(){ [660,830,1040,1320].forEach((f,i)=>playNote(f,'sine',0.14,0.3,i*0.09)); },
  rage(){ playNote(180,'sawtooth',0.2,0.5); playNote(140,'square',0.22,0.4,0.08); },
  gameOver(){ [420,330,260,210].forEach((f,i)=>playNote(f,'sawtooth',0.16,0.4,i*0.11)); },
};

// ── CANVAS & BACKGROUND ────────────────────────────────────────────────
const gc = document.getElementById('gc');
const ctx = gc.getContext('2d');
const bg = document.getElementById('bgCanvas');
const bgx = bg.getContext('2d');
let bgW=0, bgH=0;

let bgLayers=[], bgSymbols=[], bgHexCanvas=null;

function buildHexCanvas(){
  bgHexCanvas = document.createElement('canvas');
  bgHexCanvas.width = bgW; bgHexCanvas.height = bgH;
  const hx = bgHexCanvas.getContext('2d');
  hx.strokeStyle='rgba(247,147,26,0.055)'; hx.lineWidth=1;
  const s=38, hw=s*Math.sqrt(3), hh=s*1.5;
  for(let row=-1; row*hh<bgH+s; row++){
    for(let col=-1; col*hw<bgW+s; col++){
      const cx=col*hw+(row%2?hw/2:0), cy=row*hh;
      hx.beginPath();
      for(let i=0;i<6;i++){
        const a=Math.PI/3*i+Math.PI/6;
        const px=cx+Math.cos(a)*s, py=cy+Math.sin(a)*s;
        if(i===0) hx.moveTo(px,py); else hx.lineTo(px,py);
      }
      hx.closePath(); hx.stroke();
    }
  }
}

(function initBg(){
  function reset(){
    bgW=bg.width=innerWidth; bgH=bg.height=innerHeight;
    bgLayers=[];
    const specs=[
      {n:40, speed:0.35, sm:0.7, am:0.55},
      {n:25, speed:0.7,  sm:1.0, am:1.0 },
      {n:15, speed:1.2,  sm:1.5, am:1.4 },
    ];
    specs.forEach(ls=>{
      const pts=[];
      for(let i=0;i<ls.n;i++) pts.push({
        x:Math.random()*bgW, y:Math.random()*bgH,
        vx:(Math.random()-.5)*.28, vy:(Math.random()-.5)*.28,
        r:(.8+Math.random()*1.8)*ls.sm, a:(.08+Math.random()*.35)*ls.am,
        c:Math.random()>.55?'#F7931A':(Math.random()>.5?'#627EEA':'#00AAE4')
      });
      bgLayers.push({pts, speed:ls.speed});
    });
    bgSymbols=[];
    for(let i=0;i<8;i++) bgSymbols.push({
      x:Math.random()*bgW, y:Math.random()*bgH,
      vy:-0.15-Math.random()*0.25, size:14+Math.random()*32,
      a:0.04+Math.random()*0.07, phase:Math.random()*Math.PI*2
    });
    buildHexCanvas();
  }
  reset();
  addEventListener('resize',reset);
})();

function drawBg(rage,hodlRatio){
  bgx.clearRect(0,0,bgW,bgH);

  // hex grid — slow drift
  if(bgHexCanvas){
    const drift=(now*0.004)%76;
    bgx.save(); bgx.globalAlpha=0.55+hodlRatio*0.3;
    bgx.drawImage(bgHexCanvas,-drift,-drift); bgx.restore();
  }

  // ambient gradient
  const a=.04+hodlRatio*.12;
  const g=bgx.createRadialGradient(bgW/2,bgH*0.2,0,bgW/2,bgH*0.8,bgW*.9);
  if(rage){
    g.addColorStop(0,`rgba(255,51,85,${a*2.6})`);
    g.addColorStop(.5,`rgba(80,0,15,${a*1.4})`);
    g.addColorStop(1,'transparent');
  }else{
    g.addColorStop(0,`rgba(247,147,26,${a})`);
    g.addColorStop(.6,`rgba(12,12,40,${a*.6})`);
    g.addColorStop(1,'transparent');
  }
  bgx.fillStyle=g; bgx.fillRect(0,0,bgW,bgH);

  // floating ₿ glyphs
  bgx.save();
  bgx.textAlign='center'; bgx.textBaseline='middle';
  bgSymbols.forEach(s=>{
    s.y+=s.vy*(rage?2.2:1);
    if(s.y<-60){ s.y=bgH+60; s.x=Math.random()*bgW; }
    const sw=Math.sin(now*0.0007+s.phase)*22;
    bgx.globalAlpha=s.a*(rage?1.7:1);
    bgx.fillStyle=rage?'#ff3355':'#F7931A';
    bgx.shadowColor=bgx.fillStyle; bgx.shadowBlur=14;
    bgx.font=`900 ${Math.floor(s.size)}px Orbitron,monospace`;
    bgx.fillText('₿',s.x+sw,s.y);
  });
  bgx.restore();

  // parallax particle layers
  bgLayers.forEach(layer=>{
    const spd=layer.speed*(rage?2.0:1.0);
    layer.pts.forEach(p=>{
      p.x=(p.x+p.vx*spd+bgW)%bgW;
      p.y=(p.y+p.vy*spd+bgH)%bgH;
      bgx.save();
      bgx.globalAlpha=p.a*(rage?1.7:1);
      bgx.fillStyle=rage?'#ff3355':p.c;
      bgx.shadowColor=bgx.fillStyle; bgx.shadowBlur=rage?14:7;
      bgx.beginPath(); bgx.arc(p.x,p.y,p.r*(1+hodlRatio*.5),0,Math.PI*2); bgx.fill();
      bgx.restore();
    });
  });

  // rage vignette pulse
  if(rage){
    const vp=0.32+0.24*Math.sin(now*0.012);
    const v=bgx.createRadialGradient(bgW/2,bgH/2,bgW*0.28,bgW/2,bgH/2,bgW*0.72);
    v.addColorStop(0,'transparent');
    v.addColorStop(1,`rgba(255,51,85,${vp})`);
    bgx.fillStyle=v; bgx.fillRect(0,0,bgW,bgH);
  }
}

// ── UTILS ───────────────────────────────────────────────────────────────
function clamp(v,min,max){ return v<min?min:v>max?max:v; }
function randChoice(a){ return a[Math.floor(Math.random()*a.length)]; }

// grid config: hex-ish packed rows
const BUBBLE_R = 18;
const COLS = 15;
const ROW_H = BUBBLE_R*1.732; // sqrt(3)
const TOP_MARGIN = 60;
const LAUNCH_Y = 860;
const CELL_W = (800 - 2*BUBBLE_R) / COLS;

const COLORS = [
  { id:'btc', col:'#F7931A'},
  { id:'eth', col:'#627EEA'},
  { id:'xrp', col:'#00AAE4'},
  { id:'doge',col:'#C2A633'},
  { id:'pepe',col:'#00BB44'},
];

const POWER_TYPES = {
  laser:  {icon:'🎯', label:'LASER',  dur:1},
  magnet: {icon:'🧲', label:'MAGNET', dur:6},
  bomb:   {icon:'💣', label:'BLOCK BOMB', dur:1},
};

// state
let grid = []; // array of bubbles
let shooter = { x: gc.width/2, angle: -Math.PI/2 };
let currentBubble = null;
let nextBubble = null;
let moving = false;
let shotDir = {x:0,y:0};
let score = 0;
let combo = 1;
let level = 1;
let floorRows = 0;
let baseColors = 3;
let remainingShots = 0;
let hodl = 0; // rage meter style
let hodlTarget = 10;
let activePower = null;
let highScore = 0;
let bestRuns = [];
let paused = false;
let lastTs = 0;
let screenShake = 0;
let now = 0;
let shooterRecoil = 0;
let muzzleFlash = 0;

// ── PARTICLE SYSTEM ─────────────────────────────────────────────────────
const PARTICLE_CAP = 280;
const particles = [];

function emitParticle(p){ if(particles.length>=PARTICLE_CAP) particles.shift(); particles.push(p); }

function emitBurst(x,y,color,count=14){
  for(let i=0;i<count;i++){
    const a=Math.random()*Math.PI*2;
    const sp=2+Math.random()*4.5;
    emitParticle({type:'spark',x,y,
      vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-1.2,
      g:0.18, r:1.5+Math.random()*2.5,
      life:0, maxLife:380+Math.random()*260,
      color, rot:Math.random()*Math.PI, spin:(Math.random()-.5)*0.4});
  }
  emitParticle({type:'ring',x,y,r:6,maxR:BUBBLE_R*2.8,life:0,maxLife:300,color});
}

function emitPoof(x,y){
  for(let i=0;i<6;i++){
    const a=-Math.PI+Math.random()*Math.PI;
    const sp=0.5+Math.random()*1.4;
    emitParticle({type:'dust',x,y,
      vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
      g:0.03, r:2+Math.random()*1.5,
      life:0, maxLife:300+Math.random()*120,
      color:'rgba(255,255,255,0.65)'});
  }
}

function emitScorePopup(x,y,text,color='#FFD700'){
  emitParticle({type:'text',x,y,vx:0,vy:-1.5,g:0.02,
    life:0,maxLife:950,text,color,size:20});
}

function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.life+=dt;
    if(p.life>=p.maxLife){ particles.splice(i,1); continue; }
    if(p.type==='ring') continue;
    p.x+=p.vx*(dt/16); p.y+=p.vy*(dt/16);
    p.vy+=(p.g||0)*(dt/16);
    p.vx*=0.994;
    if(p.rot!==undefined) p.rot+=p.spin*(dt/16);
  }
}

function drawParticles(){
  ctx.save();
  for(const p of particles){
    const t=p.life/p.maxLife;
    const alpha=1-t;
    if(p.type==='spark'){
      const ang=Math.atan2(p.vy,p.vx);
      ctx.save();
      ctx.globalAlpha=alpha;
      ctx.fillStyle=p.color;
      ctx.shadowColor=p.color; ctx.shadowBlur=8;
      ctx.translate(p.x,p.y); ctx.rotate(ang);
      ctx.beginPath(); ctx.ellipse(0,0,p.r*1.7,p.r*0.65,0,0,Math.PI*2);
      ctx.fill();
      ctx.restore();
    }else if(p.type==='dust'){
      ctx.save();
      ctx.globalAlpha=alpha*0.7;
      ctx.fillStyle=p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r*(1+t*0.7),0,Math.PI*2); ctx.fill();
      ctx.restore();
    }else if(p.type==='ring'){
      const radius=p.r+(p.maxR-p.r)*t;
      ctx.save();
      ctx.globalAlpha=(1-t)*0.55;
      ctx.strokeStyle=p.color; ctx.lineWidth=2*(1-t)+0.5;
      ctx.shadowColor=p.color; ctx.shadowBlur=14;
      ctx.beginPath(); ctx.arc(p.x,p.y,radius,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    }else if(p.type==='text'){
      ctx.save();
      ctx.globalAlpha=alpha;
      ctx.font=`900 ${p.size}px Orbitron,monospace`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle='rgba(0,0,0,0.45)';
      ctx.fillText(p.text,p.x+1,p.y+2);
      ctx.fillStyle=p.color;
      ctx.shadowColor=p.color; ctx.shadowBlur=12;
      ctx.fillText(p.text,p.x,p.y);
      ctx.restore();
    }
  }
  ctx.shadowBlur=0;
  ctx.restore();
}

// HUD elements
const hScore = document.getElementById('hScore');
const hCombo = document.getElementById('hCombo');
const hShots = document.getElementById('hShots');
const hRows  = document.getElementById('hRows');
const hHi    = document.getElementById('hHi');
const hLevel = document.getElementById('hLevel');
const rageVal = document.getElementById('rageVal');
const rageFill = document.getElementById('sbarFill');
const puBadges = document.getElementById('puBadges');
const statusEl = document.getElementById('gstat');
const introEl = document.getElementById('intro');
const lvlBanner = document.getElementById('lvlBanner');
const lvlNum = document.getElementById('lvlNum');
const lvlSub = document.getElementById('lvlSub');
const goPanel = document.getElementById('gop');
const goFinal = document.getElementById('gofinal');
const hsBody = document.getElementById('hsbody');
const pauseOverlay = document.getElementById('pauseOverlay');
const rageRing = document.getElementById('rageRing');
const hitFlash = document.getElementById('hitFlash');

// hi-score via Auth (if available)
try{
  if(window.Auth){
    highScore = Auth.getScore('btc_bubbles_hs')||0;
  }
}catch(e){ highScore = 0; }

hHi.textContent = highScore.toLocaleString();
const introHi = document.getElementById('introHi');
if(introHi) introHi.textContent = 'Best: '+highScore.toLocaleString();

// ── BUBBLE HELPERS ─────────────────────────────────────────────────────-
function gridX(col,row){
  const offset = (row%2)*BUBBLE_R;
  const cellW = (gc.width - 2*BUBBLE_R) / COLS;
  return BUBBLE_R + col*cellW + offset;
}

function gridY(row){
  return TOP_MARGIN + row*(BUBBLE_R*1.6);
}

function spawnRow(numCols){
  const row = floorRows;
  for(let c=0;c<numCols;c++){
    const colorPool = COLORS.slice(0, baseColors);
    const cc = randChoice(colorPool);
    grid.push({
      col:c,
      row:row,
      x:gridX(c,row),
      y:gridY(row),
      color:cc.col,
      id:cc.id,
      marked:false,
      phase:Math.random()*Math.PI*2,
      placedAt:0
    });
  }
  floorRows++;
}

function buildLevel(){
  grid = [];
  floorRows = 0;
  const rows = 4 + Math.min(4, level-1);
  baseColors = 3 + Math.floor((level-1)/2);
  baseColors = clamp(baseColors,3,COLORS.length);
  for(let r=0;r<rows;r++){
    spawnRow(COLS);
  }
  remainingShots = 24;
  combo = 1;
  hodl = 0;
  activePower = null;
  updateHUD();
}

function randomBubbleColor(){
  const colorPool = COLORS.slice(0, baseColors);
  const cc = randChoice(colorPool);
  return cc;
}

function prepareNextBubble(){
  if(!currentBubble){
    const cc = randomBubbleColor();
    currentBubble = {x:shooter.x,y:LAUNCH_Y,color:cc.col,id:cc.id,phase:Math.random()*Math.PI*2,placedAt:0};
  }
  if(!nextBubble){
    const nc = randomBubbleColor();
    nextBubble = {x:shooter.x+80,y:LAUNCH_Y+40,color:nc.col,id:nc.id,phase:Math.random()*Math.PI*2,placedAt:0};
  }
}

// cluster search
function neighbors(b){
  const res=[];
  const thresh = CELL_W + 2;
  grid.forEach(o=>{
    if(o===b) return;
    const dx=o.x-b.x, dy=o.y-b.y;
    if(dx*dx+dy*dy < thresh*thresh) res.push(o);
  });
  return res;
}

function findCluster(start){
  const targetId = start.id;
  const stack=[start];
  const seen=new Set([start]);
  const cluster=[];
  while(stack.length){
    const b=stack.pop();
    cluster.push(b);
    neighbors(b).forEach(n=>{
      if(!seen.has(n) && n.id===targetId){ seen.add(n); stack.push(n); }
    });
  }
  return cluster;
}

function findFloating(){
  grid.forEach(b=>b.marked=false);
  const queue=[];
  grid.forEach(b=>{
    if(b.row===0){
      b.marked=true;queue.push(b);
    }
  });
  while(queue.length){
    const b=queue.shift();
    neighbors(b).forEach(n=>{
      if(!n.marked){n.marked=true;queue.push(n);} 
    });
  }
  const floating = grid.filter(b=>!b.marked);
  return floating;
}

// ── INPUT ───────────────────────────────────────────────────────────────
let aiming = false;
let pointerClientX = gc.getBoundingClientRect().left + gc.getBoundingClientRect().width/2;

function updateAngleFromPointer(clientX, clientY){
  const rect = gc.getBoundingClientRect();
  const scaleX = gc.width  / rect.width;
  const scaleY = gc.height / rect.height;
  const cx = (clientX - rect.left) * scaleX;
  const cy = clientY !== undefined ? (clientY - rect.top) * scaleY : LAUNCH_Y - 120;
  let angle = Math.atan2(cy - LAUNCH_Y, cx - shooter.x);
  angle = clamp(angle, -Math.PI + 0.10, -0.10);
  shooter.angle = angle;
  pointerClientX = clientX;
}

// Prevent page scroll while dragging to aim on the canvas
gc.style.touchAction = 'none';

gc.addEventListener('pointerdown',e=>{
  e.preventDefault();
  if(gameState!=='PLAY') return;
  aiming=true;
  updateAngleFromPointer(e.clientX, e.clientY);
});

gc.addEventListener('pointermove',e=>{
  e.preventDefault();
  if(gameState!=='PLAY') return;
  updateAngleFromPointer(e.clientX, e.clientY);
});

gc.addEventListener('pointerup',e=>{
  e.preventDefault();
  if(gameState!=='PLAY') return;
  aiming=false;
  updateAngleFromPointer(e.clientX, e.clientY);
  shoot();
});

// Smooth continuous aim buttons — direction applied each frame in loop()
let aimDir = 0;

function startAim(dir, e){ e.preventDefault(); aimDir = dir; }
function stopAim(e){ e.preventDefault(); aimDir = 0; }

['btnLeft','btnRight'].forEach(id=>{
  const btn = document.getElementById(id);
  if(!btn) return;
  const dir = id === 'btnLeft' ? -1 : 1;
  btn.addEventListener('pointerdown', e=>startAim(dir, e));
  btn.addEventListener('pointerup',   stopAim);
  btn.addEventListener('pointerleave',stopAim);
  btn.addEventListener('pointercancel',stopAim);
});

document.getElementById('btnFire').addEventListener('click',()=>{
  if(gameState!=='PLAY') return;
  shoot();
});

window.addEventListener('keydown',e=>{
  if(e.key==='p' || e.key==='P') togglePause();
  if(e.key==='ArrowLeft')  { if(gameState==='PLAY') shooter.angle=clamp(shooter.angle-0.12,-Math.PI+0.10,-0.10); }
  if(e.key==='ArrowRight') { if(gameState==='PLAY') shooter.angle=clamp(shooter.angle+0.12,-Math.PI+0.10,-0.10); }
  if(gameState==='INTRO') startGame();
  else if(gameState==='GAMEOVER' && e.key==='Enter') restart();
});

window.addEventListener('mousemove',e=>{
  if(gameState!=='PLAY') return;
  updateAngleFromPointer(e.clientX, e.clientY);
});

// ── GAME FLOW ───────────────────────────────────────────────────────────
let gameState = 'INTRO';

function startGame(){
  if(gameState!=='INTRO') return;
  introEl.classList.add('fade');
  setTimeout(()=>introEl.style.display='none',700);
  gameState='PLAY';
  level = 1;
  score = 0;
  bestRuns = [];
  buildLevel();
  prepareNextBubble();
  updateHUD();
}

function nextLevel(){
  level++;
  showBanner('LEVEL '+level, level%3===0?'New power‑ups unlocked.':'Stack rising faster.');
  buildLevel();
  prepareNextBubble();
  SFX.level();
}

function showBanner(title,sub){
  lvlNum.textContent = title;
  lvlSub.textContent = sub;
  lvlBanner.classList.add('show');
  setTimeout(()=>lvlBanner.classList.remove('show'),1100);
}

function togglePause(){
  if(gameState!=='PLAY') return;
  paused=!paused;
  const btn = document.getElementById('pauseBtn');
  if(paused){
    pauseOverlay.classList.add('on');
    btn.classList.add('paused');
    btn.textContent='▶ RESUME';
  }else{
    pauseOverlay.classList.remove('on');
    btn.classList.remove('paused');
    btn.textContent='⏸ PAUSE';
  }
}

function restart(){
  goPanel.style.display='none';
  document.body.classList.remove('game-over');
  gameState='INTRO';
  introEl.style.display='flex';
  introEl.classList.remove('fade');
}

// ── SHOOTING & COLLISIONS ──────────────────────────────────────────────
function shoot(){
  if(moving || remainingShots<=0 || !currentBubble) return;
  moving = true;
  SFX.fire();
  shooterRecoil = 14;
  muzzleFlash = 1;
  const mx = shooter.x + Math.cos(shooter.angle)*42;
  const my = LAUNCH_Y  + Math.sin(shooter.angle)*42;
  for(let i=0;i<6;i++){
    const a=shooter.angle+(Math.random()-.5)*0.55;
    emitParticle({type:'spark',x:mx,y:my,
      vx:Math.cos(a)*4.5,vy:Math.sin(a)*4.5,g:0.06,
      r:2.2,life:0,maxLife:320,color:'#FFD700',rot:0,spin:0});
  }
  const speed = 9;
  const dx = Math.cos(shooter.angle);
  const dy = Math.sin(shooter.angle);
  shotDir = {x:dx*speed,y:dy*speed};
}

function stepShot(dt){
  if(!moving || !currentBubble) return;
  currentBubble.x += shotDir.x*(dt/16);
  currentBubble.y += shotDir.y*(dt/16);

  if(currentBubble.x <= BUBBLE_R+4 || currentBubble.x >= gc.width-BUBBLE_R-4){
    shotDir.x*=-1; currentBubble.x = clamp(currentBubble.x,BUBBLE_R+4,gc.width-BUBBLE_R-4);
  }

  if(currentBubble.y <= TOP_MARGIN+BUBBLE_R){
    snapCurrentToGrid();
    return;
  }

  for(let b of grid){
    const dx = b.x-currentBubble.x;
    const dy = b.y-currentBubble.y;
    const dist = Math.sqrt(dx*dx+dy*dy);
    if(dist < BUBBLE_R*2-2){
      snapCurrentToGrid();
      return;
    }
  }

  if(currentBubble.y > gc.height-20){
    snapCurrentToGrid(true);
  }
}

function snapCurrentToGrid(hitFloor){
  moving=false;
  remainingShots--;
  const row = Math.max(0, Math.round((currentBubble.y - TOP_MARGIN)/(BUBBLE_R*1.6)));
  const col = clamp(Math.round((currentBubble.x - BUBBLE_R)/((gc.width-2*BUBBLE_R)/COLS)),0,COLS-1);
  currentBubble.row=row;
  currentBubble.col=col;
  currentBubble.x = gridX(col,row);
  currentBubble.y = gridY(row);
  currentBubble.placedAt = now;
  grid.push(currentBubble);
  emitPoof(currentBubble.x, currentBubble.y);

  resolveAfterPlacement(currentBubble, hitFloor);

  currentBubble = nextBubble;
  currentBubble.x = shooter.x;
  currentBubble.y = LAUNCH_Y;
  nextBubble = null;
  prepareNextBubble();
}

function resolveAfterPlacement(placed,hitFloor){
  const cluster = findCluster(placed);
  let cleared=0;
  if(cluster.length>=3){
    SFX.pop();
    cleared = cluster.length;
    cluster.forEach(b=>emitBurst(b.x,b.y,b.color,13));
    const pts=cleared*50*combo;
    score += pts;
    emitScorePopup(placed.x, placed.y-30, `+${pts}`, '#FFD700');
    combo = clamp(combo+1,1,10);
    if(combo>=2) emitScorePopup(placed.x, placed.y-58, `×${combo} COMBO!`, combo>=5?'#ff3355':'#00ffff');
    hodl = clamp(hodl+cleared*0.6,0,hodlTarget);
    if(hodl >= hodlTarget){
      triggerRage();
      hodl = 0;
    }
    grid = grid.filter(b=>!cluster.includes(b));
    const floating = findFloating();
    if(floating.length){
      const fpts=floating.length*75*combo;
      score += fpts;
      floating.forEach(f=>{
        emitBurst(f.x,f.y,f.color,9);
        const idx=grid.indexOf(f); if(idx>=0) grid.splice(idx,1);
      });
      emitScorePopup(placed.x, placed.y-88, `+${fpts} DROP!`, '#00ff88');
      screenShake = 16;
    }
    statusEl.textContent = `🔥 Combo x${combo} – Cleared ${cleared} bubbles`;
  }else{
    combo = 1;
    hodl = Math.max(0,hodl-1);
    statusEl.textContent = 'No match – combo reset.';
  }

  const maxRow = grid.reduce((m,b)=>Math.max(m,b.row),0);
  floorRows = maxRow+1;

  if(remainingShots<=0){
    floorRows++;
    grid.forEach(b=>{b.row++;b.y=gridY(b.row);} );
    remainingShots = 20;
    SFX.drop();
    statusEl.textContent = 'Stack rising – new floor added.';
  }

  if(grid.length===0){
    score += 500*level;
    nextLevel();
  }else if(grid.some(b=>b.y+BUBBLE_R >= LAUNCH_Y-40)){
    endGame();
  }

  updateHUD();
}

function triggerRage(){
  SFX.rage();
  for(let i=0;i<24;i++){
    const a=(i/24)*Math.PI*2;
    emitParticle({type:'spark',x:gc.width/2,y:gc.height*0.45,
      vx:Math.cos(a)*8,vy:Math.sin(a)*8,g:0.06,r:3.5,
      life:0,maxLife:720,color:'#ff3355',rot:0,spin:0});
  }
  const cwrapEl=document.getElementById('cwrap');
  rageRing.classList.add('on');
  document.body.classList.add('rage');
  if(cwrapEl) cwrapEl.classList.add('rage');
  statusEl.textContent = '📈 HODL RUSH – next shot pierces and scores double.';
  activePower = {type:'rage', shots:1};
  setTimeout(()=>{
    rageRing.classList.remove('on');
    document.body.classList.remove('rage');
    if(cwrapEl) cwrapEl.classList.remove('rage');
  },900);
}

// ── RENDERING ───────────────────────────────────────────────────────────
function draw(){
  const hodlRatio = hodl / hodlTarget;
  drawBg(activePower && activePower.type==='rage', hodlRatio);

  ctx.save();
  if(screenShake>0){
    ctx.translate((Math.random()-0.5)*screenShake,(Math.random()-0.5)*screenShake);
    screenShake *= 0.85;
  }

  ctx.clearRect(0,0,gc.width,gc.height);

  drawComboGhost();

  grid.forEach(b=> drawBubble(b, b.x, b.y, false));

  if(currentBubble) drawBubble(currentBubble, currentBubble.x, currentBubble.y, true);
  if(nextBubble){
    ctx.save();
    ctx.strokeStyle='rgba(247,147,26,0.22)';
    ctx.setLineDash([3,5]);
    ctx.beginPath();
    ctx.moveTo(shooter.x+18, LAUNCH_Y+4);
    ctx.lineTo(gc.width-60, LAUNCH_Y+30);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha=0.65;
    const by = LAUNCH_Y+30+Math.sin(now*0.003)*2;
    drawBubble(nextBubble, gc.width-60, by, false);
    ctx.restore();
  }

  drawParticles();
  drawTrajectory();
  drawShooter();
  ctx.restore();
}

const BUBBLE_LABELS = {
  '#F7931A':'₿', '#627EEA':'Ξ', '#00AAE4':'✕', '#C2A633':'Ð', '#00BB44':'♣'
};

function drawBubble(b, x, y, glow){
  const color  = b ? b.color : '#F7931A';
  const phase  = b ? (b.phase||0) : 0;
  const placed = b ? (b.placedAt||0) : 0;

  // idle wobble
  const idle = (!glow && b) ? 1 + Math.sin(now*0.0018 + phase)*0.018 : 1;
  // landing wiggle (350ms envelope)
  let wig = 1;
  if(placed){
    const t = clamp((now - placed)/350, 0, 1);
    wig = 1 + Math.sin(t*Math.PI*3)*0.12*(1-t);
  }
  const r = BUBBLE_R * idle * wig;

  ctx.save();

  // 1. outer glow
  if(glow){ ctx.shadowColor=color; ctx.shadowBlur=26; }

  // 2. body gradient
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
  const gb = ctx.createRadialGradient(x-r*0.35, y-r*0.45, r*0.08, x, y, r);
  gb.addColorStop(0,   'rgba(255,255,255,0.88)');
  gb.addColorStop(0.18, color);
  gb.addColorStop(0.78, color);
  gb.addColorStop(1,   'rgba(0,0,0,0.55)');
  ctx.fillStyle = gb;
  ctx.fill();
  ctx.shadowBlur = 0;

  // 3. inner glow ring (volume)
  const gi = ctx.createRadialGradient(x, y, r*0.55, x, y, r);
  gi.addColorStop(0, 'rgba(255,255,255,0)');
  gi.addColorStop(0.85,'rgba(255,255,255,0)');
  gi.addColorStop(1,  'rgba(255,255,255,0.18)');
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
  ctx.fillStyle = gi; ctx.fill();

  // 4. rim light (bottom-right secondary source)
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.clip();
  const gr = ctx.createRadialGradient(x+r*0.55, y+r*0.6, r*0.08, x+r*0.6, y+r*0.6, r*0.9);
  gr.addColorStop(0,  'rgba(255,255,255,0.52)');
  gr.addColorStop(0.5,'rgba(255,255,255,0)');
  gr.addColorStop(1,  'rgba(255,255,255,0)');
  ctx.fillStyle = gr; ctx.fillRect(x-r, y-r, r*2, r*2);
  ctx.restore();

  // 5. stroke
  ctx.strokeStyle='rgba(0,0,0,0.32)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.stroke();

  // 6. soft specular ellipse + sharp pinpoint
  ctx.beginPath();
  ctx.ellipse(x-r*0.34, y-r*0.40, r*0.33, r*0.21, -0.5, 0, Math.PI*2);
  ctx.fillStyle='rgba(255,255,255,0.42)'; ctx.fill();
  const sx = x - r*0.42 + Math.cos(now*0.002+phase)*r*0.04;
  const sy = y - r*0.46 + Math.sin(now*0.002+phase)*r*0.04;
  ctx.beginPath(); ctx.arc(sx, sy, r*0.10, 0, Math.PI*2);
  ctx.fillStyle='rgba(255,255,255,0.95)'; ctx.fill();

  // 7. shimmer sweep
  const sh = (Math.sin(now*0.0015+phase)+1)*0.5;
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.clip();
  ctx.globalAlpha = 0.10 + sh*0.16;
  const sg = ctx.createLinearGradient(x-r, y-r+sh*r*2, x+r, y-r+sh*r*2+r);
  sg.addColorStop(0,  'rgba(255,255,255,0)');
  sg.addColorStop(0.5,'rgba(255,255,255,0.9)');
  sg.addColorStop(1,  'rgba(255,255,255,0)');
  ctx.fillStyle = sg; ctx.fillRect(x-r, y-r, r*2, r*2);
  ctx.restore();

  // 8. etched crypto symbol
  const label = BUBBLE_LABELS[color];
  if(label){
    ctx.font=`900 ${Math.floor(r*0.82)}px Orbitron,monospace`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='rgba(0,0,0,0.40)';
    ctx.fillText(label, x, y+2);
    ctx.fillStyle='rgba(255,255,255,0.95)';
    ctx.fillText(label, x, y+1);
  }
  ctx.restore();
}

function drawTrajectory(){
  if(!currentBubble || moving) return;
  let x=shooter.x, y=LAUNCH_Y;
  let vx=Math.cos(shooter.angle), vy=Math.sin(shooter.angle);
  const path=[];
  for(let i=0;i<300;i++){
    x+=vx*2.8; y+=vy*2.8;
    if(x-BUBBLE_R<=0){ x=BUBBLE_R; vx=Math.abs(vx); }
    if(x+BUBBLE_R>=gc.width){ x=gc.width-BUBBLE_R; vx=-Math.abs(vx); }
    path.push({x,y});
    if(y<=TOP_MARGIN+BUBBLE_R) break;
    let hit=false;
    for(const b of grid){
      const dx=b.x-x, dy=b.y-y;
      if(dx*dx+dy*dy<(BUBBLE_R*2)**2){hit=true;break;}
    }
    if(hit) break;
  }
  // gradient dots: bigger + more opaque near cannon
  const total=path.length;
  ctx.save();
  for(let i=2;i<total;i+=4){
    const t=i/total;
    ctx.globalAlpha=(1-t)*0.58;
    ctx.fillStyle='#F7931A';
    ctx.beginPath(); ctx.arc(path[i].x,path[i].y,1.2+(1-t)*2.4,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
  // pulsing reticle at tip
  const pulse=0.5+0.5*Math.sin(now*0.008);
  const rr=7+pulse*5;
  ctx.save();
  ctx.strokeStyle=`rgba(255,215,0,${0.55+pulse*0.4})`;
  ctx.lineWidth=1.8;
  ctx.shadowColor='#FFD700'; ctx.shadowBlur=10;
  ctx.beginPath(); ctx.arc(x,y,rr,0,Math.PI*2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x-rr-4,y); ctx.lineTo(x-rr+2,y);
  ctx.moveTo(x+rr-2,y); ctx.lineTo(x+rr+4,y);
  ctx.moveTo(x,y-rr-4); ctx.lineTo(x,y-rr+2);
  ctx.moveTo(x,y+rr-2); ctx.lineTo(x,y+rr+4);
  ctx.stroke();
  ctx.restore();
}

function drawShooter(){
  const baseY=LAUNCH_Y+10;
  const ang=shooter.angle;
  const recX=-Math.cos(ang)*shooterRecoil;
  const recY=-Math.sin(ang)*shooterRecoil;

  // base shadow
  ctx.save();
  ctx.translate(shooter.x,baseY);
  ctx.fillStyle='rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(0,30,54,8,0,0,Math.PI*2); ctx.fill();
  // platform
  const pg=ctx.createLinearGradient(0,4,0,22);
  pg.addColorStop(0,'#2a2f3a'); pg.addColorStop(1,'#0a0c12');
  ctx.fillStyle=pg;
  ctx.beginPath(); ctx.roundRect(-50,4,100,18,9); ctx.fill();
  ctx.fillStyle='#F7931A'; ctx.fillRect(-40,6,80,3);
  ctx.fillStyle='#374151';
  [-36,-20,20,36].forEach(bx=>{
    ctx.beginPath(); ctx.arc(bx,14,2.5,0,Math.PI*2); ctx.fill();
  });
  ctx.restore();

  // cannon body (rotates + recoils)
  ctx.save();
  ctx.translate(shooter.x+recX*0.3, baseY+recY*0.3);
  ctx.rotate(ang+Math.PI/2);

  const bg2=ctx.createLinearGradient(-16,0,16,0);
  bg2.addColorStop(0,'#0f1219'); bg2.addColorStop(0.5,'#1f2532'); bg2.addColorStop(1,'#0f1219');
  ctx.fillStyle=bg2; ctx.strokeStyle='rgba(247,147,26,0.48)'; ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.roundRect(-15,-54+shooterRecoil*0.5,30,64,9); ctx.fill(); ctx.stroke();

  // spinning BTC coin chamber
  ctx.save(); ctx.translate(0,-22); ctx.rotate(now*0.0008);
  const cg=ctx.createRadialGradient(-3,-3,1,0,0,9);
  cg.addColorStop(0,'#FFD58A'); cg.addColorStop(1,'#C97200');
  ctx.fillStyle=cg;
  ctx.beginPath(); ctx.arc(0,0,9,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#1a0800';
  ctx.font='900 10px Orbitron'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('₿',0,1);
  ctx.restore();

  // barrel (recoils more than body)
  const barrelLen=42-shooterRecoil*1.4;
  const bgr=ctx.createLinearGradient(-6,0,6,0);
  bgr.addColorStop(0,'#7a3d00'); bgr.addColorStop(0.5,'#F7931A'); bgr.addColorStop(1,'#7a3d00');
  ctx.fillStyle=bgr;
  ctx.beginPath(); ctx.roundRect(-6,-54-barrelLen+shooterRecoil*1.4,12,barrelLen,4); ctx.fill();

  // muzzle tip glow
  ctx.shadowColor='#FFD700'; ctx.shadowBlur=12+muzzleFlash*24;
  ctx.fillStyle=`rgba(255,${190+muzzleFlash*65|0},80,${0.7+muzzleFlash*0.3})`;
  ctx.beginPath(); ctx.arc(0,-54-barrelLen+4,5+muzzleFlash*4,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;

  ctx.restore();
}

// ── HUD ─────────────────────────────────────────────────────────────────
const hudDisplay = {
  score: {disp:0,target:0,el:null,fmt:v=>Math.floor(v).toLocaleString()},
  combo: {disp:1,target:1,el:null,fmt:v=>'×'+Math.floor(v)},
  shots: {disp:0,target:0,el:null,fmt:v=>Math.floor(v).toString()},
  rows:  {disp:0,target:0,el:null,fmt:v=>Math.floor(v).toString()},
  level: {disp:1,target:1,el:null,fmt:v=>Math.floor(v).toString()},
  hodl:  {disp:0,target:0,el:null,fmt:v=>`${Math.floor(v)} / ${hodlTarget}`},
};

function initHudDisplay(){
  hudDisplay.score.el = hScore;
  hudDisplay.combo.el = hCombo;
  hudDisplay.shots.el = hShots;
  hudDisplay.rows.el  = hRows;
  hudDisplay.level.el = hLevel;
  hudDisplay.hodl.el  = rageVal;
}

function tickHUD(dt){
  for(const k in hudDisplay){
    const h=hudDisplay[k]; if(!h.el) continue;
    const diff=h.target-h.disp;
    if(Math.abs(diff)<0.5){ h.disp=h.target; }
    else{ h.disp+=diff*Math.min(1,dt/100); }
    const txt=h.fmt(h.disp);
    if(h.el.textContent!==txt) h.el.textContent=txt;
  }
  rageFill.style.width=`${(hodl/hodlTarget)*100}%`;
}

function drawComboGhost(){
  if(combo<2) return;
  ctx.save();
  ctx.globalAlpha=0.06+Math.sin(now*0.0009)*0.03;
  ctx.font=`900 240px Orbitron,monospace`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle=combo>=5?'#ff3355':'#FFD700';
  ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=40;
  ctx.fillText('×'+combo, gc.width/2, gc.height*0.42);
  ctx.restore();
}

function updateHUD(){
  if(hudDisplay.score.target!==score && hScore){
    hScore.classList.remove('flash'); void hScore.offsetWidth;
    hScore.classList.add('flash');
  }
  hudDisplay.score.target = score;
  hudDisplay.combo.target = combo;
  hudDisplay.shots.target = remainingShots;
  hudDisplay.rows.target  = floorRows;
  hudDisplay.level.target = level;
  hudDisplay.hodl.target  = hodl;
  hHi.textContent = highScore.toLocaleString();

  puBadges.innerHTML = '';
  if(activePower && activePower.type==='rage'){
    const span=document.createElement('span');
    span.className='pu-badge';
    span.innerHTML='📈 HODL RUSH';
    puBadges.appendChild(span);
  }
}

// ── GAME OVER & SCOREBOARD ─────────────────────────────────────────────
function endGame(){
  gameState='GAMEOVER';
  SFX.gameOver();
  hitFlash.style.opacity='1';
  setTimeout(()=>hitFlash.style.opacity='0',120);
  document.body.classList.add('game-over');

  goFinal.textContent = score.toLocaleString();
  bestRuns.push({score,level,floor:floorRows});
  bestRuns.sort((a,b)=>b.score-a.score);
  bestRuns = bestRuns.slice(0,5);

  hsBody.innerHTML = '';
  bestRuns.forEach((r,i)=>{
    const tr = document.createElement('tr');
    tr.className = i===0?'gr':(score===r.score?'nr':'');
    tr.innerHTML = `<td>${i+1}</td><td>${r.score.toLocaleString()}</td><td>${r.level}</td><td>${r.floor}</td>`;
    hsBody.appendChild(tr);
  });

  if(score>highScore){
    highScore=score;
    try{ if(window.Auth) Auth.saveScore('btc_bubbles_hs',score); }catch(e){}
  }
  hHi.textContent = highScore.toLocaleString();

  goPanel.style.display='block';
}

// ── MAIN LOOP ───────────────────────────────────────────────────────────
function loop(ts){
  now = ts;
  const dt = lastTs ? Math.min(50,ts-lastTs) : 16;
  lastTs = ts;

  shooterRecoil *= 0.82;
  muzzleFlash   *= 0.85;
  if(shooterRecoil < 0.05) shooterRecoil = 0;
  if(muzzleFlash  < 0.02) muzzleFlash  = 0;

  if(gameState==='PLAY' && !paused){
    if(aimDir !== 0) shooter.angle = clamp(shooter.angle + aimDir * 0.003 * dt, -Math.PI + 0.10, -0.10);
    if(moving) stepShot(dt);
    updateParticles(dt);
  }

  tickHUD(dt);
  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
initHudDisplay();

// ── INTRO INTERACTIONS ─────────────────────────────────────────────────
introEl.addEventListener('click',startGame);
window.addEventListener('click',e=>{
  if(gameState==='INTRO') startGame();
});

const playAgainBtn = document.getElementById('playAgain');
if(playAgainBtn) playAgainBtn.addEventListener('click',restart);

const pauseBtn = document.getElementById('pauseBtn');
if(pauseBtn) pauseBtn.addEventListener('click',togglePause);

const sndBtn = document.getElementById('sndBtn');
if(sndBtn) sndBtn.addEventListener('click',toggleSound);

const btnFire2 = document.getElementById('btnFire');
if(btnFire2){
  btnFire2.addEventListener('pointerdown',e=>{
    e.preventDefault();
    if(gameState!=='PLAY') return;
    shoot();
  });
}

