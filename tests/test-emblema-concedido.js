// Una reward campaign no reparte premios, reparte CONTENEDORES: la «Poké Ball» es una
// caja que se abre sola al cumplir el tiempo y suelta un emblema. El historial apunta el
// emblema y NUNCA la caja, asi que la fila de la bola no puede marcarse por su id —no
// existe en el historial— y hay que decidirla contando.
//
// Lo que se comprueba, y son dos cosas distintas:
//   1. QUE te dio: el emblema concedido («Pichu») sale, con su ✓ y tachado.
//   2. SI la caja esta hecha: se tacha cuando las concesiones de esa campaña alcanzan el
//      numero de `rewardGroups` que promete, y NO antes.
// Sin la segunda mitad de (2) —los casos de «una de tres»— el arreglo pasaria igual
// tachando en cuanto la campaña concede cualquier cosa, que es justo el error que se
// quiere evitar: esconder una caja que aun puedes ganar.
//
// Los datos son los del volcado real de `rewardCampaignsAvailableToUser` (primaria,
// 2026-09-08) recortado a lo que la prueba usa, con sus TRES campañas y sus grupos: 1
// para la Poké Ball, 3 para cada Great Ball. Esas cifras son el badge «x3» que la pagina
// de campañas pinta, y no se tocan.
//
// Lo importante y lo que no se puede tocar del lado del historial: `campaign.id` del nodo
// concedido es `92f516f7-…`, el MISMO que el `id` de la reward campaign de la Poké Ball,
// mientras que su `item.id` (`7e978af0-…`) no se parece al `reward.id` de la bola
// (`9a604770-…`). Ese es el unico cruce que hay.
const { run } = require('./harness');

const CAMP_POKEBALL = '92f516f7-f6d5-4fa6-909a-48c5b94d2a43';
const CAMP_GREATBALL_SUBS = '9bdb6607-22c2-4317-b18a-1b6924e555d6';
const CAMP_GREATBALL_TIEMPO = '19f00aac-6679-4e10-b36c-881beb654e52';
const ID_POKEBALL = '9a604770-9661-11f1-8842-0a58a9feac02';
const ID_GREATBALL = '87989657-9661-11f1-9e11-0a58a9feac02';
const ID_PICHU = '7e978af0-9661-11f1-b03f-0a58a9feac02';

const premio = (id, nombre) => ({
    id, name: nombre,
    thumbnailImage: { image1xURL: 'https://static-cdn.jtvnw.net/twitch-quests-assets/REWARD/y.png' },
    earnableUntil: '2099-10-01T07:00:00Z'
});

// `requisitos` es una lista con un elemento por GRUPO: [{ subs, minutos }, …]. Su
// longitud es la cantidad de cajas que promete la campaña, que es lo que decide el
// tachado. La campaña de subs tiene tres grupos con subsGoal 1, 2 y 3; la de tiempo,
// tres grupos IDENTICOS de 20 min. Los dos casos salen del volcado tal cual.
const rewardCampaign = (id, nombre, premioId, requisitos) => ({
    id, name: 'First Partners Collection', brand: 'Pokemon',
    startsAt: '2026-08-24T17:00:00Z', endsAt: '2099-10-01T07:00:00Z', status: 'UNKNOWN',
    isSitewide: true, game: null,
    unlockRequirements: { subsGoal: requisitos[0].subs, minuteWatchedGoal: requisitos[0].minutos },
    image: { image1xURL: 'https://static-cdn.jtvnw.net/twitch-quests-assets/CAMPAIGN/x.png' },
    rewards: [premio(premioId, nombre)],
    rewardGroups: requisitos.map((r, i) => ({
        id: 'grupo-' + id.slice(0, 4) + '-' + i,
        unlockRequirements: { subsGoal: r.subs, minuteWatchedGoal: r.minutos, turboSubsGoal: 0, eventTriggerGoal: 0 },
        rewards: [premio(premioId, nombre)]
    }))
});

const dashboard = [{
    data: {
        currentUser: { id: '1', login: 'prueba', dropCampaigns: [] },
        rewardCampaignsAvailableToUser: [
            rewardCampaign(CAMP_POKEBALL, 'Poké Ball', ID_POKEBALL, [{ subs: 0, minutos: 20 }]),
            rewardCampaign(CAMP_GREATBALL_SUBS, 'Great Ball', ID_GREATBALL,
                           [{ subs: 1, minutos: 0 }, { subs: 2, minutos: 0 }, { subs: 3, minutos: 0 }]),
            rewardCampaign(CAMP_GREATBALL_TIEMPO, 'Great Ball', ID_GREATBALL,
                           [{ subs: 0, minutos: 20 }, { subs: 0, minutos: 20 }, { subs: 0, minutos: 20 }])
        ]
    }
}];

const nodoConcedido = (id, nombre, campaignId) => ({
    node: {
        id, item: { id, distributionType: 'BADGE', name: nombre },
        campaign: { id: campaignId, brandName: 'Pokemon' },
        status: 'CLAIMED', earnedAt: '2026-08-28T17:11:51.119Z'
    }
});

const inventory = (edges) => ([{
    data: {
        currentUser: {
            inventory: {
                dropCampaignsInProgress: [],
                gameEventDrops: [],
                earnedDropRewards: { edges }
            }
        }
    }
}]);

const CASOS = [
    {
        // Control negativo: mismo codigo, historial sin nada. Si algo saliera tachado o
        // «Pichu» apareciera igual, es que sale de otro sitio y el test no probaria nada.
        nombre: 'sin conceder nada todavia',
        edges: [],
        pichu: false, bolaTachada: false, greatSubsTachada: false, greatTiempoTachada: false
    },
    {
        // 1 concesion contra 1 grupo: la Poké Ball se agoto y se tacha. Las dos campañas
        // de Great Ball siguen a 0 de 3 y no se tocan, aunque la concesion sea «de
        // Pokemon»: lo que cuenta es la campaña, no la marca.
        nombre: 'la Poké Ball, ya abierta (1 concesion de 1 grupo)',
        edges: [nodoConcedido(ID_PICHU, 'Pichu', CAMP_POKEBALL)],
        pichu: true, bolaTachada: true, greatSubsTachada: false, greatTiempoTachada: false
    },
    {
        // EL CASO QUE HACE FALTA: la campaña concedio algo y aun asi NO se tacha, porque
        // 1 de 3 no es «hecha». Es la diferencia entre contar y conformarse con «hay
        // alguna concesion», y sin este caso las dos reglas se ven identicas.
        nombre: 'una Great Ball de tres (1 concesion de 3 grupos)',
        edges: [nodoConcedido('badge-1', 'Bulbasaur', CAMP_GREATBALL_SUBS)],
        pichu: false, bolaTachada: false, greatSubsTachada: false, greatTiempoTachada: false
    },
    {
        // Las tres. Y de paso el acotado por campaña con el peor caso posible: las dos
        // campañas de Great Ball reparten EL MISMO nombre y EL MISMO `reward.id`, asi que
        // si el conteo no fuera por campaña, tachar la de subs tacharia tambien la de
        // tiempo, que va por 0.
        nombre: 'las tres Great Ball de subs (3 concesiones de 3 grupos)',
        edges: [
            nodoConcedido('badge-1', 'Bulbasaur', CAMP_GREATBALL_SUBS),
            nodoConcedido('badge-2', 'Charmander', CAMP_GREATBALL_SUBS),
            nodoConcedido('badge-3', 'Squirtle', CAMP_GREATBALL_SUBS)
        ],
        pichu: false, bolaTachada: false, greatSubsTachada: true, greatTiempoTachada: false
    },
    {
        // El control negativo de verdad, y es un caso REAL: una segunda cuenta (2026-09-01)
        // con 137 recompensas en el historial y ninguna de estas campañas. Un historial
        // VACIO no prueba el acotado —sin nada que pegar, no pegar es gratis—; este si,
        // porque trae premios del mismo tipo (un BADGE y un EMOTE, que son los dos que
        // Twitch concede solo) y lo unico que los separa de «Pichu» es de que campaña
        // vienen. Si el acotado por campaign.id se cayera, «Football Fest 2026» acabaria
        // colgado de la tarjeta de Pokemon.
        //
        // Las tres reward campaigns llegan con LOS MISMOS ids en las dos cuentas —son
        // sitewide, el id es de la campaña y no del usuario—, que es justo lo que hace
        // fiable la clave que usa el arreglo.
        nombre: 'historial lleno, pero de otras campañas',
        edges: [
            nodoConcedido('23130927-642a-11f1-ba9c-0a58a9feac02', 'Football Fest 2026',
                          '649d6e57-25f0-477e-ab51-313a2eee318d'),
            nodoConcedido('f7c2b951-5f8d-11f1-b5a9-0a58a9feac02', 'FootballHype Emote',
                          '8e0db5de-2518-4991-a0bb-9fe187ab4999')
        ],
        pichu: false, bolaTachada: false, greatSubsTachada: false, greatTiempoTachada: false,
        ajenos: ['Football Fest 2026', 'FootballHype Emote']
    }
];

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok   ' : '  FALLA') + ' ' + msg); if (!ok) fallos++; };

(async () => {
    for (const c of CASOS) {
        console.log('\n=== ' + c.nombre + ' ===');
        const r = await run({ waitMs: 9000, gql: { ViewerDropsDashboard: dashboard, Inventory: inventory(c.edges) } });

        const tarjeta = r.chips.find(x => /pok/i.test(x.titulo || ''));
        comprobar(!!tarjeta, 'la tarjeta de Pokemon esta en el panel' +
            (tarjeta ? '' : ' (titulos: ' + JSON.stringify(r.chips.map(x => x.titulo)) + ')'));
        if (!tarjeta) continue;

        // Las dos Great Ball comparten nombre, asi que se separan por el chip en el que
        // caen: el de 20 min es el que lleva ademas la Poké Ball —la campaña de tiempo—,
        // y el otro es el de subs, que va sin coste. Sin esta separacion el caso de las
        // tres concesiones no se podria leer.
        const chipConBola = tarjeta.badges.find(b => b.premios.some(p => p.texto === 'Poké Ball'));
        const chipSubs = tarjeta.badges.find(b => b !== chipConBola && b.premios.some(p => p.texto === 'Great Ball'));
        const premios = tarjeta.badges.flatMap(b => b.premios);
        const pichu = premios.find(p => p.texto === 'Pichu');
        const bola = (chipConBola && chipConBola.premios.find(p => p.texto === 'Poké Ball')) || null;
        const greatTiempo = (chipConBola && chipConBola.premios.find(p => p.texto === 'Great Ball')) || null;
        const greatSubs = (chipSubs && chipSubs.premios.find(p => p.texto === 'Great Ball')) || null;

        comprobar(!!bola, 'la fila de la «Poké Ball» sigue en la tarjeta');
        comprobar(!!greatSubs && !!greatTiempo, 'las dos «Great Ball» siguen en la tarjeta');

        if (c.pichu) {
            comprobar(!!pichu, 'sale el emblema concedido «Pichu»');
            comprobar(!!pichu && pichu.tachado, '«Pichu» sale tachado (obtenido)');
            comprobar(tarjeta.badges.some(b => /✓/.test(b.texto) && /Pichu/.test(b.texto)),
                '«Pichu» lleva su ✓');
        } else {
            comprobar(!pichu, 'NO sale «Pichu» cuando el historial no lo trae');
            for (const ajeno of (c.ajenos || [])) {
                comprobar(!premios.some(pr => pr.texto === ajeno),
                    'no se cuela «' + ajeno + '», que es de otra campaña');
            }
        }

        comprobar(!!bola && bola.tachado === c.bolaTachada,
            'la «Poké Ball» ' + (c.bolaTachada ? 'SE tacha: no queda ninguna por abrir'
                                               : 'NO se tacha: la campaña sigue dando'));
        comprobar(!!greatSubs && greatSubs.tachado === c.greatSubsTachada,
            'la «Great Ball» de subs ' + (c.greatSubsTachada ? 'SE tacha' : 'NO se tacha'));
        comprobar(!!greatTiempo && greatTiempo.tachado === c.greatTiempoTachada,
            'la «Great Ball» de tiempo ' + (c.greatTiempoTachada ? 'SE tacha' : 'NO se tacha'));

        // El ✓ y el tachado son la misma verdad dicha dos veces: un chip con ✓ delante y
        // sin tachar seria un fallo que el texto por si solo no distingue.
        const conTick = /✓\s*Poké Ball/.test((chipConBola && chipConBola.texto) || '');
        comprobar(conTick === c.bolaTachada,
            'el ✓ de la «Poké Ball» ' + (c.bolaTachada ? 'esta' : 'no esta') + ', igual que su tachado');
    }
    console.log(fallos === 0 ? '\nTODO EN VERDE' : '\n' + fallos + ' COMPROBACIONES EN ROJO');
    process.exit(fallos === 0 ? 0 : 1);
})();
