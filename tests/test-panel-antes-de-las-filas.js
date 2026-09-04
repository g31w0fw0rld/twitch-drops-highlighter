// EL PANEL SE LLENA ANTES DE QUE LAS FILAS ESTEN MONTADAS, Y NO SE VUELVE A LLENAR.
//
// Reportado el 2026-09-04: cargando de cero en /drops/inventory y cambiando a
// /drops/campaigns, la tarjeta de Pokemon del panel se queda SIN imagen. Y al volver a
// mirarlo otro dia salia bien, o sea que es intermitente — que es la firma de una carrera,
// no de una URL mala.
//
// Lo que se midio en el navegador y lo explica: en el flujo que falla el panel trae 21
// tarjetas, 20 con URLs `-120x160` (el tamaño que usa la PAGINA, o sea del DOM) y la de
// Pokemon como unica de la API, titulada «Pokémon» a secas en vez de «Pokémon - Pokemon».
// Cargando directo en campañas sale «Pokémon - Pokemon» con su imagen. Son DOS entradas
// distintas para la misma campaña, y cual gana depende de si la fila estaba montada.
//
// Aqui se pone ese orden a proposito: el panel arranca sin filas —solo con lo que da la
// API— y las filas aparecen despues. Si nadie vuelve a escanear, la tarjeta se queda con la
// entrada de la API para siempre.
const { run, readFixture } = require('./harness');

const dia = 864e5, ahora = Date.now(), iso = ms => new Date(ms).toISOString();

// La reward campaign tal y como la devuelve Twitch para esta: SIN `game` y SIN `brand`, que
// es lo que hace que su clave sea «Pokémon» a secas y no «Pokémon - <juego>». Es la unica
// forma en que las dos identidades pueden dejar de reconocerse.
const dashboard = [{
    data: {
        currentUser: { id: '1', login: 'prueba', dropCampaigns: [] },
        rewardCampaignsAvailableToUser: [{
            id: 'rc-pokemon', name: 'Pokémon',
            startsAt: iso(ahora - dia), endsAt: iso(ahora + 20 * dia),
            // La imagen que da la API. En jsdom no carga ninguna, asi que lo que se mira no
            // es si esta URL sirve: es QUE ENTRADA gana la tarjeta.
            imageURL: 'https://static-cdn.jtvnw.net/twitch-quests-assets/CAMPAIGN/rota.png',
            rewardGroups: [{
                unlockRequirements: { minuteWatchedGoal: 20 },
                rewards: [{ id: 'r1', name: 'Great Ball' }]
            }]
        }]
    }
}];

const inventory = [{
    data: { currentUser: { inventory: { dropCampaignsInProgress: [], gameEventDrops: [], earnedDropRewards: { edges: [] } } } }
}];

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok    ' : '  FALLA ') + msg); if (!ok) fallos++; };

(async () => {
    const r = await run({
        url: 'https://www.twitch.tv/drops/campaigns',
        // El panel arranca SIN filas: es el estado en el que React todavia no ha montado la
        // lista. Un <div> vacio y nada mas.
        dump: '<div class="Layout-sc-1xcs6mc-0"></div>',
        gql: { ViewerDropsDashboard: dashboard, Inventory: inventory },
        keywords: ['pokemon'],
        // Y las filas llegan DESPUES, con el panel ya pintado.
        lateHtml: readFixture('fixture-campanas-recompensas.html'), lateMs: 6000,
        waitMs: 18000
    });

    const titulos = (r.tarjetas || []).map(t => t.titulo);
    console.log('  tarjetas del panel:', JSON.stringify(r.tarjetas));
    console.log('  filas marcadas    :', JSON.stringify((r.marcados || []).map(m => m.titulo)));

    // LO QUE DECIDE: cual de las dos identidades se queda con la tarjeta. La de la fila trae
    // el sufijo del estudio; la de la API va a secas.
    comprobar(titulos.includes('Pokémon - Pokemon'),
        'la tarjeta acaba siendo la de la FILA («Pokémon - Pokemon»)');
    comprobar(!titulos.includes('Pokémon'),
        'y no la de la API a secas («Pokémon»), que es la que se queda sin imagen');

    // Y la fila, ademas, tiene que quedar marcada: si el escaneo nunca volvio a pasar, no lo
    // esta. Va aparte porque distingue «no se re-escaneo» de «se re-escaneo y el panel no se
    // repinto», que son dos arreglos distintos.
    comprobar((r.marcados || []).some(m => m.titulo === 'Pokémon'),
        'la fila que llego tarde queda marcada en la pagina');

    // Y QUE EL VIGILANTE NO SE VEA A SI MISMO. El escaneo borra y repone las marcas de
    // pagina, asi que si el observer contara eso como «filas nuevas» re-escanearia para
    // siempre. Se cuentan las marcas puestas: dos filas por pasada, y aqui hay dos pasadas
    // como mucho (la del sondeo y la del DOM tardio). Una decena seria el bucle.
    console.log('  marcas de pagina puestas:', r.marcasPuestas);
    comprobar(r.marcasPuestas >= 1, 'el escaneo llego a pasar');
    comprobar(r.marcasPuestas <= 6, 'y NO re-escanea en bucle viendose a si mismo');

    console.log(fallos === 0 ? '\nTODO EN VERDE' : '\n' + fallos + ' COMPROBACIONES EN ROJO');
    process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
