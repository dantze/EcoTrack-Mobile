import { Stack, useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';

export default function DriverLayout() {
    const router = useRouter();
    const navigation = useNavigation();

    // Intercept swipe-back / hardware-back so it always goes to login
    // instead of the role-selection screen
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
            const actionType = e.data.action.type;
            if (actionType === 'POP' || actionType === 'GO_BACK') {
                e.preventDefault();
                router.replace('/login');
            }
        });
        return unsubscribe;
    }, [navigation, router]);

    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    );
}
