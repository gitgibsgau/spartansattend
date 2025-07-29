import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import { useFonts, Poppins_600SemiBold, Poppins_400Regular } from '@expo-google-fonts/poppins';

export default function AdminAttendanceRequestsScreen() {
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
      await addDoc(collection(db, 'attendance'), {
        studentId: req.studentId,
        sessionId: req.sessionId,
        timestamp: serverTimestamp(),
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

  const [fontsLoaded] = useFonts({ Poppins_600SemiBold, Poppins_400Regular });
  if (!fontsLoaded || loading) {
    return (
      <AppBackgroundWrapper>
        <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 50 }} />
      </AppBackgroundWrapper>
    );
  }

  const renderRequest = ({ item, index }) => (
    <Animatable.View animation="fadeInUp" delay={index * 100} style={styles.card}>
      <Icon name="person-circle-outline" size={28} color="#4F46E5" style={{ marginRight: 10 }} />
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
    fontFamily: 'Poppins_600SemiBold',
    textAlign: 'center', 
    marginVertical: 20, 
    color: '#1e293b' 
  },
  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f8fafc', 
    padding: 15, 
    borderRadius: 14, 
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 4,
    elevation: 2,
  },
  name: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: '#1e293b' },
  details: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: '#64748b', marginTop: 2 },
  approveBtn: { backgroundColor: '#22c55e', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginLeft: 6 },
  rejectBtn: { backgroundColor: '#ef4444', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginLeft: 6 },
  btnText: { color: '#fff', fontFamily: 'Poppins_600SemiBold' },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 30, fontSize: 16, fontFamily: 'Poppins_400Regular' },
  statusBanner: {
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
  statusText: {
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
  },
  error: { backgroundColor: '#fee2e2', borderLeftColor: '#dc2626' },
  success: { backgroundColor: '#d1fae5', borderLeftColor: '#059669' },
});