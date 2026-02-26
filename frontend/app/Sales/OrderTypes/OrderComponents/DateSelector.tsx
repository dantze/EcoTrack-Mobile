import { StyleSheet, Text, View, Pressable } from 'react-native'
import React, { useState } from 'react'
import { AntDesign } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';

// Setup Romanian Locale
LocaleConfig.locales['ro'] = {
    monthNames: [
        'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
        'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
    ],
    monthNamesShort: ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    dayNames: ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'],
    dayNamesShort: ['D', 'L', 'Ma', 'Mi', 'J', 'V', 'S'],
    today: "Azi"
};
LocaleConfig.defaultLocale = 'ro';

// Extracted so it can be used in state initializer
const getDatesInRange = (start: string, end: string) => {
    const startD = new Date(start);
    const endD = new Date(end);
    const date = new Date(startD.getTime());
    const dates: any = {};
    while (date <= endD) {
        const dateString = date.toISOString().split('T')[0];
        dates[dateString] = { color: '#70d7c7', textColor: 'white' };
        if (dateString === start) dates[dateString].startingDay = true;
        if (dateString === end) dates[dateString].endingDay = true;
        date.setDate(date.getDate() + 1);
    }
    return dates;
};

interface DateSelectorProps {
    label?: string;
    onDateChange: (startDate: string, endDate: string) => void;
    onToggle?: (isOpen: boolean) => void;
    initialStartDate?: string;
    initialEndDate?: string;
}

const DateSelector = ({ label = "Dată Amplasare", onDateChange, onToggle, initialStartDate = '', initialEndDate = '' }: DateSelectorProps) => {
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [startDate, setStartDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);
    const [markedDates, setMarkedDates] = useState<any>(() => {
        if (initialStartDate && initialEndDate) {
            return getDatesInRange(initialStartDate, initialEndDate);
        }
        if (initialStartDate) {
            return { [initialStartDate]: { selected: true, startingDay: true, endingDay: true, color: '#00adf5', textColor: 'white' } };
        }
        return {};
    });

    const handleDayPress = (day: any) => {
        let newStart = startDate;
        let newEnd = endDate;

        if (!startDate || (startDate && endDate)) {
            newStart = day.dateString;
            newEnd = '';
            setStartDate(newStart);
            setEndDate(newEnd);
            setMarkedDates({
                [day.dateString]: { selected: true, startingDay: true, endingDay: true, color: '#00adf5', textColor: 'white' }
            });
        } else if (startDate && !endDate) {
            const start = new Date(startDate);
            const end = new Date(day.dateString);

            if (end < start) {
                newStart = day.dateString;
                setStartDate(newStart);
                setMarkedDates({
                    [day.dateString]: { selected: true, startingDay: true, endingDay: true, color: '#00adf5', textColor: 'white' }
                });
            } else {
                newEnd = day.dateString;
                setEndDate(newEnd);
                const range = getDatesInRange(startDate, day.dateString);
                setMarkedDates(range);
            }
        }

        onDateChange(newStart, newEnd);
    };

    const toggleCalendar = () => {
        const newState = !isCalendarOpen;
        setIsCalendarOpen(newState);
        if (onToggle) {
            onToggle(newState);
        }
    };

    return (
        <View style={{ marginTop: 15, zIndex: 250 }}>
            <Text style={styles.label}>{label}</Text>
            <Pressable style={styles.dropdownButton} onPress={toggleCalendar}>
                <Text style={styles.dropdownText}>
                    {startDate ? (endDate ? `${startDate} - ${endDate}` : startDate) : "Selectează data sau perioada"}
                </Text>
                <AntDesign name="calendar" size={16} color="#16283C" />
            </Pressable>

            {isCalendarOpen && (
                <View style={styles.calendarContainer}>
                    <Calendar
                        markingType={'period'}
                        markedDates={markedDates}
                        onDayPress={handleDayPress}
                        theme={{
                            backgroundColor: '#ffffff',
                            calendarBackground: '#ffffff',
                            textSectionTitleColor: '#b6c1cd',
                            selectedDayBackgroundColor: '#00adf5',
                            selectedDayTextColor: '#ffffff',
                            todayTextColor: '#00adf5',
                            dayTextColor: '#2d4150',
                            textDisabledColor: '#d9e1e8',
                            arrowColor: '#16283C',
                            monthTextColor: '#16283C',
                            indicatorColor: 'blue',
                            textDayFontWeight: '300',
                            textMonthFontWeight: 'bold',
                            textDayHeaderFontWeight: '300',
                            textDayFontSize: 14,
                            textMonthFontSize: 16,
                            textDayHeaderFontSize: 14
                        }}
                    />
                </View>
            )}
        </View>
    )
}

export default DateSelector

const styles = StyleSheet.create({
    label: {
        color: '#CCCCCC',
        fontSize: 14,
        marginBottom: 5,
        fontWeight: '600',
    },
    dropdownButton: {
        height: 40,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 10,
    },
    dropdownText: {
        color: '#16283C',
        fontSize: 14,
    },
    calendarContainer: {
        marginTop: 5,
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 5,
        elevation: 5,
    }
})
