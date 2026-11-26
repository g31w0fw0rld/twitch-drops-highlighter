// EL ESTADO DE CADA GRUPO DE UNA REWARD CAMPAIGN, DICHO POR TWITCH (2026-11-26).
//
// Reportado: con las seis cadenas del GTA DVD Chest ya conseguidas, el panel enseñaba
// «✓ Purple Chain» y nada mas, con el cofre sin tachar. Medido ese dia en la pagina:
//   · `ViewerDropsDashboard` trae la ESTRUCTURA (8 grupos), sin nada de lo conseguido;
//   · `Inventory` → `earnedDropRewards`, leido en crudo, trae UNA entrada de ese grupo
//     —Purple Chain, la primera—: el historial no cuenta repeticiones;
//   · `dropsCampaign(id)` —lo que usa la propia pagina para GTA— dice por grupo
//     `self { status: CLAIMED, grantCount: 6 }` y `repeatableTimes: 6`.
// Asi que el script pide eso para las reward campaigns del panel, en una consulta con un
// alias por campaña, y con ello tacha el grupo hecho, escribe cuantas veces se ha abierto
// uno que se repite y deja de pintar la cadena suelta del historial de ese grupo.
//
// Casos:
//   A. DVD Chest CLAIMED 6/6 (lo de la cuenta del usuario): «GTA DVD Chest 6/6» tachado,
//      el Golden Iguana y las cajas de sub sin tachar, y sin «Purple Chain» suelta;
//   B. DVD Chest en 3/6: «GTA DVD Chest 3/6» sin tachar, y sin «Purple Chain»;
//   C. el grupo de sub de 1 suscripcion CLAIMED y los otros dos no: una caja tachada y las
//      otras no, y su emote (grupo que no se repite) sigue en el chip de lo concedido;
//   D. dropsCampaign no contesta: todo como antes («GTA DVD Chest» sin cuenta ni tachar y
//      «✓ Purple Chain»), que es el control de que el camino viejo sigue entero;
//   y en A, que la consulta lleva el id de la campaña con su alias.
//
// Control negativo (tiene que salir en ROJO con el codigo publicado):
//   git show HEAD:twitch-drops-highlighter.user.js > /tmp/pub.js
//   TW_SCRIPT=/tmp/pub.js node tests/test-grupos-de-recompensa-estado.js
const { run } = require('./harness');

const CAMP = 'b7669f9e-c69c-4a9b-a3b2-36266c1bdfc0';
const premio = (id, nombre) => ({
    id, name: nombre,
    thumbnailImage: { image1xURL: 'https://static-cdn.jtvnw.net/twitch-quests-assets/REWARD/y.png' },
    earnableUntil: '2099-12-01T07:59:59.999Z'
});
const DVD = premio('30ccdb02-d162-11f1-a983-0a58a9feac02', 'GTA DVD Chest');
const EMOTE = premio('ade45588-f46b-4f96-8ae6-04f55d691ed0', 'GTA Sub Emote Chest');
const BADGE = premio('17032f56-d321-11f1-89aa-b566a4ef8937', 'GTA Sub Badge Chest');
const IGUANA = premio('8aada31e-d18c-11f1-a5bd-0a58a9feac02', 'Golden Iguana');

// Ids de grupo, premio y requisito: los de la API del 2026-11-26, en su orden.
const GRUPOS = [
    ['2283245e-d15c-11f1-8cdd-0a58a9feac02', DVD, 0, 60],
    ['676f46f8-d701-11f1-adef-0a58a9feac02', EMOTE, 1, 0],
    ['6ab6267d-d701-11f1-97fe-0a58a9feac02', EMOTE, 2, 0],
    ['6d363aba-d311-11f1-9179-0a58a9feac02', BADGE, 1, 0],
    ['6e609c14-d701-11f1-0000-0a58a9feac02', EMOTE, 3, 0],
    ['74627e23-d311-11f1-0000-0a58a9feac02', BADGE, 2, 0],
    ['7ed31d8e-d311-11f1-0000-0a58a9feac02', BADGE, 3, 0],
    ['c7e4cd08-d18c-11f1-0000-0a58a9feac02', IGUANA, 0, 60]
];
const CADENAS = ['Purple Chain', 'Bronze Chain', 'Silver Chain', 'Gold Chain', 'Diamond Chain', 'Miami Chain'];
const POOL = { [DVD.id]: CADENAS, [EMOTE.id]: ['BustedPlz', 'DinoBusted', 'SabaBusted'], [BADGE.id]: ['Welcome 2 Miami', 'Scored Big', 'Bleed Miami'] };

const dashboard = [{ data: {
    currentUser: { id: '1', login: 'prueba', dropCampaigns: [] },
    rewardCampaignsAvailableToUser: [{
        id: CAMP, name: 'GTAVI Launch Celebration', brand: '',
        startsAt: '2026-11-18T11:00:00Z', endsAt: '2099-12-01T07:59:59.999Z', status: 'UNKNOWN',
        isSitewide: true, game: null,
        unlockRequirements: { subsGoal: 0, minuteWatchedGoal: 60 },
        image: { image1xURL: 'https://static-cdn.jtvnw.net/twitch-quests-assets/CAMPAIGN/x.png' },
        rewards: [DVD],
        rewardGroups: GRUPOS.map(([id, p, subs, min]) => ({
            id, unlockRequirements: { subsGoal: subs, minuteWatchedGoal: min, turboSubsGoal: 0, eventTriggerGoal: 0 }, rewards: [p]
        }))
    }]
} }];

const concedido = (nombre, tipo, grupo) => {
    const id = 'c-' + nombre.toLowerCase().replace(/\W+/g, '-');
    return { node: { id, item: { id, distributionType: tipo, name: nombre }, campaign: { id: CAMP, brandName: '' },
        group: { id: grupo }, status: 'CLAIMED', earnedAt: '2026-11-24T02:44:37.343Z' } };
};
const inventory = (edges) => ([{ data: { currentUser: { inventory: {
    dropCampaignsInProgress: [], gameEventDrops: [], earnedDropRewards: { edges } } } } }]);

// `estado`: { groupId: [status, grantCount] }; lo que no se diga va IN_PROGRESS 0.
const pedidas = [];
const grupos = (estado) => (cuerpo) => {
    pedidas.push(cuerpo);
    const q = String(((cuerpo || [])[0] || {}).query || '');
    const m = q.match(/(c\d+): dropsCampaign\(id: "([^"]+)"\)/g) || [];
    const data = {};
    for (const trozo of m) {
        const [, alias, id] = trozo.match(/(c\d+): dropsCampaign\(id: "([^"]+)"\)/);
        if (id !== CAMP) { data[alias] = null; continue; }
        data[alias] = { id, rewardGroups: GRUPOS.map(([gid, p], i) => {
            const [status, grantCount] = estado[gid] || ['IN_PROGRESS', 0];
            return {
                id: gid,
                progressCriteria: { repeatableConfig: i === 0 ? { repeatableTimes: 6 } : null },
                self: { status, grantCount },
                rewards: [{ name: p.name, pool: POOL[p.id] ? { rewards: POOL[p.id].map(n => ({ name: n })) } : null }]
            };
        }) };
    }
    return [{ data }];
};

let fallos = 0;
const comprobar = (ok, msg, extra) => {
    console.log((ok ? '  ok    ' : '  FALLA ') + msg + (ok || extra === undefined ? '' : ` -> ${JSON.stringify(extra)}`));
    if (!ok) fallos++;
};
const mirar = async (gqlExtra, edges) => {
    const r = await run({ waitMs: 10000, keywords: ['gta'],
        gql: { ViewerDropsDashboard: dashboard, Inventory: inventory(edges), ...gqlExtra } });
    const tarjeta = r.chips.find(x => /GTAVI/.test(x.titulo || ''));
    const premios = tarjeta ? tarjeta.badges.flatMap(b => b.premios) : [];
    return { tarjeta, premios, de: (n) => premios.filter(p => p.texto === n) };
};
const DVD_G = GRUPOS[0][0], SUB1_EMOTE = GRUPOS[1][0];
const purple = [concedido('Purple Chain', 'BADGE', DVD_G)];

(async () => {
    // A.
    console.log('\n=== A. DVD Chest completo (6/6) ===');
    const a = await mirar({ DropsHighlighterRewardGroups: grupos({ [DVD_G]: ['CLAIMED', 6] }) }, purple);
    comprobar(!!a.tarjeta, 'la tarjeta de GTAVI esta en el panel');
    console.log('  premios:', JSON.stringify(a.premios));
    const q = String(((pedidas[0] || [])[0] || {}).query || '');
    comprobar(q.includes(`c0: dropsCampaign(id: "${CAMP}")`) && /self \{ status grantCount \}/.test(q), 'la consulta pide la campaña con su alias y el self del grupo', q.slice(0, 160));
    comprobar(a.de('GTA DVD Chest 6/6').length === 1 && a.de('GTA DVD Chest 6/6')[0].tachado, '«GTA DVD Chest 6/6» sale tachado', a.premios);
    comprobar(a.de('Golden Iguana').length === 1 && !a.de('Golden Iguana')[0].tachado, 'el Golden Iguana sigue sin tachar');
    comprobar(['GTA Sub Emote Chest', 'GTA Sub Badge Chest'].every(n => a.de(n).length && a.de(n).every(p => !p.tachado)), 'las cajas de sub siguen sin tachar');
    comprobar(a.de('Purple Chain').length === 0, 'y ya no sale «Purple Chain» suelta');

    // B.
    console.log('\n=== B. DVD Chest a medias (3/6) ===');
    const b = await mirar({ DropsHighlighterRewardGroups: grupos({ [DVD_G]: ['IN_PROGRESS', 3] }) }, purple);
    console.log('  premios:', JSON.stringify(b.premios));
    comprobar(b.de('GTA DVD Chest 3/6').length === 1 && !b.de('GTA DVD Chest 3/6')[0].tachado, '«GTA DVD Chest 3/6» sin tachar', b.premios);
    comprobar(b.de('Purple Chain').length === 0, 'sin «Purple Chain» suelta');

    // C.
    console.log('\n=== C. la caja de emote de 1 sub, hecha ===');
    const c = await mirar({ DropsHighlighterRewardGroups: grupos({ [DVD_G]: ['CLAIMED', 6], [SUB1_EMOTE]: ['CLAIMED', 1] }) },
        purple.concat([concedido('BustedPlz', 'EMOTE', SUB1_EMOTE)]));
    console.log('  premios:', JSON.stringify(c.premios));
    const emotes = c.de('GTA Sub Emote Chest');
    comprobar(emotes.some(p => p.tachado) && emotes.some(p => !p.tachado), 'una caja de emote tachada y otra no', emotes);
    comprobar(c.de('BustedPlz').length === 1 && c.de('BustedPlz')[0].tachado, 'y «BustedPlz» sigue en lo concedido: su grupo no se repite');

    // D.
    console.log('\n=== D. dropsCampaign no contesta ===');
    const d = await mirar({}, purple);
    console.log('  premios:', JSON.stringify(d.premios));
    comprobar(d.de('GTA DVD Chest').length === 1 && !d.de('GTA DVD Chest')[0].tachado, '«GTA DVD Chest» sin cuenta ni tachar, como antes');
    comprobar(d.de('Purple Chain').length === 1, 'y «Purple Chain» en lo concedido, como antes');

    console.log(fallos ? `\n  ${fallos} FALLAN` : '\n  todo en verde');
    process.exit(fallos ? 1 : 0);
})();
