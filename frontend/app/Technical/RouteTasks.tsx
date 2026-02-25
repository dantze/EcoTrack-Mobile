import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import React, { useState, useEffect } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons';
import { RouteService } from '../../services/RouteService';
import { Task } from '../../services/TaskService';
import { getTaskTypeLabel, getTaskTypeColor, getStatusLabel } from '../../constants/TaskConstants';
import { AppColors } from '../../constants/Colors';
import ScreenHeader from '../../components/ScreenHeader';
import TaskTypeLegend from '../../components/TaskTypeLegend';

const RouteTasks = () => {
    const router = useRouter();
    const { routeId, driverName } = useLocalSearchParams<{
        routeId?: string;
        driverName?: string;
    }>();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (routeId) {
            loadRouteTasks();
        }
    }, [routeId]);

    const loadRouteTasks = async () => {
        try {
            setLoading(true);
            setError(null);
            const route = await RouteService.getRouteById(Number(routeId));
            setTasks(route.tasks || []);
        } catch (err) {
            setError('Nu s-au putut încărca sarcinile');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCardPress = (item: Task) => {
        console.log("View task details:", item.id);
        router.push({
            pathname: "/Technical/ServiceDetails",
            params: { id: item.id }
        });
    };

    return (
        <View style={styles.container}>

            <ScreenHeader title={driverName || 'Sarcini Rută'} />

            {/* LEGEND */}
            <TaskTypeLegend types={['PICKUP', 'PLACEMENT', 'SANITIZATION']} />

            {loading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color="#427992" />
                    <Text style={styles.loadingText}>Se încarcă sarcinile...</Text>
                </View>
            ) : error ? (
                <View style={styles.centerContent}>
                    <Text style={styles.errorText}>{error}</Text>
                    <Pressable style={styles.retryButton} onPress={loadRouteTasks}>
                        <Text style={styles.retryButtonText}>Încearcă din nou</Text>
                    </Pressable>
                </View>
            ) : tasks.length === 0 ? (
                <View style={styles.centerContent}>
                    <Text style={styles.emptyText}>Această rută nu are sarcini</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.scrollContainer}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {tasks.map((item) => (
                        <Pressable
                            key={item.id}
                            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                            onPress={() => handleCardPress(item)}
                        >
                            {/* Left Info */}
                            <View style={styles.cardInfo}>
                                <Text style={styles.clientName}>
                                    {item.clientName || 'Client necunoscut'}
                                </Text>
                                <Text style={styles.statusText}>
                                    Tip: {getTaskTypeLabel(item.type)}
                                </Text>
                                <Text style={styles.statusText}>
                                    Status: {getStatusLabel(item.status)}
                                </Text>
                                {item.address && (
                                    <View style={styles.addressContainer}>
                                        <Ionicons name="location-outline" size={14} color="#E0E0E0" style={{ marginRight: 5 }} />
                                        <Text style={styles.statusText} numberOfLines={1}>{item.address}</Text>
                                    </View>
                                )}
                                {item.clientPhone && (
                                    <View style={styles.phoneContainer}>
                                        <Ionicons name="call" size={14} color="#E0E0E0" style={{ marginRight: 5 }} />
                                        <Text style={styles.statusText}>{item.clientPhone}</Text>
                                    </View>
                                )}
                            </View>

                            {/* Right Pin */}
                            <View style={styles.pinContainer}>
                                <Ionicons
                                    name="location"
                                    size={28}
                                    color={getTaskTypeColor(item.type)}
                                />
                            </View>
                        </Pressable>
                    ))}
                </ScrollView>
            )}
        </View>
    )
}

export default RouteTasks

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AppColors.screenBackground,
    },

    // --- CENTER CONTENT (Loading, Error, Empty) ---
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    loadingText: {
        color: AppColors.textWhite,
        marginTop: 10,
        fontSize: 16,
    },
    errorText: {
        color: '#E74C3C',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
    },
    emptyText: {
        color: AppColors.subtitleText,
        fontSize: 16,
        textAlign: 'center',
    },
    retryButton: {
        backgroundColor: AppColors.buttonBackground,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    retryButtonText: {
        color: AppColors.textWhite,
        fontSize: 16,
        fontWeight: 'bold',
    },

    // --- LIST ---
    scrollContainer: {
        flex: 1,
        paddingHorizontal: 20,
    },
    scrollContent: {
        paddingBottom: 40,
    },

    // --- TASK CARD ---
    card: {
        backgroundColor: AppColors.accentColor,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 5,
        shadowColor: AppColors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
    },
    cardPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    cardInfo: {
        flex: 1,
    },
    clientName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: AppColors.textWhite,
        marginBottom: 4,
    },
    statusText: {
        fontSize: 14,
        color: '#E0E0E0',
        marginBottom: 8,
    },
    phoneContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pinContainer: {
        paddingLeft: 10,
    },
    addressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
})
