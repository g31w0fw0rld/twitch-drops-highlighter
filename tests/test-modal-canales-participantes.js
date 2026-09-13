// EL MODAL DE CANALES PARTICIPANTES, QUE ES LO QUE KICK DA NATIVO Y TWITCH NO.
//
// La lista sale de `allow.channels` de `DropCampaignDetails` —la misma que publica
// twitchdrops.app— y no del directorio, asi que el modal y el enlace dicen cosas
// distintas: uno quien PUEDE, el otro quien esta EN DIRECTO. Por eso el enlace tiene que
// seguir estando dentro del modal.
//
// LA REGLA es una sola: se intercepta cuando hay lista y ya la tenemos. En cualquier
// otro caso el enlace se queda siendo un enlace. Los casos que se prueban son los que
// se dan de verdad, medidos sobre 26 campañas reales el 2026-09-12:
//   · campaña CON lista (5 de 26) -> se abre el modal con los canales;
//   · campaña SIN lista (21 de 26) -> NO se abre nada: es la mitad de la incoherencia
//     que se vio en pantalla, con «No Man's Sky» yendo al directorio y «September 2026»
//     abriendo un modal para decir que tampoco tenia canales;
//   · campaña cuya lista AUN NO HA LLEGADO -> tampoco se abre nada, que es la otra
//     mitad. Sin esto volveria el modal vacio, solo que ahora para las campañas que no
//     casan con tus keywords.
//
// Y el control que mas importa: que ctrl+clic siga abriendo el enlace. Interceptar el clic
// es facil; hacerlo sin quitarle al usuario el «abrir en otra pestaña» es lo que se puede
// romper sin que ningun href lo delate.
const { run, readFixture } = require('./harness');

const dia = 86400000, ahora = Date.now(), iso = (t) => new Date(t).toISOString();
const camp = (id, name, juego) => ({
    id, name, status: 'ACTIVE', startAt: iso(ahora - dia), endAt: iso(ahora + 5 * dia),
    owner: { name: 'Estudio', login: 'estudio' }, game: { id: '1', displayName: juego }
});
const dashboard = [{ data: { currentUser: { id: '1', login: 'p', dropCampaigns: [
    camp('halo-btb-0001', 'BTB Ladies Night-SEP12', 'Halo: The Master Chief Collection'),
    camp('lego-harley-0003', 'Harley Mayhem', 'LEGO Batman: Legacy of the Dark Knight')
] }, rewardCampaignsAvailableToUser: [] } }];
const detalles = (canales) => ([{ data: { user: { dropCampaign: {
    timeBasedDrops: [],
    allow: { channels: canales.map((n, i) => ({ id: String(i), name: n, displayName: n })) }
} } } }]);
const inventory = [{ data: { currentUser: { inventory: {
    dropCampaignsInProgress: [], gameEventDrops: [], earnedDropRewards: { edges: [] } } } } }];

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok    ' : '  FALLA ') + msg); if (!ok) fallos++; };

const base = (canales, extra) => ({
    url: 'https://www.twitch.tv/drops/campaigns',
    dump: readFixture('fixture-campanas-acordeon-expandido.html'),
    keywords: ['halo'], waitMs: 13000,
    gql: { ViewerDropsDashboard: dashboard, DropCampaignDetails: detalles(canales), Inventory: inventory },
    ...extra
});
// El enlace de Halo es el primero del volcado; los de LEGO van detras.
const HALO = 'a[data-drop-dir-filtered="1"]';
const modalDe = (w) => [...w.document.querySelectorAll('div')]
    .find(d => d.textContent.includes('Canales participantes') && d.querySelector('a[href*="twitch.tv/"]'));

(async () => {
    console.log('\n=== campaña CON lista: el clic abre el modal ===');
    const r1 = await run(base(['iblodreina', 'frickenrael', 'prowife'],
        { clicarSelector: HALO, clicarIndice: 0, clicarEnMs: 9000 }));
    const m1 = modalDe(r1.w);
    comprobar(!!m1, 'se abre el modal');
    const nombres = m1 ? [...m1.querySelectorAll('a[href*="twitch.tv/"]')].map(a => a.textContent) : [];
    console.log('  canales:', JSON.stringify(nombres));
    comprobar(nombres.includes('iblodreina') && nombres.includes('frickenrael') && nombres.includes('prowife'),
        'con los tres canales de la campaña');
    const dir = m1 && [...m1.querySelectorAll('a')].find(a => /dropID=/.test(a.getAttribute('href') || ''));
    comprobar(!!dir, 'y el enlace al directorio sigue dentro, que es quien dice quien esta EN DIRECTO');

    // La frase que explica la lista no puede vivir dentro del contenedor con scroll:
    // ahi se va hacia arriba en cuanto bajas por la lista.
    const scrollable = m1 && [...m1.querySelectorAll('div')]
        .find(d => d.style.overflowY === 'auto' && d.style.maxHeight.includes('vh')
                   && d.querySelector('a[href*="twitch.tv/"]'));
    comprobar(!!scrollable && !scrollable.textContent.includes('Mira cualquiera'),
        'la frase de ayuda queda FUERA del contenedor que scrollea');
    comprobar(!!m1 && m1.textContent.includes('Mira cualquiera'),
        'pero sigue estando en el modal');

    console.log('\n=== campaña SIN lista: no se intercepta nada ===');
    const rSin2 = await run(base([], { clicarSelector: HALO, clicarIndice: 0, clicarEnMs: 9000 }));
    comprobar(!modalDe(rSin2.w), 'no se abre modal cuando participa toda la categoria');
    comprobar(!!rSin2.w.document.querySelector(HALO), 'y el enlace sigue ahi, reescrito como estaba');

    // Y lo que en esa campaña no puede ser un modal es un aviso: el enlace lleva el
    // `title` con la frase, y ademas la marca que lo mete en el ambito del motor de
    // avisos propio —sin ella lo pintaria el navegador, que es otro aviso—.
    const aSin = rSin2.w.document.querySelector(HALO);
    comprobar(!!aSin && /toda la categor/i.test(aSin.getAttribute('title') || ''),
        'el enlace avisa de que participa toda la categoria');
    comprobar(!!aSin && aSin.hasAttribute('data-drop-dir-filtered'),
        'y lleva la marca que hace que ese aviso lo pinte la caja del script');

    console.log('\n=== lista aun sin llegar: el enlace sigue siendo un enlace ===');
    // `keywords: ['zzz']` para que NINGUNA campaña pase el filtro: asi no se piden
    // detalles de nada y no hay nada cacheado cuando llega el clic, que es exactamente
    // el estado de una campaña ajena a tus keywords antes de apuntarla.
    const rSin = await run(base(['iblodreina'],
        { keywords: ['zzz'], clicarSelector: HALO, clicarIndice: 0, clicarEnMs: 9000 }));
    comprobar(!modalDe(rSin.w), 'sin lista en mano no se abre modal, ni siquiera uno de «cargando»');

    console.log('\n=== ctrl+clic: se respeta el enlace ===');
    const r3 = await run(base(['iblodreina'], {}));
    const a3 = r3.w.document.querySelector(HALO);
    let pordefecto = true;
    a3.addEventListener('click', (e) => { pordefecto = !e.defaultPrevented; });
    a3.dispatchEvent(new r3.w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true }));
    comprobar(pordefecto, 'con ctrl NO se llama a preventDefault: la pestaña nueva sigue funcionando');
    comprobar(!modalDe(r3.w), 'y no se abre el modal');

    console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo en verde');
    process.exit(fallos ? 1 : 0);
})();
