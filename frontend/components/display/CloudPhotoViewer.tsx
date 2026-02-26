import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../../constants/Colors';
import PhotoGallery from './PhotoGallery';

interface CloudPhotoViewerProps {
    /** Either a static array of URLs or an async loader function */
    photos?: string[];
    loadPhotos?: () => Promise<string[]>;
    /** Label shown on the load button */
    buttonLabel?: string;
    /** Label shown on the banner */
    bannerLabel?: string;
}

const CloudPhotoViewer: React.FC<CloudPhotoViewerProps> = ({
    photos: staticPhotos,
    loadPhotos,
    buttonLabel = 'Vezi Pozele',
    bannerLabel = 'Pozele sunt salvate în cloud',
}) => {
    const [photos, setPhotos] = useState<string[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLoad = async () => {
        if (loaded) return;

        if (staticPhotos && staticPhotos.length > 0) {
            setPhotos(staticPhotos);
            setLoaded(true);
            return;
        }

        if (!loadPhotos) return;

        try {
            setLoading(true);
            const urls = await loadPhotos();
            setPhotos(urls);
            setLoaded(true);
        } catch {
            // Error handling left to the caller via loadPhotos
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.banner}>
                <Ionicons name="cloud-done" size={22} color={AppColors.successGreen} />
                <Text style={styles.bannerText}>{bannerLabel}</Text>
            </View>

            {loaded ? (
                <PhotoGallery photos={photos} loading={loading} />
            ) : (
                <Pressable
                    style={({ pressed }) => [
                        styles.loadButton,
                        pressed && { opacity: 0.7 },
                    ]}
                    onPress={handleLoad}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator size="small" color={AppColors.accentColor} />
                    ) : (
                        <Ionicons name="cloud-download-outline" size={22} color={AppColors.accentColor} />
                    )}
                    <Text style={styles.loadButtonText}>
                        {loading ? 'Se încarcă...' : buttonLabel}
                    </Text>
                </Pressable>
            )}
        </View>
    );
};

export default CloudPhotoViewer;

const styles = StyleSheet.create({
    container: {
        backgroundColor: AppColors.inputBackground,
        borderRadius: 12,
        padding: 16,
    },
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(76, 175, 80, 0.3)',
    },
    bannerText: {
        color: AppColors.successGreen,
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 10,
    },
    loadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: AppColors.buttonBackground,
        borderRadius: 10,
        paddingVertical: 12,
        gap: 8,
    },
    loadButtonText: {
        color: AppColors.accentColor,
        fontSize: 15,
        fontWeight: '500',
    },
});
