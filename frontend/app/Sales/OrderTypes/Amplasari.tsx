import React from 'react';
import OrderForm from './OrderComponents/OrderForm';

const Amplasari = ({ client, onDataChange }: { client: any; onDataChange: (data: any) => void }) => (
    <OrderForm orderType="Amplasari" client={client} onDataChange={onDataChange} />
);

export default Amplasari;
