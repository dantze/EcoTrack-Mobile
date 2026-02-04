import { StyleSheet, Text, View, Pressable, Image, ScrollView } from 'react-native'
import React, { useState } from 'react'
import { useRouter } from 'expo-router'
import { AntDesign } from '@expo/vector-icons';

const mapImageSource = require('../../assets/images/harta_romania.png');


const ZONES_DATA: Record<string, string[]> = {
    "Center": ["Alba", "Cluj", "Sibiu", "Hunedoara", "Brașov", "Mureș", "Covasna", "Harghita"],
    "West": ["Timiș", "Arad", "Caraș-Severin", "Bihor"]
};

const WestCenter = () => {
    const router = useRouter();


    const [isZoneOpen, setIsZoneOpen] = useState(false);
    const [isCountyOpen, setIsCountyOpen] = useState(false);

    const [selectedZone, setSelectedZone] = useState<string | null>(null);
    const [selectedCounty, setSelectedCounty] = useState<string | null>(null);


    const toggleZoneMenu = () => {
        setIsZoneOpen(!isZoneOpen);
        setIsCountyOpen(false);
    };

    const toggleCountyMenu = () => {
        if (selectedZone) {
            setIsCountyOpen(!isCountyOpen);
            setIsZoneOpen(false);
        } else {
            alert("Te rog selectează mai întâi o Zonă.");
        }
    };

    const handleSelectZone = (zone: string) => {
        setSelectedZone(zone);
        setSelectedCounty(null);
        setIsZoneOpen(false);
    };

    const handleSelectCounty = (county: string) => {
        setSelectedCounty(county);
        setIsCountyOpen(false);
    };

    const handleContinue = () => {
        if (selectedCounty) {
            console.log(`Navigate to Menu with zone: ${selectedZone}`);

            router.push({
                pathname: '/Sales/Menu',
                params: { zona: selectedZone }
            });
        } else {
            alert("Te rog selectează mai întâi un județ.");
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerContainer}>
                <Text style={styles.headerText}>Selectează Zona</Text>
            </View>

            <View style={styles.inputsContainer}>


                <View style={[styles.dropdownWrapper, { zIndex: 200 }]}>
                    <Pressable
                        style={({ pressed }) => [styles.zoneButton, pressed && styles.buttonPressed]}
                        onPress={toggleZoneMenu}
                    >
                        <Text style={styles.buttonText}>
                            {selectedZone ? selectedZone : "Selectează Zona"}
                        </Text>
                        <AntDesign name={isZoneOpen ? "up" : "down"} size={16} color="#16283C" />
                    </Pressable>

                    {isZoneOpen && (
                        <View style={styles.dropdownContent}>
                            {Object.keys(ZONES_DATA).map((zoneName, index) => (
                                <View key={index}>
                                    <Pressable
                                        style={styles.dropdownItem}
                                        onPress={() => handleSelectZone(zoneName)}
                                    >
                                        <Text style={styles.dropdownText}>{zoneName}</Text>
                                    </Pressable>
                                    {index < Object.keys(ZONES_DATA).length - 1 && <View style={styles.divider} />}
                                </View>
                            ))}
                        </View>
                    )}
                </View>


                <View style={[styles.dropdownWrapper, { zIndex: 100, marginTop: 15 }]}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.zoneButton,
                            pressed && styles.buttonPressed,
                            !selectedZone && styles.buttonDisabled
                        ]}
                        onPress={toggleCountyMenu}
                    >
                        <Text style={[styles.buttonText, !selectedZone && { color: '#999' }]}>
                            {selectedCounty ? selectedCounty : "Județ"}
                        </Text>
                        <AntDesign name={isCountyOpen ? "up" : "down"} size={16} color={selectedZone ? "#16283C" : "#999"} />
                    </Pressable>

                    {isCountyOpen && selectedZone && (
                        <View style={styles.dropdownContent}>
                            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled={true}>
                                {ZONES_DATA[selectedZone].map((countyName, index) => (
                                    <View key={index}>
                                        <Pressable
                                            style={styles.dropdownItem}
                                            onPress={() => handleSelectCounty(countyName)}
                                        >
                                            <Text style={styles.dropdownText}>{countyName}</Text>
                                        </Pressable>
                                        {index < ZONES_DATA[selectedZone].length - 1 && <View style={styles.divider} />}
                                    </View>
                                ))}
                            </ScrollView>
                        </View>
                    )}
                </View>


                {selectedCounty && (
                    <Pressable
                        style={({ pressed }) => [styles.continueButton, pressed && styles.buttonPressed]}
                        onPress={handleContinue}
                    >
                        <Text style={styles.continueButtonText}>Continuă</Text>
                    </Pressable>
                )}

            </View>

            <View style={styles.mapContainer}>
                <Image
                    source={mapImageSource}
                    style={styles.mapImage}
                    resizeMode="contain"
                />
            </View>
        </View>

    );
}

export default WestCenter;

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
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'left',
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
        marginTop: 30,
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
    mapImage: {
        width: '90%',
        height: 250,
        opacity: 0.8,
    }
})
