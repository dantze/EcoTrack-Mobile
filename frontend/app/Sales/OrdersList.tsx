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
import listStyles from '../../components/listStyles';
import {
    ScreenHeader, EmptyState, ListCard, InfoRow, TypeBadge,
} from '../../components/ListComponents';

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
        <View style={listStyles.container}>
            <ScreenHeader title="Lista Comenzi" onBack={() => router.back()} />

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

