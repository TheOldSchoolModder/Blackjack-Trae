import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSound } from '@/hooks/useSound';

const chips = [
  { value: 5, colorClass: 'chip-5' },
  { value: 10, colorClass: 'chip-10' },
  { value: 25, colorClass: 'chip-25' },
  { value: 50, colorClass: 'chip-50' },
  { value: 100, colorClass: 'chip-100' },
  { value: 500, colorClass: 'chip-500' },
  { value: 1000, colorClass: 'chip-1000' },
  { value: 5000, colorClass: 'chip-5000' },
  { value: 10000, colorClass: 'chip-10000' },
];

const StackedChipMenu = ({ onPlaceBet, disabled }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { playSound } = useSound();

  const handleChipClick = (value) => {
    if (disabled) return;
    onPlaceBet(value, 'main');
    playSound('bet', { debounce: true });
  };

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const getChipPosition = (index, isExpanded) => {
    if (isMobile) {
      // Mobile: Simple grid layout
      return {
        x: 0,
        y: 0,
        rotate: 0,
        zIndex: index,
      };
    }

    if (isExpanded) {
      // Expanded: Spread out horizontally with slight arc
      const totalChips = chips.length;
      const spacing = 70; // Horizontal spacing between chips
      const startX = -((totalChips - 1) * spacing) / 2;
      const x = startX + (index * spacing);
      const y = Math.abs(index - (totalChips - 1) / 2) * -8; // Slight arc effect
      
      return {
        x,
        y,
        rotate: (index - (totalChips - 1) / 2) * 3, // Slight rotation for natural look
        zIndex: totalChips - Math.abs(index - (totalChips - 1) / 2),
      };
    } else {
      // Stacked: Cards in hand formation
      const baseRotation = -20;
      const rotationStep = 5;
      const baseX = index * 8; // Slight horizontal offset
      const baseY = index * -2; // Slight vertical offset
      
      return {
        x: baseX,
        y: baseY,
        rotate: baseRotation + (index * rotationStep),
        zIndex: index,
      };
    }
  };

  if (isMobile) {
    return (
      <div className="grid grid-cols-3 gap-2 p-3 bg-black/20 backdrop-blur-sm rounded-lg border border-gray-600">
        {chips.map((chip, index) => (
          <motion.button
            key={chip.value}
            onClick={() => handleChipClick(chip.value)}
            className={`chip ${chip.colorClass} mx-auto relative`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            disabled={disabled}
            aria-label={`Bet ${chip.value}`}
          >
            <span className={`text-xs font-bold pointer-events-none ${chip.value === 10000 ? 'text-black' : 'text-white'}`}>
              {chip.value}
            </span>
          </motion.button>
        ))}
      </div>
    );
  }

  return (
    <div 
      className="relative flex items-center justify-center h-20 w-96"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {chips.map((chip, index) => {
        const position = getChipPosition(index, isHovered);
        
        return (
          <motion.button
            key={chip.value}
            onClick={() => handleChipClick(chip.value)}
            className={`chip ${chip.colorClass} absolute cursor-pointer`}
            disabled={disabled}
            aria-label={`Bet ${chip.value}`}
            animate={{
              x: position.x,
              y: position.y,
              rotate: position.rotate,
              zIndex: position.zIndex,
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              duration: 0.3,
            }}
            whileHover={{ 
              scale: 1.1,
              transition: { duration: 0.1 }
            }}
            whileTap={{ scale: 0.95 }}
            style={{
              zIndex: position.zIndex,
            }}
          >
            <span className={`text-xs font-bold pointer-events-none ${chip.value === 10000 ? 'text-black' : 'text-white'}`}>
              {chip.value}
            </span>
            
            {/* Price label that appears on hover */}
            <motion.div
              className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
              initial={{ opacity: 0, y: 5 }}
              animate={{ 
                opacity: isHovered ? 1 : 0, 
                y: isHovered ? 0 : 5 
              }}
              transition={{ delay: 0.1 }}
            >
              ${chip.value}
            </motion.div>
          </motion.button>
        );
      })}
      
      {/* Instruction text */}
      <motion.div
        className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-gray-400 whitespace-nowrap"
        initial={{ opacity: 0.7 }}
        animate={{ opacity: isHovered ? 0 : 0.7 }}
      >
        Hover to expand chips
      </motion.div>
    </div>
  );
};

export default StackedChipMenu;