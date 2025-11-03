-- Create events table
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 4 and 120),
  image_url text check (image_url is null or (image_url ~* '^https?://' and char_length(image_url) <= 1000)),
  description text not null check (char_length(description) between 20 and 2000),
  venue text not null check (char_length(venue) between 2 and 120),
  start_at timestamptz not null,
  end_at timestamptz,
  capacity int not null check (capacity >= 1),
  sold_count int not null default 0 check (sold_count >= 0),
  price_cents int not null check (price_cents > 0),
  currency text not null default 'SEK' check (currency in ('SEK')),
  discount_type text not null default 'none' check (discount_type in ('none','percent','amount')),
  discount_value int default 0,
  status text not null default 'published' check (status in ('draft','published','archived')),
  created_by uuid not null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.events enable row level security;

-- Helper function to check if user is admin
create or replace function public.is_admin() 
returns boolean
language sql 
stable 
security definer 
set search_path = public
as $$
  select exists(
    select 1 from profiles p 
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- RLS Policies
create policy "events_read_published_for_all"
on public.events for select
using (
  status = 'published'
  or is_admin()
);

create policy "events_write_admin_only"
on public.events for all
to authenticated
using (is_admin())
with check (is_admin());

-- Updated_at trigger
create trigger trg_events_updated 
before update on public.events
for each row 
execute procedure public.update_updated_at_column();