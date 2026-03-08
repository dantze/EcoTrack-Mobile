import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../constants/Colors';
import { OrderService } from '../../services/OrderService';
import { TaskService } from '../../services/TaskService';
import { Order, OrderTaskMap, isAmplasare, isRidicari, isIgienizari } from '../../types/OrderTypes';
import { getClientName } from '../../utils/orderUtils';
import ScreenHeader from '../../components/layout/ScreenHeader';
import OrderCard from '../../components/cards/OrderCard';
import OrderFilterModal, { OrderFilters, EMPTY_FILTERS, hasActiveFilters } from '../../modals/OrderFilterModal';

const Orders = () => {
    const router = useRouter();

    const [orders, setOrders] = useState<Order[]>([]);
    const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [orderTaskStatus, setOrderTaskStatus] = useState<OrderTaskMap>({});
    const [orderTaskStatusStr, setOrderTaskStatusStr] = useState<Record<number, string>>({});
    const [filterVisible, setFilterVisible] = useState(false);
    const [filters, setFilters] = useState<OrderFilters>(EMPTY_FILTERS);

    useEffect(() => {
        fetchOrders();
    }, []);

    useEffect(() => {
        if (orders.length > 0) {
            checkAllOrderTaskStatus();
        }
    }, [orders]);

    const fetchOrders = async () => {
        try {
            const data: Order[] = await OrderService.getOrders();
            console.log('Fetched orders:', data.length);
            setOrders(data);
            setFilteredOrders(data);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const checkAllOrderTaskStatus = async () => {
        const statusMap: OrderTaskMap = {};
        const statusStrMap: Record<number, string> = {};
        await Promise.all(
            orders.map(async (order) => {
                try {
                    const status = await TaskService.checkOrderHasTask(order.id);
                    statusMap[order.id] = status.hasTask;
                    if (status.hasTask && (status as any).status) {
                        statusStrMap[order.id] = (status as any).status;
                    }
                } catch {
                    statusMap[order.id] = false;
                }
            })
        );
        setOrderTaskStatus(statusMap);
        setOrderTaskStatusStr(statusStrMap);
    };

    // ── Advanced filters ────────────────────────────────────────
    const getOrderAddress = (order: Order): string => {
        if (isAmplasare(order)) return order.locationAddress || '';
        if (isRidicari(order)) return order.pickupLocationAddress || '';
        if (isIgienizari(order)) return order.sanitationLocationAddress || '';
        return '';
    };

    const getOrderStartDate = (order: Order): string | undefined => {
        if (isAmplasare(order)) return order.startDate;
        if (isRidicari(order)) return order.pickupDate;
        if (isIgienizari(order)) return order.sanitationDate;
        return undefined;
    };

    const getOrderEndDate = (order: Order): string | undefined => {
        if (isAmplasare(order)) return order.endDate;
        return undefined;
    };

    const getOrderProductName = (order: Order): string | undefined => {
        if (isAmplasare(order) || isRidicari(order)) return order.product?.name;
        return undefined;
    };

    const applyFilters = (source: Order[], f: OrderFilters): Order[] => {
        let result = source;

        if (f.city) {
            const lc = f.city.toLowerCase();
            result = result.filter((o) => getOrderAddress(o).toLowerCase().includes(lc));
        }

        if (f.orderType) {
            result = result.filter((o) => o.orderType === f.orderType);
        }

        if (f.productName) {
            result = result.filter((o) => getOrderProductName(o) === f.productName);
        }

        const parseDate = (d: string): number | null => {
            if (!d || d.length !== 10) return null;
            const parts = d.split('/');
            if (parts.length !== 3) return null;
            const t = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
            return isNaN(t) ? null : t;
        };

        const filterStart = parseDate(f.startDate);
        const filterEnd = parseDate(f.endDate);

        if (filterStart !== null || filterEnd !== null) {
            result = result.filter((o) => {
                const orderStart = getOrderStartDate(o);
                if (!orderStart) return false;
                const orderStartTime = new Date(orderStart).getTime();
                const orderEnd = getOrderEndDate(o);
                const orderEndTime = orderEnd ? new Date(orderEnd).getTime() : orderStartTime;

                if (filterStart !== null && filterEnd !== null) {
                    return orderEndTime >= filterStart && orderStartTime <= filterEnd;
                }
                if (filterStart !== null) {
                    return orderEndTime >= filterStart;
                }
                return orderStartTime <= filterEnd!;
            });
        }

        return result;
    };

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

    const handleCardPress = (order: Order) => {
        router.push({
            pathname: '/Technical/OrderDetails',
            params: {
                id: order.id,
                client: getClientName(order),
            },
        });
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.loadingContainer]}>
                <ActivityIndicator size="large" color={AppColors.textWhite} />
                <Text style={styles.loadingText}>Se încarcă comenzile...</Text>
            </View>
        );
    }

    const productNames = [...new Set(
        orders.map((o) => getOrderProductName(o)).filter(Boolean) as string[]
    )];

    return (
        <View style={styles.container}>
            <ScreenHeader
                title="Comenzi"
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

            <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {filteredOrders.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="clipboard-outline" size={60} color="#5D8AA8" />
                        <Text style={styles.emptyText}>{searchQuery ? 'Nu s-au găsit comenzi' : 'Nu există comenzi'}</Text>
                    </View>
                ) : (
                    filteredOrders.map((order) => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            hasTask={orderTaskStatus[order.id] || false}
                            taskStatus={orderTaskStatusStr[order.id]}
                            onPress={handleCardPress}
                        />
                    ))
                )}

                <View style={{ height: 20 }} />
            </ScrollView>

            <OrderFilterModal
                visible={filterVisible}
                onClose={() => setFilterVisible(false)}
                filters={filters}
                onApply={setFilters}
                productNames={productNames}
            />
        </View>
    );
};

export default Orders;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AppColors.screenBackground,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: AppColors.textWhite,
        marginTop: 10,
        fontSize: 16,
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