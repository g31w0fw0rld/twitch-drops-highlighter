// AL LLEGAR DESDE UNA TARJETA DEL PANEL, EL PANEL VUELVE A ESA TARJETA.
//
// Pedido el 2026-10-02. Pulsar en el panel una campaña estando en el inventario te lleva
// a campañas y enfoca la campaña en la pagina, pero el panel se reconstruye con el cambio
// de pagina: la lista vuelve arriba y a la solapa que toque —🔔 si hay avisos—, y la
// tarjeta que pulsaste ya no esta delante. Ahora el panel abre su solapa, la desplaza
// hasta ella y la marca.
//
// Se arranca en /drops/campaigns con el destino YA apuntado en el almacen, que es lo que
// deja el clic de la pagina anterior (la navegacion en si no existe en jsdom).
//
// Lo que NO se puede comprobar aqui es el desplazamiento: jsdom no hace layout y todas las
// medidas dan 0. Se comprueba la solapa abierta y la marca, que es lo que decide si la
// tarjeta esta delante; la cuenta del scroll es aritmetica sobre esas medidas.
//
//   A. desde una tarjeta abierta: su solapa delante —aunque haya avisos, que de otro modo
//      se llevarian el panel a 🔔— y la tarjeta marcada;
//   B. control: el mismo destino SIN la marca de «vino del panel» (es el del 👁️ de una
//      notificacion) deja el panel como siempre, en 🔔 y sin marcar nada. Es lo que
//      demuestra que A no sale verde por casualidad;
//   C. tocar el panel suelta el foco: el siguiente repintado ya no lo repone;
//   D. desde una tarjeta CERRADA: se abre la solapa de cerrados;
//   E. el destino trae otro estudio que la tarjeta: se cruza por el juego.
//
// CONTROL DE SENSIBILIDAD:
//     git show HEAD:twitch-drops-highlighter.user.js > /tmp/pub.js
//     TW_SCRIPT=/tmp/pub.js node tests/test-foco-panel-tras-navegar.js
// Con 1.3.23 A y D fallan: el panel se queda en 🔔 y no marca ninguna tarjeta.
// C pasa ahi por construccion —sin foco no hay nada que soltar—; su control es una COPIA
// con el oyente vaciado:
//     sed "s/panel.addEventListener(ev, _soltarFocoPanel, { passive: true }));/panel.addEventListener(ev, () => {}, { passive: true }));/" \
//         twitch-drops-highlighter.user.js > /tmp/sin-soltar.js
// y ahi C sale con la marca puesta y repuesta tras el repintado.
const { run } = require('./harness');

const dia = 864e5, ahora = Date.now(), iso = ms => new Date(ms).toISOString();
const campaña = (id, nombre, juego, gameId, estado, fin) => ({
    id, name: nombre, status: estado, startAt: iso(ahora - 5 * dia), endAt: iso(fin),
    game: { id: gameId, displayName: juego },
    owner: { id: '9', name: 'Estudio', login: 'estudio' }
});
const dashboard = [{
    data: {
        currentUser: {
            id: '1', login: 'prueba',
            dropCampaigns: [
                campaña('c-rust', 'Temporada Rust', 'Rust', '263490', 'ACTIVE', ahora + 5 * dia),
                campaña('c-halo', 'Temporada Halo', 'Halo Infinite', '506416', 'ACTIVE', ahora + 5 * dia),
                campaña('c-doom', 'Temporada Doom', 'DOOM', '6751', 'EXPIRED', ahora - dia)
            ]
        },
        rewardCampaignsAvailableToUser: []
    }
}];
const detalles = (cuerpo) => {
    const id = (((cuerpo || [])[0] || {}).variables || {}).dropID || '';
    return [{ data: { user: { dropCampaign: { id, timeBasedDrops: [{
        id: id + '-t', name: 'Premio ' + id, requiredMinutesWatched: 60,
        benefitEdges: [{ benefit: { id: id + '-b', name: 'Premio ' + id, distributionType: 'DIRECT_ENTITLEMENT' } }]
    }] } } } }];
};
const inventario = [{ data: { currentUser: { inventory: {
    dropCampaignsInProgress: [], gameEventDrops: [], earnedDropRewards: { edges: [] } } } } }];

const destino = (title, status, panel) => JSON.stringify({ title, status, panel, ts: Date.now() });
const arrancar = (almacen) => run({
    url: 'https://www.twitch.tv/drops/campaigns', dump: '<div></div>',
    cargaUnica: true, waitMs: 9000, ocultarCerrados: false,
    keywords: ['rust', 'halo', 'doom'],
    almacen,
    gql: { ViewerDropsDashboard: dashboard, DropCampaignDetails: detalles, Inventory: inventario }
});

const visible = (w, id) => { const p = w.document.getElementById(id); return !!p && p.style.display !== 'none'; };
const marcadas = (w) => Array.from(w.document.querySelectorAll('[data-panel-focus]'))
    .map(c => c.getAttribute('data-notif-title'));
const espera = (w, ms) => new Promise(res => w.setTimeout(res, ms));

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok   ' : '  FALLA') + ' ' + msg); if (!ok) fallos++; };

(async () => {
    console.log('\n=== A. desde una tarjeta abierta del panel ===');
    {
        const r = await arrancar({ twitch_drops_focus_target: destino('Halo Infinite - Estudio', 'active', true) });
        const w = r.w;
        const avisos = JSON.parse(w.GM_getValue('twitch_drop_notifications', '[]')).filter(n => !n.seen && n.changed).length;
        comprobar(avisos > 0, 'hay avisos pendientes, que normalmente se llevarian el panel a 🔔 — ' + avisos);
        comprobar(visible(w, 'twitch-drops-active-pane'), 'la solapa de abiertos esta delante');
        comprobar(!visible(w, 'twitch-drops-notifs-pane'), 'y la de 🔔 no');
        comprobar(JSON.stringify(marcadas(w)) === JSON.stringify(['Halo Infinite - Estudio']),
            'la tarjeta de Halo esta marcada, y solo ella — ' + JSON.stringify(marcadas(w)));
        comprobar(w.GM_getValue('twitch_drops_focus_target', null) === null, 'el destino se consumio');

        console.log('\n=== C. tocar el panel suelta el foco ===');
        w.document.getElementById('twitch-drops-panel').dispatchEvent(new w.Event('mousedown', { bubbles: true }));
        comprobar(marcadas(w).length === 0, 'al tocarlo se quita la marca');
        // Un repintado de verdad: el filtro de vista llama a _rerenderPanes.
        const chip = w.document.querySelector('.twitch-view-filter');
        if (chip) chip.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
        await espera(w, 300);
        comprobar(!!chip, 'hay un filtro con el que provocar el repintado');
        comprobar(marcadas(w).length === 0, 'y el repintado ya no la repone');
    }

    console.log('\n=== B. control: el mismo destino sin venir del panel ===');
    {
        const r = await arrancar({ twitch_drops_focus_target: destino('Halo Infinite - Estudio', 'active', false) });
        comprobar(visible(r.w, 'twitch-drops-notifs-pane'), 'el panel se queda en 🔔, como siempre');
        comprobar(marcadas(r.w).length === 0, 'y no se marca ninguna tarjeta');
    }

    console.log('\n=== D. desde una tarjeta cerrada ===');
    {
        const r = await arrancar({ twitch_drops_focus_target: destino('DOOM - Estudio', 'expired', true) });
        comprobar(visible(r.w, 'twitch-drops-expired-pane'), 'la solapa de cerrados esta delante');
        comprobar(JSON.stringify(marcadas(r.w)) === JSON.stringify(['DOOM - Estudio']),
            'la tarjeta de DOOM esta marcada — ' + JSON.stringify(marcadas(r.w)));
    }

    // E. EL TITULO NO COINCIDE, que es lo normal entre paginas: la tarjeta que pulsaste
    // pudo salir del DOM de la otra pagina con el estudio que imprime Twitch, y aqui la
    // pinta la API con el `owner.name`. Se cruza por el juego, si en la solapa hay uno solo.
    console.log('\n=== E. el destino lleva otro estudio que la tarjeta ===');
    {
        const r = await arrancar({ twitch_drops_focus_target: destino('Rust - Facepunch Studios', 'active', true) });
        comprobar(JSON.stringify(marcadas(r.w)) === JSON.stringify(['Rust - Estudio']),
            'se marca la tarjeta de Rust por el juego — ' + JSON.stringify(marcadas(r.w)));
    }

    console.log(fallos === 0 ? '\nTODO EN VERDE' : '\n' + fallos + ' COMPROBACIONES EN ROJO');
    process.exit(fallos === 0 ? 0 : 1);
})();
