import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createBooking } from '../api/bookings';
import { createPaymentOrder, verifyPayment } from '../api/payments';

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
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [bookingRef, setBookingRef] = useState(null);
  const [paymentError, setPaymentError] = useState(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const isTiffin = listing?.categories?.type === 'tiffin';
  const addressRequired = isTiffin;
  // Tiffin always pays online (delivery requires prepayment); services can choose
  const [paymentMethod, setPaymentMethod] = useState(isTiffin ? 'online' : 'online');

  const days = getNext7Days();

  const bookingMutation = useMutation({ mutationFn: createBooking });

  function getErrorMessage(err) {
    const status = err?.response?.status;
    const msg = err?.response?.data?.error;
    if (status === 500 || !msg) return 'Something went wrong. Please try again.';
    return msg;
  }

  function loadRazorpayScript() {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime) return;
    if (addressRequired && !address.trim()) return;

    setPaymentError(null);
    setIsProcessingPayment(true);

    try {
      const [h, m] = selectedTime.split(':');
      const dt = new Date(selectedDate);
      dt.setHours(parseInt(h), parseInt(m), 0, 0);

      // Step 1: Create booking (always)
      const bookingRes = await bookingMutation.mutateAsync({
        listing_id: listing.id,
        scheduled_at: dt.toISOString(),
        address: address.trim() || null,
        notes: notes || null,
        payment_method: paymentMethod,
      });
      const booking = bookingRes.data.booking;

      // COD — skip payment, go straight to success
      if (paymentMethod === 'cod') {
        setBookingRef(booking.id.slice(0, 8).toUpperCase());
        setStep(3);
        setIsProcessingPayment(false);
        return;
      }

      // Online — create Razorpay order and open checkout
      const orderRes = await createPaymentOrder(booking.id);
      const order = orderRes.data;

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setPaymentError('Payment gateway failed to load. Please try again.');
        setIsProcessingPayment(false);
        return;
      }

      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'Veranda',
        description: listing.title,
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
              booking_id: booking.id,
            });
            setBookingRef(booking.id.slice(0, 8).toUpperCase());
            setStep(3);
          } catch (err) {
            setPaymentError('Payment received but verification failed. Contact support with ref: ' + booking.id.slice(0, 8).toUpperCase());
          }
          setIsProcessingPayment(false);
        },
        modal: {
          ondismiss: () => {
            setPaymentError('Payment was cancelled. Your booking is saved — retry payment from your dashboard.');
            setIsProcessingPayment(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        setPaymentError(`Payment failed: ${response.error.description}`);
        setIsProcessingPayment(false);
      });
      rzp.open();

    } catch (err) {
      setPaymentError(getErrorMessage(err));
      setIsProcessingPayment(false);
    }
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

              {/* Tiffin delivery info banner */}
              {isTiffin && (
                <div className="rounded-xl p-3 flex gap-2" style={{ backgroundColor: '#fef3c7', border: '1.5px solid #f59e0b' }}>
                  <span className="shrink-0">🛵</span>
                  <p className="text-xs" style={{ color: '#92400e' }}>
                    <strong>Delivery info:</strong> The vendor will prepare and deliver your food — via their own delivery or a service like Rapido. Your address is required.
                  </p>
                </div>
              )}

              {/* Address */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#1a4a47' }}>
                  Delivery Address
                  {addressRequired
                    ? <span className="text-red-500 ml-1">*</span>
                    : <span className="text-gray-400 font-normal ml-1">(optional)</span>}
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={isTiffin ? 'House no, street, area — Vijayawada' : 'Vijayawada, Satyanarayanapuram'}
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none"
                  style={{ borderColor: addressRequired && !address.trim() ? '#ef4444' : '#d1d5db' }}
                />
                {addressRequired && !address.trim() && (
                  <p className="text-xs text-red-500 mt-1">Delivery address is required for food orders</p>
                )}
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

              {/* Payment method — services only (tiffin always online) */}
              {!isTiffin && (
                <div>
                  <p className="text-sm font-semibold mb-2" style={{ color: '#1a4a47' }}>Payment Method</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'online', icon: '💳', title: 'Pay Online', sub: 'UPI, Card, Netbanking' },
                      { value: 'cod',    icon: '💵', title: 'Pay at Doorstep', sub: 'Cash / UPI after service' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setPaymentMethod(opt.value)}
                        className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-center transition-all"
                        style={
                          paymentMethod === opt.value
                            ? { borderColor: '#1a4a47', backgroundColor: '#f0f9f8' }
                            : { borderColor: '#e5e7eb', backgroundColor: '#fff' }
                        }
                      >
                        <span className="text-xl">{opt.icon}</span>
                        <p className="text-xs font-semibold" style={{ color: '#1a4a47' }}>{opt.title}</p>
                        <p className="text-xs text-gray-400">{opt.sub}</p>
                        {paymentMethod === opt.value && (
                          <span className="text-xs font-bold mt-0.5" style={{ color: '#059669' }}>✓ Selected</span>
                        )}
                      </button>
                    ))}
                  </div>
                  {paymentMethod === 'cod' && (
                    <p className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                      💡 You'll pay the vendor directly (cash or UPI) after the service is completed.
                    </p>
                  )}
                </div>
              )}

              {(bookingMutation.isError || paymentError) && (
                <p className="text-red-500 text-sm">
                  {paymentError || getErrorMessage(bookingMutation.error)}
                </p>
              )}

              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setStep(1)}
                  disabled={isProcessingPayment}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm border transition-all disabled:opacity-40"
                  style={{ borderColor: '#1a4a47', color: '#1a4a47' }}
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isProcessingPayment || (addressRequired && !address.trim())}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-60 transition-all"
                  style={{ backgroundColor: '#1a4a47' }}
                >
                  {isProcessingPayment
                    ? 'Processing…'
                    : paymentMethod === 'cod'
                      ? 'Confirm Booking'
                      : `Pay ₹${price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}`}
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
                <h3 className="text-xl font-bold" style={{ color: '#1a4a47' }}>
                  {paymentMethod === 'cod' ? 'Booking Confirmed!' : 'Payment Successful!'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {paymentMethod === 'cod'
                    ? 'Your booking is placed. Pay the vendor after the service is done.'
                    : 'Your booking is confirmed and paid.'}
                </p>
              </div>
              <div
                className="rounded-2xl px-6 py-4 w-full space-y-2"
                style={{ backgroundColor: '#fef3c7' }}
              >
                <div>
                  <p className="text-xs text-gray-500">Booking Reference</p>
                  <p className="font-bold text-lg tracking-widest mt-0.5" style={{ color: '#1a4a47' }}>
                    #{bookingRef}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 justify-center">
                  {paymentMethod === 'cod' ? (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                      💵 Pay at Doorstep — ₹{price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#d1fae5', color: '#065f46' }}>
                      💳 Paid ₹{price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}
                    </span>
                  )}
                </div>
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
