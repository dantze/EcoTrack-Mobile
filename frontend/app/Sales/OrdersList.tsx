import React, { useEffect, useState, useCallback } from 'react';
import {
    Text,
    View,
    FlatList,
    Alert,
    ActivityIndicator,
    RefreshControl,
    StyleSheet,
    TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { OrderService } from '../../services/OrderService';
import { TaskService } from '../../services/TaskService';
import { AppColors } from '../../constants/Colors';
import { getOrderTypeLabel, formatDate } from '../../utils/orderUtils';
import ScreenHeader from '../../components/layout/ScreenHeader';
import { ListCard, TypeBadge, OrderStatusBadge, InfoRow, EmptyState, listStyles } from '../../components/list/ListComponents';
import OrderFilterModal, { OrderFilters, EMPTY_FILTERS, hasActiveFilters } from '../../modals/OrderFilterModal';

interface OrderItem {
    id: number;
    number: number;
    date: string;
    orderType: string;
    quantity?: number;
    locationAddress?: string;
    pickupLocationAddress?: string;
    sanitationLocationAddress?: string;
    details?: string;
    startDate?: string;
    endDate?: string;
    pickupDate?: string;
    sanitationDate?: string;
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
    const [filteredOrders, setFilteredOrders] = useState<OrderItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filterVisible, setFilterVisible] = useState(false);
    const [filters, setFilters] = useState<OrderFilters>(EMPTY_FILTERS);
    const [orderStatuses, setOrderStatuses] = useState<Record<number, string>>({});

    const fetchOrders = useCallback(async () => {
        try {
            const data = await OrderService.getOrders();
            setOrders(data);
            setFilteredOrders(data);
            // Fetch task statuses for all orders in parallel
            fetchOrderStatuses(data);
        } catch (error) {
            console.error('Error fetching orders:', error);
            Alert.alert('Eroare', 'Nu s-au putut prelua comenzile.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const fetchOrderStatuses = async (orderList: OrderItem[]) => {
        try {
            const statusMap: Record<number, string> = {};
            const results = await Promise.allSettled(
                orderList.map(async (order) => {
                    const taskStatus = await TaskService.checkOrderHasTask(order.id);
                    return { id: order.id, taskStatus };
                })
            );
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    const { id, taskStatus } = result.value;
                    if (taskStatus.hasTask && (taskStatus as any).status) {
                        statusMap[id] = (taskStatus as any).status;
                    } else {
                        statusMap[id] = 'NO_TASK';
                    }
                }
            }
            setOrderStatuses(statusMap);
        } catch (error) {
            console.error('Error fetching order statuses:', error);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    // ── Apply advanced filters on top of search ──────────────────────────────
    const applyFilters = (source: OrderItem[], f: OrderFilters): OrderItem[] => {
        let result = source;

        // City filter – match against locationAddress (or pickup/sanitation address)
        if (f.city) {
            const lc = f.city.toLowerCase();
            result = result.filter((o) => {
                const addr = (o.locationAddress || o.pickupLocationAddress || o.sanitationLocationAddress || '').toLowerCase();
                return addr.includes(lc);
            });
        }

        // Order type
        if (f.orderType) {
            result = result.filter((o) => o.orderType === f.orderType);
        }

        // Product name
        if (f.productName) {
            result = result.filter((o) => o.product?.name === f.productName);
        }

        // Date – check if the given date falls within [startDate, endDate] or matches the single date
        if (f.date && f.date.length === 10) {
            const parts = f.date.split('/');
            if (parts.length === 3) {
                const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                const filterTime = new Date(isoDate).getTime();
                if (!isNaN(filterTime)) {
                    result = result.filter((o) => {
                        const start = o.startDate || o.pickupDate || o.sanitationDate;
                        if (!start) return false;
                        const startTime = new Date(start).getTime();
                        const end = o.endDate;
                        if (end) {
                            const endTime = new Date(end).getTime();
                            return filterTime >= startTime && filterTime <= endTime;
                        }
                        // Single date – match same day
                        const sameDay = new Date(start).toISOString().slice(0, 10) === isoDate;
                        return sameDay;
                    });
                }
            }
        }

        return result;
    };

    // Recompute displayed list whenever search or filters change
    useEffect(() => {
        let base = orders;
        if (searchQuery) {
            const lq = searchQuery.toLowerCase();
            base = base.filter((o) => {
                const cn = getClientName(o).toLowerCase();
                const on = (o.number || o.id).toString();
                return cn.includes(lq) || on.includes(lq);
            });
        }
        setFilteredOrders(applyFilters(base, filters));
    }, [searchQuery, orders, filters]);

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
                            setFilteredOrders((prev) => prev.filter((o) => o.id !== order.id));
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

    const formatOrderDate = (order: OrderItem): string => {
        const start = order.startDate || order.pickupDate || order.sanitationDate;
        const end = order.endDate;
        if (!start) return 'N/A';
        const startFormatted = formatDate(start);
        if (end && end !== start) {
            const endFormatted = formatDate(end);
            return `${startFormatted} - ${endFormatted}`;
        }
        return startFormatted;
    };

    const getOrderStatusInfo = (orderId: number): { label: string; color: string } => {
        const status = orderStatuses[orderId];
        if (status === 'COMPLETED') return { label: 'Finalizat', color: '#2ECC71' };
        if (status === 'CANCELLED') return { label: 'Anulat', color: '#95A5A6' };
        if (status === 'IN_PROGRESS') return { label: 'În progres', color: '#F1C40F' };
        if (status === 'NEW') return { label: 'Nefinalizat', color: '#E74C3C' };
        // NO_TASK or not yet loaded
        return { label: 'Nefinalizat', color: '#E74C3C' };
    };

    const renderOrder = ({ item }: { item: OrderItem }) => {
        const statusInfo = getOrderStatusInfo(item.id);
        return (
            <ListCard
                onPress={() => handleEditOrder(item)}
                onDelete={() => handleDeleteOrder(item)}
            >
                <View style={listStyles.cardHeader}>
                    <Text style={listStyles.cardTitle}>Comanda #{ item.number || item.id}</Text>
                    <TypeBadge label={getOrderTypeLabel(item.orderType)} />
                    <OrderStatusBadge label={statusInfo.label} color={statusInfo.color} />
                </View>

                <InfoRow icon="user" text={getClientName(item)} />
                {item.product?.name ? <InfoRow icon="box" text={item.product.name} /> : null}
                {item.quantity ? <InfoRow icon="hash" text={`Cantitate: ${item.quantity}`} /> : null}
                <InfoRow icon="calendar" text={formatOrderDate(item)} />
                {item.locationAddress ? <InfoRow icon="map-pin" text={item.locationAddress} numberOfLines={1} /> : null}
            </ListCard>
        );
    };

    if (loading) {
        return (
            <View style={listStyles.centered}>
                <ActivityIndicator size="large" color="#427992" />
            </View>
        );
    }

    const productNames = [...new Set(orders.map((o) => o.product?.name).filter(Boolean) as string[])];

    return (
        <View style={styles.container}>
            <ScreenHeader
                title="Lista Comenzi"
                onRefresh={fetchOrders}
                onFilter={() => setFilterVisible(true)}
                filterActive={hasActiveFilters(filters)}
            />

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Caută comandă (Client, Număr)"
                    placeholderTextColor="#999"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {filteredOrders.length === 0 ? (
                <EmptyState icon="inbox" message={searchQuery ? "Nu s-au găsit comenzi." : "Nu există comenzi."} />
            ) : (
                <FlatList
                    data={filteredOrders}
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

            <OrderFilterModal
                visible={filterVisible}
                onClose={() => setFilterVisible(false)}
                filters={filters}
                onApply={setFilters}
                productNames={productNames}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AppColors.screenBackground,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        marginHorizontal: 20,
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 45,
        marginBottom: 10,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        height: '100%',
        color: '#16283C',
        fontSize: 16,
    },
});
