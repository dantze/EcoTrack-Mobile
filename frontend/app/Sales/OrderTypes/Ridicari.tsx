import React from 'react';
import OrderForm from './OrderComponents/OrderForm';

const Ridicari = ({ client, onDataChange, onDropdownToggle }: { client: any; onDataChange: (data: any) => void; onDropdownToggle?: (isOpen: boolean) => void }) => (
    <OrderForm orderType="Ridicari" client={client} onDataChange={onDataChange} onDropdownToggle={onDropdownToggle} />
);

export default Ridicari;
