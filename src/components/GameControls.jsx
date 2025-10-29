import React, { useEffect, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from '@/components/ui/label';
import StackedChipMenu from '@/components/StackedChipMenu';
import { Lock, Zap, Repeat, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useSound } from '@/hooks/useSound';

const Chip = ({ value, colorClass, onClick, betType, sideBetName = null }) => {
  const { playSound } = useSound();
  return (
    <motion.button 
      onClick={() => {
        onClick(value, betType, sideBetName);
        playSound('bet', { debounce: true });
      }} 
      whileTap={{ scale: 0.9 }}
      className={`chip ${colorClass}`}
      aria-label={`Chip ${value}`}
    >
      <span className="text-white text-xs font-bold pointer-events-none">{value}</span>
    </motion.button>
  );
};

const SideBetSection = ({ title, description, betAmount, onBet, onClear, chips, sideBetName }) => (
  <div className="grid gap-2">
    <Label className="col-span-2 text-base font-semibold text-yellow-300">{title}</Label>
    <div className="flex justify-between items-center bg-black/20 p-2 rounded-md">
      <div className="flex items-center gap-2">
        {chips.map(chip => <Chip key={chip.value} {...chip} onClick={onBet} betType="side" sideBetName={sideBetName} />)}
      </div>
      <div className="text-right">
        <span className="font-bold text-lg text-yellow-400">${betAmount}</span>
        {betAmount > 0 && 
          <Button variant="link" className="p-0 h-auto text-xs text-red-400" onClick={onClear}>Clear</Button>
        }
      </div>
    </div>
    <p className="text-xs text-gray-400 mt-1">{description}</p>
  </div>
);


const ActionButton = ({ children, hotkeyTrigger, ...props }) => {
  const controls = useAnimation();
  useEffect(() => {
    if (hotkeyTrigger) {
      controls.start({ scale: [1, 0.9, 1], transition: { duration: 0.2 } });
    }
  }, [hotkeyTrigger, controls]);

  return (
    <motion.div animate={controls} className="flex-1">
      <Button {...props}>{children}</Button>
    </motion.div>
  );
};

const GameControls = ({
  gameStatus,
  onHit, onStand, onDouble, onSplit, onSurrender, onNewRound, onPlaceBet, onDeal, onClearBet,
  onLockBet, myPlayerState, isHost,
  currentBet, sideBets,
  canHit, canStand, canDouble, canSplit, canSurrender,
  onClearSideBet,
  hotkey,
  isMobile,
  onMinBet,
  onMaxBet,
  onKeepSideBetsToggle,
  keepSideBets,
  onKeepMainBetToggle,
  keepMainBet,
  showNewRoundButton,
  activeHandIndex
}) => {
  // Removed debug logging to prevent console spam
  const [isLocking, setIsLocking] = useState(false);
  const { playSound } = useSound();
  const sideBetChips = [
    { value: 5, colorClass: 'chip-5' },
    { value: 10, colorClass: 'chip-10' },
    { value: 25, colorClass: 'chip-25' },
  ];
  
  const hasPlacedBet = myPlayerState?.hasPlacedBet || false;

  const handleLockBetClick = async () => {
    // Removed debug logging to prevent console spam
    setIsLocking(true);
    await onLockBet();
    playSound('click');
    setIsLocking(false);
  };
  
  const createSoundHandler = (handler, soundName) => () => {
    handler();
    playSound(soundName || 'click');
  };

  if (gameStatus === 'betting') {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className={`w-full ${isMobile ? 'space-y-4' : 'space-y-3'}`}
      >
        {/* Main Control Row */}
        <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-center gap-4'}`}>
          
          {/* Left Group: Side Bets & Clear */}
          <div className={`flex gap-2 ${isMobile ? 'order-1' : ''}`}>
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className="text-white bg-gradient-to-r from-slate-800 via-slate-900 to-black hover:from-slate-700 hover:via-slate-800 hover:to-slate-900 border-2 border-yellow-500/40 hover:border-yellow-400/60 shadow-lg hover:shadow-xl backdrop-blur-sm font-semibold transition-all duration-200 h-12 px-6 text-base flex-1 sm:flex-none min-w-[120px]" 
                  disabled={hasPlacedBet}
                >
                  <span className="text-yellow-300 drop-shadow-sm">Side Bets</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[90vw] max-w-[450px] bg-slate-900/90 backdrop-blur-sm border-yellow-500/30 text-white max-h-[70vh] overflow-y-auto">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium leading-none text-yellow-300">Automatic Bets</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Automatically place your bets from the previous round.
                    </p>
                  </div>
                  <div className="space-y-4">
                     <div className="flex items-center justify-between rounded-lg border p-4 bg-black/20">
                        <div className="space-y-0.5">
                          <Label htmlFor="keep-main-bet" className="text-base">Keep Main Bet</Label>
                          <p className="text-sm text-muted-foreground">Re-bet your previous main wager.</p>
                        </div>
                        <Switch id="keep-main-bet" checked={keepMainBet} onCheckedChange={onKeepMainBetToggle} />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-4 bg-black/20">
                        <div className="space-y-0.5">
                          <Label htmlFor="keep-side-bets" className="text-base">Keep Side Bets</Label>
                           <p className="text-sm text-muted-foreground">Re-bet your previous side bets.</p>
                        </div>
                        <Switch id="keep-side-bets" checked={keepSideBets} onCheckedChange={onKeepSideBetsToggle} />
                      </div>
                  </div>
                   <div className="border-t border-gray-600 my-4"></div>
                   <div className="space-y-2">
                      <h4 className="font-medium leading-none text-yellow-300">Side Bets</h4>
                       <p className="text-sm text-muted-foreground">Place optional side bets for a chance to win big.</p>
                  </div>
                  <div className="space-y-4">
                    <SideBetSection 
                        title="Perfect Pairs"
                        description="Pays if your first two cards are a pair. Mixed: 5:1, Colored: 10:1, Perfect: 25:1."
                        betAmount={sideBets.perfectPairs || 0}
                        onBet={onPlaceBet}
                        onClear={() => onClearSideBet('perfectPairs')}
                        chips={sideBetChips}
                        sideBetName="perfectPairs"
                    />
                    <SideBetSection 
                        title="21+3"
                        description="Bet on your first two cards and dealer's upcard forming a poker hand. Flush: 5:1, Straight: 10:1, Three of a Kind: 30:1, Straight Flush: 40:1."
                        betAmount={sideBets['21+3'] || 0}
                        onBet={onPlaceBet}
                        onClear={() => onClearSideBet('21+3')}
                        chips={sideBetChips}
                        sideBetName="21+3"
                    />
                    <SideBetSection 
                        title="Lucky Ladies"
                        description="Bet on your first two cards totaling 20. Any 20: 4:1, Suited 20: 10:1, Matched 20: 25:1, Two Queens of Hearts: 1000:1."
                        betAmount={sideBets.luckyLadies || 0}
                        onBet={onPlaceBet}
                        onClear={() => onClearSideBet('luckyLadies')}
                        chips={sideBetChips}
                        sideBetName="luckyLadies"
                    />
                    <SideBetSection 
                        title="Royal Match"
                        description="Bet on your first two cards being the same suit. Suited Match: 2.5:1, Royal Match (K-Q suited): 25:1."
                        betAmount={sideBets.royalMatch || 0}
                        onBet={onPlaceBet}
                        onClear={() => onClearSideBet('royalMatch')}
                        chips={sideBetChips}
                        sideBetName="royalMatch"
                    />
                    <SideBetSection 
                        title="Buster Blackjack"
                        description="Bet that the dealer will bust. Payouts increase with more cards: 3 cards: 1:1, 4 cards: 2:1, 5 cards: 4:1, 6 cards: 15:1, 7 cards: 50:1, 8+ cards: 200:1."
                        betAmount={sideBets.busterBlackjack || 0}
                        onBet={onPlaceBet}
                        onClear={() => onClearSideBet('busterBlackjack')}
                        chips={sideBetChips}
                        sideBetName="busterBlackjack"
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
            <Button 
              onClick={onClearBet} 
              variant="destructive" 
              className="bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:via-red-800 hover:to-red-900 text-white font-bold shadow-lg hover:shadow-xl border border-red-500/30 hover:border-red-400/50 transition-all duration-200 h-12 px-6 text-base flex-1 sm:flex-none min-w-[100px]" 
              disabled={hasPlacedBet}
            >
              <span className="drop-shadow-sm">CLEAR</span>
            </Button>
          </div>
          
          {/* Center Group: Betting Controls (MIN + Chips + MAX closer together) */}
          <div className={`flex items-center gap-1 ${isMobile ? 'order-2 justify-center' : ''}`}>
            <Button 
              onClick={createSoundHandler(onMinBet, 'bet')} 
              variant="outline" 
              className="bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 hover:from-gray-600 hover:via-gray-700 hover:to-gray-800 text-white font-bold border-2 border-gray-500/40 hover:border-gray-400/60 shadow-lg hover:shadow-xl transition-all duration-200 h-12 px-3 text-sm min-w-[50px]" 
              disabled={hasPlacedBet}
            >
              <span className="drop-shadow-sm">MIN</span>
            </Button>
            
            <StackedChipMenu onPlaceBet={onPlaceBet} disabled={hasPlacedBet} />
            
            <Button 
              onClick={createSoundHandler(onMaxBet, 'bet')} 
              variant="outline" 
              className="bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 hover:from-gray-600 hover:via-gray-700 hover:to-gray-800 text-white font-bold border-2 border-gray-500/40 hover:border-gray-400/60 shadow-lg hover:shadow-xl transition-all duration-200 h-12 px-3 text-sm min-w-[50px]" 
              disabled={hasPlacedBet}
            >
              <span className="drop-shadow-sm">MAX</span>
            </Button>
          </div>
          
          {/* Right Group: Lock Bet + Force Start */}
          <div className={`flex gap-2 ${isMobile ? 'order-3' : ''}`}>
            <Button 
              onClick={handleLockBetClick} 
              disabled={currentBet < 10 || hasPlacedBet || isLocking} 
              className={`bg-gradient-to-r from-green-600 via-green-700 to-green-800 hover:from-green-700 hover:via-green-800 hover:to-green-900 text-white font-bold shadow-lg hover:shadow-xl border border-green-500/30 hover:border-green-400/50 transition-all duration-200 disabled:from-gray-600 disabled:via-gray-700 disabled:to-gray-800 disabled:border-gray-500/30 h-12 px-6 text-base ${isMobile ? 'flex-1' : 'min-w-[120px]'}`}
            >
              {isLocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin drop-shadow-sm" /> : <Lock className="mr-2 h-4 w-4 drop-shadow-sm" />}
              <span className="drop-shadow-sm">
                {hasPlacedBet ? 'BET LOCKED' : (isLocking ? 'LOCKING...' : 'LOCK BET')}
              </span>
            </Button>
            
            {isHost && (
              <>
                {showNewRoundButton && (
                  <Button 
                    onClick={onNewRound} 
                    className="bg-gradient-to-r from-green-600 via-green-700 to-green-800 hover:from-green-700 hover:via-green-800 hover:to-green-900 text-white font-bold shadow-lg hover:shadow-xl border border-green-500/30 hover:border-green-400/50 transition-all duration-200 h-12 px-4 text-sm"
                  >
                    <Repeat className="mr-1 h-4 w-4 drop-shadow-sm" /> NEW ROUND
                  </Button>
                )}
                <Button 
                  onClick={() => onDeal(true)} 
                  className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 hover:from-blue-700 hover:via-blue-800 hover:to-blue-900 text-white font-bold shadow-lg hover:shadow-xl border border-blue-500/30 hover:border-blue-400/50 transition-all duration-200 h-12 px-4 text-sm"
                >
                  <Zap className="mr-1 h-4 w-4 drop-shadow-sm" /> START
                </Button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  if (gameStatus === 'playing') {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="flex flex-col sm:flex-row gap-3 justify-center w-full max-w-4xl mx-auto px-4"
      >
        <ActionButton 
          onClick={createSoundHandler(onSurrender)} 
          disabled={!canSurrender} 
          className="bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 hover:from-slate-500 hover:via-slate-600 hover:to-slate-700 border border-slate-500/30 hover:border-slate-400/50 text-white font-bold shadow-lg hover:shadow-xl backdrop-blur-sm transition-all duration-300 disabled:from-gray-600 disabled:via-gray-700 disabled:to-gray-800 disabled:opacity-40 disabled:cursor-not-allowed w-full h-14 text-sm rounded-xl" 
          hotkeyTrigger={hotkey === 'u'}
        >
          <div className="flex flex-col items-center gap-1">
            <span className="text-base font-bold drop-shadow-sm">Surr</span>
            <span className="text-xs opacity-80">(U)</span>
          </div>
        </ActionButton>
        
        <ActionButton 
          onClick={createSoundHandler(onHit, 'card')} 
          disabled={!canHit} 
          className="bg-gradient-to-br from-green-600 via-green-700 to-green-800 hover:from-green-500 hover:via-green-600 hover:to-green-700 border border-green-500/30 hover:border-green-400/50 text-white font-bold shadow-lg hover:shadow-xl backdrop-blur-sm transition-all duration-300 disabled:from-gray-600 disabled:via-gray-700 disabled:to-gray-800 disabled:opacity-40 disabled:cursor-not-allowed w-full h-14 text-sm rounded-xl" 
          hotkeyTrigger={hotkey === 'h'}
        >
          <div className="flex flex-col items-center gap-1">
            <span className="text-base font-bold drop-shadow-sm">Hit</span>
            <span className="text-xs opacity-80">(H)</span>
          </div>
        </ActionButton>
        
        <ActionButton 
          onClick={createSoundHandler(onStand)} 
          disabled={!canStand} 
          className="bg-gradient-to-br from-red-600 via-red-700 to-red-800 hover:from-red-500 hover:via-red-600 hover:to-red-700 border border-red-500/30 hover:border-red-400/50 text-white font-bold shadow-lg hover:shadow-xl backdrop-blur-sm transition-all duration-300 disabled:from-gray-600 disabled:via-gray-700 disabled:to-gray-800 disabled:opacity-40 disabled:cursor-not-allowed w-full h-14 text-sm rounded-xl" 
          hotkeyTrigger={hotkey === 's'}
        >
          <div className="flex flex-col items-center gap-1">
            <span className="text-base font-bold drop-shadow-sm">Stand</span>
            <span className="text-xs opacity-80">(S)</span>
          </div>
        </ActionButton>
        
        <ActionButton 
          onClick={createSoundHandler(onDouble, 'bet')} 
          disabled={!canDouble} 
          className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 hover:from-blue-500 hover:via-blue-600 hover:to-blue-700 border border-blue-500/30 hover:border-blue-400/50 text-white font-bold shadow-lg hover:shadow-xl backdrop-blur-sm transition-all duration-300 disabled:from-gray-600 disabled:via-gray-700 disabled:to-gray-800 disabled:opacity-40 disabled:cursor-not-allowed w-full h-14 text-sm rounded-xl" 
          hotkeyTrigger={hotkey === 'd'}
        >
          <div className="flex flex-col items-center gap-1">
            <span className="text-base font-bold drop-shadow-sm">Double</span>
            <span className="text-xs opacity-80">(D)</span>
          </div>
        </ActionButton>
        
        <ActionButton 
          onClick={createSoundHandler(onSplit, 'deal')} 
          disabled={!canSplit} 
          className="bg-gradient-to-br from-amber-500 via-yellow-600 to-orange-600 hover:from-amber-400 hover:via-yellow-500 hover:to-orange-500 border border-amber-400/30 hover:border-amber-300/50 text-white font-bold shadow-lg hover:shadow-xl backdrop-blur-sm transition-all duration-300 disabled:from-gray-600 disabled:via-gray-700 disabled:to-gray-800 disabled:opacity-40 disabled:cursor-not-allowed w-full h-14 text-sm rounded-xl" 
          hotkeyTrigger={hotkey === 'p'}
        >
          <div className="flex flex-col items-center gap-1">
            <span className="text-base font-bold drop-shadow-sm">Split</span>
            <span className="text-xs opacity-80">(P)</span>
          </div>
        </ActionButton>
      </motion.div>
    );
  }
  
  if (gameStatus === 'dealing' || gameStatus === 'cardDealing') {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="flex justify-center w-full max-w-4xl mx-auto px-4"
      >
        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-sm border border-blue-500/30 rounded-xl px-6 py-4 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
            <span className="text-blue-300 font-semibold text-lg">Dealing Cards...</span>
          </div>
        </div>
      </motion.div>
    );
  }

  if (gameStatus === 'roundOver') {
    return (
       <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 w-full">
        <div className="bg-gradient-to-r from-green-600/20 to-blue-600/20 backdrop-blur-sm border border-green-500/30 rounded-xl px-6 py-4 text-center">
          <span className="text-green-300 font-semibold text-lg">Round Complete!</span>
        </div>
      </motion.div>
    )
  }

  return null;
};

export default React.memo(GameControls);
