// API Configuration
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

// Get API URL from environment or use defaults
export const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (isDevelopment ? 'http://localhost:5000' : window.location.origin);

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 
  (isDevelopment ? 'http://localhost:5000' : window.location.origin);

// API endpoints
export const API_ENDPOINTS = {
  // Auth endpoints
  SIGNUP: `${API_BASE_URL}/api/auth/signup`,
  LOGIN: `${API_BASE_URL}/api/auth/login`,
  LOGOUT: `${API_BASE_URL}/api/auth/logout`,
  USER: `${API_BASE_URL}/api/auth/user`,
  FORGOT_PASSWORD: `${API_BASE_URL}/api/auth/forgot-password`,
  
  // User endpoints
  UPDATE_PROFILE: `${API_BASE_URL}/api/users/update-profile`,
  USERS: `${API_BASE_URL}/api/users`,
  
  // Game endpoints
  CREATE_ROOM: `${API_BASE_URL}/api/game/create-room`,
  JOIN_ROOM: `${API_BASE_URL}/api/game/join-room`,
  TRACK_STATS: `${API_BASE_URL}/api/game/track-stats`,
  
  // Leaderboard
  LEADERBOARD: `${API_BASE_URL}/api/leaderboard`
};

console.log('API Configuration:', {
  API_BASE_URL,
  SOCKET_URL,
  isDevelopment,
  isProduction
});