import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppColors } from '../../constants/Colors';

interface ScreenHeaderProps {
    title: string;
    onBack?: () => void;
    /** Optional element rendered on the right side of the header (e.g. status badge). */
    rightElement?: React.ReactNode;
    /** When provided, a refresh button is shown on the right side of the header. */
    onRefresh?: () => void;
    /** When provided, a filter button is shown on the right side of the header. */
    onFilter?: () => void;
    /** When true, the filter icon gets a highlight to indicate active filters. */
    filterActive?: boolean;
}

const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, onBack, rightElement, onRefresh, onFilter, filterActive }) => {
    const router = useRouter();

    return (
        <View style={styles.headerContainer}>
            <Pressable onPress={onBack ?? (() => router.back())} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={AppColors.textWhite} />
            </Pressable>
            <Text style={styles.headerText}>{title}</Text>
            {rightElement && <View style={styles.rightContainer}>{rightElement}</View>}
            {onFilter && (
                <Pressable onPress={onFilter} style={[styles.refreshButton, filterActive && styles.filterButtonActive]}>
                    <Ionicons name="filter" size={22} color={AppColors.textWhite} />
                </Pressable>
            )}
            {onRefresh && (
                <Pressable onPress={onRefresh} style={styles.refreshButton}>
                    <Ionicons name="refresh" size={22} color={AppColors.textWhite} />
                </Pressable>
            )}
        </View>
    );
};

export default ScreenHeader;

const styles = StyleSheet.create({
    headerContainer: {
        marginTop: 60,
        paddingHorizontal: 20,
        width: '100%',
        marginBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: AppColors.buttonBackground,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    headerText: {
        color: AppColors.textWhite,
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'left',
        flex: 1,
    },
    rightContainer: {
        marginLeft: 10,
    },
    refreshButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: AppColors.buttonBackground,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    filterButtonActive: {
        backgroundColor: AppColors.successGreen,
    },
});
