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
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchClients = useCallback(async () => {
        try {
            const data = await ClientService.getClients();
            setClients(data);
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
                                                    setClients((prev) => prev.filter((c) => c.id !== client.id));
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
            <ScreenHeader title="Lista Clienți" onBack={() => router.back()} />

            {clients.length === 0 ? (
                <EmptyState icon="users" message="Nu există clienți." />
            ) : (
                <FlatList
                    data={clients}
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
