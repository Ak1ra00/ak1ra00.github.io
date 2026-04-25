
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

let bgPts=[];
(function initBg(){
  function reset(){
    bgW = bg.width = innerWidth;
    bgH = bg.height = innerHeight;
    bgPts = [];
    for(let i=0;i<70;i++) bgPts.push({
      x:Math.random()*bgW,
      y:Math.random()*bgH,
      vx:(Math.random()-.5)*.28,
      vy:(Math.random()-.5)*.28,
      r:.8+Math.random()*1.8,
      a:.08+Math.random()*.35,
      c:Math.random()>.55?'#F7931A':(Math.random()>.5?'#627EEA':'#00AAE4')
    });
  }
  reset();
  addEventListener('resize',reset);
})();

function drawBg(rage,hodlRatio){
  bgx.clearRect(0,0,bgW,bgH);
  const a=.04+hodlRatio*.08;
  const g=bgx.createRadialGradient(bgW/2,bgH*0.2,0,bgW/2,bgH*0.8,bgW*.9);
  if(rage){
    g.addColorStop(0,`rgba(255,51,85,${a*2.2})`);
    g.addColorStop(.5,`rgba(80,0,15,${a})`);
    g.addColorStop(1,'transparent');
  }else{
    g.addColorStop(0,`rgba(247,147,26,${a})`);
    g.addColorStop(.6,`rgba(12,12,40,${a*.6})`);
    g.addColorStop(1,'transparent');
  }
  bgx.fillStyle=g;
  bgx.fillRect(0,0,bgW,bgH);

  bgPts.forEach(p=>{
    const spd = rage?2.0:1.0;
    p.x=(p.x+p.vx*spd+bgW)%bgW;
    p.y=(p.y+p.vy*spd+bgH)%bgH;
    bgx.save();
    bgx.globalAlpha=p.a*(rage?1.7:1);
    bgx.fillStyle=rage?'#ff3355':p.c;
    bgx.shadowColor=bgx.fillStyle;
    bgx.shadowBlur=rage?14:7;
    bgx.beginPath();bgx.arc(p.x,p.y,p.r*(1+hodlRatio*.5),0,Math.PI*2);bgx.fill();
    bgx.restore();
  });
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
      marked:false
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
    currentBubble = {x:shooter.x,y:LAUNCH_Y,color:cc.col,id:cc.id};
  }
  if(!nextBubble){
    const nc = randomBubbleColor();
    nextBubble = {x:shooter.x+80,y:LAUNCH_Y+40,color:nc.col,id:nc.id};
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
  grid.push(currentBubble);

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
    score += cleared*50*combo;
    combo = clamp(combo+1,1,10);
    hodl = clamp(hodl+cleared*0.6,0,hodlTarget);
    if(hodl >= hodlTarget){
      triggerRage();
      hodl = 0;
    }
    grid = grid.filter(b=>!cluster.includes(b));
    const floating = findFloating();
    if(floating.length){
      score += floating.length*75*combo;
      floating.forEach(f=>{ const idx = grid.indexOf(f); if(idx>=0) grid.splice(idx,1); });
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
  rageRing.classList.add('on');
  document.body.classList.add('rage');
  statusEl.textContent = '📈 HODL RUSH – next shot pierces and scores double.';
  activePower = {type:'rage', shots:1};
  setTimeout(()=>{
    rageRing.classList.remove('on');
    document.body.classList.remove('rage');
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

  grid.forEach(b=>{
    drawBubble(b.x,b.y,b.color);
  });

  if(currentBubble) drawBubble(currentBubble.x,currentBubble.y,currentBubble.color,true);
  if(nextBubble){
    ctx.save();
    ctx.globalAlpha=0.5;
    drawBubble(gc.width-60,LAUNCH_Y+30,nextBubble.color,false);
    ctx.restore();
  }

  drawTrajectory();
  drawShooter();
  ctx.restore();
}

const BUBBLE_LABELS = {
  '#F7931A':'₿', '#627EEA':'Ξ', '#00AAE4':'✕', '#C2A633':'Ð', '#00BB44':'♣'
};

function drawBubble(x,y,color,glow){
  ctx.save();
  if(glow){
    ctx.shadowColor=color;
    ctx.shadowBlur=22;
  }
  ctx.beginPath();
  ctx.arc(x,y,BUBBLE_R,0,Math.PI*2);
  const grad = ctx.createRadialGradient(x-BUBBLE_R*0.38,y-BUBBLE_R*0.38,2,x,y,BUBBLE_R);
  grad.addColorStop(0,'rgba(255,255,255,0.9)');
  grad.addColorStop(0.22,color);
  grad.addColorStop(0.75,color);
  grad.addColorStop(1,'rgba(0,0,0,0.75)');
  ctx.fillStyle=grad;
  ctx.fill();
  ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(0,0,0,0.4)';
  ctx.lineWidth=1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x-BUBBLE_R*0.28, y-BUBBLE_R*0.32, BUBBLE_R*0.28, 0, Math.PI*2);
  ctx.fillStyle='rgba(255,255,255,0.45)';
  ctx.fill();
  const label = BUBBLE_LABELS[color];
  if(label){
    ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,255,255,0.95)';
    ctx.font=`900 ${Math.floor(BUBBLE_R*0.85)}px Orbitron,monospace`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(label, x, y+1);
  }
  ctx.restore();
}

function drawTrajectory(){
  if(!currentBubble || moving) return;
  let x=shooter.x, y=LAUNCH_Y;
  let vx=Math.cos(shooter.angle), vy=Math.sin(shooter.angle);
  ctx.save();
  ctx.setLineDash([5,9]);
  ctx.strokeStyle='rgba(247,147,26,0.28)';
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(x,y);
  for(let i=0;i<300;i++){
    x+=vx*2.8; y+=vy*2.8;
    if(x-BUBBLE_R<=0){ x=BUBBLE_R; vx=Math.abs(vx); }
    if(x+BUBBLE_R>=gc.width){ x=gc.width-BUBBLE_R; vx=-Math.abs(vx); }
    if(y<=TOP_MARGIN+BUBBLE_R) break;
    ctx.lineTo(x,y);
    let hit=false;
    for(const b of grid){
      const dx=b.x-x, dy=b.y-y;
      if(dx*dx+dy*dy<(BUBBLE_R*2)**2){hit=true;break;}
    }
    if(hit) break;
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle='rgba(247,147,26,0.45)';
  ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawShooter(){
  const baseY = LAUNCH_Y+10;
  ctx.save();
  ctx.translate(shooter.x,baseY);
  ctx.rotate(shooter.angle);
  ctx.fillStyle='#111827';
  ctx.beginPath();
  ctx.roundRect(-14,-50,28,60,8);
  ctx.fill();
  ctx.fillStyle='#F7931A';
  ctx.beginPath();
  ctx.roundRect(-6,-46,12,40,6);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle='#6b7280';
  ctx.fillRect(shooter.x-40,baseY+8,80,6);
  ctx.fillStyle='#F7931A';
  ctx.fillRect(shooter.x-16,baseY+4,32,10);
  ctx.restore();
}

// ── HUD ─────────────────────────────────────────────────────────────────
function updateHUD(){
  hScore.textContent = score.toLocaleString();
  hCombo.textContent = '×'+combo;
  hShots.textContent = remainingShots.toString();
  hRows.textContent = floorRows.toString();
  hLevel.textContent = level.toString();
  rageVal.textContent = `${Math.floor(hodl)} / ${hodlTarget}`;
  rageFill.style.width = `${(hodl/hodlTarget)*100}%`;

  puBadges.innerHTML = '';
  if(activePower && activePower.type==='rage'){
    const span = document.createElement('span');
    span.className='pu-badge';
    span.innerHTML = '📈 HODL RUSH';
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
  const dt = lastTs ? Math.min(50,ts-lastTs) : 16;
  lastTs = ts;

  if(gameState==='PLAY' && !paused){
    if(aimDir !== 0) shooter.angle = clamp(shooter.angle + aimDir * 0.003 * dt, -Math.PI + 0.10, -0.10);
    if(moving) stepShot(dt);
  }

  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

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

