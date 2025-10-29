import React, { useContext } from 'react';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AppContext } from '@/context/AppContext';

const LanguageSwitcher = () => {
  const { language, setLanguage } = useContext(AppContext);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="bg-black/30 hover:bg-black/50 w-8 h-8">
          <Globe size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-black/80 border-gray-700 text-white w-32">
        <DropdownMenuItem 
          onClick={() => setLanguage('en')} 
          className={`cursor-pointer ${language === 'en' ? 'bg-green-600/50' : ''}`}
        >
          English
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setLanguage('ja')}
          className={`cursor-pointer ${language === 'ja' ? 'bg-green-600/50' : ''}`}
        >
          日本語 (Japanese)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;