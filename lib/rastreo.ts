/**
 * Rastreo de canal de origen.
 *
 * El objetivo es una sola respuesta: ¿esta persona llegó por ManyChat o por
 * WhatsApp directo? Se resuelve en tres intentos, en este orden:
 *
 *   1. Parámetro en la URL  (?src=manychat, ?utm_source=wa, ?origen=...)
 *   2. Subdominio          (wa.constelarys.com → WhatsApp)
 *   3. Página que la trajo (wa.me → WhatsApp, m.me → ManyChat)
 *   4. Lo guardado en la sesión, si ya se resolvió antes en esta visita
 *
 * El primer contacto manda: una vez resuelto, se guarda y no se sobreescribe,
 * para que recargar la página o volver atrás no ensucie el dato.
 */

export type Canal = "manychat" | "whatsapp" | "instagram" | "otro";

export const CANAL_ETIQUETA: Record<Canal, string> = {
  manychat: "ManyChat",
  whatsapp: "WhatsApp directo",
  instagram: "Instagram",
  otro: "Sin identificar",
};

export type Deteccion = "parametro" | "subdominio" | "referente" | "sin-dato";

export type Rastreo = {
  canal: Canal;
  canalCrudo: string;
  /** Cómo se supo el canal la primera vez. No se sobreescribe al reusarlo. */
  deteccion: Deteccion;
  /** true si viene de la sesión: recarga, volver atrás o segunda vista. */
  reutilizado: boolean;
  manychatId: string | null;
  campana: string | null;
  landing: string;
  referente: string;
  utm: Record<string, string>;
  primeraVisita: string;
};

const CLAVE_SESION = "constelarys:rastreo";

/** Cualquiera de estos parámetros sirve para marcar el canal. */
const PARAMETROS = [
  "src",
  "source",
  "utm_source",
  "fuente",
  "origen",
  "canal",
  "ref",
];

/** Valores que se aceptan por cada canal, en minúscula. */
const ALIAS: Record<string, Canal> = {
  manychat: "manychat",
  mc: "manychat",
  "many-chat": "manychat",
  many_chat: "manychat",
  bot: "manychat",
  chatbot: "manychat",
  messenger: "manychat",
  fb: "manychat",
  automatizacion: "manychat",

  whatsapp: "whatsapp",
  wa: "whatsapp",
  ws: "whatsapp",
  wsp: "whatsapp",
  whats: "whatsapp",
  "whatsapp-directo": "whatsapp",
  whatsapp_directo: "whatsapp",
  directo: "whatsapp",

  instagram: "instagram",
  ig: "instagram",
  insta: "instagram",
};

/** Dominios que delatan el canal cuando no vino parámetro. */
const REFERENTES: Array<[RegExp, Canal]> = [
  [/(^|\.)wa\.me$/i, "whatsapp"],
  [/(^|\.)whatsapp\.com$/i, "whatsapp"],
  [/(^|\.)manychat\.com$/i, "manychat"],
  [/(^|\.)mnch\.at$/i, "manychat"],
  [/(^|\.)m\.me$/i, "manychat"],
  [/(^|\.)messenger\.com$/i, "manychat"],
  [/(^|\.)instagram\.com$/i, "instagram"],
];

export function normalizarCanal(valor: string | null | undefined): Canal | null {
  if (!valor) return null;
  const limpio = valor.trim().toLowerCase();
  if (!limpio) return null;
  if (ALIAS[limpio]) return ALIAS[limpio];
  // Tolera cosas como "manychat-historia-3" o "wa_directo_agosto".
  for (const [alias, canal] of Object.entries(ALIAS)) {
    if (limpio.startsWith(`${alias}-`) || limpio.startsWith(`${alias}_`)) {
      return canal;
    }
  }
  return null;
}

function canalPorReferente(referente: string): Canal | null {
  if (!referente) return null;
  try {
    const host = new URL(referente).hostname;
    for (const [patron, canal] of REFERENTES) {
      if (patron.test(host)) return canal;
    }
  } catch {
    // Un referente malformado simplemente no aporta nada.
  }
  return null;
}

function leerGuardado(): Rastreo | null {
  try {
    const crudo = window.sessionStorage.getItem(CLAVE_SESION);
    if (!crudo) return null;
    const dato = JSON.parse(crudo) as Rastreo;
    return dato && typeof dato.canal === "string" ? dato : null;
  } catch {
    return null;
  }
}

function guardar(dato: Rastreo) {
  try {
    window.sessionStorage.setItem(CLAVE_SESION, JSON.stringify(dato));
  } catch {
    // Navegación privada o storage bloqueado: seguimos sin persistir.
  }
}

/** Se ejecuta solo en el navegador, después del montaje. */
export function resolverRastreo(): Rastreo {
  const params = new URLSearchParams(window.location.search);
  const referente = document.referrer || "";

  const utm: Record<string, string> = {};
  params.forEach((valor, clave) => {
    if (clave.toLowerCase().startsWith("utm_")) utm[clave.toLowerCase()] = valor;
  });

  let canal: Canal | null = null;
  let canalCrudo = "";
  let deteccion: Deteccion = "sin-dato";

  for (const clave of PARAMETROS) {
    const valor = params.get(clave);
    const resuelto = normalizarCanal(valor);
    if (resuelto) {
      canal = resuelto;
      canalCrudo = `${clave}=${valor}`;
      deteccion = "parametro";
      break;
    }
    if (valor && !canalCrudo) canalCrudo = `${clave}=${valor}`;
  }

  // Subdominio dedicado: wa.constelarys.com, mc.constelarys.com. Va antes
  // que el referente porque no depende de lo que mande el navegador.
  if (!canal) {
    // Coincidencia exacta, no por prefijo: un dominio de vista previa como
    // "mc-algo.vercel.app" no debe contarse como ManyChat.
    const subdominio = window.location.hostname.split(".")[0].toLowerCase();
    const porHost = ALIAS[subdominio] ?? null;
    if (porHost) {
      canal = porHost;
      canalCrudo = window.location.hostname;
      deteccion = "subdominio";
    }
  }

  if (!canal) {
    const porReferente = canalPorReferente(referente);
    if (porReferente) {
      canal = porReferente;
      canalCrudo = canalCrudo || referente;
      deteccion = "referente";
    }
  }

  const guardado = leerGuardado();

  // El primer contacto de la sesión gana, salvo que ahora sí haya un
  // parámetro explícito y antes no se hubiera identificado nada.
  // Se conserva su `deteccion` original: importa saber si el canal se supo
  // por parámetro o por referente, no que se leyó de la sesión.
  if (guardado && !(canal && guardado.canal === "otro")) {
    return { ...guardado, reutilizado: true };
  }

  const rastreo: Rastreo = {
    canal: canal ?? "otro",
    canalCrudo,
    deteccion: canal ? deteccion : "sin-dato",
    reutilizado: false,
    manychatId:
      params.get("mcid") ||
      params.get("subscriber_id") ||
      params.get("suscriptor") ||
      null,
    campana: params.get("utm_campaign") || params.get("campana") || null,
    landing: window.location.href,
    referente,
    utm,
    primeraVisita: new Date().toISOString(),
  };

  guardar(rastreo);
  return rastreo;
}
