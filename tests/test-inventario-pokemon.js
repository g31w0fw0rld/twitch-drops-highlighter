// EL INVENTARIO CUANDO LA CAMPAÑA NO LLEVA `inventory-opacity-2` (2026-08-26).
//
// Twitch estreno con la campaña de Pokemon un tipo de tarjeta que rompe DOS
// suposiciones del barrido del inventario, y las dos costaban lo mismo: que la
// campaña quedara fuera de todo.
//
//   1. El bucle arrancaba SOLO de `img.inventory-opacity-2`, y esa clase Twitch se la
//      pone a algunas. Mientras cada campaña aportara una, daba igual —el bucle sube
//      al bloque entero—; la de Pokemon trae UNA imagen y sin la clase, asi que por
//      ella no entraba nadie: ni la ✕, ni la casilla de ocultar, ni el tooltip, ni el
//      clic al modal.
//   2. Y el barrido de «completados» daba por cobrada toda imagen SIN esa clase, asi
//      que en cuanto el bucle empezo a alcanzar ese bloque se llevaba por delante la
//      unica recompensa que quedaba por ganar. La barra de progreso es la prueba
//      positiva de que sigue en curso.
//
// Lo que se prueba es lo unico que el usuario ve: cuantas ✕ hay, que no desaparezca lo
// que esta en curso, y que descartar una campaña la esconda y siga escondida al
// recargar. Contra la 1.3.1 fallan la primera y la tercera.
const { run } = require('./harness');

const ID_POKEMON = '92f516f7-f6d5-4fa6-909a-48c5b94d2a43';

// El volcado trae tres campañas, y solo la de Pokemon tiene una recompensa en curso.
const CAMPANAS = 3;
const EN_CURSO = 'Poké Ball';

function leer(w) {
    const doc = w.document;
    // Escondido es «el nodo o cualquiera de sus padres marcado»: el script marca el
    // bloque de la campaña, no cada imagen.
    const oculto = (el) => {
        let n = el;
        while (n && n !== doc.body) {
            if (n.getAttribute && n.getAttribute('data-twitch-drops-hidden') === '1') return true;
            n = n.parentElement;
        }
        return false;
    };
    const baldosas = Array.from(doc.querySelectorAll('img.inventory-drop-image')).map(im => {
        let n = im;
        for (let i = 0; i < 6 && n.parentElement; i++) n = n.parentElement;
        return {
            nombre: ((n.querySelector('p') || {}).textContent || '?').trim(),
            enCurso: !!n.querySelector('[role="progressbar"]'),
            oculto: oculto(im)
        };
    });
    const campanas = Array.from(doc.querySelectorAll('.inventory-campaign-info'));
    return {
        equis: doc.querySelectorAll('a[data-drop-own-tip]').length,
        pokeBall: baldosas.find(b => b.nombre === EN_CURSO) || null,
        cobradasOcultas: baldosas.filter(b => !b.enCurso && b.oculto).length,
        campanasOcultas: campanas.filter(c => oculto(c)).length,
        campanasTotales: campanas.length
    };
}

(async () => {
    const fallos = [];

    // 1. DE ENTRADA: una ✕ por campaña, incluida la que no lleva la clase, y nada
    //    escondido. Esta mitad es la que falla contra la 1.3.1 (pinta 2 de 3).
    let r = await run({});
    let v = leer(r.w);
    console.log(JSON.stringify({ deEntrada: v }, null, 2));
    if (v.equis !== CAMPANAS) fallos.push(`se pintaron ${v.equis} ✕ de ${CAMPANAS}: la campaña sin inventory-opacity-2 se quedo fuera`);
    if (!v.pokeBall) fallos.push('no se encontro la recompensa en curso en el volcado');
    else if (v.pokeBall.oculto) fallos.push('la recompensa EN CURSO se escondio: el barrido la dio por cobrada');
    if (v.campanasOcultas !== 0) fallos.push(`se escondieron ${v.campanasOcultas} campañas sin que nadie lo pidiera`);
    r.dom.window.close();

    // 2. AL PULSAR LA ✕: esa campaña se esconde y las otras dos se quedan.
    r = await run({ clicarX: 0 });
    v = leer(r.w);
    console.log(JSON.stringify({ trasPulsarLaEquis: v }, null, 2));
    if (v.campanasOcultas !== 1) fallos.push(`pulsar la ✕ escondio ${v.campanasOcultas} campañas, deberia ser 1`);
    r.dom.window.close();

    // 3. AL RECARGAR con esa campaña ya descartada: sigue escondida —y sin su ✕, que
    //    para eso la descartaste— y las otras dos conservan la suya.
    r = await run({ borrados: [ID_POKEMON] });
    v = leer(r.w);
    console.log(JSON.stringify({ alRecargar: v }, null, 2));
    if (v.campanasOcultas !== 1) fallos.push(`al recargar, la campaña descartada volvio a la vista (ocultas: ${v.campanasOcultas})`);
    if (v.equis !== CAMPANAS - 1) fallos.push(`al recargar hay ${v.equis} ✕, deberian ser ${CAMPANAS - 1}`);
    r.dom.window.close();

    if (fallos.length) {
        console.log('\nFALLOS:\n - ' + fallos.join('\n - '));
        process.exit(1);
    }
    console.log('\nTODO OK');
    process.exit(0);
})();
