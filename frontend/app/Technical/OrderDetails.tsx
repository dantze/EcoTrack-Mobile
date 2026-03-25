import { StyleSheet, Text, View, Pressable, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native'
import React, { useState, useEffect } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons';
import { OrderService } from '../../services/OrderService';
import { RouteService, Route } from '../../services/RouteService';
import { TaskService } from '../../services/TaskService';

import { AppColors } from '../../constants/Colors';
import { Order } from '../../types/OrderTypes';
import ScreenHeader from '../../components/layout/ScreenHeader';
import OrderInfoCard from '../../components/cards/OrderInfoCard';
import ScheduledDateSection from '../../components/display/ScheduledDateSection';
import RouteAssignmentModal from '../../modals/RouteAssignmentModal';
import { formatDisplayDate, toDateString } from '../../utils/dateUtils';
import { DateTimePickerEvent } from '@react-native-community/datetimepicker';

const OrderDetails = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const orderId = params.id ? Number(params.id) : null;

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [routes, setRoutes] = useState<Route[]>([]);
    const [orderTaskStatus, setOrderTaskStatus] = useState<{ hasTask: boolean; taskId: number | null; routeId: number | null; scheduledTime?: string | null; status?: string | null }>({ hasTask: false, taskId: null, routeId: null, status: null });

    // --- STATE FOR MODAL ---
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
    const [assigning, setAssigning] = useState(false);

    // --- STATE FOR DATE PICKER ---
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [savingDate, setSavingDate] = useState(false);
    const [pickerDate, setPickerDate] = useState<Date>(new Date());



    useEffect(() => {
        if (orderId) {
            fetchOrderDetails();
            fetchRoutes();
            checkTaskStatus();
        }
    }, [orderId]);



    const fetchOrderDetails = async () => {
        try {
            const data = await OrderService.getOrderById(orderId!);
            console.log("Fetched Order Details:", JSON.stringify(data, null, 2));
            setOrder(data);
        } catch (error: any) {
            console.error("Fetch order error:", error);
            Alert.alert("Eroare", `Nu s-au putut încărca detaliile comenzii: ${error.message}`);
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const fetchRoutes = async () => {
        try {
            let data: Route[] = [];
            data = await RouteService.getAllRoutes();
            setRoutes(data);
        } catch (error) {
            console.error("Failed to fetch routes", error);
        }
    };

    const checkTaskStatus = async () => {
        try {
            const status = await TaskService.checkOrderHasTask(orderId!);
            setOrderTaskStatus({ hasTask: status.hasTask, taskId: status.taskId, routeId: status.routeId, scheduledTime: status.scheduledTime, status: (status as any).status || null });
        } catch (error) {
            console.error("Failed to check task status", error);
        }
    };

    const getTaskStatusInfo = () => {
        switch (orderTaskStatus.status) {
            case 'COMPLETED': return { label: 'Finalizat', color: '#2ECC71', icon: 'checkmark-circle' as const };
            case 'IN_PROGRESS': return { label: 'În progres', color: '#F1C40F', icon: 'time' as const };
            case 'CANCELLED': return { label: 'Anulat', color: '#95A5A6', icon: 'close-circle' as const };
            case 'NEW': default: return { label: 'Nefinalizat', color: '#E74C3C', icon: 'alert-circle' as const };
        }
    };



    // Route selection function
    const handleSelectRoute = (route: Route) => {
        setSelectedRoute(route);
    };

    // Finalize function - creates a Task and assigns it to the selected Route
    const handleFinalize = async () => {
        if (selectedRoute && orderId) {
            try {
                setAssigning(true);
                // Create task from order and assign to route
                const createdTask = await TaskService.createTaskFromOrder(orderId, selectedRoute.id);
                setModalVisible(false);
                setOrderTaskStatus({ hasTask: true, taskId: createdTask.id, routeId: selectedRoute.id, scheduledTime: null });
                Alert.alert(
                    "Succes!",
                    `Comanda a fost atribuită rutei "${selectedRoute.name || 'Ruta #' + selectedRoute.id}" (${selectedRoute.employeeName || 'Șofer'})!`
                );
            } catch (error: any) {
                Alert.alert("Eroare", error.message || "Nu s-a putut atribui ruta.");
            } finally {
                setAssigning(false);
            }
        } else {
            Alert.alert("Atenție", "Te rog selectează o rută.");
        }
    };

    // Handle reassignment - deletes the existing task
    const handleReassign = async () => {
        if (!orderTaskStatus.hasTask) return;

        try {
            const status = await TaskService.checkOrderHasTask(orderId!);
            if (status.hasTask && status.taskId) {
                Alert.alert(
                    "Reasignare comandă",
                    "Sigur dorești să reasignezi această comandă la o altă rută? Atribuirea curentă va fi ștearsă.",
                    [
                        { text: "Anulează", style: "cancel" },
                        {
                            text: "Reasignează",
                            style: "destructive",
                            onPress: async () => {
                                try {
                                    await TaskService.deleteTask(status.taskId!);
                                    setOrderTaskStatus({ hasTask: false, taskId: null, routeId: null, scheduledTime: null });
                                    setSelectedRoute(null);
                                    setModalVisible(true);
                                    Alert.alert("Succes", "Atribuirea anterioară a fost ștearsă. Poți selecta o nouă rută.");
                                } catch (error: any) {
                                    Alert.alert("Eroare", error.message || "Nu s-a putut șterge atribuirea.");
                                }
                            }
                        }
                    ]
                );
            }
        } catch (error) {
            console.error("Error checking task status:", error);
        }
    };

    // Track date selection locally (no auto-save)
    const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        // On Android, the native dialog fires this on both "OK" and "Cancel"
        // We must hide the picker here since it's a one-shot dialog on Android
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
            // On Android, save immediately when user confirms
            if (event.type === 'set' && selectedDate && orderTaskStatus.taskId) {
                setPickerDate(selectedDate);
                saveDate(selectedDate);
            }
        } else {
            // iOS: inline picker, just update the local state
            if (selectedDate) {
                setPickerDate(selectedDate);
            }
        }
    };

    // Save date to backend
    const saveDate = async (date: Date) => {
        if (!orderTaskStatus.taskId) return;
        try {
            setSavingDate(true);
            const dateStr = toDateString(date);
            await TaskService.updateScheduledDate(orderTaskStatus.taskId, dateStr);
            setOrderTaskStatus(prev => ({ ...prev, scheduledTime: date.toISOString() }));
            Alert.alert("Succes", `Data programată a fost setată: ${date.toLocaleDateString('ro-RO')}`);
        } catch (error: any) {
            Alert.alert("Eroare", error.message || "Nu s-a putut seta data programată.");
        } finally {
            setSavingDate(false);
        }
    };

    // Toggle picker: open it or save & close it
    const handleDateButtonPress = async () => {
        if (showDatePicker) {
            // Picker is open (iOS only path) → save and close
            await saveDate(pickerDate);
            setShowDatePicker(false);
        } else {
            // Picker is closed → open it, initialize with existing date or today
            setPickerDate(orderTaskStatus.scheduledTime ? new Date(orderTaskStatus.scheduledTime) : new Date());
            setShowDatePicker(true);
        }
    };

    const getScheduledDateDisplay = (): string | null => {
        if (orderTaskStatus.scheduledTime) {
            return formatDisplayDate(new Date(orderTaskStatus.scheduledTime));
        }
        return null;
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
        );
    }

    if (!order) return null;

    return (
        <View style={styles.container}>

            <ScreenHeader title="Detalii Comandă" />

            <ScrollView contentContainerStyle={styles.scrollContent}>

                <OrderInfoCard order={order} />



                {/* --- SCHEDULED DATE SECTION --- */}
                {orderTaskStatus.hasTask && (
                    <ScheduledDateSection
                        scheduledDate={getScheduledDateDisplay()}
                        showPicker={showDatePicker}
                        pickerDate={pickerDate}
                        saving={savingDate}
                        onDateChange={handleDateChange}
                        onButtonPress={handleDateButtonPress}
                    />
                )}

                {/* STATUS BADGES */}
                {orderTaskStatus.hasTask && (
                    <View style={styles.statusBadgesRow}>
                        <View style={styles.assignedBadge}>
                            <Ionicons name="checkmark-circle" size={20} color="#2ECC71" />
                            <Text style={styles.assignedText}>Asociată unei rute</Text>
                        </View>
                        <View style={[styles.taskStatusBadge, { backgroundColor: getTaskStatusInfo().color + '33' }]}>
                            <Ionicons name={getTaskStatusInfo().icon} size={20} color={getTaskStatusInfo().color} />
                            <Text style={[styles.taskStatusText, { color: getTaskStatusInfo().color }]}>{getTaskStatusInfo().label}</Text>
                        </View>
                    </View>
                )}

                {/* OPEN MODAL BUTTON */}
                <Pressable
                    style={({ pressed }) => [
                        styles.actionButton,
                        orderTaskStatus.hasTask && styles.disabledActionButton,
                        pressed && !orderTaskStatus.hasTask && styles.buttonPressed
                    ]}
                    onPress={() => !orderTaskStatus.hasTask && setModalVisible(true)}
                    disabled={orderTaskStatus.hasTask}
                >
                    <Text style={styles.actionButtonText}>
                        {orderTaskStatus.hasTask ? 'Deja atribuită' : 'Asociază cu o rută'}
                    </Text>
                </Pressable>

                {/* REASSIGN BUTTON - Only visible when order has task */}
                {orderTaskStatus.hasTask && (
                    <Pressable
                        style={({ pressed }) => [
                            styles.reassignButton,
                            pressed && styles.buttonPressed
                        ]}
                        onPress={handleReassign}
                    >
                        <Ionicons name="refresh" size={20} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.reassignButtonText}>Reasignează la altă rută</Text>
                    </Pressable>
                )}

            </ScrollView>

            {/* ================= ASSIGNMENT MODAL ================= */}
            <RouteAssignmentModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                routes={routes}
                selectedRoute={selectedRoute}
                onSelectRoute={handleSelectRoute}
                onFinalize={handleFinalize}
                assigning={assigning}
            />

        </View>
    )
}

export default OrderDetails

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: AppColors.screenBackground },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 50, alignItems: 'center' },

    actionButton: { backgroundColor: AppColors.buttonBackground, width: '100%', height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: AppColors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4 },
    disabledActionButton: { backgroundColor: '#6B8A9A' },
    buttonPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
    actionButtonText: { color: AppColors.textWhite, fontSize: 20, fontWeight: 'bold' },

    // Status Badges Row
    statusBadgesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 15,
        justifyContent: 'center',
    },
    assignedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(46, 204, 113, 0.2)',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
    },
    assignedText: {
        color: AppColors.successGreen,
        fontSize: 14,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    taskStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
    },
    taskStatusText: {
        fontSize: 14,
        fontWeight: 'bold',
        marginLeft: 8,
    },

    // Reassign Button
    reassignButton: {
        width: '100%',
        height: 50,
        backgroundColor: '#E67E22',
        borderRadius: 15,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 15,
        elevation: 3,
    },
    reassignButtonText: {
        color: AppColors.textWhite,
        fontWeight: 'bold',
        fontSize: 16,
    },
})
