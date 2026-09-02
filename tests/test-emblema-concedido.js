// Una reward campaign reparte CONTENEDORES: la «Poké Ball» no es un premio que se tenga,
// es una caja que se abre sola al cumplir el tiempo y suelta un emblema. El historial
// apunta el emblema y NO la caja, asi que la fila de la bola no puede marcarse por su id
// —no existe en el historial— y tacharla porque la campaña concedio algo seria decir que
// esta cerrada cuando aun quedan tres emblemas por salir.
//
// Lo que se comprueba es eso mismo, en las dos direcciones:
//   1. el emblema concedido («Pichu») sale, con su ✓ y tachado;
//   2. la bola («Poké Ball») NO sale tachada.
// Sin la segunda, el arreglo pasaria igual marcandolo todo.
//
// Los datos son los del volcado real del 2026-09-01 (consola del usuario), recortados a
// lo que la prueba usa. Lo importante y lo que no se puede tocar: `campaign.id` del nodo
// concedido es `92f516f7-…`, el MISMO que el `id` de la reward campaign de la Poké Ball,
// mientras que su `item.id` (`7e978af0-…`) no se parece al `reward.id` de la bola
// (`9a604770-…`). Ese es el unico cruce que hay.
const { run } = require('./harness');

const CAMP_POKEBALL = '92f516f7-f6d5-4fa6-909a-48c5b94d2a43';
const CAMP_GREATBALL_SUBS = '9bdb6607-22c2-4317-b18a-1b6924e555d6';
const ID_POKEBALL = '9a604770-9661-11f1-8842-0a58a9feac02';
const ID_GREATBALL = '87989657-9661-11f1-9e11-0a58a9feac02';
const ID_PICHU = '7e978af0-9661-11f1-b03f-0a58a9feac02';

const rewardCampaign = (id, nombre, premioId, minutos, subs) => ({
    id, name: 'First Partners Collection', brand: 'Pokemon',
    startsAt: '2026-08-24T17:00:00Z', endsAt: '2099-10-01T07:00:00Z', status: 'UNKNOWN',
    isSitewide: true, game: null,
    unlockRequirements: { subsGoal: subs, minuteWatchedGoal: minutos },
    image: { image1xURL: 'https://static-cdn.jtvnw.net/twitch-quests-assets/CAMPAIGN/x.png' },
    rewards: [{
        id: premioId, name: nombre,
        thumbnailImage: { image1xURL: 'https://static-cdn.jtvnw.net/twitch-quests-assets/REWARD/y.png' },
        earnableUntil: '2099-10-01T07:00:00Z'
    }]
});

// Las TRES campañas del volcado: mismo nombre y marca, una recompensa cada una. No hay
// `rewardGroups` en la respuesta de verdad, asi que aqui tampoco: es la caida a `rewards`
// la que tiene que funcionar.
const dashboard = [{
    data: {
        currentUser: { id: '1', login: 'prueba', dropCampaigns: [] },
        rewardCampaignsAvailableToUser: [
            rewardCampaign(CAMP_POKEBALL, 'Poké Ball', ID_POKEBALL, 20, 0),
            rewardCampaign(CAMP_GREATBALL_SUBS, 'Great Ball', ID_GREATBALL, 0, 2)
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
        nombre: 'con el emblema ya concedido',
        edges: [nodoConcedido(ID_PICHU, 'Pichu', CAMP_POKEBALL)],
        esperaPichu: true
    },
    {
        // Control negativo: mismo codigo, historial sin ese nodo. Si «Pichu» saliera
        // igual, es que lo esta sacando de otro sitio y el test no probaria nada.
        nombre: 'sin conceder nada todavia',
        edges: [],
        esperaPichu: false
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
        esperaPichu: false,
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

        const premios = tarjeta.badges.flatMap(b => b.premios);
        const pichu = premios.find(p => p.texto === 'Pichu');
        const bola = premios.find(p => p.texto === 'Poké Ball');

        if (c.esperaPichu) {
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
            comprobar(!tarjeta.badges.some(b => /✓/.test(b.texto)),
                'la tarjeta no lleva ningun ✓');
        }

        comprobar(!!bola, 'la fila de la «Poké Ball» sigue en la tarjeta');
        comprobar(!!bola && !bola.tachado, 'la «Poké Ball» NO se tacha: la campaña sigue dando');
        comprobar(!tarjeta.badges.some(b => /✓\s*Poké Ball/.test(b.texto)),
            'la «Poké Ball» no lleva ✓');
    }
    console.log(fallos === 0 ? '\nTODO EN VERDE' : '\n' + fallos + ' COMPROBACIONES EN ROJO');
    process.exit(fallos === 0 ? 0 : 1);
})();
