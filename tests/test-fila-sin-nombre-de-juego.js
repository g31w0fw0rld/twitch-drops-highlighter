// UNA FILA QUE NO DICE DE QUE JUEGO ES NO SE MARCABA NUNCA.
//
// Reportado el 2026-09-04: «Treasure Hunt Drop» (Minecraft, 15 min, Amethyst Drone) salia en
// el panel como «Treasure Hunt Drop - Minecraft» —la API si sabe el juego— pero su fila de
// /drops/campaigns se quedaba sin borde. La de Pokemon, en la MISMA seccion, si se marcaba.
//
// La causa esta en el codigo y no es una suposicion: el escaneo compone el texto que compara
// con las keywords a partir de los <p> de la cabecera,
//
//     if (corePs.length >= 2) { titulo = corePs[0]; estudio = corePs[1]; }
//     else if (corePs.length === 1) { titulo = corePs[0]; }
//
// y la cabecera de esta campaña trae UN solo <p>. Asi que el texto era «treasure hunt drop »,
// donde `minecraft` no aparece ni puede aparecer. La de Pokemon trae dos («Pokémon» y
// «Pokemon») y por eso pasaba el filtro.
//
// El arreglo mete el `alt` de la caratula —que es el nombre del juego— en ese mismo texto.
//
// Las DOS filas van en el mismo fixture a proposito: la de Pokemon es el control positivo.
// Si un dia se cae ella tambien, el fallo es del escaneo entero y no de esto.
const { run, readFixture } = require('./harness');

let fallos = 0;
const comprobar = (ok, msg) => { console.log((ok ? '  ok    ' : '  FALLA ') + msg); if (!ok) fallos++; };

(async () => {
    const r = await run({
        url: 'https://www.twitch.tv/drops/campaigns',
        dump: readFixture('fixture-campanas-recompensas.html'),
        // `minecraft` es la keyword que la fila no puede delatar por su texto; `pokemon` es
        // la del control. Nada mas, para que lo que se marque sea atribuible.
        keywords: ['minecraft', 'pokemon'],
        waitMs: 14000
    });

    const titulos = (r.marcados || []).map(m => m.titulo);
    console.log('  filas marcadas:', JSON.stringify(titulos));
    console.log('  detalle       :', JSON.stringify(r.marcados));

    comprobar(titulos.includes('Pokémon'),
        'la de Pokemon sigue marcada (control positivo: el escaneo funciona)');
    comprobar(titulos.includes('Treasure Hunt Drop'),
        'la de Minecraft se marca aunque su fila no diga el juego');
    comprobar((r.marcados || []).every(m => m.borde),
        'y las marcadas llevan borde de verdad, no solo el id');

    // Que no se marque de MAS. El `alt` es texto nuevo dentro del filtro, asi que lo que hay
    // que descartar es que arrastre filas que no casan con ninguna keyword: aqui solo hay dos
    // campañas y las dos casan, asi que el numero exacto es la comprobacion.
    comprobar((r.marcados || []).length === 2,
        'se marcan exactamente las dos, ni una de mas (' + (r.marcados || []).length + ')');

    console.log(fallos === 0 ? '\nTODO EN VERDE' : '\n' + fallos + ' COMPROBACIONES EN ROJO');
    process.exit(fallos === 0 ? 0 : 1);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
