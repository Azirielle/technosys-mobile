import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from './MapWrapper';
import { getDistance } from 'geolib';

// Radar map style (Dark Mode/Sci-fi look)
const radarStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#334155' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#020617' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] }
];

interface GeofenceMobileMapProps {
  userLat?: number;
  userLng?: number;
  branchLat: number;
  branchLng: number;
  radius: number;
  branchName: string;
}

export default function GeofenceMobileMap({
  userLat,
  userLng,
  branchLat,
  branchLng,
  radius,
  branchName
}: GeofenceMobileMapProps) {
  if (!branchLat || !branchLng) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#94a3b8', fontSize: 12 }}>No location available</Text>
      </View>
    );
  }

  const hasUserLocation = userLat !== undefined && userLng !== undefined;
  const distance = hasUserLocation 
    ? getDistance({ latitude: userLat, longitude: userLng }, { latitude: branchLat, longitude: branchLng })
    : Infinity;
  const isInside = hasUserLocation && distance <= radius;

  const mapRadius = Math.max(radius, distance === Infinity ? radius : distance) * 1.5;
  const delta = (mapRadius / 111000) * 2;

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        customMapStyle={radarStyle}
        initialRegion={{
          latitude: branchLat,
          longitude: branchLng,
          latitudeDelta: delta,
          longitudeDelta: delta,
        }}
        showsUserLocation={false} 
        showsCompass={false}
        showsScale={false}
      >
        <Marker
          coordinate={{ latitude: branchLat, longitude: branchLng }}
          title={branchName}
          tracksViewChanges={false}
        >
          <View style={styles.branchMarker}>
            <View style={styles.branchMarkerInner} />
          </View>
        </Marker>

        {/* Outer Radar Ring */}
        <Circle
          center={{ latitude: branchLat, longitude: branchLng }}
          radius={radius * 3}
          strokeWidth={1}
          strokeColor="rgba(16, 185, 129, 0.2)"
          fillColor="transparent"
        />

        {/* Inner Geofence Boundary */}
        <Circle
          center={{ latitude: branchLat, longitude: branchLng }}
          radius={radius}
          strokeWidth={2}
          strokeColor={isInside ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)'}
          fillColor={isInside ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.05)'}
        />

        {hasUserLocation && (
          <Marker
            key={`user-${userLat}-${userLng}`}
            coordinate={{ latitude: userLat!, longitude: userLng! }}
            title="You"
            zIndex={2}
          >
            <View style={styles.userMarkerGlow}>
              <View style={[styles.userMarker, { backgroundColor: isInside ? '#10b981' : '#3b82f6' }]} />
            </View>
          </Marker>
        )}
      </MapView>

      <View style={styles.radarOverlay}>
        <Text style={styles.radarText}>RADAR RESOLUTION: 50m</Text>
        <Text style={[styles.radarStatus, { color: isInside ? '#10b981' : '#ef4444' }]}>
          {isInside ? '● INSIDE BOUNDARY' : '○ OUTSIDE BOUNDARY'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#0f172a'
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  radarOverlay: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    alignItems: 'center',
  },
  radarText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  radarStatus: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: 1,
  },
  branchMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  branchMarkerInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  userMarkerGlow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  }
});
