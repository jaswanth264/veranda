import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import VendorSetupPage from './pages/VendorSetupPage';
import VendorDashboardPage from './pages/VendorDashboardPage';
import CreateListingPage from './pages/CreateListingPage';
import ListingDetailPage from './pages/ListingDetailPage';
import HomePage from './pages/HomePage';
import CustomerDashboardPage from './pages/CustomerDashboardPage';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className='min-h-screen flex items-center justify-center text-gray-400'>Loading...</div>;
  return user ? children : <Navigate to='/login' replace />;
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className='min-h-screen flex items-center justify-center text-gray-400'>Loading...</div>;
  return user ? <Navigate to='/dashboard' replace /> : children;
}

// Redirect vendors to setup if no profile, else to vendor dashboard
function VendorRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className='min-h-screen flex items-center justify-center text-gray-400'>Loading...</div>;
  if (!user) return <Navigate to='/login' replace />;
  if (user.role !== 'vendor') return <Navigate to='/dashboard' replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path='/' element={<HomePage />} />
      <Route path='/login' element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path='/register' element={<GuestRoute><RegisterPage /></GuestRoute>} />
      <Route path='/dashboard' element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
      <Route path='/my-bookings' element={<PrivateRoute><CustomerDashboardPage /></PrivateRoute>} />
      <Route path='/vendor/setup' element={<VendorRoute><VendorSetupPage /></VendorRoute>} />
      <Route path='/vendor/dashboard' element={<VendorRoute><VendorDashboardPage /></VendorRoute>} />
      <Route path='/vendor/listings/new' element={<VendorRoute><CreateListingPage /></VendorRoute>} />
      <Route path='/listings/:id' element={<ListingDetailPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
