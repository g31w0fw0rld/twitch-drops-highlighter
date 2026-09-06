// EL MISMO benefit.id EN LA EDICION DE ESTE AÑO Y EN LA DEL ANTERIOR.
//
// «RLCS 2025 Exotic / Import / Very Rare Drop» son recompensas NUEVAS y acumulables cada
// temporada, pero Twitch reutiliza sus tres `benefit.id` de una edicion a la siguiente.
// Cruzar lo reclamado por benefit a secas los daba por tuyos nada mas aparecer: tachados,
// con su ✓, y escondidos por el filtro de «algo pendiente». O sea, perdidos.
//
// El acotado por `campaign.id` (1.2.18) lo arreglaba, pero un centinela lo apagaba solo
// cuando ninguna campaña EN CURSO constaba en el historial —que es el estado normal de
// quien esta viendo campañas nuevas—, y el fallo volvia. Visto el 2026-09-06 con estas
// mismas tres recompensas.
//
// Se prueban los tres estados, porque cada uno rompe de una forma distinta:
//   1. historial de OTRA edicion  -> no se tacha nada (el fallo del que va esto);
//   2. historial de ESTA campaña  -> se tacha todo (control positivo: sin el, un script
//      que no marcara nunca nada pasaria el caso 1 sin hacer nada);
//   3. desajuste de verdad        -> vuelve al cruce plano (la red de seguridad sigue).
const { run } = require('./harness');

const CAMP_2026 = 'e4c1f0aa-1111-4c2a-9a01-000000000001';   // la campaña de esta temporada
const CAMP_2025 = 'aa77bb33-2222-4c2a-9a01-000000000002';   // la del año pasado
const OTRA_EN_CURSO_A = 'c0ffee11-3333-4c2a-9a01-000000000003';
const OTRA_EN_CURSO_B = 'c0ffee22-4444-4c2a-9a01-000000000004';

// Los tres ids reutilizados entre ediciones, que es de lo que va todo esto.
const B_VERY_RARE = '111aaa11-9661-11f1-8842-0a58a9feac02';
const B_IMPORT    = '222bbb22-9661-11f1-8842-0a58a9feac02';
const B_EXOTIC    = '333ccc33-9661-11f1-8842-0a58a9feac02';

const TRAMOS = [
    { min: 30,  bid: B_VERY_RARE, nombre: 'RLCS 2025 Very Rare Drop' },
    { min: 60,  bid: B_IMPORT,    nombre: 'RLCS 2025 Import Drop' },
    { min: 120, bid: B_EXOTIC,    nombre: 'RLCS 2025 Exotic Drop' }
];

const AYER = new Date(Date.now() - 86400e3).toISOString();
const MAÑANA = new Date(Date.now() + 86400e3).toISOString();

const dashboard = [{
    data: {
        currentUser: {
            id: '1', login: 'prueba',
            dropCampaigns: [{
                id: CAMP_2026, name: 'CRL League Play', status: 'ACTIVE',
                startAt: AYER, endAt: MAÑANA,
                game: { id: '30921', displayName: 'Rocket League',
                        boxArtURL: 'https://static-cdn.jtvnw.net/ttv-boxart/30921-{width}x{height}.jpg' },
                owner: { id: '9', name: 'Epic Games', login: 'epicgames' }
            }]
        },
        rewardCampaignsAvailableToUser: []
    }
}];

const detalles = [{
    data: {
        user: {
            dropCampaign: {
                id: CAMP_2026,
                timeBasedDrops: TRAMOS.map((t, i) => ({
                    id: 'drop-2026-' + i,
                    name: t.nombre,
                    requiredMinutesWatched: t.min,
                    benefitEdges: [{
                        benefit: {
                            id: t.bid, name: t.nombre, distributionType: 'DIRECT_ENTITLEMENT',
                            imageAssetURL: 'https://static-cdn.jtvnw.net/twitch-quests-assets/REWARD/x.png'
                        }
                    }]
                }))
            }
        }
    }
}];

// Una campaña en curso: la que le da al centinela algo que mirar. `reclamado` marca su
// unico tramo como ya cobrado, que es el control positivo del acotado.
const enCurso = (cid, reclamado = false) => ({
    id: cid, name: 'otra cosa', status: 'ACTIVE',
    game: { id: '1', displayName: 'Otro juego' },
    timeBasedDrops: [{
        id: 'drop-' + cid, name: 'Premio ajeno', requiredMinutesWatched: 60,
        benefitEdges: [{ benefit: { id: 'bene-' + cid, name: 'Premio ajeno', distributionType: 'DIRECT_ENTITLEMENT' } }],
        self: { currentMinutesWatched: 12, isClaimed: reclamado }
    }]
});

const concedido = (bid, nombre, cid) => ({
    node: {
        id: bid, item: { id: bid, distributionType: 'DIRECT_ENTITLEMENT', name: nombre },
        campaign: { id: cid, brandName: 'Psyonix' },
        status: 'CLAIMED', earnedAt: '2025-06-01T10:00:00.000Z'
    }
});

const inventory = (enCursoLista, edges) => ([{
    data: {
        currentUser: {
            inventory: {
                dropCampaignsInProgress: enCursoLista,
                gameEventDrops: [],
                earnedDropRewards: { edges }
            }
        }
    }
}]);

const historialDe = (cid) => TRAMOS.map(t => concedido(t.bid, t.nombre, cid));

const CASOS = [
    {
        // EL FALLO. Dos campañas en curso que no son estas y sin nada cobrado todavia:
        // la interseccion con el historial es vacia, y eso es lo que apagaba el acotado.
        nombre: 'la edicion del año pasado no tacha la de este',
        enCurso: [enCurso(OTRA_EN_CURSO_A), enCurso(OTRA_EN_CURSO_B)],
        edges: historialDe(CAMP_2025),
        esperaTachado: false
    },
    {
        // Control positivo. Mismo codigo y mismos ids, cambiando SOLO de que campaña
        // vienen. Sin este caso, un script que no marcara nunca nada pasaria el anterior.
        nombre: 'lo concedido por ESTA campaña si se tacha',
        enCurso: [enCurso(OTRA_EN_CURSO_A), enCurso(OTRA_EN_CURSO_B)],
        edges: historialDe(CAMP_2026),
        esperaTachado: true
    },
    {
        // La red de seguridad. Aqui hay prueba de verdad de que los ids no casan: un
        // tramo que Twitch da por reclamado en una campaña EN CURSO consta en el
        // historial, pero colgado de otra campaña. Con eso el indice vuelve al cruce
        // plano y los tres se tachan otra vez — que es marcar de mas, pero es lo unico
        // que queda cuando el campaign.id del historial no vale.
        nombre: 'con el espacio de ids roto, vuelve al cruce plano',
        enCurso: [enCurso(OTRA_EN_CURSO_A, true)],
        edges: historialDe(CAMP_2025).concat([
            concedido('bene-' + OTRA_EN_CURSO_A, 'Premio ajeno', 'id-que-no-es-el-suyo')
        ]),
        esperaTachado: true
    }
];

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok   ' : '  FALLA') + ' ' + msg); if (!ok) fallos++; };

(async () => {
    for (const c of CASOS) {
        console.log('\n=== ' + c.nombre + ' ===');
        const r = await run({
            waitMs: 9000,
            keywords: ['rocket league'],
            gql: {
                ViewerDropsDashboard: dashboard,
                DropCampaignDetails: detalles,
                Inventory: inventory(c.enCurso, c.edges)
            }
        });

        const tarjeta = r.chips.find(x => /rocket league/i.test(x.titulo || ''));
        comprobar(!!tarjeta, 'la tarjeta de Rocket League esta en el panel' +
            (tarjeta ? '' : ' (titulos: ' + JSON.stringify(r.chips.map(x => x.titulo)) + ')'));
        if (!tarjeta) continue;

        const premios = tarjeta.badges.flatMap(b => b.premios);
        for (const t of TRAMOS) {
            const p = premios.find(x => x.texto === t.nombre);
            comprobar(!!p, 'sale «' + t.nombre + '»');
            if (!p) continue;
            comprobar(p.tachado === c.esperaTachado,
                '«' + t.nombre + '» ' + (c.esperaTachado ? 'tachado' : 'SIN tachar') +
                (p.tachado === c.esperaTachado ? '' : ' (esta ' + (p.tachado ? 'tachado' : 'sin tachar') + ')'));
        }
        const ticks = tarjeta.badges.filter(b => /✓/.test(b.texto)).length;
        comprobar(c.esperaTachado ? ticks > 0 : ticks === 0,
            c.esperaTachado ? 'los chips llevan ✓' : 'ningun chip lleva ✓ (hay ' + ticks + ')');
    }
    console.log(fallos === 0 ? '\nTODO EN VERDE' : '\n' + fallos + ' COMPROBACIONES EN ROJO');
    process.exit(fallos === 0 ? 0 : 1);
})();
