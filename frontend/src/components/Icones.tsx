type IconeProps = {
  tamanho?: number;
  className?: string;
};

const basePropsSvg = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

export function IconeTransacoes({ tamanho = 18, className }: IconeProps) {
  return (
    <svg width={tamanho} height={tamanho} className={className} {...basePropsSvg}>
      <path d="M4 7h13l-3.5-3.5" />
      <path d="M20 17H7l3.5 3.5" />
    </svg>
  );
}

export function IconeRelatorio({ tamanho = 18, className }: IconeProps) {
  return (
    <svg width={tamanho} height={tamanho} className={className} {...basePropsSvg}>
      <path d="M4 20V10" />
      <path d="M11 20V4" />
      <path d="M18 20v-7" />
    </svg>
  );
}

export function IconeCategorias({ tamanho = 18, className }: IconeProps) {
  return (
    <svg width={tamanho} height={tamanho} className={className} {...basePropsSvg}>
      <path d="M11.5 3.5H5a1.5 1.5 0 0 0-1.5 1.5v6.5a1.5 1.5 0 0 0 .44 1.06l7.5 7.5a1.5 1.5 0 0 0 2.12 0l6.5-6.5a1.5 1.5 0 0 0 0-2.12l-7.5-7.5a1.5 1.5 0 0 0-1.06-.44Z" />
      <circle cx="8" cy="8" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconeConfiguracoes({ tamanho = 18, className }: IconeProps) {
  return (
    <svg width={tamanho} height={tamanho} className={className} {...basePropsSvg}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

export function IconeSair({ tamanho = 18, className }: IconeProps) {
  return (
    <svg width={tamanho} height={tamanho} className={className} {...basePropsSvg}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function IconeAlerta({ tamanho = 18, className }: IconeProps) {
  return (
    <svg width={tamanho} height={tamanho} className={className} {...basePropsSvg}>
      <path d="M12 3.5 21.5 20h-19L12 3.5Z" />
      <path d="M12 9.5v4.5" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconeEditar({ tamanho = 15, className }: IconeProps) {
  return (
    <svg width={tamanho} height={tamanho} className={className} {...basePropsSvg}>
      <path d="M14.5 3.5a2.12 2.12 0 0 1 3 3L7 17l-4 1 1-4 10.5-10.5Z" />
    </svg>
  );
}

export function IconeExcluir({ tamanho = 15, className }: IconeProps) {
  return (
    <svg width={tamanho} height={tamanho} className={className} {...basePropsSvg}>
      <path d="M4 6h16" />
      <path d="M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6" />
      <path d="M6.5 6 7.3 19a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 6" />
    </svg>
  );
}

export function IconeVazio({ tamanho = 32, className }: IconeProps) {
  return (
    <svg width={tamanho} height={tamanho} className={className} {...basePropsSvg}>
      <path d="M3.5 10.5 6 4h12l2.5 6.5" />
      <path d="M3.5 10.5h5.2a1 1 0 0 1 .9.56l.8 1.6a1 1 0 0 0 .9.56h1.4a1 1 0 0 0 .9-.56l.8-1.6a1 1 0 0 1 .9-.56h5.2" />
      <path d="M3.5 10.5V18a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5v-7.5" />
    </svg>
  );
}

export function IconeFantasma({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="gradienteFantasma" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d9bbff" />
          <stop offset="100%" stopColor="#4a0080" />
        </linearGradient>
        <radialGradient id="gradienteOlho" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#ff8a8a" />
          <stop offset="60%" stopColor="#e0163c" />
          <stop offset="100%" stopColor="#7a0018" />
        </radialGradient>
      </defs>
      <path
        d="M18,52 C15,35 21,16 35,9 C41,5 46,13 50,7 C54,13 59,5 65,9 C79,16 85,35 82,52 L82,86 L74,73 L66,86 L58,73 L50,86 L42,73 L34,86 L26,73 L18,86 Z"
        fill="url(#gradienteFantasma)"
      />
      <ellipse cx="35" cy="42" rx="7.5" ry="9.5" fill="url(#gradienteOlho)" />
      <ellipse cx="65" cy="42" rx="7.5" ry="9.5" fill="url(#gradienteOlho)" />
      <path d="M29,58 Q50,76 71,58" stroke="#1a0330" strokeWidth="4.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
