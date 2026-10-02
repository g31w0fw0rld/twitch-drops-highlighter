// «RECARGAR DROPS» RECARGA Y NADA MAS; LO QUE BORRA VA EN SU PROPIO BOTON.
//
// Pedido el 2026-10-01. Hasta 1.3.23 «Recargar drops» vaciaba ademas la lista de avisos y
// la de descartados con la ✕. Lo segundo devolvia al inventario lo que habias quitado a
// mano; lo primero era peor de lo que parece: con la lista vacia, el siguiente escaneo da
// por NUEVA cada campaña que casa con tus keywords, asi que recargar volvia a poner un 🔔
// en todas. Ahora eso lo hace «Restablecer alertas y ocultos», y solo tras confirmar.
//
// Se mira el ALMACEN (GM_getValue), no el DOM: lo que importa es si se borra el dato, y el
// repintado tras recargar no existe en jsdom (location.reload no esta implementado).
//
// CONTROL DE SENSIBILIDAD:
//     git show HEAD:twitch-drops-highlighter.user.js > /tmp/pub.js
//     TW_SCRIPT=/tmp/pub.js node tests/test-boton-recargar-no-borra.js
// Con 1.3.23, pulsar «Recargar drops» vacia las dos listas y el boton nuevo no existe.
const { run } = require('./harness');

const AYER = new Date(Date.now() - 86400e3).toISOString();
const MAÑANA = new Date(Date.now() + 86400e3).toISOString();
const dashboard = [{
    data: {
        currentUser: {
            id: '1', login: 'prueba',
            dropCampaigns: [{
                id: 'f00dbabe-6666-4c2a-9a01-000000000006', name: 'Temporada de prueba', status: 'ACTIVE',
                startAt: AYER, endAt: MAÑANA,
                game: { id: '30921', displayName: 'Rocket League' },
                owner: { id: '9', name: 'Epic Games', login: 'epicgames' }
            }]
        },
        rewardCampaignsAvailableToUser: []
    }
}];
const detalles = [{ data: { user: { dropCampaign: { id: 'f00dbabe-6666-4c2a-9a01-000000000006', timeBasedDrops: [{
    id: 'drop-1', name: 'Casco', requiredMinutesWatched: 60,
    benefitEdges: [{ benefit: { id: 'bene-1', name: 'Casco', distributionType: 'DIRECT_ENTITLEMENT' } }]
}] } } } }];

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok   ' : '  FALLA') + ' ' + msg); if (!ok) fallos++; };
const espera = (w, ms) => new Promise(res => w.setTimeout(res, ms));
const clic = (w, n) => n.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
const botonDelPanel = (w, texto) => Array.from(w.document.querySelectorAll('#twitch-drops-panel button'))
    .find(b => (b.textContent || '').trim() === texto);
const botonDelModal = (w, texto) => Array.from(w.document.querySelectorAll('button'))
    .filter(b => !b.closest('#twitch-drops-panel'))
    .find(b => (b.textContent || '').trim() === texto);
const lista = (w, clave) => { try { return JSON.parse(w.GM_getValue(clave, '[]')) || []; } catch (e) { return []; } };
const avisos = (w) => lista(w, 'twitch_drop_notifications').length;
const descartados = (w) => lista(w, 'twitch_inventory_deleted_drops');

(async () => {
    const r = await run({
        cargaUnica: true, waitMs: 8000, ocultarCerrados: false,
        keywords: ['rocket league'],
        borrados: ['drop-descartado-a-mano'],
        gql: { ViewerDropsDashboard: dashboard, DropCampaignDetails: detalles }
    });
    const w = r.w;

    console.log('\n=== el punto de partida ===');
    // Sin esto, «no se borra» pasaria con dos listas que ya estaban vacias.
    comprobar(avisos(w) > 0, 'hay avisos guardados — ' + avisos(w));
    comprobar(descartados(w).includes('drop-descartado-a-mano'), 'y un descartado con la ✕');

    console.log('\n=== «Recargar drops» ===');
    const recargar = botonDelPanel(w, 'Recargar drops');
    comprobar(!!recargar, 'el boton esta en el panel');
    const antes = avisos(w);
    if (recargar) clic(w, recargar);
    await espera(w, 500);
    comprobar(avisos(w) === antes, 'no toca los avisos — ' + avisos(w) + ' de ' + antes);
    comprobar(descartados(w).includes('drop-descartado-a-mano'), 'ni los descartados');

    console.log('\n=== «Restablecer alertas y ocultos», diciendo que no ===');
    const reset = botonDelPanel(w, 'Restablecer alertas y ocultos');
    comprobar(!!reset, 'el boton nuevo esta en el panel');
    if (reset) clic(w, reset);
    await espera(w, 300);
    const no = botonDelModal(w, 'No');
    comprobar(!!no, 'pregunta antes de borrar');
    if (no) clic(w, no);
    await espera(w, 1000);
    comprobar(avisos(w) === antes && descartados(w).length === 1, 'con «No» no se borra nada');

    console.log('\n=== «Restablecer alertas y ocultos», diciendo que si ===');
    if (reset) clic(w, reset);
    await espera(w, 300);
    const si = botonDelModal(w, 'Si');
    comprobar(!!si, 'vuelve a preguntar');
    if (si) clic(w, si);
    await espera(w, 1000);
    comprobar(avisos(w) === 0, 'vacia los avisos — ' + avisos(w));
    comprobar(descartados(w).length === 0, 'y devuelve los descartados — ' + JSON.stringify(descartados(w)));

    console.log(fallos === 0 ? '\nTODO EN VERDE' : '\n' + fallos + ' COMPROBACIONES EN ROJO');
    process.exit(fallos === 0 ? 0 : 1);
})();
