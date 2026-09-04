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
    comprobar(b2.every(x => x.oculto), 'desaparece');
    // Y con la rejilla vacia, el encabezado tampoco tiene nada que decir: se va con ella.
    // Sin esto la casilla dejaba el nombre, la fecha y el «Acerca de este Drop» ocupando
    // lo mismo que antes y sin ninguna recompensa debajo.
    comprobar(campanaOculta(r2.w) === true, 'y con ella se va el bloque entero de la campaña');

    console.log(fallos === 0 ? '\nTODO EN VERDE' : '\n' + fallos + ' COMPROBACIONES EN ROJO');
    process.exit(fallos === 0 ? 0 : 1);
})();
