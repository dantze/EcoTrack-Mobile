import { StyleSheet, Text, View, Pressable, ScrollView, Image } from 'react-native'
import React, { useState } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons';

// MOCK DATA EXTENDED
const TASK_DETAILS_MOCK = {
    id: 1,
    companyName: "Dansoft",
    lastSanitization: "12/02/2025",
    phone: "0747963611",
    taskType: "Placement/Sanitization/Pickup",
    secondaryPhone: "0747923422",
    description: "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s.",
    imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSCCvGfvCGF5vX0Dq2yT9YnfnvL_qVbCg4q4Q&s"
};

// 1. DEFINE TYPE FOR DETAIL ROW
type DetailRowProps = {
    label: string;
    value: string | number; // Can be text or number
};

const ServiceDetails = () => {
    const router = useRouter();
    const { id } = useLocalSearchParams();

    const [isExpanded, setIsExpanded] = useState(true);

    const data = TASK_DETAILS_MOCK;

    // 2. APPLY TYPE HERE (: DetailRowProps)
    const DetailRow = ({ label, value }: DetailRowProps) => (
        <View style={styles.rowContainer}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
        </View>
    );

    return (
        <View style={styles.container}>

            {/* --- HEADER WITH STATUS --- */}
            <View style={styles.headerContainer}>
                <Text style={styles.headerText}>Detalii Sarcină</Text>
                <View style={styles.statusContainer}>
                    <Text style={styles.statusText}>Status</Text>
                    <View style={styles.statusDot} />
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* --- MAIN BLUE CARD --- */}
                <View style={styles.mainCard}>

                    <DetailRow label="Nume Companie" value={data.companyName} />
                    <DetailRow label="Ultima Igienizare" value={data.lastSanitization} />
                    <DetailRow label="Telefon" value={data.phone} />

                    <View style={[styles.rowContainer, { marginTop: 10 }]}>
                        <Text style={styles.label}>Tip Sarcină</Text>
                    </View>
                    <Text style={[styles.value, { textAlign: 'right', marginBottom: 15 }]}>
                        {data.taskType}
                    </Text>

                    <Text style={[styles.label, { marginBottom: 10 }]}>Informații</Text>

                    {/* --- IMAGE AND GALLERY AREA --- */}
                    <View style={styles.mediaContainer}>
                        <Image
                            source={{ uri: data.imageUrl }}
                            style={styles.taskImage}
                        />

                        <Pressable
                            //style={styles.galleryButton}\
                            style={({ pressed }) => [styles.galleryButton, pressed && styles.cardPressed]}
                            onPress={() => console.log("Open gallery")}
                        >
                            <Text style={styles.galleryText}>Galerie</Text>
                            <Ionicons name="images-outline" size={20} color="white" style={{ marginLeft: 5 }} />
                        </Pressable>
                    </View>

                    <DetailRow label="Telefon Secundar" value={data.secondaryPhone} />

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
                            {data.description}
                        </Text>
                    )}

                </View>
            </ScrollView>

            {/* --- FOOTER BUTTONS --- */}
            <View style={styles.footerButtons}>
                <Pressable
                    //style={[styles.actionButton, styles.postponeButton]}
                    style={({ pressed }) => [styles.actionButton, styles.postponeButton, pressed && styles.cardPressed]}
                    onPress={() => console.log("Postpone")}
                >
                    <Text style={styles.actionText}>Amână</Text>
                </Pressable>

                <Pressable
                    //style={[styles.actionButton, styles.finishButton]}
                    style={({ pressed }) => [styles.actionButton, styles.finishButton, pressed && styles.cardPressed]}
                    onPress={() => console.log("Finalize")}
                >
                    <Text style={styles.actionText}>Finalizează</Text>
                </Pressable>
            </View>

        </View>
    )
}

export default ServiceDetails;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#16283C',
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
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerText: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: 'bold',
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: 'bold',
        marginRight: 8,
    },
    statusDot: {
        width: 15,
        height: 15,
        borderRadius: 8,
        backgroundColor: '#2ECC71', // Bright green
    },

    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 100, // Space for footer buttons
    },

    // Main Card Styles
    mainCard: {
        backgroundColor: '#5D8AA8', // Light blue
        borderRadius: 20,
        padding: 20,
        width: '100%',
        borderWidth: 2,
        borderColor: '#3498DB',
    },
    rowContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    label: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    value: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
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
    },
    descriptionText: {
        color: '#E0E0E0',
        fontSize: 13,
        lineHeight: 20,
        textAlign: 'justify',
        marginTop: 5,
    },

    // Footer Buttons
    footerButtons: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    actionButton: {
        width: '48%',
        height: 55,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
    },
    postponeButton: {
        backgroundColor: '#456276',
    },
    finishButton: {
        backgroundColor: '#427992',
    },
    actionText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    }
})
