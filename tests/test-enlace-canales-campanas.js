// EN /drops/campaigns EL DOM NO DICE DE QUE CAMPAÑA ES CADA ENLACE.
//
// En el inventario el `dropID` esta al lado del enlace; aqui no esta en ninguna parte
// —cero apariciones en los dos acordeones desplegados del volcado— y ademas un acordeon
// es UN JUEGO con VARIAS campañas dentro, todas enlazando el mismo slug. El de LEGO
// Batman trae cuatro. Asi que el error natural es darles a las cuatro el mismo id, y ese
// error sale verde si el test solo cuenta cuantos enlaces llevan ya `dropID`.
//
// Por eso lo que se comprueba es que los TRES enlaces de LEGO Batman acaben con TRES ids
// distintos, cada uno el de su sub-campaña, y que el cuarto bloque —«Mayhem Collection -
// DC», que no tiene enlace de directorio porque solo participa un canal— no invente uno.
//
// Las keywords son solo `halo` a proposito: es el control de que el indice de campañas se
// puebla ANTES del filtro. Si se poblara despues, los tres enlaces de LEGO —que no casan
// con ninguna keyword— se quedarian con el de Twitch.
const { run, readFixture } = require('./harness');

const dia = 86400000, ahora = Date.now();
const iso = (t) => new Date(t).toISOString();
const camp = (id, name, juego) => ({
    id, name, status: 'ACTIVE',
    startAt: iso(ahora - dia), endAt: iso(ahora + 5 * dia),
    owner: { name: 'Estudio', login: 'estudio' },
    game: { id: '1', displayName: juego }
});

const dashboard = [{
    data: {
        currentUser: {
            id: '1', login: 'prueba',
            dropCampaigns: [
                camp('halo-btb-0001', 'BTB Ladies Night-SEP12', 'Halo: The Master Chief Collection'),
                camp('lego-dc-0002', 'Mayhem Collection - DC', 'LEGO Batman: Legacy of the Dark Knight'),
                camp('lego-harley-0003', 'Harley Mayhem', 'LEGO Batman: Legacy of the Dark Knight'),
                camp('lego-launch-0004', 'Mayhem Collection Launch', 'LEGO Batman: Legacy of the Dark Knight'),
                camp('lego-joker-0005', 'Joker Mayhem', 'LEGO Batman: Legacy of the Dark Knight')
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
        dump: readFixture('fixture-campanas-acordeon-expandido.html'),
        keywords: ['halo'],
        waitMs: 12000,
        gql: { ViewerDropsDashboard: dashboard, DropCampaignDetails: detalles, Inventory: inventory }
    });

    const enlaces = [...r.w.document.querySelectorAll('a[href*="/directory/category/"]')]
        .map(a => a.getAttribute('href'));
    console.log('  enlaces:', JSON.stringify(enlaces, null, 1));

    comprobar(enlaces.length === 4, 'siguen siendo los cuatro enlaces del volcado');

    const halo = enlaces.filter(h => h.includes('halo-the-master-chief-collection'));
    const lego = enlaces.filter(h => h.includes('lego-batman-legacy-of-the-dark-knight'));
    comprobar(halo.length === 1 && halo[0].includes('dropID=halo-btb-0001'),
        'el «entre otros» de Halo lleva el id de BTB Ladies Night-SEP12');
    comprobar(lego.length === 3 && lego.every(h => /[?&]dropID=/.test(h)),
        'los tres de LEGO llevan id aunque «lego» no sea una de tus keywords');

    const ids = lego.map(h => (h.match(/dropID=([^&]+)/) || [])[1]);
    console.log('  ids de LEGO:', JSON.stringify(ids));
    comprobar(new Set(ids).size === 3, 'y son TRES ids distintos, no el mismo repetido');
    comprobar(ids.includes('lego-harley-0003') && ids.includes('lego-launch-0004') && ids.includes('lego-joker-0005'),
        'cada uno es el de SU sub-campaña');
    comprobar(!ids.includes('lego-dc-0002'),
        'y ninguno se queda con el de «Mayhem Collection - DC», que no tiene enlace');


    const marcados = [...r.w.document.querySelectorAll('a[data-drop-dir-filtered="1"]')].length;
    const hoja = r.w.document.getElementById('twitch-drops-dir-css');
    comprobar(marcados === 4, 'los cuatro quedan marcados para salir en negrita');
    comprobar(!!hoja && /font-weight:\s*700/.test(hoja.textContent), 'y la hoja esta puesta');
    console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo en verde');
    process.exit(fallos ? 1 : 0);
})();
