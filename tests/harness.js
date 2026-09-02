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
function run({ borrados = [], waitMs = 8000, clicarX = null, gql = null } = {}) {
  return new Promise(resolve => {
    const vc = new VirtualConsole();
    vc.on('jsdomError', () => {});
    const dom = new JSDOM(`<!DOCTYPE html><html lang="es"><body>${DUMP}</body></html>`, {
      url: 'https://www.twitch.tv/drops/inventory',
      runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc
    });
    const w = dom.window;
    const store = new Map([
      ['twitch_show_hide_inventory_expired', true],
      ['twitch_inventory_deleted_drops', JSON.stringify(borrados)],
      ['twitch_drop_keywords', JSON.stringify(['pokemon','marvel','squadra','sorcerer','rust'])]
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
      resolve({ camps, totalX: xs.length, chips, pedidas, w, dom });
    };

    if (clicarX !== null) {
      setTimeout(() => {
        const xs = w.document.querySelectorAll('a[data-drop-own-tip]');
        if (xs[clicarX]) xs[clicarX].dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
      }, waitMs - 1500);
    }
    setTimeout(informe, waitMs);
  });
}
module.exports = { run };
