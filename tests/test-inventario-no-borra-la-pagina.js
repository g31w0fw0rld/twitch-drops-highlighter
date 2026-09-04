// REGRESION DE 1.3.5: «ocultar cerrados/completados» borraba la pagina entera.
//
// Reportado el 2026-09-04: con la casilla marcada, el inventario se quedaba EN BLANCO
// —sin baldosas y sin las cabeceras de seccion—. Medido sobre el volcado del usuario
// (docs/dom-inventory-no-progress-2026-09.html), el script escondia un nodo que contenia
// las 12 baldosas Y el texto de la cabecera: o sea el envoltorio de la SECCION, no una
// campaña.
//
// La causa raiz no era el bloque nuevo, era una suposicion vieja que ese bloque destapo:
// `_inventoryContainerOf` sube NUEVE PADRES A CIEGAS dando por hecho que toda imagen de
// recompensa vive dentro de un bloque de campaña. En un inventario sin nada en curso eso
// es falso —«Reclamada» es una rejilla plana, con CERO `dropID=` y CERO
// `inventory-campaign-info`— asi que los nueve padres se pasan de largo y aterrizan en la
// seccion. Ahora el nodo sigue valiendo de AMBITO para buscar baldosas dentro, pero antes
// de ESCONDERLO se exige que sea de verdad una campaña (`_esBloqueDeCampaña`).
//
// Los dos casos van juntos porque son las dos formas que toma el inventario y el fallo
// dependia de cual: con «En progreso» no se reproducia, sin ella si.
const { run, readFixture } = require('./harness');

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok    ' : '  FALLA ') + msg); if (!ok) fallos++; };

// Visible = ningun antepasado marcado como oculto por el script.
const visible = (d, el) => {
    for (let n = el; n && n !== d.body; n = n.parentElement) {
        if (n.getAttribute && n.getAttribute('data-twitch-drops-hidden') === '1') return false;
    }
    return true;
};
// El nodo MAS PROFUNDO que contiene ese texto: el que de verdad lo pinta.
const hojaCon = (d, txt) => {
    const todos = Array.from(d.querySelectorAll('*')).filter(e => (e.textContent || '').includes(txt));
    return todos[todos.length - 1] || null;
};

(async () => {
    // ---------------------------------------------
    // CASO A — solo «En progreso», nada terminado
    // ---------------------------------------------
    // No reproducia el fallo, y se queda igualmente: es la guarda de que una campaña con
    // los cuatro tramos a medias (10 %, 5 %, 20 %, 3 %) no se toca. Si un dia alguien
    // afloja `_algoEnCurso`, esto lo dice.
    console.log('\n=== solo «En progreso» (SQUADRA, 4 tramos a medias) ===');
    const a = await run({ waitMs: 9000, dump: readFixture('fixture-inventario-en-progreso.html') });
    console.log('  campanas:', JSON.stringify(a.camps.map(c => ({ id: c.id, marcado: c.marcado }))));
    comprobar(a.camps.length === 1, 'la campaña sigue en el DOM');
    comprobar(a.camps.every(c => !c.marcado && !c.escondido),
        'no se esconde una campaña sin nada terminado');
    const baldosasA = Array.from(a.w.document.querySelectorAll('img.inventory-drop-image'));
    comprobar(baldosasA.filter(im => visible(a.w.document, im)).length === 4,
        'sus cuatro baldosas en curso siguen visibles');

    // ---------------------------------------------
    // CASO B — sin «En progreso», todo cobrado
    // ---------------------------------------------
    // El que fallaba. Lo que se pidio con la casilla es esconder lo cobrado, asi que las
    // baldosas SI se van; lo que no puede irse es la pagina.
    console.log('\n=== sin «En progreso» (12 baldosas ya cobradas) ===');
    const b = await run({ waitMs: 9000, dump: readFixture('fixture-inventario-sin-progreso.html') });
    const d = b.w.document;
    const baldosas = Array.from(d.querySelectorAll('img.inventory-drop-image'));
    const vistas = baldosas.filter(im => visible(d, im)).length;
    console.log('  baldosas visibles:', vistas, 'de', baldosas.length);

    for (const txt of ['Reclamada', 'Podr']) {
        const el = hojaCon(d, txt);
        console.log(`  cabecera "${txt}":`, el ? (visible(d, el) ? 'visible' : 'OCULTA') : '(no esta)');
        comprobar(!!el && visible(d, el), `la cabecera «${txt}» sigue visible`);
    }
    // Lo que hacia el fallo inconfundible: la pagina se quedaba sin texto.
    const texto = (d.body.textContent || '').replace(/\s+/g, ' ').trim();
    comprobar(texto.length > 200, 'la pagina conserva su texto (no queda en blanco)');
    // Y la casilla hace su trabajo: lo cobrado se va.
    // LO QUE SE ESPERA AQUI CAMBIO, Y LO CAMBIO EL USUARIO.
    //
    // Este test daba por bueno que las doce se escondieran («es lo que se pidio»), y esa
    // era una suposicion MIA sobre lo que promete la casilla, no un dato. Reportado el
    // 2026-09-04: la seccion «Reclamada» es el escaparate de lo que tienes, o sea a lo
    // que vas al entrar; vaciarla no despeja nada y se lee como haber perdido el
    // inventario. Asi que la casilla despeja CAMPAÑAS terminadas y esta rejilla no se
    // toca.
    //
    // Se deja escrito porque el test estaba en verde sobre esa suposicion: un test puede
    // fijar una equivocacion igual de bien que un acierto, y sin esta nota el siguiente
    // que lo lea creera que la conducta de antes estaba comprobada.
    comprobar(vistas === baldosas.length,
        'las doce baldosas ya cobradas siguen VISIBLES: esta rejilla no es «lo completado»');

    // Y no se esconde NADA, que es la unica forma de estar seguros de que no se toco el
    // andamio de la pagina: aqui no hay un solo bloque de campaña (cero `dropID=`), asi
    // que cualquier nodo oculto seria algo que no habiamos podido juzgar.
    const ocultos = Array.from(d.querySelectorAll('[data-twitch-drops-hidden="1"]'));
    console.log('  nodos ocultados:', ocultos.length, '(bloques de campaña en el volcado: 0)');
    comprobar(ocultos.length === 0, 'no se esconde nada donde no hay ninguna campaña');

    console.log(fallos === 0 ? '\nTODO EN VERDE' : '\n' + fallos + ' COMPROBACIONES EN ROJO');
    process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
