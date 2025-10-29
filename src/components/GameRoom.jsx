import React, { useState, useEffect, useCallback, useContext, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, animate } from 'framer-motion';
import {
  ArrowLeft, Copy, Volume2, HelpCircle, UserPlus, MessageSquare, X, VolumeX, Eye, Send, Loader2, Lock, EyeOff, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import PlayingCard from '@/components/PlayingCard';
import GameControls from '@/components/GameControls';
import PlayerSeat from '@/components/PlayerSeat';
import RulesModal from '@/components/RulesModal';

import LanguageSwitcher from '@/components/LanguageSwitcher';
import GameLog from '@/components/GameLog';
import SideBetDisplay from './SideBetDisplay';
import BalanceDisplay from './BalanceDisplay';
import { useBlackjackGame } from '@/hooks/useBlackjackGame';
import { useSound } from '@/hooks/useSound';
import { useWindowSize } from '@/hooks/useWindowSize';
import { useTranslation } from '@/hooks/useTranslation';
import { AppContext } from '@/context/AppContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { getSocket, sendMessage, subscribeToChatMessages, updateGameState } from '@/lib/socketClient';
import AdminMenu from '@/components/AdminMenu';
import ShuffleAnimation from '@/components/ShuffleAnimation';

// Import utility functions from the game hook
const getCardValue = (card, currentScore = 0) => {
    if (!card) return 0;
    if (['J', 'Q', 'K'].includes(card.value)) return 10;
    if (card.value === 'A') {
        if (card.chosenValue) return card.chosenValue;
        return currentScore + 11 > 21 ? 1 : 11;
    }
    return parseInt(card.value, 10);
};

const calculateScore = (hand) => {
    if (!hand || hand.length === 0) return 0;
    
    let score = 0;
    let flexibleAces = [];

    // Sum non-aces and aces with a chosen value first
    for (const card of hand) {
        if (card.value === 'A' && card.chosenValue) {
            score += card.chosenValue;
        } else if (card.value === 'A') {
            flexibleAces.push(card);
        } else {
            score += getCardValue(card);
        }
    }

    // Handle flexible aces
    for (const ace of flexibleAces) {
        if (score + 11 <= 21) {
            score += 11;
        } else {
            score += 1;
        }
    }

    return score;
};

const AnimatedBalance = ({ value }) => {
    const motionValue = useMotionValue(value);
    const springValue = useSpring(motionValue, {
      damping: 50,
      stiffness: 400,
    });
    const balanceRef = useRef(null);
  
    useEffect(() => {
        const node = balanceRef.current;
        if (!node) return;

        const controls = animate(springValue, value, {
            damping: 50,
            stiffness: 400,
        });

        return controls.stop;
    }, [value, springValue]);
  
    useEffect(() => {
      const unsubscribe = springValue.on("change", (latest) => {
        if (balanceRef.current) {
            const roundedValue = Math.round(latest);
            const isNegative = roundedValue < 0;
            balanceRef.current.textContent = `${isNegative ? '-$' : '$'}${Math.abs(roundedValue).toLocaleString()}`;
            balanceRef.current.className = `font-bold text-base md:text-lg ${isNegative ? 'text-red-400' : ''}`;
        }
      });
      return unsubscribe;
    }, [springValue]);
  
    const isNegative = value < 0;
    return <div ref={balanceRef} id="animated-balance" className={`font-bold text-base md:text-lg ${isNegative ? 'text-red-400' : ''}`}>{isNegative ? '-$' : '$'}{Math.abs(value).toLocaleString()}</div>;
};

const ChatWindow = ({ onClose, messages, onSendMessage, playerUsername, isMobile }) => {
    const { t } = useTranslation();
    const [message, setMessage] = useState('');
  
    const handleSend = (e) => {
      e.preventDefault();
      if (message.trim()) {
        onSendMessage(message);
        setMessage('');
      }
    };
  
    return (
      <motion.div
        initial={{ opacity: 0, x: isMobile ? 0 : 300, y: isMobile ? 300 : 0 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, x: isMobile ? 0 : 300, y: isMobile ? 300 : 0 }}
        className={`fixed ${isMobile ? 'inset-x-4 bottom-4 top-20' : 'right-4 top-4 bottom-4 w-80'} bg-black/90 backdrop-blur-sm rounded-lg border border-gray-700 flex flex-col z-50`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">{t('chat')}</h3>
          <Button onClick={onClose} variant="ghost" size="sm" className="text-gray-400 hover:text-white">
            <X size={16} />
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.map((msg, index) => (
            <div key={index} className="text-sm">
              <span className="text-blue-400 font-medium">{msg.username}:</span>
              <span className="text-gray-300 ml-2">{msg.message}</span>
            </div>
          ))}
        </div>
        
        <form onSubmit={handleSend} className="p-4 border-t border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('typeMessage')}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              maxLength={200}
            />
            <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Send size={16} />
            </Button>
          </div>
        </form>
      </motion.div>
    );
};

const ChipAnimation = ({ id, startX, startY, endX, endY, chipImage, onComplete }) => {
    return (
      <motion.div
        key={id}
        initial={{ x: startX, y: startY, scale: 1, opacity: 1 }}
        animate={{ x: endX, y: endY, scale: 0.8, opacity: 0.8 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        onAnimationComplete={onComplete}
        className="absolute pointer-events-none z-50"
        style={{ left: 0, top: 0 }}
      >
        <img src={chipImage} alt="chip" className="w-8 h-8" />
      </motion.div>
    );
};

const GameRoom = ({ onBackToHome }) => {
  const { player, gameMode, roomCode, updatePlayerBalance } = useContext(AppContext);
  const { user } = useAuth();
  const { t } = useTranslation();

  const [chatOpen, setChatOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [tableColorIndex, setTableColorIndex] = useState(0);
  const [messages, setMessages] = useState([]);
  const [hotkey, setHotkey] = useState(null);
  const [chipAnimations, setChipAnimations] = useState([]);
  const [showNewRoundButton, setShowNewRoundButton] = useState(false);
  const [showShuffleAnimation, setShowShuffleAnimation] = useState(false);
  const { playSound, isMuted, toggleMute } = useSound();
  const { width } = useWindowSize();
  const isMobile = width <= 600;
  const chatChannelRef = useRef(null);
  const playerSeatRefs = useRef({});

  const {
    players, dealerHand, gameStatus, balance, currentBet, sideBets, isHost, activePlayerId, myPlayerState, activeHandIndex,
    canHit, canStand, canDouble, canSplit, canSurrender,
    handleHit, handleStand, handleDouble, handleSplit, handleSurrender, handleNewRound,
    handlePlaceBet, handleDeal, handleClearBet, handleClearSideBet, handleLockBet, toggleSpectator,
    handleMinBet, handleMaxBet, handleKeepSideBetsToggle, keepSideBets, handleKeepMainBetToggle, keepMainBet,
    acePrompt, handleAceChoice, gameLog, roundCounter, numSeats, mainPlayerSeatIndex,
    adminTestingMode, adminActivePlayer, setAdminActivePlayer, setAdminTestingMode, roundResult
  } = useBlackjackGame(gameMode, roomCode, player, 1000, playSound, updatePlayerBalance);

  // Debug: Add console log to track when loading condition is triggered
  console.log('🔍 GameRoom render check:', { 
    gameStatus, 
    gameMode, 
    hasPlayer: !!player,
    playerId: player?.id,
    playerObject: player,
    playerType: typeof player,
    playerKeys: player ? Object.keys(player) : null,
    playersCount: Object.keys(players).length 
  });
  
  console.log('🔍 About to call useBlackjackGame with player:', player);

  // Remove the loading screen - let the game UI show immediately
  // The gameStatus will transition from 'loading' to 'betting' quickly
  // No need for a separate loading screen that creates jarring UX

  const tableColors = [
    'bg-gradient-to-br from-green-800 via-green-700 to-green-900',
    'bg-gradient-to-br from-blue-800 via-blue-700 to-blue-900',
    'bg-gradient-to-br from-red-800 via-red-700 to-red-900',
    'bg-gradient-to-br from-purple-800 via-purple-700 to-purple-900'
  ];

  // Chat functionality
  const [chatMessages, setChatMessages] = useState([]);

  useEffect(() => {
    const fetchChatMessages = async () => {
      try {
        const socket = getSocket();
        if (!socket) {
          console.error("Socket not connected");
          return;
        }
        
        socket.emit('get_chat_messages', { roomCode }, (response) => {
          if (response.success) {
            setChatMessages(response.messages || []);
          }
        });
      } catch (error) {
        console.error("Error fetching chat messages:", error);
      }
    };

    fetchChatMessages();
  }, [roomCode]);

  // Chat message sending
  const sendChatMessage = (message) => {
    if (!message.trim()) return;
    
    try {
      const socket = getSocket();
      if (!socket) {
        console.error("❌ No socket available!");
        return;
      }
      
      if (!socket.connected) {
        console.error("❌ Socket not connected!");
        return;
      }

      socket.emit('ping', { test: 'data' });
      
      const messageData = {
        roomCode,
        userId: player.id,
        username: player.username,
        message: message,
        timestamp: new Date().toISOString()
      };
      
      socket.emit('send_chat_message', messageData);
      
      // Add a timeout to check if server responds
      setTimeout(() => {
        // Check response
      }, 2000);
      
    } catch (error) {
      console.error("💥 Error sending message:", error);
    }
  };

  const handleKeyDown = useCallback((e) => {
    const target = e.target;
    if (target.tagName.toLowerCase() === 'input' || target.tagName.toLowerCase() === 'textarea') return;

    const key = e.key.toLowerCase();
    let actionTaken = false;

    if (gameStatus === 'playing') {
        if (acePrompt && activePlayerId === player.id) {
            if (key === 'j') { handleAceChoice(acePrompt.handIndex, acePrompt.cardId, 11); actionTaken = true; }
            if (key === 'k') { handleAceChoice(acePrompt.handIndex, acePrompt.cardId, 1); actionTaken = true; }
        } else {
            if (key === 'h' && canHit) { handleHit(); actionTaken = true; }
            else if (key === 's' && canStand) { handleStand(); actionTaken = true; }
            else if (key === 'd' && canDouble) { handleDouble(); actionTaken = true; }
            else if (key === 'p' && canSplit) { handleSplit(); actionTaken = true; }
            else if (key === 'r' && canSurrender) { handleSurrender(); actionTaken = true; }
        }
    } else if (gameStatus === 'betting') {
        if (key === 'enter' && isHost) { handleDeal(); actionTaken = true; }
        else if (key === 'c') { handleClearBet(); actionTaken = true; }
        else if (key === 'l') { handleLockBet(); actionTaken = true; }
        else if (key === 'm') { handleMinBet(); actionTaken = true; }
        else if (key === 'x') { handleMaxBet(); actionTaken = true; }
        else if (key === '1') { handlePlaceBet(1); actionTaken = true; }
        else if (key === '5') { handlePlaceBet(5); actionTaken = true; }
        else if (key === '2' && key === '5') { handlePlaceBet(25); actionTaken = true; }
        else if (key === '1' && key === '0' && key === '0') { handlePlaceBet(100); actionTaken = true; }
    } else if (gameStatus === 'roundOver') {
        if (key === 'enter' && isHost) { handleNewRound(); actionTaken = true; }
    }

    if (actionTaken) {
        setHotkey(key.toUpperCase());
        setTimeout(() => setHotkey(null), 200);
    }
  }, [gameStatus, acePrompt, activePlayerId, player, canHit, canStand, canDouble, canSplit, canSurrender, isHost, handleAceChoice, handleHit, handleStand, handleDouble, handleSplit, handleSurrender, handleDeal, handleClearBet, handleLockBet, handleMinBet, handleMaxBet, handlePlaceBet, handleNewRound]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSendMessage = useCallback((message) => {
    sendChatMessage(message);
  }, []);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    // Room code copied - users can see this in the game log if needed
  };

  // Debug logging for game state
  useEffect(() => {
    console.log('🎮 GameRoom State Update:', {
      gameStatus,
      players,
      playersCount: Object.keys(players).length,
      playerIds: Object.keys(players),
      playerData: Object.values(players).map(p => {
        const mainBet = p.hands?.[0]?.bet || 0;
        const sideBetTotal = Object.values(p.sideBets || {}).reduce((sum, bet) => sum + bet, 0);
        const totalBet = mainBet + sideBetTotal;
        return {
          id: p.id,
          username: p.username,
          seatIndex: p.seatIndex,
          hasPlacedBet: p.hasPlacedBet,
          mainBet,
          sideBetTotal,
          totalBet
        };
      })
    });
  }, [players, gameStatus]);

  const playerSeats = useMemo(() => {
    console.log('🔍 PlayerSeats Debug:', { 
      players, 
      numSeats, 
      mainPlayerSeatIndex,
      playersCount: Object.keys(players).length,
      playerValues: Object.values(players),
      playersKeys: Object.keys(players)
    });
    
    return Array.from({ length: numSeats }, (_, index) => {
      const seatIndex = index;
      const playerState = Object.values(players).find(p => {
        console.log(`🔍 Checking player for seat ${seatIndex}:`, p, 'seatIndex:', p?.seatIndex);
        return p && p.seatIndex === seatIndex;
      });
      
      // Calculate totalBet for the player
      let enhancedPlayerState = null;
      if (playerState) {
        const mainBet = playerState.hands?.[0]?.bet || 0;
        const sideBetTotal = Object.values(playerState.sideBets || {}).reduce((sum, bet) => sum + bet, 0);
        const totalBet = mainBet + sideBetTotal;
        
        enhancedPlayerState = {
          ...playerState,
          totalBet
        };
      }
      
      const isMainPlayerSeat = seatIndex === mainPlayerSeatIndex;
      
      console.log(`🪑 Seat ${seatIndex}:`, { 
        playerState: enhancedPlayerState, 
        isMainPlayerSeat, 
        foundPlayer: !!playerState,
        playerSeatIndex: playerState?.seatIndex,
        playerUsername: playerState?.username,
        totalBet: enhancedPlayerState?.totalBet || 0
      });
      
      return {
        seatIndex,
        playerState: enhancedPlayerState,
        isTurn: (playerState?.id === activePlayerId && gameStatus === 'playing') || (adminTestingMode && playerState?.id === adminActivePlayer),
        isMainPlayerSeat: isMainPlayerSeat,
      };
    });
  }, [players, player, numSeats, mainPlayerSeatIndex, isMobile, activePlayerId]);
  
  // Track if hole card has been revealed to prevent it from flipping back
  const [holeCardRevealed, setHoleCardRevealed] = useState(false);
  
  // Update hole card revealed state
  useEffect(() => {
    const shouldShowHoleCard = ['dealer', 'roundOver'].includes(gameStatus) || 
      (dealerHand?.cards?.length >= 2 && gameStatus === 'playing' && !activePlayerId);
    
    if (shouldShowHoleCard && !holeCardRevealed) {
      setHoleCardRevealed(true);
    }
    
    // Reset for new rounds
    if (gameStatus === 'betting' || gameStatus === 'cardDealing') {
      setHoleCardRevealed(false);
    }
  }, [gameStatus, activePlayerId, dealerHand?.cards?.length, holeCardRevealed]);
  
  const showDealerHoleCard = holeCardRevealed || ['dealer', 'roundOver'].includes(gameStatus);

  const getDealerDisplayScore = () => {
    if (!dealerHand || !dealerHand.cards || dealerHand.cards.length === 0) return '—';
    
    // Always calculate the full score when hole card is revealed
    if (showDealerHoleCard) {
      return calculateScore(dealerHand.cards);
    }
    
    // If hole card is hidden, only show first card value
    return getCardValue(dealerHand.cards[0]);
  };

  return (
    <>
    <div className={`fixed inset-0 flex flex-col text-gray-300 transition-colors duration-500 overflow-hidden pointer-events-none ${tableColors[tableColorIndex]}`}>
      <div className="absolute inset-0 bg-black/20" />
      
      <header className="relative z-10 flex items-center justify-between p-4 bg-black/30 backdrop-blur-sm pointer-events-auto">
        <div className="flex items-center gap-4">
          <Button onClick={onBackToHome} variant="ghost" className="text-white hover:bg-white/20">
            <ArrowLeft size={20} className="mr-2" />
            {t('backToHome')}
          </Button>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300">{t('roomCode')}:</span>
            <Button onClick={copyRoomCode} variant="ghost" className="text-white hover:bg-white/20 font-mono text-lg">
              {roomCode}
              <Copy size={16} className="ml-2" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button onClick={() => setTableColorIndex((prev) => (prev + 1) % tableColors.length)} variant="ghost" className="text-white hover:bg-white/20" title={t('changeTableColor')}>
            🎨
          </Button>
          <Button onClick={toggleMute} variant="ghost" className="text-white hover:bg-white/20">
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </Button>
          <Button onClick={() => setRulesOpen(true)} variant="ghost" className="text-white hover:bg-white/20">
            <HelpCircle size={20} />
          </Button>
          <Button onClick={() => setLogOpen(true)} variant="ghost" className="text-white hover:bg-white/20">
            <History size={20} />
          </Button>
          <Button onClick={() => setChatOpen(true)} variant="ghost" className="text-white hover:bg-white/20">
            <MessageSquare size={20} />
          </Button>
        </div>
      </header>

      <main className="flex-1 relative p-4 pointer-events-auto">
        <div className="relative w-full max-w-6xl mx-auto h-full">
          {/* Dealer Title - Positioned higher up */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[100]">
            <div className="text-2xl font-bold text-white">Dealer</div>
          </div>

          {/* Dealer Section - Cards positioned with more space below title */}
          <div className="absolute top-16 left-1/2 transform -translate-x-1/2">
            <div className="text-center">
              <div className="relative flex justify-center mb-4" style={{ width: `${(dealerHand?.cards?.length || 1) * 40 + 65}px`, height: '147px' }}>
                {dealerHand?.cards?.map((card, index) => (
                  <div key={`dealer-${index}`} className="absolute" style={{ left: `${index * 40}px`, zIndex: 10 + index }}>
                    <PlayingCard
                      card={index === 1 && !showDealerHoleCard ? { suit: 'hidden', value: 'hidden' } : card}
                      hidden={index === 1 && !showDealerHoleCard}
                      isDealerCard={true}
                      cardIndex={index}
                      showDealerHoleCard={showDealerHoleCard}
                      className="transform hover:scale-105 transition-transform"
                    />
                  </div>
                ))}
              </div>
              {/* Dealer Score Pill - positioned just below dealer cards */}
              {dealerHand?.cards?.length > 0 && (
                <div className="bg-black/60 text-white text-lg font-bold px-4 py-2 rounded-full shadow-lg">
                  {getDealerDisplayScore()}
                </div>
              )}
            </div>
          </div>

          {/* Game Rules Display - Positioned well below dealer cards */}
          <div className="absolute top-80 left-1/2 transform -translate-x-1/2 text-center">
            <div className="text-white text-lg space-y-1">
              <div className="font-semibold">BLACKJACK PAYS 3:2</div>
              <div className="font-semibold">DEALER STANDS ON 17</div>
            </div>
          </div>

          {/* Player Seats */}
          <div className="relative">
            {playerSeats.map(({ seatIndex, playerState, isTurn, isMainPlayerSeat }) => (
              <PlayerSeat
                key={seatIndex}
                ref={(el) => (playerSeatRefs.current[seatIndex] = el)}
                seatIndex={seatIndex}
                playerState={playerState}
                isTurn={isTurn}
                isMainPlayerSeat={isMainPlayerSeat}
                gameStatus={gameStatus}
                activeHandIndex={activeHandIndex}
                acePrompt={acePrompt}
                onAceChoice={handleAceChoice}
                isMobile={isMobile}
                numSeats={numSeats}
                hotkey={hotkey}
                adminTestingMode={adminTestingMode}
                adminActivePlayer={adminActivePlayer}
                setAdminActivePlayer={setAdminActivePlayer}
              />
            ))}
          </div>

          {/* Side Bet Display */}
          {myPlayerState && !myPlayerState.isSpectating && (
            <SideBetDisplay
              sideBets={sideBets}
              gameStatus={gameStatus}
              isMobile={isMobile}
            />
          )}

          {/* Chip Animations */}
          <AnimatePresence>
            {chipAnimations.map((animation) => (
              <ChipAnimation
                key={animation.id}
                {...animation}
                onComplete={() => {
                  setChipAnimations(prev => prev.filter(a => a.id !== animation.id));
                }}
              />
            ))}
          </AnimatePresence>

          {/* Shuffle Animation */}
          <AnimatePresence>
            {showShuffleAnimation && (
              <ShuffleAnimation onComplete={() => setShowShuffleAnimation(false)} />
            )}
          </AnimatePresence>

          {/* Round Summary */}
        </div>
      </main>

      <footer className="relative z-10 p-4 bg-black/30 backdrop-blur-sm pointer-events-auto">
        <div className={`flex ${isMobile ? 'flex-col gap-4' : 'items-center justify-between'}`}>
          <div className="flex items-center gap-4">
            <BalanceDisplay balance={balance} currentBet={currentBet} />
            {isHost && gameMode === 'friend' && (
              <AdminMenu
                adminTestingMode={adminTestingMode}
                setAdminTestingMode={setAdminTestingMode}
                players={players}
                adminActivePlayer={adminActivePlayer}
                setAdminActivePlayer={setAdminActivePlayer}
              />
            )}
          </div>

          {myPlayerState && !myPlayerState.isSpectating && (
            <GameControls
              gameStatus={gameStatus} balance={balance} canHit={canHit} canStand={canStand} canDouble={canDouble}
              canSplit={canSplit} canSurrender={canSurrender} onHit={handleHit} onStand={handleStand}
              onDouble={handleDouble} onSplit={handleSplit} onSurrender={handleSurrender} onNewRound={handleNewRound}
              onPlaceBet={handlePlaceBet} onDeal={handleDeal} onClearBet={handleClearBet} onClearSideBet={handleClearSideBet}
              onLockBet={handleLockBet} myPlayerState={myPlayerState} isHost={isHost}
              currentBet={currentBet} sideBets={sideBets} hotkey={hotkey}
              isMobile={isMobile} onMinBet={handleMinBet} onMaxBet={handleMaxBet}
              onKeepSideBetsToggle={handleKeepSideBetsToggle} keepSideBets={keepSideBets}
              onKeepMainBetToggle={handleKeepMainBetToggle} keepMainBet={keepMainBet}
              showNewRoundButton={showNewRoundButton} activeHandIndex={activeHandIndex}
            />
          )}
          
          <div className={`flex items-center gap-2 ${isMobile ? 'absolute top-0 -translate-y-full right-2' : 'w-56 justify-end'}`}>
            {gameStatus === 'betting' && (
              <Button onClick={toggleSpectator} variant="ghost" className="bg-black/30 hover:bg-black/50 text-xs h-8 px-3">
                {myPlayerState?.isSpectating ? <Eye size={16} className="mr-2" /> : <EyeOff size={16} className="mr-2" />}
                {myPlayerState?.isSpectating ? "JOIN" : "SPECTATE"}
              </Button>
            )}
          </div>
        </div>
      </footer>
      <AnimatePresence>
        {chatOpen && player && <ChatWindow onClose={() => {
          setChatOpen(false);
        }} messages={messages} onSendMessage={handleSendMessage} playerUsername={player.username} isMobile={isMobile} />}
        {logOpen && <GameLog onClose={() => setLogOpen(false)} log={gameLog} roundCounter={roundCounter} isMobile={isMobile} />}
      </AnimatePresence>
    </div>
    <RulesModal isOpen={rulesOpen} onClose={() => setRulesOpen(false)} />
    </>
  );
};

export default GameRoom;