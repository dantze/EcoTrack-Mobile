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
import MapView, { Marker, Callout, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { API_BASE_URL } from '../../constants/ApiConfig';
import { useRouter } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// Default to Bucharest (same as LocationPicker)
const DEFAULT_REGION: Region = {
    latitude: 44.4268,
    longitude: 26.1025,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
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

interface ExistingPlacement {
    id: number;
    latitude: number;
    longitude: number;
    orderCount: number;  // Number of orders at this location
    itemCount: number;   // Total quantity of items across all orders
    name: string;
}

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

            // Transform orders - now tracking both order count and item count
            const rawPlacements = orders
                .filter((o: any) => o.locationCoordinates && o.locationCoordinates.includes(','))
                .map((o: any) => {
                    const parts = o.locationCoordinates.split(',');
                    return {
                        id: o.id,
                        latitude: parseFloat(parts[0]),
                        longitude: parseFloat(parts[1]),
                        orderCount: 1,  // Each raw placement represents 1 order
                        itemCount: o.quantity || 1,
                        name: o.product?.name || 'Comanda #' + o.id
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
                    existing.orderCount += 1;  // Increment order count
                    existing.itemCount += p.itemCount;  // Add items from this order
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

    return (
        <View style={styles.modalContainer}>
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={DEFAULT_REGION}
                customMapStyle={MAP_STYLE}
            >
                {/* Render markers exactly like LocationPicker.tsx */}
                {placements.map((placement) => (
                    <Marker
                        key={placement.id}
                        coordinate={{
                            latitude: placement.latitude,
                            longitude: placement.longitude
                        }}
                    >
                        <View style={styles.clusterMarker}>
                            <Text style={styles.clusterText}>{placement.orderCount}</Text>
                        </View>
                        <Callout>
                            <View style={styles.calloutContainer}>
                                <Text style={styles.calloutTitle}>
                                    {placement.orderCount} {placement.orderCount === 1 ? 'comandă' : 'comenzi'} cu {placement.itemCount} {placement.itemCount === 1 ? 'produs' : 'produse'}
                                </Text>
                                <Text style={styles.calloutText}>{placement.name}</Text>
                            </View>
                        </Callout>
                    </Marker>
                ))}
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
    calloutContainer: {
        width: 200,
        padding: 10,
    },
    calloutTitle: {
        fontWeight: 'bold',
        fontSize: 14,
        marginBottom: 5,
    },
    calloutText: {
        fontSize: 12,
        color: '#555',
        marginBottom: 2,
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