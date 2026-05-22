import client from './client';

export const createVendorProfile  = (data) => client.post('/vendor/profile', data);
export const getMyVendorProfile   = ()     => client.get('/vendor/profile/me');
export const updateVendorProfile  = (data) => client.put('/vendor/profile', data);
export const getVendorById        = (id)   => client.get(`/vendor/${id}`);
