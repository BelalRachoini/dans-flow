-- Allow members to insert their own lesson bookings
CREATE POLICY "Members can insert own lesson bookings"
ON lesson_bookings
FOR INSERT
TO authenticated
WITH CHECK (member_id = auth.uid());