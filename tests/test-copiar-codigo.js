// EL «COPIAR» DEL MODAL «RECLAMAR OFERTA» (pedido el 2026-11-17).
//
// Las recompensas que Twitch entrega como código abren, desde el inventario, un modal con
// el código en un campo de solo lectura pegado al botón «Canjear». El campo corta el
// código, y el script pone entre los dos un «Copiar» que lo deja entero en el portapapeles.
//
// El modal de abajo es el ESQUELETO del real de ese día («Toying Around Add-On»), sacado
// con una lista blanca de atributos y las clases propias de Twitch que no son hash
// (`tw-combo-input`, `tw-input`…): la extensión del navegador no deja salir el outerHTML
// entero. El CÓDIGO NO ES EL DE LA CUENTA: es uno inventado con la misma longitud (29) y
// la misma forma en grupos, que el de verdad no tiene por qué estar en el repositorio.
//
// Lo que se comprueba, y por qué:
//   · con código: UN botón —el arnés arranca el script dos veces, así que dos es el
//     observer de cada arranque metiendo el suyo—, entre el campo y «Canjear», y al
//     pulsarlo el portapapeles recibe el código exacto y la etiqueta dice «¡Copiado!».
//   · con el campo vacío al montarse y el código llegando después: el botón aparece
//     cuando llega el valor y no antes. React escribe el valor como propiedad y eso no
//     es una mutación del DOM, así que sin reintentos no se vería nunca.
//   · sin código —el campo vacío todo el rato—: ni botón. Es el «solo si tiene».
//   · un campo que no es de solo lectura dentro de un diálogo (un buscador, por ejemplo):
//     ni botón. Lo de solo lectura es lo que dice que eso es un código y no algo que se
//     escribe.
//   · el portapapeles negado: la etiqueta dice que falló y el código se queda
//     SELECCIONADO en el campo, para copiarlo a mano con el teclado.
//
// Contra la 1.3.34 fallan los casos con código: no hay botón.
const { run } = require('./harness');

const CODIGO = 'TEST1-ABCDE-FGHIJ-KLMNO-PQRS9';
if (CODIGO.length !== 29) { console.log('FALLOS:\n - el código de prueba ya no mide lo que el real (29)'); process.exit(1); }

const modal = ({ valor = CODIGO, soloLectura = true } = {}) => `
<div role="dialog" aria-modal="true" aria-labelledby="modal-oferta-header">
  <div class="ScTransitionBase-sc-hx4quq-0 tw-transition"><div class="ScModalBackdrop-sc-1fh27hq-0"></div></div>
  <div class="ScTransitionBase-sc-hx4quq-0 tw-transition">
    <div class="Layout-sc-1xcs6mc-0 ScModalWrapper-sc-1k48se-0 tw-modal">
      <div class="ScModalHeader-sc-1j4ii0l-0 tw-modal-header">
        <div class="ScModalHeaderButton-sc-1j4ii0l-1 tw-modal-header__button"></div>
        <div class="ScModalHeaderTitle-sc-1j4ii0l-2 tw-modal-header__title"><h2 class="CoreText-sc-1txzju1-0" id="modal-oferta-header">Reclamar oferta</h2></div>
        <div class="ScModalHeaderButton-sc-1j4ii0l-1 tw-modal-header__button"><button aria-label="Cerrar modal" class="ScCoreButton-sc-ocjdkq-0 ScButtonIcon-sc-9yap0r-0"><div class="ButtonIconFigure-sc-1emm8lf-0"><div class="ScSvgWrapper-sc-wkgzod-0 tw-svg"><svg role="presentation"></svg></div></div></button></div>
      </div>
      <div class="Layout-sc-1xcs6mc-0">
        <div class="Layout-sc-1xcs6mc-0"><img class="tw-image" alt=""></div>
        <div class="Layout-sc-1xcs6mc-0">
          <div class="Layout-sc-1xcs6mc-0"><p class="CoreText-sc-1txzju1-0">Toying Around Add-On</p></div>
          <div class="Layout-sc-1xcs6mc-0"><p class="CoreText-sc-1txzju1-0">Visita <a target="_blank" rel="noopener noreferrer" class="ScCoreLink-sc-16kq0mq-0 tw-link" href="https://www.twitch.tv/">aquí</a> para conocer más información.</p></div>
          <div class="Layout-sc-1xcs6mc-0 tw-combo-input">
            <div class="ScInputWrapper-sc-1fxjr4l-0 tw-combo-input__input">
              <div class="ScInputContainer-sc-vu7u7d-3"><div class="Layout-sc-1xcs6mc-0">
                <input data-a-target="tw-input" type="text"${soloLectura ? ' readonly=""' : ''} class="ScInputBase-sc-vu7u7d-0 ScInput-sc-19xfhag-0 tw-input" value="${valor}">
              </div></div>
            </div>
            <div class="Layout-sc-1xcs6mc-0">
              <button aria-label="Botón de canjear" class="ScCoreButton-sc-ocjdkq-0"><div class="ScCoreButtonLabel-sc-s7h2b7-0"><div data-a-target="tw-core-button-label-text" class="Layout-sc-1xcs6mc-0">Canjear</div></div></button>
            </div>
          </div>
          <div class="Layout-sc-1xcs6mc-0"><p class="CoreText-sc-1txzju1-0">Oferta disponible hasta el 22 nov 2026.</p></div>
        </div>
      </div>
      <div class="Layout-sc-1xcs6mc-0"><div class="Layout-sc-1xcs6mc-0"><button class="ScCoreButton-sc-ocjdkq-0"><div class="ScCoreButtonLabel-sc-s7h2b7-0"><div data-a-target="tw-core-button-label-text" class="Layout-sc-1xcs6mc-0">Cerrar</div></div></button></div></div>
    </div>
  </div>
</div>`;

// Un portapapeles que apunta lo que recibe; con `niega` rechaza, como un navegador que no
// da permiso. jsdom no trae `execCommand`, así que negado aquí falla también el respaldo.
const portapapeles = (niega = false) => {
    const copiado = [];
    const preparar = (w) => {
        Object.defineProperty(w.navigator, 'clipboard', {
            configurable: true,
            value: { writeText: (s) => niega ? Promise.reject(new Error('NotAllowedError')) : (copiado.push(s), Promise.resolve()) }
        });
    };
    return { copiado, preparar };
};

const SEL = '[data-twitch-drops-copiar]';
const MONTAJE = 3000;

function foto(w) {
    const d = w.document;
    const botones = Array.from(d.querySelectorAll(SEL));
    const b = botones[0];
    const combo = d.querySelector('.tw-combo-input');
    const campo = combo && combo.querySelector('input');
    return {
        botones: botones.length,
        texto: b ? b.textContent : null,
        hijoDelCombo: !!(b && b.parentElement === combo),
        antesEsElCampo: !!(b && b.previousElementSibling && b.previousElementSibling.contains(campo)),
        despuesEsCanjear: !!(b && b.nextElementSibling && /Canjear/.test(b.nextElementSibling.textContent)),
        seleccion: campo ? [campo.selectionStart, campo.selectionEnd] : null
    };
}

(async () => {
    const fallos = [];

    // --- Con código -------------------------------------------------------------------
    {
        const pp = portapapeles();
        const r = await run({
            preparar: pp.preparar, lateHtml: modal(), lateMs: MONTAJE,
            clicarSelector: SEL, clicarEnMs: MONTAJE + 1500, waitMs: MONTAJE + 2200
        });
        const f = foto(r.w);
        console.log(JSON.stringify({ caso: 'con código', ...f, copiado: pp.copiado }));
        if (f.botones !== 1) fallos.push(`con código hay ${f.botones} botones de copiar y tenía que haber 1`);
        if (!f.hijoDelCombo || !f.antesEsElCampo || !f.despuesEsCanjear) fallos.push(`con código el botón no queda entre el campo y «Canjear»: ${JSON.stringify(f)}`);
        if (JSON.stringify(pp.copiado) !== JSON.stringify([CODIGO])) fallos.push(`al pulsarlo se copió ${JSON.stringify(pp.copiado)} y tenía que ser el código entero`);
        if (f.texto !== '¡Copiado!') fallos.push(`tras copiar la etiqueta dice «${f.texto}»`);
        r.dom.window.close();
    }

    // --- El código llega después de montarse el modal -------------------------------
    {
        let antes = null;
        const pp = portapapeles();
        const r = await run({
            preparar: (w) => {
                pp.preparar(w);
                setTimeout(() => {
                    antes = w.document.querySelectorAll(SEL).length;
                    const campo = w.document.querySelector('.tw-combo-input input');
                    if (campo) campo.value = CODIGO; // como React: propiedad, sin mutación
                }, MONTAJE + 900);
            },
            lateHtml: modal({ valor: '' }), lateMs: MONTAJE, waitMs: MONTAJE + 2500
        });
        const f = foto(r.w);
        console.log(JSON.stringify({ caso: 'código tardío', antes, ...f }));
        if (antes !== 0) fallos.push(`con el campo aún vacío ya había ${antes} botones`);
        if (f.botones !== 1) fallos.push(`cuando llegó el código no apareció el botón (hay ${f.botones})`);
        r.dom.window.close();
    }

    // --- Sin código ---------------------------------------------------------------------
    {
        const r = await run({ lateHtml: modal({ valor: '' }), lateMs: MONTAJE, waitMs: MONTAJE + 4500 });
        const f = foto(r.w);
        console.log(JSON.stringify({ caso: 'sin código', ...f }));
        if (f.botones !== 0) fallos.push(`sin código salió el botón (${f.botones})`);
        r.dom.window.close();
    }

    // --- Un campo editable: no es un código ----------------------------------------------
    {
        const r = await run({ lateHtml: modal({ soloLectura: false }), lateMs: MONTAJE, waitMs: MONTAJE + 1500 });
        const f = foto(r.w);
        console.log(JSON.stringify({ caso: 'campo editable', ...f }));
        if (f.botones !== 0) fallos.push(`con un campo editable salió el botón (${f.botones})`);
        r.dom.window.close();
    }

    // --- El portapapeles negado ----------------------------------------------------------
    {
        const pp = portapapeles(true);
        const r = await run({
            preparar: pp.preparar, lateHtml: modal(), lateMs: MONTAJE,
            clicarSelector: SEL, clicarEnMs: MONTAJE + 1500, waitMs: MONTAJE + 2200
        });
        const f = foto(r.w);
        console.log(JSON.stringify({ caso: 'portapapeles negado', ...f }));
        if (f.texto !== 'Falló') fallos.push(`con el portapapeles negado la etiqueta dice «${f.texto}»`);
        if (JSON.stringify(f.seleccion) !== JSON.stringify([0, CODIGO.length])) fallos.push(`con el portapapeles negado el código no queda seleccionado: ${JSON.stringify(f.seleccion)}`);
        r.dom.window.close();
    }

    if (fallos.length) { console.log('\nFALLOS:'); fallos.forEach(x => console.log(' - ' + x)); process.exit(1); }
    console.log('\nTODO OK');
    process.exit(0);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
