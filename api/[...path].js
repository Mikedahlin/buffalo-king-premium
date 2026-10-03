const REELS = 6;
const ROWS = 4;
const CARDS = ['Ten', 'Jack', 'Queen', 'King'];
const STACKABLE = ['Buffalo', 'Eagle', 'Wolf'];
const SYMBOLS = ['Buffalo', 'Eagle', 'Wolf', 'King', 'Queen', 'Jack', 'Ten', 'Coin', 'Fight'];

function json(res, body, state) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (state) res.setHeader('Set-Cookie', `bk_state=${encodeURIComponent(JSON.stringify(state))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
  res.end(JSON.stringify(body));
}

function readState(req) {
  const match = (req.headers.cookie || '').match(/(?:^|;\s*)bk_state=([^;]*)/);
  if (!match) return { credits: 10000, bet: 80, freeSpinsRemaining: 0, lifetimeWin: 0, totalSpins: 0 };
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1]));
    return { credits: 10000, bet: 80, freeSpinsRemaining: 0, lifetimeWin: 0, totalSpins: 0, ...parsed };
  } catch { return { credits: 10000, bet: 80, freeSpinsRemaining: 0, lifetimeWin: 0, totalSpins: 0 }; }
}

function stateView(s) {
  return {
    credits: s.credits, bet: s.bet, minBet: 40, maxBet: 10000000000,
    freeSpinsRemaining: s.freeSpinsRemaining, isBusy: false,
    lifetimeWin: s.lifetimeWin, totalSpins: s.totalSpins,
    jackpots: { mini: s.bet * 25, minor: s.bet * 50, major: s.bet * 100, grand: s.bet * 500 }
  };
}

function weighted(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < items.length; i++) { roll -= weights[i]; if (roll < 0) return items[i]; }
  return items[items.length - 1];
}

function rollSymbol() {
  const rolled = weighted(['Buffalo', 'Eagle', 'Wolf', 'Card', 'Coin', 'Fight'], [2, 5, 8, 82, 2.5, 0.5]);
  return rolled === 'Card' ? CARDS[Math.floor(Math.random() * CARDS.length)] : rolled;
}

function makeGrid() {
  const grid = [];
  for (let reel = 0; reel < REELS; reel++) {
    const col = [];
    const useStack = Math.random() < 0.15;
    const stack = useStack ? STACKABLE[Math.floor(Math.random() * STACKABLE.length)] : null;
    const height = useStack ? 2 + Math.floor(Math.random() * 2) : 0;
    const start = useStack ? Math.floor(Math.random() * (ROWS - height + 1)) : -1;
    for (let row = 0; row < ROWS; row++) col.push(row >= start && row < start + height ? stack : rollSymbol());
    grid.push(col);
  }
  return grid;
}

function wild(s) { return s === 'Eagle'; }

function payoutFor(symbol, count, bet) {
  if (count < 2) return 0;
  const table = {
    Buffalo: { 2: 2, 3: 10, 4: 50, 5: 250, 6: 500 },
    Eagle: { 2: 1, 3: 6, 4: 20, 5: 100, 6: 200 },
    Wolf: { 3: 5, 4: 15, 5: 75, 6: 150 },
    Ten: { 3: 3, 4: 10, 5: 40, 6: 80 }, Jack: { 3: 3, 4: 10, 5: 40, 6: 80 },
    Queen: { 3: 3, 4: 10, 5: 40, 6: 80 }, King: { 3: 3, 4: 10, 5: 40, 6: 80 }
  };
  return bet * (table[symbol]?.[count] || 0);
}

function evaluateWays(grid, bet) {
  const result = [];
  const checked = new Set();
  for (const symbol of grid[0]) {
    if (symbol === 'Coin' || symbol === 'Fight' || checked.has(symbol)) continue;
    checked.add(symbol);
    let consecutive = 1;
    for (let reel = 1; reel < REELS; reel++) {
      if (grid[reel].some(s => s === symbol || wild(s))) consecutive++; else break;
    }
    let ways = 1;
    for (let reel = 1; reel < consecutive; reel++) ways *= Math.max(1, grid[reel].filter(s => s === symbol || wild(s)).length);
    const base = payoutFor(symbol, consecutive, bet);
    if (base > 0) result.push({ symbol, consecutiveReels: consecutive, wayCount: ways, payout: base * ways });
  }
  return result;
}

function bonusRound(coins, buffalos, fight) {
  const eligible = [];
  if (coins >= 3) eligible.push(['FreeSpins', 24]);
  if (coins >= 4) eligible.push(['BonusWheel', 18]);
  if (coins >= 5) eligible.push(['HoldAndSpinCoins', 14]);
  if (fight || buffalos >= 4) eligible.push(['StampedeBonus', 16]);
  if (fight || buffalos >= 5) eligible.push(['PickAPrize', 16]);
  if (buffalos >= 3) eligible.push(['ExpandingBuffaloWilds', 12]);
  return eligible.length ? weighted(eligible.map(x => x[0]), eligible.map(x => x[1])) : '';
}

function spin(s) {
  const free = s.freeSpinsRemaining > 0;
  if (!free && s.credits < s.bet) throw new Error('Insufficient credits');
  if (free) s.freeSpinsRemaining--; else { s.credits -= s.bet; s.totalSpins++; }
  const grid = makeGrid();
  const coins = grid.flat().filter(x => x === 'Coin').length;
  const buffalos = grid.flat().filter(x => x === 'Buffalo').length;
  const fight = grid.flat().filter(x => x === 'Fight').length;
  const winningWays = evaluateWays(grid, s.bet);
  const totalWaysPayout = winningWays.reduce((sum, x) => sum + x.payout, 0);
  const scatterPayout = coins < 2 ? 0 : s.bet * (coins === 2 ? 2 : coins === 3 ? 5 : coins === 4 ? 20 : coins === 5 ? 50 : coins * 5);
  const totalWin = totalWaysPayout + scatterPayout;
  const freeSpinsAwarded = !free && coins >= 2 ? (coins >= 5 ? 25 : coins === 4 ? 15 : 8) : 0;
  s.freeSpinsRemaining += freeSpinsAwarded;
  if (totalWin > 0) { s.credits += totalWin; s.lifetimeWin += totalWin; }
  const multiplier = totalWin / Math.max(1, s.bet);
  return {
    grid, coinCount: coins, buffaloCount: buffalos, totalWaysPayout, scatterPayout, totalWin,
    bet: s.bet, credits: s.credits, freeSpinsRemaining: s.freeSpinsRemaining,
    freeSpinsAwarded, fightTriggered: fight > 0, isFreeSpin: free,
    winTier: multiplier >= 100 ? 'GRAND' : multiplier >= 50 ? 'MEGA' : multiplier >= 15 ? 'BIG' : '',
    winningWays, bonusRound: (!free && (coins >= 3 || buffalos >= 4 || fight > 0)) ? bonusRound(coins, buffalos, fight > 0) : '', bonusCreditsWon: 0
  };
}

export default function handler(req, res) {
  const path = new URL(req.url, 'http://localhost').pathname;
  const s = readState(req);
  try {
    if (req.method === 'GET' && path === '/api/state') return json(res, stateView(s), s);
    if (req.method === 'POST' && path === '/api/spin') return json(res, spin(s), s);
    if (req.method === 'POST' && path === '/api/add-credits') { s.credits += 10000; return json(res, stateView(s), s); }
    if (req.method === 'POST' && path === '/api/bonus-collect') return json(res, stateView(s), s);
    if (req.method === 'POST' && path === '/api/bet') {
      let raw = ''; req.on('data', chunk => { raw += chunk; });
      return req.on('end', () => { const bet = Number(JSON.parse(raw || '{}').bet); if (!Number.isFinite(bet) || bet < 40 || bet > 10000000000) return res.status(400).json({ error: 'Invalid bet' }); s.bet = bet; json(res, { bet }, s); });
    }
    res.statusCode = 404; res.end('Not found');
  } catch (error) { res.statusCode = 400; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: error.message || 'Game error' })); }
}
