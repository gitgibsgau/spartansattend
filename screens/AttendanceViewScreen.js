import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/Ionicons';
import AppBackgroundWrapper from '../components/AppBackgroundWrapper';

const screenWidth = Dimensions.get('window').width;
const numColumns = 2;
const cardWidth = screenWidth / numColumns - 30;

export default function AttendanceViewScreen({ navigation }) {
  const [sessionData, setSessionData] = useState([]);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const role = userDoc.data()?.role;

        let q;
        if (role === 'admin') {
          setRole('admin');
          q = query(collection(db, 'attendance'));
        } else {
          setRole('student');
          q = query(
            collection(db, 'attendance'),
            where('studentId', '==', auth.currentUser.uid)
          );
        }

        const snapshot = await getDocs(q);
        const rawRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const sessionMap = {};

        for (let record of rawRecords) {
          if (!sessionMap[record.sessionId]) {
            sessionMap[record.sessionId] = {
              sessionId: record.sessionId,
              count: 0,
            };
          }
          sessionMap[record.sessionId].count += 1;
        }

        const sessionData = await Promise.all(
          Object.values(sessionMap).map(async (item) => {
            const sessionSnap = await getDoc(doc(db, 'sessions', item.sessionId));
            const title = sessionSnap.exists() ? sessionSnap.data().title : 'Unknown Session';
            return {
              ...item,
              sessionTitle: title,
            };
          })
        );

        setSessionData(sessionData);
      } catch (error) {
        console.error('Error fetching attendance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, []);

  const renderCard = ({ item, index }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('SessionDataScreen', { sessionId: item.sessionId, role: role })}
    >
      <Animatable.View style={[styles.card, { width: cardWidth }]}>
        <Icon name="calendar-outline" size={30} color="#4ADE80" />
        <Text style={styles.session}>{item.sessionTitle}</Text>
        {role === 'admin' && (
          <Text style={styles.student}>Total Attendance: {item.count}</Text>
        )}
      </Animatable.View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <AppBackgroundWrapper>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      </AppBackgroundWrapper>
    );
  }

  if (sessionData.length === 0) {
    return (
      <AppBackgroundWrapper>
        <View style={styles.container}>
          <Text style={styles.heading}>Attendance Records</Text>
          <Text style={styles.headerText}>No records found.</Text>
        </View>
      </AppBackgroundWrapper>
    );
  }

  return (
    <AppBackgroundWrapper>
      <View style={styles.container}>
        <Text style={styles.heading}>Attendance Records</Text>
        <FlatList
          key={numColumns}
          data={sessionData}
          renderItem={renderCard}
          keyExtractor={(item, i) => `${item.id}-${i}`}
          numColumns={numColumns}
          columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 15 }}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </AppBackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#fff', // Light text
  },
  headerText: {
    fontSize: 16,
    color: '#94a3b8', // Light gray
    textAlign: 'center',
    marginTop: 50,
  },
  card: {
    backgroundColor: '#f8fafc', // Light card
    borderRadius: 12,
    padding: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    marginBottom: 10,
  },
  session: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b', // Deep slate
    marginTop: 8,
  },
  student: {
    fontSize: 14,
    color: '#334155',
    marginTop: 4,
  },
  time: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
  },
});

