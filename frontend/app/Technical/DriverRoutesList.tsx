import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import React, { useEffect, useState } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { RouteService, Route } from '../../services/RouteService'
import { getDayOfWeekLabel } from '../../constants/RouteConstants'

const DriverRoutesList = () => {
    const router = useRouter();
    const { driverId, driverName } = useLocalSearchParams<{
        driverId?: string;
        driverName?: string;
    }>();

    const [routes, setRoutes] = useState<Route[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (driverId) {
            loadRoutes();
        }
    }, [driverId]);

    const loadRoutes = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await RouteService.getRoutesByEmployeeId(Number(driverId));
            setRoutes(data);
        } catch (err) {
            setError('Nu s-au putut încărca rutele');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleRoutePress = (route: Route) => {
        router.push({
            pathname: '/Technical/RouteTasks',
            params: {
                routeId: route.id.toString(),
                driverName: driverName,
                routeDate: route.date,
            },
        });
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerContainer}>
                <Text style={styles.headerText}>{`Rutele lui ${driverName || 'Șofer'}`}</Text>
            </View>

            {loading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color="#427992" />
                    <Text style={styles.loadingText}>Se încarcă rutele...</Text>
                </View>
            ) : error ? (
                <View style={styles.centerContent}>
                    <Text style={styles.errorText}>{error}</Text>
                    <Pressable style={styles.retryButton} onPress={loadRoutes}>
                        <Text style={styles.retryButtonText}>Încearcă din nou</Text>
                    </Pressable>
                </View>
            ) : routes.length === 0 ? (
                <View style={styles.centerContent}>
                    <Text style={styles.emptyText}>Acest șofer nu are rute atribuite</Text>
                </View>
            ) : (
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    {routes.map((route) => (
                        <Pressable
                            key={route.id}
                            style={({ pressed }) => [
                                styles.routeCard,
                                pressed && styles.cardPressed,
                            ]}
                            onPress={() => handleRoutePress(route)}
                        >
                            <View style={styles.routeInfo}>
                                <Text style={styles.routeName}>{route.name || `Ruta #${route.id}`}</Text>
                                <Text style={styles.taskCount}>
                                    {route.dayOfWeek ? `${getDayOfWeekLabel(route.dayOfWeek)} • ` : ''}{route.tasks?.length || 0} sarcini
                                </Text>
                            </View>
                            <View style={styles.routeIdBadge}>
                                <Text style={styles.routeIdText}>#{route.id}</Text>
                            </View>
                        </Pressable>
                    ))}
                </ScrollView>
            )}

            <Pressable
                style={({ pressed }) => [
                    styles.backButton,
                    pressed && styles.cardPressed,
                ]}
                onPress={() => router.back()}
            >
                <Text style={styles.backButtonText}>← Înapoi la șoferi</Text>
            </Pressable>
        </View>
    )
}

export default DriverRoutesList

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#16283C',
    },
    headerContainer: {
        marginTop: 60,
        paddingHorizontal: 20,
        width: '100%',
        marginBottom: 20,
    },
    headerText: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'left',
    },
    subHeaderText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        marginTop: 4,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    loadingText: {
        color: '#FFFFFF',
        marginTop: 10,
        fontSize: 16,
    },
    errorText: {
        color: '#ff6b6b',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
    },
    emptyText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 16,
        textAlign: 'center',
    },
    retryButton: {
        backgroundColor: '#427992',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 20,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        gap: 12,
    },
    routeCard: {
        backgroundColor: '#427992',
        borderRadius: 15,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    cardPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.99 }],
    },
    routeInfo: {
        flex: 1,
    },
    routeName: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    taskCount: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        marginTop: 4,
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
    backButton: {
        margin: 20,
        marginBottom: 40,
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    backButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
    },
})
