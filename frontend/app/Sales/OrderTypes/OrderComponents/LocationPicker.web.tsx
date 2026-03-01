import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, Modal, Pressable, TextInput, ActivityIndicator, FlatList } from 'react-native';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

// ─── Interfaces (identical to native) ───────────────────────────────────────
interface LocationData {
    latitude: number;
    longitude: number;
    address?: string;
}

interface ExistingPlacement {
    id: number;
    latitude: number;
    longitude: number;
    count: number;
    name: string;
}

interface LocationPickerProps {
    onLocationSelect: (location: LocationData, existingPlacementId?: number) => void;
    initialLocation?: LocationData;
    existingPlacements?: ExistingPlacement[];
}

interface PlacePrediction {
    place_id: string;
    description: string;
    structured_formatting?: {
        main_text: string;
        secondary_text: string;
    };
}

// ─── Constants ──────────────────────────────────────────────────────────────
const DEFAULT_CENTER = { lat: 44.4268, lng: 26.1025 };
const DEFAULT_ZOOM = 14;

const MAP_STYLES = [
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'road.highway', stylers: [{ visibility: 'simplified' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey || '';

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

// ─── Component ──────────────────────────────────────────────────────────────
const LocationPicker = ({ onLocationSelect, initialLocation, existingPlacements = [] }: LocationPickerProps) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(initialLocation || null);
    const [selectedExistingId, setSelectedExistingId] = useState<number | undefined>(undefined);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
    const [showPredictions, setShowPredictions] = useState(false);
    const [selectedAddress, setSelectedAddress] = useState('');

    // Map center tracking (updated on drag)
    const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);

    // Refs
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const googleMapRef = useRef<any>(null);
    const placementMarkersRef = useRef<any[]>([]);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mapDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (mapDebounceRef.current) clearTimeout(mapDebounceRef.current);
        };
    }, []);

    // ─── Initialize Google Map when modal opens ─────────────────────────
    useEffect(() => {
        if (!modalVisible) return;

        let cancelled = false;

        const initMap = async () => {
            try {
                await loadGoogleMapsAPI();
            } catch {
                console.error('Google Maps failed to load');
                return;
            }
            if (cancelled) return;

            // Small delay to ensure the DOM container is rendered
            setTimeout(() => {
                const container = mapContainerRef.current;
                if (!container || cancelled) return;

                const gMaps = (window as any).google.maps;
                const center = initialLocation
                    ? { lat: initialLocation.latitude, lng: initialLocation.longitude }
                    : DEFAULT_CENTER;

                const map = new gMaps.Map(container, {
                    center,
                    zoom: DEFAULT_ZOOM,
                    disableDefaultUI: false,
                    zoomControl: true,
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: false,
                    styles: MAP_STYLES,
                });
                googleMapRef.current = map;
                setMapCenter(center);

                // On idle (after drag / zoom), reverse geocode the center
                map.addListener('idle', () => {
                    const c = map.getCenter();
                    const lat = c.lat();
                    const lng = c.lng();
                    setMapCenter({ lat, lng });

                    if (mapDebounceRef.current) clearTimeout(mapDebounceRef.current);
                    mapDebounceRef.current = setTimeout(() => {
                        reverseGeocode(lat, lng);
                    }, 800);
                });

                // Add existing placement markers
                placementMarkersRef.current.forEach(m => m.setMap(null));
                placementMarkersRef.current = [];

                existingPlacements.forEach((p) => {
                    const marker = new gMaps.Marker({
                        position: { lat: p.latitude, lng: p.longitude },
                        map,
                        label: { text: p.count.toString(), color: 'white', fontWeight: 'bold', fontSize: '12px' },
                        icon: {
                            path: gMaps.SymbolPath.CIRCLE,
                            fillColor: '#2196F3',
                            fillOpacity: 1,
                            strokeColor: '#fff',
                            strokeWeight: 2,
                            scale: 15,
                        },
                    });
                    marker.addListener('click', () => handleMarkerPress(p, map));
                    placementMarkersRef.current.push(marker);
                });
            }, 150);
        };

        initMap();
        return () => { cancelled = true; };
    }, [modalVisible]);

    // ─── Reverse geocode via Google Geocoding API ──────────────────────
    const reverseGeocode = async (lat: number, lng: number) => {
        try {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=ro&key=${GOOGLE_MAPS_API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.status === 'OK' && data.results?.length > 0) {
                setSelectedAddress(data.results[0].formatted_address);
            }
        } catch (error) {
            console.log('Reverse geocode error:', error);
        }
    };

    // ─── Google Places Autocomplete (fetch-based) ──────────────────────
    const fetchPredictions = async (input: string) => {
        if (!input.trim() || input.length < 3) {
            setPredictions([]);
            setShowPredictions(false);
            return;
        }
        try {
            const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:ro&language=ro&key=${GOOGLE_MAPS_API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.status === 'OK' && data.predictions) {
                setPredictions(data.predictions);
                setShowPredictions(true);
            } else {
                setPredictions([]);
                setShowPredictions(false);
            }
        } catch (error) {
            console.error('Predictions error:', error);
            setPredictions([]);
        }
    };

    const handleSearchChange = (text: string) => {
        setSearchQuery(text);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchPredictions(text), 300);
    };

    const selectPrediction = async (prediction: PlacePrediction) => {
        setShowPredictions(false);
        setSearchQuery(prediction.description);
        setSelectedAddress(prediction.description);
        setSearching(true);

        try {
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`;
            const response = await fetch(detailsUrl);
            const data = await response.json();

            if (data.status === 'OK' && data.result?.geometry?.location) {
                const { lat, lng } = data.result.geometry.location;
                setSelectedExistingId(undefined);
                if (googleMapRef.current) {
                    googleMapRef.current.panTo({ lat, lng });
                    googleMapRef.current.setZoom(16);
                }
            } else {
                alert('Nu am putut obține coordonatele pentru această adresă.');
            }
        } catch (error) {
            console.error('Place details error:', error);
            alert('Nu am putut căuta adresa. Verifică conexiunea la internet.');
        } finally {
            setSearching(false);
        }
    };

    const handleManualSearch = async () => {
        if (!searchQuery.trim()) {
            alert('Te rog introdu o adresă pentru căutare.');
            return;
        }
        setShowPredictions(false);
        setSearching(true);

        try {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&components=country:RO&language=ro&key=${GOOGLE_MAPS_API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'OK' && data.results?.length > 0) {
                const { lat, lng } = data.results[0].geometry.location;
                setSelectedAddress(data.results[0].formatted_address || searchQuery);
                setSelectedExistingId(undefined);
                if (googleMapRef.current) {
                    googleMapRef.current.panTo({ lat, lng });
                    googleMapRef.current.setZoom(16);
                }
            } else {
                alert('Nu am găsit nicio locație pentru această adresă.');
            }
        } catch (error) {
            console.error('Geocode error:', error);
            alert('Nu am putut căuta adresa.');
        } finally {
            setSearching(false);
        }
    };

    // ─── Marker press / confirm / reset ────────────────────────────────
    const handleMarkerPress = (placement: ExistingPlacement, map?: any) => {
        setSelectedExistingId(placement.id);
        setSelectedLocation({ latitude: placement.latitude, longitude: placement.longitude });
        setSelectedAddress(placement.name || 'Locație existentă');

        const targetMap = map || googleMapRef.current;
        if (targetMap) {
            targetMap.panTo({ lat: placement.latitude, lng: placement.longitude });
        }

        // Highlight the clicked marker
        placementMarkersRef.current.forEach((m) => {
            const pos = m.getPosition();
            const isSelected =
                Math.abs(pos.lat() - placement.latitude) < 0.0001 &&
                Math.abs(pos.lng() - placement.longitude) < 0.0001;
            const gMaps = (window as any).google.maps;
            m.setIcon({
                path: gMaps.SymbolPath.CIRCLE,
                fillColor: isSelected ? '#FF9800' : '#2196F3',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
                scale: 15,
            });
        });
    };

    const resetSelection = () => {
        setSelectedExistingId(undefined);
        // Reset marker colors
        placementMarkersRef.current.forEach((m) => {
            const gMaps = (window as any).google.maps;
            m.setIcon({
                path: gMaps.SymbolPath.CIRCLE,
                fillColor: '#2196F3',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
                scale: 15,
            });
        });
    };

    const confirmLocation = () => {
        if (selectedExistingId) {
            const placement = existingPlacements.find(p => p.id === selectedExistingId);
            if (placement) {
                onLocationSelect(
                    { latitude: placement.latitude, longitude: placement.longitude, address: placement.name },
                    placement.id,
                );
            }
        } else {
            const location: LocationData = {
                latitude: mapCenter.lat,
                longitude: mapCenter.lng,
                address: selectedAddress || undefined,
            };
            setSelectedLocation(location);
            onLocationSelect(location);
        }
        setModalVisible(false);
    };

    // ─── Display helpers ────────────────────────────────────────────────
    const getDisplayText = () => {
        if (!selectedLocation) return null;
        if (selectedExistingId) return `📍 Locație Existentă (ID: ${selectedExistingId})`;
        if (selectedLocation.address) return `📍 ${selectedLocation.address}`;
        return `📍 Lat: ${selectedLocation.latitude.toFixed(4)}, Long: ${selectedLocation.longitude.toFixed(4)}`;
    };

    // ─── Render ─────────────────────────────────────────────────────────
    return (
        <View style={{ marginTop: 15, zIndex: 100 }}>
            <Text style={styles.label}>Locație</Text>
            <Pressable onPress={() => setModalVisible(true)}>
                <View style={[styles.placeholderBox, selectedLocation && styles.selectedBox]}>
                    {selectedLocation ? (
                        <Text style={styles.selectedText} numberOfLines={1}>{getDisplayText()}</Text>
                    ) : (
                        <Text style={styles.placeholderText}>Apasă pentru a selecta locația</Text>
                    )}
                    <AntDesign name="environment" size={20} color={selectedLocation ? '#FFFFFF' : '#999'} />
                </View>
            </Pressable>

            <Modal animationType="slide" transparent={false} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalContainer}>
                    {/* Google Map container (raw div for JS API) */}
                    <div
                        ref={mapContainerRef}
                        onClick={() => resetSelection()}
                        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
                    />

                    {/* Fixed center pin */}
                    {!selectedExistingId && (
                        <View style={styles.markerFixed} pointerEvents="none">
                            <Ionicons name="location-sharp" size={48} color="#E53935" />
                        </View>
                    )}

                    {/* Header */}
                    <View style={styles.header}>
                        <Pressable onPress={() => setModalVisible(false)} style={styles.closeButton}>
                            <AntDesign name="close" size={24} color="#16283C" />
                        </Pressable>
                        <Text style={styles.headerText}>Alege Locația</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    {/* Search */}
                    <View style={styles.searchWrapper}>
                        <View style={styles.searchContainer}>
                            <TextInput
                                style={styles.searchInput}
                                value={searchQuery}
                                onChangeText={handleSearchChange}
                                placeholder="Caută adresa..."
                                placeholderTextColor="#999"
                                returnKeyType="search"
                                onSubmitEditing={handleManualSearch}
                            />
                            <Pressable style={styles.searchButton} onPress={handleManualSearch} disabled={searching}>
                                {searching ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Ionicons name="search" size={20} color="#FFF" />
                                )}
                            </Pressable>
                        </View>

                        {showPredictions && predictions.length > 0 && (
                            <View style={styles.predictionsContainer}>
                                <FlatList
                                    data={predictions}
                                    keyExtractor={(item) => item.place_id}
                                    keyboardShouldPersistTaps="handled"
                                    renderItem={({ item }) => (
                                        <Pressable style={styles.predictionItem} onPress={() => selectPrediction(item)}>
                                            <Ionicons name="location-outline" size={18} color="#666" style={{ marginRight: 10 }} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.predictionMain} numberOfLines={1}>
                                                    {item.structured_formatting?.main_text || item.description.split(',')[0]}
                                                </Text>
                                                <Text style={styles.predictionSecondary} numberOfLines={1}>
                                                    {item.structured_formatting?.secondary_text || item.description}
                                                </Text>
                                            </View>
                                        </Pressable>
                                    )}
                                />
                            </View>
                        )}
                    </View>

                    {/* Address display */}
                    {selectedAddress && !selectedExistingId && (
                        <View style={styles.addressDisplay}>
                            <Text style={styles.addressText} numberOfLines={2}>📍 {selectedAddress}</Text>
                        </View>
                    )}

                    {/* Footer / Confirm */}
                    <View style={styles.footer}>
                        <Text style={styles.hintText}>
                            {selectedExistingId
                                ? 'Locație existentă selectată. Apasă Confirmă.'
                                : selectedAddress
                                    ? 'Poți ajusta poziția trăgând harta.'
                                    : 'Caută o adresă sau trage harta pentru a poziționa pin-ul.'}
                        </Text>
                        <Pressable style={styles.confirmButton} onPress={confirmLocation}>
                            <Text style={styles.confirmButtonText}>
                                {selectedExistingId ? 'Adaugă aici (+1)' : 'Confirmă Locația'}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default LocationPicker;

// ─── Styles (identical to native version) ───────────────────────────────────
const styles = StyleSheet.create({
    label: {
        color: '#CCCCCC',
        fontSize: 14,
        marginBottom: 5,
        fontWeight: '600',
    },
    placeholderBox: {
        height: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderStyle: 'dashed',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
    },
    selectedBox: {
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        borderColor: '#4CAF50',
        borderStyle: 'solid',
    },
    placeholderText: {
        color: '#999',
        fontStyle: 'italic',
        fontSize: 13,
    },
    selectedText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 13,
        flex: 1,
        marginRight: 10,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#fff',
    },
    markerFixed: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginLeft: -24,
        marginTop: -48,
        zIndex: 10,
    },
    header: {
        position: 'absolute',
        top: 20,
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.95)',
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
        marginBottom: 15,
        overflow: 'hidden',
        textAlign: 'center',
        fontSize: 13,
    },
    confirmButton: {
        backgroundColor: '#4CAF50',
        width: '100%',
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    confirmButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    searchWrapper: {
        position: 'absolute',
        top: 80,
        left: 20,
        right: 20,
        zIndex: 100,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.98)',
        borderRadius: 12,
        paddingLeft: 15,
    },
    searchInput: {
        flex: 1,
        height: 50,
        fontSize: 14,
        color: '#16283C',
        outlineStyle: 'none',
    } as any,
    searchButton: {
        width: 50,
        height: 50,
        backgroundColor: '#5D8AA8',
        borderTopRightRadius: 12,
        borderBottomRightRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    predictionsContainer: {
        backgroundColor: 'white',
        borderRadius: 12,
        marginTop: 5,
        maxHeight: 200,
    },
    predictionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
    },
    predictionMain: { fontSize: 14, fontWeight: '600', color: '#16283C' },
    predictionSecondary: { fontSize: 12, color: '#666', marginTop: 2 },
    addressDisplay: {
        position: 'absolute',
        bottom: 140,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(22, 40, 60, 0.9)',
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
        zIndex: 20,
    },
    addressText: { color: 'white', fontSize: 14, textAlign: 'center' },
});
