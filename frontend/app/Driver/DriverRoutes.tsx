import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../constants/ApiConfig';
import { AuthService, User } from '../../services/AuthService';

type Task = {
    id: number;
    type: string;
    status: string;
    address: string;
    clientName: string;
    clientPhone: string;
    scheduledTime: string;
    internalNotes: string;
};

type Route = {
    id: number;
    date?: string;
    dayOfWeek?: number; // 1=Luni, 2=Marți, ..., 7=Duminică
    tasks: Task[];
};

const DriverRoutes = () => {
    const router = useRouter();
    const [routes, setRoutes] = useState<Route[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    useEffect(() => {
        loadUserAndRoutes();
    }, []);

    const loadUserAndRoutes = async () => {
        try {
            const user = await AuthService.getCurrentUser();
            if (!user) {
                router.replace('/login');
                return;
            }

            // Check if an admin selected a specific driver to view as
            const activeDriver = await AuthService.getActiveDriver();
            if (activeDriver) {
                // Admin is impersonating a driver
                setCurrentUser({ ...user, id: activeDriver.id, fullName: activeDriver.fullName });
                await fetchDriverRoutes(activeDriver.id);
            } else {
                // Regular driver viewing their own routes
                setCurrentUser(user);
                await fetchDriverRoutes(user.id);
            }
        } catch (error) {
            console.error('Error loading user:', error);
            router.replace('/login');
        }
    };

    const fetchDriverRoutes = async (employeeId: number) => {
        try {
            const response = await fetch(`${API_BASE_URL}/routes/employee/${employeeId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch routes. Status: ${response.status}`);
            }
            const data: Route[] = await response.json();
            console.log('Fetched driver routes:', data.length);
            setRoutes(data);
        } catch (error) {
            console.error("Error fetching routes:", error);
        } finally {
            setLoading(false);
        }
    };

    // Convert dayOfWeek number to Romanian day name
    const getDayOfWeekInfo = (dayOfWeek?: number, dateString?: string) => {
        const daysRo: { [key: number]: string } = {
            1: 'Luni',
            2: 'Marți',
            3: 'Miercuri',
            4: 'Joi',
            5: 'Vineri',
            6: 'Sâmbătă',
            7: 'Duminică'
        };

        // If dayOfWeek is available, use it
        if (dayOfWeek && daysRo[dayOfWeek]) {
            return {
                dayName: daysRo[dayOfWeek],
                date: 'Săptămânal'
            };
        }

        // Fallback to date parsing if no dayOfWeek
        if (!dateString) return { dayName: 'N/A', date: '--' };

        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return { dayName: 'N/A', date: '--' };

            const days = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
            const months = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

            return {
                dayName: days[date.getDay()],
                date: `${date.getDate()} ${months[date.getMonth()]}`
            };
        } catch {
            return { dayName: 'N/A', date: '--' };
        }
    };

    const getTasksCount = (route: Route) => {
        const total = route.tasks?.length || 0;
        const completed = route.tasks?.filter(t => t.status === 'COMPLETED').length || 0;
        return { total, completed };
    };

    const handleRoutePress = (route: Route) => {
        router.push({
            pathname: "/Driver/RouteTasks",
            params: {
                routeId: route.id,
                routeDate: route.date
            }
        });
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.loadingContainer]}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.loadingText}>Se încarcă rutele...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.headerContainer}>
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.headerText}>Rutele Mele</Text>
                        <Text style={styles.subHeaderText}>Bine ai venit, {currentUser?.fullName?.split(' ')[0] || 'Șofer'}!</Text>
                    </View>
                    <Pressable
                        style={styles.logoutButton}
                        onPress={() => router.replace('/login')}
                    >
                        <Ionicons name="log-out-outline" size={24} color="#FF5252" />
                    </Pressable>
                </View>
            </View>

            <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {routes.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="car-outline" size={60} color="#5D8AA8" />
                        <Text style={styles.emptyText}>Nu ai rute asignate</Text>
                        <Text style={styles.emptySubText}>Contactează dispeceratul</Text>
                    </View>
                ) : (
                    routes.map((route) => {
                        const { dayName, date } = getDayOfWeekInfo(route.dayOfWeek, route.date);
                        const { total, completed } = getTasksCount(route);
                        const isCompleted = total > 0 && completed === total;

                        return (
                            <Pressable
                                key={route.id}
                                style={({ pressed }) => [
                                    styles.card,
                                    isCompleted && styles.cardCompleted,
                                    pressed && styles.cardPressed
                                ]}
                                onPress={() => handleRoutePress(route)}
                            >
                                <View style={styles.cardLeft}>
                                    <View style={styles.dateContainer}>
                                        <Text style={styles.dayName}>{dayName}</Text>
                                        <Text style={styles.dateText}>{date}</Text>
                                    </View>
                                </View>

                                <View style={styles.cardRight}>
                                    <View style={styles.tasksInfo}>
                                        <Ionicons name="list" size={18} color="#FFFFFF" />
                                        <Text style={styles.tasksText}>
                                            {completed}/{total} sarcini
                                        </Text>
                                    </View>

                                    {isCompleted ? (
                                        <View style={styles.completedBadge}>
                                            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                                            <Text style={styles.completedText}>Finalizată</Text>
                                        </View>
                                    ) : (
                                        <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
                                    )}
                                </View>
                            </Pressable>
                        );
                    })
                )}

                <View style={{ height: 20 }} />
            </ScrollView>

            {/* Refresh Button */}
            <Pressable
                style={({ pressed }) => [
                    styles.refreshButton,
                    pressed && styles.buttonPressed
                ]}
                onPress={() => currentUser && fetchDriverRoutes(currentUser.id)}
            >
                <Ionicons name="refresh" size={24} color="#FFFFFF" />
                <Text style={styles.refreshText}>Reîmprospătează</Text>
            </Pressable>
        </View>
    )
}

export default DriverRoutes

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#16283C',
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#FFFFFF',
        marginTop: 10,
        fontSize: 16,
    },
    headerContainer: {
        marginTop: 60,
        paddingHorizontal: 20,
        width: '100%',
        marginBottom: 20,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    logoutButton: {
        padding: 8,
    },
    headerText: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'left',
    },
    subHeaderText: {
        color: '#5D8AA8',
        fontSize: 16,
        marginTop: 5,
    },
    scrollContainer: {
        flex: 1,
        paddingHorizontal: 20,
    },
    scrollContent: {
        paddingBottom: 100,
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
    emptySubText: {
        color: '#5D8AA8',
        fontSize: 14,
        marginTop: 5,
        opacity: 0.7,
    },
    card: {
        backgroundColor: '#427992',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    cardCompleted: {
        backgroundColor: '#2A4158',
        borderWidth: 1,
        borderColor: '#4CAF50',
    },
    cardPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }]
    },
    cardLeft: {
        flex: 1,
    },
    dateContainer: {
        marginBottom: 5,
    },
    dayName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    dateText: {
        fontSize: 14,
        color: '#E0E0E0',
        marginTop: 2,
    },
    cardRight: {
        alignItems: 'flex-end',
    },
    tasksInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    tasksText: {
        color: '#FFFFFF',
        fontSize: 14,
        marginLeft: 6,
    },
    completedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    completedText: {
        color: '#4CAF50',
        fontSize: 12,
        marginLeft: 4,
        fontWeight: '600',
    },
    refreshButton: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        backgroundColor: '#5D8AA8',
        borderRadius: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
    },
    buttonPressed: {
        opacity: 0.8,
        transform: [{ scale: 0.98 }]
    },
    refreshText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
})
