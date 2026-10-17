// RECLAMAR UN DROP PASA EL BADGE A ✓ SIN RECARGAR.
//
// Reportado el 2026-10-01: en Kick, al reclamar, el chip del panel dejaba el 🎁 y pasaba a
// ✓ en segundos; en Twitch se quedaba en 🎁 hasta recargar. La causa: el inventario se
// pedia UNA vez, al cargar, y de esa respuesta cuelga todo lo que dice «reclamado». Kick
// no tenia el fallo porque alli la propia pagina vuelve a pedir /drops/progress tras
// reclamar y el interceptor lo lee de paso; el de Twitch solo toma cabeceras y no lee
// ninguna respuesta, asi que aunque la pagina volviera a pedirlo, el script no se enteraba.
//
// El arreglo relee el inventario por dos avisos, y se prueba cada uno por separado,
// porque el segundo existe justo para cuando el primero no casa:
//   A. la respuesta de la mutacion de reclamar (`DropsPage_ClaimDropRewards`);
//   B. el clic en un boton de reclamar de la pagina, sin mutacion que lo acompañe;
//   C. control: sin reclamar no se relee, ni con el filtro «Sin reclamar» del panel —que
//      lleva la palabra, pero es un <span>— ni con un <button> «Reclamar» DENTRO del panel,
//      que es lo que la exclusion del oyente deja fuera;
//   D. una tanda de reclamos seguidos acaba en UNA sola consulta.
//
// CONTROL DE SENSIBILIDAD (A y B comprueban que algo cambia, pero C y D que algo NO pasa):
//     git show HEAD:twitch-drops-highlighter.user.js > /tmp/pub.js
//     TW_SCRIPT=/tmp/pub.js node tests/test-releer-tras-reclamar.js
// Con el codigo de 1.3.23, A y B se quedan en 🎁 y sin una segunda consulta de inventario.
// C pasa tambien ahi por construccion —sin oyente no hay nada que se dispare—, asi que su
// control es otro: una COPIA del script sin la exclusion del panel (no se toca el fichero):
//     sed "s/if (!btn || btn.closest('#twitch-drops-panel')) return;/if (!btn) return;/" \
//         twitch-drops-highlighter.user.js > /tmp/sin-exclusion.js
//     TW_SCRIPT=/tmp/sin-exclusion.js node tests/test-releer-tras-reclamar.js
// y ahi C sale con dos consultas. Y el de D, quitando el `clearTimeout` en otra copia:
//     sed "s/if (_releerInventarioTimer) clearTimeout(_releerInventarioTimer);//" ...
// sale con siete consultas en vez de dos.
const { run } = require('./harness');

const CAMP = 'f00dbabe-5555-4c2a-9a01-000000000005';
const DROP = 'drop-reclamable-1';
const BENE = 'bene-reclamable-1';
const NOMBRE = 'Casco de prueba';

const AYER = new Date(Date.now() - 86400e3).toISOString();
const MAÑANA = new Date(Date.now() + 86400e3).toISOString();

const dashboard = [{
    data: {
        currentUser: {
            id: '1', login: 'prueba',
            dropCampaigns: [{
                id: CAMP, name: 'Temporada de prueba', status: 'ACTIVE',
                startAt: AYER, endAt: MAÑANA,
                game: { id: '30921', displayName: 'Rocket League',
                        boxArtURL: 'https://static-cdn.jtvnw.net/ttv-boxart/30921-{width}x{height}.jpg' },
                owner: { id: '9', name: 'Epic Games', login: 'epicgames' }
            }]
        },
        rewardCampaignsAvailableToUser: []
    }
}];

const beneficio = { id: BENE, name: NOMBRE, distributionType: 'DIRECT_ENTITLEMENT',
                    imageAssetURL: 'https://static-cdn.jtvnw.net/twitch-quests-assets/REWARD/x.png' };

const detalles = [{
    data: { user: { dropCampaign: { id: CAMP, timeBasedDrops: [{
        id: DROP, name: NOMBRE, requiredMinutesWatched: 60, benefitEdges: [{ benefit: beneficio }]
    }] } } }
}];

// El tramo, CUMPLIDO: 60 de 60. Sin reclamar es el 🎁; reclamado, el ✓. `estado.reclamado`
// es lo que cambia «en el servidor» cuando el test reclama.
const inventario = (estado) => () => ([{
    data: { currentUser: { inventory: {
        dropCampaignsInProgress: [{
            id: CAMP, name: 'Temporada de prueba', status: 'ACTIVE',
            game: { id: '30921', displayName: 'Rocket League' },
            timeBasedDrops: [{
                id: DROP, name: NOMBRE, requiredMinutesWatched: 60,
                benefitEdges: [{ benefit: beneficio }],
                self: { currentMinutesWatched: 60, isClaimed: estado.reclamado }
            }]
        }],
        gameEventDrops: [],
        earnedDropRewards: { edges: [] }
    } } }
}]);

const respuestaReclamo = [{ data: { claimDropRewards: { status: 'ELIGIBLE_FOR_ALL', dropID: DROP } } }];

// El chip del tramo en el panel, leido igual que el arnes (`chips`), pero en el momento
// que se pida: el arnes solo lo lee una vez, y aqui lo que importa es el ANTES y el DESPUES.
function chipDelTramo(w) {
    const card = Array.from(w.document.querySelectorAll('#twitch-drops-active-pane [data-notif-title]'))
        .find(c => /rocket league/i.test(c.getAttribute('data-notif-title') || ''));
    if (!card) return null;
    for (const chip of card.querySelectorAll('.drop-api-names > span')) {
        const premio = Array.from(chip.querySelectorAll('span')).find(sp => (sp.textContent || '').trim() === NOMBRE);
        if (premio) return {
            texto: (chip.textContent || '').replace(/\s+/g, ' ').trim(),
            tachado: premio.style.textDecoration === 'line-through'
        };
    }
    return null;
}
const consultasDeInventario = (r) => r.pedidas.filter(op => op === 'Inventory').length;
const espera = (w, ms) => new Promise(res => w.setTimeout(res, ms));
const reclamarPorGql = (w) => w.fetch('https://gql.twitch.tv/gql', {
    method: 'POST',
    body: JSON.stringify([{ operationName: 'DropsPage_ClaimDropRewards',
        variables: { input: { dropInstanceID: '1#' + CAMP + '#' + DROP } } }])
});
// Un boton de reclamar «de Twitch»: fuera del panel y con el texto que el script reconoce.
function botonDeReclamar(w) {
    const b = w.document.createElement('button');
    b.innerHTML = '<div data-a-target="tw-core-button-label-text">Reclamar ahora</div>';
    w.document.body.appendChild(b);
    return b;
}
const clic = (w, n) => n.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok   ' : '  FALLA') + ' ' + msg); if (!ok) fallos++; };

// `cargaUnica`: aqui se CUENTAN consultas, y con el doble `load` del arnes por defecto el
// script arrancaria dos veces —dos consultas al cargar, dos oyentes de clic—.
const arrancar = (estado) => run({
    cargaUnica: true,
    waitMs: 8000,
    keywords: ['rocket league'],
    // Sin la casilla: con ella el barrido pulsa botones por su cuenta y el caso B no
    // sabria de quien es el clic.
    ocultarCerrados: false,
    gql: {
        ViewerDropsDashboard: dashboard,
        DropCampaignDetails: detalles,
        Inventory: inventario(estado),
        DropsPage_ClaimDropRewards: respuestaReclamo
    }
});

// Comun a A y B: antes de reclamar, el tramo esta en 🎁 y sin tachar. Sin esto, un tramo
// que naciera ya tachado pasaria las comprobaciones de «despues» sin probar nada.
function comprobarAntes(r) {
    const antes = chipDelTramo(r.w);
    comprobar(!!antes, 'el chip del tramo esta en el panel');
    comprobar(!!antes && !antes.tachado && /🎁/.test(antes.texto),
        'antes de reclamar: 🎁 y sin tachar — ' + (antes && antes.texto));
    comprobar(consultasDeInventario(r) === 1, 'una sola consulta de inventario al cargar — ' + consultasDeInventario(r));
}

(async () => {
    console.log('\n=== A. la respuesta de la mutacion relee el inventario ===');
    {
        const estado = { reclamado: false };
        const r = await arrancar(estado);
        comprobarAntes(r);
        estado.reclamado = true;
        await reclamarPorGql(r.w);
        await espera(r.w, 2500);
        const despues = chipDelTramo(r.w);
        comprobar(!!despues && despues.tachado && /✓/.test(despues.texto) && !/🎁/.test(despues.texto),
            'a los 2,5 s: ✓, tachado y sin 🎁 — ' + (despues && despues.texto));
        comprobar(consultasDeInventario(r) === 2, 'y una segunda consulta de inventario — ' + consultasDeInventario(r));
    }

    console.log('\n=== B. el clic en el boton de reclamar, sin mutacion que case ===');
    {
        const estado = { reclamado: false };
        const r = await arrancar(estado);
        comprobarAntes(r);
        estado.reclamado = true;
        clic(r.w, botonDeReclamar(r.w));
        await espera(r.w, 2000);
        comprobar(consultasDeInventario(r) === 1, 'a los 2 s todavia no: el clic espera a que Twitch conteste — ' + consultasDeInventario(r));
        await espera(r.w, 3000);
        const despues = chipDelTramo(r.w);
        comprobar(!!despues && despues.tachado && /✓/.test(despues.texto),
            'a los 5 s: ✓ y tachado — ' + (despues && despues.texto));
        comprobar(consultasDeInventario(r) === 2, 'con una sola consulta mas — ' + consultasDeInventario(r));
    }

    console.log('\n=== C. sin reclamar no se relee nada ===');
    {
        const estado = { reclamado: false };
        const r = await arrancar(estado);
        // El filtro «Sin reclamar» del propio panel: lleva la palabra y no reclama nada.
        const filtro = Array.from(r.w.document.querySelectorAll('#twitch-drops-panel .twitch-view-filter'))
            .find(n => /reclamar/i.test(n.textContent || ''));
        comprobar(!!filtro, 'el panel tiene el filtro «Sin reclamar»');
        if (filtro) clic(r.w, filtro);
        // Y un <button> con la palabra dentro del panel. Hoy el panel no trae ninguno, asi que
        // se pone uno: es la unica forma de ejercitar la exclusion, que es defensiva.
        const panel = r.w.document.getElementById('twitch-drops-panel');
        comprobar(!!panel, 'el panel esta montado');
        if (panel) {
            const b = botonDeReclamar(r.w);
            panel.appendChild(b);
            clic(r.w, b);
        }
        await espera(r.w, 5000);
        comprobar(consultasDeInventario(r) === 1, 'tras 5 s y los dos clics dentro del panel, sigue habiendo una sola consulta — ' + consultasDeInventario(r));
    }

    console.log('\n=== D. una tanda de reclamos acaba en una sola consulta ===');
    {
        const estado = { reclamado: false };
        const r = await arrancar(estado);
        estado.reclamado = true;
        const b = botonDeReclamar(r.w);
        for (let i = 0; i < 3; i++) { clic(r.w, b); reclamarPorGql(r.w); await espera(r.w, 150); }
        await espera(r.w, 5000);
        comprobar(consultasDeInventario(r) === 2, 'tres reclamos, una relectura — ' + consultasDeInventario(r));
    }

    // Reportado el 2026-10-16: con el reclamo automatico, a veces el chip se quedaba en 🎁.
    // Los tres casos siguientes son los dos caminos por los que eso podia pasar y el tope
    // que impide que el arreglo de uno se convierta en un bucle.

    console.log('\n=== E. la primera relectura llega sin el reclamo: se reintenta ===');
    // El servidor solo lo da por reclamado a partir de la SEGUNDA consulta tras reclamar:
    // es un inventario que va un paso por detras. Con una sola relectura, el 🎁 se quedaba.
    {
        const estado = { reclamado: false };
        let tras = 0;
        const r = await run({
            cargaUnica: true, waitMs: 8000, keywords: ['rocket league'], ocultarCerrados: false,
            gql: {
                ViewerDropsDashboard: dashboard, DropCampaignDetails: detalles,
                Inventory: (c) => { if (estado.reclamado && ++tras >= 2) estado.visto = true;
                                    return inventario({ reclamado: !!estado.visto })(c); },
                DropsPage_ClaimDropRewards: respuestaReclamo
            }
        });
        comprobarAntes(r);
        estado.reclamado = true;
        await reclamarPorGql(r.w);
        await espera(r.w, 2500);
        const aMedias = chipDelTramo(r.w);
        comprobar(!!aMedias && /🎁/.test(aMedias.texto),
            'a los 2,5 s sigue en 🎁: la primera relectura no lo traia — ' + (aMedias && aMedias.texto));
        await espera(r.w, 6500);
        const despues = chipDelTramo(r.w);
        comprobar(!!despues && despues.tachado && /✓/.test(despues.texto),
            'a los 9 s: ✓ y tachado, por el reintento — ' + (despues && despues.texto));
        comprobar(consultasDeInventario(r) === 3, 'tres consultas: carga, relectura y un reintento — ' + consultasDeInventario(r));
    }

    console.log('\n=== F. la mutacion viaja dentro de un Request ===');
    // Sin opciones: el cuerpo va en el primer argumento, como con `fetch(new Request(…))`.
    // Antes no se veia y solo quedaba el respaldo del clic; aqui no hay clic, asi que sin el
    // arreglo no hay relectura ninguna.
    {
        const estado = { reclamado: false };
        const r = await arrancar(estado);
        comprobarAntes(r);
        estado.reclamado = true;
        const body = JSON.stringify([{ operationName: 'DropsPage_ClaimDropRewards',
            variables: { input: { dropInstanceID: '1#' + CAMP + '#' + DROP } } }]);
        let copias = 0;
        const peticion = { url: 'https://gql.twitch.tv/gql', method: 'POST', body, headers: null,
            clone() { copias++; return { text: async () => body }; } };
        await r.w.fetch(peticion);
        await espera(r.w, 2500);
        const despues = chipDelTramo(r.w);
        comprobar(copias === 1, 'el cuerpo se lee de UNA copia, no del Request que se manda — copias: ' + copias);
        comprobar(!!despues && despues.tachado && /✓/.test(despues.texto),
            'a los 2,5 s: ✓ y tachado — ' + (despues && despues.texto));
        comprobar(consultasDeInventario(r) === 2, 'con una relectura — ' + consultasDeInventario(r));
    }

    console.log('\n=== G. un tramo que nunca pasa a reclamado no relee sin fin ===');
    // P. ej. el que pide vincular la cuenta: cumplido, y el reclamo no prospera. Dos
    // reintentos y se para; el siguiente aviso de reclamo, si lo hay, empieza otra cadena.
    {
        const estado = { reclamado: false };
        const r = await arrancar(estado);
        await reclamarPorGql(r.w);
        // 40 s y no 30: la cadena es 1 + 6 + 20 s, y sin el tope la siguiente caeria a los
        // 33 y a los 39. Con 30 s, una copia SIN tope tambien sumaba cuatro y el caso salia
        // verde sin probar el tope (comprobado el 2026-10-16).
        await espera(r.w, 40000);
        comprobar(consultasDeInventario(r) === 4, 'carga, relectura y dos reintentos, ni uno mas — ' + consultasDeInventario(r));
        const chip = chipDelTramo(r.w);
        comprobar(!!chip && /🎁/.test(chip.texto), 'y el chip sigue diciendo la verdad: 🎁 — ' + (chip && chip.texto));
    }

    console.log(fallos === 0 ? '\nTODO EN VERDE' : '\n' + fallos + ' COMPROBACIONES EN ROJO');
    process.exit(fallos === 0 ? 0 : 1);
})();
