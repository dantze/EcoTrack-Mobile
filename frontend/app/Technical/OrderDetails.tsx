import { StyleSheet, Text, View, Pressable, ScrollView, Image, Modal, Animated, PanResponder, Alert, ActivityIndicator } from 'react-native'
import React, { useState, useRef, useEffect } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { OrderService } from '../../services/OrderService';
import { RouteService, Route } from '../../services/RouteService';
import { TaskService } from '../../services/TaskService';

type DetailRowProps = {
    label: string;
    value: string;
    isMultiline?: boolean;
};

const OrderDetails = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const orderId = params.id ? Number(params.id) : null;
    const county = params.county as string | undefined;

    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [routes, setRoutes] = useState<Route[]>([]);
    const [orderTaskStatus, setOrderTaskStatus] = useState<{ hasTask: boolean; routeId: number | null }>({ hasTask: false, routeId: null });

    // --- STATE FOR MODAL ---
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
    const [assigning, setAssigning] = useState(false);

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

            // If county is provided, try to filter by county first
            if (county) {
                data = await RouteService.getRoutesByCounty(county);
                // If no routes found for this county, fall back to all routes
                if (data.length === 0) {
                    console.log(`No routes found for county ${county}, showing all routes`);
                    data = await RouteService.getAllRoutes();
                }
            } else {
                data = await RouteService.getAllRoutes();
            }

            setRoutes(data);
        } catch (error) {
            console.error("Failed to fetch routes", error);
        }
    };

    const checkTaskStatus = async () => {
        try {
            const status = await TaskService.checkOrderHasTask(orderId!);
            setOrderTaskStatus({ hasTask: status.hasTask, routeId: status.routeId });
        } catch (error) {
            console.error("Failed to check task status", error);
        }
    };

    // --- DRAG & DROP LOGIC (ANIMATION) ---
    const pan = useRef(new Animated.ValueXY()).current;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderMove: Animated.event(
                [null, { dx: pan.x, dy: pan.y }],
                { useNativeDriver: false }
            ),
            onPanResponderRelease: () => {
                Animated.spring(pan, {
                    toValue: { x: 0, y: 0 },
                    useNativeDriver: false,
                }).start();
            },
        })
    ).current;

    // Route selection function
    const handleSelectRoute = (route: Route) => {
        setSelectedRoute(route);
    };

    // Format route date for display
    const formatRouteDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ro-RO', {
            day: 'numeric',
            month: 'short',
        });
    };

    // Finalize function - creates a Task and assigns it to the selected Route
    const handleFinalize = async () => {
        if (selectedRoute && orderId) {
            try {
                setAssigning(true);
                // Create task from order and assign to route
                await TaskService.createTaskFromOrder(orderId, selectedRoute.id);
                setModalVisible(false);
                setOrderTaskStatus({ hasTask: true, routeId: selectedRoute.id });
                Alert.alert(
                    "Succes!",
                    `Comanda a fost atribuită rutei din ${formatRouteDate(selectedRoute.date)} (${selectedRoute.employeeName || 'Șofer'})!`
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
    const clientAddress = order.client?.address || order.locationCoordinates;

    return (
        <View style={styles.container}>

            <View style={styles.headerContainer}>
                <Pressable onPress={() => router.back()} style={{ position: 'absolute', left: 20, top: 0 }}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </Pressable>
                <Text style={styles.headerText}>Detalii Comandă</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                <View style={styles.detailsCard}>
                    <DetailRow label="Nume Client" value={clientName} />
                    <DetailRow label="Tip Client" value={order.client?.type} />
                    {order.client?.cui && <DetailRow label="CUI" value={order.client.cui} />}
                    <DetailRow label="Adresă" value={clientAddress} isMultiline />

                    <View style={{ height: 10 }} />
                    <DetailRow label="Produs" value={order.product?.name} />
                    <DetailRow label="Cantitate" value={order.quantity?.toString()} />
                    <DetailRow label="Tip" value={order.orderType} />

                    <View style={{ height: 10 }} />
                    <DetailRow label="Dată Început" value={order.startDate} />
                    <DetailRow label="Dată Sfârșit" value={order.endDate} />
                    <DetailRow label="Durată" value={order.durationDays ? `${order.durationDays} zile` : (order.isIndefinite ? 'Nedefinit' : 'N/A')} />

                    <View style={{ height: 10 }} />
                    <DetailRow label="Contact" value={order.contact} />
                    <DetailRow label="Rută Asignată" value={order.routeDefinition?.name} />
                    <DetailRow label="Detalii" value={order.details} isMultiline />
                </View>

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

                <Pressable onPress={() => console.log("Navigate map")} style={styles.mapLinkContainer}>
                    <Text style={styles.mapLinkText}>Navighează pe hartă →</Text>
                </Pressable>

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

                        <View style={{ alignItems: 'flex-end', width: '100%', paddingRight: 10 }}>
                            <Ionicons name="information-circle" size={24} color="#16283C" />
                        </View>

                        {/* --- TOP SECTION (DRAGGABLE + BUTTON) --- */}
                        <View style={styles.modalTopSection}>

                            {/* Draggable Card */}
                            <Animated.View
                                style={[
                                    styles.draggableBox,
                                    { transform: [{ translateX: pan.x }, { translateY: pan.y }] },
                                    { zIndex: 999 }
                                ]}
                                {...panResponder.panHandlers}
                            >
                                <Text style={styles.draggableTitle} numberOfLines={1}>Comandă #{order.id}</Text>
                                <View style={styles.draggableIcons}>
                                    <Ionicons name="location-sharp" size={24} color="#16283C" />
                                    <View style={{ width: 10 }} />
                                    <Ionicons name="information-circle" size={24} color="#16283C" />
                                </View>
                            </Animated.View>

                            {/* Finalize Button */}
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
                                        <Text style={styles.finalizeText}>Finalizează</Text>
                                        <MaterialCommunityIcons name="truck-delivery" size={20} color="white" style={{ marginLeft: 5 }} />
                                    </>
                                )}
                            </Pressable>
                        </View>

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
                                                {formatRouteDate(route.date)}
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

                        <Pressable
                            style={styles.closeModalButton}
                            onPress={() => setModalVisible(false)}
                        >
                            <Text style={styles.closeModalText}>Închide</Text>
                        </Pressable>

                    </View>
                </View>
            </Modal>

        </View>
    )
}

export default OrderDetails

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#16283C' },
    headerContainer: { marginTop: 60, paddingHorizontal: 20, width: '100%', marginBottom: 20 },
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

    // Top Section (Draggable + Button)
    modalTopSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 30,
        marginTop: 10,
    },

    // Draggable Box
    draggableBox: {
        width: 140,
        height: 80,
        backgroundColor: '#5D8AA8', // Teal-blue
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
    },
    draggableTitle: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
        marginBottom: 5,
    },
    draggableIcons: {
        flexDirection: 'row',
    },

    // Finalize Button
    finalizeButton: {
        width: 140,
        height: 50,
        backgroundColor: '#5D8AA8',
        borderRadius: 10,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },
    disabledButton: {
        backgroundColor: '#BDC3C7', // Gray when disabled
    },
    finalizeText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
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
    }
})
