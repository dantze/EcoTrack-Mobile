import { StyleSheet, Text, View, TextInput, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'expo-router'
import { AntDesign, Ionicons } from '@expo/vector-icons';
import { ClientService } from '../../services/ClientService';
import ScreenHeader from '../../components/ScreenHeader';
import { AppColors } from '../../constants/Colors';

type Client = {
    id: number;
    type: 'individual' | 'company';
    name: string; // For companies
    fullName?: string;
    email: string;
    phone: string;
    address: string;
    CUI?: string;
    adminName?: string;
};

const CreateOrder = () => {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [clients, setClients] = useState<Client[]>([]);
    const [filteredClients, setFilteredClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);

    useEffect(() => {
        fetchClients();
    }, []);

    useEffect(() => {
        filterClients();
    }, [searchQuery, clients]);

    const fetchClients = async () => {
        try {
            const data = await ClientService.getClients();
            setClients(data);
            setFilteredClients(data);
        } catch (error) {
            console.error('Error fetching clients:', error);
            Alert.alert("Eroare", "Nu s-au putut încărca clienții.");
        } finally {
            setLoading(false);
        }
    };

    const filterClients = () => {
        if (!searchQuery) {
            setFilteredClients(clients);
            return;
        }
        const lowerQuery = searchQuery.toLowerCase();
        const filtered = clients.filter(client => {
            const nameMatch = client.name ? client.name.toLowerCase().includes(lowerQuery) : false;
            const fullNameMatch = client.fullName ? client.fullName.toLowerCase().includes(lowerQuery) : false;
            const emailMatch = client.email ? client.email.toLowerCase().includes(lowerQuery) : false;
            const phoneMatch = client.phone ? client.phone.includes(lowerQuery) : false;
            const cuiMatch = client.CUI ? client.CUI.toLowerCase().includes(lowerQuery) : false;

            return nameMatch || fullNameMatch || emailMatch || phoneMatch || cuiMatch;
        });
        setFilteredClients(filtered);
    };

    const handleSelectClient = (client: Client) => {
        setSelectedClient(client);
        // You might want to navigate to the next step or show order form here
        console.log("Selected client:", client);
    };

    const renderClientItem = ({ item }: { item: Client }) => {
        const isSelected = selectedClient?.id === item.id;
        return (
            <Pressable
                style={[styles.clientItem, isSelected && styles.selectedClientItem]}
                onPress={() => handleSelectClient(item)}
            >
                <View style={styles.clientInfo}>
                    <Text style={styles.clientName}>
                        {item.type === 'company' ? item.name : (item.fullName || item.email)}
                    </Text>
                    {item.type === 'company' && <Text style={styles.clientDetail}>CUI: {item.CUI}</Text>}
                    <Text style={styles.clientDetail}>{item.email}</Text>
                    <Text style={styles.clientDetail}>{item.phone}</Text>
                </View>
                {isSelected && <AntDesign size={24} color="#4CAF50" />}
            </Pressable>
        );
    };

    return (
        <View style={styles.container}>
            <ScreenHeader title="Selectează Client" />

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Caută (Nume, CUI, Email, Telefon..."
                    placeholderTextColor="#999"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#427992" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={filteredClients}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderClientItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>Nu s-au găsit clienți.</Text>
                    }
                />
            )}

            {selectedClient && (
                <View style={styles.footer}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.nextButton,
                            pressed && { opacity: 0.9 }
                        ]}
                        onPress={() => router.push({
                            pathname: '/Sales/OrderDetails',
                            params: { client: JSON.stringify(selectedClient) }
                        })}
                    >
                        <Text style={styles.nextButtonText}>Continuă cu acest client</Text>

                    </Pressable>
                </View>
            )}
        </View>
    )
}

export default CreateOrder

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
        marginBottom: 20,
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
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 150, // Increased to avoid overlap with footer
    },
    clientItem: {
        backgroundColor: '#2A3E55',
        borderRadius: 12,
        padding: 15,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    selectedClientItem: {
        borderWidth: 2,
        borderColor: '#4CAF50',
    },
    clientInfo: {
        flex: 1,
    },
    clientName: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    clientDetail: {
        color: '#CCCCCC',
        fontSize: 14,
    },
    emptyText: {
        color: '#999',
        textAlign: 'center',
        marginTop: 50,
        fontSize: 16,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: AppColors.screenBackground,
        padding: 20,
        paddingBottom: 50, // Lift button up
        borderTopWidth: 1,
        borderTopColor: '#2A3E55',
    },
    nextButton: {
        backgroundColor: AppColors.buttonBackground,
        borderRadius: 12,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    nextButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
})
