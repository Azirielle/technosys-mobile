import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Dimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

interface AnimatedSplashScreenProps {
  isReady: boolean;
  onAnimationComplete: () => void;
}

export default function AnimatedSplashScreen({ isReady, onAnimationComplete }: AnimatedSplashScreenProps) {
  // Arrow Shared Values (Counter-Clockwise sequence: Blue -> Red -> Yellow -> Green)
  const blueScale = useSharedValue(0.2);
  const blueOpacity = useSharedValue(0);
  const blueY = useSharedValue(-25);

  const redScale = useSharedValue(0.2);
  const redOpacity = useSharedValue(0);
  const redX = useSharedValue(-25);

  const yellowScale = useSharedValue(0.2);
  const yellowOpacity = useSharedValue(0);
  const yellowY = useSharedValue(25);

  const greenScale = useSharedValue(0.2);
  const greenOpacity = useSharedValue(0);
  const greenX = useSharedValue(25);

  // Center Gear Shared Values
  const gearScale = useSharedValue(0.4);
  const gearOpacity = useSharedValue(0);
  const gearRotation = useSharedValue(-90);

  // Typography Shared Values
  const textOpacity = useSharedValue(0);
  const textY = useSharedValue(18);

  const subTextOpacity = useSharedValue(0);
  const subTextY = useSharedValue(12);

  // Master Container Transition
  const containerOpacity = useSharedValue(1);
  const containerScale = useSharedValue(1);

  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    // 1. Blue Arrow (Top) - 0ms
    blueScale.value = withDelay(40, withSpring(1, { damping: 13, stiffness: 140 }));
    blueOpacity.value = withDelay(40, withTiming(1, { duration: 180 }));
    blueY.value = withDelay(40, withSpring(0, { damping: 14 }));

    // 2. Red Arrow (Left, Counter-Clockwise Step 2) - 130ms
    redScale.value = withDelay(130, withSpring(1, { damping: 13, stiffness: 140 }));
    redOpacity.value = withDelay(130, withTiming(1, { duration: 180 }));
    redX.value = withDelay(130, withSpring(0, { damping: 14 }));

    // 3. Yellow Arrow (Bottom, Counter-Clockwise Step 3) - 230ms
    yellowScale.value = withDelay(230, withSpring(1, { damping: 13, stiffness: 140 }));
    yellowOpacity.value = withDelay(230, withTiming(1, { duration: 180 }));
    yellowY.value = withDelay(230, withSpring(0, { damping: 14 }));

    // 4. Green Arrow (Right, Counter-Clockwise Step 4) - 330ms
    greenScale.value = withDelay(330, withSpring(1, { damping: 13, stiffness: 140 }));
    greenOpacity.value = withDelay(330, withTiming(1, { duration: 180 }));
    greenX.value = withDelay(330, withSpring(0, { damping: 14 }));

    // 5. Center Gear (Meshes and Rotates into place) - 420ms
    gearScale.value = withDelay(420, withSpring(1, { damping: 14, stiffness: 130 }));
    gearOpacity.value = withDelay(420, withTiming(1, { duration: 220 }));
    gearRotation.value = withDelay(420, withSpring(0, { damping: 15, stiffness: 110 }));

    // 6. Wordmark & Descriptor - 580ms
    textOpacity.value = withDelay(580, withTiming(1, { duration: 250 }));
    textY.value = withDelay(580, withSpring(0, { damping: 15 }));

    subTextOpacity.value = withDelay(720, withTiming(1, { duration: 280 }));
    subTextY.value = withDelay(720, withSpring(0, { damping: 16 }));

    // Enforce 1100ms minimum display so animation plays crisply without cutting abruptly
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 1100);

    return () => clearTimeout(timer);
  }, []);

  // When both minimum animation duration has elapsed and app session/auth is ready, dissolve smoothly
  useEffect(() => {
    if (minTimeElapsed && isReady) {
      containerOpacity.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.quad) }, (finished) => {
        if (finished) {
          runOnJS(onAnimationComplete)();
        }
      });
      containerScale.value = withTiming(1.05, { duration: 320 });
    }
  }, [minTimeElapsed, isReady]);

  // Animated Styles
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  const blueStyle = useAnimatedStyle(() => ({
    opacity: blueOpacity.value,
    transform: [{ scale: blueScale.value }, { translateY: blueY.value }],
  }));

  const redStyle = useAnimatedStyle(() => ({
    opacity: redOpacity.value,
    transform: [{ scale: redScale.value }, { translateX: redX.value }],
  }));

  const yellowStyle = useAnimatedStyle(() => ({
    opacity: yellowOpacity.value,
    transform: [{ scale: yellowScale.value }, { translateY: yellowY.value }],
  }));

  const greenStyle = useAnimatedStyle(() => ({
    opacity: greenOpacity.value,
    transform: [{ scale: greenScale.value }, { translateX: greenX.value }],
  }));

  const gearStyle = useAnimatedStyle(() => ({
    opacity: gearOpacity.value,
    transform: [{ scale: gearScale.value }, { rotate: `${gearRotation.value}deg` }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textY.value }],
  }));

  const subTextStyle = useAnimatedStyle(() => ({
    opacity: subTextOpacity.value,
    transform: [{ translateY: subTextY.value }],
  }));

  return (
    <Animated.View style={[styles.overlay, containerAnimatedStyle]} pointerEvents="none">
      <View style={styles.centerContainer}>
        {/* Emblem Layer Canvas */}
        <View style={styles.emblemContainer}>
          {/* Base Center Gear and Typography */}
          <Animated.Image
            source={require('../../assets/images/emblem_parts/center_gear.png')}
            style={[StyleSheet.absoluteFill, gearStyle]}
            resizeMode="contain"
          />

          {/* Top Blue Arrow */}
          <Animated.Image
            source={require('../../assets/images/emblem_parts/arrow_blue.png')}
            style={[StyleSheet.absoluteFill, blueStyle]}
            resizeMode="contain"
          />

          {/* Left Red Arrow */}
          <Animated.Image
            source={require('../../assets/images/emblem_parts/arrow_red.png')}
            style={[StyleSheet.absoluteFill, redStyle]}
            resizeMode="contain"
          />

          {/* Bottom Yellow Arrow */}
          <Animated.Image
            source={require('../../assets/images/emblem_parts/arrow_yellow.png')}
            style={[StyleSheet.absoluteFill, yellowStyle]}
            resizeMode="contain"
          />

          {/* Right Green Arrow */}
          <Animated.Image
            source={require('../../assets/images/emblem_parts/arrow_green.png')}
            style={[StyleSheet.absoluteFill, greenStyle]}
            resizeMode="contain"
          />
        </View>

        {/* Brand Wordmark & Descriptor */}
        <Animated.View style={[styles.typographyContainer, textStyle]}>
          <Text style={styles.title}>TECHNOCYCLE</Text>
        </Animated.View>

        <Animated.View style={[styles.descriptorContainer, subTextStyle]}>
          <Text style={styles.subtitle}>F I E L D   O P E R A T I O N S</Text>
        </Animated.View>
      </View>

      {/* Subtle Footer Telemetry */}
      <View style={styles.footerContainer}>
        <View style={styles.footerDot} />
        <Text style={styles.footerText}>ENTERPRISE FIELD SERVICE PLATFORM</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
    zIndex: 99999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemContainer: {
    width: 220,
    height: 220,
    position: 'relative',
  },
  typographyContainer: {
    marginTop: 28,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'DMSans-Bold',
  },
  descriptorContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'DMSans-Medium',
  },
  footerContainer: {
    position: 'absolute',
    bottom: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  footerText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#94A3B8',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'DMSans-Regular',
  },
});
