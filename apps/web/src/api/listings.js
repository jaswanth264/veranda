import client from './client';

export const createListing      = (data)       => client.post('/listings', data);
export const getMyListings      = ()           => client.get('/listings/mine');
export const getListings        = (params)     => client.get('/listings', { params });
export const getListingsByCategory = (type)   => client.get(`/listings/category/${type}`);
export const getListingById     = (id)         => client.get(`/listings/${id}`);
export const updateListing      = (id, data)   => client.put(`/listings/${id}`, data);
export const deleteListing      = (id)         => client.delete(`/listings/${id}`);
