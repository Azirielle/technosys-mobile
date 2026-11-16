// The blue "Navigate" pill shown in the corner of a map; opens Google Maps directions to the site.
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { openDirections } from '../lib/directions';

type Props = {
  lat?: number | null;
  lon?: number | null;
  address?: string | null;
  color: string; // brand blue from the theme
  label?: string;
};

export default function NavigateButton({ lat, lon, address, color, label = 'Navigate' }: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => openDirections(lat, lon, address)}
      style={[styles.pill, { backgroundColor: color }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather name="navigation" size={13} color="#FFF" style={{ marginRight: 5 }} />
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    elevation: 5,
  },
  text: { color: '#FFF', fontSize: 12, fontWeight: '700' },
});
