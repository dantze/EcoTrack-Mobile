import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Modal, Pressable, Dimensions, TextInput, ActivityIndicator, Alert, Keyboard, FlatList } from 'react-native';
import MapView, { Region, PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import { AntDesign, Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Constants from 'expo-constants';

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

const { width, height } = Dimensions.get('window');

const DEFAULT_REGION = {
    latitude: 45.9432,
    longitude: 24.9668,
    latitudeDelta: 6.0,
    longitudeDelta: 8.0,
};

// Custom Map Style to remove POIs and simplify
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

// Get Google Maps API key from app config
const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey || '';

const LocationPicker = ({ onLocationSelect, initialLocation, existingPlacements = [] }: LocationPickerProps) => {
    const [modalVisible, setModalVisible] = useState(false);

    useEffect(() => {
        (async () => {
            await Location.requestForegroundPermissionsAsync();
        })();

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (mapDebounceRef.current) clearTimeout(mapDebounceRef.current);
        }
    }, []);

    const [region, setRegion] = useState<Region>(DEFAULT_REGION);
    const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(initialLocation || null);
    const [selectedExistingId, setSelectedExistingId] = useState<number | undefined>(undefined);
    const mapRef = React.useRef<MapView>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
    const [showPredictions, setShowPredictions] = useState(false);
    const [selectedAddress, setSelectedAddress] = useState<string>('');

    // Debounce timers
    const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const mapDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const reverseGeocodeRegion = async (latitude: number, longitude: number) => {
        try {
            const result = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (result.length > 0) {
                const a = result[0];
                const parts = [a.street, a.streetNumber, a.city, a.region].filter(Boolean);
                if (parts.length > 0) {
                    setSelectedAddress(parts.join(', '));
                }
            }
        } catch (error) {
            console.log("Reverse geocode error:", error);
        }
    };

    const handleRegionChange = (newRegion: Region, details?: { isGesture?: boolean }) => {
        setRegion(newRegion);

        // Only reverse geocode if moved BY USER gesture (dragging)
        if (details?.isGesture && !selectedExistingId) {
            if (mapDebounceRef.current) clearTimeout(mapDebounceRef.current);

            mapDebounceRef.current = setTimeout(() => {
                reverseGeocodeRegion(newRegion.latitude, newRegion.longitude);
            }, 800);
        }
    };

    // Fetch address predictions from Google Places Autocomplete API
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

    // Handle search input change with debounce
    const handleSearchChange = (text: string) => {
        setSearchQuery(text);

        // Clear previous debounce
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // Debounce API call
        debounceRef.current = setTimeout(() => {
            fetchPredictions(text);
        }, 300);
    };

    // Get place details and navigate to location
    const selectPrediction = async (prediction: PlacePrediction) => {
        Keyboard.dismiss();
        setShowPredictions(false);
        setSearchQuery(prediction.description);
        setSelectedAddress(prediction.description);
        setSearching(true);

        try {
            // Get place details to get coordinates
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`;
            const response = await fetch(detailsUrl);
            const data = await response.json();

            if (data.status === 'OK' && data.result?.geometry?.location) {
                const { lat, lng } = data.result.geometry.location;
                const newRegion = {
                    latitude: lat,
                    longitude: lng,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                };
                setRegion(newRegion);
                mapRef.current?.animateToRegion(newRegion, 500);
                setSelectedExistingId(undefined);
            } else {
                Alert.alert('Eroare', 'Nu am putut obține coordonatele pentru această adresă.');
            }
        } catch (error) {
            console.error('Place details error:', error);
            Alert.alert('Eroare', 'Nu am putut căuta adresa. Verifică conexiunea la internet.');
        } finally {
            setSearching(false);
        }
    };

    // Fallback search using expo-location
    const handleManualSearch = async () => {
        if (!searchQuery.trim()) {
            Alert.alert('Atenție', 'Te rog introdu o adresă pentru căutare.');
            return;
        }

        Keyboard.dismiss();
        setShowPredictions(false);
        setSearching(true);

        try {
            const results = await Location.geocodeAsync(searchQuery);
            if (results && results.length > 0) {
                const { latitude, longitude } = results[0];
                const newRegion = {
                    latitude,
                    longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                };
                setRegion(newRegion);
                mapRef.current?.animateToRegion(newRegion, 500);
                setSelectedExistingId(undefined);
                setSelectedAddress(searchQuery);
            } else {
                Alert.alert('Niciun rezultat', 'Nu am găsit nicio locație pentru această adresă.');
            }
        } catch (error) {
            console.error('Geocode error:', error);
            Alert.alert('Eroare', 'Nu am putut căuta adresa.');
        } finally {
            setSearching(false);
        }
    };

    const handleMarkerPress = (placement: ExistingPlacement) => {
        setSelectedExistingId(placement.id);
        setSelectedLocation({ latitude: placement.latitude, longitude: placement.longitude });
        setSelectedAddress(placement.name || 'Locație existentă');

        const newRegion = {
            ...region,
            latitude: placement.latitude,
            longitude: placement.longitude,
        };
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 500);
    };

    const confirmLocation = () => {
        if (selectedExistingId) {
            const placement = existingPlacements.find(p => p.id === selectedExistingId);
            if (placement) {
                onLocationSelect({
                    latitude: placement.latitude,
                    longitude: placement.longitude,
                    address: placement.name
                }, placement.id);
            }
        } else {
            const location: LocationData = {
                latitude: region.latitude,
                longitude: region.longitude,
                address: selectedAddress || undefined,
            };
            setSelectedLocation(location);
            onLocationSelect(location);
        }
        setModalVisible(false);
    };

    const resetSelection = () => {
        setSelectedExistingId(undefined);
    };

    // Format display text
    const getDisplayText = () => {
        if (!selectedLocation) return null;

        if (selectedExistingId) {
            return `📍 Locație Existentă (ID: ${selectedExistingId})`;
        }

        if (selectedLocation.address) {
            return `📍 ${selectedLocation.address}`;
        }

        return `📍 Lat: ${selectedLocation.latitude.toFixed(4)}, Long: ${selectedLocation.longitude.toFixed(4)}`;
    };

    return (
        <View style={{ marginTop: 15, zIndex: 100 }}>
            <Text style={styles.label}>Locație</Text>
            <Pressable onPress={() => setModalVisible(true)}>
                <View style={[styles.placeholderBox, selectedLocation && styles.selectedBox]}>
                    {selectedLocation ? (
                        <Text style={styles.selectedText} numberOfLines={1}>
                            {getDisplayText()}
                        </Text>
                    ) : (
                        <Text style={styles.placeholderText}>Apasă pentru a selecta locația</Text>
                    )}
                    <AntDesign name="environment" size={20} color={selectedLocation ? "#FFFFFF" : "#999"} />
                </View>
            </Pressable>

            <Modal
                animationType="slide"
                transparent={false}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <MapView
                        ref={mapRef}
                        provider={PROVIDER_GOOGLE}
                        style={styles.map}
                        initialRegion={DEFAULT_REGION}
                        onRegionChangeComplete={handleRegionChange}
                        onPress={resetSelection}
                        customMapStyle={MAP_STYLE}
                    >
                        {existingPlacements.map((placement) => (
                            <Marker
                                key={placement.id}
                                coordinate={{ latitude: placement.latitude, longitude: placement.longitude }}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    handleMarkerPress(placement);
                                }}
                            >
                                <View style={[styles.clusterMarker, selectedExistingId === placement.id && styles.selectedCluster]}>
                                    <Text style={styles.clusterText}>{placement.count}</Text>
                                </View>
                            </Marker>
                        ))}
                    </MapView>

                    {/* Fixed Marker in Center */}
                    {!selectedExistingId && (
                        <View style={styles.markerFixed}>
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

                    {/* Search Bar with Autocomplete */}
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
                            <Pressable
                                style={styles.searchButton}
                                onPress={handleManualSearch}
                                disabled={searching}
                            >
                                {searching ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Ionicons name="search" size={20} color="#FFF" />
                                )}
                            </Pressable>
                        </View>

                        {/* Predictions List */}
                        {showPredictions && predictions.length > 0 && (
                            <View style={styles.predictionsContainer}>
                                <FlatList
                                    data={predictions}
                                    keyExtractor={(item) => item.place_id}
                                    keyboardShouldPersistTaps="handled"
                                    renderItem={({ item }) => (
                                        <Pressable
                                            style={styles.predictionItem}
                                            onPress={() => selectPrediction(item)}
                                        >
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

                    {/* Selected Address Display */}
                    {selectedAddress && !selectedExistingId && (
                        <View style={styles.addressDisplay}>
                            <Text style={styles.addressText} numberOfLines={2}>
                                📍 {selectedAddress}
                            </Text>
                        </View>
                    )}

                    {/* Confirm Button */}
                    <View style={styles.footer}>
                        <Text style={styles.hintText}>
                            {selectedExistingId
                                ? "Locație existentă selectată. Apasă Confirmă."
                                : selectedAddress
                                    ? "Poți ajusta poziția trăgând harta."
                                    : "Caută o adresă sau trage harta pentru a poziționa pin-ul."}
                        </Text>
                        <Pressable style={styles.confirmButton} onPress={confirmLocation}>
                            <Text style={styles.confirmButtonText}>
                                {selectedExistingId ? "Adaugă aici (+1)" : "Confirmă Locația"}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default LocationPicker;

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
    // Modal Styles
    modalContainer: {
        flex: 1,
        backgroundColor: '#fff',
    },
    map: {
        width: '100%',
        height: '100%',
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
        top: 50,
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.95)',
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
        elevation: 5,
    },
    confirmButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    // Cluster Marker Styles
    clusterMarker: {
        backgroundColor: '#4CAF50',
        minWidth: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectedCluster: {
        backgroundColor: '#FF9800',
        zIndex: 10,
    },
    clusterText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
    },
    // Search Styles
    searchWrapper: {
        position: 'absolute',
        top: 110,
        left: 20,
        right: 20,
        zIndex: 100,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.98)',
        borderRadius: 12,
        elevation: 5,
        paddingLeft: 15,
    },
    searchInput: {
        flex: 1,
        height: 50,
        fontSize: 14,
        color: '#16283C',
    },
    searchButton: {
        width: 50,
        height: 50,
        backgroundColor: '#5D8AA8',
        borderTopRightRadius: 12,
        borderBottomRightRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Predictions
    predictionsContainer: {
        backgroundColor: 'white',
        borderRadius: 12,
        marginTop: 5,
        maxHeight: 200,
        elevation: 5,
    },
    predictionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
    },
    predictionMain: {
        fontSize: 14,
        fontWeight: '600',
        color: '#16283C',
    },
    predictionSecondary: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    // Address Display
    addressDisplay: {
        position: 'absolute',
        bottom: 160,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(22, 40, 60, 0.9)',
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    addressText: {
        color: 'white',
        fontSize: 14,
        textAlign: 'center',
    },
});
