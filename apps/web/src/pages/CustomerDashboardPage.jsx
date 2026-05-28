import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getMyBookings, cancelBooking, confirmCompletion } from '../api/bookings';
import { createPaymentOrder, verifyPayment } from '../api/payments';
import { useBookingRealtime } from '../hooks/useBookingRealtime';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const TABS = [
  { key: '',                       label: 'All' },
  { key: 'pending',                label: 'Upcoming' },
  { key: 'confirmed',              label: 'Confirmed' },
  { key: 'in_progress',            label: '🔧 In Progress' },
  { key: 'out_for_delivery',       label: 'On the Way 🛵' },
  { key: 'completed',              label: 'Completed' },
  { key: 'cancelled',              label: 'Cancelled' },
];

const STATUS_STYLE = {
  pending:          { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
  confirmed:        { bg: '#d1fae5', color: '#065f46', label: 'Confirmed' },
  in_progress:      { bg: '#fef3c7', color: '#92400e', label: '🔧 Service in Progress' },
  out_for_delivery: { bg: '#fce7f3', color: '#9d174d', label: '🛵 On the Way' },
  completed:        { bg: '#dbeafe', color: '#1e40af', label: 'Completed' },
  cancelled:        { bg: '#fee2e2', color: '#991b1b', label: 'Cancelled' },
};

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(iso) {
  const d = new Date(iso);
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} · ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function CustomerDashboardPage() {
  const [activeTab, setActiveTab] = useState('');
  const [doorstepPaying, setDoorstepPaying] = useState(null); // bookingId being paid at doorstep
  const [doorstepError, setDoorstepError] = useState({});   // { [bookingId]: errorMsg }
  const [doorstepPaid, setDoorstepPaid] = useState({});     // { [bookingId]: true }
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['my-bookings', activeTab],
    queryFn: () => getMyBookings(activeTab || undefined).then((r) => r.data.bookings),
    // Poll every 6s when a COD booking is in_progress and paid (waiting for vendor to send completion OTP)
    // or when in_progress + unpaid (so OTP appears right after vendor clicks Mark Done)
    refetchInterval: (query) => {
      const bkgs = query.state.data ?? [];
      const needsPoll = bkgs.some((b) => b.status === 'in_progress' && b.payment_method === 'cod');
      return needsPoll ? 6000 : false;
    },
  });

  // Grab the profileId from the first booking (it's our profiles.id)
  // Used to subscribe to real-time status changes for this customer
  const profileId = data?.[0]?.customer_id ?? null;
  useBookingRealtime(profileId);

  const cancelMutation = useMutation({
    mutationFn: cancelBooking,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-bookings'] }),
  });

  const confirmMutation = useMutation({
    mutationFn: confirmCompletion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-bookings'] }),
  });

  async function handleDoorstepPay(b) {
    setDoorstepPaying(b.id);
    setDoorstepError((prev) => ({ ...prev, [b.id]: null }));
    try {
      const orderRes = await createPaymentOrder(b.id);
      const order = orderRes.data;
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setDoorstepError((prev) => ({ ...prev, [b.id]: 'Payment gateway failed to load.' }));
        setDoorstepPaying(null);
        return;
      }
      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'Veranda',
        description: b.vendor_profiles?.business_name || 'Service payment',
        order_id: order.order_id,
        prefill: {
          name: user?.user_metadata?.full_name || '',
          email: user?.email || '',
          contact: user?.user_metadata?.phone || '',
          method: 'upi',
        },
        theme: { color: '#f59e0b' },
        handler: async (response) => {
          try {
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              booking_id: b.id,
            });
            setDoorstepPaid((prev) => ({ ...prev, [b.id]: true }));
            queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
          } catch {
            setDoorstepError((prev) => ({ ...prev, [b.id]: 'Payment received but verification failed. Contact support.' }));
          }
          setDoorstepPaying(null);
        },
        modal: {
          ondismiss: () => setDoorstepPaying(null),
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (e) => {
        setDoorstepError((prev) => ({ ...prev, [b.id]: `Payment failed: ${e.error.description}` }));
        setDoorstepPaying(null);
      });
      rzp.open();
    } catch (err) {
      setDoorstepError((prev) => ({ ...prev, [b.id]: err?.response?.data?.error || 'Payment failed.' }));
      setDoorstepPaying(null);
    }
  }

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
                  className="bg-white rounded-2xl p-5 flex flex-col gap-4"
                  style={{ border: '1.5px solid #e8f5f4' }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: '#fef3c7' }}>
                      {b.listings?.categories?.icon || '🏠'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm" style={{ color: '#1a4a47' }}>{b.listings?.title}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: badge.bg, color: badge.color }}>{badge.label}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{b.vendor_profiles?.business_name}</p>
                      <p className="text-xs text-gray-500 mt-1">📅 {formatDate(b.scheduled_at)}</p>
                      {b.address && <p className="text-xs text-gray-400 mt-0.5">📍 {b.address}</p>}
                    </div>

                    {/* Price + cancel */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <p className="font-bold" style={{ color: '#1a4a47' }}>₹{parseFloat(b.amount).toFixed(0)}</p>
                      {b.status === 'pending' && (
                        <button onClick={() => cancelMutation.mutate(b.id)} disabled={cancelMutation.isPending} className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-all disabled:opacity-60" style={{ borderColor: '#ef4444', color: '#ef4444' }}>
                          Cancel
                        </button>
                      )}
                      {b.status === 'completed' && (
                        <button className="text-xs px-3 py-1.5 rounded-lg font-medium text-white" style={{ backgroundColor: '#1a4a47' }}>Leave a Review</button>
                      )}
                    </div>
                  </div>

                  {/* In-progress banner — service is underway */}
                  {b.status === 'in_progress' && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: '#fef3c7', border: '1.5px solid #fcd34d' }}>
                        <span className="text-lg">🔧</span>
                        <p className="text-sm font-medium" style={{ color: '#92400e' }}>Service is in progress at your location.</p>
                      </div>
                      {/* COD — pay via Razorpay at doorstep (platform QR, not vendor UPI) */}
                      {b.payment_method === 'cod' && b.payment_status !== 'paid' && !doorstepPaid[b.id] && (
                        <>
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: '#fff7ed', border: '1.5px solid #fb923c' }}>
                            <span className="animate-pulse">💳</span>
                            <p className="text-xs font-semibold" style={{ color: '#c2410c' }}>
                              Payment due — please pay now to complete the service.
                            </p>
                          </div>
                          <button
                            onClick={() => handleDoorstepPay(b)}
                            disabled={doorstepPaying === b.id}
                            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold transition disabled:opacity-60 shadow-lg"
                            style={{ backgroundColor: '#f59e0b', color: '#fff', boxShadow: '0 0 0 4px rgba(245,158,11,0.25)' }}
                          >
                            <span>📱</span>
                            {doorstepPaying === b.id ? 'Opening payment...' : `Pay ₹${Number(b.amount).toLocaleString('en-IN')} via UPI / Card`}
                          </button>
                          {doorstepError[b.id] && (
                            <p className="text-xs text-red-600">{doorstepError[b.id]}</p>
                          )}
                        </>
                      )}
                      {/* Already paid at doorstep — show completion OTP so customer can give to vendor */}
                      {(b.payment_status === 'paid' || doorstepPaid[b.id]) && b.completion_otp && (
                        <div className="flex flex-col gap-1 p-3 rounded-xl" style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #6ee7b7' }}>
                          <p className="text-xs font-semibold" style={{ color: '#065f46' }}>✅ Payment received! Give this code to the vendor:</p>
                          <p className="text-3xl font-mono font-black tracking-widest text-center py-1" style={{ color: '#1a4a47' }}>{b.completion_otp}</p>
                          <p className="text-xs text-center" style={{ color: '#6b7280' }}>Read this 6-digit code to the vendor to complete the service.</p>
                        </div>
                      )}
                      {(b.payment_status === 'paid' || doorstepPaid[b.id]) && !b.completion_otp && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: '#d1fae5', border: '1px solid #6ee7b7' }}>
                          <span>✅</span>
                          <p className="text-xs font-semibold" style={{ color: '#065f46' }}>Payment of ₹{Number(b.amount).toLocaleString('en-IN')} received.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Awaiting confirmation banner — vendor needs OTP from customer */}
                  {b.status === 'awaiting_confirmation' && (
                    <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ backgroundColor: '#ede9fe', border: '1.5px solid #c4b5fd' }}>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#5b21b6' }}>✅ Vendor says the service is done!</p>
                        <p className="text-xs mt-0.5" style={{ color: '#7c3aed' }}>
                          A <strong>6-digit OTP</strong> was sent to your registered phone number. Read it to the vendor to confirm the service.
                        </p>
                      </div>
                      {/* Dev-mode hint — remove in production */}
                      {import.meta.env.DEV && (
                        <p className="text-xs px-2 py-1 rounded-lg font-mono" style={{ backgroundColor: '#1e1e2e', color: '#a6e3a1' }}>
                          🔧 Dev: check server console for OTP
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
