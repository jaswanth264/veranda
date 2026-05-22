import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

export default function LoginPage() {
  const { setUser } = useAuth();
  const navigate    = useNavigate();
  const [serverError, setServerError] = useState('');

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
      navigate('/dashboard'); // DashboardPage will redirect vendors appropriately
    } catch (err) {
      setServerError(err.response?.data?.error || 'Login failed. Try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-8">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-orange-500">Veranda</h1>
          <p className="text-gray-500 text-sm mt-1">Services & Tiffin near you</p>
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mb-6">Sign in to your account</h2>

        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                errors.password ? 'border-red-400' : 'border-gray-300'
              }`}
              {...register('password', { required: 'Password is required' })}
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-orange-500 font-medium hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
