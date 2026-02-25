import React from 'react';
import { StyleSheet, Text, Pressable } from 'react-native';
import { AppColors } from '../constants/Colors';

interface MenuButtonProps {
    label: string;
    onPress: () => void;
}

const MenuButton: React.FC<MenuButtonProps> = ({ label, onPress }) => {
    return (
        <Pressable
            style={({ pressed }) => [
                styles.menuButton,
                pressed && styles.buttonPressed,
            ]}
            onPress={onPress}
        >
            <Text style={styles.buttonText}>{label}</Text>
        </Pressable>
    );
};

export default MenuButton;

const styles = StyleSheet.create({
    menuButton: {
        width: 330,
        height: 50,
        backgroundColor: AppColors.buttonBackground,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        shadowColor: AppColors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    buttonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.99 }],
    },
    buttonText: {
        color: AppColors.textWhite,
        fontSize: 18,
        fontWeight: 'bold',
    },
});
