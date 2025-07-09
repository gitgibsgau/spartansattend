import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Modal,
    FlatList,
    ActivityIndicator,
} from 'react-native';
import {
    collection,
    getDocs,
    doc,
    getDoc,
    setDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import * as Animatable from 'react-native-animatable';
import { useFonts, Poppins_600SemiBold, Poppins_400Regular } from '@expo-google-fonts/poppins';

export default function AdminParikshanScreen() {
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [selectedStudentName, setSelectedStudentName] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [loadingStudents, setLoadingStudents] = useState(false);

    const [scores, setScores] = useState({ dhol1: '', dhol2: '', maintenance: '', dhwaj: '', tasha: '' });
    const [lockedFields, setLockedFields] = useState({});
    const [submittedBy, setSubmittedBy] = useState(null);
    const [isTashaApplicable, setIsTashaApplicable] = useState(false);
    const [status, setStatus] = useState({ show: false, type: '', text: '' });
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [resultsReleased, setResultsReleased] = useState(false);
    const [togglingRelease, setTogglingRelease] = useState(false);
    const [isScorer, setIsScorer] = useState(false);

    const [fontsLoaded] = useFonts({
        Poppins_600SemiBold,
        Poppins_400Regular,
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const userData = userSnap.data();
                setIsSuperAdmin(userData.isSuperAdmin || false);
                setIsScorer(userData.isScorer || false);
            }

            const settingsRef = doc(db, 'globalConfig', 'parikshanSettings');
            const settingsSnap = await getDoc(settingsRef);
            if (settingsSnap.exists()) {
                const settings = settingsSnap.data();
                setResultsReleased(!!settings.parikshanReleased);
            }
        };

        fetchInitialData();
    }, []);

    const toggleReleaseResults = async () => {
        setTogglingRelease(true);
        const settingsRef = doc(db, 'globalConfig', 'parikshanSettings');
        try {
            await setDoc(settingsRef, { parikshanReleased: !resultsReleased }, { merge: true });
            setResultsReleased(!resultsReleased);
            showBanner('success', `Results ${!resultsReleased ? 'released' : 'unreleased'} successfully.`);
        } catch (e) {
            console.error(e);
            showBanner('error', 'Failed to update result visibility.');
        } finally {
            setTogglingRelease(false);
        }
    };

    const openStudentModal = async () => {
        setLoadingStudents(true);
        const userSnapshot = await getDocs(collection(db, 'users'));
        const scoreSnapshot = await getDocs(collection(db, 'parikshanScores'));

        const scoreMap = new Map();
        scoreSnapshot.forEach((docSnap) => {
            scoreMap.set(docSnap.id, docSnap.data());
        });

        const list = [];

        userSnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.role === 'student') {
                const scoreData = scoreMap.get(docSnap.id);
                let badge = null;

                if (scoreData) {
                    const fields = ['dhol1', 'dhol2', 'maintenance', 'dhwaj'];
                    const baseComplete = fields.every(f => typeof scoreData[f] === 'number');

                    const tashaIncluded = 'tasha' in scoreData;
                    const tashaValid = tashaIncluded ? typeof scoreData.tasha === 'number' : true;

                    if (baseComplete && tashaValid) {
                        badge = 'scored';
                    } else {
                        badge = 'partial';
                    }
                }

                list.push({
                    label: data.fullname || 'Unnamed',
                    value: docSnap.id,
                    badge,
                });
            }
        });

        // Sort: scored > partial > none
        list.sort((a, b) => {
            const badgeRank = { scored: 0, partial: 2, null: 1 };
            return badgeRank[b.badge] - badgeRank[a.badge] || a.label.localeCompare(b.label);
        });

        setStudents(list);
        setLoadingStudents(false);
        setModalVisible(true);
    };

    useEffect(() => {
        if (!selectedStudent) return;
        const fetchScores = async () => {
            const ref = doc(db, 'parikshanScores', selectedStudent);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const data = snap.data();
                setScores({
                    dhol1: data.dhol1?.toString() ?? '',
                    dhol2: data.dhol2?.toString() ?? '',
                    maintenance: data.maintenance?.toString() ?? '',
                    dhwaj: data.dhwaj?.toString() ?? '',
                    tasha: data.tasha?.toString() ?? '',
                });
                setLockedFields({
                    dhol1: 'dhol1' in data,
                    dhol2: 'dhol2' in data,
                    maintenance: 'maintenance' in data,
                    dhwaj: 'dhwaj' in data,
                    tasha: 'tasha' in data,
                });
                setIsTashaApplicable('tasha' in data);
                setSubmittedBy(data.submittedByName || null);
            } else {
                setScores({ dhol1: '', dhol2: '', maintenance: '', dhwaj: '', tasha: '' });
                setLockedFields({});
                setIsTashaApplicable(false);
                setSubmittedBy(null);
            }
        };
        fetchScores();
    }, [selectedStudent]);

    const showBanner = (type, text) => {
        setStatus({ show: true, type, text });
        setTimeout(() => setStatus({ show: false, type: '', text: '' }), 3000);
    };

    const handleScoreChange = (field, value) => {
        if (/^\d{0,2}$/.test(value) && (+value <= 10)) {
            setScores(prev => ({ ...prev, [field]: value }));
        }
    };

    const handleSave = async () => {
        if (!selectedStudent) {
            showBanner('error', 'Please select a student');
            return;
        }

        const adminName = auth.currentUser?.displayName || 'Admin';

        const updates = {
            studentId: selectedStudent,
            updatedAt: new Date(),
            submittedByName: adminName,
        };

        const ref = doc(db, 'parikshanScores', selectedStudent);
        const existing = await getDoc(ref);
        const existingData = existing.exists() ? existing.data() : {};

        if (!('dhol1' in existingData) && scores.dhol1 !== '') updates.dhol1 = +scores.dhol1;
        if (!('dhol2' in existingData) && scores.dhol2 !== '') updates.dhol2 = +scores.dhol2;
        if (!('maintenance' in existingData) && scores.maintenance !== '') updates.maintenance = +scores.maintenance;
        if (!('dhwaj' in existingData) && scores.dhwaj !== '') updates.dhwaj = +scores.dhwaj;
        if (!('tasha' in existingData) && isTashaApplicable && scores.tasha !== '') updates.tasha = +scores.tasha;

        try {
            await setDoc(ref, { ...existingData, ...updates });
            showBanner('success', 'Scores saved!');
            setLockedFields(prev => ({
                dhol1: prev.dhol1 || 'dhol1' in updates,
                dhol2: prev.dhol2 || 'dhol2' in updates,
                maintenance: prev.maintenance || 'maintenance' in updates,
                dhwaj: prev.dhwaj || 'dhwaj' in updates,
                tasha: prev.tasha || 'tasha' in updates,
            }));
        } catch (e) {
            console.error(e);
            showBanner('error', 'Error saving scores');
        }
    };

    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), delay);
        };
    };

    const [filteredStudents, setFilteredStudents] = useState([]);
    const handleSearch = useCallback(debounce((text) => {
        setFilteredStudents(
            students.filter((student) => student.label.toLowerCase().includes(text.toLowerCase()))
        );
    }, 300), [students]);

    useEffect(() => {
        handleSearch(searchText);
    }, [searchText, students]);

    const allFieldsLocked = lockedFields.dhol1 && lockedFields.dhol2 && lockedFields.maintenance && lockedFields.dhwaj && (!isTashaApplicable || lockedFields.tasha);

    if (!fontsLoaded) return null;


    return (
        <KeyboardAvoidingView style={styles.container}>
            <Animatable.Text animation="fadeInDown" style={styles.title}>Parikshan Scoring</Animatable.Text>

            {isSuperAdmin && (
                <TouchableOpacity
                    style={[styles.toggle, resultsReleased && styles.toggleActive]}
                    onPress={toggleReleaseResults}
                    disabled={togglingRelease}
                >
                    <Text style={[styles.toggleText, resultsReleased && styles.toggleTextActive]}>
                        {resultsReleased ? '✅ Results Released' : '🔒 Results Hidden'}
                    </Text>
                </TouchableOpacity>
            )}
            <TouchableOpacity
                style={[styles.dropdownBtn, selectedStudentName ? styles.selectedStudentCard : {}]}
                onPress={openStudentModal}
                activeOpacity={0.7}
            >
                <View style={styles.dropdownContent}>
                    <Text style={styles.dropdownText}>
                        {selectedStudentName || 'Select Student'}
                    </Text>
                    <Text style={styles.dropdownIcon}>⌄</Text>
                </View>
            </TouchableOpacity>

            <Modal visible={modalVisible} animationType="slide">
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <View style={{ flex: 1, padding: 24, paddingTop: 60 }}>
                        <TextInput
                            placeholder="Search student"
                            value={searchText}
                            onChangeText={setSearchText}
                            style={styles.input}
                        />

                        {loadingStudents ? (
                            <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 20 }} />
                        ) : (
                            <FlatList
                                data={filteredStudents}
                                keyExtractor={(item) => item.value}
                                contentContainerStyle={{ paddingBottom: 80 }}
                                showsVerticalScrollIndicator={false}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.studentItem}
                                        onPress={() => {
                                            setSelectedStudent(item.value);
                                            setSelectedStudentName(item.label);
                                            setModalVisible(false);
                                        }}
                                    >
                                        <View style={styles.studentRow}>
                                            <Text style={styles.studentLabel}>{item.label}</Text>
                                            {item.badge === 'scored' && (
                                                <View style={styles.scoredBadge}>
                                                    <Text style={styles.badgeText}>Scored</Text>
                                                </View>
                                            )}
                                            {item.badge === 'partial' && (
                                                <View style={styles.partialBadge}>
                                                    <Text style={styles.badgeText}>Partially Scored</Text>
                                                </View>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                )}
                            />
                        )}

                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: '#ccc', marginTop: 16 }]}
                            onPress={() => setModalVisible(false)}
                        >
                            <Text style={styles.saveText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {submittedBy && (
                <Text style={{ color: 'green', textAlign: 'center', marginBottom: 8 }}>
                    ✅ Scores submitted by {submittedBy}
                </Text>
            )}

            <View style={styles.form}>
                {['dhol1', 'dhol2', 'maintenance', 'dhwaj'].map((field) => {
                    if (isScorer && lockedFields[field]) return null; // hide from scorers if locked

                    return (
                        <View key={field}>
                            <Text style={styles.label}>
                                {field[0].toUpperCase() + field.slice(1)} (out of 10)
                            </Text>
                            <TextInput
                                style={styles.input}
                                keyboardType="numeric"
                                value={scores[field]}
                                editable={!lockedFields[field]}
                                onChangeText={(v) => handleScoreChange(field, v)}
                            />
                        </View>
                    );
                })}

                <TouchableOpacity
                    style={[styles.toggle, isTashaApplicable && styles.toggleActive]}
                    onPress={() => setIsTashaApplicable(prev => !prev)}
                    disabled={lockedFields.tasha}
                >
                    <Text style={[styles.toggleText, isTashaApplicable && styles.toggleTextActive]}>
                        {isTashaApplicable ? '✔️ Tasha Parikshan: Enabled' : 'Tasha Parikshan: Disabled'}
                    </Text>
                </TouchableOpacity>

                {isTashaApplicable && !(
                    isScorer && lockedFields.tasha
                ) && (
                        <>
                            <Text style={styles.label}>Tasha (out of 10)</Text>
                            <TextInput
                                keyboardType="numeric"
                                style={styles.input}
                                value={scores.tasha}
                                editable={!lockedFields.tasha}
                                onChangeText={(v) => handleScoreChange('tasha', v)}
                            />
                        </>
                    )}
                <TouchableOpacity
                    style={[styles.saveButton, allFieldsLocked && { backgroundColor: '#ccc' }]}
                    onPress={handleSave}
                    disabled={allFieldsLocked}
                >
                    <Text style={styles.saveText}>
                        {allFieldsLocked ? 'All Scores Locked' : 'Save Scores'}
                    </Text>
                </TouchableOpacity>
            </View>

            {status.show && (
                <Animatable.View
                    animation="slideInUp"
                    style={[styles.statusBanner, status.type === 'error' ? styles.error : styles.success]}
                >
                    <Text style={styles.statusText}>{status.text}</Text>
                </Animatable.View>
            )}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 24,
        fontFamily: 'Poppins_600SemiBold',
        textAlign: 'center',
        color: '#1e3a8a',
        marginBottom: 20,
    },
    dropdownBtn: {
        backgroundColor: '#f1f5f9',
        padding: 14,
        borderRadius: 10,
        marginBottom: 16,
    },
    selectedStudentCard: {
        borderColor: '#1e3a8a',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 4,
    },
    dropdownText: {
        fontSize: 16,
        fontWeight: '800',
        fontFamily: 'Poppins_400Regular',
        color: '#1e293b',
    },
    studentItem: {
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderColor: '#e5e7eb',
    },
    studentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    studentLabel: {
        fontSize: 16,
        color: '#0f172a',
        fontFamily: 'Poppins_400Regular',
    },
    scoredBadge: {
        backgroundColor: '#bbf7d0',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        color: '#15803d',
        fontSize: 12,
        fontFamily: 'Poppins_600SemiBold',
    },
    partialBadge: {
        backgroundColor: '#fde68a',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    form: {
        flex: 1,
    },
    input: {
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        padding: 12,
        marginBottom: 16,
        fontSize: 16,
        fontFamily: 'Poppins_400Regular',
        color: '#0f172a',
    },
    toggle: {
        padding: 12,
        borderRadius: 10,
        backgroundColor: '#fef3c7',
        marginBottom: 16,
    },
    toggleActive: {
        backgroundColor: '#d1fae5',
    },
    toggleText: {
        textAlign: 'center',
        fontSize: 16,
        fontFamily: 'Poppins_400Regular',
        color: '#92400e',
    },
    toggleTextActive: {
        color: '#047857',
    },
    saveButton: {
        backgroundColor: '#4f46e5',
        padding: 16,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 16,
    },
    saveText: {
        color: '#fff',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 16,
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
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 3,
        zIndex: 100,
        backgroundColor: '#fff',
    },
    statusText: {
        fontSize: 15,
        textAlign: 'center',
        fontFamily: 'Poppins_400Regular',
        color: '#1e293b',
    },
    error: {
        backgroundColor: '#fee2e2',
        borderLeftColor: '#dc2626',
    },
    success: {
        backgroundColor: '#d1fae5',
        borderLeftColor: '#059669',
    },
    label: {
        fontSize: 14,
        fontFamily: 'Poppins_600SemiBold',
        color: '#334155',
        marginBottom: 4,
        marginTop: 12,
    },
    dropdownBtn: {
        backgroundColor: '#f1f5f9',
        padding: 14,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#4f46e5',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 4,
        elevation: 3,
    },

    dropdownContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },

    dropdownIcon: {
        fontSize: 18,
        color: '#475569',
        marginLeft: 8,
        fontWeight: 'bold',
    },
});