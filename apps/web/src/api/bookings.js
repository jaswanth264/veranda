import client from './client';

export const createBooking        = (data)           => client.post('/bookings', data);
export const getMyBookings        = (status)         => client.get('/bookings/mine', { params: status ? { status } : {} });
export const getVendorBookings    = (status)         => client.get('/bookings/vendor', { params: status ? { status } : {} });
export const updateBookingStatus  = (id, status)     => client.put(`/bookings/${id}/status`, { status });
export const cancelBooking        = (id)             => client.delete(`/bookings/${id}`);
export const confirmCompletion    = (id)             => client.post(`/bookings/${id}/confirm`);
export const sendArrivalOtp       = (id)             => client.post(`/bookings/${id}/send-arrival-otp`);
export const sendCompletionOtp    = (id)             => client.post(`/bookings/${id}/send-completion-otp`);
export const verifyCompletionOtp  = (id, otp)        => client.post(`/bookings/${id}/verify-otp`, { otp });
