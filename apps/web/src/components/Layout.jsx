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
    user?.role === 'vendor' ? '/vendor/dashboard' : '/my-bookings';

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#fef9f0' }}>
      {/* Navbar */}
      <nav style={{ backgroundColor: '#1a4a47' }} className="sticky top-0 z-50 shadow-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="text-2xl font-bold text-white shrink-0 tracking-tight">
            Veranda
          </Link>

          {/* Center nav links (guest) */}
          {!user && (
            <div className="hidden md:flex items-center gap-8">
              <Link to="/" className="text-sm font-medium" style={{ color: '#f59e0b' }}>Home</Link>
              <Link to="/?type=services" className="text-sm font-medium text-white/80 hover:text-white transition-colors">Services</Link>
              <Link to="/?type=tiffin" className="text-sm font-medium text-white/80 hover:text-white transition-colors">Tiffin &amp; Food</Link>
              <Link to="/about" className="text-sm font-medium text-white/80 hover:text-white transition-colors">About Us</Link>
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  to={dashboardPath}
                  className="text-sm font-medium text-white/80 hover:text-white transition-colors hidden sm:block"
                >
                  {user.role === 'vendor' ? 'My Business' : 'My Bookings'}
                </Link>
                <div className="flex items-center gap-2">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{ backgroundColor: '#f59e0b', color: '#1a4a47' }}
                  >
                    {user.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-xs text-white/60 hover:text-white transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <Link
                to="/login"
                className="text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
                style={{ backgroundColor: '#f59e0b', color: '#1a4a47' }}
              >
                Login / Sign Up
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer style={{ backgroundColor: '#1a4a47', color: 'rgba(255,255,255,0.6)' }} className="text-center text-xs py-5">
        © {new Date().getFullYear()} Veranda · Vijayawada &amp; Gudivada
      </footer>
    </div>
  );
}
