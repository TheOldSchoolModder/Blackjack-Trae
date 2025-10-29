import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

const ChipMenu = ({ onPlaceBet, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const menuRef = useRef(null);
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

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEsc);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.06,
      },
    },
  };

  const chipVariants = {
    hidden: { y: 20, opacity: 0, scale: 0.8 },
    visible: { y: 0, opacity: 1, scale: 1 },
  };

  return (
    <div ref={menuRef} className="relative flex flex-col items-center" role="menu">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={`${
              isMobile 
                ? 'flex flex-col items-center gap-2 mb-4 max-h-64 overflow-y-auto bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 border border-gray-600' 
                : 'flex justify-center items-center gap-2 mb-4'
            }`}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            aria-hidden={!isOpen}
          >
            {isMobile ? (
              // Mobile: Vertical layout with 3 chips per row
              <div className="grid grid-cols-3 gap-2 w-full max-w-xs">
                {chips.map((chip) => (
                  <motion.button
                    key={chip.value}
                    onClick={() => handleChipClick(chip.value)}
                    className={`chip ${chip.colorClass} mx-auto`}
                    aria-label={`Bet ${chip.value}`}
                    variants={chipVariants}
                    role="menuitem"
                    disabled={disabled}
                  >
                    <span className={`text-xs font-bold pointer-events-none ${chip.value === 10000 ? 'text-black' : 'text-white'}`}>
                      {chip.value}
                    </span>
                  </motion.button>
                ))}
              </div>
            ) : (
              // Desktop: Horizontal layout
              chips.map((chip) => (
                <motion.button
                  key={chip.value}
                  onClick={() => handleChipClick(chip.value)}
                  className={`chip ${chip.colorClass}`}
                  aria-label={`Bet ${chip.value}`}
                  variants={chipVariants}
                  role="menuitem"
                  disabled={disabled}
                >
                  <span className={`text-xs font-bold pointer-events-none ${chip.value === 10000 ? 'text-black' : 'text-white'}`}>
                    {chip.value}
                  </span>
                </motion.button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-6 py-2 bg-yellow-500 text-black font-bold rounded-full shadow-lg hover:bg-yellow-400 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
        aria-haspopup="true"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        Bet Menu
      </button>
    </div>
  );
};

export default ChipMenu;