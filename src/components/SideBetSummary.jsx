import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';

const SideBetSummary = ({ sideBets, isMobile = false }) => {
  const { t } = useTranslation();
  
  // Filter out side bets with 0 amount
  const activeSideBets = Object.entries(sideBets || {}).filter(([_, amount]) => amount > 0);
  
  if (activeSideBets.length === 0) {
    return null;
  }

  const totalSideBets = activeSideBets.reduce((sum, [_, amount]) => sum + amount, 0);

  const sideBetNames = {
    perfectPairs: 'Perfect Pairs',
    twentyOnePlusThree: '21+3',
    luckyLadies: 'Lucky Ladies',
    royalMatch: 'Royal Match',
    busterBlackjack: 'Buster Blackjack'
  };

  return (
    <div className={`bg-black/50 p-2 rounded text-center ${isMobile ? 'w-full' : 'w-32 md:w-36'}`}>
      <div className="text-xs text-gray-400 mb-1">{t('side_bets')}</div>
      <div className="font-bold text-sm md:text-base text-blue-400 mb-1">
        ${totalSideBets.toLocaleString()}
      </div>
      <div className="space-y-1">
        {activeSideBets.map(([betType, amount]) => (
          <div key={betType} className="flex justify-between items-center text-xs">
            <span className="text-gray-300 truncate">
              {sideBetNames[betType] || betType}
            </span>
            <span className="text-blue-300 font-medium ml-1">
              ${amount}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SideBetSummary;