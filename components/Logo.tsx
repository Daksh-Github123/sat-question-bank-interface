// Pace mark: a minimal "motion check" — a single-stroke checkmark whose long arm
// sweeps up and to the right to imply forward motion/pace. Uses currentColor so it
// inherits the surrounding text color (teal in the nav). No fill, no extra detail.
export default function Logo({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M4 17 L12 25 L28 6"
        stroke="currentColor"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
