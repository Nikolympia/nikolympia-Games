/**
 * Survival Danmaku — infinite bullet-hell dodger
 * Tweak CONFIG below to rebalance difficulty.
 */
(function () {
  'use strict';

  // ═══ TUNING (edit these) ═══════════════════════════════════
  const CONFIG = {
    CANVAS_W: 880,
    CANVAS_H: 620,
    /** Base move speed (px/s) */
    PLAYER_SPEED: 280,
    /** Focus / Shift — slow precision */
    FOCUS_SPEED: 108,
    /** Collision radius (very small = fair) */
    HIT_RADIUS: 3.6,
    /** Graze ring — outside hit, inside this from bullet center */
    GRAZE_MARGIN: 14,
    /** Graze points per second while grazing (scaled by overlap) */
    GRAZE_PER_SEC: 42,
    /** Max bullets before culling oldest */
    MAX_BULLETS: 2200,
    /** Cull bullets this far outside playfield */
    CULL_MARGIN: 120,
    /** Difficulty ramps (gentle; scaled again per-run) */
    DIFF_LINEAR: 0.015,
    DIFF_QUAD: 0.000035,
    DIFF_CAP: 2.65,
    /** Storage */
    STORAGE_KEY: 'danmaku_survival_best_v1',
    NAME_STORAGE_KEY: 'danmaku_player_name_v1',
  };

  const FS_COLLECTION = 'danmaku_survival_leaderboard';
  const LB_FETCH_CAP = 200;
  const LB_SHOW = 15;

  const COLORS = {
    radial: '#ff5577',
    spiral: '#55ffcc',
    aimed: '#ffaa44',
    wave: '#7799ff',
    rotate: '#dd77ff',
    ring: '#66eeff',
  };

  /**
   * New profile every run: unlock order, speeds, densities, and pattern biases all roll fresh.
   * Seeded RNG so one run stays coherent but replays feel different.
   */
  function createRunProfile() {
    let seed = (Math.floor(Math.random() * 0x7fffffff) ^ (Date.now() & 0xffffffff)) >>> 0;
    if (seed < 256) seed += 0x9e3779b9;
    function rnd() {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 0x100000000;
    }
    const pick = (a, b) => a + rnd() * (b - a);
    const shuf = (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        const t = a[i];
        a[i] = a[j];
        a[j] = t;
      }
      return a;
    };

    const order = shuf(['spiral', 'wave', 'rotate', 'ring']);
    const unlock = {
      spiral: 0,
      wave: 0,
      rotate: 0,
      ring: 0,
    };
    let u = pick(3, 8);
    for (const id of order) {
      unlock[id] = u;
      u += pick(5, 14);
    }

    return {
      rnd,
      seed,
      speedScale: pick(0.52, 0.76),
      bulletRScale: pick(0.65, 0.88),
      density: pick(0.32, 0.52),
      /** Multiplies difficulty() output — keeps late game tame */
      difficultyScale: pick(0.38, 0.58),
      /** Aimed bullets err by this many radians */
      aimJitter: pick(0.12, 0.32),
      /** Radial: leave wedge gaps (skip every Nth bullet) */
      radialGapN: 6 + Math.floor(rnd() * 7),
      radialGapPhase: Math.floor(rnd() * 6),
      /** Per-pattern cadence multipliers */
      intMul: {
        radial: pick(0.75, 1.35),
        aimed: pick(0.8, 1.4),
        wave: pick(0.75, 1.3),
        ring: pick(0.8, 1.35),
        rotate: pick(0.75, 1.3),
      },
      /** Spiral bullets per frame scale (capped in code) */
      spiralStrength: pick(0.4, 0.85),
      unlock,
      radial2At: pick(16, 38),
      streamAt: pick(32, 52),
      bossAt: pick(55, 95),
      /** Random motion offsets so paths never match last run */
      phaseA: rnd() * Math.PI * 2,
      phaseB: rnd() * Math.PI * 2,
      phaseC: rnd() * Math.PI * 2,
      spiralSign: rnd() > 0.5 ? 1 : -1,
      waveColSkip: pick(0.08, 0.22),
      rotateCenterX: CONFIG.CANVAS_W * (0.38 + rnd() * 0.24),
      rotateCenterY: CONFIG.CANVAS_H * (0.28 + rnd() * 0.2),
      radialWanderX: pick(0.35, 1.15),
      radialWanderY: pick(0.35, 1.0),
      radialSpin: pick(0.26, 0.52),
      radial2IntervalMul: pick(1.35, 1.95),
      radial2AnchorX: CONFIG.CANVAS_W * pick(0.26, 0.74),
      radial2BaseY: pick(88, 138),
      /** Optional layers: rolled once per run */
      radial2Enabled: rnd() < 0.82,
      streamEnabled: rnd() < 0.88,
      bossEnabled: rnd() < 0.72,
    };
  }

  let run = createRunProfile();

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const overlay = document.getElementById('overlay');
  const elTime = document.getElementById('time-display');
  const elBest = document.getElementById('best-display');
  const elGraze = document.getElementById('graze-display');
  const elFinalTime = document.getElementById('final-time');
  const elFinalBest = document.getElementById('final-best');
  const btnRetry = document.getElementById('btn-retry');
  const menuOverlay = document.getElementById('menu-overlay');
  const pauseOverlay = document.getElementById('pause-overlay');
  const nameInput = document.getElementById('player-name');
  const btnStart = document.getElementById('btn-start');
  const menuLbBody = document.getElementById('menu-lb-body');
  const btnPause = document.getElementById('btn-pause');
  const btnResume = document.getElementById('btn-resume');
  const elPilot = document.getElementById('pilot-display');
  const elLbStatus = document.getElementById('lb-submit-status');

  let bestTime = 0;
  try {
    bestTime = parseFloat(localStorage.getItem(CONFIG.STORAGE_KEY) || '0') || 0;
  } catch (_) {}
  elBest.textContent = bestTime.toFixed(2);

  function fsDb() {
    return typeof window !== 'undefined' ? window.__NK_FB_DB : null;
  }
  function hasFirestore() {
    return !!(fsDb() && typeof firebase !== 'undefined' && firebase.firestore);
  }

  function getPlayerName() {
    try {
      const s = (nameInput && nameInput.value) || localStorage.getItem(CONFIG.NAME_STORAGE_KEY) || '';
      const t = String(s).replace(/[^a-zA-Z0-9_ -]/g, '').trim().slice(0, 16);
      return t || 'Player';
    } catch (_) {
      return 'Player';
    }
  }

  function savePlayerName() {
    try {
      localStorage.setItem(CONFIG.NAME_STORAGE_KEY, getPlayerName());
    } catch (_) {}
  }

  function loadNameIntoInput() {
    try {
      const s = localStorage.getItem(CONFIG.NAME_STORAGE_KEY) || '';
      if (nameInput) nameInput.value = String(s).slice(0, 16);
    } catch (_) {}
  }

  function mergeBestPerPlayer(rows) {
    const best = new Map();
    for (const r of rows) {
      const key = (r.name || 'Player').trim().toLowerCase() || 'player';
      const cur = best.get(key);
      if (!cur || r.score > cur.score) best.set(key, r);
    }
    return Array.from(best.values()).sort((a, b) => b.score - a.score);
  }

  function formatLbRow(i, name, scoreCs) {
    const sec = (Number(scoreCs) || 0) / 100;
    return (
      '<div class="menu-lb-row"><span class="t">#' +
      (i + 1) +
      '</span><span>' +
      escapeHtml(name) +
      '</span><span>' +
      sec.toFixed(2) +
      's</span></div>'
    );
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  async function fetchGlobalLb() {
    if (!menuLbBody) return;
    if (!hasFirestore()) {
      menuLbBody.innerHTML =
        '<p class="menu-lb-off">Firebase not loaded — open from your hosted site with <code>firebase-config.js</code>.</p>';
      return;
    }
    menuLbBody.textContent = 'Loading…';
    try {
      const col = fsDb().collection(FS_COLLECTION).orderBy('score', 'desc').limit(LB_FETCH_CAP);
      let snap;
      try {
        snap = await col.get({ source: 'server' });
      } catch (_) {
        snap = await col.get();
      }
      const rows = snap.docs.map((d) => {
        const x = d.data();
        return {
          name: String(x.name || 'Player').slice(0, 24),
          score: Math.floor(Number(x.score) || 0),
        };
      });
      const merged = mergeBestPerPlayer(rows).slice(0, LB_SHOW);
      if (!merged.length) {
        menuLbBody.innerHTML = '<p>No scores yet — be first on the board.</p>';
        return;
      }
      menuLbBody.innerHTML = merged.map((r, i) => formatLbRow(i, r.name, r.score)).join('');
    } catch (e) {
      menuLbBody.innerHTML =
        '<p class="menu-lb-off">Could not load board. Check Firestore rules for <code>' +
        FS_COLLECTION +
        '</code>.</p>';
    }
  }

  async function submitGlobalScore(secondsFloat, grazePts) {
    if (!hasFirestore() || secondsFloat < 0.35) return;
    const centis = Math.min(1999999999, Math.max(0, Math.floor(secondsFloat * 100)));
    const secInt = Math.min(9999999, Math.max(0, Math.floor(secondsFloat)));
    const safeName = getPlayerName().replace(/[^a-zA-Z0-9_ -]/g, '').slice(0, 24) || 'Player';
    const text = ('G' + Math.floor(grazePts || 0)).slice(0, 40);
    if (elLbStatus) elLbStatus.textContent = 'Uploading score…';
    try {
      await fsDb().collection(FS_COLLECTION).add({
        name: safeName,
        score: centis,
        seconds: secInt,
        text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      if (elLbStatus) elLbStatus.textContent = 'Score posted to global board.';
    } catch (e) {
      if (elLbStatus) elLbStatus.textContent = 'Could not upload — check rules / connection.';
    }
  }

  function syncPauseUi() {
    if (!btnPause) return;
    const on = phase === 'playing' || phase === 'paused';
    btnPause.style.visibility = on ? 'visible' : 'hidden';
    btnPause.textContent = phase === 'paused' ? 'Resume' : 'Pause';
    btnPause.setAttribute('aria-pressed', phase === 'paused' ? 'true' : 'false');
  }

  /** @type {{x:number,y:number}} */
  let player = { x: CONFIG.CANVAS_W / 2, y: CONFIG.CANVAS_H * 0.72 };
  let bullets = [];
  let keys = Object.create(null);
  /** @type {'menu'|'playing'|'paused'|'dead'} */
  let phase = 'menu';
  let survivalTime = 0;
  let grazeTotal = 0;
  let lastTs = 0;
  let audioCtx = null;
  let bgOsc = null;
  let bgGain = null;

  /** Pattern phase accumulators */
  let pat = {
    radialAcc: 0,
    radial2Acc: 0,
    aimedAcc: 0,
    spiralAngle: 0,
    wavePhase: 0,
    waveRowAcc: 0,
    rotateAngle: 0,
    rotateBurstAcc: 0,
    ringAcc: 0,
    streamAcc: 0,
    bossSpin: 0,
  };

  function difficulty() {
    const t = survivalTime;
    let d = 1 + t * CONFIG.DIFF_LINEAR + t * t * CONFIG.DIFF_QUAD;
    d = Math.min(CONFIG.DIFF_CAP, d) * run.difficultyScale;
    const warm = Math.min(1, t / 5.5);
    d = 0.62 + (d - 0.62) * warm;
    return Math.max(0.52, d);
  }

  function spawnBullet(x, y, vx, vy, r, color, kind) {
    if (bullets.length >= CONFIG.MAX_BULLETS) {
      bullets.splice(0, Math.floor(CONFIG.MAX_BULLETS * 0.1));
    }
    const vxS = vx * run.speedScale;
    const vyS = vy * run.speedScale;
    const rS = Math.max(2.2, r * run.bulletRScale);
    bullets.push({
      x,
      y,
      vx: vxS,
      vy: vyS,
      r: rS,
      color,
      kind,
      age: 0,
      trail: [],
      grazeCd: 0,
    });
  }

  function cullBullets() {
    const w = CONFIG.CANVAS_W;
    const h = CONFIG.CANVAS_H;
    const m = CONFIG.CULL_MARGIN;
    bullets = bullets.filter((b) => b.x > -m && b.x < w + m && b.y > -m && b.y < h + m);
  }

  /** Radial burst from point — wedge gaps + run density */
  function patternRadial(cx, cy, count, speed, angle0, spread) {
    const D = difficulty();
    const n = Math.max(8, Math.floor((count + D * 0.65) * run.density));
    const spd = speed * (0.78 + D * 0.055);
    const br = 3.4 + D * 0.18;
    for (let i = 0; i < n; i++) {
      if ((i + run.radialGapPhase) % run.radialGapN === 0) continue;
      const a = angle0 + (spread * i) / Math.max(1, n);
      spawnBullet(
        cx,
        cy,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        br,
        COLORS.radial,
        'radial'
      );
    }
  }

  /** Spiral stream — capped rate, run-unique phase */
  function patternSpiral(dt) {
    const D = difficulty();
    pat.spiralAngle += dt * run.spiralSign * (0.95 + D * 0.28);
    const cx =
      CONFIG.CANVAS_W * 0.5 +
      Math.sin(survivalTime * run.radialWanderX + run.phaseA) * (95 + run.rnd() * 40);
    const cy = 48 + Math.cos(survivalTime * run.radialWanderY + run.phaseB) * 32;
    const base = 1 + Math.floor(D * 0.38 * run.spiralStrength);
    const perFrame = Math.min(2, Math.max(1, base));
    const spd = 78 + D * 28;
    for (let k = 0; k < perFrame; k++) {
      const a = pat.spiralAngle + run.phaseC + k * 0.42;
      spawnBullet(
        cx,
        cy,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        3.2,
        COLORS.spiral,
        'spiral'
      );
    }
  }

  /** Aimed at player — imprecise so always dodgeable */
  function patternAimed() {
    const D = difficulty();
    const edge = Math.floor(run.rnd() * 4);
    let x, y;
    const margin = 20;
    const w = CONFIG.CANVAS_W;
    const h = CONFIG.CANVAS_H;
    if (edge === 0) {
      x = margin + run.rnd() * (w - margin * 2);
      y = -30;
    } else if (edge === 1) {
      x = w + 30;
      y = margin + run.rnd() * (h - margin * 2);
    } else if (edge === 2) {
      x = margin + run.rnd() * (w - margin * 2);
      y = h + 30;
    } else {
      x = -30;
      y = margin + run.rnd() * (h - margin * 2);
    }
    const lead = 0.28;
    const tx = player.x + player.vx * lead;
    const ty = player.y + player.vy * lead;
    let dx = tx - x;
    let dy = ty - y;
    const len = Math.hypot(dx, dy) || 1;
    const err = (run.rnd() - 0.5) * 2 * run.aimJitter;
    const c = Math.cos(err);
    const s = Math.sin(err);
    const rdx = (dx / len) * c - (dy / len) * s;
    const rdy = (dx / len) * s + (dy / len) * c;
    const spd = (118 + D * 38) * (0.9 + run.rnd() * 0.1);
    spawnBullet(x, y, rdx * spd, rdy * spd, 3.6, COLORS.aimed, 'aimed');
  }

  /** Descending wave — random column holes */
  function spawnWaveRow() {
    const D = difficulty();
    pat.wavePhase += 0.42 + run.rnd() * 0.2;
    const cols = Math.max(8, Math.floor((9 + Math.min(5, D * 0.9)) * run.density));
    const phase = pat.wavePhase + run.phaseA;
    const vy = 52 + D * 18;
    for (let i = 0; i < cols; i++) {
      if (run.rnd() < run.waveColSkip) continue;
      const px = (i + 0.5) * (CONFIG.CANVAS_W / cols);
      const vx = Math.sin(phase + i * 0.55) * (26 + D * 10);
      spawnBullet(px, -24, vx, vy, 3.2, COLORS.wave, 'wave');
    }
  }

  /** Rotating cross — fewer arms pressure, run-specific center */
  function patternRotating(dt) {
    const D = difficulty();
    pat.rotateAngle += dt * (0.62 + D * 0.12);
    pat.rotateBurstAcc += dt;
    const burstInt = Math.max(0.1, (0.16 - (D - 1) * 0.008) * run.intMul.rotate);
    if (pat.rotateBurstAcc < burstInt) return;
    pat.rotateBurstAcc = 0;
    const cx = run.rotateCenterX + Math.sin(survivalTime + run.phaseB) * 30;
    const cy = run.rotateCenterY + Math.cos(survivalTime * 0.8) * 25;
    const arms = 3 + (D > 1.35 ? 1 : 0);
    const perBurst = Math.min(3, Math.max(1, Math.floor(1 + D * 0.32)));
    for (let a = 0; a < arms; a++) {
      const ang = pat.rotateAngle + run.phaseC + (a * Math.PI * 2) / arms;
      for (let i = 0; i < perBurst; i++) {
        const jitter = (i - perBurst * 0.5) * 0.08;
        const s = 58 + D * 20 + i * 6;
        spawnBullet(
          cx,
          cy,
          Math.cos(ang + jitter) * s,
          Math.sin(ang + jitter) * s,
          3.5,
          COLORS.rotate,
          'rotate'
        );
      }
    }
  }

  /** Expanding ring — fewer bullets, gaps via skip */
  function patternRing() {
    const D = difficulty();
    const cx =
      CONFIG.CANVAS_W * 0.5 + (run.rnd() - 0.5) * (90 + run.rnd() * 60);
    const cy = CONFIG.CANVAS_H * 0.42 + (run.rnd() - 0.5) * (70 + run.rnd() * 50);
    const count = Math.max(12, Math.floor((14 + D * 3.5) * run.density));
    const spd = 48 + D * 14;
    const skip = run.radialGapN > 8 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      if (i % skip === 0 && run.rnd() < 0.35) continue;
      const a = (i / count) * Math.PI * 2 + run.phaseA;
      spawnBullet(cx, cy, Math.cos(a) * spd, Math.sin(a) * spd, 3.2, COLORS.ring, 'ring');
    }
  }

  /** Side stream — late, throttled */
  function patternCrossStream(dt) {
    if (!run.streamEnabled || survivalTime < run.streamAt) return;
    const D = difficulty();
    pat.streamAcc += dt;
    const interval = Math.max(0.16, 0.42 - (D - 1) * 0.028);
    if (pat.streamAcc < interval) return;
    pat.streamAcc = 0;
    const y = -20;
    const t = survivalTime * (2.2 + run.rnd()) + run.phaseB;
    spawnBullet(
      (CONFIG.CANVAS_W * 0.5 + Math.sin(t) * 180 + run.phaseA * 40) % CONFIG.CANVAS_W,
      y,
      Math.sin(t * 1.2 + run.phaseC) * 70,
      88 + D * 14,
      2.9,
      COLORS.aimed,
      'aimed'
    );
  }

  /** Corner spinner — very late, low volume */
  function patternBossSpin(dt) {
    if (!run.bossEnabled || survivalTime < run.bossAt) return;
    const D = difficulty();
    pat.bossSpin += dt * (1.5 + D * 0.2);
    const corners = [
      [CONFIG.CANVAS_W - 36, 90],
      [36, 90],
      [CONFIG.CANVAS_W - 36, CONFIG.CANVAS_H - 90],
      [36, CONFIG.CANVAS_H - 90],
    ];
    const ci = Math.floor(survivalTime * 0.15 + run.phaseA) % 4;
    const cx = corners[ci][0];
    const cy = corners[ci][1];
    const n = 1 + Math.floor((D - 1) * 0.45);
    for (let i = 0; i < n; i++) {
      const a = pat.bossSpin + i * 0.85 + run.phaseB;
      const spd = 82 + D * 18;
      spawnBullet(
        cx,
        cy,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        3,
        COLORS.rotate,
        'rotate'
      );
    }
  }

  function updatePatterns(dt) {
    const D = difficulty();

    // Primary radial — always, generous timing
    pat.radialAcc += dt;
    const radialInt =
      Math.max(0.72, 2.15 - D * 0.22) * run.intMul.radial;
    if (pat.radialAcc >= radialInt) {
      pat.radialAcc = 0;
      const cx =
        CONFIG.CANVAS_W * 0.5 +
        Math.sin(survivalTime * (0.85 + run.radialWanderX * 0.3) + run.phaseA) * 150;
      const cy =
        72 +
        Math.cos(survivalTime * (0.75 + run.radialWanderY * 0.25) + run.phaseB) * 48;
      patternRadial(
        cx,
        cy,
        11,
        72 + D * 12,
        survivalTime * run.radialSpin + run.phaseC,
        Math.PI * 2
      );
    }

    // Second radial — random unlock time, optional for this run
    if (run.radial2Enabled && survivalTime >= run.radial2At) {
      pat.radial2Acc += dt;
      if (pat.radial2Acc >= radialInt * run.radial2IntervalMul) {
        pat.radial2Acc = 0;
        patternRadial(
          run.radial2AnchorX + Math.sin(survivalTime + run.phaseA) * 50,
          run.radial2BaseY + Math.sin(survivalTime * 0.7) * 22,
          8,
          62 + D * 11,
          survivalTime * -0.42 + run.phaseB,
          Math.PI * 2
        );
      }
    }

    // Aimed — slow cadence, max 1–2 per tick
    pat.aimedAcc += dt;
    const aimedInt = Math.max(0.32, 0.72 - D * 0.045) * run.intMul.aimed;
    const aimedCount = D < 1.2 ? 1 : Math.min(2, 1 + Math.floor((D - 1.1) * 0.4));
    while (pat.aimedAcc >= aimedInt) {
      pat.aimedAcc -= aimedInt;
      for (let i = 0; i < aimedCount; i++) patternAimed();
    }

    if (survivalTime >= run.unlock.spiral) {
      patternSpiral(dt);
    }

    if (survivalTime >= run.unlock.wave) {
      pat.waveRowAcc += dt;
      const waveInt = Math.max(0.42, 0.88 - D * 0.045) * run.intMul.wave;
      const rowsPerTick = survivalTime > run.streamAt ? 2 : 1;
      let spawned = 0;
      while (pat.waveRowAcc >= waveInt && spawned < rowsPerTick) {
        pat.waveRowAcc -= waveInt;
        spawnWaveRow();
        spawned++;
      }
    }

    if (survivalTime >= run.unlock.ring) {
      pat.ringAcc += dt;
      const ringInt = Math.max(1.35, 3.2 - D * 0.28) * run.intMul.ring;
      if (pat.ringAcc >= ringInt) {
        pat.ringAcc = 0;
        patternRing();
      }
    }

    if (survivalTime >= run.unlock.rotate) {
      patternRotating(dt);
    }

    patternCrossStream(dt);
    patternBossSpin(dt);
  }

  function updateBullets(dt) {
    const w = CONFIG.CANVAS_W;
    const h = CONFIG.CANVAS_H;
    for (const b of bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.age += dt;
      b.grazeCd = Math.max(0, b.grazeCd - dt);
      // Slight homing fade on wave bullets (keep readable)
      if (b.kind === 'wave') {
        b.vy += 7 * dt;
      }
      if (b.age > 0.016 && b.trail.length < 4) {
        if (Math.floor(b.age * 60) % 2 === 0) {
          b.trail.push({ x: b.x, y: b.y });
          if (b.trail.length > 4) b.trail.shift();
        }
      }
    }
    cullBullets();
  }

  let playerVx = 0;
  let playerVy = 0;

  function updatePlayer(dt) {
    const focus = keys['shift'] || keys['shiftleft'] || keys['shiftright'];
    const spd = focus ? CONFIG.FOCUS_SPEED : CONFIG.PLAYER_SPEED;
    let mx = 0;
    let my = 0;
    if (keys['a'] || keys['arrowleft']) mx -= 1;
    if (keys['d'] || keys['arrowright']) mx += 1;
    if (keys['w'] || keys['arrowup']) my -= 1;
    if (keys['s'] || keys['arrowdown']) my += 1;
    if (mx && my) {
      const inv = 1 / Math.SQRT2;
      mx *= inv;
      my *= inv;
    }
    player.vx = mx * spd;
    player.vy = my * spd;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    const pad = 10;
    const r = 8;
    player.x = Math.max(pad + r, Math.min(CONFIG.CANVAS_W - pad - r, player.x));
    player.y = Math.max(pad + r, Math.min(CONFIG.CANVAS_H - pad - r, player.y));
  }

  function checkHitAndGraze(dt) {
    const hx = player.x;
    const hy = player.y;
    const hitR = CONFIG.HIT_RADIUS;
    const hitR2 = hitR * hitR;
    const grazeReach = CONFIG.GRAZE_MARGIN;

    for (const b of bullets) {
      const dx = b.x - hx;
      const dy = b.y - hy;
      const dist = Math.hypot(dx, dy);
      const hitDist = b.r + hitR;
      if (dist <= hitDist) {
        return true;
      }
      // Graze: close but not hitting
      if (dist < b.r + hitR + grazeReach && dist > hitDist + 0.5 && b.grazeCd <= 0) {
        const g = 1 - (dist - hitDist) / grazeReach;
        if (g > 0) {
          grazeTotal += dt * CONFIG.GRAZE_PER_SEC * g * g;
          b.grazeCd = 0.05;
        }
      }
    }
    return false;
  }

  function resetPat() {
    pat = {
      radialAcc: 0,
      radial2Acc: 0,
      aimedAcc: 0,
      spiralAngle: 0,
      wavePhase: 0,
      waveRowAcc: 0,
      rotateAngle: 0,
      rotateBurstAcc: 0,
      ringAcc: 0,
      streamAcc: 0,
      bossSpin: 0,
    };
  }

  function die() {
    phase = 'dead';
    if (survivalTime > bestTime) {
      bestTime = survivalTime;
      try {
        localStorage.setItem(CONFIG.STORAGE_KEY, String(bestTime));
      } catch (_) {}
    }
    elFinalTime.textContent = survivalTime.toFixed(2);
    elFinalBest.textContent = bestTime.toFixed(2);
    elBest.textContent = bestTime.toFixed(2);
    overlay.classList.remove('hidden');
    pauseOverlay.classList.add('hidden');
    stopAudio();
    syncPauseUi();
    submitGlobalScore(survivalTime, grazeTotal);
  }

  function openMenu() {
    phase = 'menu';
    run = createRunProfile();
    bullets = [];
    survivalTime = 0;
    grazeTotal = 0;
    player.x = CONFIG.CANVAS_W / 2;
    player.y = CONFIG.CANVAS_H * 0.72;
    player.vx = 0;
    player.vy = 0;
    resetPat();
    overlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    menuOverlay.classList.remove('hidden');
    if (elLbStatus) elLbStatus.textContent = '';
    loadNameIntoInput();
    syncPauseUi();
    fetchGlobalLb();
    elTime.textContent = '0.00';
    elGraze.textContent = '0';
    if (elPilot) elPilot.textContent = '—';
  }

  function startRunFromMenu() {
    savePlayerName();
    run = createRunProfile();
    bullets = [];
    survivalTime = 0;
    grazeTotal = 0;
    player.x = CONFIG.CANVAS_W / 2;
    player.y = CONFIG.CANVAS_H * 0.72;
    player.vx = 0;
    player.vy = 0;
    resetPat();
    phase = 'playing';
    menuOverlay.classList.add('hidden');
    overlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    lastTs = performance.now();
    elGraze.textContent = '0';
    elTime.textContent = '0.00';
    if (elPilot) elPilot.textContent = getPlayerName();
    syncPauseUi();
    maybeStartAudio();
    resumeAudio();
  }

  function togglePause() {
    if (phase === 'playing') {
      phase = 'paused';
      pauseOverlay.classList.remove('hidden');
      syncPauseUi();
      stopAudio();
    } else if (phase === 'paused') {
      phase = 'playing';
      pauseOverlay.classList.add('hidden');
      lastTs = performance.now();
      syncPauseUi();
      resumeAudio();
    }
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, CONFIG.CANVAS_H);
    g.addColorStop(0, '#070a14');
    g.addColorStop(0.5, '#0a0e1a');
    g.addColorStop(1, '#05060c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);

    ctx.strokeStyle = 'rgba(80, 120, 200, 0.04)';
    ctx.lineWidth = 1;
    const step = 48;
    const ox = (survivalTime * 18) % step;
    for (let x = -step; x < CONFIG.CANVAS_W + step; x += step) {
      ctx.beginPath();
      ctx.moveTo(x + ox, 0);
      ctx.lineTo(x + ox, CONFIG.CANVAS_H);
      ctx.stroke();
    }
    for (let y = -step; y < CONFIG.CANVAS_H + step; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y + ox * 0.3);
      ctx.lineTo(CONFIG.CANVAS_W, y + ox * 0.3);
      ctx.stroke();
    }
  }

  function drawBullets() {
    for (const b of bullets) {
      for (let i = 0; i < b.trail.length; i++) {
        const tr = b.trail[i];
        const alpha = (i + 1) / (b.trail.length + 2) * 0.35;
        ctx.beginPath();
        ctx.fillStyle = b.color;
        ctx.globalAlpha = alpha;
        ctx.arc(tr.x, tr.y, b.r * (0.4 + i * 0.15), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.fillStyle = b.color;
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayer() {
    const focus = keys['shift'] || keys['shiftleft'] || keys['shiftright'];
    if (focus) {
      ctx.strokeStyle = 'rgba(120, 220, 255, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(player.x, player.y, CONFIG.HIT_RADIUS + 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.shadowColor = '#aaddff';
    ctx.shadowBlur = focus ? 16 : 10;
    ctx.fillStyle = '#e8f4ff';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#2a4060';
    ctx.beginPath();
    ctx.arc(player.x - 2, player.y - 2, 1.5, 0, Math.PI * 2);
    ctx.arc(player.x + 2, player.y - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawVignette() {
    const rg = ctx.createRadialGradient(
      CONFIG.CANVAS_W / 2,
      CONFIG.CANVAS_H / 2,
      CONFIG.CANVAS_H * 0.2,
      CONFIG.CANVAS_W / 2,
      CONFIG.CANVAS_H / 2,
      CONFIG.CANVAS_H * 0.75
    );
    rg.addColorStop(0, 'rgba(0,0,0,0)');
    rg.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);
  }

  function tick(ts) {
    if (phase === 'menu' || phase === 'dead') {
      lastTs = ts;
      drawBackground();
      drawBullets();
      drawPlayer();
      drawVignette();
      requestAnimationFrame(tick);
      return;
    }
    if (phase === 'paused') {
      lastTs = ts;
      drawBackground();
      drawBullets();
      drawPlayer();
      drawVignette();
      requestAnimationFrame(tick);
      return;
    }

    const dt = Math.min(0.05, (ts - lastTs) / 1000) || 0.016;
    lastTs = ts;
    survivalTime += dt;

    updatePatterns(dt);
    updateBullets(dt);
    updatePlayer(dt);

    if (checkHitAndGraze(dt)) {
      die();
      drawBackground();
      drawBullets();
      drawPlayer();
      drawVignette();
      requestAnimationFrame(tick);
      return;
    }

    updateAudioIntensity();

    elTime.textContent = survivalTime.toFixed(2);
    elGraze.textContent = String(Math.floor(grazeTotal));

    drawBackground();
    drawBullets();
    drawPlayer();
    drawVignette();

    requestAnimationFrame(tick);
  }

  function maybeStartAudio() {
    if (audioCtx) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
      bgOsc = audioCtx.createOscillator();
      bgGain = audioCtx.createGain();
      bgOsc.type = 'triangle';
      bgOsc.frequency.value = 48;
      bgGain.gain.value = 0;
      bgOsc.connect(bgGain);
      bgGain.connect(audioCtx.destination);
      bgOsc.start();
    } catch (_) {}
  }

  function resumeAudio() {
    maybeStartAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if (bgGain && audioCtx) {
      bgGain.gain.cancelScheduledValues(audioCtx.currentTime);
      bgGain.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + 0.4);
    }
  }

  function updateAudioIntensity() {
    if (!bgOsc || !audioCtx) return;
    const t = survivalTime;
    const f = 48 + Math.min(36, t * 0.55) + Math.sin(t * 0.7) * 2;
    bgOsc.frequency.setTargetAtTime(f, audioCtx.currentTime, 0.08);
  }

  function stopAudio() {
    if (bgGain && audioCtx) {
      try {
        bgGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.15);
      } catch (_) {}
    }
  }

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (e.key === 'Shift') keys['shift'] = true;

    if (e.key === 'p' && (phase === 'playing' || phase === 'paused')) {
      e.preventDefault();
      togglePause();
      return;
    }
    if ((e.key === 'Escape' || e.code === 'Escape') && (phase === 'playing' || phase === 'paused')) {
      e.preventDefault();
      togglePause();
      return;
    }

    if (phase === 'dead' && (e.key === 'r' || e.key === 'Enter')) {
      e.preventDefault();
      openMenu();
      return;
    }

    if (phase === 'menu' && e.key === 'Enter' && document.activeElement === nameInput) {
      e.preventDefault();
      startRunFromMenu();
      return;
    }

    if (phase === 'playing' || phase === 'paused') resumeAudio();
  });
  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
    if (e.key === 'Shift') keys['shift'] = false;
  });

  btnRetry.addEventListener('click', () => openMenu());
  btnStart.addEventListener('click', () => startRunFromMenu());
  btnPause.addEventListener('click', () => togglePause());
  btnResume.addEventListener('click', () => togglePause());

  canvas.addEventListener(
    'pointerdown',
    () => {
      if (phase === 'playing' || phase === 'paused') resumeAudio();
    },
    { passive: true }
  );

  openMenu();
  lastTs = performance.now();
  syncPauseUi();
  requestAnimationFrame(tick);
})();
