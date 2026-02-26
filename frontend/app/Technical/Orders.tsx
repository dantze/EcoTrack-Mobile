import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../constants/Colors';
import { OrderService } from '../../services/OrderService';
import { TaskService } from '../../services/TaskService';
import { Order, OrderTaskMap } from '../../types/OrderTypes';
import { getClientName } from '../../utils/orderUtils';
import ScreenHeader from '../../components/ScreenHeader';
import OrderCard from '../../components/OrderCard';

const Orders = () => {
    const router = useRouter();

    const [orders, setOrders] = useState<Order[]>([]);
    const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [orderTaskStatus, setOrderTaskStatus] = useState<OrderTaskMap>({});

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
        await Promise.all(
            orders.map(async (order) => {
                try {
                    const status = await TaskService.checkOrderHasTask(order.id);
                    statusMap[order.id] = status.hasTask;
                } catch {
                    statusMap[order.id] = false;
                }
            })
        );
        setOrderTaskStatus(statusMap);
    };

    useEffect(() => {
        if (!searchQuery) {
            setFilteredOrders(orders);
            return;
        }
        const lowerQuery = searchQuery.toLowerCase();
        const filtered = orders.filter(order => {
            const clientNameStr = getClientName(order).toLowerCase();
            const orderNumber = (order.number || order.id).toString();
            return clientNameStr.includes(lowerQuery) || orderNumber.includes(lowerQuery);
        });
        setFilteredOrders(filtered);
    }, [searchQuery, orders]);

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

    return (
        <View style={styles.container}>
            <ScreenHeader title="Comenzi" onRefresh={fetchOrders} />

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Caută comandă (Client, Număr...)"
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
                            onPress={handleCardPress}
                        />
                    ))
                )}

                <View style={{ height: 20 }} />
            </ScrollView>
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