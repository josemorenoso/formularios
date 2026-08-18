/**
 * La constelación de progreso.
 *
 * Once estrellas, una por pregunta. Cada respuesta enciende la suya y traza
 * la línea hasta la anterior, así que llenar el formulario dibuja la
 * constelación. La última es la estrella polar: se enciende al completar.
 */

import type { CSSProperties } from "react";

type Props = {
  /** Cuántas preguntas van respondidas, de 0 a 11. */
  respondidas: number;
};

/** Coordenadas fijas: no es una fila de puntos, es un cielo. */
const ESTRELLAS: Array<{ x: number; y: number; r: number }> = [
  { x: 22, y: 44, r: 2.6 },
  { x: 58, y: 22, r: 2.2 },
  { x: 94, y: 54, r: 2.8 },
  { x: 46, y: 88, r: 2.2 },
  { x: 88, y: 116, r: 2.6 },
  { x: 130, y: 86, r: 2.2 },
  { x: 122, y: 32, r: 2.4 },
  { x: 164, y: 48, r: 2.2 },
  { x: 198, y: 80, r: 2.8 },
  { x: 170, y: 128, r: 2.2 },
  { x: 214, y: 156, r: 0 }, // la polar se dibuja aparte
];

const TOTAL = ESTRELLAS.length;

function largoDe(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export default function Constelacion({ respondidas }: Props) {
  const encendidas = Math.max(0, Math.min(respondidas, TOTAL));
  const completa = encendidas === TOTAL;
  const polar = ESTRELLAS[TOTAL - 1];

  return (
    <div className="constelacion-caja">
      <svg
        viewBox="0 0 236 178"
        className="constelacion"
        role="img"
        aria-label={`${encendidas} de ${TOTAL} preguntas respondidas`}
      >
        {/* Trazo guía: se ve desde el principio, para que el dibujo por
            completar sea legible en vez de parecer polvo. */}
        {ESTRELLAS.slice(0, -1).map((estrella, i) => (
          <line
            key={`guia-${i}`}
            className="constelacion-guia"
            x1={estrella.x}
            y1={estrella.y}
            x2={ESTRELLAS[i + 1].x}
            y2={ESTRELLAS[i + 1].y}
          />
        ))}

        {ESTRELLAS.slice(0, -1).map((estrella, i) => {
          const siguiente = ESTRELLAS[i + 1];
          const largo = largoDe(estrella, siguiente);
          return (
            <line
              key={`arista-${i}`}
              className="constelacion-arista"
              x1={estrella.x}
              y1={estrella.y}
              x2={siguiente.x}
              y2={siguiente.y}
              style={{ "--largo": Math.round(largo) } as CSSProperties}
              data-encendida={encendidas > i + 1 ? "si" : "no"}
            />
          );
        })}

        {ESTRELLAS.slice(0, -1).map((estrella, i) => (
          <g key={`estrella-${i}`}>
            <circle
              className="constelacion-halo"
              cx={estrella.x}
              cy={estrella.y}
              r={estrella.r * 3.4}
              data-encendida={encendidas > i ? "si" : "no"}
            />
            <circle
              className="constelacion-punto"
              cx={estrella.x}
              cy={estrella.y}
              r={estrella.r}
              data-encendida={encendidas > i ? "si" : "no"}
            />
          </g>
        ))}

        <circle
          className="constelacion-halo"
          cx={polar.x}
          cy={polar.y}
          r={18}
          data-encendida={completa ? "si" : "no"}
        />
        {/* El grupo posiciona; la clase solo anima escala y color, para que
            el transform de CSS no pise al del atributo. */}
        <g transform={`translate(${polar.x - 15} ${polar.y - 15}) scale(0.469)`}>
          <path
            className="constelacion-polar"
            d="M32 3c1.6 16.4 12 26.9 29 28.5C44 33.1 33.6 43.6 32 61c-1.6-17.4-12-27.9-29-29.5C20 30 30.4 19.4 32 3Z"
            data-encendida={completa ? "si" : "no"}
          />
        </g>
      </svg>

      <div className="marcador">
        <span className="marcador-cifra">{encendidas}</span>
        <span className="marcador-total">/ {TOTAL}</span>
        <span className="marcador-texto">
          {completa ? "constelación completa" : "respondidas"}
        </span>
      </div>
    </div>
  );
}
