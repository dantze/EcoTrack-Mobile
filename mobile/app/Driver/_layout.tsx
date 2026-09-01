import { Stack, useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';

export default function DriverLayout() {
    const router = useRouter();
    const navigation = useNavigation();

    // Intercept swipe-back / hardware-back so it lands on the boot gate rather
    // than unwinding into whatever screen happened to be underneath.
    //
    // It used to go straight to the login screen. Under enrollment that would be
    // actively wrong: the enrollment screen's job is to file a NEW access
    // request, so a stray back gesture would ask an admin to approve a device
    // that is already signed in. The gate re-reads the stored session instead.
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
            const actionType = e.data.action.type;
            if (actionType === 'POP' || actionType === 'GO_BACK') {
                e.preventDefault();
                router.replace('/');
            }
        });
        return unsubscribe;
    }, [navigation, router]);

    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    );
}
