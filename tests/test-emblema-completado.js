// LA BARRA AL 100 % NO ES «SIGUE EN CURSO».
//
// El barrido de «ocultar completados» se apoyaba en que una barra de progreso significa
// que ese tramo sigue vivo. Es cierto al 10 % (la Poké Ball del volcado del 2026-08-26,
// que es por lo que se puso la guarda) y es falso al 100 %: ahi la barra dice justo lo
// contrario. Se ve solo en las campañas de EMBLEMA/EMOTE porque son las unicas que se
// quedan quietas en «En progreso» —Twitch las concede solas, no hay boton que pulsar—,
// asi que el tramo cumplido se queda en la pagina para siempre.
//
// Se comprueba sobre el volcado real del 2026-09-02 y en las dos direcciones:
//   · el tramo al 100 % («Mouseathon») desaparece;
//   · el tramo al 56 % («IronmouseWah Emote») NO, que es lo que la guarda protegia.
// Sin la segunda, «esconderlo todo» pasaria el test igual.
//
// Y las dos valen SOLO mientras la campaña tenga algo en curso, que es el caso de arriba.
// El de abajo —la misma campaña ya saldada— cambio de signo el 2026-09-17: ahi no se
// esconde nada. El porque esta escrito junto a sus comprobaciones.
const { run, readFixture } = require('./harness');
const emblema = readFixture('fixture-inventario-emblema.html');

// Segundo caso: la MISMA campaña sin el tramo en curso, o sea completada del todo. Se
// recorta el volcado en vez de escribir uno a mano, y se recorta AQUI —sobre la cadena, no
// sobre el fichero— para que el fixture siga siendo lo que Twitch sirvio. El corte va por
// la baldosa entera del emote, que es el primer `.khtvTe` del DOM.
const iniA = emblema.indexOf('<div class="Layout-sc-1xcs6mc-0 khtvTe">');
const iniB = emblema.indexOf('<div class="Layout-sc-1xcs6mc-0 khtvTe">', iniA + 1);
if (iniA < 0 || iniB < 0) { console.error('no se pudo recortar el fixture: cambiaron las clases'); process.exit(1); }
const soloCompletada = emblema.slice(0, iniA) + emblema.slice(iniB);

function baldosas(w) {
    const d = w.document;
    const oculto = (el) => {
        for (let n = el; n && n !== d.body; n = n.parentElement) {
            if (n.getAttribute && n.getAttribute('data-twitch-drops-hidden') === '1') return true;
        }
        return false;
    };
    return Array.from(d.querySelectorAll('img.inventory-drop-image')).map(im => {
        let tile = im;
        for (let i = 0; i < 6 && tile.parentElement; i++) tile = tile.parentElement;
        const barra = tile.querySelector('[role="progressbar"]');
        return {
            nombre: ((tile.querySelector('p') || {}).textContent || '?').trim(),
            porcentaje: barra ? Number(barra.getAttribute('aria-valuenow')) : null,
            oculto: oculto(im)
        };
    });
}
const campanaOculta = (w) => {
    const info = w.document.querySelector('.inventory-campaign-info');
    if (!info) return null;
    for (let n = info; n && n !== w.document.body; n = n.parentElement) {
        if (n.getAttribute && n.getAttribute('data-twitch-drops-hidden') === '1') return true;
    }
    return false;
};

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok   ' : '  FALLA') + ' ' + msg); if (!ok) fallos++; };

(async () => {
    console.log('\n=== campaña con un tramo hecho y otro a medias ===');
    const r = await run({ dump: emblema, waitMs: 9000 });
    const b = baldosas(r.w);
    console.log('  baldosas:', JSON.stringify(b));
    const hecho = b.find(x => x.nombre === 'Mouseathon');
    const medias = b.find(x => x.nombre === 'IronmouseWah Emote');
    comprobar(!!hecho && hecho.porcentaje === 100, 'el volcado trae el tramo al 100 %');
    comprobar(!!hecho && hecho.oculto, 'el tramo al 100 % desaparece');
    comprobar(!!medias && medias.porcentaje === 56, 'y el otro sigue al 56 %');
    comprobar(!!medias && !medias.oculto, 'el tramo al 56 % NO desaparece');
    comprobar(campanaOculta(r.w) === false, 'la campaña sigue a la vista: aun queda algo por ganar');
    comprobar(r.totalX === 1, 'la ✕ de descartar se sigue inyectando — ' + r.totalX);

    console.log('\n=== la misma campaña, ya completada del todo ===');
    const r2 = await run({ dump: soloCompletada, waitMs: 9000 });
    const b2 = baldosas(r2.w);
    console.log('  baldosas:', JSON.stringify(b2));
    comprobar(b2.length === 1 && b2[0].nombre === 'Mouseathon', 'el recorte dejo solo el tramo hecho');
    // LO QUE SE ESPERA AQUI CAMBIO EL 2026-09-17, Y LO CAMBIO EL USUARIO.
    //
    // Este caso daba por bueno que una campaña sin nada en curso desapareciera entera
    // —primero sus baldosas y luego, por no dejar la cabecera sobre una rejilla vacia, el
    // bloque—. Ahora no se toca ninguna de las dos cosas: una campaña saldada se queda tal
    // como la pinta Twitch, porque es el unico sitio donde se ve lo que ganaste en ella.
    //
    // No es un cambio de opinion sobre el fallo que traia aqui: ese era otro —el nodo que
    // se escondia se elegia contando nueve padres y podia ser el que contiene TRES
    // campañas, ver `_inventoryContainerOf`— y esta arreglado por su cuenta. Este es el
    // criterio de que despeja la casilla: lo que ya tienes de una campaña que aun te debe
    // algo, y nada mas.
    //
    // Se deja escrito porque el test estaba en verde sobre lo contrario, igual que paso en
    // test-inventario-no-borra-la-pagina: un test fija una decision tan bien como fija un
    // acierto, y sin la nota el siguiente que lo lea creera que aquello estaba comprobado.
    comprobar(b2.every(x => !x.oculto), 'la baldosa cumplida se queda: aqui ya no hay nada que despejar');
    comprobar(campanaOculta(r2.w) === false, 'y el bloque de la campaña tampoco se esconde');
    const ocultos2 = r2.w.document.querySelectorAll('[data-twitch-drops-hidden="1"]').length;
    console.log('  nodos ocultados:', ocultos2);
    comprobar(ocultos2 === 0, 'no se esconde NADA en una campaña completamente reclamada');

    console.log(fallos === 0 ? '\nTODO EN VERDE' : '\n' + fallos + ' COMPROBACIONES EN ROJO');
    process.exit(fallos === 0 ? 0 : 1);
})();
