import { useState, useEffect, useCallback, useRef } from 'react';
import { Howl, Howler } from 'howler';
import { useDebounce } from '@/hooks/useDebounce';

const soundUrls = {
  bet: '/assets/sounds/chip-bet.mp3',
  deal: '/assets/sounds/card-deal.mp3',
  card: '/assets/sounds/dealerflip.mp3',
  win: '/assets/sounds/win.mp3',
  lose: '/assets/sounds/lose.mp3',
  push: '/assets/sounds/push.mp3',
  shuffle: '/assets/sounds/shuffle.mp3',
};

const soundCache = {};

export const useSound = () => {
  const [isMuted, setIsMuted] = useState(() => {
    const savedMute = localStorage.getItem('blackjack_muted');
    return savedMute ? JSON.parse(savedMute) : false;
  });
  
  const audioUnlocked = useRef(false);
  const soundCacheRef = useRef({});
  const lastPlayed = useRef({});
  
  const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), delay);
    };
  };

  const debouncedPlaySoundRef = useRef(debounce((soundName) => {
    if (!isMuted && audioUnlocked.current) {
        const sound = soundCacheRef.current[soundName];
        if (sound && sound.state() === 'loaded') {
            sound.play();
        } else if (!sound) {
            console.warn(`Sound "${soundName}" not found or preloaded.`);
        }
    }
  }, 150));

  useEffect(() => {
    Howler.mute(isMuted);
    localStorage.setItem('blackjack_muted', JSON.stringify(isMuted));
  }, [isMuted]);

  const preloadSounds = useCallback(() => {
    console.log("Preloading sounds...");
    Object.keys(soundUrls).forEach(key => {
      if (!soundCacheRef.current[key]) {
        soundCacheRef.current[key] = new Howl({
          src: [soundUrls[key]],
          volume: 0.7,
          preload: true,
          onloaderror: (id, err) => {
              console.warn(`Failed to load sound: ${key} (${soundUrls[key]}). Error:`, err);
          },
          onload: () => {
              // console.log(`Sound loaded: ${key}`);
          }
        });
      }
    });
  }, []);

  const unlockAudio = useCallback(() => {
    if (audioUnlocked.current || typeof window === 'undefined') return;

    const unlock = async () => {
        try {
            await Howler.ctx.resume();
        } catch (e) {
            console.error("Audio context resume failed.", e);
        } finally {
            if (Howler.ctx.state === 'running') {
                audioUnlocked.current = true;
                console.log("Audio Unlocked!");
                preloadSounds();
                // Play and immediately pause a silent sound to help iOS
                const silence = new Howl({ src: ['data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU2LjQwLjEwMQAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU2LjQxAAAAAAAAAAAAAAAAJAAAAAAAAAAAASDs90hvAAAAAAAAAAAAAAAAAAAA//MUZAAAAAGkAAAAAAAAA0gAAAAATEFN//MUZAMAAAGkAAAAAAAAA0gAAAAARTMu//MUZAYAAAGkAAAAAAAAA0gAAAAA//MUZAAAAAGkAAAAAAAAA0gAAAAATFVY//MUZAMAAAGkAAAAAAAAA0gAAAAAV1hY//MUZAYAAAGkAAAAAAAAA0gAAAAA']});
                silence.volume(0);
                silence.play();
                window.removeEventListener('click', unlock, true);
                window.removeEventListener('touchend', unlock, true);
                window.removeEventListener('keydown', unlock, true);
            }
        }
    };

    window.addEventListener('click', unlock, true);
    window.addEventListener('touchend', unlock, true);
    window.addEventListener('keydown', unlock, true);

    return () => {
      window.removeEventListener('click', unlock, true);
      window.removeEventListener('touchend', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
  }, [preloadSounds]);

  useEffect(() => {
    const cleanup = unlockAudio();
    return cleanup || (() => {}); // Ensure we always return a function
  }, [unlockAudio]);

  const playSound = useCallback((soundName, options = {}) => {
    if (!audioUnlocked.current) return;
    
    if (options.debounce) {
        debouncedPlaySoundRef.current(soundName);
        return;
    }

    if (!isMuted) {
        const sound = soundCacheRef.current[soundName];
        if (sound) {
            if(sound.playing()) {
                sound.stop();
            }
            sound.play();
        } else {
            console.warn(`Sound "${soundName}" not found or preloaded.`);
        }
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  return { playSound, isMuted, toggleMute };
};