import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator, Alert, Linking, Image } from 'react-native'
import React, { useEffect, useState } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../constants/ApiConfig';
import * as ImagePicker from 'expo-image-picker';

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

const TASK_TYPE_LABELS: { [key: string]: string } = {
    'PLACEMENT': 'Amplasare',
    'PICKUP': 'Ridicare',
    'SANITIZATION': 'Igienizare',
    'MAINTENANCE': 'Mentenanță',
};

const STATUS_LABELS: { [key: string]: string } = {
    'NEW': 'Nouă',
    'IN_PROGRESS': 'În progres',
    'COMPLETED': 'Finalizată',
    'CANCELLED': 'Anulată',
};

const STATUS_COLORS: { [key: string]: string } = {
    'NEW': '#FFA500',
    'IN_PROGRESS': '#2196F3',
    'COMPLETED': '#4CAF50',
    'CANCELLED': '#F44336',
};

const TaskDetails = () => {
    const router = useRouter();
    const { taskId } = useLocalSearchParams<{ taskId: string }>();

    const [task, setTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(true);
    const [photos, setPhotos] = useState<string[]>([]);

    useEffect(() => {
        if (taskId) {
            fetchTask();
        }
    }, [taskId]);

    const fetchTask = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch task. Status: ${response.status}`);
            }
            const data: Task = await response.json();
            console.log('Fetched task:', data);
            setTask(data);
        } catch (error) {
            console.error("Error fetching task:", error);
            Alert.alert('Eroare', 'Nu s-a putut încărca sarcina');
        } finally {
            setLoading(false);
        }
    };

    const updateTaskStatus = async (newStatus: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!response.ok) {
                throw new Error('Failed to update task status');
            }

            const statusLabel = STATUS_LABELS[newStatus] || newStatus;
            Alert.alert('Succes', `Sarcina a fost marcată ca "${statusLabel}"`);
            fetchTask(); // Refresh task
        } catch (error) {
            console.error('Error updating task:', error);
            Alert.alert('Eroare', 'Nu s-a putut actualiza sarcina');
        }
    };

    const handleCall = () => {
        if (task?.clientPhone) {
            Linking.openURL(`tel:${task.clientPhone}`);
        }
    };

    const handleNavigate = () => {
        if (task?.address) {
            const encodedAddress = encodeURIComponent(task.address);
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`);
        }
    };

    const handleStartTask = () => {
        Alert.alert(
            'Începe Sarcina',
            'Ești sigur că vrei să începi această sarcină?',
            [
                { text: 'Anulează', style: 'cancel' },
                { text: 'Începe', onPress: () => updateTaskStatus('IN_PROGRESS') }
            ]
        );
    };

    const handleCompleteTask = () => {
        Alert.alert(
            'Finalizare Sarcină',
            'Ești sigur că vrei să marchezi sarcina ca finalizată?',
            [
                { text: 'Anulează', style: 'cancel' },
                { text: 'Finalizează', onPress: () => updateTaskStatus('COMPLETED') }
            ]
        );
    };

    // Photo functionality
    const handleAddPhotos = () => {
        Alert.alert(
            'Adaugă Poze',
            'De unde vrei să adaugi pozele?',
            [
                { text: 'Anulează', style: 'cancel' },
                { text: '📷 Camera', onPress: handleTakePhoto },
                { text: '🖼️ Galerie', onPress: handlePickFromGallery },
            ]
        );
    };

    const handleTakePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permisiune necesară', 'Aplicația are nevoie de acces la cameră pentru a face poze.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: false,
        });

        if (!result.canceled && result.assets.length > 0) {
            const newUris = result.assets.map(asset => asset.uri);
            setPhotos(prev => [...prev, ...newUris]);
        }
    };

    const handlePickFromGallery = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permisiune necesară', 'Aplicația are nevoie de acces la galerie pentru a selecta poze.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsMultipleSelection: true,
        });

        if (!result.canceled && result.assets.length > 0) {
            const newUris = result.assets.map(asset => asset.uri);
            setPhotos(prev => [...prev, ...newUris]);
        }
    };

    const handleRemovePhoto = (index: number) => {
        Alert.alert(
            'Șterge Poza',
            'Ești sigur că vrei să ștergi această poză?',
            [
                { text: 'Anulează', style: 'cancel' },
                {
                    text: 'Șterge',
                    style: 'destructive',
                    onPress: () => {
                        setPhotos(prev => prev.filter((_, i) => i !== index));
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.loadingContainer]}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.loadingText}>Se încarcă detaliile...</Text>
            </View>
        );
    }

    if (!task) {
        return (
            <View style={[styles.container, styles.loadingContainer]}>
                <Ionicons name="warning" size={60} color="#F44336" />
                <Text style={styles.errorText}>Sarcina nu a fost găsită</Text>
                <Pressable style={styles.backButtonLarge} onPress={() => router.back()}>
                    <Text style={styles.backButtonText}>Înapoi</Text>
                </Pressable>
            </View>
        );
    }

    const hasPhotos = photos.length > 0;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.headerContainer}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </Pressable>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerText}>Detalii Sarcină</Text>
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[task.status] }]}>
                        <Text style={styles.statusText}>{STATUS_LABELS[task.status]}</Text>
                    </View>
                </View>
            </View>

            <ScrollView
                style={styles.scrollContainer}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Task Type - simple text, no icon */}
                <View style={styles.typeCard}>
                    <Text style={styles.typeText}>{TASK_TYPE_LABELS[task.type] || task.type}</Text>
                </View>

                {/* Client Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Informații Client</Text>

                    <View style={styles.infoRow}>
                        <Ionicons name="person" size={20} color="#5D8AA8" />
                        <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>Nume</Text>
                            <Text style={styles.infoValue}>{task.clientName || 'Necunoscut'}</Text>
                        </View>
                    </View>

                    {task.clientPhone && (
                        <Pressable style={styles.infoRow} onPress={handleCall}>
                            <Ionicons name="call" size={20} color="#4CAF50" />
                            <View style={styles.infoContent}>
                                <Text style={styles.infoLabel}>Telefon</Text>
                                <Text style={[styles.infoValue, styles.linkText]}>{task.clientPhone}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#5D8AA8" />
                        </Pressable>
                    )}
                </View>

                {/* Location Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Locație</Text>

                    <Pressable style={styles.infoRow} onPress={handleNavigate}>
                        <Ionicons name="location" size={20} color="#F44336" />
                        <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>Adresă</Text>
                            <Text style={[styles.infoValue, styles.linkText]}>{task.address || 'Necunoscută'}</Text>
                        </View>
                        <Ionicons name="navigate" size={20} color="#5D8AA8" />
                    </Pressable>
                </View>

                {/* Notes */}
                {task.internalNotes && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Note Interne</Text>
                        <View style={styles.notesContainer}>
                            <Text style={styles.notesText}>{task.internalNotes}</Text>
                        </View>
                    </View>
                )}

                {/* Photos Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Poze ({photos.length})</Text>

                    {/* Photo grid */}
                    {hasPhotos && (
                        <View style={styles.photoGrid}>
                            {photos.map((uri, index) => (
                                <Pressable
                                    key={index}
                                    style={styles.photoWrapper}
                                    onLongPress={() => handleRemovePhoto(index)}
                                >
                                    <Image source={{ uri }} style={styles.photoImage} />
                                    <Pressable
                                        style={styles.removePhotoButton}
                                        onPress={() => handleRemovePhoto(index)}
                                    >
                                        <Ionicons name="close-circle" size={22} color="#FF5252" />
                                    </Pressable>
                                </Pressable>
                            ))}
                        </View>
                    )}

                    {/* Add photos button */}
                    <Pressable
                        style={({ pressed }) => [
                            styles.addPhotoButton,
                            pressed && { opacity: 0.7 }
                        ]}
                        onPress={handleAddPhotos}
                    >
                        <Ionicons name="camera" size={28} color="#5D8AA8" />
                        <Text style={styles.addPhotoText}>Adaugă Poze</Text>
                        <Text style={styles.addPhotoSubtext}>Apasă pentru a face sau selecta poze</Text>
                    </Pressable>
                </View>

                {/* Quick Actions */}
                <View style={styles.quickActions}>
                    <Pressable
                        style={[styles.quickActionButton, { backgroundColor: '#4CAF50' }]}
                        onPress={handleCall}
                    >
                        <Ionicons name="call" size={24} color="#FFFFFF" />
                        <Text style={styles.quickActionText}>Sună</Text>
                    </Pressable>

                    <Pressable
                        style={[styles.quickActionButton, { backgroundColor: '#2196F3' }]}
                        onPress={handleNavigate}
                    >
                        <Ionicons name="navigate" size={24} color="#FFFFFF" />
                        <Text style={styles.quickActionText}>Navighează</Text>
                    </Pressable>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Bottom Action Button */}
            {task.status === 'NEW' && (
                <View style={styles.bottomAction}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.actionButton,
                            { backgroundColor: '#2196F3' },
                            pressed && styles.buttonPressed
                        ]}
                        onPress={handleStartTask}
                    >
                        <Ionicons name="play" size={24} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Începe Sarcina</Text>
                    </Pressable>
                </View>
            )}

            {task.status === 'IN_PROGRESS' && hasPhotos && (
                <View style={styles.bottomAction}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.actionButton,
                            { backgroundColor: '#4CAF50' },
                            pressed && styles.buttonPressed
                        ]}
                        onPress={handleCompleteTask}
                    >
                        <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Finalizează Sarcina</Text>
                    </Pressable>
                </View>
            )}

            {task.status === 'IN_PROGRESS' && !hasPhotos && (
                <View style={styles.bottomAction}>
                    <View style={styles.noPhotosWarning}>
                        <Ionicons name="camera-outline" size={20} color="#FFA500" />
                        <Text style={styles.noPhotosWarningText}>Adaugă poze pentru a putea finaliza sarcina</Text>
                    </View>
                </View>
            )}

            {task.status === 'COMPLETED' && (
                <View style={styles.bottomAction}>
                    <View style={[styles.completedBanner]}>
                        <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                        <Text style={styles.completedBannerText}>Sarcină Finalizată</Text>
                    </View>
                </View>
            )}
        </View>
    )
}

export default TaskDetails

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
    errorText: {
        color: '#F44336',
        marginTop: 15,
        fontSize: 18,
    },
    headerContainer: {
        marginTop: 60,
        paddingHorizontal: 20,
        width: '100%',
        marginBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#427992',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    backButtonLarge: {
        backgroundColor: '#427992',
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 20,
        marginTop: 20,
    },
    backButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    headerTextContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerText: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: 'bold',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
    },
    statusText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    scrollContainer: {
        flex: 1,
        paddingHorizontal: 20,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    typeCard: {
        backgroundColor: '#427992',
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 20,
        alignItems: 'center',
        marginBottom: 20,
    },
    typeText: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: 'bold',
    },
    section: {
        backgroundColor: '#2A4158',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    sectionTitle: {
        color: '#5D8AA8',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 12,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    infoContent: {
        flex: 1,
        marginLeft: 12,
    },
    infoLabel: {
        color: '#5D8AA8',
        fontSize: 11,
    },
    infoValue: {
        color: '#FFFFFF',
        fontSize: 16,
        marginTop: 2,
    },
    linkText: {
        color: '#64B5F6',
    },
    notesContainer: {
        backgroundColor: '#16283C',
        borderRadius: 8,
        padding: 12,
    },
    notesText: {
        color: '#E0E0E0',
        fontSize: 14,
        lineHeight: 20,
    },

    // Photos
    photoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 12,
        gap: 8,
    },
    photoWrapper: {
        width: 90,
        height: 90,
        borderRadius: 10,
        overflow: 'hidden',
        position: 'relative',
    },
    photoImage: {
        width: '100%',
        height: '100%',
        borderRadius: 10,
    },
    removePhotoButton: {
        position: 'absolute',
        top: 2,
        right: 2,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 11,
    },
    addPhotoButton: {
        borderWidth: 2,
        borderColor: '#427992',
        borderStyle: 'dashed',
        borderRadius: 12,
        paddingVertical: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addPhotoText: {
        color: '#5D8AA8',
        fontSize: 16,
        fontWeight: '600',
        marginTop: 8,
    },
    addPhotoSubtext: {
        color: '#3E6B84',
        fontSize: 12,
        marginTop: 4,
    },

    quickActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    quickActionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        marginHorizontal: 5,
    },
    quickActionText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
    },
    bottomAction: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        backgroundColor: '#16283C',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
    },
    buttonPressed: {
        opacity: 0.8,
        transform: [{ scale: 0.98 }]
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    completedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2A4158',
        paddingVertical: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#4CAF50',
    },
    completedBannerText: {
        color: '#4CAF50',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    noPhotosWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2A4158',
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FFA500',
    },
    noPhotosWarningText: {
        color: '#FFA500',
        fontSize: 13,
        fontWeight: '500',
        marginLeft: 8,
    },
})
