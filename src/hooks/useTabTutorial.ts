import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useCopilot } from 'react-native-copilot';
import { InteractionManager } from 'react-native';
import { supabase } from '../lib/supabase';

let isTutorialActive = false;

export function useTabTutorial(tabName: string) {
  const { start, copilotEvents } = useCopilot();
  const [hasSeen, setHasSeen] = useState<boolean>(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      
      const checkTutorial = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data, error } = await supabase
            .from('profiles')
            .select('user_preferences')
            .eq('id', user.id)
            .single();

          if (error) throw error;

          const prefs = data?.user_preferences || {};
          const key = "has_seen_" + tabName.toLowerCase() + "_tutorial";
          const seen = !!prefs[key];
          setHasSeen(seen);
          
          if (!seen && isActive && !isTutorialActive) {
            isTutorialActive = true;
            InteractionManager.runAfterInteractions(() => {
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
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const key = "has_seen_" + tabName.toLowerCase() + "_tutorial";
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_preferences')
            .eq('id', user.id)
            .single();
            
          const currentPrefs = profile?.user_preferences || {};
          const updatedPrefs = { ...currentPrefs, [key]: true };

          await supabase
            .from('profiles')
            .update({ user_preferences: updatedPrefs })
            .eq('id', user.id);
            
          setHasSeen(true);
        } catch (e) {
          console.warn('Failed to save tutorial state to Supabase', e);
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
