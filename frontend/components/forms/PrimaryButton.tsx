import React from 'react';
import { StyleSheet, Text, Pressable, ActivityIndicator, ViewStyle } from 'react-native';
import { AppColors } from '../../constants/Colors';

interface PrimaryButtonProps {
    label: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({
    label,
    onPress,
    loading = false,
    disabled = false,
    style,
}) => (
    <Pressable
        style={({ pressed }) => [
            styles.button,
            pressed && { opacity: 0.9 },
            (loading || disabled) && { opacity: 0.6 },
            style,
        ]}
        onPress={onPress}
        disabled={loading || disabled}
    >
        {loading ? (
            <ActivityIndicator color={AppColors.textWhite} />
        ) : (
            <Text style={styles.buttonText}>{label}</Text>
        )}
    </Pressable>
);

export default PrimaryButton;

const styles = StyleSheet.create({
    button: {
        width: '100%',
        height: 55,
        backgroundColor: AppColors.buttonBackground,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        elevation: 5,
    },
    buttonText: {
        color: AppColors.textWhite,
        fontSize: 18,
        fontWeight: 'bold',
    },
});
