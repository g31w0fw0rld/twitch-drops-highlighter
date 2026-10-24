// LOS ENLACES A UN CANAL, EN PESTAÑA NUEVA (2026-10-23).
//
// En campañas, «Cómo obtener el Drop» dice «Ve a un canal participante en vivo, como
// RocketLeague, RocketLeagueSAM…», y cada nombre es un `<a href="/rocketleague">` que
// navegaba en la misma pestaña con el enrutador de Twitch. Ahora el clic simple lo abre
// en otra, como los canales del modal propio, y el inventario hereda lo mismo.
//
// Lo que NO tiene que cambiar: el clic con ctrl/cmd (lo decide el navegador), los
// enlaces que ya traen su `target` («otros», a la categoria), las rutas de Twitch de un
// segmento (/directory, /drops…) y los canales de la barra lateral, fuera del contenido.
//
// Control negativo (tiene que salir en ROJO con el codigo publicado):
//   git show HEAD:twitch-drops-highlighter.user.js > /tmp/pub.js
//   TW_SCRIPT=/tmp/pub.js node tests/test-enlaces-canal-pestana-nueva.js
const { run, readFixture } = require('./harness');

const inventory = [{ data: { currentUser: { inventory: { dropCampaignsInProgress: [], gameEventDrops: [], earnedDropRewards: { edges: [] } } } } }];
const dashboard = [{ data: { currentUser: { id: '1', login: 'prueba', dropCampaigns: [] }, rewardCampaignsAvailableToUser: [] } }];

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok    ' : '  FALLA ') + msg); if (!ok) fallos++; };

const pulsar = (w, a, extra = {}) => {
    let enRaiz = false;
    const oye = () => { enRaiz = true; };
    w.document.addEventListener('click', oye);
    const sigue = a.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...extra }));
    w.document.removeEventListener('click', oye);
    return { cancelado: !sigue, enRaiz };
};

(async () => {
    // --- Campañas: los canales de «Cómo obtener el Drop» ---------------------------
    const r = await run({
        url: 'https://www.twitch.tv/drops/campaigns',
        dump: readFixture('fixture-campanas-torneo-diario.html'),
        keywords: ['rocket'],
        waitMs: 8000,
        gql: { ViewerDropsDashboard: dashboard, Inventory: inventory }
    });
    const w = r.w;
    const abiertas = [];
    w.open = (u) => { abiertas.push(String(u)); return null; };

    const canal = w.document.querySelector('a[href="/rocketleague"]');
    comprobar(!!canal, 'el volcado trae el enlace a RocketLeague');
    if (canal) {
        const c = pulsar(w, canal);
        comprobar(c.cancelado && !c.enRaiz, 'el clic simple no llega a React ni navega en la pestaña');
        comprobar(abiertas.length === 1 && abiertas[0] === 'https://www.twitch.tv/rocketleague',
            `y abre el canal en otra pestaña: ${JSON.stringify(abiertas)}`);
        abiertas.length = 0;
        const conCtrl = pulsar(w, canal, { ctrlKey: true });
        comprobar(!conCtrl.cancelado && abiertas.length === 0, 'con ctrl decide el navegador');
    }

    const otros = w.document.querySelector('a[href^="/directory/category/rocket-league"]');
    abiertas.length = 0;
    if (otros) {
        pulsar(w, otros);
        comprobar(!abiertas.some(u => /\/rocket-league$/.test(u)), '«otros» (categoría, con su target) no pasa por aquí');
    }

    // --- Una ruta de Twitch de un segmento no es un canal --------------------------
    const ruta = w.document.createElement('a');
    ruta.href = '/directory';
    ruta.textContent = 'Explorar';
    w.document.body.appendChild(ruta);
    abiertas.length = 0;
    const cRuta = pulsar(w, ruta);
    comprobar(!cRuta.cancelado && abiertas.length === 0, '/directory sigue navegando como siempre');

    // --- Con <main>: dentro sí, la barra lateral no ---------------------------------
    const main = w.document.createElement('main');
    main.innerHTML = '<div class="inventory-campaign-info"><a href="/shroud">shroud</a></div>';
    const lateral = w.document.createElement('aside');
    lateral.innerHTML = '<a href="/pokimane">pokimane</a>';
    w.document.body.appendChild(lateral);
    w.document.body.appendChild(main);
    abiertas.length = 0;
    const cMain = pulsar(w, main.querySelector('a'));
    comprobar(cMain.cancelado && abiertas[0] === 'https://www.twitch.tv/shroud', 'un canal dentro del contenido (inventario) se abre aparte');
    abiertas.length = 0;
    const cLat = pulsar(w, lateral.querySelector('a'));
    comprobar(!cLat.cancelado && abiertas.length === 0, 'un canal de la barra lateral se queda como estaba');

    console.log(fallos ? `\n  ${fallos} FALLAN` : '\n  todo en verde');
    process.exit(fallos ? 1 : 0);
})();
