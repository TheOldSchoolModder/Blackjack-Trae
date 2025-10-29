
import React, { useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { AppContext } from '@/context/AppContext';
import PlayingCard from './PlayingCard';

const AceChoicePopover = ({ open, onChoice, children }) => {
    const isOpen = !!open;
    if (!isOpen) return children;

    return (
        <Popover open={isOpen} onOpenChange={() => {}}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent side="top" align="center" sideOffset={6} className="z-[60] w-auto p-2 bg-slate-900/90 backdrop-blur-sm border border-yellow-400 rounded-md shadow-lg">
                <div className="flex flex-col gap-2">
                    <p className="text-center text-xs font-bold text-white">Ace Value?</p>
                    <div className="flex gap-2">
                        <Button onClick={() => onChoice(1)} size="sm" className="w-12 h-8 bg-sky-600 hover:bg-sky-700">1</Button>
                        <Button onClick={() => onChoice(11)} size="sm" className="w-12 h-8 bg-green-600 hover:bg-green-700">11</Button>
                    </div>
                    <p className="text-[10px] text-gray-300 text-center">Press J=11, K=1</p>
                </div>
            </PopoverContent>
        </Popover>
    );
};

const PlayerSeat = React.forwardRef(({ 
  seatIndex,
  playerState,
  isTurn,
  isMainPlayerSeat,
  gameStatus,
  activeHandIndex,
  acePrompt,
  onAceChoice,
  isMobile,
  numSeats,
  hotkey,
  adminTestingMode,
  adminActivePlayer,
  setAdminActivePlayer,
  onManualAceChange
}, ref) => {
  const { player } = useContext(AppContext);
  
  console.log(`🪑 PlayerSeat ${seatIndex} Debug:`, { 
    playerState, 
    hasPlayerState: !!playerState,
    username: playerState?.username,
    totalBet: playerState?.totalBet,
    seatIndex: playerState?.seatIndex
  });
  
  // Calculate seat position based on seatIndex and numSeats
  const getSeatPosition = (seatIndex, numSeats, isMobile) => {
    const radius = isMobile ? 550 : 750; // Increased radius for wider horizontal spread
    const centerX = isMobile ? 200 : 512; // Center of typical screen width
    const centerY = isMobile ? -250 : -250; // Raised seats higher on the table (increased from previous values)
    
    // Distribute seats in a wider semi-circle with better horizontal spread
    const angleStart = Math.PI * 0.12; // Adjusted for better horizontal spread
    const angleEnd = Math.PI * 0.88;   // Adjusted for better horizontal spread
    const angleStep = (angleEnd - angleStart) / Math.max(1, numSeats - 1);
    const angle = angleStart + (seatIndex * angleStep);
    
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    
    return { left: `${x}px`, top: `${y}px` };
  };

  const position = getSeatPosition(seatIndex, numSeats, isMobile);
  
  // Check if player has split hands
  const hasSplitHands = playerState?.hands && playerState.hands.length > 1;
  
  // For split hands, show both hands side by side
  // For single hand, show the active hand or first hand
  const handsToDisplay = hasSplitHands ? playerState.hands : [playerState?.hands?.[isTurn ? activeHandIndex : 0]].filter(Boolean);

  return (
    <div ref={ref} className="absolute" style={{ left: position.left, top: position.top }}>
      {playerState ? (
        <div className="flex flex-col items-center select-none">
          {/* Player Status Indicator */}
          {isTurn && (
             <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-[90]">
               <div className="bg-yellow-400 text-black text-sm font-bold px-3 py-1 rounded-full shadow-lg animate-pulse">
                 {playerState.username === player?.username ? 'Your Turn' : `${playerState.username}'s Turn`}
               </div>
             </div>
           )}
          
          {/* Ready Status */}
          {(gameStatus === 'betting' || gameStatus === 'dealing') && playerState.hasPlacedBet && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-[85]">
              <div className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow">
                READY
              </div>
            </div>
          )}

          <div className={`relative ${hasSplitHands ? 'w-[340px]' : 'w-[160px]'} h-[200px]`}>
            {/* Display hands */}
            <div className={`absolute bottom-16 left-1/2 -translate-x-1/2 z-[80] pointer-events-auto ${hasSplitHands ? 'flex gap-8' : ''}`}>
              {handsToDisplay.map((hand, handIdx) => {
                if (!hand) return null;
                
                const cards = hand.cards || [];
                const currentScore = hand.score;
                // For split hands, find the actual index of this hand in the player's hands array
                const actualHandIndex = hasSplitHands ? playerState.hands.findIndex(h => h === hand) : handIdx;
                const isActiveHand = (hasSplitHands && actualHandIndex === activeHandIndex) || (!hasSplitHands && isTurn);
                
                return (
                  <div key={handIdx} className="relative flex flex-col items-center">
                    {/* Score pill above each hand - only show if cards are dealt */}
                    {typeof currentScore === 'number' && cards.length > 0 && (
                      <div className="mb-2 z-[85]">
                        <div className={`font-bold rounded-full px-3 py-1 text-sm shadow transition-all duration-300 ${
                          isActiveHand 
                            ? 'bg-yellow-400 text-black border-2 border-yellow-300 shadow-lg shadow-yellow-400/50 animate-pulse' 
                            : 'bg-black/60 text-white'
                        }`}>
                          {currentScore}
                        </div>
                      </div>
                    )}
                    
                    {/* Active hand indicator */}
                    {hasSplitHands && isActiveHand && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-[90]">
                        <div className="bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full shadow-lg animate-bounce">
                          ACTIVE
                        </div>
                      </div>
                    )}
                    
                    {/* Cards for this hand */}
                    <div className={`relative transition-all duration-300 ${
                      isActiveHand ? 'ring-2 ring-yellow-400 ring-opacity-75 rounded-lg shadow-lg shadow-yellow-400/30' : ''
                    }`} style={{ width: `${(cards.length - 1) * 40 + 105}px`, height: '147px' }}>
                      <AnimatePresence>
                        {cards.map((card, cardIndex) => {
                          const isCardWithPrompt = !!acePrompt && acePrompt.cardId === card.instanceId;
                          
                          return (
                            <AceChoicePopover
                              key={card.instanceId || card.id}
                              open={isCardWithPrompt}
                              onChoice={(value) => onAceChoice?.(actualHandIndex, card.instanceId, value)}
                            >
                              <PlayingCard
                                card={card}
                                isDealerCard={false}
                                isTurn={isTurn && isActiveHand}
                                onAceClick={(value) => onManualAceChange?.(actualHandIndex, card.instanceId, value)}
                                isAcePromptActive={isCardWithPrompt}
                                cardIndex={cardIndex}
                              />
                            </AceChoicePopover>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Username pill and bet amount just below cards */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[70] flex flex-col items-center gap-1">
              <div className="bg-black/60 text-white text-sm px-3 py-1 rounded-full shadow font-semibold">
                {playerState.username}
              </div>
              {/* Show bet amount if player has placed a bet */}
              {playerState.totalBet > 0 && (
                <div className="bg-yellow-600/80 text-white text-xs px-2 py-0.5 rounded-full shadow font-semibold">
                  ${playerState.totalBet}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="w-24 h-24 flex items-center justify-center text-gray-400">
          <div className="bg-gray-800/50 rounded-full w-16 h-16 flex items-center justify-center border-2 border-dashed border-gray-600">
            <UserPlus size={24} className="text-gray-500" />
          </div>
          <div className="absolute -bottom-6 text-xs text-gray-500">Empty Seat</div>
        </div>
      )}
    </div>
  );
});

PlayerSeat.displayName = 'PlayerSeat';

export default PlayerSeat;