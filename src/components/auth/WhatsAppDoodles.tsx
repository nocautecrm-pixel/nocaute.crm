/** Papel de parede estilo WhatsApp — vai no bundle, então aparece mesmo se o JPG ainda não estiver no deploy. */
export function WhatsAppDoodles({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id="nocaute-wa-doodles" width="160" height="160" patternUnits="userSpaceOnUse">
          <path
            d="M28 36c0-10 9-18 20-18h18c11 0 20 8 20 18v10c0 10-9 18-20 18h-8l-12 10v-10c-11 0-18-8-18-18z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.4"
            opacity="0.55"
          />
          <path
            d="M96 22c0-6 5-11 12-11h14c7 0 12 5 12 11v6c0 6-5 11-12 11h-5l-8 7v-7c-7 0-13-5-13-11z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.3"
            opacity="0.4"
          />
          <circle cx="24" cy="108" r="7" fill="none" stroke="#ffffff" strokeWidth="1.3" opacity="0.45" />
          <path d="M20 108l3 3 6-7" fill="none" stroke="#ffffff" strokeWidth="1.4" opacity="0.45" />
          <path
            d="M118 96c0-7 6-12 14-12h16c8 0 14 5 14 12v8c0 7-6 12-14 12h-6l-10 8v-8c-8 0-14-5-14-12z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.3"
            opacity="0.5"
          />
          <path d="M52 118c2 0 4 2 8 2s6-2 8-2" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.35" />
          <circle cx="140" cy="40" r="3" fill="#ffffff" opacity="0.35" />
          <circle cx="72" cy="78" r="2.2" fill="#ffffff" opacity="0.3" />
          <path d="M78 52c8-4 14 2 22 0" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.3" />
          <path d="M12 70c6-6 14-2 18-8" fill="none" stroke="#ffffff" strokeWidth="1.1" opacity="0.28" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="#E5DDD5" />
      <rect width="100%" height="100%" fill="url(#nocaute-wa-doodles)" />
    </svg>
  );
}
