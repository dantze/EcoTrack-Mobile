import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface DetailRowProps {
    label: string;
    value?: string | number | null;
    isMultiline?: boolean;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value, isMultiline = false }) => (
    <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, isMultiline && styles.multiline]}>
            {value != null && value !== '' ? String(value) : 'N/A'}
        </Text>
    </View>
);

export default DetailRow;

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    label: {
        color: '#E0E0E0',
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
    },
    value: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
        flex: 1,
        textAlign: 'right',
    },
    multiline: {
        flex: 1.5,
    },
});
