/**
 * UP OR LOSE — vertical auto-jump climber (Canvas)
 * Leaderboard: Firestore up_or_lose_leaderboard — name, score (height px), seconds (run time), text
 */
(function () {
  'use strict';

  const CW = 480;
  const CH = 720;
  const SAVE_KEY = 'up_or_lose_v1';
  const FS_COLLECTION = 'up_or_lose_leaderboard';
  /** Shown in menu table after merging best run per player */
  const LB_LIMIT = 20;
  /** Pull enough raw rows from Firestore so worldwide merge still finds true top players */
  const LB_FETCH_CAP = 300;

  const fsDb = () => (typeof window !== 'undefined' ? window.__NK_FB_DB : null);
  function hasFirestoreLB() {
    return !!(fsDb() && typeof firebase !== 'undefined' && firebase.firestore);
  }
  /** Same idea as Void Survivors (game.js): global board needs Firestore + firebase-config.js on your host. */
  function hasOnlineLeaderboard() {
    return hasFirestoreLB();
  }

  function fmtTime(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  const PW = 30;
  const PH = 36;
  const GRAVITY = 2650;
  /** Apex ≈ v²/(2g) — slightly toned down vs peak; gaps scaled to match */
  const JUMP_V = -762;
  const BOOST_V = -1035;
  const POISON_START_OFFSET = 420;
  const POISON_RISE_BASE = 34;
  const POISON_RISE_PER_D = 52;
  const POISON_RISE_PER_HEIGHT = 0.0038;
  const MOVE_A = 3400;
  const MAX_RUN = 400;
  const AIR_CONTROL = 0.42;
  const PH_FOOT = 4;

  let globalLB = [];
  let globalLBFetched = false;
  let globalLBError = '';

  function normalizeScore(v) {
    if (v == null) return 0;
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    return Number.isFinite(n) ? Math.floor(n) : 0;
  }

  function normalizeSeconds(v) {
    if (v == null) return 0;
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    return Number.isFinite(n) ? Math.floor(n) : 0;
  }

  /** One entry per display name (best height only) — fair worldwide podium */
  function mergeBestPerPlayer(rows) {
    const best = new Map();
    for (const r of rows) {
      const key = (r.name || 'Player').trim().toLowerCase() || 'player';
      const cur = best.get(key);
      if (!cur || r.score > cur.score) best.set(key, r);
    }
    return Array.from(best.values()).sort((a, b) => b.score - a.score);
  }

  function mapDocToRow(d) {
    const x = d.data();
    let dateStr = '';
    try {
      if (x.createdAt && x.createdAt.toDate) dateStr = x.createdAt.toDate().toLocaleString();
    } catch (_) {}
    return {
      name: String(x.name || 'Player').slice(0, 24),
      score: normalizeScore(x.score),
      time: normalizeSeconds(x.seconds),
      text: String(x.text || '').slice(0, 40),
      date: dateStr,
    };
  }

  function loadSave() {
    try {
      const o = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      return {
        username: String(o.username || 'Player').slice(0, 16),
        best: Math.max(0, parseInt(o.best, 10) || 0),
      };
    } catch {
      return { username: 'Player', best: 0 };
    }
  }

  function saveSave(s) {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ username: s.username, best: s.best }));
  }

  async function submitOnline(name, score, seconds, text) {
    const safeName = name.replace(/[^a-zA-Z0-9_ -]/g, '').slice(0, 16) || 'Player';
    const safeText = String(text || '').slice(0, 30);
    const sc = Math.floor(Number(score) || 0);
    const sec = Math.floor(Number(seconds) || 0);

    if (hasFirestoreLB()) {
      try {
        await fsDb().collection(FS_COLLECTION).add({
          name: safeName,
          score: sc,
          seconds: sec,
          text: safeText,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        console.log('[UpOrLose] Score saved to Firestore');
        await fetchGlobalLB();
      } catch (e) {
        console.warn('[UpOrLose] Firestore score submit failed:', e);
      }
    }
  }

  async function fetchGlobalLB() {
    globalLBError = '';
    if (hasFirestoreLB()) {
      const col = fsDb().collection(FS_COLLECTION).orderBy('score', 'desc').limit(LB_FETCH_CAP);
      let snap = null;
      try {
        snap = await col.get({ source: 'server' });
      } catch (e1) {
        try {
          snap = await col.get();
        } catch (e2) {
          console.warn('[UpOrLose] Firestore leaderboard fetch failed:', e2);
          globalLBFetched = true;
          globalLB = [];
          globalLBError = String(e2.message || e2 || 'fetch failed');
          return globalLB;
        }
      }
      try {
        const rows = snap.docs.map(mapDocToRow);
        globalLBFetched = true;
        globalLB = mergeBestPerPlayer(rows).slice(0, LB_LIMIT);
        return globalLB;
      } catch (e) {
        console.warn('[UpOrLose] Leaderboard parse failed:', e);
        globalLBFetched = true;
        globalLB = [];
        globalLBError = String(e.message || e || 'parse failed');
        return globalLB;
      }
    }
    globalLBFetched = true;
    globalLB = [];
    return globalLB;
  }

  function computeRank(score) {
    let r = 1;
    for (const row of globalLB) {
      if (row.score > score) r++;
    }
    return r;
  }

  // ═══ Audio ═══
  let actx = null;
  let bgmOsc = null;
  let bgmGain = null;
  let bgmRaf = 0;
  function audio() {
    if (!actx) {
      try {
        actx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (_) {
        return null;
      }
    }
    return actx;
  }

  function sfxJump() {
    const a = audio();
    if (!a) return;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sine';
    o.frequency.value = 380;
    g.gain.value = 0.06;
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.08);
    o.connect(g);
    g.connect(a.destination);
    o.start();
    o.stop(a.currentTime + 0.09);
  }

  function sfxLand() {
    const a = audio();
    if (!a) return;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'triangle';
    o.frequency.value = 220;
    g.gain.value = 0.05;
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.06);
    o.connect(g);
    g.connect(a.destination);
    o.start();
    o.stop(a.currentTime + 0.07);
  }

  function sfxFall() {
    const a = audio();
    if (!a) return;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, a.currentTime);
    o.frequency.exponentialRampToValueAtTime(60, a.currentTime + 0.35);
    g.gain.value = 0.06;
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.4);
    o.connect(g);
    g.connect(a.destination);
    o.start();
    o.stop(a.currentTime + 0.42);
  }

  function startBgm() {
    const a = audio();
    if (!a || bgmOsc) return;
    bgmOsc = a.createOscillator();
    bgmGain = a.createGain();
    bgmOsc.type = 'sine';
    bgmOsc.frequency.value = 146;
    bgmGain.gain.value = 0.018;
    bgmOsc.connect(bgmGain);
    bgmGain.connect(a.destination);
    bgmOsc.start();
    let t = 0;
    const step = () => {
      if (!bgmOsc) return;
      t += 0.03;
      bgmOsc.frequency.setTargetAtTime(130 + Math.sin(t) * 22, a.currentTime, 0.08);
      bgmRaf = requestAnimationFrame(step);
    };
    bgmRaf = requestAnimationFrame(step);
  }

  function stopBgm() {
    cancelAnimationFrame(bgmRaf);
    bgmRaf = 0;
    try {
      if (bgmOsc) {
        bgmOsc.stop();
        bgmOsc.disconnect();
      }
    } catch (_) {}
    bgmOsc = null;
    bgmGain = null;
  }

  // ═══ Game ═══
  const canvas = document.getElementById('uol-canvas');
  const ctx = canvas.getContext('2d');

  let platforms = [];
  let particles = [];
  let player = { x: 0, y: 0, vx: 0, vy: 0 };
  let camY = 0;
  let startFloorY = 0;
  let minPlayerY = 0;
  let heightPx = 0;
  let runTime = 0;
  let running = false;
  let runEnded = false;
  let lastPlatId = 0;
  let inputL = false;
  let inputR = false;
  let lastTeleportAt = -999;
  let poisonTopY = 0;
  let paused = false;
  let lastD = 0;

  function syncPauseUi() {
    const btn = document.getElementById('uol-pause');
    if (!btn) return;
    btn.setAttribute('aria-pressed', paused ? 'true' : 'false');
    btn.textContent = paused ? 'Resume' : 'Pause';
  }

  function togglePaused() {
    if (!running || runEnded) return;
    paused = !paused;
    if (paused) {
      stopBgm();
      inputL = false;
      inputR = false;
    } else {
      startBgm();
      lastTs = performance.now();
    }
    syncPauseUi();
  }

  function difficulty() {
    return Math.min(1, heightPx / 7500 + runTime * 0.012);
  }

  function addPlat(p) {
    p.id = ++lastPlatId;
    platforms.push(p);
  }

  function seedWorld() {
    platforms = [];
    particles = [];
    lastPlatId = 0;
    const floorY = CH - 80;
    startFloorY = floorY;
    addPlat({
      x: CW / 2 - 100,
      y: floorY,
      w: 200,
      h: 18,
      type: 'normal',
      baseX: CW / 2 - 100,
      phase: 0,
      broken: false,
      breakT: 0,
    });
    player.x = CW / 2 - PW / 2;
    player.y = floorY - PH;
    player.vx = 0;
    player.vy = 0;
    camY = 0;
    minPlayerY = player.y;
    heightPx = 0;
    runTime = 0;
    lastTeleportAt = -999;
    poisonTopY = floorY + POISON_START_OFFSET;
    paused = false;
    lastD = 0;
    syncPauseUi();

    let y = floorY;
    for (let i = 0; i < 14; i++) {
      y = spawnLayer(y, true);
    }
  }

  function spawnLayer(prevBottomY, initial) {
    const d = difficulty();
    const gapMin = 48 + d * 34 + (initial ? 0 : 0);
    const gapMax = 70 + d * 42;
    const gap = gapMin + Math.random() * (gapMax - gapMin);
    const platY = prevBottomY - gap;
    const count = 1 + (Math.random() < Math.min(0.82, 0.3 + d * 0.22) ? 1 : 0);
    const taken = [];

    for (let c = 0; c < count; c++) {
      let tries = 0;
      let x;
      do {
        x = 40 + Math.random() * (CW - 120);
        tries++;
      } while (
        tries < 30 &&
        taken.some((tx) => Math.abs(tx - x) < 100)
      );
      taken.push(x);

      const w = 72 + Math.random() * 68;
      const roll = Math.random();
      let type = 'normal';
      if (roll < 0.1 + d * 0.12) type = 'move';
      else if (roll < 0.2 + d * 0.18) type = 'break';
      else if (roll < 0.28 + d * 0.05) type = 'boost';
      else if (roll < 0.33 + d * 0.04) type = 'tele';

      const baseX = x;
      addPlat({
        x,
        y: platY,
        w,
        h: 16,
        type,
        baseX,
        phase: Math.random() * 6.28,
        broken: false,
        breakT: 0,
        moveAmp: 55 + d * 35,
        moveSpd: 1.1 + d * 1.4,
        landed: false,
      });
    }
    return platY;
  }

  function extendWorld() {
    const alive = platforms.filter((p) => !p.broken);
    if (!alive.length) return;
    let topY = Math.min(...alive.map((p) => p.y));
    while (topY > camY - 400) {
      topY = spawnLayer(topY, false);
    }
    platforms = platforms.filter((p) => p.y < camY + CH + 240);
  }

  function updateMoving(dt, tWall) {
    for (const p of platforms) {
      if (p.type !== 'move' || p.broken) continue;
      p.x = p.baseX + Math.sin(tWall * p.moveSpd + p.phase) * p.moveAmp;
      p.x = Math.max(20, Math.min(CW - p.w - 20, p.x));
    }
  }

  /** Platform fills — same hex values as the side legend rail (up-or-lose.html). */
  function platColor(p) {
    if (p.type === 'move') return '#7ec8ff';
    if (p.type === 'break') return '#ffaa66';
    if (p.type === 'boost') return '#66ffaa';
    if (p.type === 'tele') return '#cc88ff';
    return '#a8b8d8';
  }

  function tryLand(py) {
    const feet = py + PH;
    const prevFeet = feet - player.vy * (1 / 60);

    for (const p of platforms) {
      if (p.broken) continue;
      const top = p.y;
      const bot = p.y + p.h;
      if (feet >= top && feet <= top + PH_FOOT + 10 && prevFeet <= top + 2) {
        if (player.x + PW > p.x + 2 && player.x < p.x + p.w - 2) {
          player.y = top - PH;
          player.vy = 0;

          if (p.type === 'boost') {
            player.vy = BOOST_V;
            spawnParticles(player.x + PW / 2, top, 14, '#66ffaa');
            sfxJump();
          } else if (p.type === 'tele') {
            if (runTime - lastTeleportAt > 0.8) {
              lastTeleportAt = runTime;
              const opts = platforms.filter(
                (q) =>
                  q !== p &&
                  !q.broken &&
                  q.y < p.y - 6
              );
              if (opts.length) {
                const t = opts[Math.floor(Math.random() * opts.length)];
                player.x = t.x + t.w / 2 - PW / 2;
                player.y = t.y - PH;
                player.vy = JUMP_V * 0.95;
                spawnParticles(player.x + PW / 2, player.y + PH, 20, '#dd99ff');
                sfxJump();
              } else {
                player.vy = JUMP_V;
                sfxJump();
              }
            } else {
              player.vy = JUMP_V;
              sfxJump();
            }
          } else {
            player.vy = JUMP_V;
            sfxLand();
            spawnParticles(player.x + PW / 2, top, 8, platColor(p));
          }

          if (p.type === 'break') {
            p.landed = true;
            p.breakT = 0.32;
          }
          return true;
        }
      }
    }
    return false;
  }

  function spawnParticles(x, y, n, col) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 220,
        vy: -Math.random() * 180 - 40,
        life: 0.35 + Math.random() * 0.25,
        col,
      });
    }
  }

  function updateParticles(dt) {
    for (const q of particles) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 400 * dt;
      q.life -= dt;
    }
    particles = particles.filter((q) => q.life > 0);
  }

  let lastTs = 0;
  function gameLoop(ts) {
    if (!running) return;
    if (paused) {
      lastTs = ts;
      draw(lastD);
      drawPauseOverlay();
      requestAnimationFrame(gameLoop);
      return;
    }
    const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    runTime += dt;

    const d = difficulty();
    lastD = d;
    const poisonRise = POISON_RISE_BASE + d * POISON_RISE_PER_D + heightPx * POISON_RISE_PER_HEIGHT;
    poisonTopY -= poisonRise * dt;

    updateMoving(dt, runTime);

    for (const p of platforms) {
      if (p.landed && p.breakT > 0) {
        p.breakT -= dt;
        if (p.breakT <= 0) p.broken = true;
      }
    }

    let ax = 0;
    if (inputL) ax -= 1;
    if (inputR) ax += 1;
    const onGround =
      Math.abs(player.vy) < 80 &&
      platforms.some(
        (p) =>
          !p.broken &&
          player.y + PH <= p.y + 4 &&
          player.y + PH >= p.y - 2 &&
          player.x + PW > p.x + 2 &&
          player.x < p.x + p.w - 2
      );
    const ctrl = onGround ? 1 : AIR_CONTROL;
    if (ax !== 0) player.vx += ax * MOVE_A * dt * ctrl;
    else player.vx *= onGround ? 0.82 : 0.94;
    player.vx = Math.max(-MAX_RUN, Math.min(MAX_RUN, player.vx));

    player.vy += GRAVITY * dt;
    const wasVy = player.vy;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    if (player.x < 8) {
      player.x = 8;
      player.vx *= -0.35;
    }
    if (player.x + PW > CW - 8) {
      player.x = CW - 8 - PW;
      player.vx *= -0.35;
    }

    if (wasVy > 0) {
      tryLand(player.y);
    }

    minPlayerY = Math.min(minPlayerY, player.y);
    heightPx = Math.max(0, Math.floor(startFloorY - minPlayerY));

    camY = player.y - CH * 0.58;
    extendWorld();

    updateParticles(dt);

    const feetY = player.y + PH;
    if (feetY >= poisonTopY - 1) {
      if (!runEnded) endGame('poison');
      return;
    }

    if (player.y > camY + CH + 120) {
      if (!runEnded) endGame('fall');
      return;
    }

    draw(d);
    requestAnimationFrame(gameLoop);
  }

  function drawPauseOverlay() {
    ctx.save();
    ctx.fillStyle = 'rgba(6, 10, 20, 0.6)';
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = '#f0f4ff';
    ctx.font = '800 32px system-ui,Segoe UI,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', CW / 2, CH / 2 - 10);
    ctx.font = '600 14px system-ui,Segoe UI,sans-serif';
    ctx.fillStyle = 'rgba(240, 244, 255, 0.75)';
    ctx.fillText('P / Esc or button to resume', CW / 2, CH / 2 + 26);
    ctx.restore();
  }

  function draw(d) {
    const hue = 210 + Math.min(140, heightPx / 45);
    const g = ctx.createLinearGradient(0, 0, 0, CH);
    g.addColorStop(0, 'hsl(' + hue + ',35%,8%)');
    g.addColorStop(0.5, 'hsl(' + (hue + 25) + ',28%,12%)');
    g.addColorStop(1, 'hsl(' + (hue + 50) + ',22%,16%)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CW, CH);

    ctx.save();
    ctx.translate(0, -camY);

    for (let i = 0; i < 30; i++) {
      const yy = camY + i * 90 - (heightPx % 90);
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.03 + d * 0.04) + ')';
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(CW, yy);
      ctx.stroke();
    }

    for (const p of platforms) {
      if (p.broken) continue;
      ctx.fillStyle = platColor(p);
      ctx.globalAlpha = p.landed ? 0.45 + (p.breakT / 0.32) * 0.45 : 1;
      roundRect(ctx, p.x, p.y, p.w, p.h, 6);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      roundRect(ctx, p.x, p.y, p.w, p.h, 6);
      ctx.stroke();
    }

    if (poisonTopY < camY + CH + 200) {
      const gPoison = ctx.createLinearGradient(0, poisonTopY - 40, 0, poisonTopY + 280);
      gPoison.addColorStop(0, 'rgba(95, 223, 138, 0.08)');
      gPoison.addColorStop(0.25, 'rgba(40, 190, 100, 0.45)');
      gPoison.addColorStop(1, 'rgba(8, 90, 42, 0.92)');
      ctx.fillStyle = gPoison;
      ctx.fillRect(-40, poisonTopY, CW + 80, camY + CH + 500);
      ctx.strokeStyle = 'rgba(180, 255, 200, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, poisonTopY);
      ctx.lineTo(CW, poisonTopY);
      ctx.stroke();
    }

    ctx.shadowColor = '#6eb5ff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#dff0ff';
    roundRect(ctx, player.x, player.y, PW, PH, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1a2538';
    ctx.fillRect(player.x + 8, player.y + 10, 6, 6);
    ctx.fillRect(player.x + PW - 14, player.y + 10, 6, 6);

    ctx.restore();

    for (const q of particles) {
      const sy = q.y - camY;
      ctx.globalAlpha = Math.max(0, q.life * 3);
      ctx.fillStyle = q.col;
      ctx.beginPath();
      ctx.arc(q.x, sy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    document.getElementById('uol-hud-h').textContent = String(heightPx);

    const feetHud = player.y + PH;
    const clearPx = Math.floor(poisonTopY - feetHud);
    const hp = document.getElementById('uol-hud-poison');
    if (hp) {
      if (clearPx > 220) hp.textContent = 'Poison +' + clearPx + ' px';
      else if (clearPx > 100) hp.textContent = 'Poison +' + clearPx + ' px — keep up';
      else if (clearPx > 35) hp.textContent = 'Poison ' + clearPx + ' px — hurry!';
      else if (clearPx > 0) hp.textContent = 'Poison ' + clearPx + ' px — danger';
      else hp.textContent = 'Poison — too close!';
    }
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  function endGame(reason) {
    if (runEnded) return;
    runEnded = true;
    running = false;
    paused = false;
    syncPauseUi();
    stopBgm();
    sfxFall();
    const titleEl = document.getElementById('uol-over-title');
    if (titleEl) {
      titleEl.textContent = reason === 'poison' ? 'Poison got you' : 'Fell off';
    }

    const s = loadSave();
    const name = s.username;
    const prevBest = s.best;
    if (heightPx > s.best) {
      s.best = heightPx;
      saveSave(s);
    }
    function refreshRankLine() {
      const rank = computeRank(heightPx);
      const line = hasOnlineLeaderboard()
        ? globalLB.length
          ? 'Global rank ≈ #' + rank + (rank <= 10 ? ' — top 10 range' : '')
          : 'Score submitted — climb the chart!'
        : 'Firebase not loaded — check firebase-config.js on your server.';
      document.getElementById('uol-rank-line').textContent = line;
    }

    submitOnline(name, heightPx, Math.floor(runTime), 'ALT').then(refreshRankLine);
    refreshRankLine();

    document.getElementById('uol-game').classList.add('uol-hidden');
    document.getElementById('uol-over').classList.remove('uol-hidden');
    document.getElementById('uol-final-h').textContent = String(heightPx) + ' px';

    const nudge = document.getElementById('uol-nudge');
    if (heightPx > 0 && heightPx >= prevBest - 40 && heightPx < prevBest) {
      nudge.textContent = 'So close — you almost beat your best (' + prevBest + ')!';
      nudge.classList.remove('uol-hidden');
    } else if (heightPx === prevBest && heightPx > 0) {
      nudge.textContent = 'Matched your personal best!';
      nudge.classList.remove('uol-hidden');
    } else {
      nudge.classList.add('uol-hidden');
    }
  }

  function renderMenuLB() {
    const top = globalLB.slice(0, 3);
    const order = [top[1], top[0], top[2]];
    const names = ['uol-p2-name', 'uol-p1-name', 'uol-p3-name'];
    const hs = ['uol-p2-h', 'uol-p1-h', 'uol-p3-h'];
    order.forEach((r, i) => {
      document.getElementById(names[i]).textContent = r ? r.name : '—';
      document.getElementById(hs[i]).textContent = r ? r.score + ' px' : '—';
    });

    const el = document.getElementById('uol-lb');
    const uname = loadSave().username;
    if (!hasOnlineLeaderboard()) {
      el.innerHTML =
        '<div class="uol-lb-off"><strong>Global leaderboard</strong><p>Firebase not loaded — check firebase-config.js on your server. Local scores still save.</p></div>';
      return;
    }
    if (!globalLBFetched) {
      el.textContent = 'Loading…';
      return;
    }
    if (!globalLB.length) {
      const hint = globalLBError
        ? '<p>Could not load scores from the server. Check your connection, ad blockers, and that Firestore rules allow reads on <code>up_or_lose_leaderboard</code>.</p><p class="uol-lb-err">' +
          String(globalLBError).slice(0, 120) +
          '</p>'
        : '<p>No scores yet — play a game to be #1!</p>';
      el.innerHTML = '<div class="uol-lb-off"><strong>Global leaderboard</strong>' + hint + '</div>';
      return;
    }
    let h =
      '<div class="uol-lb-row uol-head"><span>#</span><span>Player</span><span>Time</span><span>Height</span></div>';
    globalLB.slice(0, LB_LIMIT).forEach((r, i) => {
      const c = i === 0 ? 'uol-gold' : i === 1 ? 'uol-silver' : i === 2 ? 'uol-bronze' : '';
      const isYou = uname && r.name === uname;
      h +=
        '<div class="uol-lb-row ' +
        c +
        (isYou ? ' uol-lb-you' : '') +
        '"><span>' +
        (i + 1) +
        '</span><span>' +
        r.name +
        (isYou ? ' ← you' : '') +
        '</span><span>' +
        fmtTime(r.time) +
        '</span><span>' +
        r.score +
        '</span></div>';
    });
    el.innerHTML = h;
  }

  function show(id) {
    document.getElementById('uol-title').classList.toggle('uol-hidden', id !== 'title');
    document.getElementById('uol-game').classList.toggle('uol-hidden', id !== 'game');
    document.getElementById('uol-over').classList.toggle('uol-hidden', id !== 'over');
  }

  document.getElementById('uol-play').onclick = () => {
    const a = audio();
    if (a && a.state === 'suspended') a.resume();
    runEnded = false;
    startBgm();
    const inp = document.getElementById('uol-name');
    const s = loadSave();
    s.username = (inp.value || s.username || 'Player').trim().slice(0, 16) || 'Player';
    saveSave(s);
    document.getElementById('uol-hud-best').textContent = String(s.best);
    seedWorld();
    show('game');
    running = true;
    lastTs = performance.now();
    requestAnimationFrame(gameLoop);
  };

  document.getElementById('uol-again').onclick = () => {
    const a = audio();
    if (a && a.state === 'suspended') a.resume();
    runEnded = false;
    startBgm();
    const s = loadSave();
    document.getElementById('uol-hud-best').textContent = String(s.best);
    seedWorld();
    show('game');
    running = true;
    lastTs = performance.now();
    requestAnimationFrame(gameLoop);
  };

  document.getElementById('uol-menu').onclick = () => {
    stopBgm();
    show('title');
    fetchGlobalLB().then(renderMenuLB);
  };

  window.addEventListener('keydown', (e) => {
    if (running && !runEnded && (e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) {
      e.preventDefault();
      togglePaused();
      return;
    }
    if (!running || paused) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inputL = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inputR = true;
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inputL = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inputR = false;
  });

  document.getElementById('uol-pause').addEventListener('click', () => togglePaused());

  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (!running) return;
      const r = canvas.getBoundingClientRect();
      const nx = e.clientX - r.left;
      inputL = nx < r.width / 2;
      inputR = nx >= r.width / 2;
    },
    { passive: true }
  );
  canvas.addEventListener('pointerup', () => {
    inputL = false;
    inputR = false;
  });
  canvas.addEventListener('pointerleave', () => {
    inputL = false;
    inputR = false;
  });

  const sv = loadSave();
  document.getElementById('uol-name').value = sv.username;
  fetchGlobalLB().then(renderMenuLB);

  window.addEventListener('pageshow', (ev) => {
    if (ev.persisted && hasFirestoreLB()) fetchGlobalLB().then(renderMenuLB);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !hasFirestoreLB()) return;
    const title = document.getElementById('uol-title');
    if (title && !title.classList.contains('uol-hidden')) fetchGlobalLB().then(renderMenuLB);
  });
})();
