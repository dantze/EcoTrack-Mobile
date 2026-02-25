import { StyleSheet, Text, View, Pressable, Alert, Modal, ScrollView, Switch } from 'react-native'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { Employee, getAllDrivers } from '@/services/EmployeeService';
import { RouteService } from '@/services/RouteService';
import { TaskService, Task } from '@/services/TaskService';
import ScreenHeader from '../../components/ScreenHeader';
import { AppColors } from '../../constants/Colors';

const ChangeDriver = () => {
    const router = useRouter();

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Drivers
    const [drivers, setDrivers] = useState<Employee[]>([]);
    const [driversLoading, setDriversLoading] = useState(false);

    // Driver selection
    const [sourceDriver, setSourceDriver] = useState<Employee | null>(null);
    const [targetDriver, setTargetDriver] = useState<Employee | null>(null);
    const [sourceDriverDropdownVisible, setSourceDriverDropdownVisible] = useState(false);
    const [targetDriverDropdownVisible, setTargetDriverDropdownVisible] = useState(false);

    // Tasks
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);
    const [transferring, setTransferring] = useState(false);

    // Load drivers on mount
    useEffect(() => {
        loadDrivers();
    }, []);

    // Load tasks when source driver or date changes
    useEffect(() => {
        if (sourceDriver) {
            loadDriverTasks();
        } else {
            setTasks([]);
            setSelectedTaskIds(new Set());
        }
    }, [sourceDriver, selectedDate]);

    const loadDrivers = async () => {
        try {
            setDriversLoading(true);
            const data = await getAllDrivers();
            setDrivers(data);
        } catch (error) {
            console.error('Error loading drivers:', error);
            Alert.alert('Eroare', 'Nu s-au putut încărca șoferii');
        } finally {
            setDriversLoading(false);
        }
    };

    const loadDriverTasks = async () => {
        if (!sourceDriver) return;

        try {
            setLoading(true);
            const dateString = getCalendarDateString(selectedDate);

            // Fetch tasks directly by employee + scheduled date
            const employeeTasks = await TaskService.getTasksByEmployeeAndDate(sourceDriver.id, dateString);
            setTasks(employeeTasks);
            setSelectedTaskIds(new Set());
        } catch (error) {
            console.error('Error loading tasks:', error);
            Alert.alert('Eroare', 'Nu s-au putut încărca sarcinile');
        } finally {
            setLoading(false);
        }
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

    const handleSourceDriverSelect = (driver: Employee) => {
        setSourceDriver(driver);
        setSourceDriverDropdownVisible(false);
        // Reset target driver if same as source
        if (targetDriver?.id === driver.id) {
            setTargetDriver(null);
        }
    };

    const handleTargetDriverSelect = (driver: Employee) => {
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
            setSelectedTaskIds(new Set());
        } else {
            setSelectedTaskIds(new Set(tasks.map(t => t.id)));
        }
    };

    const handleTransferTasks = async () => {
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
                    onPress: performTransfer
                }
            ]
        );
    };

    const performTransfer = async () => {
        if (!targetDriver) return;

        try {
            setTransferring(true);

            // Get routes for the target driver to find a route to assign to
            const targetRoutes = await RouteService.getRoutesByEmployeeId(targetDriver.id);

            if (targetRoutes.length === 0) {
                Alert.alert('Eroare', `${targetDriver.fullName} nu are nicio rută. Creează mai întâi o rută pentru acest șofer.`);
                return;
            }

            const targetRouteId = targetRoutes[0].id;
            const taskIdsArray = Array.from(selectedTaskIds);

            await TaskService.reassignTasks(taskIdsArray, targetRouteId);

            Alert.alert(
                'Succes',
                `${selectedTaskIds.size} sarcin${selectedTaskIds.size === 1 ? 'ă a fost transferată' : 'i au fost transferate'} cu succes!`
            );

            // Remove transferred tasks from the list
            setTasks(prev => prev.filter(t => !selectedTaskIds.has(t.id)));
            setSelectedTaskIds(new Set());
        } catch (error) {
            console.error('Error transferring tasks:', error);
            Alert.alert('Eroare', 'Nu s-au putut transfera sarcinile. Te rog încearcă din nou.');
        } finally {
            setTransferring(false);
        }
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
    const availableTargetDrivers = drivers.filter(d => d.id !== sourceDriver?.id);

    return (
        <View style={styles.container}>
            <ScreenHeader title="Schimbă Șofer" />

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
                                                <Text style={styles.taskClientName}>{task.clientName || 'Client necunoscut'}</Text>
                                                <Text style={styles.taskAddress}>{task.address || 'Adresă necunoscută'}</Text>
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
                            (selectedTaskIds.size === 0 || transferring) && styles.buttonDisabled
                        ]}
                        onPress={handleTransferTasks}
                        disabled={selectedTaskIds.size === 0 || transferring}
                    >
                        <Ionicons name="swap-horizontal" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={styles.transferButtonText}>
                            {transferring ? 'Se transferă...' : 'Transferă Sarcinile'}
                        </Text>
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
                        {driversLoading ? (
                            <Text style={styles.loadingText}>Se încarcă...</Text>
                        ) : drivers.length === 0 ? (
                            <Text style={styles.emptyText}>Nu există șoferi</Text>
                        ) : (
                            <ScrollView style={styles.dropdownList}>
                                {drivers.map((driver) => (
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
                                        </View>
                                        {sourceDriver?.id === driver.id && (
                                            <Ionicons name="checkmark" size={20} color="#4CAF50" />
                                        )}
                                    </Pressable>
                                ))}
                            </ScrollView>
                        )}
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
                        {availableTargetDrivers.length === 0 ? (
                            <Text style={styles.emptyText}>Nu există alți șoferi disponibili</Text>
                        ) : (
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
                                        </View>
                                        {targetDriver?.id === driver.id && (
                                            <Ionicons name="checkmark" size={20} color="#4CAF50" />
                                        )}
                                    </Pressable>
                                ))}
                            </ScrollView>
                        )}
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
        backgroundColor: AppColors.screenBackground,
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
        color: AppColors.textWhite,
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
    },
    dropdownButton: {
        backgroundColor: AppColors.inputBackground,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: AppColors.buttonBackground,
        flexDirection: 'row',
        alignItems: 'center',
    },
    dropdownDisabled: {
        opacity: 0.5,
    },
    dropdownButtonText: {
        fontSize: 16,
        color: AppColors.textWhite,
    },
    placeholderText: {
        color: '#888',
    },
    warningText: {
        color: '#FF9800',
        fontSize: 12,
        marginTop: 8,
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
        color: AppColors.textWhite,
        fontSize: 18,
        fontWeight: 'bold',
    },
    selectAllButton: {
        backgroundColor: AppColors.buttonBackground,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    selectAllButtonText: {
        color: AppColors.textWhite,
        fontSize: 12,
        fontWeight: '600',
    },
    tasksList: {
        gap: 12,
    },
    taskCard: {
        backgroundColor: AppColors.inputBackground,
        borderRadius: 12,
        padding: 16,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    taskCardSelected: {
        borderColor: AppColors.successGreen,
        backgroundColor: AppColors.inputBackground,
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
        color: AppColors.textWhite,
        fontSize: 11,
        fontWeight: 'bold',
    },
    taskClientName: {
        color: AppColors.textWhite,
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    taskAddress: {
        color: AppColors.subtitleText,
        fontSize: 13,
    },
    loadingText: {
        color: AppColors.textWhite,
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
        backgroundColor: AppColors.screenBackground,
        borderTopWidth: 1,
        borderTopColor: AppColors.inputBackground,
    },
    selectionInfo: {
        marginBottom: 12,
    },
    selectionInfoText: {
        color: AppColors.subtitleText,
        fontSize: 14,
        textAlign: 'center',
    },
    transferButton: {
        backgroundColor: AppColors.successGreen,
        borderRadius: 20,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        shadowColor: AppColors.shadow,
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
        color: AppColors.textWhite,
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
        backgroundColor: AppColors.inputBackground,
        borderRadius: 16,
        width: '90%',
        padding: 20,
    },
    dropdownModal: {
        backgroundColor: AppColors.inputBackground,
        borderRadius: 16,
        width: '80%',
        maxHeight: '60%',
        padding: 20,
    },
    modalTitle: {
        color: AppColors.textWhite,
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
        backgroundColor: AppColors.screenBackground,
    },
    dropdownItemPressed: {
        backgroundColor: AppColors.screenBackground,
        opacity: 0.8,
    },
    dropdownItemText: {
        color: AppColors.textWhite,
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
