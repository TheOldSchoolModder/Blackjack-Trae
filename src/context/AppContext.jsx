import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { initializeSocket, getSocket, disconnectSocket, joinRoom } from '@/lib/socketClient';
import { API_ENDPOINTS } from '@/config/api';
import { useSound } from '@/hooks/useSound';

export const AppContext = createContext();

const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const AppProvider = ({ children }) => {
  const { user, profile, loading, updateProfile, token } = useAuth();
  const [currentView, setCurrentView] = useState('home');
  const [gameMode, setGameMode] = useState(null);
  const [roomCode, setRoomCode] = useState(null);
  const [player, setPlayer] = useState(null);
  const { playSound } = useSound();
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'en');

  // Initialize Socket.IO
  useEffect(() => {
    if (token) {
      initializeSocket(token);
    }
  }, [token]);

  useEffect(() => {
    console.log('🔧 AppContext profile effect:', { profile, hasProfile: !!profile });
    if (profile) {
      const playerObj = { id: profile.id, username: profile.username, balance: profile.balance, last_bonus: profile.last_bonus };
      console.log('🔧 Setting player object:', playerObj);
      setPlayer(playerObj);
    } else {
      console.log('🔧 Clearing player object');
      setPlayer(null);
    }
  }, [profile]);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomCodeFromUrl = urlParams.get('room');
    if (roomCodeFromUrl && user) {
        handleStartGame('friend', roomCodeFromUrl);
    }
  }, [user]);

  const updatePlayerBalance = useCallback(async (amount) => {
    if (!player || typeof amount !== 'number') return;
    
    const newBalance = (player.balance || 0) + amount;
    const { error } = await updateProfile({ balance: newBalance });

    if (!error) {
        setPlayer(p => ({ ...p, balance: newBalance }));
    } else {
        console.error("Failed to update balance on server:", error);
    }
  }, [player, updateProfile]);

  const handleStartGame = useCallback(async (mode, code = null) => {
    if (!player) return; // Can't start a game if not logged in.
    setGameMode(mode);
    
    let newRoomCode = code;

    if (mode === 'friend') {
        if (!code) { // Creating a new room
            try {
                const response = await fetch(API_ENDPOINTS.CREATE_ROOM, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-auth-token': token
                    },
                    body: JSON.stringify({ userId: player.id })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to create room');
                }
                
                newRoomCode = data.roomCode;
            } catch (error) {
                console.error('Error creating room:', error);
                return;
            }
        }
        
        try {
            const response = await fetch(`${API_ENDPOINTS.JOIN_ROOM}/${newRoomCode}`, {
                method: 'GET',
                headers: {
                    'x-auth-token': token
                }
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to join room');
            }
            
            // Join Socket.IO room
            joinRoom(newRoomCode, player.id, player.username);
        } catch (error) {
            console.error('Error joining room:', error);
            window.history.pushState({}, '', '/');
            setCurrentView('home');
            return;
        }
    } else { // Practice mode
        newRoomCode = `PRACTICE-${player.id.substring(0, 4)}`;
    }
    
    setRoomCode(newRoomCode);
    window.history.pushState({}, '', `/?room=${newRoomCode}`);
    setCurrentView('game');
  }, [player, token]);

  const handleBackToHome = () => {
    setCurrentView('home');
    setGameMode(null);
    setRoomCode(null);
    window.history.pushState({}, '', '/');
  };

  const handleRedeemBonus = useCallback(async () => {
    // Check if player exists and meets redeem requirements
    if (!player) return;
    
    // Check 24-hour cooldown
    if (player.last_bonus && new Date() - new Date(player.last_bonus) < 24 * 60 * 60 * 1000) {
        return;
    }
    
    // Check if balance is 0 or negative
    if (player.balance > 0) {
        return;
    }
    
    const newBalance = player.balance + 1000;
    const now = new Date().toISOString();
    
    const { error } = await updateProfile({ balance: newBalance, last_bonus: now });
    if (!error) {
        setPlayer(p => ({ ...p, balance: newBalance, last_bonus: now }));
        playSound('win');
    }
  }, [player, updateProfile, playSound]);

  const value = {
    currentView,
    gameMode,
    roomCode,
    player,
    loading,
    updatePlayerBalance,
    handleStartGame,
    handleBackToHome,
    handleRedeemBonus,
    language,
    setLanguage: (lang) => {
        setLanguage(lang);
        localStorage.setItem('language', lang);
    }
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};