const socket = io();
let myId = null;
let myName = '';
let roomCode = '';
let gameState = null;
let scoreboardOpen = false;

socket.on('connect', () => {
  myId = socket.id;
});

function showTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if (tab === 'create') {
    document.querySelector('.tab:first-child').classList.add('active');
    document.getElementById('createTab').style.display = 'block';
    document.getElementById('joinTab').style.display = 'none';
  } else {
    document.querySelector('.tab:last-child').classList.add('active');
    document.getElementById('createTab').style.display = 'none';
    document.getElementById('joinTab').style.display = 'block';
  }
}

function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function createRoom() {
  const name = document.getElementById('createName').value.trim();
  if (!name) { showError('Enter your name'); return; }
  myName = name;
  socket.emit('createRoom', { name });
}

function joinRoom() {
  const name = document.getElementById('joinName').value.trim();
  const code = document.getElementById('joinCode').value.trim().toUpperCase();
  if (!name) { showError('Enter your name'); return; }
  if (!code || code.length < 4) { showError('Enter a valid room code'); return; }
  myName = name;
  socket.emit('joinRoom', { name, code });
}

socket.on('roomCreated', ({ code }) => {
  roomCode = code;
  document.getElementById('setupScreen').style.display = 'none';
  document.getElementById('lobbyScreen').style.display = 'flex';
  document.getElementById('roomCode').textContent = code;
  document.getElementById('errorMsg').style.display = 'none';
});

socket.on('joinError', (msg) => {
  showError(msg);
});

socket.on('roomUpdate', (state) => {
  gameState = state;
  if (state.phase === 'lobby') {
    showLobby(state);
  } else {
    document.getElementById('lobbyScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    renderGame(state);
  }
});

socket.on('gameError', (msg) => {
  showError(msg);
});

function showLobby(state) {
  document.getElementById('lobbyScreen').style.display = 'flex';
  document.getElementById('gameScreen').style.display = 'none';

  const playersEl = document.getElementById('lobbyPlayers');
  playersEl.innerHTML = state.players.map(p =>
    `<div class="lobby-player ${p.ready ? 'ready' : ''}">
      <span class="lobby-player-name ${p.isHost ? 'lobby-host' : ''}">${p.name}</span>
      <span class="lobby-player-chips">$${p.chips}</span>
    </div>`
  ).join('');

  const me = state.players.find(p => p.id === myId);
  const readyBtn = document.getElementById('readyBtn');
  const startBtn = document.getElementById('startBtn');

  readyBtn.classList.toggle('ready', me && me.ready);
  readyBtn.textContent = me && me.ready ? 'NOT READY' : "I'M READY";
  startBtn.style.display = me && me.isHost ? 'block' : 'none';
}

function toggleReady() {
  socket.emit('readyToggle');
}

function startGame() {
  socket.emit('startGame');
}

function leaveRoom() {
  socket.emit('leaveRoom');
  document.getElementById('lobbyScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'none';
  document.getElementById('setupScreen').style.display = 'flex';
  roomCode = '';
  gameState = null;
}

function copyCode() {
  navigator.clipboard.writeText(roomCode);
  const el = document.getElementById('roomCode');
  const original = el.textContent;
  el.textContent = 'COPIED!';
  setTimeout(() => { el.textContent = original; }, 1000);
}

function renderGame(state) {
  document.getElementById('roundNumber').textContent = state.round;
  document.getElementById('potAmount').textContent = `$${state.pot}`;
  document.getElementById('gameRoomCode').textContent = roomCode;

  const me = state.players.find(p => p.id === myId);
  if (me) {
    document.getElementById('activePlayerName').textContent = me.name;
    document.getElementById('playerChips').textContent = `$${me.chips}`;
    document.getElementById('betAmount').textContent = `Bet: $${me.bet}`;

    if (me.hand.length > 0) {
      document.getElementById('playerHand').innerHTML = me.hand.map(card => renderCard(card)).join('');
      const total = calculateHand(me.hand);
      document.getElementById('playerValue').innerHTML = total === 21 && me.hand.length === 2
        ? '<span class="hand-value">BLACKJACK!</span>'
        : `<span class="hand-value">${total}</span>`;
    } else {
      document.getElementById('playerHand').innerHTML = '';
      document.getElementById('playerValue').innerHTML = '';
    }
  }

  if (state.dealer.hand.length > 0) {
    const showAll = state.phase === 'resolve';
    document.getElementById('dealerHand').innerHTML = state.dealer.hand.map((card, i) =>
      renderCard(card, !showAll && i === 1)
    ).join('');

    if (showAll) {
      const total = calculateHand(state.dealer.hand);
      document.getElementById('dealerValue').innerHTML = total === 21 && state.dealer.hand.length === 2
        ? '<span class="hand-value">BLACKJACK!</span>'
        : `<span class="hand-value">${total}</span>`;
    } else {
      document.getElementById('dealerValue').innerHTML = `<span class="hand-value">${state.dealer.visibleTotal}</span>`;
    }
  } else {
    document.getElementById('dealerHand').innerHTML = '';
    document.getElementById('dealerValue').innerHTML = '';
  }

  const otherPlayers = document.getElementById('otherPlayers');
  otherPlayers.innerHTML = state.players.filter(p => p.id !== myId && p.bet > 0).map(p =>
    `<div class="other-player">
      <div class="other-player-name">${p.name}</div>
      <div class="hand">
        ${p.hand.map(card => renderCard(card)).join('')}
      </div>
      ${p.hand.length > 0 ? `<div class="hand-value">${calculateHand(p.hand)}</div>` : ''}
    </div>`
  ).join('');

  if (state.message) {
    document.getElementById('messageContent').textContent = state.message;
    document.getElementById('messageContent').className = `message-content ${state.messageType || ''}`;
  }

  updatePlayerTabs(state, me);
  updateControls(state, me);
  updateScoreboard(state);
}

function updatePlayerTabs(state, me) {
  const tabs = document.getElementById('playerTabs');
  const sortedPlayers = state.players.filter(p => p.bet >= 10);
  const currentPlaying = sortedPlayers.find(p => !p.done);
  tabs.innerHTML = state.players.map(p =>
    `<div class="player-tab ${p.id === myId ? 'active' : ''} ${currentPlaying && currentPlaying.id === p.id ? 'active' : ''} ${p.done ? 'done' : ''}">
      ${p.name} ${p.id === myId ? '(You)' : ''}
    </div>`
  ).join('');
}

function updateControls(state, me) {
  const bettingPanel = document.getElementById('bettingPanel');
  const actionPanel = document.getElementById('actionPanel');
  const endPanel = document.getElementById('endPanel');
  const betInput = document.getElementById('betInput');
  const betRow = document.querySelector('.bet-row');
  const chipsTray = document.querySelector('.chips-tray');
  const dealBtn = document.getElementById('dealBtn');

  bettingPanel.style.display = 'none';
  actionPanel.style.display = 'none';
  endPanel.style.display = 'none';

  if (state.phase === 'betting') {
    bettingPanel.style.display = 'block';
    const hasDealt = state.players.some(p => p.hand.length > 0);

    if (!me || me.chips <= 0) {
      bettingPanel.querySelector('.panel-title').textContent = 'No chips remaining';
      betRow.style.display = 'none';
      chipsTray.style.display = 'none';
      dealBtn.style.display = 'none';
      return;
    }

    bettingPanel.querySelector('.panel-title').textContent = 'Place Your Bet';
    betRow.style.display = 'flex';
    chipsTray.style.display = 'flex';

    if (me.bet > 0) {
      bettingPanel.querySelector('.panel-title').textContent = `Bet placed ($${me.bet})`;
    }

    if (me.isHost && !hasDealt) {
      dealBtn.style.display = 'block';
    } else {
      dealBtn.style.display = 'none';
    }
  } else if (state.phase === 'playing') {
    const sortedPlayers = state.players.filter(p => p.bet >= 10);
    const currentPlayer = sortedPlayers.find(p => !p.done);

    if (currentPlayer && currentPlayer.id === myId) {
      actionPanel.style.display = 'flex';
      document.getElementById('doubleBtn').disabled = me.hand.length !== 2 || me.chips < me.bet;
    } else {
      bettingPanel.style.display = 'block';
      betRow.style.display = 'none';
      chipsTray.style.display = 'none';
      dealBtn.style.display = 'none';
      bettingPanel.querySelector('.panel-title').textContent = `${currentPlayer ? currentPlayer.name : '...'} is playing...`;
    }
  } else if (state.phase === 'dealer') {
    bettingPanel.style.display = 'block';
    betRow.style.display = 'none';
    chipsTray.style.display = 'none';
    dealBtn.style.display = 'none';
    bettingPanel.querySelector('.panel-title').textContent = 'Dealer is playing...';
  } else if (state.phase === 'resolve') {
    endPanel.style.display = 'block';
    if (!me || !me.isHost) {
      document.getElementById('nextRoundBtn').disabled = true;
    }
  }
}

function adjustBet(amount) {
  const betInput = document.getElementById('betInput');
  const me = gameState.players.find(p => p.id === myId);
  if (!me) return;
  let newBet = parseInt(betInput.value) + amount;
  newBet = Math.max(10, Math.min(newBet, me.chips));
  betInput.value = newBet;
  socket.emit('placeBet', { bet: newBet });
}

function setBet(amount) {
  const me = gameState.players.find(p => p.id === myId);
  if (!me) return;
  const betInput = document.getElementById('betInput');
  const bet = Math.min(amount, me.chips);
  betInput.value = bet;
  socket.emit('placeBet', { bet });
}

function deal() {
  const betInput = document.getElementById('betInput');
  const me = gameState.players.find(p => p.id === myId);
  if (!me) return;
  if (me.bet < 10) {
    const bet = parseInt(betInput.value);
    if (bet >= 10 && bet <= me.chips) {
      socket.emit('placeBet', { bet });
    } else {
      return;
    }
  }
  setTimeout(() => socket.emit('deal'), 300);
}

function hit() {
  socket.emit('hit');
}

function stand() {
  socket.emit('stand');
}

function doubleDown() {
  socket.emit('doubleDown');
}

function nextRound() {
  socket.emit('nextRound');
}

function toggleScoreboard() {
  scoreboardOpen = !scoreboardOpen;
  document.getElementById('scoreboard').classList.toggle('show', scoreboardOpen);
}

function updateScoreboard(state) {
  const body = document.getElementById('scoreboardBody');
  body.innerHTML = state.players.map(p =>
    `<tr>
      <td>${p.name} ${p.id === myId ? '(You)' : ''}</td>
      <td class="chips-cell">$${p.chips}</td>
      <td>${p.wins}</td>
      <td>${p.losses}</td>
      <td>${p.pushes}</td>
    </tr>`
  ).join('');
}

function calculateHand(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    total += getCardValue(card);
    if (card.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function getCardValue(card) {
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  if (card.rank === 'A') return 11;
  return parseInt(card.rank);
}

function renderCard(card, hidden = false) {
  if (hidden) {
    return `<div class="card hidden-card"><div class="card-face"></div></div>`;
  }
  const isRed = card.suit === '♥' || card.suit === '♦';
  return `<div class="card ${isRed ? 'red' : 'black'}">
    <div class="card-face">
      <span class="rank-corner">${card.rank}</span>
      <span class="suit-corner">${card.suit}</span>
      <span class="rank-center">${card.rank}</span>
      <span class="suit-center">${card.suit}</span>
    </div>
  </div>`;
}
