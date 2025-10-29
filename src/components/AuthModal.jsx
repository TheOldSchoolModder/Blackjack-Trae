import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import { API_ENDPOINTS } from '@/config/api';

const AuthModal = ({ isOpen, onClose, initialMode = 'login' }) => {
  const { signUp, signIn } = useAuth();
  const { t } = useTranslation();
  const [mode, setMode] = useState(initialMode); // 'login', 'register', 'forgot'
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    confirmPassword: ''
  });

  // Update mode when initialMode changes
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.email) {
      console.log("Email is required");
      return false;
    }
    
    if (mode === 'register') {
      if (!formData.username) {
        console.log("Username is required");
        return false;
      }
      if (formData.password.length < 6) {
        console.log("Password must be at least 6 characters");
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        console.log("Passwords do not match");
        return false;
      }
    }
    
    if (mode === 'login' && !formData.password) {
      console.log("Password is required");
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      if (mode === 'login') {
        await signIn(formData.email, formData.password);
        console.log("Welcome back! Successfully logged in.");
        onClose();
      } else if (mode === 'register') {
        await signUp(formData.email, formData.password, formData.username);
        console.log("Account created! Welcome to Blackjack Multiplayer!");
        onClose();
      } else if (mode === 'forgot') {
        const response = await fetch(API_ENDPOINTS.FORGOT_PASSWORD, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email })
        });
        const data = await response.json();
        console.log("Password Reset:", data.message);
        setMode('login');
      }
    } catch (error) {
      console.log("Authentication Error:", error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ email: '', password: '', username: '', confirmPassword: '' });
    setShowPassword(false);
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    resetForm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-w-[90vw] mx-auto bg-slate-900/95 backdrop-blur-sm border-yellow-500/30 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-center text-yellow-400">
            {mode === 'login' ? 'Welcome Back' : 'Join the Game'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 sm:space-y-6">
          <div className="space-y-3 sm:space-y-4">
            <div>
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="mt-1 bg-slate-800/50 border-slate-600 text-white placeholder-slate-400 text-sm sm:text-base"
                placeholder="Enter your email"
                disabled={loading}
              />
            </div>
            
            {mode === 'register' && (
              <div>
                <Label htmlFor="username" className="text-sm font-medium">
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  className="mt-1 bg-slate-800/50 border-slate-600 text-white placeholder-slate-400 text-sm sm:text-base"
                  placeholder="Enter your username"
                  disabled={loading}
                />
              </div>
            )}
            
            <div>
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="mt-1 bg-slate-800/50 border-slate-600 text-white placeholder-slate-400 text-sm sm:text-base"
                placeholder="Enter your password"
                disabled={loading}
              />
            </div>
            
            {mode === 'register' && (
              <div>
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className="mt-1 bg-slate-800/50 border-slate-600 text-white placeholder-slate-400 text-sm sm:text-base"
                  placeholder="Confirm your password"
                  disabled={loading}
                />
              </div>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading || !formData.email || !formData.password}
            className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-bold py-2 sm:py-3 text-sm sm:text-base"
          >
            {loading ? 'Please wait...' : (mode === 'login' ? 'Sign In' : 'Sign Up')}
          </Button>

          <div className="text-center">
            <button
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-yellow-400 hover:text-yellow-300 text-xs sm:text-sm underline"
              disabled={loading}
            >
              {mode === 'login' 
                ? "Don't have an account? Sign up" 
                : "Already have an account? Sign in"
              }
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;