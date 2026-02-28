const socket = io();
let currentRoom = null;
let myName = null;
let gameInProgress = false;
let isOwner = false;

socket.on('connect', () => {
  // socket.id is available after connect
});

socket.on('roomList', list => {
  const div = document.getElementById('roomsList');
  div.innerHTML = '';
  list.forEach(r => {
    const el = document.createElement('div');
    el.className = 'room';
    el.innerHTML = `${r.name}<br><small>${r.count} لاعب</small>`;
    el.onclick = () => joinPrompt(r.id);
    div.appendChild(el);
  });
});

socket.on('joinedRoom', info => {
  currentRoom = info.roomId;
  document.getElementById('roomTitle').innerText = info.roomName;
  document.getElementById('lobby').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
});

socket.on('roomData', data => {
  const div = document.getElementById('players');
  div.innerHTML = '';
  data.players.forEach(p => {
    const d = document.createElement('div');
    d.innerText = p.name + (p.ready ? ' ✅' : ' ❌');
    div.appendChild(d);
  });
  // determine owner
  isOwner = data.owner === socket.id;
  document.getElementById('settingsBtn').style.display = isOwner && !gameInProgress ? 'inline-block' : 'none';
});

socket.on('gameStart', info => {
  gameInProgress = true;
  const wEl = document.getElementById('wordDisplay');
  const cEl = document.getElementById('countdown');
  document.getElementById('readyBtn').classList.add('hidden');
  cEl.classList.remove('hidden');
  let sec = 5;
  cEl.innerText = sec;
  const timer = setInterval(() => {
    sec--;
    cEl.innerText = sec;
    if (sec === 0) {
      clearInterval(timer);
      cEl.classList.add('hidden');
      wEl.classList.remove('hidden');
      if (info.isFake) {
        wEl.innerText = 'برا السالفة';
      } else {
        wEl.innerText = info.word;
      }
      document.getElementById('playAgainBtn').classList.remove('hidden');
    }
  }, 1000);
});

function createRoom() {
  const roomName = document.getElementById('roomName').value.trim();
  const playerName = document.getElementById('playerName').value.trim();
  if (!roomName || !playerName) return alert('الرجاء إدخال اسم الغرفة واسمك');
  myName = playerName;
  socket.emit('createRoom', { roomName, playerName });
}

function joinPrompt(roomId) {
  const name = prompt('اسمك؟');
  if (!name) return;
  myName = name;
  socket.emit('joinRoom', { roomId, playerName: name });
}

function toggleReady() {
  socket.emit('toggleReady');
}

function playAgain() {
  socket.emit('playAgain');
  document.getElementById('playAgainBtn').classList.add('hidden');
}

function showSettings() {
  const words = prompt('أدخل الكلمات مفصولة بفاصلة (،)', '');
  if (words === null) return;
  const arr = words.split('،').map(w=>w.trim()).filter(w=>w);
  socket.emit('updateWords', arr);
}

function leaveRoom() {
  location.reload();
}
