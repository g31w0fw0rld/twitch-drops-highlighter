// Arranca twitch-drops-highlighter dentro de jsdom sobre el volcado real de
// /drops/inventory y cuenta lo que el usuario ve: la ✕ y lo escondido.
//
// El volcado (`fixture-inventario-pokemon.html`) es el DOM que Twitch servia el
// 2026-08-26, guardado sin credenciales. Vive aqui y no en `docs/` porque es la
// entrada de este test, no documentacion: si se mueve, esto deja de correr.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const path = require('path');
// `TW_SCRIPT` apunta a OTRO fichero. Es para las comprobaciones de sensibilidad:
// correr el mismo test contra una copia sin el arreglo y ver que falla. Sin eso, un
// test nuevo puede estar en verde por no comprobar nada.
//   git show HEAD:twitch-drops-highlighter.user.js > /tmp/pub.js
//   TW_SCRIPT=/tmp/pub.js node tests/test-inventario-pokemon.js
const SCRIPT = fs.readFileSync(process.env.TW_SCRIPT ||
  path.join(__dirname, '..', 'twitch-drops-highlighter.user.js'), 'utf8');
const DUMP = fs.readFileSync(
  path.join(__dirname, 'fixture-inventario-pokemon.html'), 'utf8');

// Arranca el script sobre el volcado y devuelve el DOM para inspeccionarlo. Se
// comprueban EFECTOS OBSERVABLES —la ✕ pintada, lo que queda escondido— y no
// funciones internas: son los que ve el usuario.
// `gql` sirve las respuestas de la API por operationName ({ ViewerDropsDashboard, Inventory }).
// Sin el, fetch sigue sin resolver nunca y los tests que solo miran el DOM se comportan igual
// que antes. Con el, el arnes ademas SIEMBRA `_gqlState`: el script no pregunta a la API hasta
// tener token e integridad, y esos los roba del trafico de la propia pagina, asi que aqui hay
// que fingir una peticion de Twitch antes de que sus consultas puedan salir.
// `dump` permite pasar OTRO volcado en vez del inventario de Pokemon. El de Pokemon sigue
// siendo el de por defecto para no tocar los tests que ya existen.
// `keywords` sustituye la lista sembrada. Hace falta para los tests que traen su propio
// volcado o su propio payload de API: con las de por defecto, una campaña que no sea de
// Pokemon/Marvel/Rust no pasa el filtro y la tarjeta no llega a pintarse.
// `url` cambia la pagina que el arnes finge servir. Hacia falta porque el escaneo que
// MARCA campañas solo corre en /drops/campaigns: con la URL del inventario fija, un
// volcado de campañas se cargaba pero nadie lo miraba, asi que no habia forma de probar
// el marcado de la pagina. Sigue por defecto en el inventario para no tocar los que ya
// existen.
// `lateHtml` / `lateMs` inyectan DOM en el <body> cuando ya ha arrancado todo. Es lo que
// hace React al montar la lista de campañas: el panel puede haberse llenado antes de que
// las filas existan. Sin poder ponerlo en ese orden no hay forma de ejercitar esa carrera,
// y un test sobre esto saldria verde con el fallo dentro.
function run({ borrados = [], waitMs = 8000, clicarX = null, gql = null, dump = DUMP,
               url = 'https://www.twitch.tv/drops/inventory', lateHtml = null, lateMs = 5000,
               keywords = ['pokemon', 'marvel', 'squadra', 'sorcerer', 'rust'] } = {}) {
  return new Promise(resolve => {
    const vc = new VirtualConsole();
    vc.on('jsdomError', () => {});
    const dom = new JSDOM(`<!DOCTYPE html><html lang="es"><body>${dump}</body></html>`, {
      url,
      runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc
    });
    const w = dom.window;
    const store = new Map([
      ['twitch_show_hide_inventory_expired', true],
      ['twitch_inventory_deleted_drops', JSON.stringify(borrados)],
      ['twitch_drop_keywords', JSON.stringify(keywords)]
    ]);
    w.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    w.GM_setValue = (k, v) => store.set(k, v);
    w.GM_deleteValue = k => store.delete(k);
    w.unsafeWindow = w;
    const pedidas = [];
    w.fetch = (u, opts) => {
      let op = '';
      try { op = JSON.parse(opts && opts.body)[0].operationName || ''; } catch (e) { /* la de siembra */ }
      if (op) pedidas.push(op);
      const payload = gql && op && gql[op];
      // Sin payload se devuelve una promesa que no resuelve NUNCA, que es lo que habia
      // antes: una respuesta vacia no es lo mismo que no contestar, y el script distingue
      // los dos casos (el aviso de «sin inventario» sale solo en el segundo).
      if (!payload) return new Promise(() => {});
      return Promise.resolve({ ok: true, status: 200, json: async () => payload });
    };
    w.eval(SCRIPT);
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    w.dispatchEvent(new w.Event('load'));

    // La siembra. Va DESPUES del eval a proposito: el interceptor del script envuelve
    // `unsafeWindow.fetch` al arrancar, asi que esta llamada pasa por el y le deja el
    // token y la integridad. Antes del eval no habria nadie escuchando.
    if (gql) {
      w.fetch('https://gql.twitch.tv/gql', {
        method: 'POST',
        headers: {
          'authorization': 'OAuth token-de-prueba',
          'client-integrity': 'integridad-de-prueba',
          'client-session-id': 'sesion', 'client-version': 'version', 'x-device-id': 'dispositivo'
        },
        body: JSON.stringify([{ operationName: 'SiembraDeCabeceras' }])
      });
    }

    const informe = () => {
      const doc = w.document;
      const xs = Array.from(doc.querySelectorAll('a[data-drop-own-tip]'));
      const camps = Array.from(doc.querySelectorAll('.inventory-campaign-info')).map(info => {
        // Subimos al bloque que el script esconde (el que lleva el enlace dropID)
        let n = info, cont = null;
        while (n && n !== doc.body) {
          if (n.querySelector('a.tw-link[href*="dropID="]')) { cont = n; break; }
          n = n.parentElement;
        }
        const link = info.querySelector('a.tw-link[href*="dropID="]');
        const id = link ? (link.getAttribute('href').match(/dropID=([^&]+)/) || [])[1] : '?';
        const nombre = (info.textContent || '').trim().slice(0, 28).replace(/\s+/g, ' ');
        return {
          nombre, id: (id||'').slice(0, 8),
          x: !!(cont && cont.querySelector('a[data-drop-own-tip]')),
          escondido: !!(cont && cont.style.display === 'none'),
          marcado: !!(cont && cont.getAttribute('data-twitch-drops-hidden') === '1')
        };
      });
      // Los chips de recompensa de cada tarjeta del panel, con su estado. El ✓ y el
      // tachado son dos marcas distintas del mismo hecho y se leen las dos: el ✓ va en su
      // propio span, asi que un chip con ✓ delante pero sin tachar seria un fallo que el
      // texto por si solo no distingue.
      const chips = Array.from(doc.querySelectorAll('#twitch-drops-active-pane [data-notif-title]'))
        .map(card => ({
          titulo: card.getAttribute('data-notif-title'),
          badges: Array.from(card.querySelectorAll('.drop-api-names > span')).map(chip => ({
            texto: (chip.textContent || '').replace(/\s+/g, ' ').trim(),
            premios: Array.from(chip.querySelectorAll('span')).map(sp => ({
              texto: (sp.textContent || '').trim(),
              tachado: sp.style.textDecoration === 'line-through'
            }))
          }))
        }));
      // LAS FILAS MARCADAS EN LA PROPIA PAGINA. Se leen por el `id` que el escaneo
      // reparte (`drop-match-N-<estado>`) y se devuelve ademas el borde, que es lo que
      // el usuario ve: un id sin borde no es una fila marcada. El titulo sale del primer
      // <p> del acordeon, que es lo que Twitch escribe ahi.
      const marcados = Array.from(doc.querySelectorAll('[id^="drop-match-"]')).map(el => {
        const p = el.querySelector('p[class^="CoreText-sc"]');
        // El borde no lo lleva el nodo del id sino un antepasado, asi que se busca hacia
        // arriba en vez de darlo por hecho en un nivel fijo.
        let borde = '';
        for (let n = el; n && n !== doc.body; n = n.parentElement) {
          if (n.style && n.style.borderColor) { borde = n.style.borderColor; break; }
        }
        return {
          titulo: p ? (p.textContent || '').trim() : '',
          id: el.id,
          borde,
          // La marca de coste/urgencia que el escaneo cuelga al lado del titulo.
          marcaPagina: !!el.querySelector('.twitch-drop-page-mark')
        };
      });
      // LAS TARJETAS DEL PANEL, con su imagen. Es el mismo volcado que se hace a mano en
      // la consola del navegador (titulo -> src del <img>), y se lee igual: una tarjeta
      // sin <img> es la que se queda con el marco vacio.
      const tarjetas = Array.from(doc.querySelectorAll('#twitch-drops-panel [data-notif-title]'))
        .map(c => {
          const i = c.querySelector('img');
          return { titulo: c.getAttribute('data-notif-title'), img: i ? i.src : null };
        });
      resolve({ camps, totalX: xs.length, chips, marcados, tarjetas, marcasPuestas: escaneos, pedidas, w, dom });
    };

    // CUANTAS VECES HA ESCANEADO. Cada pasada del escaneo borra y vuelve a poner las
    // marcas de pagina, asi que contar sus inserciones es contar escaneos. Hace falta para
    // descartar el fallo que ya costo un rato en Kick: un observer que se dispara con su
    // propio trabajo y re-escanea en bucle. Un numero sano es «uno por cambio provocado»;
    // una decena es el bucle.
    let escaneos = 0;
    new w.MutationObserver(muts => {
      for (const m of muts) for (const nodo of m.addedNodes) {
        if (nodo.nodeType === 1 && nodo.classList && nodo.classList.contains('twitch-drop-page-mark')) escaneos++;
      }
    }).observe(w.document.body, { childList: true, subtree: true });

    if (lateHtml) {
      setTimeout(() => {
        // Se AÑADE, no se sustituye: montar la lista no borra lo que ya habia.
        const cont = w.document.createElement('div');
        cont.innerHTML = lateHtml;
        while (cont.firstChild) w.document.body.appendChild(cont.firstChild);
      }, lateMs);
    }

    if (clicarX !== null) {
      setTimeout(() => {
        const xs = w.document.querySelectorAll('a[data-drop-own-tip]');
        if (xs[clicarX]) xs[clicarX].dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
      }, waitMs - 1500);
    }
    setTimeout(informe, waitMs);
  });
}
// `readFixture` para los tests que traen su propio volcado. Se lee desde aqui para que la
// ruta viva en un solo sitio.
function readFixture(f) { return fs.readFileSync(path.join(__dirname, f), 'utf8'); }

module.exports = { run, readFixture };
