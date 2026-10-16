// El panel se mete DEBAJO de los menus de Twitch, y vuelve a su sitio al cerrarse.
//
// Pedido el 2026-10-15 con capturas: la cuenta, Bits, susurros, menciones,
// notificaciones y Prime/Luna se abrian por debajo del panel. Medido ese dia: Twitch los
// monta todos como un `.ReactModal__Overlay` dentro de `.tw-dialog-layer`, colgada de
// <body> con `z-index: 5000`, y el overlay recibe `--after-open` un instante despues de
// montarse. El panel tenia 9999.
//
// Se reproduce la secuencia de react-modal: capa vacia ya montada (no mueve nada), overlay
// sin `--after-open` (tampoco), la clase llega (el panel baja a 4999), el overlay se
// desmonta (vuelve a 9999). Contra 1.3.28 se queda en 9999.
const { run } = require('./harness');

const espera = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    const r = await run({ waitMs: 6000, url: 'https://www.twitch.tv/drops/campaigns' });
    const w = r.w, d = w.document;
    const panel = d.getElementById('twitch-drops-panel');
    const z = () => panel ? panel.style.zIndex : null;
    const fotos = {};
    const fallos = [];
    if (!panel) { console.log('FALLOS: no hay panel'); process.exit(1); }

    const capa = d.createElement('div');
    capa.className = 'ScReactModalBase-sc-26ijes-0 tw-dialog-layer';
    capa.style.position = 'relative';
    capa.style.zIndex = '5000';
    d.body.appendChild(capa);
    await espera(50);
    fotos.capaVacia = z();

    const overlay = d.createElement('div');
    overlay.className = 'ReactModal__Overlay';
    overlay.style.position = 'fixed';
    overlay.innerHTML = '<div class="user-menu-dropdown__main-menu">Menu de la cuenta</div>';
    capa.appendChild(overlay);
    await espera(50);
    fotos.sinAfterOpen = z();

    overlay.classList.add('ReactModal__Overlay--after-open');
    await espera(50);
    fotos.abierto = z();

    overlay.remove();
    await espera(50);
    fotos.cerrado = z();

    console.log(JSON.stringify(fotos));
    if (fotos.capaVacia !== '9999') fallos.push('la capa vacia ya movio el panel: ' + fotos.capaVacia);
    if (fotos.sinAfterOpen !== '9999') fallos.push('el overlay sin --after-open ya movio el panel: ' + fotos.sinAfterOpen);
    if (fotos.abierto !== '4999') fallos.push('con el menu abierto el panel no queda en 4999: ' + fotos.abierto);
    if (fotos.cerrado !== '9999') fallos.push('al cerrar el menu el panel no vuelve a 9999: ' + fotos.cerrado);

    console.log(fallos.length ? 'FALLOS: ' + fallos.join(' | ') : 'TODO OK');
    process.exit(fallos.length ? 1 : 0);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
