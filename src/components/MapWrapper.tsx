// Map used by the app (phones): Google Maps (react-native-maps with the Google provider), no other map tiles.
// Android uses the Google Maps key in app.json (android.config.googleMaps.apiKey) in the APK; Expo Go uses its own.
// Re-exports Marker, Circle and Polyline so screens import everything map-related from here.
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import MapView, { Circle, MapViewProps, Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useTokens } from '../ui';

export { Marker, Circle, Polyline };

export default function AppMapView({ style, children, ...props }: MapViewProps & { style?: StyleProp<ViewStyle> }) {
  const { c } = useTokens();
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: c.cardSoft }, style]}>
      <MapView {...props} provider={PROVIDER_GOOGLE} style={StyleSheet.absoluteFill}>
        {children}
      </MapView>
    </View>
  );
}
