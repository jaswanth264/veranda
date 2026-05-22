import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { register as registerApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { setUser } = useAuth();
  const navigate    = useNavigate();
  const [role, setRole]           = useState('customer');
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-8">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-orange-500">Veranda</h1>
          <p className="text-gray-500 text-sm mt-1">Services & Tiffin near you</p>
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mb-6">Create your account</h2>

        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              placeholder="Ravi Kumar"
              className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                errors.full_name ? 'border-red-400' : 'border-gray-300'
              }`}
              {...register('full_name', { required: 'Full name is required' })}
            />
            {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                errors.email ? 'border-red-400' : 'border-gray-300'
              }`}
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
              })}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              placeholder="9876543210"
              className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                errors.phone ? 'border-red-400' : 'border-gray-300'
              }`}
              {...register('phone', {
                required: 'Phone is required',
                pattern: { value: /^[6-9]\d{9}$/, message: 'Enter valid 10-digit Indian mobile number' },
              })}
            />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              placeholder="Min 6 characters"
              className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                errors.password ? 'border-red-400' : 'border-gray-300'
              }`}
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 6, message: 'Min 6 characters' },
              })}
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">I want to</label>
            <div className="grid grid-cols-2 gap-3">
              {['customer', 'vendor'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    role === r
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'border-gray-300 text-gray-600 hover:border-orange-400'
                  }`}
                >
                  {r === 'customer' ? '🛒 Book Services' : '🏪 List My Services'}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {isSubmitting ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-orange-500 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
