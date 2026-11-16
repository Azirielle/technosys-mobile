// Opens Google Maps with driving directions to a job site (used by every "Navigate" button).
import { Linking } from 'react-native';

export function openDirections(lat?: number | null, lon?: number | null, address?: string | null) {
  if (lat != null && lon != null) {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`);
  } else if (address) {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`);
  } else {
    Linking.openURL('https://www.google.com/maps');
  }
}
