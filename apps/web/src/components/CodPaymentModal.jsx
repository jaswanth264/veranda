import { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCode } from 'react-qr-code';
import { createCodPaymentLink, checkCodPayment, confirmCodPayment } from '../api/bookings';

/**
 * CodPaymentModal — shown on VENDOR's screen when they tap "Mark Done" on a COD booking.
 *
 * How it works (same as Rapido/Swiggy merchant QR):
 * 1. Modal opens → server calls Razorpay QR Code API
 * 2. Razorpay assigns a unique VPA (e.g. pay.veranda.qr_xxx@razorpay) to this booking
 * 3. Vendor shows the QR image on their screen
 * 4. Customer scans with GPay/PhonePe → native UPI app opens immediately → enters PIN → pays
 *    (No browser redirect — direct PIN entry, exactly like scanning any merchant QR)
 * 5. Modal polls /check-cod-payment every 3s
 * 6. Razorpay confirms payment → server auto-completes booking → modal auto-closes
 *
 * Cash fallback: "Cash Received" button still works for cash payments.
 */
export default function CodPaymentModal({ booking, onClose }) {
  const overlayRef = useRef(null);
  const queryClient = useQueryClient();
  const [qrData, setQrData] = useState(null); // { qr_id, image_url } from Razorpay
  const [autoCompleted, setAutoCompleted] = useState(false);

  // ── Step 1: Create Razorpay UPI QR Code on mount ───────────────────────────
  // Razorpay assigns a unique VPA per booking — scanning opens native UPI app directly
  const linkMutation = useMutation({
    mutationFn: () => createCodPaymentLink(booking.id),
    onSuccess: (res) => setQrData(res.data),
  });

  useEffect(() => {
    linkMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.id]);

  // ── Step 2: Poll /check-cod-payment every 3s until paid ───────────────────
  useQuery({
    queryKey: ['cod-payment-check', booking.id],
    queryFn: () => checkCodPayment(booking.id).then((r) => r.data),
    // Only poll after QR is created and payment not yet confirmed
    enabled: !!qrData && !autoCompleted,
    refetchInterval: 3000,
    onSuccess: (data) => {
      if (data.completed) {
        setAutoCompleted(true);
        queryClient.invalidateQueries({ queryKey: ['vendor-bookings'] });
        // Auto-close after 2 seconds
        setTimeout(onClose, 2000);
      }
    },
  });

  // ── Cash fallback ──────────────────────────────────────────────────────────
  const cashMutation = useMutation({
    mutationFn: () => confirmCodPayment(booking.id, 'cash'),
    onSuccess: () => {
      setAutoCompleted(true);
      queryClient.invalidateQueries({ queryKey: ['vendor-bookings'] });
      setTimeout(onClose, 2000);
    },
  });

  function handleOverlayClick(e) {
    const busy = linkMutation.isPending || cashMutation.isPending || autoCompleted;
    if (e.target === overlayRef.current && !busy) onClose();
  }

  useEffect(() => {
    function onKey(e) {
      const busy = linkMutation.isPending || cashMutation.isPending || autoCompleted;
      // eslint-disable-next-line no-unused-expressions
      if (e.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, linkMutation.isPending, cashMutation.isPending, autoCompleted]);

  const amount = `₹${Number(booking.amount).toLocaleString('en-IN')}`;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
    >
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: '#fff' }}
      >
        {autoCompleted ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10">
            <div className="text-6xl">✅</div>
            <h3 className="text-xl font-bold" style={{ color: '#1a4a47' }}>Payment Received!</h3>
            <p className="text-sm text-gray-500 text-center">
              {amount} collected.<br />Booking marked as completed.
            </p>
            <p className="text-xs text-gray-400">Closing automatically…</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <h3 className="text-lg font-bold" style={{ color: '#1a4a47' }}>Collect Payment</h3>
                <p className="text-xs text-gray-400">Show QR — auto-detects when customer pays</p>
              </div>
              <button
                onClick={onClose}
                disabled={cashMutation.isPending}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold disabled:opacity-40"
              >×</button>
            </div>

            {/* Amount */}
            <div className="flex justify-center mb-3">
              <span
                className="text-3xl font-extrabold px-6 py-2 rounded-full"
                style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
              >
                {amount}
              </span>
            </div>

            <div className="px-5 pb-5 flex flex-col gap-3">
              {/* QR block */}
              <div
                className="flex flex-col items-center gap-2 p-4 rounded-2xl"
                style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #6ee7b7' }}
              >
                <p className="text-xs font-semibold text-center" style={{ color: '#065f46' }}>
                  📱 Customer scans — GPay / PhonePe opens directly
                </p>

                {linkMutation.isPending && (
                  <div className="py-8 flex flex-col items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: '#6ee7b7', borderTopColor: 'transparent' }}
                    />
                    <p className="text-xs text-gray-400">Generating QR…</p>
                  </div>
                )}

                {linkMutation.isError && (
                  <div className="py-4 text-center">
                    <p className="text-xs text-red-500 mb-2">Failed to generate QR</p>
                    <button
                      onClick={() => linkMutation.mutate()}
                      className="text-xs underline"
                      style={{ color: '#059669' }}
                    >Retry</button>
                  </div>
                )}

                {qrData && (
                  <>
                    <div className="p-3 rounded-xl bg-white shadow">
                      {qrData.upi_string ? (
                        <QRCode value={qrData.upi_string} size={170} />
                      ) : (
                        <img src={qrData.image_url} alt="UPI QR" width={170} height={170} className="block" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-xs text-gray-400">Waiting for payment…</span>
                    </div>
                  </>
                )}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">or</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Cash button */}
              <button
                onClick={() => cashMutation.mutate()}
                disabled={cashMutation.isPending || linkMutation.isPending}
                className="w-full py-3 rounded-xl text-sm font-bold border-2 disabled:opacity-60"
                style={{ borderColor: '#f59e0b', color: '#92400e', backgroundColor: '#fffbeb' }}
              >
                {cashMutation.isPending ? 'Confirming…' : `💵 Cash Received — ${amount}`}
              </button>

              {cashMutation.isError && (
                <p className="text-xs text-red-600 text-center">
                  {cashMutation.error?.response?.data?.error || 'Something went wrong. Try again.'}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
