
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PlayingCard = React.forwardRef(({ card, hidden = false, cardIndex = 0, isDealerCard = false, isTurn, onAceToggle, onAceClick, isAcePromptActive, showDealerHoleCard = true }, ref) => {
  const cardRef = useRef(null);
  const [hasBeenDealt, setHasBeenDealt] = useState(false);

  // Removed debug logging to prevent console spam

  // CSS + WAAPI animation for card dealing with flip - only run once when card is first rendered
  useEffect(() => {
    if (cardRef.current && !hasBeenDealt && card && card.value !== 'hidden') {
      const delay = cardIndex * 200; // Stagger delay in milliseconds - increased for smoother animation
      
      // Define the animation keyframes - cards come from top-right (dealer position)
      const dealKeyframes = [
        {
          transform: 'translateX(200px) translateY(-200px) scale(0.6) rotateY(180deg)',
          opacity: 0.8
        },
        {
          transform: 'translateX(100px) translateY(-100px) scale(0.8) rotateY(90deg)',
          opacity: 0.9,
          offset: 0.5
        },
        {
          transform: isDealerCard && cardIndex === 1 && !showDealerHoleCard 
            ? 'translateX(0px) translateY(0px) scale(1) rotateY(180deg)' // Keep face down for dealer hole card
            : 'translateX(0px) translateY(0px) scale(1) rotateY(0deg)', // Face up for all other cards
          opacity: 1
        }
      ];

      // Animation options
      const animationOptions = {
        duration: 800,
        delay: delay,
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        fill: 'forwards'
      };

      // Apply the animation using Web Animations API
      cardRef.current.animate(dealKeyframes, animationOptions);
      setHasBeenDealt(true);
    }
  }, [cardIndex, isDealerCard, card?.value]); // Added card?.value to dependencies to handle card changes

  // No automatic flip animation - the card display is controlled by the hidden prop and card prop

  const getCardImageUrl = (card) => {
    if (!card) return '';
    // Will be updated to local paths when user provides assets
    const baseUrl = '/assets/cards/';
    
    let suit = '';
    switch (card.suit) {
      case 'hearts': suit = 'Heart'; break;
      case 'diamonds': suit = 'Diamond'; break;
      case 'clubs': suit = 'Club'; break;
      case 'spades': suit = 'Spade'; break;
      default: suit = card.suit ? card.suit.charAt(0).toUpperCase() + card.suit.slice(1) : '';
    }

    let value = '';
    if (card.value) {
        switch (card.value) {
          case 'A': value = 'A'; break;
          case 'J': value = 'J'; break;
          case 'Q': value = 'Q'; break;
          case 'K': value = 'K'; break;
          default: value = card.value.toString();
        }
    }
    
    return `${baseUrl}${suit}${value}.svg`;
  };

  const cardImageUrl = getCardImageUrl(card);
  const cardBackUrl = '/assets/cards/Card_back.svg';

  const cardSpread = isDealerCard ? 40 : 30;
  
  const isAce = card && card.value === 'A';
  const canToggleAce = isAce && isTurn && !hidden && (onAceToggle || onAceClick);

  const handleAceClick = (e) => {
    // Removed debug logging to prevent console spam
    
    if (canToggleAce && onAceClick) {
        e.stopPropagation();
        
        // If there's an active prompt, don't interfere with it
        if (isAcePromptActive) {
          // Removed debug logging to prevent console spam
          return;
        }
        
        // For manual ace value toggling (when no prompt is active)
        const currentValue = card.chosenValue || 11;
        const newValue = currentValue === 11 ? 1 : 11;
        // Removed debug logging to prevent console spam
        onAceClick(newValue);
    } else {
        // Removed debug logging to prevent console spam
    }
  };

  return (
    <div
        ref={(el) => {
          cardRef.current = el;
          if (ref) {
            if (typeof ref === 'function') {
              ref(el);
            } else {
              ref.current = el;
            }
          }
        }}
        className="playing-card pointer-events-auto"
        style={{
            position: 'absolute',
            left: `${cardIndex * (isDealerCard ? 40 : 30)}px`,
            zIndex: 20 + cardIndex,
            width: '105px',
            height: '147px',
            // Initial state for CSS animation
            transform: 'translateX(200px) translateY(-200px) scale(0.6) rotateY(180deg)',
            opacity: 0.8
        }}
    >
      <div className="relative w-[105px] h-[147px]">
        {/* Ace pill for player cards */}
        {!isDealerCard && isAce && !hidden && (
          <div 
              onClick={handleAceClick}
              className={`absolute -top-3 -left-3 bg-black/70 text-white text-xs font-bold rounded-md px-2 py-1 shadow z-[90] ${canToggleAce ? 'cursor-pointer hover:bg-yellow-500 hover:text-black' : 'cursor-default'}`}
          >
              A{card.chosenValue || 11}
              {/* Debug info */}
              <span className="sr-only">
                Debug: {JSON.stringify({ chosenValue: card.chosenValue, canToggle: canToggleAce, isTurn })}
              </span>
          </div>
        )}
    
        {/* Card face/back */}
        <motion.img
          src={hidden || (isDealerCard && cardIndex === 1 && !showDealerHoleCard) ? cardBackUrl : cardImageUrl}
          alt={hidden || (isDealerCard && cardIndex === 1 && !showDealerHoleCard) ? 'Hidden card' : `${card.value} of ${card.suit}`}
          className="w-[105px] h-[147px] rounded-lg shadow-lg select-none"
          draggable={false}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ 
            duration: 0.6, 
            ease: 'easeInOut',
            type: 'spring',
            stiffness: 100
          }}
          style={{
            opacity: 1
          }}
        />
      </div>
    </div>
  );
});

PlayingCard.displayName = 'PlayingCard';

export default PlayingCard;

