import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getMyVendorProfile } from '../api/vendor';
import { getMyListings, deleteListing, updateListing } from '../api/listings';
import { useAuth } from '../context/AuthContext';

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function VendorDashboardPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['vendor-profile-me'],
    queryFn: () => getMyVendorProfile().then((r) => r.data.vendor_profile),
  });

  const { data: listings = [] } = useQuery({
    queryKey: ['my-listings'],
    queryFn: () => getMyListings().then((r) => r.data.listings),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => deleteListing(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-listings'] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => updateListing(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-listings'] }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading your dashboard…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Could not load your vendor profile.</p>
          <Link to="/vendor/setup" className="text-orange-500 underline">Complete setup</Link>
        </div>
      </div>
    );
  }

  const categoryLabel = data.category === 'tiffin' ? '🍱 Tiffin / Home Cook' : '🔧 Home Services';

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top Nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold text-orange-500">Veranda</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 hidden sm:block">{user?.full_name}</span>
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-red-500 transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Business header */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-800">{data.business_name}</h1>
              {data.is_verified && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Verified</span>
              )}
              {data.is_featured && (
                <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">⭐ Featured</span>
              )}
            </div>
            <p className="text-sm text-orange-500 font-medium mt-0.5">{categoryLabel}</p>
            {data.description && <p className="text-sm text-gray-500 mt-2">{data.description}</p>}
            {data.address && <p className="text-xs text-gray-400 mt-1">📍 {data.address}</p>}
          </div>
          <Link
            to="/vendor/setup/edit"
            className="text-sm text-orange-500 hover:underline whitespace-nowrap"
          >
            Edit profile
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard label="Rating" value={data.rating > 0 ? `${data.rating.toFixed(1)} ★` : '—'} sub={`${data.total_reviews} reviews`} />
          <StatCard label="Status" value={data.is_verified ? 'Active' : 'Pending'} sub="Verification status" />
          <StatCard label="Listings" value={listings.length} sub={listings.length === 0 ? 'Add your first' : 'Total published'} />
        </div>

        {/* Listings section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-700">Your Listings</h2>
            <Link
              to="/vendor/listings/new"
              className="text-sm bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              + Add Listing
            </Link>
          </div>

          {listings.length === 0 ? (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 text-center">
              <p className="text-gray-700 font-medium mb-1">No listings yet</p>
              <p className="text-sm text-gray-500 mb-4">Add your first listing so customers can find and book you.</p>
              <Link
                to="/vendor/listings/new"
                className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
              >
                + Add Listing
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {listings.map((listing) => (
                <div
                  key={listing.id}
                  className={`bg-white border rounded-xl p-4 flex items-start gap-3 ${
                    listing.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
                  }`}
                >
                  <span className="text-2xl mt-0.5">{listing.categories?.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-800 text-sm">{listing.title}</p>
                      {!listing.is_active && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{listing.categories?.name}</p>
                    <p className="text-orange-500 font-semibold text-sm mt-1">
                      ₹{parseFloat(listing.price).toFixed(0)} <span className="text-gray-400 font-normal">{listing.unit}</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Link
                      to={`/listings/${listing.id}`}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => toggleMutation.mutate({ id: listing.id, is_active: !listing.is_active })}
                      disabled={toggleMutation.isPending}
                      className="text-xs text-gray-500 hover:text-orange-500 transition-colors"
                    >
                      {listing.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
