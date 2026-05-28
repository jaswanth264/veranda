import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createBooking } from '../api/bookings';

const TIME_SLOTS = [
  { key: '08:00', label: 'Morning', sub: '8:00 AM' },
  { key: '12:00', label: 'Afternoon', sub: '12:00 PM' },
  { key: '17:00', label: 'Evening', sub: '5:00 PM' },
];

// Build next 7 days
function getNext7Days() {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function BookingModal({ listing, onClose }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [bookingRef, setBookingRef] = useState(null);

  const days = getNext7Days();

  const mutation = useMutation({
    mutationFn: createBooking,
    onSuccess: (res) => {
      setBookingRef(res.data.booking.id.slice(0, 8).toUpperCase());
      setStep(3);
    },
  });

  // Return a safe, user-friendly error message — never expose raw server/DB errors
  function getErrorMessage(err) {
    const status = err?.response?.status;
    const msg = err?.response?.data?.error;
    if (status === 500 || !msg) return 'Something went wrong. Please try again.';
    return msg;
  }

  const handleConfirm = () => {
    if (!selectedDate || !selectedTime) return;
    // Combine date + time into ISO string
    const [h, m] = selectedTime.split(':');
    const dt = new Date(selectedDate);
    dt.setHours(parseInt(h), parseInt(m), 0, 0);

    mutation.mutate({
      listing_id: listing.id,
      scheduled_at: dt.toISOString(),
      address: address || null,
      notes: notes || null,
    });
  };

  const price = parseFloat(listing.price);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Modal panel */}
      <div
        className="h-full w-full max-w-md flex flex-col overflow-y-auto"
        style={{ backgroundColor: '#fff' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ backgroundColor: '#f59e0b' }}
        >
          <h2 className="font-bold text-lg" style={{ color: '#1a4a47' }}>Booking</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold"
            style={{ backgroundColor: 'rgba(26,74,71,0.15)', color: '#1a4a47' }}
          >
            ✕
          </button>
        </div>

        <div className="flex-1 px-6 py-6">

          {/* ── STEP 1: Date & Time ── */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Date strip */}
              <div>
                <p className="font-semibold mb-3" style={{ color: '#1a4a47' }}>Date</p>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold" style={{ color: '#1a4a47' }}>
                    {MONTH_NAMES[new Date().getMonth()]} {new Date().getFullYear()}
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1">
                  {DAY_NAMES.map((d) => (
                    <div key={d} className="font-medium text-gray-400">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {days.map((d) => {
                    const isSelected = selectedDate?.toDateString() === d.toDateString();
                    return (
                      <button
                        key={d.toDateString()}
                        onClick={() => setSelectedDate(d)}
                        className="py-2 rounded-lg text-sm font-medium transition-all"
                        style={
                          isSelected
                            ? { backgroundColor: '#f59e0b', color: '#1a4a47', fontWeight: 700 }
                            : { color: '#1a4a47' }
                        }
                      >
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time slots */}
              <div>
                <p className="font-semibold mb-3" style={{ color: '#1a4a47' }}>Time Slot</p>
                <div className="flex gap-2 flex-wrap">
                  {TIME_SLOTS.map((t) => {
                    const isSelected = selectedTime === t.key;
                    return (
                      <button
                        key={t.key}
                        onClick={() => setSelectedTime(t.key)}
                        className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                        style={
                          isSelected
                            ? { backgroundColor: '#1a4a47', color: '#fff' }
                            : { backgroundColor: '#fef3c7', color: '#1a4a47' }
                        }
                      >
                        {t.sub}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!selectedDate || !selectedTime}
                className="w-full py-3.5 rounded-xl font-semibold text-white disabled:opacity-40 transition-all mt-4"
                style={{ backgroundColor: '#1a4a47' }}
              >
                Continue
              </button>
            </div>
          )}

          {/* ── STEP 2: Confirm details ── */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Summary card */}
              <div className="rounded-2xl p-4" style={{ backgroundColor: '#fef3c7' }}>
                <p className="font-semibold text-sm" style={{ color: '#1a4a47' }}>{listing.title}</p>
                <p className="text-xs text-gray-500 mt-1">{listing.vendor_profiles?.business_name}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-600">
                  <span>
                    📅 {selectedDate && `${DAY_NAMES[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTH_NAMES[selectedDate.getMonth()]}`}
                  </span>
                  <span>
                    🕐 {TIME_SLOTS.find((t) => t.key === selectedTime)?.sub}
                  </span>
                </div>
                <p className="text-lg font-bold mt-3" style={{ color: '#1a4a47' }}>
                  ₹{price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}
                  <span className="text-xs font-normal text-gray-400 ml-1">{listing.unit}</span>
                </p>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#1a4a47' }}>Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Vijayawada, Satyanarayanapuram"
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none"
                  style={{ borderColor: '#d1d5db' }}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#1a4a47' }}>
                  Special Instructions <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special instructions…"
                  rows={3}
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
                  style={{ borderColor: '#d1d5db' }}
                />
              </div>

              {mutation.isError && (
                <p className="text-red-500 text-sm">{getErrorMessage(mutation.error)}</p>
              )}

              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm border transition-all"
                  style={{ borderColor: '#1a4a47', color: '#1a4a47' }}
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={mutation.isPending}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-60 transition-all"
                  style={{ backgroundColor: '#1a4a47' }}
                >
                  {mutation.isPending ? 'Booking…' : 'Confirm Booking'}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Success ── */}
          {step === 3 && (
            <div className="flex flex-col items-center text-center py-10 gap-5">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
                style={{ backgroundColor: '#d1fae5' }}
              >
                ✅
              </div>
              <div>
                <h3 className="text-xl font-bold" style={{ color: '#1a4a47' }}>Booking Confirmed!</h3>
                <p className="text-sm text-gray-500 mt-1">Your booking has been placed successfully.</p>
              </div>
              <div
                className="rounded-2xl px-6 py-4 w-full"
                style={{ backgroundColor: '#fef3c7' }}
              >
                <p className="text-xs text-gray-500">Booking Reference</p>
                <p className="font-bold text-lg tracking-widest mt-1" style={{ color: '#1a4a47' }}>
                  #{bookingRef}
                </p>
              </div>
              <div className="flex flex-col gap-3 w-full mt-2">
                <button
                  onClick={() => { onClose(); navigate('/dashboard'); }}
                  className="w-full py-3 rounded-xl font-semibold text-white"
                  style={{ backgroundColor: '#1a4a47' }}
                >
                  View My Bookings
                </button>
                <button
                  onClick={() => { onClose(); navigate('/'); }}
                  className="w-full py-3 rounded-xl font-semibold border"
                  style={{ borderColor: '#1a4a47', color: '#1a4a47' }}
                >
                  Go Home
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
