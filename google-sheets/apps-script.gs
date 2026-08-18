/**
 * Constelarys · recibe las postulaciones en esta hoja.
 *
 * Cómo se usa (instrucciones completas en el README):
 *   1. Hoja de cálculo nueva → Extensiones › Apps Script
 *   2. Borra lo que haya y pega TODO este archivo
 *   3. Implementar › Nueva implementación › Aplicación web
 *      Ejecutar como: Yo    ·    Quién tiene acceso: Cualquier usuario
 *   4. Copia la URL que te da y ponla en Vercel como LEAD_WEBHOOK_URL
 *
 * No hace falta crear pestañas ni encabezados: se arman solos la primera
 * vez que llega un dato.
 */

function doPost(e) {
  // Durante un lanzamiento pueden llegar dos envíos en el mismo segundo.
  // Sin el candado, uno pisa al otro y se pierde una fila.
  var candado = LockService.getScriptLock();
  candado.waitLock(20000);

  try {
    var libro = SpreadsheetApp.getActiveSpreadsheet();
    var d = JSON.parse(e.postData.contents);

    if (d.evento === "progreso") {
      var progreso = hojaCon_(libro, "Progreso", [
        "Fecha", "Visita", "Canal", "ManyChat ID", "Campaña",
        "Respondidas", "Total", "Se quedó en",
        "Nombre", "WhatsApp", "Empresa y cargo"
      ]);
      progreso.appendRow([
        d.actualizado, d.visita, d.canalLegible, d.manychatId || "",
        d.campana || "", d.respondidas, d.total, d.ultimaPregunta,
        d.nombre || "", d.whatsapp || "", d.empresaCargo || ""
      ]);
    } else {
      var preguntas = Object.keys(d.respuestas);
      var postulaciones = hojaCon_(
        libro,
        "Postulaciones",
        ["Fecha", "Canal", "Detección", "Campaña", "ManyChat ID", "Visita",
         "Costo mensual (número)"].concat(preguntas)
      );
      postulaciones.appendRow(
        [d.recibido, d.canalLegible, d.deteccion, d.campana || "",
         d.manychatId || "", d.visita, d.costoMensualPesos || ""]
          .concat(Object.values(d.respuestas))
      );
    }

    return respuesta_({ ok: true });
  } catch (error) {
    // Queda en Apps Script › Ejecuciones si algo sale mal.
    console.error(error);
    return respuesta_({ ok: false, error: String(error) });
  } finally {
    candado.releaseLock();
  }
}

/**
 * Prueba de un clic: abre la URL que termina en /exec en una ventana de
 * incógnito.
 *
 *   Ves {"ok":true,...}          → quedó bien publicado.
 *   Te pide iniciar sesión       → "Quién tiene acceso" NO está en
 *                                  "Cualquier usuario". Ese es el problema.
 */
function doGet() {
  return respuesta_({
    ok: true,
    mensaje: "El script está publicado y acepta peticiones sin iniciar sesión."
  });
}

/** Devuelve la pestaña, creándola con encabezados si aún no existe. */
function hojaCon_(libro, nombre, encabezados) {
  var hoja = libro.getSheetByName(nombre);
  if (!hoja) hoja = libro.insertSheet(nombre);

  if (hoja.getLastRow() === 0) {
    hoja.appendRow(encabezados);
    hoja.getRange(1, 1, 1, encabezados.length).setFontWeight("bold");
    hoja.setFrozenRows(1);
  }
  return hoja;
}

function respuesta_(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Opcional: pruébalo sin salir de aquí.
 * Selecciona "probar" arriba y dale a Ejecutar. Debe aparecer una fila
 * de mentiras en la pestaña Postulaciones, que luego borras a mano.
 */
function probar() {
  doPost({
    postData: {
      contents: JSON.stringify({
        evento: "completado",
        visita: "prueba-local",
        recibido: new Date().toISOString(),
        canalLegible: "WhatsApp directo",
        deteccion: "parametro",
        campana: "",
        manychatId: "",
        costoMensualPesos: 3000000,
        respuestas: {
          "Nombre completo": "Prueba Prueba",
          "Número de WhatsApp": "+57 300 000 0000"
        }
      })
    }
  });
}
