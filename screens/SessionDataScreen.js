import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Platform } from 'react-native';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';

export default function SessionDataScreen({ route }) {
    const { sessionId, role } = route.params;
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSessionData = async () => {
            try {
                const q = query(collection(db, 'attendance'), where('sessionId', '==', sessionId));
                const snapshot = await getDocs(q);

                const enriched = await Promise.all(
                    snapshot.docs.map(async (docSnap) => {
                        const d = docSnap.data();
                        const userSnap = await getDoc(doc(db, 'users', d.studentId));
                        const email = userSnap.exists() ? userSnap.data().email : 'Unknown';
                        return {
                            email,
                            timestamp: d.markedAt?.toDate()?.toLocaleString() || 'N/A',
                        };
                    })
                );

                setData(enriched);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchSessionData();
    }, [sessionId]);

    const downloadExcel = async () => {
        try {
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

            const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

            const filename = `Attendance_${sessionId}.xlsx`;
            const uri = FileSystem.documentDirectory + filename;

            await FileSystem.writeAsStringAsync(uri, wbout, {
                encoding: FileSystem.EncodingType.Base64,
            });

            if (Platform.OS === 'android') {
                const { status } = await MediaLibrary.requestPermissionsAsync();
                if (status === 'granted') {
                    const asset = await MediaLibrary.createAssetAsync(uri);
                    await MediaLibrary.createAlbumAsync('Download', asset, false);
                    Alert.alert('Success', 'Excel file saved to Downloads');
                } else {
                    Alert.alert('Permission denied', 'Cannot save file without permission');
                }
            } else {
                Alert.alert('Success', `Excel file saved:\n${uri}`);
            }
        } catch (err) {
            console.error('Download error:', err);
            Alert.alert('Error', 'Could not generate Excel file');
        }
    };

    if (loading) return (
        <AppBackgroundWrapper>
            <View style={styles.loader}>
                <ActivityIndicator size="large" />
            </View>
        </AppBackgroundWrapper>
    );

    return (
        <AppBackgroundWrapper>
            <View style={styles.container}>
                <Text style={styles.title}>Session Attendance</Text>

                {role === 'admin' && (
                    <TouchableOpacity style={styles.button} onPress={downloadExcel}>
                        <Text style={styles.buttonText}>⬇️ Download XLSX</Text>
                    </TouchableOpacity>
                )}

                <FlatList
                    data={data}
                    keyExtractor={(item, index) => `${item.sessionId}-${index}`}
                    renderItem={({ item }) => (
                        <View style={styles.card}>
                            <Text>📧 {item.email}</Text>
                            <Text>🕒 {item.timestamp}</Text>
                        </View>
                    )}
                />
            </View>
        </AppBackgroundWrapper>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: '#f8fafc' },
    card: {
        padding: 12,
        marginBottom: 10,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
    },
    button: {
        marginBottom: 16,
        padding: 12,
        backgroundColor: '#4f46e5',
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
    },
});
