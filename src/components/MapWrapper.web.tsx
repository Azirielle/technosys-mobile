import React from 'react';
import { View, Text } from 'react-native';

export const Marker = (props: any) => <View {...props} />;
export const Circle = (props: any) => <View {...props} />;
export const PROVIDER_GOOGLE = 'google';

const MapView = (props: any) => (
  <View style={[{ justifyContent: 'center', alignItems: 'center', backgroundColor: '#e2e8f0' }, props.style]}>
    <Text style={{ color: '#64748b' }}>Map View (Not supported on Web)</Text>
  </View>
);

export default MapView;
