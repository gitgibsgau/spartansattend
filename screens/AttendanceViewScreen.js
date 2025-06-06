import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import * as Animatable from 'react-native-animatable';
import Icon from 'react-native-vector-icons/Ionicons';

const screenWidth = Dimensions.get('window').width;
const numColumns = 2;
const cardWidth = screenWidth / numColumns - 30;

export default function AttendanceViewScreen() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const role = userDoc.data()?.role;

        let q;
        if (role === 'admin') {
          q = query(collection(db, 'attendance'));
        } else {
          q = query(
            collection(db, 'attendance'),
            where('studentId', '==', auth.currentUser.uid)
          );
        }

        const snapshot = await getDocs(q);
        const rawRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const enrichedRecords = await Promise.all(
          rawRecords.map(async (record) => {
            const sessionSnap = await getDoc(doc(db, 'sessions', record.sessionId));
            const sessionTitle = sessionSnap.exists() ? sessionSnap.data().title : 'Unknown Session';

            let studentEmail = '';
            if (role === 'admin') {
              const studentSnap = await getDoc(doc(db, 'users', record.studentId));
              studentEmail = studentSnap.exists() ? studentSnap.data().email : 'Unknown Student';
            }

            return {
              ...record,
              sessionTitle,
              studentEmail,
            };
          })
        );

        setRecords(enrichedRecords);
      } catch (error) {
        console.error('Error fetching attendance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, []);

  const renderCard = ({ item, index }) => (
    <Animatable.View
      animation="fadeInUp"
      delay={index * 30}
      style={[styles.card, { width: cardWidth }]}
    >
      <Icon name="checkmark-done-circle-outline" size={30} color="#4ADE80" />
      <Text style={styles.session}>{item.sessionTitle}</Text>
      {item.studentEmail ? (
        <Text style={styles.student}>👤 {item.studentEmail}</Text>
      ) : null}
      <Text style={styles.time}>
        ⏱ {item.markedAt.toDate().toLocaleString()}
      </Text>
    </Animatable.View>
  );

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  if (records.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Attendance Records</Text>
        <Text>No records found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Attendance Records</Text>
      <FlatList
        key={numColumns} // <-- this is the fix
        data={records}
        renderItem={renderCard}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 15 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#1e3a8a', // Spartan background
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e3a8a',
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#f8fafc', // Light text
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

