'use strict';
// ── AUTH CORE ──
const Auth = (() => {
  const UK = 'atlas_users', SK = 'atlas_session';
  const get  = () => JSON.parse(localStorage.getItem(UK) || '{}');
  const save = u  => localStorage.setItem(UK, JSON.stringify(u));
  const hash = s  => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return (h >>> 0).toString(36);
  };
  return {
    getUser()   { return localStorage.getItem(SK); },
    logout()    { localStorage.removeItem(SK); },
    login(user, pw) {
      const u = user.toLowerCase().trim(), users = get();
      if (!u)          return { ok:false, err:'Enter a username' };
      if (!users[u])   return { ok:false, err:'User not found' };
      if (users[u].pw !== hash(pw)) return { ok:false, err:'Wrong password' };
      localStorage.setItem(SK, u);
      return { ok:true, user:u };
    },
    register(user, pw) {
      const u = user.toLowerCase().trim(), users = get();
      if (u.length < 2)               return { ok:false, err:'Username: 2+ chars' };
      if (!/^[a-z0-9_]+$/.test(u))   return { ok:false, err:'Letters, numbers & _ only' };
      if (pw.length < 4)              return { ok:false, err:'Password: 4+ chars' };
      if (users[u])                   return { ok:false, err:'Username taken' };
      users[u] = { pw: hash(pw), scores: {} };
      save(users);
      localStorage.setItem(SK, u);
      return { ok:true, user:u };
    },
    saveScore(key, score) {
      const u = this.getUser();
      if (!u) return false;               // guest — nothing saved
      const users = get();
      if (!users[u]) return false;
      const prev = users[u].scores[key] || 0;
      if (score > prev) { users[u].scores[key] = score; save(users); return true; }
      return false;
    },
    getScore(key) {
      const u = this.getUser();
      if (!u) return 0;
      return get()[u]?.scores[key] || 0;
    },
  };
})();

// ── AUTH UI (auto-injects login button + modal into every page) ──
document.addEventListener('DOMContentLoaded', () => {
  injectCSS();
  injectModal();
  injectNavBtn();
  updateNavBtn();
});

function injectCSS() {
  const s = document.createElement('style');
  s.textContent = `
  #auth-modal{display:none;position:fixed;inset:0;z-index:99999;
    background:rgba(0,0,0,0.88);align-items:center;justify-content:center;}
  #auth-modal.open{display:flex;}
  #auth-box{background:#0d0d22;border:1px solid rgba(247,147,26,0.35);
    border-radius:16px;padding:32px 28px;width:min(370px,92vw);position:relative;
    box-shadow:0 0 60px rgba(247,147,26,0.12);}
  #auth-close{position:absolute;top:14px;right:16px;background:none;border:none;
    color:#6b7280;font-size:1.3rem;cursor:pointer;line-height:1;}
  #auth-close:hover{color:#fff;}
  .auth-title{font-family:'Orbitron',monospace;font-size:1.1rem;color:#F7931A;
    text-align:center;margin-bottom:18px;letter-spacing:.06em;
    text-shadow:0 0 12px rgba(247,147,26,0.5);}
  .auth-tabs{display:flex;margin-bottom:20px;border-radius:8px;overflow:hidden;
    border:1px solid rgba(247,147,26,0.2);}
  .auth-tab{flex:1;padding:9px 0;text-align:center;
    font-family:'Orbitron',monospace;font-size:.62rem;cursor:pointer;
    background:rgba(247,147,26,0.04);color:#6b7280;border:none;
    letter-spacing:.05em;transition:all .15s;}
  .auth-tab.active{background:rgba(247,147,26,0.18);color:#F7931A;}
  .auth-field{width:100%;background:rgba(255,255,255,0.05);
    border:1px solid rgba(247,147,26,0.2);border-radius:8px;
    padding:11px 14px;color:#f0f0f0;font-size:1rem;margin-bottom:12px;
    outline:none;box-sizing:border-box;font-family:inherit;}
  .auth-field::placeholder{color:#4b5563;}
  .auth-field:focus{border-color:rgba(247,147,26,0.55);}
  .auth-submit{width:100%;padding:12px;
    background:linear-gradient(135deg,#F7931A,#FFD700);
    border:none;border-radius:8px;color:#000;
    font-family:'Orbitron',monospace;font-size:.75rem;font-weight:700;
    cursor:pointer;letter-spacing:.05em;margin-top:4px;transition:opacity .15s;}
  .auth-submit:hover{opacity:.88;}
  .auth-err{color:#ff3355;font-size:.8rem;text-align:center;
    margin-top:10px;min-height:18px;font-family:'Rajdhani',sans-serif;}
  .auth-note{color:#374151;font-size:.7rem;text-align:center;
    margin-top:12px;font-family:'Rajdhani',sans-serif;}
  /* nav elements */
  #auth-nav-btn{font-family:'Orbitron',monospace;font-size:.65rem;cursor:pointer;
    letter-spacing:.05em;background:none;
    border:1px solid rgba(247,147,26,0.35);border-radius:6px;
    padding:4px 10px;color:#F7931A;transition:all .15s;white-space:nowrap;}
  #auth-nav-btn:hover{background:rgba(247,147,26,0.14);}
  .auth-user-badge{display:flex;align-items:center;gap:8px;white-space:nowrap;}
  .auth-user-name{font-family:'Orbitron',monospace;font-size:.65rem;color:#F7931A;}
  #auth-logout-btn{font-family:'Orbitron',monospace;font-size:.55rem;
    background:none;border:none;color:#4b5563;cursor:pointer;padding:0;
    transition:color .15s;}
  #auth-logout-btn:hover{color:#ff3355;}
  `;
  document.head.appendChild(s);
}

function injectModal() {
  const el = document.createElement('div');
  el.id = 'auth-modal';
  el.innerHTML = `
    <div id="auth-box">
      <button id="auth-close" aria-label="Close">✕</button>
      <div class="auth-title">₿ ATLAS ARCADE</div>
      <div class="auth-tabs">
        <button class="auth-tab active" data-tab="login">SIGN IN</button>
        <button class="auth-tab" data-tab="register">SIGN UP</button>
      </div>
      <input class="auth-field" id="auth-user" type="text"
        placeholder="Username" autocomplete="username"
        autocapitalize="none" spellcheck="false">
      <input class="auth-field" id="auth-pw" type="password"
        placeholder="Password" autocomplete="current-password">
      <button class="auth-submit" id="auth-go">SIGN IN</button>
      <div class="auth-err" id="auth-err"></div>
      <div class="auth-note">No email required · Scores saved per account</div>
    </div>`;
  document.body.appendChild(el);

  let mode = 'login';

  el.querySelectorAll('.auth-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.tab;
      el.querySelectorAll('.auth-tab').forEach(b => b.classList.toggle('active', b === btn));
      document.getElementById('auth-go').textContent = mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT';
      document.getElementById('auth-pw').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
      document.getElementById('auth-err').textContent = '';
    });
  });

  document.getElementById('auth-close').onclick = closeAuthModal;
  el.addEventListener('click', e => { if (e.target === el) closeAuthModal(); });

  document.getElementById('auth-go').addEventListener('click', () => {
    const user = document.getElementById('auth-user').value;
    const pw   = document.getElementById('auth-pw').value;
    const res  = mode === 'login' ? Auth.login(user, pw) : Auth.register(user, pw);
    if (res.ok) { closeAuthModal(); updateNavBtn(); }
    else { document.getElementById('auth-err').textContent = res.err; }
  });

  document.getElementById('auth-pw').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('auth-go').click();
  });
  document.getElementById('auth-user').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('auth-pw').focus();
  });
}

function injectNavBtn() {
  const nav = document.querySelector('.nav-links');
  if (!nav) return;
  const wrap = document.createElement('span');
  wrap.id = 'auth-nav-wrap';
  nav.appendChild(wrap);
}

function updateNavBtn() {
  const wrap = document.getElementById('auth-nav-wrap');
  if (!wrap) return;
  const user = Auth.getUser();
  if (user) {
    wrap.innerHTML = `
      <span class="auth-user-badge">
        <span class="auth-user-name">👤 ${user}</span>
        <button id="auth-logout-btn">LOGOUT</button>
      </span>`;
    document.getElementById('auth-logout-btn').onclick = () => { Auth.logout(); updateNavBtn(); };
  } else {
    wrap.innerHTML = `<button id="auth-nav-btn">LOGIN</button>`;
    document.getElementById('auth-nav-btn').onclick = openAuthModal;
  }
}

function openAuthModal() {
  document.getElementById('auth-modal').classList.add('open');
  setTimeout(() => document.getElementById('auth-user').focus(), 60);
}
function closeAuthModal() {
  document.getElementById('auth-modal').classList.remove('open');
  document.getElementById('auth-err').textContent = '';
  document.getElementById('auth-pw').value = '';
}
