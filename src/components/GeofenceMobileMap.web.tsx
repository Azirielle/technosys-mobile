import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

interface GeofenceMobileMapProps {
  userLat: number;
  userLng: number;
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
  // If coordinates are invalid, show a placeholder
  if (!branchLat || !branchLng) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }]}>
        <Text style={{ color: '#64748b', fontSize: 12 }}>No location coordinates available</Text>
      </View>
    );
  }

  // Calculate distance locally using a simple approximation
  const getDistanceWeb = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // meters
    const phi1 = lat1 * Math.PI/180;
    const phi2 = lat2 * Math.PI/180;
    const deltaPhi = (lat2-lat1) * Math.PI/180;
    const deltaLambda = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in meters
  };

  const distance = getDistanceWeb(userLat || 0, userLng || 0, branchLat, branchLng);
  const isInside = distance <= radius;

  // Midpoints / layout constants for SVG
  const width = 300;
  const height = 230;
  const cx = width / 2;
  const cy = height / 2;

  // Scale: we want the Geofence Circle to have a constant visual radius on the radar
  const geofenceVisualRadius = 65;

  // Scale mapping: 1 meter = (geofenceVisualRadius / radius) pixels
  // If user distance is extremely large, cap it at a reasonable outer boundary so they don't fly off the screen
  const maxVisualDistance = 105;
  const rawPixelDistance = distance * (geofenceVisualRadius / radius);
  const pixelDistance = Math.min(rawPixelDistance, maxVisualDistance);

  // Set the angle of the user relative to the branch (using a fixed 45 degree angle for aesthetics)
  const angle = -Math.PI / 4; // top-right quadrant
  const ux = cx + Math.cos(angle) * pixelDistance;
  const uy = cy + Math.sin(angle) * pixelDistance;

  // Format display text
  const displayDistance = distance >= 1000 
    ? `${(distance / 1000).toFixed(1)} km` 
    : `${Math.round(distance)} meters`;

  return (
    <View style={styles.container}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ background: '#0b1329' }}>
        <defs>
          {/* Radial user glow */}
          <radialGradient id="userGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer Scope Border */}
        <circle cx={cx} cy={cy} r={105} fill="none" stroke="#1e293b" strokeWidth="1" />
        
        {/* Radar Concentric Rings */}
        <circle cx={cx} cy={cy} r={85} fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3, 3" />
        <circle cx={cx} cy={cy} r={40} fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3, 3" />
        
        {/* Radar Crosshairs */}
        <line x1={cx - 105} y1={cy} x2={cx + 105} y2={cy} stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2, 4" />
        <line x1={cx} y1={cy - 105} x2={cx} y2={cy + 105} stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2, 4" />

        {/* Sweeping Radar Line */}
        <line x1={cx} y1={cy} x2={cx + 105 * Math.cos(Math.PI/6)} y2={cy + 105 * Math.sin(Math.PI/6)} stroke="#10b981" strokeOpacity="0.4" strokeWidth="1.5" />

        {/* Geofence Boundary Circle */}
        <circle 
          cx={cx} 
          cy={cy} 
          r={geofenceVisualRadius} 
          fill={isInside ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.03)"} 
          stroke={isInside ? "#10b981" : "#ef4444"} 
          strokeWidth="2" 
          strokeDasharray={isInside ? undefined : "4, 4"}
        />

        {/* Proximity Connector Line */}
        <line 
          x1={cx} 
          y1={cy} 
          x2={ux} 
          y2={uy} 
          stroke={isInside ? "#10b981" : "#ef4444"} 
          strokeWidth="1.5" 
          strokeDasharray={isInside ? undefined : "3, 3"} 
        />

        {/* Central Branch Target Pin */}
        <g transform={`translate(${cx - 10}, ${cy - 10})`}>
          <circle cx="10" cy="10" r="12" fill="#1e293b" stroke={isInside ? "#10b981" : "#64748b"} strokeWidth="1" />
          {/* SVG building representation */}
          <path d="M6 14h8v3H6zm0-4h8v3H6zm0-4h8v3H6z" fill="#94a3b8" />
          <path d="M4 17h12v1H4zm1-14h10v14H5z" fill="none" stroke="#94a3b8" strokeWidth="1" />
        </g>

        {/* User Location Node */}
        <circle cx={ux} cy={uy} r="14" fill="url(#userGlow)" />
        <circle cx={ux} cy={uy} r="5" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />

        {/* Label Overlays */}
        <text x="10" y="20" fill="#94a3b8" fontSize="8" fontFamily="monospace">RADAR RESOLUTION: 50m</text>
        <text x="10" y="32" fill={isInside ? "#10b981" : "#ef4444"} fontSize="9" fontFamily="sans-serif" fontWeight="bold">
          {isInside ? "🟢 INSIDE BOUNDARY" : "🔴 OUTSIDE BOUNDARY"}
        </text>
        
        {/* Center Target Info */}
        <text x={cx} y={cy - 72} textAnchor="middle" fill="#f8fafc" fontSize="9" fontFamily="sans-serif" fontWeight="bold">
          {branchName} ({radius}m)
        </text>

        {/* Distance Indicator */}
        <rect x={ux - 35} y={uy + 8} width="70" height="12" rx="4" fill="#0f172a" stroke={isInside ? "#10b981" : "#ef4444"} strokeWidth="0.5" />
        <text x={ux} y={uy + 17} textAnchor="middle" fill="#f8fafc" fontSize="7.5" fontFamily="monospace" fontWeight="bold">
          {displayDistance}
        </text>
      </svg>
      <View style={styles.footerLabel}>
        <Text style={styles.footerText}>
          🛰️ <Text style={{ fontWeight: 'bold' }}>TechnoSys Radar Map:</Text> Showing relative distance to {branchName} ({radius}m geofence).
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 250,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e293b',
    marginVertical: 12,
    backgroundColor: '#0b1329'
  },
  footerLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b'
  },
  footerText: {
    color: '#94a3b8',
    fontSize: 9.5,
    textAlign: 'center'
  }
});
