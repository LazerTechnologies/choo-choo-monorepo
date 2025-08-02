import { useCallback } from 'react';

export interface SoundPlayerOptions {
  volume?: number;
  onError?: (error: Error) => void;
}

export function useSoundPlayer() {
  const playSound = useCallback((soundPath: string, options: SoundPlayerOptions = {}) => {
    try {
      const audio = new Audio(soundPath);

      if (options.volume !== undefined) {
        audio.volume = Math.max(0, Math.min(1, options.volume));
      }

      audio.play().catch((error) => {
        const audioError = new Error(`Failed to play sound: ${error.message}`);
        if (options.onError) {
          options.onError(audioError);
        } else {
          console.log('Audio play failed:', audioError.message);
        }
      });
    } catch (error) {
      const createError = new Error(
        `Failed to create audio: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      if (options.onError) {
        options.onError(createError);
      } else {
        console.log('Audio creation failed:', createError.message);
      }
    }
  }, []);

  const playChooChoo = useCallback(
    (options: SoundPlayerOptions = {}) => {
      playSound('/sounds/choochoo.mp3', options);
    },
    [playSound]
  );

  return {
    playSound,
    playChooChoo,
  };
}
