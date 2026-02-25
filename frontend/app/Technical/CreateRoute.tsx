import { StyleSheet, Text, View, Pressable, Alert, TextInput } from 'react-native'
import React, { useState } from 'react'
import { useRouter } from 'expo-router'
import { RouteService } from '../../services/RouteService';
import ScreenHeader from '../../components/ScreenHeader';
import FormPickerField from '../../components/FormPickerField';
import ListPickerModal, { ListPickerItem } from '../../modals/ListPickerModal';
import { AppColors } from '../../constants/Colors';
import { DAYS_OF_WEEK, COUNTIES, getDayOfWeekLabel } from '../../constants/RouteConstants';

const CreateRoute = () => {
    const router = useRouter();

    const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(null);
    const [showDayPicker, setShowDayPicker] = useState(false);
    const [selectedCounty, setSelectedCounty] = useState('');
    const [countyDropdownVisible, setCountyDropdownVisible] = useState(false);

    // Route name
    const [routeName, setRouteName] = useState('');


    // Prepare picker items
    const dayItems: ListPickerItem[] = DAYS_OF_WEEK.map(d => ({ key: String(d.value), label: d.label }));
    const countyItems: ListPickerItem[] = COUNTIES.map(c => ({ key: c, label: c }));

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

    const handleDaySelect = (item: ListPickerItem) => {
        setSelectedDayOfWeek(Number(item.key));
        setShowDayPicker(false);
    };

    const handleCountySelect = (item: ListPickerItem) => {
        setSelectedCounty(item.key);
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

                <FormPickerField
                    label="Ziua Săptămânii"
                    value={getDayOfWeekLabel(selectedDayOfWeek ?? undefined, '')}
                    placeholder="Selectează ziua..."
                    icon="calendar-outline"
                    onPress={() => setShowDayPicker(true)}
                />

                <FormPickerField
                    label="Județ"
                    value={selectedCounty}
                    placeholder="Selectează județul..."
                    onPress={() => setCountyDropdownVisible(true)}
                />

            </View>

            <ListPickerModal
                visible={showDayPicker}
                onClose={() => setShowDayPicker(false)}
                title="Selectează Ziua"
                items={dayItems}
                selectedKey={selectedDayOfWeek ? String(selectedDayOfWeek) : null}
                onSelect={handleDaySelect}
            />

            <ListPickerModal
                visible={countyDropdownVisible}
                onClose={() => setCountyDropdownVisible(false)}
                title="Selectează Județul"
                items={countyItems}
                selectedKey={selectedCounty || null}
                onSelect={handleCountySelect}
            />


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
