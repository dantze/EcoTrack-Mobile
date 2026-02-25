import React, { useEffect, useState, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    FlatList,
    Pressable,
    Alert,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AntDesign, Feather } from '@expo/vector-icons';
import { OrderService } from '../../services/OrderService';

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
        if (order.client.type === 'individual' && order.client.fullName) {
            return order.client.fullName;
        }
        if (order.client.type === 'company' && order.client.name) {
            return order.client.name;
        }
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
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    const renderOrder = ({ item }: { item: OrderItem }) => (
        <View style={styles.card}>
            <Pressable
                style={({ pressed }) => [
                    styles.cardContent,
                    pressed && styles.cardPressed,
                ]}
                onPress={() => handleEditOrder(item)}
            >
                <View style={styles.cardHeader}>
                    <Text style={styles.orderNumber}>
                        Comanda #{item.number || item.id}
                    </Text>
                    <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>
                            {getOrderTypeLabel(item.orderType)}
                        </Text>
                    </View>
                </View>

                <View style={styles.infoRow}>
                    <Feather name="user" size={14} color="#8BA8BE" />
                    <Text style={styles.infoText}>{getClientName(item)}</Text>
                </View>

                {item.product?.name ? (
                    <View style={styles.infoRow}>
                        <Feather name="box" size={14} color="#8BA8BE" />
                        <Text style={styles.infoText}>{item.product.name}</Text>
                    </View>
                ) : null}

                {item.quantity ? (
                    <View style={styles.infoRow}>
                        <Feather name="hash" size={14} color="#8BA8BE" />
                        <Text style={styles.infoText}>Cantitate: {item.quantity}</Text>
                    </View>
                ) : null}

                <View style={styles.infoRow}>
                    <Feather name="calendar" size={14} color="#8BA8BE" />
                    <Text style={styles.infoText}>{formatDate(item.date)}</Text>
                </View>

                {item.locationAddress ? (
                    <View style={styles.infoRow}>
                        <Feather name="map-pin" size={14} color="#8BA8BE" />
                        <Text style={styles.infoText} numberOfLines={1}>
                            {item.locationAddress}
                        </Text>
                    </View>
                ) : null}

                <View style={styles.editHint}>
                    <Feather name="edit-2" size={12} color="#5A8DAB" />
                    <Text style={styles.editHintText}>Apasă pentru editare</Text>
                </View>
            </Pressable>

            <Pressable
                style={({ pressed }) => [
                    styles.deleteButton,
                    pressed && styles.deleteButtonPressed,
                ]}
                onPress={() => handleDeleteOrder(item)}
            >
                <AntDesign name="delete" size={22} color="#FF6B6B" />
            </Pressable>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#427992" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.headerContainer}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <AntDesign name="arrow-left" size={24} color="#FFFFFF" />
                </Pressable>
                <Text style={styles.headerText}>Lista Comenzi</Text>
            </View>

            {orders.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Feather name="inbox" size={60} color="#8BA8BE" />
                    <Text style={styles.emptyText}>Nu există comenzi.</Text>
                </View>
            ) : (
                <FlatList
                    data={orders}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderOrder}
                    contentContainerStyle={styles.listContent}
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
        backgroundColor: '#16283C',
    },
    centered: {
        flex: 1,
        backgroundColor: '#16283C',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 60,
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    backButton: {
        marginRight: 15,
    },
    headerText: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: 'bold',
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
