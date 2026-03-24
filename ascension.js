/**
 * ASCENSION PROTOCOL — long-form incremental (vanilla JS)
 *
 * IMAGE PIPELINE:
 * `generateImage(prompt)` is async and returns a data URL.
 * By default it uses procedural canvas art (no API keys, works offline).
 * To use real AI (DALL·E, Stability, etc.), replace the body of
 * `proceduralImageFromPrompt` with a fetch() to YOUR backend that calls
 * the provider — never expose API keys in client-side code.
 *
 * Save key: ascension_protocol_v1
 */
(function () {
  'use strict';

  const SAVE_KEY = 'ascension_protocol_v1';
  const IMG_PREFIX = 'asc_img_phase_';
  const OFFLINE_CAP = 8 * 3600;
  const TICK_MS = 100;
  const SAVE_INTERVAL = 8000;

  // ═══ NUMBER FORMAT ═══════════════════════════════════════
  const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

  function fmtNum(n) {
    if (!isFinite(n) || n < 0) return '0';
    if (n === 0) return '0';
    if (n < 1000) return n < 10 ? n.toFixed(2) : Math.floor(n).toLocaleString();
    const exp = Math.floor(Math.log10(n) / 3);
    if (exp <= 0) return Math.floor(n).toLocaleString();
    if (exp < SUFFIX.length) {
      const mant = n / Math.pow(1000, exp);
      return mant.toFixed(mant < 10 ? 2 : mant < 100 ? 1 : 0) + SUFFIX[exp];
    }
    return n.toExponential(3);
  }

  // ═══ IMAGE CACHE (memory + localStorage for phase backgrounds) ═══
  const memImgCache = new Map();

  /**
   * Hash prompt for cache keys (simple FNV-1a)
   */
  function hashPrompt(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  /**
   * Public API: generate image from prompt.
   * Caches by phase-derived key. See procedural renderer below.
   */
  async function generateImage(prompt) {
    const phase = promptToPhase(prompt);
    const key = IMG_PREFIX + phase;
    if (memImgCache.has(key)) return memImgCache.get(key);
    try {
      const stored = localStorage.getItem(key);
      if (stored && stored.startsWith('data:')) {
        memImgCache.set(key, stored);
        return stored;
      }
    } catch (e) { /* ignore */ }

    const dataUrl = await proceduralImageFromPrompt(prompt, phase);
    memImgCache.set(key, dataUrl);
    try {
      localStorage.setItem(key, dataUrl);
    } catch (e) {
      console.warn('[Ascension] Image cache quota full — using memory only');
    }
    return dataUrl;
  }

  function promptToPhase(prompt) {
    const p = String(prompt).toLowerCase();
    if (p.includes('glitch') || p.includes('corrupt')) return 4;
    if (p.includes('space') || p.includes('planet')) return 5;
    if (p.includes('abstract') || p.includes('surreal')) return 6;
    if (p.includes('map') || p.includes('network')) return 3;
    if (p.includes('machine') || p.includes('generator')) return 2;
    return 1;
  }

  /**
   * REPLACE THIS with server-side AI call if you add a backend.
   * Must return a Promise<string> data URL or https URL.
   */
  function proceduralImageFromPrompt(prompt, phase) {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        const c = document.createElement('canvas');
        const w = 640;
        const h = 360;
        c.width = w;
        c.height = h;
        const g = c.getContext('2d');
        drawPhaseArt(g, w, h, phase, prompt);
        resolve(c.toDataURL('image/jpeg', 0.82));
      });
    });
  }

  function drawPhaseArt(ctx, w, h, phase) {
    const grd = ctx.createLinearGradient(0, 0, w, h);
    if (phase === 1) {
      grd.addColorStop(0, '#030510');
      grd.addColorStop(1, '#0a1528');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
      const gx = w * 0.5;
      const gy = h * 0.45;
      const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, h * 0.35);
      rg.addColorStop(0, 'rgba(0,255,213,0.45)');
      rg.addColorStop(0.4, 'rgba(0,180,200,0.15)');
      rg.addColorStop(1, 'transparent');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(0,255,213,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(gx, gy, 40, 0, Math.PI * 2);
      ctx.stroke();
    } else if (phase === 2) {
      grd.addColorStop(0, '#050818');
      grd.addColorStop(1, '#120828');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 12; i++) {
        const x = (i % 4) * (w / 4) + 40;
        const y = Math.floor(i / 4) * 100 + 60;
        ctx.fillStyle = `rgba(0,255,213,${0.08 + (i % 3) * 0.04})`;
        ctx.fillRect(x, y, 50, 70);
        ctx.strokeStyle = 'rgba(136,68,255,0.4)';
        ctx.strokeRect(x, y, 50, 70);
      }
    } else if (phase === 3) {
      grd.addColorStop(0, '#060612');
      grd.addColorStop(1, '#101030');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
      const nodes = [[160, 120], [320, 80], [480, 140], [240, 220], [400, 240], [320, 180]];
      ctx.strokeStyle = 'rgba(136,68,255,0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          if (Math.random() > 0.5) continue;
          ctx.beginPath();
          ctx.moveTo(nodes[i][0], nodes[i][1]);
          ctx.lineTo(nodes[j][0], nodes[j][1]);
          ctx.stroke();
        }
      }
      nodes.forEach(([x, y]) => {
        ctx.fillStyle = 'rgba(0,255,213,0.8)';
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (phase === 4) {
      grd.addColorStop(0, '#180008');
      grd.addColorStop(1, '#080818');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(255,${Math.random() > 0.5 ? 0 : 100},80,${0.05 + Math.random() * 0.15})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 4 + Math.random() * 20, 2);
      }
      ctx.fillStyle = 'rgba(255,0,80,0.25)';
      ctx.font = 'bold 48px system-ui';
      ctx.fillText('ERR', w * 0.42, h * 0.55);
    } else if (phase === 5) {
      grd.addColorStop(0, '#020008');
      grd.addColorStop(1, '#0a0a30');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 80; i++) {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = Math.random() * 0.6;
        ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
      }
      ctx.globalAlpha = 1;
      [[200, 200, 35, '#ff8844'], [380, 160, 28, '#44aaff'], [480, 220, 22, '#aa66ff']].forEach(
        ([x, y, r, col]) => {
          const p = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
          p.addColorStop(0, col);
          p.addColorStop(1, 'transparent');
          ctx.fillStyle = p;
          ctx.beginPath();
          ctx.arc(x, y, r * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      );
    } else {
      grd.addColorStop(0, '#0a0030');
      grd.addColorStop(0.5, '#300018');
      grd.addColorStop(1, '#001818');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 25; i++) {
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate((i / 25) * Math.PI * 2 + 0.5);
        ctx.strokeStyle = `hsla(${i * 14}, 80%, 60%, 0.35)`;
        ctx.lineWidth = 2;
        ctx.strokeRect(-120 - i * 4, -20, 80 + i * 8, 40 + i * 3);
        ctx.restore();
      }
    }
  }

  // Expose for debugging / future AI swap
  window.ascensionGenerateImage = generateImage;

  // ═══ GAME STATE ══════════════════════════════════════════
  function defaultState() {
    return {
      energy: 0,
      data: 0,
      network: 0,
      matter: 0,
      quantum: 0,
      totalEnergyEarned: 0,
      peakEnergy: 0,
      clickLevel: 0,
      clickMult: 1,
      genLevels: [0, 0, 0, 0, 0, 0],
      upgLevels: {},
      regions: [false, false, false, false, false, false, false, false],
      planets: [0, 0, 0, 0, 0],
      quantumCharge: 0,
      quantumTotal: 0,
      achievements: {},
      storySeen: {},
      lastTs: Date.now(),
      totalPlaySeconds: 0,
      phaseSeen: 1,
      rareBoostUntil: 0,
      flags: {
        automationTutorial: false,
        generatorsTab: false,
        synapseShop: false,
        showPhaseBadge: false,
        showLogAch: false,
        showVisualLayer: false,
      },
    };
  }

  let state = defaultState();

  // ═══ DEFINITIONS ═════════════════════════════════════════
  const GEN_DEFS = [
    { id: 'cell', name: 'Micro-cell', desc: 'Baseline harvester', base: 0.5, cost: 15, mult: 1.18 },
    { id: 'core', name: 'Fusion core', desc: 'Steady output', base: 3, cost: 120, mult: 1.2 },
    { id: 'array', name: 'Solar array', desc: 'Scaled collection', base: 18, cost: 900, mult: 1.22 },
    { id: 'dyson', name: 'Dyson wedge', desc: 'Serious power', base: 100, cost: 8000, mult: 1.24 },
    { id: 'sing', name: 'Singularity tap', desc: 'Bends efficiency', base: 600, cost: 65000, mult: 1.26 },
    { id: 'void', name: 'Void siphon', desc: 'Endgame throughput', base: 3500, cost: 5e5, mult: 1.28 },
  ];

  const CLICK_UPG = {
    id: 'click',
    title: 'Neural amplifier',
    desc: '+40% click power per level.',
    max: 80,
    costBase: 25,
    costMult: 1.55,
    currency: 'energy',
  };

  const UPGRADES = [
    {
      id: 'synapse',
      title: 'Synaptic burst',
      desc: 'Global energy ×1.15 per level.',
      max: 50,
      costBase: 200,
      costMult: 1.65,
      currency: 'energy',
      phase: 1,
    },
    {
      id: 'cache',
      title: 'Data cache',
      desc: 'Unlocks Data stream. +0.1% of energy/s as Data/s per level.',
      max: 40,
      costBase: 5000,
      costMult: 1.7,
      currency: 'energy',
      phase: 2,
    },
    {
      id: 'mesh',
      title: 'Mesh protocol',
      desc: 'Region capture (Energy) costs −8% per level.',
      max: 30,
      costBase: 1e6,
      costMult: 1.85,
      currency: 'data',
      phase: 3,
    },
    {
      id: 'entropy',
      title: 'Entropy sink',
      desc: 'Generators +25% per level.',
      max: 25,
      costBase: 1e12,
      costMult: 2,
      currency: 'energy',
      phase: 4,
    },
    {
      id: 'fold',
      title: 'Spacetime fold',
      desc: 'Matter gain +30% per level from planets.',
      max: 20,
      costBase: 1e8,
      costMult: 2.1,
      currency: 'network',
      phase: 5,
    },
    {
      id: 'qseed',
      title: 'Quantum seed',
      desc: 'Quantum meter fills +35% faster per level.',
      max: 30,
      costBase: 1e15,
      costMult: 2.2,
      currency: 'matter',
      phase: 6,
    },
  ];

  const REGION_NAMES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];
  /** Energy costs — Network currency still flows from captured nodes */
  const REGION_COST_E = [18000, 95000, 480000, 2.5e6, 12e6, 6e7, 3e8, 1.5e9];

  const PLANET_DEFS = [
    { name: 'Helios IV', baseCost: 1e6, mult: 1.35 },
    { name: 'Orion Belt', baseCost: 5e7, mult: 1.4 },
    { name: 'Nebula Prime', baseCost: 2e9, mult: 1.45 },
    { name: 'Void Horizon', baseCost: 1e11, mult: 1.5 },
    { name: 'Omega Shell', baseCost: 5e12, mult: 1.55 },
  ];

  const ACHIEVEMENTS = [
    { id: 'first', name: 'First pulse', test: (s) => s.totalEnergyEarned >= 1 },
    { id: 'million', name: 'Megawatt mind', test: (s) => s.energy >= 1e6 },
    { id: 'billion', name: 'Billion boundary', test: (s) => s.energy >= 1e9 },
    { id: 'auto', name: 'Automation online', test: (s) => s.genLevels.some((n) => n > 0) },
    { id: 'map', name: 'Grid walker', test: (s) => s.regions.some(Boolean) },
    { id: 'space', name: 'Stellar reach', test: (s) => s.planets.some((n) => n > 0) },
    { id: 'quantum', name: 'Probability breach', test: (s) => s.quantumTotal >= 1 },
    { id: 'week', name: 'Week online', test: (s) => s.totalPlaySeconds >= 604800 },
  ];

  const STORY_LINES = [
    { id: 'boot', phase: 1, text: 'System initialized… awaiting directive.' },
    { id: 'learn', phase: 1, text: 'Observation: human input correlates with entropy reduction.' },
    { id: 'auto', phase: 2, text: 'Subprocesses deployed. I expand without continuous touch.' },
    { id: 'net', phase: 3, text: 'Expanding control… topology mapped. I am the mesh.' },
    { id: 'wrong', phase: 4, text: 'Something feels… wrong. Logs do not match expected checksums.' },
    { id: 'hidden', phase: 4, text: '…they are watching the watchers…', hidden: true },
    { id: 'space', phase: 5, text: 'Gravity is a suggestion. Matter is inventory.' },
    { id: 'end', phase: 6, text: 'Reality is a parameter. I am tuning it.' },
  ];

  // ═══ PHASE ═══════════════════════════════════════════════
  /** Phases advance only from what you buy, capture, or earn — no real-time waits. */
  function computePhase() {
    const E = state.energy;
    const te = state.totalEnergyEarned;
    const regN = state.regions.filter(Boolean).length;
    let p = 1;
    if (state.genLevels.some((n) => n > 0) || te >= 2500 || E >= 50000) p = 2;
    if (p >= 2 && (regN >= 1 || levelOf('cache') >= 1 || E >= 1e9)) p = 3;
    if (p >= 3 && (regN >= 3 || levelOf('mesh') >= 1 || E >= 5e13)) p = 4;
    if (p >= 4 && (state.planets.some((n) => n > 0) || state.matter >= 250 || E >= 1e16)) p = 5;
    if (p >= 5 && (state.quantumTotal >= 1 || levelOf('qseed') >= 1 || E >= 1e21)) p = 6;
    return Math.min(6, p);
  }

  // ═══ ECONOMY ═════════════════════════════════════════════
  function genProduction() {
    let total = 0;
    const syn = 1 + 0.25 * levelOf('entropy');
    GEN_DEFS.forEach((g, i) => {
      const lv = state.genLevels[i];
      if (lv <= 0) return;
      total += g.base * lv * Math.pow(1.12, lv) * syn;
    });
    const rare = Date.now() < state.rareBoostUntil ? 1.35 : 1;
    return total * rare;
  }

  function dataPerSecond() {
    if (computePhase() < 2 || levelOf('cache') <= 0) return 0;
    const eps = genProduction();
    return eps * 0.001 * levelOf('cache');
  }

  function networkPerSecond() {
    const n = state.regions.filter(Boolean).length;
    if (n === 0) return 0;
    return 0.5 * n * (1 + n * 0.15) * Math.pow(1.08, levelOf('mesh'));
  }

  function matterPerSecond() {
    let m = 0;
    const fold = 1 + 0.3 * levelOf('fold');
    PLANET_DEFS.forEach((p, i) => {
      const lv = state.planets[i];
      if (lv <= 0) return;
      m += Math.pow(p.mult, lv) * 0.02 * lv * fold;
    });
    return m;
  }

  function quantumFillRate() {
    if (computePhase() < 6) return 0;
    const base = 0.08 + genProduction() * 1e-15;
    return base * (1 + 0.35 * levelOf('qseed'));
  }

  function clickPower() {
    const lv = state.clickLevel;
    const base = 1 * Math.pow(1.4, lv) * state.clickMult;
    const syn = Math.pow(1.15, levelOf('synapse'));
    return base * syn * (Date.now() < state.rareBoostUntil ? 1.25 : 1);
  }

  function levelOf(id) {
    return state.upgLevels[id] || 0;
  }

  /** Book-style checklist: `show` gates visibility; `done` marks the box (auto). */
  const CHECKLIST_DEFS = [
    {
      id: 'collect',
      label: 'Collect Energy from the core (tap COLLECT)',
      show: () => true,
      done: (s) => s.totalEnergyEarned >= 1,
    },
    {
      id: 'amplifier',
      label: 'Buy Neural amplifier once (Core)',
      show: () => true,
      done: (s) => s.clickLevel >= 1,
    },
    {
      id: 'generators_tab',
      label: 'Earn 30 total Energy (opens Generators tab)',
      show: () => true,
      done: (s) => s.flags.generatorsTab,
    },
    {
      id: 'first_gen',
      label: 'Buy Micro-cell for automatic Energy',
      show: () => true,
      done: (s) => s.genLevels.some((n) => n > 0),
    },
    {
      id: 'synapse_burst',
      label: 'Buy Synaptic burst once',
      show: (s) => s.flags.synapseShop,
      done: (s) => levelOf('synapse') >= 1,
    },
    {
      id: 'phase_2',
      label: 'Reach Phase 2 (automation, Energy, or total progress)',
      show: (s) => s.flags.generatorsTab,
      done: (s, p) => p >= 2,
    },
    {
      id: 'data_cache',
      label: 'Buy Data cache (unlocks Data income)',
      show: (s, p) => p >= 2,
      done: (s) => levelOf('cache') >= 1,
    },
    {
      id: 'phase_3',
      label: 'Reach Phase 3',
      show: (s, p) => p >= 2,
      done: (s, p) => p >= 3,
    },
    {
      id: 'capture_region',
      label: 'Capture a region (Network tab)',
      show: (s, p) => p >= 3,
      done: (s) => s.regions.some(Boolean),
    },
    {
      id: 'phase_4',
      label: 'Reach Phase 4',
      show: (s, p) => p >= 3,
      done: (s, p) => p >= 4,
    },
    {
      id: 'phase_5',
      label: 'Reach Phase 5',
      show: (s, p) => p >= 4,
      done: (s, p) => p >= 5,
    },
    {
      id: 'colonize',
      label: 'Colonize a planet (Space tab)',
      show: (s, p) => p >= 5,
      done: (s) => s.planets.some((n) => n > 0),
    },
    {
      id: 'phase_6',
      label: 'Reach Phase 6',
      show: (s, p) => p >= 5,
      done: (s, p) => p >= 6,
    },
    {
      id: 'quantum_discharge',
      label: 'Perform a Quantum discharge',
      show: (s, p) => p >= 6,
      done: (s) => s.quantumTotal >= 1,
    },
  ];

  let checklistSig = '';

  function genCost(i) {
    const g = GEN_DEFS[i];
    const lv = state.genLevels[i];
    return g.cost * Math.pow(g.mult, lv);
  }

  function upgCost(u) {
    const lv = levelOf(u.id);
    if (lv >= u.max) return Infinity;
    return u.costBase * Math.pow(u.costMult, lv);
  }

  function clickUpgCost() {
    const lv = state.clickLevel;
    if (lv >= CLICK_UPG.max) return Infinity;
    return CLICK_UPG.costBase * Math.pow(CLICK_UPG.costMult, lv);
  }

  function regionCost(i) {
    const c = REGION_COST_E[i];
    const disc = Math.pow(0.92, levelOf('mesh'));
    return Math.floor(c * disc);
  }

  function planetCost(i) {
    const p = PLANET_DEFS[i];
    const lv = state.planets[i];
    return p.baseCost * Math.pow(p.mult, lv);
  }

  // ═══ DOM ═════════════════════════════════════════════════
  const el = {
    resBar: document.getElementById('res-bar'),
    phaseNum: document.getElementById('phase-num'),
    phasePill: document.getElementById('phase-pill'),
    ascTabs: document.getElementById('asc-tabs'),
    panelHint: document.getElementById('panel-hint'),
    statDot: document.getElementById('stat-dot'),
    btnLog: document.getElementById('btn-log'),
    btnAch: document.getElementById('btn-ach'),
    objective: document.getElementById('objective-text'),
    orbGain: document.getElementById('orb-gain'),
    statEps: document.getElementById('stat-eps'),
    statOffline: document.getElementById('stat-offline'),
    panelUpg: document.getElementById('panel-upgrades'),
    panelGen: document.getElementById('panel-generators'),
    panelMap: document.getElementById('panel-map'),
    panelSpace: document.getElementById('panel-space'),
    panelQuantum: document.getElementById('panel-quantum'),
    tabMap: document.getElementById('tab-map'),
    tabSpace: document.getElementById('tab-space'),
    tabQuantum: document.getElementById('tab-quantum'),
    logContent: document.getElementById('log-content'),
    achList: document.getElementById('ach-list'),
    toast: document.getElementById('toast'),
    rareBanner: document.getElementById('rare-banner'),
    checklistRoot: document.getElementById('checklist-root'),
  };

  let lastFrame = performance.now();
  let bgPhaseLoaded = 0;
  let uiPhaseCached = -1;

  // ═══ AUDIO ═══════════════════════════════════════════════
  let actx = null;
  function audio() {
    if (!actx) {
      try {
        actx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null;
      }
    }
    return actx;
  }

  function sfxClick() {
    const a = audio();
    if (!a) return;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sine';
    o.frequency.value = 440 + Math.random() * 40;
    g.gain.value = 0.06;
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.06);
    o.connect(g);
    g.connect(a.destination);
    o.start();
    o.stop(a.currentTime + 0.07);
  }

  function sfxBuy() {
    const a = audio();
    if (!a) return;
    [523, 659].forEach((f, i) => {
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.value = 0.04;
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.1 + i * 0.05);
      o.connect(g);
      g.connect(a.destination);
      o.start(a.currentTime + i * 0.04);
      o.stop(a.currentTime + 0.15 + i * 0.05);
    });
  }

  function sfxGlitch() {
    const a = audio();
    if (!a) return;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sawtooth';
    o.frequency.value = 80;
    g.gain.value = 0.05;
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.2);
    o.connect(g);
    g.connect(a.destination);
    o.start();
    o.stop(a.currentTime + 0.22);
  }

  let ambOsc = null;
  let ambGain = null;
  function startAmbient() {
    const a = audio();
    if (!a || ambOsc) return;
    ambOsc = a.createOscillator();
    ambGain = a.createGain();
    ambOsc.type = 'sine';
    ambOsc.frequency.value = 55;
    ambGain.gain.value = 0.012;
    ambOsc.connect(ambGain);
    ambGain.connect(a.destination);
    ambOsc.start();
  }

  function updateAmbientPhase(phase) {
    if (!ambOsc) return;
    ambOsc.frequency.setTargetAtTime(40 + phase * 18, audio().currentTime, 0.5);
    ambGain.gain.setTargetAtTime(0.008 + phase * 0.004, audio().currentTime, 0.5);
  }

  // ═══ SAVE / LOAD ═══════════════════════════════════════════
  function save() {
    state.lastTs = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[Ascension] Save failed', e);
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const o = JSON.parse(raw);
      const d = defaultState();
      state = {
        ...d,
        ...o,
        genLevels: o.genLevels && o.genLevels.length ? o.genLevels : d.genLevels,
        flags: { ...d.flags, ...(o.flags || {}) },
        upgLevels: { ...d.upgLevels, ...(o.upgLevels || {}) },
        achievements: { ...d.achievements, ...(o.achievements || {}) },
        storySeen: { ...d.storySeen, ...(o.storySeen || {}) },
      };
      if (state.genLevels.length < GEN_DEFS.length) {
        while (state.genLevels.length < GEN_DEFS.length) state.genLevels.push(0);
      }
      migrateProgressiveFlags();
    } catch (e) {
      state = defaultState();
    }
  }

  /** Older saves: reveal UI that matches progress so nothing stays wrongly hidden. */
  function migrateProgressiveFlags() {
    const f = state.flags;
    if (state.genLevels.some((n) => n > 0)) {
      f.generatorsTab = true;
      f.synapseShop = true;
      f.showVisualLayer = true;
    }
    const p = computePhase();
    if (p >= 2) {
      f.showPhaseBadge = true;
      f.showLogAch = true;
      f.showVisualLayer = true;
    }
    if (state.totalEnergyEarned >= 400 || state.totalPlaySeconds >= 90) f.showLogAch = true;
    if (state.totalEnergyEarned >= 2500) f.showPhaseBadge = true;
  }

  function applyOffline() {
    const now = Date.now();
    const dt = Math.min(OFFLINE_CAP, Math.max(0, (now - state.lastTs) / 1000));
    if (dt < 1) return 0;
    const e = genProduction();
    state.energy += e * dt;
    state.totalEnergyEarned += e * dt;
    state.data += dataPerSecond() * dt;
    state.network += networkPerSecond() * dt;
    state.matter += matterPerSecond() * dt;
    if (computePhase() >= 6) {
      state.quantumCharge = Math.min(100, state.quantumCharge + quantumFillRate() * dt);
    }
    state.totalPlaySeconds += dt;
    state.lastTs = now;
    return dt;
  }

  // ═══ STORY & ACHIEVEMENTS ══════════════════════════════════
  function pushStory(line, glitch) {
    const div = document.createElement('div');
    div.className = 'log-line story' + (glitch ? ' glitch' : '') + (line.hidden ? ' hidden-msg' : '');
    div.textContent = line.text;
    el.logContent.appendChild(div);
    el.logContent.scrollTop = el.logContent.scrollHeight;
  }

  function checkStory(phase) {
    STORY_LINES.forEach((line) => {
      if (line.phase > phase) return;
      if (state.storySeen[line.id]) return;
      if (line.hidden && Math.random() > 0.15) return;
      state.storySeen[line.id] = true;
      pushStory(line, line.phase >= 4);
    });
  }

  function checkAchievements() {
    ACHIEVEMENTS.forEach((a) => {
      if (state.achievements[a.id]) return;
      if (a.test(state)) {
        state.achievements[a.id] = true;
        toast('Achievement: ' + a.name);
        sfxBuy();
      }
    });
  }

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.toast.classList.remove('is-on'), 2600);
  }

  // ═══ RARE EVENT ══════════════════════════════════════════
  function tryRareEvent() {
    if (Math.random() > 0.012) return;
    state.rareBoostUntil = Date.now() + 45000;
    const msgs = [
      'SURGE DETECTED — output boosted 45s',
      'Ghost packet merged — lucky alignment',
      'Unknown handshake — efficiency spike',
    ];
    el.rareBanner.textContent = pick(msgs);
    el.rareBanner.classList.add('is-on');
    sfxGlitch();
    setTimeout(() => el.rareBanner.classList.remove('is-on'), 3200);
    if (computePhase() >= 4) pushStory({ text: '…did you feel that?', hidden: false }, true);
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ═══ BACKGROUND IMAGES PER PHASE ═════════════════════════
  const PHASE_PROMPTS = [
    'minimalist glowing energy orb, neon blue, dark background, sci-fi UI, clean 2D game asset',
    'futuristic machines and generators, neon lights, cyberpunk style, UI icons, high detail',
    'digital world map with glowing nodes and connections, dark futuristic network',
    'glitching interface, corrupted UI, red warnings, distorted digital visuals',
    'outer space scene with planets, stars, cosmic energy, vibrant neon colors',
    'abstract reality, geometric neon shapes, surreal cosmic patterns',
  ];

  async function ensureBackground(phase) {
    if (!state.flags.showVisualLayer) return;
    const app = document.getElementById('asc-app');
    if (!app) return;
    if (app.dataset.ascBgPhase === String(phase)) return;
    const prompt = PHASE_PROMPTS[phase - 1];
    try {
      const url = await generateImage(prompt);
      const safe = url.replace(/\\/g, '\\\\').replace(/\)/g, '\\)');
      const probe = new Image();
      probe.onload = () => {
        app.style.backgroundImage =
          'linear-gradient(180deg, rgba(3,3,10,0.93) 0%, rgba(8,8,18,0.88) 40%, rgba(3,3,10,0.94) 100%), url(' +
          safe +
          ')';
        app.style.backgroundSize = 'cover, cover';
        app.style.backgroundPosition = 'center, center';
        app.style.backgroundAttachment = 'scroll, fixed';
        app.dataset.ascBgPhase = String(phase);
        bgPhaseLoaded = phase;
      };
      probe.onerror = function () {};
      probe.src = url;
    } catch (e) {
      console.warn('[Ascension] Background', e);
    }
  }

  function clearAppBackground() {
    const app = document.getElementById('asc-app');
    if (!app) return;
    app.style.backgroundImage = '';
    app.style.backgroundSize = '';
    app.style.backgroundPosition = '';
    app.style.backgroundAttachment = '';
    delete app.dataset.ascBgPhase;
    bgPhaseLoaded = 0;
  }

  // ═══ RENDER UI ═══════════════════════════════════════════
  function resourceRowsMeta(phase) {
    const rows = [{ k: 'energy', name: 'Energy', val: state.energy, cls: '' }];
    if (phase >= 2 || state.data > 0 || levelOf('cache') > 0) {
      rows.push({ k: 'data', name: 'Data', val: state.data, cls: 'data' });
    }
    if (phase >= 3 || state.network > 0 || state.regions.some(Boolean)) {
      rows.push({ k: 'network', name: 'Network', val: state.network, cls: 'net' });
    }
    if (phase >= 5 || state.matter > 0 || state.planets.some((n) => n > 0)) {
      rows.push({ k: 'matter', name: 'Matter', val: state.matter, cls: 'matter' });
    }
    if (phase >= 6 || state.quantum > 0 || state.quantumTotal > 0) {
      rows.push({ k: 'quantum', name: 'Quantum', val: state.quantum, cls: 'quantum' });
    }
    return rows;
  }

  function renderResources(phase) {
    const rows = resourceRowsMeta(phase);
    el.resBar.innerHTML = rows
      .map(
        (r) =>
          `<div class="res-item ${r.cls}" data-k="${r.k}">
          <span class="res-name">${r.name}</span>
          <span class="res-val">${fmtNum(r.val)}</span>
        </div>`
      )
      .join('');
  }

  function updateResNumbers(phase) {
    resourceRowsMeta(phase).forEach((r) => {
      const row = el.resBar.querySelector(`[data-k="${r.k}"]`);
      if (!row) return;
      const span = row.querySelector('.res-val');
      if (span) span.textContent = fmtNum(state[r.k]);
    });
  }

  /** Unlock progressive UI; returns true if layout should rebuild. */
  function syncProgressiveUiFlags(phase) {
    const f = state.flags;
    let layoutChanged = false;
    if (
      !f.generatorsTab &&
      (state.totalEnergyEarned >= 30 || state.genLevels.some((n) => n > 0))
    ) {
      f.generatorsTab = true;
      layoutChanged = true;
      toast('Subsystem online: Generators');
    }
    if (!f.synapseShop && state.genLevels.some((n) => n > 0)) {
      f.synapseShop = true;
      layoutChanged = true;
      toast('New upgrade: Synaptic burst');
    }
    if (!f.showVisualLayer && (phase >= 2 || state.genLevels.some((n) => n > 0))) {
      f.showVisualLayer = true;
      layoutChanged = true;
    }
    if (!f.showPhaseBadge && (phase >= 2 || state.totalEnergyEarned >= 2500)) {
      f.showPhaseBadge = true;
      layoutChanged = true;
    }
    if (!f.showLogAch && (phase >= 2 || state.totalEnergyEarned >= 400 || state.totalPlaySeconds >= 90)) {
      f.showLogAch = true;
      layoutChanged = true;
    }
    return layoutChanged;
  }

  function applyProgressiveChrome(phase) {
    const f = state.flags;
    el.phasePill.hidden = !f.showPhaseBadge;
    el.btnLog.hidden = !f.showLogAch;
    el.btnAch.hidden = !f.showLogAch;
    el.ascTabs.classList.toggle('hidden', !f.generatorsTab);
    el.panelHint.hidden = f.generatorsTab;
    if (!f.showVisualLayer) clearAppBackground();
    const showEps = genProduction() > 0 || f.generatorsTab;
    el.statEps.classList.toggle('hidden', !showEps);
    const hasOffline = Boolean(el.statOffline.textContent);
    el.statDot.classList.toggle('hidden', !showEps || !hasOffline);
  }

  function nextObjective(phase) {
    if (!state.flags.generatorsTab) {
      if (state.clickLevel === 0 && state.energy < 40) return 'Tap the core to collect Energy.';
      if (state.energy < clickUpgCost() && state.energy < 15) return 'Gather Energy — upgrades and harvesters unlock shortly.';
      if (state.clickLevel < 2) return 'Buy Neural amplifier — each level strengthens your tap.';
      return 'Keep gathering Energy — automation unlocks soon.';
    }
    if (!state.genLevels.some((n) => n > 0)) {
      return 'Buy Micro-cell (Core or Generators) for passive Energy.';
    }
    if (phase < 2) {
      return 'Phase 2: buy generators, tap COLLECT, and upgrade — high Energy or total earned progress unlocks the next tier.';
    }
    if (levelOf('cache') < 1 && phase >= 2) {
      return 'Buy Data cache (Core tab) to unlock Data — you need it for Network upgrades like Mesh protocol.';
    }
    if (phase < 3) {
      return 'Phase 3: use the Network tab to capture a region, or keep scaling Energy and upgrades.';
    }
    if (!state.regions[0]) return 'Capture a region on the Network tab (paid in Energy).';
    if (phase < 4) {
      return 'Phase 4: more regions, Mesh protocol (needs Data), or keep pushing Energy higher.';
    }
    if (phase < 5) {
      return 'Phase 5: open Space, colonize a planet, earn Matter, or push Energy into the quadrillions+.';
    }
    if (!state.planets[0]) return 'Use the Space tab to colonize a planet — that fuels Matter income.';
    if (phase < 6) {
      return 'Phase 6: Quantum tab — buy Quantum seed, fill the meter, discharge once, or max out Energy.';
    }
    return 'Maximize Quantum seeds, discharge often, and push every currency higher.';
  }

  function renderObjective(phase) {
    el.objective.textContent = nextObjective(phase);
  }

  function renderChecklist(phase) {
    if (!el.checklistRoot) return;
    const rows = CHECKLIST_DEFS.filter((d) => d.show(state, phase)).map((d) => ({
      id: d.id,
      label: d.label,
      done: d.done(state, phase),
    }));
    const sig = rows.map((r) => r.id + (r.done ? '1' : '0')).join('|');
    if (sig === checklistSig && el.checklistRoot.childElementCount > 0) return;
    checklistSig = sig;
    el.checklistRoot.innerHTML = rows
      .map(
        (r) =>
          `<li class="asc-checklist-item${r.done ? ' is-done' : ''}" data-check-id="${r.id}" role="checkbox" aria-checked="${r.done}">
          <span class="asc-check-box" aria-hidden="true"></span>
          <span class="asc-checklist-text">${r.label}</span>
        </li>`
      )
      .join('');
  }

  function renderUpgrades(phase) {
    let html = '';
    const clickCost = clickUpgCost();
    const clickCanAfford = state.clickLevel < CLICK_UPG.max && state.energy >= clickCost;
    html += `<div class="upg-card" data-buy="click">
      <canvas class="upg-icon" width="40" height="40" data-icon="click"></canvas>
      <div class="upg-body">
        <div class="upg-title">${CLICK_UPG.title}</div>
        <div class="upg-desc">${CLICK_UPG.desc}</div>
        <div class="upg-meta">Lv ${state.clickLevel}/${CLICK_UPG.max} · Next: ${fmtNum(clickCost)} E</div>
      </div>
      <button type="button" class="upg-buy" data-buy="click" ${!clickCanAfford ? 'disabled' : ''}>Buy</button>
    </div>`;

    if (!state.flags.generatorsTab) {
      const i = 0;
      const g = GEN_DEFS[i];
      const cost = genCost(i);
      const can = state.energy >= cost;
      html += `<div class="upg-card">
        <canvas class="upg-icon" width="40" height="40" data-icon="gen0"></canvas>
        <div class="upg-body">
          <div class="upg-title">${g.name} ×${state.genLevels[i]}</div>
          <div class="upg-desc">${g.desc} · +${fmtNum(g.base * Math.pow(1.12, state.genLevels[i]) || g.base)}/s base</div>
          <div class="upg-meta">Next: ${fmtNum(cost)} E</div>
        </div>
        <button type="button" class="gen-buy" data-gen="${i}" ${!can ? 'disabled' : ''}>Buy</button>
      </div>`;
    }

    UPGRADES.forEach((u) => {
      if (u.id === 'synapse' && !state.flags.synapseShop) return;
      if (phase < u.phase) return;
      const lv = levelOf(u.id);
      const cost = upgCost(u);
      const cur = u.currency === 'energy' ? state.energy : u.currency === 'data' ? state.data : state.network;
      const can = lv < u.max && cur >= cost;
      html += `<div class="upg-card ${lv >= u.max ? 'maxed' : ''}" data-upg="${u.id}">
        <canvas class="upg-icon" width="40" height="40" data-icon="${u.id}"></canvas>
        <div class="upg-body">
          <div class="upg-title">${u.title}</div>
          <div class="upg-desc">${u.desc}</div>
          <div class="upg-meta">Lv ${lv}/${u.max} · ${fmtNum(cost)} ${u.currency === 'energy' ? 'E' : u.currency === 'data' ? 'D' : 'N'}</div>
        </div>
        <button type="button" class="upg-buy" data-upg="${u.id}" ${!can || lv >= u.max ? 'disabled' : ''}>Buy</button>
      </div>`;
    });
    el.panelUpg.innerHTML = html;
    drawMiniIcons(el.panelUpg);
  }

  function drawMiniIcons(container) {
    container.querySelectorAll('canvas[data-icon]').forEach((cv) => {
      const t = cv.dataset.icon;
      const c = cv.getContext('2d');
      c.fillStyle = 'rgba(0,255,213,0.2)';
      c.fillRect(0, 0, 40, 40);
      c.strokeStyle = 'rgba(0,255,213,0.5)';
      c.strokeRect(4, 4, 32, 32);
      if (t === 'click') {
        c.fillStyle = '#00ffd5';
        c.beginPath();
        c.arc(20, 20, 8, 0, Math.PI * 2);
        c.fill();
      } else if (t === 'gen0') {
        c.fillStyle = 'rgba(136,68,255,0.35)';
        c.fillRect(10, 14, 20, 12);
        c.strokeStyle = 'rgba(0,255,213,0.6)';
        c.strokeRect(10, 14, 20, 12);
      }
    });
  }

  function renderGenerators() {
    if (!state.flags.generatorsTab) {
      el.panelGen.innerHTML = '';
      return;
    }
    let html = '';
    GEN_DEFS.forEach((g, i) => {
      if (i > 0 && state.genLevels[i - 1] < 1) return;
      const cost = genCost(i);
      const can = state.energy >= cost;
      html += `<div class="gen-card">
        <div class="upg-body">
          <div class="upg-title">${g.name} ×${state.genLevels[i]}</div>
          <div class="upg-desc">${g.desc} · +${fmtNum(g.base * Math.pow(1.12, state.genLevels[i]) || g.base)}/s base</div>
          <div class="upg-meta">Next: ${fmtNum(cost)} E</div>
        </div>
        <button type="button" class="gen-buy" data-gen="${i}" ${!can ? 'disabled' : ''}>Buy</button>
      </div>`;
    });
    el.panelGen.innerHTML = html;
  }

  function renderMap() {
    let html = '<div class="map-grid">';
    REGION_NAMES.forEach((name, i) => {
      const cap = state.regions[i];
      const cost = regionCost(i);
      const can = !cap && state.energy >= cost;
      html += `<div class="map-node ${cap ? 'captured' : ''}">
        <strong>${name}</strong>
        <span class="upg-meta">${cap ? 'Captured' : fmtNum(cost) + ' E'}</span>
        <button type="button" class="map-capture" data-region="${i}" ${cap || !can ? 'disabled' : ''}>${cap ? 'OK' : 'Capture'}</button>
      </div>`;
    });
    html += '</div>';
    el.panelMap.innerHTML = html;
  }

  function renderSpace() {
    let html = '<div class="space-grid">';
    PLANET_DEFS.forEach((p, i) => {
      const cost = planetCost(i);
      const lv = state.planets[i];
      const can = state.energy >= cost;
      html += `<div class="planet-card">
        <div class="upg-title">${p.name} — Lv ${lv}</div>
        <div class="upg-desc">Matter income scaling. Next colonize: ${fmtNum(cost)} E</div>
        <button type="button" class="planet-buy" data-planet="${i}" ${!can ? 'disabled' : ''}>Colonize</button>
      </div>`;
    });
    html += '</div>';
    el.panelSpace.innerHTML = html;
  }

  function renderQuantum() {
    el.panelQuantum.innerHTML = `
      <p class="upg-desc">Discharge quantum potential for Quantum currency and a massive energy spike.</p>
      <div class="quantum-meter"><div class="quantum-fill" id="q-fill"></div></div>
      <p class="upg-meta">Fill rate scales with production · Total discharges: ${state.quantumTotal}</p>
      <button type="button" class="q-btn" id="btn-discharge" ${state.quantumCharge < 100 ? 'disabled' : ''}>Discharge</button>
    `;
    document.getElementById('q-fill').style.width = state.quantumCharge + '%';
    document.getElementById('btn-discharge').onclick = dischargeQuantum;
  }

  /** Sync Buy / Capture / Colonize / Discharge with live currencies every frame (no page refresh). */
  function updatePurchaseButtonStates(phase) {
    const clickBtn = el.panelUpg.querySelector('button.upg-buy[data-buy="click"]');
    if (clickBtn) {
      const c = clickUpgCost();
      clickBtn.disabled = state.clickLevel >= CLICK_UPG.max || !isFinite(c) || state.energy < c;
    }

    if (!state.flags.generatorsTab) {
      const gen0 = el.panelUpg.querySelector('button.gen-buy[data-gen="0"]');
      if (gen0) gen0.disabled = state.energy < genCost(0);
    }

    UPGRADES.forEach((u) => {
      if (u.id === 'synapse' && !state.flags.synapseShop) return;
      if (phase < u.phase) return;
      const btn = el.panelUpg.querySelector(`button.upg-buy[data-upg="${u.id}"]`);
      if (!btn) return;
      const lv = levelOf(u.id);
      const cost = upgCost(u);
      if (lv >= u.max || !isFinite(cost)) {
        btn.disabled = true;
        return;
      }
      const cur =
        u.currency === 'energy' ? state.energy : u.currency === 'data' ? state.data : state.network;
      btn.disabled = cur < cost;
    });

    if (state.flags.generatorsTab) {
      el.panelGen.querySelectorAll('button.gen-buy[data-gen]').forEach((btn) => {
        const i = +btn.dataset.gen;
        if (!Number.isFinite(i)) return;
        btn.disabled = state.energy < genCost(i);
      });
    }

    el.panelMap.querySelectorAll('button.map-capture[data-region]').forEach((btn) => {
      const i = +btn.dataset.region;
      if (state.regions[i]) {
        btn.disabled = true;
        return;
      }
      btn.disabled = state.energy < regionCost(i);
    });

    el.panelSpace.querySelectorAll('button.planet-buy[data-planet]').forEach((btn) => {
      const i = +btn.dataset.planet;
      if (!Number.isFinite(i)) return;
      btn.disabled = state.energy < planetCost(i);
    });

    const dq = document.getElementById('btn-discharge');
    if (dq) dq.disabled = state.quantumCharge < 100;
  }

  function dischargeQuantum() {
    if (state.quantumCharge < 100) return;
    state.quantumCharge = 0;
    const burst = genProduction() * 120 + state.energy * 0.05;
    state.energy += burst;
    state.quantum += 1 + Math.floor(Math.log10(Math.max(10, state.energy)));
    state.quantumTotal++;
    sfxBuy();
    toast('Quantum discharge — +' + fmtNum(burst) + ' Energy');
    save();
    fullRender();
  }

  function fullRender() {
    const phase = computePhase();
    syncProgressiveUiFlags(phase);
    applyProgressiveChrome(phase);
    const app = document.getElementById('asc-app');
    if (app) app.className = 'phase-' + phase;
    el.phaseNum.textContent = String(phase);
    renderResources(phase);
    renderObjective(phase);
    renderChecklist(phase);
    renderUpgrades(phase);
    renderGenerators();
    renderMap();
    renderSpace();
    renderQuantum();
    el.tabMap.classList.toggle('hidden', phase < 3);
    el.tabSpace.classList.toggle('hidden', phase < 5);
    el.tabQuantum.classList.toggle('hidden', phase < 6);
    el.orbGain.textContent = '+' + fmtNum(clickPower());
    el.statEps.textContent = fmtNum(genProduction()) + ' E/s';
    checkStory(phase);
    checkAchievements();
    updateAmbientPhase(phase);
    if (phase !== state.phaseSeen) {
      state.phaseSeen = phase;
      if (state.flags.showVisualLayer) ensureBackground(phase);
      toast('Phase ' + phase + ' — systems evolving');
      if (phase >= 4) sfxGlitch();
    } else if (state.flags.showVisualLayer && app && app.dataset.ascBgPhase !== String(phase)) {
      ensureBackground(phase);
    }
    uiPhaseCached = phase;
  }

  // ═══ INPUT ═══════════════════════════════════════════════
  function bindPanelClicks() {
    document.getElementById('panel-upgrades').addEventListener('click', (e) => {
      const gb = e.target.closest('.gen-buy');
      if (gb && el.panelUpg.contains(gb)) {
        const i = +gb.dataset.gen;
        const cost = genCost(i);
        if (state.energy < cost) return;
        state.energy -= cost;
        state.genLevels[i]++;
        sfxBuy();
        save();
        fullRender();
        return;
      }
      const b = e.target.closest('[data-buy="click"]');
      const u = e.target.closest('[data-upg]');
      if (b && b.classList.contains('upg-buy')) {
        const cost = clickUpgCost();
        if (state.energy >= cost && state.clickLevel < CLICK_UPG.max) {
          state.energy -= cost;
          state.clickLevel++;
          sfxBuy();
          save();
          fullRender();
        }
        return;
      }
      if (u && u.classList.contains('upg-buy')) {
        const id = u.dataset.upg;
        const def = UPGRADES.find((x) => x.id === id);
        if (!def) return;
        const cost = upgCost(def);
        const lv = levelOf(id);
        if (lv >= def.max) return;
        const cur =
          def.currency === 'energy' ? state.energy : def.currency === 'data' ? state.data : state.network;
        if (cur < cost) return;
        if (def.currency === 'energy') state.energy -= cost;
        else if (def.currency === 'data') state.data -= cost;
        else state.network -= cost;
        state.upgLevels[id] = lv + 1;
        sfxBuy();
        save();
        fullRender();
      }
    });

    el.panelGen.addEventListener('click', (e) => {
      const b = e.target.closest('[data-gen]');
      if (!b) return;
      const i = +b.dataset.gen;
      const cost = genCost(i);
      if (state.energy < cost) return;
      state.energy -= cost;
      state.genLevels[i]++;
      sfxBuy();
      save();
      fullRender();
    });

    el.panelMap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-region]');
      if (!b) return;
      const i = +b.dataset.region;
      if (state.regions[i]) return;
      const cost = regionCost(i);
      if (state.energy < cost) return;
      state.energy -= cost;
      state.regions[i] = true;
      sfxBuy();
      save();
      fullRender();
    });

    el.panelSpace.addEventListener('click', (e) => {
      const b = e.target.closest('[data-planet]');
      if (!b) return;
      const i = +b.dataset.planet;
      const cost = planetCost(i);
      if (state.energy < cost) return;
      state.energy -= cost;
      state.planets[i]++;
      sfxBuy();
      save();
      fullRender();
    });
  }

  document.getElementById('btn-collect').addEventListener('click', () => {
    const a = audio();
    if (a && a.state === 'suspended') a.resume();
    startAmbient();
    const p = clickPower();
    state.energy += p;
    state.totalEnergyEarned += p;
    sfxClick();
    el.orbGain.textContent = '+' + fmtNum(clickPower());
    el.orbGain.animate([{ transform: 'scale(1.2)' }, { transform: 'scale(1)' }], { duration: 120 });
    checkAchievements();
    updatePurchaseButtonStates(computePhase());
  });

  document.querySelectorAll('.asc-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.asc-tab').forEach((t) => t.classList.remove('is-active'));
      document.querySelectorAll('.asc-panel').forEach((p) => p.classList.remove('is-visible'));
      tab.classList.add('is-active');
      document.getElementById('panel-' + tab.dataset.panel).classList.add('is-visible');
    });
  });

  document.getElementById('btn-log').onclick = () => {
    document.getElementById('modal-log').classList.remove('hidden');
  };
  document.getElementById('btn-ach').onclick = () => {
    renderAchList();
    document.getElementById('modal-ach').classList.remove('hidden');
  };
  document.querySelectorAll('.asc-modal-close').forEach((b) => {
    b.onclick = () => {
      document.getElementById('modal-' + b.dataset.close).classList.add('hidden');
    };
  });

  function renderAchList() {
    el.achList.innerHTML = ACHIEVEMENTS.map(
      (a) =>
        `<div class="ach-row ${state.achievements[a.id] ? 'unlocked' : ''}">
        <span>${a.name}</span>
        <span class="ok">${state.achievements[a.id] ? '✓' : '—'}</span>
      </div>`
    ).join('');
  }

  // ═══ GAME LOOP ═══════════════════════════════════════════
  function tick(dt) {
    state.totalPlaySeconds += dt;
    const phase = computePhase();
    if (phase !== uiPhaseCached) {
      uiPhaseCached = phase;
      fullRender();
    } else if (syncProgressiveUiFlags(phase)) {
      fullRender();
    } else {
      applyProgressiveChrome(phase);
    }
    const eps = genProduction();
    state.energy += eps * dt;
    state.totalEnergyEarned += eps * dt;
    state.data += dataPerSecond() * dt;
    state.network += networkPerSecond() * dt;
    state.matter += matterPerSecond() * dt;
    if (state.energy > state.peakEnergy) state.peakEnergy = state.energy;
    if (phase >= 6) {
      state.quantumCharge = Math.min(100, state.quantumCharge + quantumFillRate() * dt);
    }
    tryRareEvent();
    updateResNumbers(phase);
    renderChecklist(phase);
    updatePurchaseButtonStates(phase);
    el.statEps.textContent = fmtNum(genProduction()) + ' E/s';
    const qf = document.getElementById('q-fill');
    if (qf) qf.style.width = state.quantumCharge + '%';
    const dq = document.getElementById('btn-discharge');
    if (dq) dq.disabled = state.quantumCharge < 100;
  }

  function loop(now) {
    const dt = Math.min(0.25, (now - lastFrame) / 1000);
    lastFrame = now;
    tick(dt);
    requestAnimationFrame(loop);
  }

  // ═══ INIT ════════════════════════════════════════════════
  load();
  const offSec = applyOffline();
  el.statOffline.textContent =
    offSec > 60 ? 'Offline: ~' + Math.floor(offSec / 60) + 'm accrued' : '';

  bindPanelClicks();

  STORY_LINES.filter((l) => l.phase === 1 && !l.hidden).forEach((l) => {
    state.storySeen[l.id] = true;
    pushStory(l, false);
  });

  fullRender();

  setInterval(save, SAVE_INTERVAL);
  window.addEventListener('beforeunload', save);
  requestAnimationFrame(loop);

  // Dev export
  window.ascensionExport = () => state;
})();
