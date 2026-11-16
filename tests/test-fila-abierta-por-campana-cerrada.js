// UNA CAMPAÑA CERRADA NO PUEDE METER EN ABIERTOS LA FILA DE SU JUEGO.
//
// Reportado el 2026-11-15 con League of Legends: la tarjeta salia en «Drops Abiertos» con el
// chip `twitch` y SIN NINGUNA recompensa. Medido ese dia en la cache de la pagina, el juego
// tenia cuatro campañas:
//
//   · «Worlds - Sub Drop Pt. 2»  Riot Games     ACTIVE   (Hero Teemo, por suscripcion)
//   · «Worlds 2026 Chat Badge»   Twitch Gaming  EXPIRED  ese mismo dia, 18:59 UTC
//   · «K/DA Chat Badge»          Twitch Gaming  EXPIRED  ese mismo dia, 15:59 UTC
//   · «Worlds 2026 Co-Streams»   Riot Games     EXPIRED
//
// Las de Twitch Gaming casaban por `twitch`; la unica abierta no casa con nada. La fila
// abierta del juego no casa por su texto («League of Legends» / «Riot Games»), asi que el
// escaneo le preguntaba a la API (`_apiEntryForCard`), y esa buscaba en las abiertas Y EN
// LAS CERRADAS: por el id del juego encontraba la entrada cerrada y la fila entraba con su
// chip. Pero las recompensas de una tarjeta abierta salen solo de las abiertas, y alli el
// juego no tenia nada.
//
// EL CONTROL POSITIVO es Rust: su fila tampoco casa por el texto, pero su campaña abierta si
// (por el owner, Twitch Gaming), asi que tiene que seguir entrando por la API. Sin el, «la
// fila de LoL ya no entra» lo cumpliria tambien un arreglo que apagara la consulta a la API
// entera, que es lo que arreglo «OneState - Chillbase» en 1.2.20.
//
// Control negativo (tiene que salir en ROJO con el codigo publicado):
//   git show HEAD:twitch-drops-highlighter.user.js > /tmp/pub.js
//   TW_SCRIPT=/tmp/pub.js node tests/test-fila-abierta-por-campana-cerrada.js
const { run } = require('./harness');

const LOL = { id: '21779', displayName: 'League of Legends', boxArtURL: 'https://static-cdn.jtvnw.net/ttv-boxart/21779-{width}x{height}.jpg' };
const RUST = { id: '263490', displayName: 'Rust', boxArtURL: 'https://static-cdn.jtvnw.net/ttv-boxart/263490-{width}x{height}.jpg' };

const campaña = (id, nombre, juego, owner, status, endAt) => ({
    id, name: nombre, status,
    startAt: '2026-10-14T19:00:00Z', endAt,
    game: juego,
    owner: { id: 'o-' + id, login: owner.toLowerCase().replace(/\s+/g, ''), name: owner, displayName: owner },
    self: { isAccountConnected: false },
    image: { image1xURL: 'https://x/campaign-' + id + '.png' }
});

const ayer = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
const SUB_DROP = campaña('53c80198-sub-drop-pt2', 'Worlds - Sub Drop Pt. 2', LOL, 'Riot Games', 'ACTIVE', '2099-12-01T17:59:59.999Z');
const CHAT_BADGE = campaña('worlds-2026-chat-badge', 'Worlds 2026 Chat Badge', LOL, 'Twitch Gaming', 'EXPIRED', ayer);
const RUST_DROPS = campaña('rust-twitch-drops-0001', 'Rust Twitch Drops', RUST, 'Twitch Gaming', 'ACTIVE', '2099-12-01T17:59:59.999Z');

const premios = {
    '53c80198-sub-drop-pt2': [{ n: 'Hero Teemo', min: 0, subs: 1 }],
    'worlds-2026-chat-badge': [{ n: 'Worlds 2026 Chat Badge', min: 30, subs: 0 }],
    'rust-twitch-drops-0001': [{ n: 'Twitch Hoodie', min: 120, subs: 0 }]
};

const detallesDe = (cuerpo) => {
    const id = (((cuerpo || [])[0] || {}).variables || {}).dropID || '';
    return [{
        data: { user: { id: 'o-' + id, dropCampaign: {
            id, name: id,
            timeBasedDrops: (premios[id] || []).map((p, i) => ({
                id: id + '-tramo-' + i, name: p.n,
                requiredMinutesWatched: p.min, requiredSubs: p.subs,
                benefitEdges: [{ benefit: { id: id + '-b' + i, name: p.n, distributionType: 'DIRECT_ENTITLEMENT' } }]
            }))
        } } }
    }];
};

const dashboard = [{
    data: {
        currentUser: { id: '1', login: 'prueba', dropCampaigns: [SUB_DROP, CHAT_BADGE, RUST_DROPS] },
        rewardCampaignsAvailableToUser: []
    }
}];

const inventory = [{
    data: { currentUser: { inventory: {
        dropCampaignsInProgress: [], gameEventDrops: [], earnedDropRewards: { edges: [] }
    } } }
}];

// Las dos cabeceras de acordeon de la seccion de campañas ABIERTAS, con el marcado de las de
// fixture-campanas-recompensas.html (dos <p>: juego y estudio) y la caratula del juego, que
// es lo que lleva el id con el que se cruza la API.
const fila = (juego, estudio, idJuego) => `
<div class="Layout-sc-1xcs6mc-0"><div class="Layout-sc-1xcs6mc-0"><div class="Layout-sc-1xcs6mc-0 fMGFlt accordion-header" role="heading" aria-level="3"><button class="ScInteractableBase-sc-ofisyf-0 tw-interactable" aria-expanded="false"><div class="Layout-sc-1xcs6mc-0 ScAccordionHeaderContents-sc-5sm2jx-0"><div class="Layout-sc-1xcs6mc-0 ScAccordionHeaderImageContainer-sc-5sm2jx-1"><div class="Layout-sc-1xcs6mc-0"><div class="ScAspectRatio-sc-18km980-1 tw-aspect"><img alt="${juego}" class="partner-thumbnail tw-image" src="https://static-cdn.jtvnw.net/ttv-boxart/${idJuego}-120x160.jpg"></div></div></div><div class="Layout-sc-1xcs6mc-0"><div class="Layout-sc-1xcs6mc-0"><p class="CoreText-sc-1txzju1-0 dvalrg">${juego}</p><p class="CoreText-sc-1txzju1-0 dmGDNu">${estudio}</p></div></div><div class="Layout-sc-1xcs6mc-0 bkUUaS">vie 6 de nov, 12:00 p.m. - mar 1 de dic, 11:59 a.m. GMT-6</div></div></button></div></div></div>`;

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok    ' : '  FALLA ') + msg); if (!ok) fallos++; };

(async () => {
    const r = await run({
        url: 'https://www.twitch.tv/drops/campaigns',
        dump: fila('League of Legends', 'Riot Games', '21779') + fila('Rust', 'Facepunch Studios', '263490'),
        keywords: ['twitch'],
        waitMs: 14000,
        gql: { ViewerDropsDashboard: dashboard, Inventory: inventory, DropCampaignDetails: detallesDe }
    });

    const marcadas = (r.marcados || []).map(m => m.titulo);
    const abiertas = (r.chips || []).map(c => c.titulo);
    const todas = (r.tarjetas || []).map(c => c.titulo);
    console.log('  filas marcadas  :', JSON.stringify(marcadas));
    console.log('  panel, abiertos :', JSON.stringify((r.chips || []).map(c => ({ t: c.titulo, premios: c.badges.map(b => b.texto) }))));
    console.log('  panel, todas    :', JSON.stringify(todas));

    // El control positivo primero: si este cae, lo de abajo no prueba nada.
    comprobar(marcadas.includes('Rust'), 'la fila de Rust entra por su campaña abierta (control positivo)');
    const rust = (r.chips || []).find(c => /^rust\b/i.test(c.titulo || ''));
    comprobar(!!rust && rust.badges.some(b => /Twitch Hoodie/.test(b.texto)),
        'y su tarjeta abierta enseña su recompensa');

    comprobar(!marcadas.includes('League of Legends'),
        'la fila abierta de LoL NO se marca: lo que casaba de su juego ya cerró');
    const lolAbierta = (r.chips || []).find(c => /league of legends/i.test(c.titulo || ''));
    comprobar(!lolAbierta, 'ni sale en Abiertos' + (lolAbierta
        ? ` (sale como «${lolAbierta.titulo}» con ${lolAbierta.badges.length} recompensas)` : ''));
    comprobar(todas.some(t => /league of legends/i.test(t || '')),
        'LoL sigue en el panel, en Cerrados, por su campaña de Twitch Gaming');

    console.log(fallos ? `\n  ${fallos} FALLAN` : '\n  todo en verde');
    process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
