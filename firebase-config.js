// From Firebase Console → Project settings → Your web app (Config)
// Never throws: if SDK is blocked or init fails, hub + game still load (offline).

const firebaseConfig = {
  apiKey: "AIzaSyB8al6E_vdGswtlt4u-2-_EUd_N4jvtd-A",
  authDomain: "nikolympia-games.firebaseapp.com",
  projectId: "nikolympia-games",
  storageBucket: "nikolympia-games.firebasestorage.app",
  messagingSenderId: "290202105522",
  appId: "1:290202105522:web:4286717d5e49b34868bbab",
  measurementId: "G-TLV9DC8KLL"
};

function nkStubAuth() {
  return {
    onAuthStateChanged(cb) {
      queueMicrotask(() => { try { cb(null); } catch (e) { console.warn(e); } });
      return function noop() {};
    },
    signInWithPopup: () => Promise.reject(Object.assign(new Error('offline'), { code: 'auth/unavailable' })),
    signInWithEmailAndPassword: () => Promise.reject(Object.assign(new Error('offline'), { code: 'auth/unavailable' })),
    createUserWithEmailAndPassword: () => Promise.reject(Object.assign(new Error('offline'), { code: 'auth/unavailable' })),
    signOut: () => Promise.resolve(),
    get currentUser() { return null; },
  };
}

var auth = nkStubAuth();
var db = null;

try {
  if (typeof firebase !== 'undefined' && firebase.initializeApp) {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
    db = firebase.firestore();
    window.__NK_FB_DB = db;
  } else {
    console.warn('[Nikolympia] Firebase SDK not loaded (network/adblock). Cloud features off.');
    window.__NK_FB_DB = null;
  }
} catch (e) {
  console.warn('[Nikolympia] Firebase init failed:', e);
  auth = nkStubAuth();
  db = null;
  window.__NK_FB_DB = null;
}
