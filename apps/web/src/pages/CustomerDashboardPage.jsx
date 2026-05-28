import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getMyBookings, cancelBooking } from '../api/bookings';
import Layout from '../components/Layout';

const TABS = [
  { key: '',           label: 'All' },
  { key: 'pending',    label: 'Upcoming' },
  { key: 'confirmed',  label: 'Confirmed' },
  { key: 'completed',  label: 'Completed' },
  { key: 'cancelled',  label: 'Cancelled' },
];

const STATUS_STYLE = {
  pending:   { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
  confirmed: { bg: '#d1fae5', color: '#065f46', label: 'Confirmed' },
  completed: { bg: '#dbeafe', color: '#1e40af', label: 'Completed' },
  cancelled: { bg: '#fee2e2', color: '#991b1b', label: 'Cancelled' },
};

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(iso) {
  const d = new Date(iso);
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} · ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function CustomerDashboardPage() {
  const [activeTab, setActiveTab] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['my-bookings', activeTab],
    queryFn: () => getMyBookings(activeTab || undefined).then((r) => r.data.bookings),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelBooking,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-bookings'] }),
  });

  const bookings = data || [];

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8">

        <h1 className="text-2xl font-bold mb-1" style={{ color: '#1a4a47' }}>My Bookings</h1>
        <p className="text-sm text-gray-400 mb-6">Track all your service and food bookings</p>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="px-4 py-2 rounded-full text-sm font-medium transition-all"
              style={
                activeTab === t.key
                  ? { backgroundColor: '#1a4a47', color: '#fff' }
                  : { backgroundColor: '#fff', color: '#1a4a47', border: '1.5px solid #d1d5db' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-white animate-pulse" style={{ border: '1.5px solid #e8f5f4' }} />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📅</p>
            <p className="font-semibold" style={{ color: '#1a4a47' }}>No bookings yet</p>
            <p className="text-sm text-gray-400 mt-1">Browse listings and make your first booking</p>
            <Link
              to="/"
              className="inline-block mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: '#1a4a47' }}
            >
              Browse Listings
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => {
              const badge = STATUS_STYLE[b.status] || STATUS_STYLE.pending;
              return (
                <div
                  key={b.id}
                  className="bg-white rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                  style={{ border: '1.5px solid #e8f5f4' }}
                >
                  {/* Icon */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ backgroundColor: '#fef3c7' }}
                  >
                    {b.listings?.categories?.icon || '🏠'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm" style={{ color: '#1a4a47' }}>
                        {b.listings?.title}
                      </p>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: badge.bg, color: badge.color }}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{b.vendor_profiles?.business_name}</p>
                    <p className="text-xs text-gray-500 mt-1">📅 {formatDate(b.scheduled_at)}</p>
                    {b.address && <p className="text-xs text-gray-400 mt-0.5">📍 {b.address}</p>}
                  </div>

                  {/* Price + action */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <p className="font-bold" style={{ color: '#1a4a47' }}>
                      ₹{parseFloat(b.amount).toFixed(0)}
                    </p>
                    {b.status === 'pending' && (
                      <button
                        onClick={() => cancelMutation.mutate(b.id)}
                        disabled={cancelMutation.isPending}
                        className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-all disabled:opacity-60"
                        style={{ borderColor: '#ef4444', color: '#ef4444' }}
                      >
                        Cancel
                      </button>
                    )}
                    {b.status === 'completed' && (
                      <button
                        className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
                        style={{ backgroundColor: '#1a4a47' }}
                      >
                        Leave a Review
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
