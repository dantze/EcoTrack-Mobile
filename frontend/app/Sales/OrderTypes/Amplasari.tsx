import React from 'react';
import OrderForm from './OrderComponents/OrderForm';

const Amplasari = ({ client, onDataChange, onDropdownToggle }: { client: any; onDataChange: (data: any) => void; onDropdownToggle?: (isOpen: boolean) => void }) => (
    <OrderForm orderType="Amplasari" client={client} onDataChange={onDataChange} onDropdownToggle={onDropdownToggle} />
);

export default Amplasari;
