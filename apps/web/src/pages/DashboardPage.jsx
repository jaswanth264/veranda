import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Redirect vendors to their own dashboard
  useEffect(() => {
    if (!user) return;
    if (user.role === 'vendor') {
      // vendor_profiles can be: null, [], [{}], or {} depending on source
      const vp = user.vendor_profiles;
      const hasProfile = vp &&
        (Array.isArray(vp) ? vp.length > 0 : Object.keys(vp).length > 0);
      navigate(hasProfile ? '/vendor/dashboard' : '/vendor/setup', { replace: true });
    } else {
      navigate('/my-bookings', { replace: true });
    }
  }, [user, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-orange-500">Veranda</h1>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-red-500 transition-colors"
        >
          Logout
        </button>
      </header>

      <main className="max-w-2xl mx-auto mt-16 px-4 text-center">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 shadow-sm">
          <div className="text-5xl mb-4">👋</div>
          <h2 className="text-2xl font-bold text-gray-800">
            Welcome, {user?.full_name}!
          </h2>
          <p className="text-gray-500 mt-2">
            Logged in as <span className="font-medium text-orange-500">{user?.role}</span>
          </p>
          <p className="text-gray-400 text-sm mt-1">{user?.email}</p>

          <div className="mt-8 p-4 bg-orange-50 rounded-xl text-sm text-orange-700 border border-orange-100">
            Dashboard is being built — listings, bookings & more coming next!
          </div>
        </div>
      </main>
    </div>
  );
}
