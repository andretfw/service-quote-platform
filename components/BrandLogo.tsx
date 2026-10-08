export default function BrandLogo() {
  return (
    <span className="brand-logo">
      <svg width="36" height="36" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect width="40" height="40" rx="12" fill="#0f766e" />
        <path
          d="M13 10h14a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H18l-7 5v-6a4 4 0 0 1-2-3V14a4 4 0 0 1 4-4Z"
          fill="white"
        />
        <path
          d="m14.5 19 3.5 3.5 7.5-7.5"
          stroke="#0f766e"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>Service Quote</span>
    </span>
  );
}
