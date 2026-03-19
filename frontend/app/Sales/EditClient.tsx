import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard,
    Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ClientService, ClientType } from '../../services/ClientService';
import { isValidEmail, isValidPhoneDigits } from '../../utils/validation';
import CloudPhotoViewer from '../../components/display/CloudPhotoViewer';
import InputField from '../../components/forms/InputField';
import PhoneInputField from '../../components/forms/PhoneInputField';
import { EUROPEAN_COUNTRIES } from '../../components/forms/PhoneInputField';
import PrimaryButton from '../../components/forms/PrimaryButton';
import ScreenHeader from '../../components/layout/ScreenHeader';

import { AppColors } from '../../constants/Colors';

export default function EditClient() {
    const router = useRouter();
    const params = useLocalSearchParams<{ client?: string }>();

    const clientData = params.client ? JSON.parse(params.client) : null;

    if (!clientData) {
        return (
            <View style={styles.centered}>
                <Text style={{ color: '#FFF', fontSize: 18 }}>Eroare: date client lipsă.</Text>
            </View>
        );
    }

    const isCompany = clientData.type === 'company';

    // Form state initialized with existing data
    const [fullName, setFullName] = useState(clientData.fullName || '');
    const [email, setEmail] = useState(clientData.email || '');
    // Parse existing phone to extract country code and number
    const parsePhone = (raw: string) => {
        if (!raw) return { code: '+40', number: '' };
        // Normalise: strip spaces, dashes, parentheses — keep digits and leading +
        const normalised = raw.replace(/[^+\d]/g, '');
        // Try to match known country codes (longest first)
        const sorted = [...EUROPEAN_COUNTRIES].sort((a, b) => b.code.length - a.code.length);
        for (const c of sorted) {
            if (normalised.startsWith(c.code)) {
                return { code: c.code, number: normalised.slice(c.code.length) };
            }
        }
        // Legacy Romanian local format: 07XXXXXXXX / 02XXXXXXXX (starts with 0, not 00)
        // Strip leading 0 → +40, e.g. 0730712100 → +40 + 730712100
        if (!normalised.startsWith('00') && normalised.startsWith('0')) {
            return { code: '+40', number: normalised.slice(1) };
        }
        return { code: '+40', number: normalised };
    };

    const parsed = parsePhone(clientData.phone || '');
    const [phone, setPhone] = useState(parsed.number);
    const [countryCode, setCountryCode] = useState(parsed.code);
    const [address, setAddress] = useState(clientData.address || '');
    const [companyName, setCompanyName] = useState(clientData.name || '');
    const [cui, setCui] = useState(clientData.cui || clientData.CUI || '');
    const [adminName, setAdminName] = useState(clientData.adminName || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!email.trim() || !phone.trim() || !address.trim()) {
            Alert.alert('Lipsesc informații', 'Completați email, telefon și adresă.');
            return;
        }

        if (!isValidEmail(email)) {
            Alert.alert('Email invalid', 'Adresa de email trebuie să fie în formatul exemplu@domeniu.ro.');
            return;
        }

        if (!isValidPhoneDigits(phone)) {
            Alert.alert('Telefon invalid', 'Numărul de telefon trebuie să conțină doar cifre (minim 4, maxim 15).');
            return;
        }

        if (isCompany && (!companyName.trim() || !cui.trim() || !adminName.trim())) {
            Alert.alert('Lipsesc informații', 'Completați toate câmpurile companiei.');
            return;
        }

        const updatedData = {
            type: (isCompany ? 'company' : 'individual') as ClientType,
            email: email.trim(),
            phone: countryCode + phone.trim(),
            address: address.trim(),
            name: isCompany ? companyName.trim() : '',
            CUI: isCompany ? cui.trim() : '',
            adminName: isCompany ? adminName.trim() : '',
            fullName: !isCompany ? fullName.trim() : '',
        };

        setSaving(true);
        try {
            await ClientService.updateClient(clientData.id, updatedData);
            Alert.alert('Succes', 'Clientul a fost actualizat.', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (error: any) {
            console.error('Error updating client:', error);
            Alert.alert('Eroare', error?.message || 'Nu s-a putut actualiza clientul.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <ScreenHeader title="Editare Client" />

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Client type indicator */}
                    <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>
                            {isCompany ? 'Firmă' : 'Persoană fizică'}
                        </Text>
                    </View>

                    {/* ID Photo for individual clients */}

                    <View style={{ width: '100%', marginTop: 16 }}>
                        <CloudPhotoViewer
                            photos={[clientData.idPhotoUrl]}
                            buttonLabel="Vezi Fotografia"
                            bannerLabel="Fotografie buletin salvată"
                        />
                    </View>

                    {/* Form fields */}
                    <View style={{ width: '100%', marginTop: 20 }}>
                        {!isCompany && (
                            <InputField label="Nume Complet" value={fullName} onChangeText={setFullName} />
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

                        {isCompany && (
                            <>
                                <InputField label="Nume companie" value={companyName} onChangeText={setCompanyName} />
                                <InputField label="CUI" value={cui} onChangeText={setCui} />
                                <InputField label="Nume administrator" value={adminName} onChangeText={setAdminName} />
                            </>
                        )}
                    </View>

                    {/* Save button */}
                    <View style={{ width: '100%', marginTop: 30 }}>
                        <PrimaryButton
                            label="Salvează Modificările"
                            onPress={handleSave}
                            loading={saving}
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AppColors.screenBackground,
    },
    centered: {
        flex: 1,
        backgroundColor: AppColors.screenBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 100,
        alignItems: 'center',
    },
    typeBadge: {
        backgroundColor: AppColors.buttonBackground,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        alignSelf: 'flex-start',
    },
    typeBadgeText: {
        color: AppColors.textWhite,
        fontSize: 16,
        fontWeight: '600',
    },
});
