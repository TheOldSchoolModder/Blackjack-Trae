import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SideBetDisplay = ({ sideBets, isMobile = false }) => {
  // Filter out side bets with 0 amount
  const activeSideBets = Object.entries(sideBets || {}).filter(([_, amount]) => amount > 0);
  
  if (activeSideBets.length === 0) {
    return null;
  }

  const sideBetNames = {
    perfectPairs: 'Perfect Pairs',
    '21+3': '21+3',
    luckyLadies: 'Lucky Ladies',
    royalMatch: 'Royal Match',
    busterBlackjack: 'Buster Blackjack'
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`
          fixed z-[95] left-1/2 transform -translate-x-1/2
          ${isMobile ? 'bottom-[100px]' : 'bottom-[150px]'}
          bg-gradient-to-r from-blue-900/90 to-blue-800/90 
          backdrop-blur-md border border-blue-700/50 
          rounded-lg px-3 py-1.5 shadow-lg
          pointer-events-none
          -ml-8
        `}
      >
          <div className="flex items-center gap-3 text-xs">
            <span className="text-blue-300 font-medium">Side Bets:</span>
            {activeSideBets.map(([betType, amount], index) => (
              <React.Fragment key={betType}>
                {index > 0 && <div className="w-px h-3 bg-blue-600"></div>}
                <div className="flex items-center gap-1.5">
                  <span className="text-blue-200">{sideBetNames[betType] || betType}</span>
                  <span className="font-bold text-blue-100">${amount}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </motion.div>
    </AnimatePresence>
  );
};

export default SideBetDisplay;