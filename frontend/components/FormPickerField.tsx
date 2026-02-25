import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../constants/Colors';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface FormPickerFieldProps {
    label: string;
    value: string;
    placeholder?: string;
    icon?: IoniconsName;
    onPress: () => void;
    disabled?: boolean;
    showChevron?: boolean;
}

const FormPickerField: React.FC<FormPickerFieldProps> = ({
    label,
    value,
    placeholder,
    icon,
    onPress,
    disabled = false,
    showChevron = true,
}) => {
    const isPlaceholder = !value && !!placeholder;
    const displayText = value || placeholder || '';
    const iconColor = disabled ? AppColors.disabledText : AppColors.textWhite;

    return (
        <View style={styles.inputGroup}>
            <Text style={styles.label}>{label}</Text>
            <Pressable
                style={[styles.button, disabled && styles.disabled]}
                onPress={onPress}
                disabled={disabled}
            >
                {icon && (
                    <Ionicons
                        name={icon}
                        size={20}
                        color={iconColor}
                        style={styles.icon}
                    />
                )}
                <Text
                    style={[
                        styles.text,
                        { flex: showChevron ? 1 : undefined },
                        isPlaceholder && styles.placeholder,
                    ]}
                >
                    {displayText}
                </Text>
                {showChevron && (
                    <Ionicons name="chevron-down" size={20} color={iconColor} />
                )}
            </Pressable>
        </View>
    );
};

export default FormPickerField;

const styles = StyleSheet.create({
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        color: AppColors.textWhite,
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
    },
    button: {
        backgroundColor: AppColors.inputBackground,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: AppColors.buttonBackground,
        flexDirection: 'row',
        alignItems: 'center',
    },
    disabled: {
        opacity: 0.5,
    },
    icon: {
        marginRight: 10,
    },
    text: {
        fontSize: 16,
        color: AppColors.textWhite,
    },
    placeholder: {
        color: AppColors.placeholderText,
    },
});
