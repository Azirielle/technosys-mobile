// TechyChatLayer: wraps the tabs so Techy's chat can open the way Andrew chose (motion #15, useTechyOpening): the
// screen you're on turns over like a page with the chat underneath, and Techy flies to its seat in the chat header.
// The phone's Back button and "End" both close it (the chat slides down, Techy goes home).
// Techy's dock opens it with openTechyChat(). (HR replies in the Inbox open their own screen, app/ticket/[id].tsx.)
import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import TechyChat from './TechyChat';
import { BIG, TECHY_H, useTechyOpening } from './useTechyOpening';
import { Techy, techy, useTokens } from '../../ui';

const listeners = new Set<() => void>();
/** Opens Techy's chat: your unfinished Techy chat, or a new one. */
export function openTechyChat() { listeners.forEach((l) => l()); }

export default function TechyChatLayer({ children }: { children: React.ReactNode }) {
  const { c } = useTokens();
  const motion = useTechyOpening();
  const [chat, setChat] = useState(false); // mounted while open
  const [onTop, setOnTop] = useState(false); // under the turning page while opening, on top once open
  const busy = useRef(false);
  const opening = useRef(false);
  const closeWhenOpen = useRef(false); // Back was pressed while it was still opening
  const shutRef = useRef<() => void>(() => {});
  const { open, close } = motion;

  useEffect(() => {
    const listener = async () => {
      if (busy.current) return;
      busy.current = true;
      techy.away(true); // the dock is empty: this Techy is the one doing the opening
      setOnTop(false); setChat(true);
      opening.current = true;
      await open();
      opening.current = false;
      setOnTop(true);
      busy.current = false;
      if (closeWhenOpen.current) { closeWhenOpen.current = false; shutRef.current(); }
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, [open]);

  const shut = async () => {
    if (busy.current) return;
    busy.current = true;
    await close();
    setChat(false); setOnTop(false);
    techy.away(false);
    busy.current = false;
  };
  useEffect(() => { shutRef.current = shut; });

  // The phone's Back button closes the chat with the same motion as "End"
  useEffect(() => {
    if (!chat) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (opening.current) closeWhenOpen.current = true; // still opening: close as soon as it's open
      else shut();
      return true;
    });
    return () => sub.remove();
  });

  return (
    // collapsable={false}: keeps this wrapper as a real view, so the zIndex values below stay inside it. Without it the
    // new architecture flattens the wrapper away and the screen's zIndex lifted the tabs above Techy's dock.
    <View style={{ flex: 1 }} collapsable={false}>
      {chat && (
        <Animated.View style={[StyleSheet.absoluteFill, { zIndex: onTop ? 2 : 0 }, motion.chatStyle]}>
          <TechyChat onEnd={shut} dimStyle={motion.chatDimStyle} />
        </Animated.View>
      )}
      {/* The screen you're on: it turns over like a page when the chat opens */}
      {/* renderToHardwareTexture while it turns: the phone moves one picture of the screen instead of redrawing it */}
      <Animated.View pointerEvents={onTop ? 'none' : 'auto'} renderToHardwareTextureAndroid={!!chat && !onTop} shouldRasterizeIOS={!!chat && !onTop}
        style={[{ flex: 1, zIndex: chat ? 1 : undefined }, chat ? motion.screenStyle : null]}>
        {children}
        {chat && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }, motion.shadeStyle]} />}
      </Animated.View>
      {chat && (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: BIG, height: TECHY_H, zIndex: 3 }, motion.techyStyle]}>
          <Techy mood={motion.mood} size={BIG} still={motion.still} hands={motion.hands} />
        </Animated.View>
      )}
    </View>
  );
}
