// CAJAS DISTINTAS EN UNA MISMA CAMPAÑA DE RECOMPENSAS: LA CUENTA NO PUEDE TACHAR.
//
// «GTAVI Launch Celebration» (2026-11-24). `ViewerDropsDashboard` la sirve con 8 grupos,
// que son los de abajo tal cual: GTA DVD Chest (60 min), tres GTA Sub Emote Chest y tres
// GTA Sub Badge Chest (1, 2 y 3 subs) y el Golden Iguana (60 min). La pagina pinta 13
// premios porque el DVD Chest se abre una vez al dia SEIS dias —una cadena distinta cada
// vez— y el Golden Iguana solo llega con los otros doce; eso lo dice su consulta propia
// (`Gta6Collection`), no esta.
//
// La regla de las Poké Ball («concesiones >= grupos» tacha la campaña) supone que cada
// grupo da una cosa una vez. Aqui, con las seis cadenas y una sub (un emote y un emblema)
// son 8 de 8 y se tachaba TODO, el Golden Iguana incluido, con cinco premios por ganar.
//
// Casos:
//   A. una cadena: nada tachado y el chip «✓ Purple Chain» (lo de hoy en la cuenta del
//      usuario; ya pasaba antes y sirve de control de que la tarjeta sale);
//   B. 8 concesiones de 8 grupos: NADA tachado. Es el que falla con la 1.3.35;
//   C. el Golden Iguana concedido: ese si se tacha, por su nombre, y no se repite en el
//      chip de lo concedido.
//
// Que las Poké Ball y las Great Ball (cajas iguales) siguen tachandose por la cuenta lo
// comprueba test-emblema-concedido, que tiene que seguir en verde.
//
// Control negativo (tiene que salir en ROJO con el codigo publicado):
//   git show HEAD:twitch-drops-highlighter.user.js > /tmp/pub.js
//   TW_SCRIPT=/tmp/pub.js node tests/test-cofres-distintos-gta.js
const { run } = require('./harness');

const CAMP = 'b7669f9e-c69c-4a9b-a3b2-36266c1bdfc0';
const premio = (id, nombre) => ({
    id, name: nombre,
    thumbnailImage: { image1xURL: 'https://static-cdn.jtvnw.net/twitch-quests-assets/REWARD/y.png' },
    earnableUntil: '2099-12-01T07:59:59.999Z'
});
const DVD = premio('30ccdb02-d162-11f1-a983-0a58a9feac02', 'GTA DVD Chest');
const EMOTE = premio('gta-sub-emote-chest', 'GTA Sub Emote Chest');
const BADGE = premio('gta-sub-badge-chest', 'GTA Sub Badge Chest');
const IGUANA = premio('8aada31e-d18c-11f1-a5bd-0a58a9feac02', 'Golden Iguana');

// El orden de los grupos es el de la API.
const GRUPOS = [[DVD, 0, 60], [EMOTE, 1, 0], [EMOTE, 2, 0], [BADGE, 1, 0],
                [EMOTE, 3, 0], [BADGE, 2, 0], [BADGE, 3, 0], [IGUANA, 0, 60]];

const dashboard = [{
    data: {
        currentUser: { id: '1', login: 'prueba', dropCampaigns: [] },
        rewardCampaignsAvailableToUser: [{
            id: CAMP, name: 'GTAVI Launch Celebration', brand: '',
            startsAt: '2026-11-18T11:00:00Z', endsAt: '2099-12-01T07:59:59.999Z', status: 'UNKNOWN',
            isSitewide: true, game: null,
            unlockRequirements: { subsGoal: 0, minuteWatchedGoal: 60 },
            image: { image1xURL: 'https://static-cdn.jtvnw.net/twitch-quests-assets/CAMPAIGN/x.png' },
            rewards: [DVD],
            rewardGroups: GRUPOS.map(([p, subs, min], i) => ({
                id: 'grupo-gta-' + i,
                unlockRequirements: { subsGoal: subs, minuteWatchedGoal: min, turboSubsGoal: 0, eventTriggerGoal: 0 },
                rewards: [p]
            }))
        }]
    }
}];

const concedido = (nombre, tipo = 'BADGE') => {
    const id = 'c-' + nombre.toLowerCase().replace(/\W+/g, '-');
    return { node: { id, item: { id, distributionType: tipo, name: nombre },
                     campaign: { id: CAMP, brandName: '' }, status: 'CLAIMED', earnedAt: '2026-11-20T12:00:00Z' } };
};
const inventory = (edges) => ([{ data: { currentUser: { inventory: {
    dropCampaignsInProgress: [], gameEventDrops: [], earnedDropRewards: { edges } } } } }]);

const CADENAS = ['Purple Chain', 'Bronze Chain', 'Silver Chain', 'Gold Chain', 'Diamond Chain', 'Miami Chain'];
const SUBS = [['Welcome 2 Miami', 'BADGE'], ['Scored Big', 'BADGE'], ['Bleed Miami', 'BADGE'],
              ['BustedPlz', 'EMOTE'], ['DinoBusted', 'EMOTE'], ['SabaBusted', 'EMOTE']];
const CAJAS = ['GTA DVD Chest', 'GTA Sub Emote Chest', 'GTA Sub Badge Chest'];

let fallos = 0;
const comprobar = (ok, msg, extra) => {
    console.log((ok ? '  ok    ' : '  FALLA ') + msg + (ok || extra === undefined ? '' : ` -> ${JSON.stringify(extra)}`));
    if (!ok) fallos++;
};

const mirar = async (edges) => {
    const r = await run({ waitMs: 9000, keywords: ['gta'],
        gql: { ViewerDropsDashboard: dashboard, Inventory: inventory(edges) } });
    const tarjeta = r.chips.find(x => /GTAVI/.test(x.titulo || ''));
    const premios = tarjeta ? tarjeta.badges.flatMap(b => b.premios) : [];
    return { tarjeta, premios, de: (n) => premios.filter(p => p.texto === n) };
};

(async () => {
    // A. Una cadena.
    console.log('\n=== A. una cadena concedida ===');
    const a = await mirar([concedido('Purple Chain')]);
    comprobar(!!a.tarjeta, 'la tarjeta de GTAVI esta en el panel');
    console.log('  premios:', JSON.stringify(a.premios));
    comprobar(CAJAS.every(n => a.de(n).length > 0 && a.de(n).every(p => !p.tachado)),
        'las tres cajas salen y ninguna tachada');
    comprobar(a.de('Golden Iguana').length === 1 && !a.de('Golden Iguana')[0].tachado,
        'el Golden Iguana sale sin tachar');
    comprobar(a.de('Purple Chain').length === 1 && a.de('Purple Chain')[0].tachado,
        'y «Purple Chain» sale en el chip de lo concedido');

    // B. Ocho de ocho.
    console.log('\n=== B. 8 concesiones de 8 grupos (seis cadenas y una sub) ===');
    const b = await mirar(CADENAS.map(n => concedido(n)).concat(
        [concedido(SUBS[0][0], SUBS[0][1]), concedido(SUBS[3][0], SUBS[3][1])]));
    comprobar(!!b.tarjeta, 'la tarjeta de GTAVI esta en el panel');
    console.log('  premios:', JSON.stringify(b.premios));
    comprobar(b.de('Golden Iguana').length === 1 && !b.de('Golden Iguana')[0].tachado,
        'el Golden Iguana NO se tacha: faltan cinco premios para ganarlo', b.de('Golden Iguana'));
    comprobar(['GTA Sub Emote Chest', 'GTA Sub Badge Chest'].every(n => b.de(n).every(p => !p.tachado)),
        'las cajas de sub NO se tachan: quedan dos subs por hacer');
    comprobar(CADENAS.every(n => b.de(n).length === 1 && b.de(n)[0].tachado),
        'las seis cadenas salen en el chip de lo concedido');

    // C. El Golden Iguana concedido.
    console.log('\n=== C. todo concedido, Golden Iguana incluido ===');
    const c = await mirar(CADENAS.map(n => concedido(n))
        .concat(SUBS.map(([n, t]) => concedido(n, t)), [concedido('Golden Iguana')]));
    comprobar(!!c.tarjeta, 'la tarjeta de GTAVI esta en el panel');
    console.log('  premios:', JSON.stringify(c.premios));
    comprobar(c.de('Golden Iguana').length === 1 && c.de('Golden Iguana')[0].tachado,
        'el Golden Iguana se tacha por su nombre, y una sola vez', c.de('Golden Iguana'));

    console.log(fallos ? `\n  ${fallos} FALLAN` : '\n  todo en verde');
    process.exit(fallos ? 1 : 0);
})();
