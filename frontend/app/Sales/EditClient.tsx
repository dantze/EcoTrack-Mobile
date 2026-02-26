import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    Pressable,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ClientService, ClientType } from '../../services/ClientService';

type InputFieldProps = {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
};

const InputField = ({ label, value, onChangeText, placeholder = '', keyboardType = 'default' }: InputFieldProps) => (
    <View style={styles.inputWrapper}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#999"
            keyboardType={keyboardType}
        />
    </View>
);

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

        // Email must be valid format: XX@XX.XX
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            Alert.alert('Email invalid', 'Adresa de email trebuie să fie în formatul exemplu@domeniu.ro.');
            return;
        }

        // Phone must be valid Romanian format: 0XXXXXXXXX or +40XXXXXXXXX
        if (!/^(\+40\d{9}|0\d{9})$/.test(phone.trim())) {
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
                <View style={styles.headerContainer}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                    </Pressable>
                    <Text style={styles.headerText}>Editare Client</Text>
                </View>

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
                        <Pressable
                            style={({ pressed }) => [
                                styles.saveButton,
                                pressed && { opacity: 0.9 },
                                saving && { opacity: 0.6 },
                            ]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.saveButtonText}>Salvează Modificările</Text>
                            )}
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#16283C',
    },
    centered: {
        flex: 1,
        backgroundColor: '#16283C',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerContainer: {
        marginTop: 75,
        paddingHorizontal: 20,
        marginBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        marginRight: 15,
    },
    headerText: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: 'bold',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 100,
        alignItems: 'center',
    },
    typeBadge: {
        backgroundColor: '#427992',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        alignSelf: 'flex-start',
    },
    typeBadgeText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    inputWrapper: {
        marginBottom: 15,
        width: '100%',
    },
    label: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 8,
        marginLeft: 5,
    },
    input: {
        width: '100%',
        height: 45,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 15,
        fontSize: 16,
        color: '#16283C',
    },
    saveButton: {
        width: '100%',
        height: 55,
        backgroundColor: '#427992',
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
