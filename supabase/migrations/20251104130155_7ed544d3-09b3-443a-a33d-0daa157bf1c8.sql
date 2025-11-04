-- Allow members to create their own event bookings
CREATE POLICY "event_bookings_member_insert_own"
ON event_bookings
FOR INSERT
TO authenticated
WITH CHECK (member_id = auth.uid());