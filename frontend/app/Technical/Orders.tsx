import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../constants/ApiConfig';
import { TaskService } from '../../services/TaskService';

type Order = {
    id: number;
    orderType: string;
    quantity: number;
    locationCoordinates: string;
    locationAddress: string;
    startDate: string;
    endDate: string;
    details: string;
    contact: string;
    durationDays: number;
    igienizariPerMonth: number;
    isIndefinite: boolean;
    product: {
        id: number;
        name: string;
        price: number;
        description: string;
    };
    client: {
        id: number;
        fullName?: string;
        address?: string;
        email?: string;
        phone?: string;
        type?: string;
        name?: string;
    };
};

// Track which orders have associated tasks
type OrderTaskMap = { [orderId: number]: boolean };

const Orders = () => {
    const router = useRouter();

    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [orderTaskStatus, setOrderTaskStatus] = useState<OrderTaskMap>({});

    useEffect(() => {
        fetchOrders();
    }, []);

    // Check task status for all orders after they're loaded
    useEffect(() => {
        if (orders.length > 0) {
            checkAllOrderTaskStatus();
        }
    }, [orders]);

    const fetchOrders = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/orders`);
            if (!response.ok) {
                throw new Error(`Failed to fetch orders. Status: ${response.status}`);
            }
            const data: Order[] = await response.json();
            console.log('Fetched orders:', data.length);
            setOrders(data);
        } catch (error) {
            console.error("Error fetching orders:", error);
        } finally {
            setLoading(false);
        }
    };

    // Check task status for all orders
    const checkAllOrderTaskStatus = async () => {
        const statusMap: OrderTaskMap = {};

        // Check each order in parallel
        await Promise.all(
            orders.map(async (order) => {
                try {
                    const status = await TaskService.checkOrderHasTask(order.id);
                    statusMap[order.id] = status.hasTask;
                } catch (error) {
                    statusMap[order.id] = false;
                }
            })
        );

        setOrderTaskStatus(statusMap);
    };

    // Format date from ISO string or any date format
    type DateInfo =
        | { isRange: true; start: { m: string; d: number }; end: { m: string; d: number } }
        | { isRange: false; m: string; d: string | number };

    // Date display logic
    const getDateInfo = (order: Order): DateInfo => {
        const months = ['IAN', 'FEB', 'MAR', 'APR', 'MAI', 'IUN', 'IUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const parse = (s?: string) => s ? new Date(s) : null;
        const isValid = (d: Date | null) => d && !isNaN(d.getTime());

        const d1 = parse(order.startDate);
        const d2 = parse(order.endDate);

        if (isValid(d1)) {
            const m1 = months[d1!.getMonth()];
            const day1 = d1!.getDate();

            if (isValid(d2) && d1!.getTime() !== d2!.getTime()) {
                const sameDay = d1!.getDate() === d2!.getDate() && d1!.getMonth() === d2!.getMonth() && d1!.getFullYear() === d2!.getFullYear();
                if (!sameDay) {
                    const m2 = months[d2!.getMonth()];
                    const day2 = d2!.getDate();
                    return { isRange: true, start: { m: m1, d: day1 }, end: { m: m2, d: day2 } };
                }
            }
            return { isRange: false, m: m1, d: day1 };
        }
        return { isRange: false, m: 'N/A', d: '--' };
    };

    // Get client display name
    const getClientName = (order: Order): string => {
        if (order.client) {
            // Check for fullName first (for individual clients)
            if (order.client.fullName) {
                return order.client.fullName;
            }
            // Check for name (for company clients)
            if (order.client.name) {
                return order.client.name;
            }
            // Fallback to email if name fields are missing
            if (order.client.email) {
                return order.client.email;
            }
        }
        return 'Client necunoscut';
    };

    // Get location display text
    const getLocationText = (order: Order): string => {
        const coord = order.locationCoordinates.split(",");
        return order.locationAddress ||
            coord[0].substring(0, 10) + ", " + coord[1].substring(0, 10) ||
            "Eroare în procesarea datelor, adresa clientului:" + order.client?.address ||
            'Locație nespecificată: Eroare majora, contactati developerii aplicatie';
    };

    // Get action text based on order type and quantity
    const getActionText = (order: Order): string => {
        const typeMap: { [key: string]: string } = {
            'Amplasari': 'Amplasare',
            'Ridicari': 'Ridicare',
            'Igienizari': 'Igienizare'
        };
        const actionName = typeMap[order.orderType] || order.orderType || 'Comandă';
        return `${actionName} (x${order.quantity || 1})`;
    };

    const handleCardPress = (order: Order) => {
        router.push({
            pathname: "/Technical/OrderDetails",
            params: {
                id: order.id,
                client: getClientName(order),
            }
        });
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.loadingContainer]}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.loadingText}>Se încarcă comenzile...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>

            <View style={styles.headerContainer}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </Pressable>
                <Text style={styles.headerText}>Comenzi</Text>
            </View>

            <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {orders.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="clipboard-outline" size={60} color="#5D8AA8" />
                        <Text style={styles.emptyText}>Nu există comenzi</Text>
                    </View>
                ) : (
                    orders.map((order) => {
                        const dateInfo = getDateInfo(order);
                        const hasTask = orderTaskStatus[order.id] || false;

                        return (
                            <Pressable
                                key={order.id}
                                style={({ pressed }) => [
                                    styles.card,
                                    pressed && styles.cardPressed
                                ]}
                                onPress={() => handleCardPress(order)}
                            >
                                <View style={styles.cardInfo}>
                                    <View style={styles.clientRow}>
                                        <Text style={styles.clientName}>{getClientName(order)}</Text>
                                        {/* {hasTask && (
                                            <View style={styles.assignedBadge}>
                                                <Ionicons name="checkmark-circle" size={14} color="#2ECC71" />
                                                <Text style={styles.assignedBadgeText}>Atribuită</Text>
                                            </View>
                                        )} */}
                                    </View>
                                    <Text style={styles.actionText}>{getActionText(order)}</Text>

                                    <View style={styles.addressContainer}>
                                        <Ionicons name="location-sharp" size={14} color="#16283C" style={{ marginRight: 4 }} />
                                        <Text style={styles.addressText} numberOfLines={1}>
                                            {getLocationText(order)}
                                        </Text>
                                    </View>

                                    {/* Status indicator */}
                                    <View style={[styles.statusIndicator, hasTask ? styles.statusAssigned : styles.statusPending]}>
                                        <Text style={styles.statusText}>
                                            {hasTask ? 'Rută atribuită' : 'Neatribuită'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={[styles.dateBadge, dateInfo.isRange && styles.dateBadgeRange]}>
                                    {dateInfo.isRange ? (
                                        <View style={styles.rangeContainer}>
                                            <View style={styles.dateColumn}>
                                                <Text style={styles.rangeMonth}>{dateInfo.start.m}</Text>
                                                <Text style={styles.rangeDay}>{dateInfo.start.d}</Text>
                                            </View>
                                            <Text style={styles.rangeSeparator}>-</Text>
                                            <View style={styles.dateColumn}>
                                                <Text style={styles.rangeMonth}>{dateInfo.end.m}</Text>
                                                <Text style={styles.rangeDay}>{dateInfo.end.d}</Text>
                                            </View>
                                        </View>
                                    ) : (
                                        <>
                                            <Text style={styles.dateMonth}>{dateInfo.m}</Text>
                                            <Text style={styles.dateDay}>{dateInfo.d}</Text>
                                        </>
                                    )}
                                </View>

                            </Pressable>
                        );
                    })
                )}

                <View style={{ height: 20 }} />
            </ScrollView>

        </View>
    )
}

export default Orders

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#16283C',
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#FFFFFF',
        marginTop: 10,
        fontSize: 16,
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
        textAlign: 'left',
    },
    scrollContainer: {
        flex: 1,
        paddingHorizontal: 20,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyText: {
        color: '#5D8AA8',
        fontSize: 18,
        marginTop: 15,
    },
    card: {
        backgroundColor: '#5D8AA8',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    cardPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }]
    },
    cardInfo: {
        flex: 1,
        paddingRight: 10,
    },
    clientRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: 4,
    },
    clientName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#000000',
        marginRight: 8,
    },
    assignedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(46, 204, 113, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    assignedBadgeText: {
        color: '#2ECC71',
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 3,
    },
    actionText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    addressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    addressText: {
        fontSize: 12,
        color: '#E0E0E0',
        flex: 1,
    },
    statusIndicator: {
        marginTop: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    statusAssigned: {
        backgroundColor: 'rgba(46, 204, 113, 0.3)',
    },
    statusPending: {
        backgroundColor: 'rgba(241, 196, 15, 0.3)',
    },
    statusText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    dateBadge: {
        backgroundColor: '#16283C',
        borderRadius: 12,
        width: 60,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateBadgeRange: {
        width: 100,
        paddingHorizontal: 5,
    },
    rangeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    dateColumn: {
        alignItems: 'center',
    },
    rangeMonth: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    rangeDay: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    rangeSeparator: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 12, // Push it down visually to align somewhat between rows? Or center? 
        // User asked for "17 - 20". So separator aligns with Days.
    },
    dateMonth: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    dateDay: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: 'bold',
    }
})