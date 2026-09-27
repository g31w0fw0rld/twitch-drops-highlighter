// EL TITULO DEL MODAL DE CANALES SALIA CON EL ❌ PEGADO EN EL INVENTARIO.
//
// Reportado el 2026-09-26 con captura: «TSG WarzoneShowdown-SEP26❌». El nombre de la
// campaña se lee del primer `<p>` de su `.inventory-campaign-info`, y el ❌ de descartar
// lo inserta el script DENTRO de ese mismo `<p>`, detras del enlace. Su textContent
// traia las dos cosas.
//
// El control positivo va primero y es el que da sentido al resto: que el ❌ este de
// verdad dentro del `<p>` cuando se abre el modal. Sin el, un titulo limpio saldria
// verde solo porque el ❌ aun no se habia puesto —que es justo como se colo el fallo
// cuando se verifico el titulo el 2026-09-13—.
const { run } = require('./harness');

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok    ' : '  FALLA ') + msg); if (!ok) fallos++; };

const detalles = [{ data: { user: { dropCampaign: {
    timeBasedDrops: [],
    allow: { channels: ['okom_', 'eli_x', 'theredgear'].map((n, i) => ({ id: String(i), name: n, displayName: n })) }
} } } }];

(async () => {
    const r = await run({ waitMs: 9000, gql: { DropCampaignDetails: detalles } });
    const w = r.w, d = w.document;
    const enlace = [...d.querySelectorAll('a[data-test-selector="DropsCampaignInProgressDescription-no-channels-hint-text"]')]
        .find(a => a.getAttribute('href').includes('world-of-warcraft'));
    comprobar(!!enlace, 'el volcado trae el enlace de canales de World of Warcraft');
    if (!enlace) process.exit(1);

    const bloque = enlace.closest('.inventory-campaign-info');
    const p = bloque && bloque.querySelector('p');
    const esperado = p && p.querySelector('a.tw-link[href*="dropID="]').textContent.replace(/\s+/g, ' ').trim();
    // Por el texto y no por la marca `data-drop-remove`: asi el mismo test corre contra
    // el codigo de antes del arreglo (TW_SCRIPT=...) y ahi tiene que fallar el titulo,
    // no el control.
    comprobar(!!(p && p.textContent.includes('❌')),
        'control positivo: el ❌ esta dentro del <p> del nombre');

    // El enlace solo se intercepta cuando la lista ya esta en memoria: se precarga al
    // pasar por encima, como en el navegador.
    enlace.dispatchEvent(new w.Event('mouseenter'));
    await new Promise(res => setTimeout(res, 500));
    enlace.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await new Promise(res => setTimeout(res, 300));

    const modal = [...d.querySelectorAll('div')]
        .find(x => x.textContent.includes('Canales participantes') && x.querySelector('a[href*="twitch.tv/"]'));
    comprobar(!!modal, 'se abre el modal');
    const titulo = modal && modal.firstElementChild && [...modal.querySelectorAll('div')]
        .find(x => x.children.length === 0 && x.textContent.trim() && x.textContent !== 'Canales participantes');
    const texto = titulo ? titulo.textContent : '';
    console.log('  titulo del modal:', JSON.stringify(texto), ' esperado:', JSON.stringify(esperado));
    comprobar(!texto.includes('❌'), 'el titulo no lleva el ❌');
    comprobar(texto === esperado, 'el titulo es el nombre de la campaña tal cual');

    console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo en verde');
    process.exit(fallos ? 1 : 0);
})();
