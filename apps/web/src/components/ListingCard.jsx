import { Link } from 'react-router-dom';

// Emoji per category — no external image dependency
const CAT_EMOJI = {
  tiffin:      '🍱',
  homecook:    '👩‍🍳',
  plumber:     '🔧',
  electrician: '⚡',
  cleaning:    '🧹',
  carpenter:   '🪚',
  painter:     '🎨',
  ac:          '❄️',
};

export default function ListingCard({ listing }) {
  const vendor   = listing.vendor_profiles;
  const category = listing.categories;
  const price    = parseFloat(listing.price);
  const catEmoji = CAT_EMOJI[category?.slug] || '🏠';

  return (
    <Link
      to={`/listings/${listing.id}`}
      className="group bg-white rounded-2xl overflow-hidden flex flex-col transition-all hover:scale-[1.02]"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1.5px solid #f0ece4' }}
    >
      {/* Illustrated image area */}
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{ height: '130px', backgroundColor: '#fef3c7' }}
      >
        {/* Heart icon */}
        <button
          onClick={(e) => e.preventDefault()}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/80 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors text-sm"
        >
          ♡
        </button>
        <span className="text-6xl select-none">{catEmoji}</span>
      </div>

      <div className="p-4 flex flex-col flex-1 gap-1">
        {/* Vendor name */}
        <p className="font-semibold text-sm leading-snug" style={{ color: '#1a4a47' }}>
          {vendor?.business_name || listing.title}
        </p>

        {/* Listing title */}
        <p className="text-xs text-gray-500 line-clamp-1">{listing.title}</p>

        {/* Rating */}
        <div className="flex items-center gap-1 mt-0.5">
          {vendor?.rating > 0 ? (
            <>
              <span style={{ color: '#f59e0b' }}>★</span>
              <span className="text-xs font-medium text-gray-600">{vendor.rating.toFixed(1)}</span>
            </>
          ) : (
            <span className="text-xs text-gray-400">New</span>
          )}
        </div>

        {/* Price + location */}
        <div className="flex items-center justify-between mt-1">
          <div>
            <span className="font-bold text-base" style={{ color: '#1a4a47' }}>
              ₹{price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}
            </span>
            <span className="text-xs text-gray-400 ml-1">{listing.unit}</span>
          </div>
          {vendor?.address && (
            <p className="text-xs text-gray-400 truncate max-w-[90px]">
              📍 {vendor.address.split(',')[0]}
            </p>
          )}
        </div>

        {/* Book Now button */}
        <button
          onClick={(e) => e.preventDefault()}
          className="mt-3 w-full py-2 rounded-xl text-sm font-semibold text-white transition-all group-hover:opacity-90"
          style={{ backgroundColor: '#1a4a47' }}
        >
          Book Now
        </button>
      </div>
    </Link>
  );
}

