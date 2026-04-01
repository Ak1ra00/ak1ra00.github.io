'use strict';

// ─── SHORTHAND ────────────────────────────────────────────────────────
function mv(dx,dy){ G.movePlayer(dx,dy); }
function e(dx,dy){ G.movePlayer(dx,dy); }

// ─── AUDIO ────────────────────────────────────────────────────────────
let audioCtx=null, soundEnabled=true;

function toggleSound(){
    soundEnabled=!soundEnabled;
    const btn=document.getElementById('sndBtn');
    if(!btn) return;
    btn.textContent=soundEnabled?'🔊 SFX':'🔇 SFX';
    btn.className='snd-btn'+(soundEnabled?'':' off');
    btn.setAttribute('aria-pressed', soundEnabled ? 'true' : 'false');
}
function getAudio(){
    if(!soundEnabled) return null;
    try{
        if(!audioCtx) audioCtx=new(window.AudioContext||window.webkitAudioContext)();
        if(audioCtx.state==='suspended') audioCtx.resume();
        return audioCtx;
    } catch(e){ return null; }
}
function playNote(freq,type='sine',dur=0.15,vol=0.28,t0=0){
    const a=getAudio(); if(!a) return;
    try{
        const osc=a.createOscillator();
        const g=a.createGain();
        osc.connect(g); g.connect(a.destination);
        osc.type=type;
        osc.frequency.setValueAtTime(freq, a.currentTime+t0);
        g.gain.setValueAtTime(vol, a.currentTime+t0);
        g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime+t0+dur);
        osc.start(a.currentTime+t0);
        osc.stop(a.currentTime+t0+dur+0.05);
    } catch(ex){}
}
const SFX={
    collect(){ playNote(880,'sine',0.07,0.22); playNote(1320,'sine',0.09,0.18,0.04); },
    pellet(){ [440,550,660,880].forEach((f,i)=>playNote(f,'square',0.1,0.2,i*0.06)); },
    hit(){  playNote(110,'sawtooth',0.3,0.4); playNote(80,'sawtooth',0.25,0.35,0.08); },
    eatGhost(){ [350,280,210,140].forEach((f,i)=>playNote(f,'sawtooth',0.1,0.35,i*0.08)); },
    levelUp(){ [523,659,784,1047,1319].forEach((f,i)=>playNote(f,'sine',0.14,0.32,i*0.1)); },
    gameOver(){ [400,350,300,250,200,150].forEach((f,i)=>playNote(f,'sawtooth',0.16,0.38,i*0.12)); },
    powerUp(){ [440,554,659,880,1109].forEach((f,i)=>playNote(f,'sine',0.09,0.3,i*0.07)); },
    rage(){ playNote(220,'sawtooth',0.18,0.48); playNote(165,'sawtooth',0.22,0.42,0.12); playNote(110,'square',0.25,0.36,0.24); },
    newEnemy(){ playNote(200,'square',0.18,0.48); playNote(260,'square',0.18,0.48,0.1); playNote(150,'sawtooth',0.28,0.48,0.2); },
    shield(){ [600,800,1000].forEach((f,i)=>playNote(f,'sine',0.1,0.3,i*0.07)); },
    magnet(){ [300,400,500].forEach((f,i)=>playNote(f,'triangle',0.12,0.28,i*0.06)); },
    slowmo(){ [200,160,130].forEach((f,i)=>playNote(f,'triangle',0.15,0.32,i*0.08)); },
    diamond(){ [800,1000,1200,1600].forEach((f,i)=>playNote(f,'sine',0.08,0.32,i*0.05)); },
};

// ─── CONSTANTS ────────────────────────────────────────────────────────
const CELL=20,COLS=40,ROWS=30;
const RAGE_AT=5;
const COINS_PER_LEVEL=15;
const FRIGHT_DURATION=6500;
const MAX_LEVEL=10;

// Enemy specs: baseMs=move interval(ms), chaseProb=chase%, color, unlockCoins
const ESPEC={
    eth:  {baseMs:320, chaseProb:0.58, color:'#627EEA', dark:'#2a3580', sym:'Ξ',  label:'ETH',  unlockCoins:0 },
    xrp:  {baseMs:260, chaseProb:0.65, color:'#00AAE4', dark:'#005580', sym:'✕',  label:'XRP',  unlockCoins:5 },
    doge: {baseMs:270, chaseProb:0.25, color:'#C2A633', dark:'#5a4c10', sym:'Ð',  label:'DOGE', unlockCoins:20},
    sol:  {baseMs:190, chaseProb:0.82, color:'#9945FF', dark:'#4a0080', sym:'◎',  label:'SOL',  unlockCoins:35},
    pepe: {baseMs:370, chaseProb:0.72, color:'#00BB44', dark:'#004422', sym:'🐸', label:'PEPE', unlockCoins:50},
};

// Power-up specs
const PUSPEC={
    shield:  {icon:'🛡️', color:'#00ffff', dur:4500,  desc:'SHIELD',   pts:0   },
    magnet:  {icon:'🧲', color:'#ff69b4', dur:5500,  desc:'MAGNET',   pts:0   },
    slowmo:  {icon:'⏱️', color:'#aaaaff', dur:6000,  desc:'SLOW-MO',  pts:0   },
    diamond: {icon:'💎', color:'#b9f2ff', dur:0,     desc:'+1000 PTS',pts:1000},
};

// ─── MAIN & BACKGROUND CANVAS ─────────────────────────────────────────
const gc=document.getElementById('gc');
const ctx=gc.getContext('2d');
const bg=document.getElementById('bgCanvas');
const bgx=bg.getContext('2d');
let bgW=0,bgH=0;
const bgPts=[];
(function initBg(){
    bgW=bg.width=innerWidth; bgH=bg.height=innerHeight;
    for(let i=0;i<70;i++) bgPts.push({
        x:Math.random()*innerWidth, y:Math.random()*innerHeight,
        vx:(Math.random()-.5)*.28, vy:(Math.random()-.5)*.28,
        r:.6+Math.random()*1.6, a:.08+Math.random()*.38,
        c:Math.random()>.55?'#F7931A':Math.random()>.5?'#627EEA':'#00AAE4'
    });
})();
addEventListener('resize',()=>{bgW=bg.width=innerWidth;bgH=bg.height=innerHeight;});

function drawBg(rage,sr){
    bgx.clearRect(0,0,bgW,bgH);
    const a=.04+sr*.07;
    const g=bgx.createRadialGradient(bgW/2,bgH/2,0,bgW/2,bgH/2,bgW*.75);
    if(rage){g.addColorStop(0,`rgba(255,51,85,${a*2.2})`);g.addColorStop(.6,`rgba(80,0,15,${a})`);g.addColorStop(1,'transparent');}
    else{g.addColorStop(0,`rgba(247,147,26,${a})`);g.addColorStop(.6,`rgba(10,10,50,${a*.5})`);g.addColorStop(1,'transparent');}
    bgx.fillStyle=g; bgx.fillRect(0,0,bgW,bH);
    bgPts.forEach(p=>{
        const spd=rage?2.2:1;
        p.x=(p.x+p.vx*spd+bgW)%bgW; p.y=(p.y+p.vy*spd+bgH)%bgH;
        bgx.save();
        bgx.globalAlpha=p.a*(rage?1.8:1);
        bgx.fillStyle=rage?'#ff3355':p.c;
        bgx.shadowColor=rage?'#ff3355':p.c;
        bgx.shadowBlur=rage?12:5;
        bgx.beginPath();bgx.arc(p.x,p.y,p.r*(1+sr*.4),0,Math.PI*2);bgx.fill();
        bgx.restore();
    });
}

// ─── SCREEN SHAKE ─────────────────────────────────────────────────────
let skX=0,skY=0,skM=0;
function shake(m){skM=Math.max(skM,m);}
function tickShake(){
    if(skM>.5){skX=(Math.random()-.5)*skM;skY=(Math.random()-.5)*skM;skM*=.76;}
    else{skX=0;skY=0;skM=0;}
}

// ─── PARTICLES ────────────────────────────────────────────────────────
let pts=[];
function spawnPts(gx,gy,col,n=14){
    for(let i=0;i<n;i++){
        const a=(Math.PI*2/n)*i+Math.random()*.5;
        const s=1.6+Math.random()*3.6;
        pts.push({x:gx*CELL+CELL/2,y:gy*CELL+CELL/2,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,col,sz:2+Math.random()*3});
    }
}
function spawnRing(gx,gy,col){
    pts.push({ring:true,x:gx*CELL+CELL/2,y:gy*CELL+CELL/2,r:5,life:1,col});
}
function tickPts(dt){
    pts=pts.filter(p=>p.life>0);
    pts.forEach(p=>{
        if(p.ring){p.r+=dt*.11;p.life-=dt*.0032;}
        else{p.x+=p.vx;p.y+=p.vy;p.vx*=.9;p.vy*=.9;p.life-=.038;}
    });
    pts=pts.filter(p=>p.life>0);
}
function drawPts(){
    pts.forEach(p=>{
        ctx.save();ctx.globalAlpha=Math.max(0,p.life);
        if(p.ring){
            const rr=Math.max(0,p.r);
            ctx.strokeStyle=p.col;ctx.lineWidth=2.5;ctx.shadowColor=p.col;ctx.shadowBlur=10;
            ctx.beginPath();ctx.arc(p.x,p.y,rr,0,Math.PI*2);ctx.stroke();
        }else{
            const pr=Math.max(0,p.sz*p.life); if(pr<=0){ctx.restore();return;}
            ctx.fillStyle=p.col;ctx.shadowColor=p.col;ctx.shadowBlur=7;
            ctx.beginPath();ctx.arc(p.x,p.y,pr,0,Math.PI*2);ctx.fill();
        }
        ctx.restore();
    });
}

// ─── FLOATING SCORE LABELS ─────────────────────────────────────────────
let floats=[];
function spawnFloat(gx,gy,txt,col='#FFD700'){
    floats.push({x:gx*CELL+CELL/2,y:gy*CELL-2,txt,col,life:1,vy:-1.3});
}
function tickFloats(){
    floats=floats.filter(f=>f.life>0);
    floats.forEach(f=>{f.y+=f.vy;f.life-=.021;});
}
function drawFloats(){
    floats.forEach(f=>{
        ctx.save();ctx.globalAlpha=f.life;
        ctx.fillStyle=f.col;ctx.shadowColor=f.col;ctx.shadowBlur=12;
        ctx.font=`bold ${Math.round(10+(1-f.life)*5)}px 'Orbitron',monospace`;
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(f.txt,f.x,f.y);
        ctx.restore();
    });
}

// ─── SPINNING BTC COIN ────────────────────────────────────────────────
let coinSpin=0;
function drawBTC(gx,gy){
    coinSpin+=.055;
    const cx=gx*CELL+CELL/2, cy=gy*CELL+CELL/2, r=CELL/2-2;
    const sx=Math.abs(Math.cos(coinSpin));
    ctx.save();
    ctx.translate(cx,cy);ctx.scale(sx,1);
    ctx.shadowColor='#FFD700';ctx.shadowBlur=20+Math.sin(coinSpin*2)*7;
    ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);
    const shim=(Math.cos(coinSpin)+1)/2;
    const gd=ctx.createRadialGradient(-r*.32*shim,-r*.32,1,0,0,r);
    gd.addColorStop(0,'#FFF9C4');gd.addColorStop(.45,'#FFD700');gd.addColorStop(1,'#A67C00');
    ctx.fillStyle=gd;ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=1.5;ctx.stroke();
    ctx.shadowBlur=0;
    if(sx>.28){
        ctx.fillStyle='rgba(0,0,0,.75)';ctx.font=`bold ${Math.round(r*1.12)}px Arial`;
        ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('₿',0,1);
    }
    ctx.restore();
}


// ─── MAZE BUILDER ─────────────────────────────────────────────────────
let wallSet=new Set();
function buildMazeWalls(){
    wallSet.clear();
    const add=(x,y)=>{ if(x>=0&&x<COLS&&y>=0&&y<ROWS) wallSet.add(`${x},${y}`); };
    const rect=(x0,y0,w,h)=>{ for(let dy=0;dy<h;dy++) for(let dx=0;dx<w;dx++) add(x0+dx,y0+dy); };

    // Outer border
    for(let x=0;x<COLS;x++){ add(x,0); add(x,ROWS-1); }
    for(let y=1;y<ROWS-1;y++){ add(0,y); add(COLS-1,y); }

    // ── TOP BLOCKS ──
    rect(2,2,7,3);   rect(31,2,7,3);    // outer top corners  x=2-8, x=31-37
    rect(11,2,8,3);  rect(21,2,8,3);    // inner top blocks   x=11-18, x=21-28

    // ── SECOND TIER ──
    rect(2,6,4,2);   rect(34,6,4,2);    // x=2-5, x=34-37
    rect(8,6,7,2);   rect(25,6,7,2);    // x=8-14, x=25-31

    // ── UPPER HORIZONTAL BARRIERS ──
    rect(2,9,11,2);  rect(27,9,11,2);   // x=2-12, x=27-37, y=9-10

    // ── GHOST HOUSE (centered: cols 16-23, rows 12-18) ──
    for(let x=16;x<=23;x++){ add(x,12); add(x,18); }    // top/bottom rows
    for(let y=13;y<=17;y++){ add(16,y); add(23,y); }    // sides
    // Opening: clear x=19,20 at y=12
    wallSet.delete('19,12'); wallSet.delete('20,12');

    // ── LOWER HORIZONTAL BARRIERS ──
    rect(2,19,11,2); rect(27,19,11,2);  // y=19-20

    // ── SECOND FROM BOTTOM TIER ──
    rect(2,22,4,2);  rect(34,22,4,2);   // x=2-5, x=34-37
    rect(8,22,7,2);  rect(25,22,7,2);   // x=8-14, x=25-31

    // ── BOTTOM BLOCKS ──
    rect(2,25,7,3);  rect(31,25,7,3);   // outer bottom corners
    rect(11,25,8,3); rect(21,25,8,3);   // inner bottom blocks

    return Array.from(wallSet).map(s=>{const[x,y]=s.split(',').map(Number);return{x,y};});
}
function isW(x,y){ return wallSet.has(`${x},${y}`); }
function isInsideGhostHouse(x,y){ return x>=17&&x<=22&&y>=13&&y<=17; }

// ─── ENEMY HELPERS ────────────────────────────────────────────────────
function mkEnemy(type){
    const sp=ESPEC[type];
    let x,y,n=0;
    do{
        x=2+Math.floor(Math.random()*(COLS-4));
        y=2+Math.floor(Math.random()*(ROWS-4));
        n++;
    } while(n<400 && (isW(x,y)||isInsideGhostHouse(x,y)||Math.abs(x-G.px)+Math.abs(y-G.py)<12));
    return{type,x,y,dx:Math.random()>.5?1:-1,dy:Math.random()>.5?1:-1,mt:0,bmi:sp.baseMs,mi:sp.baseMs,bob:Math.random()*Math.PI*2,frightened:false};
}

// Chase movement (toward player)
function moveEnemyChase(en){
    let dx=en.dx, dy=en.dy;
    const sp=ESPEC[en.type];
    const rand=Math.random();

    if(en.type==='pepe'){
        // PEPE: ambush - predicts player position 4 steps ahead
        const ahead=4;
        const tx=G.px+pDir.dx*ahead;
        const ty=G.py+pDir.dy*ahead;
        const fx=tx-en.x, fy=ty-en.y;
        if(rand<sp.chaseProb){
            if(Math.abs(fx)>Math.abs(fy)){dx=fx>0?1:-1;dy=0;}
            else{dx=0;dy=fy>0?1:-1;}
        }
    } else if(en.type==='doge'){
        // DOGE: erratic - mostly random with occasional bursts toward player
        if(rand<sp.chaseProb){
            const fx=G.px-en.x, fy=G.py-en.y;
            if(Math.abs(fx)>Math.abs(fy)){dx=fx>0?1:-1;dy=0;}
            else{dx=0;dy=fy>0?1:-1;}
        } else {
            // random walk
            const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
            const d=dirs[Math.floor(Math.random()*4)];
            dx=d[0];dy=d[1];
        }
    } else {
        // ETH, XRP, SOL: standard chase
        if(rand<sp.chaseProb){
            const fx=G.px-en.x, fy=G.py-en.y;
            if(Math.abs(fx)>Math.abs(fy)){dx=fx>0?1:-1;dy=0;}
            else{dx=0;dy=fy>0?1:-1;}
        }
    }

    let nx=en.x+dx, ny=en.y+dy;
    if(nx<1||nx>=COLS-1){dx*=-1;nx=en.x+dx;}
    if(ny<1||ny>=ROWS-1){dy*=-1;ny=en.y+dy;}
    if(isW(nx,ny)){
        const tdx=dy,tdy=en.dx;
        nx=en.x+tdx;ny=en.y+tdy;
        if(isW(nx,ny)||nx<1||nx>=COLS-1||ny<1||ny>=ROWS-1){en.dx*=-1;en.dy*=-1;return;}
        dx=tdx;dy=tdy;
    }
    en.x=nx;en.y=ny;en.dx=dx;en.dy=dy;
}

// Flee movement (frightened - away from player)
function moveEnemyFlee(en){
    let dx=en.dx,dy=en.dy;
    const fx=en.x-G.px, fy=en.y-G.py;
    if(Math.random()<0.65){
        if(Math.abs(fx)>Math.abs(fy)){dx=fx>0?1:-1;dy=0;}
        else{dx=0;dy=fy>0?1:-1;}
    }
    let nx=en.x+dx,ny=en.y+dy;
    if(nx<1||nx>=COLS-1){dx*=-1;nx=en.x+dx;}
    if(ny<1||ny>=ROWS-1){dy*=-1;ny=en.y+dy;}
    if(isW(nx,ny)){dx=-dx;dy=-dy;nx=en.x+dx;ny=en.y+dy;
        if(isW(nx,ny)||nx<1||nx>=COLS-1||ny<1||ny>=ROWS-1){en.dx*=-1;en.dy*=-1;return;}}
    en.x=nx;en.y=ny;en.dx=dx;en.dy=dy;
}

function lighten(hex,a){
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return `rgb(${Math.min(r+a,255)},${Math.min(g+a,255)},${Math.min(b+a,255)})`;
}

// ─── HI-SCORE ─────────────────────────────────────────────────────────
function loadHs(){try{return JSON.parse(localStorage.getItem('btcpm_hs2')||'[]');}catch{return[];}}
function saveHs(sc,coins,level){
    const a=loadHs();a.push({sc,coins,level});a.sort((x,y)=>y.sc-x.sc);
    const t=a.slice(0,5);try{localStorage.setItem('btcpm_hs2',JSON.stringify(t));}catch{}return t;
}
function renderHs(arr,newSc){
    const md=['🥇','🥈','🥉','4','5'];
    document.getElementById('hsbody').innerHTML=arr.map((s,i)=>
        `<tr class="${i===0?'gr':''}${s.sc===newSc?'nr':''}">
            <td>${md[i]||i+1}</td><td>${s.sc.toLocaleString()}</td><td>${s.coins}🪙</td><td>L${s.level||1}</td>
         </tr>`).join('');
    if(arr.length) document.getElementById('hHi').textContent=arr[0].sc.toLocaleString();
}

// ─── PAC-MAN MOUTH & DIR ──────────────────────────────────────────────
let mA=.2,mD=1,pDir={dx:1,dy:0};

// ─── POWER PELLET POSITIONS ───────────────────────────────────────────
const PELLET_POS=[{x:1,y:1},{x:38,y:1},{x:1,y:28},{x:38,y:28}];

// ─── POWER-UP SPAWN TIMER ─────────────────────────────────────────────
const PU_TYPES=['shield','magnet','slowmo','diamond'];
let puSpawnTimer=0;
const PU_SPAWN_INTERVAL=14000; // ms between power-up spawns

// ─── GAME OBJECT ─────────────────────────────────────────────────────
const G={
    active:false, paused:false, started:false,
    sc:0,coins:0,lives:3,mult:1,streak:0,rage:false,
    inv:false,invT:0,level:1,
    px:19,py:21,
    tx:0,ty:0,
    enemies:[],walls:[],pellets:[],powerups:[],
    effects:{shield:0,magnet:0,slowmo:0},
    frightened:false,frightenedTimer:0,
    respawnQueue:[],
    flash:false,flashCol:'rgba(255,215,0,.07)',
    unlockedTypes:['eth'],

    init(){
        this.active=true;this.paused=false;this.started=true;
        this.sc=0;this.coins=0;this.lives=3;this.mult=1;this.streak=0;
        this.rage=false;this.inv=false;this.invT=0;this.level=1;
        this.px=19;this.py=21;
        this.enemies=[];this.respawnQueue=[];this.powerups=[];
        this.effects={shield:0,magnet:0,slowmo:0};
        this.frightened=false;this.frightenedTimer=0;
        this.unlockedTypes=['eth'];
        puSpawnTimer=PU_SPAWN_INTERVAL;

        this.pellets=PELLET_POS.map(p=>({x:p.x,y:p.y,pulse:Math.random()*Math.PI*2}));
        pts=[];floats=[];pDir={dx:1,dy:0};coinSpin=0;
        this.walls=buildMazeWalls();
        this.spawnBTC();
        this.enemies.push(mkEnemy('eth'));
        this.hud();this.stat('🎮 Game Active – Catch the Bitcoin!','s-ok');
        document.getElementById('gop').style.display='none';
        // legend reset
        ['xrpLi','dogeLi','solLi','pepeLi'].forEach(id=>document.getElementById(id).style.opacity='.3');
        const cw=document.getElementById('cwrap');
        cw.classList.remove('rage');
        document.getElementById('rageRing').classList.remove('on');
        document.getElementById('pauseOverlay').classList.remove('on');
        const pb=document.getElementById('pauseBtn');
        pb.textContent='⏸ PAUSE';pb.classList.remove('paused');
        pb.setAttribute('aria-pressed','false');
        const hs=loadHs();if(hs.length) document.getElementById('hHi').textContent=hs[0].sc.toLocaleString();
        this.updatePuDisplay();
    },

    isW(x,y){ return isW(x,y); },

    spawnBTC(){
        const cells=[];
        for(let y=1;y<ROWS-1;y++) for(let x=1;x<COLS-1;x++)
            if(!isW(x,y)&&!isInsideGhostHouse(x,y)&&Math.abs(x-this.px)+Math.abs(y-this.py)>8) cells.push({x,y});
        if(!cells.length) return;
        const p=cells[Math.floor(Math.random()*cells.length)];
        this.tx=p.x;this.ty=p.y;
    },

    togglePause(){
        if(!this.active) return;
        this.paused=!this.paused;
        const po=document.getElementById('pauseOverlay');
        const pb=document.getElementById('pauseBtn');
        if(this.paused){
            po.classList.add('on');
            pb.textContent='▶ RESUME';
            pb.classList.add('paused');
            pb.setAttribute('aria-pressed','true');
            this.stat('⏸ Game Paused','s-gold');
        } else {
            po.classList.remove('on');
            pb.textContent='⏸ PAUSE';
            pb.classList.remove('paused');
            pb.setAttribute('aria-pressed','false');
            this.stat('🎮 Game Active – Catch the Bitcoin!','s-ok');
        }
    },

    movePlayer(dx,dy){
        if(!this.active||this.paused) return;
        const nx=this.px+dx, ny=this.py+dy;
        if(!isW(nx,ny)&&nx>=0&&nx<COLS&&ny>=0&&ny<ROWS){
            this.px=nx;this.py=ny;pDir={dx,dy};
        }
    },

    loseLife(){
        if(this.inv||this.effects.shield>0) return;
        this.lives--;this.streak=0;
        const hitIdx=this.enemies.findIndex(en=>en.x===this.px&&en.y===this.py);
        if(hitIdx>=0){
            const dead=this.enemies[hitIdx];
            const sp=ESPEC[dead.type];
            spawnPts(dead.x,dead.y,sp.color,18);
            spawnRing(dead.x,dead.y,sp.color);
            this.enemies.splice(hitIdx,1);
            this.respawnQueue.push({type:dead.type, coinsNeeded:this.coins+5});
        }
        if(this.rage){
            this.rage=false;
            document.getElementById('cwrap').classList.remove('rage');
            document.getElementById('rageRing').classList.remove('on');
        }
        this.hud();shake(14);
        SFX.hit();
        const hf=document.getElementById('hitFlash');
        hf.style.opacity='1';setTimeout(()=>hf.style.opacity='0',180);
        if(this.lives<=0){this.over();return;}
        this.inv=true;this.invT=2300;
        this.px=19;this.py=21;
        this.stat(`💔 OUCH! Ghost destroyed – ${this.lives} ${this.lives===1?'life':'lives'} left!`,'s-bad');
        setTimeout(()=>{if(this.active&&!this.paused)this.stat('🎮 Game Active – Catch the Bitcoin!','s-ok');},2000);
    },

    over(){
        this.active=false;shake(22);
        SFX.gameOver();
        document.getElementById('gofinal').textContent=this.sc.toLocaleString();
        const arr=saveHs(this.sc,this.coins,this.level);renderHs(arr,this.sc);
        document.getElementById('gop').style.display='block';
        this.stat('💀 REKT BY SHITCOINS','s-bad');
    },

    stat(msg,cls){
        const el=document.getElementById('gstat');
        el.className='gstatus '+cls;el.textContent=msg;
    },

    activateFrightened(){
        this.frightened=true;
        this.frightenedTimer=FRIGHT_DURATION;
        this.enemies.forEach(en=>{ en.frightened=true; });
        shake(5);SFX.pellet();
        this.stat('💊 POWER PELLET! Eat the shitcoins now!','s-gold');
        spawnFloat(this.px,this.py,'💊 POWER!','#00ff88');
    },

    killEnemy(en){
        const idx=this.enemies.indexOf(en); if(idx<0) return;
        const sp=ESPEC[en.type];
        spawnPts(en.x,en.y,sp.color,20);
        spawnRing(en.x,en.y,sp.color);
        spawnFloat(en.x,en.y,'💀 +500','#00ff88');
        this.sc+=500;this.hud();shake(8);SFX.eatGhost();
        this.enemies.splice(idx,1);
        this.respawnQueue.push({type:en.type, coinsNeeded:this.coins+5});
        this.stat(`💀 ${sp.label} eaten! Respawns in 5 coins…`,'s-gold');
        setTimeout(()=>{ if(this.active&&!this.paused) this.stat('🎮 Game Active – Catch the Bitcoin!','s-ok'); },1800);
    },

    catchBTC(){
        const cx=this.tx,cy=this.ty;
        this.streak++;this.mult=Math.min(this.streak+1,32);
        const pts2=100*this.mult;
        this.sc+=pts2;this.coins++;
        SFX.collect();

        spawnPts(cx,cy,'#FFD700');spawnPts(cx,cy,'#FFF9C4',7);spawnRing(cx,cy,'#FFD700');
        spawnFloat(cx,cy,`+${pts2}`,pts2>=300?'#ff3355':pts2>=200?'#00ff88':'#FFD700');

        const wasRage=this.rage;
        this.rage=this.streak>=RAGE_AT;
        if(this.rage&&!wasRage){
            this.stat('🔥 RAGE MODE – Enemies going berserk!','s-rage');
            document.getElementById('cwrap').classList.add('rage');
            document.getElementById('rageRing').classList.add('on');
            shake(10);SFX.rage();
        }
        this.flash=true;
        this.flashCol=this.rage?'rgba(255,51,85,.06)':'rgba(255,215,0,.07)';

        // Check level up
        if(this.coins>0 && this.coins%COINS_PER_LEVEL===0 && this.level<MAX_LEVEL){
            this.levelUp();
        }

        this.spawnBTC();
        this.hud();
    },

    levelUp(){
        this.level++;
        SFX.levelUp();
        // Speed up all existing enemies by 8%
        this.enemies.forEach(en=>{ en.bmi=Math.max(100, Math.round(en.bmi*0.92)); en.mi=en.bmi; });
        // Show level banner
        const banner=document.getElementById('lvlBanner');
        const lvlNum=document.getElementById('lvlNum');
        const lvlSub=document.getElementById('lvlSub');
        lvlNum.textContent=`LEVEL ${this.level}`;

        // Unlock new enemy types
        let newType=null;
        if(this.level===2&&!this.unlockedTypes.includes('xrp')){ newType='xrp'; }
        else if(this.level===3&&!this.unlockedTypes.includes('doge')){ newType='doge'; }
        else if(this.level>=4&&!this.unlockedTypes.includes('sol')){ newType='sol'; }
        else if(this.level>=5&&!this.unlockedTypes.includes('pepe')){ newType='pepe'; }

        if(newType){
            this.unlockedTypes.push(newType);
            lvlSub.textContent=`⚠️ ${ESPEC[newType].label} HAS ENTERED THE MAZE!`;
        } else {
            lvlSub.textContent='🔥 ENEMIES ARE FASTER!';
        }

        banner.classList.add('show');
        setTimeout(()=>{ banner.classList.remove('show'); },2500);

        if(newType){
            const ne=mkEnemy(newType);
            this.enemies.push(ne);
            spawnPts(ne.x,ne.y,ESPEC[newType].color,10);
            spawnFloat(ne.x,ne.y,`⚠️ ${ESPEC[newType].label}!`,ESPEC[newType].color);
            const legId={xrp:'xrpLi',doge:'dogeLi',sol:'solLi',pepe:'pepeLi'}[newType];
            if(legId) document.getElementById(legId).style.opacity='1';
            SFX.newEnemy();
            this.stat(`⚠️ LEVEL ${this.level} – ${ESPEC[newType].label} UNLOCKED!`,'s-rage');
            setTimeout(()=>{ if(this.active&&!this.paused) this.stat('🎮 Game Active – Catch the Bitcoin!','s-ok'); },2800);
        } else {
            this.stat(`🚀 LEVEL ${this.level} – Enemies faster!`,'s-gold');
            setTimeout(()=>{ if(this.active&&!this.paused) this.stat('🎮 Game Active – Catch the Bitcoin!','s-ok'); },1800);
        }
        this.hud();
    },

    pickupPowerup(pu){
        const idx=this.powerups.indexOf(pu); if(idx<0) return;
        const spec=PUSPEC[pu.type];
        this.powerups.splice(idx,1);
        spawnPts(pu.x,pu.y,spec.color,16);
        spawnRing(pu.x,pu.y,spec.color);
        spawnFloat(pu.x,pu.y,spec.icon+' '+spec.desc,spec.color);
        shake(5);

        if(pu.type==='shield'){ this.effects.shield=spec.dur; SFX.shield(); this.stat('🛡️ SHIELD ACTIVE! Invincible!','s-cyan'); }
        else if(pu.type==='magnet'){ this.effects.magnet=spec.dur; SFX.magnet(); this.stat('🧲 MAGNET! BTC attracted to you!','s-cyan'); }
        else if(pu.type==='slowmo'){ this.effects.slowmo=spec.dur; SFX.slowmo(); this.stat('⏱️ SLOW-MO! Enemies slowed!','s-cyan'); }
        else if(pu.type==='diamond'){ this.sc+=spec.pts; SFX.diamond(); this.stat('💎 DIAMOND! +1000 points!','s-gold'); spawnFloat(pu.x,pu.y,'💎 +1000','#b9f2ff'); }

        this.flash=true;this.flashCol='rgba(0,255,255,.07)';
        this.hud();
        setTimeout(()=>{ if(this.active&&!this.paused&&pu.type!=='diamond') this.stat('🎮 Game Active – Catch the Bitcoin!','s-ok'); },2200);
        this.updatePuDisplay();
    },

    updatePuDisplay(){
        const wrap=document.getElementById('puDisplay');
        const badges=document.getElementById('puBadges');
        const active=[];
        if(this.effects.shield>0) active.push({type:'shield',t:this.effects.shield,max:PUSPEC.shield.dur});
        if(this.effects.magnet>0) active.push({type:'magnet',t:this.effects.magnet,max:PUSPEC.magnet.dur});
        if(this.effects.slowmo>0) active.push({type:'slowmo',t:this.effects.slowmo,max:PUSPEC.slowmo.dur});
        if(active.length===0){wrap.classList.remove('show');return;}
        wrap.classList.add('show');
        badges.innerHTML=active.map(a=>{
            const sp=PUSPEC[a.type];
            const pct=Math.round((a.t/a.max)*100);
            return `<div class="pu-badge">${sp.icon} ${sp.desc} <div class="pu-bar"><div class="pu-bar-fill" style="width:${pct}%"></div></div></div>`;
        }).join('');
    },

    update(dt){
        if(!this.active||this.paused) return;
        if(this.inv){this.invT-=dt;if(this.invT<=0)this.inv=false;}

        // Tick power-up effects
        let puChanged=false;
        ['shield','magnet','slowmo'].forEach(k=>{
            if(this.effects[k]>0){ this.effects[k]-=dt; if(this.effects[k]<=0){this.effects[k]=0;puChanged=true;} }
        });
        if(puChanged) this.updatePuDisplay();

        // Power-up spawn timer
        puSpawnTimer-=dt;
        if(puSpawnTimer<=0){
            puSpawnTimer=PU_SPAWN_INTERVAL+(Math.random()-0.5)*4000;
            this.spawnRandomPowerup();
        }
        // Power-up pickup check
        const puHit=this.powerups.find(p=>p.x===this.px&&p.y===this.py);
        if(puHit) this.pickupPowerup(puHit);
        // Power-up expiry
        this.powerups=this.powerups.filter(p=>{ p.ttl-=dt; p.pulse=(p.pulse||0)+0.1; return p.ttl>0; });

        // Frightened countdown
        if(this.frightened){
            this.frightenedTimer-=dt;
            if(this.frightenedTimer<=0){
                this.frightened=false;
                this.enemies.forEach(en=>{ en.frightened=false; });
                if(!this.rage) this.stat('🎮 Game Active – Catch the Bitcoin!','s-ok');
            }
        }

        // Mouth animation
        mA+=.07*mD; if(mA>=.38)mD=-1; if(mA<=.03)mD=1;

        // Pellet pulse
        this.pellets.forEach(p=>{ p.pulse=(p.pulse||0)+0.08; });

        // BTC is stationary — sits still until player catches it
        // Magnet effect nudges it one step toward player occasionally
        if(this.effects.magnet>0 && Math.random()<0.06){
            const mdx=this.px>this.tx?1:this.px<this.tx?-1:0;
            const mdy=this.py>this.ty?1:this.py<this.ty?-1:0;
            const nx=this.tx+(mdx!==0?mdx:0);
            const ny=this.ty+(mdx===0?mdy:0);
            if(!isW(nx,ny)&&!isInsideGhostHouse(nx,ny)&&nx>0&&nx<COLS-1&&ny>0&&ny<ROWS-1){
                this.tx=nx;this.ty=ny;
            }
        }

        // Catch BTC
        if(this.px===this.tx&&this.py===this.ty) this.catchBTC();

        // Pick up power pellet
        const pi=this.pellets.findIndex(p=>p.x===this.px&&p.y===this.py);
        if(pi>=0){ this.pellets.splice(pi,1); this.activateFrightened(); }

        // Enemy movement
        const slowFactor=this.effects.slowmo>0?2.2:1;
        const rageFactor=this.rage?.48:1;
        const toKill=[];
        this.enemies.forEach(en=>{
            const speed=en.frightened?en.bmi*2.2:en.bmi*rageFactor*slowFactor;
            en.mt+=dt;
            if(en.mt>=speed){
                en.mt=0;
                if(en.frightened) moveEnemyFlee(en);
                else moveEnemyChase(en);
            }
            if(en.x===this.px&&en.y===this.py){
                if(en.frightened) toKill.push(en);
                else this.loseLife();
            }
        });
        toKill.forEach(en=>this.killEnemy(en));

        // Respawn queue
        this.respawnQueue=this.respawnQueue.filter(r=>{
            if(this.coins>=r.coinsNeeded){
                const ne=mkEnemy(r.type);
                this.enemies.push(ne);
                spawnPts(ne.x,ne.y,ESPEC[r.type].color,10);
                spawnFloat(ne.x,ne.y,ESPEC[r.type].sym+' BACK!',ESPEC[r.type].color);
                this.stat(`👻 ${ESPEC[r.type].label} respawned!`,'s-bad');
                setTimeout(()=>{ if(this.active&&!this.paused) this.stat('🎮 Game Active – Catch the Bitcoin!','s-ok'); },1800);
                return false;
            }
            return true;
        });

        tickPts(dt);tickFloats();tickShake();
    },

    spawnRandomPowerup(){
        const cells=[];
        for(let y=2;y<ROWS-2;y++) for(let x=2;x<COLS-2;x++)
            if(!isW(x,y)&&!isInsideGhostHouse(x,y)&&Math.abs(x-this.px)+Math.abs(y-this.py)>5) cells.push({x,y});
        if(!cells.length) return;
        const p=cells[Math.floor(Math.random()*cells.length)];
        const type=PU_TYPES[Math.floor(Math.random()*PU_TYPES.length)];
        this.powerups.push({x:p.x,y:p.y,type,ttl:8000,pulse:0});
    },

    hud(){
        document.getElementById('hScore').textContent=this.sc.toLocaleString();
        document.getElementById('hMult').textContent='×'+this.mult;
        document.getElementById('hCoins').textContent=this.coins;
        document.getElementById('hLevel').textContent=this.level;
        const h=['❤️','❤️','❤️'].map((_,i)=>i<this.lives?'❤️':'🖤').join('');
        document.getElementById('hLives').textContent=h;
        const sr=Math.min(this.streak/RAGE_AT,1);
        document.getElementById('sbarFill').style.width=(sr*100)+'%';
        document.getElementById('rageVal').textContent=this.streak+' / '+RAGE_AT;
        document.getElementById('rageLabel').textContent=this.rage?'🔥 RAGE MODE':'😎 Streak Power';
    },

    draw(){
        ctx.save();ctx.translate(skX,skY);
        ctx.fillStyle='#060610';ctx.fillRect(-12,-12,gc.width+24,gc.height+24);

        // Walls
        this.walls.forEach(w=>{
            ctx.fillStyle='#0a1228';
            ctx.fillRect(w.x*CELL+1,w.y*CELL+1,CELL-2,CELL-2);
            ctx.strokeStyle='rgba(40,80,180,.18)';
            ctx.lineWidth=1;
            ctx.strokeRect(w.x*CELL+1,w.y*CELL+1,CELL-2,CELL-2);
        });

        // Ghost house glow
        ctx.save();
        ctx.strokeStyle='rgba(247,147,26,0.12)';
        ctx.lineWidth=2;
        ctx.shadowColor='rgba(247,147,26,0.2)';
        ctx.shadowBlur=8;
        ctx.strokeRect(16*CELL,12*CELL,8*CELL,7*CELL);
        ctx.restore();

        // Power pellets
        this.pellets.forEach(p=>{
            const cx=p.x*CELL+CELL/2, cy=p.y*CELL+CELL/2;
            const pulse=Math.sin(p.pulse||0);
            const r=4+pulse*1.5;
            ctx.save();
            ctx.shadowColor='#00ff88';ctx.shadowBlur=12+pulse*8;
            ctx.fillStyle='#00ff88';ctx.globalAlpha=0.85+pulse*0.15;
            ctx.beginPath();ctx.arc(cx,cy,Math.max(0.5,r),0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#ffffff';ctx.shadowBlur=4;
            ctx.beginPath();ctx.arc(cx,cy,Math.max(0.5,r*0.45),0,Math.PI*2);ctx.fill();
            ctx.restore();
        });

        // Power-up items on board
        this.powerups.forEach(pu=>{
            const cx=pu.x*CELL+CELL/2, cy=pu.y*CELL+CELL/2;
            const spec=PUSPEC[pu.type];
            const pulse=Math.sin(pu.pulse||0);
            const r=CELL/2-2+pulse*1.5;
            const alpha=pu.ttl<2000?0.4+Math.sin(Date.now()*0.008)*0.4:1;
            ctx.save();
            ctx.globalAlpha=alpha;
            ctx.shadowColor=spec.color;ctx.shadowBlur=14+pulse*6;
            ctx.fillStyle=spec.color;
            ctx.beginPath();ctx.arc(cx,cy,Math.max(1,r),0,Math.PI*2);ctx.fill();
            ctx.fillStyle='rgba(0,0,0,0.6)';
            ctx.beginPath();ctx.arc(cx,cy,Math.max(1,r*0.85),0,Math.PI*2);ctx.fill();
            ctx.font=`${Math.round(CELL*0.7)}px Arial`;
            ctx.textAlign='center';ctx.textBaseline='middle';
            ctx.globalAlpha=alpha;
            ctx.fillText(spec.icon,cx,cy+1);
            ctx.restore();
        });

        drawBTC(this.tx,this.ty);

        this.enemies.forEach(en=>this.drawEnemy(en));
        this.drawPac();
        drawPts();drawFloats();

        if(this.flash){
            ctx.fillStyle=this.flashCol;
            ctx.fillRect(0,0,gc.width,gc.height);
            this.flash=false;
        }
        ctx.restore();
    },

    drawPac(){
        if(this.inv&&Math.floor(Date.now()/115)%2===0) return;
        const cx=this.px*CELL+CELL/2, cy=this.py*CELL+CELL/2, r=Math.max(1,CELL/2-2);
        let rot=0;
        if(pDir.dx===1)  rot=0;
        if(pDir.dx===-1) rot=Math.PI;
        if(pDir.dy===-1) rot=-Math.PI/2;
        if(pDir.dy===1)  rot=Math.PI/2;
        ctx.save();ctx.translate(cx,cy);ctx.rotate(rot);

        // Shield glow
        if(this.effects.shield>0){
            ctx.shadowColor='#00ffff';ctx.shadowBlur=22+Math.sin(Date.now()*0.006)*8;
            ctx.strokeStyle='rgba(0,255,255,0.5)';ctx.lineWidth=2;
            ctx.beginPath();ctx.arc(0,0,r+4,0,Math.PI*2);ctx.stroke();
        } else {
            ctx.shadowColor='#FFD700';ctx.shadowBlur=18;
        }

        const gd=ctx.createRadialGradient(-r*.3,-r*.3,1,0,0,r);
        gd.addColorStop(0,'#FFF176');gd.addColorStop(.55,'#FFD700');gd.addColorStop(1,'#E65100');
        ctx.fillStyle=gd;
        ctx.beginPath();ctx.moveTo(0,0);
        ctx.arc(0,0,r,mA*Math.PI,(2-mA)*Math.PI);
        ctx.closePath();ctx.fill();
        ctx.shadowBlur=0;
        ctx.fillStyle='#1a1a00';
        ctx.beginPath();ctx.arc(Math.max(0,r*.15),Math.max(-r,-(r*.44)),2.2,0,Math.PI*2);ctx.fill();
        ctx.restore();
    },

    drawEnemy(en){
        const t=Date.now()/1000;
        const sp=ESPEC[en.type];
        const bob=Math.sin(t*3.2+en.bob)*2.5;
        const cx=en.x*CELL+CELL/2, cy=en.y*CELL+CELL/2+bob, r=CELL/2-1;

        const nearEnd=this.frightened&&this.frightenedTimer<2000;
        const flashOn=nearEnd&&Math.floor(Date.now()/200)%2===0;

        let col,dark,sym;
        if(en.frightened){
            col=flashOn?'#ffffff':'#1a1aff';
            dark=flashOn?'#aaaaaa':'#000088';
            sym='?';
        } else {
            col=sp.color; dark=sp.dark; sym=sp.sym;
        }

        ctx.save();
        ctx.shadowColor=en.frightened?(flashOn?'#fff':'#0000ff'):(this.rage?'#ff3355':col);
        ctx.shadowBlur=en.frightened?14:(this.rage?20:12);

        // Ghost body
        ctx.beginPath();
        ctx.arc(cx,cy-2,r,Math.PI,0);
        ctx.lineTo(cx+r,cy+r);
        const ww=r*2/3;
        for(let i=0;i<3;i++){
            const bx=cx+r-ww*i;
            ctx.quadraticCurveTo(bx-ww/2,cy+r+(i%2===0?6.5:-2),bx-ww,cy+r);
        }
        ctx.closePath();

        const gg=ctx.createLinearGradient(cx-r,cy-r,cx+r,cy+r);
        if(en.frightened){
            gg.addColorStop(0,flashOn?'#ffffff':'#4444ff');
            gg.addColorStop(1,flashOn?'#aaaaaa':'#000066');
        } else if(this.rage){
            gg.addColorStop(0,'#ff6680');gg.addColorStop(1,col);
        } else {
            gg.addColorStop(0,lighten(col,42));gg.addColorStop(1,dark);
        }
        ctx.fillStyle=gg;ctx.fill();
        ctx.shadowBlur=0;

        if(en.frightened){
            ctx.fillStyle='#fff';
            ctx.beginPath();
            ctx.arc(cx-3,cy-3,2.5,0,Math.PI*2);
            ctx.arc(cx+3,cy-3,2.5,0,Math.PI*2);
            ctx.fill();
            ctx.strokeStyle='#fff';ctx.lineWidth=1.5;
            ctx.beginPath();ctx.moveTo(cx-5,cy+3);
            ctx.quadraticCurveTo(cx-2,cy+1,cx,cy+3);
            ctx.quadraticCurveTo(cx+2,cy+1,cx+5,cy+3);
            ctx.stroke();
        } else {
            ctx.fillStyle='#fff';
            ctx.beginPath();
            ctx.ellipse(cx-4,cy-5,3.2,4.2,0,0,Math.PI*2);
            ctx.ellipse(cx+4,cy-5,3.2,4.2,0,0,Math.PI*2);
            ctx.fill();
            const edx=G.px>en.x?1.2:-1.2, edy=G.py>en.y?1.2:-1.2;
            ctx.fillStyle=dark;
            ctx.beginPath();
            ctx.arc(cx-4+edx,cy-5+edy,1.6,0,Math.PI*2);
            ctx.arc(cx+4+edx,cy-5+edy,1.6,0,Math.PI*2);
            ctx.fill();
            // Symbol label
            ctx.fillStyle='rgba(255,255,255,.9)';
            ctx.font='bold 8px Arial';
            ctx.textAlign='center';ctx.textBaseline='middle';
            ctx.fillText(sym==='🐸'?'🐸':sym,cx,cy+4);
        }
        ctx.restore();
    },

    restart(){ this.init(); }
};

// ─── INTRO SCREEN ─────────────────────────────────────────────────────
function startGame(){
    if(G.started) return;
    // init audio context on first user gesture
    getAudio();
    const introEl=document.getElementById('intro');
    introEl.classList.add('fade');
    setTimeout(()=>{ introEl.style.display='none'; G.init(); },700);
}

// Show best score on intro
(function(){
    const hs=loadHs();
    if(hs.length) document.getElementById('introHi').textContent='Best: '+hs[0].sc.toLocaleString();
})();

// ─── KEYBOARD ─────────────────────────────────────────────────────────
document.addEventListener('keydown',ev=>{
    if(!G.started){
        if(ev.key!=='F5'&&ev.key!=='F12') startGame();
        return;
    }
    switch(ev.key){
        case'ArrowUp':    ev.preventDefault();G.movePlayer(0,-1); break;
        case'ArrowDown':  ev.preventDefault();G.movePlayer(0,1);  break;
        case'ArrowLeft':  ev.preventDefault();G.movePlayer(-1,0); break;
        case'ArrowRight': ev.preventDefault();G.movePlayer(1,0);  break;
        case'p': case'P': case'Escape': G.togglePause(); break;
    }
});

// Touch to start
document.getElementById('intro').addEventListener('touchstart',()=>startGame(),{passive:true});
document.getElementById('intro').addEventListener('click',()=>startGame());
document.addEventListener('dblclick',e=>e.preventDefault(),true);

// ─── GAME LOOP ─────────────────────────────────────────────────────────
let lastTs=0;
function loop(ts){
    const dt=Math.min(ts-lastTs,50); lastTs=ts;
    const sr=G.started?Math.min(G.streak/RAGE_AT,1):0;
    if(!G.paused||!G.started) drawBg(G.rage&&G.started,sr);
    if(G.started){
        G.update(dt);
        G.draw();
        if(G.active) G.updatePuDisplay();
    }
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
