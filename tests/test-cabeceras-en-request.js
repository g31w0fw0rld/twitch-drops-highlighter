// El token y el integrity se capturan aunque la pagina los mande DENTRO de un Request.
//
// Reportado el 2026-10-15: en el navegador movil, y en escritorio simulando movil, la
// consulta a la API fallaba. El interceptor solo leia las cabeceras de las opciones de
// `fetch(url, opciones)`, y con `instanceof Headers`, que da false con un Headers creado
// por la pagina —el script vive en el sandbox de Tampermonkey, otro realm—. Si Twitch
// pide sus GQL con `fetch(new Request(url, init))`, el script no veia el token nunca y,
// a los 20 s, caia a la API publica.
//
// OJO: que Twitch movil lo haga asi es la SOSPECHA, no esta visto. Lo que este test
// asegura es que esa forma ya no deja al script sin token; si en movil sigue fallando,
// el mensaje de la consola dice ahora que pieza falto.
//
// Se siembra con `siembraEnRequest`, que manda las cabeceras dentro del primer
// argumento y en un objeto con `forEach`/`get` que NO es `instanceof Headers`. Si la
// captura funciona, la campaña llega por GQL y su tarjeta sale en el panel.
const { run } = require('./harness');

const dia = 864e5, ahora = Date.now(), iso = ms => new Date(ms).toISOString();

const dashboard = [{
    data: {
        currentUser: {
            id: '1', login: 'prueba',
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

(async () => {
    const r = await run({
        waitMs: 9000,
        keywords: ['twitch'],
        siembraEnRequest: true,
        gql: { ViewerDropsDashboard: dashboard, DropCampaignDetails: detalles, Inventory: inventory }
    });
    const card = Array.from(r.w.document.querySelectorAll('#twitch-drops-active-pane [data-notif-title]'))
        .find(c => /special events|eventos especiales/i.test(c.getAttribute('data-notif-title') || ''));
    const texto = card ? card.textContent.replace(/\s+/g, ' ').trim() : null;
    console.log('tarjeta:', texto);

    const fallos = [];
    if (!card) fallos.push('la campaña de la API no llego al panel: el token no se capturo del Request');
    else if (!/IronmouseWah Emote/.test(texto)) fallos.push('la tarjeta salio sin el tramo de DropCampaignDetails: ' + texto);

    console.log(fallos.length ? 'FALLOS: ' + fallos.join(' | ') : 'TODO OK');
    process.exit(fallos.length ? 1 : 0);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
