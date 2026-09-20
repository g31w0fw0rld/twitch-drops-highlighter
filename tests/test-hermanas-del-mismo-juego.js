// EL FILTRO ES POR CAMPAÑA Y LA TARJETA ES POR JUEGO.
//
// Basta con que UNA campaña de un juego case con tus keywords para que el juego tenga
// tarjeta en el panel, y esa tarjeta enseñaba solo los tramos de ESA campaña: los de sus
// hermanas se quedaban fuera sin decir que faltaba nada.
//
// Reportado el 2026-09-20 con League of Legends. El acordeon repartia dos cosas —«Love,
// Sera» de la campaña «Split 3 - Sub Drop (Pt.2)», de Riot Games, y «WSCI Chat Badge» de
// «WSCI 2026», de Twitch— y el panel solo listaba la segunda. La entrada existia por la
// keyword `twitch`, que casa con el OWNER de esa campaña; la de Riot Games no casa con
// ninguna de las keywords del usuario (su lista no tiene ni «league of legends» ni
// «riot») y por eso no entraba.
//
// Los datos son los de ese reporte: los dos nombres de campaña, los dos owners y las dos
// recompensas, las dos por suscripcion (`requiredSubs: 1`, `requiredMinutesWatched: 0`),
// que es como Twitch las servia ese dia.
//
// EL CONTROL NEGATIVO ES LA MITAD DEL TEST, y son dos:
//   · otro juego cuya campaña tampoco casa y que NO tiene ninguna hermana que case: no
//     puede colarse. Sin el, «incluir hermanas» seria indistinguible de «quitar el
//     filtro», que meteria en el panel las 116 campañas de la API.
//   · una hermana del juego bueno que lleva una NEGATIVA: sigue fuera. La negativa es una
//     orden y no la revoca el juego.
//
// Control negativo (tiene que salir en ROJO con el codigo publicado):
//   git show HEAD:twitch-drops-highlighter.user.js > /tmp/pub.js
//   TW_SCRIPT=/tmp/pub.js node tests/test-hermanas-del-mismo-juego.js
const { run } = require('./harness');

const LOL = { id: '21779', displayName: 'League of Legends', boxArtURL: 'https://x/lol.jpg' };
const OTRO = { id: '99999', displayName: 'Juego Sin Interes', boxArtURL: 'https://x/otro.jpg' };

const campaña = (id, nombre, juego, owner) => ({
    id, name: nombre, status: 'ACTIVE',
    startAt: '2026-09-01T18:00:00Z', endAt: '2099-10-03T15:59:00Z',
    game: juego,
    owner: { id: 'o-' + id, login: owner.toLowerCase().replace(/\s+/g, ''), name: owner, displayName: owner },
    self: { isAccountConnected: true },
    image: { image1xURL: 'https://x/campaign.png' }
});

// La que casa: su OWNER es Twitch, y `twitch` esta en las keywords.
const WSCI = campaña('wsci-2026-0001', 'WSCI 2026', LOL, 'Twitch');
// La hermana: mismo juego, owner Riot Games. No casa con nada por si sola.
const SPLIT3 = campaña('split3-sub-0002', 'Split 3 - Sub Drop (Pt.2)', LOL, 'Riot Games');
// La hermana descartada a mano: lleva la negativa dentro del nombre.
const VETADA = campaña('vetada-0003', 'Dead by Daylight Crossover', LOL, 'Riot Games');
// El control: otro juego sin ninguna campaña que case.
const AJENA = campaña('ajena-0004', 'Temporada 4', OTRO, 'Otro Estudio');

const premios = {
    'wsci-2026-0001': ['WSCI Chat Badge'],
    'split3-sub-0002': ['Love, Sera'],
    'vetada-0003': ['Premio Vetado'],
    'ajena-0004': ['Premio Ajeno']
};

// UNA CONSULTA POR CAMPAÑA, asi que la respuesta depende de cual se pide: con un payload
// fijo las dos campañas devolverian lo mismo y el test pasaria sin comprobar nada.
const detallesDe = (cuerpo) => {
    const id = (((cuerpo || [])[0] || {}).variables || {}).dropID || '';
    const nombres = premios[id] || [];
    return [{
        data: {
            user: {
                id: 'o-' + id,
                dropCampaign: {
                    id, name: id,
                    timeBasedDrops: nombres.map((n, i) => ({
                        id: id + '-tramo-' + i, name: n,
                        requiredMinutesWatched: 0, requiredSubs: 1,
                        benefitEdges: [{ benefit: { id: id + '-b' + i, name: n, distributionType: 'DIRECT_ENTITLEMENT' } }]
                    }))
                }
            }
        }
    }];
};

const dashboard = [{
    data: {
        currentUser: { id: '1', login: 'prueba', dropCampaigns: [WSCI, SPLIT3, VETADA, AJENA] },
        rewardCampaignsAvailableToUser: []
    }
}];

const inventory = [{
    data: { currentUser: { inventory: {
        dropCampaignsInProgress: [], gameEventDrops: [], earnedDropRewards: { edges: [] }
    } } }
}];

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok    ' : '  FALLA ') + msg); if (!ok) fallos++; };

(async () => {
    const r = await run({
        waitMs: 12000,
        keywords: ['twitch', '-dead by daylight'],
        gql: { ViewerDropsDashboard: dashboard, Inventory: inventory, DropCampaignDetails: detallesDe }
    });

    const titulos = r.chips.map(c => c.titulo);
    console.log('  tarjetas del panel:', JSON.stringify(titulos));
    const lol = r.chips.find(c => /league of legends/i.test(c.titulo || ''));
    comprobar(!!lol, 'la tarjeta de League of Legends esta en el panel');
    comprobar(!titulos.some(t => /juego sin interes/i.test(t || '')),
        'el juego sin ninguna campaña que case NO entra');

    if (lol) {
        const texto = lol.badges.map(b => b.texto).join(' | ');
        console.log('  chips:', JSON.stringify(lol.badges.map(b => b.texto)));
        comprobar(/WSCI Chat Badge/.test(texto), 'sigue el premio de la campaña que casa por su owner');
        comprobar(/Love, Sera/.test(texto), 'y ahora tambien el de su hermana, que no casa por si sola');
        comprobar(!/Premio Vetado/.test(texto), 'la hermana con una keyword negativa se queda fuera');
    }

    // Y OTRA VEZ CON LAS CAMPAÑAS AL REVES. El orden en que la API las devuelve no esta
    // garantizado, y el titulo de la entrada es la clave con la que se guardan los avisos:
    // si cambiara de una carga a otra, cada vuelta levantaria un 🔔 de «campaña nueva» que
    // no lo es. Con la hermana delante, el titulo tiene que seguir siendo el de la campaña
    // que casa de verdad.
    const alReves = [{
        data: {
            currentUser: { id: '1', login: 'prueba', dropCampaigns: [AJENA, VETADA, SPLIT3, WSCI] },
            rewardCampaignsAvailableToUser: []
        }
    }];
    const r2 = await run({
        waitMs: 12000,
        keywords: ['twitch', '-dead by daylight'],
        gql: { ViewerDropsDashboard: alReves, Inventory: inventory, DropCampaignDetails: detallesDe }
    });
    const lol2 = r2.chips.find(c => /league of legends/i.test(c.titulo || ''));
    console.log('\n  con la hermana delante:', JSON.stringify(r2.chips.map(c => c.titulo)));
    comprobar(!!lol2 && lol2.titulo === (lol && lol.titulo),
        'el titulo de la tarjeta no depende del orden en que llegan las campañas');
    if (lol2) {
        const texto2 = lol2.badges.map(b => b.texto).join(' | ');
        console.log('  chips:', JSON.stringify(lol2.badges.map(b => b.texto)));
        comprobar(/WSCI Chat Badge/.test(texto2) && /Love, Sera/.test(texto2),
            'y las dos recompensas siguen ahi');
    }

    console.log(fallos ? `\n  ${fallos} FALLAN` : '\n  todo en verde');
    process.exit(fallos ? 1 : 0);
})();
