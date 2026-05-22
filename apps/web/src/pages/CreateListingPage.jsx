import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createListing } from '../api/listings';

// Must match DB seed data (categories table)
const CATEGORIES = [
  { id: 1,  name: 'Tiffin Service', icon: '🍱', type: 'tiffin'   },
  { id: 2,  name: 'Home Cook',      icon: '👨‍🍳', type: 'tiffin'   },
  { id: 3,  name: 'Plumber',        icon: '🔧', type: 'services' },
  { id: 4,  name: 'Electrician',    icon: '⚡', type: 'services' },
  { id: 5,  name: 'House Cleaning', icon: '🧹', type: 'services' },
  { id: 6,  name: 'Carpenter',      icon: '🪚', type: 'services' },
  { id: 7,  name: 'Painter',        icon: '🎨', type: 'services' },
  { id: 8,  name: 'AC Repair',      icon: '❄️', type: 'services' },
];

const UNITS = [
  'per meal',
  'per day',
  'per visit',
  'per hour',
  'per month',
];

export default function CreateListingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues: { unit: 'per visit' } });

  const mutation = useMutation({
    mutationFn: (data) => createListing(data),
    onSuccess: () => {
      // Invalidate the my-listings query so dashboard refreshes
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      navigate('/vendor/dashboard');
    },
  });

  const onSubmit = (data) => {
    mutation.mutate({
      ...data,
      category_id: parseInt(data.category_id),
      price: parseFloat(data.price),
      images: [],
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link to="/vendor/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Back
        </Link>
        <span className="text-lg font-bold text-orange-500">New Listing</span>
      </nav>

      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">

          {mutation.isError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-5">
              {mutation.error?.response?.data?.error || 'Something went wrong. Try again.'}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 border rounded-lg px-3 py-2.5 cursor-pointer has-[:checked]:border-orange-500 has-[:checked]:bg-orange-50 border-gray-200 hover:border-orange-300 transition-colors"
                  >
                    <input
                      type="radio"
                      value={c.id}
                      className="accent-orange-500"
                      {...register('category_id', { required: 'Select a category' })}
                    />
                    <span className="text-sm text-gray-700">{c.icon} {c.name}</span>
                  </label>
                ))}
              </div>
              {errors.category_id && <p className="text-red-500 text-xs mt-1">{errors.category_id.message}</p>}
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Listing Title *</label>
              <input
                type="text"
                placeholder="e.g. Veg Tiffin – Lunch (Rice + 2 Curries)"
                className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                  errors.title ? 'border-red-400' : 'border-gray-300'
                }`}
                {...register('title', { required: 'Title is required', maxLength: { value: 120, message: 'Max 120 characters' } })}
              />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                rows={3}
                placeholder="What's included? Any conditions? Timings?"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                {...register('description')}
              />
            </div>

            {/* Price + Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="80"
                  className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                    errors.price ? 'border-red-400' : 'border-gray-300'
                  }`}
                  {...register('price', {
                    required: 'Price is required',
                    min: { value: 0, message: 'Cannot be negative' },
                  })}
                />
                {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Per</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                  {...register('unit')}
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {mutation.isPending ? 'Publishing…' : 'Publish Listing'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
