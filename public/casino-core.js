const Casino = (() => {
  const KEY = 'obsidianCasino_v2';

  const ICONS = {
    home: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L2 12h3v9h6v-5h2v5h6v-9h3L12 3z"/></svg>`,
    cards: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="5" width="13" height="17" rx="2"/><path d="M7 9h3M7 13h2"/><path d="M9 3h11a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-2"/></svg>`,
    slots: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="20"/><rect x="4" y="9" width="3" height="6" rx="1" fill="currentColor" stroke="none"/><rect x="10.5" y="9" width="3" height="6" rx="1" fill="currentColor" stroke="none"/><rect x="17" y="9" width="3" height="6" rx="1" fill="currentColor" stroke="none"/></svg>`,
    roulette: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="22"/><line x1="2" y1="12" x2="8" y2="12"/><line x1="16" y1="12" x2="22" y2="12"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>`,
    dice: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="16" cy="8" r="1.2" fill="currentColor"/><circle cx="8" cy="16" r="1.2" fill="currentColor"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>`,
    mines: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="2" x2="12" y2="7"/><line x1="12" y1="17" x2="12" y2="22"/><line x1="2" y1="12" x2="7" y2="12"/><line x1="17" y1="12" x2="22" y2="12"/><line x1="4.9" y1="4.9" x2="8.3" y2="8.3"/><line x1="15.7" y1="15.7" x2="19.1" y2="19.1"/><line x1="19.1" y1="4.9" x2="15.7" y2="8.3"/><line x1="8.3" y1="15.7" x2="4.9" y2="19.1"/></svg>`,
    crash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 20L10 10l4 4 3-6 4 2"/><path d="M20 8l-3 2-1-3"/></svg>`,
    plinko: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="3" r="2"/><circle cx="7" cy="9" r="1.8"/><circle cx="17" cy="9" r="1.8"/><circle cx="4" cy="15" r="1.5"/><circle cx="12" cy="15" r="1.5"/><circle cx="20" cy="15" r="1.5"/></svg>`,
    profile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"/></svg>`,
    chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>`,
    coin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5c0-1.4 1.3-2.5 3-2.5s3 1.1 3 2.5c0 1.4-1.3 2.5-3 2.5s-3 1.1-3 2.5 1.3 2.5 3 2.5 3-1.1 3-2.5" stroke-linecap="round"/></svg>`,
    trophy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 2h12v6a6 6 0 0 1-12 0V2z"/><path d="M6 4H3a2 2 0 0 0 0 4c.7 0 2-.5 3-2"/><path d="M18 4h3a2 2 0 0 1 0 4c-.7 0-2-.5-3-2"/><line x1="12" y1="14" x2="12" y2="18"/><rect x="8" y="18" width="8" height="3" rx="1"/></svg>`,
    logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  };

  const SLOT_SYMBOLS = [
    {
      id: 'wild', label: 'WILD', color: '#a855f7', weight: 1, p3: 200,
      svg: `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="wg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#e879f9"/><stop offset="100%" stop-color="#6d28d9"/></radialGradient></defs><rect width="60" height="60" rx="8" fill="url(#wg)"/><text x="30" y="22" font-size="11" font-weight="900" fill="white" text-anchor="middle" font-family="Inter,sans-serif" letter-spacing="1">WILD</text><polygon points="30,28 33,36 41,36 35,41 37,49 30,44 23,49 25,41 19,36 27,36" fill="gold" stroke="#fff" stroke-width="0.5"/></svg>`
    },
    {
      id: 'ace', label: 'ACE', color: '#ffd700', weight: 2, p3: 100,
      svg: `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="50" height="50" rx="6" fill="white"/><text x="10" y="22" font-size="14" font-weight="900" fill="#111" font-family="Georgia,serif">A</text><text x="30" y="38" font-size="20" text-anchor="middle" dominant-baseline="middle" fill="#111" font-family="Georgia,serif">♠</text><text x="50" y="52" font-size="14" font-weight="900" fill="#111" font-family="Georgia,serif" transform="rotate(180 50 52)">A</text></svg>`
    },
    {
      id: 'skull', label: 'SKULL', color: '#94a3b8', weight: 3, p3: 50,
      svg: `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="30" cy="26" rx="16" ry="17" fill="#e2e8f0"/><rect x="18" y="40" width="24" height="9" rx="2" fill="#e2e8f0"/><circle cx="22" cy="26" r="5.5" fill="#1e293b"/><circle cx="38" cy="26" r="5.5" fill="#1e293b"/><circle cx="22" cy="26" r="2" fill="#60a5fa"/><circle cx="38" cy="26" r="2" fill="#60a5fa"/><rect x="20" y="43" width="5" height="5" rx="1" fill="#1e293b"/><rect x="28" y="43" width="5" height="5" rx="1" fill="#1e293b"/><rect x="36" y="43" width="5" height="5" rx="1" fill="#1e293b"/><path d="M28 40v3M32 40v3" stroke="#1e293b" stroke-width="2"/></svg>`
    },
    {
      id: 'gem', label: 'GEM', color: '#22d3ee', weight: 4, p3: 30,
      svg: `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#22d3ee"/><stop offset="1" stop-color="#6366f1"/></linearGradient></defs><polygon points="30,6 50,22 43,52 17,52 10,22" fill="url(#gg)"/><polygon points="30,6 50,22 30,20" fill="rgba(255,255,255,0.35)"/><line x1="10" y1="22" x2="50" y2="22" stroke="rgba(255,255,255,0.25)" stroke-width="1"/><line x1="17" y1="52" x2="30" y2="20" stroke="rgba(255,255,255,0.15)" stroke-width="1"/></svg>`
    },
    {
      id: 'flame', label: 'FLAME', color: '#f97316', weight: 5, p3: 20,
      svg: `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="fg" x1="0.5" y1="0" x2="0.5" y2="1"><stop stop-color="#fde68a"/><stop offset="0.4" stop-color="#f97316"/><stop offset="1" stop-color="#dc2626"/></linearGradient></defs><path d="M30 54c-12 0-20-9-20-20 0-7 4-12 7-16 1 7 4 9 5 9-2-5 1-13 9-22 1 9 5 13 7 13-1-4 0-8 4-11 1 5 3 9 2 14 3-3 4-6 3-10 5 5 9 12 9 21 0 11-8 22-26 22z" fill="url(#fg)"/><ellipse cx="30" cy="43" rx="7" ry="5" fill="#fde68a" opacity="0.6"/></svg>`
    },
    {
      id: 'lightning', label: 'BOLT', color: '#facc15', weight: 6, p3: 15,
      svg: `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fef08a"/><stop offset="1" stop-color="#ca8a04"/></linearGradient></defs><path d="M36 5L18 32h14L21 55 44 24H30L36 5z" fill="url(#lg)" stroke="rgba(255,255,255,0.3)" stroke-width="0.5"/></svg>`
    },
    {
      id: 'crown', label: 'CROWN', color: '#ffd700', weight: 7, p3: 10,
      svg: `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fef3c7"/><stop offset="1" stop-color="#b45309"/></linearGradient></defs><path d="M8 42h44l-7-22L30 30 15 20 8 42z" fill="url(#cg)"/><rect x="8" y="42" width="44" height="7" rx="2" fill="#b45309"/><circle cx="8" cy="20" r="4" fill="#fbbf24"/><circle cx="30" cy="30" r="4" fill="#fbbf24"/><circle cx="52" cy="20" r="4" fill="#fbbf24"/><circle cx="8" cy="20" r="2" fill="white"/><circle cx="30" cy="30" r="2" fill="white"/><circle cx="52" cy="20" r="2" fill="white"/></svg>`
    },
    {
      id: 'shield', label: 'SHIELD', color: '#3b82f6', weight: 8, p3: 7,
      svg: `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#60a5fa"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient></defs><path d="M30 6L8 14v16c0 14 10 22 22 24 12-2 22-10 22-24V14L30 6z" fill="url(#sg)"/><path d="M30 6L30 54" stroke="rgba(255,255,255,0.2)" stroke-width="1"/><path d="M8 20h44" stroke="rgba(255,255,255,0.2)" stroke-width="1"/></svg>`
    },
    {
      id: 'coin', label: 'COIN', color: '#fbbf24', weight: 10, p3: 5,
      svg: `<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="30" r="22" fill="#92400e"/><circle cx="30" cy="30" r="19" fill="#fbbf24"/><circle cx="30" cy="30" r="15" fill="#f59e0b" stroke="#d97706" stroke-width="1"/><text x="30" y="35" font-size="18" font-weight="900" text-anchor="middle" fill="#78350f" font-family="Georgia,serif">$</text></svg>`
    },
  ];

  function defaults() {
    return {
      name: 'Player',
      balance: 0,
      stats: {
        blackjack: { played: 0, won: 0, wagered: 0, returned: 0 },
        slots: { played: 0, won: 0, wagered: 0, returned: 0 },
        roulette: { played: 0, won: 0, wagered: 0, returned: 0 },
        mines: { played: 0, won: 0, wagered: 0, returned: 0 },
        dice: { played: 0, won: 0, wagered: 0, returned: 0 },
        crash: { played: 0, won: 0, wagered: 0, returned: 0 },
        plinko:  { played: 0, won: 0, wagered: 0, returned: 0 },
        ropecut: { played: 0, won: 0, wagered: 0, returned: 0 },
        keno:    { played: 0, won: 0, wagered: 0, returned: 0 },
        hilo:    { played: 0, won: 0, wagered: 0, returned: 0 },
      },
      history: [],
      createdAt: Date.now()
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const s = JSON.parse(raw), d = defaults();
      return { ...d, ...s, stats: Object.keys(d.stats).reduce((acc, k) => ({ ...acc, [k]: { ...d.stats[k], ...(s.stats?.[k] || {}) } }), {}) };
    } catch { return defaults(); }
  }

  function save(p) { localStorage.setItem(KEY, JSON.stringify(p)); }

  function getProfile() { return load(); }
  function getBalance() { return load().balance; }
  function getName() { return load().name; }

  function setName(name) {
    const p = load();
    p.name = name.trim().substring(0, 20) || 'Player';
    save(p);
  }

  // Server-authoritative bet: calls /api/bet, updates localStorage stats/history
  async function recordBet(game, wagered, returned) {
    // Update local stats/history (not balance — server owns balance)
    const p = load();
    if (p.stats[game]) {
      p.stats[game].played++;
      p.stats[game].wagered += wagered;
      p.stats[game].returned += returned;
      if (returned > wagered) p.stats[game].won++;
    }
    p.history = [{ game, wagered, returned, net: returned - wagered, ts: Date.now() }, ...p.history].slice(0, 100);
    save(p);

    try {
      const r = await fetch('/api/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game, wagered, returned })
      });
      if (r.ok) {
        const d = await r.json();
        syncBalance(d.balance);
        return d.balance;
      }
    } catch {}
    return p.balance;
  }

  // Sync local balance display from server value
  function syncBalance(bal) {
    const p = load();
    p.balance = bal;
    save(p);
    const el = document.getElementById('balanceDisplay');
    if (el) el.textContent = fmt(bal);
  }

  // Auth check: redirects to /login if not authenticated
  function requireAuth() {
    fetch('/api/me').then(r => {
      if (!r.ok) { window.location.href = '/login'; return; }
      r.json().then(d => {
        // Sync name + balance from server
        const p = load();
        p.name = d.name;
        p.balance = d.balance;
        save(p);
        const el = document.getElementById('balanceDisplay');
        if (el) el.textContent = fmt(d.balance);
        const av = document.querySelector('.header-avatar span');
        if (av) av.textContent = d.name[0].toUpperCase();
      });
    }).catch(() => { window.location.href = '/login'; });
  }

  async function refill() {
    try {
      const r = await fetch('/api/refill', { method: 'POST' });
      if (r.ok) {
        const d = await r.json();
        syncBalance(d.balance);
        return d.balance;
      }
      const err = await r.json().catch(() => ({}));
      alert(err.error || 'Cannot refill right now');
    } catch { alert('Cannot refill right now'); }
    return load().balance;
  }

  function fmt(n) {
    const abs = Math.abs(Math.round(n));
    if (abs >= 1000) return (n < 0 ? '-' : '') + '$' + (abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 2) + 'K';
    return (n < 0 ? '-$' : '$') + abs.toLocaleString();
  }

  function renderSidebar(activePage) {
    const p = load();
    const nav = [
      { id: 'home', label: 'Lobby', href: '/', icon: ICONS.home },
      { id: 'blackjack', label: 'Blackjack', href: '/blackjack', icon: ICONS.cards },
      { id: 'slots', label: 'Slots', href: '/slots', icon: ICONS.slots },
      { id: 'roulette', label: 'Roulette', href: '/roulette', icon: ICONS.roulette },
      { id: 'mines', label: 'Mines', href: '/mines', icon: ICONS.mines },
      { id: 'dice', label: 'Dice', href: '/dice', icon: ICONS.dice },
      { id: 'crash', label: 'Crash', href: '/crash', icon: ICONS.crash },
      { id: 'plinko', label: 'Plinko', href: '/plinko', icon: ICONS.plinko },
      { id: 'ropecut', label: 'Rope Cut', href: '/ropecut', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 3C6 3 8 8 12 8C16 8 18 3 18 3"/><path d="M12 8v13"/><path d="M8 14l4 4 4-4"/></svg>` },
      { id: 'keno', label: 'Keno', href: '/keno', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><text x="12" y="16" font-size="10" text-anchor="middle" fill="currentColor" stroke="none" font-weight="900">K</text></svg>` },
      { id: 'hilo', label: 'HiLo', href: '/hilo', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="5" width="8" height="11" rx="1.5"/><text x="7" y="13" font-size="7" text-anchor="middle" fill="currentColor" stroke="none" font-weight="900">A</text><rect x="13" y="8" width="8" height="11" rx="1.5"/><text x="17" y="16" font-size="7" text-anchor="middle" fill="currentColor" stroke="none" font-weight="900">K</text></svg>` },
      { id: 'slots-egypt', label: 'Egypt Slots', href: '/slots-egypt', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><polygon points="12,3 21,20 3,20"/><line x1="12" y1="3" x2="12" y2="20" opacity="0.4"/></svg>` },
      { id: 'slots-space', label: 'Space Slots', href: '/slots-space', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-20 12 12)"/></svg>` },
    ];

    const html = `
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-logo">
          <a href="/" class="logo-link">
            <div class="logo-mark">
              <svg viewBox="0 0 32 32" fill="none"><polygon points="16,2 30,10 30,22 16,30 2,22 2,10" fill="#00c74d" opacity="0.15"/><polygon points="16,2 30,10 30,22 16,30 2,22 2,10" fill="none" stroke="#00c74d" stroke-width="1.5"/><path d="M10 16l4 4 8-8" stroke="#00c74d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <span class="logo-text">OBSIDIAN</span>
          </a>
        </div>
        <nav class="sidebar-nav">
          <div class="nav-section-label">GAMES</div>
          ${nav.map(item => `
            <a href="${item.href}" class="nav-item ${activePage === item.id ? 'active' : ''}">
              <span class="nav-icon">${item.icon}</span>
              <span class="nav-label">${item.label}</span>
            </a>
          `).join('')}
        </nav>
        <div class="sidebar-bottom">
          <a href="/wallet" class="nav-item ${activePage === 'wallet' ? 'active' : ''}">
            <span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 12h2M2 10h20"/><path d="M6 6V4a1 1 0 011-1h10a1 1 0 011 1v2"/></svg></span>
            <span class="nav-label">Wallet</span>
          </a>
          <a href="/profile" class="nav-item ${activePage === 'profile' ? 'active' : ''}">
            <span class="nav-icon">${ICONS.profile}</span>
            <span class="nav-label">Profile</span>
          </a>
          <a href="/auth/logout" class="nav-item" style="color:#f1323f">
            <span class="nav-icon">${ICONS.logout}</span>
            <span class="nav-label">Sign Out</span>
          </a>
        </div>
      </aside>
      <div class="sidebar-overlay" onclick="toggleSidebar()"></div>`;

    const header = `
      <header class="casino-header">
        <button class="menu-toggle" onclick="toggleSidebar()" aria-label="Menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <div class="header-game-name">${nav.find(n => n.id === activePage)?.label || 'Casino'}</div>
        <div class="header-right">
          <div class="header-balance" id="headerBalance">
            <span class="balance-icon">${ICONS.coin}</span>
            <span id="balanceDisplay">${fmt(p.balance)}</span>
          </div>
          <a href="/profile" class="header-avatar" title="${p.name}">
            <span>${p.name[0].toUpperCase()}</span>
          </a>
        </div>
      </header>`;

    document.body.insertAdjacentHTML('afterbegin', html + header);
  }

  function updateBalance() {
    const el = document.getElementById('balanceDisplay');
    if (el) el.textContent = fmt(load().balance);
  }

  function toggleSidebar() {
    document.getElementById('sidebar')?.classList.toggle('open');
    document.querySelector('.sidebar-overlay')?.classList.toggle('show');
  }

  function timeAgo(ts) {
    const d = Date.now() - ts;
    if (d < 60000) return 'just now';
    if (d < 3600000) return Math.floor(d / 60000) + 'm ago';
    if (d < 86400000) return Math.floor(d / 3600000) + 'h ago';
    return Math.floor(d / 86400000) + 'd ago';
  }

  return { getProfile, getBalance, getName, setName, recordBet, refill, fmt, renderSidebar, updateBalance, syncBalance, toggleSidebar, timeAgo, requireAuth, ICONS, SLOT_SYMBOLS };
})();

window.Casino = Casino;
window.toggleSidebar = Casino.toggleSidebar;
