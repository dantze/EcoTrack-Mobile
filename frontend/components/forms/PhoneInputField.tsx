import React, { useState, useMemo } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    Pressable,
    Modal,
    TouchableOpacity,
    FlatList,
} from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { AppColors } from '../../constants/Colors';

// ─── European Country Data ──────────────────────────────────────────────────
export interface CountryEntry {
    name: string;
    flag: string;
    code: string; // e.g. "+40"
}

export const EUROPEAN_COUNTRIES: CountryEntry[] = [
    { name: 'Albania', flag: '🇦🇱', code: '+355' },
    { name: 'Andorra', flag: '🇦🇩', code: '+376' },
    { name: 'Austria', flag: '🇦🇹', code: '+43' },
    { name: 'Belarus', flag: '🇧🇾', code: '+375' },
    { name: 'Belgia', flag: '🇧🇪', code: '+32' },
    { name: 'Bosnia și Herțegovina', flag: '🇧🇦', code: '+387' },
    { name: 'Bulgaria', flag: '🇧🇬', code: '+359' },
    { name: 'Cehia', flag: '🇨🇿', code: '+420' },
    { name: 'Cipru', flag: '🇨🇾', code: '+357' },
    { name: 'Croația', flag: '🇭🇷', code: '+385' },
    { name: 'Danemarca', flag: '🇩🇰', code: '+45' },
    { name: 'Elveția', flag: '🇨🇭', code: '+41' },
    { name: 'Estonia', flag: '🇪🇪', code: '+372' },
    { name: 'Finlanda', flag: '🇫🇮', code: '+358' },
    { name: 'Franța', flag: '🇫🇷', code: '+33' },
    { name: 'Germania', flag: '🇩🇪', code: '+49' },
    { name: 'Grecia', flag: '🇬🇷', code: '+30' },
    { name: 'Irlanda', flag: '🇮🇪', code: '+353' },
    { name: 'Islanda', flag: '🇮🇸', code: '+354' },
    { name: 'Italia', flag: '🇮🇹', code: '+39' },
    { name: 'Kosovo', flag: '🇽🇰', code: '+383' },
    { name: 'Letonia', flag: '🇱🇻', code: '+371' },
    { name: 'Liechtenstein', flag: '🇱🇮', code: '+423' },
    { name: 'Lituania', flag: '🇱🇹', code: '+370' },
    { name: 'Luxemburg', flag: '🇱🇺', code: '+352' },
    { name: 'Macedonia de Nord', flag: '🇲🇰', code: '+389' },
    { name: 'Malta', flag: '🇲🇹', code: '+356' },
    { name: 'Moldova', flag: '🇲🇩', code: '+373' },
    { name: 'Monaco', flag: '🇲🇨', code: '+377' },
    { name: 'Muntenegru', flag: '🇲🇪', code: '+382' },
    { name: 'Norvegia', flag: '🇳🇴', code: '+47' },
    { name: 'Olanda', flag: '🇳🇱', code: '+31' },
    { name: 'Polonia', flag: '🇵🇱', code: '+48' },
    { name: 'Portugalia', flag: '🇵🇹', code: '+351' },
    { name: 'Regatul Unit', flag: '🇬🇧', code: '+44' },
    { name: 'România', flag: '🇷🇴', code: '+40' },
    { name: 'San Marino', flag: '🇸🇲', code: '+378' },
    { name: 'Serbia', flag: '🇷🇸', code: '+381' },
    { name: 'Slovacia', flag: '🇸🇰', code: '+421' },
    { name: 'Slovenia', flag: '🇸🇮', code: '+386' },
    { name: 'Spania', flag: '🇪🇸', code: '+34' },
    { name: 'Suedia', flag: '🇸🇪', code: '+46' },
    { name: 'Turcia', flag: '🇹🇷', code: '+90' },
    { name: 'Ucraina', flag: '🇺🇦', code: '+380' },
    { name: 'Ungaria', flag: '🇭🇺', code: '+36' },
    { name: 'Vatican', flag: '🇻🇦', code: '+379' },
];

// ─── Props ──────────────────────────────────────────────────────────────────
export interface PhoneInputFieldProps {
    label: string;
    phoneNumber: string;
    onPhoneNumberChange: (text: string) => void;
    countryCode: string;
    onCountryCodeChange: (code: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────
const PhoneInputField: React.FC<PhoneInputFieldProps> = ({
    label,
    phoneNumber,
    onPhoneNumberChange,
    countryCode,
    onCountryCodeChange,
}) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [search, setSearch] = useState('');

    const selectedCountry = EUROPEAN_COUNTRIES.find(c => c.code === countryCode) ||
        EUROPEAN_COUNTRIES.find(c => c.code === '+40')!;

    const filteredCountries = useMemo(() => {
        if (!search.trim()) return EUROPEAN_COUNTRIES;
        const lq = search.toLowerCase();
        return EUROPEAN_COUNTRIES.filter(
            c => c.name.toLowerCase().includes(lq) || c.code.includes(lq),
        );
    }, [search]);

    const handlePhoneChange = (text: string) => {
        // Strip everything except digits
        onPhoneNumberChange(text.replace(/[^0-9]/g, ''));
    };

    const handleSelectCountry = (country: CountryEntry) => {
        onCountryCodeChange(country.code);
        setModalVisible(false);
        setSearch('');
    };

    return (
        <View style={styles.inputWrapper}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.row}>
                {/* Prefix Selector Button */}
                <Pressable
                    style={styles.prefixButton}
                    onPress={() => setModalVisible(true)}
                >
                    <Text style={styles.prefixFlag}>{selectedCountry.flag}</Text>
                    <Text style={styles.prefixCode}>{selectedCountry.code}</Text>
                    <AntDesign name="down" size={12} color="#16283C" />
                </Pressable>

                {/* Phone Number Input */}
                <TextInput
                    style={styles.phoneInput}
                    value={phoneNumber}
                    onChangeText={handlePhoneChange}
                    placeholder="Număr telefon"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    maxLength={15}
                />
            </View>

            {/* Country Selector Modal */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => { setModalVisible(false); setSearch(''); }}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => { setModalVisible(false); setSearch(''); }}
                >
                    <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                        <Text style={styles.modalTitle}>Selectează țara</Text>

                        {/* Search Input */}
                        <TextInput
                            style={styles.searchInput}
                            value={search}
                            onChangeText={setSearch}
                            placeholder="Caută țara..."
                            placeholderTextColor="#999"
                            autoFocus
                        />

                        <FlatList
                            data={filteredCountries}
                            keyExtractor={(item) => item.code}
                            style={{ maxHeight: 350 }}
                            keyboardShouldPersistTaps="handled"
                            renderItem={({ item, index }) => (
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.countryItem,
                                        pressed && { backgroundColor: '#F5F5F5' },
                                    ]}
                                    onPress={() => handleSelectCountry(item)}
                                >
                                    <Text style={styles.countryFlag}>{item.flag}</Text>
                                    <Text style={styles.countryName}>{item.name}</Text>
                                    <Text style={styles.countryCode}>{item.code}</Text>
                                </Pressable>
                            )}
                            ItemSeparatorComponent={() => <View style={styles.divider} />}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

export default PhoneInputField;

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    inputWrapper: {
        marginBottom: 15,
        width: '100%',
    },
    label: {
        color: AppColors.textWhite,
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 8,
        marginLeft: 5,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    prefixButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
        height: 45,
        paddingHorizontal: 10,
        gap: 4,
    },
    prefixFlag: {
        fontSize: 18,
    },
    prefixCode: {
        fontSize: 14,
        fontWeight: '600',
        color: '#16283C',
    },
    phoneInput: {
        flex: 1,
        height: 45,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        borderLeftWidth: 1,
        borderLeftColor: '#E0E0E0',
        paddingHorizontal: 12,
        fontSize: 16,
        color: AppColors.screenBackground,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        maxHeight: '70%',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#16283C',
        marginBottom: 12,
        textAlign: 'center',
    },
    searchInput: {
        height: 40,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#DDD',
        paddingHorizontal: 12,
        fontSize: 15,
        color: '#16283C',
        marginBottom: 10,
    },
    countryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
    },
    countryFlag: {
        fontSize: 22,
        marginRight: 10,
    },
    countryName: {
        flex: 1,
        fontSize: 15,
        color: '#16283C',
    },
    countryCode: {
        fontSize: 14,
        color: '#666',
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: '#EEEEEE',
    },
});
