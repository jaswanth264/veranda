import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getListings } from '../api/listings';
import Layout from '../components/Layout';
import ListingCard from '../components/ListingCard';

// Emoji-based categories — always render, no external image dependency
const SERVICES_CATS = [
  { key: 'plumber',     label: 'Plumber',       emoji: '🔧' },
  { key: 'electrician', label: 'Electrician',   emoji: '⚡' },
  { key: 'cleaning',    label: 'Cleaner',       emoji: '🧹' },
];

const FOOD_CATS = [
  { key: 'tiffin',   label: 'Tiffin Service', emoji: '🍱' },
  { key: 'homecook', label: 'Home Cook',       emoji: '👩‍🍳' },
];

const ALL_CATS = [
  { key: 'plumber',     label: 'Plumber',        emoji: '🔧' },
  { key: 'electrician', label: 'Electrician',    emoji: '⚡' },
  { key: 'cleaning',    label: 'House Cleaning', emoji: '🧹' },
  { key: 'carpenter',   label: 'Carpenter',      emoji: '🪚' },
  { key: 'painter',     label: 'Painter',        emoji: '🎨' },
  { key: 'ac',          label: 'AC Repair',      emoji: '❄️' },
  { key: 'tiffin',      label: 'Tiffin Service', emoji: '🍱' },
  { key: 'homecook',    label: 'Home Cook',      emoji: '👩‍🍳' },
];

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden animate-pulse shadow-sm">
      <div className="h-36 bg-gray-200" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-100 rounded w-2/3" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-5 bg-gray-200 rounded w-1/3 mt-2" />
      </div>
    </div>
  );
}

export default function HomePage() {
  const [activeType, setActiveType] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['listings', activeType],
    queryFn: () => getListings({ category: activeType || undefined, limit: 50 }).then((r) => r.data.listings),
  });

  const listings = (data || []).filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.title?.toLowerCase().includes(q) ||
      l.vendor_profiles?.business_name?.toLowerCase().includes(q) ||
      l.categories?.name?.toLowerCase().includes(q) ||
      l.vendor_profiles?.address?.toLowerCase().includes(q)
    );
  });

  return (
    <Layout>
      {/* Hero — real street background photo */}
      <div
        className="relative"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1400&auto=format&fit=crop&q=80')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          minHeight: '340px',
        }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0" style={{ backgroundColor: 'rgba(15,46,43,0.72)' }} />

        <div className="relative z-10 max-w-6xl mx-auto px-6 pt-14 pb-8">
          <h1 className="text-white font-bold text-3xl md:text-4xl leading-snug max-w-lg">
            Welcome to Veranda, Vijayawada!<br />
            Find Trusted Local Help &amp; Authentic Home Food.
          </h1>

          {/* Search bar */}
          <div className="mt-6 max-w-xl">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tiffin, plumber, AC repair…"
                className="w-full bg-white text-gray-800 rounded-xl pl-11 pr-4 py-3.5 text-sm shadow-lg focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': '#f59e0b' }}
              />
            </div>
          </div>

          {/* Two-panel category card overlapping hero bottom */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            {/* Home Services panel */}
            <button
              onClick={() => setActiveType('services')}
              className="rounded-2xl p-5 text-left transition-all hover:scale-[1.02]"
              style={{ backgroundColor: '#1a4a47' }}
            >
              <h3 className="text-white font-bold text-lg mb-3">Home Services</h3>
              <div className="flex gap-4">
                {SERVICES_CATS.slice(0, 3).map((c) => (
                  <div key={c.key} className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-2xl">
                      {c.emoji}
                    </div>
                    <span className="text-white/80 text-xs">{c.label}</span>
                  </div>
                ))}
              </div>
            </button>

            {/* Tiffin & Food panel */}
            <button
              onClick={() => setActiveType('tiffin')}
              className="rounded-2xl p-5 text-left transition-all hover:scale-[1.02]"
              style={{ backgroundColor: '#f59e0b' }}
            >
              <h3 className="font-bold text-lg mb-3" style={{ color: '#1a4a47' }}>Tiffin &amp; Food</h3>
              <div className="flex gap-6">
                {FOOD_CATS.map((c) => (
                  <div key={c.key} className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center text-2xl">
                      {c.emoji}
                    </div>
                    <span className="text-sm font-medium" style={{ color: '#1a4a47' }}>{c.label}</span>
                  </div>
                ))}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Category icon grid */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
          {ALL_CATS.map((c) => (
            <button
              key={c.key}
              onClick={() => setActiveType(c.key)}
              className="flex flex-col items-center gap-2 group"
            >
              <div
                className="w-full aspect-square rounded-2xl flex items-center justify-center text-4xl transition-all group-hover:scale-105 shadow-sm"
                style={{
                  backgroundColor: activeType === c.key ? '#fef3c7' : '#fff',
                  border: activeType === c.key ? '2px solid #f59e0b' : '2px solid #e5e7eb',
                }}
              >
                {c.emoji}
              </div>
              <span className="text-xs font-medium text-center leading-tight" style={{ color: '#1a4a47' }}>
                {c.label}
              </span>
            </button>
          ))}
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 mt-6 flex-wrap">
          {[
            { key: '', label: 'All' },
            { key: 'tiffin', label: 'Tiffin & Food' },
            { key: 'services', label: 'Home Services' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveType(f.key)}
              className="px-5 py-1.5 rounded-full text-sm font-medium transition-all"
              style={
                activeType === f.key
                  ? { backgroundColor: '#1a4a47', color: '#fff' }
                  : { backgroundColor: '#fff', color: '#1a4a47', border: '1.5px solid #d1d5db' }
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Results header */}
        <div className="flex items-center justify-between mt-6 mb-4">
          <h2 className="font-semibold text-base" style={{ color: '#1a4a47' }}>
            {isLoading
              ? 'Loading…'
              : listings.length === 0
              ? 'No listings found'
              : `${listings.length} listing${listings.length !== 1 ? 's' : ''} near you`}
          </h2>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-xs hover:underline"
              style={{ color: '#f59e0b' }}
            >
              Clear search
            </button>
          )}
        </div>

        {/* Listings grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-semibold text-gray-600">No listings yet in this area</p>
            <p className="text-sm text-gray-400 mt-1">Check back soon or try a different category</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

