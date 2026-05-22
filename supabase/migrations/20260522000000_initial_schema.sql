-- ============================================================
-- Veranda — Initial Schema Migration
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

create type user_role as enum ('customer', 'vendor', 'admin');
create type vendor_category as enum ('services', 'tiffin');
create type booking_status as enum ('pending', 'confirmed', 'completed', 'cancelled');
create type payment_status as enum ('pending', 'paid', 'refunded');
create type category_type as enum ('services', 'tiffin');

-- ============================================================
-- PROFILES
-- Extends Supabase auth.users
-- ============================================================

create table profiles (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid unique not null references auth.users(id) on delete cascade,
  full_name    text not null,
  phone        text,
  avatar_url   text,
  city         text,
  role         user_role not null default 'customer',
  created_at   timestamptz not null default now()
);

-- Auto-create profile on new user signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', new.phone)
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- VENDOR PROFILES
-- ============================================================

create table vendor_profiles (
  id             uuid primary key default uuid_generate_v4(),
  profile_id     uuid unique not null references profiles(id) on delete cascade,
  business_name  text not null,
  description    text,
  category       vendor_category not null,
  address        text,
  lat            float8,
  lng            float8,
  is_verified    boolean not null default false,
  is_featured    boolean not null default false,
  rating         float4 not null default 0,
  total_reviews  int not null default 0,
  created_at     timestamptz not null default now()
);

-- ============================================================
-- CATEGORIES (Seed data included)
-- ============================================================

create table categories (
  id    serial primary key,
  name  text not null,
  icon  text,
  type  category_type not null
);

insert into categories (name, icon, type) values
  ('Tiffin Service',  '🍱', 'tiffin'),
  ('Home Cook',       '👨‍🍳', 'tiffin'),
  ('Plumber',         '🔧', 'services'),
  ('Electrician',     '⚡', 'services'),
  ('House Cleaning',  '🧹', 'services'),
  ('Carpenter',       '🪚', 'services'),
  ('Painter',         '🎨', 'services'),
  ('AC Repair',       '❄️', 'services');

-- ============================================================
-- LISTINGS
-- ============================================================

create table listings (
  id           uuid primary key default uuid_generate_v4(),
  vendor_id    uuid not null references vendor_profiles(id) on delete cascade,
  category_id  int not null references categories(id),
  title        text not null,
  description  text,
  price        numeric(10,2) not null,
  unit         text default 'per visit',
  images       text[] default '{}',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- BOOKINGS
-- ============================================================

create table bookings (
  id              uuid primary key default uuid_generate_v4(),
  customer_id     uuid not null references profiles(id),
  listing_id      uuid not null references listings(id),
  vendor_id       uuid not null references vendor_profiles(id),
  status          booking_status not null default 'pending',
  scheduled_at    timestamptz not null,
  address         text,
  amount          numeric(10,2) not null,
  commission      numeric(10,2) default 0,
  payment_id      text,
  payment_status  payment_status not null default 'pending',
  notes           text,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- REVIEWS
-- ============================================================

create table reviews (
  id           uuid primary key default uuid_generate_v4(),
  booking_id   uuid unique not null references bookings(id) on delete cascade,
  customer_id  uuid not null references profiles(id),
  vendor_id    uuid not null references vendor_profiles(id),
  rating       smallint not null check (rating >= 1 and rating <= 5),
  comment      text,
  created_at   timestamptz not null default now()
);

-- Auto-update vendor rating when a review is added
create or replace function update_vendor_rating()
returns trigger as $$
begin
  update vendor_profiles
  set
    rating = (
      select round(avg(rating)::numeric, 1)
      from reviews
      where vendor_id = new.vendor_id
    ),
    total_reviews = (
      select count(*) from reviews where vendor_id = new.vendor_id
    )
  where id = new.vendor_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_review_created
  after insert on reviews
  for each row execute procedure update_vendor_rating();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table profiles        enable row level security;
alter table vendor_profiles enable row level security;
alter table listings        enable row level security;
alter table bookings        enable row level security;
alter table reviews         enable row level security;

-- PROFILES
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = user_id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = user_id);

-- VENDOR PROFILES (public read)
create policy "Anyone can view vendor profiles"
  on vendor_profiles for select using (true);

create policy "Vendor can update own profile"
  on vendor_profiles for update
  using (profile_id in (select id from profiles where user_id = auth.uid()));

create policy "Vendor can insert own profile"
  on vendor_profiles for insert
  with check (profile_id in (select id from profiles where user_id = auth.uid()));

-- LISTINGS (public read)
create policy "Anyone can view active listings"
  on listings for select using (is_active = true);

create policy "Vendor can manage own listings"
  on listings for all
  using (vendor_id in (
    select vp.id from vendor_profiles vp
    join profiles p on p.id = vp.profile_id
    where p.user_id = auth.uid()
  ));

-- BOOKINGS
create policy "Customer can view own bookings"
  on bookings for select
  using (customer_id in (select id from profiles where user_id = auth.uid()));

create policy "Vendor can view own bookings"
  on bookings for select
  using (vendor_id in (
    select vp.id from vendor_profiles vp
    join profiles p on p.id = vp.profile_id
    where p.user_id = auth.uid()
  ));

create policy "Customer can create booking"
  on bookings for insert
  with check (customer_id in (select id from profiles where user_id = auth.uid()));

create policy "Vendor can update booking status"
  on bookings for update
  using (vendor_id in (
    select vp.id from vendor_profiles vp
    join profiles p on p.id = vp.profile_id
    where p.user_id = auth.uid()
  ));

-- REVIEWS (public read)
create policy "Anyone can view reviews"
  on reviews for select using (true);

create policy "Customer can create review"
  on reviews for insert
  with check (customer_id in (select id from profiles where user_id = auth.uid()));
