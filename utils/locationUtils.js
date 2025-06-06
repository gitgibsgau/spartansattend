import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform, Alert } from 'react-native';

// 🔁 Set your allowed location and radius here
const ALLOWED_LAT = 37.330122; // Change this to your Spartan venue lat
const ALLOWED_LNG = -121.877429;   // Change this to your Spartan venue lng
const RADIUS_METERS = 100;

const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) ** 2 +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const checkLocationAccessAndProximity = () => {
  return new Promise(async (resolve) => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );

      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Permission Denied', 'Location permission is required to mark attendance.');
        return resolve(false);
      }
    }

    Geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        const distance = getDistanceInMeters(latitude, longitude, ALLOWED_LAT, ALLOWED_LNG);

        if (distance <= RADIUS_METERS) {
          resolve(true);
        } else {
          Alert.alert('Out of Range', `You are ${Math.round(distance)} meters away. Move closer.`);
          resolve(false);
        }
      },
      error => {
        console.log('Location error', error);
        Alert.alert('Location Error', 'Unable to get current location.');
        resolve(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
    );
  });
};
