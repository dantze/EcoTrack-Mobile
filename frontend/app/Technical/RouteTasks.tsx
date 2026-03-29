import { StyleSheet, Text, View, Pressable, ActivityIndicator, Alert } from 'react-native'
import React, { useState, useEffect } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons';
import { TaskService, Task } from '../../services/TaskService';
import { getTaskTypeLabel, getTaskTypeColor, getStatusLabel } from '../../constants/TaskConstants';
import { AppColors } from '../../constants/Colors';
import { toDateString } from '../../utils/dateUtils';
import { DAY_NAMES_SHORT } from '../../constants/RouteConstants';
import { RouteService } from '../../services/RouteService';
import ScreenHeader from '../../components/layout/ScreenHeader';
import TaskTypeLegend from '../../components/display/TaskTypeLegend';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const RouteTasks = () => {
    const router = useRouter();
    const { routeId, driverName } = useLocalSearchParams<{
        routeId?: string;
        driverName?: string;
    }>();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (routeId) {
            loadRouteTasks();
        }
    }, [routeId, selectedDate]);

    const loadRouteTasks = async () => {
        try {
            setLoading(true);
            const dateString = toDateString(selectedDate);
            const data = await TaskService.getTasksByRouteAndDate(Number(routeId), dateString);
            setTasks(data);
            setHasChanges(false);
        } catch (err) {
            console.error('Error loading route tasks:', err);
            setTasks([]);
        } finally {
            setLoading(false);
        }
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

    const handleCardPress = (item: Task) => {
        router.push({
            pathname: "/Technical/ServiceDetails",
            params: { id: item.id }
        });
    };

    const saveOrder = async () => {
        if (!routeId) return;
        try {
            setSaving(true);
            const taskIds = tasks.map(t => t.id);
            await RouteService.reorderTasks(Number(routeId), taskIds);
            setHasChanges(false);
            Alert.alert('Succes', 'Ordinea sarcinilor a fost salvată');
        } catch (err) {
            console.error('Error saving order:', err);
            Alert.alert('Eroare', 'Nu s-a putut salva ordinea sarcinilor');
        } finally {
            setSaving(false);
        }
    };

    const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<Task>) => {
        const index = (getIndex() ?? 0) + 1;
        return (
            <ScaleDecorator activeScale={1.03}>
                <Pressable
                    style={({ pressed }) => [styles.card, pressed && styles.cardPressed, isActive && styles.cardActive]}
                    onPress={() => handleCardPress(item)}
                    onLongPress={drag}
                    delayLongPress={150}
                >
                    {/* Order number badge - top right */}
                    <View style={styles.orderBadge}>
                        <Text style={styles.orderBadgeText}>{index}</Text>
                    </View>

                    <View style={styles.cardInfo}>
                        <Text style={styles.clientName}>
                            {item.clientName || 'Client necunoscut'}
                        </Text>
                        <Text style={styles.statusText}>
                            Tip: {getTaskTypeLabel(item.type)}
                        </Text>
                        <Text style={styles.statusText}>
                            Status: {getStatusLabel(item.status)}
                        </Text>
                        {item.address && (
                            <View style={styles.addressContainer}>
                                <Ionicons name="location-outline" size={14} color="#E0E0E0" style={{ marginRight: 5 }} />
                                <Text style={styles.statusText} numberOfLines={1}>{item.address}</Text>
                            </View>
                        )}
                        {item.clientPhone && (
                            <View style={styles.phoneContainer}>
                                <Ionicons name="call" size={14} color="#E0E0E0" style={{ marginRight: 5 }} />
                                <Text style={styles.statusText}>{item.clientPhone}</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.pinContainer}>
                        <Ionicons
                            name="location"
                            size={28}
                            color={getTaskTypeColor(item.type)}
                        />
                    </View>
                </Pressable>
            </ScaleDecorator>
        );
    };

    return (
        <GestureHandlerRootView style={styles.container}>

            <ScreenHeader title={driverName || 'Sarcini Rută'} />

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

            {/* LEGEND */}
            <TaskTypeLegend types={['PICKUP', 'PLACEMENT', 'SANITIZATION']} />

            {loading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color="#427992" />
                    <Text style={styles.loadingText}>Se încarcă sarcinile...</Text>
                </View>
            ) : tasks.length === 0 ? (
                <View style={styles.centerContent}>
                    <Ionicons name="clipboard-outline" size={60} color={AppColors.accentColor} />
                    <Text style={styles.emptyText}>Nicio sarcină pentru această zi</Text>
                </View>
            ) : (
                <View style={styles.listWrapper}>
                    <DraggableFlatList
                        data={tasks}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={renderItem}
                        onDragEnd={({ data }) => {
                            setTasks(data);
                            setHasChanges(true);
                        }}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                </View>
            )}

            {/* Save Order Button */}
            <View style={styles.saveButtonContainer}>
                <Pressable
                    style={({ pressed }) => [
                        styles.saveButton,
                        hasChanges && styles.saveButtonPending,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={saveOrder}
                    disabled={saving || !hasChanges}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            <Ionicons name="save-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                            <Text style={styles.saveButtonText}>Salvează ordinea</Text>
                        </>
                    )}
                </Pressable>
            </View>
        </GestureHandlerRootView>
    )
}

export default RouteTasks

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AppColors.screenBackground,
    },

    // --- DATE NAVIGATION ---
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

    // --- CENTER CONTENT (Loading, Error, Empty) ---
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    loadingText: {
        color: AppColors.textWhite,
        marginTop: 10,
        fontSize: 16,
    },
    errorText: {
        color: '#E74C3C',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
    },
    emptyText: {
        color: AppColors.accentColor,
        fontSize: 16,
        textAlign: 'center',
        marginTop: 15,
    },
    retryButton: {
        backgroundColor: AppColors.buttonBackground,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    retryButtonText: {
        color: AppColors.textWhite,
        fontSize: 16,
        fontWeight: 'bold',
    },

    // --- LIST ---
    listWrapper: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },

    // --- SAVE BUTTON ---
    saveButtonContainer: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 30,
        alignItems: 'center',
    },
    saveButton: {
        flexDirection: 'row',
        backgroundColor: AppColors.successGreen,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        elevation: 5,
        shadowColor: AppColors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    saveButtonPending: {
        backgroundColor: AppColors.warningOrange,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonPressed: {
        opacity: 0.8,
    },

    // --- TASK CARD ---
    card: {
        backgroundColor: AppColors.accentColor,
        borderRadius: 14,
        padding: 14,
        marginBottom: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 5,
        shadowColor: AppColors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
    },
    cardActive: {
        elevation: 10,
        shadowOpacity: 0.3,
    },
    orderBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: AppColors.buttonBackground,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    orderBadgeText: {
        color: AppColors.textWhite,
        fontSize: 13,
        fontWeight: 'bold',
    },
    cardPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    cardInfo: {
        flex: 1,
    },
    clientName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: AppColors.textWhite,
        marginBottom: 4,
    },
    statusText: {
        fontSize: 14,
        color: '#E0E0E0',
        marginBottom: 8,
    },
    phoneContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pinContainer: {
        paddingLeft: 10,
    },
    addressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
})
