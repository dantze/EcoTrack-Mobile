import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import React, { useEffect, useState } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
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
    const { zona, county } = useLocalSearchParams<{ zona?: string; county?: string }>();
    const zonaLabel = zona ?? 'Center';
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
    const formatDate = (dateString: string) => {
        if (!dateString) return { month: 'N/A', day: '--' };

        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return { month: 'N/A', day: '--' };

            const months = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return {
                month: months[date.getMonth()],
                day: date.getDate().toString()
            };
        } catch {
            return { month: 'N/A', day: '--' };
        }
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
                county: county
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
                <Text style={styles.headerText}>{`Comenzi - ${zonaLabel}`}</Text>
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
                        const { month, day } = formatDate(order.startDate);
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

                                <View style={styles.dateBadge}>
                                    <Text style={styles.dateMonth}>{month}</Text>
                                    <Text style={styles.dateDay}>{day}</Text>
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