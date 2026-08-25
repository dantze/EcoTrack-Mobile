import React, { useEffect, useState, useCallback } from 'react';
import {
    Text,
    View,
    FlatList,
    Alert,
    ActivityIndicator,
    RefreshControl,
    TextInput,
    StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ClientService } from '../../services/ClientService';
import { OrderService } from '../../services/OrderService';
import {
    EmptyState, ListCard, InfoRow, TypeBadge,
} from '../../components/list/ListComponents';
import ScreenHeader from '../../components/layout/ScreenHeader';
import { Order, isAmplasare, isRidicari, isIgienizari } from '../../types/OrderTypes';

interface ClientItem {
    id: number;
    type: string;
    email: string;
    phone: string;
    address: string;
    fullName?: string;
    cnp?: string | null;
    name?: string;
    cui?: string;
    adminName?: string;
}

export default function ClientsList() {
    const router = useRouter();
    const [clients, setClients] = useState<ClientItem[]>([]);
    const [filteredClients, setFilteredClients] = useState<ClientItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [clientOrderSummary, setClientOrderSummary] = useState<Record<number, { orderTypes: string[]; items: string[] }>>({});

    const fetchClients = useCallback(async () => {
        try {
            const data = await ClientService.getClients();
            setClients(data);
            setFilteredClients(data);
            fetchOrderSummaries(data);
        } catch (error) {
            console.error('Error fetching clients:', error);
            Alert.alert('Eroare', 'Nu s-au putut prelua clienții.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const fetchOrderSummaries = async (_clientsList: ClientItem[]) => {
        try {
            const allOrders: Order[] = await OrderService.getOrders();
            const summaryMap: Record<number, { orderTypes: string[]; items: string[] }> = {};

            for (const order of allOrders) {
                const clientId = order.client?.id;
                if (!clientId) continue;

                if (!summaryMap[clientId]) {
                    summaryMap[clientId] = { orderTypes: [], items: [] };
                }

                const summary = summaryMap[clientId];

                // Track order type
                if (!summary.orderTypes.includes(order.orderType)) {
                    summary.orderTypes.push(order.orderType);
                }

                // Extract product/subscription name
                if (isAmplasare(order) && order.product?.name) {
                    const label = `${order.product.name}${order.quantity && order.quantity > 1 ? ' x' + order.quantity : ''}`;
                    if (!summary.items.includes(label)) summary.items.push(label);
                } else if (isRidicari(order)) {
                    const name = order.product?.name || order.pickupProductName;
                    if (name && !summary.items.includes(name)) summary.items.push(name);
                } else if (isIgienizari(order) && order.subscription?.name) {
                    const label = `${order.subscription.name}`;
                    if (!summary.items.includes(label)) summary.items.push(label);
                }
            }

            setClientOrderSummary(summaryMap);
        } catch (error) {
            console.error('Error fetching order summaries:', error);
        }
    };

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    useEffect(() => {
        if (!searchQuery) {
            setFilteredClients(clients);
            return;
        }
        const lowerQuery = searchQuery.toLowerCase();
        const filtered = clients.filter(client => {
            const nameMatch = client.fullName ? client.fullName.toLowerCase().includes(lowerQuery) : false;
            const companyNameMatch = client.name ? client.name.toLowerCase().includes(lowerQuery) : false;
            const emailMatch = client.email ? client.email.toLowerCase().includes(lowerQuery) : false;
            const phoneMatch = client.phone ? client.phone.includes(lowerQuery) : false;
            return nameMatch || companyNameMatch || emailMatch || phoneMatch;
        });
        setFilteredClients(filtered);
    }, [searchQuery, clients]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchClients();
    };

    const handleDeleteClient = (client: ClientItem) => {
        const displayName = client.fullName || client.name || `Client #${client.id}`;
        Alert.alert(
            'Confirmare ștergere',
            `Sigur doriți să ștergeți clientul "${displayName}"?`,
            [
                { text: 'Anulează', style: 'cancel' },
                {
                    text: 'Șterge',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const hasOrders = await ClientService.checkClientHasOrders(client.id);
                            if (hasOrders) {
                                Alert.alert(
                                    'Clientul are comenzi',
                                    'Acest client are comenzi în baza de date. Dorești să continui? Toate comenzile asociate vor fi șterse.',
                                    [
                                        { text: 'Nu', style: 'cancel' },
                                        {
                                            text: 'Da',
                                            style: 'destructive',
                                            onPress: async () => {
                                                try {
                                                    await ClientService.deleteClient(client.id, true);
                                                    setClients((prev) => {
                                                        const updated = prev.filter((c) => c.id !== client.id);
                                                        setFilteredClients(updated.filter(c => {
                                                            if (!searchQuery) return true;
                                                            const lq = searchQuery.toLowerCase();
                                                            return (c.fullName?.toLowerCase().includes(lq)) || (c.name?.toLowerCase().includes(lq)) || (c.email?.toLowerCase().includes(lq)) || (c.phone?.includes(lq));
                                                        }));
                                                        return updated;
                                                    });
                                                    Alert.alert('Succes', 'Clientul și comenzile asociate au fost șterse.');
                                                } catch (error) {
                                                    console.error('Error deleting client with orders:', error);
                                                    Alert.alert('Eroare', 'Nu s-a putut șterge clientul.');
                                                }
                                            },
                                        },
                                    ]
                                );
                            } else {
                                await ClientService.deleteClient(client.id);
                                setClients((prev) => prev.filter((c) => c.id !== client.id));
                                setFilteredClients((prev) => prev.filter((c) => c.id !== client.id));
                                Alert.alert('Succes', 'Clientul a fost șters.');
                            }
                        } catch (error) {
                            console.error('Error deleting client:', error);
                            Alert.alert('Eroare', 'Nu s-a putut șterge clientul.');
                        }
                    },
                },
            ]
        );
    };

    const handleEditClient = (client: ClientItem) => {
        router.push({
            pathname: '/Sales/EditClient',
            params: { client: JSON.stringify(client) },
        });
    };

    const getClientDisplayName = (client: ClientItem): string => {
        if (client.type === 'individual' && client.fullName) return client.fullName;
        if (client.type === 'company' && client.name) return client.name;
        return `Client #${client.id}`;
    };

    const getClientTypeLabel = (type: string): string => {
        if (type === 'individual') return 'Persoană fizică';
        if (type === 'company') return 'Firmă';
        return type;
    };

    const getOrderTypeLabel = (type: string): { label: string; color: string } => {
        switch (type) {
            case 'Amplasari': return { label: 'Amplasare', color: '#2980B9' };
            case 'Ridicari': return { label: 'Ridicare', color: '#E67E22' };
            case 'Igienizari': return { label: 'Igienizare', color: '#27AE60' };
            default: return { label: type, color: '#7F8C8D' };
        }
    };

    const renderClient = ({ item }: { item: ClientItem }) => (
        <ListCard
            onPress={() => handleEditClient(item)}
            onDelete={() => handleDeleteClient(item)}
        >
            <View style={searchStyles.cardHeader}>
                <Text style={searchStyles.cardTitle}>{getClientDisplayName(item)}</Text>
                <TypeBadge label={getClientTypeLabel(item.type)} />
            </View>

            {item.phone ? <InfoRow icon="phone" text={item.phone} /> : null}
            {item.email ? <InfoRow icon="mail" text={item.email} /> : null}
            {item.address ? <InfoRow icon="map-pin" text={item.address} /> : null}

            {/* ─── Orders / Services Summary ─── */}
            {clientOrderSummary[item.id] ? (
                <View style={searchStyles.ordersSummary}>
                    <View style={searchStyles.orderTypesRow}>
                        {clientOrderSummary[item.id].orderTypes.map((type) => {
                            const { label, color } = getOrderTypeLabel(type);
                            return (
                                <View key={type} style={[searchStyles.orderTypeBadge, { backgroundColor: color }]}> 
                                    <Text style={searchStyles.orderTypeBadgeText}>{label}</Text>
                                </View>
                            );
                        })}
                    </View>
                    {clientOrderSummary[item.id].items.length > 0 && (
                        <InfoRow icon="package" text={clientOrderSummary[item.id].items.join(', ')} />
                    )}
                </View>
            ) : (
                <View style={searchStyles.noOrdersContainer}>
                    <InfoRow icon="info" text="Nu are comenzi momentan" />
                </View>
            )}
        </ListCard>
    );

    if (loading) {
        return (
            <View style={searchStyles.centered}>
                <ActivityIndicator size="large" color="#427992" />
            </View>
        );
    }

    return (
        <View style={searchStyles.container}>
            <ScreenHeader title="Lista Clienți" onBack={() => router.back()} onRefresh={fetchClients} />

            <View style={searchStyles.searchContainer}>
                <Ionicons name="search" size={20} color="#999" style={searchStyles.searchIcon} />
                <TextInput
                    style={searchStyles.searchInput}
                    placeholder="Caută client (Nume, Email, Telefon)"
                    placeholderTextColor="#999"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {filteredClients.length === 0 ? (
                <EmptyState icon="users" message={searchQuery ? "Nu s-au găsit clienți." : "Nu există clienți."} />
            ) : (
                <FlatList
                    data={filteredClients}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderClient}
                    contentContainerStyle={searchStyles.listContent}
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

const searchStyles = StyleSheet.create({
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
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 30,
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
    // Card
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
    cardTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
    },
    // Orders summary
    ordersSummary: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(139, 168, 190, 0.2)',
    },
    orderTypesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 4,
    },
    orderTypeBadge: {
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    orderTypeBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
    },
    noOrdersContainer: {
        marginTop: 6,
        opacity: 0.6,
    },
});
