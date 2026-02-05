import { StyleSheet, Text, View, Pressable, Image } from 'react-native'
import React from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'

const mapImageSource = require('../../assets/images/harta_romania.png');

const Menu = () => {
    const router = useRouter();

    const { zone } = useLocalSearchParams<{ zone?: string }>();

    const titleZone = zone ? zone : "General";

    const handleClient = () => {

        console.log(`Navigate to CreateClient`);
        router.push({
            pathname: '/Sales/CreateClient',
        });
    };

    return (
        <View style={styles.container}>

            <View style={styles.headerContainer}>
                <Text style={styles.headerText}>Meniu - {titleZone}</Text>
            </View>

            <View style={styles.buttonsContainer}>

                <Pressable
                    style={({ pressed }) => [
                        styles.menuButton,
                        pressed && styles.buttonPressed
                    ]}
                    onPress={handleClient}
                >
                    <Text style={styles.buttonText}>Creare Client</Text>
                </Pressable>

                <View style={styles.separator} />


                <Pressable
                    style={({ pressed }) => [
                        styles.menuButton,
                        pressed && styles.buttonPressed
                    ]}
                    onPress={() => router.push({
                        pathname: '/Sales/CreateOrder',
                    })}
                >
                    <Text style={styles.buttonText}>Creare Comanda</Text>
                </Pressable>

                <View style={styles.separator} />

                <Pressable
                    style={({ pressed }) => [
                        styles.menuButton,
                        pressed && styles.buttonPressed
                    ]}
                    onPress={() => router.push({
                        pathname: '/Sales/AllOrdersMap',
                    })}
                >
                    <Text style={styles.buttonText}>Harta</Text>
                </Pressable>


                <View style={styles.separator} />

                <Pressable
                    style={({ pressed }) => [
                        styles.menuButton,
                        pressed && styles.buttonPressed
                    ]}
                    onPress={() => router.push({
                        pathname: '/Sales/ProductsAndSubscriptions',
                    })}
                >
                    <Text style={styles.buttonText}>Produse și Abonamente</Text>
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
    },
    headerText: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'left',
    },


    buttonsContainer: {
        alignItems: 'center',
        justifyContent: 'flex-start',
        flex: 1,
    },
    menuButton: {
        width: 280,
        height: 60,
        backgroundColor: '#427992',
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    buttonPressed: {
        opacity: 0.8,
        transform: [{ scale: 0.98 }]
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: 'bold',
    },


    separator: {
        width: 100,
        height: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        marginVertical: 15,
    },
    mapContainer: {
        width: '100%',
        height: 250,
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 80,
    },
    mapImage: {
        width: '90%',
        height: 250,
        opacity: 0.8,
    }
})
