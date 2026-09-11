// LA ETIQUETA QUE NO DECIA NADA.
//
// Hay reward campaigns que no se desbloquean viendo el directo sino con
// SUSCRIPCIONES: su `minuteWatchedGoal` es 0 y el requisito de verdad esta en
// `subsGoal`, que el panel no leia. Resultado: la recompensa salia con la etiqueta
// pelada y el tooltip VACIO —el unico caso en el que pasar el raton por encima no dice
// nada—, que se lee como "esto es gratis" cuando es justo lo contrario.
//
// Y un tramo de subs caia en el grupo 0 junto a los gratis, donde el deduplicado por
// nombre lo fundia con ellos. Eran dos fallos con el mismo origen.
//
// LA ETIQUETA DICE QUE HACE FALTA UNA SUSCRIPCION, NO CUANTAS, y este test lo fija.
// La cifra existe (`subsGoal`) y se llego a pintar, pero no describe lo que pide la
// campaña: Pokemon reparte TRES emblemas a una Great Ball por suscripcion —o sea tres—
// y la API declara 2. Se dice el tipo de requisito, que es lo que consta.
//
// De ahi el caso 1, que es el que protege la decision: los tres escalones de 1, 2 y 3
// subs reparten el MISMO premio, asi que sin cifra que los distinga tienen que salir en
// UNA etiqueta. Separados darian tres «Great Ball (sub)» seguidas, que no se leen como
// tres escalones sino como un fallo de pintado.
//
// Los datos son los del volcado real de `rewardCampaignsAvailableToUser` (2026-09-08),
// el mismo que usa test-emblema-concedido: la Great Ball de subs con sus tres grupos de
// 1, 2 y 3 subs, y la Poké Ball de 20 minutos como contraste.
//
// Y una campaña de DROPS puede pedir suscripcion TAMBIEN, pero por otro campo:
// `requiredSubs` en el tramo, no `unlockRequirements.subsGoal`. Son dos sistemas y dos
// consultas distintas, y por eso el emblema de GTA V salia mudo mientras la Great Ball
// decia su coste. El tramo de aqui es el volcado real del 2026-09-11 —«nopixel V Launch»,
// `requiredSubs: 1`, `requiredMinutesWatched: 0`, un benefit de tipo BADGE—.
//
// EL CONTROL NEGATIVO ES LA MITAD DEL TEST: un tramo con 0 minutos y SIN `requiredSubs`
// tambien llega con coste 0 y no pide ninguna sub. Si el arreglo hubiera deducido
// "0 minutos = subs" en vez de leer el campo, ese tramo diria "requiere suscripcion"
// siendo mentira, y el test pasaria igual sin este caso.
const { run } = require('./harness');

const CAMP_POKEBALL = '92f516f7-f6d5-4fa6-909a-48c5b94d2a43';
const CAMP_GREATBALL_SUBS = '9bdb6607-22c2-4317-b18a-1b6924e555d6';

const premio = (id, nombre) => ({
    id, name: nombre,
    thumbnailImage: { image1xURL: 'https://static-cdn.jtvnw.net/twitch-quests-assets/REWARD/y.png' },
    earnableUntil: '2099-10-01T07:00:00Z'
});

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

// La campaña de DROPS. Tres tramos: uno de 60 min, uno que pide UNA SUB y ningun minuto
// —la forma del emblema de suscriptor— y uno sin nada, que es el control negativo.
const dropCampaign = {
    id: 'c0ffee00-0000-4000-8000-000000000001',
    name: 'Marvel Rivals Drops', status: 'ACTIVE',
    startAt: '2026-08-24T17:00:00Z', endAt: '2099-10-01T07:00:00Z',
    game: { id: '1', displayName: 'Marvel Rivals', boxArtURL: 'https://x/box.jpg' },
    owner: { id: '2', login: 'marvel', displayName: 'Marvel' },
    self: { isAccountConnected: true },
    image: { image1xURL: 'https://x/campaign.png' }
};

const detalles = {
    data: {
        user: {
            id: '2',
            dropCampaign: {
                id: dropCampaign.id, name: dropCampaign.name,
                timeBasedDrops: [
                    { id: 'tramo-60', name: 'Una hora', requiredMinutesWatched: 60,
                      benefitEdges: [{ benefit: { id: 'b60', name: 'Spray', distributionType: 'DIRECT_ENTITLEMENT' } }] },
                    // El emblema de suscriptor, tal cual lo sirve Twitch: 0 minutos y
                    // `requiredSubs: 1`. Es el caso de «nopixel V Sub Badge».
                    { id: 'tramo-sub', name: 'Emblema', requiredMinutesWatched: 0, requiredSubs: 1,
                      benefitEdges: [{ benefit: { id: 'bsub', name: 'Emblema de suscriptor', distributionType: 'BADGE' } }] },
                    // Sin `requiredMinutesWatched` y sin `requiredSubs`: llega a 0 y no
                    // pide nada que se pueda escribir.
                    { id: 'tramo-0', name: 'De regalo',
                      benefitEdges: [{ benefit: { id: 'b0', name: 'Icono', distributionType: 'DIRECT_ENTITLEMENT' } }] }
                ]
            }
        }
    }
};

const dashboard = [{
    data: {
        currentUser: { id: '1', login: 'prueba', dropCampaigns: [dropCampaign] },
        rewardCampaignsAvailableToUser: [
            rewardCampaign(CAMP_POKEBALL, 'Poké Ball', '9a604770-9661-11f1-8842-0a58a9feac02',
                           [{ subs: 0, minutos: 20 }]),
            rewardCampaign(CAMP_GREATBALL_SUBS, 'Great Ball', '87989657-9661-11f1-9e11-0a58a9feac02',
                           [{ subs: 1, minutos: 0 }, { subs: 2, minutos: 0 }, { subs: 3, minutos: 0 }])
        ]
    }
}];

const inventory = [{
    data: { currentUser: { inventory: {
        dropCampaignsInProgress: [], gameEventDrops: [], earnedDropRewards: { edges: [] }
    } } }
}];

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok   ' : '  FALLA') + ' ' + msg); if (!ok) fallos++; };

(async () => {
    const r = await run({
        waitMs: 9000,
        keywords: ['pokemon', 'marvel'],
        gql: { ViewerDropsDashboard: dashboard, Inventory: inventory, DropCampaignDetails: [detalles] }
    });

    const pokemon = r.chips.find(x => /pok/i.test(x.titulo || ''));
    console.log('\n=== la campaña de subs ===');
    comprobar(!!pokemon, 'la tarjeta de Pokemon esta en el panel' +
        (pokemon ? '' : ' (titulos: ' + JSON.stringify(r.chips.map(x => x.titulo)) + ')'));
    if (pokemon) {
        console.log('  ' + JSON.stringify(pokemon.badges.map(b => ({ texto: b.texto, tooltip: b.tooltip }))));

        // 1. UN PREMIO, UNA ETIQUETA. Los tres escalones reparten la misma Great Ball
        //    y ya no se distinguen por cifra, asi que salen fundidos en una sola.
        const great = pokemon.badges.filter(b => /Great Ball/.test(b.texto));
        comprobar(great.length === 1,
            'los escalones de subs salen en UNA etiqueta (salen ' + great.length + ': ' +
            JSON.stringify(great.map(b => b.texto)) + ')');

        // 2. Y DICE QUE HACE FALTA UNA SUSCRIPCION, SIN CIFRA.
        comprobar(great.length === 1 && /\(\s*[^)\d]+\s*\)/.test(great[0].texto),
            'lleva el requisito entre parentesis: ' + (great[0] && great[0].texto));
        comprobar(great.every(b => !/\d/.test(b.texto.slice(b.texto.indexOf('(')))),
            'y NO lleva ningun numero: ' + JSON.stringify(great.map(b => b.texto)));

        // 3. EL TOOLTIP, que es lo que estaba vacio.
        const sinTooltip = great.filter(b => !b.tooltip);
        comprobar(sinTooltip.length === 0,
            'ninguna se queda sin tooltip (vacias: ' + sinTooltip.length + ')');
        comprobar(great.every(b => /suscripci|subscription/i.test(b.tooltip)),
            'el tooltip dice que se desbloquea con suscripciones: ' +
            JSON.stringify(great.map(b => b.tooltip)));
        // Y NO repite la palabra delante de la frase, que decia lo mismo dos veces.
        comprobar(great.every(b => !/^\s*\S+\s+·/.test(b.tooltip)),
            'el tooltip no antepone nada a la frase: «' + (great[0] && great[0].tooltip) + '»');

        // 4. LO DE SIEMPRE NO SE MUEVE: la Poké Ball es de tiempo y sigue en minutos.
        const bola = pokemon.badges.find(b => /Poké Ball/.test(b.texto));
        comprobar(!!bola && bola.texto.includes('(20 min)'), 'la Poké Ball sigue diciendo (20 min)');
        comprobar(!!bola && bola.tooltip === '20 min', 'y su tooltip sigue siendo «20 min», sin nada de subs');
    }

    console.log('\n=== la campaña de drops: el emblema de sub, y el 0 que no es de subs ===');
    const marvel = r.chips.find(x => /marvel/i.test(x.titulo || ''));
    comprobar(!!marvel, 'la tarjeta de la campaña de drops esta en el panel' +
        (marvel ? '' : ' (titulos: ' + JSON.stringify(r.chips.map(x => x.titulo)) + ')'));
    if (marvel) {
        console.log('  ' + JSON.stringify(marvel.badges.map(b => ({ texto: b.texto, tooltip: b.tooltip }))));
        const cero = marvel.badges.find(b => /Icono/.test(b.texto));
        const hora = marvel.badges.find(b => /Spray/.test(b.texto));
        const emblema = marvel.badges.find(b => /Emblema de suscriptor/.test(b.texto));

        // El tramo que SI pide sub, por el campo de las campañas de drops.
        comprobar(!!emblema, 'el tramo de `requiredSubs` esta');
        comprobar(!!emblema && /\([^)\d]+\)\s*$/.test(emblema.texto),
            'dice el requisito sin cifra: ' + (emblema && emblema.texto));
        comprobar(!!emblema && /suscripci|subscription/i.test(emblema.tooltip),
            'y su tooltip lo explica: «' + (emblema && emblema.tooltip) + '»');

        comprobar(!!cero, 'el tramo de 0 minutos esta');
        comprobar(!!cero && !/sub/i.test(cero.texto), 'NO dice subs en la etiqueta: ' + (cero && cero.texto));
        comprobar(!!cero && !/sub/i.test(cero.tooltip) && cero.tooltip === '',
            'NO se inventa un tooltip de suscripcion: «' + (cero && cero.tooltip) + '»');
        comprobar(!!hora && hora.texto.includes('(1 h)'), 'y el tramo de 60 min sigue diciendo (1 h)');
    }

    console.log('\n' + (fallos ? 'FALLOS: ' + fallos : 'TODO EN VERDE'));
    process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
