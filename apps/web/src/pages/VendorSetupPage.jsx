import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { createVendorProfile } from '../api/vendor';
import { useAuth } from '../context/AuthContext';
import LocationPicker from '../components/LocationPicker';

// Leaflet CSS must be loaded once globally
import 'leaflet/dist/leaflet.css';

const CATEGORIES = [
  { value: 'tiffin',   label: '🍱 Tiffin / Home Cook',    desc: 'Daily meals, home-cooked food delivery' },
  { value: 'services', label: '🔧 Home Services',          desc: 'Plumber, electrician, cleaning, etc.' },
];

export default function VendorSetupPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState({ address: '', lat: null, lng: null });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const mutation = useMutation({
    mutationFn: createVendorProfile,
    onSuccess: (res) => {
      setUser((prev) => ({ ...prev, vendor_profiles: res.data.vendor_profile }));
      navigate('/vendor/dashboard');
    },
  });

  const onSubmit = (data) => {
    if (!category) return;
    mutation.mutate({
      ...data,
      category,
      address: location.address || null,
      lat: location.lat || null,
      lng: location.lng || null,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-orange-500">Veranda</h1>
          <p className="text-gray-500 text-sm mt-1">Set up your business profile</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-1">Welcome, {user?.full_name?.split(' ')[0]}!</h2>
          <p className="text-gray-500 text-sm mb-6">Complete your vendor profile to start listing your services.</p>

          {mutation.isError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-5">
              {mutation.error?.response?.data?.error || 'Something went wrong. Try again.'}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* Category selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">What do you offer? *</label>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      category === c.value
                        ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-400'
                        : 'border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <div className="font-medium text-sm text-gray-800">{c.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{c.desc}</div>
                  </button>
                ))}
              </div>
              {!category && mutation.isError && (
                <p className="text-red-500 text-xs mt-1">Please select a category</p>
              )}
            </div>

            {/* Business name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
              <input
                type="text"
                placeholder="e.g. Lakshmi Tiffins"
                className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                  errors.business_name ? 'border-red-400' : 'border-gray-300'
                }`}
                {...register('business_name', { required: 'Business name is required' })}
              />
              {errors.business_name && <p className="text-red-500 text-xs mt-1">{errors.business_name.message}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">About Your Business</label>
              <textarea
                rows={3}
                placeholder="Fresh home-cooked South Indian meals, delivered daily..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                {...register('description')}
              />
            </div>

            {/* Location picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business Location
                <span className="text-gray-400 font-normal ml-1">(helps customers nearby find you)</span>
              </label>
              <LocationPicker value={location} onChange={setLocation} />
            </div>

            <button
              type="submit"
              disabled={mutation.isPending || !category}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors mt-2"
            >
              {mutation.isPending ? 'Saving…' : 'Complete Setup →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

