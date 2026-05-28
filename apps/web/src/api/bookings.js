import client from './client';

export const createBooking  = (data)           => client.post('/bookings', data);
export const getMyBookings  = (status)         => client.get('/bookings/mine', { params: status ? { status } : {} });
export const getVendorBookings = (status)      => client.get('/bookings/vendor', { params: status ? { status } : {} });
export const updateBookingStatus = (id, status) => client.put(`/bookings/${id}/status`, { status });
export const cancelBooking  = (id)             => client.delete(`/bookings/${id}`);
