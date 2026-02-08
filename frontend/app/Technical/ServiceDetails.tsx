import { StyleSheet, Text, View, Pressable, ScrollView, Image, ActivityIndicator, Alert } from 'react-native'
import React, { useState, useEffect } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons';
import { TaskService, Task } from '../../services/TaskService';
import { OrderService } from '../../services/OrderService';

type DetailRowProps = {
    label: string;
    value: string | number | undefined | null;
    isMultiline?: boolean;
};

const ServiceDetails = () => {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const taskId = id ? Number(id) : null;

    const [isExpanded, setIsExpanded] = useState(true);
    const [loading, setLoading] = useState(true);
    const [task, setTask] = useState<Task | null>(null);
    const [additionalInfo, setAdditionalInfo] = useState<any>(null); // Order details if needed

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
        } catch (error) {
            console.error("Error loading task:", error);
            Alert.alert("Eroare", "Nu s-au putut încărca detaliile sarcinii");
            router.back();
        } finally {
            setLoading(false);
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

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'COMPLETED': return '#2ECC71'; // Green
            case 'IN_PROGRESS': return '#F1C40F'; // Yellow
            case 'CANCELLED': return '#E74C3C'; // Red
            case 'NEW': return '#3498DB'; // Blue
            default: return '#95A5A6'; // Gray
        }
    };

    const getStatusLabel = (status?: string) => {
        switch (status) {
            case 'COMPLETED': return 'Finalizat';
            case 'IN_PROGRESS': return 'În Lucru';
            case 'CANCELLED': return 'Anulat';
            case 'NEW': return 'Nou';
            default: return status || 'Necunoscut';
        }
    };

    const getTaskTypeLabel = (type?: string) => {
        const labels: Record<string, string> = {
            'PLACEMENT': 'Amplasare',
            'PICKUP': 'Ridicare',
            'SANITIZATION': 'Igienizare',
            'MAINTENANCE': 'Mentenanță'
        };
        return labels[type || ''] || type || 'Sarcină';
    };

    const DetailRow = ({ label, value, isMultiline }: DetailRowProps) => (
        <View style={styles.rowContainer}>
            <Text style={styles.label}>{label}</Text>
            <Text style={[styles.value, isMultiline && { textAlign: 'right', flex: 1, marginLeft: 10 }]}>
                {value || 'N/A'}
            </Text>
        </View>
    );

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
    const scheduledDate = task.scheduledTime
        ? new Date(task.scheduledTime).toLocaleDateString('ro-RO')
        : (additionalInfo?.startDate ? new Date(additionalInfo.startDate).toLocaleDateString('ro-RO') : 'N/A');

    // Description combines task notes and order details
    const description = [task.internalNotes, additionalInfo?.details].filter(Boolean).join('\n\n') || "Fără descriere suplimentară.";

    // Use a placeholder image if no photos (assuming photos not yet implemented in backend fetch)
    const imageUrl = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSCCvGfvCGF5vX0Dq2yT9YnfnvL_qVbCg4q4Q&s";

    return (
        <View style={styles.container}>

            {/* --- HEADER WITH STATUS --- */}
            <View style={styles.headerContainer}>
                <Pressable onPress={() => router.back()} style={{ marginRight: 10 }}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </Pressable>
                <Text style={styles.headerText}>Detalii Sarcină</Text>

                <View style={styles.statusContainer}>
                    <Text style={styles.statusLabelText}>{getStatusLabel(task.status)}</Text>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(task.status) }]} />
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* --- MAIN BLUE CARD --- */}
                <View style={styles.mainCard}>

                    <DetailRow label="Client / Companie" value={clientName} />
                    <DetailRow label="Dată Programată" value={scheduledDate} />
                    <DetailRow label="Telefon" value={phone} />
                    <DetailRow label="Adresă" value={address} isMultiline />

                    <View style={{ height: 10 }} />
                    <View style={styles.rowContainer}>
                        <Text style={styles.label}>Tip Sarcină</Text>
                        <Text style={styles.value}>{taskType}</Text>
                    </View>

                    <Text style={[styles.label, { marginBottom: 10, marginTop: 10 }]}>Media / Dovezi</Text>

                    {/* --- IMAGE AND GALLERY AREA --- */}
                    <View style={styles.mediaContainer}>
                        <Image
                            source={{ uri: imageUrl }}
                            style={styles.taskImage}
                        />

                        <Pressable
                            style={({ pressed }) => [styles.galleryButton, pressed && styles.cardPressed]}
                            onPress={() => Alert.alert("Galerie", "Această funcție va fi disponibilă curând.")}
                        >
                            <Text style={styles.galleryText}>Galerie</Text>
                            <Ionicons name="images-outline" size={20} color="white" style={{ marginLeft: 5 }} />
                        </Pressable>
                    </View>

                    {/* --- EXPANDABLE AREA --- */}
                    <Pressable
                        style={styles.expandHeader}
                        onPress={() => setIsExpanded(!isExpanded)}
                    >
                        <Text style={styles.label}>Detalii Suplimentare</Text>
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
                        style={({ pressed }) => [styles.actionButton, styles.postponeButton, pressed && styles.cardPressed]}
                        onPress={handlePostpone}
                    >
                        <Text style={styles.actionText}>Amână</Text>
                    </Pressable>

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
                        style={({ pressed }) => [styles.actionButton, styles.finishButton, { width: '100%', backgroundColor: '#2ECC71' }, pressed && styles.cardPressed]}
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
        backgroundColor: '#16283C',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#FFFFFF',
        marginTop: 10,
        fontSize: 16,
    },
    cardPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }]
    },

    // Header
    headerContainer: {
        marginTop: 60,
        paddingHorizontal: 20,
        marginBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
        // justifyContent: 'space-between', // Changed to align items better with back button
    },
    headerText: {
        color: '#FFFFFF',
        fontSize: 24, // Slightly smaller to fit
        fontWeight: 'bold',
        flex: 1,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 15,
    },
    statusLabelText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
        marginRight: 6,
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },

    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 120, // Space for footer buttons
    },

    // Main Card Styles
    mainCard: {
        backgroundColor: '#5D8AA8', // Light blue
        borderRadius: 20,
        padding: 20,
        width: '100%',
        borderWidth: 2,
        borderColor: '#3498DB',
        elevation: 4,
    },
    rowContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        alignItems: 'flex-start',
    },
    label: {
        color: '#E0E0E0',
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
    },
    value: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: 'bold',
        flex: 1,
        textAlign: 'right',
    },

    // Media
    mediaContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    taskImage: {
        width: 120,
        height: 120,
        borderRadius: 15,
        marginRight: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        backgroundColor: '#456276',
    },
    galleryButton: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    galleryText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
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
        color: '#FFFFFF',
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
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    postponeButton: {
        backgroundColor: '#456276',
    },
    finishButton: {
        backgroundColor: '#F39C12', // Orange distinctive for action
    },
    actionText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    }
})
