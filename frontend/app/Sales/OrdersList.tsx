import React, { useEffect, useState, useCallback } from 'react';
import {
    Text,
    View,
    FlatList,
    Alert,
    ActivityIndicator,
    RefreshControl,
    StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { OrderService } from '../../services/OrderService';
import { AppColors } from '../../constants/Colors';
import { getOrderTypeLabel, formatDate } from '../../utils/orderUtils';
import ScreenHeader from '../../components/ScreenHeader';
import { ListCard, TypeBadge, InfoRow, EmptyState } from '../../components/ListComponents';
import listStyles from '../../components/listStyles';

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
        <View style={styles.container}>
            <ScreenHeader title="Lista Comenzi" />

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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AppColors.screenBackground,
    },
});
