// Map used by the app (phones). Draws free OpenStreetMap tiles, like the admin's live map,
// so maps work in Expo Go and the APK without depending on Google's map tiles (they showed black).
import React from 'react';
import { View, Text, StyleSheet, Platform, StyleProp, ViewStyle } from 'react-native';
import MapView, { Marker, Circle, Polyline, UrlTile, MapViewProps } from 'react-native-maps';

export { Marker, Circle, Polyline };

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export default function AppMapView({ style, children, ...props }: MapViewProps & { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.frame, style]}>
      <MapView
        {...props}
        style={StyleSheet.absoluteFill}
        // 'none' hides Google's own base map on Android so only the free tiles show.
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
      >
        <UrlTile urlTemplate={OSM_TILES} maximumZ={19} shouldReplaceMapContent zIndex={-1} />
        {children}
      </MapView>
      <Text style={styles.credit}>© OpenStreetMap</Text>
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
