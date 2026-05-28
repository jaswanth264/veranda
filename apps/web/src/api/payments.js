import client from './client';

export const createPaymentOrder = (booking_id) =>
  client.post('/payments/create-order', { booking_id });

export const verifyPayment = (data) =>
  client.post('/payments/verify', data);
