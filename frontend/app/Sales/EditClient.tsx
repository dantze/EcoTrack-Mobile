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
import { isValidEmail, isValidPhone } from '../../utils/validation';
import InputField from '../../components/forms/InputField';
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
    const [phone, setPhone] = useState(clientData.phone || '');
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

        if (!isValidPhone(phone)) {
            Alert.alert('Telefon invalid', 'Numărul de telefon trebuie să fie în formatul 07XXXXXXXX sau +407XXXXXXXX.');
            return;
        }

        if (isCompany && (!companyName.trim() || !cui.trim() || !adminName.trim())) {
            Alert.alert('Lipsesc informații', 'Completați toate câmpurile companiei.');
            return;
        }

        const updatedData = {
            type: (isCompany ? 'company' : 'individual') as ClientType,
            email: email.trim(),
            phone: phone.trim(),
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

                    {/* Form fields */}
                    <View style={{ width: '100%', marginTop: 20 }}>
                        {!isCompany && (
                            <InputField label="Nume Complet" value={fullName} onChangeText={setFullName} />
                        )}

                        <InputField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
                        <InputField label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
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
