
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getSocket, updateGameState, subscribeToGameUpdates } from '@/lib/socketClient';
import { toast } from '@/components/ui/use-toast';
import { API_ENDPOINTS } from '@/config/api';

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const MIN_BET = 10;

const createDeck = () => SUITS.flatMap(suit => VALUES.map(value => ({ value, suit, id: `${value}-${suit}` })));

const shuffleDeck = deck => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const checkStraight = (values) => {
    const numericValues = values.map(v => {
        if (v === 'A') return 1;
        if (v === 'J') return 11;
        if (v === 'Q') return 12;
        if (v === 'K') return 13;
        return parseInt(v, 10);
    }).sort((a, b) => a - b);
    
    // Check for consecutive values
    for (let i = 0; i < numericValues.length - 1; i++) {
        if (numericValues[i + 1] - numericValues[i] !== 1) {
            return false;
        }
    }
    return true;
};

const getCardValue = (card, currentScore = 0) => {
    if (!card) return 0;
    if (['J', 'Q', 'K'].includes(card.value)) return 10;
    if (card.value === 'A') {
        if (card.chosenValue) return card.chosenValue;
        return currentScore + 11 > 21 ? 1 : 11;
    }
    return parseInt(card.value, 10);
};

const calculateScore = (hand, allowAutoAssignment = true) => {
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

    // Add flexible aces, starting with 11
    for (const ace of flexibleAces) {
        // If auto-assignment is disabled (for initial deals), just use 11 for calculation
        if (!allowAutoAssignment) {
            score += 11; // Use 11 for calculation but don't set chosenValue
        } else {
            // Normal behavior - set chosenValue
            if (!ace.chosenValue) {
                ace.chosenValue = 11;
            }
            score += ace.chosenValue;
        }
    }

    // If bust and auto-assignment is allowed, downgrade flexible aces from 11 to 1
    if (allowAutoAssignment) {
        let i = 0;
        while (score > 21 && i < flexibleAces.length) {
            if (flexibleAces[i].chosenValue === 11) {
                flexibleAces[i].chosenValue = 1;
                score -= 10;
            }
            i++;
        }
    }

    return score;
};


export const useBlackjackGame = (gameMode, roomCode, player, initialBalance, playSound, updatePlayerBalance) => {
    console.log('🚀 useBlackjackGame hook called with:', { gameMode, roomCode, playerId: player?.id, gameStatus: 'initializing' });
    // Memoize initial state to prevent unnecessary re-renders
    const initialState = useMemo(() => ({
        players: {},
        dealerHand: { cards: [], score: 0 },
        gameStatus: 'loading',
        activePlayerId: null,
        activeHandIndex: 0,
        balance: initialBalance,
        roundResult: null,
        gameLog: [],
        roundCounter: 0,
        keepSideBets: false,
        keepMainBet: false,
        deck: [],
        acePrompt: null
    }), [initialBalance]);
    
    const [players, setPlayers] = useState(initialState.players);
    const [dealerHand, setDealerHand] = useState(initialState.dealerHand);
    const [gameStatus, setGameStatus] = useState(initialState.gameStatus);
    const [activePlayerId, setActivePlayerId] = useState(initialState.activePlayerId);
    const [activeHandIndex, setActiveHandIndex] = useState(initialState.activeHandIndex);
    const [balance, setBalance] = useState(initialState.balance);
    const [roundResult, setRoundResult] = useState(initialState.roundResult);
    const [gameLog, setGameLog] = useState(initialState.gameLog);
    const [roundCounter, setRoundCounter] = useState(initialState.roundCounter);
    const [keepSideBets, setKeepSideBets] = useState(initialState.keepSideBets);
    const [keepMainBet, setKeepMainBet] = useState(initialState.keepMainBet);
    const [deck, setDeck] = useState(initialState.deck);
    const [acePrompt, setAcePrompt] = useState(initialState.acePrompt);
    
    // Memoize derived values to prevent unnecessary re-calculations
    const isHost = useMemo(() => player && players[player.id]?.isHost, [player, players]);
    const myPlayerState = useMemo(() => player ? players[player.id] : null, [player, players]);
    const playersCount = useMemo(() => Object.keys(players).length, [players]);
    
    // Removed debug logging to prevent console spam
    const gameChannelRef = useRef(null);
    const roundEndTimeoutRef = useRef(null);
    const dealerTurnInProgress = useRef(false);
    const dealInProgress = useRef(false);
    const processingRoundEnd = useRef(false);
    const lastRoundEndTime = useRef(0);
    
    const logEvent = useCallback((message, details = {}, username = null) => {
        setGameLog(prev => [{ timestamp: new Date(), message, details, username }, ...prev].slice(0, 100));
    }, []);
    
    // Optimized throttle server updates with better state comparison
    const lastUpdateRef = useRef(0);
    const lastStateRef = useRef(null);
    const updateGameStateOnServer = useCallback(async (newState) => {
        if (gameMode !== 'friend') return;
        
        // Prevent server updates during round end processing to avoid socket loops
        if (processingRoundEnd.current) {
            return;
        }
        
        // More aggressive throttling during round transitions - minimum 500ms between updates
        const now = Date.now();
        const minDelay = (newState.status === 'dealer' || newState.status === 'roundOver') ? 500 : 200;
        if (now - lastUpdateRef.current < minDelay) {
            return;
        }
        
        // Improved state comparison to prevent duplicate updates
        const stateKey = JSON.stringify({
            status: newState.status,
            activePlayerId: newState.activePlayerId,
            activeHandIndex: newState.activeHandIndex,
            playersCount: Object.keys(newState.players || {}).length,
            roundCounter: newState.roundCounter,
            dealerScore: newState.dealer?.score || 0
        });
        
        if (lastStateRef.current === stateKey) {
            return;
        }
        
        lastUpdateRef.current = now;
        lastStateRef.current = stateKey;
        
        // Ensure we have required fields to prevent undefined values
        const stateToSend = {
            ...newState,
            status: newState.status || gameStatus,
            activePlayerId: newState.activePlayerId !== undefined ? newState.activePlayerId : activePlayerId,
            activeHandIndex: newState.activeHandIndex !== undefined ? newState.activeHandIndex : activeHandIndex,
            roundCounter: newState.roundCounter !== undefined ? newState.roundCounter : roundCounter
        };
        
        try {
          updateGameState(roomCode, stateToSend);
        } catch(e) {
          console.error("Error updating game state:", e);
        }
    }, [gameMode, roomCode, gameStatus, activePlayerId, activeHandIndex, roundCounter]);
    
    const resetForNewRound = useCallback((currentState, skipServerUpdate = false) => {
        console.log('🔄 resetForNewRound called with:', { 
            skipServerUpdate, 
            playersCount: Object.keys(currentState.players || {}).length,
            roundCounter: currentState.roundCounter 
        });
        
        try {
            processingRoundEnd.current = false;
            dealInProgress.current = false;
            dealerTurnInProgress.current = false;
            roundEndProcessedRef.current = false;
            roundEndCompleteRef.current = false;
            
            console.log('🔄 Resetting player states...');
            const nextRoundPlayers = JSON.parse(JSON.stringify(currentState.players || {}));
            for (const pid in nextRoundPlayers) {
                const p = nextRoundPlayers[pid];
                if (!p.isSpectating) {
                    const existingBet = keepMainBet ? p.hands?.[0]?.bet || 0 : 0;
                    const existingSideBets = keepSideBets ? p.sideBets || {} : {};
                    
                    p.hands = [{ cards: [], score: 0, bet: existingBet, status: 'betting' }];
                    p.sideBets = existingSideBets;
                    p.hasPlacedBet = false;
                }
                p.result = null;
            }

            const newState = {
                players: nextRoundPlayers,
                dealer: { cards: [], score: 0 },
                status: 'betting',
                activePlayerId: null,
                activeHandIndex: 0,
                roundCounter: (currentState.roundCounter || 0) + 1,
                deck: [],
            };
            
            console.log('🔄 New state prepared, updating server...');
            // Update server state first if needed
            if (gameMode === 'friend' && !skipServerUpdate) {
                updateGameStateOnServer({
                    ...newState,
                    // Don't clear roundResult immediately - let UI process it first
                });
            }
            
            console.log('🔄 Scheduling local state update...');
            // Update local state in a batch to prevent temporary empty states
            setTimeout(() => {
                console.log('🔄 resetForNewRound - updating local state');
                setActivePlayerId(newState.activePlayerId);
                setActiveHandIndex(newState.activeHandIndex);
                setRoundCounter(newState.roundCounter);
                setDeck(newState.deck);
                console.log('✅ Local state update completed (except players, dealer, gameStatus)');
            }, 100);
            
            // Delay clearing cards to allow round summary to display properly
            setTimeout(() => {
                console.log('🔄 resetForNewRound - clearing cards');
                setPlayers(newState.players);
                setDealerHand(newState.dealer);
            }, 6000); // Increased from 3000ms to 6000ms to allow round summary to display
            
            // Delay gameStatus change to allow RoundSummary to display properly
            setTimeout(() => {
                console.log('🔄 resetForNewRound - updating gameStatus to betting');
                setGameStatus(newState.status);
                
                // Clear the auto-deal trigger flags to prevent immediate dealing
                setTimeout(() => {
                    console.log('🔄 Clearing auto-deal flags after gameStatus change');
                    dealInProgress.current = false;
                    processingRoundEnd.current = false;
                    
                    // Add additional delay to ensure betting phase is fully established
                    setTimeout(() => {
                        console.log('🔄 Betting phase fully established - auto-deal can now trigger if conditions are met');
                    }, 2000); // 2 second buffer for betting phase to be established
                }, 500); // Small delay to ensure gameStatus change is processed
            }, 12000); // Increased from 9000ms to 12000ms to allow round summary to display properly
            
            // Clear roundResult after RoundSummary has had time to display
            setTimeout(() => {
                setRoundResult(null);
            }, 13000); // Increased from 10000ms to 13000ms to match the gameStatus delay

            logEvent('New round started', { round: newState.roundCounter }, 'System');
            console.log('✅ resetForNewRound completed successfully');
        } catch (error) {
            console.error('❌ Error in resetForNewRound:', error);
            throw error; // Re-throw to be caught by the calling function
        }
    }, [logEvent, gameMode, keepMainBet, keepSideBets, updateGameStateOnServer]);
    
    const handleNextPlayer = useCallback((currentPlayerId, currentHandIndex) => {
        // Removed debug logging to prevent console spam
        
        // Use a callback to get the most recent players state
        setPlayers(currentPlayers => {
            const playerIds = Object.keys(currentPlayers).filter(p => currentPlayers[p] && !currentPlayers[p].isSpectating);
            const currentPlayer = currentPlayers[currentPlayerId];
        // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam

            if (currentPlayer && currentHandIndex < currentPlayer.hands.length - 1) {
        // Removed debug logging to prevent console spam
                setActiveHandIndex(currentHandIndex + 1);
                return currentPlayers; // No change to players state
            }

            const currentIndex = playerIds.indexOf(String(currentPlayerId));
            let nextPlayerId = null;
        // Removed debug logging to prevent console spam
            
            if (currentIndex !== -1) {
                // Look for the next player who has at least one hand still playing
                for (let i = currentIndex + 1; i < playerIds.length; i++) {
                    const pid = playerIds[i];
                    const player = currentPlayers[pid];
                    // Removed debug logging to prevent console spam
                    if (player && player.hands.some(h => h.status === 'playing')) {
                        nextPlayerId = pid;
        // Removed debug logging to prevent console spam
                        break;
                    }
                }
                
                // If no next player found after current, check from the beginning (wrap around)
                if (!nextPlayerId) {
        // Removed debug logging to prevent console spam
                    for (let i = 0; i < currentIndex; i++) {
                        const pid = playerIds[i];
                        const player = currentPlayers[pid];
                        // Removed debug logging to prevent console spam
                        if (player && player.hands.some(h => h.status === 'playing')) {
                            nextPlayerId = pid;
        // Removed debug logging to prevent console spam
                            break;
                        }
                    }
                }
            }
            
        // Removed debug logging to prevent console spam
            
            // If no next player found, check if ALL players have finished their turns
            let allPlayersFinished = false;
            if (!nextPlayerId) {
        // Removed debug logging to prevent console spam
                allPlayersFinished = playerIds.every(pid => {
                    const player = currentPlayers[pid];
                    const playerFinished = player && player.hands.every(h => h.status !== 'playing');
        // Removed debug logging to prevent console spam
                    return playerFinished;
                });
        // Removed debug logging to prevent console spam
            }
            
            const newStatus = nextPlayerId ? 'playing' : (allPlayersFinished ? 'dealer' : 'playing');
            const nextHandIndex = nextPlayerId ? currentPlayers[nextPlayerId].hands.findIndex(h => h.status === 'playing') : 0;
            const nextActivePlayerId = allPlayersFinished ? null : nextPlayerId;
            
        // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam

            if (gameMode === 'friend') {
        // Removed debug logging to prevent console spam
                // Removed debug logging to prevent console spam
                // In friend mode, update server state and let the socket listener handle local state updates
                // This ensures all clients receive the same state update simultaneously
                updateGameStateOnServer({ 
                    players: currentPlayers, 
                    dealer: dealerHand, 
                    status: newStatus, 
                    activePlayerId: nextActivePlayerId, 
                    activeHandIndex: nextHandIndex, 
                    roundCounter, 
                    deck 
                });
                
                // Don't update local state here in friend mode - let the socket update handle it
                // This prevents race conditions and ensures all players see the same state
        // Removed debug logging to prevent console spam
            } else {
        // Removed debug logging to prevent console spam
                setGameStatus(newStatus);
                setActivePlayerId(nextActivePlayerId);
                setActiveHandIndex(nextHandIndex);
            }
            
            return currentPlayers; // Return the current state unchanged
        });
    }, [dealerHand, roundCounter, deck, gameMode, updateGameStateOnServer]);

    const handleDeal = useCallback((force = false) => {
        console.log('🎲 handleDeal called:', { gameStatus, force, dealInProgress: dealInProgress.current });
        
        if (gameStatus !== 'betting' && gameStatus !== 'dealing') {
            console.log('❌ handleDeal rejected: wrong gameStatus');
            return;
        }
        
        // Reset dealInProgress if it's stuck
        if (dealInProgress.current && gameStatus === 'dealing') {
            console.log('🔄 Resetting stuck dealInProgress');
            dealInProgress.current = false;
        }
        
        if (dealInProgress.current) {
            console.log('❌ handleDeal rejected: dealInProgress is true');
            return;
        }
    
        const activePlayersList = Object.values(players).filter(p => p && !p.isSpectating && p.hands?.[0]?.bet >= MIN_BET);
        const allBetsPlaced = activePlayersList.length > 0 && activePlayersList.every(p => p.hasPlacedBet);
        
        // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam
        
        if (!allBetsPlaced && !force) {
        // Removed debug logging to prevent console spam
            return;
        }
        
        // Removed debug logging to prevent console spam
        dealInProgress.current = true;
        
        // First, trigger the shuffle animation by setting status to 'dealing'
        setGameStatus('dealing');
        playSound('shuffle');
        
        // Wait for shuffle animation to complete (2000ms) before preparing cards
        setTimeout(() => {
        // Removed debug logging to prevent console spam
            
            // Change status to 'cardDealing' to hide shuffle animation but show we're still dealing
            setGameStatus('cardDealing');
            
            let newDeck = shuffleDeck(createDeck());
        
            const playerIdsInOrder = Object.keys(players).filter(pid => players[pid] && !players[pid].isSpectating && players[pid].hands?.[0]?.bet >= MIN_BET);
        // Removed debug logging to prevent console spam
            
            let tempPlayers = JSON.parse(JSON.stringify(players));
            Object.values(tempPlayers).forEach(p => {
              if(!p.isSpectating) {
                p.hands = [{ cards: [], bet: p.hands?.[0]?.bet || 0, status: 'playing' }];
              }
            });
            
            let tempDealerHand = { cards: [], score: 0 };
            
            // Now start card dealing
        // Removed debug logging to prevent console spam
            
            let dealIndex = 0;
            let completionTriggered = false; // Flag to prevent duplicate completion
            const totalCards = (playerIdsInOrder.length + 1) * 2; // +1 for dealer, *2 for two rounds
        
        const dealNextCard = () => {
            if (dealIndex >= totalCards) {
                // All cards dealt, finalize the round
                if (completionTriggered) return; // Prevent duplicate completion
                completionTriggered = true;
        // Removed debug logging to prevent console spam
                
                // Calculate scores
                Object.values(tempPlayers).forEach(p => { 
                    if (p.hands && p.hands[0]) {
                        p.hands[0].score = calculateScore(p.hands[0].cards, false);
                    }
                });
                tempDealerHand.score = calculateScore(tempDealerHand.cards, false);
                
                const firstPlayerId = playerIdsInOrder.find(pid => tempPlayers[pid] && !tempPlayers[pid].isSpectating);
                const newStatus = firstPlayerId ? 'playing' : 'dealer';

        // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam

                const finalState = { 
                    players: tempPlayers, 
                    dealer: tempDealerHand, 
                    status: newStatus, 
                    activePlayerId: firstPlayerId || null, 
                    activeHandIndex: 0, 
                    roundCounter, 
                    deck: newDeck 
                };
                
                if (gameMode === 'friend') updateGameStateOnServer(finalState);

                setPlayers(finalState.players);
                setDealerHand(finalState.dealer);
                setDeck(finalState.deck);
                setGameStatus(newStatus);
                setActivePlayerId(finalState.activePlayerId);
                setActiveHandIndex(0);
                
                logEvent("Round started. Cards dealt.", { dealerCard: tempDealerHand.cards[0]?.value }, 'Dealer');
                dealInProgress.current = false;
                
                // Post-deal Ace check
                if (firstPlayerId === player.id) {
                    const firstPlayerHand = finalState.players[firstPlayerId].hands[0];
                    const aceInHand = firstPlayerHand.cards.find(c => c.value === 'A' && !c.chosenValue);
        // Removed debug logging to prevent console spam
                    if (aceInHand) {
        // Removed debug logging to prevent console spam
                        setAcePrompt({ handIndex: 0, cardId: aceInHand.instanceId });
                    }
                }
                return;
            }
            
            const isFirstRound = dealIndex < (playerIdsInOrder.length + 1);
            const cardNumber = isFirstRound ? 1 : 2;
            
            if (isFirstRound) {
                // First round: dealer first, then players
                if (dealIndex === 0) {
                    // Deal to dealer
                    const dealerCard = newDeck.pop();
                    dealerCard.instanceId = `${dealerCard.id}-${Math.random()}-dealer${cardNumber}`;
                    tempDealerHand.cards.push(dealerCard);
        // Removed debug logging to prevent console spam
                } else {
                    // Deal to player
                    const playerIndex = dealIndex - 1;
                    const pid = playerIdsInOrder[playerIndex];
                    const playerCard = newDeck.pop();
                    playerCard.instanceId = `${playerCard.id}-${Math.random()}-${pid}${cardNumber}`;
                    tempPlayers[pid].hands[0].cards.push(playerCard);
        // Removed debug logging to prevent console spam
                }
            } else {
                // Second round: dealer first, then players
                const secondRoundIndex = dealIndex - (playerIdsInOrder.length + 1);
                if (secondRoundIndex === 0) {
                    // Deal second card to dealer
                    const dealerCard = newDeck.pop();
                    dealerCard.instanceId = `${dealerCard.id}-${Math.random()}-dealer${cardNumber}`;
                    tempDealerHand.cards.push(dealerCard);
        // Removed debug logging to prevent console spam
                } else {
                    // Deal second card to player
                    const playerIndex = secondRoundIndex - 1;
                    const pid = playerIdsInOrder[playerIndex];
                    const playerCard = newDeck.pop();
                    playerCard.instanceId = `${playerCard.id}-${Math.random()}-${pid}${cardNumber}`;
                    tempPlayers[pid].hands[0].cards.push(playerCard);
        // Removed debug logging to prevent console spam
                }
            }
            
            // Update state after each card
            setPlayers({...tempPlayers});
            setDealerHand({...tempDealerHand});
            setDeck([...newDeck]);
            
            playSound('deal');
            dealIndex++;
            
            // Check if this was the last card
            const isLastCard = dealIndex === (playerIdsInOrder.length * 2 + 1);
            if (isLastCard && !completionTriggered) {
                // All cards dealt, finish the dealing process
                setTimeout(() => {
                    console.log('🎯 Last card dealt, triggering completion logic');
                    dealNextCard(); // This will trigger the completion logic
                }, 100);
            } else if (!isLastCard) {
                // Send server update only every 2 cards to reduce visual loops while maintaining sync
                if (gameMode === 'friend' && roomCode && dealIndex % 2 === 0) {
                    const currentState = {
                        players: tempPlayers,
                        dealer: tempDealerHand,
                        status: 'cardDealing',
                        activePlayerId: null,
                        activeHandIndex: 0,
                        roundCounter,
                        deck: newDeck
                    };
                    updateGameStateOnServer(currentState);
                }
                
                // Schedule next card with delay
                setTimeout(dealNextCard, 800); // 800ms delay between cards for smoother animation
            }
        };
        
        // Start dealing
        dealNextCard();
        }, 2000); // Wait exactly 2000ms for shuffle animation to complete

    }, [players, gameStatus, roundCounter, playSound, gameMode, updateGameStateOnServer, logEvent, player]);
    
    const handleHit = useCallback((isDoubleDown = false) => {
        // Removed debug logging to prevent console spam
        
        if (gameStatus !== 'playing' || String(activePlayerId) !== String(player?.id)) {
        // Removed debug logging to prevent console spam
            return;
        }
        
        // Removed debug logging to prevent console spam
        
        let newDeck = [...deck];
        const newCard = newDeck.pop();
        if (!newCard) return;

        newCard.instanceId = `${newCard.id}-${Math.random()}`;
        playSound('deal');

        const newPlayers = JSON.parse(JSON.stringify(players));
        const playerState = newPlayers[player.id];
        const hand = playerState.hands[activeHandIndex];
        
        // Removed debug logging to prevent console spam
        hand.cards.push(newCard);
        // Removed debug logging to prevent console spam

        // Auto-downgrade chosen aces if bust
        let currentScore = calculateScore(hand.cards);
        if (currentScore > 21) {
            for (let i = hand.cards.length - 1; i >= 0; i--) {
                const c = hand.cards[i];
                if (c.value === 'A' && c.chosenValue === 11) {
                    c.chosenValue = 1;
                    currentScore = calculateScore(hand.cards);
                    if (currentScore <= 21) break;
                }
            }
        }
        
        if (newCard.value === 'A' && !newCard.chosenValue) {
        // Removed debug logging to prevent console spam
            // Store the double down flag for later use
            if (isDoubleDown) {
        // Removed debug logging to prevent console spam
                newPlayers[player.id].hands[activeHandIndex].pendingDoubleDown = true;
            }
            setAcePrompt({ handIndex: activeHandIndex, cardId: newCard.instanceId });
            setPlayers(newPlayers);
            setDeck(newDeck);
        // Removed debug logging to prevent console spam
            return;
        }

        hand.score = calculateScore(hand.cards);
        // Removed debug logging to prevent console spam
        
        if (hand.score > 21) {
            hand.status = 'bust';
            playSound('lose');
            logEvent(`${player.username} busts with ${hand.score}`, { score: hand.score, cards: hand.cards.length }, player.username);
        // Removed debug logging to prevent console spam
        } else if (hand.score === 21 || isDoubleDown) {
            hand.status = 'stand';
            logEvent(isDoubleDown ? `${player.username} doubles down and gets ${newCard.value}` : `${player.username} hits and gets ${newCard.value}`, { 
                    card: newCard.value, 
                    newScore: hand.score, 
                    action: isDoubleDown ? 'double' : 'hit' 
                }, player.username);
        // Removed debug logging to prevent console spam
        }
        
        // Check if there's a next hand that needs a card (for split hands) when current hand is finished
        if (hand.status !== 'playing') {
            const nextHandIndex = activeHandIndex + 1;
            if (nextHandIndex < playerState.hands.length) {
                const nextHand = playerState.hands[nextHandIndex];
                // If the next hand only has one card, deal it a second card
                if (nextHand.cards.length === 1) {
                    const secondDeck = [...newDeck];
                    if (secondDeck.length > 0) {
                        const cardForNextHand = secondDeck.pop();
                        nextHand.cards.push(cardForNextHand);
                        nextHand.score = calculateScore(nextHand.cards);
                        setDeck(secondDeck);
                        playSound('deal');
                        newDeck = secondDeck; // Update the deck reference for server sync
                    }
                }
            }
        }
        
        // Removed debug logging to prevent console spam
        
        setPlayers(newPlayers);
        setDeck(newDeck);

        if (gameMode === 'friend') {
            const nextState = { players: newPlayers, deck: newDeck };
            updateGameStateOnServer({ ...nextState, dealer: dealerHand, status: gameStatus, activePlayerId, activeHandIndex, roundCounter });
        }
        
        if (hand.status !== 'playing') {
        // Removed debug logging to prevent console spam
            setTimeout(() => handleNextPlayer(player.id, activeHandIndex), 1000);
        }
    }, [player, players, dealerHand, gameStatus, roundCounter, activePlayerId, activeHandIndex, deck, playSound, logEvent, handleNextPlayer, gameMode, updateGameStateOnServer]);
    
    const handleStand = useCallback(() => {
        // Removed debug logging to prevent console spam
        
        if (gameStatus !== 'playing' || String(activePlayerId) !== String(player?.id)) {
        // Removed debug logging to prevent console spam
            return;
        }
        
        // Removed debug logging to prevent console spam
        
        const newPlayers = JSON.parse(JSON.stringify(players));
        const playerState = newPlayers[player.id];
        const hand = playerState.hands[activeHandIndex];
        hand.status = 'stand';
        
        // Check if there's a next hand that needs a card (for split hands)
        const nextHandIndex = activeHandIndex + 1;
        if (nextHandIndex < playerState.hands.length) {
            const nextHand = playerState.hands[nextHandIndex];
            // If the next hand only has one card, deal it a second card
            if (nextHand.cards.length === 1) {
                const newDeck = [...deck];
                if (newDeck.length > 0) {
                    const newCard = newDeck.pop();
                    nextHand.cards.push(newCard);
                    nextHand.score = calculateScore(nextHand.cards);
                    setDeck(newDeck);
                    playSound('deal');
                }
            }
        }
        
        logEvent(`${player.username} stands with ${hand.score}`, { score: hand.score, cards: hand.cards.length }, player.username);
        setPlayers(newPlayers);
        setAcePrompt(null);

        // Don't update server here - let handleNextPlayer do it with the correct turn progression
        // The handleNextPlayer function will handle both local state and server updates properly
        setTimeout(() => handleNextPlayer(player.id, activeHandIndex), 500);

    }, [player, players, dealerHand, gameStatus, roundCounter, activePlayerId, activeHandIndex, deck, logEvent, handleNextPlayer, gameMode, updateGameStateOnServer, playSound]);
    
    const canHit = gameStatus === 'playing' && String(activePlayerId) === String(player?.id) && !acePrompt;
    const canStand = gameStatus === 'playing' && String(activePlayerId) === String(player?.id) && !acePrompt;
    
    // Removed debug logging to prevent console spam
    
    const activeHandForActions = myPlayerState?.hands?.[activeHandIndex];
    
    // Only calculate canDouble during playing phase when player has cards
    const canDouble = gameStatus === 'playing' && 
                     canStand && 
                     activeHandForActions?.cards?.length === 2;
    
    // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam
    // Limit splits to maximum of 3 hands per player (2 splits maximum)
    const maxHandsPerPlayer = 3;
    const currentHandCount = myPlayerState?.hands?.length || 0;
    const canSplit = canStand && 
                     activeHandForActions?.cards?.length === 2 && 
                     getCardValue(activeHandForActions.cards[0]) === getCardValue(activeHandForActions.cards[1]) &&
                     currentHandCount < maxHandsPerPlayer;

    const canSurrender = false;

    const handleDouble = useCallback(() => {
        // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam
        
        if (!canDouble) {
        // Removed debug logging to prevent console spam
            return;
        }
        
        if (gameStatus !== 'playing' || String(activePlayerId) !== String(player?.id)) {
        // Removed debug logging to prevent console spam
            return;
        }
        
        const betAmount = myPlayerState.hands[activeHandIndex].bet;
        // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam
        
        // Deal the card and double the bet in one operation
        const newDeck = [...deck];
        const newCard = newDeck.pop();
        if (!newCard) return;

        newCard.instanceId = `${newCard.id}-${Math.random()}`;
        playSound('deal');

        const newPlayers = JSON.parse(JSON.stringify(players));
        const playerState = newPlayers[player.id];
        const hand = playerState.hands[activeHandIndex];
        
        // Double the bet
        hand.bet += betAmount;
        
        // Add the card
        // Removed debug logging to prevent console spam
        hand.cards.push(newCard);
        // Removed debug logging to prevent console spam

        // Auto-downgrade chosen aces if bust
        let currentScore = calculateScore(hand.cards);
        if (currentScore > 21) {
            for (let i = hand.cards.length - 1; i >= 0; i--) {
                const c = hand.cards[i];
                if (c.value === 'A' && c.chosenValue === 11) {
                    c.chosenValue = 1;
                    currentScore = calculateScore(hand.cards);
                    if (currentScore <= 21) break;
                }
            }
        }
        
        if (newCard.value === 'A' && !newCard.chosenValue) {
        // Removed debug logging to prevent console spam
            hand.pendingDoubleDown = true;
            setAcePrompt({ handIndex: activeHandIndex, cardId: newCard.instanceId });
            setPlayers(newPlayers);
            setDeck(newDeck);
            setBalance(prev => prev - betAmount);
        // Removed debug logging to prevent console spam
            return;
        }

        hand.score = calculateScore(hand.cards);
        hand.status = 'stand'; // Double down always stands after one card
        
        // Removed debug logging to prevent console spam
        
        setPlayers(newPlayers);
        setDeck(newDeck);
        setBalance(prev => prev - betAmount);
        
        logEvent(`${player.username} doubles down.`);

        if (gameMode === 'friend') {
            const nextState = { players: newPlayers, deck: newDeck };
            updateGameStateOnServer({ ...nextState, dealer: dealerHand, status: gameStatus, activePlayerId, activeHandIndex, roundCounter });
        }
        
        setTimeout(() => handleNextPlayer(player.id, activeHandIndex), 1000);
        
    }, [canDouble, myPlayerState, activeHandIndex, balance, players, player, gameStatus, activePlayerId, deck, playSound, logEvent, gameMode, updateGameStateOnServer, dealerHand, roundCounter, handleNextPlayer]);
    
    const handleSplit = useCallback(() => {
        if (!canSplit) return;
        
        const handToSplit = myPlayerState.hands[activeHandIndex];
        const betAmount = handToSplit.bet;

        // Allow splitting even with insufficient balance - player can go negative
        // Removed debug logging to prevent console spam

        const newDeck = [...deck];
        if (newDeck.length < 2) {
            console.log("Not enough cards in deck to split.");
            return;
        }

        const isSplittingAces = handToSplit.cards[0].value === 'A';
        
        // Create two new hands with one card each from the original hand
        const hand1 = { 
            cards: [handToSplit.cards[0]], 
            bet: betAmount, 
            score: 0, 
            status: 'playing' 
        };
        const hand2 = { 
            cards: [handToSplit.cards[1]], 
            bet: betAmount, 
            score: 0, 
            status: 'playing' 
        };

        // Deal one card to the first hand immediately
        const cardForHand1 = newDeck.pop();
        hand1.cards.push(cardForHand1);

        // Handle splitting Aces: force chosen value to 11 and auto-stand both hands
        if (isSplittingAces) {
            hand1.cards[0].chosenValue = 11;
            hand2.cards[0].chosenValue = 11;
            if(hand1.cards[1].value === 'A') hand1.cards[1].chosenValue = 1; // Prevent two flexible aces
            hand1.status = 'stand';
            hand2.status = 'stand';
            
            // Deal second card to second hand for Aces
            const cardForHand2 = newDeck.pop();
            hand2.cards.push(cardForHand2);
            if(hand2.cards[1].value === 'A') hand2.cards[1].chosenValue = 1;
        }

        hand1.score = calculateScore(hand1.cards);
        hand2.score = calculateScore(hand2.cards);
        
        const newPlayers = JSON.parse(JSON.stringify(players));
        const playerState = newPlayers[player.id];
        playerState.hands.splice(activeHandIndex, 1, hand1, hand2);

        setPlayers(newPlayers);
        setDeck(newDeck);
        setBalance(prev => prev - betAmount);
        
        if (gameMode === 'friend') {
            updateGameStateOnServer({ players: newPlayers, deck: newDeck, dealer: dealerHand, status: gameStatus, activePlayerId, activeHandIndex, roundCounter });
        }
        playSound('deal');
        
        if (isSplittingAces) {
            // For Aces, both hands are automatically stood, move to next player
            setTimeout(() => handleNextPlayer(player.id, activeHandIndex + 1), 1000);
        } else {
            // For non-Aces, stay on the first hand to continue playing
            // The second hand will get its card when the first hand is finished
        }
    }, [canSplit, balance, myPlayerState, players, deck, activeHandIndex, gameMode, updateGameStateOnServer, dealerHand, gameStatus, activePlayerId, roundCounter, playSound, handleNextPlayer]);

    const handleManualAceChange = useCallback((handIndex, cardId, newValue) => {
        // Removed debug logging to prevent console spam
        
        // Only allow manual ace changes when it's the player's turn
        if (gameStatus !== 'playing' || String(activePlayerId) !== String(player?.id)) {
        // Removed debug logging to prevent console spam
            return;
        }

        // If there's an active ace prompt for this specific card, don't allow manual changes
        if (acePrompt && acePrompt.cardId === cardId) {
        // Removed debug logging to prevent console spam
            return;
        }

        const newPlayers = JSON.parse(JSON.stringify(players));
        const playerState = newPlayers[player.id];
        const hand = playerState.hands[handIndex];
        const card = hand.cards.find(c => c.instanceId === cardId);
        
        if (card && card.value === 'A') {
            // Removed debug logging to prevent console spam
            
            card.chosenValue = newValue;
            const oldScore = hand.score;
            hand.score = calculateScore(hand.cards);
            
            // Removed debug logging to prevent console spam
            
            setPlayers(newPlayers);
            
            // Removed debug logging to prevent console spam
            
            if (gameMode === 'friend') {
                updateGameStateOnServer({ players: newPlayers, deck: deck, dealer: dealerHand, status: gameStatus, activePlayerId, activeHandIndex, roundCounter });
            }
        } else {
            // Removed debug logging to prevent console spam
        }
    }, [acePrompt, gameStatus, activePlayerId, player, players, gameMode, updateGameStateOnServer, deck, dealerHand, activeHandIndex, roundCounter]);

    const handleAceChoice = useCallback((handIndex, cardId, chosenValue) => {
        // Removed debug logging to prevent console spam
        
        const newPlayers = JSON.parse(JSON.stringify(players));
        const playerState = newPlayers[player.id];
        const hand = playerState.hands[handIndex];
        const card = hand.cards.find(c => c.instanceId === cardId);
        
        // Removed debug logging to prevent console spam
        
        if(card) {
            card.chosenValue = chosenValue;
            hand.score = calculateScore(hand.cards);
        // Removed debug logging to prevent console spam
        } else {
        // Removed debug logging to prevent console spam
        }

        setPlayers(newPlayers);
        setAcePrompt(null);
        
        // Check if this was a double down that was waiting for ace choice
        const wasDoubleDown = hand.pendingDoubleDown;
        // Removed debug logging to prevent console spam
        
        if (wasDoubleDown) {
            hand.pendingDoubleDown = false;
            hand.status = 'stand';
        // Removed debug logging to prevent console spam
            logEvent(`${player.username} doubles down for $${betAmount}`, { 
                betAmount, 
                newBalance: balance - betAmount,
                handIndex: activeHandIndex 
            }, player.username);
            setTimeout(() => handleNextPlayer(player.id, handIndex), 1000);
        } else if (hand.score === 21) {
            hand.status = 'stand';
        // Removed debug logging to prevent console spam
            setTimeout(() => handleNextPlayer(player.id, handIndex), 1000);
        }
        
        // Removed debug logging to prevent console spam
        
        if (gameMode === 'friend') {
            updateGameStateOnServer({ players: newPlayers, deck: deck, dealer: dealerHand, status: gameStatus, activePlayerId, activeHandIndex: handIndex, roundCounter });
        }
    }, [players, player, deck, dealerHand, gameStatus, activePlayerId, roundCounter, gameMode, updateGameStateOnServer, handleNextPlayer, logEvent]);

    useEffect(() => {
        
        // Removed debug logging to prevent console spam
        if (gameStatus !== 'dealer' || dealerTurnInProgress.current) return;
        
        let localDealerHand = JSON.parse(JSON.stringify(dealerHand));
        let localDeck = [...deck];
        let dealerPlayTimeout = null;
        let initTimeout = null;
    
        const dealerPlay = () => {
            localDealerHand.score = calculateScore(localDealerHand.cards);
        // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam

            if (localDealerHand.score < 17) {
        // Removed debug logging to prevent console spam
                const newCard = localDeck.pop();
                if (!newCard) {
        // Removed debug logging to prevent console spam
                    setDealerHand(localDealerHand);
                    setDeck(localDeck);
                    setGameStatus('roundOver');
                    processRoundEnd(); // Direct call to process round end
                    dealerTurnInProgress.current = false;
                    return;
                }
    
                newCard.instanceId = `${newCard.id}-${Math.random()}`;
                localDealerHand.cards.push(newCard);
                
                // Recalculate score after adding the new card
                localDealerHand.score = calculateScore(localDealerHand.cards);
        // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam
                
                // Log dealer action with correct new score
                logEvent(`Dealer draws ${newCard.value} of ${newCard.suit}`, { 
                    card: newCard.value, 
                    suit: newCard.suit, 
                    newScore: localDealerHand.score 
                }, 'Dealer');
    
                // Update state with the new card
                setDealerHand(JSON.parse(JSON.stringify(localDealerHand)));
                setDeck([...localDeck]);
                playSound('dealerFlip');
                
                // Sync with server in friend mode
                if (gameMode === 'friend' && roomCode) {
                    updateGameStateOnServer({ 
                        players, 
                        dealer: localDealerHand, 
                        status: 'dealer', 
                        activePlayerId, 
                        activeHandIndex, 
                        roundCounter, 
                        deck: localDeck 
                    });
                }
    
                // Check if dealer busted after drawing the card
                if (localDealerHand.score > 21) {
        // Removed debug logging to prevent console spam
                    // Dealer busted - finalize the hand immediately
        // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam
                    
                    logEvent(`Dealer busts with ${localDealerHand.score}`, { 
                        finalScore: localDealerHand.score, 
                        cards: localDealerHand.cards.length 
                    }, 'Dealer');
                    
        // Removed debug logging to prevent console spam
                    setDealerHand(localDealerHand);
                    setDeck(localDeck);
                    
                    // Reset round end processing flags before setting gameStatus to roundOver
                    processingRoundEnd.current = false;
                    roundEndProcessedRef.current = false;
                    
                    console.log('🎯 Setting gameStatus to roundOver from dealerPlay');
                    
                    // Force immediate state update and re-render
                    setGameStatus('roundOver');
                    console.log('✅ gameStatus set to roundOver immediately');
                    
                    // Call processRoundEnd directly instead of relying on useEffect
                    console.log('🚀 Calling processRoundEnd directly');
                    processRoundEnd();
                    
                    // Sync final dealer state with server in friend mode - only once when round ends
                if (gameMode === 'friend' && roomCode && !dealerTurnInProgress.current) {
                    updateGameStateOnServer({ 
                        players, 
                        dealer: localDealerHand, 
                        status: 'roundOver', 
                        activePlayerId, 
                        activeHandIndex, 
                        roundCounter, 
                        deck: localDeck
                        // Don't clear roundResult here - let round end processing handle it
                    });
                }
                    
                    // Clear dealerTurnInProgress after a small delay to ensure state updates are processed
                    setTimeout(() => {
                        dealerTurnInProgress.current = false;
                    }, 100);
                    return;
                }
    
                // Continue dealing after delay if not busted and score still < 17
                dealerPlayTimeout = setTimeout(dealerPlay, 1000);
            } else {
                // Dealer stands or busts - finalize the hand
        // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam
                
                // Log dealer final action
                if (localDealerHand.score > 21) {
                    logEvent(`Dealer busts with ${localDealerHand.score}`, { 
                        finalScore: localDealerHand.score, 
                        cards: localDealerHand.cards.length 
                    }, 'Dealer');
                } else {
                    logEvent(`Dealer stands with ${localDealerHand.score}`, { 
                        finalScore: localDealerHand.score, 
                        cards: localDealerHand.cards.length 
                    }, 'Dealer');
                }
                
        // Removed debug logging to prevent console spam
                setDealerHand(localDealerHand);
                setDeck(localDeck);
                
                // Reset round end processing flags before setting gameStatus to roundOver
                processingRoundEnd.current = false;
                roundEndProcessedRef.current = false;
                
                // Reset dealerTurnInProgress immediately to allow socket updates
                dealerTurnInProgress.current = false;
                
                setGameStatus('roundOver');
                processRoundEnd(); // Direct call to process round end
                
                // Sync final dealer state with server in friend mode - only once when round ends
                if (gameMode === 'friend' && roomCode) {
                    updateGameStateOnServer({ 
                        players, 
                        dealer: localDealerHand, 
                        status: 'roundOver', 
                        activePlayerId, 
                        activeHandIndex, 
                        roundCounter, 
                        deck: localDeck
                        // Don't clear roundResult here - let UI process it first
                    });
                }
            }
        };
    
        // Add a delay before setting dealerTurnInProgress and starting dealer play to allow socket updates to process
        initTimeout = setTimeout(() => {
            dealerTurnInProgress.current = true;
        // Removed debug logging to prevent console spam
            dealerPlayTimeout = setTimeout(dealerPlay, 1000);
        }, 600);

        // Cleanup function to prevent memory leaks
        return () => {
        // Removed debug logging to prevent console spam
            if (dealerPlayTimeout) {
                clearTimeout(dealerPlayTimeout);
            }
            if (initTimeout) {
                clearTimeout(initTimeout);
            }
        };

    }, [gameStatus, playSound]);

    // Ref to capture players state when round ends
    const roundEndPlayersRef = useRef(null);
    const roundEndProcessedRef = useRef(false);
    const roundEndCompleteRef = useRef(false);

    // Add debug logging outside useEffect to track when hook re-renders
    console.log('🔍 useBlackjackGame hook render:', {
        gameStatus,
        playersCount: Object.keys(players).length,
        processingRoundEnd: processingRoundEnd.current,
        roundEndProcessed: roundEndProcessedRef.current
    });

    // Extract round end processing into a separate function
    const processRoundEnd = useCallback(() => {
        console.log('🎯 DIRECT ROUND END PROCESSING CALLED');
        
        // Set the timestamp when round ends
        lastRoundEndTime.current = Date.now();
        
        // Only process if we haven't already processed this round
        if (processingRoundEnd.current || roundEndProcessedRef.current) {
            console.log('🚫 Skipping round end processing - already processed or in progress');
            return;
        }
        
        console.log('✅ Starting round end processing');
        processingRoundEnd.current = true;
        roundEndProcessedRef.current = true;
        
        // Set game status to roundOver immediately to show the RoundSummary
        setGameStatus('roundOver');
        
        console.log('🔍 Step 1: Setting processing flags completed');
        
        // Capture the current players state to prevent recalculation on players updates
        roundEndPlayersRef.current = players;
        
        console.log('🔍 Step 2: Captured players state:', Object.keys(roundEndPlayersRef.current).length, 'players');
    
        // Removed debug logging to prevent console spam
        const results = {};
        let totalWinningsForPlayer = 0;
        const finalDealerScore = calculateScore(dealerHand.cards);
        
        console.log('🔍 Step 3: Calculated dealer score:', finalDealerScore);
        // Removed debug logging to prevent console spam

        console.log('🔍 Step 4: Starting player processing loop');
        Object.values(roundEndPlayersRef.current).forEach(p => {
            if (!p || p.isSpectating || !p.hands || p.hands.length === 0) return;
    
            console.log('🔄 Processing player results for:', p.username);
            console.log('🔍 Step 4a: Player data valid, starting calculations');
            let playerTotalWinnings = 0;
            let finalResults = [];
            let sideBetResults = [];
    
            // --- Side Bet Calculations ---
            const sideBets = p.sideBets || {};
            const initialPlayerHand = p.hands[0].cards.slice(0, 2);
            const initialDealerCard = dealerHand.cards[0];
            
            console.log('🔍 Step 4b: Side bet setup completed');
    
            // Perfect Pairs
            if (sideBets.perfectPairs > 0) {
                console.log('🎰 Processing Perfect Pairs side bet');
                console.log('🔍 Step 4c: Starting Perfect Pairs calculation');
                let ppWinnings = -sideBets.perfectPairs;
                let ppResultText = 'Perfect Pairs: Lose';
                if (initialPlayerHand.length === 2) {
                    console.log('🔍 Step 4c1: Initial hand has 2 cards, checking pairs');
                    const [c1, c2] = initialPlayerHand;
                    if (c1.value === c2.value) {
                        console.log('🔍 Step 4c2: Found matching values, checking suits');
                        if (c1.suit === c2.suit) { // Perfect Pair
                            ppWinnings = sideBets.perfectPairs * 25;
                            ppResultText = 'Perfect Pair! (25:1)';
                        } else if ((['hearts', 'diamonds'].includes(c1.suit) && ['hearts', 'diamonds'].includes(c2.suit)) || (['spades', 'clubs'].includes(c1.suit) && ['spades', 'clubs'].includes(c2.suit))) { // Colored Pair
                            ppWinnings = sideBets.perfectPairs * 12;
                            ppResultText = 'Colored Pair! (12:1)';
                        } else { // Mixed Pair
                            ppWinnings = sideBets.perfectPairs * 6;
                            ppResultText = 'Mixed Pair! (6:1)';
                        }
                    }
                }
                sideBetResults.push({ type: 'Perfect Pairs', winnings: ppWinnings, text: ppResultText });
                playerTotalWinnings += ppWinnings;
            }
    
            // 21+3
            if (sideBets.twentyOnePlusThree > 0) {
                console.log('🎰 Processing 21+3 side bet');
                let tptWinnings = -sideBets.twentyOnePlusThree;
                let tptResultText = '21+3: Lose';
                
                if (initialPlayerHand.length === 2 && initialDealerCard) {
                    const threeCards = [...initialPlayerHand, initialDealerCard];
                    const suits = threeCards.map(c => c.suit);
                    const values = threeCards.map(c => c.value);
                    
                    // Check for different combinations
                    const isFlush = suits.every(s => s === suits[0]);
                    const isStraight = checkStraight(values);
                    const isThreeOfAKind = values.every(v => v === values[0]);
                    const isStraightFlush = isFlush && isStraight;
                    
                    if (isStraightFlush) {
                        tptWinnings = sideBets.twentyOnePlusThree * 40;
                        tptResultText = 'Straight Flush! (40:1)';
                    } else if (isThreeOfAKind) {
                        tptWinnings = sideBets.twentyOnePlusThree * 30;
                        tptResultText = 'Three of a Kind! (30:1)';
                    } else if (isStraight) {
                        tptWinnings = sideBets.twentyOnePlusThree * 10;
                        tptResultText = 'Straight! (10:1)';
                    } else if (isFlush) {
                        tptWinnings = sideBets.twentyOnePlusThree * 5;
                        tptResultText = 'Flush! (5:1)';
                    }
                }
                sideBetResults.push({ type: '21+3', winnings: tptWinnings, text: tptResultText });
                playerTotalWinnings += tptWinnings;
            }
    
            // --- Main Hand Calculations ---
            p.hands.forEach((hand, handIndex) => {
                if (!hand.cards || hand.cards.length === 0) return;
                
                const playerScore = calculateScore(hand.cards);
                let handWinnings = 0;
                let resultText = '';
                
                if (playerScore > 21) {
                    handWinnings = -hand.bet;
                    resultText = 'Bust';
                } else if (finalDealerScore > 21) {
                    if (playerScore === 21 && hand.cards.length === 2) {
                        handWinnings = hand.bet * 1.5;
                        resultText = 'Blackjack!';
                    } else {
                        handWinnings = hand.bet;
                        resultText = 'Win (Dealer Bust)';
                    }
                } else if (playerScore === 21 && hand.cards.length === 2 && finalDealerScore !== 21) {
                    handWinnings = hand.bet * 1.5;
                    resultText = 'Blackjack!';
                } else if (playerScore > finalDealerScore) {
                    handWinnings = hand.bet;
                    resultText = 'Win';
                } else if (playerScore === finalDealerScore) {
                    handWinnings = 0;
                    resultText = 'Push';
                } else {
                    handWinnings = -hand.bet;
                    resultText = 'Lose';
                }
                
                finalResults.push({
                    handIndex,
                    playerScore,
                    dealerScore: finalDealerScore,
                    winnings: handWinnings,
                    result: resultText,
                    bet: hand.bet
                });
                
                playerTotalWinnings += handWinnings;
            });
    
            results[p.id] = {
                totalWinnings: playerTotalWinnings,
                mainHandResults: finalResults,
                sideBetResults: sideBetResults
            };
            
            totalWinningsForPlayer += playerTotalWinnings;
            
            // Update player balance
            if (playerTotalWinnings !== 0) {
                updatePlayerBalance(p.id, playerTotalWinnings);
            }
        });

        logEvent('Round ended', {
            type: 'roundEnd',
            results: Object.keys(results).map(playerId => ({
                playerId,
                playerName: roundEndPlayersRef.current[playerId]?.username,
                totalWinnings: results[playerId]?.totalWinnings || 0,
                mainResults: results[playerId]?.mainHandResults || [],
                sideBetResults: results[playerId]?.sideBetResults || []
            }))
        }, 'System');

        // Set roundResult immediately for UI display
        setRoundResult(results);
        
        // Reset processingRoundEnd quickly to allow game updates
        setTimeout(() => {
            processingRoundEnd.current = false;
            console.log('✅ Processing flag reset - game updates now allowed');
        }, 500); // Quick reset to prevent blocking
        
        roundEndTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Round end timeout triggered - resetting for new round');
            
            // Add error handling to prevent crashes during reset
            try {
                roundEndCompleteRef.current = true;
                resetForNewRound({ players: roundEndPlayersRef.current, dealerHand, roundCounter }, true);
                console.log('✅ Round reset completed successfully');
            } catch (error) {
                console.error('❌ Error during round reset:', error);
                // Prevent infinite loops by resetting the processing flag even on error
                roundEndProcessedRef.current = false;
            }
        }, 10000); // Increased from 8000ms to 10000ms to allow proper round summary display

        return () => clearTimeout(roundEndTimeoutRef.current);
    }, [gameStatus, dealerHand, roundCounter, calculateScore, logEvent, updatePlayerBalance, resetForNewRound]);

    // Round end processing useEffect - CRITICAL: This must trigger when gameStatus becomes 'roundOver'
    useEffect(() => {
        console.log('🔄 Round end processing useEffect triggered:', {
            gameStatus,
            processingRoundEnd: processingRoundEnd.current,
            roundEndProcessed: roundEndProcessedRef.current,
            playersCount: Object.keys(players).length
        });
        
        // Reset the flag when game status changes away from roundOver
        if (gameStatus !== 'roundOver') {
            if (roundEndProcessedRef.current) {
                console.log('🔄 Resetting round end flags - status changed from roundOver');
                roundEndProcessedRef.current = false;
                roundEndCompleteRef.current = false;
            }
            return;
        }
        // Removed debug logging to prevent console spam

        // Initialize variables for this useEffect
        const results = {};
        const finalDealerScore = calculateScore(dealerHand.cards);
        let totalWinningsForPlayer = 0;

        console.log('🔍 Step 4: Starting player processing loop');
        Object.values(roundEndPlayersRef.current).forEach(p => {
            if (!p || p.isSpectating || !p.hands || p.hands.length === 0) return;
    
            console.log('🔄 Processing player results for:', p.username);
            console.log('🔍 Step 4a: Player data valid, starting calculations');
            let playerTotalWinnings = 0;
            let finalResults = [];
            let sideBetResults = [];
    
            // --- Side Bet Calculations ---
            const sideBets = p.sideBets || {};
            const initialPlayerHand = p.hands[0].cards.slice(0, 2);
            const initialDealerCard = dealerHand.cards[0];
            
            console.log('🔍 Step 4b: Side bet setup completed');
    
            // Perfect Pairs
            if (sideBets.perfectPairs > 0) {
                console.log('🎰 Processing Perfect Pairs side bet');
                console.log('🔍 Step 4c: Starting Perfect Pairs calculation');
                let ppWinnings = -sideBets.perfectPairs;
                let ppResultText = 'Perfect Pairs: Lose';
                if (initialPlayerHand.length === 2) {
                    console.log('🔍 Step 4c1: Initial hand has 2 cards, checking pairs');
                    const [c1, c2] = initialPlayerHand;
                    if (c1.value === c2.value) {
                        console.log('🔍 Step 4c2: Found matching values, checking suits');
                        if (c1.suit === c2.suit) { // Perfect Pair
                            ppWinnings = sideBets.perfectPairs * 25;
                            ppResultText = 'Perfect Pair! (25:1)';
                        } else if ((['hearts', 'diamonds'].includes(c1.suit) && ['hearts', 'diamonds'].includes(c2.suit)) || (['spades', 'clubs'].includes(c1.suit) && ['spades', 'clubs'].includes(c2.suit))) { // Colored Pair
                            ppWinnings = sideBets.perfectPairs * 12;
                            ppResultText = 'Colored Pair! (12:1)';
                        } else { // Mixed Pair
                            ppWinnings = sideBets.perfectPairs * 6;
                            ppResultText = 'Mixed Pair! (6:1)';
                        }
                    }
                }
                console.log('🔍 Step 4c3: Perfect Pairs calculation completed');
                playerTotalWinnings += ppWinnings;
                sideBetResults.push({ text: ppResultText, amount: ppWinnings });
            }
    
            // 21+3
            if (sideBets['21+3'] > 0) {
                console.log('🔍 Step 4d: Starting 21+3 side bet calculation');
                let d3Winnings = -sideBets['21+3'];
                let d3ResultText = '21+3: Lose';
                console.log('🔍 Step 4d0: Checking initial conditions - playerHand length:', initialPlayerHand?.length, 'dealerCard exists:', !!initialDealerCard);
                if (initialPlayerHand.length === 2 && initialDealerCard) {
                    console.log('🔍 Step 4d1: Valid cards for 21+3, checking combinations');
                    console.log('🔍 Step 4d1a: initialPlayerHand:', initialPlayerHand);
                    console.log('🔍 Step 4d1b: initialDealerCard:', initialDealerCard);
                    
                    try {
                        const threeCards = [...initialPlayerHand, initialDealerCard];
                        console.log('🔍 Step 4d2: Created three cards array successfully');
                        const values = threeCards.map(c => c.value).sort();
                        console.log('🔍 Step 4d3: Mapped and sorted values');
                        const suits = threeCards.map(c => c.suit);
                        console.log('🔍 Step 4d4: Mapped suits');
                        const isFlush = new Set(suits).size === 1;
                        console.log('🔍 Step 4d5: Calculated flush check');
                        
                        // Simplified straight check
                        const cardRanks = threeCards.map(c => VALUES.indexOf(c.value)).sort((a, b) => a - b);
                        console.log('🔍 Step 4d6: Calculated card ranks');
                        const isStraight = cardRanks[2] - cardRanks[1] === 1 && cardRanks[1] - cardRanks[0] === 1;
                        console.log('🔍 Step 4d7: Calculated straight check');
                        
                        const isThreeOfAKind = new Set(values).size === 1;
                        console.log('🔍 Step 4d8: Calculated three of a kind check');

                        if (isFlush && isStraight) { // Straight Flush
                            d3Winnings = sideBets['21+3'] * 40;
                            d3ResultText = 'Straight Flush! (40:1)';
                        } else if (isThreeOfAKind) { // Three of a Kind
                            d3Winnings = sideBets['21+3'] * 30;
                            d3ResultText = 'Three of a Kind! (30:1)';
                        } else if (isStraight) { // Straight
                            d3Winnings = sideBets['21+3'] * 10;
                            d3ResultText = 'Straight! (10:1)';
                        } else if (isFlush) { // Flush
                            d3Winnings = sideBets['21+3'] * 5;
                            d3ResultText = 'Flush! (5:1)';
                        }
                        console.log('🔍 Step 4d9: Completed 21+3 calculations');
                    } catch (error) {
                        console.error('🚨 Error in 21+3 calculation:', error);
                        console.log('🔍 Error details - initialPlayerHand:', initialPlayerHand, 'initialDealerCard:', initialDealerCard);
                    }
                }
                console.log('🔍 Step 4d10: Adding 21+3 results to totals');
                playerTotalWinnings += d3Winnings;
                sideBetResults.push({ text: d3ResultText, amount: d3Winnings });
            }

            // Lucky Ladies
            if (sideBets.luckyLadies > 0) {
                console.log('🔍 Step 4e: Starting Lucky Ladies calculation');
                let llWinnings = -sideBets.luckyLadies;
                let llResultText = 'Lucky Ladies: Lose';
                if (initialPlayerHand.length === 2) {
                    console.log('🔍 Step 4e1: Valid hand for Lucky Ladies');
                    const handValue = initialPlayerHand.reduce((sum, card) => {
                        const value = card.value === 'A' ? 11 : (card.value === 'K' || card.value === 'Q' || card.value === 'J') ? 10 : parseInt(card.value);
                        return sum + value;
                    }, 0);
                    
                    if (handValue === 20) {
                        const [c1, c2] = initialPlayerHand;
                        const isQueenOfHearts = (card) => card.value === 'Q' && card.suit === 'hearts';
                        
                        if (isQueenOfHearts(c1) && isQueenOfHearts(c2)) {
                            // Check if dealer has blackjack for bonus payout
                            const dealerBlackjack = calculateScore(dealerHand.cards) === 21 && dealerHand.cards.length === 2;
                            if (dealerBlackjack) {
                                llWinnings = sideBets.luckyLadies * 200;
                                llResultText = 'Two Queens of Hearts with Dealer BJ! (200:1)';
                            } else {
                                llWinnings = sideBets.luckyLadies * 1000;
                                llResultText = 'Two Queens of Hearts! (1000:1)';
                            }
                        } else if (c1.value === c2.value && c1.suit === c2.suit) { // Matched 20 (same rank and suit)
                            llWinnings = sideBets.luckyLadies * 25;
                            llResultText = 'Matched 20! (25:1)';
                        } else if (c1.suit === c2.suit) { // Suited 20
                            llWinnings = sideBets.luckyLadies * 10;
                            llResultText = 'Suited 20! (10:1)';
                        } else { // Any 20
                            llWinnings = sideBets.luckyLadies * 4;
                            llResultText = 'Any 20! (4:1)';
                        }
                    }
                }
                playerTotalWinnings += llWinnings;
                sideBetResults.push({ text: llResultText, amount: llWinnings });
            }

            // Royal Match
            if (sideBets.royalMatch > 0) {
                let rmWinnings = -sideBets.royalMatch;
                let rmResultText = 'Royal Match: Lose';
                if (initialPlayerHand.length === 2) {
                    const [c1, c2] = initialPlayerHand;
                    if (c1.suit === c2.suit) { // Same suit
                        if ((c1.value === 'K' && c2.value === 'Q') || (c1.value === 'Q' && c2.value === 'K')) {
                            rmWinnings = sideBets.royalMatch * 25;
                            rmResultText = 'Royal Match! (25:1)';
                        } else {
                            rmWinnings = sideBets.royalMatch * 2.5;
                            rmResultText = 'Suited Match! (2.5:1)';
                        }
                    }
                }
                playerTotalWinnings += rmWinnings;
                sideBetResults.push({ text: rmResultText, amount: rmWinnings });
            }

            // Buster Blackjack
            if (sideBets.busterBlackjack > 0) {
                let bbWinnings = -sideBets.busterBlackjack;
                let bbResultText = 'Buster Blackjack: Lose';
                
                // Check if dealer busted
                if (finalDealerScore > 21) {
                    const dealerCardCount = dealerHand.cards.length;
                    if (dealerCardCount >= 8) {
                        bbWinnings = sideBets.busterBlackjack * 200;
                        bbResultText = `Dealer Bust with ${dealerCardCount} cards! (200:1)`;
                    } else if (dealerCardCount === 7) {
                        bbWinnings = sideBets.busterBlackjack * 50;
                        bbResultText = 'Dealer Bust with 7 cards! (50:1)';
                    } else if (dealerCardCount === 6) {
                        bbWinnings = sideBets.busterBlackjack * 15;
                        bbResultText = 'Dealer Bust with 6 cards! (15:1)';
                    } else if (dealerCardCount === 5) {
                        bbWinnings = sideBets.busterBlackjack * 4;
                        bbResultText = 'Dealer Bust with 5 cards! (4:1)';
                    } else if (dealerCardCount === 4) {
                        bbWinnings = sideBets.busterBlackjack * 2;
                        bbResultText = 'Dealer Bust with 4 cards! (2:1)';
                    } else if (dealerCardCount === 3) {
                        bbWinnings = sideBets.busterBlackjack * 1;
                        bbResultText = 'Dealer Bust with 3 cards! (1:1)';
                    }
                }
                playerTotalWinnings += bbWinnings;
                sideBetResults.push({ text: bbResultText, amount: bbWinnings });
            }
    
            // --- Main Hand Calculations ---
            console.log('🔍 Step 5: Starting main hand calculations');
            console.log('🔍 Step 5a: Player hands count:', p.hands?.length);
            console.log('🔍 Step 5b: Player hands data:', p.hands);
            
            p.hands.forEach((hand, handIndex) => {
                console.log(`🔍 Step 5c: Processing hand ${handIndex}:`, hand);
                const bet = hand.bet || 0;
                let handWinnings = 0;
                let resultText = '';
                const isBlackjack = hand.score === 21 && hand.cards.length === 2 && p.hands.length === 1;
    
                if (hand.status === 'bust' || hand.score > 21) {
                    resultText = 'Bust';
                    handWinnings = -bet;
                } else if (isBlackjack && (calculateScore(dealerHand.cards) !== 21 || dealerHand.cards.length > 2)) {
                    resultText = 'Blackjack!';
                    handWinnings = bet * 1.5;
                } else if (finalDealerScore > 21 || hand.score > finalDealerScore) {
                    resultText = 'Win';
                    handWinnings = bet;
                } else if (hand.score < finalDealerScore) {
                    resultText = 'Lose';
                    handWinnings = -bet;
                } else {
                    resultText = 'Push';
                    handWinnings = 0;
                }
                playerTotalWinnings += handWinnings;
                finalResults.push({ text: resultText, amount: handWinnings });
            });

            // Play sound only once per player based on total winnings - delay to allow UI to render first
            if (p.id === player?.id) {
                setTimeout(() => {
                    if (playerTotalWinnings > 0) playSound('win');
                    else if (playerTotalWinnings < 0) playSound('lose');
                    else playSound('push');
                }, 500); // 500ms delay to allow UI to render
            }
    
            results[p.id] = {
                mainHandResults: finalResults,
                sideBetResults: sideBetResults,
                totalWinnings: playerTotalWinnings
            };
    
            if (p.id === player?.id) {
                totalWinningsForPlayer = playerTotalWinnings;
            }
        });

        // Removed debug logging to prevent console spam
        setRoundResult(results);
        // Removed debug logging to prevent console spam
        
        // Sync roundResult with server in friend mode
        if (gameMode === 'friend' && roomCode) {
            updateGameStateOnServer({ 
                players: roundEndPlayersRef.current, 
                dealer: dealerHand, 
                status: 'roundOver', 
                activePlayerId, 
                activeHandIndex, 
                roundCounter, 
                deck,
                roundResult: results // Sync roundResult to server
            });
        }
        
        // Track stats for the current player
        if (player && results[player.id]) {
            const playerResult = results[player.id];
            
            // Use a separate async function to handle the fetch
            const trackStats = async () => {
                try {
                    await fetch(API_ENDPOINTS.TRACK_STATS, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            userId: player.id,
                            gameResults: {
                                mainHandResults: playerResult.mainHandResults || [],
                                sideBetResults: playerResult.sideBetResults || []
                            }
                        })
                    });
        // Removed debug logging to prevent console spam
                } catch (error) {
                    console.error('📊 Failed to track stats:', error);
                }
            };
            
            // Call the async function
            trackStats();
        }
        
        if (typeof updatePlayerBalance === 'function' && player) {
        // Removed debug logging to prevent console spam
            updatePlayerBalance(totalWinningsForPlayer);
            setBalance(prev => prev + totalWinningsForPlayer);
        } else {
        // Removed debug logging to prevent console spam
        }

        logEvent('Round over.', { 
            dealerScore: finalDealerScore, 
            results: Object.keys(results).map(playerId => ({
                playerId,
                playerName: roundEndPlayersRef.current[playerId]?.username,
                totalWinnings: results[playerId]?.totalWinnings || 0,
                mainResults: results[playerId]?.mainHandResults || [],
                sideBetResults: results[playerId]?.sideBetResults || []
            }))
        }, 'System');

        roundEndTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Round end timeout triggered - resetting for new round');
            
            // Add error handling to prevent crashes during reset
            try {
                roundEndCompleteRef.current = true;
                resetForNewRound({ players: roundEndPlayersRef.current, dealerHand, roundCounter }, true);
                // Reset processingRoundEnd only after resetForNewRound completes
                processingRoundEnd.current = false;
                console.log('✅ Round reset completed successfully');
            } catch (error) {
                console.error('❌ Error during round reset:', error);
                // Prevent infinite loops by resetting the processing flag even on error
                processingRoundEnd.current = false;
                roundEndProcessedRef.current = false;
            }
        }, 8000); // Increased from 5000ms to 8000ms to allow proper round summary display

        // Don't reset processingRoundEnd here - keep it true until timeout completes

        return () => clearTimeout(roundEndTimeoutRef.current);
    }, [gameStatus, dealerHand, roundCounter, calculateScore, logEvent, updatePlayerBalance, resetForNewRound]);

    useEffect(() => {
      // Initialize results object for this useEffect
      const results = {};
      let totalWinningsForPlayer = 0;
      const finalDealerScore = calculateScore(dealerHand.cards);
      
      // Don't trigger during round over or when processing round end
      if (gameStatus === 'roundOver' || processingRoundEnd.current) {
          return;
      }
      
      // Don't trigger if deal is already in progress
      if (dealInProgress.current) {
          return;
      }
      
      // Don't trigger for playing, cardDealing, or dealer status
      if (gameStatus === 'playing' || gameStatus === 'cardDealing' || gameStatus === 'dealer') {
          return;
      }
      
      console.log('🎯 Auto-deal useEffect triggered:', {
        gameMode,
        gameStatus,
        isHost,
        playerId: player?.id,
        playersCount: Object.keys(players).length,
        processingRoundEnd: processingRoundEnd.current
      });
      
      // Only trigger auto-deal for betting or dealing status in friend mode
      if (gameMode === 'friend' && (gameStatus === 'betting' || gameStatus === 'dealing')) {
        // Add a delay check to prevent immediate auto-deal after round reset
        const timeSinceRoundEnd = Date.now() - (lastRoundEndTime.current || 0);
        if (timeSinceRoundEnd < 12000) { // 12 seconds buffer after round end
          console.log('⏳ Waiting for betting phase to be fully established after round end');
          return;
        }
        
        // Get all non-spectating players
        const allNonSpectatingPlayers = Object.values(players).filter(p => p && !p.isSpectating);
        
        // Get players who have placed valid bets and locked them
        const playersWithLockedBets = allNonSpectatingPlayers.filter(p => 
          p.hands?.[0]?.bet >= MIN_BET && p.hasPlacedBet
        );
        
        console.log('🎲 Auto-deal check:', {
          allNonSpectatingPlayers: allNonSpectatingPlayers.length,
          playersWithLockedBets: playersWithLockedBets.length,
          players: Object.values(players).map(p => ({
            id: p.id,
            username: p.username,
            isSpectating: p.isSpectating,
            hasPlacedBet: p.hasPlacedBet,
            bet: p.hands?.[0]?.bet
          }))
        });
        
        // Only start the round if:
        // 1. There are non-spectating players
        // 2. ALL non-spectating players have locked valid bets (not just some)
        // 3. At least one player has placed a bet (prevents auto-deal immediately after reset)
        const allPlayersReadyOrDeciding = allNonSpectatingPlayers.length > 0 && 
                                         playersWithLockedBets.length > 0 &&
                                         allNonSpectatingPlayers.length === playersWithLockedBets.length &&
                                         playersWithLockedBets.every(p => p.hasPlacedBet && p.hands?.[0]?.bet >= MIN_BET);
        
        console.log('🎯 Ready check:', { 
            allPlayersReadyOrDeciding, 
            isHost,
            allNonSpectatingPlayersCount: allNonSpectatingPlayers.length,
            playersWithLockedBetsCount: playersWithLockedBets.length,
            allNonSpectatingPlayers: allNonSpectatingPlayers.map(p => ({ id: p.id, username: p.username, hasPlacedBet: p.hasPlacedBet })),
            playersWithLockedBets: playersWithLockedBets.map(p => ({ id: p.id, username: p.username, hasPlacedBet: p.hasPlacedBet }))
        });
        
        if (allPlayersReadyOrDeciding) {
            // Only the host should trigger the deal to avoid duplicate dealing
            if (isHost) {
                console.log('🎉 HOST: Triggering handleDeal()');
                handleDeal();
            } else {
                console.log('👥 NON-HOST: Waiting for host to deal');
            }
        } else {
            console.log('⏳ Not all players ready yet');
        }
      }
    }, [gameStatus, gameMode, isHost, Object.keys(players).length, Object.values(players).map(p => `${p?.id}-${p?.hasPlacedBet}-${p?.isSpectating}-${p?.hands?.[0]?.bet}`).join(',')]);
    
    const handlePlaceBet = useCallback((amount, betType = 'main', sideBetName = null) => {
        if (!player || !myPlayerState || myPlayerState.isSpectating || myPlayerState.hasPlacedBet) return;
    
        const newPlayers = JSON.parse(JSON.stringify(players));
        const playerToUpdate = newPlayers[player.id];

        if (betType === 'main') {
            if (!playerToUpdate.hands || playerToUpdate.hands.length === 0) {
                playerToUpdate.hands = [{ cards: [], score: 0, bet: 0, status: 'betting' }];
            }
            playerToUpdate.hands[0].bet += amount;
            
            // Log main bet placement
            logEvent(`${player.username} placed main bet of $${amount}`, { 
                betAmount: amount, 
                totalMainBet: playerToUpdate.hands[0].bet,
                betType: 'main'
            }, player.username);
        } else {
            playerToUpdate.sideBets = playerToUpdate.sideBets || {};
            playerToUpdate.sideBets[sideBetName] = (playerToUpdate.sideBets[sideBetName] || 0) + amount;
            
            // Log side bet placement
            logEvent(`${player.username} placed ${sideBetName} side bet of $${amount}`, { 
                betAmount: amount, 
                totalSideBet: playerToUpdate.sideBets[sideBetName],
                betType: 'side',
                sideBetName: sideBetName
            }, player.username);
        }
        
        setBalance(prev => prev - amount);
        setPlayers(newPlayers);
        if (gameMode === 'friend') updateGameStateOnServer({ players: newPlayers });

    }, [player, myPlayerState, players, gameMode, updateGameStateOnServer, logEvent]);
    
    const handleSurrender = () => { console.log("🚧 Feature not implemented yet!"); };
    const handleNewRound = () => resetForNewRound({ players, dealerHand, roundCounter });

    const handleClearBet = () => {
        if(!myPlayerState || myPlayerState.isSpectating || myPlayerState.hasPlacedBet) return;
        const newPlayers = { ...players };
        const playerToUpdate = newPlayers[player.id];

        const mainBet = playerToUpdate.hands?.[0]?.bet || 0;
        const sideBetTotal = Object.values(playerToUpdate.sideBets || {}).reduce((a, b) => a + b, 0);
        const totalRefund = mainBet + sideBetTotal;
        
        if(playerToUpdate.hands?.[0]) playerToUpdate.hands[0].bet = 0;
        playerToUpdate.sideBets = {};
        
        setBalance(prev => prev + totalRefund);
        setPlayers(newPlayers);
        if (gameMode === 'friend') updateGameStateOnServer({ players: newPlayers });
    };
    
    const handleClearSideBet = (sideBetName) => {
        if(!myPlayerState || myPlayerState.isSpectating || myPlayerState.hasPlacedBet || !myPlayerState.sideBets?.[sideBetName]) return;
        const newPlayers = JSON.parse(JSON.stringify(players));
        const playerToUpdate = newPlayers[player.id];
        const refundAmount = playerToUpdate.sideBets[sideBetName];
        playerToUpdate.sideBets[sideBetName] = 0;
        
        setBalance(prev => prev + refundAmount);
        setPlayers(newPlayers);
        if (gameMode === 'friend') updateGameStateOnServer({ players: newPlayers });
    };

    const handleLockBet = async () => {
        // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam

        if (!myPlayerState || (myPlayerState.hands?.[0]?.bet || 0) < MIN_BET || myPlayerState.hasPlacedBet) return;

        // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam

        const newPlayers = JSON.parse(JSON.stringify(players));
        newPlayers[player.id].hasPlacedBet = true;

        // Removed debug logging to prevent console spam

        playSound('bet');
        
        // Always update player state first
        setPlayers(newPlayers);
        
        // Always trigger shuffle animation immediately when bet is locked
        // Removed debug logging to prevent console spam
        setGameStatus('dealing');
        playSound('shuffle');
        
        // Wait for shuffle animation to complete before dealing cards
        setTimeout(() => {
        // Removed debug logging to prevent console spam
            
            if (gameMode === 'practice') {
        // Removed debug logging to prevent console spam
                handleDeal(true);
            } else {
                // Always update server state in friend mode with both players and status
        // Removed debug logging to prevent console spam
                updateGameStateOnServer({ players: newPlayers, status: 'dealing' });
            }
        }, 2000); // Updated to match new 2000ms animation duration
    };

    const toggleSpectator = () => {
        if (!myPlayerState) return;
        const newPlayers = JSON.parse(JSON.stringify(players));
        const playerToUpdate = newPlayers[player.id];
        playerToUpdate.isSpectating = !playerToUpdate.isSpectating;
        if(playerToUpdate.isSpectating) playerToUpdate.hasPlacedBet = false;
        
        if (gameMode === 'friend') updateGameStateOnServer({ players: newPlayers });
        setPlayers(newPlayers);
    };

    const handleMinBet = () => {
      const currentMainBet = myPlayerState?.hands?.[0]?.bet || 0;
      if (currentMainBet >= MIN_BET) return;
      const amountToAdd = MIN_BET - currentMainBet;
      if (amountToAdd > 0) handlePlaceBet(amountToAdd);
    };
    
    const handleMaxBet = () => {
        const currentMainBet = myPlayerState?.hands?.[0]?.bet || 0;
        let amountToAdd;
    
        if (balance < 0) {
            // If balance is negative, bet the amount to break even.
            // But first, clear any existing bet to calculate correctly.
            amountToAdd = Math.abs(balance) - currentMainBet;
        } else {
            // If balance is positive, bet the entire remaining balance.
            amountToAdd = balance;
        }
    
        if (amountToAdd > 0) {
            handlePlaceBet(amountToAdd);
        } else if (balance < 0 && currentMainBet < Math.abs(balance)) {
             // If there's an existing bet that's less than the debt, clear it first then place max bet
             const refund = currentMainBet;
             const newPlayers = JSON.parse(JSON.stringify(players));
             newPlayers[player.id].hands[0].bet = 0;
             setPlayers(newPlayers);
             setBalance(prev => prev + refund);
             handlePlaceBet(Math.abs(balance + refund));
        }
    };

    const handleKeepSideBetsToggle = () => setKeepSideBets(prev => !prev);
    const handleKeepMainBetToggle = () => setKeepMainBet(prev => !prev);

    useEffect(() => {
        const fetchInitialState = async () => {
            if (gameMode !== 'friend') {
                const p = {
                    [player.id]: { id: player.id, username: player.username, isHost: true, seatIndex: 2, isSpectating: false, hasPlacedBet: false, hands: [{ cards: [], score: 0, bet: 0, status: 'betting' }], sideBets: {} }
                };
                setPlayers(p);
                setGameStatus('betting');
                setRoundCounter(1);
                setDeck(shuffleDeck(createDeck()));
                return;
            }

            try {
                // Use Socket.IO to get game state
                const socket = getSocket();
                
                // Set up listeners BEFORE emitting join_room to prevent race conditions
                const gameUpdateHandler = (gameState) => {
                    console.log('📡 Received game_update event:', gameState);
                    
                    // Allow roundResult updates even during round end processing
                    if (processingRoundEnd.current && !gameState.hasOwnProperty('roundResult')) {
                        console.log('🚫 Skipping update during round end processing');
                        return;
                    }
                    
                    if (gameState && gameState.players) {
                        console.log('📡 Processing game state update:', {
                            status: gameState.status,
                            playersCount: Object.keys(gameState.players).length,
                            roundCounter: gameState.roundCounter
                        });
                        
                        // Don't override local state during dealer turn
                        if (dealerTurnInProgress.current) {
        // Removed debug logging to prevent console spam
                            return;
                        }
                        
                        // Also check if we're in dealer status locally but server is sending different status
                        if (gameStatus === 'dealer' && gameState.status !== 'dealer') {
        // Removed debug logging to prevent console spam
                            return;
                        }
                        
                        setPlayers(gameState.players);
                        const myState = gameState.players[player.id];
                        let nextStatus = gameState.status || 'betting';
                        // Only override dealing status if player hasn't placed bet AND is not spectating
                        if (nextStatus === 'dealing' && myState && !myState.hasPlacedBet && !myState.isSpectating) {
                            nextStatus = 'betting';
                        }
        // Removed debug logging to prevent console spam
                        setGameStatus(nextStatus);
                        setRoundCounter(gameState.roundCounter);
                        if (gameState.dealer) {
        // Removed debug logging to prevent console spam
                            setDealerHand(gameState.dealer);
                        }
                        if (gameState.deck) {
                            setDeck(gameState.deck);
                        }
                        if (gameState.activePlayerId !== undefined) {
        // Removed debug logging to prevent console spam
                            setActivePlayerId(gameState.activePlayerId);
                        }
                        if (gameState.activeHandIndex !== undefined) {
        // Removed debug logging to prevent console spam
                            setActiveHandIndex(gameState.activeHandIndex);
                        }
                        
                        // Sync roundResult from server
                        if (gameState.hasOwnProperty('roundResult')) {
                            console.log('📡 Received roundResult from server via game_update:', gameState.roundResult);
                            setRoundResult(gameState.roundResult);
                        }
                        
                        // Handle spectating status
                        if (gameState.players[player.id] && 
                            gameState.players[player.id].isSpectating && 
                            nextStatus === 'betting') {
                            gameState.players[player.id].isSpectating = false;
                        }
                    }
                };
                
                // Set up the event listener
                console.log(`🔌 Setting up socket listener for: game_update_${roomCode}`);
                socket.on(`game_update_${roomCode}`, gameUpdateHandler);
                
                // Also subscribe to alternate event name for compatibility
                console.log(`🔌 Setting up socket listener for: game_state_update:${roomCode}`);
                socket.on(`game_state_update:${roomCode}`, gameUpdateHandler);
                
                // Set loading state and emit join_room AFTER listeners are set up
                console.log(`🔌 Socket connected: ${socket.connected}, emitting join_room for ${roomCode}`);
                setGameStatus('loading');
                setDeck(shuffleDeck(createDeck()));
                
                // Now emit join_room - the server response will be handled by the listeners above
                socket.emit('join_room', { roomCode });
                
                // Set a timeout to prevent infinite loading if server doesn't respond
                const loadingTimeout = setTimeout(() => {
                    console.warn('Game state loading timeout - setting to betting state');
                    if (gameStatus === 'loading') {
                        setGameStatus('betting');
                    }
                }, 5000); // 5 second timeout
                
                // Clean up timeout when component unmounts or gameStatus changes
                return () => {
                    clearTimeout(loadingTimeout);
                    socket.off(`game_update_${roomCode}`, gameUpdateHandler);
                    socket.off(`game_state_update:${roomCode}`, gameUpdateHandler);
                };
                
            } catch (error) {
                console.error("Error setting up game:", error);
                setGameStatus('error');
            }
        };
        
        if (player) {
            console.log('🔧 Setting up game for player:', player);
            setBalance(player.balance);
            fetchInitialState();
        } else {
            console.log('🔧 No player found, skipping game setup');
        }
    }, [gameMode, roomCode, player]);
    
    useEffect(() => {
        if (gameMode !== 'friend' || !roomCode) return;
        
        // Removed debug logging to prevent console spam
        
        const handleGameUpdate = (newState) => {
        // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam
        // Removed debug logging to prevent console spam
            
            // Don't override local state during dealer turn
            if (dealerTurnInProgress.current) {
        // Removed debug logging to prevent console spam
                return;
            }
            
            // Don't override local state during round end processing
            if (processingRoundEnd.current) {
        // Removed debug logging to prevent console spam
                return;
            }
            
            // Don't override roundOver status if we just set it locally
            if (gameStatus === 'roundOver' && newState.status !== 'roundOver') {
                console.log('🚫 Preventing server override of roundOver status:', {
                    localStatus: gameStatus,
                    serverStatus: newState.status
                });
                return;
            }
            
            // Also check if we're in dealer status locally but server is sending different status
            if (gameStatus === 'dealer' && newState.status !== 'dealer' && newState.status !== 'roundOver') {
        // Removed debug logging to prevent console spam
                return;
            }
            
            // If local status is roundOver and server is also roundOver, allow the update to proceed
            // This ensures proper synchronization of round end state
            if (gameStatus === 'roundOver' && newState.status === 'roundOver') {
        // Removed debug logging to prevent console spam
            }
            
            if (newState) {
        // Removed debug logging to prevent console spam
                setPlayers(newState.players || {});
        // Removed debug logging to prevent console spam
                setDealerHand(newState.dealer || { cards: [], score: 0 });
                const myState = newState.players ? newState.players[player.id] : undefined;
                let nextStatus = newState.status || 'betting';
                if (nextStatus === 'dealing' && myState && !myState.hasPlacedBet && !myState.isSpectating) {
        // Removed debug logging to prevent console spam
                    nextStatus = 'betting';
                }
        // Removed debug logging to prevent console spam
                setGameStatus(nextStatus);
                
        // Removed debug logging to prevent console spam
                setActivePlayerId(newState.activePlayerId || null);
                
        // Removed debug logging to prevent console spam
                setActiveHandIndex(newState.activeHandIndex || 0);
                
        // Removed debug logging to prevent console spam
                setRoundCounter(newState.roundCounter || 1);
                
        // Removed debug logging to prevent console spam
                setDeck(newState.deck || []);
                setAcePrompt(newState.acePrompt || null);
                
                // Sync roundResult from server
                if (newState.hasOwnProperty('roundResult')) {
                    setRoundResult(newState.roundResult);
                }
            }
        };
        
        const unsubscribe = subscribeToGameUpdates(roomCode, handleGameUpdate);
        
        return () => {
        // Removed debug logging to prevent console spam
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [gameMode, roomCode]);
    
    const currentBet = myPlayerState?.hands.reduce((sum, h) => sum + h.bet, 0) || 0;
    const sideBets = myPlayerState?.sideBets || {};
    
    return {
        players, dealerHand, gameStatus, activePlayerId, activeHandIndex, balance,
        roundResult, gameLog, roundCounter, keepSideBets, keepMainBet, isHost,
        myPlayerState, currentBet, sideBets, acePrompt, deck, numSeats: 5, mainPlayerSeatIndex: 2,
        canHit, canStand, canDouble, canSplit, canSurrender,
        handleHit, handleStand, handleDouble, handleSplit, handleSurrender,
        handleNewRound, handlePlaceBet, handleDeal, handleClearBet, handleClearSideBet,
        handleLockBet, toggleSpectator, handleMinBet, handleMaxBet,
        handleKeepSideBetsToggle, handleKeepMainBetToggle,
        getCardValue, handleAceChoice, handleManualAceChange, setPlayers, setDeck, setAcePrompt,
        adminTestingMode: false, adminActivePlayer: null, setAdminActivePlayer: () => {}, setAdminTestingMode: () => {}
    };
};

