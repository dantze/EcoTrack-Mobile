import React from 'react';
import OrderForm from './OrderComponents/OrderForm';

const Igienizari = ({ client, onDataChange, onDropdownToggle }: { client: any; onDataChange: (data: any) => void; onDropdownToggle?: (isOpen: boolean) => void }) => (
    <OrderForm orderType="Igienizari" client={client} onDataChange={onDataChange} onDropdownToggle={onDropdownToggle} />
);

export default Igienizari;
