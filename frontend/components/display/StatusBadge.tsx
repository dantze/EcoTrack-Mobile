import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppColors } from '../../constants/Colors';

interface StatusBadgeProps {
    label: string;
    color: string;
    /** If true, shows a small dot next to the label. Default: false (solid background). */
    dotStyle?: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ label, color, dotStyle = false }) => {
    if (dotStyle) {
        return (
            <View style={styles.dotContainer}>
                <Text style={styles.dotLabel}>{label}</Text>
                <View style={[styles.dot, { backgroundColor: color }]} />
            </View>
        );
    }

    return (
        <View style={[styles.solidContainer, { backgroundColor: color }]}>
            <Text style={styles.solidLabel}>{label}</Text>
        </View>
    );
};

export default StatusBadge;

const styles = StyleSheet.create({
    // Dot style (used by ServiceDetails)
    dotContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 15,
    },
    dotLabel: {
        color: AppColors.textWhite,
        fontSize: 14,
        fontWeight: 'bold',
        marginRight: 6,
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    // Solid style (used by Driver/TaskDetails)
    solidContainer: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    solidLabel: {
        color: AppColors.textWhite,
        fontSize: 12,
        fontWeight: '600',
    },
});
