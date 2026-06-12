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
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import { LinearGradient } from '../components/ui/Gradient';
import { colors, spacing, radius, fonts, shadows } from '../theme';

export default function SessionDataScreen({ route }) {
  const { sessionId, role } = route.params;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusBanner, setStatusBanner] = useState({ show: false, type: '', message: '' });

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

  if (loading) {
    return (
      <AppBackgroundWrapper>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AppBackgroundWrapper>
    );
  }

  return (
    <AppBackgroundWrapper>
      <Animatable.View animation="fadeInUp" delay={100} style={styles.container}>
        <Text style={styles.title}>Session Attendance</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Icon name="people" size={22} color={colors.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryCount}>{data.length}</Text>
            <Text style={styles.summaryLabel}>{data.length === 1 ? 'Attendee' : 'Attendees'} marked present</Text>
          </View>
        </View>

        {role === 'admin' && (
          <TouchableOpacity style={styles.buttonShadow} onPress={downloadExcel} activeOpacity={0.9}>
            <LinearGradient
              colors={colors.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}
            >
              <Icon name="download-outline" size={18} color={colors.textOnPrimary} style={{ marginRight: 6 }} />
              <Text style={styles.buttonText}>Download XLSX</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {role === 'admin' && (
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
        )}

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
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 23,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  summaryCount: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  card: {
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  email: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
  },
  timestamp: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  buttonShadow: {
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    marginBottom: spacing.lg,
    ...shadows.primary,
  },
  button: {
    flexDirection: 'row',
    padding: 13,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  banner: {
    position: 'absolute',
    bottom: 30,
    left: spacing.xl,
    right: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderLeftWidth: 6,
    ...shadows.md,
    zIndex: 100,
  },
  bannerText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    textAlign: 'center',
  },
  success: {
    backgroundColor: colors.successSoft,
    borderLeftColor: colors.success,
  },
  error: {
    backgroundColor: colors.dangerSoft,
    borderLeftColor: colors.danger,
  },
});