import * as Location from 'expo-location';
import { Alert } from 'react-native';

// Spartan location and allowed radius
const ALLOWED_LAT = 37.330122;
const ALLOWED_LNG = -121.877429;
const RADIUS_METERS = 100;

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

export const checkLocationAccessAndProximity = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location permission is required to mark attendance.');
      return false;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const { latitude, longitude } = location.coords;
    const distance = getDistanceInMeters(latitude, longitude, ALLOWED_LAT, ALLOWED_LNG);

    const withinRadius = distance <= RADIUS_METERS;

    return { withinRadius, distance }

  } catch (error) {
    console.log('Location error:', error);
    Alert.alert('Location Error', 'Unable to fetch your location.');
    return { withinRadius: false, distance: null};
  }
};
