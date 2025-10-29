import React, { useContext, useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppContext } from '@/context/AppContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Wrench } from 'lucide-react';
import { API_ENDPOINTS } from '@/config/api';

const AdminMenu = ({ onForceStart, onNewRound, onDealAce, onDealSplitCards, onSetPlayerCards, players }) => {
  const { player, updatePlayerBalance } = useContext(AppContext);
  const { token } = useAuth();
  const [amount, setAmount] = useState('100');
  const [targetBalance, setTargetBalance] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [allUsers, setAllUsers] = useState([]);

  const currentBalance = useMemo(() => player?.balance ?? 0, [player]);

  // Fetch all users for dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      if (!token) return;
      
      try {
        const response = await fetch(API_ENDPOINTS.USERS, {
          headers: {
            'x-auth-token': token
          }
        });
        
        if (response.ok) {
          const users = await response.json();
          setAllUsers(users);
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };

    fetchUsers();
  }, [token]);

  const parseNumber = (val) => {
    const num = Number(val);
    return Number.isFinite(num) ? num : 0;
  };

  const handleAdd = async () => {
    const num = parseNumber(amount);
    if (num === 0) return;
    await updatePlayerBalance(num);
  };

  const handleSubtract = async () => {
    const num = parseNumber(amount);
    if (num === 0) return;
    await updatePlayerBalance(-num);
  };

  const handleSetBalance = async () => {
    const target = parseNumber(targetBalance);
    const delta = target - currentBalance;
    if (delta === 0) return;
    await updatePlayerBalance(delta);
  };

  const handleResetToThousand = async () => {
    const delta = 1000 - currentBalance;
    if (delta !== 0) await updatePlayerBalance(delta);
  };

  const handleDealAce = () => {
    // Removed debug logging to prevent console spam
    if (onDealAce && selectedPlayer) {
      onDealAce(selectedPlayer);
    } else {
      // Removed debug logging to prevent console spam
    }
  };

  const handleDealSplitCards = () => {
    // Removed debug logging to prevent console spam
    if (onDealSplitCards && selectedPlayer) {
      onDealSplitCards(selectedPlayer);
    } else {
      // Removed debug logging to prevent console spam
    }
  };

  const handleSetPlayerCards = () => {
    if (onSetPlayerCards && selectedPlayer) {
      onSetPlayerCards(selectedPlayer);
    }
  };

  // Get current game players for dropdown
  const gamePlayers = players ? Object.values(players).filter(p => p && !p.isSpectating) : [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="bg-black/30 hover:bg-black/50 w-8 h-8" title="Admin Menu">
          <Wrench size={18} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[92vw] max-w-[480px] bg-slate-900/90 backdrop-blur-sm border-yellow-500/30 text-white">
        <div className="space-y-4">
          <div>
            <h4 className="font-bold text-yellow-300">Admin Tools</h4>
            <p className="text-xs text-gray-300">Debug, reset, and adjust player balance.</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-300">Current Balance</span>
              <span className={`font-mono font-bold ${currentBalance < 0 ? 'text-red-400' : ''}`}>
                {currentBalance < 0 ? '-$' : '$'}{Math.abs(currentBalance).toLocaleString()}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <label className="text-sm text-gray-400 col-span-1">Amount</label>
              <Input value={amount} onChange={e => setAmount(e.target.value)} className="col-span-2 bg-black/40 border-gray-600 text-white" type="number" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd} className="bg-green-600 hover:bg-green-700 flex-1">Add</Button>
              <Button onClick={handleSubtract} className="bg-red-600 hover:bg-red-700 flex-1">Subtract</Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 items-center">
              <label className="text-sm text-gray-400 col-span-1">Set Balance</label>
              <Input value={targetBalance} onChange={e => setTargetBalance(e.target.value)} className="col-span-2 bg-black/40 border-gray-600 text-white" type="number" placeholder="e.g. 1000" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSetBalance} className="bg-blue-600 hover:bg-blue-700 flex-1">Apply</Button>
              <Button onClick={handleResetToThousand} className="bg-yellow-600 hover:bg-yellow-700 flex-1">Reset to $1,000</Button>
            </div>
          </div>

          <div className="space-y-2">
            <h5 className="font-semibold">Round Controls</h5>
            <div className="flex gap-2">
              <Button onClick={onForceStart} className="bg-sky-600 hover:bg-sky-700 flex-1">Force Start</Button>
              <Button onClick={onNewRound} className="bg-purple-600 hover:bg-purple-700 flex-1">New Round</Button>
            </div>
          </div>

          <div className="space-y-2">
            <h5 className="font-semibold">Card Testing</h5>
            <div className="flex gap-2">
              <Button onClick={handleDealAce} className="bg-orange-600 hover:bg-orange-700 flex-1">Deal Ace</Button>
              <Button onClick={handleDealSplitCards} className="bg-teal-600 hover:bg-teal-700 flex-1">Deal Split Cards</Button>
            </div>
          </div>

          <div className="space-y-2">
            <h5 className="font-semibold">Player Selection</h5>
            <div className="space-y-2">
              <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
                <SelectTrigger className="bg-black/40 border-gray-600 text-white">
                  <SelectValue placeholder="Select a player..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-gray-600">
                  <SelectItem value="all-users" className="text-gray-400">All Registered Users</SelectItem>
                  {allUsers.map(user => (
                    <SelectItem key={user._id} value={user._id} className="text-white">
                      {user.username} (${user.balance?.toLocaleString() || 0})
                    </SelectItem>
                  ))}
                  <SelectItem value="game-players-separator" disabled className="text-gray-500">--- Game Players ---</SelectItem>
                  {gamePlayers.map(gamePlayer => (
                    <SelectItem key={`game-${gamePlayer.id}`} value={gamePlayer.id} className="text-yellow-300">
                      🎮 {gamePlayer.username} (In Game)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleSetPlayerCards} disabled={!selectedPlayer} className="bg-indigo-600 hover:bg-indigo-700 w-full">
                Set Cards for Selected Player
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AdminMenu;
