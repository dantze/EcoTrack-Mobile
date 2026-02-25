import React, { useEffect, useState, useCallback } from 'react';
import {
    Text,
    View,
    FlatList,
    Alert,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { OrderService } from '../../services/OrderService';
<<<<<<< refactor
import { AppColors } from '../../constants/Colors';
import { getOrderTypeLabel, formatDate } from '../../utils/orderUtils';
import ScreenHeader from '../../components/ScreenHeader';
=======
import listStyles from '../../components/listStyles';
import {
    ScreenHeader, EmptyState, ListCard, InfoRow, TypeBadge,
} from '../../components/ListComponents';
>>>>>>> main

interface OrderItem {
    id: number;
    number: number;
    date: string;
    orderType: string;
    quantity?: number;
    locationAddress?: string;
    details?: string;
    client?: {
        id: number;
        type: string;
        fullName?: string;
        name?: string;
        email?: string;
        phone?: string;
    };
    product?: {
        id: number;
        name: string;
    };
}

export default function OrdersList() {
    const router = useRouter();
    const [orders, setOrders] = useState<OrderItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchOrders = useCallback(async () => {
        try {
            const data = await OrderService.getOrders();
            setOrders(data);
        } catch (error) {
            console.error('Error fetching orders:', error);
            Alert.alert('Eroare', 'Nu s-au putut prelua comenzile.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchOrders();
    };

    const handleDeleteOrder = (order: OrderItem) => {
        Alert.alert(
            'Confirmare ștergere',
            `Sigur doriți să ștergeți comanda #${order.number || order.id}?`,
            [
                { text: 'Anulează', style: 'cancel' },
                {
                    text: 'Șterge',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await OrderService.deleteOrder(order.id);
                            setOrders((prev) => prev.filter((o) => o.id !== order.id));
                            Alert.alert('Succes', 'Comanda a fost ștearsă.');
                        } catch (error) {
                            console.error('Error deleting order:', error);
                            Alert.alert('Eroare', 'Nu s-a putut șterge comanda.');
                        }
                    },
                },
            ]
        );
    };

    const handleEditOrder = (order: OrderItem) => {
        router.push({
            pathname: '/Sales/EditOrder',
            params: { order: JSON.stringify(order) },
        });
    };

    const getClientName = (order: OrderItem): string => {
        if (!order.client) return 'Client necunoscut';
        if (order.client.type === 'individual' && order.client.fullName) return order.client.fullName;
        if (order.client.type === 'company' && order.client.name) return order.client.name;
        return `Client #${order.client.id}`;
    };

<<<<<<< refactor
    const getOrderDateDisplay = (order: OrderItem): string => {
        const start = order.startDate ? formatDate(order.startDate) : null;
        const end = order.endDate ? formatDate(order.endDate) : null;

        if (start && end) {
            return start === end ? start : `${start} - ${end}`;
        }
        if (start) return start;
        if (end) return end;
        if (order.date) return formatDate(order.date);
        return 'N/A';
=======
    const getOrderTypeLabel = (type: string): string => {
        const labels: Record<string, string> = {
            amplasari: 'Amplasare',
            igienizari: 'Igienizare',
            ridicari: 'Ridicare',
        };
        return labels[type?.toLowerCase()] || type || 'N/A';
    };

    const formatDate = (dateStr: string): string => {
        if (!dateStr) return 'N/A';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('ro-RO', {
                day: '2-digit', month: '2-digit', year: 'numeric',
            });
        } catch {
            return dateStr;
        }
>>>>>>> main
    };

    const renderOrder = ({ item }: { item: OrderItem }) => (
        <ListCard
            onPress={() => handleEditOrder(item)}
            onDelete={() => handleDeleteOrder(item)}
        >
            <View style={listStyles.cardHeader}>
                <Text style={listStyles.cardTitle}>Comanda #{item.number || item.id}</Text>
                <TypeBadge label={getOrderTypeLabel(item.orderType)} />
            </View>

            <InfoRow icon="user" text={getClientName(item)} />
            {item.product?.name ? <InfoRow icon="box" text={item.product.name} /> : null}
            {item.quantity ? <InfoRow icon="hash" text={`Cantitate: ${item.quantity}`} /> : null}
            <InfoRow icon="calendar" text={formatDate(item.date)} />
            {item.locationAddress ? <InfoRow icon="map-pin" text={item.locationAddress} numberOfLines={1} /> : null}
        </ListCard>
    );

    if (loading) {
        return (
            <View style={listStyles.centered}>
                <ActivityIndicator size="large" color="#427992" />
            </View>
        );
    }

    return (
<<<<<<< refactor
        <View style={styles.container}>
            <ScreenHeader title="Lista Comenzi" />
=======
        <View style={listStyles.container}>
            <ScreenHeader title="Lista Comenzi" onBack={() => router.back()} />
>>>>>>> main

            {orders.length === 0 ? (
                <EmptyState icon="inbox" message="Nu există comenzi." />
            ) : (
                <FlatList
                    data={orders}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderOrder}
                    contentContainerStyle={listStyles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#427992"
                            colors={['#427992']}
                        />
                    }
                />
            )}
        </View>
    );
}

<<<<<<< refactor
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AppColors.screenBackground,
    },
    centered: {
        flex: 1,
        backgroundColor: AppColors.screenBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 30,
    },
    card: {
        backgroundColor: '#1E3A50',
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardContent: {
        flex: 1,
    },
    cardPressed: {
        opacity: 0.7,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        flexWrap: 'wrap',
        gap: 8,
    },
    orderNumber: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
    },
    typeBadge: {
        backgroundColor: '#427992',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 3,
    },
    typeBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '500',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
    },
    infoText: {
        color: '#B0C4D4',
        fontSize: 14,
    },
    deleteButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 107, 107, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },
    deleteButtonPressed: {
        opacity: 0.6,
    },
    editHint: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 4,
    },
    editHintText: {
        color: '#5A8DAB',
        fontSize: 12,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    emptyText: {
        color: '#8BA8BE',
        fontSize: 18,
    },
});
=======
>>>>>>> main
