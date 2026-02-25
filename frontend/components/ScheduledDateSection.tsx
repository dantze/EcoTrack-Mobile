import React from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { AppColors } from '../constants/Colors';

interface ScheduledDateSectionProps {
    scheduledDate: string | null;
    showPicker: boolean;
    pickerDate: Date;
    saving: boolean;
    onDateChange: (event: DateTimePickerEvent, date?: Date) => void;
    onButtonPress: () => void;
}

const ScheduledDateSection: React.FC<ScheduledDateSectionProps> = ({
    scheduledDate,
    showPicker,
    pickerDate,
    saving,
    onDateChange,
    onButtonPress,
}) => {
    const buttonLabel = showPicker
        ? 'Salvează Data'
        : scheduledDate
            ? 'Schimbă Data'
            : 'Setează Data';

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Ionicons name="calendar-outline" size={20} color="#E0E0E0" />
                <Text style={styles.title}>Dată Programată</Text>
            </View>

            {scheduledDate ? (
                <View style={styles.dateDisplay}>
                    <Ionicons name="checkmark-circle" size={18} color="#2ECC71" />
                    <Text style={styles.dateText}>{scheduledDate}</Text>
                </View>
            ) : (
                <View style={styles.noDateNotice}>
                    <Ionicons name="alert-circle-outline" size={18} color="#F39C12" />
                    <Text style={styles.noDateText}>Nicio dată programată încă</Text>
                </View>
            )}

            {showPicker && (
                <DateTimePicker
                    value={pickerDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateChange}
                    minimumDate={new Date()}
                />
            )}

            <Pressable
                style={({ pressed }) => [
                    showPicker ? styles.saveButton : styles.setButton,
                    saving && styles.disabled,
                    pressed && !saving && styles.pressed,
                ]}
                onPress={onButtonPress}
                disabled={saving}
            >
                {saving ? (
                    <ActivityIndicator size="small" color="white" />
                ) : (
                    <>
                        <Ionicons
                            name={showPicker ? 'checkmark-circle' : 'calendar'}
                            size={20}
                            color="white"
                            style={{ marginRight: 8 }}
                        />
                        <Text style={styles.buttonText}>{buttonLabel}</Text>
                    </>
                )}
            </Pressable>
        </View>
    );
};

export default ScheduledDateSection;

const styles = StyleSheet.create({
    container: {
        backgroundColor: AppColors.accentColor,
        borderRadius: 20,
        padding: 20,
        width: '100%',
        marginTop: 20,
        marginBottom: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        color: '#E0E0E0',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    dateDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(46, 204, 113, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        marginBottom: 12,
    },
    dateText: {
        color: AppColors.textWhite,
        fontSize: 15,
        fontWeight: 'bold',
        marginLeft: 8,
        textTransform: 'capitalize',
    },
    noDateNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(243, 156, 18, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        marginBottom: 12,
    },
    noDateText: {
        color: '#F39C12',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
    },
    setButton: {
        backgroundColor: AppColors.buttonBackground,
        height: 48,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3,
    },
    saveButton: {
        backgroundColor: '#2ECC71',
        height: 48,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 3,
        marginTop: 10,
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 15,
    },
    disabled: {
        backgroundColor: '#6B8A9A',
    },
    pressed: {
        opacity: 0.8,
        transform: [{ scale: 0.98 }],
    },
});
