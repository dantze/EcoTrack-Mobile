import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, Image, Modal, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator } from 'react-native';
import { AppColors } from '../../constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PhotoGalleryProps {
    photos: string[];
    loading?: boolean;
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({ photos, loading = false }) => {
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={AppColors.textWhite} />
                <Text style={styles.loadingText}>Se încarcă pozele...</Text>
            </View>
        );
    }

    if (photos.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Ionicons name="images-outline" size={36} color="#456276" />
                <Text style={styles.emptyText}>Nicio poză disponibilă</Text>
            </View>
        );
    }

    return (
        <>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
            >
                {photos.map((url, index) => (
                    <Pressable
                        key={index}
                        onPress={() => setSelectedPhoto(url)}
                        style={({ pressed }) => [
                            styles.photoCard,
                            pressed && styles.photoPressed,
                        ]}
                    >
                        <Image source={{ uri: url }} style={styles.thumbnail} />
                        <Text style={styles.photoIndex}>{index + 1}</Text>
                    </Pressable>
                ))}
            </ScrollView>

            {/* Full-screen photo modal */}
            <Modal
                visible={!!selectedPhoto}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedPhoto(null)}
                statusBarTranslucent
            >
                <View style={styles.modalOverlay}>
                    <Pressable style={styles.modalClose} onPress={() => setSelectedPhoto(null)}>
                        <Ionicons name="close" size={30} color={AppColors.textWhite} />
                    </Pressable>
                    {selectedPhoto && (
                        <Image
                            source={{ uri: selectedPhoto }}
                            style={styles.modalImage}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>
        </>
    );
};

export default PhotoGallery;

const styles = StyleSheet.create({
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
    },
    loadingText: {
        color: AppColors.textWhite,
        marginLeft: 10,
        fontSize: 14,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 25,
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 12,
        marginBottom: 15,
    },
    emptyText: {
        color: '#456276',
        fontSize: 14,
        marginTop: 8,
    },
    scrollView: {
        marginBottom: 15,
        marginHorizontal: -5,
    },
    scrollContent: {
        paddingHorizontal: 5,
        gap: 10,
    },
    photoCard: {
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    photoPressed: {
        opacity: 0.8,
        transform: [{ scale: 0.96 }],
    },
    thumbnail: {
        width: 110,
        height: 110,
        borderRadius: 12,
        backgroundColor: '#456276',
    },
    photoIndex: {
        position: 'absolute',
        bottom: 4,
        right: 6,
        color: AppColors.textWhite,
        fontSize: 11,
        fontWeight: 'bold',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalClose: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 20,
        padding: 8,
    },
    modalImage: {
        width: SCREEN_WIDTH - 40,
        height: '70%',
    },
});
