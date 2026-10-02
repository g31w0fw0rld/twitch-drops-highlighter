// QUITAR LA CASILLA DEVUELVE LO ESCONDIDO SIN RECARGAR LA PAGINA.
//
// Pedido el 2026-10-01: en Twitch, quitar «ocultar cerrados/completados» recargaba la
// pagina entera, y en la pestaña de campañas de Kick no. Ahora tampoco aqui: lo que la
// casilla escondio lleva su motivo apuntado, y `_sigueCuadrando` sabe que baldosa y
// caducada dependen de ella, asi que el repaso de siempre las devuelve.
//
// Tres casos, uno por motivo, porque cada uno tiene que salir distinto:
//   A. baldosa  (el tramo al 100 % del volcado de emblema) — vuelve, y al poner la
//      casilla otra vez se esconde de nuevo;
//   B. caducada (la campaña que la API da por cerrada)     — vuelve;
//   C. descartada (la ✕)                                    — se QUEDA escondida: no es
//      de la casilla. Sin este caso, «devolverlo todo» pasaria A y B igual.
//
// CONTROL DE SENSIBILIDAD:
//     git show HEAD:twitch-drops-highlighter.user.js > /tmp/pub.js
//     TW_SCRIPT=/tmp/pub.js node tests/test-desmarcar-casilla-sin-recargar.js
// Con 1.3.23 la casilla llama a location.reload(), que jsdom no implementa: A y B se
// quedan escondidas. (C pasa ahi por construccion; su control es el propio A/B.)
//
// Lo que NO cubre: el barrido ya en marcha que deja de reclamar al quitar la casilla
// (`modo` en cleanInventory). Pedirlo exige quitarla dentro de los primeros ~500 ms tras
// el arranque, y el arnes no da ese instante con precision.
const fs = require('fs');
const path = require('path');
const { run, readFixture } = require('./harness');

const EMBLEMA = readFixture('fixture-inventario-emblema.html');
const CADUCADA = fs.readFileSync(path.join(__dirname, 'fixture-inventario-campana-caducada.html'), 'utf8');
const ID_POKEMON = '92f516f7-f6d5-4fa6-909a-48c5b94d2a43';

// La campaña cerrada para el caso B, igual que en test-inventario-campana-caducada.
const CAMP = 'afe7cb0a-2c43-41a9-864f-d5b1a7263b86';
const DIA = 24 * 60 * 60 * 1000;
const cuando = (dias) => new Date(Date.now() + dias * DIA).toISOString();
const gqlCaducada = {
    ViewerDropsDashboard: [{ data: { currentUser: { id: '1', login: 'prueba', dropCampaigns: [{
        id: CAMP, name: 'PEC: Fall Finals 1_DAY3', status: 'EXPIRED',
        startAt: cuando(-2), endAt: cuando(2),
        game: { id: '493057', displayName: 'PUBG: BATTLEGROUNDS', boxArtURL: 'https://x/pubg.jpg' },
        owner: { id: 'o-pec', login: 'pubgesports', name: 'PUBG Esports', displayName: 'PUBG Esports' },
        self: { isAccountConnected: true }, image: { image1xURL: 'https://x/pec.png' }
    }] }, rewardCampaignsAvailableToUser: [] } }],
    Inventory: [{ data: { currentUser: { inventory: {
        dropCampaignsInProgress: [], gameEventDrops: [], earnedDropRewards: { edges: [] } } } } }],
    DropCampaignDetails: (cuerpo) => {
        const id = (((cuerpo || [])[0] || {}).variables || {}).dropID || '';
        return [{ data: { user: { id: 'o-pec', dropCampaign: { id, name: 'PEC: Fall Finals 1_DAY3',
            timeBasedDrops: [{ id: id + '-t0', name: 'PUBG Varsity Jacket', requiredMinutesWatched: 120,
                benefitEdges: [{ benefit: { id: id + '-b0', name: 'PUBG Varsity Jacket',
                    distributionType: 'DIRECT_ENTITLEMENT' } }] }] } } } }];
    }
};

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok   ' : '  FALLA') + ' ' + msg); if (!ok) fallos++; };
const espera = (w, ms) => new Promise(res => w.setTimeout(res, ms));
const escondidos = (w, porque) => Array.from(w.document.querySelectorAll('[data-twitch-drops-hidden="1"]'))
    .filter(n => !porque || n.getAttribute('data-twitch-drops-hidden-why') === porque);
// La casilla se cambia como la cambia el usuario: el valor y despues el evento `change`.
function ponerCasilla(w, valor) {
    const cb = w.document.getElementById('cb-hide-expired');
    if (!cb) return false;
    cb.checked = valor;
    cb.dispatchEvent(new w.Event('change', { bubbles: true }));
    return true;
}

(async () => {
    console.log('\n=== A. la baldosa cobrada vuelve, y se va otra vez ===');
    {
        const r = await run({ dump: EMBLEMA, waitMs: 9000, cargaUnica: true });
        const w = r.w;
        const antes = escondidos(w, 'baldosa').length;
        comprobar(antes > 0, 'con la casilla puesta hay baldosas escondidas — ' + antes);
        comprobar(ponerCasilla(w, false), 'la casilla esta en el panel');
        await espera(w, 1000);
        comprobar(escondidos(w, 'baldosa').length === 0, 'quitada: ninguna baldosa escondida — ' + escondidos(w, 'baldosa').length);
        comprobar(w.GM_getValue('twitch_show_hide_inventory_expired', null) === false, 'y el ajuste se guarda apagado');
        ponerCasilla(w, true);
        await espera(w, 6000);
        comprobar(escondidos(w, 'baldosa').length === antes, 'puesta otra vez: vuelven a esconderse — ' + escondidos(w, 'baldosa').length + ' de ' + antes);
    }

    console.log('\n=== B. la campaña caducada vuelve ===');
    {
        const r = await run({ dump: CADUCADA, waitMs: 12000, cargaUnica: true, keywords: ['pubg'], gql: gqlCaducada });
        const w = r.w;
        comprobar(escondidos(w, 'caducada').length === 1, 'con la casilla puesta, la caducada esta escondida — ' + escondidos(w, 'caducada').length);
        ponerCasilla(w, false);
        await espera(w, 1000);
        comprobar(escondidos(w, 'caducada').length === 0, 'quitada: vuelve a la vista — ' + escondidos(w, 'caducada').length);
        // Y no la vuelve a esconder nadie: el observador sigue puesto y el barrido puede
        // seguir vivo, y los dos pasan por `_esconderCampañasCaducadas`.
        await espera(w, 3000);
        comprobar(escondidos(w, 'caducada').length === 0, 'y sigue a la vista 3 s despues');
    }

    console.log('\n=== C. lo descartado con la ✕ se queda escondido ===');
    {
        const r = await run({ borrados: [ID_POKEMON], waitMs: 8000, cargaUnica: true });
        const w = r.w;
        comprobar(escondidos(w, 'descartada').length === 1, 'la campaña descartada esta escondida — ' + escondidos(w, 'descartada').length);
        ponerCasilla(w, false);
        await espera(w, 1500);
        comprobar(escondidos(w, 'descartada').length === 1, 'quitar la casilla no la devuelve — ' + escondidos(w, 'descartada').length);
    }

    console.log(fallos === 0 ? '\nTODO EN VERDE' : '\n' + fallos + ' COMPROBACIONES EN ROJO');
    process.exit(fallos === 0 ? 0 : 1);
})();
