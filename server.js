const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

const pages = { '/': 'index.html', '/blackjack': 'blackjack.html', '/slots': 'slots.html', '/roulette': 'roulette.html', '/mines': 'mines.html', '/dice': 'dice.html', '/profile': 'profile.html' };
Object.entries(pages).forEach(([route, file]) => {
  app.get(route, (req, res) => res.sendFile(path.join(__dirname, 'public', file)));
});

const rooms = {};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms[code]);
  return code;
}

function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];
  for (let i = 0; i < 6; i++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ rank, suit });
      }
    }
  }
  return shuffleDeck(deck);
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
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

function broadcastState(room) {
  const publicState = {
    phase: room.phase,
    round: room.round,
    dealer: { hand: room.dealer.hand, visibleTotal: room.dealer.hand.length > 0 ? getCardValue(room.dealer.hand[0]) : 0, total: room.phase === 'resolve' ? calculateHand(room.dealer.hand) : null },
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      chips: p.chips,
      hand: p.hand,
      bet: p.bet,
      wins: p.wins,
      losses: p.losses,
      pushes: p.pushes,
      done: p.done,
      busted: p.busted,
      isHost: p.isHost,
      ready: p.ready
    })),
    pot: room.pot,
    message: room.message,
    messageType: room.messageType,
    currentPlayer: room.currentPlayer,
    isHost: false
  };
  return publicState;
}

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('createRoom', ({ name }) => {
    const code = generateCode();
    rooms[code] = {
      code,
      hostId: socket.id,
      phase: 'lobby',
      round: 1,
      deck: createDeck(),
      dealer: { hand: [] },
      pot: 0,
      currentPlayer: 0,
      message: `Welcome! Waiting for players...`,
      messageType: '',
      players: [{
        id: socket.id,
        name,
        chips: 1000,
        hand: [],
        bet: 0,
        wins: 0,
        losses: 0,
        pushes: 0,
        done: false,
        busted: false,
        isHost: true,
        ready: false
      }]
    };
    currentRoom = rooms[code];
    socket.join(code);
    socket.emit('roomCreated', { code, roomId: code });
    io.to(code).emit('roomUpdate', { ...rooms[code], players: rooms[code].players.map(p => ({ ...p, isHost: p.id === socket.id })) });
  });

  socket.on('joinRoom', ({ code, name }) => {
    const room = rooms[code?.toUpperCase()];
    if (!room) {
      socket.emit('joinError', 'Room not found');
      return;
    }
    if (room.phase !== 'lobby') {
      socket.emit('joinError', 'Game already in progress');
      return;
    }
    if (room.players.length >= 6) {
      socket.emit('joinError', 'Room is full');
      return;
    }
    room.players.push({
      id: socket.id,
      name,
      chips: 1000,
      hand: [],
      bet: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      done: false,
      busted: false,
      isHost: false,
      ready: false
    });
    currentRoom = room;
    socket.join(code);
    socket.emit('roomCreated', { code: code.toUpperCase(), roomId: code.toUpperCase() });
    io.to(code).emit('roomUpdate', { ...room, players: room.players.map(p => ({ ...p, isHost: p.id === socket.id })) });
  });

  socket.on('readyToggle', () => {
    if (!currentRoom) return;
    const player = currentRoom.players.find(p => p.id === socket.id);
    if (player) {
      player.ready = !player.ready;
      io.to(currentRoom.code).emit('roomUpdate', { ...currentRoom, players: currentRoom.players.map(p => ({ ...p, isHost: p.id === socket.id })) });
    }
  });

  socket.on('startGame', () => {
    if (!currentRoom || currentRoom.hostId !== socket.id) return;
    const readyPlayers = currentRoom.players.filter(p => p.ready);
    if (readyPlayers.length === 0) {
      socket.emit('gameError', 'At least one player must be ready');
      return;
    }
    startRound(currentRoom);
  });

  socket.on('leaveRoom', () => {
    if (!currentRoom) return;
    const code = currentRoom.code;
    currentRoom.players = currentRoom.players.filter(p => p.id !== socket.id);
    if (currentRoom.players.length === 0) {
      delete rooms[code];
    } else {
      if (currentRoom.hostId === socket.id) {
        currentRoom.hostId = currentRoom.players[0].id;
        currentRoom.players[0].isHost = true;
      }
      io.to(code).emit('roomUpdate', { ...currentRoom, players: currentRoom.players.map(p => ({ ...p, isHost: p.id === currentRoom.hostId })) });
    }
    currentRoom = null;
  });

  socket.on('placeBet', ({ bet }) => {
    if (!currentRoom || currentRoom.phase !== 'betting') return;
    const player = currentRoom.players.find(p => p.id === socket.id);
    if (!player || player.done) return;
    if (bet < 10 || bet > player.chips) return;
    player.bet = bet;
    io.to(currentRoom.code).emit('roomUpdate', { ...currentRoom, players: currentRoom.players.map(p => ({ ...p, isHost: p.id === currentRoom.hostId })) });
  });

  socket.on('deal', () => {
    if (!currentRoom || currentRoom.hostId !== socket.id) return;
    if (currentRoom.phase !== 'betting') return;
    const activePlayers = currentRoom.players.filter(p => p.chips > 0);
    const bettingPlayers = activePlayers.filter(p => p.bet >= 10);
    if (bettingPlayers.length === 0) return;

    currentRoom.phase = 'playing';
    currentRoom.deck = createDeck();
    currentRoom.dealer = { hand: [] };
    currentRoom.pot = 0;
    currentRoom.message = '';
    currentRoom.messageType = '';

    for (const player of currentRoom.players) {
      player.hand = [];
      player.done = false;
      player.busted = false;
    }

    const sortedPlayers = currentRoom.players.filter(p => p.bet >= 10);
    currentRoom.currentPlayer = 0;

    dealCards(currentRoom);
  });

  socket.on('hit', () => {
    handlePlayerAction(currentRoom, socket.id, 'hit');
  });

  socket.on('stand', () => {
    handlePlayerAction(currentRoom, socket.id, 'stand');
  });

  socket.on('doubleDown', () => {
    handlePlayerAction(currentRoom, socket.id, 'double');
  });

  socket.on('nextRound', () => {
    if (!currentRoom || currentRoom.hostId !== socket.id) return;
    if (currentRoom.phase !== 'resolve') return;
    startRound(currentRoom);
  });

  socket.on('disconnect', () => {
    if (!currentRoom) {
      for (const code in rooms) {
        const room = rooms[code];
        const playerIdx = room.players.findIndex(p => p.id === socket.id);
        if (playerIdx !== -1) {
          room.players.splice(playerIdx, 1);
          if (room.players.length === 0) {
            delete rooms[code];
          } else {
            if (room.hostId === socket.id) {
              room.hostId = room.players[0].id;
              room.players[0].isHost = true;
            }
            io.to(code).emit('roomUpdate', { ...room, players: room.players.map(p => ({ ...p, isHost: p.id === room.hostId })) });
          }
        }
      }
    } else {
      const code = currentRoom.code;
      currentRoom.players = currentRoom.players.filter(p => p.id !== socket.id);
      if (currentRoom.players.length === 0) {
        delete rooms[code];
      } else {
        if (currentRoom.hostId === socket.id) {
          currentRoom.hostId = currentRoom.players[0].id;
          currentRoom.players[0].isHost = true;
        }
        io.to(code).emit('roomUpdate', { ...currentRoom, players: currentRoom.players.map(p => ({ ...p, isHost: p.id === currentRoom.hostId })) });
      }
    }
  });
});

function startRound(room) {
  room.phase = 'betting';
  room.dealer = { hand: [] };
  room.pot = 0;
  room.message = 'Place your bets!';
  room.messageType = '';
  room.round++;

  for (const player of room.players) {
    if (player.chips <= 0) {
      player.hand = [];
      player.bet = 0;
      player.done = true;
      player.busted = true;
      continue;
    }
    player.hand = [];
    player.bet = 0;
    player.done = false;
    player.busted = false;
    player.ready = false;
  }

  io.to(room.code).emit('roomUpdate', { ...room, players: room.players.map(p => ({ ...p, isHost: p.id === room.hostId })) });
}

function dealCards(room) {
  if (room.deck.length < 20) room.deck = createDeck();

  const sortedPlayers = room.players.filter(p => p.bet >= 10);
  let cardDelay = 0;

  for (const player of sortedPlayers) {
    player.hand.push(room.deck.pop());
    cardDelay += 400;
    io.to(room.code).emit('roomUpdate', { ...room, players: room.players.map(p => ({ ...p, isHost: p.id === room.hostId })) });
  }

  setTimeout(() => {
    room.dealer.hand.push(room.deck.pop());
    io.to(room.code).emit('roomUpdate', { ...room, players: room.players.map(p => ({ ...p, isHost: p.id === room.hostId })) });
  }, cardDelay);

  setTimeout(() => {
    for (const player of sortedPlayers) {
      player.hand.push(room.deck.pop());
      cardDelay += 400;
    }
    io.to(room.code).emit('roomUpdate', { ...room, players: room.players.map(p => ({ ...p, isHost: p.id === room.hostId })) });
  }, cardDelay + 400);

  setTimeout(() => {
    room.dealer.hand.push(room.deck.pop());
    room.pot = sortedPlayers.reduce((sum, p) => sum + p.bet, 0);
    io.to(room.code).emit('roomUpdate', { ...room, players: room.players.map(p => ({ ...p, isHost: p.id === room.hostId })) });
    checkNaturalBlackjacks(room);
  }, cardDelay + 800);
}

function checkNaturalBlackjacks(room) {
  const sortedPlayers = room.players.filter(p => p.bet >= 10);
  let allDone = true;

  for (const player of sortedPlayers) {
    if (calculateHand(player.hand) === 21) {
      player.done = true;
    } else {
      allDone = false;
    }
  }

  if (allDone) {
    playDealer(room);
  } else {
    room.currentPlayer = sortedPlayers.findIndex(p => !p.done);
    io.to(room.code).emit('roomUpdate', { ...room, players: room.players.map(p => ({ ...p, isHost: p.id === room.hostId })) });
  }
}

function handlePlayerAction(room, socketId, action) {
  if (!room || room.phase !== 'playing') return;

  const sortedPlayers = room.players.filter(p => p.bet >= 10);
  const playerIdx = sortedPlayers.findIndex(p => p.id === socketId);
  if (playerIdx === -1 || playerIdx !== room.currentPlayer) return;

  const player = sortedPlayers[playerIdx];

  if (action === 'hit') {
    if (room.deck.length < 20) room.deck = createDeck();
    player.hand.push(room.deck.pop());
    const total = calculateHand(player.hand);
    if (total > 21) {
      player.done = true;
      player.busted = true;
    } else if (total === 21) {
      player.done = true;
    }
  } else if (action === 'stand') {
    player.done = true;
  } else if (action === 'double') {
    if (player.chips < player.bet) return;
    player.chips -= player.bet;
    player.bet *= 2;
    if (room.deck.length < 20) room.deck = createDeck();
    player.hand.push(room.deck.pop());
    const total = calculateHand(player.hand);
    if (total > 21) {
      player.done = true;
      player.busted = true;
    } else {
      player.done = true;
    }
  }

  room.pot = room.players.reduce((sum, p) => sum + p.bet, 0);
  io.to(room.code).emit('roomUpdate', { ...room, players: room.players.map(p => ({ ...p, isHost: p.id === room.hostId })) });

  const remaining = sortedPlayers.filter(p => !p.done);
  if (remaining.length === 0) {
    setTimeout(() => playDealer(room), 500);
  } else {
    room.currentPlayer = sortedPlayers.findIndex(p => p.id === remaining[0].id);
    io.to(room.code).emit('roomUpdate', { ...room, players: room.players.map(p => ({ ...p, isHost: p.id === room.hostId })) });
  }
}

function playDealer(room) {
  room.phase = 'dealer';
  io.to(room.code).emit('roomUpdate', { ...room, players: room.players.map(p => ({ ...p, isHost: p.id === room.hostId })) });

  const dealerPlay = () => {
    if (calculateHand(room.dealer.hand) < 17) {
      if (room.deck.length < 20) room.deck = createDeck();
      room.dealer.hand.push(room.deck.pop());
      io.to(room.code).emit('roomUpdate', { ...room, players: room.players.map(p => ({ ...p, isHost: p.id === room.hostId })) });
      setTimeout(dealerPlay, 600);
    } else {
      resolveRound(room);
    }
  };

  setTimeout(dealerPlay, 500);
}

function resolveRound(room) {
  room.phase = 'resolve';
  const dealerTotal = calculateHand(room.dealer.hand);
  const dealerBJ = room.dealer.hand.length === 2 && dealerTotal === 21;

  const results = [];

  for (const player of room.players) {
    if (player.bet === 0) continue;
    const playerTotal = calculateHand(player.hand);
    const playerBJ = player.hand.length === 2 && playerTotal === 21;

    if (player.busted || playerTotal > 21) {
      player.losses++;
      results.push(`${player.name}: Bust`);
    } else if (playerBJ && !dealerBJ) {
      const winnings = Math.floor(player.bet * 2.5);
      player.chips += winnings;
      player.wins++;
      results.push(`${player.name}: BLACKJACK!`);
    } else if (dealerBJ) {
      if (playerBJ) {
        player.chips += player.bet;
        player.pushes++;
        results.push(`${player.name}: Push`);
      } else {
        player.losses++;
        results.push(`${player.name}: Loses`);
      }
    } else if (dealerTotal > 21) {
      player.chips += player.bet * 2;
      player.wins++;
      results.push(`${player.name}: Wins!`);
    } else if (playerTotal > dealerTotal) {
      player.chips += player.bet * 2;
      player.wins++;
      results.push(`${player.name}: Wins!`);
    } else if (playerTotal === dealerTotal) {
      player.chips += player.bet;
      player.pushes++;
      results.push(`${player.name}: Push`);
    } else {
      player.losses++;
      results.push(`${player.name}: Loses`);
    }

    player.bet = 0;
  }

  room.message = results.join(' | ');
  room.messageType = results.some(r => r.includes('BLACKJACK')) ? 'blackjack'
    : results.every(r => r.includes('Wins') || r.includes('BLACKJACK')) ? 'win'
    : results.every(r => r.includes('Loses') || r.includes('Bust')) ? 'lose'
    : results.every(r => r.includes('Push')) ? 'push' : '';

  room.pot = 0;
  room.round++;
  io.to(room.code).emit('roomUpdate', { ...room, players: room.players.map(p => ({ ...p, isHost: p.id === room.hostId })) });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
