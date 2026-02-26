import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native'
import React, { useState, useEffect } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons';
import { TaskService, Task } from '../../services/TaskService';
import { OrderService } from '../../services/OrderService';
import { getTaskTypeLabel, getStatusLabel, getStatusColor } from '../../constants/TaskConstants';
import { formatDisplayDate } from '../../utils/dateUtils';
import { AppColors } from '../../constants/Colors';
import DetailRow from '../../components/display/DetailRow';
import ScreenHeader from '../../components/layout/ScreenHeader';
import StatusBadge from '../../components/display/StatusBadge';
import PhotoGallery from '../../components/display/PhotoGallery';

const ServiceDetails = () => {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const taskId = id ? Number(id) : null;

    const [isExpanded, setIsExpanded] = useState(true);
    const [loading, setLoading] = useState(true);
    const [task, setTask] = useState<Task | null>(null);
    const [additionalInfo, setAdditionalInfo] = useState<any>(null);
    const [taskPhotos, setTaskPhotos] = useState<string[]>([]);
    const [loadingPhotos, setLoadingPhotos] = useState(false);

    useEffect(() => {
        if (taskId) {
            loadTaskData();
        }
    }, [taskId]);

    const loadTaskData = async () => {
        try {
            setLoading(true);
            const taskData = await TaskService.getTaskById(taskId!);
            setTask(taskData);

            // If task has an order ID, fetch order details for extra info
            if (taskData.orderId) {
                try {
                    const orderData = await OrderService.getOrderById(taskData.orderId);
                    setAdditionalInfo(orderData);
                } catch (err) {
                    console.log("Could not fetch order details:", err);
                }
            }

            // Fetch task photos
            loadTaskPhotos();
        } catch (error) {
            console.error("Error loading task:", error);
            Alert.alert("Eroare", "Nu s-au putut încărca detaliile sarcinii");
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const loadTaskPhotos = async () => {
        try {
            setLoadingPhotos(true);
            const photos = await TaskService.getTaskPhotos(taskId!);
            setTaskPhotos(photos);
        } catch (error) {
            console.log("Could not fetch task photos:", error);
        } finally {
            setLoadingPhotos(false);
        }
    };

    const handleFinalize = () => {
        Alert.alert(
            "Finalizare Sarcină",
            "Ești sigur că vrei să finalizezi această sarcină?",
            [
                { text: "Nu", style: "cancel" },
                {
                    text: "Da",
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await TaskService.updateTaskStatus(taskId!, "COMPLETED");
                            Alert.alert("Succes", "Sarcina a fost finalizată cu succes!");
                            router.back();
                        } catch (error) {
                            Alert.alert("Eroare", "Nu s-a putut finaliza sarcina.");
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handlePostpone = () => {
        // Placeholder for postpone logic
        Alert.alert("Info", "Funcționalitatea de schimbare dată (snooze) va fi disponibilă în curând.");
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.loadingText}>Se încarcă detaliile...</Text>
            </View>
        );
    }

    if (!task) return null;

    // Unified data access
    const clientName = task.clientName || additionalInfo?.client?.name || additionalInfo?.client?.fullName || 'Client Necunoscut';
    const address = task.address || additionalInfo?.locationAddress || 'Adresă indisponibilă';
    const phone = task.clientPhone || additionalInfo?.contact || 'N/A';
    const taskType = getTaskTypeLabel(task.type);
    const hasScheduledDate = !!task.scheduledTime;
    const scheduledDate = task.scheduledTime
        ? formatDisplayDate(new Date(task.scheduledTime))
        : null;


    // Description shows order details only
    const description = additionalInfo?.details || "Fără descriere suplimentară.";

    return (
        <View style={styles.container}>

            {/* --- HEADER WITH STATUS --- */}
            <ScreenHeader
                title="Detalii Sarcină"
                rightElement={
                    <StatusBadge
                        label={getStatusLabel(task.status)}
                        color={getStatusColor(task.status)}
                        dotStyle
                    />
                }
            />

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* --- MAIN BLUE CARD --- */}
                <View style={styles.mainCard}>

                    <DetailRow label="Client / Companie" value={clientName} />
                    {hasScheduledDate ? (
                        <DetailRow label="Dată Programată" value={scheduledDate!} />
                    ) : (
                        <View style={styles.noDateRow}>
                            <Text style={styles.sectionLabel}>Dată Programată</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="alert-circle-outline" size={16} color="#F39C12" style={{ marginRight: 4 }} />
                                <Text style={{ color: '#F39C12', fontSize: 13, fontWeight: '600' }}>Nicio dată programată</Text>
                            </View>
                        </View>
                    )}
                    <DetailRow label="Telefon" value={phone} />
                    <DetailRow label="Adresă" value={address} isMultiline />

                    <View style={{ height: 10 }} />
                    <DetailRow label="Tip Sarcină" value={taskType} />

                    <Text style={[styles.sectionLabel, { marginBottom: 10, marginTop: 10 }]}>Poze ({taskPhotos.length})</Text>

                    {/* --- PHOTO GALLERY --- */}
                    <PhotoGallery photos={taskPhotos} loading={loadingPhotos} />

                    {/* --- EXPANDABLE AREA --- */}
                    <Pressable
                        style={styles.expandHeader}
                        onPress={() => setIsExpanded(!isExpanded)}
                    >
                        <Text style={styles.sectionLabel}>Detalii Suplimentare</Text>
                        <Ionicons
                            name={isExpanded ? "arrow-up" : "arrow-down"}
                            size={20}
                            color="white"
                        />
                    </Pressable>

                    {isExpanded && (
                        <Text style={styles.descriptionText}>
                            {description}
                        </Text>
                    )}

                </View>
            </ScrollView>

            {/* --- FOOTER BUTTONS --- */}
            {task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
                <View style={styles.footerButtons}>
                    
 
                    <Pressable
                        style={({ pressed }) => [styles.actionButton, styles.finishButton, pressed && styles.cardPressed]}
                        onPress={handleFinalize}
                    >
                        <Text style={styles.actionText}>Finalizează</Text>
                    </Pressable>
                </View>
            )}

            {/* Show only Back button if completed */}
            {task.status === 'COMPLETED' && (
                <View style={styles.footerButtons}>
                    <Pressable
                        style={({ pressed }) => [styles.actionButton, styles.finishButton, { width: '100%', backgroundColor: AppColors.successGreen }, pressed && styles.cardPressed]}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.actionText}>Înapoi (Finalizat)</Text>
                    </Pressable>
                </View>
            )}

        </View>
    )
}

export default ServiceDetails;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AppColors.screenBackground,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: AppColors.textWhite,
        marginTop: 10,
        fontSize: 16,
    },
    cardPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },

    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 120,
    },

    // Main Card Styles
    mainCard: {
        backgroundColor: AppColors.accentColor,
        borderRadius: 20,
        padding: 20,
        width: '100%',
        borderWidth: 2,
        borderColor: '#3498DB',
        elevation: 4,
    },
    sectionLabel: {
        color: '#E0E0E0',
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
    },
    noDateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },

    // Description
    expandHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 5,
        paddingVertical: 5,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    descriptionText: {
        color: AppColors.textWhite,
        fontSize: 14,
        lineHeight: 22,
        textAlign: 'justify',
        marginTop: 5,
        backgroundColor: 'rgba(0,0,0,0.1)',
        padding: 10,
        borderRadius: 10,
    },

    // Footer Buttons
    footerButtons: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 15,
    },
    actionButton: {
        flex: 1,
        height: 55,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: AppColors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    finishButton: {
        backgroundColor: '#F39C12',
    },
    actionText: {
        color: AppColors.textWhite,
        fontSize: 18,
        fontWeight: 'bold',
    },
})
