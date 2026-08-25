import React from 'react';
import { StyleSheet, Text, View, Pressable, Switch } from 'react-native';
import { AppColors } from '../../constants/Colors';
import { getTaskTypeLabel, getTaskTypeColor } from '../../constants/TaskConstants';

interface SelectableTaskCardProps {
    taskType: string;
    clientName?: string;
    address?: string;
    selected: boolean;
    onToggle: () => void;
}

const SelectableTaskCard: React.FC<SelectableTaskCardProps> = ({
    taskType,
    clientName,
    address,
    selected,
    onToggle,
}) => (
    <Pressable
        style={[styles.card, selected && styles.cardSelected]}
        onPress={onToggle}
    >
        <View style={styles.content}>
            <View style={styles.info}>
                <View style={[styles.typeBadge, { backgroundColor: getTaskTypeColor(taskType) }]}>
                    <Text style={styles.typeBadgeText}>{getTaskTypeLabel(taskType)}</Text>
                </View>
                <Text style={styles.clientName}>{clientName || 'Client necunoscut'}</Text>
                <Text style={styles.address}>{address || 'Adresă necunoscută'}</Text>
            </View>
            <Switch
                value={selected}
                onValueChange={onToggle}
                trackColor={{ false: AppColors.inputBackground, true: AppColors.successGreen }}
                thumbColor={selected ? AppColors.textWhite : '#AAAAAA'}
            />
        </View>
    </Pressable>
);

export default SelectableTaskCard;

const styles = StyleSheet.create({
    card: {
        backgroundColor: AppColors.inputBackground,
        borderRadius: 12,
        padding: 16,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    cardSelected: {
        borderColor: AppColors.successGreen,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    info: {
        flex: 1,
    },
    typeBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 8,
    },
    typeBadgeText: {
        color: AppColors.textWhite,
        fontSize: 11,
        fontWeight: 'bold',
    },
    clientName: {
        color: AppColors.textWhite,
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    address: {
        color: AppColors.subtitleText,
        fontSize: 13,
    },
});
