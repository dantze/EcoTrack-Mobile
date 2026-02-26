import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TASK_TYPE_COLORS, TASK_TYPE_LABELS } from '../constants/TaskConstants';
import { AppColors } from '../constants/Colors';

interface TaskTypeLegendProps {
    /** Task type keys to display. Defaults to all known types. */
    types?: string[];
}

const ALL_TYPES = Object.keys(TASK_TYPE_LABELS);

const TaskTypeLegend: React.FC<TaskTypeLegendProps> = ({ types = ALL_TYPES }) => (
    <View style={styles.container}>
        {types.map((type) => (
            <View key={type} style={styles.item}>
                <Ionicons name="location" size={20} color={TASK_TYPE_COLORS[type] || '#9B59B6'} />
                <Text style={styles.text}>{TASK_TYPE_LABELS[type] || type}</Text>
            </View>
        ))}
    </View>
);

export default TaskTypeLegend;

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        paddingHorizontal: 25,
        marginBottom: 20,
        flexWrap: 'wrap',
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 15,
        marginBottom: 5,
    },
    text: {
        color: AppColors.textWhite,
        fontSize: 14,
        marginLeft: 5,
    },
});
