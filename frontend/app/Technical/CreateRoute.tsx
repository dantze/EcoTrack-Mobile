import { StyleSheet, Text, View, Pressable, Alert, Modal, ScrollView, Platform, TextInput } from 'react-native'
import React, { useState } from 'react'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons';
import { RouteService } from '../../services/RouteService';
import ScreenHeader from '../../components/ScreenHeader';
import { AppColors } from '../../constants/Colors';

// Lista de județe
const COUNTIES = [
    'Alba', 'Arad', 'Argeș', 'Bacău', 'Bihor', 'Bistrița-Năsăud', 'Botoșani',
    'Brașov', 'Brăila', 'București', 'Buzău', 'Caraș-Severin', 'Călărași',
    'Cluj', 'Constanța', 'Covasna', 'Dâmbovița', 'Dolj', 'Galați', 'Giurgiu',
    'Gorj', 'Harghita', 'Hunedoara', 'Ialomița', 'Iași', 'Ilfov', 'Maramureș',
    'Mehedinți', 'Mureș', 'Neamț', 'Olt', 'Prahova', 'Satu Mare', 'Sălaj',
    'Sibiu', 'Suceava', 'Teleorman', 'Timiș', 'Tulcea', 'Vaslui', 'Vâlcea', 'Vrancea'
];

// Zilele săptămânii (1=Luni, 2=Marți, ..., 7=Duminică)
const DAYS_OF_WEEK = [
    { value: 1, label: 'Luni' },
    { value: 2, label: 'Marți' },
    { value: 3, label: 'Miercuri' },
    { value: 4, label: 'Joi' },
    { value: 5, label: 'Vineri' },
    { value: 6, label: 'Sâmbătă' },
    { value: 7, label: 'Duminică' },
];

const CreateRoute = () => {
    const router = useRouter();

    const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(null);
    const [showDayPicker, setShowDayPicker] = useState(false);
    const [selectedCounty, setSelectedCounty] = useState('');
    const [countyDropdownVisible, setCountyDropdownVisible] = useState(false);

    // Route name
    const [routeName, setRouteName] = useState('');


    const handleFinalize = async () => {
        if (!routeName.trim()) {
            Alert.alert('Eroare', 'Te rog introdu un nume pentru rută.');
            return;
        }

        if (!selectedCounty) {
            Alert.alert('Eroare', 'Te rog selectează un județ.');
            return;
        }

        if (!selectedDayOfWeek) {
            Alert.alert('Eroare', 'Te rog selectează ziua săptămânii.');
            return;
        }

        try {
            const routeData: any = {
                name: routeName.trim(),
                dayOfWeek: selectedDayOfWeek,
                county: selectedCounty,
            };

            await RouteService.createRoute(routeData);

            Alert.alert(
                'Succes',
                `Ruta "${routeName}" a fost creată!`,
                [
                    {
                        text: 'OK',
                        onPress: () => router.back()
                    }
                ]
            );
        } catch (error) {
            console.error(error);
            Alert.alert('Eroare', 'Nu s-a putut crea ruta. Te rog încearcă din nou.');
        }
    };

    const getDayLabel = (dayValue: number | null) => {
        if (!dayValue) return null;
        const day = DAYS_OF_WEEK.find(d => d.value === dayValue);
        return day ? day.label : null;
    };

    const handleDaySelect = (dayValue: number) => {
        setSelectedDayOfWeek(dayValue);
        setShowDayPicker(false);
    };

    const handleCountySelect = (county: string) => {
        setSelectedCounty(county);
        setCountyDropdownVisible(false);
    };



    return (
        <View style={styles.container}>
            <ScreenHeader title="Creare Rută" />

            {/* Form Container */}
            <View style={styles.formContainer}>
                {/* Route Name Input */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Nume Rută</Text>
                    <TextInput
                        style={styles.textInput}
                        value={routeName}
                        onChangeText={setRouteName}
                        placeholder="ex: Ruta Cluj Vest"
                        placeholderTextColor="#888"
                    />
                </View>

                {/* Day of Week Picker */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Ziua Săptămânii</Text>
                    <Pressable
                        style={styles.dropdownButton}
                        onPress={() => setShowDayPicker(true)}
                    >
                        <Ionicons name="calendar-outline" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
                        <Text style={[
                            styles.dropdownButtonText,
                            !selectedDayOfWeek && styles.placeholderText
                        ]}>
                            {getDayLabel(selectedDayOfWeek) || 'Selectează ziua...'}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#FFFFFF" />
                    </Pressable>
                </View>

                {/* County Dropdown */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Județ</Text>
                    <Pressable
                        style={styles.dropdownButton}
                        onPress={() => setCountyDropdownVisible(true)}
                    >
                        <Text style={[
                            styles.dropdownButtonText,
                            !selectedCounty && styles.placeholderText
                        ]}>
                            {selectedCounty || 'Selectează județul...'}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#FFFFFF" />
                    </Pressable>
                </View>

            </View>

            {/* Day of Week Picker Modal */}
            <Modal
                visible={showDayPicker}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDayPicker(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setShowDayPicker(false)}
                >
                    <View style={styles.dropdownModal}>
                        <Text style={styles.dropdownTitle}>Selectează Ziua</Text>
                        <ScrollView style={styles.dropdownList}>
                            {DAYS_OF_WEEK.map((day) => (
                                <Pressable
                                    key={day.value}
                                    style={({ pressed }) => [
                                        styles.dropdownItem,
                                        selectedDayOfWeek === day.value && styles.dropdownItemSelected,
                                        pressed && styles.dropdownItemPressed
                                    ]}
                                    onPress={() => handleDaySelect(day.value)}
                                >
                                    <Text style={[
                                        styles.dropdownItemText,
                                        selectedDayOfWeek === day.value && styles.dropdownItemTextSelected
                                    ]}>
                                        {day.label}
                                    </Text>
                                    {selectedDayOfWeek === day.value && (
                                        <Ionicons name="checkmark" size={20} color="#4CAF50" />
                                    )}
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>

            {/* County Dropdown Modal */}
            <Modal
                visible={countyDropdownVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setCountyDropdownVisible(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setCountyDropdownVisible(false)}
                >
                    <View style={styles.dropdownModal}>
                        <Text style={styles.dropdownTitle}>Selectează Județul</Text>
                        <ScrollView style={styles.dropdownList}>
                            {COUNTIES.map((county) => (
                                <Pressable
                                    key={county}
                                    style={({ pressed }) => [
                                        styles.dropdownItem,
                                        selectedCounty === county && styles.dropdownItemSelected,
                                        pressed && styles.dropdownItemPressed
                                    ]}
                                    onPress={() => handleCountySelect(county)}
                                >
                                    <Text style={[
                                        styles.dropdownItemText,
                                        selectedCounty === county && styles.dropdownItemTextSelected
                                    ]}>
                                        {county}
                                    </Text>
                                    {selectedCounty === county && (
                                        <Ionicons name="checkmark" size={20} color="#4CAF50" />
                                    )}
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>


            {/* Finalize Button */}
            <View style={styles.bottomContainer}>
                <Pressable
                    style={({ pressed }) => [
                        styles.finalizeButton,
                        pressed && styles.buttonPressed
                    ]}
                    onPress={handleFinalize}
                >
                    <Text style={styles.finalizeButtonText}>Creează Rută</Text>
                </Pressable>
            </View>
        </View>
    )
}

export default CreateRoute

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AppColors.screenBackground,
    },
    formContainer: {
        flex: 1,
        paddingHorizontal: 20,
    },
    inputGroup: {
        marginBottom: 25,
    },
    label: {
        color: AppColors.textWhite,
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
    },
    textInput: {
        backgroundColor: AppColors.inputBackground,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: AppColors.textWhite,
        borderWidth: 1,
        borderColor: AppColors.buttonBackground,
    },
    dropdownButton: {
        backgroundColor: AppColors.inputBackground,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: AppColors.buttonBackground,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dropdownButtonText: {
        fontSize: 16,
        color: AppColors.textWhite,
    },
    placeholderText: {
        color: '#888',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dropdownModal: {
        backgroundColor: AppColors.inputBackground,
        borderRadius: 16,
        width: '80%',
        maxHeight: '60%',
        padding: 20,
    },
    calendarModal: {
        backgroundColor: AppColors.inputBackground,
        borderRadius: 16,
        width: '90%',
        padding: 20,
    },
    dropdownTitle: {
        color: AppColors.textWhite,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },
    dropdownList: {
        maxHeight: 300,
    },
    dropdownItem: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5,
    },
    dropdownItemSelected: {
        backgroundColor: AppColors.screenBackground,
    },
    dropdownItemPressed: {
        backgroundColor: AppColors.screenBackground,
        opacity: 0.8,
    },
    dropdownItemText: {
        color: AppColors.textWhite,
        fontSize: 16,
    },
    dropdownItemTextSelected: {
        fontWeight: 'bold',
    },
    driverCountyText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 12,
        marginTop: 2,
    },
    loadingText: {
        color: AppColors.textWhite,
        fontSize: 16,
        textAlign: 'center',
        padding: 20,
    },
    emptyText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 16,
        textAlign: 'center',
        padding: 20,
    },
    bottomContainer: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    finalizeButton: {
        backgroundColor: AppColors.successGreen,
        borderRadius: 20,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        shadowColor: AppColors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    buttonPressed: {
        opacity: 0.8,
        transform: [{ scale: 0.98 }]
    },
    finalizeButtonText: {
        color: AppColors.textWhite,
        fontSize: 18,
        fontWeight: 'bold',
    },
})
