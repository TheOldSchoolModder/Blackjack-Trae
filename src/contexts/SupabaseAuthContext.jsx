import React, { createContext, useContext, useState, useEffect } from 'react';
import { disconnectSocket, reconnectSocket } from '@/lib/socketClient';
import { API_ENDPOINTS, API_BASE_URL } from '@/config/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Initialize socket connection when token is available
  useEffect(() => {
    if (token) {
      reconnectSocket(token);
    }
  }, [token]);

  // Optimized session management with better error handling
  useEffect(() => {
    const fetchUser = async () => {
      console.log('🔍 Auth fetchUser called, token:', !!token);
      
      if (!token) {
        console.log('🔍 No token, setting loading to false');
        setLoading(false);
        return;
      }

      try {
        console.log('🔍 Fetching user data...');
        const response = await fetch(API_ENDPOINTS.USER, {
          headers: {
            'x-auth-token': token
          }
        });

        if (response.ok) {
          const userData = await response.json();
          console.log('🔍 User data fetched successfully');
          setUser(userData);
          setProfile({
            id: userData._id,
            username: userData.username,
            balance: userData.balance,
            last_bonus: userData.last_bonus
          });
        } else {
          console.log('🔍 Invalid token, clearing session');
          // Clear invalid token and disconnect socket
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
          setProfile(null);
          disconnectSocket();
        }
      } catch (error) {
        console.error('🔍 Error fetching user:', error);
        // Clear invalid session on network error
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        setProfile(null);
        disconnectSocket();
      }

      console.log('🔍 Setting loading to false');
      setLoading(false);
    };

    fetchUser();
  }, [token]);

  const signUp = async (email, password, username) => {
    try {
      const response = await fetch(API_ENDPOINTS.SIGNUP, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, username })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      setProfile({
        id: data.user.id,
        username: data.user.username,
        balance: data.user.balance,
        last_bonus: data.user.last_bonus
      });
      reconnectSocket(data.token); // Reconnect socket with new token
      console.log("Account created successfully");

      return data;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const signIn = async (email, password) => {
    try {
      const response = await fetch(API_ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      setProfile({
        id: data.user.id,
        username: data.user.username,
        balance: data.user.balance,
        last_bonus: data.user.last_bonus
      });
      
      // Reconnect socket with the new token
      reconnectSocket(data.token);
      
      console.log("Signed in successfully");

      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // Call logout endpoint to clean up server session
      if (token) {
        await fetch(API_ENDPOINTS.LOGOUT, {
          method: 'POST',
          headers: {
            'x-auth-token': token
          }
        });
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }
    
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setProfile(null);
    disconnectSocket(); // Disconnect socket on logout
    console.log("Logged out successfully");
  };

  const updateProfile = async (updates) => {
    if (!user || !token) return { error: 'Not authenticated' };

    try {
      const response = await fetch(API_ENDPOINTS.UPDATE_PROFILE, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        },
        body: JSON.stringify(updates)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Profile update failed');
      }

      setProfile(prev => ({ ...prev, ...updates }));
      return { data };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { error };
    }
  };

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    token
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};