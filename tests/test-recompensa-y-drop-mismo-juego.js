// LA FILA DE UNA CAMPAÑA DE RECOMPENSAS ENSEÑABA LOS PREMIOS DE OTRA CAMPAÑA.
//
// Reportado el 2026-09-21 con CONTROL Resonant. El juego tiene DOS campañas abiertas a la
// vez, y la API las sirve en dos sitios distintos del mismo volcado (`json.json`):
//
//   · de DROPS       «CONTROL Resonant launch » (con espacio final), owner «Twitch Gaming»,
//                    dos tramos: 60 min y 1 sub -> «Don't Eat The Mold» y «The Inverted Man».
//   · de RECOMPENSAS «CONTROL Resonant launch», tres grupos: 60, 120 y 240 min
//                    -> «Sierra Suit», «Sierra Vest» y «Sierra Helmet».
//
// La fila de la seccion «Campañas de recompensas abiertas» salia en el panel con los chips
// de la de DROPS —«The Inverted Man (sub)» y «Don't Eat The Mold (1 h)»— y con un «⏱ 1h»
// que es el coste de aquella, no el suyo (el suyo son 4 h).
//
// Dos causas encadenadas, las dos verificables leyendo el codigo:
//
//   1. El escaneo apunta el titulo de CADA fila como «el nombre que la pagina le da a este
//      juego» (`_domTitleByGameId`, indexado por el id que va en la URL de la caratula).
//      Pero la cabecera de una fila de recompensas se titula con el nombre de la CAMPAÑA
//      —un solo <p>, sin estudio—, asi que el juego 1338428218 quedaba apodado «control
//      resonant launch». Con ese apodo, `_findEntryForTitle` le daba a la fila la entrada
//      de la campaña de drops con puntuacion de coincidencia EXACTA (1000).
//   2. Y aunque no se lo diera, su propia entrada no existia: las campañas de recompensas
//      solo entraban si casaban con una keyword POR SI MISMAS, y esta no casa con ninguna
//      («control» no esta en la lista; la fila esta en el panel porque la campaña de drops
//      de su juego casa por el owner `twitch`). La regla de hermanas del 2026-09-20 —un
//      juego que ya te interesa se lleva todas sus campañas— nunca llego a este bucle.
//
// EL CONTROL NEGATIVO es la campaña de recompensas de un juego que NO interesa: la regla
// de hermanas abre una puerta, y sin esto «traer las hermanas» seria indistinguible de
// «quitar el filtro».
//
// Control negativo (tiene que salir en ROJO con el codigo publicado):
//   git show HEAD:twitch-drops-highlighter.user.js > /tmp/pub.js
//   TW_SCRIPT=/tmp/pub.js node tests/test-recompensa-y-drop-mismo-juego.js
const { run, readFixture } = require('./harness');

// La campaña de DROPS, tal cual la sirvio `ViewerDropsDashboard` el 2026-09-21. Sus dos
// tramos son los de la pagina: 60 min uno y 1 sub el otro.
const CAMPAÑA_DROPS = {
    "id": "84f27bd4-9c9f-4a03-acc5-096b84081db8",
    "name": "CONTROL Resonant launch ",
    "owner": {
        "id": "d32de13d-937e-4196-8198-1a7f875f295a",
        "name": "Twitch Gaming",
        "__typename": "Organization"
    },
    "game": {
        "id": "1338428218",
        "displayName": "CONTROL Resonant",
        "boxArtURL": "https://static-cdn.jtvnw.net/ttv-boxart/1338428218_IGDB-120x160.jpg",
        "__typename": "Game"
    },
    "status": "ACTIVE",
    "startAt": "2026-09-22T14:00:00Z",
    "endAt": "2026-10-13T13:59:59.999Z",
    "detailsURL": "https://www.twitch.tv/drops/campaigns",
    "accountLinkURL": "https://www.twitch.tv",
    "self": {
        "isAccountConnected": false,
        "__typename": "DropCampaignSelfEdge"
    },
    "timeBasedDrops": [
        {
            "id": "e5e7aea8-b5c5-11f1-ad79-0a58a9feac02",
            "requiredMinutesWatched": 60,
            "requiredSubs": 0,
            "requiredTurboSubs": 0,
            "__typename": "TimeBasedDrop"
        },
        {
            "id": "ef439b46-b5c5-11f1-a91c-0a58a9feac02",
            "requiredMinutesWatched": 0,
            "requiredSubs": 1,
            "requiredTurboSubs": 0,
            "__typename": "TimeBasedDrop"
        }
    ],
    "__typename": "DropCampaign"
};

// Y la campaña de RECOMPENSAS del MISMO juego, del mismo volcado. Se llama igual que la
// de arriba —salvo el espacio final de aquella— y reparte otras tres cosas.
const CAMPAÑA_RECOMPENSAS = {
    "id": "68e4ae05-4d2e-4244-9b28-d1c881735460",
    "name": "CONTROL Resonant launch",
    "brand": "",
    "startsAt": "2026-09-22T14:00:00Z",
    "endsAt": "2026-10-13T13:59:59.999Z",
    "status": "UNKNOWN",
    "summary": "Celebrate the launch of CONTROL Resonant and earn an exclusive in-game outfit for Dylan Faden by watching. Designed to look like a test dummy, help the FBC’s former test dummy take back CONTROL! #CONTROLResonant",
    "instructions": "",
    "externalURL": "https://www.twitch.tv",
    "rewardValueURLParam": "",
    "aboutURL": "https://www.twitch.tv/drops/campaigns",
    "isSitewide": false,
    "game": {
        "id": "1338428218",
        "slug": "control-2",
        "displayName": "CONTROL Resonant",
        "boxArtURL": "https://static-cdn.jtvnw.net/ttv-boxart/1338428218_IGDB-120x160.jpg",
        "__typename": "Game"
    },
    "unlockRequirements": {
        "subsGoal": 0,
        "minuteWatchedGoal": 240,
        "__typename": "QuestRewardUnlockRequirements"
    },
    "image": {
        "image1xURL": "https://static-cdn.jtvnw.net/twitch-quests-assets/CAMPAIGN/d489529e-6ebc-4def-9a2b-02851a9c2a0f.png",
        "__typename": "RewardCampaignImageSet"
    },
    "rewards": [
        {
            "id": "d768e395-ad5f-11f1-9163-0a58a9feac02",
            "name": "Sierra Helmet",
            "bannerImage": {
                "image1xURL": "https://static-cdn.jtvnw.net/twitch-quests-assets/REWARD/3acd2188-6d1b-4315-a37a-0bdb39d74677.png",
                "__typename": "RewardCampaignImageSet"
            },
            "thumbnailImage": {
                "image1xURL": "https://static-cdn.jtvnw.net/twitch-quests-assets/REWARD/3acd2188-6d1b-4315-a37a-0bdb39d74677.png",
                "__typename": "RewardCampaignImageSet"
            },
            "earnableUntil": "2026-10-13T13:59:59.999Z",
            "redemptionInstructions": "",
            "redemptionURL": "https://www.twitch.tv",
            "__typename": "Reward"
        }
    ],
    "rewardGroups": [
        {
            "id": "004044e6-aae1-11f1-88b3-0a58a9feac02",
            "unlockRequirements": {
                "subsGoal": 0,
                "minuteWatchedGoal": 240,
                "turboSubsGoal": 0,
                "eventTriggerGoal": 0,
                "__typename": "QuestRewardUnlockRequirements"
            },
            "rewards": [
                {
                    "id": "d768e395-ad5f-11f1-9163-0a58a9feac02",
                    "name": "Sierra Helmet",
                    "bannerImage": {
                        "image1xURL": "https://static-cdn.jtvnw.net/twitch-quests-assets/REWARD/3acd2188-6d1b-4315-a37a-0bdb39d74677.png",
                        "__typename": "RewardCampaignImageSet"
                    },
                    "thumbnailImage": {
                        "image1xURL": "https://static-cdn.jtvnw.net/twitch-quests-assets/REWARD/3acd2188-6d1b-4315-a37a-0bdb39d74677.png",
                        "__typename": "RewardCampaignImageSet"
                    },
                    "earnableUntil": "2026-10-13T13:59:59.999Z",
                    "redemptionInstructions": "",
                    "redemptionURL": "https://www.twitch.tv",
                    "__typename": "Reward"
                }
            ],
            "__typename": "RewardCampaignRewardGroup"
        },
        {
            "id": "f018aea6-aae0-11f1-b635-0a58a9feac02",
            "unlockRequirements": {
                "subsGoal": 0,
                "minuteWatchedGoal": 60,
                "turboSubsGoal": 0,
                "eventTriggerGoal": 0,
                "__typename": "QuestRewardUnlockRequirements"
            },
            "rewards": [
                {
                    "id": "1c59b8bd-ad60-11f1-8414-0a58a9feac02",
                    "name": "Sierra Suit",
                    "bannerImage": {
                        "image1xURL": "https://static-cdn.jtvnw.net/twitch-quests-assets/REWARD/4903c44f-5f93-4a99-8870-8caba8e7bfb3.png",
                        "__typename": "RewardCampaignImageSet"
                    },
                    "thumbnailImage": {
                        "image1xURL": "https://static-cdn.jtvnw.net/twitch-quests-assets/REWARD/4903c44f-5f93-4a99-8870-8caba8e7bfb3.png",
                        "__typename": "RewardCampaignImageSet"
                    },
                    "earnableUntil": "2026-10-13T13:59:59.999Z",
                    "redemptionInstructions": "",
                    "redemptionURL": "https://www.twitch.tv",
                    "__typename": "Reward"
                }
            ],
            "__typename": "RewardCampaignRewardGroup"
        },
        {
            "id": "f772504e-aae0-11f1-9217-0a58a9feac02",
            "unlockRequirements": {
                "subsGoal": 0,
                "minuteWatchedGoal": 120,
                "turboSubsGoal": 0,
                "eventTriggerGoal": 0,
                "__typename": "QuestRewardUnlockRequirements"
            },
            "rewards": [
                {
                    "id": "000b1da7-ad60-11f1-a1c8-0a58a9feac02",
                    "name": "Sierra Vest",
                    "bannerImage": {
                        "image1xURL": "https://static-cdn.jtvnw.net/twitch-quests-assets/REWARD/2c928fee-1de6-417f-96c2-65b57f9ea7cc.png",
                        "__typename": "RewardCampaignImageSet"
                    },
                    "thumbnailImage": {
                        "image1xURL": "https://static-cdn.jtvnw.net/twitch-quests-assets/REWARD/2c928fee-1de6-417f-96c2-65b57f9ea7cc.png",
                        "__typename": "RewardCampaignImageSet"
                    },
                    "earnableUntil": "2026-10-13T13:59:59.999Z",
                    "redemptionInstructions": "",
                    "redemptionURL": "https://www.twitch.tv",
                    "__typename": "Reward"
                }
            ],
            "__typename": "RewardCampaignRewardGroup"
        }
    ],
    "__typename": "RewardCampaign"
};

// EL CONTROL NEGATIVO: una campaña de recompensas de un juego sin ninguna campaña de drops
// que case. Copia la forma de la de arriba y cambia lo que se comprueba.
const CAMPAÑA_AJENA = {
    id: 'ajena-0001', name: 'Turtle Tunes', brand: '',
    startsAt: '2026-09-22T14:00:00Z', endsAt: '2099-10-13T13:59:59.999Z',
    status: 'UNKNOWN',
    game: { id: '99999', slug: 'juego-sin-interes', displayName: 'Juego Sin Interes',
            boxArtURL: 'https://static-cdn.jtvnw.net/ttv-boxart/99999-120x160.jpg' },
    unlockRequirements: { subsGoal: 0, minuteWatchedGoal: 60 },
    rewards: [{ id: 'ajena-r1', name: 'Premio Ajeno' }],
    rewardGroups: [{ id: 'ajena-g1', unlockRequirements: { subsGoal: 0, minuteWatchedGoal: 60 },
                     rewards: [{ id: 'ajena-r1', name: 'Premio Ajeno' }] }]
};

// LOS TRAMOS DE LA CAMPAÑA DE DROPS. `ViewerDropsDashboard` da sus requisitos —(60 min, 0
// subs) y (0 min, 1 sub), arriba— pero no los NOMBRES: esos viven en `DropCampaignDetails`,
// que es una consulta por campaña. Los dos nombres y el tipo EMBLEMA son los que la pagina
// escribe en ese acordeon (captura del 2026-09-21); los numeros son los del volcado.
const detallesDe = (cuerpo) => {
    const id = (((cuerpo || [])[0] || {}).variables || {}).dropID || '';
    if (id !== CAMPAÑA_DROPS.id) return [{ data: { user: { id: 'x', dropCampaign: null } } }];
    return [{ data: { user: { id: CAMPAÑA_DROPS.owner.id, dropCampaign: {
        id, name: CAMPAÑA_DROPS.name,
        timeBasedDrops: [
            { id: CAMPAÑA_DROPS.timeBasedDrops[0].id, name: "Don't Eat The Mold",
              requiredMinutesWatched: 60, requiredSubs: 0,
              benefitEdges: [{ benefit: { id: 'b-mold', name: "Don't Eat The Mold", distributionType: 'BADGE' } }] },
            { id: CAMPAÑA_DROPS.timeBasedDrops[1].id, name: 'The Inverted Man',
              requiredMinutesWatched: 0, requiredSubs: 1,
              benefitEdges: [{ benefit: { id: 'b-inverted', name: 'The Inverted Man', distributionType: 'BADGE' } }] }
        ]
    } } } }];
};

const dashboard = [{
    data: {
        currentUser: { id: '1', login: 'prueba', dropCampaigns: [CAMPAÑA_DROPS] },
        rewardCampaignsAvailableToUser: [CAMPAÑA_RECOMPENSAS, CAMPAÑA_AJENA]
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
        url: 'https://www.twitch.tv/drops/campaigns',
        dump: readFixture('fixture-campanas-recompensa-mismo-nombre.html'),
        // La keyword del reporte: casa con el OWNER de la campaña de drops («Twitch Gaming»)
        // y con nada mas. Ni la campaña de recompensas ni el juego la llevan, que es
        // justamente la situacion que se prueba.
        keywords: ['twitch'],
        gql: { ViewerDropsDashboard: dashboard, Inventory: inventory, DropCampaignDetails: detallesDe },
        waitMs: 14000
    });

    console.log('  tarjetas del panel:', JSON.stringify(r.chips.map(c => c.titulo)));

    const fila = r.chips.find(c => c.titulo === 'CONTROL Resonant launch');
    comprobar(!!fila, 'la fila de la seccion de recompensas sigue teniendo tarjeta');

    if (fila) {
        const texto = fila.badges.map(b => b.texto).join(' | ');
        console.log('  sus chips:', JSON.stringify(fila.badges.map(b => b.texto)));
        comprobar(/Sierra Suit/.test(texto) && /Sierra Vest/.test(texto) && /Sierra Helmet/.test(texto),
            'y enseña SUS tres recompensas (Sierra Suit, Vest y Helmet)');
        comprobar(!/Don't Eat The Mold/.test(texto) && !/The Inverted Man/.test(texto),
            'y ninguna de la campaña de drops del mismo juego');
    }

    // EL CONTROL POSITIVO: la campaña de drops sigue con SU tarjeta y SUS dos premios. Sin
    // esto, «la fila ya no coge los de la otra» se cumpliria tambien borrandolos de todas.
    const drops = r.chips.find(c => /Twitch Gaming/.test(c.titulo || ''));
    comprobar(!!drops, 'la campaña de drops conserva su propia tarjeta');
    if (drops) {
        const texto = drops.badges.map(b => b.texto).join(' | ');
        console.log('  chips de la de drops:', JSON.stringify(drops.badges.map(b => b.texto)));
        comprobar(/Don't Eat The Mold/.test(texto) && /The Inverted Man/.test(texto),
            'con sus dos premios');
        comprobar(!/Sierra/.test(texto), 'y sin los de la campaña de recompensas');
    }

    // EL CONTROL NEGATIVO.
    comprobar(!r.chips.some(c => /Juego Sin Interes|Turtle Tunes/.test(c.titulo || '')),
        'la campaña de recompensas de un juego que no interesa NO entra');
    comprobar(!r.chips.some(c => c.badges.some(b => /Premio Ajeno/.test(b.texto))),
        'ni se cuela su premio en ninguna tarjeta');

    // Y LA MARCA DE LA PROPIA PAGINA, que es el otro sintoma del reporte: decia «⏱ 1h»,
    // que es el coste de la campaña de drops. El de esta son 4 h (240 min, Sierra Helmet).
    const marca = r.w.document.querySelector('.twitch-drop-page-mark');
    const textoMarca = marca ? (marca.textContent || '').trim() : '(ninguna)';
    console.log('  marca en la fila:', JSON.stringify(textoMarca));
    comprobar(/4\s*h/.test(textoMarca), 'la fila dice lo que cuesta llevarse LO SUYO (4 h)');

    // EL ENLACE DE CATEGORIA (2026-09-23). La campaña de recompensas enlaza la categoria a
    // secas —`/directory/category/control-2`, tres veces, una por premio— y pasa a llevar
    // SU id, no el de la campaña de drops que se llama igual.
    const enlaces = [...r.w.document.querySelectorAll('a[href*="/directory/category/"]')];
    console.log('  enlaces:', JSON.stringify(enlaces.map(a => a.getAttribute('href'))));
    comprobar(enlaces.length === 3, 'siguen siendo los tres enlaces del volcado');
    comprobar(enlaces.every(a => a.getAttribute('href') ===
        '/directory/category/control-2?filter=drops&dropID=' + CAMPAÑA_RECOMPENSAS.id),
        'los TRES llevan el id de la campaña de recompensas (no solo el primero)');
    comprobar(!enlaces.some(a => a.getAttribute('href').includes(CAMPAÑA_DROPS.id)),
        'ninguno se lleva el id de la campaña de drops homonima');
    comprobar(enlaces.every(a => a.getAttribute('data-drop-dir-filtered') === '1'),
        'y los tres van marcados en negrita');

    // LA ETIQUETA EN EL INVENTARIO, que es el reporte: ahi no hay fila de pagina y la
    // tarjeta sale de la entrada de la API de la campaña de recompensas, que entro por su
    // juego y no por ninguna keyword propia. Tenia que decir «twitch» y no decia nada.
    //
    // Y de paso el CONTROL NEGATIVO del enlace: un acordeon con un `filter=drops` dentro es
    // de drops, y su enlace de categoria a secas no es de la regla nueva aunque la cabecera
    // se llame como una campaña de recompensas.
    const ACORDEON_DE_DROPS = `
      <div id="control-drops-acordeon"><div class="accordion-header"><p>CONTROL Resonant launch</p>
        <img src="https://static-cdn.jtvnw.net/ttv-boxart/1338428218_IGDB-120x160.jpg"></div>
        <a class="tw-link" href="/directory/category/control-2?filter=drops">canal</a>
        <a class="tw-link" id="control-a-secas" href="/directory/category/control-2">CONTROL Resonant</a>
      </div>`;
    const inv = await run({
        url: 'https://www.twitch.tv/drops/inventory',
        keywords: ['twitch'],
        gql: { ViewerDropsDashboard: dashboard, Inventory: inventory, DropCampaignDetails: detallesDe },
        lateHtml: ACORDEON_DE_DROPS, lateMs: 4000,
        waitMs: 14000
    });
    const cards = [...inv.w.document.querySelectorAll('#twitch-drops-active-pane [data-notif-title]')];
    const etiquetas = (c) => [...c.querySelectorAll('.drop-kw-chips > span')].map(sp => sp.textContent.trim());
    console.log('  tarjetas del inventario:', JSON.stringify(cards.map(c =>
        [c.getAttribute('data-notif-title'), etiquetas(c)])));
    const rc = cards.find(c => /Sierra/.test(c.textContent));
    comprobar(!!rc, 'en el inventario sale la tarjeta de la campaña de recompensas');
    comprobar(!!rc && etiquetas(rc).includes('twitch'),
        'y dice la keyword que metio a su juego en el panel («twitch»)');
    const dr = cards.find(c => /Twitch Gaming/.test(c.getAttribute('data-notif-title') || ''));
    comprobar(!!dr && etiquetas(dr).includes('twitch'), 'CONTROL: la de drops la sigue diciendo');
    const aSecas = inv.w.document.getElementById('control-a-secas');
    comprobar(!!aSecas && aSecas.getAttribute('href') === '/directory/category/control-2',
        'CONTROL: el enlace a secas de un acordeon de drops no se toca');

    // EL SIERRA SUIT DUPLICADO (2026-09-23). Con el Suit ya concedido, la tarjeta pintaba
    // «Sierra Suit (1 h)» SIN tachar y, en otro chip, «✓ Sierra Suit»: el tramo solo se
    // tachaba contando concesiones contra grupos (1 < 3) y el chip de «lo que ya te dio»
    // no sabia que ese nombre ya era de un tramo. Ahora el tramo se tacha por su nombre y
    // el chip aparte no se repite.
    //
    // EL CONTROL es una campaña de recompensas del mismo juego con DOS grupos que dan lo
    // mismo («Premio Doble») y UNA concesion con ese nombre: no dice cual de los dos fue,
    // asi que ninguno se tacha, y el chip aparte se queda porque es lo unico que dice que
    // ya te llevaste uno.
    const DOBLE = {
        id: 'doble-0001', name: 'Doble launch', brand: '',
        startsAt: '2026-09-22T14:00:00Z', endsAt: '2099-10-13T13:59:59.999Z', status: 'UNKNOWN',
        game: CAMPAÑA_RECOMPENSAS.game,
        unlockRequirements: { subsGoal: 0, minuteWatchedGoal: 120 },
        rewards: [{ id: 'doble-r', name: 'Premio Doble' }],
        rewardGroups: [
            { id: 'doble-g1', unlockRequirements: { subsGoal: 0, minuteWatchedGoal: 60 }, rewards: [{ id: 'doble-r', name: 'Premio Doble' }] },
            { id: 'doble-g2', unlockRequirements: { subsGoal: 0, minuteWatchedGoal: 120 }, rewards: [{ id: 'doble-r', name: 'Premio Doble' }] }
        ]
    };
    const concedido = (id, name, campaignId, tipo) => ({ node: {
        id, item: { id, distributionType: tipo, name }, campaign: { id: campaignId },
        status: 'CLAIMED', earnedAt: '2026-09-23T10:00:00Z' } });
    const conSuit = await run({
        url: 'https://www.twitch.tv/drops/inventory',
        keywords: ['twitch'],
        gql: {
            ViewerDropsDashboard: [{ data: {
                currentUser: { id: '1', login: 'prueba', dropCampaigns: [CAMPAÑA_DROPS] },
                rewardCampaignsAvailableToUser: [CAMPAÑA_RECOMPENSAS, DOBLE] } }],
            Inventory: [{ data: { currentUser: { inventory: {
                dropCampaignsInProgress: [], gameEventDrops: [],
                earnedDropRewards: { edges: [
                    concedido('suit-concedido', 'Sierra Suit', CAMPAÑA_RECOMPENSAS.id, 'CODE'),
                    concedido('doble-concedido', 'Premio Doble', DOBLE.id, 'BADGE')
                ] } } } } }],
            DropCampaignDetails: detallesDe
        },
        waitMs: 14000
    });
    const premiosDe = (re) => {
        const t = conSuit.chips.find(c => re.test(c.titulo || ''));
        return t ? t.badges.flatMap(b => b.premios) : null;
    };
    const sierra = premiosDe(/^CONTROL Resonant launch/);
    console.log('  premios de CONTROL con el Suit concedido:', JSON.stringify(sierra));
    const suits = (sierra || []).filter(p => /Sierra Suit/.test(p.texto));
    comprobar(suits.length === 1, 'el Sierra Suit sale UNA vez, no dos');
    comprobar(suits.length === 1 && suits[0].tachado, 'y sale tachado');
    comprobar((sierra || []).some(p => /Sierra Vest/.test(p.texto) && !p.tachado) &&
              (sierra || []).some(p => /Sierra Helmet/.test(p.texto) && !p.tachado),
        'y el Vest y el Helmet siguen pendientes');
    const doble = premiosDe(/^Doble launch/);
    console.log('  premios de la campaña de homonimos:', JSON.stringify(doble));
    comprobar(!!doble && doble.filter(p => p.texto === 'Premio Doble' && !p.tachado).length === 2,
        'CONTROL: con dos tramos homonimos y una concesion, el tramo NO se tacha');
    comprobar(!!doble && doble.some(p => /Premio Doble/.test(p.texto) && p.tachado),
        'CONTROL: y el chip aparte de lo concedido se queda');

    console.log(fallos === 0 ? '\nTODO EN VERDE' : '\n' + fallos + ' COMPROBACIONES EN ROJO');
    process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
