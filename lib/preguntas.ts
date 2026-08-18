/**
 * Las once preguntas, en un solo lugar.
 *
 * El formulario las pinta y la API las usa para etiquetar cada respuesta,
 * así el payload que llega a tu hoja o a tu webhook viene con los títulos
 * completos y no con nombres de variable.
 *
 * El orden importa: pregunta 1 = estrella 1 en la constelación.
 */

export type Tipo = "texto" | "tel" | "area" | "lista" | "pesos";

export type Campo = {
  id: string;
  etiqueta: string;
  ayuda?: string;
  tipo: Tipo;
  marcador?: string;
  opciones?: string[];
  autoComplete?: string;
  maximo?: number;
};

export type Bloque = { numero: string; nombre: string; campos: Campo[] };

export const BLOQUES: Bloque[] = [
  {
    numero: "01",
    nombre: "Quién eres",
    campos: [
      {
        id: "nombre",
        etiqueta: "Nombre completo",
        tipo: "texto",
        marcador: "María Fernanda Ríos",
        autoComplete: "name",
        maximo: 90,
      },
      {
        id: "empresaCargo",
        etiqueta: "Nombre de la empresa y tu cargo",
        ayuda: "Ejemplo: Distribuidora Andina — gerente comercial.",
        tipo: "texto",
        marcador: "Empresa — cargo",
        autoComplete: "organization",
        maximo: 140,
      },
      {
        id: "whatsapp",
        etiqueta: "Número de WhatsApp",
        ayuda: "A este número te respondemos. Incluye el indicativo del país.",
        tipo: "tel",
        marcador: "+57 300 000 0000",
        autoComplete: "tel",
        maximo: 25,
      },
      {
        id: "trabajadores",
        etiqueta: "Cantidad de trabajadores",
        tipo: "lista",
        opciones: [
          "Solo yo",
          "2 a 5",
          "6 a 15",
          "16 a 50",
          "51 a 200",
          "Más de 200",
        ],
      },
    ],
  },
  {
    numero: "02",
    nombre: "Tu operación",
    campos: [
      {
        id: "queVende",
        etiqueta: "¿Qué vende tu empresa y cómo te llegan hoy los clientes?",
        ayuda: "En una o dos frases.",
        tipo: "texto",
        marcador: "Vendemos… y los clientes llegan por…",
        maximo: 220,
      },
      {
        id: "procesoCostoso",
        etiqueta:
          "¿Cuál es el proceso que más tiempo o plata te está costando hoy?",
        ayuda:
          "Cuéntalo como se lo contarías a un socio: qué pasa, quién lo hace y en qué momento se traba.",
        tipo: "area",
        marcador: "Todos los días alguien tiene que…",
        maximo: 1500,
      },
      {
        id: "intentosPrevios",
        etiqueta: "¿Has intentado resolverlo antes? ¿Con qué?",
        ayuda:
          "Herramientas, personas, agencias. Si nunca lo has intentado, dilo también.",
        tipo: "texto",
        marcador: "Probamos… / Todavía no hemos intentado nada",
        maximo: 220,
      },
      {
        id: "costoMensual",
        etiqueta:
          "Si tuvieras que ponerle un número: ¿cuánto crees que te cuesta ese problema al mes?",
        ayuda:
          "Un estimado sirve. Cuenta horas perdidas, ventas que se caen y reprocesos.",
        tipo: "pesos",
        marcador: "3.000.000",
      },
    ],
  },
  {
    numero: "03",
    nombre: "La decisión",
    campos: [
      {
        id: "porQueTu",
        etiqueta: "¿Por qué deberías ganártelo tú?",
        ayuda: "Sin modestia y sin discurso. Qué vas a hacer con esto si te lo llevas.",
        tipo: "area",
        marcador: "Porque…",
        maximo: 1500,
      },
      {
        id: "decision",
        etiqueta:
          "¿La decisión de contratar algo así la tomas tú solo o hay alguien más?",
        tipo: "lista",
        opciones: [
          "La tomo yo solo",
          "La tomo con un socio",
          "Necesito aprobación de un jefe o una junta",
          "Todavía no está claro quién decide",
        ],
      },
      {
        id: "plazo",
        etiqueta: "¿Para cuándo necesitas esto resuelto?",
        tipo: "lista",
        opciones: [
          "Ya, es lo más urgente que tengo",
          "Este mes",
          "En los próximos tres meses",
          "Todavía estoy explorando",
        ],
      },
    ],
  },
];

export const CAMPOS: Campo[] = BLOQUES.flatMap((bloque) => bloque.campos);

export const TOTAL_PREGUNTAS = CAMPOS.length;

export function contarDigitos(valor: string) {
  return (valor.match(/\d/g) || []).length;
}

/** Un campo cuenta como respondido cuando tiene contenido utilizable. */
export function estaRespondido(campo: Campo, valor: string) {
  const limpio = (valor ?? "").trim();
  if (!limpio) return false;
  if (campo.tipo === "tel") return contarDigitos(limpio) >= 7;
  if (campo.tipo === "pesos") return contarDigitos(limpio) >= 1;
  if (campo.tipo === "area") return limpio.length >= 15;
  return limpio.length >= 2;
}

/** Devuelve el texto del error, o null si la respuesta sirve. */
export function mensajeDeError(campo: Campo, valor: string) {
  const limpio = (valor ?? "").trim();
  if (!limpio) {
    return campo.tipo === "lista" ? "Elige una opción." : "Falta responder esto.";
  }
  if (campo.tipo === "tel" && contarDigitos(limpio) < 7) {
    return "Escribe el número completo, con indicativo.";
  }
  if (campo.tipo === "pesos" && contarDigitos(limpio) < 1) {
    return "Pon una cifra, aunque sea aproximada.";
  }
  if (campo.tipo === "area" && limpio.length < 15) {
    return "Cuéntanos un poco más: con una línea no alcanza.";
  }
  if (limpio.length < 2) return "Falta responder esto.";
  return null;
}
