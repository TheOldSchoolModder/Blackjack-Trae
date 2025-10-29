import React, { useState, useContext } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Coins, Users, Trophy, Zap, Play, UserPlus, HelpCircle, Volume2, VolumeX, Settings, Crown, Star, Gift, LogIn, LogOut, Plus, Bot } from 'lucide-react';
import { AppContext } from '@/context/AppContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useSound } from '@/hooks/useSound';
import { useTranslation } from '@/hooks/useTranslation';
import AuthModal from '@/components/AuthModal';
import RulesModal from '@/components/RulesModal';
import Leaderboard from '@/components/Leaderboard';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import HeroImage from '@/components/HeroImage';
import WelcomeMessage from '@/components/WelcomeMessage';
import CallToAction from '@/components/CallToAction';

const AuthSection = () => {
  const { player } = useContext(AppContext);
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  const openAuthModal = (mode = 'login') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  if (user && player) {
    return (
      <div className="text-center">
        <p className="text-xl text-emerald-200 mb-4">{t('welcome_back', { username: player.username })}</p>
        <p className="text-lg text-white mb-4">
          {t('balance')}: 
          <span className={`font-bold ${player.balance < 0 ? 'text-red-400' : ''}`}>
            {player.balance < 0 ? '-$' : '$'}{Math.abs(player.balance).toLocaleString()}
          </span>
        </p>
        <Button onClick={signOut} className="bg-red-600 hover:bg-red-700">
          <LogOut className="mr-2 h-4 w-4" /> {t('logout_button')}
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <div className="space-y-2">
        <Button 
          onClick={() => openAuthModal('login')} 
          className="bg-emerald-600 hover:bg-emerald-700 text-lg py-6 px-8 mr-4"
        >
          <LogIn className="mr-2 h-5 w-5" /> {t('login_button')}
        </Button>
        <Button 
          onClick={() => openAuthModal('register')} 
          variant="outline"
          className="bg-transparent border-emerald-400 text-emerald-300 hover:bg-emerald-600 hover:text-white text-lg py-6 px-8"
        >
          <Plus className="mr-2 h-5 w-5" /> {t('sign_up')}
        </Button>
      </div>
      <p className="text-sm text-gray-400">
        Join thousands of players in the ultimate blackjack experience
      </p>
      
      <AuthModal 
        isOpen={authModalOpen} 
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
      />
    </div>
  );
};
  
const DailyBonus = ({ onRedeemBonus }) => {
    const { player } = useContext(AppContext);
    const { t } = useTranslation();

    if (!player || player.balance > 0) return null;

    const handleRedeem = () => {
        onRedeemBonus();
        // Bonus redeemed - users can see this reflected in their balance
    };
    
    const canRedeem = (!player.last_bonus || new Date() - new Date(player.last_bonus) > 24 * 60 * 60 * 1000) && player.balance <= 0;

    return (
        <div className="mt-8 p-6 bg-yellow-500/10 rounded-xl border border-yellow-500/30 text-center">
            <h3 className="text-xl font-bold text-yellow-300">{t('daily_bonus_title')}</h3>
            {canRedeem ? (
                <>
                    <p className="text-yellow-200 my-2">{t('daily_bonus_desc')}</p>
                    <Button onClick={handleRedeem} className="bg-yellow-500 hover:bg-yellow-600 text-black">{t('daily_bonus_redeem')}</Button>
                </>
            ) : (
                <p className="text-yellow-200 my-2">{t('daily_bonus_redeemed')}</p>
            )}
        </div>
    );
};

const HomePage = ({ onRedeemBonus }) => {
  const { player, handleStartGame } = useContext(AppContext);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const { t } = useTranslation();

  const handleCreateRoom = () => {
    setIsCreateDialogOpen(false);
    handleStartGame('friend');
  };

  const handleJoinRoom = () => {
    if (!roomCodeInput.trim()) {
      console.log("Room code is required!");
      return;
    }
    setIsJoinDialogOpen(false);
    handleStartGame('friend', roomCodeInput);
  };
  
  const handlePracticeMode = () => handleStartGame('bot');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>
      
      <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center space-y-8 relative z-10 max-w-4xl w-full">
        <motion.h1 className="text-4xl sm:text-6xl md:text-8xl font-bold bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 bg-clip-text text-transparent px-2" initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ duration: 0.5, delay: 0.2 }}>
          ♠️ Blackjack Royale ♥️
        </motion.h1>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-8 p-4 sm:p-6 bg-white/5 rounded-xl backdrop-blur-sm border border-emerald-400/20 mx-2">
          <AuthSection />
        </motion.div>

        {player && <DailyBonus onRedeemBonus={onRedeemBonus} />}
        
        {player && (
          <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-12 px-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <motion.div whileHover={{ scale: 1.05, y: -5 }} whileTap={{ scale: 0.95 }}>
                  <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-6 sm:p-8 rounded-2xl cursor-pointer shadow-2xl border-2 border-purple-400/30 hover:border-purple-400/60 transition-all">
                    <Plus className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-purple-200" />
                    <h3 className="text-xl sm:text-2xl font-bold mb-2">{t('create_room_title')}</h3>
                    <p className="text-purple-200 text-sm sm:text-base">{t('invite_placeholder')}</p>
                  </div>
                </motion.div>
              </DialogTrigger>
              <DialogContent className="bg-gradient-to-br from-slate-800 to-slate-900 border-purple-500/30 mx-4 max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-xl sm:text-2xl text-purple-300">{t('create_room_title')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <p className="text-emerald-200 text-sm sm:text-base">{t('create_room_desc')}</p>
                  <Button onClick={handleCreateRoom} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-base sm:text-lg py-4 sm:py-6">{t('create_room_button')}</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
              <DialogTrigger asChild>
                <motion.div whileHover={{ scale: 1.05, y: -5 }} whileTap={{ scale: 0.95 }}>
                  <div className="bg-gradient-to-br from-teal-600 to-cyan-700 p-6 sm:p-8 rounded-2xl cursor-pointer shadow-2xl border-2 border-teal-400/30 hover:border-teal-400/60 transition-all">
                    <LogIn className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-teal-200" />
                    <h3 className="text-xl sm:text-2xl font-bold mb-2">{t('join_room_title')}</h3>
                    <p className="text-teal-200 text-sm sm:text-base">{t('join_room_desc')}</p>
                  </div>
                </motion.div>
              </DialogTrigger>
              <DialogContent className="bg-gradient-to-br from-slate-800 to-slate-900 border-teal-500/30 mx-4 max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-xl sm:text-2xl text-teal-300">{t('join_room_title')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="joinRoomCode" className="text-emerald-200 text-sm sm:text-base">{t('room_code')}</Label>
                    <Input id="joinRoomCode" type="text" placeholder={t('join_room_desc')} value={roomCodeInput} onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())} className="bg-white/10 border-teal-400/30 text-white mt-2 text-base" maxLength={6}/>
                  </div>
                  <Button onClick={handleJoinRoom} className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-base sm:text-lg py-4 sm:py-6">{t('join_room_button')}</Button>
                </div>
              </DialogContent>
            </Dialog>
            <motion.div whileHover={{ scale: 1.05, y: -5 }} whileTap={{ scale: 0.95 }} onClick={handlePracticeMode} className="sm:col-span-2 lg:col-span-1">
              <div className="bg-gradient-to-br from-amber-600 to-orange-700 p-6 sm:p-8 rounded-2xl cursor-pointer shadow-2xl border-2 border-amber-400/30 hover:border-amber-400/60 transition-all">
                <Bot className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-amber-200" />
                <h3 className="text-xl sm:text-2xl font-bold mb-2">{t('practice_mode_title')}</h3>
                <p className="text-amber-200 text-sm sm:text-base">{t('practice_mode_desc')}</p>
              </div>
            </motion.div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-12 px-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" className="text-base sm:text-lg text-emerald-300 hover:text-white hover:bg-emerald-500/10">
                  <Trophy className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> {t('view_leaderboard')}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gradient-to-br from-slate-800 to-slate-900 border-yellow-500/30 max-w-2xl mx-4">
                <DialogHeader>
                  <DialogTitle className="text-2xl sm:text-3xl text-yellow-300">{t('top_players')}</DialogTitle>
                  <DialogDescription className="text-sm sm:text-base">{t('leaderboard_desc')}</DialogDescription>
                </DialogHeader>
                <div className="py-4"><Leaderboard /></div>
              </DialogContent>
            </Dialog>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default HomePage;