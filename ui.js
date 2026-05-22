/* ── Atlas Arcade — shared UI layer ────────────────────────────────────────
   Injects: fullscreen button, CRT scanline toggle, mobile game drawer,
   and a 🏆 NEW BEST! flash helper (call window.UI.flashNewBest()).
   Zero dependencies. Works on all 9 game pages.                           */
(function () {
  'use strict';

  const GAMES = [
    {href:'pacman.html',    name:'PAC-MAN'},
    {href:'snake.html',     name:'SNAKE'},
    {href:'pong.html',      name:'PONG'},
    {href:'invaders.html',  name:'INVADERS'},
    {href:'flappy.html',    name:'FLAPPY'},
    {href:'tetris.html',    name:'TETRIS'},
    {href:'hashbreaker.html',name:'HASHBREAKER'},
    {href:'bubbles.html',   name:'BUBBLES'},
    {href:'icecold.html',   name:'ICE COLD ₿'},
  ];

  /* ── styles ── */
  const css = `
    /* shared ui buttons in fixed position */
    #uiBar {
      position:fixed; top:10px; right:10px; z-index:9990;
      display:flex; gap:6px; align-items:center;
    }
    .ui-btn {
      font-family:'Orbitron',monospace;
      background:rgba(6,6,22,.82); border:1px solid rgba(247,147,26,.4);
      color:#F7931A; border-radius:7px; cursor:pointer;
      height:30px; padding:0 9px; font-size:.6rem; letter-spacing:.06em;
      display:flex; align-items:center; gap:4px;
      transition:background .15s, border-color .15s;
      white-space:nowrap; backdrop-filter:blur(8px);
    }
    .ui-btn:hover { background:rgba(247,147,26,.14); border-color:rgba(247,147,26,.7); }
    .ui-btn.off { opacity:.42; }
    /* hide desktop buttons on very small screens; hamburger takes over */
    @media(max-width:600px){ #uiFs,#uiScan { display:none; } }

    /* mobile hamburger */
    #uiHam {
      display:none;
      font-family:'Orbitron',monospace;
      background:rgba(6,6,22,.92); border:1px solid rgba(247,147,26,.5);
      color:#F7931A; border-radius:8px; cursor:pointer;
      width:36px; height:36px; font-size:1.1rem;
      align-items:center; justify-content:center;
      backdrop-filter:blur(10px);
    }
    @media(max-width:600px){ #uiHam { display:flex; } }

    /* game drawer */
    #uiDrawerBg {
      position:fixed; inset:0; z-index:9991;
      background:rgba(0,0,0,.52); opacity:0; pointer-events:none;
      transition:opacity .22s;
    }
    #uiDrawerBg.on { opacity:1; pointer-events:auto; }
    #uiDrawer {
      position:fixed; top:0; right:0; bottom:0; width:min(260px,88vw);
      z-index:9992; background:rgba(5,5,18,.97);
      border-left:1px solid rgba(247,147,26,.25);
      backdrop-filter:blur(24px);
      display:flex; flex-direction:column; padding:16px 10px 24px;
      transform:translateX(105%); transition:transform .24s cubic-bezier(.25,.46,.45,.94);
      gap:3px;
    }
    #uiDrawer.on { transform:translateX(0); }
    #uiDrawer .dr-head {
      font-family:'Orbitron',monospace; font-size:.8rem; color:#F7931A;
      letter-spacing:.1em; padding:4px 8px 12px;
      border-bottom:1px solid rgba(247,147,26,.2); margin-bottom:6px;
      display:flex; justify-content:space-between; align-items:center;
    }
    #uiDrawer .dr-close {
      background:none; border:none; color:#6b7280; cursor:pointer;
      font-size:1.1rem; line-height:1; padding:0 2px;
    }
    #uiDrawer a {
      font-family:'Orbitron',monospace; font-size:.68rem; color:#6b7280;
      text-decoration:none; padding:9px 10px; border-radius:7px;
      border:1px solid transparent; transition:all .14s; letter-spacing:.05em;
    }
    #uiDrawer a:hover { color:#F7931A; background:rgba(247,147,26,.07); border-color:rgba(247,147,26,.22); }
    #uiDrawer a.cur { color:#F7931A; border-color:rgba(247,147,26,.3); }
    #uiDrawer .dr-home {
      margin-bottom:6px; color:#9ca3af;
      border-bottom:1px solid rgba(247,147,26,.12); padding-bottom:10px;
    }

    /* 🏆 new-best flash */
    #uiNewBest {
      position:fixed; top:18%; left:50%; transform:translateX(-50%) scale(.6);
      z-index:9993; pointer-events:none; opacity:0;
      font-family:'Orbitron',monospace; font-weight:900;
      font-size:clamp(1.4rem,6vw,2.4rem); color:#FFD700;
      text-shadow:0 0 28px rgba(255,215,0,.9),0 0 56px rgba(255,215,0,.5);
      letter-spacing:.08em; white-space:nowrap;
      transition:opacity .25s, transform .35s cubic-bezier(.34,1.56,.64,1);
    }
    #uiNewBest.show { opacity:1; transform:translateX(-50%) scale(1); }
    #uiNewBest.gone { opacity:0; transform:translateX(-50%) scale(.8); transition:opacity .4s,transform .4s; }
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ── Scanline state ── */
  let scanOn = localStorage.getItem('ui_scan') !== '0';
  function applyScan() {
    const el = document.querySelector('.scanlines');
    if (el) el.style.display = scanOn ? '' : 'none';
  }

  /* ── Fullscreen ── */
  function toggleFS() {
    if (!document.fullscreenElement) {
      (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)
        .call(document.documentElement).catch(() => {});
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document).catch(() => {});
    }
  }

  /* ── Determine active game ── */
  const pagePath = location.pathname.toLowerCase();

  /* ── Build UI ── */
  function build() {
    applyScan();

    /* fixed bar (desktop) */
    const bar = document.createElement('div');
    bar.id = 'uiBar';

    const fsBtn = document.createElement('button');
    fsBtn.id = 'uiFs'; fsBtn.className = 'ui-btn';
    fsBtn.innerHTML = '⛶ FULL'; fsBtn.title = 'Toggle fullscreen';
    fsBtn.addEventListener('click', toggleFS);

    const scanBtn = document.createElement('button');
    scanBtn.id = 'uiScan'; scanBtn.className = 'ui-btn' + (scanOn ? '' : ' off');
    scanBtn.textContent = 'CRT'; scanBtn.title = 'Toggle CRT scanlines';
    scanBtn.addEventListener('click', () => {
      scanOn = !scanOn;
      localStorage.setItem('ui_scan', scanOn ? '1' : '0');
      applyScan();
      scanBtn.classList.toggle('off', !scanOn);
    });

    bar.appendChild(fsBtn);
    bar.appendChild(scanBtn);
    document.body.appendChild(bar);

    /* hamburger */
    const ham = document.createElement('button');
    ham.id = 'uiHam'; ham.textContent = '☰';
    ham.setAttribute('aria-label', 'Open game menu');
    document.body.appendChild(ham);

    /* drawer overlay */
    const bg = document.createElement('div');
    bg.id = 'uiDrawerBg';
    document.body.appendChild(bg);

    /* drawer */
    const drawer = document.createElement('div');
    drawer.id = 'uiDrawer';

    const head = document.createElement('div');
    head.className = 'dr-head';
    head.innerHTML = '₿ ARCADE';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'dr-close'; closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Close menu');
    head.appendChild(closeBtn);
    drawer.appendChild(head);

    const homeLink = document.createElement('a');
    homeLink.href = 'index.html'; homeLink.className = 'dr-home';
    homeLink.textContent = '← HOME';
    drawer.appendChild(homeLink);

    GAMES.forEach(g => {
      const a = document.createElement('a');
      a.href = g.href; a.textContent = g.name;
      if (pagePath.includes(g.href.replace('.html', ''))) a.className = 'cur';
      drawer.appendChild(a);
    });
    document.body.appendChild(drawer);

    function openDrawer()  { drawer.classList.add('on'); bg.classList.add('on'); }
    function closeDrawer() { drawer.classList.remove('on'); bg.classList.remove('on'); }
    ham.addEventListener('click', openDrawer);
    closeBtn.addEventListener('click', closeDrawer);
    bg.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

    /* new-best element */
    const nb = document.createElement('div');
    nb.id = 'uiNewBest'; nb.textContent = '🏆 NEW BEST!';
    document.body.appendChild(nb);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

  /* ── Public API ── */
  window.UI = {
    flashNewBest() {
      const el = document.getElementById('uiNewBest');
      if (!el) return;
      el.classList.remove('show', 'gone');
      void el.offsetWidth;
      el.classList.add('show');
      setTimeout(() => el.classList.replace('show', 'gone'), 2000);
      setTimeout(() => el.classList.remove('gone'), 2500);
    },
  };
})();
