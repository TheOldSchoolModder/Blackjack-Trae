import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from '@/hooks/useTranslation';
import { ChevronDown, ChevronRight } from 'lucide-react';

    const CollapsibleSideBet = ({ title, description, payoutRows, isOpen, onToggle }) => (
        <div className="border border-yellow-500/20 rounded-lg overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full px-4 py-3 bg-yellow-500/10 hover:bg-yellow-500/20 transition-colors flex items-center justify-between text-left"
            >
                <h4 className="font-semibold text-yellow-300">{title}</h4>
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {isOpen && (
                <div className="p-4 space-y-2">
                    <p className="text-sm text-gray-300">{description}</p>
                    <PayoutTable rows={payoutRows} />
                </div>
            )}
        </div>
    );

    const RuleSection = ({ title, children }) => (
        <div className="space-y-2">
            <h4 className="font-semibold text-yellow-300">{title}</h4>
            <div className="text-sm text-gray-300 space-y-1">{children}</div>
        </div>
    );

    const PayoutTable = ({ rows }) => (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {rows.map(([item, payout]) => (
                <React.Fragment key={item}>
                    <span className="text-gray-400">{item}</span>
                    <span className="text-right font-mono">{payout}</span>
                </React.Fragment>
            ))}
        </div>
    );

    const RulesModal = ({ isOpen, onClose }) => {
      const { t } = useTranslation();
      const [openSideBets, setOpenSideBets] = useState({});

      const toggleSideBet = (betName) => {
        setOpenSideBets(prev => ({
          ...prev,
          [betName]: !prev[betName]
        }));
      };
      
      return (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="bg-slate-900/95 border-yellow-500/30 text-white max-w-4xl w-[95vw] max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="text-yellow-300 text-2xl">{t('rules_title')}</DialogTitle>
              <DialogDescription>
                {t('rules_description')}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
                <Tabs defaultValue="basics" className="w-full h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-4 bg-black/30 flex-shrink-0">
                    <TabsTrigger value="basics">{t('rules_basics')}</TabsTrigger>
                    <TabsTrigger value="moves">{t('rules_moves')}</TabsTrigger>
                    <TabsTrigger value="insurance">{t('rules_insurance')}</TabsTrigger>
                    <TabsTrigger value="side-bets">{t('rules_side_bets')}</TabsTrigger>
                </TabsList>
                <div className="flex-1 overflow-y-auto mt-4 pr-2">
                <TabsContent value="basics" className="space-y-4 m-0 data-[state=active]:block data-[state=inactive]:hidden">
                    <RuleSection title={t('rules_objective_title')}>
                        <p>{t('rules_objective_desc')}</p>
                    </RuleSection>
                    <RuleSection title={t('rules_card_values_title')}>
                        <p>{t('rules_card_values_number')}</p>
                        <p>{t('rules_card_values_face')}</p>
                        <p>{t('rules_card_values_aces')}</p>
                    </RuleSection>
                    <RuleSection title={t('rules_deal_title')}>
                        <p>{t('rules_deal_desc')}</p>
                    </RuleSection>
                    <RuleSection title={t('rules_blackjack_title')}>
                        <p>{t('rules_blackjack_desc')}</p>
                    </RuleSection>
                </TabsContent>
                <TabsContent value="moves" className="space-y-4 m-0 data-[state=active]:block data-[state=inactive]:hidden">
                    <RuleSection title={t('rules_hit_title')}>
                        <p>{t('rules_hit_desc')}</p>
                    </RuleSection>
                    <RuleSection title={t('rules_stand_title')}>
                        <p>{t('rules_stand_desc')}</p>
                    </RuleSection>
                    <RuleSection title={t('rules_double_title')}>
                        <p>{t('rules_double_desc')}</p>
                    </RuleSection>
                    <RuleSection title={t('rules_split_title')}>
                        <p>{t('rules_split_desc')}</p>
                    </RuleSection>
                    <RuleSection title={t('rules_surrender_title')}>
                        <p>{t('rules_surrender_desc')}</p>
                    </RuleSection>
                </TabsContent>
                <TabsContent value="insurance" className="space-y-4 m-0 data-[state=active]:block data-[state=inactive]:hidden">
                    <RuleSection title={t('rules_insurance_what_title')}>
                        <p>{t('rules_insurance_what_desc')}</p>
                    </RuleSection>
                    <RuleSection title={t('rules_insurance_how_title')}>
                        <p>{t('rules_insurance_how_desc')}</p>
                    </RuleSection>
                    <RuleSection title={t('rules_even_money_title')}>
                        <p>{t('rules_even_money_desc')}</p>
                    </RuleSection>
                </TabsContent>
                <TabsContent value="side-bets" className="m-0 data-[state=active]:block data-[state=inactive]:hidden">
                    <div className="space-y-3 pb-4">
                        <CollapsibleSideBet
                            title={t('rules_perfect_pairs_title')}
                            description={t('rules_perfect_pairs_desc')}
                            payoutRows={[
                                [t('rules_perfect_pair'), "25:1"],
                                [t('rules_colored_pair'), "10:1"],
                                [t('rules_mixed_pair'), "5:1"],
                            ]}
                            isOpen={openSideBets.perfectPairs}
                            onToggle={() => toggleSideBet('perfectPairs')}
                        />
                        <CollapsibleSideBet
                            title={t('rules_21plus3_title')}
                            description={t('rules_21plus3_desc')}
                            payoutRows={[
                                [t('rules_suited_trips'), "100:1"],
                                [t('rules_straight_flush'), "40:1"],
                                [t('rules_three_kind'), "30:1"],
                                [t('rules_straight'), "10:1"],
                                [t('rules_flush'), "5:1"],
                            ]}
                            isOpen={openSideBets.twentyOnePlus3}
                            onToggle={() => toggleSideBet('twentyOnePlus3')}
                        />
                        <CollapsibleSideBet
                            title={t('rules_lucky_ladies_title')}
                            description={t('rules_lucky_ladies_desc')}
                            payoutRows={[
                                [t('rules_two_queens_hearts'), "1000:1"],
                                [t('rules_two_queens_hearts_bj'), "200:1"],
                                [t('rules_matched_20'), "25:1"],
                                [t('rules_suited_20'), "10:1"],
                                [t('rules_any_20'), "4:1"],
                            ]}
                            isOpen={openSideBets.luckyLadies}
                            onToggle={() => toggleSideBet('luckyLadies')}
                        />
                        <CollapsibleSideBet
                            title={t('rules_royal_match_title')}
                            description={t('rules_royal_match_desc')}
                            payoutRows={[
                                [t('rules_royal_match_kq'), "25:1"],
                                [t('rules_suited_match'), "2.5:1"],
                            ]}
                            isOpen={openSideBets.royalMatch}
                            onToggle={() => toggleSideBet('royalMatch')}
                        />
                        <CollapsibleSideBet
                            title={t('rules_buster_title')}
                            description={t('rules_buster_desc')}
                            payoutRows={[
                                [t('rules_bust_8plus'), "200:1"],
                                [t('rules_bust_7'), "50:1"],
                                [t('rules_bust_6'), "15:1"],
                                [t('rules_bust_5'), "4:1"],
                                [t('rules_bust_4'), "2:1"],
                                [t('rules_bust_3'), "1:1"],
                            ]}
                            isOpen={openSideBets.buster}
                            onToggle={() => toggleSideBet('buster')}
                        />
                    </div>
                </TabsContent>
                </div>
                </Tabs>
            </div>
          </DialogContent>
        </Dialog>
      );
    };

    export default RulesModal;