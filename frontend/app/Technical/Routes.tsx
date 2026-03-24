import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native'
import React, { useState, useCallback } from 'react'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons';
import { RouteService, Route } from '../../services/RouteService';
import { getAllDrivers, Employee } from '../../services/EmployeeService';
import ScreenHeader from '../../components/layout/ScreenHeader';
import DriverSelectModal from '../../modals/DriverSelectModal';
import { AppColors } from '../../constants/Colors';
import { getDayOfWeekLabel } from '../../constants/RouteConstants';

const Routes = () => {
    const router = useRouter();
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
            const data = await RouteService.getAllRoutes();
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
        }, [])
    );

    // Fetch drivers
    const fetchDrivers = async () => {
        try {
            setDriversLoading(true);
            const data = await getAllDrivers();
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
        });
    };

    const handleRoutePress = (route: Route) => {
        router.push({
            pathname: '/Technical/RouteTasks',
            params: {
                routeId: route.id.toString(),
                driverName: route.name || `Ruta #${route.id}`,
            },
        });
    };

    const handleDriverAssign = (route: Route) => {
        setSelectedRoute(route);
        fetchDrivers();
        setDriverModalVisible(true);
    };

    const handleSelectDriver = async (driver: Employee) => {
        if (!selectedRoute) return;

        try {
            const routeName = selectedRoute.name || `#${selectedRoute.id}`;
            await RouteService.assignDriverToRoute(selectedRoute.id, driver.id);
            console.log(`Assigned driver ${driver.fullName} to route ${selectedRoute.id}`);
            setDriverModalVisible(false);
            setSelectedRoute(null);
            // Refresh routes to show updated driver assignment
            fetchRoutes();
            Alert.alert('Succes', `${driver.fullName} a fost asignat rutei ${routeName}`);
        } catch (error) {
            console.error('Error assigning driver:', error);
            Alert.alert('Eroare', 'Nu s-a putut asigna șoferul.');
        }
    };

    const handleCloseDriverModal = () => {
        setDriverModalVisible(false);
        setSelectedRoute(null);
    };

    return (
        <View style={styles.container}>

            <ScreenHeader title="Rute" />

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

                                <View style={styles.routeRow}>
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
                                        <Ionicons name="chevron-forward" size={22} color={AppColors.textWhite} />
                                    </Pressable>

                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.driverButton,
                                            pressed && styles.buttonPressed
                                        ]}
                                        onPress={() => handleDriverAssign(route)}
                                    >
                                        <Ionicons name="person-add" size={22} color={AppColors.textWhite} />
                                    </Pressable>

                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.addTaskButton,
                                            pressed && styles.buttonPressed
                                        ]}
                                    >
                                        <Ionicons name="add" size={26} color={AppColors.textWhite} />
                                    </Pressable>
                                </View>

                                {index < routes.length - 1 && <View style={styles.separator} />}

                            </View>
                        ))}
                    </ScrollView>
                )}
            </View>

            <DriverSelectModal
                visible={driverModalVisible}
                onClose={handleCloseDriverModal}
                subtitle={selectedRoute ? `Rută: ${selectedRoute.name || `#${selectedRoute.id}`}` : undefined}
                drivers={drivers}
                loading={driversLoading}
                onSelectDriver={handleSelectDriver}
            />

        </View>
    )
}

export default Routes;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AppColors.screenBackground,
    },
    addButtonContainer: {
        paddingHorizontal: 20,
        marginBottom: 20,
        alignItems: 'center',
    },
    addRouteButton: {
        width: 300,
        height: 50,
        backgroundColor: AppColors.successGreen,
        borderRadius: 20,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: AppColors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    addButtonText: {
        color: AppColors.textWhite,
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
    routeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: 340,
        gap: 10,
    },
    routeButton: {
        flex: 1,
        height: 60,
        backgroundColor: AppColors.buttonBackground,
        borderRadius: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        elevation: 5,
        shadowColor: AppColors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    driverButton: {
        width: 50,
        height: 50,
        backgroundColor: AppColors.successGreen,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: AppColors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    addTaskButton: {
        width: 50,
        height: 50,
        backgroundColor: AppColors.successGreen,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: AppColors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    buttonPressed: {
        opacity: 0.8,
        transform: [{ scale: 0.98 }]
    },
    buttonText: {
        color: AppColors.textWhite,
        fontSize: 20,
        fontWeight: 'bold',
    },
    subtitleText: {
        color: AppColors.subtitleText,
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
        color: AppColors.accentColor,
        fontSize: 18,
        marginTop: 15,
    },
    routeInfo: {
        flex: 1,
    },
})
