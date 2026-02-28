const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// serve static assets
app.use(express.static('public'));

const words = ["سيارة","بحر","كتاب","قهوة","نملة","قلم","تفاحة","شمس","قمر","نحلة"];
const rooms = {}; // roomId -> { name, players: { socketId: {name, ready, playAgain} }, game: {word, fakeId} | null }

function updateRoomList() {
  const list = Object.entries(rooms).map(([id, r]) => ({ id, name: r.name, count: Object.keys(r.players).length }));
  io.emit('roomList', list);
}

function updateRoom(roomId) {
  const r = rooms[roomId];
  if (!r) return;
  const players = Object.entries(r.players).map(([id, p]) => ({ id, name: p.name, ready: p.ready, playAgain: p.playAgain }));
  io.to(roomId).emit('roomData', { players, gameStarted: !!r.game });
}

function startGame(roomId) {
  const r = rooms[roomId];
  if (!r) return;
  const word = words[Math.floor(Math.random() * words.length)];
  const playerIds = Object.keys(r.players);
  const fake = playerIds[Math.floor(Math.random() * playerIds.length)];
  r.game = { word, fake };
  playerIds.forEach(pid => {
    const isFake = pid === fake;
    io.to(pid).emit('gameStart', { word: isFake ? null : word, isFake });
  });
}

function checkStart(roomId) {
  const r = rooms[roomId];
  if (!r || r.game) return;
  const total = Object.keys(r.players).length;
  const readyCount = Object.values(r.players).filter(p => p.ready).length;
  if (total >= 4 && readyCount === total) {
    startGame(roomId);
  }
}

function checkPlayAgain(roomId) {
  const r = rooms[roomId];
  if (!r || !r.game) return;
  const total = Object.keys(r.players).length;
  const playAgainCount = Object.values(r.players).filter(p => p.playAgain).length;
  if (playAgainCount === total && total > 0) {
    // reset states and allow new round
    Object.values(r.players).forEach(p => { p.ready = false; p.playAgain = false; });
    r.game = null;
    updateRoom(roomId);
  }
}

io.on('connection', socket => {
  console.log('user connected', socket.id);

  socket.on('createRoom', ({ roomName, playerName }) => {
    if (!roomName || !playerName) return;
    let roomId = Math.random().toString(36).substr(2, 4);
    while (rooms[roomId]) roomId = Math.random().toString(36).substr(2, 4);
    rooms[roomId] = { name: roomName, players: {}, game: null };
    socket.join(roomId);
    rooms[roomId].players[socket.id] = { name: playerName, ready: false, playAgain: false };
    updateRoomList();
    updateRoom(roomId);
    socket.emit('joinedRoom', { roomId, roomName });
  });

  socket.on('joinRoom', ({ roomId, playerName }) => {
    const r = rooms[roomId];
    if (!r || !playerName) return;
    socket.join(roomId);
    r.players[socket.id] = { name: playerName, ready: false, playAgain: false };
    updateRoomList();
    updateRoom(roomId);
    socket.emit('joinedRoom', { roomId, roomName: r.name });
  });

  socket.on('toggleReady', () => {
    const roomId = Object.keys(socket.rooms).find(r => r !== socket.id);
    if (!roomId) return;
    const player = rooms[roomId].players[socket.id];
    if (!player) return;
    player.ready = !player.ready;
    updateRoom(roomId);
    checkStart(roomId);
  });

  socket.on('playAgain', () => {
    const roomId = Object.keys(socket.rooms).find(r => r !== socket.id);
    if (!roomId) return;
    const player = rooms[roomId].players[socket.id];
    if (!player || !rooms[roomId].game) return;
    player.playAgain = true;
    updateRoom(roomId);
    checkPlayAgain(roomId);
  });

  socket.on('disconnect', () => {
    console.log('disconnect', socket.id);
    for (const roomId in rooms) {
      if (rooms[roomId].players[socket.id]) {
        delete rooms[roomId].players[socket.id];
        socket.leave(roomId);
        if (Object.keys(rooms[roomId].players).length === 0) {
          delete rooms[roomId];
          updateRoomList();
        } else {
          updateRoom(roomId);
          updateRoomList();
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));
