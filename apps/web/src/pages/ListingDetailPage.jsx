import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getListingById } from '../api/listings';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import BookingModal from '../components/BookingModal';

export default function ListingDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [showBooking, setShowBooking] = useState(false);

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

  const isOwnListing = user?.role === 'vendor' &&
    listing.vendor_profiles?.user_id === user.id;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">

        {/* Image area */}
        <div
          className="rounded-2xl flex items-center justify-center text-7xl"
          style={{ height: '200px', backgroundColor: '#fef3c7' }}
        >
          {listing.categories?.icon || '🏠'}
        </div>

        {/* Listing card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#fef3c7', color: '#1a4a47' }}>
                  {listing.categories?.name}
                </span>
              </div>
              <h1 className="text-xl font-bold mt-2" style={{ color: '#1a4a47' }}>{listing.title}</h1>
              {listing.description && (
                <p className="text-sm text-gray-500 mt-2">{listing.description}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold" style={{ color: '#1a4a47' }}>₹{parseFloat(listing.price).toFixed(0)}</p>
              <p className="text-xs text-gray-400">{listing.unit}</p>
            </div>
          </div>
        </div>

        {/* Vendor info */}
        {listing.vendor_profiles && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Service Provider</p>
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0"
                style={{ backgroundColor: '#fef3c7', color: '#1a4a47' }}
              >
                {listing.vendor_profiles.business_name?.[0]}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold" style={{ color: '#1a4a47' }}>{listing.vendor_profiles.business_name}</h2>
                  {listing.vendor_profiles.is_verified && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Verified</span>
                  )}
                </div>
                {listing.vendor_profiles.address && (
                  <p className="text-sm text-gray-500 mt-0.5">📍 {listing.vendor_profiles.address}</p>
                )}
                {listing.vendor_profiles.rating > 0 && (
                  <p className="text-sm mt-0.5" style={{ color: '#f59e0b' }}>
                    ★ {listing.vendor_profiles.rating.toFixed(1)}
                    <span className="text-gray-400 ml-1">({listing.vendor_profiles.total_reviews} reviews)</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Book button */}
        {!user ? (
          <Link
            to="/login"
            className="block text-center w-full py-3.5 rounded-xl font-semibold text-white transition-colors"
            style={{ backgroundColor: '#1a4a47' }}
          >
            Login to Book
          </Link>
        ) : user.role === 'customer' && !isOwnListing ? (
          <button
            onClick={() => setShowBooking(true)}
            className="w-full py-3.5 rounded-xl font-semibold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: '#1a4a47' }}
          >
            Book Now
          </button>
        ) : null}

      </div>

      {/* Booking Modal */}
      {showBooking && (
        <BookingModal listing={listing} onClose={() => setShowBooking(false)} />
      )}
    </Layout>
  );
}
