import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getListings } from '../api/listings';
import Layout from '../components/Layout';
import ListingCard from '../components/ListingCard';

const CATEGORIES = [
  { key: '',         label: 'All',           icon: '🏠' },
  { key: 'tiffin',  label: 'Tiffin',         icon: '🍱' },
  { key: 'services', label: 'Home Services', icon: '🔧' },
];

const SUBCATEGORIES = [
  { key: '',            label: 'All',            icon: '✨', type: null },
  { key: 'tiffin',     label: 'Tiffin Service',  icon: '🍱', type: 'tiffin' },
  { key: 'homecook',   label: 'Home Cook',       icon: '👨‍🍳', type: 'tiffin' },
  { key: 'plumber',    label: 'Plumber',         icon: '🔧', type: 'services' },
  { key: 'electrician',label: 'Electrician',     icon: '⚡', type: 'services' },
  { key: 'cleaning',   label: 'Cleaning',        icon: '🧹', type: 'services' },
  { key: 'carpenter',  label: 'Carpenter',       icon: '🪚', type: 'services' },
  { key: 'painter',    label: 'Painter',         icon: '🎨', type: 'services' },
  { key: 'ac',         label: 'AC Repair',       icon: '❄️', type: 'services' },
];

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-1.5 bg-gray-200 w-full" />
      <div className="p-4 space-y-3">
        <div className="h-3 bg-gray-100 rounded w-1/3" />
        <div className="h-4 bg-gray-200 rounded w-2/3" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-5/6" />
        <div className="flex justify-between pt-2 border-t border-gray-100">
          <div className="h-5 bg-gray-200 rounded w-16" />
          <div className="h-3 bg-gray-100 rounded w-12" />
        </div>
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

  // Client-side search filter on top of server results
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
      {/* Hero */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white px-4 py-10">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            Services & Tiffin near you
          </h1>
          <p className="text-orange-100 text-sm mb-6">
            Vijayawada · Gudivada · Andhra Pradesh
          </p>

          {/* Search bar */}
          <div className="relative max-w-lg mx-auto">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tiffin, plumber, electrician…"
              className="w-full bg-white text-gray-800 rounded-xl pl-10 pr-4 py-3 text-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Category type pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setActiveType(c.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-all shrink-0 ${
                activeType === c.key
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
              }`}
            >
              <span>{c.icon}</span> {c.label}
            </button>
          ))}
        </div>

        {/* Sub-category scroll (Urban Company style) */}
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          {SUBCATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setActiveType(c.type || '')}
              className="flex flex-col items-center gap-1 shrink-0 group"
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl border-2 transition-all ${
                activeType === (c.type || '') && c.key !== ''
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-100 bg-white group-hover:border-orange-300'
              }`}>
                {c.icon}
              </div>
              <span className="text-xs text-gray-500 font-medium">{c.label}</span>
            </button>
          ))}
        </div>

        {/* Results header */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">
            {isLoading
              ? 'Loading…'
              : listings.length === 0
              ? 'No listings found'
              : `${listings.length} listing${listings.length !== 1 ? 's' : ''} available`}
          </h2>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-xs text-orange-500 hover:underline"
            >
              Clear search
            </button>
          )}
        </div>

        {/* Listings grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-gray-500 font-medium">No listings yet in this category</p>
            <p className="text-gray-400 text-sm mt-1">Check back soon or try a different category</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
