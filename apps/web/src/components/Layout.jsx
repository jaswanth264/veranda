import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const dashboardPath =
    user?.role === 'vendor' ? '/vendor/dashboard' : '/dashboard';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="text-xl font-bold text-orange-500 shrink-0">
            Veranda
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  to={dashboardPath}
                  className="text-sm text-gray-600 hover:text-orange-500 transition-colors hidden sm:block"
                >
                  {user.role === 'vendor' ? 'My Business' : 'My Bookings'}
                </Link>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">
                    {user.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm text-gray-600 hover:text-orange-500 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="text-sm bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg transition-colors"
                >
                  Join free
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-100">
        © {new Date().getFullYear()} Veranda · Vijayawada & Gudivada
      </footer>
    </div>
  );
}
