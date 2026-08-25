import { StyleSheet, Text, View, Pressable, Alert, ScrollView } from 'react-native'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons';
import { Employee, getAllDrivers } from '@/services/EmployeeService';
import { RouteService } from '@/services/RouteService';
import { TaskService, Task } from '@/services/TaskService';
import ScreenHeader from '../../components/layout/ScreenHeader';
import FormPickerField from '../../components/forms/FormPickerField';
import SelectableTaskCard from '../../components/cards/SelectableTaskCard';
import ListPickerModal, { ListPickerItem } from '../../modals/ListPickerModal';
import CalendarPickerModal from '../../modals/CalendarPickerModal';
import { AppColors } from '../../constants/Colors';
import { formatDisplayDate, toDateString } from '../../utils/dateUtils';

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
            const dateString = toDateString(selectedDate);

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

    const handleDateSelect = (date: Date) => {
        setSelectedDate(date);
        setShowDatePicker(false);
    };

    const handleSourceDriverSelect = (item: ListPickerItem) => {
        const driver = drivers.find(d => d.id === Number(item.key));
        if (!driver) return;
        setSourceDriver(driver);
        setSourceDriverDropdownVisible(false);
        // Reset target driver if same as source
        if (targetDriver?.id === driver.id) {
            setTargetDriver(null);
        }
    };

    const handleTargetDriverSelect = (item: ListPickerItem) => {
        const driver = availableTargetDrivers.find(d => d.id === Number(item.key));
        if (!driver) return;
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

    // Available drivers for target (exclude source driver)
    const availableTargetDrivers = drivers.filter(d => d.id !== sourceDriver?.id);

    // Prepare picker items
    const sourceDriverItems: ListPickerItem[] = drivers.map(d => ({ key: String(d.id), label: d.fullName }));
    const targetDriverItems: ListPickerItem[] = availableTargetDrivers.map(d => ({ key: String(d.id), label: d.fullName }));

    return (
        <View style={styles.container}>
            <ScreenHeader title="Schimbă Șofer" />

            <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
                <FormPickerField
                    label="Data"
                    value={formatDisplayDate(selectedDate)}
                    icon="calendar-outline"
                    onPress={() => setShowDatePicker(true)}
                    showChevron={false}
                />

                <FormPickerField
                    label="Șofer Sursă (de la)"
                    value={sourceDriver?.fullName || ''}
                    placeholder="Selectează șoferul..."
                    icon="person-outline"
                    onPress={() => setSourceDriverDropdownVisible(true)}
                />

                <FormPickerField
                    label="Șofer Destinație (către)"
                    value={targetDriver?.fullName || ''}
                    placeholder="Selectează șoferul..."
                    icon="person-outline"
                    onPress={() => sourceDriver && setTargetDriverDropdownVisible(true)}
                    disabled={!sourceDriver}
                />

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
                                    <SelectableTaskCard
                                        key={task.id}
                                        taskType={task.type}
                                        clientName={task.clientName}
                                        address={task.address}
                                        selected={selectedTaskIds.has(task.id)}
                                        onToggle={() => toggleTaskSelection(task.id)}
                                    />
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
                        <Ionicons name="swap-horizontal" size={20} color={AppColors.textWhite} style={{ marginRight: 8 }} />
                        <Text style={styles.transferButtonText}>
                            {transferring ? 'Se transferă...' : 'Transferă Sarcinile'}
                        </Text>
                    </Pressable>
                </View>
            )}

            <CalendarPickerModal
                visible={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
            />

            <ListPickerModal
                visible={sourceDriverDropdownVisible}
                onClose={() => setSourceDriverDropdownVisible(false)}
                title="Selectează Șoferul Sursă"
                items={sourceDriverItems}
                selectedKey={sourceDriver ? String(sourceDriver.id) : null}
                onSelect={handleSourceDriverSelect}
            />

            <ListPickerModal
                visible={targetDriverDropdownVisible}
                onClose={() => setTargetDriverDropdownVisible(false)}
                title="Selectează Șoferul Destinație"
                items={targetDriverItems}
                selectedKey={targetDriver ? String(targetDriver.id) : null}
                onSelect={handleTargetDriverSelect}
            />
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
})
