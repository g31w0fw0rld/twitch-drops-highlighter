// AL RECLAMAR EL ULTIMO DROP DE UNA CAMPAÑA SE IBA EL INVENTARIO ENTERO.
//
// Reportado el 2026-09-17. La causa no era esconder —eso ya se hace con `display:none`
// desde 1.3.5, nunca se quita un nodo de React— sino QUE nodo se escondia:
// `_inventoryContainerOf` subia NUEVE PADRES a ciegas para dar con «el bloque de la
// campaña», y esa profundidad no es fija. Medido sobre este mismo volcado:
//
//     6 recompensas EN CURSO  -> su bloque de campaña esta a 9 padres
//     20 recompensas COBRADAS -> su bloque de campaña esta a 8 padres
//
// O sea que una recompensa cuelga un nivel mas arriba en cuanto pasa a cobrada, que es
// justo lo que hace reclamarla. Con la cuenta fija, esas 20 aterrizaban en el nodo que
// contiene LAS TRES campañas, y la guarda que se puso en 1.3.5 no lo paraba: solo
// rechazaba los nodos con CERO campañas, no los que tienen varias.
//
// EL VOLCADO SE TRANSFORMA, y los dos cambios son los que hace la propia pagina cuando
// ya no queda nada por ganar: ninguna imagen atenuada (`inventory-opacity-2`) y todas las
// barras al 100 %. No se inventa markup —no hay volcado de Twitch justo despues de
// reclamar— sino que se le quitan al real las dos marcas de «esto sigue en curso», que es
// lo que significa haber reclamado el ultimo drop.
//
// CONTROL DE SENSIBILIDAD (obligatorio para creerse este test, porque comprueba que algo
// NO pasa y eso sale verde solo con no hacer nada):
//     git show HEAD:twitch-drops-highlighter.user.js > /tmp/pub.js  # el ultimo commit publicado
//     TW_SCRIPT=/tmp/pub.js node tests/test-inventario-ultimo-drop.js
// Con el codigo publicado sale 0 recompensas visibles de 26, 0 campañas de 3, y entre los
// nodos escondidos uno con 3 campañas dentro.
const { run, readFixture } = require('./harness');

const base = readFixture('fixture-inventario-pokemon.html');
const todoCobrado = base
    .replace(/ inventory-opacity-2/g, '')
    .replace(/aria-valuenow="\d+"/g, 'aria-valuenow="100"');

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok    ' : '  FALLA ') + msg); if (!ok) fallos++; };

const SEL_CAMP_LINK = 'a.tw-link[href*="dropID="]:not([href*="/directory/"])';
const cuantasCampañas = (el) => Math.max(
    el.querySelectorAll('.inventory-campaign-info').length,
    el.querySelectorAll(SEL_CAMP_LINK).length);
const visible = (d, el) => {
    for (let n = el; n && n !== d.body; n = n.parentElement) {
        if (n.getAttribute && n.getAttribute('data-twitch-drops-hidden') === '1') return false;
    }
    return true;
};
const espera = (w, ms) => new Promise(r => w.setTimeout(r, ms));

(async () => {
    // ---------------------------------------------
    // CASO A — el fallo reportado
    // ---------------------------------------------
    console.log('\n=== las tres campañas con todo reclamado ===');
    const r = await run({ dump: todoCobrado, waitMs: 9000 });
    const d = r.w.document;
    const imgs = Array.from(d.querySelectorAll('img.inventory-drop-image'));
    const camps = Array.from(d.querySelectorAll('.inventory-campaign-info'));
    // Primero, que la transformacion no se haya llevado por delante el volcado: si aqui
    // quedaran 0 campañas, todo lo de abajo saldria verde sin comprobar nada.
    comprobar(imgs.length === 26, `el volcado transformado trae las 26 recompensas — ${imgs.length}`);
    comprobar(camps.length === 3, `y sus 3 campañas — ${camps.length}`);

    const ocultos = Array.from(d.querySelectorAll('[data-twitch-drops-hidden="1"]'));
    const dentro = ocultos.map(cuantasCampañas);
    console.log('  nodos escondidos:', ocultos.length, '| campañas dentro de cada uno:', JSON.stringify(dentro));
    // LA INVARIANTE, y es la que de verdad importa: se puede discutir que se esconde, pero
    // nunca puede esconderse un nodo que abarque mas de una campaña. Ahi es donde viven las
    // cabeceras de seccion y el resto del inventario.
    comprobar(dentro.every(n => n <= 1), 'ningun nodo escondido abarca mas de una campaña');
    comprobar(camps.filter(c => visible(d, c)).length === 3, 'las tres campañas siguen a la vista');
    comprobar(imgs.filter(i => visible(d, i)).length === 26,
        'y sus 26 recompensas: una campaña saldada no se toca');

    // ---------------------------------------------
    // CASO B — el «devolver», que antes no existia
    // ---------------------------------------------
    // React REUTILIZA nodos: uno que escondamos puede volver con otro contenido dentro y
    // quedarse invisible. Se descarta una campaña con la ✕ —el unico escondido de bloque
    // que queda— y se le cambia el contenido por la fuerza, que es lo que haria un
    // repintado. Tiene que volver a la vista sin recargar nada.
    console.log('\n=== un nodo escondido que React reutiliza para otra cosa ===');
    const r2 = await run({ clicarX: 0, waitMs: 9000 });
    const d2 = r2.w.document;
    const nodo = d2.querySelector('[data-twitch-drops-hidden="1"]');
    comprobar(!!nodo, 'la ✕ escondio la campaña');
    if (nodo) {
        comprobar(nodo.getAttribute('data-twitch-drops-hidden-why') === 'descartada',
            'y queda apuntado POR QUE se escondio');
        nodo.innerHTML = '<div><p>otra cosa que React monto aqui</p></div>';
        await espera(r2.w, 900);
        comprobar(nodo.getAttribute('data-twitch-drops-hidden') !== '1',
            'al dejar de ser esa campaña, el nodo vuelve a la vista');
    }

    console.log(fallos === 0 ? '\nTODO EN VERDE' : '\n' + fallos + ' COMPROBACIONES EN ROJO');
    process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
