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
import { useSeason } from '../contexts/SeasonContext';
import { colors, spacing, radius, fonts, shadows } from '../theme';

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
  const [sessionData, setSessionData] = useState([]);
  const [markedDates, setMarkedDates] = useState({});
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [showStatus, setShowStatus] = useState(false);
  const [showCalendar, setShowCalendar] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const { currentSeason } = useSeason();

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
            where('studentId', '==', auth.currentUser.uid),
            where('season', '==', currentSeason)
          )
        );
        const requestData = requestsSnap.docs.map(docSnap => ({
          sessionId: docSnap.data().sessionId,
          status: docSnap.data().status, // pending, approved, rejected
        }));

        // 🔹 Fetch attendance records - filtered by season
        const attendanceQuery =
          userRole === 'admin'
            ? query(collection(db, 'attendance'), where('season', '==', currentSeason)) // Admin fetches ALL for current season
            : query(
                collection(db, 'attendance'),
                where('studentId', '==', auth.currentUser.uid),
                where('season', '==', currentSeason)
              );

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

        // 🔹 The student's own attendance. For non-admins, rawRecords already IS
        // their own attendance (same studentId+season query above), so reuse it
        // instead of issuing an identical second read. Admins fetched ALL records
        // above, so they still need a scoped read for their personal attendance.
        let myAttendance;
        if (userRole === 'admin') {
          const myAttendanceSnap = await getDocs(
            query(
              collection(db, 'attendance'),
              where('studentId', '==', auth.currentUser.uid),
              where('season', '==', currentSeason)
            )
          );
          myAttendance = myAttendanceSnap.docs.map(doc => ({ sessionId: doc.data().sessionId }));
        } else {
          myAttendance = rawRecords.map(r => ({ sessionId: r.sessionId }));
        }

        const myAttendanceSet = new Set(myAttendance.map(a => a.sessionId));

        // 🔹 Fetch sessions - filtered by season
        const sessionsSnap = await getDocs(
          query(collection(db, 'sessions'), where('season', '==', currentSeason))
        );
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

    if (currentSeason) fetchAttendance();
  }, [currentSeason]);


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
        season: currentSeason,
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
        where('sessionId', '==', selectedSession.id),
        where('season', '==', currentSeason)
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

  if (loading) {
    return (
      <AppBackgroundWrapper>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AppBackgroundWrapper>
    );
  }

  const totalSessions = sessionData.length;
  const attendedCount = sessionData.filter(
    (s) => s.attended || s.requestStatus === 'approved'
  ).length;
  const attendancePct = totalSessions ? Math.round((attendedCount / totalSessions) * 100) : 0;

  return (
    <AppBackgroundWrapper>
      <View style={styles.container}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryLeft}>
            <Text style={styles.summaryLabel}>Attendance</Text>
            <Text style={styles.summaryCount}>
              {attendedCount}<Text style={styles.summaryCountMuted}> / {totalSessions} sessions</Text>
            </Text>
          </View>
          <View style={styles.summaryPctWrap}>
            <Text style={styles.summaryPct}>{attendancePct}%</Text>
          </View>
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
            <Text style={styles.legendText}>Attended</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#facc15' }]} />
            <Text style={styles.legendText}>Pending</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.legendText}>Missed</Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => setShowCalendar(!showCalendar)}>
          <Text style={styles.toggleCalendar}>{showCalendar ? '▴ Hide Calendar' : '▾ Show Calendar'}</Text>
        </TouchableOpacity>

        {showCalendar && (
          <Calendar
            markedDates={markedDates}
            onDayPress={handleDayPress}
            markingType={'custom'}
            style={styles.calendarCard}
            theme={{
              backgroundColor: colors.surface,
              calendarBackground: colors.surface,
              textSectionTitleColor: colors.textMuted,
              selectedDayTextColor: '#fff',
              todayTextColor: colors.primary,
              dayTextColor: colors.text,
              textDisabledColor: '#d1d5db',
              monthTextColor: colors.text,
              arrowColor: colors.primary,
              textMonthFontFamily: fonts.semibold,
              textDayFontFamily: fonts.regular,
              textDayHeaderFontFamily: fonts.medium,
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
  container: { flex: 1, padding: spacing.xl, backgroundColor: colors.background },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  summaryLeft: { flex: 1 },
  summaryLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryCount: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.text,
    marginTop: 2,
  },
  summaryCountMuted: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  summaryPctWrap: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  summaryPct: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.primaryDark,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  calendarCard: {
    borderRadius: radius.xl,
    paddingBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
    marginBottom: spacing.md,
  },
  missedCard: {
    backgroundColor: colors.dangerSoft,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    borderColor: colors.dangerSoft,
  },
  requestedCard: {
    backgroundColor: colors.warningSoft,
    borderLeftWidth: 4,
    borderLeftColor: '#facc15',
    borderColor: colors.warningSoft,
  },
  session: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  student: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 4,
  },
  toggleCalendar: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: colors.surface,
    padding: spacing['2xl'],
    borderRadius: radius.xl,
    width: '84%',
    alignItems: 'center',
    ...shadows.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    marginBottom: spacing.sm,
    color: colors.text,
  },
  modalStatus: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  modalCloseButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    ...shadows.primary,
  },
  modalCloseText: {
    color: colors.textOnPrimary,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  requestButton: {
    backgroundColor: '#facc15',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  requestText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  undoButton: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  undoText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
});