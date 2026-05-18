DELETE FROM public.event_bookings
WHERE payment_reference IS NULL
  AND checkins_used = 0;