import React, { useState, useEffect, useRef } from 'react';

const ShuffleAnimation = ({ isVisible, onComplete, duration = 2000 }) => {
  const [animationPhase, setAnimationPhase] = useState('hidden');
  const spinAnimationRef = useRef();

  useEffect(() => {
    if (isVisible) {
      setAnimationPhase('fanOut');
      
      // Phase 1: Fan out (300ms) - faster fan out
      const fanOutTimer = setTimeout(() => {
        setAnimationPhase('spinning');
      }, 300);

      // Phase 2: Spinning (1200ms) - shorter spinning phase
      const spinTimer = setTimeout(() => {
        setAnimationPhase('fanIn');
      }, 1500);

      // Phase 3: Fan in and complete (500ms)
      const completeTimer = setTimeout(() => {
        setAnimationPhase('hidden');
        onComplete && onComplete();
      }, duration);

      return () => {
        clearTimeout(fanOutTimer);
        clearTimeout(spinTimer);
        clearTimeout(completeTimer);
      };
    }
  }, [isVisible, duration, onComplete]);

  if (!isVisible && animationPhase === 'hidden') return null;

  // Create 8 cards for the fan animation
  const cards = Array.from({ length: 8 }, (_, i) => i);

  const getCardStyle = (index) => {
    const angleStep = 360 / 8; // 45 degrees between each card
    const baseAngle = index * angleStep;
    const radius = 120;
    
    let transform = '';
    let opacity = 1;
    
    switch (animationPhase) {
      case 'fanOut':
        // Cards move from center to form a circle
        const fanOutRadius = radius * 0.8; // Slightly smaller radius for fan out
        const x = Math.cos((baseAngle - 90) * Math.PI / 180) * fanOutRadius;
        const y = Math.sin((baseAngle - 90) * Math.PI / 180) * fanOutRadius;
        transform = `
          translate(-50%, -50%) 
          translate(${x}px, ${y}px)
          rotate(${baseAngle}deg)
        `;
        break;
      case 'spinning':
        // Cards spin in a complete circle
        const spinAngle = baseAngle + (Date.now() / 8) % 360; // Smooth continuous rotation
        const x2 = Math.cos((spinAngle - 90) * Math.PI / 180) * radius;
        const y2 = Math.sin((spinAngle - 90) * Math.PI / 180) * radius;
        transform = `
          translate(-50%, -50%) 
          translate(${x2}px, ${y2}px)
          rotate(${spinAngle + 90}deg)
        `;
        break;
      case 'fanIn':
        // Cards move back to center
        transform = `
          translate(-50%, -50%) 
          rotate(0deg)
        `;
        opacity = 0.3;
        break;
      default:
        transform = 'translate(-50%, -50%)';
        opacity = 0;
    }

    return {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: '70px',
      height: '98px',
      backgroundImage: "url('/assets/cards/Card_back.svg')",
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      transform,
      opacity,
      transition: animationPhase === 'spinning' ? 'none' : 'all 0.5s ease-in-out',
      zIndex: 1000 + index,
      borderRadius: '8px',
      boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
    };
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '300px',
          height: '300px',
        }}
      >
        {cards.map((_, index) => (
          <div
            key={index}
            style={getCardStyle(index)}
          />
        ))}
        
        {/* Center text */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '60%',
            transform: 'translate(-50%, -50%)',
            color: 'white',
            fontSize: '24px',
            fontWeight: 'bold',
            textAlign: 'center',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
            opacity: animationPhase === 'spinning' ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out',
          }}
        >
          Shuffling...
        </div>
      </div>
    </div>
  );
};

export default ShuffleAnimation;