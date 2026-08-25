import React from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../constants/Colors';

export interface ListPickerItem {
    key: string;
    label: string;
}

interface ListPickerModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    items: ListPickerItem[];
    selectedKey?: string | null;
    onSelect: (item: ListPickerItem) => void;
}

const ListPickerModal: React.FC<ListPickerModalProps> = ({
    visible,
    onClose,
    title,
    items,
    selectedKey,
    onSelect,
}) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <View style={styles.dropdownModal}>
                    <Text style={styles.dropdownTitle}>{title}</Text>
                    <ScrollView style={styles.dropdownList}>
                        {items.map((item) => (
                            <Pressable
                                key={item.key}
                                style={({ pressed }) => [
                                    styles.dropdownItem,
                                    selectedKey === item.key && styles.dropdownItemSelected,
                                    pressed && styles.dropdownItemPressed,
                                ]}
                                onPress={() => onSelect(item)}
                            >
                                <Text
                                    style={[
                                        styles.dropdownItemText,
                                        selectedKey === item.key && styles.dropdownItemTextSelected,
                                    ]}
                                >
                                    {item.label}
                                </Text>
                                {selectedKey === item.key && (
                                    <Ionicons name="checkmark" size={20} color={AppColors.successGreen} />
                                )}
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>
            </Pressable>
        </Modal>
    );
};

export default ListPickerModal;

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dropdownModal: {
        backgroundColor: AppColors.inputBackground,
        borderRadius: 16,
        width: '80%',
        maxHeight: '60%',
        padding: 20,
    },
    dropdownTitle: {
        color: AppColors.textWhite,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },
    dropdownList: {
        maxHeight: 300,
    },
    dropdownItem: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5,
    },
    dropdownItemSelected: {
        backgroundColor: AppColors.screenBackground,
    },
    dropdownItemPressed: {
        backgroundColor: AppColors.screenBackground,
        opacity: 0.8,
    },
    dropdownItemText: {
        color: AppColors.textWhite,
        fontSize: 16,
    },
    dropdownItemTextSelected: {
        fontWeight: 'bold',
    },
});
