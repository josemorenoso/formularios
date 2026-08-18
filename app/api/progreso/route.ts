import { NextResponse } from "next/server";
import { CAMPOS } from "@/lib/preguntas";
import { CANAL_ETIQUETA, normalizarCanal, type Canal } from "@/lib/rastreo";

/**
 * Avisa que alguien va llenando el formulario, sin haberlo enviado.
 *
 * Es lo que permite recuperar a quien abandona: si llega el progreso pero
 * nunca el evento "completado", esa persona se quedó a medias. La clave que
 * une ambos eventos es `visita`.
 *
 * No guarda las respuestas, solo cuántas van y en cuál se quedó. Los datos
 * de contacto viajan únicamente si la persona ya los escribió, para poder
 * identificarla en la hoja.
 *
 * Nunca hace fallar al formulario: si el webhook no responde, se registra y
 * se sigue. Quien está llenando no debe enterarse de esto.
 */

type Cuerpo = {
  visita?: string;
  respondidas?: number;
  ultimaPregunta?: string;
  contacto?: { nombre?: string; whatsapp?: string; empresaCargo?: string };
  rastreo?: {
    canal?: string;
    deteccion?: string;
    manychatId?: string | null;
    campana?: string | null;
    landing?: string;
  } | null;
};

const IDS = new Set(CAMPOS.map((campo) => campo.id));
const ESPERA_MS = 4000;

export async function POST(peticion: Request) {
  let cuerpo: Cuerpo;
  try {
    cuerpo = (await peticion.json()) as Cuerpo;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const visita = (cuerpo.visita ?? "").slice(0, 80);
  if (!visita) return new NextResponse(null, { status: 204 });

  const canal: Canal = normalizarCanal(cuerpo.rastreo?.canal) ?? "otro";
  const ultima = cuerpo.ultimaPregunta ?? "";

  const registro = {
    evento: "progreso" as const,
    visita,
    actualizado: new Date().toISOString(),
    canal,
    canalLegible: CANAL_ETIQUETA[canal],
    deteccion: cuerpo.rastreo?.deteccion ?? "sin-dato",
    manychatId: cuerpo.rastreo?.manychatId ?? null,
    campana: cuerpo.rastreo?.campana ?? null,
    respondidas: Math.max(0, Math.min(Number(cuerpo.respondidas) || 0, CAMPOS.length)),
    total: CAMPOS.length,
    ultimaPregunta: IDS.has(ultima) ? ultima : "",
    nombre: (cuerpo.contacto?.nombre ?? "").trim().slice(0, 90),
    whatsapp: (cuerpo.contacto?.whatsapp ?? "").trim().slice(0, 25),
    empresaCargo: (cuerpo.contacto?.empresaCargo ?? "").trim().slice(0, 140),
    landing: cuerpo.rastreo?.landing ?? "",
  };

  console.log("[progreso]", JSON.stringify(registro));

  const webhook = process.env.LEAD_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registro),
        signal: AbortSignal.timeout(ESPERA_MS),
      });
    } catch {
      // Un progreso perdido no es grave: el siguiente lo reemplaza.
      console.warn("[progreso] el webhook no respondió");
    }
  }

  return new NextResponse(null, { status: 204 });
}
