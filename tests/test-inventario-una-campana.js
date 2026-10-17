// CON UNA SOLA CAMPAÑA EN CURSO, «RECLAMADA» SE QUEDABA VACIA.
//
// Reportado el 2026-10-16, con dos sesiones de la misma cuenta lado a lado: en una se
// veian las baldosas de «Reclamada» y en la otra solo su cabecera y el «Cargar mas».
// El volcado de la mala tenia las diecinueve baldosas en el DOM, todas marcadas
// `data-twitch-drops-hidden-why="baldosa"`. La diferencia entre las dos no era el
// navegador sino el inventario: la buena tenia CUATRO campañas en «En progreso» —tres
// escondidas por caducadas, pero en el DOM— y la mala UNA.
//
// `_inventoryContainerOf` sube desde la imagen hasta el primer antepasado con una
// campaña dentro y lo acepta si tiene exactamente una. Desde una baldosa de «Reclamada»
// ese antepasado es `inventory-max-width`, el envoltorio de LAS DOS secciones: con cuatro
// campañas daba null, con una se tomaba por el bloque de esa campaña. Y como la campaña
// iba al 33 %, el barrido escondia todo lo que no estuviera en curso dentro de ese
// «bloque», que es exactamente «Reclamada».
//
// Y el mismo error por el otro lado: `_findPerCardWrapper` sube hasta el primer nodo con
// UNA barra, y con una sola campaña ese nodo era la pagina entera, que se llevaba el
// tooltip del tramo («Tiempo restante: 0m») y el cursor de mano.
const { run, readFixture } = require('./harness');

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok    ' : '  FALLA ') + msg); if (!ok) fallos++; };

const visible = (d, el) => {
    for (let n = el; n && n !== d.body; n = n.parentElement) {
        if (n.getAttribute && n.getAttribute('data-twitch-drops-hidden') === '1') return false;
    }
    return true;
};

(async () => {
    const dump = readFixture('fixture-inventario-una-campana-y-reclamados.html');

    console.log('\n=== una campaña en curso (Evoluciones, 33 %) + «Reclamada» con 3 baldosas ===');
    const r = await run({ waitMs: 9000, dump, keywords: ['evoluciones'] });
    const d = r.w.document;

    const reclamadas = Array.from(d.querySelectorAll('img.inventory-drop-image'))
        .filter(im => !im.closest('.inventory-campaign-info') && !im.closest('.hStHhY'));
    // Control de que el recorte se hizo como se cree: si el selector no encontrara las
    // tres, «las tres visibles» saldria verde sin mirar nada.
    comprobar(reclamadas.length === 3, 'el volcado trae las 3 baldosas de «Reclamada» (hay ' + reclamadas.length + ')');
    const vistas = reclamadas.filter(im => visible(d, im)).length;
    console.log('  baldosas de «Reclamada» visibles:', vistas, 'de', reclamadas.length);
    comprobar(vistas === reclamadas.length, 'las baldosas de «Reclamada» siguen VISIBLES con la casilla puesta');

    comprobar(r.camps.length === 1 && !r.camps[0].marcado, 'la campaña en curso sigue a la vista');
    comprobar(r.totalX === 1, 'y lleva su ✕ (el barrido si paso por ella)');

    // El tooltip del tramo, solo en el tramo. Lo de fuera de la campaña que lo lleve es el
    // fallo de `_findPerCardWrapper`.
    const conTooltip = Array.from(d.querySelectorAll('[data-drop-tooltip-attached]'));
    const fuera = conTooltip.filter(n => !n.closest('.hStHhY'));
    console.log('  nodos con tooltip de tramo:', conTooltip.map(n => n.className.split(' ').pop()).join(', ') || '(ninguno)');
    comprobar(fuera.length === 0, 'ningun nodo fuera de la campaña lleva el tooltip de tramo'
        + (fuera.length ? ' (lo lleva: ' + fuera.map(n => n.className.split(' ').pop()).join(', ') + ')' : ''));

    const ocultos = Array.from(d.querySelectorAll('[data-twitch-drops-hidden="1"]'));
    comprobar(ocultos.length === 0, 'no se esconde nada (hay ' + ocultos.length + ' ocultos)');

    // ---------------------------------------------
    // LA PAGINA QUE YA ESTABA ROTA
    // ---------------------------------------------
    // Las baldosas llegan YA marcadas como las dejo la version anterior: es la pestaña que
    // seguia abierta. El barrido nuevo no las esconde, pero alguien tiene que devolverlas,
    // y ese es `_revalidarEscondidos`. Antes no lo hacia: una baldosa de «Reclamada» pasa
    // todas las pruebas de baldosa —una imagen, ninguna campaña, nada en curso— y solo la
    // delata no estar dentro de una campaña a medias.
    console.log('\n=== las mismas baldosas, llegando ya escondidas por la version anterior ===');
    let marcadas = 0;
    const dumpRoto = dump.replace(/<div class="Layout-sc-1xcs6mc-0 kBZhWz"><div class="Layout-sc-1xcs6mc-0 hbROwx">/g, (m) => {
        marcadas++;
        return m.replace('kBZhWz"', 'kBZhWz" data-twitch-drops-hidden-why="baldosa" data-twitch-drops-hidden="1"');
    });
    // El control del recorte: si el reemplazo no casara, el caso pasaria con el volcado
    // intacto y no probaria nada.
    comprobar(marcadas === 3, 'el volcado roto lleva las 3 baldosas marcadas (marcadas: ' + marcadas + ')');
    const r2 = await run({ waitMs: 9000, dump: dumpRoto, keywords: ['evoluciones'] });
    const d2 = r2.w.document;
    const quedan = d2.querySelectorAll('[data-twitch-drops-hidden="1"]').length;
    console.log('  siguen escondidas:', quedan);
    comprobar(quedan === 0, 'el repaso devuelve a la vista las baldosas escondidas por error');

    console.log(fallos === 0 ? '\nTODO EN VERDE' : '\n' + fallos + ' COMPROBACIONES EN ROJO');
    process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
