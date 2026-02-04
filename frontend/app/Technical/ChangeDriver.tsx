import { StyleSheet, Text, View, Pressable, Alert, Modal, ScrollView, Switch } from 'react-native'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';

// Mock drivers data
const MOCK_DRIVERS = [
    { id: 1, fullName: 'Ion Popescu', county: 'București' },
    { id: 2, fullName: 'Andrei Ionescu', county: 'Cluj' },
    { id: 3, fullName: 'Maria Georgescu', county: 'Timiș' },
    { id: 4, fullName: 'Gheorghe Stanciu', county: 'Iași' },
    { id: 5, fullName: 'Elena Marin', county: 'București' },
];

// Mock tasks data
const MOCK_TASKS = [
    { id: 1, clientName: 'SC Example SRL', address: 'Str. Victoriei 12, București', type: 'PLACEMENT', status: 'NEW' },
    { id: 2, clientName: 'Ion Marinescu', address: 'Bd. Unirii 45, București', type: 'PICKUP', status: 'NEW' },
    { id: 3, clientName: 'SC Tech Solutions', address: 'Str. Libertatii 8, București', type: 'SANITIZATION', status: 'IN_PROGRESS' },
    { id: 4, clientName: 'Maria Popescu', address: 'Calea Moșilor 120, București', type: 'PLACEMENT', status: 'NEW' },
    { id: 5, clientName: 'SC Green Energy', address: 'Str. Republicii 33, București', type: 'PICKUP', status: 'NEW' },
];

interface Driver {
    id: number;
    fullName: string;
    county?: string;
}

interface Task {
    id: number;
    clientName: string;
    address: string;
    type: string;
    status: string;
}

const ChangeDriver = () => {
    const router = useRouter();

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Driver selection
    const [sourceDriver, setSourceDriver] = useState<Driver | null>(null);
    const [targetDriver, setTargetDriver] = useState<Driver | null>(null);
    const [sourceDriverDropdownVisible, setSourceDriverDropdownVisible] = useState(false);
    const [targetDriverDropdownVisible, setTargetDriverDropdownVisible] = useState(false);

    // Tasks
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);

    // Load tasks when source driver is selected
    useEffect(() => {
        if (sourceDriver) {
            loadDriverTasks();
        } else {
            setTasks([]);
            setSelectedTaskIds(new Set());
        }
    }, [sourceDriver, selectedDate]);

    const loadDriverTasks = async () => {
        setLoading(true);
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        // Mock: return tasks for the selected driver
        setTasks(MOCK_TASKS);
        setSelectedTaskIds(new Set());
        setLoading(false);
    };

    const formatDisplayDate = (date: Date) => {
        return date.toLocaleDateString('ro-RO', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const getCalendarDateString = (date: Date) => {
        return date.toISOString().split('T')[0];
    };

    const handleDateSelect = (day: any) => {
        const newDate = new Date(day.dateString);
        setSelectedDate(newDate);
        setShowDatePicker(false);
    };

    const handleSourceDriverSelect = (driver: Driver) => {
        setSourceDriver(driver);
        setSourceDriverDropdownVisible(false);
        // Reset target driver if same as source
        if (targetDriver?.id === driver.id) {
            setTargetDriver(null);
        }
    };

    const handleTargetDriverSelect = (driver: Driver) => {
        setTargetDriver(driver);
        setTargetDriverDropdownVisible(false);
    };

    const toggleTaskSelection = (taskId: number) => {
        setSelectedTaskIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(taskId)) {
                newSet.delete(taskId);
            } else {
                newSet.add(taskId);
            }
            return newSet;
        });
    };

    const selectAllTasks = () => {
        if (selectedTaskIds.size === tasks.length) {
            // Deselect all if all are selected
            setSelectedTaskIds(new Set());
        } else {
            // Select all
            setSelectedTaskIds(new Set(tasks.map(t => t.id)));
        }
    };

    const handleTransferTasks = () => {
        if (!targetDriver) {
            Alert.alert('Eroare', 'Te rog selectează șoferul destinație.');
            return;
        }
        if (selectedTaskIds.size === 0) {
            Alert.alert('Eroare', 'Te rog selectează cel puțin o sarcină.');
            return;
        }

        Alert.alert(
            'Confirmare Transfer',
            `Vrei să transferi ${selectedTaskIds.size} sarcin${selectedTaskIds.size === 1 ? 'ă' : 'i'} de la ${sourceDriver?.fullName} la ${targetDriver.fullName}?`,
            [
                { text: 'Anulează', style: 'cancel' },
                {
                    text: 'Transferă',
                    onPress: () => {
                        // Mock transfer
                        Alert.alert('Succes', `${selectedTaskIds.size} sarcin${selectedTaskIds.size === 1 ? 'ă a fost transferată' : 'i au fost transferate'} cu succes!`);
                        // Remove transferred tasks from the list
                        setTasks(prev => prev.filter(t => !selectedTaskIds.has(t.id)));
                        setSelectedTaskIds(new Set());
                    }
                }
            ]
        );
    };

    const getTaskTypeLabel = (type: string) => {
        switch (type) {
            case 'PLACEMENT': return 'Amplasare';
            case 'PICKUP': return 'Ridicare';
            case 'SANITIZATION': return 'Igienizare';
            default: return type;
        }
    };

    const getTaskTypeColor = (type: string) => {
        switch (type) {
            case 'PLACEMENT': return '#4CAF50';
            case 'PICKUP': return '#FF9800';
            case 'SANITIZATION': return '#2196F3';
            default: return '#888';
        }
    };

    // Available drivers for target (exclude source driver)
    const availableTargetDrivers = MOCK_DRIVERS.filter(d => d.id !== sourceDriver?.id);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.headerContainer}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </Pressable>
                <Text style={styles.headerText}>Schimbă Șofer</Text>
            </View>

            <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
                {/* Date Picker */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Data</Text>
                    <Pressable
                        style={styles.dropdownButton}
                        onPress={() => setShowDatePicker(true)}
                    >
                        <Ionicons name="calendar-outline" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
                        <Text style={styles.dropdownButtonText}>
                            {formatDisplayDate(selectedDate)}
                        </Text>
                    </Pressable>
                </View>

                {/* Source Driver Selector */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Șofer Sursă (de la)</Text>
                    <Pressable
                        style={styles.dropdownButton}
                        onPress={() => setSourceDriverDropdownVisible(true)}
                    >
                        <Ionicons name="person-outline" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
                        <Text style={[
                            styles.dropdownButtonText,
                            { flex: 1 },
                            !sourceDriver && styles.placeholderText
                        ]}>
                            {sourceDriver?.fullName || 'Selectează șoferul...'}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#FFFFFF" />
                    </Pressable>
                </View>

                {/* Target Driver Selector */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Șofer Destinație (către)</Text>
                    <Pressable
                        style={[styles.dropdownButton, !sourceDriver && styles.dropdownDisabled]}
                        onPress={() => sourceDriver && setTargetDriverDropdownVisible(true)}
                        disabled={!sourceDriver}
                    >
                        <Ionicons name="person-outline" size={20} color={sourceDriver ? "#FFFFFF" : "#666"} style={{ marginRight: 10 }} />
                        <Text style={[
                            styles.dropdownButtonText,
                            { flex: 1 },
                            (!targetDriver || !sourceDriver) && styles.placeholderText
                        ]}>
                            {targetDriver?.fullName || 'Selectează șoferul...'}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color={sourceDriver ? "#FFFFFF" : "#666"} />
                    </Pressable>
                </View>

                {/* Tasks Section */}
                {sourceDriver && (
                    <View style={styles.tasksSection}>
                        <View style={styles.tasksSectionHeader}>
                            <Text style={styles.tasksSectionTitle}>
                                Sarcini ({tasks.length})
                            </Text>
                            {tasks.length > 0 && (
                                <Pressable onPress={selectAllTasks} style={styles.selectAllButton}>
                                    <Text style={styles.selectAllButtonText}>
                                        {selectedTaskIds.size === tasks.length ? 'Deselectează Toate' : 'Selectează Toate'}
                                    </Text>
                                </Pressable>
                            )}
                        </View>

                        {loading ? (
                            <Text style={styles.loadingText}>Se încarcă sarcinile...</Text>
                        ) : tasks.length === 0 ? (
                            <Text style={styles.emptyText}>Nu există sarcini pentru această dată</Text>
                        ) : (
                            <View style={styles.tasksList}>
                                {tasks.map((task) => (
                                    <Pressable
                                        key={task.id}
                                        style={[
                                            styles.taskCard,
                                            selectedTaskIds.has(task.id) && styles.taskCardSelected
                                        ]}
                                        onPress={() => toggleTaskSelection(task.id)}
                                    >
                                        <View style={styles.taskCardContent}>
                                            <View style={styles.taskInfo}>
                                                <View style={[styles.taskTypeBadge, { backgroundColor: getTaskTypeColor(task.type) }]}>
                                                    <Text style={styles.taskTypeBadgeText}>{getTaskTypeLabel(task.type)}</Text>
                                                </View>
                                                <Text style={styles.taskClientName}>{task.clientName}</Text>
                                                <Text style={styles.taskAddress}>{task.address}</Text>
                                            </View>
                                            <Switch
                                                value={selectedTaskIds.has(task.id)}
                                                onValueChange={() => toggleTaskSelection(task.id)}
                                                trackColor={{ false: '#3A5168', true: '#4CAF50' }}
                                                thumbColor={selectedTaskIds.has(task.id) ? '#FFFFFF' : '#AAAAAA'}
                                            />
                                        </View>
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Transfer Button */}
            {sourceDriver && tasks.length > 0 && (
                <View style={styles.bottomContainer}>
                    <View style={styles.selectionInfo}>
                        <Text style={styles.selectionInfoText}>
                            {selectedTaskIds.size} sarcin{selectedTaskIds.size === 1 ? 'ă selectată' : 'i selectate'}
                        </Text>
                    </View>
                    <Pressable
                        style={({ pressed }) => [
                            styles.transferButton,
                            pressed && styles.buttonPressed,
                            selectedTaskIds.size === 0 && styles.buttonDisabled
                        ]}
                        onPress={handleTransferTasks}
                        disabled={selectedTaskIds.size === 0}
                    >
                        <Ionicons name="swap-horizontal" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={styles.transferButtonText}>Transferă Sarcinile</Text>
                    </Pressable>
                </View>
            )}

            {/* Date Picker Modal */}
            <Modal
                visible={showDatePicker}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDatePicker(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setShowDatePicker(false)}
                >
                    <View style={styles.calendarModal}>
                        <Text style={styles.modalTitle}>Selectează Data</Text>
                        <Calendar
                            current={getCalendarDateString(selectedDate)}
                            onDayPress={handleDateSelect}
                            markedDates={{
                                [getCalendarDateString(selectedDate)]: { selected: true, selectedColor: '#4CAF50' }
                            }}
                            theme={{
                                backgroundColor: '#2A4158',
                                calendarBackground: '#2A4158',
                                textSectionTitleColor: '#FFFFFF',
                                selectedDayBackgroundColor: '#4CAF50',
                                selectedDayTextColor: '#FFFFFF',
                                todayTextColor: '#4CAF50',
                                dayTextColor: '#FFFFFF',
                                textDisabledColor: '#666666',
                                arrowColor: '#FFFFFF',
                                monthTextColor: '#FFFFFF',
                            }}
                        />
                    </View>
                </Pressable>
            </Modal>

            {/* Source Driver Dropdown Modal */}
            <Modal
                visible={sourceDriverDropdownVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSourceDriverDropdownVisible(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setSourceDriverDropdownVisible(false)}
                >
                    <View style={styles.dropdownModal}>
                        <Text style={styles.modalTitle}>Selectează Șoferul Sursă</Text>
                        <ScrollView style={styles.dropdownList}>
                            {MOCK_DRIVERS.map((driver) => (
                                <Pressable
                                    key={driver.id}
                                    style={({ pressed }) => [
                                        styles.dropdownItem,
                                        sourceDriver?.id === driver.id && styles.dropdownItemSelected,
                                        pressed && styles.dropdownItemPressed
                                    ]}
                                    onPress={() => handleSourceDriverSelect(driver)}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={[
                                            styles.dropdownItemText,
                                            sourceDriver?.id === driver.id && styles.dropdownItemTextSelected
                                        ]}>
                                            {driver.fullName}
                                        </Text>
                                        {driver.county && (
                                            <Text style={styles.driverCountyText}>{driver.county}</Text>
                                        )}
                                    </View>
                                    {sourceDriver?.id === driver.id && (
                                        <Ionicons name="checkmark" size={20} color="#4CAF50" />
                                    )}
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>

            {/* Target Driver Dropdown Modal */}
            <Modal
                visible={targetDriverDropdownVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setTargetDriverDropdownVisible(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setTargetDriverDropdownVisible(false)}
                >
                    <View style={styles.dropdownModal}>
                        <Text style={styles.modalTitle}>Selectează Șoferul Destinație</Text>
                        <ScrollView style={styles.dropdownList}>
                            {availableTargetDrivers.map((driver) => (
                                <Pressable
                                    key={driver.id}
                                    style={({ pressed }) => [
                                        styles.dropdownItem,
                                        targetDriver?.id === driver.id && styles.dropdownItemSelected,
                                        pressed && styles.dropdownItemPressed
                                    ]}
                                    onPress={() => handleTargetDriverSelect(driver)}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={[
                                            styles.dropdownItemText,
                                            targetDriver?.id === driver.id && styles.dropdownItemTextSelected
                                        ]}>
                                            {driver.fullName}
                                        </Text>
                                        {driver.county && (
                                            <Text style={styles.driverCountyText}>{driver.county}</Text>
                                        )}
                                    </View>
                                    {targetDriver?.id === driver.id && (
                                        <Ionicons name="checkmark" size={20} color="#4CAF50" />
                                    )}
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>
        </View>
    )
}

export default ChangeDriver

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#16283C',
    },
    headerContainer: {
        marginTop: 60,
        paddingHorizontal: 20,
        width: '100%',
        marginBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#427992',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    headerText: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: 'bold',
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
    },
    dropdownButton: {
        backgroundColor: '#2A4158',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: '#427992',
        flexDirection: 'row',
        alignItems: 'center',
    },
    dropdownDisabled: {
        opacity: 0.5,
    },
    dropdownButtonText: {
        fontSize: 16,
        color: '#FFFFFF',
    },
    placeholderText: {
        color: '#888',
    },
    tasksSection: {
        marginTop: 10,
    },
    tasksSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    tasksSectionTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    selectAllButton: {
        backgroundColor: '#427992',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    selectAllButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    tasksList: {
        gap: 12,
    },
    taskCard: {
        backgroundColor: '#2A4158',
        borderRadius: 12,
        padding: 16,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    taskCardSelected: {
        borderColor: '#4CAF50',
        backgroundColor: '#2A4158',
    },
    taskCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    taskInfo: {
        flex: 1,
    },
    taskTypeBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 8,
    },
    taskTypeBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: 'bold',
    },
    taskClientName: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    taskAddress: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 13,
    },
    loadingText: {
        color: '#FFFFFF',
        fontSize: 16,
        textAlign: 'center',
        padding: 30,
    },
    emptyText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 16,
        textAlign: 'center',
        padding: 30,
    },
    bottomContainer: {
        paddingHorizontal: 20,
        paddingTop: 15,
        paddingBottom: 40,
        backgroundColor: '#16283C',
        borderTopWidth: 1,
        borderTopColor: '#2A4158',
    },
    selectionInfo: {
        marginBottom: 12,
    },
    selectionInfoText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 14,
        textAlign: 'center',
    },
    transferButton: {
        backgroundColor: '#4CAF50',
        borderRadius: 20,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    buttonPressed: {
        opacity: 0.8,
        transform: [{ scale: 0.98 }]
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    transferButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    calendarModal: {
        backgroundColor: '#2A4158',
        borderRadius: 16,
        width: '90%',
        padding: 20,
    },
    dropdownModal: {
        backgroundColor: '#2A4158',
        borderRadius: 16,
        width: '80%',
        maxHeight: '60%',
        padding: 20,
    },
    modalTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },
    dropdownList: {
        maxHeight: 300,
    },
    dropdownItem: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5,
    },
    dropdownItemSelected: {
        backgroundColor: '#16283C',
    },
    dropdownItemPressed: {
        backgroundColor: '#16283C',
        opacity: 0.8,
    },
    dropdownItemText: {
        color: '#FFFFFF',
        fontSize: 16,
    },
    dropdownItemTextSelected: {
        fontWeight: 'bold',
    },
    driverCountyText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 12,
        marginTop: 2,
    },
})
