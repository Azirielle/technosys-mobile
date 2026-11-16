// Glow: the soft blue/cyan light at the top of a screen that the glass sits on (colors.md "Glass").
// Drawn with SVG radial gradients (no blur needed). On Android it is also the "blur target" that
// <Glass> pieces blur, so wrap a screen's content in <GlowScreen> to use glass on it.
import React, { createContext, useContext, useRef, RefObject } from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { BlurTargetView } from 'expo-blur';
import { useTokens } from './useTokens';

const GlowTargetContext = createContext<RefObject<View | null> | null>(null);
/** The blur target for <Glass>, if the screen has a glow. */
export const useGlowTarget = () => useContext(GlowTargetContext);

function GlowShapes() {
  const { c } = useTokens();
  return (
    <Svg width="100%" height={420} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
      <Defs>
        <RadialGradient id="g1" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={c.glow1} stopOpacity={1} />
          <Stop offset="1" stopColor={c.glow1} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="g2" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={c.glow2} stopOpacity={1} />
          <Stop offset="1" stopColor={c.glow2} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx="10%" cy="40" r="210" fill="url(#g1)" />
      <Circle cx="100%" cy="170" r="200" fill="url(#g2)" />
    </Svg>
  );
}

/** A full screen with the canvas color and the glow at the top. Glass inside it blurs the glow. */
export function GlowScreen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTokens();
  const target = useRef<View | null>(null);
  return (
    <View style={[{ flex: 1, backgroundColor: c.canvas }, style]}>
      <BlurTargetView ref={target} style={StyleSheet.absoluteFill} pointerEvents="none">
        <GlowShapes />
      </BlurTargetView>
      <GlowTargetContext.Provider value={target}>{children}</GlowTargetContext.Provider>
    </View>
  );
}
