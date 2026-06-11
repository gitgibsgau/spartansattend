// utils/notifications.js
// Push-notification helpers built on expo-notifications.
//  • registerForPushNotificationsAsync — ask permission + fetch the Expo push token.
//  • savePushToken — persist the token on the user's Firestore doc (deduped array).
//  • sendPushToTokens — fan a notification out via Expo's push API (client-side,
//    no backend required; Expo's endpoint accepts unauthenticated POSTs).
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

// Load the native modules defensively. A static import would crash the whole
// app at load if the native module isn't present in the running binary (Expo
// Go, or a build made before expo-notifications was added). With require() in
// try/catch, push features no-op gracefully until a native rebuild.
let Notifications = null;
let Device = null;
try {
    Notifications = require('expo-notifications');
    Device = require('expo-device');
} catch (e) {
    console.log('expo-notifications native module unavailable; push disabled:', e?.message);
}

// Resolve the EAS project id (required by getExpoPushTokenAsync in SDK 49+).
const getProjectId = () =>
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    undefined;

/**
 * Request permission and return the device's Expo push token, or null if
 * unavailable (simulator, denied permission, or web).
 */
export async function registerForPushNotificationsAsync() {
    // No native module → push unavailable in this runtime.
    if (!Notifications || !Device) return null;

    // Push tokens are only issued on physical devices.
    if (!Device.isDevice) {
        console.log('Push notifications require a physical device.');
        return null;
    }

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
        });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    if (finalStatus !== 'granted') {
        console.log('Push notification permission not granted.');
        return null;
    }

    try {
        const projectId = getProjectId();
        const { data: token } = await Notifications.getExpoPushTokenAsync(
            projectId ? { projectId } : undefined
        );
        return token;
    } catch (err) {
        console.error('Failed to get Expo push token:', err);
        return null;
    }
}

/** Add the push token to the user doc's `pushTokens` array (idempotent). */
export async function savePushToken(uid, token) {
    if (!uid || !token) return;
    try {
        await setDoc(
            doc(db, 'users', uid),
            { pushTokens: arrayUnion(token) },
            { merge: true }
        );
    } catch (err) {
        console.error('Failed to save push token:', err);
    }
}

/**
 * Send a notification to a list of Expo push tokens. Chunks into batches of
 * 100 (Expo's per-request limit). Returns the number of messages accepted.
 * Invalid/empty tokens are filtered out.
 */
export async function sendPushToTokens(tokens, { title, body, data } = {}) {
    const valid = (tokens || []).filter(
        (t) => typeof t === 'string' && t.startsWith('ExponentPushToken')
    );
    if (!valid.length) return 0;

    const messages = valid.map((to) => ({
        to,
        sound: 'default',
        title,
        body,
        data: data || {},
    }));

    let sent = 0;
    for (let i = 0; i < messages.length; i += 100) {
        const chunk = messages.slice(i, i + 100);
        try {
            const res = await fetch(EXPO_PUSH_ENDPOINT, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(chunk),
            });
            if (res.ok) sent += chunk.length;
            else console.error('Expo push error:', await res.text());
        } catch (err) {
            console.error('Failed to send push chunk:', err);
        }
    }
    return sent;
}
