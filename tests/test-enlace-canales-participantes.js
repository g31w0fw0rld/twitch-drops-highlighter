// EL ENLACE DE «CANAL EN VIVO QUE PARTICIPE» LLEVABA AL TAG, NO A LA CAMPAÑA.
//
// Twitch lo escribe como `/directory/category/<slug>?filter=drops`, que lista a todo el
// que se haya puesto el tag de drops. El parametro que filtra por la campaña de verdad es
// `?dropID=<id de campaña>` (verificado el 2026-09-12 sobre Halo: MCC), y las dos piezas
// —el slug y el id— ya estan en el DOM del inventario, dentro del mismo
// `.inventory-campaign-info`.
//
// El volcado trae DOS campañas con ese enlace, y eso es lo que hace util al test: no basta
// con que aparezca un `dropID`, tiene que ser el de SU campaña. Un ambito mal elegido
// —subir un padre de mas— manda las dos al mismo sitio y eso saldria verde si solo se
// contara.
//
// Los dos ultimos casos son controles que viajan en el propio test, inyectados cuando ya
// ha arrancado todo (lo que de paso ejercita el observer, porque ese DOM no existia en la
// primera pasada):
//   · un enlace de categoria SIN `filter=drops` dentro de una campaña -> no es nuestro.
//   · un enlace CON filtro pero sin campaña identificable -> se deja como esta antes que
//     mandar al usuario a la campaña equivocada.
const { run } = require('./harness');

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok    ' : '  FALLA ') + msg); if (!ok) fallos++; };

const CONTROL = `
<div class="inventory-campaign-info" id="control-campana">
  <a class="tw-link" href="/drops/campaigns?dropID=ctrl-1111">campaña de control</a>
  <a id="ctrl-con" href="/directory/category/halo-the-master-chief-collection?filter=drops">con filtro</a>
  <a id="ctrl-sin" href="/directory/category/halo-the-master-chief-collection">sin filtro</a>
</div>
<div id="control-huerfano">
  <a id="ctrl-solo" href="/directory/category/halo-the-master-chief-collection?filter=drops">sin campaña</a>
</div>`;

(async () => {
    const r = await run({ waitMs: 9000, lateHtml: CONTROL, lateMs: 4000 });
    const d = r.w.document;
    const href = (sel) => { const a = d.querySelector(sel); return a ? a.getAttribute('href') : null; };

    const hints = [...d.querySelectorAll('a[data-test-selector="DropsCampaignInProgressDescription-no-channels-hint-text"]')]
        .map(a => a.getAttribute('href'));
    console.log('  enlaces del volcado:', JSON.stringify(hints, null, 1));

    comprobar(hints.length === 2, 'el volcado sigue trayendo los dos enlaces (control positivo del fixture)');
    comprobar(hints.every(h => /[?&]dropID=/.test(h)), 'los dos llevan ya el dropID');
    comprobar(hints.every(h => /\/directory\/category\/[^?]+\?filter=drops/.test(h)),
        'y conservan el slug y el filtro que traia Twitch');

    // El cruce: cada campaña con SU id. Salen del propio volcado, no de una lista escrita
    // a mano, para que renombrar el fixture no deje el test mintiendo en verde.
    const dragon = hints.find(h => h.includes('dragon-ball-project-multi'));
    const wow = hints.find(h => h.includes('world-of-warcraft'));
    comprobar(!!dragon && dragon.includes('dropID=4c219285-bcf7-422a-9e2e-1603ced3d10c'),
        'Dragon Ball apunta a su campaña');
    comprobar(!!wow && wow.includes('dropID=8ac3cc4f-870f-4f72-a6e7-f9aebd1f8d5a'),
        'World of Warcraft apunta a la suya, que es OTRA');

    // Controles inyectados tarde.
    comprobar(href('#ctrl-con') === '/directory/category/halo-the-master-chief-collection?filter=drops&dropID=ctrl-1111',
        'el observer coge lo que se monta despues y le pone el id de su campaña');
    comprobar(href('#ctrl-sin') === '/directory/category/halo-the-master-chief-collection',
        'un enlace de categoria sin filtro de drops se queda intacto');
    comprobar(href('#ctrl-solo') === '/directory/category/halo-the-master-chief-collection?filter=drops',
        'y uno sin campaña a la vista tambien: antes eso que enlazar la campaña equivocada');


    // El bold. Se comprueban las DOS mitades porque cada una sola miente: el atributo sin
    // la hoja no pinta nada, y la hoja sin el atributo no alcanza a ningun enlace.
    const marcados = [...d.querySelectorAll('a[data-drop-dir-filtered="1"]')].length;
    const hoja = d.getElementById('twitch-drops-dir-css');
    comprobar(marcados === 3, 'los tres enlaces cambiados quedan marcados (2 del volcado + el del control)');
    comprobar(!!hoja && /font-weight:\s*700/.test(hoja.textContent),
        'y la hoja que los pone en negrita esta puesta');
    comprobar(!d.querySelector('#ctrl-sin[data-drop-dir-filtered]') &&
              !d.querySelector('#ctrl-solo[data-drop-dir-filtered]'),
        'los que no se tocaron tampoco salen en negrita');
    console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo en verde');
    process.exit(fallos ? 1 : 0);
})();
