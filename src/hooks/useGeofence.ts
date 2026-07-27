import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { getDistance } from 'geolib';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { withTimeout } from '../lib/timeout';

interface GeofenceResult {
  status: 'idle' | 'checking' | 'inside' | 'outside' | 'error';
  distance?: number | null; // meters from nearest office
  latitude?: number | null;
  longitude?: number | null;
  matchingOfficeName?: string | null;
  officeLatitude?: number | null;
  officeLongitude?: number | null;
  officeRadius?: number | null;
  error: string | null;
  errorKey?: string;
  isMocked?: boolean;
  gpsAccuracy?: number | null;
  timeDrift?: number | null;
}

export function useGeofence() {
  const [result, setResult] = useState<GeofenceResult>({
    status: 'idle', 
    distance: null, 
    latitude: null, 
    longitude: null, 
    matchingOfficeName: null,
    officeLatitude: null,
    officeLongitude: null,
    officeRadius: null,
    error: null,
    errorKey: undefined,
    isMocked: false,
    gpsAccuracy: null
  });

  const [offices, setOffices] = useState<any[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null);

  const officesRef = useRef<any[]>([]);
  const selectedOfficeIdRef = useRef<string | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // Clean up location subscription on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
    };
  }, []);

  const checkLocation = useCallback(async (overrideOfficeId?: string): Promise<GeofenceResult> => {
    setResult(prev => ({ ...prev, status: 'checking', error: null }));

    try {
      // 1. Request permission with try-catch
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const errorMsg = 'Location permission denied. Please enable it in your phone settings.';
        setResult(prev => ({ ...prev, status: 'error', error: errorMsg, errorKey: 'locationPermissionDenied' }));
        return { status: 'error', error: errorMsg, errorKey: 'locationPermissionDenied' } as const;
      }

      // 2. Get current position with 10-second timeout and cache fallback
      let location = null;
      try {
        const gpsPromise = Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        location = await withTimeout(gpsPromise, 10000);
      } catch (gpsErr) {
        console.warn("GPS request failed or timed out, trying last known position:", gpsErr);
        try {
          location = await Location.getLastKnownPositionAsync();
        } catch (cacheErr) {
          console.warn("Failed to retrieve last known position:", cacheErr);
        }
      }

      if (!location) {
        const errorMsg = 'Location request timed out. Please ensure GPS/Location services are enabled on your device and try again.';
        setResult(prev => ({ ...prev, status: 'error', error: errorMsg, errorKey: 'locationTimeout' }));
        return { status: 'error', error: errorMsg, errorKey: 'locationTimeout' } as const;
      }

      const isMocked = !!(location as any).mocked;
      const gpsAccuracy = location.coords.accuracy;

      // Time Tampering Detection (Check system clock against GPS satellite timestamp)
      const gpsTime = location.timestamp;
      const deviceTime = Date.now();
      const timeDelta = Math.abs(deviceTime - gpsTime);

      if (timeDelta > 5 * 60 * 1000) { // 5 minutes tolerance
        const errorMsg = 'Time manipulation detected. Please set your device clock to automatic network time.';
        setResult(prev => ({ ...prev, status: 'error', error: errorMsg, errorKey: 'timeTamperingDetected' }));
        return { status: 'error', error: errorMsg, errorKey: 'timeTamperingDetected' } as const;
      }

      if (isMocked) {
        const errorMsg = 'FAKE GPS DETECTED: You cannot use mock locations or VPNs to clock in.';
        setResult(prev => ({ ...prev, status: 'error', error: errorMsg, errorKey: 'mockLocationDetected' }));
        return { status: 'error', error: errorMsg, errorKey: 'mockLocationDetected' } as const;
      }

      if (Platform.OS !== 'web' && gpsAccuracy && gpsAccuracy > 200) {
        const errorMsg = `Poor GPS signal accuracy (${Math.round(gpsAccuracy)}m). Please step outside or find an open space.`;
        setResult(prev => ({ ...prev, status: 'error', error: errorMsg, errorKey: 'poorGpsSignal' }));
        return { status: 'error', error: errorMsg, errorKey: 'poorGpsSignal' } as const;
      }

      const userLat = location.coords.latitude;
      const userLng = location.coords.longitude;

      // 3. Fetch ALL active office locations from Supabase (with cache fallback)
      let fetchedOffices: any[] = [];
      try {
        const fetchPromise = supabase
          .from('office_locations')
          .select('*')
          .eq('is_active', true);
        const { data, error: dbError } = await withTimeout(fetchPromise, 4000);
        
        if (dbError) throw dbError;
        
        if (data && data.length > 0) {
          fetchedOffices = data;
          setOffices(data);
          officesRef.current = data;
          await AsyncStorage.setItem('CACHED_OFFICE_LOCATIONS', JSON.stringify(data));
        } else {
          throw new Error('No active office locations in database.');
        }
      } catch (err) {
        console.warn('DB geofence fetch failed. Loading cached locations...', err);
        const cached = await AsyncStorage.getItem('CACHED_OFFICE_LOCATIONS');
        if (cached) {
          fetchedOffices = JSON.parse(cached);
          setOffices(fetchedOffices);
          officesRef.current = fetchedOffices;
        } else {
          const errorMsg = 'No office locations found in cache or database. Connect to network to download coordinates.';
          setResult(prev => ({ ...prev, status: 'error', error: errorMsg }));
          return { status: 'error', error: errorMsg } as const;
        }
      }

      // 4. Calculate distance to target selected office, or find nearest
      const activeOfficeId = overrideOfficeId || selectedOfficeId;
      let targetOffice = activeOfficeId ? fetchedOffices.find(o => o.id === activeOfficeId) : null;
      
      let nearestOffice = targetOffice || null;
      let nearestDistance = Infinity;
      let isInsideAny = false;

      if (targetOffice) {
        nearestDistance = getDistance(
          { latitude: userLat, longitude: userLng },
          { latitude: targetOffice.latitude, longitude: targetOffice.longitude }
        );
        isInsideAny = nearestDistance <= targetOffice.radius_meters;
        if (overrideOfficeId) {
          setSelectedOfficeId(overrideOfficeId);
          selectedOfficeIdRef.current = overrideOfficeId;
        }
      } else {
        // Find nearest office automatically
        for (const office of fetchedOffices) {
          const distanceMeters = getDistance(
            { latitude: userLat, longitude: userLng },
            { latitude: office.latitude, longitude: office.longitude }
          );

          if (distanceMeters <= office.radius_meters) {
            isInsideAny = true;
            nearestOffice = office;
            nearestDistance = distanceMeters;
            break; // Stop immediately since they are inside an allowed zone
          }

          if (distanceMeters < nearestDistance) {
            nearestDistance = distanceMeters;
            nearestOffice = office;
          }
        }
        if (nearestOffice) {
          setSelectedOfficeId(nearestOffice.id);
          selectedOfficeIdRef.current = nearestOffice.id;
        }
      }

      // 5. Start watching location for real-time tracking if not already watching
      if (!subscriptionRef.current) {
        subscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 4000,   // every 4 seconds
            distanceInterval: 3,  // every 3 meters
          },
          (newLoc) => {
            const freshLat = newLoc.coords.latitude;
            const freshLng = newLoc.coords.longitude;
            const freshAccuracy = newLoc.coords.accuracy;
            const freshIsMocked = !!(newLoc as any).mocked;

            const currentOffices = officesRef.current;
            const currentSelectedOfficeId = selectedOfficeIdRef.current;

            if (currentOffices.length === 0) return;

            let liveTargetOffice = currentSelectedOfficeId ? currentOffices.find(o => o.id === currentSelectedOfficeId) : null;
            let liveNearestOffice = liveTargetOffice || null;
            let liveDistance = Infinity;
            let liveIsInside = false;

            if (liveTargetOffice) {
              liveDistance = getDistance(
                { latitude: freshLat, longitude: freshLng },
                { latitude: liveTargetOffice.latitude, longitude: liveTargetOffice.longitude }
              );
              liveIsInside = liveDistance <= liveTargetOffice.radius_meters;
            } else {
              // Fallback to finding nearest
              for (const office of currentOffices) {
                const distanceMeters = getDistance(
                  { latitude: freshLat, longitude: freshLng },
                  { latitude: office.latitude, longitude: office.longitude }
                );

                if (distanceMeters <= office.radius_meters) {
                  liveIsInside = true;
                  liveNearestOffice = office;
                  liveDistance = distanceMeters;
                  break;
                }

                if (distanceMeters < liveDistance) {
                  liveDistance = distanceMeters;
                  liveNearestOffice = office;
                }
              }
            }

            if (liveNearestOffice) {
              if (liveIsInside) {
                setResult({
                  status: 'inside',
                  distance: liveDistance,
                  latitude: freshLat,
                  longitude: freshLng,
                  matchingOfficeName: liveNearestOffice.name,
                  officeLatitude: liveNearestOffice.latitude,
                  officeLongitude: liveNearestOffice.longitude,
                  officeRadius: liveNearestOffice.radius_meters,
                  error: null,
                  isMocked: freshIsMocked,
                  gpsAccuracy: freshAccuracy,
                  timeDrift: 0
                });
              } else {
                const errorMsg = `You are ${liveDistance}m away from the nearest branch (${liveNearestOffice.name}). You must be within ${liveNearestOffice.radius_meters}m to clock in.`;
                setResult({
                  status: 'outside',
                  distance: liveDistance,
                  latitude: freshLat,
                  longitude: freshLng,
                  matchingOfficeName: liveNearestOffice.name,
                  officeLatitude: liveNearestOffice.latitude,
                  officeLongitude: liveNearestOffice.longitude,
                  officeRadius: liveNearestOffice.radius_meters,
                  error: errorMsg,
                  isMocked: freshIsMocked,
                  gpsAccuracy: freshAccuracy,
                  timeDrift: 0
                });
              }
            }
          }
        );
      }

      // 6. Build final result
      if (isInsideAny && nearestOffice) {
        const finalResult: GeofenceResult = {
          status: 'inside',
          distance: nearestDistance,
          latitude: userLat,
          longitude: userLng,
          matchingOfficeName: nearestOffice.name,
          officeLatitude: nearestOffice.latitude,
          officeLongitude: nearestOffice.longitude,
          officeRadius: nearestOffice.radius_meters,
          error: null,
          isMocked,
          gpsAccuracy,
          timeDrift: timeDelta
        };
        setResult(finalResult);
        return finalResult;
      } else {
        const nearestName = nearestOffice ? nearestOffice.name : 'Office';
        const nearestRadius = nearestOffice ? nearestOffice.radius_meters : 50;
        const errorMsg = `You are ${nearestDistance}m away from the nearest branch (${nearestName}). You must be within ${nearestRadius}m to clock in.`;
        
        const finalResult: GeofenceResult = {
          status: 'outside',
          distance: nearestDistance,
          latitude: userLat,
          longitude: userLng,
          matchingOfficeName: nearestName,
          officeLatitude: nearestOffice ? nearestOffice.latitude : null,
          officeLongitude: nearestOffice ? nearestOffice.longitude : null,
          officeRadius: nearestRadius,
          error: errorMsg,
          isMocked,
          gpsAccuracy,
          timeDrift: timeDelta
        };
        setResult(finalResult);
        return finalResult;
      }
    } catch (err: any) {
      // Presentation Fallback: Triggered when native GPS permissions or hardware check fails (e.g., in web browser testing)
      if (Platform.OS !== 'web') { const errorMsg = err.message || 'Location timeout or GPS error on physical device.'; setResult(prev => ({ ...prev, status: 'error', error: errorMsg })); return { status: 'error', error: errorMsg } as const; } console.warn("GPS check failed. Activating presentation fallback simulator...", err);
      
      let fetchedOffices = officesRef.current;
      if (fetchedOffices.length === 0) {
        const cached = await AsyncStorage.getItem('CACHED_OFFICE_LOCATIONS');
        if (cached) {
          fetchedOffices = JSON.parse(cached);
          setOffices(fetchedOffices);
          officesRef.current = fetchedOffices;
        }
      }

      if (fetchedOffices.length === 0) {
        // Ultimate fallback static list of branch locations
        fetchedOffices = [
          { id: "83699d74-a9f6-456d-8eb7-b9903767da00", name: "Main Office", latitude: 14.5995, longitude: 120.9842, radius_meters: 50 },
          { id: "4b318db1-828f-41e7-a8ff-756556e77557", name: "Quezon City Branch", latitude: 14.6760, longitude: 121.0437, radius_meters: 100 },
          { id: "c70eb697-12c5-41bb-97aa-31aaad6dc208", name: "Quezon City HQ", latitude: 14.6515, longitude: 121.0493, radius_meters: 150 }
        ];
        setOffices(fetchedOffices);
        officesRef.current = fetchedOffices;
      }

      const activeOfficeId = overrideOfficeId || selectedOfficeId;
      let targetOffice = activeOfficeId ? fetchedOffices.find(o => o.id === activeOfficeId) : null;
      let nearestOffice = targetOffice || fetchedOffices[0];

      // Smart simulation positioning logic:
      // If Quezon City HQ is selected, place user inside the geofence radius.
      // Otherwise, place user outside the radius to showcase both geofence states.
      const isInsideSimulation = nearestOffice.name === "Quezon City HQ";
      const mockUserLat = isInsideSimulation 
        ? nearestOffice.latitude + 0.0002 
        : nearestOffice.latitude + 0.0015;
      const mockUserLng = isInsideSimulation 
        ? nearestOffice.longitude + 0.0002 
        : nearestOffice.longitude + 0.0015;

      const nearestDistance = getDistance(
        { latitude: mockUserLat, longitude: mockUserLng },
        { latitude: nearestOffice.latitude, longitude: nearestOffice.longitude }
      );

      if (overrideOfficeId) {
        setSelectedOfficeId(overrideOfficeId);
        selectedOfficeIdRef.current = overrideOfficeId;
      } else if (!selectedOfficeId) {
        setSelectedOfficeId(nearestOffice.id);
        selectedOfficeIdRef.current = nearestOffice.id;
      }

      const finalResult: GeofenceResult = {
        status: isInsideSimulation ? 'inside' : 'outside',
        distance: nearestDistance,
        latitude: mockUserLat,
        longitude: mockUserLng,
        matchingOfficeName: nearestOffice.name,
        officeLatitude: nearestOffice.latitude,
        officeLongitude: nearestOffice.longitude,
        officeRadius: nearestOffice.radius_meters,
        error: `Simulation Fallback: Native GPS permission blocked/unavailable. Showing simulated position near ${nearestOffice.name}.`,
        isMocked: true,
        gpsAccuracy: 10,
        timeDrift: 0
      };

      setResult(finalResult);
      return finalResult;
    }
  }, [selectedOfficeId]);

  const reset = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    setResult({ 
      status: 'idle', 
      distance: null, 
      latitude: null, 
      longitude: null, 
      matchingOfficeName: null,
      officeLatitude: null,
      officeLongitude: null,
      officeRadius: null,
      error: null,
      errorKey: undefined,
      isMocked: false,
      gpsAccuracy: null
    });
    setSelectedOfficeId(null);
    selectedOfficeIdRef.current = null;
  }, []);

  return { ...result, offices, selectedOfficeId, setSelectedOfficeId, checkLocation, reset };
}



