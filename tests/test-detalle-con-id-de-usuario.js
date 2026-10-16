// `DropCampaignDetails` pide ahora el ID DE LA CUENTA en `channelLogin`.
//
// Reportado el 2026-10-15: el panel paso de 23 campañas a una y la consola decia «tipos
// de recompensa: {}». La pagina de Twitch manda en `channelLogin` el id numerico del
// usuario, y medido ese dia en el navegador, con `'twitch'` la respuesta llega con
// `user: null`, sin error y sin datos. El script mandaba el login del dueño o `'twitch'`.
//
// El mock reproduce eso: tramos solo si `channelLogin` es el id; con otra cosa, `user:
// null`. Dos vueltas, por las dos fuentes del id:
//   1. el id viene en `ViewerDropsDashboard` (`currentUser.id`);
//   2. no viene, y sale de la consulta propia `DropsHighlighterCurrentUser`.
// Contra 1.3.27 fallan las dos: ahi el parametro nunca es el id.
const { run } = require('./harness');

const dia = 864e5, ahora = Date.now(), iso = ms => new Date(ms).toISOString();

const dashboard = [{
    data: {
        currentUser: {
            id: '123456789', login: 'prueba',
            dropCampaigns: [{
                id: '4185d21c-7dd1-41f8-9e8f-4f52c7b27622',
                name: 'Ironmouse Subathon 2026',
                status: 'ACTIVE',
                startAt: iso(ahora - dia), endAt: iso(ahora + 20 * dia),
                owner: { name: 'Twitch Gaming', login: 'twitch' },
                game: { id: '509663', displayName: 'Special Events' }
            }]
        },
        rewardCampaignsAvailableToUser: []
    }
}];

const detalles = [{
    data: {
        user: {
            dropCampaign: {
                timeBasedDrops: [{
                    id: 'tramo-1', name: 'IronmouseWah Emote', requiredMinutesWatched: 30,
                    benefitEdges: [{ benefit: { id: 'b1', name: 'IronmouseWah Emote', distributionType: 'EMOTE' } }]
                }]
            }
        }
    }
}];

const inventory = [{
    data: { currentUser: { inventory: { dropCampaignsInProgress: [], gameEventDrops: [], earnedDropRewards: { edges: [] } } } }
}];

const ID = '123456789';
const detallesSegun = (cuerpo) => {
    const v = (cuerpo && cuerpo[0] && cuerpo[0].variables) || {};
    return v.channelLogin === ID ? detalles : [{ data: { user: null } }];
};
const sinId = JSON.parse(JSON.stringify(dashboard));
delete sinId[0].data.currentUser.id;

const tarjeta = (r) => {
    const c = Array.from(r.w.document.querySelectorAll('#twitch-drops-active-pane [data-notif-title]'))
        .find(x => /special events|eventos especiales/i.test(x.getAttribute('data-notif-title') || ''));
    return c ? c.textContent.replace(/\s+/g, ' ').trim() : null;
};

(async () => {
    const fallos = [];
    const casos = [
        ['el id viene en el dashboard', { ViewerDropsDashboard: dashboard }],
        ['el id sale de la consulta propia', { ViewerDropsDashboard: sinId,
            DropsHighlighterCurrentUser: [{ data: { currentUser: { id: ID } } }] }]
    ];
    for (const [nombre, gql] of casos) {
        const r = await run({ waitMs: 10000, keywords: ['twitch'],
            gql: Object.assign({ DropCampaignDetails: detallesSegun, Inventory: inventory }, gql) });
        const t = tarjeta(r);
        console.log(nombre + ':', t);
        if (!t) fallos.push(nombre + ': la campaña no llego al panel');
        else if (!/IronmouseWah Emote/.test(t)) fallos.push(nombre + ': la tarjeta salio sin tramos -> ' + t);
    }
    console.log(fallos.length ? 'FALLOS: ' + fallos.join(' | ') : 'TODO OK');
    process.exit(fallos.length ? 1 : 0);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
