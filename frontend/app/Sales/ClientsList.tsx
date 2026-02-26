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
import listStyles from '../../components/listStyles';
import {
    EmptyState, ListCard, InfoRow, TypeBadge,
} from '../../components/ListComponents';
import ScreenHeader from '../../components/ScreenHeader';

interface ClientItem {
    id: number;
    type: string;
    email: string;
    phone: string;
    address: string;
    fullName?: string;
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

    const fetchClients = useCallback(async () => {
        try {
            const data = await ClientService.getClients();
            setClients(data);
            setFilteredClients(data);
        } catch (error) {
            console.error('Error fetching clients:', error);
            Alert.alert('Eroare', 'Nu s-au putut prelua clienții.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

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

    const renderClient = ({ item }: { item: ClientItem }) => (
        <ListCard
            onPress={() => handleEditClient(item)}
            onDelete={() => handleDeleteClient(item)}
        >
            <View style={listStyles.cardHeader}>
                <Text style={listStyles.cardTitle}>{getClientDisplayName(item)}</Text>
                <TypeBadge label={getClientTypeLabel(item.type)} />
            </View>

            {item.phone ? <InfoRow icon="phone" text={item.phone} /> : null}
            {item.email ? <InfoRow icon="mail" text={item.email} /> : null}
            {item.address ? <InfoRow icon="map-pin" text={item.address} numberOfLines={1} /> : null}
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
});
