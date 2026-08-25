import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { AntDesign, Ionicons } from '@expo/vector-icons';

interface ActionBarProps {
    label: string;
    color?: string;
    pressedColor?: string;
    onAdd: () => void;
    onRefresh: () => void;
}

const ActionBar: React.FC<ActionBarProps> = ({
    label, color = '#4CAF50', pressedColor = '#388E3C', onAdd, onRefresh,
}) => (
    <View style={styles.container}>
        <Pressable
            style={({ pressed }) => [
                styles.addButton,
                { backgroundColor: color },
                pressed && { backgroundColor: pressedColor },
            ]}
            onPress={onAdd}
        >
            <AntDesign name="plus" size={20} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.addButtonText}>{label}</Text>
        </Pressable>
        <Pressable style={styles.refreshButton} onPress={onRefresh}>
            <Ionicons name="refresh" size={22} color="#5D8AA8" />
        </Pressable>
    </View>
);

export default ActionBar;

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row', paddingHorizontal: 20, marginBottom: 16, alignItems: 'center',
    },
    addButton: {
        flex: 1, flexDirection: 'row',
        paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center', elevation: 3,
    },
    addButtonText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
    refreshButton: {
        marginLeft: 12, width: 48, height: 48,
        backgroundColor: 'rgba(93,138,168,0.2)', borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
    },
});
