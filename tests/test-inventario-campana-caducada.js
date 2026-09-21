// LA CAMPAÑA QUE CERRO SIN QUE LLEGARAS A TIEMPO.
//
// Reportado el 2026-09-20: en el inventario, con la casilla de «ocultar cerrados/
// completados» puesta, «PEC: Fall Finals 1_DAY3» —caducada, al 45 %, con su unica
// recompensa diciendo «Esta recompensa ya no esta disponible»— seguia ahi. Y no habia
// forma de quitarla: por el camino que sigue ese caso no se le añade la ✕ tampoco.
//
// El volcado es el del reporte, tal cual, con su enlace `?dropID=afe7cb0a-…` —que es de
// donde sale el id con el que se pregunta a la API— y su barra en 45.
//
// LOS CONTROLES SON LA MITAD DEL TEST, y son cuatro, porque «esconder» se puede romper
// por exceso de cuatro maneras distintas:
//   · LA MISMA PAGINA con la campaña ACTIVE en la API: no se esconde. Es el control que
//     prueba que lo cerrado lo decide la API y no el texto de la pagina —que esta
//     traducido a 28 locales— ni la barra a medias. Sin el, «esconder lo caducado» y
//     «esconder lo que se quedo a medias» darian el mismo verde.
//   · con un BOTON DE RECLAMAR dentro: no se esconde, aunque la campaña este cerrada. Lo
//     que caduca es el plazo de ganarlo, no siempre el de cobrarlo, y tapar un boton que
//     todavia responde es perder el premio.
//   · con la campaña que NO ESTA en la API: no se esconde. Sin dato no se decide.
//   · con la CASILLA QUITADA: no se esconde nada. Es la que manda.
// Y una comprobacion por defecto: una campaña que la API sigue llamando ACTIVE pero cuyo
// `endAt` ya paso tambien se esconde. El estado no es el campo, es el campo Y el reloj.
//
// Control negativo (tiene que salir en ROJO con el codigo publicado):
//   git show HEAD:twitch-drops-highlighter.user.js > /tmp/pub.js
//   TW_SCRIPT=/tmp/pub.js node tests/test-inventario-campana-caducada.js
const fs = require('fs');
const path = require('path');
const { run } = require('./harness');

const CAMP = 'afe7cb0a-2c43-41a9-864f-d5b1a7263b86';
const DUMP = fs.readFileSync(path.join(__dirname, 'fixture-inventario-campana-caducada.html'), 'utf8');

// El mismo volcado con un boton de reclamar metido dentro del bloque, escrito como lo
// escribe Twitch: la etiqueta va en su propio nodo con `data-a-target`.
const DUMP_CON_BOTON = DUMP.replace(
    '<div class="ScTowerPlaceholder-sc-1sjzzes-1 IUMtQ"></div>',
    '<button data-test-selector="DropsCampaignInProgressRewardPresentation-claim-button"' +
    ' class="ScCoreButton-sc-ocjdkq-0"><div data-a-target="tw-core-button-label-text">' +
    'Reclamar ahora</div></button><div class="ScTowerPlaceholder-sc-1sjzzes-1 IUMtQ"></div>');

// Las fechas van RELATIVAS al reloj de la corrida, no clavadas al dia del reporte. La
// campaña se marca cerrada cuando lo dice su `status` O cuando su `endAt` ya paso, asi que
// con una fecha fija el control de «campaña viva» se convertiria, el dia que ese instante
// quedara atras, en un segundo control de campaña cerrada: verde igual, sin comprobar nada.
const DIA = 24 * 60 * 60 * 1000;
const cuando = (dias) => new Date(Date.now() + dias * DIA).toISOString();

// Y la misma con la barra llena. No es un adorno: son DOS guardas distintas las que la
// dejaban pasar, una en cada extremo. Al 45 % la frenaba la comprobacion de la baldosa
// («aun queda algo por ganar») y al 100 % la regla de 1.3.16 («una campaña completamente
// reclamada no se toca»), que vuelve antes de llegar a la otra. Arreglar solo el caso del
// reporte habria dejado el otro vivo y sin test que lo dijera.
const DUMP_AL_100 = DUMP.replace('aria-valuenow="45"', 'aria-valuenow="100"')
    .replace('>45</span>% de 2 horas', '>100</span>% de 2 horas');

const campaña = (estado, finEnDias = 2) => ({
    id: CAMP, name: 'PEC: Fall Finals 1_DAY3', status: estado,
    startAt: cuando(-2), endAt: cuando(finEnDias),
    game: { id: '493057', displayName: 'PUBG: BATTLEGROUNDS', boxArtURL: 'https://x/pubg.jpg' },
    owner: { id: 'o-pec', login: 'pubgesports', name: 'PUBG Esports', displayName: 'PUBG Esports' },
    self: { isAccountConnected: true },
    image: { image1xURL: 'https://x/pec.png' }
});

const dashboardCon = (camps) => [{
    data: { currentUser: { id: '1', login: 'prueba', dropCampaigns: camps },
            rewardCampaignsAvailableToUser: [] } }];

const detalle = (cuerpo) => {
    const id = (((cuerpo || [])[0] || {}).variables || {}).dropID || '';
    return [{ data: { user: { id: 'o-pec', dropCampaign: {
        id, name: 'PEC: Fall Finals 1_DAY3',
        timeBasedDrops: [{ id: id + '-t0', name: 'PUBG Varsity Jacket',
            requiredMinutesWatched: 120, requiredSubs: 0,
            benefitEdges: [{ benefit: { id: id + '-b0', name: 'PUBG Varsity Jacket',
                distributionType: 'DIRECT_ENTITLEMENT' } }] }]
    } } } }];
};

const inventory = [{ data: { currentUser: { inventory: {
    dropCampaignsInProgress: [], gameEventDrops: [], earnedDropRewards: { edges: [] } } } } }];

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok    ' : '  FALLA ') + msg); if (!ok) fallos++; };

// Devuelve el nodo escondido que CONTIENE al bloque de la campaña, si lo hay. Se mira por
// contencion y no por igualdad: lo que se esconde es el contenedor del bloque, y cual de
// los dos `div` anidados es depende del marcado de Twitch, que cambia.
async function escondido(opts) {
    const r = await run(Object.assign({
        url: 'https://www.twitch.tv/drops/inventory',
        waitMs: 12000,
        keywords: ['pubg'],
        gql: { ViewerDropsDashboard: dashboardCon([campaña('EXPIRED')]),
               Inventory: inventory, DropCampaignDetails: detalle }
    }, opts));
    const doc = r.w.document;
    const bloque = doc.querySelector('.inventory-campaign-info');
    const nodos = Array.from(doc.querySelectorAll('[data-twitch-drops-hidden="1"]'));
    return { r, bloque, nodo: nodos.find(n => n === bloque || n.contains(bloque)) || null, nodos };
}

(async () => {
    const caducada = await escondido({ dump: DUMP });
    comprobar(!!caducada.nodo, 'la campaña caducada a medias desaparece del inventario');
    comprobar(!!caducada.nodo && caducada.nodo.getAttribute('data-twitch-drops-hidden-why') === 'caducada',
        'y lo hace por caducada, no por ninguna de las reglas viejas');
    // El escondido tiene que SOBREVIVIR a la revalidacion: `_revalidarEscondidos` vuelve a
    // juzgar cada nodo escondido con `_sigueCuadrando`, y un motivo que ese juez no conozca
    // se destapa solo unos segundos despues. Las esperas de 12 s de aqui arriba cubren de
    // sobra las 10 vueltas del barrido y varias del observador.
    comprobar(caducada.nodos.length >= 1, 'y sigue escondida cuando pasa la revalidacion');

    const llena = await escondido({ dump: DUMP_AL_100 });
    comprobar(!!llena.nodo, 'y tambien desaparece con la barra al 100 %, que la frenaba por otra guarda');

    const viva = await escondido({ dump: DUMP,
        gql: { ViewerDropsDashboard: dashboardCon([campaña('ACTIVE')]),
               Inventory: inventory, DropCampaignDetails: detalle } });
    comprobar(!viva.nodo, 'CONTROL: la misma pagina, con la campaña viva en la API, no se esconde');

    const vencida = await escondido({ dump: DUMP,
        gql: { ViewerDropsDashboard: dashboardCon([campaña('ACTIVE', -1)]),
               Inventory: inventory, DropCampaignDetails: detalle } });
    comprobar(!!vencida.nodo, 'una que la API sigue llamando ACTIVE pero cuyo plazo ya paso, tambien');

    const conBoton = await escondido({ dump: DUMP_CON_BOTON });
    comprobar(!conBoton.nodo, 'CONTROL: con un boton de reclamar dentro, no se toca');

    const ajena = await escondido({ dump: DUMP,
        gql: { ViewerDropsDashboard: dashboardCon([]), Inventory: inventory,
               DropCampaignDetails: detalle } });
    comprobar(!ajena.nodo, 'CONTROL: sin dato de esa campaña en la API, no se esconde');

    const sinCasilla = await escondido({ dump: DUMP, ocultarCerrados: false });
    comprobar(!sinCasilla.nodo, 'CONTROL: con la casilla quitada, no se esconde nada');

    console.log(fallos ? `\n  ${fallos} FALLAN` : '\n  todo en verde');
    process.exit(fallos ? 1 : 0);
})();
