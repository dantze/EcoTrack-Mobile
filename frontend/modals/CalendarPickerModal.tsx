import React from 'react';
import { Modal, Pressable, View, Text, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { AppColors } from '../constants/Colors';
import { toDateString } from '../utils/dateUtils';

interface CalendarPickerModalProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
}

const CalendarPickerModal: React.FC<CalendarPickerModalProps> = ({
    visible,
    onClose,
    title = 'Selectează Data',
    selectedDate,
    onDateSelect,
}) => {
    const dateString = toDateString(selectedDate);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <View style={styles.container}>
                    <Text style={styles.title}>{title}</Text>
                    <Calendar
                        current={dateString}
                        onDayPress={(day: { dateString: string }) => {
                            onDateSelect(new Date(day.dateString));
                        }}
                        markedDates={{
                            [dateString]: { selected: true, selectedColor: AppColors.successGreen },
                        }}
                        theme={{
                            backgroundColor: AppColors.inputBackground,
                            calendarBackground: AppColors.inputBackground,
                            textSectionTitleColor: AppColors.textWhite,
                            selectedDayBackgroundColor: AppColors.successGreen,
                            selectedDayTextColor: AppColors.textWhite,
                            todayTextColor: AppColors.successGreen,
                            dayTextColor: AppColors.textWhite,
                            textDisabledColor: '#666666',
                            arrowColor: AppColors.textWhite,
                            monthTextColor: AppColors.textWhite,
                        }}
                    />
                </View>
            </Pressable>
        </Modal>
    );
};

export default CalendarPickerModal;

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: AppColors.modalOverlay,
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        backgroundColor: AppColors.inputBackground,
        borderRadius: 16,
        width: '90%',
        padding: 20,
    },
    title: {
        color: AppColors.textWhite,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },
});
