// EL AVISO DE UN DROP DE CODIGO NO SE BORRA.
//
// El script barre el centro de notificaciones de Twitch: en /drops/inventory, con la
// casilla de «ocultar cerrados/completados» puesta, abre la campana y borra todo aviso que
// diga «drop». Eso vale para los demas —lo que anuncian ya esta en tu inventario y ahi
// sigue— pero NO para un drop que se entrega como CODIGO: ahi el aviso ES el canje, y
// borrarlo es la unica forma que tiene este script de hacerte perder algo.
//
// Pedido el 2026-09-22 con «Corrupted Creeper Cape» (Minecraft). Lo que lo hace un dato y
// no una corazonada es el campo con el que Twitch lo dice, sacado de `earnedDropRewards`
// de la cuenta del usuario ese mismo dia:
//
//     item: { name: "Corrupted Creeper Cape", distributionType: "CODE",
//             thumbnailURL: ".../REWARD/07bed736-edcc-4d2b-b7f5-ef7709d6a971.png" }
//
// Es el MISMO campo que ya separa `EMOTE` y `BADGE` en el benefit de una campaña
// (AUTO_GRANTED_TYPES), o sea un solo enum en dos sitios.
//
// El aviso se reconoce por DOS señas independientes y basta una: el nombre escrito en su
// texto, y el uuid del asset de su imagen —que no se traduce—. El fixture trae una
// notificacion de cada clase para que se vea cual salva a cual.
//
// EL CONTROL NEGATIVO es la tercera notificacion, que dice «drop» y nada mas: esa SI se
// borra. Sin ella, «no se borra la del codigo» seria indistinguible de «se dejo de barrer».
//
// Y EL CONTRASTE, que es la otra mitad: el mismo DOM con el mismo historial pero con esa
// recompensa marcada `DIRECT_ENTITLEMENT` en vez de `CODE`. Ahi se borran las tres, que es
// lo que demuestra que quien las salva es el campo y no el texto del fixture.
//
// Control negativo (tiene que salir en ROJO con el codigo publicado):
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
    const borradas = r.clicsEspiados || [];
    console.log('  notificaciones borradas:', JSON.stringify(borradas));

    comprobar(borradas.includes('normal'),
        'el aviso de un drop normal se sigue borrando (el barrido funciona)');
    comprobar(!borradas.includes('codigo-nombre'),
        'el que NOMBRA la recompensa de codigo se queda');
    comprobar(!borradas.includes('codigo-imagen'),
        'y el que solo enseña su imagen tambien, aunque no la nombre');

    // EL CONTRASTE.
    const r2 = await correr('DIRECT_ENTITLEMENT');
    // Se cuentan valores DISTINTOS y no clics: el arnes dispara `load` a mano y jsdom
    // dispara el suyo, asi que el script arranca dos veces y cada borrado se ve doble. Es
    // del arnes y no del script, y para lo que se comprueba aqui —a quien se le pulsa el
    // boton y a quien no— da igual cuantas veces se le pulse.
    const borradas2 = [...new Set(r2.clicsEspiados || [])].sort();
    console.log('\n  con la misma recompensa como DIRECT_ENTITLEMENT:', JSON.stringify(borradas2));
    comprobar(borradas2.length === 3,
        'sin el CODE se borran las tres: quien las salva es el campo, no el fixture');

    console.log(fallos === 0 ? '\nTODO EN VERDE' : '\n' + fallos + ' COMPROBACIONES EN ROJO');
    process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
