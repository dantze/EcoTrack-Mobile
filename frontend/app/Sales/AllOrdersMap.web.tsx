import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    StyleSheet,
    ActivityIndicator,
    Text,
    Pressable,
} from 'react-native';
import { API_BASE_URL } from '../../constants/ApiConfig';
import { useRouter } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';
import Constants from 'expo-constants';

const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey || '';

// Default to center of Romania
const DEFAULT_CENTER = { lat: 45.9432, lng: 24.9668 };
const DEFAULT_ZOOM = 7;

const MAP_STYLES = [
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'road.highway', stylers: [{ visibility: 'simplified' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

// ─── Google Maps JS API Loader ──────────────────────────────────────────────
let _gMapsPromise: Promise<void> | null = null;
const loadGoogleMapsAPI = (): Promise<void> => {
    if (_gMapsPromise) return _gMapsPromise;
    if (typeof window !== 'undefined' && (window as any).google?.maps) {
        return Promise.resolve();
    }
    _gMapsPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Google Maps'));
        document.head.appendChild(script);
    });
    return _gMapsPromise;
};

interface OrderSummary {
    orderNumber: number | null;
    clientName: string;
    name: string;
    orderType: string;
    itemCount: number;
    address: string;
}

interface ExistingPlacement {
    id: number;
    latitude: number;
    longitude: number;
    orderCount: number;
    itemCount: number;
    orders: OrderSummary[];
}

export default function AllOrdersMap() {
    const [placements, setPlacements] = useState<ExistingPlacement[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const googleMapRef = useRef<any>(null);

    useEffect(() => {
        fetchAllOrders();
    }, []);

    // Initialize map once placements are ready
    useEffect(() => {
        if (loading) return;

        let cancelled = false;

        const initMap = async () => {
            try {
                await loadGoogleMapsAPI();
            } catch {
                console.error('Google Maps failed to load');
                return;
            }
            if (cancelled) return;

            setTimeout(() => {
                const container = mapContainerRef.current;
                if (!container || cancelled) return;

                const gMaps = (window as any).google.maps;

                const map = new gMaps.Map(container, {
                    center: DEFAULT_CENTER,
                    zoom: DEFAULT_ZOOM,
                    disableDefaultUI: false,
                    zoomControl: true,
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: false,
                    styles: MAP_STYLES,
                });
                googleMapRef.current = map;

                // Add markers for each placement
                placements.forEach((placement) => {
                    const marker = new gMaps.Marker({
                        position: { lat: placement.latitude, lng: placement.longitude },
                        map,
                        label: {
                            text: placement.orderCount.toString(),
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '12px',
                        },
                        icon: {
                            path: gMaps.SymbolPath.CIRCLE,
                            fillColor: '#2196F3',
                            fillOpacity: 1,
                            strokeColor: '#fff',
                            strokeWeight: 2,
                            scale: 15,
                        },
                    });

                    // Info window on click
                    const description = placement.orders
                        .map((o) => `#${o.orderNumber} - ${o.clientName}`)
                        .join('<br/>');
                    const infoWindow = new gMaps.InfoWindow({
                        content: `<div style="font-family:sans-serif">
                            <strong>${placement.orderCount} ${placement.orderCount === 1 ? 'comandă' : 'comenzi'}</strong><br/>
                            ${description}
                        </div>`,
                    });
                    marker.addListener('click', () => {
                        infoWindow.open(map, marker);
                    });
                });

                // Fit bounds to show all markers
                if (placements.length > 0) {
                    const bounds = new gMaps.LatLngBounds();
                    placements.forEach((p) => {
                        bounds.extend({ lat: p.latitude, lng: p.longitude });
                    });
                    map.fitBounds(bounds, 60);
                }
            }, 150);
        };

        initMap();
        return () => { cancelled = true; };
    }, [loading, placements]);

    const fetchAllOrders = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/orders`);
            if (!response.ok) throw new Error(`Failed to fetch orders. Status: ${response.status}`);
            const orders = await response.json();

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

            // Simple clustering
            const clustered: ExistingPlacement[] = [];
            const THRESHOLD = 0.0002;
            rawPlacements.forEach((p: any) => {
                const existing = clustered.find(c =>
                    Math.abs(c.latitude - p.latitude) < THRESHOLD &&
                    Math.abs(c.longitude - p.longitude) < THRESHOLD,
                );
                if (existing) {
                    existing.orderCount += 1;
                    existing.itemCount += p.itemCount;
                    existing.orders.push(...p.orders);
                } else {
                    clustered.push({ ...p });
                }
            });

            setPlacements(clustered);
        } catch (error) {
            console.error('Error fetching all orders:', error);
            alert('Nu s-au putut încărca locațiile comenzilor.');
        } finally {
            setLoading(false);
        }
    };

    const totalOrders = placements.reduce((sum, p) => sum + p.orderCount, 0);
    const totalItems = placements.reduce((sum, p) => sum + p.itemCount, 0);

    return (
        <View style={styles.container}>
            {/* Google Map container */}
            <div
                ref={mapContainerRef}
                style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
            />

            {/* Header / Close Button */}
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
                    {totalOrders} comenzi ({totalItems} produse) în {placements.length} locații
                </Text>
            </View>

            {/* Loading overlay */}
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
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        position: 'absolute',
        top: 20,
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.9)',
        padding: 10,
        borderRadius: 12,
        zIndex: 20,
    },
    closeButton: { padding: 5 },
    headerText: { fontSize: 18, fontWeight: 'bold', color: '#16283C' },
    footer: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        alignItems: 'center',
        zIndex: 20,
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
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255,255,255,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 30,
    },
    loadingText: { marginTop: 10, fontSize: 16, color: '#333' },
});
