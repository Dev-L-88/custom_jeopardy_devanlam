const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  transports: ['websocket']
});

// --- MIDDLEWARE & ENGINE CONFIGURATION ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// In-memory runtime cache object to manage live interactive game sessions
let activeGames = {}; 

function sendUpdatedPlayerData(roomCode) {
  if (activeGames[roomCode]) {
    io.to(roomCode).emit('playerDataUpdate', activeGames[roomCode].players);
  }
}

// --- APP PAGE ROUTING ENGINE ---
app.get('/', (req, res) => {
  // FIXED: No longer reading dead server files. Simply rendering the page!
  res.render('index'); 
});

app.get('/creator', (req, res) => {
  res.render('creator');
});

app.get('/host/:roomCode', (req, res) => {
  res.render('host', { roomCode: req.params.roomCode });
});

app.get('/join/:roomCode', (req, res) => {
  res.render('player', { roomCode: req.params.roomCode });
});

app.get('/board/:roomCode', (req, res) => {
  res.render('board', { roomCode: req.params.roomCode });
});

// --- REST API SYSTEM ENDPOINTS ---
app.post('/api/create-room', (req, res) => {
  const roomCode = 'JEP-' + Math.floor(1000 + Math.random() * 9000);
  
  // Accept the complete custom board payload straight from the host's browser window
  const selectedBoard = req.body.boardData || { title: "Sample Default Edition", categories: [] };

  activeGames[roomCode] = {
    boardData: selectedBoard, 
    buzzQueue: [],
    players: []
  };
  
  res.json({ roomCode });
});

app.get('/api/get-room-board/:roomCode', (req, res) => {
  const game = activeGames[req.params.roomCode];
  if (game && game.boardData) {
    res.json({ success: true, boardData: game.boardData });
  } else {
    res.status(404).json({ success: false, message: "Active board configuration not found." });
  }
});

// --- SOCKET.IO REAL-TIME INTERACTION ENGINE ---
io.on('connection', (socket) => {
  console.log(`Connection established pipeline index handle: ${socket.id}`);

  socket.on('joinRoom', ({ roomCode, username }) => {
    if (!activeGames[roomCode]) {
      return socket.emit('errorMsg', 'This game lobby does not exist.');
    }

    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.username = username;

    if (username !== "GAME_BOARD_DISPLAY" && username !== "HOST_CONSOLE") {
      const alreadyExists = activeGames[roomCode].players.find(p => p.username === username);
      if (!alreadyExists) {
        activeGames[roomCode].players.push({
          id: socket.id,
          username: username,
          score: 0 
        });
      }
    }

    sendUpdatedPlayerData(roomCode);
  });

  socket.on('playerBuzz', ({ roomCode, username }) => {
    const game = activeGames[roomCode];
    if (game) {
      const alreadyBuzzed = game.buzzQueue.includes(username);
      
      if (!alreadyBuzzed) {
        game.buzzQueue.push(username); 
        io.to(roomCode).emit('buzzerLocked', game.buzzQueue);
      }
    }
  });

  socket.on('resetBuzzer', (roomCode) => {
    const game = activeGames[roomCode];
    if (game) {
      game.buzzQueue = []; 
      io.to(roomCode).emit('buzzerResetSignal');
    }
  });

  socket.on('disconnect', () => {
    const roomCode = socket.roomCode;
    const username = socket.username;
    
    if (roomCode && activeGames[roomCode]) {
      activeGames[roomCode].players = activeGames[roomCode].players.filter(p => p.id !== socket.id);
      
      if (username) {
        activeGames[roomCode].buzzQueue = activeGames[roomCode].buzzQueue.filter(name => name !== username);
        io.to(roomCode).emit('buzzerLocked', activeGames[roomCode].buzzQueue);
      }
      
      sendUpdatedPlayerData(roomCode);
    }
    console.log(`Socket interface down link disconnected safely: ${socket.id}`);
  });

  socket.on('updatePlayerScore', ({ roomCode, playerId, changeAmount }) => {
    const game = activeGames[roomCode];
    if (game) {
      const player = game.players.find(p => p.id === playerId);
      if (player) {
        player.score = (player.score ?? 0) + changeAmount;
        sendUpdatedPlayerData(roomCode);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Jeopardy Application Service active across network pipelines! http://localhost:${PORT}\n`);
});