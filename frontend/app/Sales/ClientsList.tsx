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
import { ClientService } from '../../services/ClientService';

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
        if (client.type === 'individual' && client.fullName) {
            return client.fullName;
        }
        if (client.type === 'company' && client.name) {
            return client.name;
        }
        return `Client #${client.id}`;
    };

    const getClientTypeLabel = (type: string): string => {
        if (type === 'individual') return 'Persoană fizică';
        if (type === 'company') return 'Firmă';
        return type;
    };

    const renderClient = ({ item }: { item: ClientItem }) => (
        <View style={styles.card}>
            <Pressable
                style={({ pressed }) => [
                    styles.cardContent,
                    pressed && styles.cardPressed,
                ]}
                onPress={() => handleEditClient(item)}
            >
                <View style={styles.cardHeader}>
                    <Text style={styles.clientName}>{getClientDisplayName(item)}</Text>
                    <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>{getClientTypeLabel(item.type)}</Text>
                    </View>
                </View>

                {item.phone ? (
                    <View style={styles.infoRow}>
                        <Feather name="phone" size={14} color="#8BA8BE" />
                        <Text style={styles.infoText}>{item.phone}</Text>
                    </View>
                ) : null}

                {item.email ? (
                    <View style={styles.infoRow}>
                        <Feather name="mail" size={14} color="#8BA8BE" />
                        <Text style={styles.infoText}>{item.email}</Text>
                    </View>
                ) : null}

                {item.address ? (
                    <View style={styles.infoRow}>
                        <Feather name="map-pin" size={14} color="#8BA8BE" />
                        <Text style={styles.infoText} numberOfLines={1}>{item.address}</Text>
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
                onPress={() => handleDeleteClient(item)}
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
                <Text style={styles.headerText}>Lista Clienți</Text>
            </View>

            {clients.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Feather name="users" size={60} color="#8BA8BE" />
                    <Text style={styles.emptyText}>Nu există clienți.</Text>
                </View>
            ) : (
                <FlatList
                    data={clients}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderClient}
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
    clientName: {
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
