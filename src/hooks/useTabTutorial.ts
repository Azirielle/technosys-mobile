import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCopilot } from 'react-native-copilot';
import { InteractionManager } from 'react-native';

// Global flag to prevent race conditions during rapid tab switching
let isTutorialActive = false;

export function useTabTutorial(tabName: string) {
  const { start, copilotEvents } = useCopilot();

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      
      const checkTutorial = async () => {
        try {
          const key = `HAS_SEEN_${tabName}_TUTORIAL_V2`;
          const hasSeen = await AsyncStorage.getItem(key);
          
          if (hasSeen !== 'true' && isActive && !isTutorialActive) {
            isTutorialActive = true;
            InteractionManager.runAfterInteractions(() => {
               // Delay to allow full layout render and avoid stuttering
               setTimeout(() => {
                 if (isActive) start();
               }, 800);
            });
          }
        } catch (e) {
          console.warn('Tutorial check failed', e);
        }
      };

      checkTutorial();

      const handleStop = async () => {
        isTutorialActive = false;
        try {
          await AsyncStorage.setItem(`HAS_SEEN_${tabName}_TUTORIAL_V2`, 'true');
        } catch (e) {
          // ignore
        }
      };
      
      if(copilotEvents) {
        copilotEvents.on('stop', handleStop);
      }

      return () => {
        isActive = false;
        if(copilotEvents) {
          copilotEvents.off('stop', handleStop);
        }
      };
    }, [tabName, start, copilotEvents])
  );
}
