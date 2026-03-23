// From Firebase Console → Project settings → Your web app (Config)

const firebaseConfig = {
  apiKey: "AIzaSyB8al6E_vdGswtlt4u-2-_EUd_N4jvtd-A",
  authDomain: "nikolympia-games.firebaseapp.com",
  projectId: "nikolympia-games",
  storageBucket: "nikolympia-games.firebasestorage.app",
  messagingSenderId: "290202105522",
  appId: "1:290202105522:web:4286717d5e49b34868bbab",
  measurementId: "G-TLV9DC8KLL"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
// Used by game.js for the online leaderboard (HTTPS-safe)
window.__NK_FB_DB = db;
