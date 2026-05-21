'use strict';

/* ════════════════════════════════════════════════════════════════════════
   ICE COLD ₿  —  Bitcoin-themed Ice Cold Beer (Taito, 1983) remix
   Two independent levers tilt a blockchain bar.
   A golden ₿ coin rolls based on gravity + bar angle.
   Sink it into the glowing wallet pocket.  Don't drop it.
   ════════════════════════════════════════════════════════════════════════ */

/* ── AUDIO ─────────────────────────────────────────────────────────────── */
let audioCtx = null, soundEnabled = true;

function toggleSound(){
  soundEnabled = !soundEnabled;
  const btn = document.getElementById('sndBtn');
  if(!btn) return;
  btn.textContent = soundEnabled ? '🔊 SFX' : '🔇 SFX';
  btn.className = 'snd-btn' + (soundEnabled ? '' : ' off');
}
function getAudio(){
  if(!soundEnabled) return null;
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }catch(e){ return null; }
}
function playNote(freq,type='sine',dur=0.12,vol=0.22,t0=0){
  const a=getAudio(); if(!a) return;
  try{
    const osc=a.createOscillator(), g=a.createGain();
    osc.connect(g); g.connect(a.destination);
    osc.type=type;
    osc.frequency.setValueAtTime(freq, a.currentTime+t0);
    g.gain.setValueAtTime(vol, a.currentTime+t0);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime+t0+dur);
    osc.start(a.currentTime+t0);
    osc.stop(a.currentTime+t0+dur+0.05);
  }catch(e){}
}
const SFX = {
  pocket(){ [880,1180,1480,1760].forEach((f,i)=>playNote(f,'sine',0.1,0.24,i*0.05)); },
  drop(){ [280,210,150,110].forEach((f,i)=>playNote(f,'sawtooth',0.18,0.30,i*0.07)); },
  tick(){ playNote(680,'square',0.04,0.10); },
  level(){ [660,830,1040,1320,1660].forEach((f,i)=>playNote(f,'sine',0.13,0.28,i*0.09)); },
  gameOver(){ [420,330,260,210,160].forEach((f,i)=>playNote(f,'sawtooth',0.18,0.36,i*0.11)); },
  start(){ playNote(440,'triangle',0.08,0.18); playNote(660,'triangle',0.08,0.18,0.08); },
  combo(){ playNote(1320,'triangle',0.06,0.18); playNote(1760,'triangle',0.06,0.18,0.05); },
};

/* ── DOM ───────────────────────────────────────────────────────────────── */
const gc      = document.getElementById('gc');
const ctx     = gc.getContext('2d');
const bg      = document.getElementById('bgCanvas');
const bgx     = bg ? bg.getContext('2d') : null;
const intro   = document.getElementById('intro');
const lvlBanner = document.getElementById('lvlBanner');
const lvlNum  = document.getElementById('lvlNum');
const lvlSub  = document.getElementById('lvlSub');
const gop     = document.getElementById('gop');
const goFinal = document.getElementById('gofinal');
const goRecap = document.getElementById('goRecap');
const introHi = document.getElementById('introHi');
const hScore  = document.getElementById('hScore');
const hLives  = document.getElementById('hLives');
const hBlock  = document.getElementById('hBlock');
const hTime   = document.getElementById('hTime');
const hCombo  = document.getElementById('hCombo');
const hHi     = document.getElementById('hHi');
const gstat   = document.getElementById('gstat');
const pauseBtn= document.getElementById('pauseBtn');
const sndBtn  = document.getElementById('sndBtn');
const pauseOverlay = document.getElementById('pauseOverlay');
const playAgainBtn = document.getElementById('playAgain');
const progFill= document.getElementById('progFill');
const progVal = document.getElementById('progVal');
const idleTicker = document.getElementById('idleTicker');
const tzLeft  = document.getElementById('tzLeft');
const tzRight = document.getElementById('tzRight');
const tzhLeft = document.getElementById('tzhLeft');
const tzhRight= document.getElementById('tzhRight');

/* ── CONST / LAYOUT ────────────────────────────────────────────────────── */
const W = gc.width, H = gc.height;          // 600 x 700
const SIDE_PAD   = 50;                       // bar end clearance from canvas edge
const BAR_LEFT_X = SIDE_PAD;
const BAR_RIGHT_X= W - SIDE_PAD;
const BAR_LEN    = BAR_RIGHT_X - BAR_LEFT_X; // 500
const BAR_THICK  = 14;

/* Grid sits in the canvas; bar travels vertically over its lower 75%.
   That lets the player raise the bar up to reach the higher hole rows. */
const GRID_COLS  = 10;
const GRID_ROWS  = 12;
const GRID_TOP   = 50;
const GRID_BOT   = H - 60;                   // gives ~40px below for posts
const HEX_R      = Math.min((W - 80) / (GRID_COLS * Math.sqrt(3) + Math.sqrt(3)/2),
                            (GRID_BOT - GRID_TOP) / (GRID_ROWS * 1.5 + 0.5));
const HEX_DX     = HEX_R * Math.sqrt(3);
const HEX_DY     = HEX_R * 1.5;
const GRID_OFFX  = (W - (GRID_COLS - 1) * HEX_DX - HEX_DX/2) / 2;
const HOLE_R     = HEX_R * 0.72;             // pocket radius (catch radius)

/* 10 fixed bitcoin positions: #1 low (easy) → #10 near top (hard) */
const BITCOIN_PATH = [
  {col:4, row:10},
  {col:6, row:9},
  {col:3, row:8},
  {col:7, row:7},
  {col:5, row:6},
  {col:2, row:5},
  {col:8, row:4},
  {col:4, row:3},
  {col:6, row:2},
  {col:5, row:1},
];

/* Fixed danger holes — each row leaves only a narrow corridor around its bitcoin target.
   Open columns per row shown in comments; everything else is a hole. */
const FIXED_DANGERS = [
  // Row 11 — gentle entry (open: most cols)
  {col:3, row:11}, {col:6, row:11},
  // Row 10 — ₿#1 col4 (open: 2,3,4,6,8)
  {col:0, row:10}, {col:1, row:10}, {col:5, row:10}, {col:7, row:10}, {col:9, row:10},
  // Row 9 — ₿#2 col6 (open: 3,5,6,9)
  {col:0, row:9},  {col:1, row:9},  {col:2, row:9},  {col:4, row:9},  {col:7, row:9},  {col:8, row:9},
  // Row 8 — ₿#3 col3 (open: 0,3,4,9)
  {col:1, row:8},  {col:2, row:8},  {col:5, row:8},  {col:6, row:8},  {col:7, row:8},  {col:8, row:8},
  // Row 7 — ₿#4 col7 (open: 5,6,7,8)
  {col:0, row:7},  {col:1, row:7},  {col:2, row:7},  {col:3, row:7},  {col:4, row:7},  {col:9, row:7},
  // Row 6 — ₿#5 col5 (open: 4,5,6)
  {col:0, row:6},  {col:1, row:6},  {col:2, row:6},  {col:3, row:6},  {col:7, row:6},  {col:8, row:6},  {col:9, row:6},
  // Row 5 — ₿#6 col2 (open: 1,2,3)
  {col:0, row:5},  {col:4, row:5},  {col:5, row:5},  {col:6, row:5},  {col:7, row:5},  {col:8, row:5},  {col:9, row:5},
  // Row 4 — ₿#7 col8 (open: 6,7,8,9)
  {col:0, row:4},  {col:1, row:4},  {col:2, row:4},  {col:3, row:4},  {col:4, row:4},  {col:5, row:4},
  // Row 3 — ₿#8 col4 (open: 3,4,5)
  {col:0, row:3},  {col:1, row:3},  {col:2, row:3},  {col:6, row:3},  {col:7, row:3},  {col:8, row:3},  {col:9, row:3},
  // Row 2 — ₿#9 col6 (open: 5,6,7)
  {col:0, row:2},  {col:1, row:2},  {col:2, row:2},  {col:3, row:2},  {col:4, row:2},  {col:8, row:2},  {col:9, row:2},
  // Row 1 — ₿#10 col5 (open: 4,5,6)
  {col:0, row:1},  {col:1, row:1},  {col:2, row:1},  {col:3, row:1},  {col:7, row:1},  {col:8, row:1},  {col:9, row:1},
  // Row 0 — gauntlet cap (open: col5 only)
  {col:0, row:0},  {col:1, row:0},  {col:2, row:0},  {col:3, row:0},  {col:4, row:0},
  {col:6, row:0},  {col:7, row:0},  {col:8, row:0},  {col:9, row:0},
];

/* Bar travel: covers most of the grid so player can reach any row.
   Top travel = just below grid top + ball clearance.
   Bottom rest = near canvas bottom. */
const BAR_TOP    = GRID_TOP + HEX_R * 1.6;
const BAR_BOT    = GRID_BOT + 10;
const BAR_CTR_Y  = BAR_BOT - 20;             // start at the bottom

const BALL_R     = HEX_R * 0.58;             // a bit smaller than hole
const GRAVITY    = 1100;                     // px/s² along bar (after sin(angle))
const FRICTION   = 0.985;                    // per-60Hz frame
const LEVER_SPD  = 320;                      // px/s when key held

const COMBO_WIN_MS = 3000;
const LIFE_LOST_MS = 1100;
const POCKET_FREEZE_MS = 520;
const LVL_BANNER_MS = 1500;

/* ── STATE ─────────────────────────────────────────────────────────────── */
const STATE = Object.freeze({INTRO:0, PLAYING:1, POCKET:2, LIFE_LOST:3, LEVEL_CLEAR:4, GAME_OVER:5, PAUSED:6});
let state = STATE.INTRO, prevState = STATE.INTRO;

let leftY  = BAR_CTR_Y;       // current Y of left lever endpoint
let rightY = BAR_CTR_Y;       // current Y of right lever endpoint
let leftTargetY = BAR_CTR_Y;  // for smoothed input
let rightTargetY= BAR_CTR_Y;

let ball;                     // {x, y, vx, rot}
let particles = [];           // sparks on pocket
let chainDust = [];           // ambient sparks falling along bar

let block       = 1;
let lives       = 3;
let score       = 0;
let hiScore     = 0;
let combo       = 1;
let comboTimer  = 0;          // ms
let bitcoinIdx  = 0;          // which of the 10 bitcoins we're targeting (0-9)
let claimedPositions = [];    // collected positions → become danger holes
let blockTime   = 90;         // seconds remaining
let blockTimeTotal = 90;
let invincibleMs= 0;          // mercy after life lost
let pocketFreezeMs = 0;
let lifeLostMs  = 0;
let lvlBannerMs = 0;
let lastSec     = -1;

let prevBarMidY  = BAR_CTR_Y; // for bar vertical-velocity detection
let activeHoles = [];         // [{col,row,fake?:bool,bornMs}]
let pocketedFlashes = [];     // [{col,row,ms,maxMs}]

/* per-block hit counter — small flash celebration */
let hudFlashTimer = 0;

/* idle ticker rotation */
const TICKER = [
  "1 BTC = 100,000,000 sats. Stack ’em.",
  "Block 0 mined Jan 3 2009. We’ve come a long way.",
  "Don’t trust. Verify.",
  "Not your keys, not your coin.",
  "Difficulty adjusts every 2016 blocks.",
  "21 million. Forever.",
  "“If you don’t believe it, I don’t have time to convince you.” — Satoshi",
  "Fix the money, fix the world.",
  "Cold storage. Hot moves.",
  "Bull, bear, doesn’t matter — you’re HODLing.",
  "Every halving, sats get harder to find.",
  "A wallet is just a key. Don’t lose it.",
];
let tickerIdx = 0, tickerNextMs = 0;

/* keys */
const KEYS = {};

/* shake */
let shakeMs = 0, shakeMag = 0;

/* ── HI-SCORE ──────────────────────────────────────────────────────────── */
function loadHi(){
  if(typeof Auth !== 'undefined' && Auth.getScore){
    try{ hiScore = Auth.getScore('btc_icecold_hi') || 0; }catch(e){ hiScore = 0; }
  } else {
    hiScore = parseInt(localStorage.getItem('btc_icecold_hi') || '0', 10) || 0;
  }
}
function saveHi(){
  if(score <= hiScore) return;
  hiScore = score;
  if(typeof Auth !== 'undefined' && Auth.saveScore){
    try{ Auth.saveScore('btc_icecold_hi', score); }catch(e){}
  }
  try{ localStorage.setItem('btc_icecold_hi', String(hiScore)); }catch(e){}
}
loadHi();

/* ── HELPERS ───────────────────────────────────────────────────────────── */
function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
function holePos(col, row){
  const x = GRID_OFFX + col * HEX_DX + (row % 2 ? HEX_DX/2 : 0);
  const y = GRID_TOP + row * HEX_DY + HEX_R;
  return {x, y};
}
function barYAt(x){
  if(x <= BAR_LEFT_X)  return leftY;
  if(x >= BAR_RIGHT_X) return rightY;
  const t = (x - BAR_LEFT_X) / BAR_LEN;
  return leftY + (rightY - leftY) * t;
}
function barAngle(){ return Math.atan2(rightY - leftY, BAR_LEN); }
function shake(mag, ms){ shakeMag = Math.max(shakeMag, mag); shakeMs = Math.max(shakeMs, ms); }

/* ── INPUT ─────────────────────────────────────────────────────────────── */
function startGame(){
  if(state === STATE.INTRO || state === STATE.GAME_OVER){
    intro.classList.add('fade');
    gop.classList.remove('show');
    gop.style.display = 'none';
    setTimeout(()=>{ intro.style.display='none'; }, 700);
    SFX.start();
    resetRun();
    state = STATE.PLAYING;
  }
}
document.addEventListener('keydown', e => {
  const k = e.key;
  if(state === STATE.INTRO || state === STATE.GAME_OVER){
    if(k === 'Tab') return;
    startGame();
    return;
  }
  if(k === 'p' || k === 'P'){
    if(state === STATE.PAUSED){
      state = prevState;
      pauseOverlay.classList.remove('on');
      pauseBtn.classList.remove('paused');
      pauseBtn.textContent = '⏸ PAUSE';
    } else if(state === STATE.PLAYING){
      prevState = state;
      state = STATE.PAUSED;
      pauseOverlay.classList.add('on');
      pauseBtn.classList.add('paused');
      pauseBtn.textContent = '▶ RESUME';
    }
    return;
  }
  KEYS[k.toLowerCase()] = true;
  if(k === 'ArrowLeft' || k === 'ArrowRight') KEYS[k] = true;
});
document.addEventListener('keyup', e => {
  KEYS[e.key.toLowerCase()] = false;
  if(e.key === 'ArrowLeft' || e.key === 'ArrowRight') KEYS[e.key] = false;
});
intro.addEventListener('click', startGame);
intro.addEventListener('touchstart', e => { e.preventDefault(); startGame(); }, {passive:false});

pauseBtn.addEventListener('click', () => {
  if(state === STATE.PLAYING){
    prevState = state;
    state = STATE.PAUSED;
    pauseOverlay.classList.add('on');
    pauseBtn.classList.add('paused');
    pauseBtn.textContent = '▶ RESUME';
  } else if(state === STATE.PAUSED){
    state = prevState;
    pauseOverlay.classList.remove('on');
    pauseBtn.classList.remove('paused');
    pauseBtn.textContent = '⏸ PAUSE';
  }
});
sndBtn.addEventListener('click', toggleSound);
playAgainBtn.addEventListener('click', startGame);

/* ── TOUCH ZONES (mobile) ──────────────────────────────────────────────── */
function bindZone(zoneEl, handleEl, isLeft){
  let active = false;
  function update(clientY){
    const rect = zoneEl.getBoundingClientRect();
    let t = (clientY - rect.top) / rect.height;
    t = clamp(t, 0, 1);
    /* map zone-Y to bar lever Y: top of zone = lever UP (small Y) */
    const target = BAR_TOP + t * (BAR_BOT - BAR_TOP);
    if(isLeft) leftTargetY = target;
    else       rightTargetY = target;
  }
  zoneEl.addEventListener('touchstart', e => {
    e.preventDefault(); active = true;
    update(e.touches[0].clientY);
  }, {passive:false});
  zoneEl.addEventListener('touchmove', e => {
    if(!active) return;
    e.preventDefault();
    update(e.touches[0].clientY);
  }, {passive:false});
  zoneEl.addEventListener('touchend', () => { active = false; }, {passive:true});
  zoneEl.addEventListener('touchcancel', () => { active = false; }, {passive:true});
  /* desktop mouse drag (just in case) */
  zoneEl.addEventListener('mousedown', e => { active = true; update(e.clientY); });
  document.addEventListener('mousemove', e => { if(active) update(e.clientY); });
  document.addEventListener('mouseup',   () => { active = false; });
}
bindZone(tzLeft,  tzhLeft,  true);
bindZone(tzRight, tzhRight, false);

/* on-canvas touch — left 30% / right 30%, drag up/down */
(function bindCanvasTouch(){
  const drags = {};
  function update(id, x, y){
    const rect = gc.getBoundingClientRect();
    const cx = (x - rect.left) * (W / rect.width);
    const cy = (y - rect.top)  * (H / rect.height);
    /* map canvas-Y (in bar zone) to lever Y */
    let t = (cy - BAR_TOP) / (BAR_BOT - BAR_TOP);
    t = clamp(t, 0, 1);
    const target = BAR_TOP + t * (BAR_BOT - BAR_TOP);
    if(cx < W * 0.3 || drags[id] === 'L'){ leftTargetY = target; drags[id] = 'L'; }
    else if(cx > W * 0.7 || drags[id] === 'R'){ rightTargetY = target; drags[id] = 'R'; }
  }
  gc.addEventListener('touchstart', e => {
    e.preventDefault();
    for(const t of e.changedTouches){
      const rect = gc.getBoundingClientRect();
      const cx = (t.clientX - rect.left) * (W / rect.width);
      drags[t.identifier] = cx < W*0.5 ? 'L' : 'R';
      update(t.identifier, t.clientX, t.clientY);
    }
  }, {passive:false});
  gc.addEventListener('touchmove', e => {
    e.preventDefault();
    for(const t of e.changedTouches){
      if(!(t.identifier in drags)) continue;
      update(t.identifier, t.clientX, t.clientY);
    }
  }, {passive:false});
  function endTouch(e){
    for(const t of e.changedTouches){ delete drags[t.identifier]; }
  }
  gc.addEventListener('touchend', endTouch, {passive:true});
  gc.addEventListener('touchcancel', endTouch, {passive:true});
})();

/* ── GAME FLOW ─────────────────────────────────────────────────────────── */
function resetRun(){
  block = 1; lives = 3; score = 0;
  combo = 1; comboTimer = 0;
  bitcoinIdx = 0;
  claimedPositions = [];
  blockTimeTotal = blockTimeForBlock(block);
  blockTime = blockTimeTotal;
  particles = [];
  pocketedFlashes = [];
  activeHoles = [];
  setActiveHoles();
  resetBall(true);
  setLvlBanner(`BLOCK ${block}`, blockSubtitleForBlock(block), false);
  updateHUD();
}
function blockTimeForBlock(b){
  if(b === 1) return 120;
  if(b === 2) return 100;
  if(b === 3) return 85;
  return Math.max(50, 80 - (b - 3) * 6);
}
function blockGravity(b){
  return Math.min(1900, GRAVITY * (1 + (b - 1) * 0.06));
}
function blockLeverSpeed(b){
  return Math.max(180, LEVER_SPD - (b - 1) * 14);
}
function blockSubtitleForBlock(b){
  if(b === 1) return "Collect all 10 ₿ from bottom to top. Claimed holes become traps!";
  if(b === 2) return "Faster gravity. Every claimed hole will kill you. Stay focused.";
  if(b === 3) return "10 bitcoins, 9 death traps by the end. Controls heavier.";
  return `Block ${b}. 10 ₿ to collect. Claimed holes are permanent death. NGMI?`;
}

function resetBall(fullReset){
  /* on full reset (new run / lost life): re-center the bar.
     On pocket: keep bar where the player has it, drop a new ball at center. */
  if(fullReset){
    leftY  = BAR_CTR_Y;
    rightY = BAR_CTR_Y;
    leftTargetY = BAR_CTR_Y;
    rightTargetY= BAR_CTR_Y;
  }
  const x = W/2;
  ball = { x: x, y: barYAt(x) - BALL_R - BAR_THICK/2, vx: 0, vy: 0, onBar: true, rot: 0 };
  prevBarMidY = (leftY + rightY) / 2;
}

/* ── TARGET / HOLE HELPERS ─────────────────────────────────────────────── */
function setActiveHoles(){
  activeHoles = [];
  if(bitcoinIdx < BITCOIN_PATH.length){
    const p = BITCOIN_PATH[bitcoinIdx];
    activeHoles.push({col:p.col, row:p.row, danger:false, claimed:false});
  }
  for(const d of FIXED_DANGERS){
    activeHoles.push({col:d.col, row:d.row, danger:true, claimed:false});
  }
  for(const c of claimedPositions){
    activeHoles.push({col:c.col, row:c.row, danger:true, claimed:true});
  }
}

function loseLife(msg){
  if(invincibleMs > 0) return;
  lives--;
  SFX.drop();
  shake(14, 380);
  combo = 1; comboTimer = 0;
  spawnExplosion(ball.x, ball.y);
  setStatus(msg || "Dropped! Re-rack…", 's-bad');
  state = STATE.LIFE_LOST;
  lifeLostMs = LIFE_LOST_MS;
  if(lives <= 0){
    setTimeout(gameOver, LIFE_LOST_MS - 100);
  }
  updateHUD();
}
function hitDangerHole(){
  if(invincibleMs > 0) return;
  shake(22, 500);
  loseLife("☠ DANGER HOLE! You fell in!");
}
function gameOver(){
  state = STATE.GAME_OVER;
  SFX.gameOver();
  saveHi();
  goFinal.textContent = score.toLocaleString() + ' sats';
  goRecap.innerHTML =
    `Reached <b style="color:var(--btc)">Block ${block}</b>` +
    ` · Hi-Score <b style="color:var(--gold)">${hiScore.toLocaleString()}</b> sats`;
  gop.style.display = 'block';
  gop.classList.add('show');
  updateHUD();
}

function onPocket(hole){
  const base = 200 + bitcoinIdx * 200;   // ₿#1=200, ₿#10=2000
  const mult = combo;
  const gained = base * mult;
  score += gained;
  combo = Math.min(8, combo + 1);
  comboTimer = COMBO_WIN_MS;
  pocketedFlashes.push({col:hole.col, row:hole.row, ms:0, maxMs:420});
  spawnPocketBurst(hole);
  SFX.pocket();
  if(combo >= 3) SFX.combo();
  claimedPositions.push({col:hole.col, row:hole.row});
  bitcoinIdx++;
  const left = BITCOIN_PATH.length - bitcoinIdx;
  setStatus(
    left > 0
      ? `₿ #${bitcoinIdx} claimed! +${gained.toLocaleString()} sats · ${left} left`
      : `ALL 10 ₿ CLAIMED! +${gained.toLocaleString()} sats 🎉`,
    's-gold'
  );
  pocketFreezeMs = POCKET_FREEZE_MS;
  state = STATE.POCKET;
  hudFlashTimer = 320;
  if(bitcoinIdx >= BITCOIN_PATH.length){
    setTimeout(levelClear, POCKET_FREEZE_MS + 60);
  } else {
    setTimeout(() => {
      if(state === STATE.POCKET){
        setActiveHoles();
        resetBall(true);
        invincibleMs = 350;
        state = STATE.PLAYING;
      }
    }, POCKET_FREEZE_MS);
  }
  updateHUD();
}

function levelClear(){
  state = STATE.LEVEL_CLEAR;
  SFX.level();
  const tBonus = Math.floor(Math.max(0, blockTime) * 200);
  score += tBonus;
  block++;
  bitcoinIdx = 0;
  claimedPositions = [];
  blockTimeTotal = blockTimeForBlock(block);
  blockTime = blockTimeTotal;
  setLvlBanner('ALL 10 ₿ CONFIRMED ✓', `+${tBonus.toLocaleString()} sats · Block ${block} incoming`, true);
  setTimeout(() => {
    setLvlBanner(`BLOCK ${block}`, blockSubtitleForBlock(block), false);
    setTimeout(() => {
      setActiveHoles();
      resetBall(true);
      state = STATE.PLAYING;
      updateHUD();
    }, 700);
  }, LVL_BANNER_MS - 200);
  updateHUD();
}

/* ── PARTICLES ─────────────────────────────────────────────────────────── */
function spawnPocketBurst(hole){
  const pos = holePos(hole.col, hole.row);
  for(let i=0;i<26;i++){
    const a = (Math.PI*2) * (i/26) + Math.random()*0.3;
    const sp = 80 + Math.random()*160;
    particles.push({
      x: pos.x, y: pos.y,
      vx: Math.cos(a)*sp, vy: Math.sin(a)*sp - 30,
      life: 1, decay: 1.2 + Math.random()*0.8,
      r: 2 + Math.random()*2,
      col: Math.random() < 0.6 ? '255,215,0' : '247,147,26'
    });
  }
}
function spawnExplosion(x, y){
  for(let i=0;i<30;i++){
    const a = (Math.PI*2) * (i/30) + Math.random()*0.4;
    const sp = 50 + Math.random()*220;
    particles.push({
      x: x, y: y,
      vx: Math.cos(a)*sp, vy: Math.sin(a)*sp - 60,
      life: 1, decay: 0.9 + Math.random()*0.5,
      r: 2 + Math.random()*3,
      col: Math.random() < 0.5 ? '255,51,85' : '255,170,60'
    });
  }
}

/* ── HUD ───────────────────────────────────────────────────────────────── */
function updateHUD(){
  hScore.textContent = score.toLocaleString();
  hLives.innerHTML = '<span class="lives-row">' +
    (lives > 0 ? Array(lives).fill('<span class="life-coin">₿</span>').join('') : '<span style="color:#4b5563">—</span>') +
    '</span>';
  hBlock.textContent = block;
  hTime.textContent = Math.max(0, Math.ceil(blockTime));
  hCombo.textContent = '×' + combo;
  hCombo.classList.toggle('y', combo > 1);
  hHi.textContent = hiScore.toLocaleString();
  introHi.textContent = 'Best: ' + hiScore.toLocaleString() + ' sats';
  const pct = Math.min(100, (bitcoinIdx / BITCOIN_PATH.length) * 100);
  progFill.style.width = pct + '%';
  progVal.textContent = bitcoinIdx + ' / ' + BITCOIN_PATH.length;
  /* time colour */
  if(blockTime < 10){ hTime.classList.remove('g'); hTime.classList.add('r'); }
  else { hTime.classList.add('g'); hTime.classList.remove('r'); }
}
let statusTimer = 0;
function setStatus(txt, cls){
  gstat.textContent = txt;
  gstat.className = 'gstatus ' + cls;
  statusTimer = 1400;
}

function setLvlBanner(num, sub, confirmed){
  lvlNum.textContent = num;
  lvlSub.textContent = sub;
  lvlNum.classList.toggle('confirmed', !!confirmed);
  lvlSub.classList.toggle('confirmed', !!confirmed);
  lvlBanner.classList.add('show');
  lvlBannerMs = LVL_BANNER_MS;
}

/* ── BG CANVAS — soft floating coins ───────────────────────────────────── */
let bgCoins = [], bgW=0, bgH=0;
function bgInit(){
  if(!bg || !bgx) return;
  bgW = bg.width  = innerWidth;
  bgH = bg.height = innerHeight;
  bgCoins = [];
  const n = Math.min(22, Math.max(8, Math.floor(bgW*bgH/26000)));
  for(let i=0;i<n;i++) bgCoins.push({
    x: Math.random()*bgW, y: Math.random()*bgH,
    s: 14 + Math.random()*22,
    vx: (Math.random()-0.5)*0.25, vy: (Math.random()-0.5)*0.18,
    a: 0.05 + Math.random()*0.10,
    rot: Math.random()*6.28, vr: (Math.random()-0.5)*0.004
  });
}
addEventListener('resize', bgInit);
bgInit();
function bgDraw(){
  if(!bgx) return;
  bgx.fillStyle = 'rgba(6,6,16,0.35)';
  bgx.fillRect(0,0,bgW,bgH);
  /* faint grid */
  bgx.strokeStyle = 'rgba(247,147,26,0.035)';
  bgx.lineWidth = 1;
  const G = 60;
  for(let x=0; x<bgW; x+=G){
    bgx.beginPath(); bgx.moveTo(x,0); bgx.lineTo(x,bgH); bgx.stroke();
  }
  for(let y=0; y<bgH; y+=G){
    bgx.beginPath(); bgx.moveTo(0,y); bgx.lineTo(bgW,y); bgx.stroke();
  }
  /* coins */
  for(const c of bgCoins){
    c.x += c.vx; c.y += c.vy; c.rot += c.vr;
    if(c.x < -40) c.x = bgW + 40;
    if(c.x > bgW + 40) c.x = -40;
    if(c.y < -40) c.y = bgH + 40;
    if(c.y > bgH + 40) c.y = -40;
    bgx.save();
    bgx.translate(c.x, c.y);
    bgx.rotate(c.rot);
    bgx.font = '900 ' + c.s + 'px Orbitron, sans-serif';
    bgx.textAlign='center'; bgx.textBaseline='middle';
    bgx.fillStyle = 'rgba(247,147,26,' + c.a.toFixed(3) + ')';
    bgx.shadowColor = 'rgba(247,147,26,0.45)';
    bgx.shadowBlur = 12;
    bgx.fillText('₿', 0, 0);
    bgx.restore();
  }
}

/* ── RENDER ────────────────────────────────────────────────────────────── */
function drawHexHole(x, y, r){
  ctx.beginPath();
  for(let i=0;i<6;i++){
    const a = Math.PI/2 + i*Math.PI/3;
    const px = x + Math.cos(a)*r, py = y + Math.sin(a)*r;
    i === 0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
  }
  ctx.closePath();
}

function drawBoard(t){
  /* dark backdrop */
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0, '#0a0f1a');
  g.addColorStop(0.6, '#070a13');
  g.addColorStop(1, '#04060b');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);

  /* subtle scanline shimmer */
  ctx.fillStyle = 'rgba(247,147,26,0.012)';
  for(let y=0; y<H; y+=3){ ctx.fillRect(0, y, W, 1); }

  /* ── Pegboard: solid amber cells with SPARSE holes punched through ── */
  const _target = bitcoinIdx < BITCOIN_PATH.length ? BITCOIN_PATH[bitcoinIdx] : null;

  /* Build lookup sets for O(1) checks inside the render loop */
  const _claimedKey = new Set(claimedPositions.map(c => c.col + ',' + c.row));
  const _dangerKey  = new Set(FIXED_DANGERS.map(d => d.col + ',' + d.row));

  for(let row=0; row<GRID_ROWS; row++){
    for(let col=0; col<GRID_COLS; col++){
      const p    = holePos(col, row);
      const key  = col + ',' + row;
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.004 + col + row);

      const isTarget  = _target && col === _target.col && row === _target.row;
      const isClaimed = _claimedKey.has(key);
      const isDanger  = _dangerKey.has(key);
      const isHole    = isTarget || isClaimed || isDanger;

      /* ── 1. Bright amber hex face (solid board surface) ── */
      ctx.fillStyle = isClaimed ? '#5a0008' : isTarget ? '#7a3800' : '#b84a05';
      drawHexHole(p.x, p.y, HEX_R * 0.93);
      ctx.fill();

      /* ── 2. Hex border ── */
      ctx.strokeStyle = isTarget
        ? `rgba(255,215,0,${0.85 + pulse * 0.15})`
        : isClaimed ? `rgba(255,40,40,${0.65 + pulse * 0.25})`
        : 'rgba(255,120,20,0.55)';
      ctx.lineWidth = isTarget ? 2.5 : 1.2;
      drawHexHole(p.x, p.y, HEX_R * 0.93);
      ctx.stroke();

      /* ── 3. Safe cells get a bright centre highlight so they read as SOLID ── */
      if(!isHole){
        ctx.fillStyle = 'rgba(255,130,25,0.22)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - HEX_R * 0.12, HEX_R * 0.42, HEX_R * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      /* ── 4. Deep black pit for every hole — no shadow bleed ── */
      if(isHole){
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(p.x, p.y, HOLE_R * 0.86, 0, Math.PI * 2);
        ctx.fill();
        /* thin coloured rim inside the pit */
        ctx.strokeStyle = isClaimed
          ? `rgba(220,30,30,${0.55 + pulse * 0.30})`
          : isTarget ? `rgba(255,200,0,${0.60 + pulse * 0.30})`
          : `rgba(160,0,15,${0.35 + pulse * 0.20})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, HOLE_R * 0.86, 0, Math.PI * 2);
        ctx.stroke();
      }

      /* ── 5. Target: gold fill + ₿ text, NO wide shadow blur ── */
      if(isTarget){
        ctx.fillStyle = `rgba(255,210,0,${0.70 + pulse * 0.28})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, HOLE_R * 0.78, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3a1800';
        ctx.font = '900 ' + Math.floor(HEX_R * 1.0) + 'px Orbitron,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('₿', p.x, p.y - HEX_R * 0.06);
        ctx.font = '700 ' + Math.floor(HEX_R * 0.38) + 'px Orbitron,sans-serif';
        ctx.fillStyle = `rgba(0,0,0,${0.75 + pulse * 0.15})`;
        ctx.fillText('#' + (bitcoinIdx + 1), p.x, p.y + HEX_R * 0.72);
      } else if(isClaimed){
        ctx.fillStyle = `rgba(255,50,50,${0.70 + pulse * 0.25})`;
        ctx.font = '900 ' + Math.floor(HEX_R * 0.85) + 'px Orbitron,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('✕', p.x, p.y + 1);
      }
    }
  }

  /* pocket flash */
  for(const f of pocketedFlashes){
    const p = holePos(f.col, f.row);
    const k = 1 - f.ms / f.maxMs;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.shadowColor = 'rgba(0,255,136,0.9)';
    ctx.shadowBlur = 26;
    ctx.fillStyle = `rgba(0,255,136,${0.5 * k})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, HOLE_R * (1 + (1-k)*1.4), 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function drawBar(){
  const lx = BAR_LEFT_X, ly = leftY;
  const rx = BAR_RIGHT_X, ry = rightY;
  const ang = barAngle();

  /* posts (visual rails) */
  ctx.strokeStyle = 'rgba(247,147,26,0.10)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(lx, BAR_TOP - 20); ctx.lineTo(lx, BAR_BOT + 20);
  ctx.moveTo(rx, BAR_TOP - 20); ctx.lineTo(rx, BAR_BOT + 20);
  ctx.stroke();

  /* bar body — gradient + chain-link segmentation */
  ctx.save();
  /* translate/rotate so we can draw the bar horizontally */
  const cx = (lx + rx) / 2;
  const cy = (ly + ry) / 2;
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  /* glow */
  ctx.shadowColor = 'rgba(247,147,26,0.75)';
  ctx.shadowBlur = 18;
  /* main bar gradient */
  const g = ctx.createLinearGradient(0, -BAR_THICK/2, 0, BAR_THICK/2);
  g.addColorStop(0, '#5a3208');
  g.addColorStop(0.25, '#F7931A');
  g.addColorStop(0.5, '#FFD700');
  g.addColorStop(0.75, '#F7931A');
  g.addColorStop(1, '#5a3208');
  ctx.fillStyle = g;
  ctx.beginPath();
  const half = BAR_LEN / 2;
  /* rounded rect */
  const r = BAR_THICK / 2;
  ctx.moveTo(-half + r, -BAR_THICK/2);
  ctx.lineTo( half - r, -BAR_THICK/2);
  ctx.quadraticCurveTo(half, -BAR_THICK/2, half, 0);
  ctx.quadraticCurveTo(half,  BAR_THICK/2, half - r, BAR_THICK/2);
  ctx.lineTo(-half + r, BAR_THICK/2);
  ctx.quadraticCurveTo(-half, BAR_THICK/2, -half, 0);
  ctx.quadraticCurveTo(-half,-BAR_THICK/2,-half + r,-BAR_THICK/2);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  /* segmented chain-link grooves */
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.4;
  const segs = 14;
  for(let i = 1; i < segs; i++){
    const x = -half + (BAR_LEN / segs) * i;
    ctx.beginPath();
    ctx.moveTo(x, -BAR_THICK/2 + 1);
    ctx.lineTo(x,  BAR_THICK/2 - 1);
    ctx.stroke();
  }
  /* light reflective top edge */
  ctx.strokeStyle = 'rgba(255,235,170,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-half + r, -BAR_THICK/2 + 1.2);
  ctx.lineTo( half - r, -BAR_THICK/2 + 1.2);
  ctx.stroke();
  ctx.restore();

  /* end caps */
  function endCap(x, y, isLeft){
    ctx.save();
    ctx.shadowColor = 'rgba(247,147,26,0.85)';
    ctx.shadowBlur = 14;
    const rad = BAR_THICK * 0.95;
    const rg = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, rad);
    rg.addColorStop(0, '#FFE07A');
    rg.addColorStop(0.55, '#F7931A');
    rg.addColorStop(1, '#5a3208');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    /* small bolt */
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(x, y, rad * 0.28, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,235,170,0.7)';
    ctx.beginPath(); ctx.arc(x - rad*0.12, y - rad*0.12, rad * 0.10, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
  endCap(lx, ly, true);
  endCap(rx, ry, false);

  /* lever indicator markers on rails */
  ctx.fillStyle = 'rgba(247,147,26,0.35)';
  ctx.beginPath(); ctx.arc(lx, BAR_TOP, 3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(lx, BAR_BOT, 3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(rx, BAR_TOP, 3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(rx, BAR_BOT, 3, 0, Math.PI*2); ctx.fill();
}

function drawBall(){
  if(!ball) return;
  const x = ball.x, y = ball.y;
  /* shadow on bar */
  const by = barYAt(x);
  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, by + BAR_THICK*0.6, BALL_R*0.95, BALL_R*0.4, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  /* glow */
  ctx.save();
  ctx.shadowColor = 'rgba(255,215,0,0.85)';
  ctx.shadowBlur = 18;
  const grd = ctx.createRadialGradient(x - BALL_R*0.4, y - BALL_R*0.4, 1, x, y, BALL_R);
  grd.addColorStop(0,   '#FFF6BF');
  grd.addColorStop(0.35,'#FFD700');
  grd.addColorStop(0.75,'#F7931A');
  grd.addColorStop(1,   '#7a4205');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(x, y, BALL_R, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  /* rim */
  ctx.strokeStyle = 'rgba(120,70,10,0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, BALL_R - 0.8, 0, Math.PI*2); ctx.stroke();

  /* ₿ glyph — rotated with ball rotation */
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ball.rot);
  ctx.fillStyle = '#3a1f04';
  ctx.font = '900 ' + Math.floor(BALL_R * 1.55) + 'px Orbitron, sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('₿', 0, 1);
  ctx.restore();

  /* tiny highlight */
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(x - BALL_R*0.42, y - BALL_R*0.5, BALL_R*0.22, BALL_R*0.12, -0.4, 0, Math.PI*2);
  ctx.fill();
}

function drawParticles(){
  for(const p of particles){
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = `rgba(${p.col},1)`;
    ctx.shadowColor = `rgba(${p.col},0.9)`;
    ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function drawOverlayText(){
  if(state === STATE.PAUSED){
    /* the HTML overlay handles this */
    return;
  }
  /* combo HUD floater on canvas */
  if(combo > 1 && state === STATE.PLAYING){
    ctx.save();
    ctx.globalAlpha = Math.min(1, comboTimer / COMBO_WIN_MS);
    ctx.font = '900 26px Orbitron, sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillStyle = '#FFD700';
    ctx.shadowColor = 'rgba(255,215,0,0.8)'; ctx.shadowBlur = 14;
    ctx.fillText('×' + combo + ' COMBO', W/2, 8);
    ctx.restore();
  }
}

/* ── PHYSICS / UPDATE ──────────────────────────────────────────────────── */
function updateInputs(dt){
  /* read keyboard, accumulate into target Y */
  const step = blockLeverSpeed(block) * dt;
  if(KEYS['q']) leftTargetY -= step;
  if(KEYS['a']) leftTargetY += step;
  if(KEYS['p']) rightTargetY -= step;
  if(KEYS['l']) rightTargetY += step;
  /* arrows = tilt */
  if(KEYS['ArrowLeft']){  leftTargetY -= step; rightTargetY += step; }
  if(KEYS['ArrowRight']){ leftTargetY += step; rightTargetY -= step; }
  leftTargetY  = clamp(leftTargetY,  BAR_TOP, BAR_BOT);
  rightTargetY = clamp(rightTargetY, BAR_TOP, BAR_BOT);
  /* smooth current toward target */
  const smooth = clamp(dt * 12, 0, 1);
  leftY  += (leftTargetY  - leftY)  * smooth;
  rightY += (rightTargetY - rightY) * smooth;
  /* update slider handle visuals */
  function setHandle(h, y){
    if(!h || !h.parentElement) return;
    const rect = h.parentElement.getBoundingClientRect();
    if(rect.height < 10) return;        // hidden on desktop
    const usable = rect.height - 18 - 16;
    const t = clamp((y - BAR_TOP) / (BAR_BOT - BAR_TOP), 0, 1);
    h.style.top = (8 + usable * t) + 'px';
  }
  setHandle(tzhLeft,  leftY);
  setHandle(tzhRight, rightY);
}

function updatePhysics(dt){
  if(!ball) return;

  /* ── Horizontal rolling ── */
  const ang = barAngle();
  ball.vx += Math.sin(ang) * blockGravity(block) * dt;
  ball.vx *= Math.pow(FRICTION, dt * 60);
  ball.x  += ball.vx * dt;
  ball.rot += (ball.vx * dt) / Math.max(BALL_R, 1);

  /* ── Detect bar vertical velocity (mid-point of bar) ── */
  const barMidY = (leftY + rightY) / 2;
  const barVY   = dt > 0 ? (barMidY - prevBarMidY) / dt : 0;
  prevBarMidY   = barMidY;

  const barSurface = barYAt(ball.x) - BALL_R - BAR_THICK / 2;

  /* ── Vertical physics ── */
  if(ball.onBar){
    if(barVY > 480){
      /* bar dropped fast — ball separates (inertia keeps it up) */
      ball.vy   = -barVY * 0.06;
      ball.onBar = false;
    } else if(barVY < -620){
      /* bar pushed up hard — launches ball */
      ball.vy   = barVY * 0.32;
      ball.onBar = false;
    } else {
      /* stick to bar surface */
      ball.y  = barSurface;
      ball.vy = 0;
    }
  }
  if(!ball.onBar){
    ball.vy += 3200 * dt;          /* intense gravity, snaps back fast */
    ball.y  += ball.vy * dt;
    if(ball.y >= barSurface && ball.vy >= 0){
      ball.y  = barSurface;
      ball.vy = 0;
      ball.onBar = true;
    }
  }

  /* ── Ball left the bar horizontally ── */
  if(ball.x < BAR_LEFT_X - 4 || ball.x > BAR_RIGHT_X + 4){
    loseLife();
    return;
  }

  /* ── Hole detection — only sparse active holes, not the full grid ── */
  const catchR = HOLE_R * 0.9;
  for(const h of activeHoles){
    const p  = holePos(h.col, h.row);
    const dx = ball.x - p.x, dy = ball.y - p.y;
    if(dx*dx + dy*dy < catchR * catchR){
      if(!h.danger){ onPocket({col:h.col, row:h.row}); }
      else { hitDangerHole(); }
      return;
    }
  }
}

function updateParticles(dt){
  for(let i = particles.length - 1; i >= 0; i--){
    const p = particles[i];
    p.vx *= 0.96;
    p.vy += 280 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.life -= p.decay * dt;
    if(p.life <= 0) particles.splice(i, 1);
  }
  /* pocket flashes */
  for(let i = pocketedFlashes.length - 1; i >= 0; i--){
    pocketedFlashes[i].ms += dt * 1000;
    if(pocketedFlashes[i].ms >= pocketedFlashes[i].maxMs) pocketedFlashes.splice(i, 1);
  }
}

function updateTimers(dt){
  /* only count down block time during active play */
  if(state === STATE.PLAYING && pocketFreezeMs <= 0 && lifeLostMs <= 0){
    blockTime -= dt;
    /* tick sound on each second past */
    const sec = Math.ceil(blockTime);
    if(sec !== lastSec){
      lastSec = sec;
      if(sec <= 10 && sec > 0) SFX.tick();
    }
    if(blockTime <= 0){
      blockTime = 0;
      /* time up = lose a life */
      if(invincibleMs <= 0) loseLife();
      else blockTime = 0.01;
    }
  }
  if(comboTimer > 0){
    comboTimer -= dt * 1000;
    if(comboTimer <= 0){ combo = 1; comboTimer = 0; }
  }
  if(invincibleMs > 0) invincibleMs -= dt * 1000;
  if(pocketFreezeMs > 0) pocketFreezeMs -= dt * 1000;
  if(lifeLostMs > 0){
    lifeLostMs -= dt * 1000;
    if(lifeLostMs <= 0 && state === STATE.LIFE_LOST && lives > 0){
      resetBall(true);
      invincibleMs = 600;
      /* if timer ran out, give the player a fresh fraction of the block time */
      if(blockTime <= 0) blockTime = Math.max(15, blockTimeTotal * 0.35);
      state = STATE.PLAYING;
      lastSec = -1;
    }
  }
  if(lvlBannerMs > 0){
    lvlBannerMs -= dt * 1000;
    if(lvlBannerMs <= 0){ lvlBanner.classList.remove('show'); }
  }
  if(shakeMs > 0){ shakeMs -= dt * 1000; if(shakeMs < 0){ shakeMs = 0; shakeMag = 0; } }
  if(statusTimer > 0){
    statusTimer -= dt * 1000;
    if(statusTimer <= 0){
      setStatus(`🎮 Steady the bar. Target ₿ #${bitcoinIdx + 1} of 10 — aim for the glow!`, 's-ok');
      statusTimer = -1;
    }
  }
  if(hudFlashTimer > 0) hudFlashTimer -= dt * 1000;

  /* idle ticker rotation */
  tickerNextMs -= dt * 1000;
  if(tickerNextMs <= 0){
    tickerNextMs = 5200;
    tickerIdx = (tickerIdx + 1) % TICKER.length;
    if(idleTicker) idleTicker.innerHTML = '<b>SATOSHI SAYS:</b> ' + TICKER[tickerIdx];
  }
}

/* ── MAIN LOOP ─────────────────────────────────────────────────────────── */
let lastT = performance.now();
function loop(now){
  requestAnimationFrame(loop);
  let dt = (now - lastT) / 1000;
  if(dt > 0.05) dt = 0.05; // clamp big stalls
  lastT = now;

  bgDraw();

  /* update */
  if(state === STATE.PLAYING || state === STATE.LIFE_LOST || state === STATE.POCKET || state === STATE.LEVEL_CLEAR){
    updateInputs(dt);
    updateTimers(dt);
    updateParticles(dt);
    if(state === STATE.PLAYING){
      updatePhysics(dt);
    }
  }
  updateHUD();

  /* draw — with optional shake */
  ctx.save();
  if(shakeMs > 0){
    const k = shakeMs / 380;
    const sx = (Math.random()-0.5) * shakeMag * k;
    const sy = (Math.random()-0.5) * shakeMag * k;
    ctx.translate(sx, sy);
  }

  drawBoard(now);
  drawBar();
  if(state !== STATE.LIFE_LOST) drawBall();
  drawParticles();
  drawOverlayText();

  /* faint vignette */
  const vg = ctx.createRadialGradient(W/2, H*0.45, Math.min(W,H)*0.45, W/2, H/2, Math.max(W,H)*0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0,0,W,H);

  /* invincibility flicker */
  if(invincibleMs > 0 && (Math.floor(now/80) % 2) === 0 && ball){
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R + 4, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}
requestAnimationFrame(loop);

/* ── INITIAL HUD ───────────────────────────────────────────────────────── */
updateHUD();
if(idleTicker) idleTicker.innerHTML = '<b>SATOSHI SAYS:</b> ' + TICKER[0];
