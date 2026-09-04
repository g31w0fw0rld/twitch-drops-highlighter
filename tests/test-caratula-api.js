// LA CARATULA DE UNA TARJETA QUE VIENE DE LA API.
//
// En /drops/inventory el panel se llena de la API, y esas tarjetas no traen `<img>`:
// la URL se compone. Y componerla tiene una trampa que NO se puede detectar en el
// navegador: Twitch no da 404 a una caratula que no existe, redirige a su propio
// placeholder, que carga con un 200. Medido el 2026-09-02:
//
//   509663_IGDB-144x192.jpg -> 302 -> ttv-static/404_boxart-144x192.jpg (200, JPEG)
//   509663-144x192.jpg      -> 200, el PNG de verdad
//
// Asi que el `onerror` del <img> no salta y la cadena de respaldo no avanza NUNCA:
// con `_IGDB` delante, «Eventos especiales - Twitch Gaming» (gameId 509663) se
// quedaba con el marco gris de «sin caratula» en el panel, mientras en la pagina de
// campañas se veia bien —ahi la tarjeta la trae el DOM con el <img> de Twitch—.
//
// Lo que se comprueba es el PRIMER `src` que se intenta, que es lo unico que decide:
// lo que venga detras no se llega a probar. En jsdom las imagenes no cargan, asi que
// el primer src es TAMBIEN el ultimo, lo cual va bien aqui.
const { run } = require('./harness');

const ID_JUEGO = '509663';                       // Special Events / «Eventos especiales»
const PLANA = 'https://static-cdn.jtvnw.net/ttv-boxart/' + ID_JUEGO + '-144x192.jpg';
const IGDB = 'https://static-cdn.jtvnw.net/ttv-boxart/' + ID_JUEGO + '_IGDB-144x192.jpg';
// La que daria la API en su plantilla, ya rellenada.
const DE_LA_API = 'https://static-cdn.jtvnw.net/ttv-boxart/' + ID_JUEGO + '-144x192.jpg?deLaApi=1';

const dia = 864e5, ahora = Date.now(), iso = ms => new Date(ms).toISOString();

// El campo `game` con y sin `boxArtURL`: son los dos casos que se dan de verdad —la
// consulta es persistida, asi que Twitch decide si manda la URL o solo el id—.
const dashboard = (conUrl) => ([{
    data: {
        currentUser: {
            id: '1', login: 'prueba',
            dropCampaigns: [{
                id: '4185d21c-7dd1-41f8-9e8f-4f52c7b27622',
                name: 'Ironmouse Subathon 2026',
                status: 'ACTIVE',
                startAt: iso(ahora - dia), endAt: iso(ahora + 20 * dia),
                owner: { name: 'Twitch Gaming', login: 'twitch' },
                game: conUrl
                    ? { id: ID_JUEGO, displayName: 'Special Events', boxArtURL: DE_LA_API.replace('144', '{width}').replace('192', '{height}') }
                    : { id: ID_JUEGO, displayName: 'Special Events' }
            }]
        },
        rewardCampaignsAvailableToUser: []
    }
}]);

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

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok   ' : '  FALLA') + ' ' + msg); if (!ok) fallos++; };

const primerSrc = (w) => {
    const card = Array.from(w.document.querySelectorAll('#twitch-drops-active-pane [data-notif-title]'))
        .find(c => /special events|eventos especiales/i.test(c.getAttribute('data-notif-title') || ''));
    if (!card) return null;
    const img = card.querySelector('img');
    return img ? img.getAttribute('src') : '(la tarjeta no pinto imagen)';
};

(async () => {
    for (const conUrl of [true, false]) {
        console.log('\n=== la API ' + (conUrl ? 'SI' : 'NO') + ' da boxArtURL ===');
        const r = await run({
            waitMs: 9000,
            // «twitch» casa con el dueño de la campaña (Twitch Gaming), que es por
            // donde entra de verdad: su nombre de juego («Special Events») no casa con
            // ninguna keyword, asi que sin esto la tarjeta no se pinta y el test mide
            // el filtro en vez de la caratula.
            keywords: ['twitch'],
            gql: {
                ViewerDropsDashboard: dashboard(conUrl),
                DropCampaignDetails: detalles,
                Inventory: inventory
            }
        });
        const src = primerSrc(r.w);
        console.log('  primer src:', src);
        comprobar(!!src && src !== '(la tarjeta no pinto imagen)', 'la tarjeta de la API pinta imagen');
        comprobar(src !== IGDB, 'NO se intenta primero la forma _IGDB, que en este juego cae en el placeholder');
        if (conUrl) {
            comprobar(src === DE_LA_API, 'se usa la URL que dio la API, sin adivinar nada');
        } else {
            comprobar(src === PLANA, 'sin URL de la API se adivina, y la forma plana va primera');
        }
    }
    console.log(fallos === 0 ? '\nTODO EN VERDE' : '\n' + fallos + ' COMPROBACIONES EN ROJO');
    process.exit(fallos === 0 ? 0 : 1);
})();
