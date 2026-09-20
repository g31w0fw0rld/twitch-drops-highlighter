// UN TORNEO REPARTE UNA CAMPAÑA POR DIA Y LAS LLAMA A TODAS IGUAL.
//
// El desempate por juego (ver test-enlace-canales-nombre-repetido) salva a los nombres
// corrientes que se repiten ENTRE juegos, pero no hace nada cuando el homonimo es del
// MISMO juego. Y eso no es un caso raro: el 2026-09-20, en el acordeon de Rocket League,
// «RL World Championship» era la campaña del dia 20 —la que la pagina estaba
// enseñando— y tambien la del 19 y la del 18, ya vencidas pero presentes en
// `ViewerDropsDashboard`. La clave `30921|rl world championship` guardaba `null` y ese
// enlace se quedaba sin filtrar: ni `dropID`, ni negrita, ni modal. Su vecina «RL Worlds
// Sub Drops», que si es unica, funcionaba — de ahi el reporte, otra vez, de que «la
// segunda campaña no se remarca».
//
// El volcado es el acordeon tal cual lo pego el usuario ese dia, con las marcas del
// propio script quitadas (el `dropID` que ya habia escrito en el primer enlace, su
// negrita y el borde del acordeon): lo que entra al test es el DOM de Twitch, no el
// resultado de una pasada anterior.
//
// Control negativo (tiene que salir en ROJO con el codigo publicado):
//   git show HEAD:twitch-drops-highlighter.user.js > /tmp/pub.js
//   TW_SCRIPT=/tmp/pub.js node tests/test-enlace-canales-torneo-diario.js
const { run, readFixture } = require('./harness');

const dia = 86400000, hora = 3600000, ahora = Date.now();
const iso = (t) => new Date(t).toISOString();
// Tiene que casar con la caratula del acordeon del volcado (`ttv-boxart/30921-...`).
const RL = '30921';
const camp = (id, name, desde, hasta, status) => ({
    id, name, status,
    startAt: iso(ahora + desde), endAt: iso(ahora + hasta),
    owner: { name: 'Epic Games', login: 'epicgames' },
    game: { id: RL, displayName: 'Rocket League' }
});

const dashboard = [{
    data: {
        currentUser: {
            id: '1', login: 'prueba',
            dropCampaigns: [
                camp('sub-drops-0001', 'RL Worlds Sub Drops', -5 * dia, 9 * dia, 'ACTIVE'),
                // La del dia, que es la que se ve en la pagina.
                camp('worlds-hoy-0002', 'RL World Championship', -3 * hora, 6 * hora, 'ACTIVE'),
                // Los dias anteriores del mismo torneo: mismo juego, mismo nombre.
                camp('worlds-ayer-0003', 'RL World Championship', -1 * dia, -8 * hora, 'EXPIRED'),
                camp('worlds-antier-004', 'RL World Championship', -2 * dia, -1 * dia, 'EXPIRED')
            ]
        },
        rewardCampaignsAvailableToUser: []
    }
}];
const detalles = [{ data: { user: { dropCampaign: { timeBasedDrops: [] } } } }];
const inventory = [{ data: { currentUser: { inventory: { dropCampaignsInProgress: [], gameEventDrops: [], earnedDropRewards: { edges: [] } } } } }];

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok    ' : '  FALLA ') + msg); if (!ok) fallos++; };

(async () => {
    const r = await run({
        url: 'https://www.twitch.tv/drops/campaigns',
        dump: readFixture('fixture-campanas-torneo-diario.html'),
        keywords: ['rocket'],
        waitMs: 12000,
        gql: { ViewerDropsDashboard: dashboard, DropCampaignDetails: detalles, Inventory: inventory }
    });

    const enlaces = [...r.w.document.querySelectorAll('a[href*="/directory/category/"]')]
        .map(a => a.getAttribute('href'));
    console.log('  enlaces de categoria:', JSON.stringify(enlaces, null, 1));

    comprobar(enlaces.length === 2, 'siguen siendo los dos enlaces del volcado');
    comprobar(enlaces.every(h => /[?&]dropID=/.test(h)),
        'los dos llevan id, tambien el de la campaña con homonimas en su propio juego');

    const ids = enlaces.map(h => (h.match(/dropID=([^&]+)/) || [])[1]);
    comprobar(ids[0] === 'sub-drops-0001', 'el primero sigue siendo el de «RL Worlds Sub Drops»');
    comprobar(ids[1] === 'worlds-hoy-0002',
        'y el segundo es la campaña de HOY, no una de las vencidas que se llaman igual');

    const marcados = r.w.document.querySelectorAll('a[data-drop-dir-filtered="1"]').length;
    comprobar(marcados === 2, 'los dos quedan marcados, que es lo que los pone en negrita');

    console.log(fallos ? `\n  ${fallos} FALLAN` : '\n  todo en verde');
    process.exit(fallos ? 1 : 0);
})();
