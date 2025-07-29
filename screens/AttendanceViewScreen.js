import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/Ionicons';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  Poppins_600SemiBold,
  Poppins_400Regular,
} from '@expo-google-fonts/poppins';

const screenWidth = Dimensions.get('window').width;
const numColumns = 2;
const cardWidth = screenWidth / numColumns - 30;

function getWeekId(date = new Date()) {
  const temp = new Date(date.getTime());
  temp.setHours(0, 0, 0, 0);
  temp.setDate(temp.getDate() + 4 - (temp.getDay() || 7));
  const yearStart = new Date(temp.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((temp - yearStart) / 86400000 + 1) / 7);
  return `${temp.getFullYear()}-W${weekNo}`;
}

export default function AttendanceViewScreen({ navigation }) {
  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_400Regular,
  });

  const [sessionData, setSessionData] = useState([]);
  const [markedDates, setMarkedDates] = useState({});
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [showStatus, setShowStatus] = useState(false);
  const [showCalendar, setShowCalendar] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);

  const showBanner = (type, text) => {
    setStatusMessage({ type, text });
    setShowStatus(true);
    setTimeout(() => setShowStatus(false), 3000);
  };

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setLoading(true);

        // 🔹 Fetch user role
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const userRole = userDoc.data()?.role;
        setRole(userRole);

        // 🔹 Fetch correction requests (only relevant for student/admin's own attendance)
        const requestsSnap = await getDocs(
          query(
            collection(db, 'attendanceCorrectionRequests'),
            where('studentId', '==', auth.currentUser.uid)
          )
        );
        const requestData = requestsSnap.docs.map(docSnap => ({
          sessionId: docSnap.data().sessionId,
          status: docSnap.data().status, // pending, approved, rejected
        }));

        // 🔹 Fetch attendance records
        const attendanceQuery =
          userRole === 'admin'
            ? query(collection(db, 'attendance')) // Admin fetches ALL
            : query(collection(db, 'attendance'), where('studentId', '==', auth.currentUser.uid));

        const attendanceSnap = await getDocs(attendanceQuery);
        const rawRecords = attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Map attendance count by session (for admin global view)
        const sessionMap = {};
        rawRecords.forEach(record => {
          if (!sessionMap[record.sessionId]) {
            sessionMap[record.sessionId] = { attended: false, count: 0, attendees: [] };
          }
          sessionMap[record.sessionId].attended = true;
          sessionMap[record.sessionId].count += 1;
          sessionMap[record.sessionId].attendees.push(record.studentId);
        });

        // 🔹 Also fetch admin's personal attendance (even in admin role)
        const myAttendanceSnap = await getDocs(
          query(collection(db, 'attendance'), where('studentId', '==', auth.currentUser.uid))
        );
        const myAttendance = myAttendanceSnap.docs.map(doc => ({ sessionId: doc.data().sessionId }));

        const myAttendanceSet = new Set(myAttendance.map(a => a.sessionId));

        // 🔹 Fetch sessions
        const sessionsSnap = await getDocs(collection(db, 'sessions'));
        const allSessions = sessionsSnap.docs.map(docSnap => {
          const session = docSnap.data();
          const localDate = new Date(session.timestamp.seconds * 1000);
          const date = localDate.toLocaleDateString('en-CA');

          const req = requestData.find(r => r.sessionId === docSnap.id);

          return {
            id: docSnap.id,
            sessionTitle: session.title,
            sessionDate: date,
            attended: myAttendanceSet.has(docSnap.id), // ✅ Admin sees their own attendance too
            count: sessionMap[docSnap.id]?.count || 0,
            requested: !!req,
            requestStatus: req?.status || null,
          };
        });

        allSessions.sort((a, b) => new Date(a.sessionDate) - new Date(b.sessionDate));

        // 🔹 Build marked dates (personal attendance for admin & students)
        const marks = {};
        allSessions.forEach(session => {
          let bgColor = '#ef4444'; // missed
          if (session.attended || session.requestStatus === 'approved') bgColor = '#22c55e';
          else if (session.requestStatus === 'pending') bgColor = '#facc15';
          else if (session.requestStatus === 'rejected') bgColor = '#ef4444';

          marks[session.sessionDate] = {
            customStyles: {
              container: { backgroundColor: bgColor, borderRadius: 16 },
              text: { color: '#fff', fontWeight: 'bold' },
            },
          };
        });

        setSessionData(allSessions);
        setMarkedDates(marks);
      } catch (error) {
        console.error('Error fetching attendance:', error);
        showBanner('error', 'Failed to load attendance.');
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, []);


  const handleDayPress = (day) => {
    const session = sessionData.find(s => s.sessionDate === day.dateString);
    if (session) setSelectedSession(session);
  };

  const handleCorrectionRequest = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const fullname = userDoc.data()?.fullname || 'Unknown';
      await addDoc(collection(db, 'attendanceCorrectionRequests'), {
        studentId: auth.currentUser.uid,
        fullname,
        sessionId: selectedSession.id,
        sessionTitle: selectedSession.sessionTitle,
        sessionDate: selectedSession.sessionDate,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      showBanner('success', 'Request sent to admin.');

      const updatedSessions = sessionData.map(s =>
        s.id === selectedSession.id ? { ...s, requested: true, requestStatus: 'pending' } : s
      );

      const updatedMarks = { ...markedDates };
      updatedMarks[selectedSession.sessionDate] = {
        customStyles: {
          container: {
            backgroundColor: '#facc15',
            borderRadius: 16,
          },
          text: {
            color: '#fff',
            fontWeight: 'bold',
          },
        },
      };

      setSessionData(updatedSessions);
      setMarkedDates(updatedMarks);

      const weekId = getWeekId();
      await AsyncStorage.setItem('attendance_data', JSON.stringify({ sessions: updatedSessions, role }));
      await AsyncStorage.setItem('attendance_week', weekId);

      setSelectedSession(null);
    } catch (error) {
      console.error('Failed to request correction:', error);
      showBanner('error', 'Could not send request.');
    }
  };

  const handleUndoRequest = async () => {
    try {
      const q = query(
        collection(db, 'attendanceCorrectionRequests'),
        where('studentId', '==', auth.currentUser.uid),
        where('sessionId', '==', selectedSession.id)
      );
      const snap = await getDocs(q);
      const deletes = snap.docs.map(docSnap => deleteDoc(doc(db, 'attendanceCorrectionRequests', docSnap.id)));
      await Promise.all(deletes);

      const updatedSessions = sessionData.map(s =>
        s.id === selectedSession.id ? { ...s, requested: false } : s
      );

      const updatedMarks = { ...markedDates };
      updatedMarks[selectedSession.sessionDate] = {
        customStyles: {
          container: {
            backgroundColor: '#ef4444',
            borderRadius: 16,
          },
          text: {
            color: '#fff',
            fontWeight: 'bold',
          },
        },
      };

      setSessionData(updatedSessions);
      setMarkedDates(updatedMarks);

      const weekId = getWeekId();
      await AsyncStorage.setItem('attendance_data', JSON.stringify({ sessions: updatedSessions, role }));
      await AsyncStorage.setItem('attendance_week', weekId);

      showBanner('success', 'Request successfully undone.');
      setSelectedSession(null);
    } catch (err) {
      console.error('Undo request failed:', err);
      showBanner('error', 'Failed to undo request.');
    }
  };

  const renderCard = ({ item }) => (
    <TouchableOpacity
      onPress={() => role === 'admin' && navigation.navigate('SessionDataScreen', { sessionId: item.id, role })}
      disabled={role !== 'admin'} // ✅ Only admins can tap
    >
      <Animatable.View
        animation="fadeInUp"
        style={[
          styles.card,
          { width: cardWidth },
          item.attended
            ? null // ✅ green for attended
            : item.requestStatus === 'pending'
              ? styles.requestedCard // yellow pending
              : styles.missedCard // red missed/rejected
        ]}
      >
        <Icon name="calendar-outline" size={30} color="#4ADE80" />
        <Text style={styles.session}>{item.sessionTitle}</Text>
        {role === 'admin' && <Text style={styles.student}>Total Attendance: {item.count}</Text>}
      </Animatable.View>
    </TouchableOpacity>
  );

  if (!fontsLoaded || loading) {
    return (
      <AppBackgroundWrapper>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      </AppBackgroundWrapper>
    );
  }

  return (
    <AppBackgroundWrapper>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => setShowCalendar(!showCalendar)}>
          <Text style={styles.toggleCalendar}>{showCalendar ? '▴ Hide Calendar' : '▾ Show Calendar'}</Text>
        </TouchableOpacity>

        {showCalendar && (
          <Calendar
            markedDates={markedDates}
            onDayPress={handleDayPress}
            markingType={'custom'}
            theme={{
              backgroundColor: '#fff',
              calendarBackground: '#fff',
              textSectionTitleColor: '#64748b',
              selectedDayTextColor: '#fff',
              todayTextColor: '#2563eb',
              dayTextColor: '#1e293b',
              textDisabledColor: '#d1d5db',
              monthTextColor: '#1e293b',
              textMonthFontFamily: 'Poppins_600SemiBold',
              textDayFontFamily: 'Poppins_400Regular',
              textDayHeaderFontFamily: 'Poppins_400Regular',
            }}
          />
        )}

        <FlatList
          key={numColumns}
          data={sessionData}
          renderItem={renderCard}
          keyExtractor={(item, i) => `${item.id}-${i}`}
          numColumns={numColumns}
          columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 15 }}
          contentContainerStyle={{ paddingBottom: 100, marginTop: 20 }}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {selectedSession && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{selectedSession.sessionTitle}</Text>
              <Text style={styles.modalStatus}>
                {selectedSession.attended ? '✅ Attended' : '❌ Missed'}
              </Text>

              {/* Request button if missed & no request */}
              {!selectedSession.attended && !selectedSession.requested && (
                <TouchableOpacity style={styles.requestButton} onPress={handleCorrectionRequest}>
                  <Text style={styles.requestText}>Request Attendance Correction</Text>
                </TouchableOpacity>
              )}

              {/* Pending request */}
              {selectedSession.requestStatus === 'pending' && (
                <>
                  <Text style={styles.modalStatus}>🕒 Request pending approval.</Text>
                  <TouchableOpacity style={styles.undoButton} onPress={handleUndoRequest}>
                    <Text style={styles.undoText}>Undo Request</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Approved request */}
              {selectedSession.requestStatus === 'approved' && (
                <Text style={styles.modalStatus}>✅ Request approved. Attendance marked.</Text>
              )}

              {/* Rejected request */}
              {selectedSession.requestStatus === 'rejected' && (
                <Text style={styles.modalStatus}>❌ Request rejected by admin.</Text>
              )}

              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSelectedSession(null)}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {showStatus && (
        <Animatable.View animation="slideInUp" duration={400} style={[styles.statusBanner, statusMessage.type === 'error' ? styles.error : styles.success]}>
          <Text style={styles.statusText}>{statusMessage.text}</Text>
        </Animatable.View>
      )}
    </AppBackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: '#f1f5f9',
    borderLeftColor: '#4ade80',
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    marginBottom: 10,
  },
  missedCard: {
    backgroundColor: '#ffe4e6',
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
  },
  requestedCard: {
    backgroundColor: '#fef3c7',
    borderLeftWidth: 4,
    borderLeftColor: '#facc15',
  },
  session: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: '#1e293b',
    marginTop: 8,
  },
  student: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#334155',
    marginTop: 4,
  },
  toggleCalendar: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: '#4F46E5',
    marginBottom: 10,
    textAlign: 'center',
  },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 14,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    marginBottom: 8,
    color: '#1e293b',
  },
  modalStatus: {
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    color: '#334155',
    marginBottom: 16,
  },
  modalCloseButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalCloseText: {
    color: '#fff',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
  },
  requestButton: {
    backgroundColor: '#facc15',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  requestText: {
    color: '#1e293b',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
  },
  undoButton: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  undoText: {
    color: '#1e293b',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
  },
});