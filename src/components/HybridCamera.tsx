import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
const COLORS = {
  background: '#ffffff',
  card: '#f8fafc',
  primary: '#10b981',
  primaryDim: 'rgba(16, 185, 129, 0.1)',
  textMain: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  danger: '#ef4444'
};

interface HybridCameraProps {
  onPhotoTaken: (photoUri: string) => void;
  onCancel: () => void;
  language?: 'en' | 'fil';
}

export default function HybridCamera({ onPhotoTaken, onCancel, language = 'en' }: HybridCameraProps) {
  const [facing, setFacing] = useState<CameraType>('front');
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  if (!permission) {
    return <View style={styles.container}><ActivityIndicator size="large" color="#10b981" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>
          {language === 'fil' ? 'Kailangan namin ang iyong pahintulot para gamitin ang camera.' : 'We need your permission to show the camera.'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>{language === 'fil' ? 'Ibigay ang Pahintulot' : 'Grant Permission'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, { backgroundColor: '#ef4444', marginTop: 10 }]} onPress={onCancel}>
          <Text style={styles.buttonText}>{language === 'fil' ? 'Kanselahin' : 'Cancel'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      setIsProcessing(true);
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7, // compress slightly for faster upload
          base64: false,
        });
        if (photo && photo.uri) {
          setCapturedImage(photo.uri);
        }
      } catch (e) {
        console.error("Camera capture failed", e);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const submitPhoto = () => {
    if (capturedImage) {
      onPhotoTaken(capturedImage);
    }
  };

  // Preview Mode
  if (capturedImage) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: capturedImage }} style={styles.camera} />
        <View style={styles.previewOverlay}>
          <Text style={styles.previewText}>
            {language === 'fil' ? 'Tingnan ang Larawan' : 'Review Photo'}
          </Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.retakeBtn} onPress={() => setCapturedImage(null)}>
              <MaterialCommunityIcons name="refresh" size={24} color="#0f172a" />
              <Text style={styles.retakeText}>{language === 'fil' ? 'Ulitin' : 'Retake'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.submitBtn} onPress={submitPhoto}>
              <MaterialCommunityIcons name="check-circle" size={24} color="white" />
              <Text style={styles.submitText}>{language === 'fil' ? 'Ipasa' : 'Submit'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Camera Mode
  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
        <View style={styles.cameraOverlay}>
          
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onCancel} style={styles.iconButton}>
              <MaterialCommunityIcons name="close" size={28} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFacing(current => (current === 'back' ? 'front' : 'back'))} style={styles.iconButton}>
              <MaterialCommunityIcons name="camera-flip" size={28} color="white" />
            </TouchableOpacity>
          </View>

          <View style={styles.bottomBar}>
            <TouchableOpacity 
              style={styles.captureButtonOuter} 
              onPress={takePicture}
              disabled={isProcessing}
            >
              <View style={styles.captureButtonInner}>
                {isProcessing && <ActivityIndicator size="small" color="#10b981" />}
              </View>
            </TouchableOpacity>
            <Text style={styles.hintText}>
              {language === 'fil' ? 'Kumuha ng Selfie' : 'Take a Selfie'}
            </Text>
          </View>

        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 400,
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    padding: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconButton: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    padding: 8,
  },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  captureButtonOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  captureButtonInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintText: {
    color: 'white',
    marginTop: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  previewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  previewText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    gap: 8,
  },
  retakeText: {
    color: '#0f172a',
    fontWeight: 'bold',
    fontSize: 15,
  },
  submitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#10b981',
    borderRadius: 16,
    gap: 8,
  },
  submitText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
  text: {
    color: 'white',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  }
});
