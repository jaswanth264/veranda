import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

export default function LoginPage() {
  const { setUser } = useAuth();
  const navigate    = useNavigate();
  const [serverError, setServerError] = useState('');
  const [role, setRole] = useState('customer'); // 'customer' | 'vendor'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();

  const onSubmit = async (data) => {
    setServerError('');
    try {
      const res = await login(data);
      setUser(res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setServerError(err.response?.data?.error || 'Login failed. Try again.');
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#fef9f0' }}>
      {/* Left illustration panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden"
        style={{ backgroundColor: '#fef3c7' }}
      >
        <Link to="/" className="text-2xl font-bold" style={{ color: '#1a4a47' }}>Veranda</Link>

        {/* Illustration collage */}
        <div className="flex-1 flex flex-col gap-6 justify-center">
          <div className="rounded-3xl overflow-hidden shadow-lg">
            <img
              src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&auto=format&fit=crop&q=80"
              alt="Home cook"
              className="w-full h-52 object-cover"
            />
          </div>
          <div className="rounded-3xl overflow-hidden shadow-lg">
            <img
              src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&auto=format&fit=crop&q=80"
              alt="Service worker"
              className="w-full h-48 object-cover"
            />
          </div>
        </div>

        <div className="mt-6">
          <p className="font-bold text-lg" style={{ color: '#1a4a47' }}>Veranda. Your local help.</p>
          <p className="text-sm mt-1" style={{ color: '#4b7c78' }}>Vijayawada | Gudivada</p>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="text-3xl font-bold" style={{ color: '#1a4a47' }}>Veranda</Link>
            <p className="text-sm mt-1 text-gray-500">Your local help · Vijayawada | Gudivada</p>
          </div>

          {/* Customer / Vendor toggle */}
          <div
            className="flex rounded-xl p-1 mb-8"
            style={{ backgroundColor: '#e8f5f4' }}
          >
            {['customer', 'vendor'].map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold capitalize transition-all"
                style={
                  role === r
                    ? { backgroundColor: '#1a4a47', color: '#fff' }
                    : { color: '#4b7c78' }
                }
              >
                {r === 'customer' ? 'Customer' : 'Vendor'}
              </button>
            ))}
          </div>

          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-5">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#1a4a47' }}>
                Phone Number
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Email or phone"
                  className="flex-1 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: '#d1d5db', '--tw-ring-color': '#f59e0b' }}
                  {...register('email', {
                    required: 'Email is required',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
                  })}
                />
                <button
                  type="button"
                  className="px-4 py-3 rounded-xl text-sm font-semibold text-white"
                  style={{ backgroundColor: '#1a4a47' }}
                >
                  OTP
                </button>
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              <p className="text-xs text-gray-400 mt-1">Enter verification click here</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#1a4a47' }}>Full Name</label>
              <input
                type="text"
                placeholder="Your full name"
                className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none"
                style={{ borderColor: '#d1d5db' }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#1a4a47' }}>Password</label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none pr-10"
                  style={{ borderColor: '#d1d5db' }}
                  {...register('password', { required: 'Password is required' })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer text-sm">👁</span>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-60 mt-2"
              style={{ backgroundColor: '#1a4a47' }}
            >
              {isSubmitting ? 'Signing in…' : 'Login'}
            </button>
          </form>

          <div className="mt-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">OR</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <button className="mt-4 w-full flex items-center justify-center gap-2 border rounded-xl py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors" style={{ borderColor: '#d1d5db' }}>
            <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="G" />
            Login with Google
          </button>
          <button className="mt-2 w-full flex items-center justify-center gap-2 border rounded-xl py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors" style={{ borderColor: '#d1d5db' }}>
            <span className="text-blue-600 font-bold text-base">f</span>
            Login with Facebook
          </button>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-semibold hover:underline" style={{ color: '#1a4a47' }}>
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

