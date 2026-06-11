import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
    collection,
    query,
    orderBy,
    limit,
    onSnapshot,
    doc,
    setDoc,
    getDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
    registerForPushNotificationsAsync,
    savePushToken,
} from '../utils/notifications';

const NotificationsContext = createContext(null);

// Cap how many notifications we keep in memory / show in the inbox.
const FEED_LIMIT = 100;

export const NotificationsProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const [lastReadAt, setLastReadAt] = useState(0); // millis
    const [uid, setUid] = useState(null);

    // Track auth + register this device's push token once signed in.
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setUid(null);
                setNotifications([]);
                setLastReadAt(0);
                return;
            }
            setUid(user.uid);

            // Seed last-read from the user doc so the badge is correct on launch.
            try {
                const snap = await getDoc(doc(db, 'users', user.uid));
                if (snap.exists()) setLastReadAt(snap.data().notificationsLastReadAt || 0);
            } catch (err) {
                console.error('Failed to read last-read marker:', err);
            }

            // Register for push (no-op on simulator / denied permission).
            const token = await registerForPushNotificationsAsync();
            if (token) await savePushToken(user.uid, token);
        });
        return unsub;
    }, []);

    // Live inbox feed (newest first).
    useEffect(() => {
        if (!uid) return;
        const q = query(
            collection(db, 'notifications'),
            orderBy('createdAt', 'desc'),
            limit(FEED_LIMIT)
        );
        const unsub = onSnapshot(
            q,
            (snap) => {
                const items = snap.docs.map((d) => {
                    const data = d.data();
                    // createdAt is a Firestore Timestamp; normalize to millis.
                    const createdMs = data.createdAt?.toMillis
                        ? data.createdAt.toMillis()
                        : 0;
                    return { id: d.id, ...data, createdMs };
                });
                setNotifications(items);
            },
            (err) => console.error('Notifications feed error:', err)
        );
        return unsub;
    }, [uid]);

    const unreadCount = notifications.filter((n) => n.createdMs > lastReadAt).length;

    // Mark everything read up to "now". Optimistic local update + persist.
    const markAllRead = useCallback(async () => {
        if (!uid) return;
        const now = Date.now();
        setLastReadAt(now);
        try {
            await setDoc(
                doc(db, 'users', uid),
                { notificationsLastReadAt: now },
                { merge: true }
            );
        } catch (err) {
            console.error('Failed to persist last-read marker:', err);
        }
    }, [uid]);

    return (
        <NotificationsContext.Provider
            value={{ notifications, unreadCount, lastReadAt, markAllRead }}
        >
            {children}
        </NotificationsContext.Provider>
    );
};

export const useNotifications = () => {
    const ctx = useContext(NotificationsContext);
    if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
    return ctx;
};

export default NotificationsContext;
