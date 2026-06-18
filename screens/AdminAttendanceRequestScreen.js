import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import { colors, spacing, radius, fonts, shadows } from '../theme';
import { useSeason } from '../contexts/SeasonContext';

export default function AdminAttendanceRequestsScreen() {
  const { currentSeason } = useSeason();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [showStatus, setShowStatus] = useState(false);

  const showBanner = (type, text) => {
    setStatusMessage({ type, text });
    setShowStatus(true);
    setTimeout(() => setShowStatus(false), 3000);
  };

  const fetchRequests = async () => {
    try {
      const q = query(collection(db, 'attendanceCorrectionRequests'), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      const reqs = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setRequests(reqs);
    } catch (error) {
      console.error('Error fetching requests:', error);
      showBanner('error', 'Failed to fetch requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  const approveRequest = async (req) => {
    try {
      // Write a canonical attendance doc (must match the QR/manual schema:
      // season + markedAt) so every season-filtered reader counts it.
      // Missing `season` was why approved corrections didn't register as
      // attended in the profile count or the session card.
      await addDoc(collection(db, 'attendance'), {
        studentId: req.studentId,
        sessionId: req.sessionId,
        season: req.season ?? currentSeason,
        markedAt: serverTimestamp(),
        corrected: true,
      });
      await updateDoc(doc(db, 'attendanceCorrectionRequests', req.id), { status: 'approved' });
      setRequests(requests.filter(r => r.id !== req.id));
      showBanner('success', `Approved: ${req.fullname}'s request for ${req.sessionTitle}` );
    } catch (err) {
      console.error('Approval failed:', err);
      showBanner('error', 'Failed to approve request.');
    }
  };

  const rejectRequest = async (req) => {
    try {
      await updateDoc(doc(db, 'attendanceCorrectionRequests', req.id), { status: 'rejected' });
      setRequests(requests.filter(r => r.id !== req.id));
      showBanner('success', `Rejected: ${req.fullname}`);
    } catch (err) {
      console.error('Rejection failed:', err);
      showBanner('error', 'Failed to reject request.');
    }
  };

  if (loading) {
    return (
      <AppBackgroundWrapper>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
      </AppBackgroundWrapper>
    );
  }

  const renderRequest = ({ item, index }) => (
    <Animatable.View animation="fadeInUp" delay={index * 100} style={styles.card}>
      <Icon name="person-circle-outline" size={28} color={colors.primary} style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.fullname}</Text>
        <Text style={styles.details}>{item.sessionTitle} • {item.sessionDate}</Text>
      </View>
      <TouchableOpacity style={styles.approveBtn} onPress={() => approveRequest(item)}>
        <Text style={styles.btnText}>Approve</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectRequest(item)}>
        <Text style={styles.btnText}>Reject</Text>
      </TouchableOpacity>
    </Animatable.View>
  );

  return (
    <AppBackgroundWrapper>
      <Text style={styles.header}>Pending Attendance Requests</Text>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={renderRequest}
        contentContainerStyle={{ padding: 20 }}
        ListEmptyComponent={<Text style={styles.empty}>🎉 No pending requests</Text>}
        showsVerticalScrollIndicator={false}
      />

      {showStatus && (
        <Animatable.View animation="slideInUp" duration={400} style={[styles.statusBanner, statusMessage.type === 'error' ? styles.error : styles.success]}>
          <Text style={styles.statusText}>{statusMessage.text}</Text>
        </Animatable.View>
      )}
    </AppBackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 20,
    fontFamily: fonts.bold,
    textAlign: 'center',
    marginVertical: spacing.xl,
    color: colors.text,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  name: { fontSize: 16, fontFamily: fonts.semibold, color: colors.text },
  details: { fontSize: 14, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 2 },
  approveBtn: { backgroundColor: colors.success, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.sm, marginLeft: 6 },
  rejectBtn: { backgroundColor: colors.danger, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.sm, marginLeft: 6 },
  btnText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 13 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing['2xl'], fontSize: 16, fontFamily: fonts.regular },
  statusBanner: {
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
  statusText: {
    fontSize: 16,
    fontFamily: fonts.medium,
    textAlign: 'center',
  },
  error: { backgroundColor: colors.dangerSoft, borderLeftColor: colors.danger },
  success: { backgroundColor: colors.successSoft, borderLeftColor: colors.success },
});