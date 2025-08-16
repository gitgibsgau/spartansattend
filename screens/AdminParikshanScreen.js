import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView,
    Platform, Modal, FlatList, ActivityIndicator, ScrollView,
} from 'react-native';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import * as Animatable from 'react-native-animatable';
import { useFonts, Poppins_600SemiBold, Poppins_400Regular } from '@expo-google-fonts/poppins';

export default function AdminFinalParikshanScreen() {
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [selectedStudentName, setSelectedStudentName] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [loadingStudents, setLoadingStudents] = useState(false);

    const [scores, setScores] = useState({ dhol: '', dhwaj: '', tasha: '' });
    const [lockedFields, setLockedFields] = useState({});
    const [submittedBy, setSubmittedBy] = useState(null);

    const [firstSummary, setFirstSummary] = useState({ dholAvg: null, tasha: null, maintenance: null, dhwaj: null, overall: null });

    const [status, setStatus] = useState({ show: false, type: '', text: '' });
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [resultsReleased, setResultsReleased] = useState(false);
    const [togglingRelease, setTogglingRelease] = useState(false);
    const [isScorer, setIsScorer] = useState(false);

    const [fontsLoaded] = useFonts({ Poppins_600SemiBold, Poppins_400Regular });
    useEffect(() => {
        (async () => {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const u = userSnap.data();
                setIsSuperAdmin(!!u.isSuperAdmin);
                setIsScorer(!!u.isScorer);
            }

            // SINGLE RELEASE FLAG
            const settingsRef = doc(db, 'globalConfig', 'parikshanSettings');
            const settingsSnap = await getDoc(settingsRef);
            if (settingsSnap.exists()) setResultsReleased(!!settingsSnap.data().parikshanReleased);
        })();
    }, []);

    const toggleReleaseResults = async () => {
        setTogglingRelease(true);
        try {
            await setDoc(doc(db, 'globalConfig', 'parikshanSettings'), { parikshanReleased: !resultsReleased }, { merge: true });
            setResultsReleased(!resultsReleased);
            showBanner('success', `Results ${!resultsReleased ? 'released' : 'hidden'} successfully.`);
        } catch (e) {
            console.error(e); showBanner('error', 'Failed to update result visibility.');
        } finally { setTogglingRelease(false); }
    };

    const openStudentModal = async () => {
        setLoadingStudents(true);
        const userSnapshot = await getDocs(collection(db, 'users'));
        const finalSnapshot = await getDocs(collection(db, 'finalParikshanScores'));
        const finalMap = new Map();
        finalSnapshot.forEach((d) => finalMap.set(d.id, d.data()));

        const list = [];
        userSnapshot.forEach((uDoc) => {
            const u = uDoc.data();
            if (u.role === 'student') {
                const f = finalMap.get(uDoc.id);
                let badge = null;
                if (f) {
                    const baseComplete = typeof f.dhol === 'number' && typeof f.dhwaj === 'number';
                    const tashaValid = ('tasha' in f) ? typeof f.tasha === 'number' : true;
                    badge = (baseComplete && tashaValid) ? 'scored' : 'partial';
                }
                list.push({ label: u.fullname || 'Unnamed', value: uDoc.id, badge });
            }
        });

        list.sort((a, b) => {
            const rank = { scored: 0, partial: 1, null: 2, undefined: 2 };
            const rA = rank[a.badge], rB = rank[b.badge];
            return rA !== rB ? rA - rB : a.label.localeCompare(b.label);
        });

        setStudents(list);
        setLoadingStudents(false);
        setModalVisible(true);
    };

    const computeFirstSummary = (data) => {
        let dholAvg = null;
        const hasD1 = typeof data?.dhol1 === 'number';
        const hasD2 = typeof data?.dhol2 === 'number';
        if (hasD1 && hasD2) dholAvg = (data.dhol1 + data.dhol2) / 2;
        else if (hasD1) dholAvg = data.dhol1;
        else if (hasD2) dholAvg = data.dhol2;

        const tasha = (typeof data?.tasha === 'number') ? data.tasha : null;
        const maintenance = (typeof data?.maintenance === 'number') ? data.maintenance : null;
        const dhwaj = (typeof data?.dhwaj === 'number') ? data.dhwaj : null;

        const parts = [dholAvg, tasha, maintenance, dhwaj].filter((x) => typeof x === 'number' && !Number.isNaN(x));
        const overall = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
        return { dholAvg, tasha, maintenance, dhwaj, overall };
    };

    useEffect(() => {
        if (!selectedStudent) return;
        (async () => {
            const finalRef = doc(db, 'finalParikshanScores', selectedStudent);
            const finalSnap = await getDoc(finalRef);
            if (finalSnap.exists()) {
                const f = finalSnap.data();
                setScores({
                    dhol: f.dhol?.toString() ?? '',
                    dhwaj: f.dhwaj?.toString() ?? '',
                    tasha: f.tasha?.toString() ?? '',
                });
                setLockedFields({
                    dhol: 'dhol' in f,
                    dhwaj: 'dhwaj' in f,
                    tasha: 'tasha' in f,
                });
                setSubmittedBy(f.submittedByName || null);
            } else {
                setScores({ dhol: '', dhwaj: '', tasha: '' });
                setLockedFields({});
                setSubmittedBy(null);
            }

            const firstRef = doc(db, 'parikshanScores', selectedStudent);
            const firstSnap = await getDoc(firstRef);
            if (firstSnap.exists()) setFirstSummary(computeFirstSummary(firstSnap.data()));
            else setFirstSummary({ dholAvg: null, tasha: null, maintenance: null, dhwaj: null, overall: null });
        })();
    }, [selectedStudent]);

    const showBanner = (type, text) => {
        setStatus({ show: true, type, text });
        setTimeout(() => setStatus({ show: false, type: '', text: '' }), 3000);
    };

    const handleScoreChange = (field, value) => {
        if (/^\d{0,2}(\.\d)?$/.test(value) && (+value <= 10)) {
            setScores((prev) => ({ ...prev, [field]: value }));
        }
    };

    const handleSave = async () => {
        if (!selectedStudent) return showBanner('error', 'Please select a student');
        const adminName = auth.currentUser?.displayName || 'Admin';

        const ref = doc(db, 'finalParikshanScores', selectedStudent);
        const existing = await getDoc(ref);
        const existingData = existing.exists() ? existing.data() : {};

        const updates = {
            studentId: selectedStudent,
            updatedAt: new Date(),
            submittedByName: adminName,
        };

        if (!('dhol' in existingData) && scores.dhol !== '') updates.dhol = +scores.dhol;
        if (!('dhwaj' in existingData) && scores.dhwaj !== '') updates.dhwaj = +scores.dhwaj;
        if (!('tasha' in existingData) && scores.tasha !== '') updates.tasha = +scores.tasha;

        try {
            await setDoc(ref, { ...existingData, ...updates });
            showBanner('success', 'Final scores saved!');
            setLockedFields((prev) => ({
                dhol: prev.dhol || 'dhol' in updates,
                dhwaj: prev.dhwaj || 'dhwaj' in updates,
                tasha: prev.tasha || 'tasha' in updates,
            }));
        } catch (e) {
            console.error(e);
            showBanner('error', 'Error saving final scores');
        }
    };

    const debounce = (fn, delay) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); }; };
    const [filteredStudents, setFilteredStudents] = useState([]);
    const handleSearch = useCallback(debounce((text) => {
        setFilteredStudents(students.filter((s) => s.label.toLowerCase().includes(text.toLowerCase())));
    }, 300), [students]);

    useEffect(() => { handleSearch(searchText); }, [searchText, students]);

    const allFieldsLocked =
        lockedFields.dhol && lockedFields.dhwaj && (lockedFields.tasha || scores.tasha === '');

    if (!fontsLoaded) return null;

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <ScrollView contentContainerStyle={{ paddingBottom: 200 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Animatable.Text animation="fadeInDown" style={styles.title}>Final Parikshan</Animatable.Text>

                {isSuperAdmin && (
                    <TouchableOpacity style={[styles.toggle, resultsReleased && styles.toggleActive]}
                        onPress={toggleReleaseResults} disabled={togglingRelease}>
                        <Text style={[styles.toggleText, resultsReleased && styles.toggleTextActive]}>
                            {resultsReleased ? '✅ Results Released' : '🔒 Results Hidden'}
                        </Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity style={[styles.dropdownBtn, selectedStudentName ? styles.selectedStudentCard : {}]}
                    onPress={openStudentModal} activeOpacity={0.7}>
                    <View style={styles.dropdownContent}>
                        <Text style={styles.dropdownText}>{selectedStudentName || 'Select Student'}</Text>
                        <Text style={styles.dropdownIcon}>⌄</Text>
                    </View>
                </TouchableOpacity>

                <Modal visible={modalVisible} animationType="slide">
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                        <View style={{ flex: 1, padding: 24, paddingTop: 60 }}>
                            <TextInput placeholder="Search student" value={searchText} onChangeText={setSearchText} style={styles.input} />
                            {loadingStudents ? (
                                <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 20 }} />
                            ) : (
                                <FlatList
                                    data={filteredStudents}
                                    keyExtractor={(item) => item.value}
                                    contentContainerStyle={{ paddingBottom: 80 }}
                                    showsVerticalScrollIndicator={false}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity style={styles.studentItem} onPress={() => {
                                            setSelectedStudent(item.value); setSelectedStudentName(item.label); setModalVisible(false);
                                        }}>
                                            <View style={styles.studentRow}>
                                                <Text style={styles.studentLabel}>{item.label}</Text>
                                                {item.badge === 'scored' && <View style={styles.scoredBadge}><Text style={styles.badgeText}>Scored</Text></View>}
                                                {item.badge === 'partial' && <View style={styles.partialBadge}><Text style={styles.badgeText}>Partially Scored</Text></View>}
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                />
                            )}
                            <TouchableOpacity style={[styles.saveButton, { backgroundColor: '#4F46E5', marginTop: 16 }]} onPress={() => setModalVisible(false)}>
                                <Text style={styles.saveText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>

                {submittedBy && (
                    <Text style={{ color: 'green', textAlign: 'center', marginBottom: 8 }}>
                        ✅ Final scores submitted by {submittedBy}
                    </Text>
                )}

                {/* First Parikshan Reference */}
                {selectedStudent && (
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryTitle}>First Parikshan (Reference)</Text>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Dhol Avg</Text><Text style={styles.summaryValue}>{firstSummary.dholAvg ?? '—'}</Text></View>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Tasha</Text><Text style={styles.summaryValue}>{firstSummary.tasha ?? '—'}</Text></View>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Maintenance</Text><Text style={styles.summaryValue}>{firstSummary.maintenance ?? '—'}</Text></View>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Dhwaj</Text><Text style={styles.summaryValue}>{firstSummary.dhwaj ?? '—'}</Text></View>
                        <View style={[styles.summaryRow, { borderTopWidth: 1, borderColor: '#e5e7eb', paddingTop: 8, marginTop: 4 }]}>
                            <Text style={[styles.summaryLabel, { fontFamily: 'Poppins_600SemiBold' }]}>Overall Avg</Text>
                            <Text style={[styles.summaryValue, { fontFamily: 'Poppins_600SemiBold' }]}>{firstSummary.overall.toFixed(2) ?? '—'}</Text>
                        </View>
                        <Text style={{ marginTop: 6, fontSize: 12, color: '#64748b', fontFamily: 'Poppins_400Regular' }}>
                            Average = Dhol Avg, Tasha, Maintenance and Dhwaj.
                        </Text>
                    </View>
                )}

                {/* Final Parikshan Form (only three fields) */}
                <View style={styles.form}>
                    {['dhol', 'dhwaj', 'tasha'].map((field) => {
                        if (isScorer && lockedFields[field]) return null; // scorers can't see locked fields
                        const label = field.charAt(0).toUpperCase() + field.slice(1);
                        return (
                            <View key={field}>
                                <Text style={styles.label}>{label} (out of 10)</Text>
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
                        style={[styles.saveButton, allFieldsLocked && { backgroundColor: '#ccc' }]}
                        onPress={handleSave}
                        disabled={allFieldsLocked}
                    >
                        <Text style={styles.saveText}>
                            {allFieldsLocked ? 'All Scores Locked' : 'Save Final Scores'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {status.show && (
                    <Animatable.View animation="slideInUp" style={[styles.statusBanner, status.type === 'error' ? styles.error : styles.success]}>
                        <Text style={styles.statusText}>{status.text}</Text>
                    </Animatable.View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24, backgroundColor: '#fff' },
    title: { fontSize: 24, fontFamily: 'Poppins_600SemiBold', textAlign: 'center', color: '#1e3a8a', marginBottom: 20 },

    dropdownBtn: {
        backgroundColor: '#f1f5f9', padding: 14, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#4f46e5',
        shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 3,
    },
    selectedStudentCard: {
        borderColor: '#1e3a8a', borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6, elevation: 4,
    },
    dropdownText: { fontSize: 16, fontWeight: '800', fontFamily: 'Poppins_400Regular', color: '#1e293b' },
    dropdownContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dropdownIcon: { fontSize: 18, color: '#475569', marginLeft: 8, fontWeight: 'bold' },

    studentItem: { paddingVertical: 14, borderBottomWidth: 1, borderColor: '#e5e7eb' },
    studentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    studentLabel: { fontSize: 16, color: '#0f172a', fontFamily: 'Poppins_400Regular' },
    scoredBadge: { backgroundColor: '#bbf7d0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    partialBadge: { backgroundColor: '#fde68a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    badgeText: { color: '#15803d', fontSize: 12, fontFamily: 'Poppins_600SemiBold' },

    form: { flex: 1 },
    input: { backgroundColor: '#f1f5f9', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 16, fontFamily: 'Poppins_400Regular', color: '#0f172a' },

    saveButton: { backgroundColor: '#4f46e5', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 16 },
    saveText: { color: '#fff', fontFamily: 'Poppins_600SemiBold', fontSize: 16 },

    statusBanner: {
        position: 'absolute', bottom: 30, left: 20, right: 20, padding: 12, borderRadius: 10, borderLeftWidth: 6,
        shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 3, zIndex: 100, backgroundColor: '#fff',
    },
    statusText: { fontSize: 15, textAlign: 'center', fontFamily: 'Poppins_400Regular', color: '#1e293b' },
    error: { backgroundColor: '#fee2e2', borderLeftColor: '#dc2626' },
    success: { backgroundColor: '#d1fae5', borderLeftColor: '#059669' },

    label: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#334155', marginBottom: 4, marginTop: 12 },

    summaryCard: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    summaryTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: '#1e293b', marginBottom: 8 },
    summaryRow: { paddingVertical: 4, flexDirection: 'row', justifyContent: 'space-between' },
    summaryLabel: { fontFamily: 'Poppins_400Regular', color: '#334155' },
    summaryValue: { fontFamily: 'Poppins_400Regular', color: '#0f172a' },

    toggle: { padding: 12, borderRadius: 10, backgroundColor: '#fef3c7', marginBottom: 16 },
    toggleActive: { backgroundColor: '#d1fae5' },
    toggleText: { textAlign: 'center', fontSize: 16, fontFamily: 'Poppins_400Regular', color: '#92400e' },
    toggleTextActive: { color: '#047857' },
});