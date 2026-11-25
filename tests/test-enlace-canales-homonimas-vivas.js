// DOS CAMPAÑAS VIVAS DEL MISMO JUEGO CON EL MISMO NOMBRE.
//
// Visto el 2026-11-24 en Old School RuneScape: «OSRS Hardcore Worlds» es a la vez la
// campaña de «RuneScape Bones» (ver 60 min) y la de «RuneScape GnomePlush» (1 sub), las
// dos de Twitch Gaming, ACTIVE las dos, con dos minutos de diferencia en el arranque y el
// mismo cierre. Ni el juego (test-enlace-canales-nombre-repetido) ni el reloj
// (test-enlace-canales-torneo-diario) desempatan, y los dos enlaces de «un canal en vivo
// que participe» se quedaban como los escribio Twitch: la consola decia «sin campaña a la
// vista: 2» y el enlace salia sin negrita y sin el aviso de «toda la categoria», que es lo
// que son las dos (`allow.channels: null`).
//
// Lo que las separa esta en el bloque: cada sub-campaña enseña SUS recompensas, y
// `DropCampaignDetails` dice que reparte cada campaña.
//
// El volcado es el del torneo de Rocket League (dos sub-campañas en un acordeon, con sus
// baldosas), con UN retoque hecho aqui a la vista: la primera sub-campaña se renombra para
// que las dos se llamen igual. Asi el DOM es de Twitch y la homonimia es la de OSRS.
//
// Casos:
//   A. cada enlace se lleva el id de la campaña que reparte lo de su bloque, en negrita
//      y con el aviso de toda la categoria;
//   B. si una recompensa la reparten LAS DOS, el bloque que solo enseña esa no se
//      desempata y su enlace se queda como esta (el otro, si);
//   C. sin el detalle de las campañas (no casan con tus keywords) no se adivina nada.
//
// El caso A cubre ademas la CARRERA del indice, que salio al escribir este test: con el
// desempate ya puesto pero el indice de nombres todavia dentro del bucle que espera el
// detalle de cada campaña, los DOS enlaces salian con `subs-0001` —una pasada del
// filtrado a mitad de bucle veia a la primera homonima como unica—. O sea que el fallo de
// mandar a la campaña equivocada no es teorico: es lo que daba esta misma prueba.
//
// Control negativo (tiene que salir en ROJO con el codigo publicado):
//   git show HEAD:twitch-drops-highlighter.user.js > /tmp/pub.js
//   TW_SCRIPT=/tmp/pub.js node tests/test-enlace-canales-homonimas-vivas.js
const { run, readFixture } = require('./harness');

const dia = 86400000, hora = 3600000, ahora = Date.now();
const iso = (t) => new Date(t).toISOString();
const RL = '30921';
const NOMBRE = 'RL World Championship';

// La primera sub-campaña («RL Worlds Sub Drops») pasa a llamarse como la segunda.
const original = readFixture('fixture-campanas-torneo-diario.html');
const dump = original.replace(/RL Worlds Sub Drops/g, NOMBRE);

const camp = (id, desde) => ({
    id, name: NOMBRE, status: 'ACTIVE',
    startAt: iso(ahora + desde), endAt: iso(ahora + 6 * dia),
    owner: { name: 'Epic Games', login: 'epicgames' },
    game: { id: RL, displayName: 'Rocket League' }
});
const dashboard = [{
    data: {
        currentUser: {
            id: '1', login: 'prueba',
            dropCampaigns: [camp('subs-0001', -3 * hora), camp('watch-0002', -3 * hora + 120000)]
        },
        rewardCampaignsAvailableToUser: []
    }
}];
const inventory = [{ data: { currentUser: { inventory: { dropCampaignsInProgress: [], gameEventDrops: [], earnedDropRewards: { edges: [] } } } } }];

// Lo que reparte cada una, con los nombres de las baldosas del volcado: la primera
// sub-campaña enseña «Torque TX (Crimson)»; la segunda, las otras cuatro.
const tramos = (id, nombres) => nombres.map((n, i) => ({
    id: id + '-t' + i, name: n, requiredMinutesWatched: 60, requiredSubs: 0,
    benefitEdges: [{ benefit: { id: id + '-b' + i, name: n, distributionType: 'BADGE' } }]
}));
const detallesCon = (reparto) => (cuerpo) => {
    const id = (((cuerpo || [])[0] || {}).variables || {}).dropID || '';
    return [{ data: { user: { id: '1', dropCampaign: {
        id, name: NOMBRE, game: { id: RL },
        allow: { isEnabled: false, channels: null },
        timeBasedDrops: tramos(id, reparto[id] || [])
    } } } }];
};
const SEGUNDA = ['Apex Collection', 'Point Break (White)', 'Torque TX (Black)', 'Viled (White)'];

let fallos = 0;
const comprobar = (ok, msg, extra) => {
    console.log((ok ? '  ok    ' : '  FALLA ') + msg + (ok || extra === undefined ? '' : ` -> ${JSON.stringify(extra)}`));
    if (!ok) fallos++;
};
const enlacesDe = (r) => [...r.w.document.querySelectorAll('a[href*="/directory/category/"]')]
    .map(a => ({
        id: ((a.getAttribute('href') || '').match(/dropID=([^&]+)/) || [])[1] || '',
        negrita: a.getAttribute('data-drop-dir-filtered') === '1',
        aviso: a.getAttribute('title') || ''
    }));
const mirar = (keywords, reparto) => run({
    url: 'https://www.twitch.tv/drops/campaigns',
    dump, keywords, waitMs: 12000,
    gql: { ViewerDropsDashboard: dashboard, DropCampaignDetails: detallesCon(reparto), Inventory: inventory }
});

(async () => {
    if (dump === original || (dump.match(new RegExp(NOMBRE, 'g')) || []).length < 2) {
        console.log('FALLO: el retoque del volcado no se aplico');
        process.exit(1);
    }

    // A. Cada bloque, su campaña.
    const a = enlacesDe(await mirar(['rocket'], {
        'subs-0001': ['Torque TX (Crimson)'],
        'watch-0002': SEGUNDA
    }));
    console.log('  A:', JSON.stringify(a));
    comprobar(a.length === 2, 'siguen siendo los dos enlaces del volcado');
    comprobar(a[0] && a[0].id === 'subs-0001', 'el primero lleva la campaña que reparte «Torque TX (Crimson)»', a[0]);
    comprobar(a[1] && a[1].id === 'watch-0002', 'el segundo, la que reparte las otras cuatro', a[1]);
    comprobar(a.every(x => x.negrita), 'los dos quedan en negrita');
    comprobar(a.every(x => x.aviso.length > 0), 'y los dos dicen que participa toda la categoria', a.map(x => x.aviso));

    // B. Una recompensa compartida no desempata.
    const b = enlacesDe(await mirar(['rocket'], {
        'subs-0001': ['Torque TX (Crimson)'],
        'watch-0002': SEGUNDA.concat(['Torque TX (Crimson)'])
    }));
    console.log('  B:', JSON.stringify(b));
    comprobar(b[0] && b[0].id === '' && !b[0].negrita,
        'con «Torque TX (Crimson)» en las dos, el primer enlace se queda como lo escribio Twitch', b[0]);
    comprobar(b[1] && b[1].id === 'watch-0002',
        'y el segundo, cuyas recompensas solo reparte una, si se desempata', b[1]);

    // C. Sin detalle, nada.
    const c = enlacesDe(await mirar(['halo'], {
        'subs-0001': ['Torque TX (Crimson)'],
        'watch-0002': SEGUNDA
    }));
    console.log('  C:', JSON.stringify(c));
    comprobar(c.length === 2 && c.every(x => x.id === '' && !x.negrita),
        'sin el detalle de las campañas los dos enlaces se quedan como estan', c);

    console.log(fallos ? `\n  ${fallos} FALLAN` : '\n  todo en verde');
    process.exit(fallos ? 1 : 0);
})();
