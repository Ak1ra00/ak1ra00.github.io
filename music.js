/* ── Atlas Arcade BGM — procedural chiptune for every game ─────────────── */
/* Auto-detects game from URL, generates a looping retro theme, exposes
   window.BGM = { start, stop, toggle, enabled }. Mutes persisted in
   localStorage as 'btc_bgm_off'. Inserts a 🎵 button next to the existing
   #sndBtn when present, otherwise floats one at top-right. */
(function () {
  'use strict';

  /* Theme presets — each game gets a distinct mood.
     midi root + scale (semitone offsets) + bpm + 16-step melody/bass patterns. */
  const THEMES = {
    pacman:      {root:55, scale:[0,2,4,5,7,9,11], bpm:138, lead:'square',   bass:'square',
                  bassPat:[0,0,4,4,5,5,2,2,0,0,4,4,5,5,7,7],
                  melPat: [7,4,5,7,11,9,7,5,4,5,7,4,2,4,5,2]},
    snake:       {root:48, scale:[0,2,3,5,7,8,10], bpm:96,  lead:'triangle', bass:'square',
                  bassPat:[0,0,0,0,5,5,5,5,3,3,3,3,7,7,7,7],
                  melPat: [0,3,5,7,5,3,2,0,3,5,7,5,3,5,2,0]},
    pong:        {root:45, scale:[0,3,5,7,10],     bpm:108, lead:'square',   bass:'square',
                  bassPat:[0,0,0,0,3,3,3,3,2,2,2,2,4,4,4,4],
                  melPat: [0,2,3,2,0,3,4,3,2,3,4,2,0,2,3,0]},
    invaders:    {root:43, scale:[0,1,3,5,6,8,10], bpm:132, lead:'square',   bass:'sawtooth',
                  bassPat:[0,0,0,0,0,0,0,0,3,3,3,3,2,2,1,1],
                  melPat: [0,3,5,3,0,5,3,1,4,6,4,1,3,5,3,0]},
    flappy:      {root:60, scale:[0,2,4,5,7,9,11], bpm:144, lead:'triangle', bass:'square',
                  bassPat:[0,0,4,4,5,5,3,3,0,0,4,4,5,5,2,2],
                  melPat: [4,7,9,7,11,9,7,4,5,9,11,9,7,5,4,2]},
    tetris:      {root:52, scale:[0,2,3,5,7,8,11], bpm:140, lead:'square',   bass:'square',
                  bassPat:[0,0,4,4,3,3,0,0,5,5,0,0,4,4,3,3],
                  melPat: [7,4,5,7,4,5,3,2,0,2,3,5,7,5,3,2]},
    hashbreaker: {root:46, scale:[0,2,3,5,7,8,10], bpm:128, lead:'square',   bass:'sawtooth',
                  bassPat:[0,0,5,5,3,3,7,7,0,0,5,5,3,3,2,2],
                  melPat: [7,5,3,5,7,8,10,8,7,5,3,2,0,3,5,7]},
    bubbles:     {root:53, scale:[0,2,4,7,9,11],   bpm:118, lead:'triangle', bass:'square',
                  bassPat:[0,0,4,4,2,2,5,5,0,0,4,4,3,3,5,5],
                  melPat: [4,7,9,11,9,7,4,2,4,7,9,7,11,9,7,4]},
    icecold:     {root:50, scale:[0,2,3,5,6,7,10], bpm:104, lead:'triangle', bass:'sawtooth',
                  bassPat:[0,0,0,0,5,5,5,5,3,3,3,3,4,4,4,4],
                  melPat: [0,3,5,3,5,6,5,3,0,3,5,7,6,5,3,2]},
  };

  /* ── pick theme from URL ── */
  const path = location.pathname.toLowerCase();
  let key = null;
  for (const k of Object.keys(THEMES)) { if (path.indexOf(k) >= 0) { key = k; break; } }
  if (!key) return;
  const theme = THEMES[key];

  /* ── audio state ── */
  let ctx = null;
  let masterGain = null;
  let running = false;
  let step = 0;
  let nextNoteTime = 0;
  let lookaheadId = null;
  const LOOKAHEAD_S = 0.12;
  const TICK_MS = 25;

  function loadEnabled(){
    try { return localStorage.getItem('btc_bgm_off') !== '1'; } catch(e){ return true; }
  }
  function saveEnabled(v){
    try { localStorage.setItem('btc_bgm_off', v ? '0' : '1'); } catch(e){}
  }
  let enabled = loadEnabled();

  function ensureCtx(){
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.55;
      masterGain.connect(ctx.destination);
    } catch(e){ ctx = null; }
    return ctx;
  }

  function midiToFreq(m){ return 440 * Math.pow(2, (m - 69) / 12); }
  function degreeToMidi(deg){
    const o = Math.floor(deg / theme.scale.length);
    const i = ((deg % theme.scale.length) + theme.scale.length) % theme.scale.length;
    return theme.root + theme.scale[i] + o * 12;
  }

  function playTone(freq, type, dur, vol, t){
    if (!ctx) return;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  function playNoise(t, vol, dur){
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = vol;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4000;
    src.connect(hp); hp.connect(g); g.connect(masterGain);
    src.start(t);
  }

  function scheduleStep(s, time){
    const stepDur = 60 / theme.bpm / 4;  /* sixteenth */
    /* bass — every step, low octave */
    const bassDeg = theme.bassPat[s % 16] - 7;
    playTone(midiToFreq(degreeToMidi(bassDeg)), theme.bass, stepDur * 1.8, 0.10, time);
    /* lead melody */
    const melDeg = theme.melPat[s % 16];
    playTone(midiToFreq(degreeToMidi(melDeg)), theme.lead, stepDur * 0.95, 0.08, time);
    /* hi-hat on every even sixteenth */
    if (s % 2 === 0) playNoise(time, 0.035, 0.035);
    /* snare on beats 4 and 12 */
    if (s % 16 === 4 || s % 16 === 12) playNoise(time, 0.06, 0.10);
  }

  function tick(){
    if (!running || !ctx) return;
    const stepDur = 60 / theme.bpm / 4;
    while (nextNoteTime < ctx.currentTime + LOOKAHEAD_S){
      scheduleStep(step, nextNoteTime);
      nextNoteTime += stepDur;
      step = (step + 1) % 64;  /* 4-bar loop */
    }
    lookaheadId = setTimeout(tick, TICK_MS);
  }

  function start(){
    if (running || !enabled) return;
    ensureCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    running = true;
    step = 0;
    nextNoteTime = ctx.currentTime + 0.05;
    tick();
    updateBtn();
  }
  function stop(){
    running = false;
    if (lookaheadId) { clearTimeout(lookaheadId); lookaheadId = null; }
    updateBtn();
  }
  function toggle(){
    enabled = !enabled;
    saveEnabled(enabled);
    if (enabled) start(); else stop();
  }

  /* ── UI: 🎵 button placed next to existing #sndBtn ── */
  let btn = null;
  function updateBtn(){
    if (!btn) return;
    btn.textContent = enabled ? '🎵 MUSIC' : '🎵 OFF';
    btn.style.opacity = enabled ? '1' : '0.55';
  }
  function injectButton(){
    if (document.getElementById('bgmBtn')) { btn = document.getElementById('bgmBtn'); updateBtn(); return; }
    const snd = document.getElementById('sndBtn');
    btn = document.createElement('button');
    btn.id = 'bgmBtn';
    btn.type = 'button';
    if (snd) {
      btn.className = snd.className;
      snd.parentNode.insertBefore(btn, snd.nextSibling);
    } else {
      Object.assign(btn.style, {
        position:'fixed', top:'12px', right:'12px', zIndex:9999,
        padding:'6px 10px', background:'rgba(0,0,0,0.65)',
        color:'#F7931A', border:'1px solid #F7931A', borderRadius:'6px',
        font:'700 12px Orbitron,sans-serif', cursor:'pointer'
      });
      document.body.appendChild(btn);
    }
    btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    updateBtn();
  }

  /* ── auto-start on first user gesture ── */
  function firstGesture(){
    document.removeEventListener('pointerdown', firstGesture, true);
    document.removeEventListener('keydown', firstGesture, true);
    if (enabled) start();
  }
  function init(){
    injectButton();
    document.addEventListener('pointerdown', firstGesture, true);
    document.addEventListener('keydown', firstGesture, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.BGM = { start, stop, toggle, get enabled(){ return enabled; } };
})();
