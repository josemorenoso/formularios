"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Constelacion from "./Constelacion";
import { EstrellaPolar } from "./Marca";
import { resolverRastreo, type Rastreo } from "@/lib/rastreo";
import {
  BLOQUES,
  CAMPOS,
  TOTAL_PREGUNTAS,
  estaRespondido,
  mensajeDeError,
  type Campo,
} from "@/lib/preguntas";

/** Agrupa en miles con punto, como se escriben los pesos. */
function formatearPesos(valor: string) {
  const digitos = valor.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 12);
  if (!digitos) return "";
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const VACIO: Record<string, string> = Object.fromEntries(
  CAMPOS.map((campo) => [campo.id, ""]),
);

/* Enlace de invitación al grupo de WhatsApp. Se inyecta al compilar, así que
   hay que volver a desplegar después de cambiarlo en Vercel. Si no está
   configurado, la pantalla final no muestra el botón en vez de un enlace roto. */
const GRUPO = process.env.NEXT_PUBLIC_WHATSAPP_GRUPO ?? "";

/** Reporte de avance: cuánto lleva y en qué pregunta se quedó. */
function armarProgreso(
  valores: Record<string, string>,
  respondidas: number,
  rastreo: Rastreo | null,
) {
  const ultima = [...CAMPOS]
    .reverse()
    .find((campo) => estaRespondido(campo, valores[campo.id]));
  return JSON.stringify({
    visita: rastreo?.visita ?? "",
    respondidas,
    ultimaPregunta: ultima?.id ?? "",
    contacto: {
      nombre: valores.nombre,
      whatsapp: valores.whatsapp,
      empresaCargo: valores.empresaCargo,
    },
    rastreo,
  });
}

/** Segundos de cortesía antes de llevar a la persona al grupo. */
const ESPERA_REDIRECCION = 6;

/** Silencio tras la última tecla antes de reportar el avance. */
const RETARDO_PROGRESO = 4000;

type Estado = "editando" | "enviando" | "recibido";

export default function Formulario() {
  const [valores, setValores] = useState<Record<string, string>>(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [estado, setEstado] = useState<Estado>("editando");
  const [fallo, setFallo] = useState<string | null>(null);
  const trampa = useRef<HTMLInputElement>(null);
  const abierto = useRef<number>(0);
  // El canal no se pinta en pantalla: viaja con el envío. Por eso vive en
  // una ref y no en estado. Se resuelve ya montado, que necesita URL y
  // referrer del navegador.
  const rastreo = useRef<Rastreo | null>(null);
  const [cuenta, setCuenta] = useState(ESPERA_REDIRECCION);

  useEffect(() => {
    abierto.current = Date.now();
    rastreo.current = resolverRastreo();
  }, []);

  const respondidas = useMemo(
    () => CAMPOS.filter((campo) => estaRespondido(campo, valores[campo.id])).length,
    [valores],
  );

  const ultimoAvisado = useRef(-1);

  // Quien abandona no avisa: se reporta el avance mientras llena, para poder
  // reconocerlo después. Solo cuenta y última pregunta, no las respuestas.
  // El efecto se reinicia con cada tecla, así que espera a que la persona
  // deje de escribir y manda el estado más reciente.
  useEffect(() => {
    if (estado !== "editando" || respondidas === 0) return;
    if (respondidas === ultimoAvisado.current) return;

    const temporizador = setTimeout(() => {
      ultimoAvisado.current = respondidas;
      fetch("/api/progreso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: armarProgreso(valores, respondidas, rastreo.current),
        keepalive: true,
      }).catch(() => {
        // El avance es información secundaria: si falla, no molestamos.
        ultimoAvisado.current = -1;
      });
    }, RETARDO_PROGRESO);

    return () => clearTimeout(temporizador);
  }, [respondidas, estado, valores]);

  // Al cerrar o cambiar de pestaña se manda lo último, que es justo el
  // momento en que se pierde a la gente. sendBeacon sobrevive al cierre.
  useEffect(() => {
    if (estado !== "editando") return;
    const alOcultar = () => {
      if (document.visibilityState !== "hidden") return;
      if (respondidas === 0 || respondidas === ultimoAvisado.current) return;
      ultimoAvisado.current = respondidas;
      navigator.sendBeacon?.(
        "/api/progreso",
        new Blob([armarProgreso(valores, respondidas, rastreo.current)], {
          type: "application/json",
        }),
      );
    };
    document.addEventListener("visibilitychange", alOcultar);
    return () => document.removeEventListener("visibilitychange", alOcultar);
  }, [estado, respondidas, valores]);

  // Cuenta regresiva hacia el grupo de WhatsApp.
  useEffect(() => {
    if (estado !== "recibido" || !GRUPO) return;
    if (cuenta <= 0) {
      window.location.href = GRUPO;
      return;
    }
    const temporizador = setTimeout(() => setCuenta((n) => n - 1), 1000);
    return () => clearTimeout(temporizador);
  }, [estado, cuenta]);

  function cambiar(campo: Campo, entrada: string) {
    const valor = campo.tipo === "pesos" ? formatearPesos(entrada) : entrada;
    setValores((previos) => ({ ...previos, [campo.id]: valor }));
    setErrores((previos) => {
      if (!previos[campo.id]) return previos;
      const siguiente = { ...previos };
      delete siguiente[campo.id];
      return siguiente;
    });
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (estado === "enviando") return;

    const nuevos: Record<string, string> = {};
    for (const campo of CAMPOS) {
      const problema = mensajeDeError(campo, valores[campo.id]);
      if (problema) nuevos[campo.id] = problema;
    }
    setErrores(nuevos);

    const faltantes = Object.keys(nuevos).length;
    if (faltantes > 0) {
      setFallo(
        faltantes === 1
          ? "Falta una respuesta. Está marcada abajo."
          : `Faltan ${faltantes} respuestas. Están marcadas abajo.`,
      );
      const primero = CAMPOS.find((campo) => nuevos[campo.id]);
      if (primero) {
        const nodo = document.getElementById(primero.id);
        nodo?.scrollIntoView({ block: "center", behavior: "smooth" });
        nodo?.focus({ preventScroll: true });
      }
      return;
    }

    setFallo(null);
    setEstado("enviando");

    try {
      const respuesta = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          respuestas: valores,
          rastreo: rastreo.current,
          verificacion: {
            trampa: trampa.current?.value ?? "",
            segundos: Math.round((Date.now() - abierto.current) / 1000),
          },
        }),
      });

      if (!respuesta.ok) {
        const detalle = await respuesta.json().catch(() => null);
        throw new Error(detalle?.mensaje || "No pudimos guardar tu postulación.");
      }

      setEstado("recibido");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setEstado("editando");
      setFallo(
        error instanceof Error
          ? `${error.message} Vuelve a intentarlo o escríbenos por WhatsApp.`
          : "Algo falló al enviar. Vuelve a intentarlo.",
      );
    }
  }

  if (estado === "recibido") {
    return (
      <div className="recibido aparece">
        <EstrellaPolar tamano={52} style={{ color: "var(--oro-claro)" }} />
        <h2>
          Quedaste <em>registrado</em>.
        </h2>
        <p>
          Ya tenemos tus once respuestas. Las leemos una por una y te escribimos
          al WhatsApp que dejaste.
        </p>

        {GRUPO ? (
          <>
            <div className="recibido-linea" />
            <p>
              Falta un paso: entra al grupo. Ahí anunciamos a quien se lo lleva.
            </p>
            <a className="boton boton-grupo" href={GRUPO}>
              Entrar al grupo de WhatsApp
            </a>
            <p className="pie-nota" aria-live="polite">
              Te llevamos automáticamente en {cuenta}…
            </p>
          </>
        ) : (
          <>
            <div className="recibido-linea" />
            <p>Si en 48 horas no sabes de nosotros, escríbenos tú.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rejilla">
      <aside className="riel aparece">
        <p className="rotulo">Constelarys · Postulación</p>
        <h1 className="riel-titulo">
          Once preguntas para <em>ganártelo</em>.
        </h1>
        <p className="riel-texto">
          Cuéntanos qué proceso te está costando plata. Cada respuesta enciende
          una estrella.
        </p>
        <Constelacion respondidas={respondidas} />
        <p className="riel-nota">
          Tus respuestas no se comparten con nadie. Te escribimos únicamente al
          WhatsApp que dejes aquí.
        </p>
      </aside>

      <div>
        <div className="intro-movil">
          <p className="rotulo">Constelarys · Postulación</p>
          <h1>
            Once preguntas para <em>ganártelo</em>.
          </h1>
          <p>
            Cuéntanos qué proceso te está costando plata. Cada respuesta
            enciende una estrella.
          </p>
          <Constelacion respondidas={respondidas} />
        </div>

        {/* Al hacer scroll la constelación queda arriba, así que la barra
            fija solo lleva la cuenta: una regla y un número. */}
        <div className="movil">
          <span className="movil-riel" aria-hidden="true">
            <span
              className="movil-riel-lleno"
              style={{ width: `${(respondidas / TOTAL_PREGUNTAS) * 100}%` }}
            />
          </span>
          <span className="movil-cuenta">
            <b>{respondidas}</b> de {TOTAL_PREGUNTAS}
          </span>
        </div>

        <form className="formulario" onSubmit={enviar} noValidate>
          {fallo && (
            <p className="aviso" role="alert">
              {fallo}
            </p>
          )}

          {BLOQUES.map((bloque) => (
            <section className="bloque" key={bloque.numero}>
              <div className="bloque-cabecera">
                <span className="bloque-numero">{bloque.numero}</span>
                <h2 className="bloque-nombre">{bloque.nombre}</h2>
              </div>

              {bloque.campos.map((campo) => {
                const valor = valores[campo.id] ?? "";
                const error = errores[campo.id];
                const idAyuda = campo.ayuda ? `${campo.id}-ayuda` : undefined;
                const idError = error ? `${campo.id}-error` : undefined;
                const descrito =
                  [idAyuda, idError].filter(Boolean).join(" ") || undefined;
                const comunes = {
                  id: campo.id,
                  name: campo.id,
                  value: valor,
                  "aria-describedby": descrito,
                  "aria-invalid": error ? true : undefined,
                  "data-error": error ? "si" : "no",
                } as const;

                return (
                  <div className="campo" key={campo.id}>
                    <label className="campo-etiqueta" htmlFor={campo.id}>
                      {campo.etiqueta}
                    </label>
                    {campo.ayuda && (
                      <span className="campo-ayuda" id={idAyuda}>
                        {campo.ayuda}
                      </span>
                    )}

                    {campo.tipo === "area" ? (
                      <textarea
                        {...comunes}
                        className="area"
                        rows={5}
                        placeholder={campo.marcador}
                        maxLength={campo.maximo}
                        onChange={(e) => cambiar(campo, e.target.value)}
                      />
                    ) : campo.tipo === "lista" ? (
                      <select
                        {...comunes}
                        className="lista"
                        onChange={(e) => cambiar(campo, e.target.value)}
                      >
                        <option value="">Elige una opción</option>
                        {campo.opciones?.map((opcion) => (
                          <option key={opcion} value={opcion}>
                            {opcion}
                          </option>
                        ))}
                      </select>
                    ) : campo.tipo === "pesos" ? (
                      <div className="pesos">
                        <span className="pesos-simbolo">$</span>
                        <input
                          {...comunes}
                          className="entrada"
                          type="text"
                          inputMode="numeric"
                          placeholder={campo.marcador}
                          onChange={(e) => cambiar(campo, e.target.value)}
                        />
                        <span className="pesos-sufijo">AL MES</span>
                      </div>
                    ) : (
                      <input
                        {...comunes}
                        className="entrada"
                        type={campo.tipo === "tel" ? "tel" : "text"}
                        inputMode={campo.tipo === "tel" ? "tel" : undefined}
                        placeholder={campo.marcador}
                        maxLength={campo.maximo}
                        autoComplete={campo.autoComplete}
                        onChange={(e) => cambiar(campo, e.target.value)}
                      />
                    )}

                    {error && (
                      <span className="campo-error" id={idError} role="alert">
                        {error}
                      </span>
                    )}
                  </div>
                );
              })}
            </section>
          ))}

          {/* Trampa para bots: invisible y fuera del recorrido de teclado. */}
          <div className="trampa" aria-hidden="true">
            <label htmlFor="sitio-web">No llenes este campo</label>
            <input
              ref={trampa}
              id="sitio-web"
              name="sitio-web"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <div className="pie">
            <button
              className="boton"
              type="submit"
              disabled={estado === "enviando"}
            >
              {estado === "enviando" ? "Enviando…" : "Enviar postulación"}
            </button>
            <p className="pie-nota">
              Respondemos por WhatsApp en menos de 48 horas.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
