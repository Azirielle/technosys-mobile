// Map used by the app (phones). Draws Esri's free street map tiles (no key needed), so maps work in Expo Go and
// the APK without Google's tiles (they showed black). Not OpenStreetMap's own servers: they block apps and send
// an "Access blocked" picture (checked 16 Nov), which is why the map was still black. Credit shown bottom-left.
import React from 'react';
import { View, Text, StyleSheet, Platform, StyleProp, ViewStyle } from 'react-native';
import MapView, { Marker, Circle, Polyline, UrlTile, MapViewProps } from 'react-native-maps';

export { Marker, Circle, Polyline };

const STREET_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';

export default function AppMapView({ style, children, ...props }: MapViewProps & { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.frame, style]}>
      <MapView
        {...props}
        style={StyleSheet.absoluteFill}
        // 'none' hides Google's own base map on Android so only the free tiles show.
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
      >
        <UrlTile urlTemplate={STREET_TILES} maximumZ={19} shouldReplaceMapContent zIndex={-1} />
        {children}
      </MapView>
      <Text style={styles.credit}>© Esri</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: '#E5E7EB' },
  credit: {
    position: 'absolute',
    left: 6,
    bottom: 4,
    fontSize: 9,
    color: '#334155',
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingHorizontal: 4,
    borderRadius: 3,
  },
});
