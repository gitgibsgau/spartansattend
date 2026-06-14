import * as SecureStore from 'expo-secure-store';

// Stable per-install device identifier used to bind a user account to one
// physical device (anti-proxy attendance check). Persisted in SecureStore.
const KEY = 'device_uuid';

// Pure-JS UUID v4. Intentionally NOT using the `uuid` package or expo-crypto:
// both need crypto.getRandomValues, which isn't available in Hermes without a
// native polyfill — that would break OTA delivery. A binding id only needs to
// be unique, not unguessable, so Math.random is sufficient here.
function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

let cached = null;

// Returns this install's device id, generating + persisting one on first use.
// Cached in-memory so repeated checks in a session don't re-hit SecureStore.
export async function getDeviceId() {
    if (cached) return cached;
    try {
        let id = await SecureStore.getItemAsync(KEY);
        if (!id) {
            id = generateId();
            await SecureStore.setItemAsync(KEY, id);
        }
        cached = id;
        return id;
    } catch (err) {
        // SecureStore should not hard-fail, but if it does, keep the session
        // usable with a volatile id rather than crashing the gate.
        console.warn('getDeviceId failed, using volatile id:', err?.message);
        cached = generateId();
        return cached;
    }
}
