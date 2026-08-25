import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native'
import React, { useEffect, useState, useRef } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '../../services/AuthService';
import { TaskService, Task } from '../../services/TaskService';
import { TASK_TYPE_LABELS, STATUS_LABELS, STATUS_COLORS, getTaskTypeLabel, getStatusLabel, getStatusColor } from '../../constants/TaskConstants';
import { AppColors } from '../../constants/Colors';
import { toDateString } from '../../utils/dateUtils';
import { DAY_NAMES_SHORT } from '../../constants/RouteConstants';
import ScreenHeader from '../../components/layout/ScreenHeader';
import StatusBadge from '../../components/display/StatusBadge';

const RouteTasks = () => {
    const router = useRouter();
    const { routeId, routeDate, routeName } = useLocalSearchParams<{ routeId: string; routeDate?: string; routeName?: string }>();
    const { width: screenWidth } = useWindowDimensions();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [activeTab, setActiveTab] = useState(0); // 0 = Rămase, 1 = Finalizate
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        fetchTasks();
    }, [selectedDate]);

    const fetchTasks = async () => {
        try {
            setLoading(true);

            // Get the logged-in user or active driver
            const user = await AuthService.getCurrentUser();
            const activeDriver = await AuthService.getActiveDriver();
            const employeeId = activeDriver?.id || user?.id;

            if (!employeeId) {
                setTasks([]);
                return;
            }

            // Format date as YYYY-MM-DD
            const dateString = toDateString(selectedDate);

            // Fetch tasks for the employee on the selected date
            const data = await TaskService.getTasksByEmployeeAndDate(employeeId, dateString);
            console.log('Fetched tasks for', dateString, ':', data.length);
            setTasks(data);
        } catch (error) {
            console.error("Error fetching tasks:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleTaskPress = (task: Task) => {
        router.push({
            pathname: "/Driver/TaskDetails",
            params: {
                taskId: task.id,
            }
        });
    };

    // Date navigation
    const goToPreviousDay = () => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() - 1);
        setSelectedDate(newDate);
    };

    const goToNextDay = () => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + 1);
        setSelectedDate(newDate);
    };

    const formatDateNav = (date: Date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const dayName = DAY_NAMES_SHORT[date.getDay()];
        return `${day}/${month} ${dayName}`;
    };

    // Slider tab handling
    const handleTabPress = (index: number) => {
        setActiveTab(index);
        scrollViewRef.current?.scrollTo({ x: index * screenWidth, animated: true });
    };

    const handleSliderScroll = (event: any) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const newIndex = Math.round(offsetX / screenWidth);
        if (newIndex !== activeTab) {
            setActiveTab(newIndex);
        }
    };

    // Filter tasks
    const remainingTasks = tasks.filter(t => t.status === 'NEW' || t.status === 'IN_PROGRESS');
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED');
    const remainingSanitizations = remainingTasks.filter(t => t.type?.toUpperCase() === 'SANITIZATION');

    const renderTaskCard = (task: Task) => (
        <Pressable
            key={task.id}
            style={({ pressed }) => [
                styles.card,
                task.status === 'COMPLETED' && styles.cardCompleted,
                pressed && styles.cardPressed
            ]}
            onPress={() => handleTaskPress(task)}
        >
            <View style={styles.cardInfo}>
                <View style={styles.taskTypeRow}>
                    <Text style={styles.taskType}>
                        {getTaskTypeLabel(task.type)}
                    </Text>
                    <StatusBadge
                        label={getStatusLabel(task.status)}
                        color={getStatusColor(task.status)}
                    />
                </View>

                <Text style={styles.clientName}>{task.clientName || 'Client necunoscut'}</Text>

                <View style={styles.addressRow}>
                    <Ionicons name="location-sharp" size={14} color={AppColors.lightText} />
                    <Text style={styles.addressText} numberOfLines={1}>
                        {task.address || 'Adresă necunoscută'}
                    </Text>
                </View>

                {(task.contactPerson || task.clientPhone) && (
                    <View style={styles.phoneRow}>
                        <Ionicons name="call" size={14} color={AppColors.lightText} />
                        <Text style={styles.phoneText}>{task.contactPerson || task.clientPhone}</Text>
                    </View>
                )}
            </View>

            <Ionicons name="chevron-forward" size={22} color={AppColors.textWhite} style={{ marginLeft: 8 }} />
        </Pressable>
    );

    const renderEmptyState = (message: string) => (
        <View style={styles.emptyContainer}>
            <Ionicons name="clipboard-outline" size={60} color={AppColors.accentColor} />
            <Text style={styles.emptyText}>{message}</Text>
        </View>
    );

    if (loading && tasks.length === 0) {
        return (
            <View style={[styles.container, styles.loadingContainer]}>
                <ActivityIndicator size="large" color={AppColors.textWhite} />
                <Text style={styles.loadingText}>Se încarcă sarcinile...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <ScreenHeader title={routeName || 'Sarcinile Mele'} onRefresh={fetchTasks} />

            {/* Date Navigation */}
            <View style={styles.dateNavContainer}>
                <Pressable onPress={goToPreviousDay} style={styles.dateNavArrow}>
                    <Ionicons name="chevron-back" size={22} color={AppColors.textWhite} />
                </Pressable>
                <View style={styles.dateNavCenter}>
                    <Ionicons name="calendar-outline" size={18} color={AppColors.accentColor} style={{ marginRight: 8 }} />
                    <Text style={styles.dateNavText}>{formatDateNav(selectedDate)}</Text>
                </View>
                <Pressable onPress={goToNextDay} style={styles.dateNavArrow}>
                    <Ionicons name="chevron-forward" size={22} color={AppColors.textWhite} />
                </Pressable>
            </View>

            {/* Stats - Rămase, Igienizări rămase, Finalizate */}
            <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: AppColors.warningOrange }]}>
                        {remainingTasks.length}
                    </Text>
                    <Text style={styles.statLabel}>Rămase</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: '#3498DB' }]}>
                        {remainingSanitizations.length}
                    </Text>
                    <Text style={styles.statLabel}>Igienizări</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: AppColors.successGreen }]}>
                        {completedTasks.length}
                    </Text>
                    <Text style={styles.statLabel}>Finalizate</Text>
                </View>
            </View>

            {/* Tab Buttons */}
            <View style={styles.tabContainer}>
                <Pressable
                    style={[styles.tab, activeTab === 0 && styles.tabActive]}
                    onPress={() => handleTabPress(0)}
                >
                    <Text style={[styles.tabText, activeTab === 0 && styles.tabTextActive]}>
                        Rămase ({remainingTasks.length})
                    </Text>
                </Pressable>
                <Pressable
                    style={[styles.tab, activeTab === 1 && styles.tabActive]}
                    onPress={() => handleTabPress(1)}
                >
                    <Text style={[styles.tabText, activeTab === 1 && styles.tabTextActive]}>
                        Finalizate ({completedTasks.length})
                    </Text>
                </Pressable>
            </View>

            {/* Horizontal Slider */}
            <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleSliderScroll}
                style={styles.sliderContainer}
            >
                {/* Page 1: Remaining Tasks */}
                <ScrollView
                    style={{ width: screenWidth }}
                    contentContainerStyle={styles.pageContent}
                    showsVerticalScrollIndicator={false}
                >
                    {remainingTasks.length === 0 ? (
                        renderEmptyState('Nicio sarcină rămasă pentru această zi 🎉')
                    ) : (
                        remainingTasks.map(renderTaskCard)
                    )}
                    <View style={{ height: 80 }} />
                </ScrollView>

                {/* Page 2: Completed Tasks */}
                <ScrollView
                    style={{ width: screenWidth }}
                    contentContainerStyle={styles.pageContent}
                    showsVerticalScrollIndicator={false}
                >
                    {completedTasks.length === 0 ? (
                        renderEmptyState('Nicio sarcină finalizată pentru această zi')
                    ) : (
                        completedTasks.map(renderTaskCard)
                    )}
                    <View style={{ height: 80 }} />
                </ScrollView>
            </ScrollView>

            {/* Loading overlay when changing dates */}
            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="small" color={AppColors.textWhite} />
                </View>
            )}

        </View>
    )
}

export default RouteTasks

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AppColors.screenBackground,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: AppColors.textWhite,
        marginTop: 10,
        fontSize: 16,
    },

    // Date Navigation
    dateNavContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 20,
        marginBottom: 15,
        backgroundColor: AppColors.modalBackground,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: AppColors.inputBackground,
    },
    dateNavArrow: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateNavCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    dateNavText: {
        color: AppColors.textWhite,
        fontSize: 17,
        fontWeight: '600',
        letterSpacing: 0.5,
    },

    // Stats
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: AppColors.inputBackground,
        marginHorizontal: 20,
        borderRadius: 12,
        marginBottom: 12,
    },
    statItem: {
        alignItems: 'center',
        paddingHorizontal: 30,
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: AppColors.buttonBackground,
    },
    statNumber: {
        color: AppColors.textWhite,
        fontSize: 24,
        fontWeight: 'bold',
    },
    statLabel: {
        color: AppColors.accentColor,
        fontSize: 12,
        marginTop: 2,
    },

    // Tabs
    tabContainer: {
        flexDirection: 'row',
        marginHorizontal: 20,
        marginBottom: 8,
        backgroundColor: AppColors.modalBackground,
        borderRadius: 12,
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    tabActive: {
        backgroundColor: AppColors.buttonBackground,
    },
    tabText: {
        color: AppColors.accentColor,
        fontSize: 14,
        fontWeight: '600',
    },
    tabTextActive: {
        color: AppColors.textWhite,
    },

    // Slider
    sliderContainer: {
        flex: 1,
    },
    pageContent: {
        paddingHorizontal: 20,
        paddingTop: 8,
    },

    // Empty state
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyText: {
        color: AppColors.accentColor,
        fontSize: 16,
        marginTop: 15,
        textAlign: 'center',
    },

    // Task Cards
    card: {
        backgroundColor: AppColors.buttonBackground,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: AppColors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    cardCompleted: {
        backgroundColor: AppColors.inputBackground,
        opacity: 0.85,
    },
    cardPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    cardInfo: {
        flex: 1,
    },
    taskTypeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    taskType: {
        fontSize: 16,
        fontWeight: 'bold',
        color: AppColors.textWhite,
        marginRight: 8,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    statusText: {
        color: AppColors.textWhite,
        fontSize: 10,
        fontWeight: '600',
    },
    clientName: {
        fontSize: 14,
        color: AppColors.lightText,
        marginBottom: 4,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    addressText: {
        fontSize: 12,
        color: AppColors.mutedText,
        marginLeft: 4,
        flex: 1,
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    phoneText: {
        fontSize: 12,
        color: AppColors.mutedText,
        marginLeft: 4,
    },

    // Loading overlay
    loadingOverlay: {
        position: 'absolute',
        top: 130,
        alignSelf: 'center',
        backgroundColor: `${AppColors.screenBackground}D9`,
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
    },
})
