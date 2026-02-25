import React from 'react';
import { useRouter } from 'expo-router';
import MenuScreen from '../../components/MenuScreen';
import MenuButton from '../../components/MenuButton';

const Menu = () => {
    const router = useRouter();

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
            showMap
            renderButton={(item) => (
                <MenuButton label={item.label} onPress={item.onPress} />
            )}
        />
    );
};

export default Menu;
