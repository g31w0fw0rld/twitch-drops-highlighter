// EL MODAL DE CANALES, CON FOTO Y CON QUIEN ESTA EN DIRECTO.
//
// `allow.channels` trae `{id, name, displayName}` y nada mas, asi que la foto y el
// directo salen de una consulta aparte —`users(logins:)`, en texto y no persisted—, y una
// sola sirve para las dos cosas. Las filas salen al instante con «…» y, al llegar la
// respuesta, se marcan y se reordenan: en directo primero, de mas a menos espectadores;
// despues los que no emiten, por orden alfabetico; al final lo que no se sabe.
//
// Los casos, cada uno con su forma de fallar:
//   · un login que la consulta no devuelve (cuenta cerrada) sale con «?» y AL FINAL, no
//     como offline;
//   · si la consulta entera falla —Twitch deja de aceptar consultas en texto—, todas las
//     filas se quedan con «?» y el modal sigue funcionando: los nombres y los enlaces
//     estan, que es lo que habia antes;
//   · con mas de cien canales la consulta va en lotes de cien, el tope de `logins`.
const { run, readFixture } = require('./harness');

const dia = 86400000, ahora = Date.now(), iso = (t) => new Date(t).toISOString();
const dashboard = [{ data: { currentUser: { id: '1', login: 'p', dropCampaigns: [{
    id: 'halo-btb-0001', name: 'BTB Ladies Night-SEP12', status: 'ACTIVE',
    startAt: iso(ahora - dia), endAt: iso(ahora + 5 * dia),
    owner: { name: 'Estudio', login: 'estudio' }, game: { id: '1', displayName: 'Halo: The Master Chief Collection' }
}] }, rewardCampaignsAvailableToUser: [] } }];
const detalles = (canales, juego) => ([{ data: { user: { dropCampaign: {
    timeBasedDrops: [], ...(juego ? { game: { id: juego, displayName: 'Halo' } } : {}),
    allow: { channels: canales.map((n, i) => ({ id: String(i), name: n.toLowerCase(), displayName: n })) }
} } } }]);
const inventory = [{ data: { currentUser: { inventory: {
    dropCampaignsInProgress: [], gameEventDrops: [], earnedDropRewards: { edges: [] } } } } }];

// La consulta de directo: contesta segun `tabla` (login -> viewers | 'off' |
// { v: viewers, g: id de juego o null }), en el orden pedido y con null para los que no
// existen, como hace Twitch.
const lotes = [];
const estadoGql = (tabla) => (cuerpo) => {
    const logins = cuerpo[0].variables.logins;
    lotes.push(logins.length);
    return [{ data: { users: logins.map(l => {
        const v = tabla[l];
        if (v === undefined) return null;
        const vv = typeof v === 'object' ? v.v : v;
        const juego = typeof v === 'object' ? v.g : '1';
        return { login: l, profileImageURL: `https://static-cdn.jtvnw.net/${l}-50x50.png`,
                 stream: v === 'off' ? null : { id: 's' + l, viewersCount: vv, game: juego ? { id: juego } : null } };
    }) } }];
};

const HALO = 'a[data-drop-dir-filtered="1"]';
const filasDe = (w) => {
    const m = [...w.document.querySelectorAll('div')]
        .find(d => d.textContent.includes('Canales participantes') && d.querySelector('a[data-canal]'));
    if (!m) return null;
    return [...m.querySelectorAll('a[data-canal]')].map(a => {
        const b = a.querySelector('.twitch-live-badge');
        const img = a.querySelector('img');
        return {
            login: a.getAttribute('data-canal'),
            nombre: a.querySelector('[data-canal-nombre]').textContent,
            marca: b && b.textContent, estado: b && b.getAttribute('data-live'),
            aviso: b && (b.getAttribute('title') || ''),
            foto: img && img.getAttribute('src'),
            // Una imagen `lazy` con display:none no se descarga nunca en el navegador.
            // jsdom no carga imagenes, asi que esto es lo unico que puede vigilarse aqui.
            fotoInvisible: !!img && img.loading === 'lazy' && img.style.display === 'none'
        };
    });
};

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok    ' : '  FALLA ') + msg); if (!ok) fallos++; };

const base = (canales, estado, juego) => ({
    url: 'https://www.twitch.tv/drops/campaigns',
    dump: readFixture('fixture-campanas-acordeon-expandido.html'),
    keywords: ['halo'], waitMs: 12000,
    clicarSelector: HALO, clicarIndice: 0, clicarEnMs: 9000,
    gql: { ViewerDropsDashboard: dashboard, DropCampaignDetails: detalles(canales, juego), Inventory: inventory,
           DropsHighlighterChannelStatus: estado }
});

(async () => {
    console.log('\n=== marcas, fotos y orden ===');
    const r = await run(base(['Ana', 'Beto', 'Cora', 'Dani', 'Eva'],
        estadoGql({ ana: 'off', beto: 50, cora: 1900, eva: 'off' })));
    const f = filasDe(r.w);
    comprobar(!!f, 'se abre el modal');
    if (!f) process.exit(1);
    console.log('  filas:', JSON.stringify(f.map(x => [x.login, x.marca])));
    const por = Object.fromEntries(f.map(x => [x.login, x]));
    comprobar(JSON.stringify(f.map(x => x.login)) === JSON.stringify(['cora', 'beto', 'ana', 'eva', 'dani']),
        'en directo por espectadores, offline alfabetico, desconocido al final');
    comprobar(por.cora.estado === 'live' && /^● /.test(por.cora.marca) && /1,9|1\.9/.test(por.cora.marca),
        'en directo: punto y cifra corta');
    // En español 1900 va sin separador (la norma solo agrupa desde cinco cifras).
    comprobar(/1[.,\u00a0\u202f ]?900 espectadores/.test(por.cora.aviso), 'y la cifra exacta en el aviso');
    comprobar(por.ana.estado === 'offline' && por.ana.marca === 'Desconectado', 'offline: «Desconectado» (es)');
    comprobar(por.dani.estado === 'unknown' && por.dani.marca === '?', 'el login que no devuelve la consulta es «?»');
    comprobar(por.cora.foto === 'https://static-cdn.jtvnw.net/cora-50x50.png', 'la fila lleva la foto del canal');
    comprobar(!por.dani.foto, 'y sin foto, el circulo gris (ninguna URL inventada)');
    comprobar(f.every(x => !x.fotoInvisible),
        'ninguna foto diferida con display:none (el navegador no la descargaria: todas en gris)');
    comprobar(por.beto.nombre === 'Beto', 'el nombre sigue siendo el displayName');

    console.log('\n=== la consulta falla entera ===');
    const r2 = await run(base(['Ana', 'Beto'], () => [{ errors: [{ message: 'unknown query' }], data: null }]));
    const f2 = filasDe(r2.w);
    comprobar(!!f2 && f2.length === 2, 'el modal se abre igual, con sus dos canales');
    comprobar(!!f2 && f2.every(x => x.estado === 'unknown'), 'y todas las marcas en «?», ninguna «offline» inventada');

    console.log('\n=== mas de cien canales: lotes de cien ===');
    lotes.length = 0;
    const muchos = Array.from({ length: 150 }, (_, i) => 'canal' + i);
    const r3 = await run(base(muchos, estadoGql(Object.fromEntries(muchos.map(l => [l, 'off'])))));
    const f3 = filasDe(r3.w);
    console.log('  lotes:', JSON.stringify(lotes));
    comprobar(JSON.stringify(lotes) === '[100,50]', 'dos consultas, de 100 y de 50');
    comprobar(!!f3 && f3.length === 150 && f3.every(x => x.estado === 'offline'), 'y los 150 marcados');

    console.log('\n=== en directo con OTRO juego: «Desconectado», como en Kick ===');
    // La campaña es de Halo (juego 1). Cora emite Halo; Beto emite otro juego y Eva emite
    // sin categoria: los dos, «Desconectado» —ahi no se gana el drop—. Decidido el
    // 2026-10-03 para que Twitch diga lo mismo que Kick.
    const r5 = await run(base(['Beto', 'Cora', 'Eva'],
        estadoGql({ beto: { v: 9000, g: '999' }, cora: { v: 20, g: '1' }, eva: { v: 50, g: null } }), '1'));
    const f5 = filasDe(r5.w);
    const por5 = f5 ? Object.fromEntries(f5.map(x => [x.login, x])) : {};
    console.log('  filas:', JSON.stringify(f5 && f5.map(x => [x.login, x.marca])));
    comprobar(!!f5 && por5.cora.estado === 'live', 'el que emite el juego de la campaña, en directo');
    comprobar(!!f5 && por5.beto.estado === 'offline' && por5.beto.marca === 'Desconectado',
        'el que emite otro juego, «Desconectado» aunque tenga 9.000 espectadores');
    comprobar(!!f5 && por5.eva.estado === 'offline', 'y el que emite sin juego, tambien');
    comprobar(!!f5 && por5.beto.aviso === 'No está transmitiendo el juego de esta campaña',
        'con un aviso que es cierto para el: no transmite el juego de ESTA campaña');
    comprobar(!!f5 && f5[0].login === 'cora', 'y el de la campaña va primero');

    console.log('\n=== refresco cada minuto, y se para al cerrar ===');
    // El intervalo de 60 s se captura y se dispara a mano. Con la cache de un minuto, en
    // cada tick la entrada tiene 59 s: si el refresco no obligara a pedir de nuevo, la
    // pasaria por fresca y el modal solo se refrescaria cada dos minutos.
    const tabla = { ana: 'off', beto: 50 };
    const r4 = await run(Object.assign(base(['Ana', 'Beto'], estadoGql(tabla)), { intervaloManual: 60000 }));
    const consultas = () => r4.pedidas.filter(o => o === 'DropsHighlighterChannelStatus').length;
    const refrescos = r4.intervalos;
    comprobar(refrescos.length === 1 && refrescos[0].vivo, 'el modal deja puesto un refresco de 60 s');
    const antes = consultas();
    tabla.ana = 4000; // Ana empieza a transmitir
    refrescos[0] && refrescos[0].disparar();
    // `_gqlRequest` espera la sesion con un sondeo de 500 ms antes de salir.
    await new Promise(res => setTimeout(res, 1500));
    comprobar(consultas() === antes + 1, 'el tick vuelve a consultar aunque la cache tenga menos de un minuto');
    const f4 = filasDe(r4.w);
    comprobar(!!f4 && f4[0].login === 'ana' && f4[0].estado === 'live', 'y Ana, que empezo a transmitir, sube la primera');
    const aceptar = [...r4.w.document.querySelectorAll('button')].find(b => b.textContent === 'Aceptar');
    if (aceptar) aceptar.click();
    await new Promise(res => setTimeout(res, 50));
    comprobar(!!aceptar && refrescos[0] && !refrescos[0].vivo, 'al cerrar con «Aceptar» el refresco se cancela');

    console.log(fallos ? `\n${fallos} fallo(s) — FALLOS` : '\ntodo en verde');
    process.exit(fallos ? 1 : 0);
})();
