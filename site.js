const GAMES_DB = {
  'void-survivors': {
    id: 'void-survivors',
    name: 'Void Survivors',
    url: 'game.html',
    img: 'void_survivors_cover.png',
    tags: ['Survival', 'Roguelike', 'Action'],
    desc: 'Survive waves of enemies, grab weapons, evolve them, fight bosses every 10 levels. Global leaderboard included.',
    pitch: 'Survive waves, evolve weapons, fight bosses every 10 levels.',
    sessionHint: '~5–15 min runs · high intensity',
    vibe: 'intense',
    bullets: ['Roguelike gear that evolves mid-run', 'Boss every 10 floors', 'Post your score worldwide'],
    live: true,
  },
  'ascension-protocol': {
    id: 'ascension-protocol',
    name: 'Ascension Protocol',
    url: 'ascension.html',
    img: 'ascension_cover.svg',
    tags: ['Incremental', 'Strategy', 'Idle'],
    desc: 'Long-form AI awakening clicker: six phases, five currencies, network map, space colonies, quantum bursts — built for days of progression.',
    pitch: 'Idle clicker with six phases, five currencies, and a real endgame.',
    sessionHint: 'Long sessions · chill grind',
    vibe: 'chill',
    bullets: ['Six progression phases', 'Network map & space colonies', 'Quantum bursts when you go deep'],
    live: true,
  },
  'up-or-lose': {
    id: 'up-or-lose',
    name: 'Up or Lose',
    url: 'up-or-lose.html',
    img: 'up_or_lose_cover.svg',
    tags: ['Arcade', 'Platformer', 'Endless'],
    desc: 'Auto-jump vertical climb: moving platforms, boosts, teleports, breakables — don’t fall. Global podium and local best.',
    pitch: 'Auto-jump climb — don’t fall. One more try every time.',
    sessionHint: '~1–3 min runs · quick dopamine',
    vibe: 'quick',
    bullets: ['One-thumb friendly', 'Boosts, teleports, breakables', 'Climb the global height board'],
    live: true,
  },
};

/** Hero shows every live game — fixed order for scanability. */
const HERO_GAME_ORDER = ['void-survivors', 'up-or-lose', 'ascension-protocol'];

/** Latest #1 per game for hub cards + hero teaser (updated after each LB fetch). */
let HUB_LB_TOP = {};
const hubLbPrevTopScores = {};
let homeLbFetchSeq = 0;
let homeLbAutoRefreshStarted = false;
let homeLbLastFetchAt = 0;

function formatLbScore(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const x = Math.floor(Number(n));
  if (x >= 1e9) return (x / 1e9).toFixed(2) + 'B';
  if (x >= 1e6) return (x / 1e6).toFixed(2) + 'M';
  if (x >= 1e3) return (x / 1e3).toFixed(1) + 'k';
  return String(x);
}

const HOME_LB_BOARDS = [
  {
    col: 'void_survivors_leaderboard',
    title: 'Void Survivors',
    href: 'game.html',
    gid: 'void-survivors',
    unit: (s) => formatLbScore(s) + ' pts',
  },
  {
    col: 'up_or_lose_leaderboard',
    title: 'Up or Lose',
    href: 'up-or-lose.html',
    gid: 'up-or-lose',
    unit: (s) => formatLbScore(s) + ' px',
  },
  {
    col: 'ascension_leaderboard',
    title: 'Ascension Protocol',
    href: 'ascension.html',
    gid: 'ascension-protocol',
    unit: (s) => 'Rating ' + formatLbScore(s),
  },
];

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function readLocalVoidBestRunScore() {
  try {
    const raw = localStorage.getItem('void_survivors_save');
    if (!raw) return 0;
    const d = JSON.parse(raw);
    const lb = Array.isArray(d.leaderboard) ? d.leaderboard : [];
    let best = 0;
    for (const e of lb) {
      const kills = Math.floor(Number(e.kills) || 0);
      const t = Math.floor(Number(e.time) || 0);
      const sc = kills + t * 10;
      if (sc > best) best = sc;
    }
    return best;
  } catch {
    return 0;
  }
}

function readLocalUpOrLoseBest() {
  try {
    const o = JSON.parse(localStorage.getItem('up_or_lose_v1') || '{}');
    return Math.max(0, parseInt(o.best, 10) || 0);
  } catch {
    return 0;
  }
}

function readLocalAscensionLbBest() {
  try {
    const o = JSON.parse(localStorage.getItem('ascension_protocol_v1') || '{}');
    return Math.max(0, parseInt(o.lbBestScore, 10) || 0);
  } catch {
    return 0;
  }
}

function getPersonalBest(gid) {
  if (gid === 'void-survivors') return readLocalVoidBestRunScore();
  if (gid === 'up-or-lose') return readLocalUpOrLoseBest();
  if (gid === 'ascension-protocol') return readLocalAscensionLbBest();
  return 0;
}

function renderHomeLbPersonalLine(b) {
  const pb = getPersonalBest(b.gid);
  if (!b.top || b.top.score <= 0) {
    return '<p class="home-lb-you home-lb-you--open">Board’s open — first run could be #1.</p>';
  }
  if (pb <= 0) {
    return '<p class="home-lb-you">No local PB yet — <strong>one run</strong> to join the chase.</p>';
  }
  const u = b.unit;
  if (pb >= b.top.score) {
    return `<p class="home-lb-you home-lb-you--tight">Your PB: <strong>${u(pb)}</strong> · In range — <strong>submit a run</strong> and steal the crown.</p>`;
  }
  const need = b.top.score - pb;
  return `<p class="home-lb-you">Your PB: <strong>${u(pb)}</strong> · Need <strong>+${formatLbScore(need)}</strong> to tie #1</p>`;
}

function renderGameCompetitionHtml(gid) {
  const b = HOME_LB_BOARDS.find((x) => x.gid === gid);
  if (!b) return '';
  const top = HUB_LB_TOP[gid];
  const pb = getPersonalBest(gid);
  let html = '';
  if (top && top.score > 0) {
    const nm = escapeHtml(String(top.name || 'Player').slice(0, 20));
    html += `<p class="game-card-top1">#1 globally: <strong>${b.unit(top.score)}</strong> <span class="game-card-top1-name">${nm}</span></p>`;
  } else {
    html += `<p class="game-card-top1 game-card-top1--empty">#1 slot is <strong>empty</strong> — yours to take.</p>`;
  }
  if (top && top.score > 0) {
    if (pb <= 0) {
      html += `<p class="game-card-near">No PB yet — first run counts.</p>`;
    } else if (pb >= top.score) {
      html += `<p class="game-card-near game-card-near--hot">You’re in striking distance — one big run could do it.</p>`;
    } else {
      html += `<p class="game-card-near">Need <strong>+${formatLbScore(top.score - pb)}</strong> to tie #1</p>`;
    }
  }
  return html;
}

function updateHeroLiveTeaser(results) {
  const el = document.getElementById('hero-live-teaser');
  if (!el) return;
  const parts = results
    .filter((r) => r.top && r.top.score > 0)
    .map((r) => {
      const nm = escapeHtml(String(r.top.name || 'Player').slice(0, 14));
      return `<span class="hero-teaser-chip"><strong>${r.title}</strong> · ${r.unit(r.top.score)} · ${nm}</span>`;
    });
  if (!parts.length) {
    el.setAttribute('hidden', '');
    el.innerHTML = '';
    return;
  }
  el.removeAttribute('hidden');
  el.innerHTML = '<span class="hero-teaser-label">Live boards:</span> ' + parts.join('');
}

function refreshHomeLbUpdatedText() {
  const el = document.getElementById('home-lb-updated');
  if (!el || !homeLbLastFetchAt) return;
  const sec = Math.floor((Date.now() - homeLbLastFetchAt) / 1000);
  if (sec < 12) el.textContent = 'Updated just now';
  else if (sec < 60) el.textContent = `Updated ${sec}s ago`;
  else if (sec < 3600) el.textContent = `Updated ${Math.floor(sec / 60)}m ago`;
  else el.textContent = `Updated ${Math.floor(sec / 3600)}h ago`;
}

function startHomeLbAutoRefresh() {
  if (homeLbAutoRefreshStarted) return;
  homeLbAutoRefreshStarted = true;
  setInterval(() => {
    if (document.getElementById('home-lb-root') && window.__NK_FB_DB && typeof firebase !== 'undefined' && firebase.firestore) {
      fetchAndRenderHomeLb();
    }
  }, 60000);
  setInterval(refreshHomeLbUpdatedText, 8000);
}

function getPlayStreakCount() {
  try {
    const o = JSON.parse(localStorage.getItem('nk_play_streak') || '{}');
    const today = new Date().toISOString().slice(0, 10);
    if (o.day !== today) return 0;
    return Math.max(0, parseInt(o.count, 10) || 0);
  } catch {
    return 0;
  }
}

function bumpPlayStreak() {
  const key = 'nk_play_streak';
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem(key);
    let o = raw ? JSON.parse(raw) : {};
    if (o.day === today) return Math.max(1, parseInt(o.count, 10) || 1);
    const y = new Date();
    y.setUTCDate(y.getUTCDate() - 1);
    const ystr = y.toISOString().slice(0, 10);
    let count = 1;
    if (o.day === ystr) count = Math.min(99, (parseInt(o.count, 10) || 0) + 1);
    o = { day: today, count };
    localStorage.setItem(key, JSON.stringify(o));
    return count;
  } catch {
    return 1;
  }
}

function renderHeroGames() {
  const slot = document.getElementById('hero-games-slot');
  if (!slot) return;
  const streak = getPlayStreakCount();
  const streakHtml =
    streak >= 2
      ? `<p class="hero-streak-banner" aria-label="Play streak">🔥 <strong>${streak}-day</strong> play streak — don’t break it</p>`
      : '';
  const cards = HERO_GAME_ORDER.map((id, i) => {
    const g = GAMES_DB[id];
    if (!g || !g.live) return '';
    const delay = (i * 0.06).toFixed(2);
    return `<article class="hero-mini-card hero-mini-card--${g.vibe} anim-card" style="animation-delay:${delay}s">
      <a href="${g.url}" class="hero-mini-media" onclick="trackPlay('${g.id}')">
        <span class="hero-mini-live" aria-hidden="true">LIVE</span>
        <img src="${g.img}" alt="" width="400" height="225" loading="eager">
      </a>
      <div class="hero-mini-body">
        <h3 class="hero-mini-title">${g.name}</h3>
        <p class="hero-mini-pitch">${g.pitch}</p>
        <p class="hero-mini-meta">${g.sessionHint}</p>
        <a href="${g.url}" class="hero-mini-play" onclick="trackPlay('${g.id}')">▶ Run it</a>
      </div>
    </article>`;
  }).join('');
  slot.innerHTML =
    streakHtml +
    `<p class="hero-games-label">All live · tap a run</p><div class="hero-games-grid">${cards}</div>`;
}

function renderComingSoonRow() {
  const el = document.getElementById('coming-soon-inner');
  if (!el) return;
  el.innerHTML = `
    <div class="coming-card"><span class="coming-ico" aria-hidden="true">🔮</span><div><strong>Arena drop #4</strong><span>Fast sessions · code name TBA</span></div></div>
    <div class="coming-card"><span class="coming-ico" aria-hidden="true">🎮</span><div><strong>Experimental modes</strong><span>New rule sets &amp; weekly challenges</span></div></div>`;
}

async function fetchAndRenderHomeLb() {
  const root = document.getElementById('home-lb-root');
  if (!root) return;
  const seq = ++homeLbFetchSeq;
  const db = typeof window !== 'undefined' ? window.__NK_FB_DB : null;

  if (!db || typeof firebase === 'undefined' || !firebase.firestore) {
    if (seq !== homeLbFetchSeq) return;
    root.innerHTML =
      '<p class="home-lb-off">Leaderboards load when you’re online with Firebase. Every game still runs instantly.</p>';
    HUB_LB_TOP = {};
    homeLbLastFetchAt = Date.now();
    const up = document.getElementById('home-lb-updated');
    if (up) up.textContent = 'Offline — boards refresh when connected';
    updateHeroLiveTeaser([]);
    renderAllGamesGrid();
    return;
  }

  const results = await Promise.all(
    HOME_LB_BOARDS.map(async (b) => {
      try {
        const snap = await db.collection(b.col).orderBy('score', 'desc').limit(8).get();
        const rows = snap.docs.map((d) => d.data());
        if (!rows.length) return { ...b, top: null };
        const best = new Map();
        for (const r of rows) {
          const key = String(r.name || 'Player')
            .trim()
            .toLowerCase();
          const sc = Math.floor(Number(r.score) || 0);
          if (!best.has(key) || sc > best.get(key).score) best.set(key, { name: r.name || 'Player', score: sc });
        }
        const sorted = [...best.values()].sort((a, b) => b.score - a.score);
        return { ...b, top: sorted[0] || null };
      } catch (e) {
        console.warn('[Hub] LB fetch', b.col, e);
        return { ...b, top: null, err: true };
      }
    })
  );

  if (seq !== homeLbFetchSeq) return;

  HUB_LB_TOP = {};
  for (const b of results) {
    HUB_LB_TOP[b.gid] = b.top && b.top.score > 0 ? { name: String(b.top.name || 'Player'), score: b.top.score } : null;
  }

  homeLbLastFetchAt = Date.now();
  refreshHomeLbUpdatedText();
  updateHeroLiveTeaser(results);
  startHomeLbAutoRefresh();

  root.innerHTML = results
    .map((b, i) => {
      const youLine = renderHomeLbPersonalLine(b);
      if (b.top) {
        const name = escapeHtml(String(b.top.name || 'Player').slice(0, 24));
        return `<div class="home-lb-card anim-card" style="animation-delay:${i * 0.06}s">
          <h4 class="home-lb-game">${b.title}</h4>
          <p class="home-lb-rank-label">#1 worldwide</p>
          <p class="home-lb-champion-name">${name}</p>
          <p class="home-lb-score">${b.unit(b.top.score)}</p>
          ${youLine}
          <a href="${b.href}" class="home-lb-cta" onclick="trackPlay('${b.gid}')">Beat this →</a>
        </div>`;
      }
      return `<div class="home-lb-card home-lb-card--empty anim-card" style="animation-delay:${i * 0.06}s">
          <h4 class="home-lb-game">${b.title}</h4>
          <p class="home-lb-empty">No scores yet — <strong>you’re #1</strong> waiting to happen.</p>
          ${youLine}
          <a href="${b.href}" class="home-lb-cta" onclick="trackPlay('${b.gid}')">Play first →</a>
        </div>`;
    })
    .join('');

  const cards = root.querySelectorAll('.home-lb-card');
  results.forEach((b, i) => {
    const scoreEl = cards[i] && cards[i].querySelector('.home-lb-score');
    if (b.top && scoreEl) {
      const prev = hubLbPrevTopScores[b.gid];
      if (prev !== undefined && prev !== b.top.score) {
        scoreEl.classList.add('home-lb-score--pop');
        setTimeout(() => scoreEl.classList.remove('home-lb-score--pop'), 700);
      }
      hubLbPrevTopScores[b.gid] = b.top.score;
    } else {
      hubLbPrevTopScores[b.gid] = 0;
    }
  });

  renderAllGamesGrid();
}

function syncRetentionStrip() {
  const el = document.getElementById('retention-strip');
  if (!el) return;
  el.classList.toggle('retention-strip--hidden', !!currentUser);
}

const AVATARS = ['😎','🎮','👾','🔥','⚡','💀','🐉','🎯','🚀','🌟','🤖','🦊'];

let currentUser = null;
let userData = null;

// ─── AUTH STATE ───
auth.onAuthStateChanged(async user => {
  currentUser = user;
  if (user) {
    await loadUserData();
  } else {
    userData = null;
  }
  renderNavAccount();
  renderSections();
});

// ─── FIRESTORE USER DATA ───
async function loadUserData() {
  if (!currentUser) return;
  try {
    const doc = await db.collection('users').doc(currentUser.uid).get();
    if (doc.exists) {
      userData = doc.data();
    } else {
      userData = {
        username: currentUser.displayName || currentUser.email.split('@')[0],
        avatar: '😎',
        joined: Date.now(),
        totalPlays: 0,
        stats: {},
        liked: []
      };
      await db.collection('users').doc(currentUser.uid).set(userData);
    }
  } catch (e) {
    console.warn('Failed to load user data:', e);
    userData = { username: currentUser.displayName || 'Player', avatar: '😎', totalPlays: 0, stats: {}, liked: [] };
  }
}

async function saveUserData() {
  if (!currentUser || !userData) return;
  try {
    await db.collection('users').doc(currentUser.uid).update(userData);
  } catch (e) {
    console.warn('Failed to save user data:', e);
  }
}

// ─── LIKED ───
function getLiked() {
  if (userData && userData.liked) return userData.liked;
  try { return JSON.parse(localStorage.getItem('nk_liked')) || []; } catch { return []; }
}

async function toggleLike(gameId) {
  if (!currentUser) {
    openAuthModal();
    return false;
  }
  if (!userData.liked) userData.liked = [];
  const i = userData.liked.indexOf(gameId);
  if (i >= 0) userData.liked.splice(i, 1); else userData.liked.push(gameId);
  await saveUserData();
  return userData.liked.includes(gameId);
}

// ─── RECENT (local, per-device) ───
function getRecent() {
  try { return JSON.parse(localStorage.getItem('nk_recent')) || []; } catch { return []; }
}
function addRecent(gameId) {
  let recent = getRecent();
  recent = recent.filter(r => r.id !== gameId);
  recent.unshift({ id: gameId, time: Date.now() });
  if (recent.length > 10) recent = recent.slice(0, 10);
  localStorage.setItem('nk_recent', JSON.stringify(recent));
  bumpPlayStreak();
}

// ─── PLAY TRACKING ───
async function trackPlay(gameId) {
  addRecent(gameId);
  if (!currentUser || !userData) return;
  if (!userData.stats) userData.stats = {};
  if (!userData.stats[gameId]) userData.stats[gameId] = { plays: 0, first: Date.now() };
  userData.stats[gameId].plays++;
  userData.stats[gameId].last = Date.now();
  userData.totalPlays = (userData.totalPlays || 0) + 1;
  await saveUserData();
}

function timeAgo(ms) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

// ─── NAV ACCOUNT RENDER ───
function renderNavAccount() {
  const container = document.getElementById('nav-account-area');
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = '<button class="nav-signin" onclick="openAuthModal()">Sign In</button>';
    syncRetentionStrip();
    return;
  }

  const name = userData?.username || currentUser.displayName || currentUser.email?.split('@')[0] || 'Player';
  const avatar = userData?.avatar || '😎';
  const photo = currentUser.photoURL;
  const avatarHtml = photo
    ? `<img src="${photo}" class="nav-avatar-img" referrerpolicy="no-referrer">`
    : `<div class="nav-avatar">${avatar}</div>`;

  container.innerHTML = `
    <div class="profile-wrap" id="profile-wrap">
      <div class="nav-account" onclick="document.getElementById('profile-wrap').classList.toggle('open')">
        ${avatarHtml}
        <span class="nav-username">${name}</span>
      </div>
      <div class="profile-dropdown">
        <div class="pd-header">
          ${photo ? `<img src="${photo}" class="pd-photo" referrerpolicy="no-referrer">` : `<div class="pd-avatar">${avatar}</div>`}
          <div class="pd-name">${name}</div>
          <div class="pd-stat">${currentUser.email}</div>
          <div class="pd-stat">${userData?.totalPlays || 0} games played</div>
        </div>
        <button onclick="openEditProfile()">Edit Profile</button>
        <button class="pd-signout" onclick="signOut()">Sign Out</button>
      </div>
    </div>`;
  syncRetentionStrip();
}

// ─── AUTH MODAL ───
function openAuthModal(mode) {
  const overlay = document.getElementById('auth-modal');
  if (!overlay) return;
  overlay.classList.add('open');

  if (mode === 'edit') { openEditProfile(); return; }

  const modal = overlay.querySelector('.modal');
  modal.innerHTML = `
    <button class="modal-close" onclick="closeAuthModal()">&times;</button>
    <h2>Save your progress</h2>
    <p class="modal-lead">Free account — games stay free. No paywall.</p>
    <ul class="modal-benefits">
      <li>♥ Like games and sync across devices</li>
      <li>📊 Play counts &amp; history</li>
      <li>🏆 Use your name on leaderboards</li>
    </ul>

    <button class="google-btn" onclick="googleSignIn()">
      <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
      Continue with Google
    </button>

    <div class="auth-divider"><span>or use email</span></div>

    <div id="auth-form">
      <input class="modal-input" id="auth-email" type="email" placeholder="Email address" autocomplete="email">
      <input class="modal-input" id="auth-pass" type="password" placeholder="Password (min 6 characters)" autocomplete="current-password">
      <div id="auth-error" class="auth-error"></div>
      <button class="modal-btn" id="auth-submit" onclick="emailSignIn()">Sign In</button>
      <button class="modal-secondary" id="auth-toggle" onclick="toggleAuthMode()">Don't have an account? <strong>Sign Up</strong></button>
    </div>`;

  overlay.dataset.mode = 'signin';
  const email = document.getElementById('auth-email');
  if (email) email.focus();

  document.getElementById('auth-pass')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') emailSignIn();
  });
}

function toggleAuthMode() {
  const overlay = document.getElementById('auth-modal');
  const isSignIn = overlay.dataset.mode === 'signin';
  overlay.dataset.mode = isSignIn ? 'signup' : 'signin';

  document.getElementById('auth-submit').textContent = isSignIn ? 'Create Account' : 'Sign In';
  document.getElementById('auth-submit').setAttribute('onclick', isSignIn ? 'emailSignUp()' : 'emailSignIn()');
  document.getElementById('auth-toggle').innerHTML = isSignIn
    ? 'Already have an account? <strong>Sign In</strong>'
    : 'Don\'t have an account? <strong>Sign Up</strong>';
  document.getElementById('auth-error').textContent = '';
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) el.textContent = msg;
}

async function googleSignIn() {
  if (typeof firebase === 'undefined' || !firebase.auth?.GoogleAuthProvider) {
    showAuthError('Sign-in needs Firebase scripts. Try disabling strict blocking for this site or another network.');
    return;
  }
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
    closeAuthModal();
  } catch (e) {
    console.error('Google sign-in error:', e.code, e.message);
    if (e.code !== 'auth/popup-closed-by-user') {
      showAuthError(friendlyError(e.code, e.message));
    }
  }
}

async function emailSignIn() {
  const email = document.getElementById('auth-email')?.value.trim();
  const pass = document.getElementById('auth-pass')?.value;
  if (!email || !pass) { showAuthError('Enter your email and password.'); return; }
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    closeAuthModal();
  } catch (e) {
    console.error('Email sign-in error:', e.code, e.message);
    showAuthError(friendlyError(e.code, e.message));
  }
}

async function emailSignUp() {
  const email = document.getElementById('auth-email')?.value.trim();
  const pass = document.getElementById('auth-pass')?.value;
  if (!email) { showAuthError('Enter an email address.'); return; }
  if (!pass || pass.length < 6) { showAuthError('Password must be at least 6 characters.'); return; }
  try {
    await auth.createUserWithEmailAndPassword(email, pass);
    closeAuthModal();
  } catch (e) {
    console.error('Sign up error:', e.code, e.message);
    showAuthError(friendlyError(e.code, e.message));
  }
}

function friendlyError(code, message) {
  const map = {
    'auth/email-already-in-use': 'That email is already taken. Try signing in.',
    'auth/invalid-email': 'That doesn\'t look like a valid email.',
    'auth/weak-password': 'Password needs to be at least 6 characters.',
    'auth/user-not-found': 'No account with that email. Try signing up.',
    'auth/wrong-password': 'Wrong password. Try again.',
    'auth/invalid-credential': 'Wrong email or password. Try again.',
    'auth/too-many-requests': 'Too many attempts. Wait a bit and try again.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/popup-blocked': 'Popup was blocked. Allow popups for this site.',
    'auth/unauthorized-domain': 'This address is not allowed. In Firebase: Authentication → Settings → Authorized domains — add localhost (or your site domain).',
    'auth/operation-not-allowed': 'Google or Email sign-in is not enabled. Firebase → Authentication → Sign-in method.',
    'auth/api-key-not-valid': 'Invalid API key. Open firebase-config.js and paste apiKey from Firebase → Project settings → Your web app.',
    'auth/invalid-api-key': 'Invalid API key. Paste apiKey from Firebase → Project settings.',
  };
  if (map[code]) return map[code];
  if (code && String(code).includes('api-key-not-valid')) {
    return 'Invalid API key. In firebase-config.js replace apiKey with the exact value from Firebase Project settings.';
  }
  if (code) return code.replace('auth/', '') + (message ? ': ' + message : '');
  return message || 'Something went wrong. Try again.';
}

async function signOut() {
  try {
    await auth.signOut();
  } catch (e) {
    console.warn('Sign out failed:', e);
  }
  const wrap = document.getElementById('profile-wrap');
  if (wrap) wrap.classList.remove('open');
}

function closeAuthModal() {
  const overlay = document.getElementById('auth-modal');
  if (overlay) overlay.classList.remove('open');
}

// ─── EDIT PROFILE ───
function openEditProfile() {
  const overlay = document.getElementById('auth-modal');
  if (!overlay) return;
  overlay.classList.add('open');

  const name = userData?.username || currentUser?.displayName || '';
  const currentAvatar = userData?.avatar || '😎';

  const modal = overlay.querySelector('.modal');
  modal.innerHTML = `
    <button class="modal-close" onclick="closeAuthModal()">&times;</button>
    <h2>Edit Profile</h2>
    <p>Change your display name and avatar.</p>
    <input class="modal-input" id="edit-name" type="text" placeholder="Display name" maxlength="16" value="${name}" autocomplete="off">
    <div class="modal-avatars" id="avatar-picker">
      ${AVATARS.map(a => `<div class="modal-avatar${a === currentAvatar ? ' selected' : ''}" data-avatar="${a}" onclick="pickAvatar(this)">${a}</div>`).join('')}
    </div>
    <button class="modal-btn" onclick="saveProfile()">Save</button>`;

  document.getElementById('edit-name')?.focus();
}

function pickAvatar(el) {
  document.querySelectorAll('.modal-avatar').forEach(a => a.classList.remove('selected'));
  el.classList.add('selected');
}

async function saveProfile() {
  const name = document.getElementById('edit-name')?.value.trim().slice(0, 16);
  if (!name) return;
  const sel = document.querySelector('.modal-avatar.selected');
  const avatar = sel ? sel.dataset.avatar : '😎';

  if (userData) {
    userData.username = name;
    userData.avatar = avatar;
    await saveUserData();
  }
  closeAuthModal();
  renderNavAccount();
}

// ─── CLOSE DROPDOWN ON OUTSIDE CLICK ───
document.addEventListener('click', e => {
  const wrap = document.getElementById('profile-wrap');
  if (wrap && !wrap.contains(e.target)) wrap.classList.remove('open');

  const overlay = document.getElementById('auth-modal');
  if (overlay?.classList.contains('open') && e.target === overlay) closeAuthModal();
});

// ─── GAME CARDS ───
function renderAllGamesGrid() {
  const allEl = document.getElementById('all-games-grid');
  if (!allEl) return;
  const liveGames = Object.values(GAMES_DB).filter((g) => g.live);
  allEl.innerHTML = liveGames.map((g, i) => renderGameCard(g, { cardIndex: i })).join('');
}

function renderGameCard(game, opts = {}) {
  const liked = getLiked();
  const isLiked = liked.includes(game.id);

  if (opts.compact) {
    return `<a href="${game.url}" class="game-row-card" onclick="trackPlay('${game.id}')">
      <img src="${game.img}" alt="${game.name}" loading="lazy">
      <div class="row-info">
        <h4>${game.name}</h4>
        <span>${opts.sub || ''}</span>
      </div>
    </a>`;
  }

  const vibe = game.vibe || 'default';
  const sessionLine = game.sessionHint ? `<p class="game-card-session">${game.sessionHint}</p>` : '';
  const delayAttr = opts.cardIndex != null ? ` style="animation-delay:${opts.cardIndex * 0.05}s"` : '';
  const comp = renderGameCompetitionHtml(game.id);
  return `<div class="game-card game-card--${vibe} anim-card"${delayAttr}>
    <div class="game-card-media">
      <span class="game-card-live-pill" aria-hidden="true">LIVE</span>
      <img src="${game.img}" alt="${game.name}" class="game-card-img" loading="lazy">
    </div>
    <div class="game-card-body">
      <h3>${game.name}</h3>
      <div class="game-card-tags">
        ${game.tags.map(t => `<span class="game-tag${t === 'Action' ? ' action' : ''}">${t}</span>`).join('')}
      </div>
      ${sessionLine}
      ${comp}
      <p>${game.desc}</p>
      <div class="game-card-footer">
        <a href="${game.url}" class="game-play-btn" onclick="trackPlay('${game.id}')">&#9654; Run it</a>
        <div style="display:flex;align-items:center;gap:.5rem">
          <button class="game-like-btn${isLiked ? ' liked' : ''}" onclick="handleLike('${game.id}',this)" title="${isLiked ? 'Unlike' : 'Like'}">&#9829;</button>
          <span class="game-status live">&#9679; Live</span>
        </div>
      </div>
    </div>
  </div>`;
}

async function handleLike(gameId, btn) {
  const nowLiked = await toggleLike(gameId);
  if (nowLiked === false && !currentUser) return;
  btn.classList.toggle('liked', nowLiked);
  btn.title = nowLiked ? 'Unlike' : 'Like';
  renderSections();
}

// ─── RENDER SECTIONS ───
function renderSections() {
  renderHeroGames();
  renderComingSoonRow();
  syncRetentionStrip();
  fetchAndRenderHomeLb();

  const liked = getLiked();
  const recent = getRecent();

  const recentEl = document.getElementById('recent-section');
  if (recentEl) {
    if (recent.length > 0) {
      recentEl.style.display = '';
      const row = recentEl.querySelector('.game-row');
      if (row) {
        row.innerHTML = recent
          .filter(r => GAMES_DB[r.id])
          .map(r => renderGameCard(GAMES_DB[r.id], { compact: true, sub: timeAgo(r.time) }))
          .join('');
      }
    } else {
      recentEl.style.display = 'none';
    }
  }

  const likedEl = document.getElementById('liked-section');
  if (likedEl) {
    if (currentUser && liked.length > 0) {
      likedEl.style.display = '';
      const row = likedEl.querySelector('.game-row');
      if (row) {
        row.innerHTML = liked
          .filter(id => GAMES_DB[id])
          .map(id => renderGameCard(GAMES_DB[id], { compact: true, sub: '&#9829; Liked' }))
          .join('');
      }
    } else {
      likedEl.style.display = 'none';
    }
  }

  renderAllGamesGrid();
}

// Contact page (FormSubmit): guarantee POST — some caches/CDNs serve stale markup without method.
(function ensureContactFormUsesPost() {
  const form = document.querySelector('form.contact-form[action*="formsubmit.co"]');
  if (!form) return;
  form.method = 'post';
  form.setAttribute('method', 'POST');
})();

// First paint: nav + hub (don’t wait for auth round-trip).
if (document.getElementById('nav-account-area')) {
  renderNavAccount();
}
if (document.getElementById('hero-games-slot') || document.getElementById('all-games-grid')) {
  renderSections();
}
