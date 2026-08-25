import React, { useEffect, useState } from 'react';
import {
    View,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Text,
    Dimensions,
    Pressable
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { API_BASE_URL } from '../../constants/ApiConfig';
import { useRouter } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// Default to center of Romania, zoomed out to show the whole country
const DEFAULT_REGION: Region = {
    latitude: 45.9432,
    longitude: 24.9668,
    latitudeDelta: 6.0,
    longitudeDelta: 8.0,
};

// Custom Map Style to remove POIs and simplify (same as LocationPicker)
const MAP_STYLE = [
    {
        "featureType": "poi",
        "stylers": [{ "visibility": "off" }]
    },
    {
        "featureType": "road.highway",
        "stylers": [{ "visibility": "simplified" }]
    },
    {
        "featureType": "transit",
        "stylers": [{ "visibility": "off" }]
    }
];

interface OrderSummary {
    orderNumber: number | null;
    clientName: string;
    name: string;
    orderType: string;
    itemCount: number;
    address: string;
    rawOrder: any; // full order object for navigation
}

interface ExistingPlacement {
    id: number;
    latitude: number;
    longitude: number;
    orderCount: number;
    itemCount: number;
    orders: OrderSummary[];
}

const getClusterColor = (orders: OrderSummary[]): string => {
    const types = new Set(orders.map(o => o.orderType));
    if (types.size === 1) {
        const type = types.values().next().value;
        if (type === 'Amplasari') return '#4CAF50';
        if (type === 'Ridicari') return '#F44336';
        if (type === 'Igienizari') return '#9E9E9E';
    }
    return '#2196F3'; // default blue for mixed
};

export default function AllOrdersMap() {
    const [placements, setPlacements] = useState<ExistingPlacement[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const mapRef = React.useRef<MapView>(null);

    useEffect(() => {
        fetchAllOrders();
    }, []);

    const fetchAllOrders = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/orders`);
            if (!response.ok) {
                throw new Error(`Failed to fetch orders. Status: ${response.status}`);
            }
            const orders = await response.json();

            console.log('Fetched orders:', orders.length);

            // Helper to extract coordinates based on order type
            const getCoords = (o: any) => {
                if (o.orderType === 'Ridicari') return o.pickupLocationCoordinates;
                if (o.orderType === 'Igienizari') return o.sanitationLocationCoordinates;
                return o.locationCoordinates;
            };
            const getAddress = (o: any) => {
                if (o.orderType === 'Ridicari') return o.pickupLocationAddress || '';
                if (o.orderType === 'Igienizari') return o.sanitationLocationAddress || '';
                return o.locationAddress || '';
            };

            const rawPlacements = orders
                .filter((o: any) => {
                    const coords = getCoords(o);
                    return coords && coords.includes(',');
                })
                .map((o: any) => {
                    const coords = getCoords(o);
                    const parts = coords.split(',');
                    const orderSummary: OrderSummary = {
                        orderNumber: o.number || o.id,
                        clientName: o.client?.fullName || o.client?.name || 'Necunoscut',
                        name: o.product?.name || o.subscription?.name || '',
                        address: getAddress(o),
                        orderType: o.orderType || 'Amplasari',
                        itemCount: o.quantity || o.pickupQuantity || 1,
                        rawOrder: o,
                    };
                    return {
                        id: o.id,
                        latitude: parseFloat(parts[0]),
                        longitude: parseFloat(parts[1]),
                        orderCount: 1,
                        itemCount: orderSummary.itemCount,
                        orders: [orderSummary],
                    };
                });

            console.log('Raw placements with location:', rawPlacements.length);

            // Simple Clustering Logic - now properly tracks orders vs items
            const clustered: ExistingPlacement[] = [];
            const THRESHOLD = 0.0002; // Approx 20-30 meters

            rawPlacements.forEach((p: any) => {
                const existing = clustered.find(c =>
                    Math.abs(c.latitude - p.latitude) < THRESHOLD &&
                    Math.abs(c.longitude - p.longitude) < THRESHOLD
                );

                if (existing) {
                    existing.orderCount += 1;
                    existing.itemCount += p.itemCount;
                    existing.orders.push(...p.orders);
                } else {
                    clustered.push({ ...p });
                }
            });

            console.log('Clustered placements:', clustered.length);

            setPlacements(clustered);

        } catch (error) {
            console.error("Error fetching all orders:", error);
            Alert.alert("Eroare", "Nu s-au putut încărca locațiile comenzilor.");
        } finally {
            setLoading(false);
        }
    };

    const handleMarkerPress = (placement: ExistingPlacement) => {
        if (placement.orders.length === 1) {
            const order = placement.orders[0].rawOrder;
            router.push({
                pathname: '/Sales/EditOrder',
                params: { order: JSON.stringify(order) },
            });
        } else {
            const buttons = placement.orders.map((o) => ({
                text: `#${o.orderNumber} - ${o.clientName} (${o.orderType})`,
                onPress: () => {
                    router.push({
                        pathname: '/Sales/EditOrder',
                        params: { order: JSON.stringify(o.rawOrder) },
                    });
                },
            }));
            buttons.push({ text: 'Anulează', onPress: () => {} });
            Alert.alert(
                `${placement.orders.length} comenzi la această locație`,
                'Selectează comanda:',
                buttons
            );
        }
    };

    return (
        <View style={styles.modalContainer}>
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={DEFAULT_REGION}
                customMapStyle={MAP_STYLE}
            >
                {placements.map((placement) => {
                    return (
                        <Marker
                            key={placement.id}
                            coordinate={{
                                latitude: placement.latitude,
                                longitude: placement.longitude
                            }}
                            onPress={() => handleMarkerPress(placement)}
                        >
                            <View style={[styles.clusterMarker, { backgroundColor: getClusterColor(placement.orders) }]}>
                                <Text style={styles.clusterText}>{placement.orderCount}</Text>
                            </View>
                        </Marker>
                    );
                })}
            </MapView>

            {/* Header / Close Button - same style as LocationPicker */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.closeButton}>
                    <AntDesign name="close" size={24} color="#16283C" />
                </Pressable>
                <Text style={styles.headerText}>Harta Comenzilor</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Footer info */}
            <View style={styles.footer}>
                <Text style={styles.hintText}>
                    {placements.reduce((sum, p) => sum + p.orderCount, 0)} comenzi ({placements.reduce((sum, p) => sum + p.itemCount, 0)} produse) în {placements.length} locații
                </Text>
            </View>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#2196F3" />
                    <Text style={styles.loadingText}>Se încarcă comenzile...</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: '#fff',
    },
    map: {
        width: '100%',
        height: '100%',
    },
    header: {
        position: 'absolute',
        top: 50,
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.9)',
        padding: 10,
        borderRadius: 12,
        elevation: 5,
    },
    closeButton: {
        padding: 5,
    },
    headerText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#16283C',
    },
    footer: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        alignItems: 'center',
    },
    hintText: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        color: 'white',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        overflow: 'hidden',
        fontSize: 14,
    },
    // Cluster Marker Styles - exactly same as LocationPicker
    clusterMarker: {
        backgroundColor: '#2196F3',
        minWidth: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    clusterText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255,255,255,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#333',
    },
});