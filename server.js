const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
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

// --- PERMANENT MEMORY STORAGE MANAGEMENT ---
const STORAGE_DIR = process.env.RENDER ? '/data' : __dirname;
const BOARDS_FILE = path.join(STORAGE_DIR, 'boards.json');


let activeGames = {}; 

function getSavedBoards() {
  try {
    // Ensure the data directory exists
    if (process.env.RENDER && !fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    if (!fs.existsSync(BOARDS_FILE)) {
      fs.writeFileSync(BOARDS_FILE, JSON.stringify({}));
    }
    const data = fs.readFileSync(BOARDS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading boards file, defaulting to empty database:", err);
    return {};
  }
}

function saveBoardsToDisk(boards) {
  try {
    fs.writeFileSync(BOARDS_FILE, JSON.stringify(boards, null, 2));
  } catch (err) {
    console.error("Error writing boards payload data directly down to local disk storage:", err);
  }
}

function sendUpdatedPlayerData(roomCode) {
  if (activeGames[roomCode]) {
    io.to(roomCode).emit('playerDataUpdate', activeGames[roomCode].players);
  }
}

// --- APP PAGE ROUTING ENGINE ---
app.get('/', (req, res) => {
  const currentBoards = getSavedBoards();
  res.render('index', { boards: currentBoards }); 
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
  const boards = getSavedBoards();
  const selectedBoard = boards[req.body.boardId] || { title: "Sample Default Edition", categories: [] };

  activeGames[roomCode] = {
    boardData: selectedBoard, 
    buzzQueue: [],
    players: []
  };
  res.json({ roomCode });
});

app.post('/api/save-board', (req, res) => {
  const { title, categories } = req.body;
  const boardId = title.toLowerCase().replace(/\s+/g, '-');
  
  const boards = getSavedBoards();
  boards[boardId] = { id: boardId, title, categories };
  
  saveBoardsToDisk(boards); 
  res.json({ success: true, boardId });
});

app.get('/api/get-board/:boardId', (req, res) => {
  const boards = getSavedBoards();
  const board = boards[req.params.boardId];
  
  if (board) {
    res.json({ success: true, board });
  } else {
    res.status(404).json({ success: false, message: "Board profile query mismatch." });
  }
});

app.get('/api/get-room-board/:roomCode', (req, res) => {
  const game = activeGames[req.params.roomCode];
  if (game && game.boardData) {
    res.json({ success: true, boardData: game.boardData });
  } else {
    res.status(404).json({ success: false, message: "Active board configuration not found." });
  }
});

app.delete('/api/delete-board/:boardId', (req, res) => {
  try {
    const boardId = req.params.boardId;
    const boards = getSavedBoards();

    if (boards[boardId]) {
      delete boards[boardId];
      saveBoardsToDisk(boards);
      res.json({ success: true, message: "Board dropped successfully." });
    } else {
      res.status(404).json({ success: false, message: "Board file match not found on disk." });
    }
  } catch (err) {
    console.error("Backend failed processing board profile entry drop action:", err);
    res.status(500).json({ success: false, message: "Server encountered a block executing resource wipe." });
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
      // 1. Remove player from score rosters
      activeGames[roomCode].players = activeGames[roomCode].players.filter(p => p.id !== socket.id);
      
      // 2. FIXED: Wipe their handle out of the queue array if they were holding a buzzer slot
      if (username) {
        activeGames[roomCode].buzzQueue = activeGames[roomCode].buzzQueue.filter(name => name !== username);
        // Alert host and remaining players of the adjusted queue ordering
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