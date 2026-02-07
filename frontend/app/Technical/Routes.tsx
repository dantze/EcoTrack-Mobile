import { StyleSheet, Text, View, Pressable, Image, ScrollView, ActivityIndicator, Modal } from 'react-native'
import React, { useState, useCallback } from 'react'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons';
import { RouteService, Route } from '../../services/RouteService';
import { getAllDrivers, getDriversByCounty, Employee } from '../../services/EmployeeService';

const mapImageSource = require('../../assets/images/harta_romania.png');

const Routes = () => {
    const router = useRouter();
    const { zona, county } = useLocalSearchParams<{ zona?: string; county?: string }>();
    const zonaLabel = zona ?? 'Center';
    const [routes, setRoutes] = useState<Route[]>([]);
    const [loading, setLoading] = useState(true);

    // Driver assignment modal state
    const [driverModalVisible, setDriverModalVisible] = useState(false);
    const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
    const [drivers, setDrivers] = useState<Employee[]>([]);
    const [driversLoading, setDriversLoading] = useState(false);

    const fetchRoutes = async () => {
        try {
            setLoading(true);
            let data: Route[] = [];

            // If county is provided, try to filter by county first
            if (county) {
                data = await RouteService.getRoutesByCounty(county);
                // If no routes found for this county, fall back to all routes
                if (data.length === 0) {
                    console.log(`No routes found for county ${county}, showing all routes`);
                    data = await RouteService.getAllRoutes();
                }
            } else {
                data = await RouteService.getAllRoutes();
            }

            setRoutes(data);
        } catch (error) {
            console.error('Error fetching routes:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchRoutes();
        }, [county])
    );

    // Fetch drivers filtered by county
    const fetchDrivers = async () => {
        try {
            setDriversLoading(true);
            let data: Employee[] = [];

            if (county) {
                data = await getDriversByCounty(county);
                if (data.length === 0) {
                    console.log(`No drivers found for county ${county}, showing all drivers`);
                    data = await getAllDrivers();
                }
            } else {
                data = await getAllDrivers();
            }

            setDrivers(data);
        } catch (error) {
            console.error('Error fetching drivers:', error);
        } finally {
            setDriversLoading(false);
        }
    };

    const handleAddRoute = () => {
        router.push({
            pathname: "/Technical/CreateRoute",
            params: { zona, county }
        });
    };

    // Convert dayOfWeek number to Romanian label
    const getDayOfWeekLabel = (dayOfWeek?: number) => {
        const days: { [key: number]: string } = {
            1: 'Luni',
            2: 'Marți',
            3: 'Miercuri',
            4: 'Joi',
            5: 'Vineri',
            6: 'Sâmbătă',
            7: 'Duminică'
        };
        return dayOfWeek ? days[dayOfWeek] || 'N/A' : 'N/A';
    };

    const handleRoutePress = (route: Route) => {
        console.log("You selected route:", route.id);
        setSelectedRoute(route);
        fetchDrivers();
        setDriverModalVisible(true);
    };

    const handleSelectDriver = async (driver: Employee) => {
        if (!selectedRoute) return;

        try {
            await RouteService.assignDriverToRoute(selectedRoute.id, driver.id);
            console.log(`Assigned driver ${driver.fullName} to route ${selectedRoute.id}`);
            setDriverModalVisible(false);
            setSelectedRoute(null);
            // Refresh routes to show updated driver assignment
            fetchRoutes();
        } catch (error) {
            console.error('Error assigning driver:', error);
        }
    };

    const handleCloseDriverModal = () => {
        setDriverModalVisible(false);
        setSelectedRoute(null);
    };

    return (
        <View style={styles.container}>

            {/* Header */}
            <View style={styles.headerContainer}>
                <Text style={styles.headerText}>{`Rute - ${county || zonaLabel}`}</Text>
            </View>

            {/* Add Route Button */}
            <View style={styles.addButtonContainer}>
                <Pressable
                    style={({ pressed }) => [
                        styles.addRouteButton,
                        pressed && styles.buttonPressed
                    ]}
                    onPress={handleAddRoute}
                >
                    <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.addButtonText}>Adaugă Rută</Text>
                </Pressable>
            </View>

            <View style={styles.listContainer}>
                {loading ? (
                    <ActivityIndicator size="large" color="#ffffff" />
                ) : routes.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="map-outline" size={60} color="#5D8AA8" />
                        <Text style={styles.emptyText}>Nu există rute</Text>
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        {routes.map((route, index) => (
                            <View key={route.id} style={styles.itemWrapper}>

                                <Pressable
                                    style={({ pressed }) => [
                                        styles.routeButton,
                                        pressed && styles.buttonPressed
                                    ]}
                                    onPress={() => handleRoutePress(route)}
                                >
                                    <View style={styles.routeInfo}>
                                        <Text style={styles.buttonText}>{route.name || `Ruta #${route.id}`}</Text>
                                        <Text style={styles.subtitleText}>{getDayOfWeekLabel(route.dayOfWeek)}</Text>
                                    </View>
                                </Pressable>

                                {index < routes.length - 1 && <View style={styles.separator} />}

                            </View>
                        ))}
                    </ScrollView>
                )}
            </View>

            {/* <View style={styles.footerContainer}>
                <Image
                    source={mapImageSource}
                    style={styles.mapImage}
                    resizeMode="contain"
                />
            </View> */}

            {/* Driver Assignment Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={driverModalVisible}
                onRequestClose={handleCloseDriverModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Selectează Șofer</Text>
                            <Pressable onPress={handleCloseDriverModal}>
                                <Ionicons name="close" size={24} color="#FFFFFF" />
                            </Pressable>
                        </View>

                        {selectedRoute && (
                            <Text style={styles.modalSubtitle}>
                                Rută: {selectedRoute.name || `#${selectedRoute.id}`}
                            </Text>
                        )}

                        {driversLoading ? (
                            <ActivityIndicator size="large" color="#ffffff" style={{ marginTop: 20 }} />
                        ) : drivers.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="person-outline" size={40} color="#5D8AA8" />
                                <Text style={styles.emptyText}>Nu există șoferi disponibili</Text>
                            </View>
                        ) : (
                            <ScrollView style={styles.modalList}>
                                {drivers.map((driver) => (
                                    <Pressable
                                        key={driver.id}
                                        style={({ pressed }) => [
                                            styles.driverItem,
                                            pressed && styles.buttonPressed
                                        ]}
                                        onPress={() => handleSelectDriver(driver)}
                                    >
                                        <Ionicons name="person-circle-outline" size={32} color="#FFFFFF" />
                                        <View style={styles.driverInfo}>
                                            <Text style={styles.driverName}>{driver.fullName}</Text>
                                            {driver.county && (
                                                <Text style={styles.driverCounty}>{driver.county}</Text>
                                            )}
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color="#5D8AA8" />
                                    </Pressable>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

        </View>
    )
}

export default Routes;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#16283C',
    },
    headerContainer: {
        marginTop: 60,
        paddingHorizontal: 20,
        width: '100%',
        marginBottom: 30,
    },
    headerText: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'left',
    },

    addButtonContainer: {
        paddingHorizontal: 20,
        marginBottom: 20,
        alignItems: 'center',
    },
    addRouteButton: {
        width: 300,
        height: 50,
        backgroundColor: '#4CAF50',
        borderRadius: 20,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    addButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },

    listContainer: {
        flex: 1,
        alignItems: 'center',
    },
    scrollContent: {
        alignItems: 'center',
        paddingBottom: 20,
    },
    itemWrapper: {
        alignItems: 'center',
    },

    routeButton: {
        width: 300,
        height: 60,
        backgroundColor: '#427992',
        borderRadius: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    buttonPressed: {
        opacity: 0.8,
        transform: [{ scale: 0.98 }]
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
    subtitleText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 14,
        marginTop: 4,
    },

    separator: {
        width: 100,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        marginVertical: 15,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyText: {
        color: '#5D8AA8',
        fontSize: 18,
        marginTop: 15,
    },
    routeInfo: {
        flex: 1,
    },
    taskCountText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 12,
        marginTop: 2,
    },
    routeIdBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    routeIdText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
    },

    footerContainer: {
        width: '100%',
        height: 250,
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 30,
    },
    mapImage: {
        width: '80%',
        height: 210,
        opacity: 0.9,
        marginBottom: 10,

    },
    navLink: {
        marginTop: 10,
        alignSelf: 'flex-end',
        marginRight: 30,
    },
    navLinkText: {
        color: '#5D8AA8',
        fontSize: 16,
        fontWeight: 'bold',
    },
    mapContainer: {
        flex: 1,
        width: '100%',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 80,
        zIndex: 1,
    },

    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        maxHeight: '70%',
        backgroundColor: '#1E3A5F',
        borderRadius: 20,
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    modalTitle: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: 'bold',
    },
    modalSubtitle: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 14,
        marginBottom: 15,
    },
    modalList: {
        marginTop: 10,
    },
    driverItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#427992',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
    },
    driverInfo: {
        flex: 1,
        marginLeft: 12,
    },
    driverName: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    driverCounty: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 12,
        marginTop: 2,
    },
})
