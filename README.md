# Constelarys · Formulario de postulación

Formulario de once preguntas que registra **por qué canal llegó cada persona**
—ManyChat o WhatsApp directo— para poder comparar cuál trae mejores leads.

Next.js 16 (App Router) + TypeScript. Listo para Vercel.

---

## Lo primero: los enlaces que tienes que repartir

Todo el rastreo se apoya en qué enlace comparte cada canal. Son estos:

| Dónde lo pegas | Enlace | Se registra como |
| --- | --- | --- |
| Botón o mensaje de ManyChat | `formulario.constelarys.com/mc` | ManyChat |
| Chat de WhatsApp, mensaje manual | `formulario.constelarys.com/wa` | WhatsApp directo |
| Bio e historias de Instagram | `formulario.constelarys.com/ig` | Instagram |

> **`/mc`, `/wa` y `/ig` no se configuran en el DNS.** Son rutas de esta
> aplicación, ya escritas en [next.config.ts](next.config.ts), igual que
> `/contacto` en cualquier web. En el proveedor de dominio solo creas el
> subdominio; las rutas funcionan solas desde el primer despliegue.

Cada ruta redirige a la portada marcando el origen. Puedes probarlas ya en la
URL provisional de Vercel: al abrir `…vercel.app/wa` la barra de direcciones
cambia sola a `…/?src=whatsapp`.

Si prefieres enlaces largos, también funcionan a mano:
`formulario.constelarys.com/?src=manychat`, `?src=wa`, `?utm_source=manychat`,
`?origen=whatsapp`.

**En ManyChat**, para saber además qué suscriptor era, agrega su id:
`formulario.constelarys.com/mc?mcid={{user_id}}`. Llega en el campo `manychatId`.

**Para separar campañas** dentro del mismo canal:
`formulario.constelarys.com/mc?utm_campaign=historia-agosto`.

---

## Conectar el subdominio

Dos pasos, un solo registro DNS.

**1. En Vercel** — Settings › Domains › Add › `formulario.constelarys.com`.
Ahí te muestra el valor exacto del CNAME que necesitas.

**2. En tu proveedor de dominio** (Namecheap: Domain List › Manage ›
Advanced DNS › Add New Record):

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| CNAME Record | `formulario` | el valor que mostró Vercel | Automatic |

En **Host** va solo `formulario`, no el dominio completo: el proveedor le pega
`constelarys.com` por su cuenta.

Tres advertencias:

- El valor del CNAME **lo dicta Vercel**, no este README. Suele ser
  `cname.vercel-dns.com`, pero cambia según la cuenta. Usa el que te muestre.
- `constelarys.com` no se toca. Solo agregas un subdominio; la web principal
  sigue igual.
- Si el DNS está en Cloudflare, el registro debe quedar en *DNS only*
  (nube gris). Con el proxy activado falla la verificación de Vercel.

### Opcional: un subdominio por canal

No hace falta, pero si quieres enlaces más cortos puedes apuntar varios
subdominios al mismo proyecto —un CNAME por cada uno— y el canal sale del
subdominio, sin la ruta: `mc.`, `wa.` e `ig.`

La coincidencia es exacta: `formulario.` o un dominio de vista previa como
`mc-algo.vercel.app` no cuentan como canal. Un parámetro en la URL siempre
gana sobre el subdominio, por si necesitas corregir el origen a mano.

---

## Cómo decide el canal

Cuatro intentos, en orden. El primer resultado manda:

1. **Parámetro en la URL** — `src`, `source`, `utm_source`, `fuente`, `origen`,
   `canal` o `ref`. Es el método confiable y el que usan las rutas cortas.
2. **Subdominio** — solo si creaste `wa.constelarys.com` o
   `mc.constelarys.com`, por coincidencia exacta.
3. **Página que la trajo** — si no vino nada de lo anterior, mira el referente:
   `wa.me` y `whatsapp.com` cuentan como WhatsApp; `m.me`, `manychat.com` y
   `mnch.at` como ManyChat.
4. **Lo guardado en la sesión** — si ya se resolvió en esta visita, se
   conserva. Recargar la página o volver atrás no borra el origen.

Si nada da resultado, el lead se guarda como `otro` en vez de inventar un canal.

> Por eso importan las rutas cortas: WhatsApp muchas veces **no** manda el
> referente, así que sin el parámetro esos leads caerían todos en `otro`.

La lógica vive en [lib/rastreo.ts](lib/rastreo.ts). Los alias aceptados están
en la constante `ALIAS`: agrega ahí cualquier variante que uses.

---

## Dónde quedan las postulaciones

La API ([app/api/lead/route.ts](app/api/lead/route.ts)) tiene tres salidas.
Solo la primera es automática:

1. **Logs de Vercel** — siempre. Cada envío se imprime como una línea
   `[lead] {...}` en JSON. Es la copia de seguridad: nunca se pierde un lead
   aunque falle todo lo demás.
2. **`LEAD_WEBHOOK_URL`** — recibe el JSON por POST. Sirve n8n, Make, Zapier
   o un Google Apps Script.
3. **`RESEND_API_KEY` + `LEAD_EMAIL_TO`** — aviso por correo con las
   respuestas en texto plano.

Copia `.env.example` a `.env.local` para desarrollo.

### Tabla en Google Sheets en cinco minutos

Es la vía más rápida para tener la comparación por canal sin base de datos.

1. Crea una hoja nueva → **Extensiones › Apps Script**.
2. Pega esto y guarda:

```js
function doPost(e) {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const d = JSON.parse(e.postData.contents);

  if (hoja.getLastRow() === 0) {
    hoja.appendRow(
      ["Fecha", "Canal", "Detección", "Campaña"].concat(Object.keys(d.respuestas))
    );
  }

  hoja.appendRow(
    [d.recibido, d.canalLegible, d.deteccion, d.campana || ""]
      .concat(Object.values(d.respuestas))
  );

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. **Implementar › Nueva implementación › Aplicación web**.
   Ejecutar como *yo*, con acceso para *cualquier usuario*.
4. Copia la URL que te da y ponla en `LEAD_WEBHOOK_URL`.

Con eso, una tabla dinámica sobre la columna **Canal** te responde la pregunta:
cuántos leads trajo cada uno y cómo se ven.

---

## Desplegar en Vercel

```bash
npm i -g vercel      # si no lo tienes
vercel               # despliegue de prueba
vercel --prod        # producción
```

O sube el repo a GitHub e impórtalo en [vercel.com/new](https://vercel.com/new).
Next.js se detecta solo, no hay que configurar nada del build.

Después, las variables:

```bash
vercel env add LEAD_WEBHOOK_URL production
vercel env pull .env.local      # traerlas a tu máquina
```

---

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:3000
```

Para probar el rastreo en local: `http://localhost:3000/mc` y
`http://localhost:3000/wa`. El canal detectado sale en la consola del servidor
al enviar el formulario.

---

## Estructura

```
app/
  page.tsx              portada
  layout.tsx            tipografías y metadatos
  globals.css           tokens de marca (tinta, oro, marfil)
  icon.svg              favicon: la estrella polar
  api/lead/route.ts     recibe, valida y reenvía la postulación
components/
  Formulario.tsx        las once preguntas y el envío
  Constelacion.tsx      progreso: una estrella por respuesta
  Marca.tsx             logo, isotipo y estrella, en vector
lib/
  preguntas.ts          definición de las preguntas y su validación
  rastreo.ts            detección del canal de origen
next.config.ts          rutas cortas /mc, /wa, /ig
```

## Cambiar las preguntas

Todo está en [lib/preguntas.ts](lib/preguntas.ts): el formulario y la API leen
de ahí, así que editarlo actualiza pantalla, validación y las columnas que
llegan a tu hoja.

Si agregas o quitas una pregunta, ajusta también el arreglo `ESTRELLAS` en
[components/Constelacion.tsx](components/Constelacion.tsx): tiene que haber una
estrella por pregunta.

## Contra el spam

Un campo trampa invisible y un mínimo de cinco segundos entre abrir y enviar.
Suficiente para bots de formulario; si aparece spam dirigido, el siguiente paso
es activar [Vercel BotID](https://vercel.com/docs/botid).
