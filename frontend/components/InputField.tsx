import React from 'react';
import { StyleSheet, Text, View, TextInput } from 'react-native';
import { AppColors } from '../constants/Colors';

export interface InputFieldProps {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
}

const InputField: React.FC<InputFieldProps> = ({
    label,
    value,
    onChangeText,
    placeholder = '',
    keyboardType = 'default',
}) => (
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

export default InputField;

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
    input: {
        width: '100%',
        height: 45,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 15,
        fontSize: 16,
        color: AppColors.screenBackground,
    },
});
