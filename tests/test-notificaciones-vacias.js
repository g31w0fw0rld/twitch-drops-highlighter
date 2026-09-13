// LA SOLAPA DE NOTIFICACIONES SE QUEDABA EN BLANCO.
//
// Reportado el 2026-09-12 con capturas: al abrir 🔔 (0) a veces salia el «✓ no hay
// ninguna» y a veces no salia NADA, ni mensaje ni filas. La sospecha era la limpieza de
// notificaciones, y no era: esa rama si pinta el mensaje.
//
// La causa es quien llama a `renderNotificationsTab`, que es quien pinta el mensaje. En
// `/drops/campaigns` la llama el escaneo al terminar, asi que alli salia siempre; en
// `/drops/inventory` no hay escaneo —esa rama hace `cleanInventory` y `_rerenderPanes`—
// y nadie la llamaba, asi que el pane se quedaba con cero hijos. De ahi el «a veces».
//
// Las DOS paginas van en el mismo test a proposito: campañas es el control positivo. El
// arreglo pinta la solapa al construir el panel, y si un dia eso rompiera el caso que ya
// funcionaba —pintar el «no hay ninguna» ENCIMA de notificaciones que si existen— se
// veria aqui y no en un reporte.
const { run, readFixture } = require('./harness');

const dia = 86400000, ahora = Date.now(), iso = (t) => new Date(t).toISOString();
const dashboard = [{ data: { currentUser: { id: '1', login: 'p', dropCampaigns: [{
    id: 'c1', name: 'Camp', status: 'ACTIVE',
    startAt: iso(ahora - dia), endAt: iso(ahora + dia),
    owner: { name: 'O', login: 'o' }, game: { id: '1', displayName: 'Pokémon' }
}] }, rewardCampaignsAvailableToUser: [] } }];
const detalles = [{ data: { user: { dropCampaign: { timeBasedDrops: [] } } } }];
const inventory = [{ data: { currentUser: { inventory: {
    dropCampaignsInProgress: [], gameEventDrops: [], earnedDropRewards: { edges: [] } } } } }];

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok    ' : '  FALLA ') + msg); if (!ok) fallos++; };

const pane = (r) => r.w.document.getElementById('twitch-drops-notifs-pane');

(async () => {
    const inv = await run({
        url: 'https://www.twitch.tv/drops/inventory', waitMs: 11000,
        keywords: ['pokemon', 'halo'],
        gql: { ViewerDropsDashboard: dashboard, DropCampaignDetails: detalles, Inventory: inventory }
    });
    const pInv = pane(inv);
    console.log('  inventario  ->', pInv.children.length, 'hijo(s):', JSON.stringify(pInv.textContent.trim().slice(0, 60)));
    comprobar(!!pInv, 'el pane de notificaciones existe en el inventario');
    comprobar(pInv.children.length > 0, 'y NO se queda vacio: algo dice');
    comprobar(/✓/.test(pInv.textContent), 'lo que dice es el mensaje de «no hay ninguna»');

    const camp = await run({
        url: 'https://www.twitch.tv/drops/campaigns', waitMs: 12000,
        dump: readFixture('fixture-campanas-acordeon-expandido.html'),
        keywords: ['pokemon', 'halo'],
        gql: { ViewerDropsDashboard: dashboard, DropCampaignDetails: detalles, Inventory: inventory }
    });
    const pCamp = pane(camp);
    console.log('  campañas    ->', pCamp.children.length, 'hijo(s):', JSON.stringify(pCamp.textContent.trim().slice(0, 60)));
    comprobar(pCamp.children.length > 0, 'en campañas tampoco queda vacio (control positivo)');
    comprobar(!/✓/.test(pCamp.textContent),
        'y ahi NO sale el «no hay ninguna», porque si hay: el arreglo no pisa las que existen');

    console.log(fallos ? `\n${fallos} fallo(s)` : '\ntodo en verde');
    process.exit(fallos ? 1 : 0);
})();
