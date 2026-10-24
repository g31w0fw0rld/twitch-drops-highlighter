// EL AVISO DE UN DROP DE CODIGO SE BORRA, COMO LOS DEMAS (2026-10-23).
//
// El script barre el centro de notificaciones de Twitch: en /drops/inventory, con la
// casilla de «ocultar cerrados/completados» puesta, abre la campana y borra todo aviso que
// diga «drop». Entre 1.3.20 y 1.3.31 el de un drop que se entrega como CODIGO se dejaba
// (pedido el 2026-09-22 con «Corrupted Creeper Cape», `distributionType: "CODE"`); el
// 2026-10-23 el usuario pidio volver a borrarlo, para dejar la campana limpia.
//
// El fixture trae tres avisos —uno que nombra la recompensa de codigo, otro que solo
// enseña su imagen y uno normal— y con la recompensa marcada `CODE` se tienen que borrar
// los tres. El reconocimiento se queda, pero solo para la linea de consola.
//
// Control negativo (tiene que salir en ROJO con el codigo publicado, que los dejaba):
//   git show HEAD:twitch-drops-highlighter.user.js > /tmp/pub.js
//   TW_SCRIPT=/tmp/pub.js node tests/test-notificacion-de-codigo.js
const { run, readFixture } = require('./harness');

const dashboard = [{
    data: { currentUser: { id: '1', login: 'prueba', dropCampaigns: [] }, rewardCampaignsAvailableToUser: [] }
}];

// El historial, con el nodo real. `tipo` cambia solo para el contraste.
const inventarioCon = (tipo) => [{
    data: { currentUser: { inventory: {
        dropCampaignsInProgress: [], gameEventDrops: [],
        earnedDropRewards: { edges: [
            { node: {
                id: '8cefb7b0-b228-11f1-9ea5-0a58a9feac02',
                earnedAt: '2026-09-21T21:27:55.194Z',
                status: 'CLAIMED',
                campaign: { id: '931cf994-acae-45e6-8796-dbc04e98371d' },
                item: {
                    id: '8cefb7b0-b228-11f1-9ea5-0a58a9feac02',
                    name: 'Corrupted Creeper Cape',
                    thumbnailURL: 'https://static-cdn.jtvnw.net/twitch-quests-assets/REWARD/07bed736-edcc-4d2b-b7f5-ef7709d6a971.png',
                    distributionType: tipo, pool: null
                }
            } }
        ] }
    } } }
}];

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok    ' : '  FALLA ') + msg); if (!ok) fallos++; };

const correr = (tipo) => run({
    dump: readFixture('fixture-notificaciones-drop.html'),
    gql: { ViewerDropsDashboard: dashboard, Inventory: inventarioCon(tipo) },
    espiaClics: 'button[data-test-selector="persistent-notification__delete"]',
    waitMs: 11000
});

(async () => {
    const r = await correr('CODE');
    // Se cuentan valores DISTINTOS y no clics: el arnes dispara `load` a mano y jsdom
    // dispara el suyo, asi que cada borrado se puede ver doble.
    const borradas = [...new Set(r.clicsEspiados || [])].sort();
    console.log('  notificaciones borradas:', JSON.stringify(borradas));

    comprobar(borradas.includes('normal'),
        'el aviso de un drop normal se sigue borrando (el barrido funciona)');
    comprobar(borradas.includes('codigo-nombre'),
        'el que NOMBRA la recompensa de codigo se borra tambien');
    comprobar(borradas.includes('codigo-imagen'),
        'y el que solo enseña su imagen, igual');

    console.log(fallos === 0 ? '\nTODO EN VERDE' : '\n' + fallos + ' COMPROBACIONES EN ROJO');
    process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
