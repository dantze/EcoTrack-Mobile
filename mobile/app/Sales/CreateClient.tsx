import { StyleSheet, Text, View, Pressable, ScrollView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Alert, Image } from 'react-native'
import React, { useState } from 'react'
import { useRouter } from 'expo-router'
import { AntDesign, Feather } from '@expo/vector-icons';
import { ClientService, ClientType } from '../../services/ClientService';
import { PhotoService } from '../../services/PhotoService';
import { isValidEmail, isValidPhoneDigits } from '../../utils/validation';
import InputField from '../../components/forms/InputField';
import PhoneInputField from '../../components/forms/PhoneInputField';
import PrimaryButton from '../../components/forms/PrimaryButton';
import ScreenHeader from '../../components/layout/ScreenHeader';
import { AppColors } from '../../constants/Colors';
import * as ImagePicker from 'expo-image-picker';

const TIP_CLIENT = ["Persoană fizică", "Firme"];

const CreateClient = () => {
    const router = useRouter();

    // --- STATE ---
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedType, setSelectedType] = useState("Persoană fizică");

    // Form Data
    const [fullName, setFullName] = useState('');
    const [cnp, setCnp] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [countryCode, setCountryCode] = useState('+40');
    const [address, setAddress] = useState('');

    // ID Photo State
    const [idPhoto, setIdPhoto] = useState<string | null>(null);

    // Company specific fields
    const [companyName, setCompanyName] = useState('');
    const [cui, setCui] = useState('');
    const [adminName, setAdminName] = useState('');

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    const handleSelectType = (type: string) => {
        setSelectedType(type);
        setIsDropdownOpen(false);
    };

    const pickImage = async () => {
        // No permissions request is necessary for launching the image library
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            setIdPhoto(result.assets[0].uri);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permisiune necesară', 'Avem nevoie de permisiunea camerei pentru a face poze.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            setIdPhoto(result.assets[0].uri);
        }
    };

    const handleCreate = async (shouldCreateOrder = false) => {
        // Validation
        if (!email.trim() || !phone.trim() || !address.trim()) {
            Alert.alert("Lipsesc informații!");
            return;
        }

        if (!isValidEmail(email)) {
            Alert.alert("Email invalid", "Adresa de email trebuie să fie în formatul exemplu@domeniu.ro.");
            return;
        }

        if (!isValidPhoneDigits(phone)) {
            Alert.alert("Telefon invalid", "Numărul de telefon trebuie să conțină doar cifre (minim 4, maxim 15).");
            return;
        }

        if (selectedType === "Firme") {
            if (!companyName.trim() || !cui.trim() || !adminName.trim()) {
                Alert.alert("Lipsesc informații!");
                return;
            }
        }

        // Construct client data based on selected type
        const clientData = {
            type: (selectedType === "Firme" ? 'company' : 'individual') as ClientType,
            email,
            phone: countryCode + phone,
            address,
            // Include company fields only if type is 'Firme' (or always if backend expects them)
            name: selectedType === "Firme" ? companyName : '',

            CUI: selectedType === "Firme" ? cui : '',
            adminName: selectedType === "Firme" ? adminName : '',
            fullName: selectedType === "Persoană fizică" ? fullName : '',
            cnp: selectedType === "Persoană fizică" && cnp.trim() ? cnp.trim() : null,
        };

        console.log("Creating client with data:", clientData);

        try {
            const data = await ClientService.createClient(clientData);
            console.log('Client created successfully:', data);

            // Upload photo to DigitalOcean Spaces via PhotoService
            if (idPhoto && data?.id && selectedType === "Persoană fizică") {
                try {
                    console.log(`[CreateClient] Uploading photo for new client ID: ${data.id}`);
                    const uploadResult = await PhotoService.uploadIdPhoto(data.id, idPhoto);
                    console.log('[CreateClient] Photo uploaded to cloud:', uploadResult);
                } catch (photoError) {
                    console.error('[CreateClient] Cloud photo upload failed:', photoError);
                    Alert.alert(
                        "Eroare Buletin",
                        "Clientul a fost creat, dar poza de buletin nu a putut fi încărcată în cloud."
                    );
                }
            }

            if (shouldCreateOrder && data) {
                router.push({
                    pathname: '/Sales/OrderDetails',
                    params: { client: JSON.stringify(data) }
                });
            } else {
                router.back();
            }
        } catch (error) {
            console.error('[CreateClient] Error creating client:', error);
            Alert.alert("Eroare", "Nu s-a putut crea clientul. Te rog încearcă din nou.");
        }
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <ScreenHeader title="Creare Client" />

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    {/* --- DROPDOWN CLIENT TYPE --- */}
                    <View style={[styles.dropdownWrapper, { zIndex: 200 }]}>
                        <Pressable
                            style={styles.dropdownButton}
                            onPress={toggleDropdown}
                        >
                            <Text style={styles.dropdownButtonText}>{selectedType}</Text>
                            <AntDesign name={isDropdownOpen ? "up" : "down"} size={16} color="#16283C" />
                        </Pressable>

                        {isDropdownOpen && (
                            <View style={styles.dropdownList}>
                                {TIP_CLIENT.map((item, index) => (
                                    <Pressable
                                        key={index}
                                        style={styles.dropdownItem}
                                        onPress={() => handleSelectType(item)}
                                    >
                                        <Text style={styles.dropdownItemText}>{item}</Text>
                                        {index < TIP_CLIENT.length - 1 && <View style={styles.divider} />}
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* --- FORM FIELDS --- */}
                    <View style={{ zIndex: 100, width: '100%', marginTop: 20 }}>
                        {selectedType === "Persoană fizică" && (
                            <>
                                <InputField label="Nume Complet" value={fullName} onChangeText={setFullName} />
                                <InputField label="CNP" value={cnp} onChangeText={setCnp} placeholder="Opțional" keyboardType="numeric" />

                                {/* Photo Upload Section */}
                                <Text style={styles.label}>Buletin</Text>
                                <View style={styles.uploadContainer}>
                                    <View style={styles.dashedBox}>
                                        {idPhoto ? (
                                            <View style={{ alignItems: 'center', width: '100%' }}>
                                                <Image source={{ uri: idPhoto }} style={styles.previewImage} resizeMode="contain" />
                                                <Pressable onPress={() => setIdPhoto(null)} style={{ marginTop: 10 }}>
                                                    <Text style={{ color: '#FF4444', fontWeight: 'bold' }}>Șterge imaginea</Text>
                                                </Pressable>
                                            </View>
                                        ) : (
                                            <Pressable onPress={pickImage} style={styles.uploadTouchArea}>
                                                <Feather name="upload-cloud" size={50} color="#5A8DAB" />
                                                <Text style={styles.uploadTitle}>Atingeți pentru a încărca ID-ul</Text>
                                            </Pressable>
                                        )}

                                        <View style={styles.orRow}>
                                            <View style={styles.line} />
                                            <Text style={styles.orText}>sau</Text>
                                            <View style={styles.line} />
                                        </View>

                                        <Pressable onPress={takePhoto} style={styles.cameraButtonSmall}>
                                            <Text style={styles.cameraButtonTextSmall}>Deschide Camera</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </>
                        )}
                        <InputField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
                        <PhoneInputField
                            label="Telefon"
                            phoneNumber={phone}
                            onPhoneNumberChange={setPhone}
                            countryCode={countryCode}
                            onCountryCodeChange={setCountryCode}
                        />
                        <InputField label="Adresa" value={address} onChangeText={setAddress} />

                        {/* Conditional rendering for Company fields */}
                        {selectedType === "Firme" && (
                            <>
                                <InputField label="Nume companie" value={companyName} onChangeText={setCompanyName} />
                                <InputField label="CUI" value={cui} onChangeText={setCui} />
                                <InputField label="Nume administrator" value={adminName} onChangeText={setAdminName} />
                            </>
                        )}
                    </View>

                    {/* --- CREATE BUTTONS --- */}
                    <View style={{ width: '100%', marginTop: 30 }}>
                        <PrimaryButton label="Finalizare" onPress={() => handleCreate(false)} />
                        <PrimaryButton label="Creare Comanda Client" onPress={() => handleCreate(true)} />
                    </View>
                </ScrollView>

            </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
    )
}

export default CreateClient

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AppColors.screenBackground,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 100,
        alignItems: 'center',
    },

    // Dropdown
    dropdownWrapper: {
        width: '100%',
        position: 'relative',
    },
    dropdownButton: {
        width: '100%',
        height: 50,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
    },
    dropdownButtonText: {
        color: '#16283C',
        fontSize: 16,
        fontWeight: 'bold',
    },
    dropdownList: {
        position: 'absolute',
        top: 55,
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingVertical: 5,
        elevation: 5,
        zIndex: 1000,
    },
    dropdownItem: {
        paddingVertical: 12,
        paddingHorizontal: 15,
    },
    dropdownItemText: {
        color: '#16283C',
        fontSize: 16,
    },
    divider: {
        height: 1,
        backgroundColor: '#EEEEEE',
        width: '100%',
    },

    // Photo label (still needed locally for the "Buletin" label outside InputField)
    label: {
        color: AppColors.textWhite,
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 8,
        marginLeft: 5,
    },

    // Photo Upload Styles
    uploadContainer: {
        width: '90%',
        alignSelf: 'center',
        marginBottom: 20,
    },
    dashedBox: {
        borderWidth: 1.5,
        borderColor: '#5A8DAB', // Or a slightly lighter color
        borderStyle: 'dashed',
        borderRadius: 15,
        backgroundColor: '#1E3246', // Slightly lighter than background
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadTouchArea: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    uploadTitle: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 10,
        textAlign: 'center',
    },

    previewImage: {
        width: 200,
        height: 120,
        borderRadius: 10,
    },
    orRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginVertical: 15,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: '#5A8DAB',
        opacity: 0.5,
    },
    orText: {
        color: '#A0A0A0',
        marginHorizontal: 10,
        fontWeight: 'bold',
    },
    cameraButtonSmall: {
        backgroundColor: '#5A8DAB',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    cameraButtonTextSmall: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
})