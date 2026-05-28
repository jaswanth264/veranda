import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';

const STATUS_MESSAGES = {
  confirmed:        { msg: '🎉 Your booking has been confirmed by the vendor!', type: 'success' },
  in_progress:      { msg: '🔧 The service provider has arrived and started work!', type: 'info' },
  out_for_delivery: { msg: '🛵 Your food is on the way! Vendor has dispatched your order.', type: 'info' },
  completed:        { msg: '✅ Your booking is now completed. Thanks for using Veranda!', type: 'success' },
  cancelled:        { msg: '❌ Your booking was cancelled by the vendor.', type: 'error' },
};

/**
 * Subscribes to real-time booking status changes for the current customer.
 * Shows a toast and refreshes the bookings query whenever status changes.
 *
 * @param {string|null} profileId - the profiles.id of the logged-in customer
 */
export function useBookingRealtime(profileId) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const channelRef = useRef(null);

  useEffect(() => {
    if (!profileId) return;

    // Subscribe to all booking rows where customer_id = profileId
    const channel = supabase
      .channel(`bookings:customer:${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `customer_id=eq.${profileId}`,
        },
        (payload) => {
          const newStatus = payload.new?.status;
          const toast = STATUS_MESSAGES[newStatus];
          if (toast) addToast(toast.msg, toast.type);
          // Refresh booking lists
          queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, queryClient, addToast]);
}
