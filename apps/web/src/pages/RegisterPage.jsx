import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { register as registerApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { setUser } = useAuth();
  const navigate    = useNavigate();
  const [role, setRole]               = useState('customer');
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();

  const onSubmit = async (data) => {
    setServerError('');
    try {
      const res = await registerApi({ ...data, role });
      setUser(res.data.user);
      navigate(role === 'vendor' ? '/vendor/setup' : '/dashboard');
    } catch (err) {
      setServerError(err.response?.data?.error || 'Registration failed. Try again.');
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

        <div className="flex-1 flex flex-col gap-5 justify-center">
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
              className="w-full h-44 object-cover"
            />
          </div>
        </div>

        <div className="mt-6">
          <p className="font-bold text-lg" style={{ color: '#1a4a47' }}>Veranda. Your local help.</p>
          <p className="text-sm mt-1" style={{ color: '#4b7c78' }}>Vijayawada | Gudivada</p>
        </div>
      </div>

      {/* Right register form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="text-3xl font-bold" style={{ color: '#1a4a47' }}>Veranda</Link>
            <p className="text-sm mt-1 text-gray-500">Your local help · Vijayawada | Gudivada</p>
          </div>

          <h2 className="text-2xl font-bold mb-2" style={{ color: '#1a4a47' }}>Create Account</h2>
          <p className="text-sm text-gray-400 mb-6">Join thousands of happy customers in Vijayawada</p>

          {/* Customer / Vendor toggle */}
          <div
            className="flex rounded-xl p-1 mb-7"
            style={{ backgroundColor: '#e8f5f4' }}
          >
            {[
              { key: 'customer', label: 'Book Services', icon: '🛒' },
              { key: 'vendor',   label: 'List My Services', icon: '🏪' },
            ].map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRole(r.key)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5"
                style={
                  role === r.key
                    ? { backgroundColor: '#1a4a47', color: '#fff' }
                    : { color: '#4b7c78' }
                }
              >
                <span>{r.icon}</span>
                <span>{r.label}</span>
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
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#1a4a47' }}>Full Name</label>
              <input
                type="text"
                placeholder="Ravi Kumar"
                className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none"
                style={{ borderColor: errors.full_name ? '#ef4444' : '#d1d5db' }}
                {...register('full_name', { required: 'Full name is required' })}
              />
              {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#1a4a47' }}>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none"
                style={{ borderColor: errors.email ? '#ef4444' : '#d1d5db' }}
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
                })}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#1a4a47' }}>Phone</label>
              <div className="flex">
                <span
                  className="px-3 flex items-center text-sm font-medium rounded-l-xl border border-r-0"
                  style={{ backgroundColor: '#e8f5f4', borderColor: '#d1d5db', color: '#1a4a47' }}
                >
                  +91
                </span>
                <input
                  type="tel"
                  placeholder="9876543210"
                  className="flex-1 border rounded-r-xl px-4 py-3 text-sm focus:outline-none"
                  style={{ borderColor: errors.phone ? '#ef4444' : '#d1d5db' }}
                  {...register('phone', {
                    required: 'Phone is required',
                    pattern: { value: /^[6-9]\d{9}$/, message: 'Enter valid 10-digit Indian mobile number' },
                  })}
                />
              </div>
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#1a4a47' }}>Password</label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="Min 6 characters"
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none pr-10"
                  style={{ borderColor: errors.password ? '#ef4444' : '#d1d5db' }}
                  {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 6, message: 'Min 6 characters' },
                  })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">👁</span>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-60 mt-2"
              style={{ backgroundColor: '#1a4a47' }}
            >
              {isSubmitting ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold hover:underline" style={{ color: '#1a4a47' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
