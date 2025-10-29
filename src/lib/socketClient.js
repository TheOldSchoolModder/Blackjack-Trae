import io from 'socket.io-client';

// Force production URL - bypass environment variables for debugging
const SOCKET_URL = 'https://blackjack-server-3q07.onrender.com';
let socket = null;

export const initializeSocket = (token) => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  
  socket = io(SOCKET_URL, {
    auth: {
      token: token
    },
    transports: ['websocket', 'polling'],
    timeout: 30000,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
    autoConnect: true,
    forceNew: true // Force a new connection to prevent stale connections
  });
    
  socket.on('connect', () => {
    console.log('Connected to Socket.IO server with ID:', socket.id);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason, {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      reason: reason
    });
    
    // Log stack trace to see what's causing the disconnect
    console.trace('Socket disconnect stack trace');
    
    // Only attempt reconnection for network-related disconnects
    if (reason === 'io server disconnect' || reason === 'transport close') {
      console.log('Attempting to reconnect...');
    }
  });
  
  socket.on('connect_error', (error) => {
    console.error('Socket.IO connection error:', error);
  });
  
  socket.on('reconnect', (attemptNumber) => {
    console.log('Reconnected to Socket.IO server after', attemptNumber, 'attempts');
  });
  
  socket.on('reconnect_error', (error) => {
    console.error('Socket.IO reconnection error:', error);
  });
  
  socket.on('error', (error) => {
    console.error('Socket.IO error:', error);
  });

  // Listen for force logout events
  socket.on('force_logout', (data) => {
    console.log('Force logout received:', data);
    console.log('Current token in localStorage:', localStorage.getItem('token'));
    
    // Clear local storage and redirect to login
    localStorage.removeItem('token');
    
    // Handle cases where data might be undefined
    const reason = data?.reason || "You have been logged out from another device";
    
    // Log notification to console
    console.log("Session Expired:", reason);
    
    console.log('Redirecting to home page due to force logout');
    // Redirect to home page or trigger logout in auth context
    window.location.href = '/';
  });
  
  return socket;
};

export const reconnectSocket = (token) => {
  disconnectSocket();
  return initializeSocket(token);
};

export const getSocket = () => {
  if (!socket || !socket.connected) {
    const token = localStorage.getItem('token');
    if (token) {
      console.log('Socket not connected, reinitializing...');
      return initializeSocket(token);
    } else {
      console.warn('No token available for socket initialization');
      return null;
    }
  }
  return socket;
};

export const joinRoom = (roomCode, userId, username) => {
  const socket = getSocket();
  if (socket && socket.connected) {
    console.log(`Joining room ${roomCode} as ${username} (${userId})`);
    socket.emit('join_room', { roomCode, userId, username });
  } else {
    console.error('Cannot join room: socket not connected');
  }
};

// Throttling variables for updateGameState
let lastUpdateTime = 0;
let lastStateKey = null;

export const updateGameState = (roomCode, gameState) => {
  const socket = getSocket();
  
  if (!socket || !socket.connected) {
    console.error('Cannot update game state: socket not connected');
    return;
  }
  
  // Implement throttling to prevent socket stress
  const now = Date.now();
  const minDelay = (gameState.status === 'dealer' || gameState.status === 'roundOver') ? 500 : 200;
  
  if (now - lastUpdateTime < minDelay) {
    console.log('🚫 CLIENT: Throttling update_game_state (too frequent)');
    return;
  }
  
  // Prevent duplicate state updates
  const stateKey = `${gameState.status}-${gameState.activePlayerId}-${gameState.activeHandIndex}-${Object.keys(gameState.players || {}).length}`;
  if (lastStateKey === stateKey) {
    console.log('🚫 CLIENT: Skipping duplicate state update');
    return;
  }
  
  lastUpdateTime = now;
  lastStateKey = stateKey;
  
  console.log('📡 CLIENT: Sending update_game_state to server:', {
    roomCode,
    status: gameState.status,
    activePlayerId: gameState.activePlayerId,
    activeHandIndex: gameState.activeHandIndex
  });
  socket.emit('update_game_state', { roomCode, gameState });
};

export const sendMessage = (roomCode, userId, username, message) => {
  const socket = getSocket();
  if (socket && socket.connected) {
    socket.emit('send_message', { roomCode, userId, username, message });
  } else {
    console.error('Cannot send message: socket not connected');
  }
};

export const updateBalance = (userId, amount) => {
  const socket = getSocket();
  if (socket && socket.connected) {
    socket.emit('update_balance', { userId, amount });
  } else {
    console.error('Cannot update balance: socket not connected');
  }
};

export const updateStats = (userId, stats) => {
  const socket = getSocket();
  if (socket && socket.connected) {
    socket.emit('update_stats', { userId, stats });
  } else {
    console.error('Cannot update stats: socket not connected');
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const subscribeToGameUpdates = (roomCode, callback) => {
  const socket = getSocket();
  if (!socket) {
    console.error('Cannot subscribe to game updates: socket not available');
    return () => {}; // Return empty cleanup function
  }
  
  const eventName = `game_update_${roomCode}`;
  socket.on(eventName, callback);
  
  return () => {
    if (socket) {
      socket.off(eventName, callback);
    }
  };
};

export const subscribeToChatMessages = (roomCode, callback) => {
  const socket = getSocket();
  socket.on(`chat_message:${roomCode}`, callback);
  socket.on(`chat_history:${roomCode}`, (messages) => {
    callback(messages, true); // true indicates this is history, not a new message
  });
  
  return () => {
    socket.off(`chat_message:${roomCode}`, callback);
    socket.off(`chat_history:${roomCode}`, callback);
  };
};

export const subscribeToBalanceUpdates = (callback) => {
  const socket = getSocket();
  socket.on('balance_updated', callback);
  
  return () => {
    socket.off('balance_updated', callback);
  };
};