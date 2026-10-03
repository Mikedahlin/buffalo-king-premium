/* ===================================================
   BUFFALO KING 2026 — Premium Slot Engine
   Fixes: image rendering, audio unlock, all bonus rounds
   =================================================== */

// ─── AUDIO MANAGER ───────────────────────────────────────────────────────────
// ─── AUDIO MANAGER (simple HTML Audio — works on every browser) ──────────────
class AudioManager {
  constructor() {
    this.muted = false;
    this.ready = false;
    this.volume = 0.7;
    this.pool = {};
    this.lastAt = {};
    this.sounds = {
      spinStart:  '/audio/reel-spin.wav',
      reelStop:   '/audio/reel-stop.wav',
      button:     '/audio/tick.wav',
      betUp:      '/audio/bet-up.wav',
      win:        '/audio/casino-win.wav',
      bigWin:     '/audio/big-win.wav',
      megaWin:    '/audio/jackpot.wav',
      grandWin:   '/audio/jackpot.wav',
      bonusStart: '/audio/bonus-start.wav',
      bonusSpin:  '/audio/bonus-spin.wav',
      bonusPick:  '/audio/big-win.wav',
      countUp:    '/audio/count-up.wav',
      collect:    '/audio/collect.wav',
    };
  }
  _get(src) {
    if (!this.pool[src]) this.pool[src] = [];
    let el = this.pool[src].find(a => a.paused || a.ended);
    if (!el) { el = new Audio(src); el.preload = 'auto'; this.pool[src].push(el); }
    return el;
  }
  preload() {
    Object.values(this.sounds).forEach(src => {
      if (!this.pool[src]) { const el = new Audio(src); el.preload = 'auto'; this.pool[src] = [el]; }
    });
  }
  async unlock() {
    if (this.muted) return;
    this.preload();
    this.ready = true;
    this.updateStatus();
    // Unlock iOS/Safari by playing a near-silent sound on user gesture
    try {
      const el = this._get('/audio/tick.wav');
      el.volume = 0.01;
      await el.play();
      el.pause(); el.currentTime = 0; el.volume = this.volume;
    } catch(e) {}
  }
  updateStatus() {
    const s = $('sound-status');
    if (s) s.textContent = this.muted ? 'Muted' : (this.ready ? 'Sound ON ✓' : '');
    const b = $('sound-test-btn');
    if (b) b.textContent = this.ready ? '🔊 SOUND ON' : '🔈 ENABLE SOUND';
  }
  setMuted(v) {
    this.muted = v;
    if (v) {
      // Stop all currently playing audio elements
      Object.values(this.pool).flat().forEach(el => {
        try { el.pause(); el.currentTime = 0; } catch(e) {}
      });
    }
    this.updateStatus();
  }
  play(ev) {
    if (this.muted || !this.ready) return;
    const gap = { reelStop: 100, button: 60 };
    const now = Date.now();
    if (gap[ev] && now - (this.lastAt[ev] || 0) < gap[ev]) return;
    this.lastAt[ev] = now;
    const src = this.sounds[ev]; if (!src) return;
    try { const el = this._get(src); el.volume = this.volume; el.currentTime = 0; el.play().catch(() => {}); } catch(e) {}
  }
}


// ─── PARTICLE SYSTEM ─────────────────────────────────────────────────────────
class ParticleSystem {
  constructor() {
    this.canvas = $('particle-canvas');
    if (!this.canvas) return;
    this.ctx2d = this.canvas.getContext('2d');
    this.particles = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop();
  }
  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
  spawn(x, y, count = 20) {
    if (this.particles.length > 200) return; // cap to prevent memory leak
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1,
        decay: 0.02 + Math.random() * 0.03,
        size: 3 + Math.random() * 5,
        color: `hsl(${40 + Math.random() * 30},100%,${50 + Math.random() * 20}%)`,
      });
    }
  }
  loop() {
    if (!this.canvas) return;
    const c = this.ctx2d;
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles = this.particles.filter(p => p.life > 0);
    this.particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.1;
      p.life -= p.decay;
      c.save();
      c.globalAlpha = Math.max(0, p.life);
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      c.fill();
      c.restore();
    });
    requestAnimationFrame(() => this.loop());
  }
}

// ─── GLOBALS ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const BET_LEVELS = [40,80,200,400,800,2000,5000,10000,25000,50000,100000,250000,500000,1000000,2500000,5000000,10000000,25000000,50000000,100000000,250000000,500000000,1000000000,2500000000,5000000000,10000000000];
const SYMS = ['Buffalo','Eagle','Wolf','King','Queen','Jack','Ten','Coin'];
const ALL_SYMS = ['Buffalo','Eagle','Wolf','King','Queen','Jack','Ten','Coin','Fight'];
const SYM_EXT = { Buffalo:'png', Eagle:'png', Wolf:'png', King:'png', Queen:'png', Jack:'png', Ten:'png', Coin:'png', Fight:'png' };

let spinning = false;
let bonusActive = false;

const audio = new AudioManager();
const particles = new ParticleSystem();

// ─── IMAGE PRELOAD ────────────────────────────────────────────────────────────
const imgCache = {};
function preloadImages() {
  ALL_SYMS.forEach(s => {
    const ext = SYM_EXT[s] || 'png';
    const img = new Image();
    img.src = `/images/${s.toLowerCase()}.${ext}`;
    imgCache[s] = img;
  });
}

function cellHTML(sym) {
  const ext = SYM_EXT[sym] || 'png';
  const src = `/images/${sym.toLowerCase()}.${ext}`;
  return `<div class="reel-strip"><img class="sym-img" src="${src}" alt="${sym}" loading="eager" onerror="this.style.display='none'"/></div>`;
}

// ─── INITIAL GRID ─────────────────────────────────────────────────────────────
function renderInitialGrid(gridEl) {
  if (!gridEl || gridEl.children.length) return;
  const init = ['Buffalo','Eagle','Wolf','King','Queen','Jack','Ten','Coin',
                'Eagle','Buffalo','King','Queen','Wolf','Ten','Coin','Jack',
                'Buffalo','Queen','Eagle','King','Ten','Wolf','Jack','Coin'];
  gridEl.innerHTML = init.map(s => `<div class="cell s-${s}">${cellHTML(s)}</div>`).join('');
}

// ─── API ──────────────────────────────────────────────────────────────────────
async function api(path, opts) {
  const r = await fetch(path, { headers: {'Content-Type':'application/json'}, ...(opts||{}) });
  if (!r.ok) throw new Error(await r.text().catch(() => `HTTP ${r.status}`));
  return r.json();
}
async function getState() { try { return await api('/api/state'); } catch(e) { return null; } }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── SPIN ANIMATION ──────────────────────────────────────────────────────────
async function doSpin() {
  if (spinning || bonusActive) return;
  spinning = true;

  if (!audio.ready) await audio.unlock();
  audio.play('spinStart');

  const st = await getState();
  if (!st) { spinning = false; toast('Cannot reach server', 'error'); return; }
  const isFree = st.freeSpinsRemaining > 0;
  if (st.credits < st.bet && !isFree) { spinning = false; toast('NOT ENOUGH CREDITS', 'error'); return; }

  spinBtn(true, isFree);
  const grid = $('grid');
  grid.className = 'grid spinning';
  grid.innerHTML = '';

  // Build spinning cells
  for (let i = 0; i < 24; i++) {
    const d = document.createElement('div');
    d.className = 'cell spin-cell';
    d.innerHTML = cellHTML(SYMS[i % SYMS.length]);
    d.dataset.col = Math.floor(i / 4);
    grid.appendChild(d);
  }

  // Column spin intervals
  const colInts = [];
  for (let col = 0; col < 6; col++) {
    colInts[col] = setInterval(() => {
      for (let row = 0; row < 4; row++) {
        const c = grid.children[col * 4 + row];
        if (c && c.classList.contains('spin-cell'))
          c.innerHTML = cellHTML(SYMS[Math.floor(Math.random() * SYMS.length)]);
      }
    }, 65);
  }

  try {
    const resultPromise = api('/api/spin', { method: 'POST' });
    await delay(1800);
    const r = await resultPromise;

    // Stop reels column by column
    for (let col = 0; col < 6; col++) {
      clearInterval(colInts[col]);
      audio.play('reelStop');
      for (let row = 0; row < 4; row++) {
        const c = grid.children[col * 4 + row];
        if (!c) continue;
        const sym = r.grid[col][row];
        c.className = `cell landing s-${sym}`;
        c.innerHTML = cellHTML(sym);
      }
      await delay(200);
    }

    await delay(250);
    for (let i = 0; i < 24; i++) {
      const c = grid.children[i];
      if (c) c.classList.remove('landing');
    }
    grid.className = 'grid';

    showResult(r);
    await refreshUI();

    // Trigger bonus round if server says so
    if (r.bonusRound && r.bonusRound !== '') {
      await delay(600);
      await playBonusRound(r);
    }

  } catch(e) {
    for (let col = 0; col < 6; col++) clearInterval(colInts[col]);
    toast('ERROR: ' + e.message, 'error');
    grid.className = 'grid';
  }

  spinning = false;
  const s2 = await getState();
  spinBtn(false, s2 ? s2.freeSpinsRemaining > 0 : false);
}

function spinBtn(busy, free) {
  const b = $('spin-btn');
  b.disabled = busy;
  if (busy) {
    b.textContent = free ? 'FREE SPIN...' : 'SPINNING...';
    b.className = free ? 'freespin' : '';
  } else {
    const fs = free ? (parseInt($('spins-display').textContent) || 0) : 0;
    b.textContent = fs > 0 ? `FREE (${fs})` : 'SPIN';
    b.className = fs > 0 ? 'freespin' : '';
  }
}

// ─── SHOW RESULT ─────────────────────────────────────────────────────────────
function showResult(r) {
  $('win-overlay').classList.remove('active');
  const mpb = $('multiplier-bar');
  if (r.isFreeSpin) {
    mpb.classList.add('active');
    $('multiplier-value').textContent = `${r.freeSpinMultiplier || 1}x`;
  } else {
    mpb.classList.remove('active');
  }

  if (r.totalWin > 0) {
    const tier = r.winTier || '';

    // ── GRAND / MEGA: full-screen fireworks celebration ──────────────────────
    if (tier === 'GRAND') {
      audio.play('grandWin');
      animateNum($('win-display'), r.totalWin);
      $('win-overlay').classList.add('active');
      showWinCelebration('🏆 GRAND JACKPOT! 🏆', r.totalWin, '#ff4444', true);
      const rw = $('reel-window');
      if (rw) { const rect = rw.getBoundingClientRect(); particles.spawn(rect.left+rect.width/2, rect.top+rect.height/2, 80); }

    } else if (tier === 'MEGA') {
      audio.play('megaWin');
      animateNum($('win-display'), r.totalWin);
      $('win-overlay').classList.add('active');
      showWinCelebration('💥 MEGA WIN! 💥', r.totalWin, '#ff88ff', true);
      const rw = $('reel-window');
      if (rw) { const rect = rw.getBoundingClientRect(); particles.spawn(rect.left+rect.width/2, rect.top+rect.height/2, 60); }

    // ── BIG WIN: quick toast + amount, no fullscreen ─────────────────────────
    } else if (tier === 'BIG') {
      audio.play('bigWin');
      animateNum($('win-display'), r.totalWin);
      $('win-overlay').classList.add('active');
      // Quick banner that auto-dismisses in 1.5s
      showWinCelebration('🔥 BIG WIN!', r.totalWin, '#f6d365', false);
      const rw = $('reel-window');
      if (rw) { const rect = rw.getBoundingClientRect(); particles.spawn(rect.left+rect.width/2, rect.top+rect.height/2, 30); }

    // ── NORMAL WIN: just show the amount, no popup ───────────────────────────
    } else {
      audio.play('win');
      // Instant number - no slow count-up animation for small wins
      $('win-display').textContent = r.totalWin.toLocaleString();
    }

    highlightWins(r);
    let html = '';
    (r.winningWays || []).forEach(w => {
      html += `<span class="way-line">${w.symbol} ×${w.consecutiveReels} (${w.wayCount} ways) = <b class="win-amount">+${w.payout.toLocaleString()}</b></span>`;
    });
    if (r.scatterPayout > 0) html += `<span class="way-line scatter-line">💰 SCATTER +${r.scatterPayout.toLocaleString()}</span>`;
    $('ways-display').innerHTML = html;

  } else {
    $('win-display').textContent = '0';
    $('ways-display').innerHTML = '';
  }

  if (r.freeSpinsAwarded > 0) {
    audio.play('bonusStart');
    toast(`⚡ ${r.freeSpinsAwarded} FREE SPINS!`, 'mega');
  }
}

function highlightWins(r) {
  const cells = $('grid').querySelectorAll('.cell');
  const syms = new Set((r.winningWays || []).map(w => w.symbol));
  cells.forEach(c => {
    const m = c.className.match(/s-(\w+)/);
    if (m && syms.has(m[1])) c.classList.add('win');
  });
}

function animateNum(el, target) {
  const cur = parseInt(el.textContent.replace(/,/g, '')) || 0;
  if (target <= cur) { el.textContent = target.toLocaleString(); return; }
  audio.play('countUp');
  const steps = Math.min(30, Math.ceil((target - cur) / 5));
  let s = 0;
  const iv = setInterval(() => {
    s++;
    el.textContent = Math.round(cur + (target - cur) * (s / steps)).toLocaleString();
    if (s >= steps) { clearInterval(iv); el.textContent = target.toLocaleString(); }
  }, 25);
}

// ─── WIN CELEBRATION ─────────────────────────────────────────────────────────
function showWinCelebration(title, amount, color, requireTap) {
  const cel = $('win-celebration');
  const panel = cel.querySelector('.win-celebration-panel');
  const titleEl = $('win-cel-title');
  const amountEl = $('win-cel-amount');
  const closeBtn = $('win-cel-close');

  titleEl.textContent = title;
  titleEl.style.color = color || '#ffd700';
  titleEl.style.textShadow = `0 0 30px ${color || '#ffd700'}99`;
  amountEl.textContent = '+' + amount.toLocaleString();
  amountEl.style.color = color || '#ff8c00';
  if (panel) panel.style.borderColor = color || '#ffd700';

  cel.classList.remove('hidden');

  if (requireTap) {
    // GRAND/MEGA: stays until player taps
    closeBtn.style.display = '';
    closeBtn.textContent = 'AWESOME!';
    closeBtn.onclick = () => cel.classList.add('hidden');
  } else {
    // BIG WIN: auto-dismisses after 1.5s, no button needed
    closeBtn.style.display = 'none';
    clearTimeout(cel._autoDismiss);
    cel._autoDismiss = setTimeout(() => cel.classList.add('hidden'), 1500);
  }
}

// ─── REFRESH UI ───────────────────────────────────────────────────────────────
async function refreshUI() {
  const s = await getState(); if (!s) return;
  $('credits').textContent = s.credits.toLocaleString();
  $('bet-amount').textContent = s.bet.toLocaleString();
  $('bet-display').textContent = s.bet.toLocaleString();
  const sc = $('spins-container');
  if (s.freeSpinsRemaining > 0) {
    sc.style.display = '';
    $('spins-display').textContent = s.freeSpinsRemaining;
  } else {
    sc.style.display = 'none';
  }
  updateJackpots(s);
}

function updateJackpots(s) {
  if (!s.jackpots) return;
  ['mini','minor','major','grand'].forEach(t => {
    const e = $(`jp-${t}`);
    if (e) e.textContent = (s.jackpots[t] || 0).toLocaleString();
  });
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
function toast(text, type) {
  const t = $('toast');
  t.textContent = text;
  t.className = type || 'normal';
  t.classList.remove('hidden');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.add('hidden'), 3500);
}

// ─── BET LEVEL ───────────────────────────────────────────────────────────────
function getCurrentBetLevel() {
  const cur = parseInt($('bet-amount').textContent.replace(/,/g,'')) || 80;
  let best = 1;
  for (let i = 0; i < BET_LEVELS.length; i++) { if (BET_LEVELS[i] <= cur) best = i; }
  return best;
}

// ─── BONUS INTRO VIDEO ──────────────────────────────────────────────────────
function playBonusIntroVideo() {
  return new Promise(resolve => {
    const ov = $('bonus-intro-overlay');
    const vid = $('bonus-intro-video');
    const skip = $('bonus-intro-skip');
    if (!vid) { resolve(); return; }
    ov.classList.remove('hidden');
    vid.currentTime = 0;
    vid.muted = true;
    vid.volume = 0.9;
    const done = () => {
      ov.classList.add('hidden');
      vid.pause();
      vid.muted = true;
      vid.currentTime = 0;
      resolve();
    };
    const p = vid.play();
    if (p) p.then(() => { vid.muted = false; }).catch(() => {
      skip.textContent = '▶ TAP TO START BONUS';
      skip.style.cssText += ';font-size:1.1rem;padding:14px 28px;bottom:50%;right:50%;transform:translate(50%,50%);';
    });
    vid.onended = done;
    skip.onclick = done;
  });
}

// ─── BONUS ROUND DISPATCHER ──────────────────────────────────────────────────
// All bonus rounds are now premium FREE SPINS with special effects.
// Each bonus type gets a different number of spins, multiplier, and visual theme.
async function playBonusRound(result) {
  bonusActive = true;
  try {
    // Show the "Welcome to the bonus round" video first
    await playBonusIntroVideo();
    audio.play('bonusStart');

    const round = result.bonusRound || 'FreeSpins';
    const bet = result.bet || 80;

    // Each bonus type maps to a free-spins config
    const configs = {
      FreeSpins:            { spins: 8,  mult: 1, maxMult: 3, label: '⚡ FREE SPINS',          color: '#2ecc71', glow: 'rgba(46,204,113,0.4)' },
      BonusWheel:           { spins: 10, mult: 2, maxMult: 4, label: '🎡 WHEEL SPINS',          color: '#f1c40f', glow: 'rgba(241,196,15,0.4)'  },
      HoldAndSpinCoins:     { spins: 12, mult: 2, maxMult: 5, label: '🪙 COIN SPINS',           color: '#e67e22', glow: 'rgba(230,126,34,0.4)'  },
      StampedeBonus:        { spins: 15, mult: 3, maxMult: 6, label: '🦬 STAMPEDE SPINS',       color: '#e74c3c', glow: 'rgba(231,76,60,0.4)'   },
      PickAPrize:           { spins: 10, mult: 2, maxMult: 5, label: '🦬 PRIZE SPINS',          color: '#9b59b6', glow: 'rgba(155,89,182,0.4)'  },
      ExpandingBuffaloWilds:{ spins: 12, mult: 3, maxMult: 6, label: '🦬 WILD BUFFALO SPINS',   color: '#ff8c00', glow: 'rgba(255,140,0,0.4)'   },
    };
    const cfg = configs[round] || configs.FreeSpins;

    await playFreeSpinsBonus(bet, cfg);

  } catch(e) {
    toast('Bonus error: ' + e.message, 'error');
  } finally {
    bonusActive = false;
    try { await refreshUI(); } catch(e) {}
  }
}

// ─── PREMIUM FREE SPINS (all bonus rounds use this) ───────────────────────────
async function playFreeSpinsBonus(bet, cfg) {
  const ov = $('freespins-overlay');
  ov.classList.remove('hidden');

  // Apply bonus color theme
  const panel = ov.querySelector('.freespins-panel');
  if (panel) {
    panel.style.borderColor = cfg.color;
    panel.style.boxShadow = `0 0 60px ${cfg.glow}, 0 0 120px rgba(0,0,0,0.5)`;
  }

  let spinsLeft = cfg.spins;
  let multiplier = cfg.mult;
  let totalWon = 0;

  // Update header
  const titleEl = ov.querySelector('.bonus-title');
  if (titleEl) { titleEl.textContent = cfg.label; titleEl.style.color = cfg.color; }

  $('fs-remaining').textContent = spinsLeft;
  $('fs-multiplier').textContent = multiplier + 'x';
  $('fs-total-win').textContent = '0';
  $('fs-log').innerHTML = '';
  $('fs-footer').classList.add('hidden');

  const fsGrid = $('fs-grid');
  renderInitialGrid(fsGrid);

  for (let i = 0; i < cfg.spins; i++) {
    spinsLeft = cfg.spins - i;
    $('fs-remaining').textContent = spinsLeft;
    await delay(350);

    // Animate reels spinning
    fsGrid.className = 'grid spinning';
    fsGrid.innerHTML = '';
    for (let j = 0; j < 24; j++) {
      const d = document.createElement('div');
      d.className = 'cell spin-cell';
      d.innerHTML = cellHTML(SYMS[j % SYMS.length]);
      fsGrid.appendChild(d);
    }
    const spinInt = setInterval(() => {
      for (let j = 0; j < 24; j++) {
        const c = fsGrid.children[j];
        if (c) c.innerHTML = cellHTML(SYMS[Math.floor(Math.random() * SYMS.length)]);
      }
    }, 60);

    let sr;
    try {
      sr = await api('/api/spin', { method: 'POST' });
    } catch(e) {
      clearInterval(spinInt);
      break;
    }
    clearInterval(spinInt);

    // Land symbols column by column with sound
    for (let col = 0; col < 6; col++) {
      audio.play('reelStop');
      for (let row = 0; row < 4; row++) {
        const c = fsGrid.children[col * 4 + row];
        if (!c) continue;
        const sym = sr.grid[col][row];
        c.className = `cell landing s-${sym}`;
        c.innerHTML = cellHTML(sym);
      }
      await delay(120);
    }
    fsGrid.className = 'grid';
    await delay(200);
    for (let j = 0; j < 24; j++) {
      const c = fsGrid.children[j];
      if (c) c.classList.remove('landing');
    }

    // Retrigger: more coins = multiplier up
    if (sr.freeSpinsAwarded > 0 || sr.coinCount >= 3) {
      multiplier = Math.min(multiplier + 1, cfg.maxMult);
      $('fs-multiplier').textContent = multiplier + 'x';
      $('fs-multiplier').style.color = cfg.color;
      toast(`🔥 ${multiplier}x MULTIPLIER!`, 'mega');
    }

    const spinWin = sr.totalWin * multiplier;
    totalWon += spinWin;
    $('fs-total-win').textContent = totalWon.toLocaleString();

    if (spinWin > 0) {
      if (spinWin > bet * 50) audio.play('bigWin');
      else audio.play('win');
      // Highlight winning cells
      const syms = new Set((sr.winningWays || []).map(w => w.symbol));
      fsGrid.querySelectorAll('.cell').forEach(c => {
        const m = c.className.match(/s-(\w+)/);
        if (m && syms.has(m[1])) c.classList.add('win');
      });
      setTimeout(() => fsGrid.querySelectorAll('.cell.win').forEach(c => c.classList.remove('win')), 600);
    }

    // Log entry
    const entry = document.createElement('div');
    entry.className = 'fs-log-entry' + (spinWin > 0 ? ' win' : '');
    entry.innerHTML = `<span>Spin ${i + 1}</span><span>${spinWin > 0 ? '+' + spinWin.toLocaleString() : '—'}</span>`;
    $('fs-log').prepend(entry);
    await delay(250);
  }

  // Total row
  const total = document.createElement('div');
  total.className = 'fs-log-entry total';
  total.innerHTML = `<span>TOTAL WIN</span><span>+${totalWon.toLocaleString()}</span>`;
  $('fs-log').prepend(total);

  if (totalWon > 0) {
    audio.play('bigWin');
    if (totalWon > bet * 100) showWinCelebration(cfg.label + ' JACKPOT!', totalWon);
  }

  // Credit winnings
  if (totalWon > 0) {
    try { await api('/api/bonus-collect', { method: 'POST', body: JSON.stringify({ credits: totalWon, freeSpins: 0 }) }); } catch(e) {}
  }

  // Show collect button
  $('fs-footer').classList.remove('hidden');
  const collectBtn = $('fs-collect-btn');
  if (collectBtn) {
    collectBtn.style.background = `linear-gradient(180deg,${cfg.color},${cfg.color}99)`;
    collectBtn.textContent = `🏆 COLLECT +${totalWon.toLocaleString()}`;
  }

  return new Promise(resolve => {
    const btn = $('fs-collect-btn');
    if (btn) {
      btn.onclick = () => {
        ov.classList.add('hidden');
        $('fs-footer').classList.add('hidden');
        // Reset panel style
        if (panel) { panel.style.borderColor = ''; panel.style.boxShadow = ''; }
        if (titleEl) { titleEl.style.color = ''; }
        audio.play('collect');
        resolve(totalWon);
      };
    } else {
      resolve(totalWon);
    }
  });
}

// ─── PAYTABLE ────────────────────────────────────────────────────────────────
function togglePaytable() { $('paytable').classList.toggle('hidden'); }

// ─── EVENT LISTENERS ─────────────────────────────────────────────────────────
$('spin-btn').onclick = async () => {
  // Auto-unlock audio on first spin click (user gesture)
  if (!audio.ready && !audio.muted) await audio.unlock();
  doSpin();
};

$('bet-down').onclick = async () => {
  if (!audio.ready && !audio.muted) await audio.unlock();
  audio.play('button');
  const s = await getState(); if (!s) return;
  const idx = getCurrentBetLevel();
  const nb = idx > 0 ? BET_LEVELS[idx - 1] : BET_LEVELS[0];
  if (nb !== s.bet) {
    try { await api('/api/bet', { method: 'POST', body: JSON.stringify({ bet: nb }) }); } catch(e) {}
    await refreshUI();
  }
};

$('bet-up').onclick = async () => {
  if (!audio.ready) await audio.unlock();
  audio.play('betUp');
  const s = await getState(); if (!s) return;
  const idx = getCurrentBetLevel();
  const nb = idx < BET_LEVELS.length - 1 ? BET_LEVELS[idx + 1] : BET_LEVELS[BET_LEVELS.length - 1];
  if (nb !== s.bet) {
    try { await api('/api/bet', { method: 'POST', body: JSON.stringify({ bet: nb }) }); } catch(e) {}
    await refreshUI();
  }
};

$('max-bet-btn').onclick = async () => {
  audio.play('button');
  try { await api('/api/bet', { method: 'POST', body: JSON.stringify({ bet: BET_LEVELS[BET_LEVELS.length - 1] }) }); } catch(e) {}
  await refreshUI();
};

$('mute-btn').onclick = () => {
  audio.setMuted(!audio.muted);
  $('mute-btn').textContent = audio.muted ? '🔇' : '🔊';
};

$('sound-test-btn').onclick = async () => {
  audio.setMuted(false);
  $('mute-btn').textContent = '🔊';
  const ok = await audio.unlock();
  if (ok) audio.play('betUp');
};

$('paytable-btn').onclick = togglePaytable;
$('paytable-close').onclick = togglePaytable;

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.repeat) { e.preventDefault(); if (!bonusActive) doSpin(); }
  if (e.code === 'ArrowUp') { e.preventDefault(); $('bet-up').click(); }
  if (e.code === 'ArrowDown') { e.preventDefault(); $('bet-down').click(); }
  if (e.code === 'KeyP') togglePaytable();
});

// ─── INIT ────────────────────────────────────────────────────────────────────
preloadImages();
renderInitialGrid($('grid'));
audio.updateStatus();
refreshUI();

// Add bonus-collect endpoint if missing
(async () => {
  try {
    const r = await fetch('/api/bonus-collect', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({credits:0,freeSpins:0}) });
    // If 404, the endpoint doesn't exist — that's OK, we handle it silently
  } catch(e) {}
})();
