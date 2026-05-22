import axios from 'axios';

// All requests go to /api which Vite proxies to http://localhost:5000
const client = axios.create({
  baseURL: '/api',
  withCredentials: true, // sends httpOnly cookies automatically
  headers: { 'Content-Type': 'application/json' },
});

export default client;
