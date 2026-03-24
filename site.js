const GAMES_DB = {
  'void-survivors': {
    id: 'void-survivors',
    name: 'Void Survivors',
    url: 'game.html',
    img: 'void_survivors_cover.png',
    tags: ['Survival', 'Roguelike', 'Action'],
    desc: 'Survive waves of enemies, grab weapons, evolve them, fight bosses every 10 levels. Global leaderboard included.',
    live: true
  },
  'ascension-protocol': {
    id: 'ascension-protocol',
    name: 'Ascension Protocol',
    url: 'ascension.html',
    img: 'ascension_cover.svg',
    tags: ['Incremental', 'Strategy', 'Idle'],
    desc: 'Long-form AI awakening clicker: six phases, five currencies, network map, space colonies, quantum bursts — built for days of progression.',
    live: true
  }
};

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
    <h2>Sign In</h2>
    <p>Sign in to save your stats, like games, and sync across devices.</p>

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

  return `<div class="game-card">
    <img src="${game.img}" alt="${game.name}" class="game-card-img" loading="lazy">
    <div class="game-card-body">
      <h3>${game.name}</h3>
      <div class="game-card-tags">
        ${game.tags.map(t => `<span class="game-tag${t === 'Action' ? ' action' : ''}">${t}</span>`).join('')}
      </div>
      <p>${game.desc}</p>
      <div class="game-card-footer">
        <a href="${game.url}" class="game-play-btn" onclick="trackPlay('${game.id}')">&#9654; Play</a>
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

  const allEl = document.getElementById('all-games-grid');
  if (allEl) {
    const liveGames = Object.values(GAMES_DB).filter(g => g.live);
    allEl.innerHTML = liveGames.map(g => renderGameCard(g)).join('') + `
      <div class="game-card coming-soon">
        <div class="game-card-placeholder">&#128302;</div>
        <div class="game-card-body">
          <h3>???</h3>
          <div class="game-card-tags"><span class="game-tag">TBA</span></div>
          <p>New game in the works.</p>
          <div class="game-card-footer"><span class="game-status">Coming soon</span></div>
        </div>
      </div>
      <div class="game-card coming-soon">
        <div class="game-card-placeholder">&#127918;</div>
        <div class="game-card-body">
          <h3>???</h3>
          <div class="game-card-tags"><span class="game-tag">TBA</span></div>
          <p>More on the way.</p>
          <div class="game-card-footer"><span class="game-status">Planned</span></div>
        </div>
      </div>`;
  }
}
