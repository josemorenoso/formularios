# Constelarys · Formulario de postulación

Formulario de once preguntas que registra **por qué canal llegó cada persona**
—ManyChat o WhatsApp directo— para poder comparar cuál trae mejores leads.

Next.js 16 (App Router) + TypeScript. Listo para Vercel.

---

## Lo primero: los enlaces que tienes que repartir

Todo el rastreo se apoya en qué enlace comparte cada canal. Son estos:

| Dónde lo pegas | Enlace | Se registra como |
| --- | --- | --- |
| Botón o mensaje de ManyChat | `convocatoria.constelarys.com/mc` | ManyChat |
| Chat de WhatsApp, mensaje manual | `convocatoria.constelarys.com/wa` | WhatsApp directo |
| Bio e historias de Instagram | `convocatoria.constelarys.com/ig` | Instagram |

> **`/mc`, `/wa` y `/ig` no se configuran en el DNS.** Son rutas de esta
> aplicación, ya escritas en [next.config.ts](next.config.ts), igual que
> `/contacto` en cualquier web. En el proveedor de dominio solo creas el
> subdominio; las rutas funcionan solas desde el primer despliegue.

Cada ruta redirige a la portada marcando el origen. Puedes probarlas ya en la
URL provisional de Vercel: al abrir `…vercel.app/wa` la barra de direcciones
cambia sola a `…/?src=whatsapp`.

Si prefieres enlaces largos, también funcionan a mano:
`convocatoria.constelarys.com/?src=manychat`, `?src=wa`, `?utm_source=manychat`,
`?origen=whatsapp`.

**En ManyChat**, para saber además qué suscriptor era, agrega su id:
`convocatoria.constelarys.com/mc?mcid={{user_id}}`. Llega en el campo `manychatId`.

**Para separar campañas** dentro del mismo canal:
`convocatoria.constelarys.com/mc?utm_campaign=historia-agosto`.

---

## Conectar el subdominio

Dos pasos, un solo registro DNS.

**1. En Vercel** — Settings › Domains › Add › `convocatoria.constelarys.com`.
Ahí te muestra el valor exacto del CNAME que necesitas.

**2. En tu proveedor de dominio** (Namecheap: Domain List › Manage ›
Advanced DNS › Add New Record):

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| CNAME Record | `convocatoria` | el valor que mostró Vercel | Automatic |

En **Host** va solo `convocatoria`, no el dominio completo: el proveedor le pega
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
2. **`LEAD_WEBHOOK_URL`** — recibe el JSON por POST. Aquí va n8n.
3. **`RESEND_API_KEY` + `LEAD_EMAIL_TO`** — aviso por correo con las
   respuestas en texto plano.

Copia `.env.example` a `.env.local` para desarrollo.

### Los dos eventos

Al mismo webhook llegan dos tipos de mensaje. Se distinguen por el campo
`evento`, y esa es la primera bifurcación del flujo de n8n.

| `evento` | Cuándo se manda | Para qué sirve |
| --- | --- | --- |
| `progreso` | Mientras la persona llena, 4 s después de dejar de escribir, y al cerrar o cambiar de pestaña | Saber quién se quedó a medias y en qué pregunta |
| `completado` | Al enviar el formulario | La postulación entera |

Ambos traen el mismo campo **`visita`**: es la clave que une el avance de
alguien con su envío. Si hay `progreso` con una `visita` que nunca llegó como
`completado`, esa persona abandonó.

El evento `progreso` **no lleva las respuestas largas**, solo cuántas van, en
cuál se quedó y los datos de contacto que ya haya escrito.

### Montar el flujo en n8n

En [n8n/constelarys-formulario.json](n8n/constelarys-formulario.json) está el
flujo listo para importar (**Workflows › Import from File**). Son ocho nodos:

```
Webhook → Switch por evento
            ├── completado → Code → Sheets "Postulaciones" → IF ManyChat → ManyChat: etiquetar
            └── progreso   → Code → Sheets "Progreso"
```

Después de importar hay que completar tres cosas, que a propósito no vienen
en el archivo:

1. **Credencial de Google Sheets** en los dos nodos de hoja, y volver a elegir
   el documento desde el selector (el ID viene como
   `REEMPLAZA_CON_EL_ID_DE_TU_HOJA`).
2. **Credencial Header Auth** en el nodo de ManyChat:
   Name `Authorization`, Value `Bearer TU_TOKEN`. El token sale de ManyChat ›
   Settings › API.
3. **Copiar la URL de producción del webhook** y ponerla en Vercel como
   `LEAD_WEBHOOK_URL`.

Los nodos de código arman la fila con los nombres de columna ya escritos y los
nodos de Sheets usan mapeo automático, así que **los encabezados de la hoja
tienen que coincidir exactamente**:

- Pestaña `Postulaciones`: Fecha · Canal · Detección · Campaña · ManyChat ID ·
  Visita · Nombre · WhatsApp · Empresa y cargo · Trabajadores · Qué vende ·
  Proceso costoso · Intentos previos · Costo mensual · Por qué él ·
  Quién decide · Plazo
- Pestaña `Progreso`: Fecha · Visita · Canal · ManyChat ID · Campaña ·
  Respondidas · Total · Se quedó en · Nombre · WhatsApp · Empresa y cargo

Una tabla dinámica sobre la columna **Canal** de `Postulaciones` responde la
pregunta del experimento. Otra sobre **Se quedó en** de `Progreso` te dice
cuál pregunta está espantando gente.

### Opción rápida: Google Sheets sin n8n

La forma más corta de tener los datos guardados hoy mismo. Después puedes
cambiar a n8n sin tocar código: solo cambias `LEAD_WEBHOOK_URL`.

El script está en [google-sheets/apps-script.gs](google-sheets/apps-script.gs).
Crea las pestañas y los encabezados solo, así que no hay que preparar nada
en la hoja.

1. Entra a [sheets.new](https://sheets.new) — crea una hoja en blanco.
   Ponle nombre, por ejemplo *Constelarys · Postulaciones*.
2. Menú **Extensiones › Apps Script**. Se abre otra pestaña del navegador.
3. Borra el `function myFunction() {}` que viene y pega **todo** el contenido
   de `apps-script.gs`. Guarda con el icono del disquete o Ctrl+S.
4. Botón azul **Implementar › Nueva implementación**.
5. Al lado de *Seleccionar tipo*, dale al **engranaje** y elige
   **Aplicación web**.
6. Rellena así:
   - *Ejecutar como*: *Yo*
   - *Quién tiene acceso*: **Cualquier usuario** ← el que más se equivoca
7. **Implementar**. Pide permisos: *Revisar permisos* → tu cuenta → aparece
   una pantalla roja que dice que Google no ha verificado la app. Es normal,
   la app es tuya: **Configuración avanzada › Ir a (nombre) (no seguro)** →
   **Permitir**.
8. Copia la **URL de la aplicación web** (termina en `/exec`).
9. En Vercel: *Settings › Environment Variables* → `LEAD_WEBHOOK_URL` con esa
   URL → *Deployments › ⋯ › Redeploy*.

Para comprobarlo sin esperar a nadie: en el editor de Apps Script elige la
función `probar` en el desplegable de arriba y dale **Ejecutar**. Debe
aparecer una fila de mentiras en la pestaña *Postulaciones*; bórrala a mano.

> Si más adelante editas el script, hay que hacer **Implementar › Gestionar
> implementaciones › editar › Versión: Nueva** para que los cambios salgan en
> vivo. La URL no cambia.

---

## Recuperar a quien abandona

El recordatorio lo manda **ManyChat**, no este proyecto. La aplicación solo
avisa quién terminó; ManyChat decide a quién le escribe.

**En ManyChat**, en el flujo que reparte el enlace:

1. Enviar el mensaje con `convocatoria.constelarys.com/mc?mcid={{user_id}}`.
   El `mcid` es lo que permite reconocer después al suscriptor.
2. **Smart Delay** de 2 o 3 horas.
3. **Condition**: ¿tiene la etiqueta `postulacion-completada`?
   - Sí → terminar.
   - No → enviar el recordatorio.

El nodo de n8n pone esa etiqueta en cuanto llega el evento `completado`. Quien
no la tenga, es porque no terminó.

Dos límites que conviene tener presentes:

- **Solo alcanza a quien llegó por ManyChat.** De los que entran por WhatsApp
  directo no sabemos quiénes son hasta que envían el formulario, así que no
  hay a quién escribirle. Es la asimetría que este experimento mide.
- **Instagram cierra la ventana a las 24 horas.** Meta solo deja escribir
  dentro de las 24 h desde la última interacción de la persona. Un Smart Delay
  de 2–3 horas cae cómodo dentro; uno de dos días no se entrega.

Si quieres que el recordatorio diga en qué pregunta se quedó, esa información
está en la hoja `Progreso`, columna **Se quedó en**.

---

## Al terminar: el grupo de WhatsApp

Pon el enlace de invitación en `NEXT_PUBLIC_WHATSAPP_GRUPO`. La pantalla final
muestra el botón y redirige sola a los seis segundos.

Dos detalles:

- Es una variable **`NEXT_PUBLIC_`**: se inyecta al compilar. Después de
  cambiarla en Vercel hay que **volver a desplegar** para que tome efecto.
- Si se deja vacía no aparece el botón, y la pantalla final vuelve al mensaje
  normal. Nunca se muestra un enlace roto.

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
  page.tsx                portada
  layout.tsx              tipografías y metadatos
  globals.css             tokens de marca (tinta, oro, marfil)
  icon.svg                favicon: la estrella polar
  api/lead/route.ts       recibe, valida y reenvía la postulación
  api/progreso/route.ts   avisa que alguien va a medias
components/
  Formulario.tsx          las once preguntas, el envío y el paso al grupo
  Constelacion.tsx        progreso: una estrella por respuesta
  Marca.tsx               logo, isotipo y estrella, en vector
lib/
  preguntas.ts            definición de las preguntas y su validación
  rastreo.ts              detección del canal de origen
google-sheets/
  apps-script.gs                recibe los datos en una hoja, sin n8n
n8n/
  constelarys-formulario.json   flujo listo para importar
next.config.ts            rutas cortas /mc, /wa, /ig
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
