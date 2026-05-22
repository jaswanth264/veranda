import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getListingById } from '../api/listings';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

export default function ListingDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const { data: listing, isLoading, isError } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => getListingById(id).then((r) => r.data.listing),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading…
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Listing not found.</p>
          <Link to="/" className="text-orange-500 underline">Browse listings</Link>
        </div>
      </div>
    );
  }

  const vendor = listing.vendor_profiles;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">

        {/* Listing card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{listing.categories?.icon}</span>
                <span className="text-xs text-gray-400">{listing.categories?.name}</span>
              </div>
              <h1 className="text-xl font-bold text-gray-800">{listing.title}</h1>
              {listing.description && (
                <p className="text-sm text-gray-500 mt-2">{listing.description}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-orange-500">₹{parseFloat(listing.price).toFixed(0)}</p>
              <p className="text-xs text-gray-400">{listing.unit}</p>
            </div>
          </div>
        </div>

        {/* Vendor info */}
        {vendor && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Service Provider</p>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 font-bold text-lg shrink-0">
                {vendor.business_name?.[0]}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-gray-800">{vendor.business_name}</h2>
                  {vendor.is_verified && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Verified</span>
                  )}
                </div>
                {vendor.address && (
                  <p className="text-sm text-gray-500 mt-0.5">📍 {vendor.address}</p>
                )}
                {vendor.rating > 0 && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    ⭐ {vendor.rating.toFixed(1)} ({vendor.total_reviews} reviews)
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Book button */}
        {user?.role === 'customer' ? (
          <button
            disabled
            className="w-full bg-orange-500 opacity-60 text-white font-semibold py-3 rounded-xl"
            title="Booking coming in next step"
          >
            Book Now — Coming Soon
          </button>
        ) : !user ? (
          <Link
            to="/login"
            className="block text-center w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Login to Book
          </Link>
        ) : null}

      </div>
    </Layout>
  );
}
