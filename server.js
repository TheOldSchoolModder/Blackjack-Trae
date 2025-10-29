import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'fs';

// Initialize environment variables
dotenv.config();

// Create Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json());
// Removed static file serving - frontend is served separately

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/blackjack';
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    // Continue running even if MongoDB connection fails
    console.log('Running without MongoDB for development purposes');
  });

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Helper functions
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });
};

// In-memory storage with persistence
const DATA_FILE = path.join(__dirname, 'data.json');

// Load data from file if it exists
let inMemoryUsers = [];
let nextUserId = 1;
let inMemoryGameRooms = [];
let nextRoomId = 1;
let inMemoryChatMessages = [];
let nextMessageId = 1;
let inMemoryUserStats = [];
let activeSessions = new Map(); // Track active sessions: userId -> { token, socketId, loginTime }

// Initialize user stats structure
const initializeUserStats = (userId) => {
  return {
    user_id: userId,
    total_blackjacks: 0,
    total_wins: 0,
    total_losses: 0,
    total_pushes: 0,
    total_busts: 0,
    total_side_bets_won: 0,
    total_side_bets_lost: 0,
    total_money_won: 0,
    total_money_lost: 0,
    rounds_played: 0,
    created_at: new Date(),
    updated_at: new Date()
  };
};

// Update user stats function
const updateUserStats = (userId, statsUpdate) => {
  let userStats = inMemoryUserStats.find(stats => stats.user_id === userId);
  if (!userStats) {
    userStats = initializeUserStats(userId);
    inMemoryUserStats.push(userStats);
  }
  
  // Update stats
  Object.keys(statsUpdate).forEach(key => {
    if (userStats.hasOwnProperty(key)) {
      userStats[key] += statsUpdate[key];
    }
  });
  
  userStats.updated_at = new Date();
  saveData();
  
  console.log(`Updated stats for user ${userId}:`, statsUpdate);
};

// Load persisted data
const loadData = () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      inMemoryUsers = data.users || [];
      nextUserId = data.nextUserId || 1;
      inMemoryGameRooms = data.gameRooms || [];
      nextRoomId = data.nextRoomId || 1;
      inMemoryChatMessages = data.chatMessages || [];
      nextMessageId = data.nextMessageId || 1;
      inMemoryUserStats = data.userStats || [];
      console.log(`Loaded ${inMemoryUsers.length} users and ${inMemoryUserStats.length} user stats from persistent storage`);
    }
  } catch (error) {
    console.error('Error loading data:', error);
  }
};

// Save data to file
const saveData = () => {
  try {
    const data = {
      users: inMemoryUsers,
      nextUserId,
      gameRooms: inMemoryGameRooms,
      nextRoomId,
      chatMessages: inMemoryChatMessages,
      nextMessageId,
      userStats: inMemoryUserStats
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving data:', error);
  }
};

// Load data on startup
loadData();

// Save data periodically (every 30 seconds)
setInterval(saveData, 30000);

// Auth routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, username } = req.body;
    
    // Check if user already exists in memory
    const existingUser = inMemoryUsers.find(u => u.email === email || u.username === username);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new user in memory
    const userId = nextUserId++;
    const user = {
      _id: userId,
      username,
      email,
      password: hashedPassword,
      balance: 1000
    };
    
    inMemoryUsers.push(user);
    
    // Initialize user stats
    const userStats = initializeUserStats(userId);
    inMemoryUserStats.push(userStats);
    
    // Save data after user registration
    saveData();
    
    // Generate token
    const token = generateToken(userId);
    
    console.log('User registered:', username);
    
    res.status(201).json({
      token,
      user: {
        id: userId,
        username: user.username,
        email: user.email,
        balance: user.balance
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, checkExistingSession } = req.body;
    
    // If this is just a session check, handle it differently
    if (checkExistingSession) {
      const token = req.headers['x-auth-token'];
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }
      
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = parseInt(decoded.id);
      
      console.log(`Session check for user ${decoded.username} (ID: ${userId})`);
      
      // Check for existing session
      const existingSession = activeSessions.get(userId);
      console.log(`Existing session found: ${existingSession ? 'YES' : 'NO'}`);
      
      if (existingSession) {
        console.log(`Existing session details:`, {
          socketId: existingSession.socketId,
          loginTime: existingSession.loginTime
        });
        
        // Find the existing socket
        const existingSocket = io.sockets.sockets.get(existingSession.socketId);
        console.log(`Existing socket found: ${existingSocket ? 'YES' : 'NO'}`);
        
        if (existingSocket) {
          console.log(`Logging out existing session for user ${decoded.username}`);
          existingSocket.emit('force_logout', { 
            reason: 'New login detected from another device',
            newLoginTime: new Date().toISOString()
          });
          existingSocket.disconnect(true);
        }
      }
      
      // Update the session with current socket (will be updated when socket connects)
       activeSessions.set(userId, {
         userId: userId,
         username: decoded.username,
         loginTime: new Date(),
         socketId: null // Will be updated when socket connects
       });
      
      return res.json({ success: true });
    }
    
    // Original login logic for initial authentication
    // Find user in memory
    const user = inMemoryUsers.find(u => u.email === email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Check if user already has an active session
    const existingSession = activeSessions.get(user._id);
    console.log(`Login attempt for user ${user.username} (ID: ${user._id})`);
    console.log(`Existing session found:`, existingSession ? 'YES' : 'NO');
    
    if (existingSession) {
      console.log(`Existing session details:`, {
        hasSocketId: !!existingSession.socketId,
        socketId: existingSession.socketId,
        loginTime: existingSession.loginTime
      });
      
      // Notify the existing session that it's being logged out
      const existingSocket = io.sockets.sockets.get(existingSession.socketId);
      console.log(`Found existing socket:`, !!existingSocket);
      
      if (existingSocket) {
        console.log(`Emitting force_logout to socket ${existingSession.socketId}`);
        existingSocket.emit('force_logout', { 
          reason: 'New login detected from another device',
          newLoginTime: new Date().toISOString()
        });
        existingSocket.disconnect(true);
        console.log(`Disconnected existing socket ${existingSession.socketId}`);
      }
      console.log(`Logging out existing session for user ${user.username} due to new login`);
    }
    
    // Generate new token
    const token = generateToken(user._id);
    
    // Store new session (socketId will be updated when socket connects)
    activeSessions.set(user._id, {
      token,
      socketId: null,
      loginTime: new Date().toISOString(),
      userAgent: req.headers['user-agent'] || 'Unknown'
    });
    
    console.log('User logged in:', user.username);
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        balance: user.balance
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/user', async (req, res) => {
  try {
    const token = req.header('x-auth-token');
    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = inMemoryUsers.find(u => u._id === decoded.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Don't send password
    const { password, ...userWithoutPassword } = user;
    
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Game routes
app.post('/api/game/create-room', async (req, res) => {
  try {
    const { userId } = req.body;
    
    // Generate room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Create game room in memory
    const roomId = nextRoomId++;
    const gameRoom = {
      _id: roomId,
      room_code: roomCode,
      host_id: userId,
      game_state: {
        status: 'betting',
        players: {},
        dealer: { cards: [], score: 0 },
        roundCounter: 1
      },
      created_at: new Date()
    };
    
    inMemoryGameRooms.push(gameRoom);
    
    // Save data after room creation
    saveData();
    
    console.log(`Room created: ${roomCode} by user ${userId}`);
    
    res.status(201).json({ roomCode });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/game/join-room/:roomCode', async (req, res) => {
  try {
    const { roomCode } = req.params;
    
    // Find game room in memory
    const gameRoom = inMemoryGameRooms.find(room => room.room_code === roomCode);
    if (!gameRoom) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    console.log(`User joining room: ${roomCode}`);
    res.json({ roomId: gameRoom._id });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Chat routes
app.get('/api/chat/:roomCode', async (req, res) => {
  try {
    const { roomCode } = req.params;
    
    // Find chat messages for room
    const messages = inMemoryChatMessages
      .filter(msg => msg.room_code === roomCode)
      .sort((a, b) => a.created_at - b.created_at);
    
    res.json(messages);
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Leaderboard route
app.get('/api/leaderboard', async (req, res) => {
  try {
    // Get all users with their stats
    const leaderboard = inMemoryUsers.map(user => {
      const { password, ...userWithoutPassword } = user;
      
      // Find user stats or create default if not exists
      let userStats = inMemoryUserStats.find(stats => stats.user_id === user._id);
      if (!userStats) {
        userStats = initializeUserStats(user._id);
        inMemoryUserStats.push(userStats);
        saveData();
      }
      
      return {
        ...userWithoutPassword,
        stats: {
          total_blackjacks: userStats.total_blackjacks,
          total_wins: userStats.total_wins,
          total_losses: userStats.total_losses,
          total_pushes: userStats.total_pushes,
          total_busts: userStats.total_busts,
          total_side_bets_won: userStats.total_side_bets_won,
          total_side_bets_lost: userStats.total_side_bets_lost,
          total_money_won: userStats.total_money_won,
          total_money_lost: userStats.total_money_lost,
          rounds_played: userStats.rounds_played,
          net_profit: userStats.total_money_won - userStats.total_money_lost
        }
      };
    }).sort((a, b) => b.balance - a.balance); // Sort by balance (most money)
    
    res.json(leaderboard);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add password reset endpoint
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Find user in memory
    const user = inMemoryUsers.find(u => u.email === email);
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }
    
    // In a real app, you would send an email with a reset token
    // For now, we'll just log it
    console.log(`Password reset requested for user: ${user.username} (${user.email})`);
    
    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Track game statistics endpoint
app.post('/api/game/track-stats', async (req, res) => {
  try {
    const { userId, gameResults } = req.body;
    
    if (!userId || !gameResults) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Find user
    const user = inMemoryUsers.find(u => u._id === userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Process game results and update stats
    const statsUpdate = {
      rounds_played: 1,
      total_blackjacks: 0,
      total_wins: 0,
      total_losses: 0,
      total_pushes: 0,
      total_busts: 0,
      total_side_bets_won: 0,
      total_side_bets_lost: 0,
      total_money_won: 0,
      total_money_lost: 0
    };
    
    // Process main hand results
    if (gameResults.mainHandResults && Array.isArray(gameResults.mainHandResults)) {
      gameResults.mainHandResults.forEach(result => {
        if (result.text === 'Blackjack!') {
          statsUpdate.total_blackjacks += 1;
          statsUpdate.total_wins += 1;
        } else if (result.text === 'Win') {
          statsUpdate.total_wins += 1;
        } else if (result.text === 'Lose') {
          statsUpdate.total_losses += 1;
        } else if (result.text === 'Push') {
          statsUpdate.total_pushes += 1;
        } else if (result.text === 'Bust') {
          statsUpdate.total_busts += 1;
          statsUpdate.total_losses += 1;
        }
        
        // Track money won/lost
        if (result.amount > 0) {
          statsUpdate.total_money_won += result.amount;
        } else if (result.amount < 0) {
          statsUpdate.total_money_lost += Math.abs(result.amount);
        }
      });
    }
    
    // Process side bet results
    if (gameResults.sideBetResults && Array.isArray(gameResults.sideBetResults)) {
      gameResults.sideBetResults.forEach(result => {
        if (result.amount > 0) {
          statsUpdate.total_side_bets_won += 1;
          statsUpdate.total_money_won += result.amount;
        } else if (result.amount < 0) {
          statsUpdate.total_side_bets_lost += 1;
          statsUpdate.total_money_lost += Math.abs(result.amount);
        }
      });
    }
    
    // Update user stats
    updateUserStats(userId, statsUpdate);
    
    res.json({ message: 'Stats updated successfully', statsUpdate });
  } catch (error) {
    console.error('Track stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add logout endpoint (for token invalidation in real apps)
app.post('/api/auth/logout', async (req, res) => {
  try {
    // In a real app with token blacklisting, you would invalidate the token here
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile
app.put('/api/users/update-profile', async (req, res) => {
  try {
    const token = req.header('x-auth-token');
    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const userIndex = inMemoryUsers.findIndex(u => u._id === decoded.id);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update user data
    const updates = req.body;
    inMemoryUsers[userIndex] = { ...inMemoryUsers[userIndex], ...updates };
    
    console.log(`Profile updated for user ${inMemoryUsers[userIndex].username}:`, updates);
    
    // Return updated user data (without password)
    const { password, ...userWithoutPassword } = inMemoryUsers[userIndex];
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout endpoint
app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = req.header('x-auth-token');
    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }

    // Verify token and get user ID
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = parseInt(decoded.id); // Convert to number to match database format

    // Remove the session
    const session = activeSessions.get(userId);
    if (session) {
      // Disconnect the socket if it exists
      if (session.socketId) {
        const socket = io.sockets.sockets.get(session.socketId);
        if (socket) {
          socket.disconnect(true);
        }
      }
      activeSessions.delete(userId);
      console.log(`Logged out user ${userId} and cleared session`);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all users (for admin dropdown)
app.get('/api/users', async (req, res) => {
  try {
    const token = req.header('x-auth-token');
    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }
    
    // Return all users without passwords
    const usersWithoutPasswords = inMemoryUsers.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    
    res.json(usersWithoutPasswords);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Socket.IO connection
// Global throttling maps to prevent socket stress across all connections
const roomUpdateTimestamps = new Map();
const roomLastStates = new Map();

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Handle authentication and session tracking
  const token = socket.handshake.auth.token;
  console.log(`New socket connection: ${socket.id}, has token: ${!!token}`);
  
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = parseInt(decoded.id); // Convert to number to match database format
      console.log(`Socket ${socket.id} authenticated for user ${userId}`);
      
      // Update or create the session with the socket ID
      let session = activeSessions.get(userId);
      console.log(`Found session for user ${userId}:`, !!session);
      
      if (session) {
        session.socketId = socket.id;
        session.token = token; // Store the current token
        console.log(`Updated session for user ${userId} with socket ${socket.id}`);
      } else {
        // Create a new session if one doesn't exist
        const user = inMemoryUsers.find(u => u._id === userId);
        if (user) {
          session = {
            token,
            socketId: socket.id,
            loginTime: new Date().toISOString(),
            userId: userId,
            username: user.username
          };
          activeSessions.set(userId, session);
          console.log(`Created new session for user ${userId} with socket ${socket.id}`);
        } else {
          console.log(`User ${userId} not found in database`);
        }
      }
    } catch (err) {
      console.error('Token verification error on socket connection:', err);
    }
  }
  
  // Join room
  socket.on('join_room', ({ roomCode }) => {
    try {
      // Find game room in memory
      const gameRoom = inMemoryGameRooms.find(room => room.room_code === roomCode);
      if (!gameRoom) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      
      // Join socket room
      socket.join(roomCode);
      
      // Get user info from socket auth
      const token = socket.handshake.auth.token;
      let userId, username;
      
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          userId = decoded.id;
          const user = inMemoryUsers.find(u => u._id === userId);
          username = user ? user.username : 'Anonymous';
        } catch (err) {
          console.error('Token verification error:', err);
          userId = 'guest-' + Math.random().toString(36).substring(2, 10);
          username = 'Guest';
        }
      } else {
        userId = 'guest-' + Math.random().toString(36).substring(2, 10);
        username = 'Guest';
      }
      
      // Add player to game state if not already present
      const gameState = gameRoom.game_state;
      const isHost = gameRoom.host_id.toString() === userId.toString();
      
      if (!gameState.players[userId]) {
        // Find the first available seat (0-4 for 5 seats)
        const numSeats = 5;
        const occupiedSeats = new Set(Object.values(gameState.players).map(p => p.seatIndex).filter(s => s !== undefined));
        let assignedSeatIndex = null;
        
        for (let i = 0; i < numSeats; i++) {
          if (!occupiedSeats.has(i)) {
            assignedSeatIndex = i;
            break;
          }
        }
        
        // If no seat available, assign as spectator
        const isSpectating = assignedSeatIndex === null;
        
        gameState.players[userId] = {
          id: userId,
          username,
          isHost,
          seatIndex: assignedSeatIndex, // Assign seat index
          isSpectating, // Set spectating if no seat available
          hasPlacedBet: false,
          hands: [{ cards: [], score: 0, bet: 0, status: 'betting' }],
          sideBets: {}
        };
        console.log(`Added new player ${username} to room ${roomCode}, seatIndex: ${assignedSeatIndex}, isHost: ${isHost}, isSpectating: ${isSpectating}`);
      } else {
        // Update existing player's isHost status and ensure consistency
        gameState.players[userId].isHost = isHost;
        gameState.players[userId].username = username; // Update username in case it changed
        console.log(`Updated existing player ${username} in room ${roomCode}, isHost: ${isHost}`);
      }
      
      // Ensure game state has required properties
      if (!gameState.status) {
        gameState.status = 'betting';
      }
      if (!gameState.roundCounter) {
        gameState.roundCounter = 1;
      }
      if (!gameState.dealer) {
        gameState.dealer = { cards: [], score: 0 };
      }
      
      console.log(`Emitting game state to room ${roomCode}:`, {
        status: gameState.status,
        playersCount: Object.keys(gameState.players).length,
        roundCounter: gameState.roundCounter
      });
      
      // Emit updated game state to all clients in room
      io.to(roomCode).emit('game_update_' + roomCode, gameState);
      
      // Get chat messages for this room
      const roomMessages = inMemoryChatMessages
        .filter(msg => msg.room_code === roomCode)
        .sort((a, b) => a.created_at - b.created_at);

      // Emit chat history to the specific socket that joined
      socket.emit(`chat_history:${roomCode}`, roomMessages);
      
      console.log(`User ${username} joined room ${roomCode}`);
    } catch (error) {
      console.error('Join room error:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });
  
  // Update game state with throttling to prevent socket stress
  socket.on('update_game_state', ({ roomCode, gameState }) => {
    try {
      console.log(`🎮 SERVER: Received update_game_state for room ${roomCode}`);
      console.log(`🎮 SERVER: Game state data:`, {
        status: gameState.status,
        activePlayerId: gameState.activePlayerId,
        activeHandIndex: gameState.activeHandIndex,
        playersCount: Object.keys(gameState.players || {}).length
      });
      
      // Find game room in memory
      const gameRoom = inMemoryGameRooms.find(room => room.room_code === roomCode);
      if (!gameRoom) {
        console.log(`❌ SERVER: Room ${roomCode} not found`);
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      
      // Server-side throttling to prevent excessive updates
      const now = Date.now();
      const lastUpdate = roomUpdateTimestamps.get(roomCode) || 0;
      const minDelay = (gameState.status === 'dealer' || gameState.status === 'roundOver') ? 300 : 100;
      
      if (now - lastUpdate < minDelay) {
        console.log(`🚫 SERVER: Throttling update for room ${roomCode} (too frequent)`);
        return;
      }
      
      // Prevent duplicate state updates
      const stateKey = `${gameState.status}-${gameState.activePlayerId}-${gameState.activeHandIndex}-${Object.keys(gameState.players || {}).length}`;
      const lastStateKey = roomLastStates.get(roomCode);
      
      if (lastStateKey === stateKey) {
        console.log(`🚫 SERVER: Skipping duplicate state update for room ${roomCode}`);
        return;
      }
      
      roomUpdateTimestamps.set(roomCode, now);
      roomLastStates.set(roomCode, stateKey);
      
      // Preserve server-assigned properties when updating game state
      const existingPlayers = gameRoom.game_state.players || {};
      const updatedPlayers = gameState.players || {};
      
      // Merge players while preserving server-assigned seatIndex and other properties
      const mergedPlayers = {};
      for (const playerId in updatedPlayers) {
        const existingPlayer = existingPlayers[playerId];
        const updatedPlayer = updatedPlayers[playerId];
        
        mergedPlayers[playerId] = {
          ...updatedPlayer,
          // Preserve server-assigned properties
          seatIndex: existingPlayer?.seatIndex ?? updatedPlayer.seatIndex,
          isSpectating: existingPlayer?.isSpectating ?? updatedPlayer.isSpectating,
          username: existingPlayer?.username ?? updatedPlayer.username,
          isHost: existingPlayer?.isHost ?? updatedPlayer.isHost
        };
      }
      
      // Update game state with merged players
      gameRoom.game_state = {
        ...gameState,
        players: mergedPlayers
      };
      
      // Emit updated game state to all clients in room
      console.log(`🎮 SERVER: Emitting game_update_${roomCode} to all clients`);
      io.to(roomCode).emit('game_update_' + roomCode, gameState);
      
      console.log(`✅ SERVER: Game state updated in room ${roomCode}`);
    } catch (error) {
      console.error('Update game state error:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });
  
  // Send chat message
  socket.on('send_chat_message', ({ roomCode, userId, username, message, timestamp }) => {
    try {
      console.log(`🔥 CHAT MESSAGE RECEIVED: "${message}" from ${username} in room ${roomCode}`);
      console.log(`🔥 Full message data:`, { roomCode, userId, username, message, timestamp });
      
      // Find game room in memory
      const gameRoom = inMemoryGameRooms.find(room => room.room_code === roomCode);
      if (!gameRoom) {
        console.log(`❌ Room ${roomCode} not found`);
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      
      // Create message
      const chatMessage = {
        _id: nextMessageId++,
        room_code: roomCode,
        user_id: userId,
        username,
        message,
        created_at: new Date(timestamp)
      };
      
      console.log(`✅ Created chat message:`, chatMessage);
      
      inMemoryChatMessages.push(chatMessage);
      
      // Emit message to all clients in room
      const eventName = `chat_message:${roomCode}`;
      console.log(`📡 Emitting to event: ${eventName}`);
      console.log(`📡 Clients in room ${roomCode}:`, io.sockets.adapter.rooms.get(roomCode)?.size || 0);
      io.to(roomCode).emit(eventName, chatMessage);
      
      console.log(`🎉 Message sent in room ${roomCode} by ${username}`);
    } catch (error) {
      console.error('💥 Send message error:', error);
      socket.emit('error', { message: 'Server error' });
    }
  });

  // Get chat messages
  socket.on('get_chat_messages', ({ roomCode }, callback) => {
    try {
      // Get chat messages for this room
      const roomMessages = inMemoryChatMessages
        .filter(msg => msg.room_code === roomCode)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
      callback({ success: true, messages: roomMessages });
      
      console.log(`Chat messages retrieved for room ${roomCode}`);
    } catch (error) {
      console.error('Get chat messages error:', error);
      callback({ success: false, error: 'Server error' });
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log('🔌 Client disconnected:', socket.id, 'Reason:', reason, 'Timestamp:', new Date().toISOString());
    
    // Clean up session tracking
    for (const [userId, session] of activeSessions.entries()) {
      if (session.socketId === socket.id) {
        // Don't remove the session entirely, just clear the socket ID
        // This allows the user to reconnect with the same token
        session.socketId = null;
        console.log(`Cleared socket ID for user ${userId} session`);
        break;
      }
    }
     
     try {
       // Handle player leaving game rooms - but with a delay to allow for reconnections
      const token = socket.handshake.auth.token;
      let userId;
      
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          userId = decoded.id;
        } catch (err) {
          console.error('Token verification error on disconnect:', err);
          return; // Can't identify user, nothing to clean up
        }
      } else {
        return; // Guest users or no token, nothing to clean up
      }
      
      // Only handle room cleanup for actual disconnects, not transport upgrades or client-side navigation
      if (reason === 'transport close' || reason === 'client namespace disconnect' || reason === 'transport error' || reason === 'ping timeout') {
        console.log(`🚨 User ${userId} disconnected due to ${reason}, setting up room cleanup timeout`);
        
        // Set a longer timeout to allow for reconnections (e.g., page refresh, network issues)
        setTimeout(() => {
          // Check if the user has reconnected
          const currentSession = activeSessions.get(userId);
          if (currentSession && currentSession.socketId) {
            console.log(`User ${userId} reconnected, skipping room cleanup`);
            return;
          }
          
          console.log(`User ${userId} still disconnected after timeout, proceeding with room cleanup`);
          
          // Find all rooms this user was in and remove them
          inMemoryGameRooms.forEach(gameRoom => {
            const gameState = gameRoom.game_state;
            
            if (gameState.players && gameState.players[userId]) {
              console.log(`Removing player ${userId} from room ${gameRoom.room_code} after disconnect timeout`);
              
              // Check if this player was the active player
              const wasActivePlayer = gameState.activePlayerId === userId;
              
              // Check if this player was the host
              const wasHost = gameRoom.host_id.toString() === userId.toString();
              
              // Remove player from game state
              delete gameState.players[userId];
              
              // Handle host transfer if needed
              if (wasHost) {
                const remainingPlayers = Object.values(gameState.players);
                if (remainingPlayers.length > 0) {
                  // Transfer host to the first remaining player
                  const newHost = remainingPlayers[0];
                  gameRoom.host_id = newHost.id;
                  newHost.isHost = true;
                  console.log(`Host transferred from ${userId} to ${newHost.id} (${newHost.username}) in room ${gameRoom.room_code}`);
                } else {
                  console.log(`Room ${gameRoom.room_code} is now empty, keeping for potential rejoins`);
                }
              }
              
              // Handle turn progression if it was this player's turn
              if (wasActivePlayer && (gameState.status === 'playing' || gameState.status === 'dealing')) {
                console.log(`Active player ${userId} disconnected, advancing turn`);
                
                // Find next active player
                const playerIds = Object.keys(gameState.players).filter(pid => 
                  gameState.players[pid] && !gameState.players[pid].isSpectating
                );
                
                if (playerIds.length > 0) {
                  // Find next player with hands in 'playing' status
                  let nextActivePlayer = null;
                  
                  for (const playerId of playerIds) {
                    const player = gameState.players[playerId];
                    if (player.hands && player.hands.some(h => h.status === 'playing')) {
                      nextActivePlayer = playerId;
                      break;
                    }
                  }
                  
                  if (nextActivePlayer) {
                    gameState.activePlayerId = nextActivePlayer;
                    gameState.activeHandIndex = 0;
                    console.log(`Turn advanced to player ${nextActivePlayer}`);
                  } else {
                    // No more players with active hands, move to dealer
                    gameState.status = 'dealer';
                    gameState.activePlayerId = null;
                    gameState.activeHandIndex = 0;
                    console.log('No more active players, moving to dealer turn');
                  }
                } else {
                  // No players left, reset to betting
                  gameState.status = 'betting';
                  gameState.activePlayerId = null;
                  gameState.activeHandIndex = 0;
                  console.log('No players left, resetting to betting phase');
                }
              }
              
              // Emit updated game state to remaining clients in room
              io.to(gameRoom.room_code).emit('game_update_' + gameRoom.room_code, gameState);
              
              console.log(`Player ${userId} removed from room ${gameRoom.room_code}, updated state sent to remaining players`);
            }
          });
        }, 30000); // Increased to 30 second delay to allow for reconnections
      } else {
        console.log(`✅ User ${userId} disconnected due to ${reason}, not setting up room cleanup (likely a normal navigation or transport upgrade)`);
      }
      
    } catch (error) {
      console.error('Error handling player disconnect:', error);
    }
  });
});

// Start server
const PORT = process.env.PORT || 5000;

// Add a simple health check route for the backend
app.get('/', (req, res) => {
  res.json({ 
    message: 'Blackjack Backend API is running!', 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  console.log(`Network access: http://192.168.0.230:${PORT}`);
});