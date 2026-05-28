import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getMyVendorProfile } from '../api/vendor';
import { getMyListings, updateListing } from '../api/listings';
import { getVendorBookings, updateBookingStatus, sendArrivalOtp, sendCompletionOtp, verifyCompletionOtp } from '../api/bookings';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { icon: '⊞', label: 'Dashboard' },
  { icon: '☰', label: 'My Listings' },
  { icon: '📅', label: 'Bookings' },
  { icon: '👤', label: 'Profile Settings' },
];

const STATUS_COLORS = {
  pending:                { bg: '#fef3c7', color: '#92400e' },
  confirmed:              { bg: '#d1fae5', color: '#065f46' },
  in_progress:            { bg: '#fef3c7', color: '#92400e' },
  out_for_delivery:       { bg: '#fce7f3', color: '#9d174d' },
  awaiting_confirmation:  { bg: '#ede9fe', color: '#5b21b6' },
  completed:              { bg: '#dbeafe', color: '#1e40af' },
  cancelled:              { bg: '#fee2e2', color: '#991b1b' },
};

const STATUS_LABELS = {
  pending: 'Pending', confirmed: 'Confirmed', in_progress: '🔧 In Progress',
  out_for_delivery: '🛵 On the Way', completed: 'Completed', cancelled: 'Cancelled',
};

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: '#fef3c7' }}>
      <p className="text-sm font-medium" style={{ color: '#4b7c78' }}>{label}</p>
      <p className="text-3xl font-bold mt-2" style={{ color: '#1a4a47' }}>{value}</p>
    </div>
  );
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50"
      style={{ backgroundColor: checked ? '#f59e0b' : '#d1d5db' }}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform"
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </button>
  );
}

// ── Bookings Tab ──────────────────────────────────────────────────────────────
function BookingsTab() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [confirmingId, setConfirmingId] = useState(null);
  const [arrivedIds, setArrivedIds] = useState(new Set());
  const [otpInputs, setOtpInputs] = useState({});
  const [devOtps, setDevOtps] = useState({});
  const [doneIds, setDoneIds] = useState(new Set());       // in_progress bookings where "Mark Done" clicked
  const [completionDevOtps, setCompletionDevOtps] = useState({}); // dev OTPs for completion step

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['vendor-bookings', filter],
    queryFn: () => getVendorBookings(filter === 'all' ? null : filter).then((r) => r.data.bookings),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateBookingStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-bookings'] });
      setConfirmingId(null);
    },
  });

  const otpMutation = useMutation({
    mutationFn: ({ id, otp }) => verifyCompletionOtp(id, otp),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-bookings'] });
      setOtpInputs(prev => { const n = { ...prev }; delete n[id]; delete n[`done_${id}`]; return n; });
      setArrivedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      setDoneIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    },
  });

  const sendOtpMutation = useMutation({
    mutationFn: (id) => sendArrivalOtp(id),
    onSuccess: (res, id) => {
      setArrivedIds(prev => new Set([...prev, id]));
      if (res.data?.dev_otp) setDevOtps(prev => ({ ...prev, [id]: res.data.dev_otp }));
    },
  });

  const sendCompletionMutation = useMutation({
    mutationFn: (id) => sendCompletionOtp(id),
    onSuccess: (res, id) => {
      setDoneIds(prev => new Set([...prev, id]));
      if (res.data?.dev_otp) setCompletionDevOtps(prev => ({ ...prev, [id]: res.data.dev_otp }));
    },
  });

  const FILTERS = ['all', 'pending', 'confirmed', 'in_progress', 'out_for_delivery', 'completed', 'cancelled'];
  const FILTER_LABELS = {
    all: 'All', pending: 'Pending', confirmed: 'Confirmed', in_progress: 'In Progress',
    out_for_delivery: 'Out for Delivery', completed: 'Completed', cancelled: 'Cancelled',
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold" style={{ color: '#1a4a47' }}>Incoming Bookings</h2>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
            style={
              filter === f
                ? { backgroundColor: '#1a4a47', color: '#fff' }
                : { backgroundColor: '#fff', color: '#4b7c78', border: '1.5px solid #e8f5f4' }
            }
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-gray-400 text-sm">Loading…</p>}

      {!isLoading && bookings.length === 0 && (
        <div className="rounded-2xl p-10 text-center" style={{ backgroundColor: '#fff', border: '2px dashed #e8f5f4' }}>
          <p className="text-4xl mb-2">📭</p>
          <p className="font-semibold" style={{ color: '#1a4a47' }}>No bookings yet</p>
          <p className="text-sm text-gray-400 mt-1">Bookings from customers will appear here</p>
        </div>
      )}

      {/* Mark-Done confirmation modal */}
      {confirmingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <p className="text-4xl mb-3">✅</p>
            <h3 className="font-bold text-lg mb-1" style={{ color: '#1a4a47' }}>Mark service as done?</h3>
            <p className="text-sm text-gray-500 mb-5">
              This will send a <strong>6-digit OTP</strong> to the customer’s registered phone number. Ask the customer for the code to complete the booking.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => statusMutation.mutate({ id: confirmingId, status: 'awaiting_confirmation' })}
                disabled={statusMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: '#1a4a47' }}
              >
                {statusMutation.isPending ? 'Sending…' : 'Yes, notify customer'}
              </button>
              <button
                onClick={() => setConfirmingId(null)}
                disabled={statusMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: '#f3f4f6', color: '#374151' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {bookings.map((b) => {
          const sc = STATUS_COLORS[b.status] || STATUS_COLORS.pending;
          const dt = new Date(b.scheduled_at);
          const isTiffin = b.listings?.categories?.type === 'tiffin';
          const statusLabel = STATUS_LABELS[b.status] || b.status;
          return (
            <div key={b.id} className="rounded-2xl p-4" style={{ backgroundColor: '#fff', border: '1.5px solid #e8f5f4' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{isTiffin ? '🍱' : '🔧'}</span>
                    <span className="font-semibold text-sm" style={{ color: '#1a4a47' }}>
                      {b.listings?.title || 'Listing'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize" style={{ backgroundColor: sc.bg, color: sc.color }}>
                      {statusLabel}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">👤 {b.profiles?.full_name || 'Customer'} · 📞 {b.profiles?.phone || '—'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    📅 {dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {/* Delivery address — prominent for tiffin */}
                  {b.address && (
                    <div className={`flex items-start gap-1.5 mt-1.5 px-2 py-1.5 rounded-lg text-xs ${isTiffin ? 'font-semibold' : ''}`}
                      style={isTiffin ? { backgroundColor: '#fef3c7', color: '#92400e' } : { color: '#6b7280' }}>
                      📍 {isTiffin && <span className="shrink-0">Deliver to: </span>}{b.address}
                    </div>
                  )}
                  {!b.address && isTiffin && (
                    <p className="text-xs text-red-400 mt-1">⚠️ No delivery address provided — contact customer</p>
                  )}
                  {b.notes && <p className="text-xs text-gray-500 mt-0.5">📝 {b.notes}</p>}
                  <p className="text-sm font-bold mt-1" style={{ color: '#f59e0b' }}>₹{Number(b.amount).toLocaleString('en-IN')}</p>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  {b.status === 'pending' && (<>
                    <button onClick={() => statusMutation.mutate({ id: b.id, status: 'confirmed' })} disabled={statusMutation.isPending} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#1a4a47' }}>Accept</button>
                    <button onClick={() => statusMutation.mutate({ id: b.id, status: 'cancelled' })} disabled={statusMutation.isPending} className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>Decline</button>
                  </>)}

                  {/* Tiffin flow: confirmed → out_for_delivery → completed */}
                  {b.status === 'confirmed' && isTiffin && (
                    <button onClick={() => statusMutation.mutate({ id: b.id, status: 'out_for_delivery' })} disabled={statusMutation.isPending} className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ backgroundColor: '#fce7f3', color: '#9d174d' }}>
                      🛵 Out for Delivery
                    </button>
                  )}
                  {b.status === 'out_for_delivery' && isTiffin && (
                    <button onClick={() => statusMutation.mutate({ id: b.id, status: 'completed' })} disabled={statusMutation.isPending} className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}>
                      ✅ Mark Delivered
                    </button>
                  )}

                  {/* Services flow: confirmed → in_progress (via arrival OTP) → completed */}
                  {b.status === 'confirmed' && !isTiffin && !arrivedIds.has(b.id) && (
                    <button
                      onClick={() => sendOtpMutation.mutate(b.id)}
                      disabled={sendOtpMutation.isPending}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                      style={{ backgroundColor: '#ede9fe', color: '#5b21b6' }}
                    >
                      {sendOtpMutation.isPending ? 'Sending…' : '📍 I’ve Arrived'}
                    </button>
                  )}
                  {b.status === 'confirmed' && !isTiffin && arrivedIds.has(b.id) && (
                    <div className="flex flex-col gap-1.5 items-end">
                      {devOtps[b.id] && (
                        <div className="px-3 py-1.5 rounded-lg text-center" style={{ backgroundColor: '#1e1e2e', border: '1.5px solid #a6e3a1' }}>
                          <p className="text-xs" style={{ color: '#a6e3a1' }}>🔧 Dev OTP</p>
                          <p className="text-xl font-mono font-bold tracking-widest" style={{ color: '#cdd6f4' }}>{devOtps[b.id]}</p>
                        </div>
                      )}
                      <p className="text-xs font-medium" style={{ color: '#7c3aed' }}>📱 Enter OTP from customer</p>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="000000"
                          value={otpInputs[b.id] || ''}
                          onChange={(e) => setOtpInputs(prev => ({ ...prev, [b.id]: e.target.value.replace(/\D/g, '') }))}
                          className="w-24 px-2 py-1.5 rounded-lg border text-center text-sm font-mono tracking-widest focus:outline-none"
                          style={{ borderColor: '#c4b5fd', backgroundColor: '#faf5ff' }}
                        />
                        <button
                          onClick={() => otpMutation.mutate({ id: b.id, otp: otpInputs[b.id] })}
                          disabled={otpMutation.isPending || !otpInputs[b.id] || otpInputs[b.id].length !== 6}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                          style={{ backgroundColor: '#7c3aed' }}
                        >
                          {otpMutation.isPending ? '…' : 'Start ✓'}
                        </button>
                      </div>
                      <button
                        onClick={() => sendOtpMutation.mutate(b.id)}
                        disabled={sendOtpMutation.isPending}
                        className="text-xs underline"
                        style={{ color: '#9ca3af' }}
                      >
                        Resend OTP
                      </button>
                      {otpMutation.isError && otpMutation.variables?.id === b.id && (
                        <p className="text-xs" style={{ color: '#dc2626' }}>
                          {otpMutation.error?.response?.data?.error || 'Invalid OTP'}
                        </p>
                      )}
                    </div>
                  )}
                  {b.status === 'in_progress' && !isTiffin && !doneIds.has(b.id) && (
                    <button
                      onClick={() => sendCompletionMutation.mutate(b.id)}
                      disabled={sendCompletionMutation.isPending}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                      style={{ backgroundColor: '#d1fae5', color: '#065f46' }}
                    >
                      {sendCompletionMutation.isPending ? 'Sending…' : '✅ Mark Done'}
                    </button>
                  )}
                  {b.status === 'in_progress' && !isTiffin && doneIds.has(b.id) && (
                    <div className="flex flex-col gap-1.5 items-end">
                      {completionDevOtps[b.id] && (
                        <div className="px-3 py-1.5 rounded-lg text-center" style={{ backgroundColor: '#1e1e2e', border: '1.5px solid #89b4fa' }}>
                          <p className="text-xs" style={{ color: '#89b4fa' }}>🔧 Completion OTP</p>
                          <p className="text-xl font-mono font-bold tracking-widest" style={{ color: '#cdd6f4' }}>{completionDevOtps[b.id]}</p>
                        </div>
                      )}
                      <p className="text-xs font-medium" style={{ color: '#065f46' }}>📱 Enter completion OTP</p>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="000000"
                          value={otpInputs[`done_${b.id}`] || ''}
                          onChange={(e) => setOtpInputs(prev => ({ ...prev, [`done_${b.id}`]: e.target.value.replace(/\D/g, '') }))}
                          className="w-24 px-2 py-1.5 rounded-lg border text-center text-sm font-mono tracking-widest focus:outline-none"
                          style={{ borderColor: '#6ee7b7', backgroundColor: '#f0fdf4' }}
                        />
                        <button
                          onClick={() => otpMutation.mutate({ id: b.id, otp: otpInputs[`done_${b.id}`] })}
                          disabled={otpMutation.isPending || !otpInputs[`done_${b.id}`] || otpInputs[`done_${b.id}`].length !== 6}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                          style={{ backgroundColor: '#059669' }}
                        >
                          {otpMutation.isPending ? '…' : 'Done ✓'}
                        </button>
                      </div>
                      <button
                        onClick={() => sendCompletionMutation.mutate(b.id)}
                        disabled={sendCompletionMutation.isPending}
                        className="text-xs underline"
                        style={{ color: '#9ca3af' }}
                      >
                        Resend OTP
                      </button>
                      {otpMutation.isError && otpMutation.variables?.id === b.id && (
                        <p className="text-xs" style={{ color: '#dc2626' }}>
                          {otpMutation.error?.response?.data?.error || 'Invalid OTP'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Listings Tab ──────────────────────────────────────────────────────────────
function ListingsTab({ listings }) {
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => updateListing(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-listings'] }),
  });

  if (listings.length === 0) {
    return (
      <div className="rounded-2xl p-10 flex flex-col items-center text-center" style={{ backgroundColor: '#fff', border: '2px dashed #e8f5f4' }}>
        <p className="text-4xl mb-3">+</p>
        <p className="font-semibold" style={{ color: '#1a4a47' }}>Add your first listing</p>
        <p className="text-sm text-gray-400 mt-1 mb-4">Customers will see it on the home page</p>
        <Link to="/vendor/listings/new" className="px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#1a4a47' }}>
          Create Listing
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold" style={{ color: '#1a4a47' }}>My Listings</h2>
        <Link to="/vendor/listings/new" className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#1a4a47' }}>
          + Add New
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {listings.map((listing) => (
          <div key={listing.id} className="flex items-center gap-3 rounded-2xl p-4" style={{ backgroundColor: '#fff', border: '1.5px solid #e8f5f4' }}>
            <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: '#fef3c7' }}>
              <span className="text-2xl">{listing.categories?.icon || '🍱'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate" style={{ color: '#1a4a47' }}>{listing.title}</p>
              <p className="text-xs text-gray-400">{listing.categories?.name}</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: '#f59e0b' }}>₹{Number(listing.price).toLocaleString('en-IN')} / {listing.unit}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link to={`/listings/${listing.id}`} className="text-gray-400 hover:text-gray-600 text-sm">✏️</Link>
              <Toggle
                checked={listing.is_active}
                onChange={() => toggleMutation.mutate({ id: listing.id, is_active: !listing.is_active })}
                disabled={toggleMutation.isPending}
              />
            </div>
          </div>
        ))}
        <Link to="/vendor/listings/new" className="flex flex-col items-center justify-center rounded-2xl p-4 transition-all hover:scale-[1.02]" style={{ backgroundColor: '#1a4a47', minHeight: '80px' }}>
          <span className="text-3xl text-white/80">+</span>
          <span className="text-white/80 text-sm font-medium mt-1">Add New Listing</span>
        </Link>
      </div>
    </div>
  );
}

export default function VendorDashboardPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('Dashboard');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['vendor-profile-me'],
    queryFn: () => getMyVendorProfile().then((r) => r.data.vendor_profile),
  });

  const { data: listings = [] } = useQuery({
    queryKey: ['my-listings'],
    queryFn: () => getMyListings().then((r) => r.data.listings),
  });

  const { data: allBookings = [] } = useQuery({
    queryKey: ['vendor-bookings', 'all'],
    queryFn: () => getVendorBookings(null).then((r) => r.data.bookings),
  });

  const pendingCount = allBookings.filter((b) => b.status === 'pending').length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fef9f0' }}>
        <p className="text-gray-400">Loading your dashboard…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fef9f0' }}>
        <div className="text-center">
          <p className="text-gray-500 mb-4">Could not load your vendor profile.</p>
          <Link to="/vendor/setup" style={{ color: '#f59e0b' }} className="underline">Complete setup</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#fef9f0' }}>
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 py-6 px-4 gap-1" style={{ backgroundColor: '#fff', borderRight: '1.5px solid #e8f5f4' }}>
        <div className="text-xl font-bold mb-6 px-2" style={{ color: '#1a4a47' }}>Veranda</div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            onClick={() => setActiveTab(item.label)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative text-left w-full"
            style={
              activeTab === item.label
                ? { backgroundColor: '#1a4a47', color: '#fff' }
                : { color: '#4b7c78' }
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
            {item.label === 'Bookings' && pendingCount > 0 && (
              <span className="absolute right-3 w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold" style={{ backgroundColor: '#f59e0b', color: '#1a4a47' }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
        {/* Logout */}
        <div className="mt-auto pt-4 border-t" style={{ borderColor: '#e8f5f4' }}>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full transition-all hover:bg-red-50"
            style={{ color: '#ef4444' }}
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 flex border-t z-40" style={{ backgroundColor: '#fff', borderColor: '#e8f5f4' }}>
        {NAV_ITEMS.map((item) => (
          <button key={item.label} onClick={() => setActiveTab(item.label)} className="flex-1 flex flex-col items-center py-3 gap-1 relative">
            <span className="text-lg">{item.icon}</span>
            <span className="text-[10px]" style={{ color: activeTab === item.label ? '#1a4a47' : '#9ca3af' }}>{item.label}</span>
            {item.label === 'Bookings' && pendingCount > 0 && (
              <span className="absolute top-1 right-1/4 w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold" style={{ backgroundColor: '#f59e0b', color: '#1a4a47' }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 lg:p-8 space-y-6 max-w-4xl pb-24 lg:pb-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1a4a47' }}>
              {activeTab === 'Dashboard' ? `Hello, ${data.business_name}!` : activeTab}
            </h1>
            {activeTab === 'Dashboard' && (
              <p className="text-sm mt-1" style={{ color: '#4b7c78' }}>Welcome to your vendor dashboard on Veranda!</p>
            )}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'Dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Total Bookings" value={allBookings.length} />
              <StatCard label="Pending Requests" value={pendingCount} />
            </div>

            {/* Recent pending bookings */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: '#1a4a47' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold">Recent Booking Requests</h2>
                <button onClick={() => setActiveTab('Bookings')} className="text-xs font-medium" style={{ color: '#f59e0b' }}>View all →</button>
              </div>
              {allBookings.filter((b) => b.status === 'pending').length === 0 ? (
                <p className="text-white/60 text-sm">No pending requests</p>
              ) : (
                <div className="space-y-3">
                  {allBookings.filter((b) => b.status === 'pending').slice(0, 3).map((b) => (
                    <div key={b.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-medium">{b.listings?.title || 'Booking'}</p>
                        <p className="text-white/60 text-xs">{b.profiles?.full_name || 'Customer'} · ₹{Number(b.amount).toLocaleString('en-IN')}</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('Bookings')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ backgroundColor: '#fef3c7', color: '#1a4a47' }}
                      >
                        Review
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Listings preview */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-lg" style={{ color: '#1a4a47' }}>My Listings</h2>
                <button onClick={() => setActiveTab('My Listings')} className="text-sm" style={{ color: '#f59e0b' }}>Manage →</button>
              </div>
              {listings.length === 0 ? (
                <Link to="/vendor/listings/new" className="flex items-center gap-3 rounded-2xl p-4" style={{ backgroundColor: '#fff', border: '2px dashed #e8f5f4' }}>
                  <span className="text-2xl">+</span>
                  <span className="text-sm font-medium" style={{ color: '#1a4a47' }}>Add your first listing</span>
                </Link>
              ) : (
                <p className="text-sm" style={{ color: '#4b7c78' }}>{listings.length} listing{listings.length !== 1 ? 's' : ''} · {listings.filter((l) => l.is_active).length} active</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Bookings' && <BookingsTab />}
        {activeTab === 'My Listings' && <ListingsTab listings={listings} />}
        {activeTab === 'Profile Settings' && (
          <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: '#fff', border: '1.5px solid #e8f5f4' }}>
            <p className="text-4xl mb-3">👤</p>
            <p className="font-semibold mb-2" style={{ color: '#1a4a47' }}>Profile Settings</p>
            <p className="text-sm text-gray-400 mb-4">Update your business details and contact info</p>
            <Link to="/vendor/setup" className="px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#1a4a47' }}>
              Edit Profile
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
