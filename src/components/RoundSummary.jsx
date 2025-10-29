import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';

const RoundSummary = ({ roundResult, currentPlayerId, onClose }) => {
  const { t } = useTranslation();
  
  // Defensive logging to debug blue screen issue
  console.log('🎯 RoundSummary render:', {
    roundResult,
    currentPlayerId,
    hasRoundResult: !!roundResult,
    hasCurrentPlayerId: !!currentPlayerId,
    roundResultKeys: roundResult ? Object.keys(roundResult) : null
  });
  
  const myResult = roundResult && currentPlayerId ? roundResult[currentPlayerId] : null;
  
  console.log('🎯 RoundSummary myResult:', {
    myResult,
    hasMyResult: !!myResult,
    myResultKeys: myResult ? Object.keys(myResult) : null
  });

  // Auto-close after 8 seconds - increased to give more time to read
  useEffect(() => {
    if (myResult && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, 8000); // Increased from 4000ms to 8000ms
      
      return () => clearTimeout(timer);
    }
  }, [myResult, onClose]);

  const getResultColor = (payout) => {
    if (payout > 0) return 'text-green-400';
    if (payout < 0) return 'text-red-500';
    return 'text-yellow-400';
  };

  if (!myResult) {
    console.log('🎯 RoundSummary: No myResult, returning null');
    return null;
  }

  const { totalWinnings, mainHandResults, sideBetResults } = myResult;
  
  console.log('🎯 RoundSummary destructured data:', {
    totalWinnings,
    mainHandResults,
    sideBetResults,
    hasMainHandResults: !!mainHandResults,
    hasSideBetResults: !!sideBetResults,
    mainHandResultsLength: mainHandResults ? mainHandResults.length : 0,
    sideBetResultsLength: sideBetResults ? sideBetResults.length : 0
  });

  let title = '';
  if (totalWinnings > 0) {
    title = t('you_won_amount', { amount: totalWinnings.toLocaleString() });
  } else if (totalWinnings < 0) {
    title = t('you_lost_amount', { amount: Math.abs(totalWinnings).toLocaleString() });
  } else {
    title = t('round_pushed');
  }
  
  console.log('🎯 RoundSummary title generated:', { title, totalWinnings });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          transition={{ duration: 0.5, ease: 'backOut' }}
          className="text-center w-80"
        >
        <div className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border border-slate-600/30 rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-full ${
              totalWinnings > 0 
                ? 'bg-gradient-to-r from-green-600/20 to-emerald-500/20 border border-green-400/30' 
                : totalWinnings < 0 
                  ? 'bg-gradient-to-r from-red-600/20 to-red-500/20 border border-red-400/30'
                  : 'bg-gradient-to-r from-yellow-600/20 to-amber-500/20 border border-yellow-400/30'
            }`}>
              <div className={`w-3 h-3 rounded-full ${
                totalWinnings > 0 ? 'bg-green-400' : totalWinnings < 0 ? 'bg-red-400' : 'bg-yellow-400'
              }`}></div>
              <h2 className={`text-2xl font-bold ${getResultColor(totalWinnings)}`}>
                {title}
              </h2>
            </div>
          </div>
          
          <div className="space-y-3 text-left">
            {console.log('🎯 RoundSummary: About to render mainHandResults:', mainHandResults)}
            {mainHandResults && mainHandResults.map((res, index) => {
              console.log('🎯 RoundSummary: Rendering main hand result:', { res, index });
              return (
                <div key={`main-${index}`} className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border border-slate-700/30">
                  <span className="text-slate-300 font-medium">
                    {mainHandResults.length > 1 ? `Hand ${index + 1}:` : 'Main Hand:'} {res.result}
                  </span>
                  <span className={`font-bold text-lg ${getResultColor(res.winnings)}`}>
                    {res.winnings > 0 ? `+$${res.winnings}` : res.winnings < 0 ? `-$${Math.abs(res.winnings)}` : '$0'}
                  </span>
                </div>
              );
            })}
            
            {sideBetResults && sideBetResults.length > 0 && (
              <>
                {console.log('🎯 RoundSummary: About to render sideBetResults:', sideBetResults)}
                <div className="border-t border-slate-600/50 my-4"></div>
                {sideBetResults.map((res, index) => {
                  console.log('🎯 RoundSummary: Rendering side bet result:', { res, index });
                  return (
                    <div key={`side-${index}`} className="flex justify-between items-center p-3 bg-blue-900/30 rounded-lg border border-blue-700/30">
                      <span className="text-blue-200 font-medium">{res.text}</span>
                      <span className={`font-bold text-lg ${getResultColor(res.winnings)}`}>
                        {res.winnings > 0 ? `+$${res.winnings}` : res.winnings < 0 ? `-$${Math.abs(res.winnings)}` : '$0'}
                      </span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default RoundSummary;