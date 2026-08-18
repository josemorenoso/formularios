/**
 * Marca Constelarys, redibujada como vector desde el manual v1.0.
 * Nada de PNG: escala a cualquier tamaño y no hay archivos que subir.
 */

import type { CSSProperties } from "react";

/** La constelación sola. Sellos, marcas de agua, favicon. */
export function Isotipo({
  tamano = 40,
  className,
}: {
  tamano?: number;
  className?: string;
}) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 64 64"
      fill="none"
      role="presentation"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="5.5"
        y="5.5"
        width="53"
        height="53"
        rx="15"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1.1"
      />
      <g stroke="currentColor" strokeOpacity="0.5" strokeWidth="0.9" strokeLinecap="round">
        <path d="M17 26 L30 17" />
        <path d="M30 17 L45 25" />
        <path d="M17 26 L24 41" />
        <path d="M24 41 L40 45" />
        <path d="M45 25 L40 45" />
      </g>
      <g fill="currentColor">
        <circle cx="17" cy="26" r="2.1" />
        <circle cx="30" cy="17" r="1.7" />
        <circle cx="45" cy="25" r="1.7" />
        <circle cx="40" cy="45" r="1.7" />
      </g>
      <circle cx="24" cy="41" r="4" fill="#c9a24a" />
      <circle cx="24" cy="41" r="7.5" fill="#c9a24a" fillOpacity="0.16" />
    </svg>
  );
}

/** La estrella polar suelta. Es lo único que se lee bien a 16 px. */
export function EstrellaPolar({
  tamano = 24,
  className,
  style,
}: {
  tamano?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 64 64"
      fill="none"
      role="presentation"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <path
        d="M32 3c1.6 16.4 12 26.9 29 28.5C44 33.1 33.6 43.6 32 61c-1.6-17.4-12-27.9-29-29.5C20 30 30.4 19.4 32 3Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Logo horizontal: isotipo + nombre. El de webs y encabezados. */
export function LogoHorizontal({
  tamano = 34,
  className,
}: {
  tamano?: number;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: tamano * 0.34 }}
    >
      <Isotipo tamano={tamano} />
      <span
        className="display"
        style={{
          fontSize: tamano * 0.7,
          letterSpacing: "0.01em",
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        Constelarys
      </span>
    </span>
  );
}
