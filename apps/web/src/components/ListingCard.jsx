import { Link } from 'react-router-dom';

export default function ListingCard({ listing }) {
  const vendor   = listing.vendor_profiles;
  const category = listing.categories;
  const price    = parseFloat(listing.price);

  return (
    <Link
      to={`/listings/${listing.id}`}
      className="group bg-white rounded-2xl border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all overflow-hidden flex flex-col"
    >
      {/* Category color band */}
      <div className={`h-1.5 w-full ${category?.type === 'tiffin' ? 'bg-orange-400' : 'bg-blue-400'}`} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Category badge */}
        <div className="flex items-center gap-1.5">
          <span className="text-base">{category?.icon}</span>
          <span className="text-xs text-gray-400 font-medium">{category?.name}</span>
          {vendor?.is_verified && (
            <span className="ml-auto text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">✓</span>
          )}
        </div>

        {/* Vendor name */}
        <div>
          <p className="font-semibold text-gray-800 text-sm leading-snug group-hover:text-orange-600 transition-colors">
            {vendor?.business_name}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{listing.title}</p>
        </div>

        {/* Footer row */}
        <div className="flex items-end justify-between mt-auto pt-2 border-t border-gray-100">
          <div>
            <span className="text-lg font-bold text-orange-500">₹{price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}</span>
            <span className="text-xs text-gray-400 ml-1">{listing.unit}</span>
          </div>
          <div className="text-right">
            {vendor?.rating > 0 ? (
              <p className="text-xs text-gray-500">⭐ {vendor.rating.toFixed(1)}</p>
            ) : (
              <p className="text-xs text-gray-400">New</p>
            )}
            {vendor?.address && (
              <p className="text-xs text-gray-400 truncate max-w-[100px]">📍 {vendor.address.split(',')[0]}</p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
