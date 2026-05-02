require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const path = require('path');
const http = require('http');
const fs = require('fs');
const { Server } = require('socket.io');
const crypto = require('crypto');
const CW = require('./crypto-wallet');

// ── Auto-generate wallet seed if missing ──────────────────────────────────
(function ensureWalletSeed() {
  const envPath = path.join(__dirname, '.env');
  if (!process.env.WALLET_SEED) {
    const mnemonic = CW.generateMnemonic();
    process.env.WALLET_SEED = mnemonic;
    fs.appendFileSync(envPath, `\nWALLET_SEED=${mnemonic}\n`);
    console.log('\n✅ Generated new crypto wallet seed and saved to .env');
    console.log('   BACKUP YOUR .env FILE — losing it means losing all house funds!\n');
  }
  try {
    const hotAddr = CW.initWallet(process.env.WALLET_SEED);
    console.log(`[crypto] Hot wallet ready: ${hotAddr}`);
  } catch (e) {
    console.error('[crypto] Wallet init failed:', e.message);
  }
})();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ─────────────────────────── DATABASE ───────────────────────────
const DB_FILE = path.join(__dirname, 'casino-db.json');

function defaultDB() {
  return {
    users: {},
    bets: [],
    nextBetId: 1,
    game_rates: {
      slots:     { rtp: 0.96,   enabled: true, label: 'RTP %' },
      roulette:  { house_edge: 0.027, enabled: true, label: 'House Edge' },
      mines:     { house_edge: 0.04,  enabled: true, label: 'House Edge' },
      dice:      { house_edge: 0.01,  enabled: true, label: 'House Edge' },
      crash:     { house_edge: 0.04,  enabled: true, label: 'House Edge' },
      plinko:    { house_edge: 0.04,  enabled: true, label: 'House Edge' },
      blackjack: { house_edge: 0.005, enabled: true, label: 'House Edge' },
      ropecut:   { house_edge: 0.04,  enabled: true, label: 'House Edge' },
      keno:      { house_edge: 0.04,  enabled: true, label: 'House Edge' },
      hilo:      { house_edge: 0.04,  enabled: true, label: 'House Edge' },
    }
  };
}

let DB = (() => {
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    // ensure defaults merged
    const def = defaultDB();
    return { ...def, ...data, game_rates: { ...def.game_rates, ...data.game_rates } };
  } catch { return defaultDB(); }
})();

function saveDB() {
  try {
    fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(DB));
    fs.renameSync(DB_FILE + '.tmp', DB_FILE);
  } catch (e) { console.error('DB save error:', e.message); }
}

// Admin bootstrap
const ADMIN_USER = process.env.ADMIN_USERNAME || 'owner';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'owner';
if (!DB.users[ADMIN_USER]) {
  DB.users[ADMIN_USER] = { id: ADMIN_USER, name: 'Owner', email: '', balance: 999999, role: 'admin', provider: 'local', created_at: Date.now(), last_seen: Date.now() };
  saveDB();
}

// ─────────────────────────── MIDDLEWARE ───────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || ('obs-' + crypto.randomBytes(12).toString('hex')),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
});
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

// Share session with socket.io
io.engine.use(sessionMiddleware);

// ─────────────────────────── PASSPORT ───────────────────────────
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => done(null, DB.users[id] || null));

passport.use(new LocalStrategy((username, password, done) => {
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    DB.users[ADMIN_USER].last_seen = Date.now();
    saveDB();
    return done(null, DB.users[ADMIN_USER]);
  }
  return done(null, false, { message: 'Invalid credentials' });
}));

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
  }, (accessToken, refreshToken, profile, done) => {
    const id = 'google_' + profile.id;
    if (!DB.users[id]) {
      DB.users[id] = { id, google_id: profile.id, name: profile.displayName, email: profile.emails?.[0]?.value || '', avatar: profile.photos?.[0]?.value || '', balance: 5000, role: 'player', provider: 'google', created_at: Date.now(), last_seen: Date.now() };
    } else {
      DB.users[id].last_seen = Date.now();
      DB.users[id].name = profile.displayName;
    }
    saveDB();
    return done(null, DB.users[id]);
  }));
}

// ─────────────────────────── AUTH ROUTES ───────────────────────────
app.post('/auth/admin', passport.authenticate('local', { failureRedirect: '/login?error=1' }), (req, res) => res.redirect('/'));
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login?error=1' }), (req, res) => res.redirect('/'));
app.post('/auth/guest', (req, res) => {
  const name = (req.body.name || 'Guest').trim().substring(0, 20) || 'Guest';
  const id = 'guest_' + crypto.randomBytes(6).toString('hex');
  DB.users[id] = { id, name, balance: 1000, role: 'player', provider: 'guest', created_at: Date.now(), last_seen: Date.now() };
  saveDB();
  req.login(DB.users[id], () => res.redirect('/'));
});
app.get('/auth/logout', (req, res) => req.logout(() => res.redirect('/login')));

// ─────────────────────────── AUTH GUARDS ───────────────────────────
function requireAuth(req, res, next) { req.isAuthenticated() ? next() : res.redirect('/login'); }
function requireAdmin(req, res, next) { (req.isAuthenticated() && req.user.role === 'admin') ? next() : res.status(403).json({ error: 'Forbidden' }); }

// ─────────────────────────── API ───────────────────────────
app.get('/api/me', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  const u = req.user;
  res.json({ id: u.id, name: u.name, balance: u.balance, role: u.role, avatar: u.avatar || '' });
});

app.get('/api/rates', (req, res) => res.json(DB.game_rates));

app.post('/api/bet', requireAuth, (req, res) => {
  const { game, wagered, returned } = req.body;
  const user = DB.users[req.user.id];
  if (!user) return res.status(401).json({ error: 'No user' });
  const w = parseFloat(wagered), r = parseFloat(returned);
  if (!w || w <= 0 || r < 0 || w > user.balance + 0.01) return res.status(400).json({ error: 'Invalid bet' });
  user.balance = Math.round(Math.max(0, user.balance - w + r) * 100) / 100;
  user.last_seen = Date.now();
  const bet = { id: DB.nextBetId++, user_id: user.id, user_name: user.name, game, wagered: w, returned: r, net: Math.round((r - w) * 100) / 100, created_at: Date.now() };
  DB.bets.push(bet);
  if (DB.bets.length > 50000) DB.bets = DB.bets.slice(-25000);
  saveDB();
  io.to('admin_room').emit('admin:bet', bet);
  res.json({ balance: user.balance });
});

app.post('/api/balance/sync', requireAuth, (req, res) => {
  const user = DB.users[req.user.id];
  res.json({ balance: user?.balance || 0 });
});

app.post('/api/refill', requireAuth, (req, res) => {
  const user = DB.users[req.user.id];
  if (!user) return res.status(401).json({ error: 'No user' });
  if (user.balance >= 500) return res.status(400).json({ error: 'Balance too high for refill' });
  user.balance = Math.round((user.balance + 1000) * 100) / 100;
  user.last_seen = Date.now();
  saveDB();
  res.json({ balance: user.balance });
});

// ─────────────────────────── ADMIN API ───────────────────────────
app.get('/admin/api/stats', requireAdmin, (req, res) => {
  const users = Object.values(DB.users).filter(u => u.role !== 'admin');
  const bets = DB.bets;
  const now = Date.now();
  const today = bets.filter(b => now - b.created_at < 86400000);
  const byGame = {};
  for (const b of bets) {
    if (!byGame[b.game]) byGame[b.game] = { wagered: 0, returned: 0, count: 0 };
    byGame[b.game].wagered += b.wagered;
    byGame[b.game].returned += b.returned;
    byGame[b.game].count++;
  }
  res.json({
    total_players: users.length,
    online_now: onlinePlayers.size,
    total_bets: bets.length,
    bets_today: today.length,
    wagered_today: today.reduce((s, b) => s + b.wagered, 0),
    profit_today: today.reduce((s, b) => s + (b.wagered - b.returned), 0),
    wagered_total: bets.reduce((s, b) => s + b.wagered, 0),
    profit_total: bets.reduce((s, b) => s + (b.wagered - b.returned), 0),
    player_balances: users.reduce((s, u) => s + u.balance, 0),
    by_game: byGame,
  });
});

app.get('/admin/api/players', requireAdmin, (req, res) => {
  const players = Object.values(DB.users).filter(u => u.role !== 'admin').map(u => {
    const ub = DB.bets.filter(b => b.user_id === u.id);
    return { ...u, total_bets: ub.length, total_wagered: ub.reduce((s,b)=>s+b.wagered,0), total_returned: ub.reduce((s,b)=>s+b.returned,0), pl: ub.reduce((s,b)=>s+b.net,0) };
  }).sort((a, b) => b.last_seen - a.last_seen);
  res.json(players);
});

app.get('/admin/api/bets', requireAdmin, (req, res) => {
  res.json(DB.bets.slice(-200).reverse());
});

app.get('/admin/api/rates', requireAdmin, (req, res) => res.json(DB.game_rates));

app.post('/admin/api/rates', requireAdmin, (req, res) => {
  const { rates } = req.body;
  Object.entries(rates || {}).forEach(([game, cfg]) => {
    if (DB.game_rates[game]) DB.game_rates[game] = { ...DB.game_rates[game], ...cfg };
  });
  saveDB();
  io.emit('rates:update', DB.game_rates);
  res.json({ ok: true, rates: DB.game_rates });
});

app.post('/admin/api/player/:id/balance', requireAdmin, (req, res) => {
  const user = DB.users[req.params.id];
  if (!user) return res.status(404).json({ error: 'Not found' });
  user.balance = parseFloat(req.body.balance) || user.balance;
  saveDB();
  res.json({ ok: true, balance: user.balance });
});

app.delete('/admin/api/player/:id', requireAdmin, (req, res) => {
  delete DB.users[req.params.id];
  saveDB();
  res.json({ ok: true });
});

// ─────────────────────────── CRYPTO PAYMENTS ───────────────────────────
// ─────────────────────────── CRYPTO PAYMENTS (direct blockchain) ──────────
const DEPOSIT_FEE  = parseFloat(process.env.DEPOSIT_FEE_PCT  || '0.01');   // 1%
const WITHDRAW_FEE = parseFloat(process.env.WITHDRAW_FEE_PCT || '0.015');  // 1.5%

if (!DB.transactions)    DB.transactions    = [];
if (!DB.nextTxId)        DB.nextTxId        = 1;
if (!DB.nextWalletIdx)   DB.nextWalletIdx   = 0;

// Assign a unique HD wallet index to a user (for deposit address)
function ensureUserWallet(user) {
  if (user.wallet_index == null) {
    user.wallet_index = DB.nextWalletIdx++;
    const w = CW.deriveDepositWallet(user.wallet_index);
    user.eth_deposit_address = w.address;
    saveDB();
  }
  return CW.deriveDepositWallet(user.wallet_index);
}

// GET /api/crypto/price
app.get('/api/crypto/price', requireAuth, async (req, res) => {
  try {
    const eth = await CW.getEthPrice();
    res.json({ eth, ts: Date.now() });
  } catch { res.json({ eth: 2500 }); }
});

// GET /api/crypto/deposit-address  — returns user's dedicated deposit address
app.get('/api/crypto/deposit-address', requireAuth, async (req, res) => {
  const user = DB.users[req.user.id];
  if (!user) return res.status(401).json({ error: 'No user' });
  ensureUserWallet(user);
  const ethPrice = await CW.getEthPrice().catch(() => 2500);
  res.json({ address: user.eth_deposit_address, eth_price: ethPrice, supported: ['eth','usdt','usdc'] });
});

// GET /api/crypto/estimate?coin=eth&usd=100 — how much crypto for USD
app.get('/api/crypto/estimate', requireAuth, async (req, res) => {
  const { coin = 'eth', usd } = req.query;
  if (!usd) return res.status(400).json({ error: 'Missing usd' });
  const amt = parseFloat(usd);
  try {
    if (coin === 'eth') {
      const ethAmt = await CW.usdToEth(amt);
      return res.json({ coin, usd: amt, crypto_amount: ethAmt });
    }
    // USDT/USDC are 1:1 USD
    res.json({ coin, usd: amt, crypto_amount: amt });
  } catch { res.json({ coin, usd: amt, crypto_amount: null }); }
});

// POST /api/crypto/check-deposit — manually trigger deposit check for user
app.post('/api/crypto/check-deposit', requireAuth, async (req, res) => {
  const user = DB.users[req.user.id];
  if (!user || user.wallet_index == null) return res.json({ credited: false });
  const credited = await checkUserDeposit(user);
  res.json({ credited, balance: user.balance });
});

// POST /api/crypto/withdraw — send crypto to user's personal wallet
app.post('/api/crypto/withdraw', requireAuth, async (req, res) => {
  const { coin = 'eth', wallet_address, amount_usd } = req.body;
  const amt = parseFloat(amount_usd);
  const user = DB.users[req.user.id];
  if (!user) return res.status(401).json({ error: 'No user' });
  if (!wallet_address || !amt || amt < 10) return res.status(400).json({ error: 'Invalid request (min $10 withdrawal)' });
  if (amt > user.balance) return res.status(400).json({ error: 'Insufficient balance' });
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet_address) && !/^[13][a-zA-HJ-NP-Z0-9]{25,34}$/.test(wallet_address) && wallet_address.length < 10) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  const fee = Math.round(amt * WITHDRAW_FEE * 100) / 100;
  const net = Math.round((amt - fee) * 100) / 100;
  const txId = DB.nextTxId++;

  user.balance = Math.round((user.balance - amt) * 100) / 100;
  user.last_seen = Date.now();

  const tx = {
    id: txId, user_id: user.id, user_name: user.name,
    type: 'withdraw', status: 'pending',
    coin: coin.toLowerCase(), amount_usd: amt, fee_usd: fee, net_usd: net,
    wallet_address, tx_hash: null,
    created_at: Date.now(), confirmed_at: null,
  };
  DB.transactions.push(tx);
  saveDB();

  // Process payout asynchronously
  setImmediate(async () => {
    try {
      const hot = CW.getHotWallet();
      if (!hot) throw new Error('Hot wallet not ready');
      let txHash;
      if (coin === 'eth') {
        const ethAmt = await CW.usdToEth(net);
        txHash = await CW.sendEth(wallet_address, ethAmt, hot.privateKey);
      } else if (coin === 'usdt' || coin === 'usdc') {
        txHash = await CW.sendToken(wallet_address, net, coin, hot.privateKey);
      }
      tx.status = 'confirmed';
      tx.tx_hash = txHash;
      tx.confirmed_at = Date.now();
      saveDB();
      io.to('admin_room').emit('admin:withdraw', { ...tx });
    } catch (e) {
      console.error('[crypto] Withdrawal failed:', e.message);
      // Refund on failure
      const u = DB.users[tx.user_id];
      if (u) u.balance = Math.round((u.balance + amt) * 100) / 100;
      tx.status = 'failed';
      tx.error = e.message;
      saveDB();
    }
  });

  res.json({ ok: true, tx_id: txId, net_usd: net, fee_usd: fee, message: 'Withdrawal processing. Funds sent within 5 minutes.' });
});

// GET /api/crypto/transactions
app.get('/api/crypto/transactions', requireAuth, (req, res) => {
  const txs = DB.transactions.filter(t => t.user_id === req.user.id).slice(-50).reverse();
  res.json(txs);
});

// Admin: all transactions + hot wallet balance
app.get('/admin/api/transactions', requireAdmin, (req, res) => {
  res.json(DB.transactions.slice(-500).reverse());
});

app.get('/admin/api/hot-wallet', requireAdmin, async (req, res) => {
  try {
    const hot = CW.getHotWallet();
    if (!hot) return res.json({ address: null, eth: 0, usdt: 0 });
    const [eth, usdt] = await Promise.all([
      CW.getEthBalance(hot.address).catch(() => 0),
      CW.getTokenBalance(hot.address, 'usdt').catch(() => 0),
    ]);
    res.json({ address: hot.address, eth, usdt });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Background deposit poller ─────────────────────────────────────────────
async function checkUserDeposit(user) {
  if (user.wallet_index == null) return false;
  const { address, privateKey } = CW.deriveDepositWallet(user.wallet_index);
  let credited = false;

  try {
    // Check ETH
    const ethBal = await CW.getEthBalance(address);
    const lastEth = user.last_eth_balance || 0;
    if (ethBal > lastEth + 0.0001) {
      const arrived = ethBal - lastEth;
      const ethPrice = await CW.getEthPrice();
      const usdGross = Math.round(arrived * ethPrice * 100) / 100;
      const usdFee   = Math.round(usdGross * DEPOSIT_FEE * 100) / 100;
      const usdNet   = Math.round((usdGross - usdFee) * 100) / 100;
      if (usdNet > 0.5) {
        user.balance = Math.round((user.balance + usdNet) * 100) / 100;
        user.last_eth_balance = ethBal;
        const tx = {
          id: DB.nextTxId++, user_id: user.id, user_name: user.name,
          type: 'deposit', status: 'confirmed', coin: 'eth',
          amount_usd: usdGross, fee_usd: usdFee, net_usd: usdNet,
          crypto_amount: arrived, eth_price: ethPrice,
          deposit_address: address,
          created_at: Date.now(), confirmed_at: Date.now(),
        };
        DB.transactions.push(tx);
        io.to('admin_room').emit('admin:deposit', { ...tx, user_balance: user.balance });
        credited = true;
        // Sweep to hot wallet
        CW.sweepEth(privateKey).catch(e => console.warn('[crypto] Sweep failed:', e.message));
      }
    }

    // Check USDT
    const usdtBal = await CW.getTokenBalance(address, 'usdt');
    const lastUsdt = user.last_usdt_balance || 0;
    if (usdtBal > lastUsdt + 0.5) {
      const arrived = usdtBal - lastUsdt;
      const usdFee  = Math.round(arrived * DEPOSIT_FEE * 100) / 100;
      const usdNet  = Math.round((arrived - usdFee) * 100) / 100;
      if (usdNet > 0.5) {
        user.balance = Math.round((user.balance + usdNet) * 100) / 100;
        user.last_usdt_balance = usdtBal;
        const tx = {
          id: DB.nextTxId++, user_id: user.id, user_name: user.name,
          type: 'deposit', status: 'confirmed', coin: 'usdt',
          amount_usd: arrived, fee_usd: usdFee, net_usd: usdNet,
          crypto_amount: arrived,
          deposit_address: address,
          created_at: Date.now(), confirmed_at: Date.now(),
        };
        DB.transactions.push(tx);
        io.to('admin_room').emit('admin:deposit', { ...tx, user_balance: user.balance });
        credited = true;
        CW.sweepToken(privateKey, 'usdt').catch(e => console.warn('[crypto] USDT sweep failed:', e.message));
      }
    }
  } catch (e) {
    console.warn(`[crypto] Check failed for ${user.id}:`, e.message);
  }

  if (credited) saveDB();
  return credited;
}

// Poll all users with active deposit addresses every 90 seconds
const POLL_INTERVAL = 90000;
function startDepositPoller() {
  setInterval(async () => {
    const usersWithWallet = Object.values(DB.users).filter(u => u.wallet_index != null);
    // Check in batches of 5 to avoid rate limiting
    for (let i = 0; i < usersWithWallet.length; i += 5) {
      const batch = usersWithWallet.slice(i, i + 5);
      await Promise.allSettled(batch.map(u => checkUserDeposit(u)));
      if (i + 5 < usersWithWallet.length) await new Promise(r => setTimeout(r, 2000));
    }
  }, POLL_INTERVAL);
  console.log(`[crypto] Deposit poller started (${POLL_INTERVAL/1000}s interval)`);
}

// ─────────────────────────── PAGES ───────────────────────────
const GAME_PAGES = { '/': 'index.html', '/blackjack': 'blackjack.html', '/slots': 'slots.html', '/slots-egypt': 'slots-egypt.html', '/slots-space': 'slots-space.html', '/roulette': 'roulette.html', '/mines': 'mines.html', '/dice': 'dice.html', '/profile': 'profile.html', '/crash': 'crash.html', '/plinko': 'plinko.html', '/ropecut': 'ropecut.html', '/keno': 'keno.html', '/hilo': 'hilo.html', '/wallet': 'wallet.html' };
Object.entries(GAME_PAGES).forEach(([route, file]) => {
  app.get(route, requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', file)));
});
app.get('/login', (req, res) => { if (req.isAuthenticated()) return res.redirect('/'); res.sendFile(path.join(__dirname, 'public', 'login.html')); });
app.get('/admin', (req, res) => { if (!req.isAuthenticated() || req.user.role !== 'admin') return res.redirect('/login'); res.sendFile(path.join(__dirname, 'public', 'admin.html')); });

// ─────────────────────────── SOCKET.IO ───────────────────────────
const onlinePlayers = new Set();
const rooms = {};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = ''; for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]; } while (rooms[code]);
  return code;
}
function createDeck() {
  const suits = ['♠','♥','♦','♣'], ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'], deck = [];
  for (let i = 0; i < 6; i++) for (const s of suits) for (const r of ranks) deck.push({ rank: r, suit: s });
  return shuffleDeck(deck);
}
function shuffleDeck(d) { for (let i = d.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [d[i],d[j]]=[d[j],d[i]]; } return d; }
function getCardValue(c) { if (['J','Q','K'].includes(c.rank)) return 10; if (c.rank==='A') return 11; return parseInt(c.rank); }
function calculateHand(hand) { let t=0,a=0; for (const c of hand){t+=getCardValue(c);if(c.rank==='A')a++;} while(t>21&&a>0){t-=10;a--;} return t; }

function broadcastRoom(room) {
  const pub = { phase: room.phase, round: room.round, dealer: { hand: room.dealer.hand, visibleTotal: room.dealer.hand.length>0?getCardValue(room.dealer.hand[0]):0 }, players: room.players.map(p=>({...p,isHost:p.id===room.hostId})), pot: room.pot, message: room.message, messageType: room.messageType };
  io.to(room.code).emit('roomUpdate', pub);
}

io.on('connection', (socket) => {
  const session = socket.request.session;
  const userId = session?.passport?.user;
  if (userId && DB.users[userId]) {
    onlinePlayers.add(userId);
    io.to('admin_room').emit('admin:online', onlinePlayers.size);
  }
  let currentRoom = null;

  socket.on('admin:join', () => {
    const user = userId ? DB.users[userId] : null;
    if (user?.role === 'admin') socket.join('admin_room');
  });

  socket.on('crash:join', () => {
    socket.join('crash_room');
    socket.emit('crash:state', getCrashState());
  });

  socket.on('crash:bet', ({ amount }) => {
    if (!userId || crashState.phase !== 'betting') return;
    const user = DB.users[userId];
    if (!user || amount <= 0 || amount > user.balance) return;
    user.balance = Math.round((user.balance - amount) * 100) / 100;
    saveDB();
    crashState.bets.set(userId, { amount, cashedOut: false, cashoutMult: 0, socketId: socket.id });
    socket.emit('crash:betPlaced', { amount, balance: user.balance });
  });

  socket.on('crash:cashout', () => {
    if (!userId || crashState.phase !== 'running') return;
    const bet = crashState.bets.get(userId);
    if (!bet || bet.cashedOut) return;
    const mult = getCrashMult();
    if (mult < 1) return;
    bet.cashedOut = true;
    bet.cashoutMult = mult;
    const win = Math.round(bet.amount * mult * 100) / 100;
    const user = DB.users[userId];
    if (user) {
      user.balance = Math.round((user.balance + win) * 100) / 100;
      const b = { id: DB.nextBetId++, user_id: userId, user_name: user.name, game: 'crash', wagered: bet.amount, returned: win, net: Math.round((win-bet.amount)*100)/100, created_at: Date.now() };
      DB.bets.push(b); saveDB();
      io.to('admin_room').emit('admin:bet', b);
    }
    socket.emit('crash:cashedOut', { mult, win, balance: user?.balance || 0 });
  });

  // ── BLACKJACK ──
  socket.on('createRoom', ({ name }) => {
    const code = generateCode();
    rooms[code] = { code, hostId: socket.id, phase: 'lobby', round: 1, deck: createDeck(), dealer: { hand:[] }, pot: 0, currentPlayer: 0, message: 'Welcome! Waiting for players...', messageType: '', players: [{ id: socket.id, name, chips: 1000, hand: [], bet: 0, wins: 0, losses: 0, pushes: 0, done: false, busted: false, isHost: true, ready: false }] };
    currentRoom = rooms[code];
    socket.join(code);
    socket.emit('roomCreated', { code });
    broadcastRoom(currentRoom);
  });
  socket.on('joinRoom', ({ code, name }) => {
    const room = rooms[code?.toUpperCase()];
    if (!room) { socket.emit('joinError', 'Room not found'); return; }
    if (room.phase !== 'lobby') { socket.emit('joinError', 'Game in progress'); return; }
    if (room.players.length >= 6) { socket.emit('joinError', 'Room is full'); return; }
    room.players.push({ id: socket.id, name, chips: 1000, hand: [], bet: 0, wins: 0, losses: 0, pushes: 0, done: false, busted: false, isHost: false, ready: false });
    currentRoom = room; socket.join(code.toUpperCase());
    socket.emit('roomCreated', { code: code.toUpperCase() });
    broadcastRoom(room);
  });
  socket.on('readyToggle', () => { if (!currentRoom) return; const p = currentRoom.players.find(p=>p.id===socket.id); if(p){p.ready=!p.ready; broadcastRoom(currentRoom);} });
  socket.on('startGame', () => { if (!currentRoom||currentRoom.hostId!==socket.id) return; if (currentRoom.players.filter(p=>p.ready).length===0){socket.emit('gameError','At least one player must be ready');return;} startRound(currentRoom); });
  socket.on('leaveRoom', () => { leaveCurrentRoom(socket, currentRoom); currentRoom=null; });
  socket.on('placeBet', ({ bet }) => {
    if (!currentRoom||currentRoom.phase!=='betting') return;
    const p = currentRoom.players.find(p=>p.id===socket.id);
    if (!p||p.done||bet<10||bet>p.chips) return;
    p.bet=bet; broadcastRoom(currentRoom);
  });
  socket.on('deal', () => { if (!currentRoom||currentRoom.hostId!==socket.id||currentRoom.phase!=='betting') return; const bp=currentRoom.players.filter(p=>p.chips>0&&p.bet>=10); if(!bp.length) return; currentRoom.phase='playing'; currentRoom.deck=createDeck(); currentRoom.dealer={hand:[]}; currentRoom.pot=0; currentRoom.message=''; for(const p of currentRoom.players){p.hand=[];p.done=false;p.busted=false;} dealCards(currentRoom); });
  socket.on('hit', () => handleAction(currentRoom, socket.id, 'hit'));
  socket.on('stand', () => handleAction(currentRoom, socket.id, 'stand'));
  socket.on('doubleDown', () => handleAction(currentRoom, socket.id, 'double'));
  socket.on('nextRound', () => { if (!currentRoom||currentRoom.hostId!==socket.id||currentRoom.phase!=='resolve') return; startRound(currentRoom); });
  socket.on('disconnect', () => {
    if (userId) { onlinePlayers.delete(userId); io.to('admin_room').emit('admin:online', onlinePlayers.size); }
    if (currentRoom) leaveCurrentRoom(socket, currentRoom);
    else for (const code in rooms) { const r=rooms[code]; const i=r.players.findIndex(p=>p.id===socket.id); if(i!==-1){r.players.splice(i,1);if(!r.players.length){delete rooms[code];}else{if(r.hostId===socket.id){r.hostId=r.players[0].id;r.players[0].isHost=true;}broadcastRoom(r);}break;} }
  });
});

function leaveCurrentRoom(socket, room) {
  if (!room) return;
  const code = room.code;
  room.players = room.players.filter(p => p.id !== socket.id);
  if (!room.players.length) { delete rooms[code]; }
  else { if (room.hostId === socket.id) { room.hostId = room.players[0].id; room.players[0].isHost = true; } broadcastRoom(room); }
}

function startRound(room) {
  room.phase='betting'; room.dealer={hand:[]}; room.pot=0; room.message='Place your bets!'; room.messageType=''; room.round++;
  for (const p of room.players) { if(p.chips<=0){p.hand=[];p.bet=0;p.done=true;p.busted=true;continue;} p.hand=[];p.bet=0;p.done=false;p.busted=false;p.ready=false; }
  broadcastRoom(room);
}

function dealCards(room) {
  if (room.deck.length < 20) room.deck = createDeck();
  const sp = room.players.filter(p => p.bet >= 10);
  for (const p of sp) p.hand.push(room.deck.pop());
  room.dealer.hand.push(room.deck.pop());
  for (const p of sp) p.hand.push(room.deck.pop());
  setTimeout(() => {
    room.dealer.hand.push(room.deck.pop());
    room.pot = sp.reduce((s,p)=>s+p.bet, 0);
    broadcastRoom(room);
    checkNaturalBJ(room);
  }, 800);
}

function checkNaturalBJ(room) {
  const sp = room.players.filter(p => p.bet >= 10);
  let allDone = true;
  for (const p of sp) { if (calculateHand(p.hand)===21) p.done=true; else allDone=false; }
  if (allDone) playDealer(room);
  else { room.currentPlayer = sp.findIndex(p=>!p.done); broadcastRoom(room); }
}

function handleAction(room, socketId, action) {
  if (!room||room.phase!=='playing') return;
  const sp = room.players.filter(p=>p.bet>=10);
  const idx = sp.findIndex(p=>p.id===socketId);
  if (idx===-1||idx!==room.currentPlayer) return;
  const p = sp[idx];
  if (action==='hit') {
    if (room.deck.length<20) room.deck=createDeck();
    p.hand.push(room.deck.pop()); const t=calculateHand(p.hand);
    if (t>21){p.done=true;p.busted=true;} else if(t===21) p.done=true;
  } else if (action==='stand') { p.done=true; }
  else if (action==='double') {
    if (p.chips<p.bet) return;
    p.chips-=p.bet; p.bet*=2;
    if (room.deck.length<20) room.deck=createDeck();
    p.hand.push(room.deck.pop());
    p.done=true; if(calculateHand(p.hand)>21) p.busted=true;
  }
  room.pot = room.players.reduce((s,p)=>s+p.bet, 0);
  broadcastRoom(room);
  const remaining = sp.filter(p=>!p.done);
  if (!remaining.length) setTimeout(()=>playDealer(room), 500);
  else { room.currentPlayer=sp.findIndex(p=>p.id===remaining[0].id); broadcastRoom(room); }
}

function playDealer(room) {
  room.phase='dealer'; broadcastRoom(room);
  const deal = () => {
    if (calculateHand(room.dealer.hand)<17) {
      if (room.deck.length<20) room.deck=createDeck();
      room.dealer.hand.push(room.deck.pop()); broadcastRoom(room); setTimeout(deal, 600);
    } else resolveRound(room);
  };
  setTimeout(deal, 500);
}

function resolveRound(room) {
  room.phase='resolve';
  const dt=calculateHand(room.dealer.hand), dbj=room.dealer.hand.length===2&&dt===21;
  const results=[];
  for (const p of room.players) {
    if (!p.bet) continue;
    const pt=calculateHand(p.hand), pbj=p.hand.length===2&&pt===21;
    if (p.busted||pt>21){p.losses++;results.push(`${p.name}: Bust`);}
    else if(pbj&&!dbj){p.chips+=Math.floor(p.bet*2.5);p.wins++;results.push(`${p.name}: BLACKJACK!`);}
    else if(dbj){if(pbj){p.chips+=p.bet;p.pushes++;results.push(`${p.name}: Push`);}else{p.losses++;results.push(`${p.name}: Loses`);}}
    else if(dt>21){p.chips+=p.bet*2;p.wins++;results.push(`${p.name}: Wins!`);}
    else if(pt>dt){p.chips+=p.bet*2;p.wins++;results.push(`${p.name}: Wins!`);}
    else if(pt===dt){p.chips+=p.bet;p.pushes++;results.push(`${p.name}: Push`);}
    else{p.losses++;results.push(`${p.name}: Loses`);}
    p.bet=0;
  }
  room.message=results.join(' | ');
  room.messageType=results.some(r=>r.includes('BLACKJACK'))?'blackjack':results.every(r=>r.includes('Wins')||r.includes('BLACKJACK'))?'win':results.every(r=>r.includes('Loses')||r.includes('Bust'))?'lose':results.every(r=>r.includes('Push'))?'push':'';
  room.pot=0; room.round++;
  broadcastRoom(room);
}

// ─────────────────────────── CRASH GAME ───────────────────────────
const crashState = {
  phase: 'waiting', // waiting | betting | running | crashed
  round: 0,
  crashPoint: 1.0,
  startTime: null,
  bets: new Map(),
  history: [],
};

function getCrashMult() {
  if (crashState.phase !== 'running' || !crashState.startTime) return 1.0;
  const elapsed = (Date.now() - crashState.startTime) / 1000;
  return Math.floor(Math.pow(Math.E, elapsed * 0.07) * 100) / 100;
}

function getCrashPoint() {
  const he = DB.game_rates.crash?.house_edge || 0.04;
  const r = Math.random();
  if (r < he) return 1.0;
  return Math.floor(Math.max(101, Math.floor(100 / (1 - r)) * (1 - he))) / 100;
}

function getCrashState() {
  return { phase: crashState.phase, round: crashState.round, mult: getCrashMult(), history: crashState.history.slice(-20) };
}

function runCrash() {
  crashState.round++;
  crashState.phase = 'betting';
  crashState.crashPoint = getCrashPoint();
  crashState.bets.clear();
  io.to('crash_room').emit('crash:betting', { round: crashState.round, duration: 5000 });

  setTimeout(() => {
    if (crashState.phase !== 'betting') return;
    crashState.phase = 'running';
    crashState.startTime = Date.now();
    io.to('crash_room').emit('crash:start', { round: crashState.round });

    const tick = setInterval(() => {
      const mult = getCrashMult();
      if (mult >= crashState.crashPoint) {
        clearInterval(tick);
        crashState.phase = 'crashed';
        const cp = crashState.crashPoint;
        crashState.history.unshift(cp);
        if (crashState.history.length > 50) crashState.history.pop();

        // Record losses
        crashState.bets.forEach((bet, uid) => {
          if (!bet.cashedOut) {
            const user = DB.users[uid];
            if (user) {
              const b = { id: DB.nextBetId++, user_id: uid, user_name: user.name, game: 'crash', wagered: bet.amount, returned: 0, net: -bet.amount, created_at: Date.now() };
              DB.bets.push(b);
              io.to('admin_room').emit('admin:bet', b);
            }
          }
        });
        saveDB();
        io.to('crash_room').emit('crash:bust', { mult: cp, round: crashState.round });
        setTimeout(runCrash, 4000);
      } else {
        io.to('crash_room').emit('crash:tick', { mult, round: crashState.round });
      }
    }, 100);
  }, 5000);
}

setTimeout(runCrash, 3000);

// ─────────────────────────── START ───────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Obsidian Casino running on port ${PORT}`);
  startDepositPoller();
});
