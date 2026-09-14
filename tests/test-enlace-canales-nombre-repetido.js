// DOS JUEGOS PUEDEN LLAMAR IGUAL A SU CAMPAÑA, Y LOS NOMBRES CORRIENTES LO HACEN.
//
// El enlace de «un canal en vivo que participe» se filtra por campaña cruzando el
// `<strong>` que Twitch imprime sobre cada sub-campaña con el indice de nombres que deja
// la API. Un nombre repetido entre DOS campañas guarda `null` —deja de identificar nada—
// y ese enlace se queda con el de Twitch.
//
// Eso, que parecia una precaucion para casos raros, resulta ser el caso normal: el
// 2026-09-13, en la pagina de campañas, «Twitch Drops» a secas era el nombre de la unica
// campaña de Lords Mobile y tambien de la de Doomsday: Last Survivors, y ninguno de los
// dos enlaces se filtro. Lo mismo con «September Week 2» de MARVEL Contest of Champions,
// mientras su vecina «September Week 2 - CCP» si se filtraba: de ahi el sintoma con el
// que se reporto —«funciona con la primera campaña y no con la segunda»—, que no tenia
// nada que ver con el orden.
//
// Lo que se comprueba aqui es que el desempate por JUEGO devuelve esos enlaces: los tres
// de LEGO Batman siguen llevando el id de SU sub-campaña aunque otro juego tenga una
// campaña llamada exactamente igual que una de ellas.
//
// Control negativo (tiene que salir en ROJO con el codigo publicado):
//   git show HEAD:twitch-drops-highlighter.user.js > /tmp/pub.js
//   TW_SCRIPT=/tmp/pub.js node tests/test-enlace-canales-nombre-repetido.js
const { run, readFixture } = require('./harness');

const dia = 86400000, ahora = Date.now();
const iso = (t) => new Date(t).toISOString();
// `game.id` importa aqui tanto como el nombre: es el que tiene que casar con el de la
// caratula del acordeon del volcado (`ttv-boxart/1813168901_IGDB-120x160.jpg`).
const LEGO = '1813168901';
const camp = (id, name, juego, gid) => ({
    id, name, status: 'ACTIVE',
    startAt: iso(ahora - dia), endAt: iso(ahora + 5 * dia),
    owner: { name: 'Estudio', login: 'estudio' },
    game: { id: gid, displayName: juego }
});

const dashboard = [{
    data: {
        currentUser: {
            id: '1', login: 'prueba',
            dropCampaigns: [
                camp('lego-harley-0003', 'Harley Mayhem', 'LEGO Batman: Legacy of the Dark Knight', LEGO),
                camp('lego-launch-0004', 'Mayhem Collection Launch', 'LEGO Batman: Legacy of the Dark Knight', LEGO),
                camp('lego-joker-0005', 'Joker Mayhem', 'LEGO Batman: Legacy of the Dark Knight', LEGO),
                // El homonimo, que es la unica diferencia con test-enlace-canales-campanas:
                // otro juego, otro id de campaña, MISMO nombre que una de LEGO.
                camp('otro-harley-9999', 'Harley Mayhem', 'Otro Juego Cualquiera', '77')
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

    const lego = [...r.w.document.querySelectorAll('a[href*="/directory/category/"]')]
        .map(a => a.getAttribute('href'))
        .filter(h => h.includes('lego-batman-legacy-of-the-dark-knight'));
    console.log('  enlaces de LEGO:', JSON.stringify(lego, null, 1));

    comprobar(lego.length === 3, 'siguen siendo los tres enlaces de LEGO del volcado');
    comprobar(lego.every(h => /[?&]dropID=/.test(h)),
        'los tres llevan id pese al homonimo de otro juego');

    const ids = lego.map(h => (h.match(/dropID=([^&]+)/) || [])[1]);
    comprobar(ids.includes('lego-harley-0003'),
        'el de «Harley Mayhem» es el de LEGO y no se quedo sin id por el homonimo');
    comprobar(!ids.includes('otro-harley-9999'),
        'y no es el del OTRO juego, que seria mandar al usuario a la campaña equivocada');
    comprobar(new Set(ids).size === 3, 'y siguen siendo tres ids distintos');

    console.log(fallos ? `\n  ${fallos} FALLAN` : '\n  todo en verde');
    process.exit(fallos ? 1 : 0);
})();
