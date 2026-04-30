let players = [];
let currentPlayerIndex = 0;
let dealer = { hand: [], chips: 0 };
let deck = [];
let round = 1;
let gamePhase = 'setup';
let scoreboardOpen = false;

const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
  deck = [];
  for (let i = 0; i < 6; i++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ rank, suit });
      }
    }
  }
  shuffleDeck();
}

function shuffleDeck() {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function getCardValue(card) {
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  if (card.rank === 'A') return 11;
  return parseInt(card.rank);
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

function addPlayer() {
  const nameInput = document.getElementById('playerNameInput');
  const name = nameInput.value.trim();
  if (name && players.length < 6) {
    players.push({
      name,
      chips: 1000,
      hand: [],
      bet: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      done: false
    });
    nameInput.value = '';
    nameInput.focus();
    updatePlayersList();
    document.getElementById('startGameBtn').disabled = false;
    document.getElementById('playerCount').textContent = `${players.length} player${players.length > 1 ? 's' : ''} at table`;
  }
}

function removePlayer(index) {
  players.splice(index, 1);
  updatePlayersList();
  document.getElementById('startGameBtn').disabled = players.length === 0;
  document.getElementById('playerCount').textContent = players.length === 0 
    ? 'Add 1-6 players to begin' 
    : `${players.length} player${players.length > 1 ? 's' : ''} at table`;
}

function updatePlayersList() {
  const list = document.getElementById('playersList');
  list.innerHTML = players.map((p, i) =>
    `<div class="player-tag">
      ${p.name}
      <span class="remove" onclick="removePlayer(${i})">×</span>
    </div>`
  ).join('');
}

document.getElementById('playerNameInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addPlayer();
});

function startGame() {
  if (players.length === 0) return;
  createDeck();
  document.getElementById('setupScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'block';
  gamePhase = 'betting';
  currentPlayerIndex = 0;
  round = 1;
  updateGameUI();
}

function updateGameUI() {
  const player = players[currentPlayerIndex];
  document.getElementById('roundNumber').textContent = round;
  document.getElementById('activePlayerName').textContent = player.name;
  document.getElementById('playerChips').textContent = `$${player.chips}`;
  document.getElementById('betAmount').textContent = `Bet: $${player.bet}`;
  updatePlayerTabs();
  updateScoreboard();
  updatePot();
}

function updatePot() {
  const totalPot = players.reduce((sum, p) => sum + p.bet, 0);
  document.getElementById('potAmount').textContent = `$${totalPot}`;
}

function updatePlayerTabs() {
  const tabs = document.getElementById('playerTabs');
  tabs.innerHTML = players.map((p, i) =>
    `<div class="player-tab ${i === currentPlayerIndex ? 'active' : ''} ${p.done ? 'done' : ''}">
      ${p.name}
    </div>`
  ).join('');
}

function updateScoreboard() {
  const body = document.getElementById('scoreboardBody');
  body.innerHTML = players.map(p =>
    `<tr>
      <td>${p.name}</td>
      <td class="chips-cell">$${p.chips}</td>
      <td>${p.wins}</td>
      <td>${p.losses}</td>
      <td>${p.pushes}</td>
    </tr>`
  ).join('');
}

function toggleScoreboard() {
  scoreboardOpen = !scoreboardOpen;
  document.getElementById('scoreboard').classList.toggle('show', scoreboardOpen);
}

function adjustBet(amount) {
  const betInput = document.getElementById('betInput');
  const player = players[currentPlayerIndex];
  let newBet = parseInt(betInput.value) + amount;
  newBet = Math.max(10, Math.min(newBet, player.chips));
  betInput.value = newBet;
}

function setBet(amount) {
  const player = players[currentPlayerIndex];
  const betInput = document.getElementById('betInput');
  betInput.value = Math.min(amount, player.chips);
}

function deal() {
  const betInput = document.getElementById('betInput');
  const bet = parseInt(betInput.value);
  const player = players[currentPlayerIndex];

  if (bet < 10 || bet > player.chips) {
    showMessage('Invalid bet!', 'lose');
    return;
  }

  player.bet = bet;
  player.chips -= bet;
  player.hand = [];

  if (deck.length < 20) createDeck();

  document.getElementById('bettingPanel').style.display = 'none';
  document.getElementById('actionPanel').style.display = 'flex';
  document.getElementById('messageContent').textContent = '';
  document.getElementById('messageContent').className = 'message-content';

  setTimeout(() => {
    dealCardToHand('player');
  }, 100);
  
  setTimeout(() => {
    if (!dealer.hand.length) dealer.hand.push(drawCard());
    updateRenderHands();
  }, 300);
  
  setTimeout(() => {
    dealCardToHand('player');
    updateGameUI();
  }, 500);
  
  setTimeout(() => {
    dealer.hand.push(drawCard());
    updateRenderHands();
    const total = calculateHand(player.hand);
    if (total === 21) {
      setTimeout(() => stand(), 600);
    }
  }, 700);
  
  setTimeout(() => {
    document.getElementById('doubleBtn').disabled = player.hand.length !== 2 || player.chips < player.bet;
  }, 800);
}

function dealCardToHand(handType) {
  const player = players[currentPlayerIndex];
  player.hand.push(drawCard());
  updateRenderHands();
}

function drawCard() {
  return deck.pop();
}

function hit() {
  const player = players[currentPlayerIndex];
  
  document.querySelectorAll('.action-btn').forEach(btn => btn.disabled = true);
  
  player.hand.push(drawCard());
  updateRenderHands();

  const total = calculateHand(player.hand);
  
  setTimeout(() => {
    if (total > 21) {
      player.done = true;
      showMessage(`${player.name} busts!`, 'lose');
      setTimeout(() => finishPlayerTurn(), 1000);
    } else if (total === 21) {
      setTimeout(() => stand(), 500);
    } else {
      document.querySelectorAll('.action-btn').forEach(btn => btn.disabled = false);
      document.getElementById('doubleBtn').disabled = true;
    }
  }, 400);
}

function stand() {
  const player = players[currentPlayerIndex];
  
  document.querySelectorAll('.action-btn').forEach(btn => btn.disabled = true);
  player.done = true;
  
  setTimeout(() => finishPlayerTurn(), 500);
}

function doubleDown() {
  const player = players[currentPlayerIndex];
  if (player.chips < player.bet) {
    showMessage('Not enough chips!', 'lose');
    return;
  }

  player.chips -= player.bet;
  player.bet *= 2;
  
  document.querySelectorAll('.action-btn').forEach(btn => btn.disabled = true);
  
  player.hand.push(drawCard());
  updateRenderHands();
  updateGameUI();

  const total = calculateHand(player.hand);
  
  setTimeout(() => {
    if (total > 21) {
      player.done = true;
      showMessage(`${player.name} busts!`, 'lose');
    } else {
      player.done = true;
    }
    setTimeout(() => finishPlayerTurn(), 800);
  }, 500);
}

function finishPlayerTurn() {
  const allDone = players.every(p => p.done);
  if (allDone) {
    setTimeout(() => playDealer(), 600);
  } else {
    let nextIndex = (currentPlayerIndex + 1) % players.length;
    while (players[nextIndex].done) {
      nextIndex = (nextIndex + 1) % players.length;
    }
    currentPlayerIndex = nextIndex;

    gamePhase = 'betting';
    document.getElementById('bettingPanel').style.display = 'block';
    document.getElementById('actionPanel').style.display = 'none';

    const nextPlayer = players[currentPlayerIndex];
    const betInput = document.getElementById('betInput');
    betInput.value = Math.min(parseInt(betInput.value) || 100, nextPlayer.chips);

    updateRenderHands(true);
    updateGameUI();
  }
}

function playDealer() {
  gamePhase = 'dealer';
  
  document.getElementById('actionPanel').style.display = 'none';
  
  while (dealer.hand.length < 2) {
    dealer.hand.push(drawCard());
  }
  
  updateRenderHands();
  
  setTimeout(() => dealerPlay(), 800);
}

function dealerPlay() {
  const dealerTotal = calculateHand(dealer.hand);
  
  if (dealerTotal < 17) {
    dealer.hand.push(drawCard());
    updateRenderHands();
    
    setTimeout(() => dealerPlay(), 600);
  } else {
    setTimeout(() => resolveBets(), 600);
  }
}

function resolveBets() {
  const dealerTotal = calculateHand(dealer.hand);
  const dealerBlackjack = dealer.hand.length === 2 && dealerTotal === 21;

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    if (player.bet === 0) continue;

    const playerTotal = calculateHand(player.hand);
    const playerBlackjack = player.hand.length === 2 && playerTotal === 21;

    if (playerTotal > 21) {
      player.losses++;
    } else if (playerBlackjack && !dealerBlackjack) {
      player.chips += Math.floor(player.bet * 2.5);
      player.wins++;
    } else if (dealerBlackjack) {
      if (playerBlackjack) {
        player.chips += player.bet;
        player.pushes++;
      } else {
        player.losses++;
      }
    } else if (dealerTotal > 21) {
      player.chips += player.bet * 2;
      player.wins++;
    } else if (playerTotal > dealerTotal) {
      player.chips += player.bet * 2;
      player.wins++;
    } else if (playerTotal === dealerTotal) {
      player.chips += player.bet;
      player.pushes++;
    } else {
      player.losses++;
    }

    player.bet = 0;
    player.done = false;
    player.hand = [];
  }

  currentPlayerIndex = 0;
  round++;
  gamePhase = 'roundEnd';

  updateRenderHands();
  updateGameUI();
  showMessageArea();
  document.getElementById('endPanel').style.display = 'block';
}

function showMessageArea() {
  const dealerTotal = calculateHand(dealer.hand);
  const results = [];

  for (const player of players) {
    const playerTotal = calculateHand(player.hand);
    const playerBlackjack = player.hand.length === 2 && playerTotal === 21;
    const dealerBlackjack = dealer.hand.length === 2 && dealerTotal === 21;

    if (playerTotal > 21) {
      results.push(`${player.name}: Bust 💥`);
    } else if (playerBlackjack && dealerTotal !== 21) {
      results.push(`${player.name}: BLACKJACK! 🎉`);
    } else if (dealerTotal > 21) {
      results.push(`${player.name}: Wins! ✨`);
    } else if (playerTotal > dealerTotal) {
      results.push(`${player.name}: Wins! ✨`);
    } else if (playerTotal === dealerTotal) {
      results.push(`${player.name}: Push 🤝`);
    } else {
      results.push(`${player.name}: Loses`);
    }
  }

  const messageContent = document.getElementById('messageContent');
  messageContent.textContent = results.join(' | ');

  if (results.some(r => r.includes('BLACKJACK'))) {
    messageContent.className = 'message-content blackjack';
  } else if (results.every(r => r.includes('Wins') || r.includes('BLACKJACK'))) {
    messageContent.className = 'message-content win';
  } else if (results.every(r => r.includes('Loses') || r.includes('Bust'))) {
    messageContent.className = 'message-content lose';
  } else if (results.every(r => r.includes('Push'))) {
    messageContent.className = 'message-content push';
  } else {
    messageContent.className = 'message-content';
  }
}

function showMessage(text, type) {
  const messageContent = document.getElementById('messageContent');
  messageContent.textContent = text;
  messageContent.className = `message-content ${type}`;
}

function nextRound() {
  document.getElementById('endPanel').style.display = 'none';
  document.getElementById('messageContent').textContent = '';
  document.getElementById('messageContent').className = 'message-content';
  dealer.hand = [];

  const activePlayers = players.filter(p => p.chips > 0);
  if (activePlayers.length === 0) {
    alert('All players are out of chips! Game over.');
    location.reload();
    return;
  }

  gamePhase = 'betting';
  currentPlayerIndex = 0;
  document.getElementById('bettingPanel').style.display = 'block';
  updateRenderHands(true);
  updateGameUI();
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

function updateRenderHands(hideDealer = false) {
  const dealerHand = document.getElementById('dealerHand');
  const playerHand = document.getElementById('playerHand');
  const dealerValue = document.getElementById('dealerValue');
  const playerValue = document.getElementById('playerValue');

  if (dealer.hand.length > 0) {
    const showAll = gamePhase === 'roundEnd' || gamePhase === 'dealer';
    dealerHand.innerHTML = dealer.hand.map((card, i) =>
      renderCard(card, !showAll && i === 1)
    ).join('');

    if (showAll) {
      const total = calculateHand(dealer.hand);
      dealerValue.innerHTML = total === 21 && dealer.hand.length === 2 
        ? '<span class="hand-value">BLACKJACK!</span>' 
        : `<span class="hand-value">${total}</span>`;
    } else {
      dealerValue.innerHTML = `<span class="hand-value">${getCardValue(dealer.hand[0])}</span>`;
    }
  } else {
    dealerHand.innerHTML = '';
    dealerValue.innerHTML = '';
  }

  const player = players[currentPlayerIndex];
  if (player && player.hand.length > 0) {
    playerHand.innerHTML = player.hand.map(card => renderCard(card)).join('');
    const total = calculateHand(player.hand);
    playerValue.innerHTML = total === 21 && player.hand.length === 2
      ? '<span class="hand-value">BLACKJACK!</span>'
      : `<span class="hand-value">${total}</span>`;
  } else {
    playerHand.innerHTML = '';
    playerValue.innerHTML = '';
  }
}
