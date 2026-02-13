import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import React, { useState, useEffect } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons';
import { RouteService, Route } from '../../services/RouteService';

// --- 1. DEFINE DATA TYPE (Schema) - matches backend Task entity ---
type TaskItem = {
    id: number;
    type: 'PLACEMENT' | 'PICKUP' | 'SANITIZATION' | 'MAINTENANCE';
    status: 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    scheduledTime?: string;
    address?: string;
    coordinates?: string;
    clientName?: string;
    clientPhone?: string;
    contactPerson?: string;
    productName?: string;
    quantity?: number;
    internalNotes?: string;
};

const RouteTasks = () => {
    const router = useRouter();
    const { routeId, driverName} = useLocalSearchParams<{
        routeId?: string;
        driverName?: string;
    }>();

    const [tasks, setTasks] = useState<TaskItem[]>([]);
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

    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ro-RO', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
        });
    };

    const getTaskTypeColor = (taskType?: string) => {
        switch (taskType?.toUpperCase()) {
            case 'PICKUP':
                return '#E74C3C'; // Red
            case 'PLACEMENT':
                return '#2ECC71'; // Green
            case 'SANITIZATION':
                return '#3498DB'; // Blue
            case 'MAINTENANCE':
                return '#F39C12'; // Orange
            default:
                return '#9B59B6'; // Purple
        }
    };

    const getTaskTypeLabel = (taskType?: string) => {
        switch (taskType?.toUpperCase()) {
            case 'PICKUP':
                return 'Ridicare';
            case 'PLACEMENT':
                return 'Amplasare';
            case 'SANITIZATION':
                return 'Igienizare';
            case 'MAINTENANCE':
                return 'Mentenanță';
            default:
                return taskType || 'Sarcină';
        }
    };

    const getStatusLabel = (status?: string) => {
        switch (status?.toUpperCase()) {
            case 'NEW':
                return 'Nou';
            case 'IN_PROGRESS':
                return 'În progres';
            case 'COMPLETED':
                return 'Finalizat';
            case 'CANCELLED':
                return 'Anulat';
            default:
                return status || 'Necunoscut';
        }
    };

    const getStatusColor = (status?: string) => {
        switch (status?.toUpperCase()) {
            case 'NEW':
                return '#F39C12'; // Orange
            case 'IN_PROGRESS':
                return '#3498DB'; // Blue
            case 'COMPLETED':
                return '#2ECC71'; // Green
            case 'CANCELLED':
                return '#E74C3C'; // Red
            default:
                return '#95A5A6'; // Gray
        }
    };

    const handleCardPress = (item: TaskItem) => {
        console.log("View task details:", item.id);
        router.push({
            pathname: "/Technical/ServiceDetails",
            params: { id: item.id }
        });
    };

    return (
        <View style={styles.container}>

            <View style={styles.headerContainer}>
                <Text style={styles.headerText}>{driverName}</Text>
            </View>

            {/* LEGEND */}
            <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                    <Ionicons name="location" size={20} color="#E74C3C" />
                    <Text style={styles.legendText}>Ridicări</Text>
                </View>
                <View style={styles.legendItem}>
                    <Ionicons name="location" size={20} color="#2ECC71" />
                    <Text style={styles.legendText}>Amplasări</Text>
                </View>
                <View style={styles.legendItem}>
                    <Ionicons name="location" size={20} color="#3498DB" />
                    <Text style={styles.legendText}>Igienizări</Text>
                </View>
            </View>

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
                            {/* Colored left border based on task type */}
                            <View style={[styles.cardTypeBorder, { backgroundColor: getTaskTypeColor(item.type) }]} />

                            {/* Card Body */}
                            <View style={styles.cardBody}>
                                {/* Top Row: Location + Status */}
                                <View style={styles.cardTopRow}>
                                    <View style={styles.locationSection}>
                                        <Ionicons name="location-sharp" size={18} color="#FFFFFF" />
                                        <Text style={styles.addressText} numberOfLines={2}>
                                            {item.address || item.coordinates || 'Locație necunoscută'}
                                        </Text>
                                    </View>
                                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]}>
                                        <Text style={styles.statusDotText}>{getStatusLabel(item.status)}</Text>
                                    </View>
                                </View>

                                {/* Order Info */}
                                <View style={styles.orderInfoSection}>
                                    {item.productName && (
                                        <View style={styles.infoRow}>
                                            <Ionicons name="cube-outline" size={14} color="#D0D0D0" />
                                            <Text style={styles.infoText}>
                                                {item.productName}{item.quantity ? ` × ${item.quantity}` : ''}
                                            </Text>
                                        </View>
                                    )}
                                    <View style={styles.infoRow}>
                                        <Ionicons name="person-outline" size={14} color="#D0D0D0" />
                                        <Text style={styles.infoText}>
                                            {item.clientName || 'Client necunoscut'}
                                        </Text>
                                    </View>
                                    {item.contactPerson && (
                                        <View style={styles.infoRow}>
                                            <Ionicons name="call-outline" size={14} color="#D0D0D0" />
                                            <Text style={styles.infoText}>Contact: {item.contactPerson}</Text>
                                        </View>
                                    )}
                                </View>

                                {/* Bottom: Task Type Tag */}
                                <View style={[styles.typeTag, { backgroundColor: getTaskTypeColor(item.type) + '30' }]}>
                                    <View style={[styles.typeTagDot, { backgroundColor: getTaskTypeColor(item.type) }]} />
                                    <Text style={[styles.typeTagText, { color: getTaskTypeColor(item.type) }]}>
                                        {getTaskTypeLabel(item.type)}
                                    </Text>
                                </View>
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
        backgroundColor: '#16283C',
    },
    headerContainer: {
        marginTop: 60,
        paddingHorizontal: 20,
        width: '100%',
        marginBottom: 10,
    },
    headerText: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'left',
    },
    subHeaderText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 16,
        marginTop: 4,
    },

    // --- CENTER CONTENT (Loading, Error, Empty) ---
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
        color: '#E74C3C',
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
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },

    // --- LEGEND ---
    legendContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        paddingHorizontal: 25,
        marginBottom: 20,
        flexWrap: 'wrap',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 15,
        marginBottom: 5,
    },
    legendText: {
        color: '#FFFFFF',
        fontSize: 14,
        marginLeft: 5,
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
        backgroundColor: '#1E3A52',
        borderRadius: 16,
        marginBottom: 14,
        flexDirection: 'row',
        overflow: 'hidden',
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    cardPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }]
    },
    cardTypeBorder: {
        width: 5,
    },
    cardBody: {
        flex: 1,
        padding: 14,
    },
    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    locationSection: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginRight: 10,
        gap: 6,
    },
    addressText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
        flex: 1,
        lineHeight: 20,
    },
    statusDot: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusDotText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    orderInfoSection: {
        marginBottom: 10,
        gap: 5,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    infoText: {
        fontSize: 13,
        color: '#B0BEC5',
    },
    typeTag: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        gap: 6,
    },
    typeTagDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    typeTagText: {
        fontSize: 12,
        fontWeight: '700',
    }
})
