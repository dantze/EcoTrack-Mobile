import { StyleSheet, Text, View, Pressable, ScrollView, Image, Modal, Alert, ActivityIndicator, Platform } from 'react-native'
import React, { useState, useEffect } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { OrderService } from '../../services/OrderService';
import { RouteService, Route } from '../../services/RouteService';
import { TaskService } from '../../services/TaskService';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

type DetailRowProps = {
    label: string;
    value: string;
    isMultiline?: boolean;
};

const OrderDetails = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const orderId = params.id ? Number(params.id) : null;

    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [routes, setRoutes] = useState<Route[]>([]);
    const [orderTaskStatus, setOrderTaskStatus] = useState<{ hasTask: boolean; taskId: number | null; routeId: number | null; scheduledTime?: string | null }>({ hasTask: false, taskId: null, routeId: null });

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
            setOrderTaskStatus({ hasTask: status.hasTask, taskId: status.taskId, routeId: status.routeId, scheduledTime: status.scheduledTime });
        } catch (error) {
            console.error("Failed to check task status", error);
        }
    };



    // Route selection function
    const handleSelectRoute = (route: Route) => {
        setSelectedRoute(route);
    };

    // Get day of week name
    const getDayOfWeekName = (dayOfWeek?: number) => {
        const daysRo: { [key: number]: string } = {
            1: 'Luni',
            2: 'Marți',
            3: 'Miercuri',
            4: 'Joi',
            5: 'Vineri',
            6: 'Sâmbătă',
            7: 'Duminică'
        };
        return dayOfWeek ? daysRo[dayOfWeek] || null : null;
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
    const handleDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
        if (selectedDate) {
            setPickerDate(selectedDate);
        }
    };

    // Toggle picker: open it or save & close it
    const handleDateButtonPress = async () => {
        if (showDatePicker) {
            // Picker is open → save and close
            if (orderTaskStatus.taskId) {
                try {
                    setSavingDate(true);
                    const dateStr = pickerDate.toISOString().split('T')[0];
                    await TaskService.updateScheduledDate(orderTaskStatus.taskId, dateStr);
                    setOrderTaskStatus(prev => ({ ...prev, scheduledTime: pickerDate.toISOString() }));
                    Alert.alert("Succes", `Data programată a fost setată: ${pickerDate.toLocaleDateString('ro-RO')}`);
                } catch (error: any) {
                    Alert.alert("Eroare", error.message || "Nu s-a putut seta data programată.");
                } finally {
                    setSavingDate(false);
                }
            }
            setShowDatePicker(false);
        } else {
            // Picker is closed → open it, initialize with existing date or today
            setPickerDate(orderTaskStatus.scheduledTime ? new Date(orderTaskStatus.scheduledTime) : new Date());
            setShowDatePicker(true);
        }
    };

    const getScheduledDateDisplay = () => {
        if (orderTaskStatus.scheduledTime) {
            return new Date(orderTaskStatus.scheduledTime).toLocaleDateString('ro-RO', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
        return null;
    };

    // Component for detail rows
    const DetailRow = ({ label, value, isMultiline = false }: DetailRowProps) => (
        <View style={styles.rowContainer}>
            <Text style={styles.label}>{label}</Text>
            <Text style={[styles.value, isMultiline && styles.multilineValue]}>
                {value || 'N/A'}
            </Text>
        </View>
    );

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
        );
    }

    if (!order) return null;

    // Updated here: use 'name' instead of 'companyName', with email fallback
    const clientName = order.client?.type === 'company'
        ? (order.client?.name || order.client?.email || 'N/A')
        : (order.client?.fullName || order.client?.email || 'N/A');
    const clientAddress = order.locationAddress || order.locationCoordinates || order.client?.address;

    const renderDateRow = () => {
        if (!order || !order.startDate) return null;
        try {
            const start = new Date(order.startDate);
            if (isNaN(start.getTime())) return null;

            const formatDate = (d: Date) => d.toLocaleDateString('ro-RO');
            const startStr = formatDate(start);

            if (order.endDate) {
                const end = new Date(order.endDate);
                if (!isNaN(end.getTime()) && start.getTime() !== end.getTime()) {
                    return <DetailRow label="Perioadă" value={`${startStr} - ${formatDate(end)}`} />;
                }
            }
            return <DetailRow label="Data Comenzii" value={startStr} />;
        } catch (e) {
            return null;
        }
    };

    return (
        <View style={styles.container}>

            <View style={styles.headerContainer}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </Pressable>
                <Text style={styles.headerText}>Detalii Comandă</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                <View style={styles.detailsCard}>
                    <DetailRow label="Nume Client" value={clientName} />
                    <DetailRow label="Tip Client" value={order.client?.type === 'company' ? 'Firmă' : 'Persoană Fizică'} />
                    {order.client?.cui && <DetailRow label="CUI" value={order.client.cui} />}
                    <DetailRow label="Adresă" value={clientAddress} isMultiline />

                    <View style={{ height: 10 }} />
                    <DetailRow label="Produs" value={order.product?.name} />
                    <DetailRow label="Cantitate" value={order.quantity?.toString()} />
                    <DetailRow label="Tip" value={order.orderType} />

                    {renderDateRow()}
                    <DetailRow label="Durată" value={order.durationDays ? `${order.durationDays} zile` : (order.isIndefinite ? 'Nedefinit' : 'N/A')} />

                    <View style={{ height: 10 }} />
                    <DetailRow label="Contact" value={order.contact} />
                    <DetailRow label="Detalii" value={order.details} isMultiline />
                </View>

                {/* --- SCHEDULED DATE SECTION --- */}
                {orderTaskStatus.hasTask && (
                    <View style={styles.scheduleDateSection}>
                        <View style={styles.scheduleDateHeader}>
                            <Ionicons name="calendar-outline" size={20} color="#E0E0E0" />
                            <Text style={styles.scheduleDateTitle}>Dată Programată</Text>
                        </View>

                        {getScheduledDateDisplay() ? (
                            <View style={styles.scheduleDateDisplay}>
                                <Ionicons name="checkmark-circle" size={18} color="#2ECC71" />
                                <Text style={styles.scheduleDateText}>{getScheduledDateDisplay()}</Text>
                            </View>
                        ) : (
                            <View style={styles.noDateNotice}>
                                <Ionicons name="alert-circle-outline" size={18} color="#F39C12" />
                                <Text style={styles.noDateText}>Nicio dată programată încă</Text>
                            </View>
                        )}

                        {showDatePicker && (
                            <DateTimePicker
                                value={pickerDate}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={handleDateChange}
                                minimumDate={new Date()}
                            />
                        )}

                        <Pressable
                            style={({ pressed }) => [
                                showDatePicker ? styles.saveDateButton : styles.setDateButton,
                                savingDate && styles.disabledActionButton,
                                pressed && !savingDate && styles.buttonPressed
                            ]}
                            onPress={handleDateButtonPress}
                            disabled={savingDate}
                        >
                            {savingDate ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <>
                                    <Ionicons name={showDatePicker ? "checkmark-circle" : "calendar"} size={20} color="white" style={{ marginRight: 8 }} />
                                    <Text style={styles.setDateButtonText}>
                                        {showDatePicker ? 'Salvează Data' : (getScheduledDateDisplay() ? 'Schimbă Data' : 'Setează Data')}
                                    </Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                )}

                {/* STATUS BADGE - shows if already assigned */}
                {orderTaskStatus.hasTask && (
                    <View style={styles.assignedBadge}>
                        <Ionicons name="checkmark-circle" size={20} color="#2ECC71" />
                        <Text style={styles.assignedText}>Asociată unei rute</Text>
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
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>

                        {/* --- HEADER: Title + Close --- */}
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Selectează Ruta</Text>
                            <Pressable onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#16283C" />
                            </Pressable>
                        </View>

                        {/* --- FINALIZE BUTTON (Top Center) --- */}
                        <Pressable
                            style={[
                                styles.finalizeButton,
                                (!selectedRoute || assigning) && styles.disabledButton
                            ]}
                            onPress={handleFinalize}
                            disabled={!selectedRoute || assigning}
                        >
                            {assigning ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <>
                                    <Text style={styles.finalizeText}>Finalizează Atribuirea</Text>
                                    <MaterialCommunityIcons name="truck-delivery" size={20} color="white" style={{ marginLeft: 8 }} />
                                </>
                            )}
                        </Pressable>

                        {/* --- SCROLLABLE ROUTES LIST --- */}
                        <ScrollView style={styles.routesScrollView} contentContainerStyle={styles.routesScrollContent}>
                            {routes.length > 0 ? (
                                routes.map((route) => (
                                    <Pressable
                                        key={route.id}
                                        style={[
                                            styles.routeCard,
                                            selectedRoute?.id === route.id && styles.activeRouteCard
                                        ]}
                                        onPress={() => handleSelectRoute(route)}
                                    >
                                        <View style={styles.routeCardContent}>
                                            <Text style={[
                                                styles.routeCardDriver,
                                                selectedRoute?.id === route.id && styles.activeRouteText
                                            ]}>
                                                {route.employeeName || 'Șofer neasignat'}
                                            </Text>
                                            <Text style={[
                                                styles.routeCardDate,
                                                selectedRoute?.id === route.id && styles.activeRouteSubtext
                                            ]}>
                                                {route.name || `Ruta #${route.id}`}{getDayOfWeekName(route.dayOfWeek) ? ` • ${getDayOfWeekName(route.dayOfWeek)}` : ''}
                                            </Text>
                                            <Text style={[
                                                styles.routeCardTasks,
                                                selectedRoute?.id === route.id && styles.activeRouteSubtext
                                            ]}>
                                                {route.tasks?.length || 0} sarcini
                                            </Text>
                                        </View>
                                        {selectedRoute?.id === route.id && (
                                            <Ionicons name="checkmark-circle" size={24} color="white" />
                                        )}
                                    </Pressable>
                                ))
                            ) : (
                                <View style={styles.emptyRoutes}>
                                    <Ionicons name="alert-circle-outline" size={40} color="#999" />
                                    <Text style={styles.emptyRoutesText}>Nu există rute disponibile</Text>
                                </View>
                            )}
                        </ScrollView>

                    </View>
                </View>
            </Modal>

        </View>
    )
}

export default OrderDetails

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#16283C' },
    headerContainer: { marginTop: 60, paddingHorizontal: 20, width: '100%', marginBottom: 20, flexDirection: 'row', alignItems: 'center' },
    backButton: { marginRight: 15 },
    headerText: { color: '#FFFFFF', fontSize: 28, fontWeight: 'bold' },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 50, alignItems: 'center' },
    detailsCard: { backgroundColor: '#5D8AA8', borderRadius: 20, padding: 20, width: '100%', marginBottom: 30 },
    rowContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    label: { color: '#E0E0E0', fontSize: 14, flex: 1, fontWeight: '600' },
    value: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', flex: 1, textAlign: 'right' },
    multilineValue: { flex: 1.5 },

    actionButton: { backgroundColor: '#427992', width: '100%', height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4 },
    disabledActionButton: { backgroundColor: '#6B8A9A' },
    buttonPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
    actionButtonText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },

    // Assigned Badge
    assignedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(46, 204, 113, 0.2)',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        marginBottom: 15,
    },
    assignedText: {
        color: '#2ECC71',
        fontSize: 14,
        fontWeight: 'bold',
        marginLeft: 8,
    },

    mapLinkContainer: { marginTop: 20, alignSelf: 'flex-end' },
    mapLinkText: { color: '#5D8AA8', fontSize: 16, fontWeight: 'bold' },

    // --- MODAL STYLES ---
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(22, 40, 60, 0.8)', // Dark semi-transparent background
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '90%',
        backgroundColor: 'white',
        borderRadius: 30,
        padding: 20,
        alignItems: 'center',
        elevation: 10,
    },

    // Modal Header
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#16283C',
    },

    // Finalize Button
    finalizeButton: {
        width: '100%',
        height: 50,
        backgroundColor: '#5D8AA8',
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        marginBottom: 20,
    },
    disabledButton: {
        backgroundColor: '#BDC3C7', // Gray when disabled
    },
    finalizeText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },

    // Routes Scroll View
    routesScrollView: {
        maxHeight: 300,
        width: '100%',
    },
    routesScrollContent: {
        paddingBottom: 10,
    },
    routeCard: {
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        padding: 15,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    activeRouteCard: {
        backgroundColor: '#5D8AA8',
        borderColor: '#16283C',
    },
    routeCardContent: {
        flex: 1,
    },
    routeCardDriver: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#16283C',
        marginBottom: 4,
    },
    routeCardDate: {
        fontSize: 14,
        color: '#666',
        marginBottom: 2,
    },
    routeCardTasks: {
        fontSize: 12,
        color: '#888',
    },
    activeRouteText: {
        color: 'white',
    },
    activeRouteSubtext: {
        color: 'rgba(255,255,255,0.8)',
    },
    emptyRoutes: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    emptyRoutesText: {
        color: '#999',
        fontSize: 14,
        marginTop: 10,
    },

    closeModalButton: {
        marginTop: 10,
        padding: 10,
    },
    closeModalText: {
        color: '#999',
        fontWeight: 'bold',
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
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },

    // --- SCHEDULED DATE SECTION STYLES ---
    scheduleDateSection: {
        backgroundColor: '#5D8AA8',
        borderRadius: 20,
        padding: 20,
        width: '100%',
        marginTop: 20,
        marginBottom: 10,
    },
    scheduleDateHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    scheduleDateTitle: {
        color: '#E0E0E0',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    scheduleDateDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(46, 204, 113, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        marginBottom: 12,
    },
    scheduleDateText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: 'bold',
        marginLeft: 8,
        textTransform: 'capitalize',
    },
    noDateNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(243, 156, 18, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        marginBottom: 12,
    },
    noDateText: {
        color: '#F39C12',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
    },
    setDateButton: {
        backgroundColor: '#427992',
        height: 48,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3,
    },
    setDateButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 15,
    },
    saveDateButton: {
        backgroundColor: '#2ECC71',
        height: 48,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3,
        marginTop: 10,
    },
})
