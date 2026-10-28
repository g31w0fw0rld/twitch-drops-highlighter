// LO GANADO QUE PIDE «CONECTAR» NO ESTA COBRADO, Y NO SE ESCONDE.
//
// Reportado el 2026-10-27 con «Modern Warfare 4 Launch»: con la casilla de «ocultar
// cerrados/completados» puesta, «MW4 Emblem - Point Man» —al 100 % de 20 min— se iba
// del inventario mientras sus dos hermanas seguian al 51 y al 38 %. La cuenta de
// Call of Duty no estaba vinculada, asi que Twitch no pinta «Reclamar» en esa baldosa
// sino un enlace-boton «Conectar» a la web del juego, y el barrido la daba por cobrada.
//
// EL MARCADO DEL ENLACE ES EL REAL, medido ese dia en el inventario del usuario: un
// `<a target="_blank">` a profile.callofduty.com, sin `data-test-selector`, con el
// `tw-core-button-label-text` dentro, y colgado como hermano del envoltorio de la
// imagen. Lo que NO es real es la campaña: no hay volcado de MW4 a medias —cuando se
// midio, las tres baldosas ya estaban al 100 %—, asi que se le pone el enlace a dos
// volcados que ya tienen la forma que hace falta, sin tocar nada mas:
//   · `fixture-inventario-emblema.html`: una baldosa al 100 % y otra al 56 % en la
//     misma campaña, que es el caso reportado;
//   · `fixture-inventario-campana-caducada.html`: la campaña que se esconde entera por
//     caducada, con la barra subida al 100 %.
//
// CONTROLES, porque las dos comprobaciones principales miden que algo NO pasa:
//   · sin el enlace, la baldosa al 100 % SI desaparece (es test-emblema-completado);
//   · el «Conectar» de la cabecera de la campaña —que tambien sale en las cerradas que
//     no te dieron nada, «Fortune's Frontier #2» al 1 %— no frena el escondido.
// Sensibilidad:
//     git show HEAD:twitch-drops-highlighter.user.js > /tmp/pub.js
//     TW_SCRIPT=/tmp/pub.js node tests/test-baldosa-falta-conectar.js
const { run, readFixture } = require('./harness');

const ENLACE_CONECTAR =
    '<div class="Layout-sc-1xcs6mc-0"><div class="Layout-sc-1xcs6mc-0">' +
    '<a class="ScCoreButton-sc-ocjdkq-0" rel="noopener noreferrer" target="_blank"' +
    ' href="https://profile.callofduty.com/cod/twitch/reauth"><div><div><div>' +
    '<div data-a-selector="tw-core-button-icon"></div></div></div>' +
    '<div data-a-target="tw-core-button-label-text">Conectar</div></div></a></div></div>';

// El de la cabecera, como lo pinta Twitch dentro de `.inventory-campaign-info`.
const ENLACE_CABECERA =
    '<a data-test-selector="DropsCampaignInProgressDescription-connect-button"' +
    ' class="ScCoreButton-sc-ocjdkq-0" rel="noopener noreferrer" target="_blank"' +
    ' href="https://ravenquest.io/myaccount/twitch"><div>' +
    '<div data-a-target="tw-core-button-label-text">Conectar</div></div></a>';

// Mete el enlace justo detras del envoltorio de la imagen de la baldosa cuyo nombre se
// da. Se busca la imagen que precede a ese nombre, no la primera del fichero.
function conEnlaceEnBaldosa(html, nombre) {
    const iNombre = html.indexOf('>' + nombre + '</p>');
    const iImg = html.lastIndexOf('inventory-drop-image', iNombre);
    const iCierre = html.indexOf('</div>', html.indexOf('>', iImg)) + '</div>'.length;
    if (iNombre < 0 || iImg < 0 || iCierre < iImg) throw new Error('no se encontro la baldosa ' + nombre);
    return html.slice(0, iCierre) + ENLACE_CONECTAR + html.slice(iCierre);
}

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok    ' : '  FALLA ') + msg); if (!ok) fallos++; };

const oculto = (d, el) => {
    for (let n = el; n && n !== d.body; n = n.parentElement) {
        if (n.getAttribute && n.getAttribute('data-twitch-drops-hidden') === '1') return true;
    }
    return false;
};
function baldosas(w) {
    const d = w.document;
    return Array.from(d.querySelectorAll('img.inventory-drop-image')).map(im => {
        let tile = im;
        for (let i = 0; i < 6 && tile.parentElement; i++) tile = tile.parentElement;
        const barra = tile.querySelector('[role="progressbar"]');
        return {
            nombre: ((tile.querySelector('p:not(:empty)') || {}).textContent || '?').trim(),
            porcentaje: barra ? Number(barra.getAttribute('aria-valuenow')) : null,
            conectar: !!tile.querySelector('a[href*="callofduty"]'),
            oculto: oculto(d, im)
        };
    });
}

// ---- lo de la campaña caducada, copiado de test-inventario-campana-caducada ----
const CAMP = 'afe7cb0a-2c43-41a9-864f-d5b1a7263b86';
const DIA = 24 * 60 * 60 * 1000;
const cuando = (dias) => new Date(Date.now() + dias * DIA).toISOString();
const gqlCaducada = {
    ViewerDropsDashboard: [{ data: { currentUser: { id: '1', login: 'prueba', dropCampaigns: [{
        id: CAMP, name: 'PEC: Fall Finals 1_DAY3', status: 'EXPIRED',
        startAt: cuando(-2), endAt: cuando(2),
        game: { id: '493057', displayName: 'PUBG: BATTLEGROUNDS', boxArtURL: 'https://x/pubg.jpg' },
        owner: { id: 'o-pec', login: 'pubgesports', name: 'PUBG Esports', displayName: 'PUBG Esports' },
        self: { isAccountConnected: false },
        image: { image1xURL: 'https://x/pec.png' } }] },
        rewardCampaignsAvailableToUser: [] } }],
    Inventory: [{ data: { currentUser: { inventory: {
        dropCampaignsInProgress: [], gameEventDrops: [], earnedDropRewards: { edges: [] } } } } }],
    DropCampaignDetails: (cuerpo) => {
        const id = (((cuerpo || [])[0] || {}).variables || {}).dropID || '';
        return [{ data: { user: { id: 'o-pec', dropCampaign: {
            id, name: 'PEC: Fall Finals 1_DAY3',
            timeBasedDrops: [{ id: id + '-t0', name: 'PUBG Varsity Jacket',
                requiredMinutesWatched: 120, requiredSubs: 0,
                benefitEdges: [{ benefit: { id: id + '-b0', name: 'PUBG Varsity Jacket',
                    distributionType: 'DIRECT_ENTITLEMENT' } }] }] } } } }];
    }
};
async function bloqueCaducadaEscondido(dump) {
    const r = await run({ dump, waitMs: 12000, keywords: ['pubg'], gql: gqlCaducada });
    const d = r.w.document;
    return oculto(d, d.querySelector('.inventory-campaign-info'));
}

(async () => {
    const emblema = readFixture('fixture-inventario-emblema.html');

    console.log('\n=== campaña a medias: la baldosa al 100 % pide «Conectar» ===');
    const dump = conEnlaceEnBaldosa(emblema, 'Mouseathon');
    const r = await run({ dump, waitMs: 9000 });
    const b = baldosas(r.w);
    console.log('  baldosas:', JSON.stringify(b));
    const hecho = b.find(x => x.nombre === 'Mouseathon');
    const medias = b.find(x => x.nombre === 'IronmouseWah Emote');
    comprobar(!!hecho && hecho.porcentaje === 100 && hecho.conectar,
        'el volcado lleva la baldosa al 100 % con su «Conectar»');
    comprobar(!!medias && medias.porcentaje === 56 && !medias.conectar,
        'y la otra al 56 %, sin el');
    comprobar(!!hecho && !hecho.oculto, 'la ganada que pide «Conectar» NO desaparece');
    comprobar(!!medias && !medias.oculto, 'ni la que va a medias');

    console.log('\n=== CONTROL: el mismo volcado sin el enlace ===');
    const rc = await run({ dump: emblema, waitMs: 9000 });
    const hechoC = baldosas(rc.w).find(x => x.nombre === 'Mouseathon');
    comprobar(!!hechoC && hechoC.oculto, 'sin «Conectar», la baldosa al 100 % SI desaparece');

    // Y el repaso de lo escondido tampoco la da por cuadrada si el enlace llega DESPUES,
    // que es lo que pasa cuando React repinta la baldosa. Se usa el nodo que escondio el
    // propio barrido, no uno elegido aqui: marcar otro a mano media el repaso sobre un
    // nodo que el script nunca habria escondido, y salia verde tambien sin el arreglo.
    const dc = rc.w.document;
    const escondida = Array.from(dc.querySelectorAll('[data-twitch-drops-hidden-why="baldosa"]'))
        .find(n => /Mouseathon/.test(n.textContent));
    comprobar(!!escondida, 'el barrido la escondio por baldosa');
    if (escondida) {
        const img = escondida.querySelector('img.inventory-drop-image');
        const envoltorio = img && img.parentElement;
        envoltorio.insertAdjacentHTML('afterend', ENLACE_CONECTAR);
        await new Promise(res => rc.w.setTimeout(res, 900));
        comprobar(escondida.getAttribute('data-twitch-drops-hidden') !== '1',
            'si despues aparece su «Conectar», vuelve a la vista en el siguiente repaso');
    }

    console.log('\n=== campaña caducada con lo ganado esperando a «Conectar» ===');
    const caducada = readFixture('fixture-inventario-campana-caducada.html')
        .replace('aria-valuenow="45"', 'aria-valuenow="100"')
        .replace('>45</span>% de 2 horas', '>100</span>% de 2 horas');
    comprobar(await bloqueCaducadaEscondido(caducada) === true,
        'CONTROL: sin el enlace, la caducada al 100 % se esconde');
    comprobar(await bloqueCaducadaEscondido(conEnlaceEnBaldosa(caducada, 'PUBG Varsity Jacket')) === false,
        'con «Conectar» en la baldosa, NO se esconde: el premio sigue esperando');

    // El de la cabecera no dice que haya nada ganado: sale igual en una cerrada al 1 %.
    const iInfo = caducada.indexOf('inventory-campaign-info');
    const iDentro = caducada.indexOf('>', iInfo) + 1;
    const conCabecera = caducada.slice(0, iDentro) + ENLACE_CABECERA + caducada.slice(iDentro);
    comprobar(await bloqueCaducadaEscondido(conCabecera) === true,
        'CONTROL: el «Conectar» de la cabecera no frena el escondido');

    console.log(fallos === 0 ? '\nTODO EN VERDE' : '\n' + fallos + ' COMPROBACIONES EN ROJO (FALLOS)');
    process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
