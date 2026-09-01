import React from 'react';
import { useRouter } from 'expo-router';
import MenuScreen from '../../components/layout/MenuScreen';
import { AuthService } from '../../services/AuthService';
import MenuButton from '../../components/layout/MenuButton';

const Menu = () => {
    const router = useRouter();

    // Revoke server-side before leaving. Navigating away on its own left this
    // device's refresh token valid for the rest of its year — and now that the way
    // back in is an access request an admin must approve, a "logout" that only
    // changed screens would also leave a live session behind the new one.
    const handleLogout = async () => {
        await AuthService.logout();
        router.replace('/enrollment');
    };

    const menuItems = [
        { label: 'Creare Client', onPress: () => router.push({ pathname: '/Sales/CreateClient' }) },
        { label: 'Creare Comanda', onPress: () => router.push({ pathname: '/Sales/CreateOrder' }) },
        { label: 'Harta', onPress: () => router.push({ pathname: '/Sales/AllOrdersMap' }) },
        { label: 'Produse și Abonamente', onPress: () => router.push({ pathname: '/Sales/ProductsAndSubscriptions' }) },
        { label: 'Lista Clienți', onPress: () => router.push({ pathname: '/Sales/ClientsList' }) },
        { label: 'Lista Comenzi', onPress: () => router.push({ pathname: '/Sales/OrdersList' }) },
    ];

    return (
        <MenuScreen
            title="Meniu Vânzări"
            items={menuItems}
            onLogout={() => void handleLogout()}
            renderButton={(item) => (
                <MenuButton label={item.label} onPress={item.onPress} />
            )}
        />
    );
};

export default Menu;
