/**
 * Nikolympia — shared Firestore game saves
 * Path: users/{uid}/games/{gameId}  { save: <object>, updatedAt: ms, version: 1 }
 * Requires: firebase-config.js (window.__NK_FB_DB), firebase-auth, same origin as hub for session.
 */
(function (global) {
  'use strict';

  const DEBOUNCE_MS = 2000;
  const timers = {};

  function db() {
    return typeof window !== 'undefined' ? window.__NK_FB_DB : null;
  }
  function getAuth() {
    return typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null;
  }

  function refFor(gameId) {
    const a = getAuth();
    const d = db();
    if (!a || !d || !a.currentUser) return null;
    return d.collection('users').doc(a.currentUser.uid).collection('games').doc(gameId);
  }

  /** Strip undefined so Firestore set() does not throw */
  function stripUndefined(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  const NkCloudGameSave = {
    GAME_VOID: 'void_survivors',
    GAME_UOL: 'up_or_lose',
    GAME_ASCENSION: 'ascension_protocol',

    /**
     * @param {string} gameId
     * @returns {Promise<{ save: object, updatedAt: number } | null>}
     */
    async pull(gameId) {
      const r = refFor(gameId);
      if (!r) return null;
      try {
        const snap = await r.get();
        if (!snap.exists) return null;
        const data = snap.data();
        if (!data || typeof data.save !== 'object' || data.save === null) return null;
        return { save: data.save, updatedAt: Number(data.updatedAt) || 0 };
      } catch (e) {
        console.warn('[NkCloudGameSave] pull', gameId, e);
        return null;
      }
    },

    /**
     * @param {string} gameId
     * @param {object} savePayload plain JSON-serializable object
     */
    async pushNow(gameId, savePayload) {
      const r = refFor(gameId);
      if (!r || !savePayload || typeof savePayload !== 'object') return;
      const updatedAt = Date.now();
      try {
        const save = stripUndefined(savePayload);
        await r.set({ save, updatedAt, version: 1 }, { merge: false });
      } catch (e) {
        console.warn('[NkCloudGameSave] pushNow', gameId, e);
      }
    },

    /**
     * @param {string} gameId
     * @param {() => object} getPayload
     * @param {number} [debounceMs]
     */
    schedulePush(gameId, getPayload, debounceMs) {
      const ms = debounceMs == null ? DEBOUNCE_MS : debounceMs;
      clearTimeout(timers[gameId]);
      timers[gameId] = setTimeout(() => {
        const a = getAuth();
        if (!a || !a.currentUser) return;
        try {
          const p = getPayload();
          if (p && typeof p === 'object') NkCloudGameSave.pushNow(gameId, p);
        } catch (e) {
          console.warn('[NkCloudGameSave] schedulePush', gameId, e);
        }
      }, ms);
    },

    /** Push immediately when user hides tab (best-effort) */
    onVisibilityFlush(gameId, getPayload) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'hidden') return;
        const a = getAuth();
        if (!a || !a.currentUser) return;
        try {
          const p = getPayload();
          if (p && typeof p === 'object') NkCloudGameSave.pushNow(gameId, p);
        } catch (_) {}
      });
    },
  };

  global.NkCloudGameSave = NkCloudGameSave;
})(typeof window !== 'undefined' ? window : this);
