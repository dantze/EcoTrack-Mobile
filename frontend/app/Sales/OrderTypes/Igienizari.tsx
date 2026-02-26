import React from 'react';
import OrderForm from './OrderComponents/OrderForm';

const Igienizari = ({ client, onDataChange }: { client: any; onDataChange: (data: any) => void }) => (
    <OrderForm orderType="Igienizari" client={client} onDataChange={onDataChange} />
);

export default Igienizari;
