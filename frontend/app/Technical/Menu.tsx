import { StyleSheet, Text, View, Pressable, Image, ScrollView } from 'react-native'
import React, { useState } from 'react'
import { useRouter } from 'expo-router'
import { AntDesign, Ionicons } from '@expo/vector-icons';
const mapImageSource = require('../../assets/images/harta_romania.png');

const Menu = () => {
    const router = useRouter();
    const handlePress = () => {
        console.log('Button pressed')
    };
    return (
        <View style={styles.container}>
            <View style={styles.headerContainer}>
                <Pressable onPress={() => {
                    if (router.canGoBack()) {
                        router.back();
                    } else {
                        router.replace('/RoleSelection' as any);
                    }
                }} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </Pressable>
                <Text style={styles.headerText}>Meniu Tehnic</Text>
            </View>

            <View style={styles.buttonsContainer}>
                <Pressable
                    style={({ pressed }) => [
                        styles.optiuneButton,
                        pressed && styles.buttonPressed,
                    ]}
                    onPress={() =>

                        router.push({ pathname: '/Technical/Orders' })
                    }
                >
                    <Text style={styles.continueButtonText}>Comenzi</Text>
                </Pressable>

                <View style={styles.separator} />

                <Pressable style={({ pressed }) => [
                    styles.optiuneButton,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.99 }] }
                ]}
                    onPress={() =>

                        router.push({ pathname: '/Technical/Routes' })
                    }
                >
                    <Text style={styles.continueButtonText}>Rute</Text>
                </Pressable>

                <View style={styles.separator} />

                <Pressable style={({ pressed }) => [
                    styles.optiuneButton,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.99 }] }
                ]}
                    onPress={() =>

                        router.push({ pathname: '/Technical/RoutesAndDrivers' })
                    }
                >
                    <Text style={styles.continueButtonText}>Rute și Șoferi</Text>
                </Pressable>

                <View style={styles.separator} />

                <Pressable style={({ pressed }) => [
                    styles.optiuneButton,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.99 }] }
                ]}
                    onPress={() =>
                        router.push({ pathname: '/Technical/ChangeDriver' })
                    }
                >
                    <Text style={styles.continueButtonText}>Schimbare Șoferi și Rute</Text>
                </Pressable>

            </View>

            <View style={styles.mapContainer}>
                <Image
                    source={mapImageSource}
                    style={styles.mapImage}
                    resizeMode="contain"
                />
            </View>
        </View>
    )
}
export default Menu;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#16283C',
    },
    headerContainer: {
        marginTop: 60,
        paddingHorizontal: 20,
        width: '100%',
        marginBottom: 40,
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
    headerText: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'left',
    },
    subHeaderText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        marginTop: 4,
    },
    inputsContainer: {
        alignItems: 'center',
        zIndex: 10,
        paddingBottom: 50,
    },
    dropdownWrapper: {
        position: 'relative',
        width: 330,
        alignItems: 'center',
    },
    zoneButton: {
        width: '100%',
        height: 50,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 3,
    },
    buttonDisabled: {
        backgroundColor: '#E0E0E0',
    },
    buttonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.99 }]
    },
    buttonText: {
        color: '#16283C',
        fontSize: 16,
        fontWeight: 'bold',
    },
    dropdownContent: {
        position: 'absolute',
        top: 55,
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingVertical: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 10,
        overflow: 'hidden'
    },
    dropdownItem: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        justifyContent: 'center',
        backgroundColor: '#fff'
    },
    dropdownText: {
        color: '#16283C',
        fontSize: 16,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: '#EEEEEE',
        width: '100%',
    },


    continueButton: {
        marginTop: 10,
        width: 200,
        height: 50,
        backgroundColor: '#427992',
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        zIndex: 1,
    },
    optiuneButton: {
        //marginTop: 5, 
        width: 330,
        height: 50,
        backgroundColor: '#427992',
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        zIndex: 1,
    },
    continueButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },

    mapContainer: {
        flex: 1,
        width: '100%',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 80,
        zIndex: 1,
    },
    buttonsContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingBottom: 50,
        marginTop: 30,
    },
    separator: {
        width: 100,
        height: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        marginVertical: 15,
    },
    mapImage: {
        width: '90%',
        height: 250,
        opacity: 0.8,
    }
})
