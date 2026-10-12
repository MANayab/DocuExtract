import type { ReactNode, SVGProps } from 'react';

function Svg({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="dx-icon"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconUpload = () => (
  <Svg><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></Svg>
);
export const IconShield = () => (
  <Svg><path d="M12 3 5 6v5c0 4.5 2.9 8.2 7 10 4.1-1.8 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></Svg>
);
export const IconLayers = () => (
  <Svg><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></Svg>
);
export const IconReceipt = () => (
  <Svg><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></Svg>
);
export const IconCheck = () => (
  <Svg><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.5 2.5 4.5-5" /></Svg>
);
export const IconScan = () => (
  <Svg><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M4 12h16" /></Svg>
);
export const IconTable = () => (
  <Svg><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16" /></Svg>
);
export const IconFile = () => (
  <Svg><path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4Z" /><path d="M14 3v4h4" /></Svg>
);
export const IconTrash = () => (
  <Svg><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" /></Svg>
);
export const IconDownload = () => (
  <Svg><path d="M12 4v12m0 0 5-5m-5 5-5-5" /><path d="M4 18v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1" /></Svg>
);
export const IconArrowLeft = () => (
  <Svg><path d="M19 12H5m0 0 6-6m-6 6 6 6" /></Svg>
);
export const IconAlert = () => (
  <Svg><path d="M12 4 3 20h18L12 4Z" /><path d="M12 10v4M12 17h.01" /></Svg>
);
export const IconGithub = () => (
  <Svg fill="currentColor" stroke="none">
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.35 1.08 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
  </Svg>
);
export const IconSparkle = () => (
  <Svg><path d="m12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></Svg>
);

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="dx-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#dx-logo-g)" />
      <path d="M18 12h20l10 10v30H18z" fill="#fff" />
      <path d="M38 12v12h12" fill="none" stroke="#4f46e5" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M24 34h18M24 42h12" stroke="#4f46e5" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
