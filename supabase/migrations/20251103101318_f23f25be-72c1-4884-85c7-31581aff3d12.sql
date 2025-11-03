-- Create event_bookings table
create table if not exists public.event_bookings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  booked_at timestamptz not null default now(),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  payment_status text not null default 'paid' check (payment_status in ('pending', 'paid', 'refunded')),
  created_at timestamptz not null default now(),
  unique(event_id, member_id)
);

-- Enable RLS
alter table public.event_bookings enable row level security;

-- Members can view their own bookings
create policy "event_bookings_member_read_own"
on public.event_bookings for select
to authenticated
using (member_id = auth.uid());

-- Admins can view all bookings
create policy "event_bookings_admin_read_all"
on public.event_bookings for select
to authenticated
using (is_admin());

-- Admins can manage all bookings
create policy "event_bookings_admin_write"
on public.event_bookings for all
to authenticated
using (is_admin())
with check (is_admin());

-- Create index for faster queries
create index idx_event_bookings_event_id on public.event_bookings(event_id);
create index idx_event_bookings_member_id on public.event_bookings(member_id);