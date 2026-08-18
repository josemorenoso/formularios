import { NextResponse } from "next/server";
import { CAMPOS, mensajeDeError } from "@/lib/preguntas";
import { CANAL_ETIQUETA, normalizarCanal, type Canal } from "@/lib/rastreo";

/**
 * Recibe la postulación, la etiqueta con el canal de origen y la reenvía.
 *
 * Salidas, todas opcionales salvo la primera:
 *   1. Registro estructurado  → siempre. Se lee en los logs de Vercel.
 *   2. LEAD_WEBHOOK_URL       → n8n, Make, Zapier o un Apps Script de Sheets.
 *   3. RESEND_API_KEY + LEAD_EMAIL_TO → aviso por correo.
 *
 * Sin ninguna variable configurada el formulario funciona igual: el lead
 * queda en los logs. Configura al menos el webhook para tener la tabla.
 */

type Cuerpo = {
  respuestas?: Record<string, string>;
  rastreo?: {
    canal?: string;
    canalCrudo?: string;
    deteccion?: string;
    reutilizado?: boolean;
    manychatId?: string | null;
    campana?: string | null;
    landing?: string;
    referente?: string;
    utm?: Record<string, string>;
    primeraVisita?: string;
  } | null;
  verificacion?: { trampa?: string; segundos?: number };
};

const SEGUNDOS_MINIMOS = 5;

function aNumero(valor: string) {
  const digitos = (valor ?? "").replace(/\D/g, "");
  return digitos ? Number(digitos) : null;
}

function rechazo(mensaje: string, estado: number) {
  return NextResponse.json({ ok: false, mensaje }, { status: estado });
}

export async function POST(peticion: Request) {
  let cuerpo: Cuerpo;
  try {
    cuerpo = (await peticion.json()) as Cuerpo;
  } catch {
    return rechazo("No pudimos leer el formulario.", 400);
  }

  // Trampa para bots: el campo está oculto, una persona nunca lo llena.
  if (cuerpo.verificacion?.trampa) {
    return NextResponse.json({ ok: true });
  }
  if ((cuerpo.verificacion?.segundos ?? 0) < SEGUNDOS_MINIMOS) {
    return rechazo("Tómate un momento más y vuelve a enviarlo.", 429);
  }

  const respuestas = cuerpo.respuestas ?? {};

  // Se revalida en el servidor: el navegador no es fuente de verdad.
  const faltantes = CAMPOS.filter(
    (campo) => mensajeDeError(campo, respuestas[campo.id]) !== null,
  ).map((campo) => campo.id);

  if (faltantes.length > 0) {
    return rechazo(
      `Faltan respuestas: ${faltantes.join(", ")}.`,
      422,
    );
  }

  // ── El dato del encargo: por dónde llegó esta persona ──────
  const canal: Canal =
    normalizarCanal(cuerpo.rastreo?.canal) ??
    normalizarCanal(cuerpo.rastreo?.canalCrudo) ??
    "otro";

  const etiquetadas: Record<string, string> = {};
  for (const campo of CAMPOS) {
    etiquetadas[campo.etiqueta] = (respuestas[campo.id] ?? "").trim();
  }

  const registro = {
    recibido: new Date().toISOString(),
    canal,
    canalLegible: CANAL_ETIQUETA[canal],
    deteccion: cuerpo.rastreo?.deteccion ?? "sin-dato",
    reutilizado: cuerpo.rastreo?.reutilizado ?? false,
    canalCrudo: cuerpo.rastreo?.canalCrudo ?? "",
    manychatId: cuerpo.rastreo?.manychatId ?? null,
    campana: cuerpo.rastreo?.campana ?? null,
    landing: cuerpo.rastreo?.landing ?? "",
    referente: cuerpo.rastreo?.referente ?? "",
    utm: cuerpo.rastreo?.utm ?? {},
    nombre: (respuestas.nombre ?? "").trim(),
    whatsapp: (respuestas.whatsapp ?? "").trim(),
    empresaCargo: (respuestas.empresaCargo ?? "").trim(),
    costoMensualPesos: aNumero(respuestas.costoMensual ?? ""),
    respuestas: etiquetadas,
    crudo: respuestas,
    ip:
      peticion.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      peticion.headers.get("x-real-ip") ??
      null,
    navegador: peticion.headers.get("user-agent") ?? null,
  };

  // Registro estructurado: es la copia de seguridad que nunca se cae.
  console.log("[lead]", JSON.stringify(registro));

  let advertencia: string | null = null;

  const webhook = process.env.LEAD_WEBHOOK_URL;
  if (webhook) {
    const enviado = await reintentar(() =>
      fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registro),
      }),
    );
    if (!enviado) {
      advertencia = "webhook";
      console.error("[lead] el webhook no respondió; el lead quedó solo en logs");
    }
  }

  const clave = process.env.RESEND_API_KEY;
  const destinatario = process.env.LEAD_EMAIL_TO;
  if (clave && destinatario) {
    const enviado = await reintentar(() =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clave}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.LEAD_EMAIL_FROM ?? "Constelarys <onboarding@resend.dev>",
          to: destinatario.split(",").map((d) => d.trim()),
          subject: `Postulación · ${registro.nombre} · ${registro.canalLegible}`,
          text: correoEnTexto(registro),
        }),
      }),
    );
    if (!enviado) {
      advertencia = advertencia ?? "correo";
      console.error("[lead] no se pudo enviar el correo de aviso");
    }
  }

  return NextResponse.json({ ok: true, canal, advertencia });
}

/** Un reintento y listo: la persona está esperando del otro lado. */
async function reintentar(accion: () => Promise<Response>) {
  for (let intento = 0; intento < 2; intento++) {
    try {
      const respuesta = await accion();
      if (respuesta.ok) return true;
    } catch {
      // Se reintenta abajo.
    }
  }
  return false;
}

function correoEnTexto(registro: {
  canalLegible: string;
  deteccion: string;
  campana: string | null;
  respuestas: Record<string, string>;
}) {
  const cabecera = [
    `Canal: ${registro.canalLegible}`,
    `Detectado por: ${registro.deteccion}`,
    registro.campana ? `Campaña: ${registro.campana}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const cuerpo = Object.entries(registro.respuestas)
    .map(([pregunta, valor]) => `${pregunta}\n${valor}`)
    .join("\n\n");

  return `${cabecera}\n\n———\n\n${cuerpo}\n`;
}

export function GET() {
  return rechazo("Este endpoint solo recibe envíos del formulario.", 405);
}
