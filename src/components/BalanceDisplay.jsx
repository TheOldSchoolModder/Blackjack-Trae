import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const AnimatedBalance = ({ value }) => {
  return (
    <motion.div
      key={value}
      initial={{ scale: 1.2, color: '#10b981' }}
      animate={{ scale: 1, color: value < 0 ? '#ef4444' : '#10b981' }}
      transition={{ duration: 0.3 }}
      className="font-bold text-base md:text-lg"
    >
      ${Math.abs(value).toLocaleString()}
    </motion.div>
  );
};

const BalanceDisplay = ({ balance, currentBet, isMobile }) => {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className={`
          fixed z-[90] left-4 transform
          ${isMobile ? 'bottom-[140px]' : 'bottom-[140px]'}
          bg-gradient-to-r from-gray-900/90 to-gray-800/90 
          backdrop-blur-md border border-gray-700/50 
          rounded-lg px-4 py-2 shadow-lg
          pointer-events-none
        `}
      >
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-300">Balance:</span>
            <AnimatedBalance value={balance} />
          </div>
          <div className="w-px h-4 bg-gray-600"></div>
          <div className="flex items-center gap-2">
            <span className="text-gray-300">Main Bet:</span>
            <span className="font-bold text-base md:text-lg text-yellow-400">
              ${(currentBet || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BalanceDisplay;