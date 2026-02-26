import React from 'react';
import OrderForm from './OrderComponents/OrderForm';

const Ridicari = ({ client, onDataChange }: { client: any; onDataChange: (data: any) => void }) => (
    <OrderForm orderType="Ridicari" client={client} onDataChange={onDataChange} />
);

export default Ridicari;
