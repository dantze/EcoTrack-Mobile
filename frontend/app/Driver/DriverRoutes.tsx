import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons';
import { AuthService, User } from '../../services/AuthService';
import { RouteService, Route } from '../../services/RouteService';
import { getDayOfWeekLabel } from '../../constants/RouteConstants';
import { AppColors } from '../../constants/Colors';
import ScreenHeader from '../../components/layout/ScreenHeader';

const DriverRoutes = () => {
    const router = useRouter();
    const [routes, setRoutes] = useState<Route[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);

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

            const userIsAdmin = user.roles && user.roles.length > 1;
            setIsAdmin(userIsAdmin);

            const activeDriver = await AuthService.getActiveDriver();
            if (activeDriver) {
                setCurrentUser({ ...user, id: activeDriver.id, fullName: activeDriver.fullName });
                await fetchDriverRoutes(activeDriver.id);
            } else {
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
            const data = await RouteService.getRoutesByEmployeeId(employeeId);
            console.log('Fetched driver routes:', data.length);
            setRoutes(data);
        } catch (error) {
            console.error("Error fetching routes:", error);
        } finally {
            setLoading(false);
        }
    };

    const getDayOfWeekInfo = (dayOfWeek?: number, dateString?: string) => {
        if (dayOfWeek) {
            return {
                dayName: getDayOfWeekLabel(dayOfWeek),
                date: 'Săptămânal'
            };
        }

        if (!dateString) return { dayName: 'N/A', date: '--' };

        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return { dayName: 'N/A', date: '--' };

            // Convert JS getDay() (0=Sunday) to RouteConstants (1=Mon..7=Sun)
            const jsDay = date.getDay();
            const routeDay = jsDay === 0 ? 7 : jsDay;

            return {
                dayName: getDayOfWeekLabel(routeDay),
                date: date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })
            };
        } catch {
            return { dayName: 'N/A', date: '--' };
        }
    };

    const getTasksCount = (route: Route) => {
        const total = route.tasks?.length || 0;
        const completed = route.tasks?.filter((t: any) => t.status === 'COMPLETED').length || 0;
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

    const handleBack = async () => {
        await AuthService.clearActiveDriver();
        router.replace('/Driver/DriverSelection');
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.loadingContainer]}>
                <ActivityIndicator size="large" color={AppColors.textWhite} />
                <Text style={styles.loadingText}>Se încarcă rutele...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.headerContainer}>
                <View style={styles.headerTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {isAdmin && (
                            <Pressable onPress={handleBack} style={styles.backButton}>
                                <Ionicons name="arrow-back" size={22} color={AppColors.textWhite} />
                            </Pressable>
                        )}
                        <View>
                            <Text style={styles.headerText}>Rutele Mele</Text>
                            <Text style={styles.subHeaderText}>
                                Bine ai venit, {currentUser?.fullName?.split(' ')[0] || 'Șofer'}!
                            </Text>
                        </View>
                    </View>
                    <Pressable
                        style={styles.logoutButton}
                        onPress={() => router.replace('/login')}
                    >
                        <Ionicons name="log-out-outline" size={24} color={AppColors.errorRed} />
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
                        <Ionicons name="car-outline" size={60} color={AppColors.accentColor} />
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
                                        <Ionicons name="list" size={18} color={AppColors.textWhite} />
                                        <Text style={styles.tasksText}>
                                            {completed}/{total} sarcini
                                        </Text>
                                    </View>

                                    {isCompleted ? (
                                        <View style={styles.completedBadge}>
                                            <Ionicons name="checkmark-circle" size={20} color={AppColors.successGreen} />
                                            <Text style={styles.completedText}>Finalizată</Text>
                                        </View>
                                    ) : (
                                        <Ionicons name="chevron-forward" size={24} color={AppColors.textWhite} />
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
                <Ionicons name="refresh" size={24} color={AppColors.textWhite} />
                <Text style={styles.refreshText}>Reîmprospătează</Text>
            </Pressable>
        </View>
    )
}

export default DriverRoutes

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AppColors.screenBackground,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: AppColors.textWhite,
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
    backButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: AppColors.buttonBackground,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        marginRight: 12,
    },
    headerText: {
        color: AppColors.textWhite,
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'left',
    },
    subHeaderText: {
        color: AppColors.accentColor,
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
        color: AppColors.accentColor,
        fontSize: 18,
        marginTop: 15,
    },
    emptySubText: {
        color: AppColors.accentColor,
        fontSize: 14,
        marginTop: 5,
        opacity: 0.7,
    },
    card: {
        backgroundColor: AppColors.buttonBackground,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: AppColors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    cardCompleted: {
        backgroundColor: AppColors.inputBackground,
        borderWidth: 1,
        borderColor: AppColors.successGreen,
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
        color: AppColors.textWhite,
    },
    dateText: {
        fontSize: 14,
        color: AppColors.lightText,
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
        color: AppColors.textWhite,
        fontSize: 14,
        marginLeft: 6,
    },
    completedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    completedText: {
        color: AppColors.successGreen,
        fontSize: 12,
        marginLeft: 4,
        fontWeight: '600',
    },
    refreshButton: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        backgroundColor: AppColors.accentColor,
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
        color: AppColors.textWhite,
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
})
