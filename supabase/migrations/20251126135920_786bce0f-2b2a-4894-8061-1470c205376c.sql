-- Create event_dates table to store multiple dates per event
CREATE TABLE public.event_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on event_dates
ALTER TABLE public.event_dates ENABLE ROW LEVEL SECURITY;

-- Create policies for event_dates
CREATE POLICY "Anyone can view event dates for published events"
  ON public.event_dates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_dates.event_id
      AND events.status = 'published'
    )
    OR is_admin()
  );

CREATE POLICY "Admins can manage event dates"
  ON public.event_dates
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Create index for faster queries
CREATE INDEX idx_event_dates_event_id ON public.event_dates(event_id);
CREATE INDEX idx_event_dates_start_at ON public.event_dates(start_at);