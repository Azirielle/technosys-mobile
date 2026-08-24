import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const COLORS = {
  primary: '#2563eb',
  background: '#ffffff',
  textMain: '#1e293b',
  textMuted: '#64748b',
  overlay: 'rgba(15, 23, 42, 0.95)',
};

interface OnboardingTutorialProps {
  language: string;
}

export default function OnboardingTutorial({ language }: OnboardingTutorialProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(0);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    checkFirstLaunch();
  }, []);

  const checkFirstLaunch = async () => {
    try {
      const hasSeenTutorial = await AsyncStorage.getItem('HAS_SEEN_TUTORIAL_V1');
      if (hasSeenTutorial !== 'true') {
        setIsVisible(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }
    } catch (e) {
      console.warn('Failed to check tutorial status:', e);
    }
  };

  const finishTutorial = async () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(async () => {
      setIsVisible(false);
      try {
        await AsyncStorage.setItem('HAS_SEEN_TUTORIAL_V1', 'true');
      } catch (e) {
        // ignore
      }
    });
  };

  const nextStep = () => {
    if (step < steps.length - 1) {
      setStep(prev => prev + 1);
    } else {
      finishTutorial();
    }
  };

  const steps = [
    {
      icon: 'map-pin',
      title: language === 'fil' ? 'Geofence Attendance' : 'Geofence Attendance',
      desc: language === 'fil' 
        ? 'Mag-clock In at Out pagdating mo sa inyong opisina. Siguraduhing ikaw ay nasa loob ng radius ng Geofence Map upang makapag-log ng attendance.' 
        : 'Clock In and Out when you arrive at your office. Make sure you are inside the Geofence Map radius to successfully log your attendance.',
      color: '#10b981'
    },
    {
      icon: 'calendar',
      title: language === 'fil' ? 'Ang Iyong Iskedyul' : 'Your Schedule',
      desc: language === 'fil'
        ? 'Tingnan ang iyong mga paparating na dispatches at shift. Tinutulungan ka ng Priority Dispatches na malaman kung aling mga kliyente ang nangangailangan ng agarang pansin.'
        : 'View your upcoming dispatches and shifts. Priority Dispatches help you easily identify which clients need urgent attention.',
      color: '#2563eb'
    },
    {
      icon: 'message-square',
      title: language === 'fil' ? 'HR at Suporta' : 'HR & Support',
      desc: language === 'fil'
        ? 'Kailangan mag-file ng leave o may tanong sa payroll? Gamitin ang Support tab para direktang magpadala ng ticket at mensahe sa Admin.'
        : 'Need to file a leave or have a payroll question? Use the Support tab to send a ticket and message Admin directly.',
      color: '#8b5cf6'
    }
  ];

  if (!isVisible) return null;

  return (
    <Modal transparent visible={isVisible} animationType="none">
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <View style={styles.card}>
          <View style={[styles.iconRing, { backgroundColor: `${steps[step].color}15` }]}>
            <View style={[styles.iconCircle, { backgroundColor: steps[step].color }]}>
              <Feather name={steps[step].icon as any} size={40} color="#fff" />
            </View>
          </View>
          
          <Text style={styles.title}>{steps[step].title}</Text>
          <Text style={styles.desc}>{steps[step].desc}</Text>

          <View style={styles.dotsContainer}>
            {steps.map((_, idx) => (
              <View 
                key={idx} 
                style={[
                  styles.dot, 
                  step === idx ? { backgroundColor: steps[step].color, width: 20 } : { backgroundColor: '#cbd5e1' }
                ]} 
              />
            ))}
          </View>

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: steps[step].color }]} 
            onPress={nextStep}
          >
            <Text style={styles.buttonText}>
              {step === steps.length - 1 
                ? (language === 'fil' ? 'Magsimula' : 'Get Started') 
                : (language === 'fil' ? 'Susunod' : 'Next')}
            </Text>
            <Feather name={step === steps.length - 1 ? "check" : "arrow-right"} size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textMain,
    marginBottom: 12,
    textAlign: 'center',
  },
  desc: {
    fontSize: 15,
    lineHeight: 24,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 32,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
    gap: 8,
  },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 100,
    width: '100%',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  }
});
