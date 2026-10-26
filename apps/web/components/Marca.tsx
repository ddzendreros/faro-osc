/** Un faro esquemático: torre, linterna encendida y techo. */
export function Marca({ tamano = 28 }: { tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <path d="M10 26 12 11h4l2 15z" fill="currentColor" />
      <rect x="11.2" y="5.5" width="5.6" height="5.5" fill="#f3c53c" />
      <path d="M9.5 5.5 14 1.5l4.5 4z" fill="currentColor" />
      <path d="M2 26h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M11.6 16h4.8M11 20.5h6" stroke="var(--sal)" strokeWidth="1.5" />
    </svg>
  );
}
