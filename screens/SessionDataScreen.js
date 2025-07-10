import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import {
  useFonts,
  Poppins_600SemiBold,
  Poppins_400Regular,
} from '@expo-google-fonts/poppins';

export default function SessionDataScreen({ route }) {
  const { sessionId, role } = route.params;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusBanner, setStatusBanner] = useState({ show: false, type: '', message: '' });

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_400Regular,
  });

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
        showBanner('error', 'Failed to fetch session data');
      } finally {
        setLoading(false);
      }
    };

    fetchSessionData();
  }, [sessionId]);

  const showBanner = (type, message) => {
    setStatusBanner({ show: true, type, message });
    setTimeout(() => setStatusBanner({ show: false, type: '', message: '' }), 3000);
  };

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
          showBanner('success', 'Excel saved to Downloads');
        } else {
          showBanner('error', 'Permission denied to save file');
        }
      } else {
        showBanner('success', `Excel saved to:\n${uri}`);
      }
    } catch (err) {
      console.error('Download error:', err);
      showBanner('error', 'Failed to generate Excel file');
    }
  };

  if (!fontsLoaded) return null;

  if (loading) {
    return (
      <AppBackgroundWrapper>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      </AppBackgroundWrapper>
    );
  }

  return (
    <AppBackgroundWrapper>
      <Animatable.View animation="fadeInUp" delay={100} style={styles.container}>
        <Text style={styles.title}>Session Attendance</Text>

        {role === 'admin' && (
          <TouchableOpacity style={styles.button} onPress={downloadExcel}>
            <Icon name="download-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.buttonText}>Download XLSX</Text>
          </TouchableOpacity>
        )}

        <FlatList
          data={data}
          keyExtractor={(item, index) => `${item.email}-${index}`}
          renderItem={({ item }) => (
            <Animatable.View animation="fadeInUp" delay={100} style={styles.card}>
              <Text style={styles.email}>📧 {item.email}</Text>
              <Text style={styles.timestamp}>🕒 {item.timestamp}</Text>
            </Animatable.View>
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
        />

        {statusBanner.show && (
          <Animatable.View
            animation="slideInUp"
            style={[
              styles.banner,
              statusBanner.type === 'error' ? styles.error : styles.success,
            ]}
          >
            <Text style={styles.bannerText}>{statusBanner.message}</Text>
          </Animatable.View>
        )}
      </Animatable.View>
    </AppBackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontFamily: 'Poppins_600SemiBold',
    color: '#f8fafc',
    marginBottom: 20,
    textAlign: 'center',
  },
  card: {
    padding: 16,
    marginBottom: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
  },
  email: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#1e293b',
  },
  timestamp: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#4F46E5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
  },
  banner: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
    zIndex: 100,
  },
  bannerText: {
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
  },
  success: {
    backgroundColor: '#d1fae5',
    borderLeftColor: '#059669',
  },
  error: {
    backgroundColor: '#fee2e2',
    borderLeftColor: '#dc2626',
  },
});