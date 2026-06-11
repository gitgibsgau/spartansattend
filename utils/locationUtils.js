import * as Location from 'expo-location';
import { Alert } from 'react-native';

// Legacy fallback location (SJSU). Used only for sessions created before
// per-session coordinates were captured at generation time.
const ALLOWED_LAT = 37.335382;
const ALLOWED_LNG = -121.879835;
const RADIUS_METERS = 200;

const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const x = lat1 * Math.PI / 180;
  const y = lat2 * Math.PI / 180;
  const z = (lat2 - lat1) * Math.PI / 180;
  const zz = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(z / 2) ** 2 +
    Math.cos(x) * Math.cos(y) * Math.sin(zz / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Capture the current device coordinates. Used by the admin when generating a
// session so the geofence is anchored to wherever the event actually is.
// Returns { latitude, longitude } or null if permission is denied / fetch fails.
export const getCurrentCoordinates = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location permission is required to set the session location.');
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.log('Location error:', error);
    Alert.alert('Location Error', 'Unable to fetch your location.');
    return null;
  }
};

// Check the student is within RADIUS_METERS of the session's location.
// targetLat/targetLng come from the session doc (captured at generation). If a
// session predates that field, we fall back to the legacy hardcoded location.
export const checkLocationAccessAndProximity = async (targetLat, targetLng) => {
  const lat = typeof targetLat === 'number' ? targetLat : ALLOWED_LAT;
  const lng = typeof targetLng === 'number' ? targetLng : ALLOWED_LNG;

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location permission is required to mark attendance.');
      return { withinRadius: false, distance: null };
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const { latitude, longitude } = location.coords;
    const distance = getDistanceInMeters(latitude, longitude, lat, lng);

    const withinRadius = distance <= RADIUS_METERS;

    return { withinRadius, distance };

  } catch (error) {
    console.log('Location error:', error);
    Alert.alert('Location Error', 'Unable to fetch your location.');
    return { withinRadius: false, distance: null };
  }
};
