// ==UserScript==
// @name         Twitch Drops Highlighter + Keywords (Full + i18n)
// @namespace    http://tampermonkey.net/
// @version      1.2.19
// @description  Highlights the Twitch drop campaigns matching your keywords on the page itself, and lists them in a panel split into active and expired. Rewards you own are ticked, one earned but not collected is flagged with a gift, and every open card shows the watch time you still need. Sort by closing date or by cheapest, trim the list with four filters, and exclude with keywords starting with "-". Optional auto-claim of finished drops. 16 languages, read-only GraphQL queries.
// @match        https://www.twitch.tv/drops/*
// @author       g31w0fw0rld
// @license      MIT
// @downloadURL  https://github.com/g31w0fw0rld/twitch-drops-highlighter/raw/main/twitch-drops-highlighter.user.js
// @updateURL    https://github.com/g31w0fw0rld/twitch-drops-highlighter/raw/main/twitch-drops-highlighter.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function () {
    "use strict";
    const SCRIPT_VERSION = "1.2.19";
    console.log("Twitch Drops Highlighter cargado. Version:", SCRIPT_VERSION);

    // =============================================
    // GQL STATE CAPTURE (runs before page loads)
    // =============================================
    // El token OAuth y el client-integrity viven SOLO en memoria: persistirlos en
    // localStorage los dejaba legibles de forma durable por cualquier otro script,
    // extension o XSS que corriera en twitch.tv, y sobrevivian al cierre del
    // navegador. El interceptor de fetch los recaptura en cada carga de pagina,
    // asi que no hay nada que guardar.
    const LEGACY_GQL_STORAGE_KEY = '__twitch_gql_state__';
    try { localStorage.removeItem(LEGACY_GQL_STORAGE_KEY); } catch (e) {}

    const _gqlState = {
        integrity: null,
        token: null,
        deviceId: null,
        sessionId: null,
        clientVersion: null
    };

    function _normalizeHeaders(headers) {
        if (!headers) return {};
        if (headers instanceof Headers) {
            const obj = {};
            headers.forEach((v, k) => obj[k.toLowerCase()] = v);
            return obj;
        }
        if (Array.isArray(headers)) {
            const obj = {};
            headers.forEach(([k, v]) => obj[k.toLowerCase()] = v);
            return obj;
        }
        const obj = {};
        Object.keys(headers).forEach(k => { obj[k.toLowerCase()] = headers[k]; });
        return obj;
    }

    function _captureGqlHeaders(headers) {
        if (!headers) return;
        if (headers['client-integrity']) _gqlState.integrity = headers['client-integrity'];
        if (headers['authorization']) _gqlState.token = headers['authorization'].replace('OAuth ', '');
        if (headers['x-device-id']) _gqlState.deviceId = headers['x-device-id'];
        if (headers['client-session-id']) _gqlState.sessionId = headers['client-session-id'];
        if (headers['client-version']) _gqlState.clientVersion = headers['client-version'];
    }

    // fetch acepta string, URL o Request. Con un URL, .url es undefined, asi que
    // hay que caer a String(input) para no perder el href.
    function _urlOf(input) {
        if (typeof input === 'string') return input;
        if (input == null) return '';
        return input.url || String(input);
    }

    // Comparamos host y path, no substring: con includes('gql.twitch.tv/gql')
    // cualquier URL ajena que llevara esa cadena (p. ej. en el query string)
    // pasaba el filtro, y le habriamos robado el Authorization a un tercero para
    // despues mandarlo a Twitch.
    function _isTwitchGqlUrl(url) {
        if (!url) return false;
        try {
            const u = new URL(url, location.href);
            return u.hostname === 'gql.twitch.tv' && u.pathname === '/gql';
        } catch (e) { return false; }
    }

    // Non-async fetch interceptor — MUST NOT wrap in new Promise (breaks React)
    const _realFetch = unsafeWindow.fetch;
    unsafeWindow.fetch = function(...args) {
        const [url, options] = args;
        if (_isTwitchGqlUrl(_urlOf(url))) {
            _captureGqlHeaders(_normalizeHeaders(options?.headers));
        }
        return _realFetch.apply(this, args);
    };

    // =============================================
    // WAIT FOR PAGE LOAD
    // =============================================
    window.addEventListener("load", () => {

        // =============================================
        // INTERNACIONALIZACION (i18n)
        // =============================================

        const userLang = document.documentElement.getAttribute("lang") || navigator.language || "en";
        const lang = userLang.split("-")[0];
        const i18n = {
            es: {

                addKeyword: "Añadir Keyword",
                deleteKeywordTooltip: "Haga click para eliminar keyword",
                deleteKeywordQuestion: "¿Eliminar la keyword ",
                editKeywords: "Editar Keywords",
                resetKeywords: "Restaurar Predeterminadas",
                confirmReset: "¿Restaurar las keywords por defecto?",
                keywordsRestored: "Keywords restauradas. Recargando...",
                keywordsModified: "Las keywords han sido modificadas, estas son las actuales: ",
                reloading: "Recargando...",
                currentKeywords: "Keywords actuales (haga clic en una para eliminar):",
                noResults: "No se encontraron campanas relacionadas con tus keywords.",
                dropsActive: "Drops Abiertos",
                dropsExpired: "Drops Cerrados",
                editPrompt: "Palabras clave separadas por coma:",
                reload: "Recargar drops",
                hideExpired: "Ocultar cerrados/completados del inventario, reclamacion de drops automatica",
                hideActive: "Ocultar abiertos del inventario",
                removeInventory: "Haz clic para eliminar del inventario, para volver a mostrar pulsa el boton de recargar drops",
                changes_detected: "Cambios detectados",
                viewed: "Mostrar",
                markAllAsViewed: "Marcar todas como vistas",
                accept: "Aceptar",
                cancel: "Cancelar",
                yes: "Si",
                no: "No",
                addButton: "+",
                viewIcon: "👁️",
                changedIcon: "🔔",
                removeIcon: "❌",
                shareCopy: "Copiar para compartir",
                shareCopied: "Copiado",

                scriptInfoTitle: "Informacion del script",
                scriptInfoName: "Nombre:",
                scriptInfoVersion: "Version:",
                scriptInfoDescription: "Descripcion:",
                scriptInfoDescriptionText: "Resalta en la propia página las campañas de drops que coinciden con tus keywords: morado las abiertas, rojo las cerradas. El panel las lista separadas en abiertos y cerrados, con la ventana de fechas, la keyword que la encontró y cada recompensa con las horas que pide. Se llena de la propia API de Twitch, así que funciona igual en el inventario sin sacarte a campañas, y mientras la respuesta viene de camino se calla en vez de cantar un cero que todavía no sabe. Las recompensas que ya tienes van con ✓ y tachadas, una a una, y el badge que no tiene nada pendiente se queda sin su tiempo. Lo que ya te ganaste y no has recogido va aparte, con 🎁 y sin atenuar, porque solo le falta un clic, y el aviso de cierre tambien los cuenta. Lo que está por cerrar va primero: cuando a una recompensa que aún no tienes se le acaba el tiempo en menos de 72 h, su tarjeta dice cuánto queda y cuánto te falta por ver —rojo por debajo de 24 h— o que ya no da tiempo, y el mismo ⏳ cae en la tarjeta de la campaña en la página. Keywords editables: clic en una para borrarla, + para añadir, editarlas en bloque o restaurar las predeterminadas. Una keyword que empieza por «-» descarta: «-console» deja fuera la campaña aunque otra keyword la hubiera encontrado, y se lleva con ella el resaltado, la tarjeta y el aviso. Y cuatro filtros de vista recortan la lista de abiertos sin tocar nada mas —lo que aun te falta, lo que cierra pronto, lo que ya ganaste y no has recogido, y lo que se saca en una hora o menos—: se suman entre si, se recuerdan, y la pestaña dice cuantas tarjetas se ven de cuantas hay. La lista de abiertos se ordena por lo que antes cierra o por lo que menos tiempo te pide, a eleccion. Y cada campaña abierta lleva en su propia tarjeta de la pagina el tiempo que te falta para llevarte todo lo que queda —su recompensa mas cara, porque el tiempo visto es por campaña—, de modo que el coste se ve haciendo scroll. Si el inventario no llega —sin el no se sabe que tienes ni cuanto llevas visto—, el panel lo dice en vez de quedarse callado con las marcas apagadas. En el inventario puedes ver el detalle de un drop (progreso y tiempo restante), descartar entradas con la ✕ —«Recargar drops» las devuelve— y marcar una casilla que oculta lo cerrado/completado y activa la reclamación automática. Un 🔗 en cada campaña abierta copia su nombre, sus fechas, cada recompensa con lo que pide y un enlace que la abre en Twitch: texto y no imagen, así que se sigue pudiendo buscar y el enlace se pulsa. Marca con 🔔 —en el panel y en la propia tarjeta— las campañas que cambiaron desde la última vez, con una cuenta de pendientes, notificación de escritorio y un botón 👁️ que además te lleva hasta la campaña. 16 idiomas.",
                scriptInfoAuthor: "Autor:",
                scriptInfoGitHub: "GitHub:",
                scriptInfoPrivacy: "Privacidad:",
                scriptInfoPrivacyText: "Tus keywords y ajustes se guardan solo en tu navegador. Las consultas de drops van a gql.twitch.tv con tu propia sesion (el token nunca se guarda en disco); si eso falla, se usa la API publica twitch-drops-api.sunkwi.com, que solo recibe una peticion sin datos tuyos. No se envia nada al autor del script.",

                readingApiDrops: "Leyendo cambios en drops desde GQL/API...",
                timeRemaining: "Tiempo restante",
                progress: "Progreso",
                rewards: "Recompensas",
                minutesShort: "min",
                dropDetails: "Detalle del drop",
                earnedUnclaimed: "ganado, falta reclamar",
                urgentUnclaimed: "sin reclamar",
                filterPending: "Algo pendiente",
                filterSoon: "Cierra pronto",
                filterUnclaimed: "Sin reclamar",
                filterQuick: "Tramo ≤ 1 h",
                filterBarHint: "Filtra solo la pestaña de activos. Varios filtros se suman.",
                noResultsFiltered: "Nada pasa los filtros activos.",
                clearFilters: "Quitar filtros",
                negativeKeywordHint: "escribe -palabra para descartar",
                sortLabel: "Orden:",
                sortUrgent: "Lo que antes cierra",
                sortCheapest: "Lo más barato",
                sortCheapestHint: "Ordena por lo que menos te pide para sacar algo. El ⏱ de la tarjeta es otra cuenta: lo que cuesta llevárselo todo.",
                remainingToFinish: "lo que te falta para llevártelo todo de aquí",
                noInventoryData: "Sin inventario: no se sabe qué tienes reclamado ni cuánto llevas visto.",
                urgentClosesIn: "cierra en",
                urgentNeed: "te faltan",
                urgentMinimum: "lo mínimo",
                urgentNoTime: "no da tiempo",
                claimedInventoryTitle: "Reclamados"
            },
            en: {

                addKeyword: "Add Keyword",
                deleteKeywordTooltip: "Click to delete keyword",
                deleteKeywordQuestion: "Delete keyword ",
                editKeywords: "Edit Keywords",
                resetKeywords: "Reset to Default",
                confirmReset: "Reset keywords to default?",
                keywordsRestored: "Keywords restored. Reloading...",
                keywordsModified: "Keywords modified. These are the current keywords: ",
                reloading: "Reloading...",
                currentKeywords: "Current keywords (click on one to delete):",
                noResults: "No drops matched your keywords.",
                dropsActive: "Active Drops",
                dropsExpired: "Expired Drops",
                editPrompt: "Comma-separated keywords:",
                reload: "Reload drops",
                hideExpired: "Hide expired/completed from inventory, automatic drops claiming",
                hideActive: "Hide active from inventory",
                removeInventory: "Click to remove from inventory, to show again press the reload drops button",
                changes_detected: "Changes detected",
                viewed: "Shown",
                markAllAsViewed: "Mark all as viewed",
                accept: "Accept",
                cancel: "Cancel",
                yes: "Yes",
                no: "No",
                addButton: "+",
                viewIcon: "👁️",
                changedIcon: "🔔",
                removeIcon: "❌",
                shareCopy: "Copy to share",
                shareCopied: "Copied",

                scriptInfoTitle: "Script Information",
                scriptInfoName: "Name:",
                scriptInfoVersion: "Version:",
                scriptInfoDescription: "Description:",
                scriptInfoDescriptionText: "Highlights the drop campaigns matching your keywords on the page itself: purple for open, red for closed. The panel lists them split into active and expired, with the date window, the keyword that matched and each reward with the hours it needs. It fills from Twitch's own API, so it works the same in the inventory without pulling you over to campaigns, and while the answer is on its way it stays quiet instead of reporting a zero it does not know yet. Rewards you already own are ticked and struck through one by one, and a badge with nothing left to earn drops the watch time it asked for. What you already earned but have not collected is flagged apart with 🎁 —not dimmed— because it only needs a click, and the closing warning counts those too. What is about to close comes first: when a reward you do not own yet runs out of time within 72 hours, its card says how long is left and how much watch time you still need —red under 24 hours— or that it no longer fits, and the same ⏳ lands on the campaign's card on the page. Keywords are editable: click one to delete it, + to add, edit them in bulk or reset to the defaults. A keyword starting with \"-\" excludes: \"-console\" drops the campaign even if another keyword had found it, and takes the highlight, the card and the alert with it. And four view filters trim the open list without touching anything else —what you still have left, what closes soon, what you already earned and have not collected, and what takes an hour or less—: they add up, they are remembered, and the tab says how many cards are showing out of how many there are. The open list is sorted by whatever closes first or by whatever asks the least time, your choice. And every open campaign carries, on its own card on the page, the time you still need to take everything that is left —its most expensive reward, because the watch time is per campaign—, so the cost is visible while scrolling. If the inventory never arrives —without it there is no telling what you own or how much you have watched— the panel says so instead of going quiet with its marks switched off. In the inventory you can see a drop's details (progress and time remaining), dismiss entries with the ✕ —\"Reload drops\" brings them back— and tick a checkbox that hides expired/completed and turns on automatic claiming. A 🔗 on every open campaign copies its name, its dates, every reward with what it asks and a link that opens it on Twitch: text and not an image, so it stays searchable and the link stays clickable. It flags campaigns that changed since you last looked with a 🔔 —in the panel and on the card itself— plus a pending count, a desktop notification and an 👁️ button that also takes you to the campaign. 16 languages.",
                scriptInfoAuthor: "Author:",
                scriptInfoGitHub: "GitHub:",
                scriptInfoPrivacy: "Privacy:",
                scriptInfoPrivacyText: "Your keywords and settings stay in your browser only. Drop queries go to gql.twitch.tv using your own session (the token is never written to disk); if that fails, the public API twitch-drops-api.sunkwi.com is used, which only receives a request with none of your data. Nothing is sent to the script author.",

                readingApiDrops: "Reading drop changes from GQL/API...",
                timeRemaining: "Time remaining",
                progress: "Progress",
                rewards: "Rewards",
                minutesShort: "min",
                dropDetails: "Drop details",
                earnedUnclaimed: "earned, not claimed",
                urgentUnclaimed: "unclaimed",
                filterPending: "Something left",
                filterSoon: "Closing soon",
                filterUnclaimed: "Unclaimed",
                filterQuick: "Tier ≤ 1 h",
                filterBarHint: "Filters the active tab only. Several filters add up.",
                noResultsFiltered: "Nothing matches the active filters.",
                clearFilters: "Clear filters",
                negativeKeywordHint: "type -word to exclude",
                sortLabel: "Sort:",
                sortUrgent: "Closing first",
                sortCheapest: "Cheapest first",
                sortCheapestHint: "Sorts by what asks the least to get something. The ⏱ on the card is a different figure: what it costs to take everything.",
                remainingToFinish: "what you still need to take everything from here",
                noInventoryData: "No inventory: what you own and how much you have watched are unknown.",
                urgentClosesIn: "closes in",
                urgentNeed: "you still need",
                urgentMinimum: "minimum",
                urgentNoTime: "not enough time",
                claimedInventoryTitle: "Claimed"
            },
            de: {
                addKeyword: "Keyword hinzufügen",
                deleteKeywordTooltip: "Klicken um Keyword zu löschen", deleteKeywordQuestion: "Keyword löschen ",
                editKeywords: "Keywords bearbeiten", resetKeywords: "Standard wiederherstellen",
                confirmReset: "Keywords auf Standard zurücksetzen?",
                keywordsRestored: "Keywords wiederhergestellt. Neu laden...",
                keywordsModified: "Keywords modified. These are the current keywords: ",
                reloading: "Neu laden...", currentKeywords: "Aktuelle Keywords (klicken zum Löschen):",
                noResults: "Keine Drops gefunden.", dropsActive: "Offene Drops",
                dropsExpired: "Geschlossene Drops",
                editPrompt: "Kommagetrennte Keywords:",
                reload: "Drops neu laden",
                hideExpired: "Hide expired/completed from inventory, automatic drops claiming",
                hideActive: "Hide active from inventory",
                removeInventory: "Click to remove from inventory, to show again press the reload drops button",
                changes_detected: "Changes detected", viewed: "Shown",
                markAllAsViewed: "Mark all as viewed",
                accept: "Akzeptieren", cancel: "Abbrechen", yes: "Ja", no: "Nein",
                addButton: "+", viewIcon: "👁️", changedIcon: "🔔", removeIcon: "❌",
                shareCopy: "Zum Teilen kopieren",
                shareCopied: "Kopiert",
                scriptInfoTitle: "Skript-Informationen", scriptInfoName: "Name:",
                scriptInfoVersion: "Version:", scriptInfoDescription: "Beschreibung:",
                scriptInfoDescriptionText: "Highlights the drop campaigns matching your keywords on the page itself: purple for open, red for closed. The panel lists them split into active and expired, with the date window, the keyword that matched and each reward with the hours it needs. It fills from Twitch's own API, so it works the same in the inventory without pulling you over to campaigns, and while the answer is on its way it stays quiet instead of reporting a zero it does not know yet. Rewards you already own are ticked and struck through one by one, and a badge with nothing left to earn drops the watch time it asked for. What you already earned but have not collected is flagged apart with 🎁 —not dimmed— because it only needs a click, and the closing warning counts those too. What is about to close comes first: when a reward you do not own yet runs out of time within 72 hours, its card says how long is left and how much watch time you still need —red under 24 hours— or that it no longer fits, and the same ⏳ lands on the campaign's card on the page. Keywords are editable: click one to delete it, + to add, edit them in bulk or reset to the defaults. A keyword starting with \"-\" excludes: \"-console\" drops the campaign even if another keyword had found it, and takes the highlight, the card and the alert with it. And four view filters trim the open list without touching anything else —what you still have left, what closes soon, what you already earned and have not collected, and what takes an hour or less—: they add up, they are remembered, and the tab says how many cards are showing out of how many there are. The open list is sorted by whatever closes first or by whatever asks the least time, your choice. And every open campaign carries, on its own card on the page, the time you still need to take everything that is left —its most expensive reward, because the watch time is per campaign—, so the cost is visible while scrolling. If the inventory never arrives —without it there is no telling what you own or how much you have watched— the panel says so instead of going quiet with its marks switched off. In the inventory you can see a drop's details (progress and time remaining), dismiss entries with the ✕ —\"Reload drops\" brings them back— and tick a checkbox that hides expired/completed and turns on automatic claiming. A 🔗 on every open campaign copies its name, its dates, every reward with what it asks and a link that opens it on Twitch: text and not an image, so it stays searchable and the link stays clickable. It flags campaigns that changed since you last looked with a 🔔 —in the panel and on the card itself— plus a pending count, a desktop notification and an 👁️ button that also takes you to the campaign. 16 languages.",
                scriptInfoAuthor: "Autor:", scriptInfoGitHub: "GitHub:",
                readingApiDrops: "Reading drop changes from GQL/API...",
                timeRemaining: "Time remaining",
                progress: "Progress",
                rewards: "Rewards",
                minutesShort: "min",
                dropDetails: "Drop details",
                earnedUnclaimed: "verdient, nicht abgeholt",
                urgentUnclaimed: "nicht abgeholt",
                filterPending: "Noch offen",
                filterSoon: "Endet bald",
                filterUnclaimed: "Nicht abgeholt",
                filterQuick: "Stufe ≤ 1 Std.",
                filterBarHint: "Filtert nur den Tab „Aktiv“. Mehrere Filter greifen zusammen.",
                noResultsFiltered: "Nichts entspricht den aktiven Filtern.",
                clearFilters: "Filter entfernen",
                negativeKeywordHint: "-wort schreiben zum Ausschließen",
                sortLabel: "Sortierung:",
                sortUrgent: "Endet zuerst",
                sortCheapest: "Günstigstes zuerst",
                sortCheapestHint: "Sortiert danach, was am wenigsten verlangt, um überhaupt etwas zu bekommen. Das ⏱ auf der Karte ist eine andere Rechnung: was es kostet, alles mitzunehmen.",
                noInventoryData: "Kein Inventar: unbekannt, was du hast und wie viel du geschaut hast.",
                urgentClosesIn: "endet in",
                urgentNeed: "dir fehlen",
                urgentNoTime: "Zeit reicht nicht",
                claimedInventoryTitle: "Beansprucht"
            },
            fr: {
                addKeyword: "Ajouter un mot-clé",
                deleteKeywordTooltip: "Cliquez pour supprimer le mot-clé", deleteKeywordQuestion: "Supprimer le mot-clé ",
                editKeywords: "Modifier les mots-clés", resetKeywords: "Réinitialiser par défaut",
                confirmReset: "Réinitialiser les mots-clés par défaut ?",
                keywordsRestored: "Mots-clés restaurés. Rechargement...",
                keywordsModified: "Keywords modified. These are the current keywords: ",
                reloading: "Rechargement...", currentKeywords: "Mots-clés actuels (cliquez pour supprimer) :",
                noResults: "Aucun drop ne correspond à vos mots-clés.",
                dropsActive: "Drops ouverts", dropsExpired: "Drops fermés",
                editPrompt: "Mots-clés séparés par des virgules :",
                reload: "Recharger les drops",
                hideExpired: "Hide expired/completed from inventory, automatic drops claiming",
                hideActive: "Hide active from inventory",
                removeInventory: "Click to remove from inventory, to show again press the reload drops button",
                changes_detected: "Changes detected", viewed: "Shown",
                markAllAsViewed: "Mark all as viewed",
                accept: "Accepter", cancel: "Annuler", yes: "Oui", no: "Non",
                addButton: "+", viewIcon: "👁️", changedIcon: "🔔", removeIcon: "❌",
                shareCopy: "Copier pour partager",
                shareCopied: "Copié",
                scriptInfoTitle: "Informations du script", scriptInfoName: "Nom :",
                scriptInfoVersion: "Version :", scriptInfoDescription: "Description :",
                scriptInfoDescriptionText: "Highlights the drop campaigns matching your keywords on the page itself: purple for open, red for closed. The panel lists them split into active and expired, with the date window, the keyword that matched and each reward with the hours it needs. It fills from Twitch's own API, so it works the same in the inventory without pulling you over to campaigns, and while the answer is on its way it stays quiet instead of reporting a zero it does not know yet. Rewards you already own are ticked and struck through one by one, and a badge with nothing left to earn drops the watch time it asked for. What you already earned but have not collected is flagged apart with 🎁 —not dimmed— because it only needs a click, and the closing warning counts those too. What is about to close comes first: when a reward you do not own yet runs out of time within 72 hours, its card says how long is left and how much watch time you still need —red under 24 hours— or that it no longer fits, and the same ⏳ lands on the campaign's card on the page. Keywords are editable: click one to delete it, + to add, edit them in bulk or reset to the defaults. A keyword starting with \"-\" excludes: \"-console\" drops the campaign even if another keyword had found it, and takes the highlight, the card and the alert with it. And four view filters trim the open list without touching anything else —what you still have left, what closes soon, what you already earned and have not collected, and what takes an hour or less—: they add up, they are remembered, and the tab says how many cards are showing out of how many there are. The open list is sorted by whatever closes first or by whatever asks the least time, your choice. And every open campaign carries, on its own card on the page, the time you still need to take everything that is left —its most expensive reward, because the watch time is per campaign—, so the cost is visible while scrolling. If the inventory never arrives —without it there is no telling what you own or how much you have watched— the panel says so instead of going quiet with its marks switched off. In the inventory you can see a drop's details (progress and time remaining), dismiss entries with the ✕ —\"Reload drops\" brings them back— and tick a checkbox that hides expired/completed and turns on automatic claiming. A 🔗 on every open campaign copies its name, its dates, every reward with what it asks and a link that opens it on Twitch: text and not an image, so it stays searchable and the link stays clickable. It flags campaigns that changed since you last looked with a 🔔 —in the panel and on the card itself— plus a pending count, a desktop notification and an 👁️ button that also takes you to the campaign. 16 languages.",
                scriptInfoAuthor: "Auteur :", scriptInfoGitHub: "GitHub :",
                readingApiDrops: "Reading drop changes from GQL/API...",
                timeRemaining: "Time remaining",
                progress: "Progress",
                rewards: "Rewards",
                minutesShort: "min",
                dropDetails: "Drop details",
                earnedUnclaimed: "gagné, non réclamé",
                urgentUnclaimed: "non réclamés",
                filterPending: "Reste à faire",
                filterSoon: "Se termine bientôt",
                filterUnclaimed: "Non réclamés",
                filterQuick: "Palier ≤ 1 h",
                filterBarHint: "Ne filtre que l’onglet actif. Plusieurs filtres se cumulent.",
                noResultsFiltered: "Rien ne passe les filtres actifs.",
                clearFilters: "Retirer les filtres",
                negativeKeywordHint: "écrivez -mot pour exclure",
                sortLabel: "Tri :",
                sortUrgent: "Ce qui ferme en premier",
                sortCheapest: "Le moins cher",
                sortCheapestHint: "Trie par ce qui demande le moins pour obtenir quelque chose. Le ⏱ de la carte est un autre calcul : ce que coûte tout emporter.",
                noInventoryData: "Sans inventaire : impossible de savoir ce que tu as ni combien tu as regardé.",
                urgentClosesIn: "se termine dans",
                urgentNeed: "il te manque",
                urgentNoTime: "pas assez de temps",
                claimedInventoryTitle: "Réclamés"
            },
            pt: {
                addKeyword: "Adicionar Keyword",
                deleteKeywordTooltip: "Clique para deletar keyword", deleteKeywordQuestion: "Deletar keyword ",
                editKeywords: "Editar Keywords", resetKeywords: "Restaurar Padrão",
                confirmReset: "Restaurar keywords padrão?",
                keywordsRestored: "Keywords restauradas. Recarregando...",
                keywordsModified: "Keywords modified. These are the current keywords: ",
                reloading: "Recarregando...", currentKeywords: "Keywords atuais (clique para deletar):",
                noResults: "Nenhum drop encontrado com suas keywords.",
                dropsActive: "Drops Abertos", dropsExpired: "Drops Fechados",
                editPrompt: "Keywords separadas por vírgula:",
                reload: "Recarregar drops",
                hideExpired: "Hide expired/completed from inventory, automatic drops claiming",
                hideActive: "Hide active from inventory",
                removeInventory: "Click to remove from inventory, to show again press the reload drops button",
                changes_detected: "Changes detected", viewed: "Shown",
                markAllAsViewed: "Mark all as viewed",
                accept: "Aceitar", cancel: "Cancelar", yes: "Sim", no: "Não",
                addButton: "+", viewIcon: "👁️", changedIcon: "🔔", removeIcon: "❌",
                shareCopy: "Copiar para compartilhar",
                shareCopied: "Copiado",
                scriptInfoTitle: "Informações do script", scriptInfoName: "Nome:",
                scriptInfoVersion: "Versão:", scriptInfoDescription: "Descrição:",
                scriptInfoDescriptionText: "Highlights the drop campaigns matching your keywords on the page itself: purple for open, red for closed. The panel lists them split into active and expired, with the date window, the keyword that matched and each reward with the hours it needs. It fills from Twitch's own API, so it works the same in the inventory without pulling you over to campaigns, and while the answer is on its way it stays quiet instead of reporting a zero it does not know yet. Rewards you already own are ticked and struck through one by one, and a badge with nothing left to earn drops the watch time it asked for. What you already earned but have not collected is flagged apart with 🎁 —not dimmed— because it only needs a click, and the closing warning counts those too. What is about to close comes first: when a reward you do not own yet runs out of time within 72 hours, its card says how long is left and how much watch time you still need —red under 24 hours— or that it no longer fits, and the same ⏳ lands on the campaign's card on the page. Keywords are editable: click one to delete it, + to add, edit them in bulk or reset to the defaults. A keyword starting with \"-\" excludes: \"-console\" drops the campaign even if another keyword had found it, and takes the highlight, the card and the alert with it. And four view filters trim the open list without touching anything else —what you still have left, what closes soon, what you already earned and have not collected, and what takes an hour or less—: they add up, they are remembered, and the tab says how many cards are showing out of how many there are. The open list is sorted by whatever closes first or by whatever asks the least time, your choice. And every open campaign carries, on its own card on the page, the time you still need to take everything that is left —its most expensive reward, because the watch time is per campaign—, so the cost is visible while scrolling. If the inventory never arrives —without it there is no telling what you own or how much you have watched— the panel says so instead of going quiet with its marks switched off. In the inventory you can see a drop's details (progress and time remaining), dismiss entries with the ✕ —\"Reload drops\" brings them back— and tick a checkbox that hides expired/completed and turns on automatic claiming. A 🔗 on every open campaign copies its name, its dates, every reward with what it asks and a link that opens it on Twitch: text and not an image, so it stays searchable and the link stays clickable. It flags campaigns that changed since you last looked with a 🔔 —in the panel and on the card itself— plus a pending count, a desktop notification and an 👁️ button that also takes you to the campaign. 16 languages.",
                scriptInfoAuthor: "Autor:", scriptInfoGitHub: "GitHub:",
                readingApiDrops: "Reading drop changes from GQL/API...",
                timeRemaining: "Time remaining",
                progress: "Progress",
                rewards: "Rewards",
                minutesShort: "min",
                dropDetails: "Drop details",
                earnedUnclaimed: "ganho, falta resgatar",
                urgentUnclaimed: "sem resgatar",
                filterPending: "Falta algo",
                filterSoon: "Fecha em breve",
                filterUnclaimed: "Sem resgatar",
                filterQuick: "Nível ≤ 1 h",
                filterBarHint: "Filtra só a aba de ativos. Vários filtros somam-se.",
                noResultsFiltered: "Nada passa nos filtros ativos.",
                clearFilters: "Remover filtros",
                negativeKeywordHint: "escreva -palavra para excluir",
                sortLabel: "Ordem:",
                sortUrgent: "O que fecha antes",
                sortCheapest: "O mais barato",
                sortCheapestHint: "Ordena pelo que menos pede para levar alguma coisa. O ⏱ do cartão é outra conta: o que custa levar tudo.",
                noInventoryData: "Sem inventário: não se sabe o que tens nem quanto já viste.",
                urgentClosesIn: "fecha em",
                urgentNeed: "faltam",
                urgentNoTime: "não dá tempo",
                claimedInventoryTitle: "Resgatados"
            },
            ru: {
                addKeyword: "Добавить ключевое слово",
                deleteKeywordTooltip: "Нажмите для удаления", deleteKeywordQuestion: "Удалить ключевое слово ",
                editKeywords: "Редактировать ключевые слова", resetKeywords: "Сбросить по умолчанию",
                confirmReset: "Сбросить ключевые слова по умолчанию?",
                keywordsRestored: "Ключевые слова восстановлены. Перезагрузка...",
                keywordsModified: "Keywords modified. These are the current keywords: ",
                reloading: "Перезагрузка...", currentKeywords: "Текущие ключевые слова (нажмите для удаления):",
                noResults: "Дропы не найдены.", dropsActive: "Открытые дропы",
                dropsExpired: "Закрытые дропы",
                editPrompt: "Ключевые слова через запятую:",
                reload: "Перезагрузить дропы",
                hideExpired: "Hide expired/completed from inventory, automatic drops claiming",
                hideActive: "Hide active from inventory",
                removeInventory: "Click to remove from inventory, to show again press the reload drops button",
                changes_detected: "Changes detected", viewed: "Shown",
                markAllAsViewed: "Mark all as viewed",
                accept: "Принять", cancel: "Отмена", yes: "Да", no: "Нет",
                addButton: "+", viewIcon: "👁️", changedIcon: "🔔", removeIcon: "❌",
                shareCopy: "Скопировать, чтобы поделиться",
                shareCopied: "Скопировано",
                scriptInfoTitle: "Информация о скрипте", scriptInfoName: "Имя:",
                scriptInfoVersion: "Версия:", scriptInfoDescription: "Описание:",
                scriptInfoDescriptionText: "Highlights the drop campaigns matching your keywords on the page itself: purple for open, red for closed. The panel lists them split into active and expired, with the date window, the keyword that matched and each reward with the hours it needs. It fills from Twitch's own API, so it works the same in the inventory without pulling you over to campaigns, and while the answer is on its way it stays quiet instead of reporting a zero it does not know yet. Rewards you already own are ticked and struck through one by one, and a badge with nothing left to earn drops the watch time it asked for. What you already earned but have not collected is flagged apart with 🎁 —not dimmed— because it only needs a click, and the closing warning counts those too. What is about to close comes first: when a reward you do not own yet runs out of time within 72 hours, its card says how long is left and how much watch time you still need —red under 24 hours— or that it no longer fits, and the same ⏳ lands on the campaign's card on the page. Keywords are editable: click one to delete it, + to add, edit them in bulk or reset to the defaults. A keyword starting with \"-\" excludes: \"-console\" drops the campaign even if another keyword had found it, and takes the highlight, the card and the alert with it. And four view filters trim the open list without touching anything else —what you still have left, what closes soon, what you already earned and have not collected, and what takes an hour or less—: they add up, they are remembered, and the tab says how many cards are showing out of how many there are. The open list is sorted by whatever closes first or by whatever asks the least time, your choice. And every open campaign carries, on its own card on the page, the time you still need to take everything that is left —its most expensive reward, because the watch time is per campaign—, so the cost is visible while scrolling. If the inventory never arrives —without it there is no telling what you own or how much you have watched— the panel says so instead of going quiet with its marks switched off. In the inventory you can see a drop's details (progress and time remaining), dismiss entries with the ✕ —\"Reload drops\" brings them back— and tick a checkbox that hides expired/completed and turns on automatic claiming. A 🔗 on every open campaign copies its name, its dates, every reward with what it asks and a link that opens it on Twitch: text and not an image, so it stays searchable and the link stays clickable. It flags campaigns that changed since you last looked with a 🔔 —in the panel and on the card itself— plus a pending count, a desktop notification and an 👁️ button that also takes you to the campaign. 16 languages.",
                scriptInfoAuthor: "Автор:", scriptInfoGitHub: "GitHub:",
                readingApiDrops: "Reading drop changes from GQL/API...",
                timeRemaining: "Time remaining",
                progress: "Progress",
                rewards: "Rewards",
                minutesShort: "min",
                dropDetails: "Drop details",
                earnedUnclaimed: "получено, не забрано",
                urgentUnclaimed: "не забрано",
                filterPending: "Есть незавершённые",
                filterSoon: "Скоро закроется",
                filterUnclaimed: "Не забрано",
                filterQuick: "Уровень ≤ 1 ч",
                filterBarHint: "Фильтрует только вкладку активных. Несколько фильтров складываются.",
                noResultsFiltered: "Ничего не проходит активные фильтры.",
                clearFilters: "Убрать фильтры",
                negativeKeywordHint: "напишите -слово, чтобы исключить",
                sortLabel: "Сортировка:",
                sortUrgent: "Скоро закрывается",
                sortCheapest: "Самое дешёвое",
                sortCheapestHint: "Сортирует по тому, что требует меньше всего, чтобы получить хоть что-то. ⏱ на карточке — другой расчёт: сколько стоит забрать всё.",
                noInventoryData: "Нет инвентаря: неизвестно, что получено и сколько просмотрено.",
                urgentClosesIn: "закроется через",
                urgentNeed: "осталось",
                urgentNoTime: "не успеешь",
                claimedInventoryTitle: "Востребованные"
            },
            tr: {
                addKeyword: "Anahtar Kelime Ekle",
                deleteKeywordTooltip: "Silmek için tıklayın", deleteKeywordQuestion: "Anahtar kelimeyi sil ",
                editKeywords: "Anahtar Kelimeleri Düzenle", resetKeywords: "Varsayılana Sıfırla",
                confirmReset: "Anahtar kelimeleri varsayılana sıfırla?",
                keywordsRestored: "Anahtar kelimeler geri yüklendi. Yeniden yükleniyor...",
                keywordsModified: "Keywords modified. These are the current keywords: ",
                reloading: "Yeniden yükleniyor...", currentKeywords: "Mevcut anahtar kelimeler (silmek için tıklayın):",
                noResults: "Anahtar kelimelerinize uygun drop bulunamadı.",
                dropsActive: "Açık Drops", dropsExpired: "Kapalı Drops",
                editPrompt: "Virgülle ayrılmış anahtar kelimeler:",
                reload: "Dropları yeniden yükle",
                hideExpired: "Hide expired/completed from inventory, automatic drops claiming",
                hideActive: "Hide active from inventory",
                removeInventory: "Click to remove from inventory, to show again press the reload drops button",
                changes_detected: "Changes detected", viewed: "Shown",
                markAllAsViewed: "Mark all as viewed",
                accept: "Kabul et", cancel: "İptal", yes: "Evet", no: "Hayır",
                addButton: "+", viewIcon: "👁️", changedIcon: "🔔", removeIcon: "❌",
                shareCopy: "Paylaşmak için kopyala",
                shareCopied: "Kopyalandı",
                scriptInfoTitle: "Script Bilgisi", scriptInfoName: "Ad:",
                scriptInfoVersion: "Sürüm:", scriptInfoDescription: "Açıklama:",
                scriptInfoDescriptionText: "Highlights the drop campaigns matching your keywords on the page itself: purple for open, red for closed. The panel lists them split into active and expired, with the date window, the keyword that matched and each reward with the hours it needs. It fills from Twitch's own API, so it works the same in the inventory without pulling you over to campaigns, and while the answer is on its way it stays quiet instead of reporting a zero it does not know yet. Rewards you already own are ticked and struck through one by one, and a badge with nothing left to earn drops the watch time it asked for. What you already earned but have not collected is flagged apart with 🎁 —not dimmed— because it only needs a click, and the closing warning counts those too. What is about to close comes first: when a reward you do not own yet runs out of time within 72 hours, its card says how long is left and how much watch time you still need —red under 24 hours— or that it no longer fits, and the same ⏳ lands on the campaign's card on the page. Keywords are editable: click one to delete it, + to add, edit them in bulk or reset to the defaults. A keyword starting with \"-\" excludes: \"-console\" drops the campaign even if another keyword had found it, and takes the highlight, the card and the alert with it. And four view filters trim the open list without touching anything else —what you still have left, what closes soon, what you already earned and have not collected, and what takes an hour or less—: they add up, they are remembered, and the tab says how many cards are showing out of how many there are. The open list is sorted by whatever closes first or by whatever asks the least time, your choice. And every open campaign carries, on its own card on the page, the time you still need to take everything that is left —its most expensive reward, because the watch time is per campaign—, so the cost is visible while scrolling. If the inventory never arrives —without it there is no telling what you own or how much you have watched— the panel says so instead of going quiet with its marks switched off. In the inventory you can see a drop's details (progress and time remaining), dismiss entries with the ✕ —\"Reload drops\" brings them back— and tick a checkbox that hides expired/completed and turns on automatic claiming. A 🔗 on every open campaign copies its name, its dates, every reward with what it asks and a link that opens it on Twitch: text and not an image, so it stays searchable and the link stays clickable. It flags campaigns that changed since you last looked with a 🔔 —in the panel and on the card itself— plus a pending count, a desktop notification and an 👁️ button that also takes you to the campaign. 16 languages.",
                scriptInfoAuthor: "Yazar:", scriptInfoGitHub: "GitHub:",
                readingApiDrops: "Reading drop changes from GQL/API...",
                timeRemaining: "Time remaining",
                progress: "Progress",
                rewards: "Rewards",
                minutesShort: "min",
                dropDetails: "Drop details",
                earnedUnclaimed: "kazanıldı, alınmadı",
                urgentUnclaimed: "alınmadı",
                filterPending: "Eksiği var",
                filterSoon: "Yakında kapanıyor",
                filterUnclaimed: "Alınmadı",
                filterQuick: "Kademe ≤ 1 sa.",
                filterBarHint: "Yalnızca etkin sekmesini filtreler. Birden fazla filtre birleşir.",
                noResultsFiltered: "Etkin filtrelere uyan bir şey yok.",
                clearFilters: "Filtreleri kaldır",
                negativeKeywordHint: "hariç tutmak için -kelime yazın",
                sortLabel: "Sıralama:",
                sortUrgent: "Önce kapananlar",
                sortCheapest: "Önce en ucuz",
                sortCheapestHint: "Bir şey almak için en az isteyene göre sıralar. Karttaki ⏱ başka bir hesap: her şeyi almanın maliyeti.",
                noInventoryData: "Envanter yok: neye sahip olduğun ve ne kadar izlediğin bilinmiyor.",
                urgentClosesIn: "kapanışa",
                urgentNeed: "kalan",
                urgentNoTime: "zaman yetmiyor",
                claimedInventoryTitle: "Talep Edilenler"
            },
            ja: {
                addKeyword: "キーワード追加",
                deleteKeywordTooltip: "クリックで削除", deleteKeywordQuestion: "キーワードを削除 ",
                editKeywords: "キーワード編集", resetKeywords: "デフォルトに戻す",
                confirmReset: "キーワードをデフォルトに戻しますか？",
                keywordsRestored: "キーワード復元。再読み込み中...",
                keywordsModified: "Keywords modified. These are the current keywords: ",
                reloading: "再読み込み中...", currentKeywords: "現在のキーワード（クリックで削除）:",
                noResults: "キーワードに一致するドロップはありません。",
                dropsActive: "アクティブなドロップ", dropsExpired: "終了したドロップ",
                editPrompt: "カンマ区切りのキーワード:",
                reload: "ドロップを再読み込み",
                hideExpired: "Hide expired/completed from inventory, automatic drops claiming",
                hideActive: "Hide active from inventory",
                removeInventory: "Click to remove from inventory, to show again press the reload drops button",
                changes_detected: "Changes detected", viewed: "Shown",
                markAllAsViewed: "Mark all as viewed",
                accept: "承認", cancel: "キャンセル", yes: "はい", no: "いいえ",
                addButton: "+", viewIcon: "👁️", changedIcon: "🔔", removeIcon: "❌",
                shareCopy: "共有用にコピー",
                shareCopied: "コピーしました",
                scriptInfoTitle: "スクリプト情報", scriptInfoName: "名前:",
                scriptInfoVersion: "バージョン:", scriptInfoDescription: "説明:",
                scriptInfoDescriptionText: "Highlights the drop campaigns matching your keywords on the page itself: purple for open, red for closed. The panel lists them split into active and expired, with the date window, the keyword that matched and each reward with the hours it needs. It fills from Twitch's own API, so it works the same in the inventory without pulling you over to campaigns, and while the answer is on its way it stays quiet instead of reporting a zero it does not know yet. Rewards you already own are ticked and struck through one by one, and a badge with nothing left to earn drops the watch time it asked for. What you already earned but have not collected is flagged apart with 🎁 —not dimmed— because it only needs a click, and the closing warning counts those too. What is about to close comes first: when a reward you do not own yet runs out of time within 72 hours, its card says how long is left and how much watch time you still need —red under 24 hours— or that it no longer fits, and the same ⏳ lands on the campaign's card on the page. Keywords are editable: click one to delete it, + to add, edit them in bulk or reset to the defaults. A keyword starting with \"-\" excludes: \"-console\" drops the campaign even if another keyword had found it, and takes the highlight, the card and the alert with it. And four view filters trim the open list without touching anything else —what you still have left, what closes soon, what you already earned and have not collected, and what takes an hour or less—: they add up, they are remembered, and the tab says how many cards are showing out of how many there are. The open list is sorted by whatever closes first or by whatever asks the least time, your choice. And every open campaign carries, on its own card on the page, the time you still need to take everything that is left —its most expensive reward, because the watch time is per campaign—, so the cost is visible while scrolling. If the inventory never arrives —without it there is no telling what you own or how much you have watched— the panel says so instead of going quiet with its marks switched off. In the inventory you can see a drop's details (progress and time remaining), dismiss entries with the ✕ —\"Reload drops\" brings them back— and tick a checkbox that hides expired/completed and turns on automatic claiming. A 🔗 on every open campaign copies its name, its dates, every reward with what it asks and a link that opens it on Twitch: text and not an image, so it stays searchable and the link stays clickable. It flags campaigns that changed since you last looked with a 🔔 —in the panel and on the card itself— plus a pending count, a desktop notification and an 👁️ button that also takes you to the campaign. 16 languages.",
                scriptInfoAuthor: "作者:", scriptInfoGitHub: "GitHub:",
                readingApiDrops: "Reading drop changes from GQL/API...",
                timeRemaining: "Time remaining",
                progress: "Progress",
                rewards: "Rewards",
                minutesShort: "min",
                dropDetails: "Drop details",
                earnedUnclaimed: "獲得済み、未受け取り",
                urgentUnclaimed: "未受け取り",
                filterPending: "未完了あり",
                filterSoon: "まもなく終了",
                filterUnclaimed: "未受け取り",
                filterQuick: "1時間以内の枠",
                filterBarHint: "「進行中」タブのみを絞り込みます。複数の条件は重ねて適用されます。",
                noResultsFiltered: "有効な絞り込みに合うものがありません。",
                clearFilters: "絞り込みを解除",
                negativeKeywordHint: "除外するには -単語 と入力",
                sortLabel: "並び順:",
                sortUrgent: "終了が近い順",
                sortCheapest: "安い順",
                sortCheapestHint: "何か一つ手に入れるのに一番時間がかからない順に並べます。カードの⏱は別の数字で、すべて手に入れるのにかかる時間です。",
                noInventoryData: "インベントリなし: 所持状況と視聴時間が不明です。",
                urgentClosesIn: "終了まで",
                urgentNeed: "残り",
                urgentNoTime: "時間が足りません",
                claimedInventoryTitle: "受け取り済み"
            },
            ko: {
                addKeyword: "키워드 추가",
                deleteKeywordTooltip: "클릭하여 삭제", deleteKeywordQuestion: "키워드 삭제 ",
                editKeywords: "키워드 편집", resetKeywords: "기본값 복원",
                confirmReset: "키워드를 기본값으로 복원하시겠습니까?",
                keywordsRestored: "키워드 복원됨. 새로고침 중...",
                keywordsModified: "Keywords modified. These are the current keywords: ",
                reloading: "새로고침 중...", currentKeywords: "현재 키워드 (클릭하여 삭제):",
                noResults: "키워드와 일치하는 드롭이 없습니다.",
                dropsActive: "활성 드롭", dropsExpired: "종료된 드롭",
                editPrompt: "쉼표로 구분된 키워드:",
                reload: "드롭 새로고침",
                hideExpired: "Hide expired/completed from inventory, automatic drops claiming",
                hideActive: "Hide active from inventory",
                removeInventory: "Click to remove from inventory, to show again press the reload drops button",
                changes_detected: "Changes detected", viewed: "Shown",
                markAllAsViewed: "Mark all as viewed",
                accept: "수락", cancel: "취소", yes: "예", no: "아니오",
                addButton: "+", viewIcon: "👁️", changedIcon: "🔔", removeIcon: "❌",
                shareCopy: "공유용으로 복사",
                shareCopied: "복사됨",
                scriptInfoTitle: "스크립트 정보", scriptInfoName: "이름:",
                scriptInfoVersion: "버전:", scriptInfoDescription: "설명:",
                scriptInfoDescriptionText: "Highlights the drop campaigns matching your keywords on the page itself: purple for open, red for closed. The panel lists them split into active and expired, with the date window, the keyword that matched and each reward with the hours it needs. It fills from Twitch's own API, so it works the same in the inventory without pulling you over to campaigns, and while the answer is on its way it stays quiet instead of reporting a zero it does not know yet. Rewards you already own are ticked and struck through one by one, and a badge with nothing left to earn drops the watch time it asked for. What you already earned but have not collected is flagged apart with 🎁 —not dimmed— because it only needs a click, and the closing warning counts those too. What is about to close comes first: when a reward you do not own yet runs out of time within 72 hours, its card says how long is left and how much watch time you still need —red under 24 hours— or that it no longer fits, and the same ⏳ lands on the campaign's card on the page. Keywords are editable: click one to delete it, + to add, edit them in bulk or reset to the defaults. A keyword starting with \"-\" excludes: \"-console\" drops the campaign even if another keyword had found it, and takes the highlight, the card and the alert with it. And four view filters trim the open list without touching anything else —what you still have left, what closes soon, what you already earned and have not collected, and what takes an hour or less—: they add up, they are remembered, and the tab says how many cards are showing out of how many there are. The open list is sorted by whatever closes first or by whatever asks the least time, your choice. And every open campaign carries, on its own card on the page, the time you still need to take everything that is left —its most expensive reward, because the watch time is per campaign—, so the cost is visible while scrolling. If the inventory never arrives —without it there is no telling what you own or how much you have watched— the panel says so instead of going quiet with its marks switched off. In the inventory you can see a drop's details (progress and time remaining), dismiss entries with the ✕ —\"Reload drops\" brings them back— and tick a checkbox that hides expired/completed and turns on automatic claiming. A 🔗 on every open campaign copies its name, its dates, every reward with what it asks and a link that opens it on Twitch: text and not an image, so it stays searchable and the link stays clickable. It flags campaigns that changed since you last looked with a 🔔 —in the panel and on the card itself— plus a pending count, a desktop notification and an 👁️ button that also takes you to the campaign. 16 languages.",
                scriptInfoAuthor: "작성자:", scriptInfoGitHub: "GitHub:",
                readingApiDrops: "Reading drop changes from GQL/API...",
                timeRemaining: "Time remaining",
                progress: "Progress",
                rewards: "Rewards",
                minutesShort: "min",
                dropDetails: "Drop details",
                earnedUnclaimed: "획득함, 미수령",
                urgentUnclaimed: "미수령",
                filterPending: "남은 항목",
                filterSoon: "곧 종료",
                filterUnclaimed: "미수령",
                filterQuick: "1시간 이하 단계",
                filterBarHint: "‘진행 중’ 탭만 걸러냅니다. 여러 조건은 함께 적용됩니다.",
                noResultsFiltered: "활성 필터에 맞는 항목이 없습니다.",
                clearFilters: "필터 해제",
                negativeKeywordHint: "제외하려면 -단어 입력",
                sortLabel: "정렬:",
                sortUrgent: "종료 임박순",
                sortCheapest: "저렴한 순",
                sortCheapestHint: "무언가 하나를 얻는 데 가장 적게 드는 순서로 정렬합니다. 카드의 ⏱는 다른 계산으로, 전부 받는 데 드는 시간입니다.",
                noInventoryData: "인벤토리 없음: 보유 여부와 시청 시간을 알 수 없습니다.",
                urgentClosesIn: "종료까지",
                urgentNeed: "남은 시간",
                urgentNoTime: "시간이 부족",
                claimedInventoryTitle: "수령 완료"
            },
            pl: {
                addKeyword: "Dodaj słowo kluczowe",
                deleteKeywordTooltip: "Kliknij aby usunąć", deleteKeywordQuestion: "Usunąć słowo kluczowe ",
                editKeywords: "Edytuj słowa kluczowe", resetKeywords: "Przywróć domyślne",
                confirmReset: "Przywrócić domyślne słowa kluczowe?",
                keywordsRestored: "Słowa kluczowe przywrócone. Przeładowywanie...",
                keywordsModified: "Keywords modified. These are the current keywords: ",
                reloading: "Przeładowywanie...", currentKeywords: "Aktualne słowa kluczowe (kliknij aby usunąć):",
                noResults: "Nie znaleziono dropów pasujących do słów kluczowych.",
                dropsActive: "Otwarte dropy", dropsExpired: "Zamknięte dropy",
                editPrompt: "Słowa kluczowe oddzielone przecinkami:",
                reload: "Przeładuj dropy",
                hideExpired: "Hide expired/completed from inventory, automatic drops claiming",
                hideActive: "Hide active from inventory",
                removeInventory: "Click to remove from inventory, to show again press the reload drops button",
                changes_detected: "Changes detected", viewed: "Shown",
                markAllAsViewed: "Mark all as viewed",
                accept: "Akceptuj", cancel: "Anuluj", yes: "Tak", no: "Nie",
                addButton: "+", viewIcon: "👁️", changedIcon: "🔔", removeIcon: "❌",
                shareCopy: "Kopiuj, aby udostępnić",
                shareCopied: "Skopiowano",
                scriptInfoTitle: "Informacje o skrypcie", scriptInfoName: "Nazwa:",
                scriptInfoVersion: "Wersja:", scriptInfoDescription: "Opis:",
                scriptInfoDescriptionText: "Highlights the drop campaigns matching your keywords on the page itself: purple for open, red for closed. The panel lists them split into active and expired, with the date window, the keyword that matched and each reward with the hours it needs. It fills from Twitch's own API, so it works the same in the inventory without pulling you over to campaigns, and while the answer is on its way it stays quiet instead of reporting a zero it does not know yet. Rewards you already own are ticked and struck through one by one, and a badge with nothing left to earn drops the watch time it asked for. What you already earned but have not collected is flagged apart with 🎁 —not dimmed— because it only needs a click, and the closing warning counts those too. What is about to close comes first: when a reward you do not own yet runs out of time within 72 hours, its card says how long is left and how much watch time you still need —red under 24 hours— or that it no longer fits, and the same ⏳ lands on the campaign's card on the page. Keywords are editable: click one to delete it, + to add, edit them in bulk or reset to the defaults. A keyword starting with \"-\" excludes: \"-console\" drops the campaign even if another keyword had found it, and takes the highlight, the card and the alert with it. And four view filters trim the open list without touching anything else —what you still have left, what closes soon, what you already earned and have not collected, and what takes an hour or less—: they add up, they are remembered, and the tab says how many cards are showing out of how many there are. The open list is sorted by whatever closes first or by whatever asks the least time, your choice. And every open campaign carries, on its own card on the page, the time you still need to take everything that is left —its most expensive reward, because the watch time is per campaign—, so the cost is visible while scrolling. If the inventory never arrives —without it there is no telling what you own or how much you have watched— the panel says so instead of going quiet with its marks switched off. In the inventory you can see a drop's details (progress and time remaining), dismiss entries with the ✕ —\"Reload drops\" brings them back— and tick a checkbox that hides expired/completed and turns on automatic claiming. A 🔗 on every open campaign copies its name, its dates, every reward with what it asks and a link that opens it on Twitch: text and not an image, so it stays searchable and the link stays clickable. It flags campaigns that changed since you last looked with a 🔔 —in the panel and on the card itself— plus a pending count, a desktop notification and an 👁️ button that also takes you to the campaign. 16 languages.",
                scriptInfoAuthor: "Autor:", scriptInfoGitHub: "GitHub:",
                readingApiDrops: "Reading drop changes from GQL/API...",
                timeRemaining: "Time remaining",
                progress: "Progress",
                rewards: "Rewards",
                minutesShort: "min",
                dropDetails: "Drop details",
                earnedUnclaimed: "zdobyte, nieodebrane",
                urgentUnclaimed: "nieodebrane",
                filterPending: "Coś zostało",
                filterSoon: "Wkrótce koniec",
                filterUnclaimed: "Nieodebrane",
                filterQuick: "Próg ≤ 1 godz.",
                filterBarHint: "Filtruje tylko kartę aktywnych. Kilka filtrów sumuje się.",
                noResultsFiltered: "Nic nie przechodzi aktywnych filtrów.",
                clearFilters: "Usuń filtry",
                negativeKeywordHint: "wpisz -słowo, aby wykluczyć",
                sortLabel: "Sortowanie:",
                sortUrgent: "Najpierw kończące się",
                sortCheapest: "Najpierw najtańsze",
                sortCheapestHint: "Sortuje według tego, co wymaga najmniej, by cokolwiek zdobyć. ⏱ na karcie to inne wyliczenie: ile kosztuje zabranie wszystkiego.",
                noInventoryData: "Brak ekwipunku: nie wiadomo, co masz ani ile obejrzano.",
                urgentClosesIn: "kończy się za",
                urgentNeed: "brakuje",
                urgentNoTime: "za mało czasu",
                claimedInventoryTitle: "Odebrane"
            },
            fi: {
                addKeyword: "Lisää avainsana",
                deleteKeywordTooltip: "Klikkaa poistaaksesi", deleteKeywordQuestion: "Poista avainsana ",
                editKeywords: "Muokkaa avainsanoja", resetKeywords: "Palauta oletukset",
                confirmReset: "Palauta avainsanat oletuksiin?",
                keywordsRestored: "Avainsanat palautettu. Ladataan uudelleen...",
                keywordsModified: "Keywords modified. These are the current keywords: ",
                reloading: "Ladataan uudelleen...", currentKeywords: "Nykyiset avainsanat (klikkaa poistaaksesi):",
                noResults: "Avainsanoihin sopivia droppeja ei löytynyt.",
                dropsActive: "Avoimet dropit", dropsExpired: "Suljetut dropit",
                editPrompt: "Avainsanat pilkulla eroteltuina:",
                reload: "Lataa dropit uudelleen",
                hideExpired: "Hide expired/completed from inventory, automatic drops claiming",
                hideActive: "Hide active from inventory",
                removeInventory: "Click to remove from inventory, to show again press the reload drops button",
                changes_detected: "Changes detected", viewed: "Shown",
                markAllAsViewed: "Mark all as viewed",
                accept: "Hyväksy", cancel: "Peruuta", yes: "Kyllä", no: "Ei",
                addButton: "+", viewIcon: "👁️", changedIcon: "🔔", removeIcon: "❌",
                shareCopy: "Kopioi jaettavaksi",
                shareCopied: "Kopioitu",
                scriptInfoTitle: "Skriptin tiedot", scriptInfoName: "Nimi:",
                scriptInfoVersion: "Versio:", scriptInfoDescription: "Kuvaus:",
                scriptInfoDescriptionText: "Highlights the drop campaigns matching your keywords on the page itself: purple for open, red for closed. The panel lists them split into active and expired, with the date window, the keyword that matched and each reward with the hours it needs. It fills from Twitch's own API, so it works the same in the inventory without pulling you over to campaigns, and while the answer is on its way it stays quiet instead of reporting a zero it does not know yet. Rewards you already own are ticked and struck through one by one, and a badge with nothing left to earn drops the watch time it asked for. What you already earned but have not collected is flagged apart with 🎁 —not dimmed— because it only needs a click, and the closing warning counts those too. What is about to close comes first: when a reward you do not own yet runs out of time within 72 hours, its card says how long is left and how much watch time you still need —red under 24 hours— or that it no longer fits, and the same ⏳ lands on the campaign's card on the page. Keywords are editable: click one to delete it, + to add, edit them in bulk or reset to the defaults. A keyword starting with \"-\" excludes: \"-console\" drops the campaign even if another keyword had found it, and takes the highlight, the card and the alert with it. And four view filters trim the open list without touching anything else —what you still have left, what closes soon, what you already earned and have not collected, and what takes an hour or less—: they add up, they are remembered, and the tab says how many cards are showing out of how many there are. The open list is sorted by whatever closes first or by whatever asks the least time, your choice. And every open campaign carries, on its own card on the page, the time you still need to take everything that is left —its most expensive reward, because the watch time is per campaign—, so the cost is visible while scrolling. If the inventory never arrives —without it there is no telling what you own or how much you have watched— the panel says so instead of going quiet with its marks switched off. In the inventory you can see a drop's details (progress and time remaining), dismiss entries with the ✕ —\"Reload drops\" brings them back— and tick a checkbox that hides expired/completed and turns on automatic claiming. A 🔗 on every open campaign copies its name, its dates, every reward with what it asks and a link that opens it on Twitch: text and not an image, so it stays searchable and the link stays clickable. It flags campaigns that changed since you last looked with a 🔔 —in the panel and on the card itself— plus a pending count, a desktop notification and an 👁️ button that also takes you to the campaign. 16 languages.",
                scriptInfoAuthor: "Tekijä:", scriptInfoGitHub: "GitHub:",
                readingApiDrops: "Reading drop changes from GQL/API...",
                timeRemaining: "Time remaining",
                progress: "Progress",
                rewards: "Rewards",
                minutesShort: "min",
                dropDetails: "Drop details",
                earnedUnclaimed: "ansaittu, lunastamatta",
                urgentUnclaimed: "lunastamatta",
                filterPending: "Jotain kesken",
                filterSoon: "Päättyy pian",
                filterUnclaimed: "Lunastamatta",
                filterQuick: "Taso ≤ 1 t",
                filterBarHint: "Suodattaa vain aktiiviset-välilehden. Useat suodattimet vaikuttavat yhdessä.",
                noResultsFiltered: "Mikään ei läpäise aktiivisia suodattimia.",
                clearFilters: "Poista suodattimet",
                negativeKeywordHint: "kirjoita -sana sulkeaksesi pois",
                sortLabel: "Järjestys:",
                sortUrgent: "Pian päättyvät ensin",
                sortCheapest: "Halvin ensin",
                sortCheapestHint: "Järjestää sen mukaan, mikä vaatii vähiten, jotta saat edes jotain. Kortin ⏱ on eri laskelma: mitä kaiken vieminen maksaa.",
                noInventoryData: "Ei inventaariota: ei tiedetä mitä omistat tai kuinka paljon olet katsonut.",
                urgentClosesIn: "päättyy",
                urgentNeed: "jäljellä",
                urgentNoTime: "aika ei riitä",
                claimedInventoryTitle: "Lunastettu"
            },
            vi: {
                addKeyword: "Thêm từ khóa",
                deleteKeywordTooltip: "Nhấp để xóa", deleteKeywordQuestion: "Xóa từ khóa ",
                editKeywords: "Sửa từ khóa", resetKeywords: "Khôi phục mặc định",
                confirmReset: "Khôi phục từ khóa mặc định?",
                keywordsRestored: "Từ khóa đã khôi phục. Đang tải lại...",
                keywordsModified: "Keywords modified. These are the current keywords: ",
                reloading: "Đang tải lại...", currentKeywords: "Từ khóa hiện tại (nhấp để xóa):",
                noResults: "Không tìm thấy drop nào khớp.",
                dropsActive: "Drop đang mở", dropsExpired: "Drop đã đóng",
                editPrompt: "Từ khóa phân cách bằng dấu phẩy:",
                reload: "Tải lại drop",
                hideExpired: "Hide expired/completed from inventory, automatic drops claiming",
                hideActive: "Hide active from inventory",
                removeInventory: "Click to remove from inventory, to show again press the reload drops button",
                changes_detected: "Changes detected", viewed: "Shown",
                markAllAsViewed: "Mark all as viewed",
                accept: "Chấp nhận", cancel: "Hủy", yes: "Có", no: "Không",
                addButton: "+", viewIcon: "👁️", changedIcon: "🔔", removeIcon: "❌",
                shareCopy: "Sao chép để chia sẻ",
                shareCopied: "Đã sao chép",
                scriptInfoTitle: "Thông tin script", scriptInfoName: "Tên:",
                scriptInfoVersion: "Phiên bản:", scriptInfoDescription: "Mô tả:",
                scriptInfoDescriptionText: "Highlights the drop campaigns matching your keywords on the page itself: purple for open, red for closed. The panel lists them split into active and expired, with the date window, the keyword that matched and each reward with the hours it needs. It fills from Twitch's own API, so it works the same in the inventory without pulling you over to campaigns, and while the answer is on its way it stays quiet instead of reporting a zero it does not know yet. Rewards you already own are ticked and struck through one by one, and a badge with nothing left to earn drops the watch time it asked for. What you already earned but have not collected is flagged apart with 🎁 —not dimmed— because it only needs a click, and the closing warning counts those too. What is about to close comes first: when a reward you do not own yet runs out of time within 72 hours, its card says how long is left and how much watch time you still need —red under 24 hours— or that it no longer fits, and the same ⏳ lands on the campaign's card on the page. Keywords are editable: click one to delete it, + to add, edit them in bulk or reset to the defaults. A keyword starting with \"-\" excludes: \"-console\" drops the campaign even if another keyword had found it, and takes the highlight, the card and the alert with it. And four view filters trim the open list without touching anything else —what you still have left, what closes soon, what you already earned and have not collected, and what takes an hour or less—: they add up, they are remembered, and the tab says how many cards are showing out of how many there are. The open list is sorted by whatever closes first or by whatever asks the least time, your choice. And every open campaign carries, on its own card on the page, the time you still need to take everything that is left —its most expensive reward, because the watch time is per campaign—, so the cost is visible while scrolling. If the inventory never arrives —without it there is no telling what you own or how much you have watched— the panel says so instead of going quiet with its marks switched off. In the inventory you can see a drop's details (progress and time remaining), dismiss entries with the ✕ —\"Reload drops\" brings them back— and tick a checkbox that hides expired/completed and turns on automatic claiming. A 🔗 on every open campaign copies its name, its dates, every reward with what it asks and a link that opens it on Twitch: text and not an image, so it stays searchable and the link stays clickable. It flags campaigns that changed since you last looked with a 🔔 —in the panel and on the card itself— plus a pending count, a desktop notification and an 👁️ button that also takes you to the campaign. 16 languages.",
                scriptInfoAuthor: "Tác giả:", scriptInfoGitHub: "GitHub:",
                readingApiDrops: "Reading drop changes from GQL/API...",
                timeRemaining: "Time remaining",
                progress: "Progress",
                rewards: "Rewards",
                minutesShort: "min",
                dropDetails: "Drop details",
                earnedUnclaimed: "đã đạt, chưa nhận",
                urgentUnclaimed: "chưa nhận",
                filterPending: "Còn dang dở",
                filterSoon: "Sắp kết thúc",
                filterUnclaimed: "Chưa nhận",
                filterQuick: "Mốc ≤ 1 giờ",
                filterBarHint: "Chỉ lọc thẻ đang hoạt động. Nhiều bộ lọc cộng dồn với nhau.",
                noResultsFiltered: "Không có gì qua được các bộ lọc đang bật.",
                clearFilters: "Bỏ bộ lọc",
                negativeKeywordHint: "gõ -từ để loại trừ",
                sortLabel: "Sắp xếp:",
                sortUrgent: "Sắp kết thúc trước",
                sortCheapest: "Rẻ nhất trước",
                sortCheapestHint: "Sắp xếp theo thứ đòi hỏi ít nhất để lấy được một thứ gì đó. ⏱ trên thẻ là con số khác: chi phí để lấy hết mọi thứ.",
                noInventoryData: "Không có kho đồ: không biết bạn đã có gì hay đã xem bao lâu.",
                urgentClosesIn: "kết thúc sau",
                urgentNeed: "còn thiếu",
                urgentNoTime: "không kịp",
                claimedInventoryTitle: "Đã nhận"
            },
            zh: {
                addKeyword: "添加关键词",
                deleteKeywordTooltip: "点击删除", deleteKeywordQuestion: "删除关键词 ",
                editKeywords: "编辑关键词", resetKeywords: "恢复默认",
                confirmReset: "恢复默认关键词？",
                keywordsRestored: "关键词已恢复。重新加载...",
                keywordsModified: "Keywords modified. These are the current keywords: ",
                reloading: "重新加载...", currentKeywords: "当前关键词（点击删除）：",
                noResults: "没有找到匹配的掉宝。",
                dropsActive: "活跃掉宝", dropsExpired: "已关闭掉宝",
                editPrompt: "逗号分隔的关键词：",
                reload: "重新加载掉宝",
                hideExpired: "Hide expired/completed from inventory, automatic drops claiming",
                hideActive: "Hide active from inventory",
                removeInventory: "Click to remove from inventory, to show again press the reload drops button",
                changes_detected: "Changes detected", viewed: "Shown",
                markAllAsViewed: "Mark all as viewed",
                accept: "接受", cancel: "取消", yes: "是", no: "否",
                addButton: "+", viewIcon: "👁️", changedIcon: "🔔", removeIcon: "❌",
                shareCopy: "复制以分享",
                shareCopied: "已复制",
                scriptInfoTitle: "脚本信息", scriptInfoName: "名称：",
                scriptInfoVersion: "版本：", scriptInfoDescription: "描述：",
                scriptInfoDescriptionText: "Highlights the drop campaigns matching your keywords on the page itself: purple for open, red for closed. The panel lists them split into active and expired, with the date window, the keyword that matched and each reward with the hours it needs. It fills from Twitch's own API, so it works the same in the inventory without pulling you over to campaigns, and while the answer is on its way it stays quiet instead of reporting a zero it does not know yet. Rewards you already own are ticked and struck through one by one, and a badge with nothing left to earn drops the watch time it asked for. What you already earned but have not collected is flagged apart with 🎁 —not dimmed— because it only needs a click, and the closing warning counts those too. What is about to close comes first: when a reward you do not own yet runs out of time within 72 hours, its card says how long is left and how much watch time you still need —red under 24 hours— or that it no longer fits, and the same ⏳ lands on the campaign's card on the page. Keywords are editable: click one to delete it, + to add, edit them in bulk or reset to the defaults. A keyword starting with \"-\" excludes: \"-console\" drops the campaign even if another keyword had found it, and takes the highlight, the card and the alert with it. And four view filters trim the open list without touching anything else —what you still have left, what closes soon, what you already earned and have not collected, and what takes an hour or less—: they add up, they are remembered, and the tab says how many cards are showing out of how many there are. The open list is sorted by whatever closes first or by whatever asks the least time, your choice. And every open campaign carries, on its own card on the page, the time you still need to take everything that is left —its most expensive reward, because the watch time is per campaign—, so the cost is visible while scrolling. If the inventory never arrives —without it there is no telling what you own or how much you have watched— the panel says so instead of going quiet with its marks switched off. In the inventory you can see a drop's details (progress and time remaining), dismiss entries with the ✕ —\"Reload drops\" brings them back— and tick a checkbox that hides expired/completed and turns on automatic claiming. A 🔗 on every open campaign copies its name, its dates, every reward with what it asks and a link that opens it on Twitch: text and not an image, so it stays searchable and the link stays clickable. It flags campaigns that changed since you last looked with a 🔔 —in the panel and on the card itself— plus a pending count, a desktop notification and an 👁️ button that also takes you to the campaign. 16 languages.",
                scriptInfoAuthor: "作者：", scriptInfoGitHub: "GitHub：",
                readingApiDrops: "Reading drop changes from GQL/API...",
                timeRemaining: "Time remaining",
                progress: "Progress",
                rewards: "Rewards",
                minutesShort: "min",
                dropDetails: "Drop details",
                earnedUnclaimed: "已达成，未领取",
                urgentUnclaimed: "未领取",
                filterPending: "还有未完成",
                filterSoon: "即将结束",
                filterUnclaimed: "未领取",
                filterQuick: "档位 ≤ 1 小时",
                filterBarHint: "仅筛选“进行中”标签页。多个筛选条件同时生效。",
                noResultsFiltered: "没有内容符合当前筛选条件。",
                clearFilters: "清除筛选",
                negativeKeywordHint: "输入 -词 可排除",
                sortLabel: "排序:",
                sortUrgent: "即将结束优先",
                sortCheapest: "最省时优先",
                sortCheapestHint: "按最快能拿到一样奖励的顺序排列。卡片上的⏱是另一笔账：拿走全部所需的时间。",
                noInventoryData: "无库存数据：不清楚你已拥有什么、看了多久。",
                urgentClosesIn: "距结束",
                urgentNeed: "还需",
                urgentNoTime: "时间不够",
                claimedInventoryTitle: "已领取"
            },
            ar: {
                addKeyword: "إضافة كلمة مفتاحية",
                deleteKeywordTooltip: "انقر للحذف", deleteKeywordQuestion: "حذف الكلمة المفتاحية ",
                editKeywords: "تعديل الكلمات المفتاحية", resetKeywords: "استعادة الافتراضية",
                confirmReset: "استعادة الكلمات المفتاحية الافتراضية؟",
                keywordsRestored: "تم استعادة الكلمات المفتاحية. إعادة التحميل...",
                keywordsModified: "Keywords modified. These are the current keywords: ",
                reloading: "إعادة التحميل...", currentKeywords: "الكلمات المفتاحية الحالية (انقر للحذف):",
                noResults: "لم يتم العثور على نتائج.",
                dropsActive: "دروبات نشطة", dropsExpired: "دروبات مغلقة",
                editPrompt: "كلمات مفتاحية مفصولة بفواصل:",
                reload: "إعادة تحميل الدروبات",
                hideExpired: "Hide expired/completed from inventory, automatic drops claiming",
                hideActive: "Hide active from inventory",
                removeInventory: "Click to remove from inventory, to show again press the reload drops button",
                changes_detected: "Changes detected", viewed: "Shown",
                markAllAsViewed: "Mark all as viewed",
                accept: "قبول", cancel: "إلغاء", yes: "نعم", no: "لا",
                addButton: "+", viewIcon: "👁️", changedIcon: "🔔", removeIcon: "❌",
                shareCopy: "انسخ للمشاركة",
                shareCopied: "تم النسخ",
                scriptInfoTitle: "معلومات السكربت", scriptInfoName: "الاسم:",
                scriptInfoVersion: "الإصدار:", scriptInfoDescription: "الوصف:",
                scriptInfoDescriptionText: "Highlights the drop campaigns matching your keywords on the page itself: purple for open, red for closed. The panel lists them split into active and expired, with the date window, the keyword that matched and each reward with the hours it needs. It fills from Twitch's own API, so it works the same in the inventory without pulling you over to campaigns, and while the answer is on its way it stays quiet instead of reporting a zero it does not know yet. Rewards you already own are ticked and struck through one by one, and a badge with nothing left to earn drops the watch time it asked for. What you already earned but have not collected is flagged apart with 🎁 —not dimmed— because it only needs a click, and the closing warning counts those too. What is about to close comes first: when a reward you do not own yet runs out of time within 72 hours, its card says how long is left and how much watch time you still need —red under 24 hours— or that it no longer fits, and the same ⏳ lands on the campaign's card on the page. Keywords are editable: click one to delete it, + to add, edit them in bulk or reset to the defaults. A keyword starting with \"-\" excludes: \"-console\" drops the campaign even if another keyword had found it, and takes the highlight, the card and the alert with it. And four view filters trim the open list without touching anything else —what you still have left, what closes soon, what you already earned and have not collected, and what takes an hour or less—: they add up, they are remembered, and the tab says how many cards are showing out of how many there are. The open list is sorted by whatever closes first or by whatever asks the least time, your choice. And every open campaign carries, on its own card on the page, the time you still need to take everything that is left —its most expensive reward, because the watch time is per campaign—, so the cost is visible while scrolling. If the inventory never arrives —without it there is no telling what you own or how much you have watched— the panel says so instead of going quiet with its marks switched off. In the inventory you can see a drop's details (progress and time remaining), dismiss entries with the ✕ —\"Reload drops\" brings them back— and tick a checkbox that hides expired/completed and turns on automatic claiming. A 🔗 on every open campaign copies its name, its dates, every reward with what it asks and a link that opens it on Twitch: text and not an image, so it stays searchable and the link stays clickable. It flags campaigns that changed since you last looked with a 🔔 —in the panel and on the card itself— plus a pending count, a desktop notification and an 👁️ button that also takes you to the campaign. 16 languages.",
                scriptInfoAuthor: "المؤلف:", scriptInfoGitHub: "GitHub:",
                readingApiDrops: "Reading drop changes from GQL/API...",
                timeRemaining: "Time remaining",
                progress: "Progress",
                rewards: "Rewards",
                minutesShort: "min",
                dropDetails: "Drop details",
                earnedUnclaimed: "تم كسبه ولم تتم المطالبة به",
                urgentUnclaimed: "دون مطالبة",
                filterPending: "متبقٍ شيء",
                filterSoon: "ينتهي قريبًا",
                filterUnclaimed: "دون مطالبة",
                filterQuick: "مستوى ≤ ساعة",
                filterBarHint: "يصفّي تبويب النشط فقط. تُطبَّق عدة مرشحات معًا.",
                noResultsFiltered: "لا شيء يجتاز المرشحات المفعّلة.",
                clearFilters: "إزالة المرشحات",
                negativeKeywordHint: "اكتب -كلمة للاستبعاد",
                sortLabel: "الترتيب:",
                sortUrgent: "الأقرب انتهاءً أولاً",
                sortCheapest: "الأقل وقتًا أولاً",
                sortCheapestHint: "يرتّب حسب الأقل طلبًا للحصول على شيء ما. الرمز ⏱ على البطاقة حساب آخر: ما يكلّفه أخذ كل شيء.",
                noInventoryData: "لا يوجد مخزون: لا يُعرف ما لديك ولا كم شاهدت.",
                urgentClosesIn: "ينتهي خلال",
                urgentNeed: "يتبقى",
                urgentNoTime: "الوقت لا يكفي",
                claimedInventoryTitle: "تم المطالبة"
            },
            hi: {
                addKeyword: "कीवर्ड जोड़ें",
                deleteKeywordTooltip: "हटाने के लिए क्लिक करें", deleteKeywordQuestion: "कीवर्ड हटाएं ",
                editKeywords: "कीवर्ड संपादित करें", resetKeywords: "डिफ़ॉल्ट पर रीसेट करें",
                confirmReset: "कीवर्ड को डिफ़ॉल्ट पर रीसेट करें?",
                keywordsRestored: "कीवर्ड बहाल। पुनः लोड हो रहा है...",
                keywordsModified: "Keywords modified. These are the current keywords: ",
                reloading: "पुनः लोड हो रहा है...", currentKeywords: "वर्तमान कीवर्ड (हटाने के लिए क्लिक करें):",
                noResults: "कोई ड्रॉप नहीं मिला।",
                dropsActive: "सक्रिय ड्रॉप", dropsExpired: "बंद ड्रॉप",
                editPrompt: "अल्पविराम से अलग कीवर्ड:",
                reload: "ड्रॉप पुनः लोड करें",
                hideExpired: "Hide expired/completed from inventory, automatic drops claiming",
                hideActive: "Hide active from inventory",
                removeInventory: "Click to remove from inventory, to show again press the reload drops button",
                changes_detected: "Changes detected", viewed: "Shown",
                markAllAsViewed: "Mark all as viewed",
                accept: "स्वीकार करें", cancel: "रद्द करें", yes: "हां", no: "नहीं",
                addButton: "+", viewIcon: "👁️", changedIcon: "🔔", removeIcon: "❌",
                shareCopy: "साझा करने के लिए कॉपी करें",
                shareCopied: "कॉपी हो गया",
                scriptInfoTitle: "स्क्रिप्ट जानकारी", scriptInfoName: "नाम:",
                scriptInfoVersion: "संस्करण:", scriptInfoDescription: "विवरण:",
                scriptInfoDescriptionText: "Highlights the drop campaigns matching your keywords on the page itself: purple for open, red for closed. The panel lists them split into active and expired, with the date window, the keyword that matched and each reward with the hours it needs. It fills from Twitch's own API, so it works the same in the inventory without pulling you over to campaigns, and while the answer is on its way it stays quiet instead of reporting a zero it does not know yet. Rewards you already own are ticked and struck through one by one, and a badge with nothing left to earn drops the watch time it asked for. What you already earned but have not collected is flagged apart with 🎁 —not dimmed— because it only needs a click, and the closing warning counts those too. What is about to close comes first: when a reward you do not own yet runs out of time within 72 hours, its card says how long is left and how much watch time you still need —red under 24 hours— or that it no longer fits, and the same ⏳ lands on the campaign's card on the page. Keywords are editable: click one to delete it, + to add, edit them in bulk or reset to the defaults. A keyword starting with \"-\" excludes: \"-console\" drops the campaign even if another keyword had found it, and takes the highlight, the card and the alert with it. And four view filters trim the open list without touching anything else —what you still have left, what closes soon, what you already earned and have not collected, and what takes an hour or less—: they add up, they are remembered, and the tab says how many cards are showing out of how many there are. The open list is sorted by whatever closes first or by whatever asks the least time, your choice. And every open campaign carries, on its own card on the page, the time you still need to take everything that is left —its most expensive reward, because the watch time is per campaign—, so the cost is visible while scrolling. If the inventory never arrives —without it there is no telling what you own or how much you have watched— the panel says so instead of going quiet with its marks switched off. In the inventory you can see a drop's details (progress and time remaining), dismiss entries with the ✕ —\"Reload drops\" brings them back— and tick a checkbox that hides expired/completed and turns on automatic claiming. A 🔗 on every open campaign copies its name, its dates, every reward with what it asks and a link that opens it on Twitch: text and not an image, so it stays searchable and the link stays clickable. It flags campaigns that changed since you last looked with a 🔔 —in the panel and on the card itself— plus a pending count, a desktop notification and an 👁️ button that also takes you to the campaign. 16 languages.",
                scriptInfoAuthor: "लेखक:", scriptInfoGitHub: "GitHub:",
                readingApiDrops: "Reading drop changes from GQL/API...",
                timeRemaining: "Time remaining",
                progress: "Progress",
                rewards: "Rewards",
                minutesShort: "min",
                dropDetails: "Drop details",
                earnedUnclaimed: "अर्जित, दावा बाकी",
                urgentUnclaimed: "दावा बाकी",
                filterPending: "कुछ बाकी है",
                filterSoon: "जल्द बंद",
                filterUnclaimed: "दावा बाकी",
                filterQuick: "स्तर ≤ 1 घं.",
                filterBarHint: "सिर्फ़ सक्रिय टैब को छानता है। कई फ़िल्टर एक साथ लगते हैं।",
                noResultsFiltered: "सक्रिय फ़िल्टर से कुछ भी मेल नहीं खाता।",
                clearFilters: "फ़िल्टर हटाएँ",
                negativeKeywordHint: "बाहर रखने के लिए -शब्द लिखें",
                sortLabel: "क्रम:",
                sortUrgent: "पहले बंद होने वाले",
                sortCheapest: "पहले सबसे सस्ते",
                sortCheapestHint: "कुछ भी पाने के लिए जो सबसे कम माँगता है, उसके हिसाब से क्रम लगाता है। कार्ड का ⏱ अलग हिसाब है: सब कुछ लेने में कितना लगता है।",
                noInventoryData: "इन्वेंट्री नहीं: पता नहीं आपके पास क्या है और कितना देखा है।",
                urgentClosesIn: "समाप्त होने में",
                urgentNeed: "बाकी",
                urgentNoTime: "समय कम है",
                claimedInventoryTitle: "दावा किया गया"
            },
            id: {
                addKeyword: "Tambah Kata Kunci",
                deleteKeywordTooltip: "Klik untuk menghapus", deleteKeywordQuestion: "Hapus kata kunci ",
                editKeywords: "Edit Kata Kunci", resetKeywords: "Kembalikan Default",
                confirmReset: "Kembalikan kata kunci default?",
                keywordsRestored: "Kata kunci dikembalikan. Memuat ulang...",
                keywordsModified: "Keywords modified. These are the current keywords: ",
                reloading: "Memuat ulang...", currentKeywords: "Kata kunci saat ini (klik untuk menghapus):",
                noResults: "Tidak ada drop yang cocok.",
                dropsActive: "Drop Terbuka", dropsExpired: "Drop Tertutup",
                editPrompt: "Kata kunci dipisahkan koma:",
                reload: "Muat ulang drop",
                hideExpired: "Hide expired/completed from inventory, automatic drops claiming",
                hideActive: "Hide active from inventory",
                removeInventory: "Click to remove from inventory, to show again press the reload drops button",
                changes_detected: "Changes detected", viewed: "Shown",
                markAllAsViewed: "Mark all as viewed",
                accept: "Terima", cancel: "Batal", yes: "Ya", no: "Tidak",
                addButton: "+", viewIcon: "👁️", changedIcon: "🔔", removeIcon: "❌",
                shareCopy: "Salin untuk dibagikan",
                shareCopied: "Disalin",
                scriptInfoTitle: "Informasi Script", scriptInfoName: "Nama:",
                scriptInfoVersion: "Versi:", scriptInfoDescription: "Deskripsi:",
                scriptInfoDescriptionText: "Highlights the drop campaigns matching your keywords on the page itself: purple for open, red for closed. The panel lists them split into active and expired, with the date window, the keyword that matched and each reward with the hours it needs. It fills from Twitch's own API, so it works the same in the inventory without pulling you over to campaigns, and while the answer is on its way it stays quiet instead of reporting a zero it does not know yet. Rewards you already own are ticked and struck through one by one, and a badge with nothing left to earn drops the watch time it asked for. What you already earned but have not collected is flagged apart with 🎁 —not dimmed— because it only needs a click, and the closing warning counts those too. What is about to close comes first: when a reward you do not own yet runs out of time within 72 hours, its card says how long is left and how much watch time you still need —red under 24 hours— or that it no longer fits, and the same ⏳ lands on the campaign's card on the page. Keywords are editable: click one to delete it, + to add, edit them in bulk or reset to the defaults. A keyword starting with \"-\" excludes: \"-console\" drops the campaign even if another keyword had found it, and takes the highlight, the card and the alert with it. And four view filters trim the open list without touching anything else —what you still have left, what closes soon, what you already earned and have not collected, and what takes an hour or less—: they add up, they are remembered, and the tab says how many cards are showing out of how many there are. The open list is sorted by whatever closes first or by whatever asks the least time, your choice. And every open campaign carries, on its own card on the page, the time you still need to take everything that is left —its most expensive reward, because the watch time is per campaign—, so the cost is visible while scrolling. If the inventory never arrives —without it there is no telling what you own or how much you have watched— the panel says so instead of going quiet with its marks switched off. In the inventory you can see a drop's details (progress and time remaining), dismiss entries with the ✕ —\"Reload drops\" brings them back— and tick a checkbox that hides expired/completed and turns on automatic claiming. A 🔗 on every open campaign copies its name, its dates, every reward with what it asks and a link that opens it on Twitch: text and not an image, so it stays searchable and the link stays clickable. It flags campaigns that changed since you last looked with a 🔔 —in the panel and on the card itself— plus a pending count, a desktop notification and an 👁️ button that also takes you to the campaign. 16 languages.",
                scriptInfoAuthor: "Penulis:", scriptInfoGitHub: "GitHub:",
                readingApiDrops: "Reading drop changes from GQL/API...",
                timeRemaining: "Time remaining",
                progress: "Progress",
                rewards: "Rewards",
                minutesShort: "min",
                dropDetails: "Drop details",
                earnedUnclaimed: "didapat, belum diklaim",
                urgentUnclaimed: "belum diklaim",
                filterPending: "Masih ada sisa",
                filterSoon: "Segera tutup",
                filterUnclaimed: "Belum diklaim",
                filterQuick: "Tingkat ≤ 1 jam",
                filterBarHint: "Hanya menyaring tab aktif. Beberapa filter berlaku bersamaan.",
                noResultsFiltered: "Tidak ada yang lolos filter aktif.",
                clearFilters: "Hapus filter",
                negativeKeywordHint: "ketik -kata untuk mengecualikan",
                sortLabel: "Urutan:",
                sortUrgent: "Yang tutup dulu",
                sortCheapest: "Yang termurah dulu",
                sortCheapestHint: "Mengurutkan berdasarkan yang paling sedikit dibutuhkan untuk mendapat sesuatu. ⏱ pada kartu adalah hitungan lain: biaya untuk mengambil semuanya.",
                noInventoryData: "Tanpa inventaris: tidak diketahui apa yang kamu punya atau berapa lama menonton.",
                urgentClosesIn: "berakhir dalam",
                urgentNeed: "kurang",
                urgentNoTime: "waktu tidak cukup",
                claimedInventoryTitle: "Diklaim"
            }
        };
        const t = i18n[lang] || i18n["en"];

        // =============================================
        // CONSTANTES Y CONFIGURACION
        // =============================================

        const DEFAULT_KEYWORDS = [
            "halo", "doom", "quake", "wolfenstein", "rage", "fortnite",
            "rocket league", "among us", "minecraft", "roblox", "star wars", "marvel"
        ];

        const STORAGE_KEY = "twitch_drop_keywords";
        const SHOW_HIDE_INVENTORY_EXPIRED = "twitch_show_hide_inventory_expired";
        const SHOW_HIDE_INVENTORY_ACTIVE = "twitch_show_hide_inventory_active";
        const COLLAPSE_KEY = "twitch_drops_collapse_preview";
        const INVENTORY_DELETED_KEYS = "twitch_inventory_deleted_drops";
        const STORAGE_NOTIFS = "twitch_drop_notifications";
        const VIEW_FILTERS_KEY = "twitch_drops_view_filters";
        const SORT_MODE_KEY = "twitch_drops_sort_mode";
        const FOCUS_TARGET_KEY = "twitch_drops_focus_target";

        // Filtros de vista. El orden es el de la barra: de lo mas general a lo mas
        // concreto.
        const VIEW_FILTER_IDS = ['pending', 'soon', 'unclaimed', 'quick'];

        // "Un rato corto": el tramo que se saca en una sesion sin planificarla.
        const QUICK_MAX_MINUTES = 60;

        // Orden de la pestaña de abiertos. 'urgent' es el de siempre y sigue siendo
        // el de por defecto: la fecha de cierre es la unica que se pierde sola.
        const SORT_MODES = ['urgent', 'cheapest'];

        // Antes de avisar de que falta el inventario se esperan unos segundos: al
        // arrancar el dato aun no ha llegado y eso no es un fallo, es una carrera.
        const INVENTORY_WARN_DELAY_MS = 8000;

        const ORIGINAL_TITLE = document.title || (document.querySelector('title') ? document.querySelector('title').textContent : '');

        const NOTIFICATION_BEEP_INTERVAL_MS = 5000;
        const NOTIFICATION_VOLUME = 0.75;

        const NOTIFICATION_SVG_PATH = 'M5 3h14l3 6v12H2V9l3-6Zm-.264 5 1.5-3h11.528l1.5 3H15v3a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V8H4.736ZM4 10v9h16v-9h-3v1a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3v-1H4Z';

        const CLOSED_HEADER_TEXTS = [
            "Campañas con drops cerradas",
            "Campañas de drops cerradas",
            "Closed Drop Campaigns",
            "Lukkede rovkampagner",
            "Beendete Drop-Kampagnen",
            "Campagnes de drops fermées",
            "Campagne Drop chiuse",
            "Lezárt dropkampányok",
            "Gesloten dropcampagnes",
            "Lukkede droppkampanjer",
            "Zamknięte kampanie z dropami",
            "Campanhas de drops encerradas",
            "Campanii de dropuri închise",
            "Zatvorené kampane s dropmi",
            "Suljetut droppikampanjat",
            "Stängda dropkampanjer",
            "Các chiến dịch quà tặng đã đóng",
            "Kapalı drop kampanyaları",
            "Zavřené kampaně s Drops",
            "Κλειστές καμπάνιες Drop",
            "Затворени кампании за Drop",
            "Закрытые кампании Drop",
            "แคมเปญ Drops ที่ปิดแล้ว",
            "حملات Drop المغلقة",
            "已关闭的掉宝活动",
            "已結束的掉寶活動",
            "Dropsキャンペーンを閉じる",
            "종료된 드롭 캠페인"
        ];

        const CLOSED_DROP_TEXTS = [
            "Esta campaña está cerrada.",
            "Esta campaña se ha cerrado.",
            "This campaign has closed.",
            "Denne kampagne er lukket.",
            "Diese Kampagne wurde beendet.",
            "Cette campagne est fermée.",
            "La campagna è chiusa.",
            "A kampány lezárult.",
            "Deze campagne is gesloten.",
            "Denne kampanjen er avsluttet.",
            "Ta kampania została zamknięta.",
            "Esta campanha está encerrada.",
            "Esta campanha foi encerrada.",
            "Această campanie s-a terminat.",
            "Táto kampaň je uzavretá.",
            "Tämä kampanja on suljettu.",
            "Den här kampanjen har stängts.",
            "Chiến dịch này đã đóng.",
            "Bu kampanya kapanmış.",
            "Tato kampaň je uzavřená.",
            "Η καμπάνια έχει κλείσει.",
            "Тази кампания приключи.",
            "Эта кампания закрыта.",
            "แคมเปญนี้ปิดลงแล้ว",
            "تم إغلاق هذه الحملة.",
            "此活动已关闭。",
            "活動已結束。",
            "このキャンペーンは終了しています。",
            "종료된 캠페인입니다."
        ];

        const ACTIVE_STYLE = `border: 4px solid #772ce8 !important; box-shadow: 0 0 30px #9147ff !important; border-radius: 16px !important; scroll-margin-top: 100px;`;
        const EXPIRED_STYLE = `border: 4px solid #971311 !important; box-shadow: 0 0 30px #ff8280 !important; border-radius: 16px !important; scroll-margin-top: 100px;`;

        const DEBUG_SNAPSHOTS = false;

        // Detect Twitch light/dark theme
        function isDarkTheme() {
            const body = document.body || document.documentElement;
            const bg = getComputedStyle(body).getPropertyValue('--color-background-body').trim();
            if (bg) {
                // Twitch dark bg is typically #0e0e10 or similar dark color
                const hex = bg.replace('#', '');
                if (hex.length === 6) {
                    const r = parseInt(hex.substring(0, 2), 16);
                    const g = parseInt(hex.substring(2, 4), 16);
                    const b = parseInt(hex.substring(4, 6), 16);
                    return (r + g + b) / 3 < 128;
                }
            }
            // Fallback: check if body has dark class or dark data attribute
            const classList = (body.className || '').toLowerCase();
            const html = document.documentElement;
            const theme = html.getAttribute('data-color-theme') || html.getAttribute('data-theme') || '';
            if (theme.includes('light')) return false;
            if (theme.includes('dark')) return true;
            if (classList.includes('dark')) return true;
            // Default to dark (most Twitch users use dark mode)
            return true;
        }

        let _isDark = isDarkTheme();

        // Twitch purple colors — adapt to light/dark theme
        let colors = _isDark ? {
            purple: "#9147ff",
            purpleLight: "#bf94ff",
            purpleDark: "#772ce8",
            green: "#00c274",
            red: "#ff4d4d",
            gray: "#adadb8",
            orange: "#ff9900",
            bg: "#0e0e10",
            text: "#efeff1",
            surface: "#18181b",
            border: "#2f2f35"
        } : {
            purple: "#9147ff",
            purpleLight: "#6441a5",
            purpleDark: "#772ce8",
            green: "#00a67e",
            red: "#d92f2f",
            gray: "#53535f",
            orange: "#cc7a00",
            bg: "#ffffff",
            text: "#0e0e10",
            surface: "#f7f7f8",
            border: "#dad8de"
        };

        // =============================================
        // FUNCIONES DE ALMACENAMIENTO / PERSISTENCIA
        // =============================================

        function getStoredKeywords() {
            const stored = GM_getValue(STORAGE_KEY, null);
            if (stored) {
                try { return JSON.parse(stored); } catch (e) { return DEFAULT_KEYWORDS.slice(); }
            }
            return DEFAULT_KEYWORDS.slice();
        }

        function setStoredKeywords(keywords) {
            GM_setValue(STORAGE_KEY, JSON.stringify(keywords));
        }

        function resetKeywords() {
            GM_setValue(STORAGE_KEY, JSON.stringify(DEFAULT_KEYWORDS.slice()));
        }

        // ---------------------------------------------
        // Keywords positivas y negativas
        // ---------------------------------------------
        // Las negativas viven en la MISMA lista, con un `-` delante, para que se
        // editen, se borren y se guarden por los caminos que ya existen: chips,
        // edicion en bloque, reinicio. Se separan al usarlas, nunca al guardarlas,
        // asi que el almacenamiento sigue siendo un array de cadenas y una version
        // vieja del script leeria "-fortnite" como una keyword que no casa con
        // nada, que es el fallo inofensivo.
        function _splitKeywords(list) {
            const positive = [];
            const negative = [];
            for (const raw of (list || [])) {
                const k = String(raw || '').trim().toLowerCase();
                if (!k) continue;
                if (k.startsWith('-')) {
                    const body = k.slice(1).trim();
                    if (body) negative.push(body);
                } else {
                    positive.push(k);
                }
            }
            return { positive, negative };
        }

        // Casa si toca al menos una positiva Y ninguna negativa. La negativa manda
        // sobre la positiva a proposito: "minecraft" pero no "minecraft dungeons"
        // solo tiene sentido si lo segundo gana.
        function _matchesKeywords(searchText) {
            const { positive, negative } = _splitKeywords(keywords);
            if (negative.some(k => searchText.includes(k))) return false;
            return positive.some(k => searchText.includes(k));
        }

        // Las que se enseñan en la tarjeta: solo positivas, porque son las que
        // explican POR QUE aparece la campaña.
        function _matchedPositiveKeywords(searchText) {
            return _splitKeywords(keywords).positive.filter(k => searchText.includes(k));
        }

        // ---------------------------------------------
        // Filtros de vista
        // ---------------------------------------------
        // Se validan contra la lista conocida al leer: un id que ya no exista —o
        // basura en el almacenamiento— se descarta, en vez de esconder tarjetas
        // por una regla que ya nadie implementa.
        function getViewFilters() {
            const stored = GM_getValue(VIEW_FILTERS_KEY, null);
            if (!stored) return [];
            try {
                const list = JSON.parse(stored);
                if (!Array.isArray(list)) return [];
                return list.filter(id => VIEW_FILTER_IDS.includes(id));
            } catch (e) {
                return [];
            }
        }

        function setViewFilters(list) {
            const clean = (list || []).filter(id => VIEW_FILTER_IDS.includes(id));
            GM_setValue(VIEW_FILTERS_KEY, JSON.stringify(clean));
        }

        // Mismo criterio que los filtros: un valor desconocido cae al de por
        // defecto en vez de dejar la lista en un orden que nadie implementa.
        function getSortMode() {
            const v = GM_getValue(SORT_MODE_KEY, null);
            return SORT_MODES.includes(v) ? v : 'urgent';
        }

        function setSortMode(mode) {
            GM_setValue(SORT_MODE_KEY, SORT_MODES.includes(mode) ? mode : 'urgent');
        }

        // ---------------------------------------------
        // Poda del almacenamiento local
        // ---------------------------------------------
        // Ni el historial de notificaciones ni la lista de inventario descartado
        // tenian tope. Una campaña que expiraba dejaba su entrada para siempre
        // (el chequeo de cambios solo hace "continue" cuando ya no quedan drops),
        // y las claves descartadas solo se borraban con los botones de reinicio.
        // Ahora se acotan al leer y al escribir, asi que el limite se aplica siempre.
        // Y es lo UNICO que las acota sin que tu lo pidas: antes habia ademas un
        // vaciado por cambio de @version —de golpe, y solo si habia release—, que se
        // quito por borrar avisos sin verlos. A mano sigue estando «Recargar drops».

        // Una campaña de drops dura semanas: a los 60 dias sin actualizarse la
        // entrada ya no describe nada vivo, este vista o no.
        const NOTIF_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;
        const NOTIF_MAX_ENTRIES = 200;
        const DELETED_KEYS_MAX = 500;

        function _notifTs(n) {
            return Number(n && (n.updatedAt || n.createdAt)) || 0;
        }

        function pruneNotifications(notifs) {
            if (!Array.isArray(notifs)) return [];
            const now = Date.now();
            let out = notifs.filter(n => {
                const ts = _notifTs(n);
                // Sin marca de tiempo utilizable no se puede juzgar la edad: se
                // conserva, y del volumen ya se encarga el tope por cantidad.
                return ts === 0 || now - ts < NOTIF_MAX_AGE_MS;
            });
            if (out.length > NOTIF_MAX_ENTRIES) {
                // Conservar las mas recientes SIN reordenar la lista: la pestaña de
                // notificaciones la pinta en el orden en que esta guardada.
                const keep = new Set(
                    out.slice().sort((a, b) => _notifTs(b) - _notifTs(a)).slice(0, NOTIF_MAX_ENTRIES)
                );
                out = out.filter(n => keep.has(n));
            }
            return out;
        }

        // Las claves se añaden con push, asi que las mas recientes quedan al final
        // y el recorte va por la cabeza. Se deduplica ademas de acotar, porque la
        // ruta de descarte del inventario no comprueba si la clave ya estaba.
        function pruneDeletedKeys(keys) {
            if (!Array.isArray(keys)) return [];
            const unique = [...new Set(keys)];
            return unique.length > DELETED_KEYS_MAX ? unique.slice(-DELETED_KEYS_MAX) : unique;
        }

        function getInventoryDeletedKeys() {
            const stored = GM_getValue(INVENTORY_DELETED_KEYS, null);
            if (stored) {
                try { return pruneDeletedKeys(JSON.parse(stored)); } catch (e) { return []; }
            }
            return [];
        }

        function setInventoryDeletedKeys(keys) {
            GM_setValue(INVENTORY_DELETED_KEYS, JSON.stringify(pruneDeletedKeys(keys)));
        }

        function resetInventoryDeletedKeys() {
            GM_setValue(INVENTORY_DELETED_KEYS, JSON.stringify([]));
        }

        function getNotifications() {
            const stored = GM_getValue(STORAGE_NOTIFS, null);
            if (stored) {
                try { return pruneNotifications(JSON.parse(stored)); } catch (e) { return []; }
            }
            return [];
        }

        function saveNotifications(notifs) {
            GM_setValue(STORAGE_NOTIFS, JSON.stringify(pruneNotifications(notifs)));
        }

        function resetNotifications() {
            GM_setValue(STORAGE_NOTIFS, JSON.stringify([]));
        }

        // =============================================
        // GQL CLIENT + DROPS FETCHING
        // =============================================

        // In-memory map: gameName -> [{name, rewards, minutes}]
        const _apiDropNames = {};
        // Las campañas YA CERRADAS, en su propio mapa y sin sus tramos. Aparte de
        // _apiDropNames por dos motivos:
        //   · _apiDropNames es de donde salen la urgencia, el coste y los badges de
        //     reclamado, y todo eso se pregunta por titulo (_findEntryForTitle). Meter
        //     ahi una campaña cerrada del mismo juego que una abierta fundiria las dos
        //     entradas y sus tramos vencidos pasarian a contar como pendientes: un
        //     "te faltan 10 h" de algo que ya no se puede ganar.
        //   · la solapa de Cerrados no pinta tramos —renderCampaignCard solo los añade
        //     si isActive—, asi que pedir DropCampaignDetails de cada campaña cerrada,
        //     que es UNA CONSULTA POR CAMPAÑA, seria pagar por un dato que nadie mira.
        const _apiClosedCampaigns = {};
        // Que valores de `status` devolvio Twitch y cuantas veces. Se vuelca en consola
        // al final del fetch; ver el porque alli.
        const _apiStatusSeen = {};
        let _apiDataReady = false;

        // Wait for GQL state (captured in memory by the fetch interceptor)
        function _waitForGqlState(timeout = 20000) {
            const start = Date.now();
            return new Promise((resolve, reject) => {
                const interval = setInterval(() => {
                    if (_gqlState.token && _gqlState.integrity) {
                        clearInterval(interval);
                        resolve({ ..._gqlState });
                        return;
                    }
                    if (Date.now() - start > timeout) {
                        clearInterval(interval);
                        reject('GQL state timeout');
                    }
                }, 500);
            });
        }

        // GQL request helper
        async function _gqlRequest(body) {
            const s = await _waitForGqlState();
            const res = await fetch("https://gql.twitch.tv/gql", {
                method: "POST",
                headers: {
                    "accept": "*/*",
                    "authorization": `OAuth ${s.token}`,
                    "client-id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
                    "client-integrity": s.integrity,
                    "client-session-id": s.sessionId,
                    "client-version": s.clientVersion,
                    "content-type": "text/plain;charset=UTF-8",
                    "x-device-id": s.deviceId
                },
                body: JSON.stringify(body)
            });
            return res.json();
        }

        // Get all drop campaigns + reward campaigns
        async function _gqlGetCampaigns() {
            const body = [{
                operationName: "ViewerDropsDashboard",
                variables: { fetchRewardCampaigns: true },
                extensions: { persistedQuery: { version: 1, sha256Hash: "5a4da2ab3d5b47c9f9ce864e727b2cb346af1e3ea8b897fe8f704a97ff017619" } }
            }];
            const res = await _gqlRequest(body);
            const data = res?.[0]?.data;
            return {
                dropCampaigns: data?.currentUser?.dropCampaigns ?? [],
                rewardCampaigns: data?.rewardCampaignsAvailableToUser ?? []
            };
        }

        // Get campaign details (timeBasedDrops)
        async function _gqlGetCampaignDetails(dropID, channelLogin) {
            const body = [{
                operationName: "DropCampaignDetails",
                variables: { dropID, channelLogin },
                extensions: { persistedQuery: { version: 1, sha256Hash: "039277bf98f3130929262cc7c6efd9c141ca3749cb6dca442fc8ead9a53f77c1" } }
            }];
            const res = await _gqlRequest(body);
            return res?.[0]?.data ?? null;
        }

        // Get user inventory (drops in progress with currentMinutesWatched)
        //
        // DOS hashes a proposito. `Inventory` es una persisted query: el hash identifica
        // una VERSION concreta de la consulta, con los campos que pedia entonces. El
        // viejo seguia respondiendo, asi que nada fallaba y nada avisaba —pero devolvia
        // `earnedDropRewards` VACIO, que es justo donde Twitch apunta lo concedido, y de
        // ahi venia que los emotes no se marcaran nunca—. El nuevo es el que usa hoy la
        // propia pagina del inventario, cazado en su trafico el 2026-08-07.
        //
        // El viejo se queda de respaldo porque el nuevo caducara a su vez: los hashes
        // rotan con cada cambio del cliente de Twitch, y quedarse sin inventario es
        // peor que quedarse sin `earnedDropRewards` —sin el no se sabe ni lo reclamado
        // ni lo visto—.
        const INVENTORY_HASHES = [
            "e7197a7e03be13e423118005966d097a2f44045b3642bfdb70820e01c8129fd6",
            "d86775d0ef16a63a33ad52e80eaff963b2d5b72fada7c991504a57496e1d8e4b"
        ];

        async function _gqlGetInventory() {
            for (const hash of INVENTORY_HASHES) {
                const body = [{
                    operationName: "Inventory",
                    variables: { fetchRewardCampaigns: true },
                    extensions: { persistedQuery: { version: 1, sha256Hash: hash } }
                }];
                let res = null;
                try { res = await _gqlRequest(body); } catch (e) { continue; }
                const inv = res?.[0]?.data?.currentUser?.inventory;
                if (inv) {
                    if (hash !== INVENTORY_HASHES[0]) {
                        console.warn('[Inventory] el hash nuevo no respondio; se uso el de respaldo.'
                            + ' Sin earnedDropRewards no se marcan emotes ni emblemas.');
                    }
                    return inv;
                }
            }
            return null;
        }

        // La consulta vieja devolvia `gameEventDrops` como lista suelta y la nueva lo
        // envuelve en una connection. Se leen las dos formas para que cambiar de hash
        // —o caer al respaldo— no deje el indice de reclamados a medias.
        function _gameEventDropsOf(inv) {
            if (Array.isArray(inv?.gameEventDrops)) return inv.gameEventDrops;
            return (inv?.gameEventDropsConnection?.edges || []).map(e => e?.node).filter(Boolean);
        }

        // dropID -> { current, required, dropName, rewards: [], imageUrl }
        const _inventoryProgress = {};
        let _inventoryProgressReady = false;

        // Ids de lo ya reclamado. Son dos conjuntos porque hay dos formas de saberlo
        // y cubren casos distintos: `self.isClaimed` marca el tramo dentro de una
        // campaña que sigue EN CURSO, mientras que `gameEventDrops` es la lista de
        // recompensas ya concedidas, que sobrevive aunque la campaña deje de estar en
        // curso por haberla completado.
        let _claimedDropIds = new Set();
        let _claimedBenefitIds = new Set();
        // El mismo historial, pero con la campaña pegada: "campaignId|benefitId". Existe
        // porque un benefit.id se REUTILIZA entre ediciones de la misma campaña, asi que
        // el conjunto plano de arriba no distingue «ya lo tienes» de «tuviste el del año
        // pasado». Ver _isDropClaimed, que explica el caso con nombres y fechas.
        //
        // Solo lo alimenta `earnedDropRewards`, que es el unico que dice de que campaña
        // salio cada cosa; `gameEventDrops` llega sin campaña y no se puede acotar. No se
        // pierde nada: en el volcado del 2026-08-11 sus 18 ids estaban TODOS tambien en
        // earnedDropRewards, que es el historial completo. Sigue en el plano por si acaso.
        let _claimedBenefitsByCampaign = new Set();
        // Que los ids de campaña de earnedDropRewards son los MISMOS que los de las
        // campañas quedo comprobado el 2026-08-12 en la consola de este usuario (1 en
        // curso, 65 en el historial, casaron). Si no lo fueran, acotar no casaria nunca y
        // todo saldria sin reclamar: un falso negativo constante a cambio de un falso
        // positivo raro. Por eso se sigue vigilando, pero al reves de como estaba: se
        // acota por defecto y solo se desactiva con PRUEBAS de que no casan. Al reves
        // —exigir la prueba para activarlo— bastaba con no tener ninguna campaña en curso
        // para que el arreglo se apagara solo y sin avisar.
        let _campaignScopeUsable = true;
        let _claimedIndexReady = false;

        async function fetchInventoryProgress() {
            try {
                const inv = await _gqlGetInventory();
                const campaigns = inv?.dropCampaignsInProgress || [];
                const claimedDrops = new Set();
                const claimedBenefits = new Set();
                const claimedByCampaign = new Set();
                const campaignIdsInProgress = new Set();
                for (const c of campaigns) {
                    if (c?.id) campaignIdsInProgress.add(c.id);
                    for (const drop of (c.timeBasedDrops || [])) {
                        if (!drop?.id) continue;
                        const rewardEdges = drop.benefitEdges || [];
                        _inventoryProgress[drop.id] = {
                            current: drop.self?.currentMinutesWatched || 0,
                            required: drop.requiredMinutesWatched || 0,
                            dropName: drop.name || '',
                            rewards: rewardEdges.map(b => b.benefit?.name).filter(Boolean),
                            imageUrl: rewardEdges[0]?.benefit?.imageAssetURL || ''
                        };
                        if (drop.self?.isClaimed) claimedDrops.add(drop.id);
                    }
                }
                for (const g of _gameEventDropsOf(inv)) {
                    if (g?.id) claimedBenefits.add(g.id);
                }
                // La fuente que faltaba. `earnedDropRewards` es el historial de lo
                // concedido, y ahi SI constan los emotes y los emblemas: el nodo del
                // Bop2bop llego con `status: "CLAIMED"` sin que nadie lo reclamara,
                // porque para Twitch concederlo ES reclamarlo. Su `id` es el mismo
                // `benefit.id` que ya guardamos en benefitIds, asi que el cruce es
                // exacto y no hace falta ninguna heuristica.
                //
                // Verificado el 2026-08-07 con la campaña «8.08 Week» de Twitch Gaming:
                // el emote no aparecia en dropCampaignsInProgress —la campaña sale al
                // completarse— ni en gameEventDrops —que solo lleva lo que se reclama a
                // mano—, y aqui si, y sigue estando despues de borrar la notificacion.
                //
                // Solo CLAIMED: cualquier otro estado no es «lo tienes», y un estado
                // que no conozcamos no se presume a favor.
                //
                // Y cada nodo dice ADEMAS de que campaña salio, que es lo que permite no
                // confundir ediciones. Se indexa por las dos vias: plana para lo que no
                // sabe de que campaña es —el respaldo publico—, y acotada para lo demas.
                const campaignIdsEarned = new Set();
                for (const edge of (inv?.earnedDropRewards?.edges || [])) {
                    const n = edge?.node;
                    if (!n || n.status !== 'CLAIMED') continue;
                    const cid = n.campaign?.id || '';
                    if (cid) campaignIdsEarned.add(cid);
                    if (n.id) {
                        claimedBenefits.add(n.id);
                        if (cid) claimedByCampaign.add(cid + '|' + n.id);
                    }
                    if (n.item?.id) {
                        claimedBenefits.add(n.item.id);
                        if (cid) claimedByCampaign.add(cid + '|' + n.item.id);
                    }
                }
                // Las dos formas en que acotar dejaria de valer, y solo esas dos. No se
                // exige demostrar que SI vale —eso se apagaba solo en cuanto no tuvieras
                // ninguna campaña en curso, que es lo normal—, se exige demostrar que NO.
                let scopeUsable = true;
                let motivo = '';
                if (claimedBenefits.size > 0 && claimedByCampaign.size === 0) {
                    // El historial llego sin campaña por nodo: la consulta persistida
                    // habra cambiado de forma otra vez. Acotar dejaria todo sin marcar.
                    scopeUsable = false;
                    motivo = 'earnedDropRewards no trae campaign.id';
                } else if (campaignIdsInProgress.size > 0 && campaignIdsEarned.size > 0) {
                    let alguna = false;
                    for (const cid of campaignIdsInProgress) {
                        if (campaignIdsEarned.has(cid)) { alguna = true; break; }
                    }
                    // Con campañas en curso Y historial, que no coincida NINGUNA es la
                    // señal de que los dos lados hablan de espacios de id distintos.
                    if (!alguna) {
                        scopeUsable = false;
                        motivo = 'ningun id de campaña en comun con las que estan en curso';
                    }
                }
                // Se dice SIEMPRE en que modo quedo y por que, porque desde fuera los dos
                // modos se ven igual hasta que uno marca de mas o de menos.
                console.log('[Twitch Drops] indice de reclamados:',
                    scopeUsable ? 'acotado por campaña' : 'plano (benefit a secas) <- ' + motivo,
                    '| campañas en curso', campaignIdsInProgress.size,
                    '| campañas en el historial', campaignIdsEarned.size,
                    '| benefits', claimedBenefits.size,
                    '| pares campaña+benefit', claimedByCampaign.size);
                _claimedDropIds = claimedDrops;
                _claimedBenefitIds = claimedBenefits;
                _claimedBenefitsByCampaign = claimedByCampaign;
                _campaignScopeUsable = scopeUsable;
                _claimedIndexReady = true;
                _inventoryProgressReady = true;
                // Los badges ya estan pintados (los nombres salen de otra consulta,
                // mas rapida); este es el pase que les añade las marcas de obtenido. Y
                // repinta el panel entero, no solo las tarjetas: el inventario es lo que
                // hace juzgables "lo mas barato" y los filtros de estado, asi que hasta
                // ahora no habia con que ordenar ni con que filtrar.
                _refreshPanelAfterLateData();
                // El aviso de "sin inventario" se apaga aqui y no cuando vence el
                // temporizador: este es el momento en que la afirmacion deja de ser
                // cierta.
                _updateInventoryWarning();
            } catch (e) {
                console.warn('[Inventory] fetch failed:', e);
            }
        }

        // =============================================
        // LOS TRAMOS QUE NO SE RECLAMAN
        // =============================================
        // Twitch reparte emotes y emblemas SOLO al cumplir el tiempo: no hay boton, van
        // derechos al selector del chat. Para el inventario eso significa que su
        // `isClaimed` se queda en `false` PARA SIEMPRE, porque no hay nada que reclamar.
        //
        // Y eso hacia dano por partida doble: el tramo no se marcaba nunca como
        // obtenido, y ademas, al cumplir el tiempo con `isClaimed: false`, _isDropEarned
        // lo daba por «ganado sin reclamar» y le ponia el 🎁. O sea que te pedia un clic
        // por algo que Twitch ya te habia dado.
        //
        // El discriminador es `benefit.distributionType`, verificado el 2026-08-07 en un
        // volcado real: el tramo de la campaña de Twitch Gaming llega con `[EMOTE]`.
        // Viene en `DropCampaignDetails` y tambien en `Inventory`, asi que clasificar no
        // cuesta ni una peticion mas — solo habia que dejar de tirarlo al leer.
        //
        // Lo que NO discrimina es la imagen: se probo y el emote de Twitch cuelga del
        // mismo `twitch-quests-assets/REWARD/` que el contenido de juego. Tampoco el
        // nombre: en el historial de este usuario habia nueve «... Emote» de Marvel
        // Rivals que son objetos DENTRO del juego, con enlace de vinculacion de cuenta y
        // reclamables. Guiarse por cualquiera de las dos rompia esos nueve.
        //
        // Se exige que TODOS los benefits sean de un tipo conocido que no se reclama. Un
        // tipo que no conozcamos no cuenta como concedido: preferimos no marcar a marcar
        // de mas, que es la regla del resto del archivo.
        const AUTO_GRANTED_TYPES = ['EMOTE', 'BADGE'];

        // Marcador que Twitch mete en el enlace del aviso de «te concedimos esto». Se
        // compara el PREFIJO, sin el sufijo final, y las DOS variantes estan vistas en
        // notificaciones reales:
        //   emote   (2026-08-07, Bop2bop)
        //     help.twitch.tv/s/article/how-to-use-emotes?tt_content=..._earned_emote
        //   emblema (2026-08-08, EWC 2026 Platinum)
        //     help.twitch.tv/s/article/how-to-use-badges?tt_content=..._earned_badge
        // Cambia el articulo de ayuda y cambia el sufijo; lo que no cambia es este
        // prefijo. Si un dia Twitch usara otra cadena, simplemente no casa: nunca puede
        // acertarle a una notificacion ajena.
        const EARNED_REWARD_NOTIF_MARK = 'quests_viewer_reward_campaign_earned';

        function _autoGrantedFrom(benefitEdges) {
            const tipos = (benefitEdges || []).map(b => b.benefit?.distributionType);
            return tipos.length > 0 && tipos.every(t => AUTO_GRANTED_TYPES.includes(t));
        }

        // Devuelve null —no false— mientras no haya llegado el inventario. Sin datos
        // no se marca nada, en vez de pintar todo como no obtenido, que seria mentir
        // en la direccion contraria y encima con aspecto de dato.
        function _isDropClaimed(drop) {
            if (!_claimedIndexReady || !drop) return null;
            if (drop.id && _claimedDropIds.has(drop.id)) return true;
            // El tramo que se concede solo esta obtenido en cuanto el tiempo esta hecho.
            // Se mira contra el inventario y no contra un contador propio: si la campaña
            // no esta ahi no se sabe cuanto llevas, y entonces esto no opina.
            if (drop.autoGranted && drop.id) {
                const p = _inventoryProgress[drop.id];
                const required = p ? (Number(p.required) || 0) : 0;
                if (p && required > 0 && (Number(p.current) || 0) >= required) return true;
            }
            // El cruce por benefit es un RECURSO, no la fuente buena, y solo vale
            // cuando no hay dato por tramo: si la campaña esta en el inventario, Twitch
            // ya dijo tramo a tramo lo que tienes (self.isClaimed, arriba) y esto solo
            // puede contradecirlo.
            //
            // Contradecirlo pasaba de verdad, y no en un caso raro: una campaña puede
            // repartir LA MISMA recompensa en varios tramos, y entonces todos comparten
            // un unico benefit.id. Visto en Overwatch - Blizzard, cinco tramos de «100
            // Comp Points» a 2/4/6/8/10 h con el id `9620a89d-...-ae832fa6985e_CUSTOM_
            // ID_1852792` en los cinco: reclamar el de 2 h metia ese id en el indice y
            // los cinco pasaban a salir con ✓. En el historial de este usuario hay 8 ids
            // que se repiten asi, o sea que no es una campaña rara.
            //
            // Fuera del inventario —campaña completada o cerrada— no hay nada por tramo
            // y esto es lo unico que queda, con su imprecision: si comparten id, o salen
            // todos o ninguno. Se prefiere marcarlos, que es lo que hace que los emotes
            // y emblemas consten; ahi el tramo suele ser uno solo.
            //
            // Y hay una segunda forma de contradecirlo, peor porque no se nota: el
            // benefit.id tambien se REPITE ENTRE EDICIONES de una campaña. Visto el
            // 2026-08-11 con «RLCS 2025 Exotic/Import/Very Rare Drop», que son nuevos y
            // acumulables cada temporada: en el historial de este usuario los mismos tres
            // ids constan bajo CUATRO campañas distintas, asi que los de este año salian
            // con ✓ nada mas aparecer, y solo se corregian al empezar a ver stream —al
            // entrar la campaña en el inventario, este bloque deja de opinar—. Por eso el
            // cruce va acotado a la campaña del tramo: la misma recompensa concedida en
            // la edicion del año pasado ya no dice nada de la de este.
            if (!(drop.id && _inventoryProgress[drop.id])) {
                // Hacen falta TODOS: un tramo entrega varias recompensas de golpe, asi
                // que con una sola concedida no se puede dar el tramo por reclamado.
                const benefitIds = drop.benefitIds || [];
                if (benefitIds.length === 0) return false;
                // Sin campaña —el respaldo publico no la trae— o sin poder fiarse de que
                // los ids casen, se sigue mirando el conjunto plano: es menos preciso,
                // pero es lo que habia y marca de mas, no de menos.
                const scoped = _campaignScopeUsable && drop.campaignId;
                const has = scoped
                    ? (id => _claimedBenefitsByCampaign.has(drop.campaignId + '|' + id))
                    : (id => _claimedBenefitIds.has(id));
                if (benefitIds.every(has)) return true;
            }
            return false;
        }

        // Ganado y sin reclamar: el tiempo ya esta hecho y solo falta pulsar. Es un
        // estado propio y no un "casi": lo que le falta no es tiempo, es un clic, y
        // se pierde igual que lo demas cuando la campaña cierra. Twitch no lo marca
        // con ningun flag, asi que se deduce del inventario —minutos vistos contra
        // los que pide el tramo—; un drop que no esta en el inventario es que su
        // campaña no esta en curso, o sea que no lo tienes ganado.
        function _isDropEarned(drop) {
            if (!_inventoryProgressReady || !drop) return null;
            if (_isDropClaimed(drop) === true) return false;
            const p = drop.id ? _inventoryProgress[drop.id] : null;
            if (!p) return false;
            const required = Number(p.required) || 0;
            return required > 0 && (Number(p.current) || 0) >= required;
        }

        // =============================================
        // TOOLTIP + MODAL: TIEMPO RESTANTE EN DROPS EN PROGRESO
        // =============================================

        function formatHoursMinutes(totalMinutes) {
            const m = Math.max(0, Math.round(totalMinutes));
            const h = Math.floor(m / 60);
            const mm = m % 60;
            if (h <= 0) return `${mm}m`;
            if (mm <= 0) return `${h}h`;
            return `${h}h ${mm}m`;
        }

        // Parse "45% de 1 hora 30 minutos" / "45% of 1 hour 30 minutes" / "45% / 5 h" from
        // a per-tier card. Combines hours+minutes when both appear (the previous version
        // broke after the first match and read "1 hora 30 minutos" as 60 instead of 90).
        function _parseProgressFromCard(card) {
            const bar = card.querySelector('[role="progressbar"]');
            const pct = bar ? parseInt(bar.getAttribute('aria-valuenow') || '', 10) : NaN;
            if (!Number.isFinite(pct)) return null;
            const pNodes = card.querySelectorAll('p');
            let totalMinutes = 0;
            for (const p of pNodes) {
                const txt = (p.textContent || '').toLowerCase();
                let h = 0, m = 0;
                const mHours = txt.match(/(\d+(?:[.]\d+)?)\s*(?:hours?|horas?|stunden?|heures?|ore|godzin|h\b)/);
                if (mHours) h = parseFloat(mHours[1].replace(',', '.'));
                const mMin = txt.match(/(\d+)\s*(?:minutes?|minutos?|min\b)/);
                if (mMin) m = parseInt(mMin[1], 10);
                if (h > 0 || m > 0) {
                    totalMinutes = Math.round(h * 60) + m;
                    break;
                }
            }
            if (!totalMinutes) return null;
            const current = Math.round(totalMinutes * (pct / 100));
            const name = card.querySelectorAll('p')?.[0]?.textContent?.trim() || '';
            return { current, required: totalMinutes, dropName: name || '' };
        }

        let _dropTooltipEl = null;
        function _ensureDropTooltip() {
            if (_dropTooltipEl && document.body.contains(_dropTooltipEl)) return _dropTooltipEl;
            const el = document.createElement('div');
            el.id = 'twitch-drop-tooltip';
            Object.assign(el.style, {
                position: 'fixed', top: '0', left: '0', zIndex: '999999',
                background: colors.surface, color: colors.text,
                border: `1px solid ${colors.purple}`, borderRadius: '8px',
                padding: '6px 10px', fontSize: '12px', fontWeight: '600',
                fontFamily: 'Inter, system-ui, sans-serif',
                boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                pointerEvents: 'none', opacity: '0',
                transition: 'opacity 120ms ease', whiteSpace: 'nowrap'
            });
            document.body.appendChild(el);
            _dropTooltipEl = el;
            return el;
        }

        function _showDropTooltip(text) {
            const el = _ensureDropTooltip();
            el.textContent = text;
            el.style.opacity = '1';
        }

        function _moveDropTooltip(e) {
            const el = _ensureDropTooltip();
            const pad = 12;
            const w = el.offsetWidth;
            const h = el.offsetHeight;
            let x = e.clientX + pad;
            let y = e.clientY + pad;
            if (x + w + 4 > window.innerWidth) x = e.clientX - w - pad;
            if (y + h + 4 > window.innerHeight) y = e.clientY - h - pad;
            el.style.left = `${Math.max(0, x)}px`;
            el.style.top = `${Math.max(0, y)}px`;
        }

        function _hideDropTooltip() {
            if (_dropTooltipEl) _dropTooltipEl.style.opacity = '0';
        }

        function _resolveDropProgress(dropID, card) {
            // The DOM is authoritative for current/required: aria-valuenow and the
            // "X% de N horas" text are always for THIS card and stay accurate while
            // the user watches. The API is a secondary source (used only for
            // metadata like reward names + image and as a fallback if the DOM can't
            // be parsed). Preferring API was buggy because:
            //   - the per-card dropID lookup can resolve to the wrong tier, and
            //   - the API snapshot is taken once at init and grows stale.
            const fromDom = _parseProgressFromCard(card);
            const fromApi = dropID ? _inventoryProgress[dropID] : null;
            console.debug(`[Progress] dropID=${dropID} fromDom=`, fromDom, 'fromApi=', fromApi);
            if (fromDom) {
                return {
                    current: fromDom.current,
                    required: fromDom.required,
                    dropName: fromDom.dropName || (fromApi && fromApi.dropName) || '',
                    rewards: (fromApi && fromApi.rewards) || [],
                    imageUrl: (fromApi && fromApi.imageUrl) || ''
                };
            }
            if (fromApi && fromApi.required > 0) return fromApi;
            return null;
        }

        function _openDropModal(dropID, card) {
            const progress = _resolveDropProgress(dropID, card);
            if (!progress) return;
            const remaining = Math.max(0, progress.required - progress.current);
            const pct = progress.required > 0
                ? Math.round((progress.current / progress.required) * 100)
                : 0;

            const { overlay, box } = createModalContainer();
            box.style.minWidth = 'min(320px, 100%)';
            box.style.padding = '24px 28px';

            // Header con imagen + nombre
            const header = document.createElement('div');
            Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' });
            const cardImg = card.querySelector('img.inventory-drop-image, img.inventory-opacity-2');
            const imgSrc = progress.imageUrl || (cardImg ? cardImg.src : '');
            if (imgSrc) {
                const img = document.createElement('img');
                img.src = imgSrc;
                Object.assign(img.style, {
                    width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover',
                    border: `1px solid ${colors.border}`
                });
                header.appendChild(img);
            }
            const titleWrap = document.createElement('div');
            const title = document.createElement('div');
            title.textContent = progress.dropName || t.dropDetails;
            Object.assign(title.style, { fontSize: '16px', fontWeight: '700', color: colors.text });
            titleWrap.appendChild(title);
            const subtitle = document.createElement('div');
            subtitle.textContent = t.dropDetails;
            Object.assign(subtitle.style, { fontSize: '11px', color: colors.gray, marginTop: '2px' });
            titleWrap.appendChild(subtitle);
            header.appendChild(titleWrap);
            box.appendChild(header);

            const lineProgress = document.createElement('div');
            lineProgress.style.marginBottom = '6px';
            lineProgress.innerHTML = `<span style="color:${colors.gray}">${t.progress}:</span> <span style="font-weight:600">${progress.current} / ${progress.required} ${t.minutesShort} · ${pct}%</span>`;
            box.appendChild(lineProgress);

            const lineRemaining = document.createElement('div');
            lineRemaining.style.marginBottom = '12px';
            lineRemaining.innerHTML = `<span style="color:${colors.gray}">${t.timeRemaining}:</span> <span style="font-weight:700;color:${colors.purple}">${formatHoursMinutes(remaining)}</span>`;
            box.appendChild(lineRemaining);

            if (progress.rewards && progress.rewards.length > 0) {
                const rewardsTitle = document.createElement('div');
                rewardsTitle.textContent = `${t.rewards}:`;
                Object.assign(rewardsTitle.style, { color: colors.gray, fontSize: '12px', marginBottom: '4px' });
                box.appendChild(rewardsTitle);
                const ul = document.createElement('ul');
                Object.assign(ul.style, { margin: '0 0 12px 0', paddingLeft: '18px' });
                for (const r of progress.rewards) {
                    const li = document.createElement('li');
                    li.textContent = r;
                    li.style.fontSize = '13px';
                    ul.appendChild(li);
                }
                box.appendChild(ul);
            }

            const actions = document.createElement('div');
            Object.assign(actions.style, { display: 'flex', justifyContent: 'flex-end', gap: '8px' });
            const closeBtn = document.createElement('button');
            closeBtn.textContent = t.accept || 'OK';
            Object.assign(closeBtn.style, {
                padding: '6px 12px', backgroundColor: colors.surface,
                color: colors.purple, border: `1px solid ${colors.purple}`,
                borderRadius: '6px', cursor: 'pointer', fontWeight: '600'
            });
            const detach = attachDismissHandlers(overlay, () => { closeOverlayAnimated(overlay); });
            closeBtn.onclick = () => { detach(); closeOverlayAnimated(overlay); };
            actions.appendChild(closeBtn);
            box.appendChild(actions);

            document.body.appendChild(overlay);
            try { setInertOnBodyChildrenExcept(overlay, true); } catch (e) { /* noop */ }
            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                box.style.transform = 'translateY(0) scale(1)';
                box.style.opacity = '1';
            });
            setTimeout(() => { closeBtn.focus(); }, 100);
        }

        // Walks up from a per-tier image (img.inventory-opacity-2) and returns the
        // smallest ancestor that contains exactly ONE [role="progressbar"]. That
        // ancestor is the per-tier card wrapper.
        //
        // We use progressbar count (not dropID links) because Twitch's inventory
        // does NOT expose per-tier dropID links — only one campaign-level link
        // exists per campaign. Each tier does have its own progressbar though,
        // so that's what gives us per-tier isolation.
        //
        // Returns the FIRST (smallest) ancestor with exactly 1 progressbar so the
        // tooltip/click area stays tight on the actual card and not the full row
        // or campaign block.
        function _findPerCardWrapper(img) {
            let el = img.parentElement;
            while (el && el !== document.body) {
                const bars = el.querySelectorAll('[role="progressbar"]');
                if (bars.length >= 2) return null;
                if (bars.length === 1) return el;
                el = el.parentElement;
            }
            return null;
        }

        // Best-effort: match a per-tier card to its API entry by tier name. The
        // DOM shows e.g. "Love, Reddysh" while the API exposes "Love, Reddysh
        // Spray", so we match with a substring check in either direction. Returns
        // the dropID (tier ID from the GQL Inventory) or null if no match. Only
        // used for metadata (reward names + image); progress is read from the DOM.
        function _findDropIDByCardName(cardWrapper) {
            const nameEl = cardWrapper.querySelector('p');
            const name = nameEl ? nameEl.textContent.trim() : '';
            if (!name) return null;
            for (const [id, info] of Object.entries(_inventoryProgress)) {
                const apiName = (info && info.dropName) || '';
                if (!apiName) continue;
                if (apiName === name || apiName.includes(name) || name.includes(apiName)) {
                    return id;
                }
            }
            return null;
        }

        function attachDropTooltipAndModal(card, dropID) {
            if (!card || card.dataset.dropTooltipAttached === 'true') return;
            card.dataset.dropTooltipAttached = 'true';
            card.style.cursor = 'pointer';

            card.addEventListener('mouseenter', (e) => {
                const progress = _resolveDropProgress(dropID, card);
                if (!progress) return;
                const remaining = Math.max(0, progress.required - progress.current);
                _showDropTooltip(`${t.timeRemaining}: ${formatHoursMinutes(remaining)}`);
                _moveDropTooltip(e);
            });
            card.addEventListener('mousemove', _moveDropTooltip);
            card.addEventListener('mouseleave', _hideDropTooltip);
            card.addEventListener('click', (e) => {
                if (e.target.closest('a, button, input')) return;
                e.preventDefault();
                e.stopPropagation();
                _hideDropTooltip();
                _openDropModal(dropID, card);
            });
        }

        // Main: fetch drops via GQL, fallback to public API
        async function fetchDropsFromAPI() {
            try {
                await _fetchDropsViaGQL();
            } catch (e) {
                console.warn('[GQL] Failed, falling back to public API:', e);
                await _fetchDropsViaPublicAPI();
            }
            _apiDataReady = true;
            const _apiLoadingEl = document.getElementById("twitch-drops-api-loading");
            if (_apiLoadingEl) _apiLoadingEl.style.display = "none";
            // Process snapshots from API data regardless of current page
            _processSnapshotsFromAPI();
            if (location.pathname.includes('/campaigns')) {
                // Re-escanea la pagina y repinta entero: ahora si hay fechas y tramos
                // con los que ordenar y filtrar.
                highlightAndLinkDrops();
            } else {
                _refreshPanelAfterLateData();
            }
        }

        // En que solapa cae una campaña. `status` es lo que dice Twitch, pero se
        // contrasta con endAt: una marcada ACTIVE cuya fecha de cierre ya paso esta
        // cerrada, y la fecha es el dato duro. Lo que no es ni lo uno ni lo otro
        // (UPCOMING) se descarta a proposito: la pagina de campañas tampoco lo lista,
        // asi que no hay solapa donde ponerlo y meterlo en Cerrados seria mentir.
        function _campaignStatus(campaign) {
            const raw = String((campaign && campaign.status) || '');
            const now = Date.now();
            const end = Date.parse((campaign && campaign.endAt) || '');
            const start = Date.parse((campaign && campaign.startAt) || '');
            if (raw === 'EXPIRED' || (Number.isFinite(end) && end <= now)) return 'expired';
            if (Number.isFinite(start) && start > now) return 'upcoming';
            return raw === 'ACTIVE' ? 'active' : 'upcoming';
        }

        // Twitch sirve las imagenes con plantilla —el box art lleva {width}x{height}—
        // y el <img> de la tarjeta pide la URL tal cual, asi que una con llaves no
        // carga. Se prueban varios campos porque la consulta es PERSISTIDA: su
        // seleccion la fija Twitch y no se puede pedir un campo concreto.
        // Un campo de imagen no siempre es una cadena: las reward campaigns traen
        // `image` como OBJETO, y al concatenarlo salia un src de "[object Object]" —la
        // imagen rota que se veia en el inventario en «Boss Run Marathon - Minecraft»,
        // y solo ahi: en campañas esa tarjeta la pinta el DOM, con su <img> de verdad—.
        //
        // No se pide un nombre de campo concreto porque la consulta es PERSISTIDA: su
        // seleccion la fija Twitch, asi que se coge el primer valor del objeto que sea
        // una URL. Adivinar el nombre envejece peor.
        function _imageUrlOf(raw) {
            if (!raw) return '';
            if (typeof raw === 'string') return raw;
            if (typeof raw !== 'object') return '';
            for (const v of Object.values(raw)) {
                if (typeof v === 'string' && /^https?:\/\//.test(v)) return v;
            }
            return '';
        }

        // La CARATULA manda, y las imagenes propias de la campaña quedan de respaldo.
        // Es lo que hace que la misma campaña se vea igual en las dos paginas: en
        // /drops/campaigns la tarjeta la pinta el DOM, cuyo <img> es la caratula, asi
        // que preferir aqui `imageURL` hacia que en el inventario saliera OTRA imagen
        // para lo mismo. Visto en «FF14 Support a Streamer»:
        //     DOM        ttv-boxart/24241_IGDB-120x160.jpg
        //     imageURL   twitch-quests-assets/CAMPAIGN/67ca517b-....jpeg
        // Precio a pagar, y se asume: la caratula es del JUEGO, asi que dos campañas
        // del mismo juego se ven iguales. Ya pasaba con las de drops —ese mapa va
        // indexado por juego— y el titulo es quien las distingue.
        function _apiImage(c) {
            const raw = _imageUrlOf(c && c.game && c.game.boxArtURL)
                || _imageUrlOf(c && c.imageURL)
                || _imageUrlOf(c && c.image)
                || _imageUrlOf(c && c.owner && c.owner.profileImageURL);
            if (!raw) return '';
            return String(raw).replace('{width}', '144').replace('{height}', '192');
        }

        // El NOMBRE del juego lo traduce Twitch en la pagina y no en la API: el DOM dice
        // "Eventos especiales" donde la API dice "Special Events", y "DJ" donde dice
        // "DJs". Como todo el cruce entre las dos fuentes iba por titulo, esas campañas
        // salian DOS veces en el panel —la tarjeta del DOM y la de la API— y ademas la
        // del DOM se quedaba sin chips de recompensa, porque _findEntryForTitle tampoco
        // las encontraba.
        //
        // El id del juego si es el mismo en los dos lados, y no hace falta pedirlo
        // aparte: viene DENTRO de la URL de la caratula, que las dos fuentes publican.
        //     DOM  Eventos especiales -> ttv-boxart/509663-120x160.jpg
        //     API  Special Events     -> game.id "509663"
        // El sufijo _IGDB de algunas (ttv-boxart/23020_IGDB-120x160.jpg) no estorba
        // porque solo se leen los digitos de delante.
        function _gameIdFromBoxArt(url) {
            const m = String(url || '').match(/ttv-boxart\/(\d+)/);
            return m ? m[1] : '';
        }
        function _gameIdOf(c) {
            const id = c && c.game && c.game.id;
            if (id && /^\d+$/.test(String(id))) return String(id);
            return _gameIdFromBoxArt(c && c.game && c.game.boxArtURL);
        }

        // Titulo con el que la PAGINA llama a cada juego, indexado por id. Lo llena el
        // escaneo del DOM y lo consultan la deduplicacion y la busqueda de recompensas.
        // Va en un mapa aparte, y no pegado a la entrada de la API, porque las dos
        // fuentes llegan por su cuenta: si se guardara en la entrada, un escaneo previo
        // a la respuesta de la API no tendria donde dejarlo y el alias se perderia.
        const _domTitleByGameId = {};
        function _domAliasFor(entry) {
            // Las entradas indexadas POR CAMPAÑA quedan fuera: varias comparten juego,
            // asi que un alias por id las deduplicaria todas de golpe (ver donde se
            // construyen las reward campaigns). Llevan gameId solo para la caratula.
            if (!entry || entry.perCampaign) return '';
            const id = entry.gameId;
            return id ? (_domTitleByGameId[id] || '') : '';
        }

        // La caratula a partir del id del juego. `game` de la API trae el id pero NO
        // siempre la URL, asi que hay que componerla — y tiene una trampa: unas van
        // como `ttv-boxart/509663-...` y otras como `ttv-boxart/24241_IGDB-...`. En el
        // volcado real de 100 juegos (2026-08-08) no habia una tercera forma, asi que
        // se prueban las dos y quien decide es el navegador, con el onerror del <img>.
        function _boxArtCandidates(gameId) {
            if (!gameId) return [];
            const base = 'https://static-cdn.jtvnw.net/ttv-boxart/' + gameId;
            return [base + '_IGDB-144x192.jpg', base + '-144x192.jpg'];
        }

        // El MISMO texto contra el que se acaba de filtrar, guardado en la entrada. Se
        // guarda porque si no, la tarjeta no puede decir POR QUE esta ahi: las
        // etiquetas se calculaban sobre el titulo que se muestra, y el filtro mira
        // ademas el nombre de la campaña, que en Twitch NO entra en el titulo
        // —displayTitle es "<juego> - <propietario>"—. Una campaña que casara solo por
        // el nombre de campaña salia en el panel SIN NINGUNA ETIQUETA, o sea sin
        // explicacion, y eso es indistinguible de un fallo del filtro.
        //
        // Se acumula sin repetir: un juego funde sus campañas en una sola entrada y
        // cada una pudo entrar por una keyword distinta, asi que quedarse con el texto
        // de la primera dejaria a las demas sin etiqueta.
        function _mergeSearchText(entry, searchText) {
            if (!entry.searchText) { entry.searchText = searchText; return; }
            if (entry.searchText.indexOf(searchText) === -1) entry.searchText += ' ' + searchText;
        }

        async function _fetchDropsViaGQL() {
            const { dropCampaigns, rewardCampaigns } = await _gqlGetCampaigns();

            // Se reconstruye desde cero: los tramos entran con push, asi que una
            // segunda pasada duplicaria los badges de cada tarjeta.
            for (const k of Object.keys(_apiDropNames)) delete _apiDropNames[k];
            for (const k of Object.keys(_apiClosedCampaigns)) delete _apiClosedCampaigns[k];
            for (const k of Object.keys(_apiStatusSeen)) delete _apiStatusSeen[k];

            // Process reward campaigns first (specific keys like "Turtle Tunes - Minecraft")
            for (const rc of rewardCampaigns) {
                // NO se filtra por `status`, y ahora se sabe por que: una reward
                // campaign viva llega con `status: "UNKNOWN"` —visto el 2026-08-08 en
                // «FF14 Support a Streamer», abierta y en la pagina—. Descartar lo que
                // no sea ACTIVE las escondia todas. Lo que si acota es la fecha, en
                // _apiItemsFor. Por eso este filtro se queda fuera; no lo reactives.
                const campaignName = rc.name || '';
                const gameName = rc.game?.displayName || '';
                const searchText = (campaignName + ' ' + gameName).toLowerCase();
                if (!_matchesKeywords(searchText)) continue;

                const minutes = rc.unlockRequirements?.minuteWatchedGoal || 0;
                const rewards = (rc.rewards || []).map(r => ({
                    name: r.name || '',
                    rewards: [r.name].filter(Boolean),
                    minutes,
                    id: r.id || '',
                    benefitIds: [],
                    // Vacio y no `rc.id`: sin benefits no hay nada que acotar, y poner un
                    // id que no aparece en el historial solo invitaria a creer que si.
                    campaignId: '',
                    // Las reward campaigns son otro sistema y no traen benefits, asi que
                    // aqui no hay tipo que mirar. Se pone para que las tres formas del
                    // tramo sean una sola y nadie tenga que acordarse de cual es cual.
                    autoGranted: false
                })).filter(r => r.name);

                if (rewards.length > 0) {
                    // Key by "campaignName - gameName" for precise matching against card titles
                    const key = gameName ? `${campaignName} - ${gameName}` : campaignName;
                    // Aqui el titulo YA lleva las dos mitades del texto filtrado, asi
                    // que searchText es coherente por si solo. Se guarda igual para que
                    // las cuatro entradas tengan la misma forma y nadie tenga que
                    // acordarse de la excepcion.
                    // SIN gameId, y no es un olvido. El alias por juego vale para las
                    // campañas de drops porque ese mapa va indexado POR JUEGO y hay una
                    // entrada como mucho; estas van indexadas por campaña, asi que un
                    // juego puede tener varias, y todas compartirian el mismo alias: la
                    // primera tarjeta de ese juego que trajera el DOM las habria
                    // deduplicado a TODAS de golpe. Tampoco les hace falta: su clave
                    // lleva el nombre de la campaña, que Twitch no traduce.
                    //
                    // SIN campaignId tampoco, y esto no es una suposicion: NO EXISTE
                    // enlace profundo a una reward campaign. Comprobado el 2026-08-08
                    // por los dos lados con «FF14 Support a Streamer»:
                    //   · se le paso su id a `?dropID=` —que si funciona con las
                    //     campañas de drops, tambien verificado— y Twitch no lo
                    //     reconoce: abre la lista y no enfoca nada;
                    //   · volcando los enlaces de su tarjeta en la pagina, lo unico que
                    //     hay es vincular cuenta (secure.square-enix.com), el directorio
                    //     del juego (/directory/category/...) y /drops/inventory. Twitch
                    //     no las trata como algo navegable.
                    // Asi que el 🔗 copia la pagina de campañas a secas, que es la
                    // verdad: mejor un enlace generico que uno con un uuid inerte.
                    _apiDropNames[key] = { drops: rewards, startAt: rc.startsAt || '', endAt: rc.endsAt || '', displayTitle: key, imgSrc: _apiImage(rc), searchText, gameId: _gameIdOf(rc), perCampaign: true };
                }
            }

            // Process drop campaigns
            for (const campaign of dropCampaigns) {
                // Ya NO se descarta lo que no esta ACTIVE: la solapa de Cerrados tiene
                // que poder llenarse sin pasar por la pagina de campañas. Lo que se
                // hace ahora es clasificar.
                const status = _campaignStatus(campaign);
                const raw = String(campaign.status || '(sin status)');
                _apiStatusSeen[raw] = (_apiStatusSeen[raw] || 0) + 1;

                const gameName = campaign.game?.displayName || '';
                const campaignName = campaign.name || '';
                const ownerName = campaign.owner?.name || '';
                const searchText = (gameName + ' ' + campaignName + ' ' + ownerName).toLowerCase();
                if (!_matchesKeywords(searchText)) continue;

                const apiKey = gameName || campaignName;
                // Full display title matching DOM format: "Game - Owner"
                const displayTitle = ownerName ? `${apiKey} - ${ownerName}` : apiKey;

                if (status === 'expired') {
                    if (!_apiClosedCampaigns[apiKey]) {
                        _apiClosedCampaigns[apiKey] = {
                            displayTitle, startAt: campaign.startAt || '',
                            endAt: campaign.endAt || '', imgSrc: _apiImage(campaign),
                            campaignId: campaign.id || '', searchText,
                            gameId: _gameIdOf(campaign)
                        };
                    } else {
                        // Un juego agrupa varias campañas y la primera puede no traer
                        // imagen: se toma la primera que la tenga.
                        if (!_apiClosedCampaigns[apiKey].imgSrc) {
                            _apiClosedCampaigns[apiKey].imgSrc = _apiImage(campaign);
                        }
                        if (!_apiClosedCampaigns[apiKey].gameId) {
                            _apiClosedCampaigns[apiKey].gameId = _gameIdOf(campaign);
                        }
                        // Fuera del if de la imagen a proposito: el texto se acumula
                        // aunque la entrada ya tuviera imagen, que no tienen nada que ver.
                        _mergeSearchText(_apiClosedCampaigns[apiKey], searchText);
                    }
                    continue;
                }
                if (status !== 'active') continue;

                // Get details for this campaign
                try {
                    const details = await _gqlGetCampaignDetails(campaign.id, campaign.owner?.login || 'twitch');
                    const timeBasedDrops = details?.user?.dropCampaign?.timeBasedDrops || [];
                    const drops = [];
                    for (const drop of timeBasedDrops) {
                        const rewardNames = (drop.benefitEdges || [])
                            .map(b => b.benefit?.name).filter(Boolean);
                        drops.push({
                            name: drop.name,
                            rewards: rewardNames,
                            minutes: drop.requiredMinutesWatched || 0,
                            // Identidad del drop, para cruzarlo con el inventario y
                            // saber si ya esta reclamado. Se guardan las dos claves
                            // posibles porque el reclamado se puede mirar por tramo
                            // (id del drop) o por recompensa concreta (id del
                            // benefit), y no son intercambiables: un tramo reparte
                            // varios benefits de golpe.
                            id: drop.id || '',
                            benefitIds: (drop.benefitEdges || [])
                                .map(b => b.benefit?.id).filter(Boolean),
                            // Por tramo y no en la entrada del mapa, que va indexada por
                            // JUEGO y funde varias campañas en una: ahi solo cabe un id
                            // —el de la primera— y acotar el reclamado con el de otra
                            // campaña seria peor que no acotarlo.
                            campaignId: campaign.id || '',
                            autoGranted: _autoGrantedFrom(drop.benefitEdges)
                        });
                    }
                    if (drops.length > 0) {
                        if (!_apiDropNames[apiKey]) {
                            // campaignId es lo que hace compartible la tarjeta (ver
                            // _shareUrlFor). Se queda con el de la PRIMERA campaña del
                            // juego: la clave del mapa es el juego, asi que un juego con
                            // varias campañas las funde en una entrada y solo cabe un id.
                            // Es la misma limitacion que ya funde sus badges.
                            _apiDropNames[apiKey] = { drops: [], startAt: campaign.startAt || '', endAt: campaign.endAt || '', displayTitle, imgSrc: _apiImage(campaign), campaignId: campaign.id || '', searchText, gameId: _gameIdOf(campaign) };
                        } else {
                            _mergeSearchText(_apiDropNames[apiKey], searchText);
                        }
                        _apiDropNames[apiKey].drops.push(...drops);
                        if (!_apiDropNames[apiKey].imgSrc) {
                            _apiDropNames[apiKey].imgSrc = _apiImage(campaign);
                        }
                        if (!_apiDropNames[apiKey].gameId) {
                            _apiDropNames[apiKey].gameId = _gameIdOf(campaign);
                        }
                    }
                } catch (e) { /* skip this campaign */ }
            }

            // De aqui salen LAS DOS SOLAPAS cuando entras por el inventario, asi que
            // queda dicho que estados devolvio Twitch y cuantas campañas quedaron en
            // cada una. Si "cerrados" sale a 0 con campañas cerradas en la web, es que
            // ViewerDropsDashboard no las devuelve y hay que sacarlas de otro sitio.
            //
            // La cuenta de imagenes va por lo mismo: la consulta es persistida —su
            // seleccion de campos la fija Twitch— asi que si un dia deja de traer
            // imagen, las tarjetas de la API se quedarian sin ella en silencio.
            const entradas = Object.values(_apiDropNames).concat(Object.values(_apiClosedCampaigns));
            const conImagen = entradas.filter(e => e.imgSrc).length;
            console.log('[Twitch Drops] API:', JSON.stringify(_apiStatusSeen),
                '-> tus keywords: activos', Object.keys(_apiDropNames).length,
                '| cerrados', Object.keys(_apiClosedCampaigns).length,
                '| con imagen:', conImagen + '/' + entradas.length);

            // Cuantas entradas casan por algo que NO esta en su titulo. Son exactamente
            // las que antes salian sin etiqueta, asi que este numero dice si el arreglo
            // tiene hoy algo que hacer con TUS keywords —y con cual comprobarlo—. Si
            // sale 0 no es que este roto: es que ninguna campaña de hoy es de ese tipo.
            const soloFuera = [];
            for (const e of entradas) {
                if (!e.searchText) continue;
                const enTitulo = _matchedPositiveKeywords(String(e.displayTitle || '').toLowerCase());
                const enFiltro = _matchedPositiveKeywords(e.searchText);
                const extra = enFiltro.filter(k => !enTitulo.includes(k));
                if (extra.length) soloFuera.push(`${e.displayTitle} <- ${extra.join(', ')}`);
            }
            console.log('[Twitch Drops] casan por algo que no esta en el titulo:',
                soloFuera.length, soloFuera.length ? soloFuera : '');
        }

        // Public API fallback
        async function _fetchDropsViaPublicAPI() {
            try {
                const resp = await fetch('https://twitch-drops-api.sunkwi.com/drops');
                if (!resp.ok) return;
                const allDrops = await resp.json();
                if (!Array.isArray(allDrops)) return;

                for (const game of allDrops) {
                    const gameName = game.gameDisplayName || '';
                    const searchText = gameName.toLowerCase();
                    if (!_matchesKeywords(searchText)) continue;

                    const drops = [];
                    for (const reward of (game.rewards || [])) {
                        for (const drop of (reward.timeBasedDrops || [])) {
                            const rewardNames = (drop.benefitEdges || [])
                                .map(b => b.benefit?.name).filter(Boolean);
                            drops.push({
                                name: drop.name,
                                rewards: rewardNames,
                                minutes: drop.requiredMinutesWatched || 0,
                                id: drop.id || '',
                                benefitIds: (drop.benefitEdges || [])
                                    .map(b => b.benefit?.id).filter(Boolean),
                                // El espejo publico no expone el id de la campaña, asi
                                // que estos tramos se quedan con el cruce plano. Es el
                                // respaldo: se usa solo cuando GQL no responde.
                                campaignId: '',
                                autoGranted: _autoGrantedFrom(drop.benefitEdges)
                            });
                        }
                    }
                    if (drops.length > 0) {
                        // Coherente por casualidad —filtra por gameName y el titulo ES
                        // gameName—, pero se guarda igual: la forma de la entrada tiene
                        // que ser una sola, no una por rama.
                        _apiDropNames[gameName] = { drops, startAt: '', endAt: '', displayTitle: gameName, searchText, gameId: _gameIdFromBoxArt(game.gameBoxArtURL) };
                    }
                }
            } catch (e) { console.warn('[Public API] Fetch error:', e); }
        }

        // Find full API entry for a card title (best match wins) — returns {drops, startAt, endAt}
        function _titleScore(ct, k) {
            if (!k) return 0;
            if (ct === k) return 1000;              // exact match
            if (ct.includes(k)) return k.length;    // longer key = more specific
            if (k.includes(ct)) return ct.length;
            // Try matching just the game name part (before " - ")
            const cardGame = ct.split(' - ')[0].trim();
            const keyGame = k.split(' - ')[0].trim();
            if (cardGame && keyGame && (cardGame.includes(keyGame) || keyGame.includes(cardGame))) {
                return Math.min(cardGame.length, keyGame.length);
            }
            return 0;
        }

        function _findEntryForTitle(cardTitle) {
            if (!cardTitle) return null;
            const ct = cardTitle.toLowerCase();
            let bestMatch = null;
            let bestScore = 0;

            for (const [key, entry] of Object.entries(_apiDropNames)) {
                if (key === '__all') continue;
                // Se puntua contra la clave de la API Y contra el nombre que la pagina
                // le da al mismo juego: si no, una tarjeta que dice "Eventos especiales"
                // no encuentra nunca la entrada "Special Events" y se queda sin chips.
                const score = Math.max(
                    _titleScore(ct, key.toLowerCase()),
                    _titleScore(ct, _domAliasFor(entry))
                );

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = entry;
                }
            }
            return bestMatch;
        }

        // Find drop names array for a card title (convenience wrapper)
        function _findDropNamesForTitle(cardTitle) {
            const entry = _findEntryForTitle(cardTitle);
            return entry ? entry.drops : null;
        }

        // Process snapshots from API data regardless of current page (inventory or campaigns)
        function _processSnapshotsFromAPI() {
            if (!_apiDataReady) return;
            const notifs = getNotifications();
            let hasChanges = false;

            // 1. Update snapshots for existing notifications using fresh API data
            for (const notif of notifs) {
                if (!notif.title) continue;
                // Si la campaña/juego ya no tiene drops en la API (expiró), no notificar
                const entry = _findEntryForTitle(notif.title);
                if (!entry || !entry.drops || entry.drops.length === 0) continue;
                const dataSnapshot = buildDataSnapshot(notif.title);
                if (dataSnapshot && notif.dataSnapshot !== dataSnapshot) {
                    notif.changed = true;
                    notif.seen = false;
                    notif.dataSnapshot = dataSnapshot;
                    notif.updatedAt = Date.now();
                    hasChanges = true;
                }
            }

            // 2. Check for new campaigns using full display title (e.g. "Rust - Facepunch Studios")
            for (const [key, entry] of Object.entries(_apiDropNames)) {
                if (key === '__all' || !entry || !entry.drops || entry.drops.length === 0) continue;
                const title = entry.displayTitle || key;
                const titleLower = title.toLowerCase();
                // Mismo criterio que el escaneo de la pagina, negativas incluidas:
                // una campaña descartada no puede colarse por la puerta de atras
                // de la API y hacer sonar la alarma.
                if (!_matchesKeywords(titleLower)) continue;
                const exists = notifs.find(n => n.title === title || (n.title && n.title.toLowerCase() === titleLower));
                if (!exists) {
                    const dataSnapshot = buildDataSnapshot(title);
                    notifs.push({
                        id: `api-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        title: title,
                        key: title + '|api',
                        dataSnapshot: dataSnapshot,
                        seen: false, changed: true,
                        createdAt: Date.now(), updatedAt: Date.now()
                    });
                    hasChanges = true;
                }
            }

            if (hasChanges) {
                saveNotifications(notifs);
                _updateNotifTabCount();
                renderNotificationsTab();
            }
        }

        // Inject drop name chips into already-rendered cards (active only)
        function _updateAllCardsWithDropNames() {
            const panes = ["twitch-drops-active-pane"];
            for (const paneId of panes) {
                const pane = document.getElementById(paneId);
                if (!pane) continue;
                pane.querySelectorAll("[data-notif-title]").forEach(card => {
                    const ct = card.getAttribute("data-notif-title");
                    const drops = _findDropNamesForTitle(ct);
                    if (!drops || drops.length === 0) return;
                    // Se repinta en vez de saltarse los badges ya puestos: el estado de
                    // reclamado llega del inventario, despues que los nombres, asi que
                    // el primer pintado se hace sin marcas y este segundo pase es el
                    // que las añade.
                    const previous = card.querySelector(".drop-api-names");
                    if (previous) previous.remove();
                    // La linea de urgencia entra en el mismo repintado: el "te
                    // faltan" necesita los minutos vistos, que llegan con este pase.
                    const previousUrgency = card.querySelector(".drop-urgency");
                    if (previousUrgency) previousUrgency.remove();
                    _appendUrgencyTo(card, _findEntryForTitle(ct));
                    _appendDropNamesTo(card, drops);
                });
            }
        }

        function _appendDropNamesTo(card, drops) {
            const container = document.createElement("div");
            container.className = "drop-api-names";
            Object.assign(container.style, {
                display: "flex", flexWrap: "wrap", gap: "3px", marginTop: "4px"
            });
            // Group by minutes: un chip por tramo de visualizacion. Dentro del chip va
            // un span POR DROP, no un texto unico. El drop es la unidad de reclamo
            // —un tramo entrega todas sus recompensas de golpe—, y una campaña puede
            // tener varios drops en el mismo tramo, cada uno con su propio estado.
            const grouped = {};
            drops.forEach(d => {
                const key = d.minutes || 0;
                if (!grouped[key]) grouped[key] = [];
                const name = (d.rewards && d.rewards.length > 0) ? d.rewards.join(", ") : d.name;
                if (!name) return;
                const claimed = _isDropClaimed(d);
                // Ganado solo cuenta mientras no este reclamado: son estados
                // sucesivos del mismo tramo, no dos marcas que se acumulen.
                const earned = claimed === true ? false : _isDropEarned(d);
                // Deduplicado por (nombre + estado) y no solo por nombre: dos drops
                // homonimos en el mismo tramo se siguen viendo como uno mientras
                // compartan estado, y se separan en cuanto uno esta reclamado y el
                // otro no — que es justo lo que este badge viene a decir.
                if (grouped[key].some(x => x.name === name && x.claimed === claimed && x.earned === earned)) return;
                grouped[key].push({ name, claimed, earned });
            });
            Object.entries(grouped).forEach(([min, items]) => {
                const minutes = parseInt(min);
                const hours = minutes / 60;
                // Con el tramo entero reclamado, el tiempo que pedia ya no le sirve a
                // nadie: desaparece de la etiqueta, y quien lo dice es el tooltip, que
                // es donde vivia ese dato.
                const allClaimed = items.length > 0 && items.every(x => x.claimed === true);
                const chip = document.createElement("span");
                chip.title = allClaimed
                    ? (t.claimedInventoryTitle || 'Claimed')
                    : (minutes ? `${minutes} min` : '');
                Object.assign(chip.style, {
                    padding: "1px 6px",
                    backgroundColor: colors.text + "18",
                    color: colors.text,
                    border: `1px solid ${colors.text}40`,
                    borderRadius: "8px", fontSize: "10px"
                });
                items.forEach((item, i) => {
                    if (i > 0) chip.appendChild(document.createTextNode(", "));
                    if (item.claimed) {
                        // El ✓ va en su propio span y SIN tachar: es la marca positiva
                        // de que lo tienes, y tachado se leeria como lo contrario. El
                        // tachado es solo para el nombre, y la opacidad hunde el
                        // conjunto para que lo que resalte sea lo que aun falta.
                        const tick = document.createElement("span");
                        tick.textContent = "✓ ";
                        tick.style.opacity = "0.6";
                        chip.appendChild(tick);
                    } else if (item.earned) {
                        // El regalo tira en la direccion contraria al ✓: no atenua ni
                        // tacha, porque esto no esta cerrado — es lo unico del badge
                        // que pide una accion tuya ahora mismo.
                        const gift = document.createElement("span");
                        gift.textContent = "🎁 ";
                        chip.appendChild(gift);
                    }
                    const nameEl = document.createElement("span");
                    nameEl.textContent = item.name;
                    if (item.claimed) {
                        nameEl.style.textDecoration = "line-through";
                        nameEl.style.opacity = "0.6";
                    } else if (item.earned) {
                        nameEl.style.color = colors.orange;
                        nameEl.style.fontWeight = "700";
                        nameEl.title = t.earnedUnclaimed || 'Earned, not claimed';
                    }
                    chip.appendChild(nameEl);
                });
                if (!allClaimed) {
                    const suffix = hours >= 1 ? ` (${hours} h)` : minutes > 0 ? ` (${minutes} min)` : '';
                    if (suffix) chip.appendChild(document.createTextNode(suffix));
                }
                container.appendChild(chip);
            });
            card.appendChild(container);
        }

        // =============================================
        // URGENCIA: CIERRA PRONTO Y AUN TE FALTA TIEMPO
        // =============================================

        // Dos umbrales y no uno: "cierra hoy" y "cierra este fin de semana" se
        // deciden distinto, y un solo color los iguala. Van fijos a proposito —como
        // ajuste serian 16 traducciones, validacion y persistencia para un numero
        // que casi nadie tocaria.
        const URGENT_SOON_HOURS = 24;
        const URGENT_WARN_HOURS = 72;

        // Cuenta atras gruesa: para un cierre no importan los minutos salvo en la
        // ultima hora. formatHoursMinutes() sigue siendo la de los tiempos de
        // visualizacion, donde el minuto si cuenta.
        function _formatCountdown(totalMinutes) {
            const m = Math.max(0, Math.round(totalMinutes));
            if (m < 60) return `${m} min`;
            return `${Math.floor(m / 60)} h`;
        }

        // Minutos ya vistos. Twitch lo EXPONE dentro de cada tramo, pero el numero
        // es de la campaña, igual que en Kick. Verificado en un volcado real de
        // /drops/inventory: los 5 tramos de EWC 2026 (60/120/180/360/720 min)
        // marcaban 131 los cinco, y los 6 de Ignite MSF marcaban 75 los seis, con
        // dos ya reclamados. De ahi salen tres reglas:
        //   - reclamar un tramo NO reinicia el contador;
        //   - terminar una campaña cuesta el tramo mas alto que quede sin reclamar,
        //     NO la suma de los pendientes;
        //   - lo visto puede pasarse de lo requerido (131 > 120), asi que restar
        //     sin un Math.max(0, ...) daria negativos.
        // Devuelve null —no 0— mientras no haya llegado el inventario: decirle "te
        // faltan 10 h" a quien lleva 9 vistas es peor que no decir nada. Un drop
        // ausente del inventario si es un 0 real: la campaña no esta en curso, o sea
        // que no la has empezado.
        function _watchedMinutesFor(drop) {
            if (!_inventoryProgressReady) return null;
            const p = drop && drop.id ? _inventoryProgress[drop.id] : null;
            return p ? (Number(p.current) || 0) : 0;
        }

        // Recibe la entrada del API ({drops, endAt}) y no solo los drops: en Twitch
        // el cierre es de la campaña, no de cada recompensa. Devuelve
        // {level, minutesLeft, needed, minNeeded, feasible, unclaimed} o null si no
        // corre prisa.
        function _computeUrgency(entry) {
            if (!entry || !entry.endAt) return null;   // el fallback publico no trae fechas
            const now = Date.now();
            const end = Date.parse(entry.endAt);
            if (!Number.isFinite(end) || end <= now) return null;
            const minutesLeft = (end - now) / 60000;
            if (minutesLeft > URGENT_WARN_HOURS * 60) return null;

            // Solo cuenta lo que aun no es tuyo: una campaña cuyos tramos ya tienes
            // no tiene ninguna prisa, por mucho que cierre mañana. Se descarta solo
            // lo que CONSTA reclamado (true); mientras el indice no ha llegado,
            // _isDropClaimed devuelve null y el tramo sigue contando.
            const pending = (entry.drops || []).filter(d => _isDropClaimed(d) !== true);
            if (pending.length === 0) return null;

            // De los tramos que quedan se sacan DOS numeros, porque responden a
            // preguntas distintas y confundirlos es lo que hacia enganosa la linea:
            //   needed    = el mas caro -> lo que cuesta llevarse TODO lo que queda.
            //               Es el numero que se enseña: el minuto no cuenta si te
            //               dejas recompensas por el camino.
            //   minNeeded = el mas barato -> lo unico que decide si todavia se puede
            //               sacar algo. Si el mas barato no entra, ninguno entra, y
            //               por eso es el que manda en "no da tiempo".
            // Como el contador es por campaña y no por tramo, reclamar uno no reinicia
            // nada: el resto de cada tramo se mide siempre contra los mismos minutos
            // vistos. Por eso el total NO es la suma de los pendientes, sino el mas
            // alto. Se ignoran los de resto 0 (ganados y sin reclamar): ahi no falta
            // tiempo, falta pulsar, y eso se cuenta aparte.
            let needed = null;
            let minNeeded = null;
            let unclaimed = 0;
            for (const d of pending) {
                if (_isDropEarned(d) === true) unclaimed++;
                const watched = _watchedMinutesFor(d);
                if (watched === null) continue;
                const rest = Math.max(0, (Number(d.minutes) || 0) - watched);
                if (rest <= 0) continue;
                if (needed === null || rest > needed) needed = rest;
                if (minNeeded === null || rest < minNeeded) minNeeded = rest;
            }
            return {
                level: minutesLeft <= URGENT_SOON_HOURS * 60 ? 'soon' : 'warn',
                minutesLeft,
                needed,                                 // null = sin dato de progreso
                minNeeded,
                feasible: minNeeded === null ? null : minNeeded <= minutesLeft,
                // Lo que ya te ganaste y se pierde igual si no lo pulsas antes del
                // cierre. Es la unica parte del aviso que no depende de que te de
                // tiempo a nada: ese trabajo ya esta hecho.
                unclaimed
            };
        }

        function _urgencyColor(u) {
            return u.level === 'soon' ? colors.red : colors.orange;
        }

        function _urgencyText(u) {
            let txt = `⏳ ${t.urgentClosesIn || 'closes in'} ${_formatCountdown(u.minutesLeft)}`;
            if (u.needed !== null) {
                txt += ` · ${t.urgentNeed || 'you still need'} ${formatHoursMinutes(u.needed)}`;
                // El minimo solo cuando aporta, que es un caso concreto: llevarselo todo
                // ya no entra en el plazo, pero el tramo mas barato si. Ahi —y solo ahi—
                // "te faltan 5h" con un cierre en 4h se leeria como que no hay nada que
                // hacer, y todavia se puede salvar algo. Si el total entra, el minimo no
                // aporta; si no entra ni el minimo, ya lo dice "no da tiempo".
                if (u.minNeeded !== null && u.minNeeded < u.needed &&
                    u.needed > u.minutesLeft && u.minNeeded <= u.minutesLeft) {
                    // Solo es/en definen esta clave; los otros 14 idiomas caen al ingles
                    // por aqui, porque en este script `t` es i18n[lang] || i18n.en y no
                    // un merge: una clave ausente queda undefined, no la hereda.
                    txt += ` (${formatHoursMinutes(u.minNeeded)} ${t.urgentMinimum || i18n.en.urgentMinimum})`;
                }
            }
            if (u.feasible === false) txt += ` · ${t.urgentNoTime || 'not enough time'}`;
            if (u.unclaimed > 0) txt += ` · 🎁 ${u.unclaimed} ${t.urgentUnclaimed || 'unclaimed'}`;
            return txt;
        }

        // Clave de orden: cuanto antes cierre, mas arriba. Lo que no corre prisa se
        // va al final con Infinity y conserva el orden de la pagina, porque sort()
        // es estable.
        function _urgencySortKey(item) {
            const u = _computeUrgency(_findEntryForTitle(item && item.title));
            return u ? u.minutesLeft : Infinity;
        }

        // La linea va justo debajo de la cabecera —encima de las keywords y de los
        // badges— porque es lo que decide si la tarjeta te importa hoy.
        function _appendUrgencyTo(card, entry) {
            const u = _computeUrgency(entry);
            if (!u) return;
            const line = document.createElement("div");
            line.className = "drop-urgency";
            line.textContent = _urgencyText(u);
            Object.assign(line.style, {
                fontSize: "11px", fontWeight: "700", marginBottom: "4px",
                color: _urgencyColor(u),
                opacity: u.feasible === false ? "0.75" : "1"
            });
            card.insertBefore(line, card.children[1] || null);
        }

        // =============================================
        // FILTROS DE VISTA: QUE TARJETAS SE ENSEÑAN
        // =============================================

        // Una lente sobre el panel, no una segunda lista de keywords: no tocan el
        // resaltado de la pagina, ni las marcas de la tarjeta, ni las
        // notificaciones. Por eso se pueden encender y apagar sin consecuencias y
        // sin recargar.
        //
        // Se combinan en Y —todos los encendidos tienen que cumplirse—, que es lo
        // que se espera al ir sumando condiciones.
        //
        // Solo actuan sobre Activos a proposito: en Cerrados ya no queda ninguna
        // decision que tomar.

        // REGLA DE ORO: lo que no se puede juzgar NO se esconde. _isDropClaimed y
        // _isDropEarned devuelven null hasta que llega el inventario; si eso
        // contara como "no cumple", el panel apareceria vacio durante el arranque y
        // pareceria roto justo cuando el usuario acaba de entrar.
        function _passesViewFilter(id, entry) {
            const drops = (entry && entry.drops) || [];
            if (drops.length === 0) return true;
            switch (id) {
                case 'soon':
                    // Este se decide sin inventario, con la fecha de la campaña.
                    // Ojo: en el fallback publico no hay endAt y _computeUrgency
                    // devuelve null por falta de dato, no por falta de prisa; por
                    // eso el sin-fecha se deja pasar en vez de esconderse.
                    if (!entry || !entry.endAt) return true;
                    return _computeUrgency(entry) !== null;
                case 'unclaimed':
                    if (!_inventoryProgressReady) return true;
                    return drops.some(d => _isDropEarned(d) === true);
                case 'pending':
                    if (!_inventoryProgressReady) return true;
                    return drops.some(d => _isDropClaimed(d) !== true);
                case 'quick': {
                    // Lo barato que TE QUEDA: un tramo de 30 min ya reclamado no
                    // convierte la campaña en un rato corto.
                    const rest = drops.filter(d => _isDropClaimed(d) !== true);
                    return rest.some(d => {
                        const m = Number(d.minutes) || 0;
                        return m > 0 && m <= QUICK_MAX_MINUTES;
                    });
                }
                default:
                    return true;
            }
        }

        function _applyViewFilters(items) {
            const on = getViewFilters();
            if (on.length === 0) return items || [];
            return (items || []).filter(item => {
                const entry = _findEntryForTitle(item && item.title);
                return on.every(id => _passesViewFilter(id, entry));
            });
        }

        // =============================================
        // LO QUE TE QUEDA Y EN QUE ORDEN
        // =============================================

        // Minutos de visualizacion que te faltan de una campaña. Dos lecturas del
        // mismo dato, porque son dos preguntas distintas y cada una tiene su sitio:
        //   'max' = lo que cuesta llevarte TODO lo que queda, o sea el tramo
        //           pendiente mas caro. Es lo que enseña la ⏱ de la tarjeta.
        //   'min' = lo que cuesta sacar algo, o sea el tramo pendiente mas barato.
        //           Es lo que ordena "lo mas barato".
        //
        // El mas caro y no la suma de los pendientes, porque el contador de Twitch es
        // por campaña: los minutos que llevas cuentan para todos sus tramos a la vez.
        //
        // Ninguna de las dos mira fechas: es lo que cuesta, corra prisa o no. El
        // "te faltan" del aviso de cierre es otra cuenta y va por su lado.
        //
        // Tres valores con tres significados distintos, y hay que respetarlos:
        //   null = no se sabe (sin inventario) o no queda nada pendiente
        //   0    = ya te lo ganaste y solo falta pulsar
        //   >0   = minutos de visualizacion que te faltan
        function _remainingMinutes(drops, mode) {
            if (!drops || drops.length === 0) return null;
            let best = null;
            for (const d of drops) {
                if (_isDropClaimed(d) === true) continue;
                const watched = _watchedMinutesFor(d);
                // Sin minutos vistos no hay resta posible, y aqui no se inventa un
                // 0: decirle "te faltan 10 h" a quien lleva 9 vistas es peor que
                // no decir nada.
                if (watched === null) return null;
                const rest = Math.max(0, (Number(d.minutes) || 0) - watched);
                if (best === null) best = rest;
                else best = mode === 'max' ? Math.max(best, rest) : Math.min(best, rest);
            }
            return best;
        }

        // Lo mas barato primero, y barato es el tramo pendiente MINIMO: responde a
        // "¿que saco con el rato que tengo?", no a "¿que me cuesta terminarla?" —eso
        // lo dice la ⏱ de la tarjeta—. Por eso una campaña puede subir del todo
        // enseñando un ⏱ de 5 h: son dos cuentas distintas a proposito.
        //
        // Un tramo ya ganado vale 0 y sube del todo: no le falta tiempo, le falta un
        // clic. Lo que no se puede juzgar se va al final con Infinity y conserva el
        // orden de la pagina, porque sort() es estable —la misma regla que usa el
        // orden por urgencia—.
        function _cheapestSortKey(item) {
            const entry = _findEntryForTitle(item && item.title);
            const rest = _remainingMinutes(entry && entry.drops, 'min');
            return rest === null ? Infinity : rest;
        }

        // Devuelve una COPIA ordenada: el array original lo mantiene el escaneo de
        // la pagina y reordenarlo romperia la correspondencia con los nodos.
        function _sortActive(items) {
            const key = getSortMode() === 'cheapest' ? _cheapestSortKey : _urgencySortKey;
            return [...(items || [])].sort((a, b) => key(a) - key(b));
        }

        // Aqui vivia checkAndHandleScriptVersion, que al cambiar la @version borraba
        // TODAS las notificaciones. Borrar por publicar no tiene nada que ver con lo
        // que el aviso dice —que una campaña cambio—, asi que una release cualquiera
        // te tiraba avisos que no habias visto. Del volumen ya se encargan los topes
        // de pruneNotifications (60 dias / 200 entradas), y para vaciarlas a mano
        // sigue estando el boton de «Recargar drops».
        const LEGACY_VERSION_KEY = 'twitch_drop_script_version';

        function setInventoryExpiredFlag(value) {
            GM_setValue(SHOW_HIDE_INVENTORY_EXPIRED, value);
        }

        function setInventoryActiveFlag(value) {
            GM_setValue(SHOW_HIDE_INVENTORY_ACTIVE, value);
        }

        function getCollapseFlag() {
            const stored = GM_getValue(COLLAPSE_KEY, false);
            if (stored === undefined) return false;
            return stored;
        }

        function setCollapseFlag(value) {
            GM_setValue(COLLAPSE_KEY, value);
        }

        // Initialize flags if not existing
        if (GM_getValue(SHOW_HIDE_INVENTORY_EXPIRED) === undefined) setInventoryExpiredFlag(false);
        if (GM_getValue(SHOW_HIDE_INVENTORY_ACTIVE) === undefined) setInventoryActiveFlag(false);
        if (GM_getValue(COLLAPSE_KEY) === undefined) setCollapseFlag(false);

        // =============================================
        // ESTADO LOCAL DE LA APLICACION
        // =============================================

        let keywords = getStoredKeywords();
        let deletedInventoryDrops = getInventoryDeletedKeys();
        let cleanExpiredInventoryFlag = GM_getValue(SHOW_HIDE_INVENTORY_EXPIRED, false);
        let cleanActiveInventoryFlag = GM_getValue(SHOW_HIDE_INVENTORY_ACTIVE, false);
        let _notificationSoundInterval = null;

        // La clave que llevaba la cuenta de la version ya no la lee nadie: se borra
        // una vez para no dejarla ahi para siempre en quien viene de una version
        // anterior. Mismo gesto que con LEGACY_GQL_STORAGE_KEY.
        try { GM_deleteValue(LEGACY_VERSION_KEY); } catch (e) { /* noop */ }

        // Fetch drops from public API on load
        fetchDropsFromAPI();
        // Fetch inventory progress (currentMinutesWatched / requiredMinutesWatched) for tooltips
        fetchInventoryProgress();

        // =============================================
        // FUNCIONES DE AUDIO / NOTIFICACION SONORA
        // =============================================

        // Aqui vivian las notificaciones de ESCRITORIO: se pedia permiso al cargar
        // —un cuadro del navegador nada mas entrar en Twitch, sin haber pedido nada—
        // y luego se lanzaba una notificacion nativa, con GM_notification de respaldo.
        // Se van enteras. Lo que avisa de un cambio sigue siendo el 🔔 del panel, el
        // contador en el titulo de la pestaña y el pitido; todo eso vive DENTRO de la
        // pagina, que es donde el aviso significa algo. Con ellas se va el permiso que
        // se pedia y el @grant GM_notification.

        function playBeep() {
            try {
                const audio = new Audio('data:audio/wav;base64,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3RPrMZfk5nDh/zhdOlw/LAMEyzlgNW9E4o3MC6ilutSmtbmBVZSv/////jkf/PFs///5eJQv5eIcHuzp4AkAstsCAJiDYsrTeCDIw3MGDGqhwBpqwTOQwCWChjUMGOWMgzVjIP8I//uSZEyM03xVyotZokBZaplyaoeECsFTNEy0VMGmKiQBrbT4AgOhzvgZeCGFfOK6o54sWUKRqNcsU9Tsypp80gNzqq6//lv///////////KeUCQsgeCSUsHAwcLNoHkJb4ipZEAYEAeM/iz5mHQ5R/g5dbAAFgSnYS0C5n92liCJwOR2Wp26N/9aOiG47tWPbo6Lu1KtojazFV//////qf/83//44+DBAQ7lEo8vsaacJ1zMmTQlDNJjF006MoODayuYQbJkExMTPHVCsRUZKxw84AKwDxGaFbW2Vd3/5gICbssmbganDkwZBvjrHQRgdY6SKRBhfIxGIw6YjcdPy2VoqT7vt//////////////AVhHqDCgFDDnmDHAVUm6VigBYbAGwgh1TkREwOncIA2qmGFB42s5cGBwwyn4RxyUDxmt1orsrdupFV3UGq0uoWb7nyf75VmabV0/////1Cf/V///wHwMd/h0CYACIJxCIjI0QUZMMMK8QmnNibEJ1q4gAneANWVIIwwNUtKf1AgVrf///xDsh6ZpeUl65epbkUv/7kmRHDPKeVEwLMBRUUeqJUGgN5gx1UyoNZgkBSZElAammSOfdp/u3Pp6ahpKb7v0tJ////////jMFk/whRH2MmY1ApsIERYBmbJmYFnAaiWAmaFgBYJ0g1ILjhqCnZ9LKeU+OglZVLcx/FyAjQ6MdpePz53njv584XD506gsNQoIWFJP6P/7dlJVs/Zf///+p9yi3/olv//+f4s0hh2NFgqAi5p0wRULAIFTwQzBJM4YI3ag7joyyorBjKALsxYAgqFw53VCn/gwa3fBnE0A73BFA4dLpz0g+m5yFznfov3u6FP96T/+m6bBzfJHlpqANwAAAB4AhtRY6Wx2hCxdwgBMQBMcx7C+oOrS8U5ZyAoHKLIrSACMHeomha/n8fgF8CfC+Xjp+fqN636KVBnrOFATabqWo4OStqU1bo6LT+1KN///////xv//8YN40AXjIQwsQZKodKmacAQU2DhDiLCShy1YKJeKiTZmmTv4Ogx8oyVqkGIRcniVA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xF0yw9M0pdNMPatKXTTNWsSl0sTVrEpVq0oeAKFTYdQeADHjgqIlKiUtKoNWqSmSkhyWlQrKiqCAUHiMkNu3Lv//Yyu6nDYyVSSuH8VlSxZeE6iiKjRYupOlSIQjQ0XUXpMsVGhougbduXVX////6oi2MIiQRCgoJiAOGlMdqAUAWhLhXyWHGoFOfBsmyiFeYfSpYZOlEbA6tZPzVgoIE6H7BQQJwy7oBkKiweiwuI3fWKNxYV/ircWF2frFOLCusUbiotiwuz+KcWFVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//uSRPyOw0JVP4NgbzKcSqgxbYioSOlKyCSAvoEzC9tE9I1QVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVRBR3d3dy52b2ljeS5uZXR3b3JrAAAAAAAAAAAAAAAAAHd3dy52b2ljeS5uZXR3b3JrAAAAAAAAAAAAAAAAAHd3dy52b2ljeS5uZXR3b3JrAAAAAAAAAAAAAAAAADIwMjIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/');
                audio.volume = NOTIFICATION_VOLUME;
                audio.play().catch(() => { });
            } catch (ee) { /* noop */ }
        }

        function startNotificationSound() {
            if (_notificationSoundInterval) return;
            playBeep();
            _notificationSoundInterval = setInterval(() => playBeep(), NOTIFICATION_BEEP_INTERVAL_MS);
        }

        function stopNotificationSound() {
            if (_notificationSoundInterval) {
                clearInterval(_notificationSoundInterval);
                _notificationSoundInterval = null;
            }
        }

        function updateNotificationTitleAndSound() {
            try {
                const notifs = getNotifications();
                const pending = notifs.filter(n => !n.seen && n.changed).length;

                // Update tab badge
                const tabNotifs = document.getElementById("twitch-drops-tab-notifs");
                if (tabNotifs) {
                    tabNotifs.textContent = `${t.changedIcon || "🔔"} (${pending})`;
                    tabNotifs.style.color = pending > 0 ? colors.orange : colors.gray;
                }

                if (pending > 0) {
                    startNotificationSound();
                    setTimeout(() => {
                        document.title = `(${pending}) ${ORIGINAL_TITLE}`;
                    }, 100);
                } else {
                    stopNotificationSound();
                    setTimeout(() => {
                        if (document.title.startsWith('(')) document.title = ORIGINAL_TITLE;
                    }, 1000);
                }
            } catch (e) {
                console.warn('Error actualizando titulo/sonido:', e);
            }
        }

        // =============================================
        // GESTION DE DATOS DE NOTIFICACIONES
        // =============================================

        function markNotificationSeen(identifier) {
            const notifs = getNotifications();
            let changed = false;
            // Extraer titulo del key (formato: "titulo|id") para fallback por titulo
            const titleFromKey = (identifier && identifier.includes('|')) ? identifier.split('|').slice(0, -1).join('|') : identifier;
            for (const n of notifs) {
                if (n.seen) continue;
                // Match por key exacto, por titulo del key, o por titulo directo
                if (n.key === identifier || n.title === titleFromKey || n.title === identifier) {
                    n.seen = true;
                    n.updatedAt = Date.now();
                    changed = true;
                }
            }
            if (changed) saveNotifications(notifs);
            updateNotificationTitleAndSound();
        }

        function markAllNotificationsSeen() {
            const notifs = getNotifications();
            let changed = false;
            for (const n of notifs) {
                if (!n.seen && n.changed) {
                    n.seen = true;
                    n.updatedAt = Date.now();
                    changed = true;
                }
            }
            if (changed) saveNotifications(notifs);
            updateNotificationTitleAndSound();
        }

        function deleteNotificationsByKeyword(keyword) {
            const notifs = getNotifications();
            const filtered = [];
            for (const n of notifs) {
                if (!n.title.toLowerCase().includes(keyword)) {
                    filtered.push(n);
                }
            }
            saveNotifications(filtered);
            updateNotificationTitleAndSound();
        }

        // Deja solo las notificaciones que siguen casando con la lista dada. Se
        // llama tambien al AÑADIR una keyword, no solo al editarlas en bloque:
        // añadir una negativa tiene que llevarse por delante las notificaciones de
        // lo que acaba de quedar descartado. Para una positiva es inofensivo, no
        // hay nada guardado que deje de casar.
        function removeNotificationsNotInKeywords(list) {
            const { positive, negative } = _splitKeywords(list);
            const notifs = getNotifications();
            const filtered = [];
            for (const n of notifs) {
                const title = (n.title || '').toLowerCase();
                if (negative.some(kw => title.includes(kw))) continue;
                if (positive.some(kw => title.includes(kw))) filtered.push(n);
            }
            saveNotifications(filtered);
            updateNotificationTitleAndSound();
        }

        // =============================================
        // HELPERS GENERICOS DE UI (MODALES, BOTONES)
        // =============================================

        function createButton(label, color, onClick, inline = false) {
            const btn = document.createElement("button");
            btn.textContent = label;
            Object.assign(btn.style, {
                padding: "6px 10px",
                backgroundColor: colors.surface,
                color: color,
                border: `1px solid ${color}`,
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
                marginTop: inline ? "10px" : "0"
            });
            btn.onmouseenter = () => { btn.style.opacity = "0.8"; };
            btn.onmouseleave = () => { btn.style.opacity = "1"; };
            btn.onclick = onClick;
            return btn;
        }

        function setInertOnBodyChildrenExcept(overlay, inert) {
            if (inert) {
                const saved = [];
                Array.from(document.body.children).forEach((el) => {
                    if (el === overlay) return;
                    saved.push({ el, ariaHidden: el.getAttribute('aria-hidden'), tabIndex: el.hasAttribute('tabindex') ? el.tabIndex : null });
                    try {
                        el.setAttribute('aria-hidden', 'true');
                        el.inert = true;
                    } catch (e) { /* noop */ }
                });
                overlay._savedInert = saved;
            } else {
                const saved = overlay._savedInert || [];
                saved.forEach((s) => {
                    try {
                        if (s.ariaHidden === null) s.el.removeAttribute('aria-hidden');
                        else s.el.setAttribute('aria-hidden', s.ariaHidden);
                    } catch (e) { /* noop */ }
                    try {
                        if (s.tabIndex === null) s.el.removeAttribute('tabindex');
                        else s.el.tabIndex = s.tabIndex;
                        s.el.inert = false;
                    } catch (e) { /* noop */ }
                });
                overlay._savedInert = null;
            }
        }

        function closeOverlayAnimated(overlay) {
            return new Promise((resolve) => {
                try {
                    overlay.style.opacity = '0';
                    const box = overlay.firstChild;
                    if (box) {
                        box.style.transform = 'translateY(-8px) scale(0.98)';
                        box.style.opacity = '0';
                    }
                } catch (e) { /* noop */ }
                setTimeout(() => {
                    try {
                        if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
                    } catch (e) { /* noop */ }
                    try { setInertOnBodyChildrenExcept(overlay, false); } catch (e) { /* noop */ }
                    resolve();
                }, 220);
            });
        }

        /**
         * attachDismissHandlers(overlay, close)
         *
         * Cierre por Escape y por clic fuera. Solo para los modales INFORMATIVOS —el
         * detalle del drop y el ℹ️—: los de decision (input, confirmar, aviso) no lo
         * llevan a proposito, porque ahi un clic fuera perderia lo escrito o dejaria la
         * pregunta contestada a medias. Esos cierran con Escape sobre sus propios
         * elementos, que es suficiente porque enfocan algo al abrir.
         *
         * Devuelve detach(), y hay que llamarlo TAMBIEN desde el boton de cerrar. El
         * listener de Escape vive en document —no queda mas remedio: el modal de
         * informacion no enfoca nada y el resto de la pagina esta inert, asi que no hay
         * ningun elemento suyo que pueda recibir la tecla—, y un listener en document que
         * no se quita sobrevive al modal y se acumula uno por cada apertura.
         */
        function attachDismissHandlers(overlay, close) {
            const detach = () => {
                document.removeEventListener('keydown', onKey);
                overlay.removeEventListener('click', onClick);
            };
            const onKey = (ev) => {
                if (ev.key !== 'Escape') return;
                detach();
                close();
            };
            const onClick = (ev) => {
                // Solo el fondo: un clic dentro de la caja no debe cerrar.
                if (ev.target !== overlay) return;
                detach();
                close();
            };
            document.addEventListener('keydown', onKey);
            overlay.addEventListener('click', onClick);
            return detach;
        }

        function createModalContainer() {
            const overlay = document.createElement('div');
            Object.assign(overlay.style, {
                position: 'fixed', left: '0', top: '0', width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                // El padding reserva el hueco contra el que se acota el modal (maxHeight/
                // maxWidth al 100%), y de paso evita que quede pegado a los bordes.
                padding: '24px', boxSizing: 'border-box',
                backgroundColor: 'rgba(0,0,0,0.6)', zIndex: '99999',
                transition: 'opacity 180ms ease', opacity: '0'
            });
            const box = document.createElement('div');
            Object.assign(box.style, {
                backgroundColor: colors.surface, color: colors.text, borderRadius: '14px',
                // minWidth fijo desbordaba por el eje horizontal en ventanas estrechas; con
                // min() se mantiene en 340px mientras quepa y se encoge cuando no.
                padding: '28px 32px', minWidth: 'min(340px, 100%)', maxWidth: '520px',
                // Sin tope de altura, un modal con mucho contenido (el de informacion lo es:
                // el aviso de privacidad ocupa un parrafo largo) crece por encima de la
                // ventana. Y como el overlay centra con align-items:center, lo que se sale
                // se sale por ARRIBA y por abajo a la vez, y la parte de arriba no se puede
                // recuperar con scroll. El padding del overlay ya reserva el margen; 100% es
                // su area de contenido. border-box para que el padding de la caja no se sume
                // a ese 100% y lo desborde.
                maxHeight: '100%', overflowY: 'auto', boxSizing: 'border-box',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: `1px solid ${colors.purple}`,
                fontFamily: 'Inter, system-ui, sans-serif', fontSize: '14px',
                transition: 'transform 180ms ease, opacity 180ms ease',
                transform: 'translateY(8px) scale(0.98)', opacity: '0'
            });
            overlay.appendChild(box);
            return { overlay, box };
        }

        function showInputModal(message, defaultValue = '') {
            return new Promise((resolve) => {
                const { overlay, box } = createModalContainer();
                const msg = document.createElement('div');
                msg.textContent = message;
                msg.style.marginBottom = '8px';
                box.appendChild(msg);

                const input = document.createElement('input');
                input.type = 'text';
                input.value = defaultValue || '';
                Object.assign(input.style, {
                    width: '100%', padding: '8px', marginBottom: '10px',
                    boxSizing: 'border-box', borderRadius: '4px',
                    border: `1px solid ${colors.purple}`,
                    background: colors.bg, color: colors.text
                });
                box.appendChild(input);

                const actions = document.createElement('div');
                actions.style.display = 'flex';
                actions.style.justifyContent = 'center';
                actions.style.gap = '8px';

                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = t.cancel || 'Cancel';
                Object.assign(cancelBtn.style, {
                    padding: '6px 10px', backgroundColor: colors.surface,
                    color: colors.red, border: `1px solid ${colors.red}`, borderRadius: '6px', cursor: 'pointer'
                });
                cancelBtn.onclick = () => { closeOverlayAnimated(overlay).then(() => resolve(null)); };

                const okBtn = document.createElement('button');
                okBtn.textContent = t.accept || 'Accept';
                Object.assign(okBtn.style, {
                    padding: '6px 10px', backgroundColor: colors.surface,
                    color: colors.purple, border: `1px solid ${colors.purple}`, borderRadius: '6px', cursor: 'pointer'
                });
                okBtn.onclick = () => {
                    const v = input.value;
                    closeOverlayAnimated(overlay).then(() => resolve(v));
                };

                actions.appendChild(cancelBtn);
                actions.appendChild(okBtn);
                box.appendChild(actions);

                // focus trap
                const focusable = [input, cancelBtn, okBtn];
                let fi = 0;
                focusable.forEach((el, idx) => el.tabIndex = idx + 1);
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); okBtn.click(); }
                    if (e.key === 'Escape') { e.preventDefault(); cancelBtn.click(); }
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        if (e.shiftKey) fi = (fi - 1 + focusable.length) % focusable.length;
                        else fi = (fi + 1) % focusable.length;
                        focusable[fi].focus();
                    }
                });
                [cancelBtn, okBtn].forEach((el) => el.addEventListener('keydown', (e) => {
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        if (e.shiftKey) fi = (fi - 1 + focusable.length) % focusable.length;
                        else fi = (fi + 1) % focusable.length;
                        focusable[fi].focus();
                    }
                    if (e.key === 'Escape') { e.preventDefault(); cancelBtn.click(); }
                }));

                document.body.appendChild(overlay);
                try { setInertOnBodyChildrenExcept(overlay, true); } catch (e) { /* noop */ }
                setTimeout(() => {
                    overlay.style.opacity = '1';
                    try { box.style.transform = 'translateY(0) scale(1)'; box.style.opacity = '1'; } catch (e) { }
                }, 10);
                setTimeout(() => input.focus(), 120);
            });
        }

        function showConfirmModal(message) {
            return new Promise((resolve) => {
                const { overlay, box } = createModalContainer();
                const msg = document.createElement('div');
                msg.textContent = message;
                msg.style.marginBottom = '12px';
                box.appendChild(msg);

                const actions = document.createElement('div');
                actions.style.display = 'flex';
                actions.style.justifyContent = 'center';
                actions.style.gap = '8px';

                const noBtn = document.createElement('button');
                Object.assign(noBtn.style, {
                    padding: '6px 10px', backgroundColor: colors.surface,
                    color: colors.red, border: `1px solid ${colors.red}`, borderRadius: '6px', cursor: 'pointer'
                });
                noBtn.textContent = t.no || 'No';
                noBtn.onclick = () => { closeOverlayAnimated(overlay).then(() => resolve(false)); };

                const yesBtn = document.createElement('button');
                Object.assign(yesBtn.style, {
                    padding: '6px 10px', backgroundColor: colors.surface,
                    color: colors.purple, border: `1px solid ${colors.purple}`, borderRadius: '6px', cursor: 'pointer'
                });
                yesBtn.textContent = t.yes || 'Yes';
                yesBtn.onclick = () => { closeOverlayAnimated(overlay).then(() => resolve(true)); };

                actions.appendChild(noBtn);
                actions.appendChild(yesBtn);
                box.appendChild(actions);

                // focus trap
                const focusable = [noBtn, yesBtn];
                let fi = 0;
                focusable.forEach((el, idx) => el.tabIndex = idx + 1);
                focusable.forEach((el) => el.addEventListener('keydown', (e) => {
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        if (e.shiftKey) fi = (fi - 1 + focusable.length) % focusable.length;
                        else fi = (fi + 1) % focusable.length;
                        focusable[fi].focus();
                    }
                    if (e.key === 'Escape') { e.preventDefault(); noBtn.click(); }
                }));

                document.body.appendChild(overlay);
                try { setInertOnBodyChildrenExcept(overlay, true); } catch (e) { /* noop */ }
                setTimeout(() => {
                    overlay.style.opacity = '1';
                    try { box.style.transform = 'translateY(0) scale(1)'; box.style.opacity = '1'; } catch (e) { }
                }, 10);
                setTimeout(() => yesBtn.focus(), 120);
            });
        }

        // Siempre textContent: el flag html que tenia esta funcion no lo usaba
        // nadie y solo dejaba un sink de inyeccion esperando al primer llamador
        // que le pasara texto venido de la pagina.
        function showAlertModal(message) {
            return new Promise((resolve) => {
                const { overlay, box } = createModalContainer();
                const msg = document.createElement('div');
                msg.textContent = message;
                msg.style.marginBottom = '12px';
                box.appendChild(msg);

                const actions = document.createElement('div');
                actions.style.display = 'flex';
                actions.style.justifyContent = 'center';

                const okBtn = document.createElement('button');
                Object.assign(okBtn.style, {
                    padding: '6px 10px', backgroundColor: colors.surface,
                    color: colors.purple, border: `1px solid ${colors.purple}`, borderRadius: '6px', cursor: 'pointer'
                });
                okBtn.textContent = t.accept || 'Accept';
                okBtn.onclick = () => { closeOverlayAnimated(overlay).then(() => resolve()); };
                okBtn.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') { e.preventDefault(); okBtn.click(); }
                });

                actions.appendChild(okBtn);
                box.appendChild(actions);
                okBtn.tabIndex = 1;

                document.body.appendChild(overlay);
                try { setInertOnBodyChildrenExcept(overlay, true); } catch (e) { /* noop */ }
                setTimeout(() => {
                    overlay.style.opacity = '1';
                    try { box.style.transform = 'translateY(0) scale(1)'; box.style.opacity = '1'; } catch (e) { }
                }, 10);
                setTimeout(() => okBtn.focus(), 120);
            });
        }

        // =============================================
        // COMPONENTES DE UI ESPECIFICOS
        // =============================================

        function createEditKeywordsButton(inline = false) {
            return createButton(t.editKeywords, colors.purple, () => {
                (async () => {
                    const current = getStoredKeywords().join(", ");
                    const input = await showInputModal(t.editPrompt + " — " + (t.negativeKeywordHint || ''), current);
                    if (input !== null) {
                        const newKeywords = input.split(",").map((k) => k.trim().toLowerCase()).filter((k) => k.length > 0);
                        setStoredKeywords(newKeywords);
                        removeNotificationsNotInKeywords(newKeywords);
                        showAlertModal(t.keywordsModified + newKeywords.join(", ") + "\n" + t.reloading);
                        setCollapseFlag(false);
                        setTimeout(() => location.reload(), 1500);
                    }
                })();
            }, inline);
        }

        function createResetKeywordsButton(inline = false) {
            return createButton(t.resetKeywords, colors.orange, () => {
                (async () => {
                    const ok = await showConfirmModal(t.confirmReset);
                    if (ok) {
                        resetKeywords();
                        resetInventoryDeletedKeys();
                        resetNotifications();
                        showAlertModal(t.keywordsRestored);
                        setCollapseFlag(false);
                        setTimeout(() => location.reload(), 1500);
                    }
                })();
            }, inline);
        }

        function createReloadButton(inline = false) {
            return createButton(t.reload, colors.gray, () => {
                setCollapseFlag(false);
                resetInventoryDeletedKeys();
                resetNotifications();
                if (!location.pathname.includes("/campaigns")) {
                    location.href = "https://www.twitch.tv/drops/campaigns";
                } else {
                    location.reload();
                }
            }, inline);
        }

        function getAddKeyword() {
            const addBtn = document.createElement("button");
            addBtn.textContent = t.addButton || "+";
            Object.assign(addBtn.style, {
                color: colors.purple,
                cursor: "pointer",
                border: "1px solid " + colors.purple,
                backgroundColor: colors.surface,
                borderRadius: "4px",
                padding: "2px 6px",
                fontWeight: "bold",
                fontSize: "11px"
            });
            addBtn.title = t.addKeyword + " · " + (t.negativeKeywordHint || '');
            addBtn.onclick = () => {
                (async () => {
                    const newKeyword = await showInputModal(t.addKeyword + " — " + (t.negativeKeywordHint || ''));
                    if (newKeyword) {
                        const k = newKeyword.trim().toLowerCase();
                        if (k && k !== '-' && !keywords.includes(k)) {
                            keywords.push(k);
                            setStoredKeywords(keywords);
                            removeNotificationsNotInKeywords(keywords);
                            setCollapseFlag(false);
                            location.reload();
                        }
                    }
                })();
            };
            return addBtn;
        }

        // ---------------------------------------------
        // Barra de filtros de vista
        // ---------------------------------------------
        // Va pegada a las pestañas y no a las keywords: filtra lo que las keywords
        // ya encontraron, no cambia que se busca. Encender un chip no recarga la
        // pagina —solo repinta el panel—, que es justo lo que separa un filtro de
        // vista de una keyword.

        function _paintFilterChip(chip, on) {
            chip.style.backgroundColor = on ? colors.purple : colors.bg;
            chip.style.color = on ? "#ffffff" : colors.gray;
            chip.style.borderColor = on ? colors.purple : colors.border;
            chip.style.fontWeight = on ? "700" : "400";
        }

        // Repinta el panel con los arrays del ultimo escaneo. Los nombres de drop y
        // la linea de urgencia se re-inyectan aparte porque renderResults crea
        // tarjetas nuevas y esas dos cosas se cuelgan de ellas despues.
        function _rerenderPanes() {
            const results = document.getElementById("twitch-drops-results");
            if (!results) return;
            renderResults(results, active, expired);
            _updateAllCardsWithDropNames();
        }

        // Los datos llegan tarde y por DOS vias independientes —las campañas por GQL y
        // el inventario por su propia consulta—, asi que el primer pintado del panel se
        // hace casi siempre a ciegas. Repintar solo las tarjetas NO basta: el orden, los
        // filtros y la cuenta de la pestaña se DECIDEN en renderResults, y sin volver a
        // pasar por ahi se quedan congelados. Ese era el fallo al recargar: badges y ✓
        // recien puestos conviviendo con el orden de la pagina y un "(13/14)" de un
        // filtro que ya solo deja pasar tres.
        function _refreshPanelAfterLateData() {
            // Sin escaneo todavia no hay tarjetas que reordenar, y renderResults pintaria
            // un "no hay resultados" de un instante. El primer render ya vendra con estos
            // datos, asi que aqui basta con el parcheo (que ademas no hace nada).
            //
            // Salvo que la API ya haya llegado: entonces SI hay tarjetas que pintar
            // aunque el DOM no diera ninguna, que es justo lo que pasa en el inventario.
            // Con el atajo puesto sin esta salvedad, el panel se quedaba en blanco ahi.
            if (active.length === 0 && expired.length === 0 && !_apiDataReady) {
                _updateAllCardsWithDropNames();
                return;
            }
            _rerenderPanes();
        }

        function clearViewFilters() {
            setViewFilters([]);
            document.querySelectorAll(".twitch-view-filter").forEach(c => _paintFilterChip(c, false));
            _rerenderPanes();
        }

        function createViewFilterBar() {
            const row = document.createElement("div");
            Object.assign(row.style, {
                display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "10px"
            });
            const defs = [
                { id: 'pending', label: "☑ " + (t.filterPending || "Something left") },
                { id: 'soon', label: "⏳ " + (t.filterSoon || "Closing soon") },
                { id: 'unclaimed', label: "🎁 " + (t.filterUnclaimed || "Unclaimed") },
                { id: 'quick', label: "⚡ " + (t.filterQuick || "1 h or less") }
            ];
            const on = getViewFilters();
            defs.forEach(def => {
                const chip = document.createElement("span");
                chip.className = "twitch-view-filter";
                chip.setAttribute("data-filter-id", def.id);
                chip.textContent = def.label;
                chip.title = t.filterBarHint || '';
                Object.assign(chip.style, {
                    padding: "2px 8px", borderRadius: "12px", fontSize: "11px",
                    cursor: "pointer", transition: "all 0.15s", userSelect: "none",
                    border: `1px solid ${colors.border}`
                });
                _paintFilterChip(chip, on.includes(def.id));
                chip.onclick = () => {
                    const current = getViewFilters();
                    const next = current.includes(def.id)
                        ? current.filter(x => x !== def.id)
                        : current.concat(def.id);
                    setViewFilters(next);
                    _paintFilterChip(chip, next.includes(def.id));
                    _rerenderPanes();
                };
                row.appendChild(chip);
            });
            return row;
        }

        // ---------------------------------------------
        // Barra de orden
        // ---------------------------------------------
        // Dos chips excluyentes, no un desplegable: son dos y se ve de un vistazo
        // cual manda. Comparten pintado con los filtros para que se lean como la
        // misma familia, pero se comportan como una radio.
        function createSortBar() {
            const row = document.createElement("div");
            Object.assign(row.style, {
                display: "flex", flexWrap: "wrap", gap: "4px",
                alignItems: "center", marginBottom: "10px"
            });
            const label = document.createElement("span");
            label.textContent = t.sortLabel || "Sort:";
            Object.assign(label.style, { fontSize: "11px", color: colors.gray, marginRight: "2px" });
            row.appendChild(label);

            // El tooltip va solo en "lo mas barato" porque es la unica de las dos
            // que sorprende: ordena por el tramo pendiente MINIMO mientras la ⏱ de
            // la tarjeta enseña el MAXIMO, asi que la primera de la lista puede
            // llevar un ⏱ de 5 h y parecer un error. La de urgencia ordena por
            // fecha y nadie espera que coincida con un tiempo, no necesita nota.
            const defs = [
                { id: 'urgent', label: "⏳ " + (t.sortUrgent || "Closing first") },
                { id: 'cheapest', label: "⏱ " + (t.sortCheapest || "Cheapest first"),
                  hint: t.sortCheapestHint || i18n.en.sortCheapestHint }
            ];
            const current = getSortMode();
            defs.forEach(def => {
                const chip = document.createElement("span");
                chip.className = "twitch-sort-mode";
                chip.setAttribute("data-sort-id", def.id);
                chip.textContent = def.label;
                if (def.hint) chip.title = def.hint;
                Object.assign(chip.style, {
                    padding: "2px 8px", borderRadius: "12px", fontSize: "11px",
                    cursor: "pointer", transition: "all 0.15s", userSelect: "none",
                    border: `1px solid ${colors.border}`
                });
                _paintFilterChip(chip, current === def.id);
                chip.onclick = () => {
                    if (getSortMode() === def.id) return;
                    setSortMode(def.id);
                    document.querySelectorAll(".twitch-sort-mode").forEach(c => {
                        _paintFilterChip(c, c.getAttribute("data-sort-id") === def.id);
                    });
                    _rerenderPanes();
                };
                row.appendChild(chip);
            });
            return row;
        }

        // ---------------------------------------------
        // Aviso de que falta el inventario
        // ---------------------------------------------
        // Sin el inventario desaparecen en silencio los ✓, los 🎁, el "te faltan"
        // y los filtros de estado dejan pasar todo. Callarselo hace que el panel
        // parezca simplemente un dia sin novedades, que es lo contrario de lo que
        // pasa: es un panel que no sabe nada de ti.
        function _updateInventoryWarning() {
            const el = document.getElementById("twitch-drops-inventory-warning");
            if (!el) return;
            el.style.display = _inventoryProgressReady ? "none" : "flex";
        }

        function _scheduleInventoryWarning() {
            setTimeout(_updateInventoryWarning, INVENTORY_WARN_DELAY_MS);
        }

        function createInventoryWarning() {
            const el = document.createElement("div");
            el.id = "twitch-drops-inventory-warning";
            Object.assign(el.style, {
                // Arranca escondido siempre: lo enciende el temporizador, no el
                // estado del momento, para no parpadear durante el arranque.
                display: "none",
                alignItems: "center", gap: "6px",
                padding: "6px 8px", marginBottom: "6px",
                backgroundColor: colors.orange + "15",
                border: `1px solid ${colors.orange}40`,
                borderRadius: "6px", fontSize: "11px",
                color: colors.orange
            });
            const icon = document.createElement("span");
            icon.textContent = "⚠";
            el.appendChild(icon);
            el.appendChild(document.createTextNode(
                t.noInventoryData || "No inventory: what you own and what you have watched are unknown."
            ));
            return el;
        }

        function createInventoryCheckboxes(inline = false) {
            const container = document.createElement('div');
            Object.assign(container.style, {
                display: 'flex', flexDirection: 'column', gap: '6px',
                marginTop: inline ? '10px' : '0'
            });

            const makeCheckbox = (id, labelText, initial, onChange) => {
                const wrapper = document.createElement('label');
                wrapper.style.display = 'flex';
                wrapper.style.alignItems = 'center';
                wrapper.style.gap = '6px';
                wrapper.style.cursor = 'pointer';

                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.id = id;
                cb.checked = !!initial;
                cb.style.width = '14px';
                cb.style.height = '14px';
                cb.style.accentColor = colors.purple;

                const txt = document.createElement('span');
                txt.textContent = labelText;
                txt.style.fontSize = '11px';
                txt.style.color = colors.text;

                cb.onchange = () => onChange(cb.checked);
                wrapper.appendChild(cb);
                wrapper.appendChild(txt);
                return wrapper;
            };

            const expiredCb = makeCheckbox('cb-hide-expired', t.hideExpired, cleanExpiredInventoryFlag, (checked) => {
                setInventoryExpiredFlag(checked);
                cleanExpiredInventoryFlag = checked;
                if (location.pathname.includes('/inventory')) {
                    if (checked) { cleanInventory("expired"); } else { setCollapseFlag(false); location.reload(); }
                }
            });

            const activeCb = makeCheckbox('cb-hide-active', t.hideActive, cleanActiveInventoryFlag, (checked) => {
                setInventoryActiveFlag(checked);
                cleanActiveInventoryFlag = checked;
                if (location.pathname.includes('/inventory')) {
                    if (checked) { cleanInventory("active"); } else { setCollapseFlag(false); location.reload(); }
                }
            });

            container.appendChild(expiredCb);
            return container;
        }

        function showInfoModal() {
            const { overlay, box } = createModalContainer();
            // Este modal es el unico con contenido de largo imprevisible (la descripcion
            // es un parrafo entero), asi que en vez de dejar que scrollee la caja entera
            // —lo que se llevaria el titulo y obligaria a bajar hasta el final para
            // encontrar el boton de cerrar— scrollea solo el cuerpo.
            Object.assign(box.style, {
                display: 'flex', flexDirection: 'column', overflowY: 'hidden'
            });
            const body = document.createElement('div');
            Object.assign(body.style, {
                overflowY: 'auto', minHeight: '0', paddingRight: '4px'
            });
            const lines = [
                { label: t.scriptInfoName, value: "Twitch Drops Highlighter + Keywords (Full + i18n)" },
                { label: t.scriptInfoVersion, value: SCRIPT_VERSION },
                { label: t.scriptInfoDescription, value: t.scriptInfoDescriptionText },
                { label: t.scriptInfoAuthor, value: "g31w0fw0rld" },
                { label: t.scriptInfoGitHub, value: "github.com/g31w0fw0rld/twitch-drops-highlighter", isLink: true },
                // Solo es/en tienen texto propio de privacidad; el resto cae al ingles.
                {
                    label: t.scriptInfoPrivacy || i18n.en.scriptInfoPrivacy,
                    value: t.scriptInfoPrivacyText || i18n.en.scriptInfoPrivacyText
                },
                { label: "☕ Ko-fi:", value: "ko-fi.com/g31w0fw0rld", isLink: true }
            ];
            const titleEl = document.createElement('div');
            titleEl.textContent = t.scriptInfoTitle;
            titleEl.style.fontWeight = 'bold';
            titleEl.style.fontSize = '16px';
            titleEl.style.marginBottom = '14px';
            titleEl.style.color = colors.purpleLight;
            titleEl.style.flexShrink = '0';
            box.appendChild(titleEl);
            lines.forEach(l => {
                const row = document.createElement('div');
                row.style.marginBottom = '8px';
                row.style.lineHeight = '1.5';
                const label = document.createElement('span');
                label.textContent = l.label + " ";
                label.style.fontWeight = 'bold';
                row.appendChild(label);
                if (l.isLink) {
                    const a = document.createElement('a');
                    a.href = "https://" + l.value;
                    a.textContent = l.value;
                    a.target = "_blank";
                    a.rel = "noopener noreferrer";
                    a.style.color = colors.purpleLight;
                    a.style.textDecoration = "underline";
                    row.appendChild(a);
                } else {
                    const val = document.createElement('span');
                    val.textContent = l.value;
                    row.appendChild(val);
                }
                body.appendChild(row);
            });
            box.appendChild(body);
            const detach = attachDismissHandlers(overlay, () => { closeOverlayAnimated(overlay); });
            const closeBtn = createButton(t.accept, colors.purple, () => {
                detach();
                return closeOverlayAnimated(overlay);
            });
            closeBtn.style.marginTop = '14px';
            closeBtn.style.flexShrink = '0';
            // Centrado y a su ancho, como los botones de los demas modales —que lo
            // consiguen con su fila de acciones—. Hace falta decirlo porque `box` es
            // aqui un flex en columna: con el align-items:stretch por defecto, el
            // boton se estiraba a todo el ancho de la caja.
            closeBtn.style.alignSelf = 'center';
            box.appendChild(closeBtn);

            document.body.appendChild(overlay);
            try { setInertOnBodyChildrenExcept(overlay, true); } catch (e) { /* noop */ }
            setTimeout(() => {
                overlay.style.opacity = '1';
                try { box.style.transform = 'translateY(0) scale(1)'; box.style.opacity = '1'; } catch (e) { }
            }, 10);
            // Sin esto el foco se queda en el ℹ️ del panel, que setInertOnBodyChildrenExcept
            // acaba de marcar inert, y se cae a <body>. Mismo gesto que los otros modales.
            setTimeout(() => closeBtn.focus(), 120);
        }

        // =============================================
        // FLOATING PANEL (Kick-style, Twitch purple)
        // =============================================

        function buildPanel() {
            const existing = document.getElementById("twitch-drops-panel");
            if (existing) existing.remove();

            const panel = document.createElement("div");
            panel.id = "twitch-drops-panel";
            Object.assign(panel.style, {
                position: "fixed", top: "70px", right: "16px", zIndex: "9999",
                backgroundColor: colors.surface, color: colors.text,
                border: `1px solid ${colors.border}`, borderRadius: "12px",
                padding: "0", fontFamily: "Inter, system-ui, sans-serif",
                fontSize: "13px", boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                maxWidth: "390px", minWidth: "300px", maxHeight: "80vh",
                display: "flex", flexDirection: "column", overflow: "hidden"
            });

            // Header with gradient
            const header = document.createElement("div");
            Object.assign(header.style, {
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", borderBottom: `1px solid ${colors.border}`,
                cursor: "move", userSelect: "none",
                background: `linear-gradient(135deg, ${colors.purpleDark}22, ${colors.surface})`
            });

            const titleEl = document.createElement("span");
            titleEl.textContent = "🎁 Twitch Drops";
            titleEl.style.fontWeight = "bold";
            titleEl.style.fontSize = "14px";
            titleEl.style.color = colors.purpleLight;
            header.appendChild(titleEl);

            const headerBtns = document.createElement("div");
            headerBtns.style.display = "flex";
            headerBtns.style.gap = "6px";

            const infoBtn = document.createElement("span");
            infoBtn.textContent = "ℹ️";
            infoBtn.style.cursor = "pointer";
            infoBtn.style.fontSize = "14px";
            infoBtn.onclick = showInfoModal;
            headerBtns.appendChild(infoBtn);

            const collapseBtn = document.createElement("span");
            const isCollapsed = getCollapseFlag();
            collapseBtn.textContent = isCollapsed ? "🔽" : "🔼";
            collapseBtn.style.cursor = "pointer";
            collapseBtn.style.fontSize = "14px";
            headerBtns.appendChild(collapseBtn);

            header.appendChild(headerBtns);
            panel.appendChild(header);

            // Body (no scroll here — scroll is on each tab pane)
            const body = document.createElement("div");
            body.id = "twitch-drops-panel-body";
            Object.assign(body.style, {
                padding: "10px 14px", overflow: "hidden", flex: "1",
                display: isCollapsed ? "none" : "flex", flexDirection: "column"
            });

            collapseBtn.onclick = () => {
                const collapsed = body.style.display === "none";
                body.style.display = collapsed ? "flex" : "none";
                collapseBtn.textContent = collapsed ? "🔼" : "🔽";
                setCollapseFlag(!collapsed);
            };

            // Keyword chips
            const kwSection = document.createElement("div");
            kwSection.style.marginBottom = "10px";
            const kwLabel = document.createElement("div");
            kwLabel.textContent = t.currentKeywords;
            kwLabel.style.marginBottom = "6px";
            kwLabel.style.fontSize = "11px";
            kwLabel.style.color = colors.gray;
            kwSection.appendChild(kwLabel);

            const kwChips = document.createElement("div");
            kwChips.style.display = "flex";
            kwChips.style.flexWrap = "wrap";
            kwChips.style.gap = "4px";

            const currentKws = getStoredKeywords();
            currentKws.forEach(kw => {
                // Las negativas se ven distintas —borde discontinuo y en rojo— sin
                // esconder el `-`: el prefijo es la sintaxis real, y verlo es lo
                // que enseña a escribir la siguiente.
                const negative = kw.startsWith('-');
                const idleBorder = negative ? colors.red + "80" : colors.border;
                const idleColor = negative ? colors.red : colors.text;
                const chip = document.createElement("span");
                chip.textContent = kw;
                chip.title = negative
                    ? (t.negativeKeywordHint || '') + " · " + t.deleteKeywordTooltip
                    : t.deleteKeywordTooltip;
                Object.assign(chip.style, {
                    padding: "2px 8px", backgroundColor: colors.bg,
                    border: `1px ${negative ? "dashed" : "solid"} ${idleBorder}`,
                    borderRadius: "12px",
                    fontSize: "11px", cursor: "pointer", transition: "all 0.15s",
                    color: idleColor
                });
                // Las negativas ya son rojas en reposo, asi que el hover se marca
                // con opacidad: si no, no habria respuesta visual al pasar por
                // encima justo en las que mas facil es borrar por error.
                chip.onmouseenter = () => {
                    chip.style.borderColor = colors.red;
                    chip.style.color = colors.red;
                    if (negative) chip.style.opacity = "0.6";
                };
                chip.onmouseleave = () => {
                    chip.style.borderColor = idleBorder;
                    chip.style.color = idleColor;
                    chip.style.opacity = "1";
                };
                chip.onclick = () => {
                    (async () => {
                        const ok = await showConfirmModal(t.deleteKeywordQuestion + `"${kw}"?`);
                        if (ok) {
                            const updated = getStoredKeywords().filter(k => k !== kw);
                            setStoredKeywords(updated);
                            // Quitar una negativa solo puede AÑADIR coincidencias,
                            // asi que no hay nada que purgar.
                            if (!negative) deleteNotificationsByKeyword(kw);
                            setCollapseFlag(false);
                            location.reload();
                        }
                    })();
                };
                kwChips.appendChild(chip);
            });

            // Add keyword button inline
            const addChip = document.createElement("span");
            addChip.textContent = "+";
            addChip.title = t.addKeyword + " · " + (t.negativeKeywordHint || '');
            Object.assign(addChip.style, {
                padding: "2px 8px", backgroundColor: colors.bg,
                border: `1px solid ${colors.purple}`, borderRadius: "12px",
                fontSize: "11px", cursor: "pointer", transition: "all 0.15s",
                color: colors.purple, fontWeight: "bold"
            });
            addChip.onmouseenter = () => { addChip.style.backgroundColor = colors.purple; addChip.style.color = colors.bg; };
            addChip.onmouseleave = () => { addChip.style.backgroundColor = colors.bg; addChip.style.color = colors.purple; };
            addChip.onclick = () => {
                (async () => {
                    const newKeyword = await showInputModal(t.addKeyword + " — " + (t.negativeKeywordHint || ''));
                    if (newKeyword) {
                        const k = newKeyword.trim().toLowerCase();
                        // Un "-" a secas no descarta nada y dejaria la lista con una
                        // entrada muerta que ademas parece un error.
                        if (k && k !== '-' && !keywords.includes(k)) {
                            keywords.push(k);
                            setStoredKeywords(keywords);
                            removeNotificationsNotInKeywords(keywords);
                            setCollapseFlag(false);
                            location.reload();
                        }
                    }
                })();
            };
            kwChips.appendChild(addChip);

            kwSection.appendChild(kwChips);
            body.appendChild(kwSection);

            // Buttons row
            const btnRow = document.createElement("div");
            Object.assign(btnRow.style, {
                display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px"
            });
            btnRow.appendChild(createEditKeywordsButton());
            btnRow.appendChild(createResetKeywordsButton());
            btnRow.appendChild(createReloadButton());
            body.appendChild(btnRow);

            // Inventory checkboxes
            const invCbs = createInventoryCheckboxes();
            invCbs.style.marginBottom = "10px";
            body.appendChild(invCbs);

            // View filters
            body.appendChild(createViewFilterBar());

            // Sort mode
            body.appendChild(createSortBar());

            // Tabs: Active | Expired | Notifications
            const tabBar = document.createElement("div");
            Object.assign(tabBar.style, {
                display: "flex", gap: "0", marginBottom: "10px",
                borderBottom: `1px solid ${colors.border}`
            });

            const tabStyle = {
                flex: "1", padding: "6px 0", cursor: "pointer", fontSize: "11px",
                fontWeight: "bold", border: "none", borderBottom: `2px solid transparent`,
                backgroundColor: "transparent", color: colors.gray, textAlign: "inherit"
            };

            const tabActive = document.createElement("button");
            tabActive.id = "twitch-drops-tab-active";
            tabActive.textContent = t.dropsActive;
            Object.assign(tabActive.style, { ...tabStyle });

            const tabExpired = document.createElement("button");
            tabExpired.id = "twitch-drops-tab-expired";
            tabExpired.textContent = t.dropsExpired;
            Object.assign(tabExpired.style, { ...tabStyle });

            const tabNotifs = document.createElement("button");
            tabNotifs.id = "twitch-drops-tab-notifs";
            tabNotifs.textContent = `${t.changedIcon || "🔔"} (0)`;
            Object.assign(tabNotifs.style, { ...tabStyle });

            tabBar.appendChild(tabActive);
            tabBar.appendChild(tabExpired);
            tabBar.appendChild(tabNotifs);
            body.appendChild(tabBar);

            // Scrollable tab content area (takes remaining space)
            const tabContent = document.createElement("div");
            Object.assign(tabContent.style, {
                flex: "1", overflowY: "auto", minHeight: "0"
            });

            // Active drops pane
            const activePane = document.createElement("div");
            activePane.id = "twitch-drops-active-pane";
            tabContent.appendChild(activePane);

            // Expired drops pane (hidden by default)
            const expiredPane = document.createElement("div");
            expiredPane.id = "twitch-drops-expired-pane";
            expiredPane.style.display = "none";
            tabContent.appendChild(expiredPane);

            // Hidden combined results container (used by renderResults internally)
            const results = document.createElement("div");
            results.id = "twitch-drops-results";
            results.style.display = "none";
            tabContent.appendChild(results);

            // Notifications pane (hidden by default)
            const notifsPane = document.createElement("div");
            notifsPane.id = "twitch-drops-notifs-pane";
            notifsPane.style.display = "none";
            tabContent.appendChild(notifsPane);

            // API loading indicator
            const apiLoadingEl = document.createElement("div");
            apiLoadingEl.id = "twitch-drops-api-loading";
            Object.assign(apiLoadingEl.style, {
                display: _apiDataReady ? "none" : "flex",
                alignItems: "center", gap: "6px",
                padding: "6px 8px", marginBottom: "6px",
                backgroundColor: colors.orange + "15",
                border: `1px solid ${colors.orange}40`,
                borderRadius: "6px", fontSize: "11px",
                color: colors.orange
            });
            const pulseDot = document.createElement("span");
            Object.assign(pulseDot.style, {
                display: "inline-block", width: "8px", height: "8px",
                borderRadius: "50%", backgroundColor: colors.orange,
                animation: "twitch-pulse-dot 1.2s infinite"
            });
            apiLoadingEl.appendChild(pulseDot);
            apiLoadingEl.appendChild(document.createTextNode(t.readingApiDrops || "Reading drop changes from GQL/API..."));
            if (!document.getElementById("twitch-pulse-dot-style")) {
                const style = document.createElement("style");
                style.id = "twitch-pulse-dot-style";
                style.textContent = "@keyframes twitch-pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }";
                document.head.appendChild(style);
            }
            body.appendChild(apiLoadingEl);
            body.appendChild(createInventoryWarning());
            _scheduleInventoryWarning();

            body.appendChild(tabContent);

            // Tab helper: activate one tab, deactivate others.
            // El acento del tab activo es parametrizable para que "Drops Cerrados" se
            // active en rojo (igual que en el script de Kick) en vez del morado de
            // Twitch: el color refuerza que ese tab lista campanas ya cerradas, y
            // coincide con el borde rojo de sus cards (renderCampaignCard con
            // isActive=false). Los demas tabs siguen con el morado por default.
            function activateTab(activeBtn, accentBorder, accentText) {
                [tabActive, tabExpired, tabNotifs].forEach(btn => {
                    btn.style.borderBottom = `2px solid transparent`;
                    btn.style.color = colors.gray;
                });
                activeBtn.style.borderBottom = `2px solid ${accentBorder || colors.purple}`;
                activeBtn.style.color = accentText || colors.purpleLight;
                [activePane, expiredPane, notifsPane].forEach(p => p.style.display = "none");
            }

            tabActive.onclick = () => { activateTab(tabActive); activePane.style.display = "block"; };
            tabExpired.onclick = () => { activateTab(tabExpired, colors.red, colors.red); expiredPane.style.display = "block"; };
            tabNotifs.onclick = () => { activateTab(tabNotifs); notifsPane.style.display = "block"; };

            // Check if there are pending notifications to show that tab by default
            const pendingNotifs = getNotifications().filter(n => !n.seen && n.changed);
            if (pendingNotifs.length > 0) {
                activateTab(tabNotifs);
                notifsPane.style.display = "block";
            } else {
                activateTab(tabActive);
                activePane.style.display = "block";
            }

            panel.appendChild(body);

            // Drag support
            let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;
            header.addEventListener("mousedown", (e) => {
                isDragging = true;
                const rect = panel.getBoundingClientRect();
                dragOffsetX = e.clientX - rect.left;
                dragOffsetY = e.clientY - rect.top;
                e.preventDefault();
            });
            document.addEventListener("mousemove", (e) => {
                if (!isDragging) return;
                panel.style.left = (e.clientX - dragOffsetX) + "px";
                panel.style.top = (e.clientY - dragOffsetY) + "px";
                panel.style.right = "auto";
            });
            document.addEventListener("mouseup", () => { isDragging = false; });

            document.body.appendChild(panel);
            return results;
        }

        // =============================================
        // CAMPAIGN CARD RENDERING (Kick-style)
        // =============================================

        // =============================================
        // COMPARTIR UNA CAMPAÑA
        // =============================================
        // El enlace profundo de Twitch a una campaña concreta es
        // /drops/campaigns?dropID=<id de campaña>. Que `dropID` sea el ID DE CAMPAÑA
        // —y no el del tramo— esta verificado por dos sitios del propio codigo:
        //   · _gqlGetCampaignDetails recibe una variable que Twitch llama `dropID` y
        //     se le pasa `campaign.id`;
        //   · el enlace del inventario (a.tw-link[href*="dropID="]) es de campaña, no
        //     de tramo, segun la nota ya verificada sobre DOM real en _findPerCardWrapper.
        // Y la ruta quedo COMPROBADA EN VIVO el 2026-08-08: abriendo el enlace copiado
        // por el 🔗, Twitch reconoce el id y despliega esa campaña.
        //
        // Solo vale para campañas de DROPS. Las reward campaigns son otro sistema: se
        // probo pasarles su propio id por aqui y Twitch no lo reconoce, asi que sus
        // entradas se guardan sin `campaignId` y este enlace cae al generico (ver el
        // comentario donde se construyen).
        //
        // cleanInventory sigue volcando en consola el primer href real que encuentra:
        // ya no hace falta para comprobar la ruta, pero es lo que avisaria si Twitch
        // la cambiara.
        const TWITCH_CAMPAIGNS_URL = 'https://www.twitch.tv/drops/campaigns';

        function _shareUrlFor(campaign, entry) {
            // Primero el id que trae la propia tarjeta: las cerradas de la API viven en
            // _apiClosedCampaigns, que _findEntryForTitle no mira.
            const id = (campaign && campaign.campaignId) || (entry && entry.campaignId) || '';
            return id ? `${TWITCH_CAMPAIGNS_URL}?dropID=${encodeURIComponent(id)}` : TWITCH_CAMPAIGNS_URL;
        }

        function _shareTextFor(campaign) {
            const entry = _findEntryForTitle(campaign && campaign.title);
            const lines = [campaign.title || ''];
            const range = campaign.dateRange || _apiDateRange(entry);
            if (range) lines.push(range);
            // Los tramos van SIN las marcas de reclamado ni de ganado: eso es tuyo, no
            // de la campaña, y a quien se lo mandas no le dice nada —o peor, le dice
            // que ya lo tiene—. Se comparte lo que reparte, no como vas tu.
            const seen = new Set();
            for (const d of ((entry && entry.drops) || [])) {
                const name = (d.rewards && d.rewards.length > 0) ? d.rewards.join(', ') : d.name;
                if (!name) continue;
                const minutes = Number(d.minutes) || 0;
                const dedupe = name + '|' + minutes;
                if (seen.has(dedupe)) continue;
                seen.add(dedupe);
                const hours = minutes / 60;
                const cost = hours >= 1 ? ` — ${hours} h` : minutes > 0 ? ` — ${minutes} min` : '';
                lines.push(`· ${name}${cost}`);
            }
            lines.push(_shareUrlFor(campaign, entry));
            return lines.join('\n');
        }

        // navigator.clipboard puede no estar: hace falta contexto seguro y que la
        // Permissions-Policy del sitio no lo bloquee. El respaldo con textarea +
        // execCommand esta obsoleto pero sigue funcionando en ese hueco, y aqui el
        // clic del usuario ya nos da el gesto que los dos exigen.
        function _copyToClipboard(text) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                return navigator.clipboard.writeText(text);
            }
            return new Promise((resolve, reject) => {
                try {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.setAttribute('readonly', '');
                    Object.assign(ta.style, { position: 'fixed', top: '-1000px', opacity: '0' });
                    document.body.appendChild(ta);
                    ta.select();
                    const ok = document.execCommand('copy');
                    document.body.removeChild(ta);
                    ok ? resolve() : reject(new Error('execCommand copy failed'));
                } catch (e) { reject(e); }
            });
        }

        function _createShareButton(campaign) {
            const btn = document.createElement("span");
            btn.className = "drop-share-btn";
            btn.textContent = "🔗";
            btn.title = t.shareCopy || i18n.en.shareCopy;
            Object.assign(btn.style, {
                cursor: "pointer", fontSize: "13px", userSelect: "none",
                lineHeight: "1", transition: "opacity 0.15s"
            });
            btn.onmouseenter = () => { btn.style.opacity = "0.6"; };
            btn.onmouseleave = () => { btn.style.opacity = "1"; };
            btn.onclick = (e) => {
                // La tarjeta entera lleva su propio onclick (hacer scroll hasta la
                // campaña o ir a campañas). Compartir no es eso.
                e.stopPropagation();
                e.preventDefault();
                _copyToClipboard(_shareTextFor(campaign)).then(() => {
                    // La confirmacion va en el propio boton y no en un aviso aparte:
                    // copiar no deja rastro visible en ningun sitio, asi que sin esto
                    // no hay forma de saber si funciono.
                    btn.textContent = "✓";
                    btn.title = t.shareCopied || i18n.en.shareCopied;
                    setTimeout(() => {
                        btn.textContent = "🔗";
                        btn.title = t.shareCopy || i18n.en.shareCopy;
                    }, 1500);
                }).catch((err) => {
                    console.warn('[Twitch Drops] no se pudo copiar:', err);
                    btn.textContent = "✕";
                    setTimeout(() => { btn.textContent = "🔗"; }, 1500);
                });
            };
            return btn;
        }

        function renderCampaignCard(campaign, isActive) {
            const accentColor = isActive ? colors.purple : colors.red;
            const card = document.createElement("div");
            Object.assign(card.style, {
                backgroundColor: colors.bg, border: `1px solid ${accentColor}`,
                borderRadius: "8px", padding: "10px", marginBottom: "8px", cursor: "pointer",
                transition: "all 0.15s"
            });
            card.onmouseenter = () => { card.style.boxShadow = `0 0 12px ${accentColor}40`; };
            card.onmouseleave = () => { card.style.boxShadow = "none"; };

            // Data attributes for notification bell removal
            if (campaign.title) card.setAttribute("data-notif-title", campaign.title);
            if (campaign.id) card.setAttribute("data-notif-id", campaign.id);

            // Header with image and name
            const cardHeader = document.createElement("div");
            cardHeader.style.display = "flex";
            cardHeader.style.alignItems = "center";
            cardHeader.style.gap = "8px";
            cardHeader.style.marginBottom = "6px";

            // La caratula primero y la imagen de la campaña de respaldo, para que la
            // misma campaña se vea igual aqui y en /drops/campaigns. Se prueban por
            // orden con el onerror: las dos formas de caratula y, si ninguna carga,
            // lo que traiga la entrada. Sin candidatos no se pinta nada, como antes.
            const _imgTries = _boxArtCandidates(campaign.gameId)
                .concat(campaign.imgSrc ? [campaign.imgSrc] : []);
            if (_imgTries.length > 0) {
                const img = document.createElement("img");
                let intento = 0;
                img.onerror = () => {
                    intento++;
                    if (intento < _imgTries.length) img.src = _imgTries[intento];
                    else img.remove();
                };
                img.src = _imgTries[0];
                img.style.width = "36px";
                img.style.height = "48px";
                img.style.borderRadius = "4px";
                img.style.objectFit = "cover";
                cardHeader.appendChild(img);
            }

            const titleInfo = document.createElement("div");
            const nameEl = document.createElement("div");
            nameEl.textContent = campaign.title || campaign.gameName || '';
            nameEl.style.fontWeight = "bold";
            nameEl.style.fontSize = "13px";
            titleInfo.appendChild(nameEl);

            if (campaign.studio) {
                const studioEl = document.createElement("div");
                studioEl.textContent = campaign.studio;
                studioEl.style.fontSize = "11px";
                studioEl.style.color = colors.gray;
                titleInfo.appendChild(studioEl);
            }

            if (campaign.dateRange) {
                const dateEl = document.createElement("div");
                dateEl.textContent = campaign.dateRange;
                dateEl.style.fontSize = "10px";
                dateEl.style.color = colors.gray;
                titleInfo.appendChild(dateEl);
            }

            cardHeader.appendChild(titleInfo);

            // Los iconos de la derecha, en su propio hueco. El marginLeft:auto pasa a
            // ser del contenedor y no de la campana: cuando eran dos sueltos, el
            // segundo se pegaba al primero y el bloque bailaba segun hubiera 🔔 o no.
            const cardActions = document.createElement("div");
            Object.assign(cardActions.style, {
                marginLeft: "auto", display: "flex", alignItems: "center",
                gap: "6px", flexShrink: "0"
            });

            // Changed indicator (bell icon)
            if (campaign.changed) {
                const bell = document.createElement("span");
                bell.className = "drop-bell-icon";
                bell.textContent = t.changedIcon || "🔔";
                bell.style.color = colors.orange;
                bell.style.fontSize = "14px";
                cardActions.appendChild(bell);
            }

            // Compartir SOLO lo que sigue abierto. Mandar una campaña cerrada es
            // mandar a alguien a por algo que ya no puede conseguir, y el mensaje ni
            // siquiera lo diria: el texto lleva fechas, no un "esto ya acabo".
            //
            // De paso se cae un fallo real. _shareTextFor saca los tramos con
            // _findEntryForTitle, que busca solo en _apiDropNames —las abiertas— y
            // casa por aproximacion contra el nombre del juego. Una campaña cerrada de
            // un juego que ademas tiene una abierta se llevaba los tramos DE LA
            // ABIERTA bajo el titulo de la cerrada.
            if (isActive) cardActions.appendChild(_createShareButton(campaign));
            // Puede quedar vacio: en Cerrados no hay 🔗, y la 🔔 casi nunca esta —el
            // escaneo no marca cambios en lo cerrado, aunque una tarjeta de la API si
            // puede heredar un aviso previo—. Un div vacio con marginLeft:auto no
            // pinta nada, pero tampoco tiene por que estar.
            if (cardActions.children.length > 0) cardHeader.appendChild(cardActions);

            card.appendChild(cardHeader);

            // Keywords matched chips
            if (campaign.matchedKeywords && campaign.matchedKeywords.length > 0) {
                const kwRow = document.createElement("div");
                kwRow.style.display = "flex";
                kwRow.style.flexWrap = "wrap";
                kwRow.style.gap = "3px";
                kwRow.style.marginBottom = "4px";
                campaign.matchedKeywords.forEach(kw => {
                    const chip = document.createElement("span");
                    chip.textContent = kw;
                    Object.assign(chip.style, {
                        padding: "1px 6px", backgroundColor: accentColor + "20",
                        color: accentColor,
                        border: `1px solid ${accentColor}40`,
                        borderRadius: "8px", fontSize: "10px"
                    });
                    kwRow.appendChild(chip);
                });
                card.appendChild(kwRow);
            }

            // API drop/reward names (only for active campaigns)
            if (isActive) {
                const dropNames = _findDropNamesForTitle(campaign.title);
                if (dropNames && dropNames.length > 0) {
                    _appendUrgencyTo(card, _findEntryForTitle(campaign.title));
                    _appendDropNamesTo(card, dropNames);
                }
            }

            // Pulsar la tarjeta lleva a la campaña, este donde este.
            //
            // Un solo camino para los dos casos, y a proposito: la tarjeta de la API y la
            // del DOM se distinguen en que una trae nodo y la otra no, y de eso ya se
            // ocupa _focusCampaignOnPage. Antes cada una tenia su rama y ninguna de las
            // dos enfocaba nada al venir del inventario.
            card.onclick = () => {
                if (_focusCampaignOnPage(campaign)) return;
                // No esta delante: se apunta el destino y se navega. Al llegar lo cobra
                // _focusPendingCampaign, por la MISMA funcion que acaba de fallar aqui,
                // para que los dos caminos no puedan divergir.
                _goToCampaignsPage(campaign);
            };

            return card;
        }

        // =============================================
        // RENDER RESULTS IN PANEL
        // =============================================

        // ---------------------------------------------
        // LAS CAMPAÑAS QUE NO ESTAN DELANTE
        // ---------------------------------------------
        // El escaneo del DOM solo ve /drops/campaigns. Entrando por el inventario no
        // hay ni un acordeon que leer, y antes eso se resolvia yendo a campañas y
        // volviendo; ahora lo que falta se saca de la API, que devuelve la lista
        // entera en una peticion (ver waitForDropsFunction).
        //
        // Se dedupla contra lo ya escaneado por TITULO: la campaña que si esta delante
        // se queda con su tarjeta del DOM, que es mejor —lleva el rango de fechas tal
        // y como lo escribe Twitch y sabe hacer scroll hasta ella—. De la API vienen
        // solo las que no tienen tarjeta propia.
        function _apiDateRange(entry) {
            const s = Date.parse((entry && entry.startAt) || '');
            const e = Date.parse((entry && entry.endAt) || '');
            const fmt = (ms) => new Date(ms).toLocaleDateString(lang, {
                day: 'numeric', month: 'short', year: 'numeric'
            });
            if (!Number.isFinite(s) && !Number.isFinite(e)) return '';
            if (!Number.isFinite(s)) return fmt(e);
            if (!Number.isFinite(e)) return fmt(s);
            return `${fmt(s)} - ${fmt(e)}`;
        }

        function _apiItemsFor(status, seen) {
            if (!_apiDataReady) return [];
            const notifs = getNotifications();
            const src = status === 'expired' ? _apiClosedCampaigns : _apiDropNames;
            const now = Date.now();
            const out = [];
            for (const [key, entry] of Object.entries(src)) {
                if (!entry || key === '__all') continue;
                if (status === 'active') {
                    if (!entry.drops || entry.drops.length === 0) continue;
                    // Las campañas de recompensas entran en este mapa sin mirar su
                    // estado (su bucle nunca lo miro), asi que una ya vencida podria
                    // colarse en Activos. Aqui no.
                    const end = Date.parse(entry.endAt || '');
                    if (Number.isFinite(end) && end <= now) continue;
                }
                const title = entry.displayTitle || key;
                const titleLower = title.toLowerCase();
                // Se mira el titulo entero Y el nombre del juego a secas, porque las
                // dos fuentes lo componen por su cuenta: el DOM pega el estudio que
                // imprime la pagina y la API el `owner.name` de la campaña, que no
                // siempre es la misma cadena. Comparando solo el titulo completo, un
                // "Rust - Facepunch Studios" y un "Rust - Facepunch" son campañas
                // distintas y la tarjeta salia DOS veces en /drops/campaigns, que es
                // donde el DOM ya las trae todas. Sin riesgo de esconder de mas:
                // _apiDropNames va indexado por juego, asi que por juego hay como
                // mucho una entrada de la API a la que renunciar.
                if (seen.has(titleLower) || seen.has(titleLower.split(' - ')[0].trim())) continue;
                // Y por el nombre que la pagina le da al mismo juego, que es el que hay
                // en `seen` cuando Twitch lo traduce: sin esto la tarjeta de la API se
                // añadia junto a la del DOM y la campaña salia dos veces.
                const alias = _domAliasFor(entry);
                if (alias && (seen.has(alias) || seen.has(alias.split(' - ')[0].trim()))) continue;
                const n = notifs.find(x => x.title === title);
                out.push({
                    title, studio: '', id: '', key: title + '|api', status,
                    // La campana sale igual que en una tarjeta escaneada: el cambio no
                    // depende de en que pagina estes.
                    changed: !!(n && !n.seen && n.changed),
                    idx: -1, imgSrc: entry.imgSrc || '', dateRange: _apiDateRange(entry),
                    // Sobre el texto con el que SE FILTRO, no sobre el titulo (ver el
                    // comentario de _mergeSearchText). Vale para las dos solapas: el
                    // `src` de arriba ya trae la entrada buena, tambien la de Cerrados,
                    // que _findEntryForTitle no sabe encontrar. Se cae al titulo solo
                    // por si alguna entrada no lo trae.
                    matchedKeywords: _matchedPositiveKeywords(entry.searchText || title.toLowerCase()),
                    element: null,
                    // Viaja en la tarjeta porque las cerradas viven en
                    // _apiClosedCampaigns y _findEntryForTitle solo mira las abiertas.
                    campaignId: entry.campaignId || '',
                    // Para componer la caratula: es la MISMA imagen que pinta la pagina
                    // de campañas, y sin ella esta tarjeta saldria con la imagen propia
                    // de la campaña —otra distinta para lo mismo—.
                    gameId: entry.gameId || '',
                    // Marca que esta tarjeta no tiene nodo en esta pagina: al pulsarla
                    // se va a campañas, en vez de intentar un scroll a algo que no existe.
                    fromApi: true
                });
            }
            return out;
        }

        function renderResults(resultsContainer, activeItems, expiredItems) {
            // Lo escaneado manda y la API completa. Se hace aqui —y no al escanear—
            // porque las dos fuentes llegan por su cuenta: repintar por cualquiera de
            // las dos vuelve a pasar por este punto y el panel queda coherente.
            //
            // La deduplicacion es CONTRA LAS DOS SECCIONES, no contra la propia: si una
            // campaña esta delante, la API no vuelve a meterla por la otra solapa.
            // Mirando solo su seccion, un juego que la pagina lista como abierto y la
            // API tiene por cerrado saldria en las dos a la vez.
            const scanned = new Set();
            for (const i of [].concat(activeItems || [], expiredItems || [])) {
                const titleLower = String(i.title || '').toLowerCase();
                if (!titleLower) continue;
                scanned.add(titleLower);
                scanned.add(titleLower.split(' - ')[0].trim());
            }
            activeItems = (activeItems || []).concat(_apiItemsFor('active', scanned));
            expiredItems = (expiredItems || []).concat(_apiItemsFor('expired', scanned));
            // Render into separate panes (Active tab / Expired tab)
            const activePane = document.getElementById("twitch-drops-active-pane");
            const expiredPane = document.getElementById("twitch-drops-expired-pane");
            const tabActive = document.getElementById("twitch-drops-tab-active");
            const tabExpired = document.getElementById("twitch-drops-tab-expired");

            const totalActive = activeItems.length;
            const totalExpired = expiredItems.length;

            // Los filtros de vista solo recortan Activos.
            const shownActive = _applyViewFilters(activeItems);

            // TODAVIA NO SE SABE, QUE NO ES LO MISMO QUE NO HAY. Mientras la API no
            // ha contestado y no hay nada escaneado, la solapa no lleva contador y el
            // panel no escribe su "no se encontró nada": los dos dirian cero, y el
            // cero es una respuesta. El aviso naranja de "leyendo drops" ya esta ahi
            // diciendo lo unico cierto en ese momento, y sobreescribirlo con un cero
            // era decir las dos cosas a la vez.
            //
            // En cuanto llega la API —o falla y se agota— _apiDataReady se pone a
            // true y el cero se escribe, que entonces si es informacion.
            const stillLoading = !_apiDataReady;

            // Update tab labels with counts. Cuando un filtro esconde algo se dice
            // "(3/12)": un contador a secas convertiria un filtro que se quedo
            // encendido de la sesion anterior en "hoy no hay nada".
            if (tabActive) {
                tabActive.textContent = (stillLoading && totalActive === 0)
                    ? t.dropsActive
                    : shownActive.length === totalActive
                        ? `${t.dropsActive} (${totalActive})`
                        : `${t.dropsActive} (${shownActive.length}/${totalActive})`;
            }
            if (tabExpired) {
                tabExpired.textContent = (stillLoading && totalExpired === 0)
                    ? t.dropsExpired
                    : `${t.dropsExpired} (${totalExpired})`;
            }

            // Active pane
            if (activePane) {
                activePane.innerHTML = "";
                if (shownActive.length === 0) {
                    // "No hay" y "lo escondiste tu" son cosas distintas y el mensaje
                    // lo dice, con la salida a mano. Y "todavia no se sabe" es una
                    // tercera: ahi el panel se queda callado. Ojo, el filtro se avisa
                    // igualmente aunque se este cargando: que un filtro esconda algo
                    // ya se sabe sin la API, y es lo unico que explica un panel vacio
                    // teniendo tarjetas.
                    const hiddenByFilter = totalActive > 0;
                    if (hiddenByFilter) {
                        const msg = document.createElement("div");
                        msg.textContent = "⚙ " + (t.noResultsFiltered || "Nothing matches the active filters.");
                        msg.style.color = colors.gray;
                        msg.style.fontSize = "12px";
                        msg.style.padding = "12px 0 4px";
                        msg.style.textAlign = "center";
                        activePane.appendChild(msg);
                        const clear = document.createElement("div");
                        clear.textContent = t.clearFilters || "Clear filters";
                        Object.assign(clear.style, {
                            color: colors.purpleLight || colors.purple, cursor: "pointer",
                            fontSize: "11px", textAlign: "center",
                            textDecoration: "underline", paddingBottom: "12px"
                        });
                        clear.onclick = clearViewFilters;
                        activePane.appendChild(clear);
                    } else if (!stillLoading) {
                        const msg = document.createElement("div");
                        msg.textContent = t.noResults;
                        msg.style.color = colors.gray;
                        msg.style.fontSize = "12px";
                        msg.style.padding = "12px 0 4px";
                        msg.style.textAlign = "center";
                        activePane.appendChild(msg);
                    }
                } else {
                    // El orden elegido, y solo en Activos: en Cerrados ya se acabo.
                    _sortActive(shownActive).forEach(c => {
                        activePane.appendChild(renderCampaignCard(c, true));
                    });
                }
            }

            // Expired pane
            if (expiredPane) {
                expiredPane.innerHTML = "";
                if (totalExpired === 0 && !stillLoading) {
                    const msg = document.createElement("div");
                    msg.textContent = t.noResults;
                    msg.style.color = colors.gray;
                    msg.style.fontSize = "12px";
                    msg.style.padding = "12px 0";
                    msg.style.textAlign = "center";
                    expiredPane.appendChild(msg);
                } else {
                    expiredItems.forEach(c => {
                        expiredPane.appendChild(renderCampaignCard(c, false));
                    });
                }
            }
        }

        // =============================================
        // NOTIFICATIONS TAB (inside panel, not a separate popup)
        // =============================================

        function removeBellFromCard(notifTitle, notifId) {
            // Remove bell icons from campaign cards in both Active and Expired panes
            ["twitch-drops-active-pane", "twitch-drops-expired-pane"].forEach(paneId => {
                const pane = document.getElementById(paneId);
                if (pane) {
                    pane.querySelectorAll("[data-notif-title]").forEach(card => {
                        const cardTitle = card.getAttribute("data-notif-title") || "";
                        const cardId = card.getAttribute("data-notif-id") || "";
                        if ((notifTitle && cardTitle === notifTitle) || (notifId && cardId === notifId)) {
                            const bell = card.querySelector(".drop-bell-icon");
                            if (bell) bell.remove();
                        }
                    });
                }
            });
            // El mismo 🔔 puesto sobre la tarjeta de la pagina: marcarla como vista
            // lo quita de los dos sitios, no solo del panel.
            document.querySelectorAll(".drop-page-bell").forEach(bell => {
                const bellTitle = bell.getAttribute("data-notif-title") || "";
                const bellId = bell.getAttribute("data-notif-id") || "";
                if ((notifTitle && bellTitle === notifTitle) || (notifId && bellId === notifId)) {
                    bell.remove();
                }
            });
        }

        function removeAllBellsFromCards() {
            ["twitch-drops-active-pane", "twitch-drops-expired-pane"].forEach(paneId => {
                const pane = document.getElementById(paneId);
                if (pane) {
                    pane.querySelectorAll(".drop-bell-icon").forEach(bell => bell.remove());
                }
            });
            document.querySelectorAll(".drop-page-bell").forEach(bell => bell.remove());
        }

        // Lightweight update: only refresh notification count badge without re-rendering/switching tabs
        function _updateNotifTabCount() {
            const notifs = getNotifications();
            const pending = notifs.filter(n => !n.seen && n.changed).length;
            const tabNotifs = document.getElementById("twitch-drops-tab-notifs");
            if (tabNotifs) {
                tabNotifs.textContent = `${t.changedIcon || "🔔"} (${pending})`;
                tabNotifs.style.color = pending > 0 ? colors.orange : colors.gray;
            }
            updateNotificationTitleAndSound();
        }

        function renderNotificationsTab() {
            const notifsPane = document.getElementById("twitch-drops-notifs-pane");
            if (!notifsPane) return;
            notifsPane.innerHTML = "";

            const notifs = getNotifications();
            const pending = notifs.filter(n => !n.seen && n.changed);

            // Update tab label with count
            const tabNotifs = document.getElementById("twitch-drops-tab-notifs");
            if (tabNotifs) {
                tabNotifs.textContent = `${t.changedIcon || "🔔"} (${pending.length})`;
                if (pending.length > 0) {
                    tabNotifs.style.color = colors.orange;
                }
            }

            if (!pending.length) {
                const emptyMsg = document.createElement("div");
                emptyMsg.textContent = "✓ " + (t.noResults || "No notifications");
                emptyMsg.style.color = colors.gray;
                emptyMsg.style.fontSize = "12px";
                emptyMsg.style.textAlign = "center";
                emptyMsg.style.padding = "12px 0";
                notifsPane.appendChild(emptyMsg);
                updateNotificationTitleAndSound();
                return;
            }

            // Mark all as viewed button
            const markAllRow = document.createElement("div");
            Object.assign(markAllRow.style, {
                display: "flex", justifyContent: "flex-end", marginBottom: "8px"
            });
            const markAllBtn = document.createElement("button");
            markAllBtn.textContent = t.markAllAsViewed;
            Object.assign(markAllBtn.style, {
                backgroundColor: colors.surface, border: `1px solid ${colors.purple}`,
                color: colors.text, padding: "4px 8px", borderRadius: "4px",
                cursor: "pointer", fontSize: "11px"
            });
            markAllBtn.onclick = () => {
                markAllNotificationsSeen();
                removeAllBellsFromCards();
                renderNotificationsTab();
            };
            markAllRow.appendChild(markAllBtn);
            notifsPane.appendChild(markAllRow);

            // Notification rows
            pending.forEach(n => {
                const row = document.createElement("div");
                Object.assign(row.style, {
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "6px 8px", marginBottom: "4px",
                    backgroundColor: colors.bg, borderRadius: "6px",
                    border: `1px solid ${colors.border}`
                });

                const titleDiv = document.createElement("div");
                titleDiv.textContent = n.title;
                titleDiv.style.flex = "1";
                titleDiv.style.fontSize = "12px";
                titleDiv.style.overflow = "hidden";
                titleDiv.style.textOverflow = "ellipsis";
                titleDiv.style.whiteSpace = "nowrap";
                row.appendChild(titleDiv);

                const viewBtn = document.createElement("button");
                viewBtn.textContent = t.viewIcon || "👁️";
                viewBtn.title = t.viewed;
                Object.assign(viewBtn.style, {
                    backgroundColor: colors.surface, border: `1px solid ${colors.purple}`,
                    color: colors.text, padding: "4px 8px", borderRadius: "4px",
                    cursor: "pointer", fontSize: "11px", flexShrink: "0"
                });
                viewBtn.onclick = () => {
                    const notifTitle = n.title;
                    const notifId = (n.key && n.key.includes("|")) ? n.key.split("|")[1] : (n.id || "");
                    markNotificationSeen(n.key || n.title);
                    removeBellFromCard(notifTitle, notifId);

                    // Mismo camino que la tarjeta del panel. Tenia el mismo fallo y uno
                    // suyo encima: cruzaba por `notifId`, que sale de la key de la
                    // notificacion y es el `drop-match-N` de un escaneo viejo, asi que
                    // fuera de esa pasada apunta a otra campaña o a nada. Se pasa igual
                    // porque cuando la notificacion es de esta misma visita es exacto,
                    // pero detras va el titulo, que no caduca.
                    // 'active' explicito: las notificaciones solo se crean para campañas
                    // abiertas, y dejarlo vacio haria que el barrido no acotara el lado.
                    const objetivo = { id: notifId, title: notifTitle, status: 'active' };
                    if (!_focusCampaignOnPage(objetivo)) _goToCampaignsPage(objetivo);

                    // Remove this notification row from the list
                    row.remove();
                    // Show empty message if no more pending notifications
                    const notifsPane = document.getElementById("twitch-drops-notifs-pane");
                    if (notifsPane && !notifsPane.querySelector('[style*="border"]')) {
                        const remaining = getNotifications().filter(nn => !nn.seen && nn.changed);
                        if (!remaining.length) {
                            notifsPane.innerHTML = "";
                            const emptyMsg = document.createElement("div");
                            emptyMsg.textContent = "✓ " + (t.noResults || "No notifications");
                            emptyMsg.style.color = colors.gray;
                            emptyMsg.style.fontSize = "12px";
                            emptyMsg.style.textAlign = "center";
                            emptyMsg.style.padding = "12px 0";
                            notifsPane.appendChild(emptyMsg);
                        }
                    }
                    
                    // Re-render this tab
                    renderNotificationsTab();
                };
                row.appendChild(viewBtn);
                notifsPane.appendChild(row);
            });

            updateNotificationTitleAndSound();

            // Auto-switch to notifications tab when there are pending notifications
            if (pending.length > 0) {
                const tabActiveBtn = document.getElementById("twitch-drops-tab-active");
                const tabExpiredBtn = document.getElementById("twitch-drops-tab-expired");
                const activeP = document.getElementById("twitch-drops-active-pane");
                const expiredP = document.getElementById("twitch-drops-expired-pane");
                if (tabActiveBtn && tabExpiredBtn && tabNotifs && activeP && expiredP && notifsPane) {
                    [tabActiveBtn, tabExpiredBtn, tabNotifs].forEach(btn => {
                        btn.style.borderBottom = `2px solid transparent`;
                        btn.style.color = colors.gray;
                    });
                    tabNotifs.style.borderBottom = `2px solid ${colors.purple}`;
                    tabNotifs.style.color = colors.purpleLight;
                    activeP.style.display = "none";
                    expiredP.style.display = "none";
                    notifsPane.style.display = "block";
                }
            }
        }

        // =============================================
        // LOGICA CENTRAL (CORE)
        // =============================================

        let active = [];
        let expired = [];
        let seenTitles = new Set();
        let idx = 0;
        let reseted = false;

        // Los campos que entran en el snapshot son los que definen "la campaña
        // cambio". Se proyectan de forma explicita en vez de serializar el drop
        // entero: los objetos de _apiDropNames llevan ademas identidad (id,
        // benefitIds) y, sobre todo, NO puede entrar aqui nada que dependa del
        // usuario. Si el estado de reclamado formara parte del snapshot, reclamar un
        // drop marcaria su campaña como cambiada y levantaria un 🔔 falso cada vez.
        function _snapshotFieldsOf(drop) {
            return {
                name: drop.name || '',
                rewards: drop.rewards || [],
                minutes: drop.minutes || 0
            };
        }

        function buildDataSnapshot(displayTitle) {
            const entry = _findEntryForTitle(displayTitle);
            if (!entry || !entry.drops || entry.drops.length === 0) {
                return JSON.stringify({ title: displayTitle.toLowerCase() });
            }
            // Sort drops by name for consistent comparison
            const sortedDrops = [...entry.drops]
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                .map(_snapshotFieldsOf);
            return JSON.stringify({
                drops: sortedDrops,
                startAt: entry.startAt || '',
                endAt: entry.endAt || ''
            });
        }

        // =============================================
        // ENFOCAR UNA CAMPAÑA EN LA PAGINA
        // =============================================
        // Deja el TITULO de la campaña pegado al borde de arriba.
        //
        // El nodo escaneado es `div.accordion-header`, que ya ES la fila del titulo, asi
        // que no hay que buscar ancla dentro como en Kick. Lo que si hace falta es el
        // `scroll-margin-top`: el ACTIVE_STYLE que lo lleva se aplica al PADRE del nodo
        // —es el que se resalta—, y el margen solo cuenta en el elemento al que se hace
        // scroll. Sin ponerlo aqui, la cabecera fija de Twitch se come el titulo justo
        // cuando acaba de llegar.
        const SCROLL_MARGIN_TOP = "100px";

        function scrollToCampaignElement(node) {
            if (!node) return;
            node.style.scrollMarginTop = SCROLL_MARGIN_TOP;
            node.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        // Busca en la pagina la cabecera de campaña que se llama asi. Hace falta ademas
        // de lo escaneado por un caso concreto: una campaña puede estar en el panel
        // porque su NOMBRE DE CAMPAÑA caso una keyword, y ese nombre no sale en el DOM
        // —la pagina imprime juego y estudio—, asi que el escaneo, que filtra por lo que
        // lee del DOM, ni la mira. Esta si.
        // Que cabeceras caen BAJO el separador de «Cerrados». Devuelve null cuando la
        // pagina no lo tiene, que no es lo mismo que «ninguna esta cerrada»: sin
        // separador no se puede saber de que lado esta cada una, y eso hay que poder
        // distinguirlo de un conjunto vacio.
        //
        // Se reproduce el mismo criterio que usa el escaneo —posicion respecto al h4—
        // en vez de inventar otro: si los dos no coinciden, la tarjeta que se resalta y
        // la que se enfoca dejan de ser la misma.
        function _expiredPageHeaders() {
            const all = Array.from(document.querySelectorAll('h4[class^="CoreText-sc"], div.accordion-header'));
            const closed = all.find(h => h.matches('h4[class^="CoreText-sc"]')
                && CLOSED_HEADER_TEXTS.some(t => h.textContent.trim().toLowerCase() === t.toLowerCase()));
            if (!closed) return null;
            const idx = all.indexOf(closed);
            const set = new Set();
            all.forEach((n, i) => { if (i > idx && n.matches('div.accordion-header')) set.add(n); });
            return set;
        }

        // `status` acota el lado de la pagina. Sin el, una campaña CERRADA de un juego
        // que ademas tiene una abierta acababa enfocando la ABIERTA: el titulo entero no
        // casaba, se caia al nombre del juego y la primera cabecera con ese nombre es
        // siempre la de arriba, o sea la abierta. Se pasa como null cuando no se sabe
        // —y tambien cuando la pagina no trae separador— para no dejar de enfocar por no
        // poder decidir; ahi vuelve a valer la primera, que es lo de antes.
        function _findPageHeaderByTitle(title, status) {
            const wanted = String(title || '').toLowerCase().trim();
            if (!wanted) return null;
            const wantedGame = wanted.split(' - ')[0].trim();
            const cerradas = _expiredPageHeaders();
            const lado = !cerradas ? null
                : status === 'expired' ? true
                : status === 'active' ? false
                : null;
            let porJuego = null;
            for (const node of document.querySelectorAll('div.accordion-header')) {
                if (lado !== null && cerradas.has(node) !== lado) continue;
                const ps = node.querySelectorAll('p[class^="CoreText-sc"]').length
                    ? node.querySelectorAll('p[class^="CoreText-sc"]')
                    : node.querySelectorAll('p');
                if (!ps.length) continue;
                const juego = ps[0].textContent.trim().toLowerCase();
                const estudio = ps.length >= 2 ? ps[1].textContent.trim().toLowerCase() : '';
                const compuesto = estudio ? `${juego} - ${estudio}` : juego;
                if (compuesto === wanted) return node;
                // El titulo de la API y el del DOM se componen por separado, asi que
                // pueden discrepar en el estudio. El juego se guarda como segunda
                // opcion y solo se usa si nadie casa entero.
                if (!porJuego && juego === wantedGame) porJuego = node;
            }
            return porJuego;
        }

        // Enfoca la campaña SI ESTA EN ESTA PAGINA. Devuelve si lo consiguio, para que
        // quien llame sepa si todavia hace falta navegar.
        function _focusCampaignOnPage(campaign) {
            if (!campaign) return false;
            if (campaign.element && document.contains(campaign.element)) {
                scrollToCampaignElement(campaign.element);
                return true;
            }
            if (campaign.id) {
                const byId = document.getElementById(campaign.id);
                if (byId) { scrollToCampaignElement(byId); return true; }
            }
            const node = _findPageHeaderByTitle(campaign.title, campaign.status);
            if (node) { scrollToCampaignElement(node); return true; }
            return false;
        }

        // =============================================
        // IR A UNA CAMPAÑA QUE NO ESTA EN ESTA PAGINA
        // =============================================
        // Estando en el inventario, el panel lista campañas que viven en /drops/campaigns.
        // Pulsar una significa "llevame alli", y llegar no basta: hay que dejarte delante
        // de la campaña.
        //
        // Antes no se intentaba siquiera. La tarjeta de la API se iba por una rama que
        // navegaba y volvia sin apuntar destino, y la del DOM apuntaba en una variable
        // en memoria cuyo consumidor cruzaba por `id`; los ids son `drop-match-N-status`
        // y se reparten POR ORDEN en cada escaneo, asi que el de antes de navegar no
        // significa nada al llegar. Y su ultimo recurso hacia scroll a la tarjeta DEL
        // PANEL, que es la que acabas de pulsar: se daba por bueno sin mover la pagina.
        //
        // El destino va a GM_setValue en vez de a una variable. Las pestañas de Twitch
        // son navegacion de SPA y la memoria sobreviviria, pero eso es justo lo que no
        // se puede comprobar leyendo codigo: asi el arreglo vale igual si un dia esa
        // navegacion recarga, y la pregunta deja de importar.
        //
        // Caduca a los 30 s: si la navegacion no llega a ocurrir, un destino olvidado
        // haria saltar el scroll en una visita cualquiera de mañana sin que nadie lo
        // hubiera pedido.
        const FOCUS_TARGET_TTL_MS = 30000;
        const CAMPAIGNS_LINK_SELECTOR = 'a[href="/drops/campaigns"]';

        function _setFocusTarget(campaign) {
            if (!campaign || !campaign.title) return;
            try {
                GM_setValue(FOCUS_TARGET_KEY, JSON.stringify({
                    title: campaign.title,
                    // Viaja el estado porque al llegar hay que saber de que lado de la
                    // pagina buscar: un juego puede tener campaña abierta Y cerrada, y
                    // el titulo por si solo no las distingue.
                    status: campaign.status || '',
                    ts: Date.now()
                }));
            } catch (e) { /* sin destino, la navegacion sigue valiendo */ }
        }

        // Se lee UNA vez y se borra en el mismo gesto, pase lo que pase despues: el
        // escaneo corre mas de una vez por visita —al encontrar el DOM y otra vez cuando
        // llega la API—, y un destino que sobreviva a su uso volveria a dar el salto.
        function _takeFocusTarget() {
            let raw = null;
            try { raw = GM_getValue(FOCUS_TARGET_KEY, null); } catch (e) { return null; }
            if (!raw) return null;
            try { GM_deleteValue(FOCUS_TARGET_KEY); } catch (e) { /* ignore */ }
            let target = null;
            try { target = JSON.parse(raw); } catch (e) { return null; }
            if (!target || !target.title) return null;
            if (!target.ts || Date.now() - target.ts > FOCUS_TARGET_TTL_MS) return null;
            return target;
        }

        // Apunta el destino y navega. Solo si hay enlace al que ir: si no, se deja el
        // destino sin guardar en vez de colgado esperando una navegacion que no pasa.
        function _goToCampaignsPage(campaign) {
            if (location.pathname.includes("/campaigns")) return;
            const link = document.querySelector(CAMPAIGNS_LINK_SELECTOR);
            if (!link) return;
            _setFocusTarget(campaign);
            link.click();
        }

        // Se llama al terminar cada escaneo, con los nodos ya identificados. El cruce es
        // POR TITULO y no por id, por lo dicho arriba. Se reintenta unas cuantas veces
        // porque las campañas cerradas cuelgan al final de la pagina y pueden tardar en
        // pintarse; el destino ya se consumio en el primer intento, asi que los reintentos
        // no lo resucitan.
        function _focusPendingCampaign(items) {
            const target = _takeFocusTarget();
            if (!target) return;
            const wanted = String(target.title).toLowerCase();
            let intentos = 0;
            const reintento = setInterval(() => {
                intentos++;
                // Se busca primero entre lo escaneado para recuperar el NODO; si no
                // esta, _focusCampaignOnPage cae al barrido por titulo. El estado entra
                // en la comparacion por lo mismo que arriba: el mismo juego puede estar
                // en las dos solapas, y quedarse con el primero era llevarte al abierto
                // habiendo pulsado el cerrado.
                const found = (items || []).find(c =>
                    c && c.element && String(c.title || '').toLowerCase() === wanted
                    && (!target.status || c.status === target.status));
                if (_focusCampaignOnPage(found || { title: target.title, status: target.status })
                    || intentos >= 10) {
                    clearInterval(reintento);
                }
            }, 500);
        }

        async function highlightAndLinkDrops() {
            active = [];
            expired = [];
            seenTitles = new Set();
            reseted = false;
            idx = 0;
            // Clear previous drop-match IDs to allow re-scanning (needed when API data arrives after first DOM scan)
            document.querySelectorAll('[id^="drop-match-"]').forEach(el => el.removeAttribute('id'));
            // Las marcas de la pagina (⏳ y 🔔) se borran enteras y se vuelven a
            // poner: asi se van solas las de campañas que dejaron de correr prisa
            // —la reclamaste, o cruzo el umbral— sin llevar la cuenta de cual habia
            // en cada nodo.
            document.querySelectorAll('.twitch-drop-page-mark').forEach(el => el.remove());
            // APPROACH 1: Find closed header using CLOSED_HEADER_TEXTS (28 locales)
            const closedHeader = Array.from(document.querySelectorAll('h4[class^="CoreText-sc"]'))
                .find(h => CLOSED_HEADER_TEXTS.some(text => h.textContent.trim().toLowerCase() === text.toLowerCase()));

            // APPROACH 2: Y-position based — find all relevant nodes
            const allNodes = Array.from(document.querySelectorAll('h4[class^="CoreText-sc"], div.accordion-header'));
            const closedIndex = closedHeader ? allNodes.indexOf(closedHeader) : -1;

            // If we have a closed header, use index-based approach
            // Otherwise, try Y-position approach with CLOSED_DROP_TEXTS
            allNodes.forEach((node, index) => {
                if (!(node instanceof HTMLElement)) return;
                if (!node.matches('div[class^="Layout-sc"]') && !node.matches('div.accordion-header')) return;
                if (node.id?.startsWith('drop-match-')) return;
                if (node.querySelector('p[data-a-target="side-nav-title"]')) return;

                // Extract title + studio from p tags (both used for keyword matching)
                const corePs = node.querySelectorAll('p[class^="CoreText-sc"]');
                let titleText = '';
                let studioText = '';

                if (corePs.length >= 2) {
                    titleText = corePs[0].textContent.trim();
                    studioText = corePs[1].textContent.trim();
                } else if (corePs.length === 1) {
                    titleText = corePs[0].textContent.trim();
                } else {
                    const ps = node.querySelectorAll('p');
                    if (ps.length >= 2) {
                        titleText = ps[0].textContent.trim();
                        studioText = ps[1].textContent.trim();
                    } else if (ps.length === 1) {
                        titleText = ps[0].textContent.trim();
                    }
                }

                if (!titleText) return;

                // El elemento del que salio el titulo, para colgar de el la marca de
                // urgencia. Reproduce las ramas de arriba: el primer CoreText si lo
                // hay, y si no el primer <p> suelto.
                const titleEl = corePs[0] || node.querySelector('p') || null;

                // Combine title + studio for keyword matching (match against both fields)
                const searchText = (titleText + " " + studioText).toLowerCase();
                if (!_matchesKeywords(searchText)) return;

                // Display title includes studio when present
                const displayTitle = studioText ? titleText + " - " + studioText : titleText;

                // Determine if expired
                let isExpired = false;
                if (closedIndex >= 0 && index > closedIndex) {
                    isExpired = true;
                } else if (closedIndex < 0) {
                    // Y-position fallback: check if node contains CLOSED_DROP_TEXTS
                    const nodeText = (node.innerText || node.textContent || '').toLowerCase();
                    if (CLOSED_DROP_TEXTS.some(ct => nodeText.includes(ct.toLowerCase()))) {
                        isExpired = true;
                    }
                }

                if (isExpired && !reseted) {
                    seenTitles = new Set();
                    reseted = true;
                }

                if (seenTitles.has(index)) return;
                seenTitles.add(index);

                const id = `drop-match-${idx++}-${isExpired ? 'expired' : 'active'}`;

                node.id = id;
                if (node.parentElement) node.parentElement.setAttribute('style', isExpired ? EXPIRED_STYLE : ACTIVE_STYLE);

                // Extract image and extra info for card rendering
                let imgSrc = '';
                const imgEl = node.querySelector('img.partner-thumbnail, img.tw-image, img');
                if (imgEl) imgSrc = imgEl.src;

                // La caratula del acordeon lleva el id del juego, que es lo unico que
                // no se traduce. Se apunta como el nombre que la PAGINA usa para ese
                // juego, para que la entrada de la API se reconozca por el (ver
                // _domTitleByGameId).
                const domGameId = _gameIdFromBoxArt(imgSrc);
                if (domGameId) _domTitleByGameId[domGameId] = displayTitle.toLowerCase();

                // Extract date range from the accordion header date div
                let dateRange = '';
                const allDivs = node.querySelectorAll('div[class^="Layout-sc"]');
                for (const d of allDivs) {
                    const txt = d.textContent.trim();
                    // Match date patterns like "lun 6 de abr" or "Mar 24, 2026" etc.
                    if (txt && d.children.length === 0 && /\d/.test(txt) && (txt.includes('de ') || txt.includes(', ') || txt.includes(' - ') || txt.includes(' – '))) {
                        dateRange = txt;
                        break;
                    }
                }

                // Matched keywords (search against both title + studio)
                const matchedKeywords = _matchedPositiveKeywords(searchText);

                // Update/create notification (using GQL/API data instead of HTML snapshots)
                let changedFlag = false;
                const computedKey = displayTitle + '|' + id;
                if (!isExpired) {
                    const notifs = getNotifications();
                    let existingNotif = notifs.find((n) => n.key === computedKey) || notifs.find((n) => n.title === displayTitle);
                    if (_apiDataReady) {
                        // Si la campaña ya no tiene drops activos en la API (expiró), no notificar cambio
                        const entry = _findEntryForTitle(displayTitle);
                        if (!entry || !entry.drops || entry.drops.length === 0) {
                            if (existingNotif) changedFlag = !existingNotif.seen && existingNotif.changed;
                        } else {
                        const dataSnapshot = buildDataSnapshot(displayTitle);
                        if (existingNotif) {
                            // Siempre actualizar key/id por si cambio el orden del DOM
                            const keyChanged = existingNotif.key !== computedKey;
                            existingNotif.id = id;
                            existingNotif.key = computedKey;
                            if (existingNotif.dataSnapshot !== dataSnapshot) {
                                existingNotif.changed = true;
                                existingNotif.seen = false;
                                existingNotif.dataSnapshot = dataSnapshot;
                                existingNotif.updatedAt = Date.now();
                                changedFlag = true;
                                saveNotifications(notifs);
                            } else {
                                if (keyChanged) saveNotifications(notifs);
                                changedFlag = !existingNotif.seen && existingNotif.changed;
                            }
                        } else {
                            const newN = {
                                id: id, title: displayTitle, key: computedKey,
                                dataSnapshot: dataSnapshot,
                                seen: false, changed: true,
                                createdAt: Date.now(), updatedAt: Date.now()
                            };
                            notifs.push(newN);
                            saveNotifications(notifs);
                            changedFlag = true;
                        }
                        }
                    } else if (existingNotif) {
                        changedFlag = !existingNotif.seen && existingNotif.changed;
                    } else {
                        // No API data y no existia snapshot previo → drop nuevo detectado
                        const newN = {
                            id: id, title: displayTitle, key: computedKey,
                            dataSnapshot: '',
                            seen: false, changed: true,
                            createdAt: Date.now(), updatedAt: Date.now()
                        };
                        notifs.push(newN);
                        saveNotifications(notifs);
                        changedFlag = true;
                    }
                }

                // Marcas sobre la propia tarjeta de Twitch, para que la prisa y el
                // cambio se vean haciendo scroll y no solo dentro del panel. Van
                // como HERMANAS del titulo y nunca dentro: el titulo se relee con
                // textContent en cada pasada, asi que un hijo acabaria colandose en
                // el texto que se compara con las keywords y en el nombre de la
                // campaña. Se insertan en orden inverso al que se leen, porque cada
                // una entra pegada al titulo y empuja a la anterior.
                if (titleEl && titleEl.parentElement) {
                    const pageMark = (text, color, tooltip, extraClass) => {
                        const el = document.createElement('span');
                        el.className = 'twitch-drop-page-mark' + (extraClass ? ' ' + extraClass : '');
                        el.textContent = text;
                        if (tooltip) el.title = tooltip;
                        // Los mismos atributos que la tarjeta del panel: es lo que
                        // permite que "marcar como vista" quite el 🔔 de los dos sitios.
                        el.setAttribute('data-notif-title', displayTitle);
                        el.setAttribute('data-notif-id', id);
                        Object.assign(el.style, {
                            marginLeft: '8px', fontSize: '12px', fontWeight: '700',
                            color: color, whiteSpace: 'nowrap'
                        });
                        titleEl.insertAdjacentElement('afterend', el);
                    };
                    if (changedFlag) {
                        pageMark(t.changedIcon || '🔔', colors.orange, t.changes_detected || '', 'drop-page-bell');
                    }
                    if (!isExpired) {
                        const entry = _findEntryForTitle(displayTitle);
                        const urgency = _computeUrgency(entry);
                        if (urgency) {
                            // Cuando corre prisa, las dos cosas van juntas en la
                            // misma marca: el cierre sin el coste no dice si merece
                            // la pena empezar.
                            let txt = `⏳ ${_formatCountdown(urgency.minutesLeft)}`;
                            if (urgency.needed !== null) {
                                txt += ` · ${t.urgentNeed || 'you still need'} ${formatHoursMinutes(urgency.needed)}`;
                            }
                            pageMark(txt, _urgencyColor(urgency), _urgencyText(urgency));
                        } else {
                            // Y cuando no corre prisa, el coste solo, en gris: el
                            // reloj de arena es del aviso de cierre y aqui no hay
                            // cierre que avisar. El 0 se calla porque ya lo dice el
                            // 🎁 del panel: ahi no falta tiempo, falta un clic.
                            const rest = _remainingMinutes(entry && entry.drops, 'max');
                            if (rest !== null && rest > 0) {
                                // Mismo caso que urgentMinimum: solo es/en la definen y el
                                // resto cae al ingles por este ||, no por un merge.
                                pageMark(`⏱ ${formatHoursMinutes(rest)}`, colors.gray,
                                    t.remainingToFinish || i18n.en.remainingToFinish);
                            }
                        }
                    }
                }

                const item = {
                    title: displayTitle, studio: studioText, id, changed: changedFlag,
                    key: computedKey, status: isExpired ? 'expired' : 'active',
                    idx: index, imgSrc, dateRange, matchedKeywords,
                    element: node
                };
                (isExpired ? expired : active).push(item);
            });

            // Render results in the floating panel
            const resultsContainer = document.getElementById("twitch-drops-results");
            if (resultsContainer) {
                renderResults(resultsContainer, active, expired);
            }

            // Show notification popup (separate from panel)
            renderNotificationsTab();

            // Si veniamos del inventario a por una campaña concreta, es aqui donde se
            // cobra: los nodos ya estan identificados y `active`/`expired` llevan su
            // elemento.
            _focusPendingCampaign([].concat(active, expired));
        }


        // =============================================
        // INVENTORY CLEANUP (cleanInventory)
        // =============================================

        let _realDropHrefLogged = false;

        function cleanInventory(type = "expired") {
            let attempts = 0;
            const maxAttempts = 10;
            const interval = 500;
            const aToRemoveAdded = [];

            // El icono X de "Cerrar" del popover de notificaciones usa EXACTAMENTE el mismo
            // path SVG que el boton "eliminar" de cada notificacion individual
            // (persistent-notification__delete). Por eso no basta con querySelector del path:
            // hay que (1) excluir los botones de borrado, (2) acotar la busqueda al popover y
            // (3) re-consultar el boton en el momento del click (no cachear un nodo que el
            // re-render de Twitch deja huerfano tras borrar las notificaciones).
            const CLOSE_X_PATH = "M6.414 5 5 6.414l5.588 5.588L5 17.59l1.414 1.414 5.588-5.588 5.588 5.588 1.414-1.414-5.588-5.588 5.588-5.588L17.59 5l-5.588 5.588L6.414 5Z";

            const checkNotifications = function (dropTextArrayVar) {
                if (dropTextArrayVar.length === 0) return;
                const path_noti = document.querySelector(`path[d="${NOTIFICATION_SVG_PATH}"]`);
                const openNotifBtn = path_noti?.closest('button');
                if (!openNotifBtn) return;
                openNotifBtn.click();

                setTimeout(() => {
                    // El popover de notificaciones es [data-test-selector="center-window__balloon"]
                    // (ancla estable e independiente del idioma). Su boton "Cerrar" vive en
                    // .tw-popover-header, ANTES de la lista en el DOM y junto a un boton de
                    // engranaje (Configuracion, otro path); acotar al header garantiza que nunca
                    // tomemos por error el X de borrado de una .persistent-notification.
                    const findCloseBtn = () => {
                        const balloon = document.querySelector('[data-test-selector="center-window__balloon"]');
                        if (!balloon || !document.body.contains(balloon)) return null;
                        const header = balloon.querySelector('.tw-popover-header') || balloon;
                        for (const p of header.querySelectorAll(`path[d="${CLOSE_X_PATH}"]`)) {
                            const btn = p.closest('button');
                            if (btn && !btn.closest('.persistent-notification')) return btn;
                        }
                        return header.querySelector('button[aria-label="Cerrar"], button[aria-label="Close"]');
                    };

                    const closePanel = () => {
                        let tries = 0;
                        const tryClose = () => {
                            const btn = findCloseBtn();
                            if (btn) { btn.click(); return; }
                            if (++tries < 5) { setTimeout(tryClose, 300); return; }
                            // Fallback: si el popover sigue abierto pero no hallamos su X,
                            // re-clic en la campana para alternar el cierre.
                            if (document.querySelector('[data-test-selector="center-window__balloon"]')) openNotifBtn.click();
                        };
                        tryClose();
                    };

                    // Filtramos primero las que realmente vamos a borrar, asi el cierre se agenda
                    // tras la ultima borrada de verdad (no condicionado a que la ultima del DOM
                    // coincida con la keyword ni tenga boton de borrado).
                    const toDelete = Array.from(document.querySelectorAll('.persistent-notification')).filter((n) => {
                        if (!n.querySelector('button[data-test-selector="persistent-notification__delete"]')) return false;
                        // El aviso de emote o emblema concedido NO dice «drop» en
                        // ningun idioma —«¡Recibiste el emote "Bop2bop Emote"!»—, asi
                        // que por texto se quedaba siempre. Su enlace si lleva un
                        // marcador de Twitch, que no se traduce.
                        if (n.querySelector(`a[href*="${EARNED_REWARD_NOTIF_MARK}"]`)) return true;
                        const body = n.querySelector('.persistent-notification__body');
                        if (!body) return false;
                        const notifText = body.innerText.toLowerCase();
                        return !!notifText && dropTextArrayVar.some(d => notifText.includes(d));
                    });

                    if (toDelete.length === 0) {
                        setTimeout(closePanel, 1000);
                        return;
                    }

                    toDelete.forEach((n, i) => {
                        const deleteBtn = n.querySelector('button[data-test-selector="persistent-notification__delete"]');
                        setTimeout(() => {
                            deleteBtn.click();
                            if (i === toDelete.length - 1) setTimeout(closePanel, 1000);
                        }, 500 + i * 150);
                    });
                }, 1000);
            };

            // Al auto-reclamar drops, Twitch muestra un banner "Drop reclamado" con un
            // boton de cerrar (aria-label "Descartar mensaje", localizado) que usa el mismo
            // icono X que el resto (CLOSE_X_PATH). Lo cerramos junto con la limpieza de
            // notificaciones de drops.
            //
            // Verificado sobre el DOM real (2026-08-02): el banner NO expone data-a-target ni
            // data-test-selector; no los tiene el boton, ni el banner, ni ninguno de sus
            // ancestros hasta <body>. Las unicas anclas estables son las del componente de
            // alerta de Twitch:
            //     <div role="alert" class="... ScAlertBanner-sc-1i6rgt3-0 ... tw-alert-banner">
            // `tw-alert-banner` no va hasheada -- es el mismo tipo de ancla que .tw-popover-header
            // (ya usada mas arriba) y que tw-link / tw-image / tw-svg -- y `role="alert"` es
            // semantica ARIA. El resto de clases son styled-components cuyo hash cambia en cada
            // build. Pedimos cualquiera de las dos, asi que Twitch tendria que quitar ambas para
            // romperlo. closest() nos ahorra ademas el paseo a ciegas por N ancestros.
            //
            // El componente de alerta es generico (Twitch lo reutiliza para otros avisos), asi
            // que dentro de el seguimos comprobando por texto que el aviso sea de un drop:
            // "Drop" es marca y se conserva sin traducir en casi todos los idiomas. La
            // diferencia con la version anterior es que ese texto ahora se lee del banner ya
            // identificado y no del innerText de ancestros anonimos, que era un falso positivo
            // real: en /drops/inventory el <header id="twilight-sticky-header-root"> que
            // envuelve al banner incluye el titulo "Drops y recompensas", de modo que el bucle
            // acababa encontrando "drop" ahi y cerraba CUALQUIER alerta, fuese o no de drops.
            const ALERT_BANNER_SELECTOR = '.tw-alert-banner, [role="alert"]';
            const dismissClaimedBanners = function () {
                document.querySelectorAll(`path[d="${CLOSE_X_PATH}"]`).forEach((p) => {
                    const btn = p.closest('button[aria-label]');
                    if (!btn) return;
                    if (btn.closest('.persistent-notification')) return;
                    if (btn.closest('[data-test-selector="center-window__balloon"]')) return;
                    const banner = btn.closest(ALERT_BANNER_SELECTOR);
                    if (!banner) return;
                    if (!(banner.innerText || '').toLowerCase().includes('drop')) return;
                    btn.click();
                });
            };

            if (type === "expired") {
                setTimeout(() => { checkNotifications(['drop']); }, 2000);
                // El banner aparece de forma asincrona tras reclamar; reintentar unas veces.
                [3000, 6000, 9000].forEach((ms) => setTimeout(dismissClaimedBanners, ms));
            }

            const checker = setInterval(() => {
                attempts++;
                const imgs = document.querySelectorAll("img.inventory-opacity-2");
                if (imgs.length > 0) {
                    const toRemove = [];
                    imgs.forEach(function (img) {
                        const firstParentDiv = img.closest("div");
                        if (!firstParentDiv) return;
                        const secondParentDiv = firstParentDiv.parentElement;
                        if (!secondParentDiv) return;
                        const hasP = secondParentDiv.querySelector("p") !== null;

                        if ((type === "expired" && hasP) || (type === "active" && !hasP)) {
                            let container = img;
                            for (let i = 0; i < 9; i++) {
                                if (container.parentElement) container = container.parentElement;
                                else { container = null; break; }
                            }
                            if (container) {
                                const notificationPath = container.querySelector(`path[d="${NOTIFICATION_SVG_PATH}"]`);
                                if (!notificationPath) {
                                    toRemove.push(container);
                                }
                            }
                        } else {
                            let container = img;
                            for (let i = 0; i < 9; i++) {
                                if (container.parentElement) container = container.parentElement;
                                else { container = null; break; }
                            }
                            if (container) {
                                const linkElement = container.querySelector('a.tw-link[href*="dropID="]');
                                if (linkElement) {
                                    const href = linkElement.getAttribute('href');
                                    const dropIDMatch = href.match(/dropID=([^&]+)/);
                                    if (dropIDMatch) {
                                        const dropID = dropIDMatch[1];
                                        // El enlace que compone el boton de compartir
                                        // (_shareUrlFor) se construye a mano, y la RUTA
                                        // es lo unico de el que no se pudo verificar en
                                        // el codigo. Este es el unico sitio donde Twitch
                                        // nos enseña uno de verdad: se vuelca el primero
                                        // y se calla, que si no son uno por drop.
                                        if (!_realDropHrefLogged) {
                                            _realDropHrefLogged = true;
                                            console.log('[Twitch Drops] enlace real de campaña (para comprobar _shareUrlFor):', linkElement.href);
                                        }
                                        if (!aToRemoveAdded.includes(dropID)) {
                                            aToRemoveAdded.push(dropID);
                                            if (deletedInventoryDrops.includes(dropID)) {
                                                container.parentElement.removeChild(container);
                                            } else {
                                                const newLink = document.createElement('a');
                                                newLink.textContent = t.removeIcon || '❌';
                                                newLink.href = '#';
                                                newLink.style.marginLeft = '10px';
                                                newLink.style.color = colors.purple;
                                                newLink.title = t.removeInventory;
                                                newLink.onclick = (e) => {
                                                    e.preventDefault();
                                                    container.parentElement.removeChild(container);
                                                    deletedInventoryDrops.push(dropID);
                                                    setInventoryDeletedKeys(deletedInventoryDrops);
                                                };
                                                if (!linkElement.dataset.buttonAdded) {
                                                    linkElement.dataset.buttonAdded = "true";
                                                    linkElement.parentNode.insertBefore(newLink, linkElement.nextSibling);
                                                }
                                            }
                                        }
                                    }
                                }
                                // Per-tier tooltip + click-to-modal. Attached on the per-card
                                // wrapper (not the campaign block) so each tier shows its own
                                // remaining time. The wrapper is found via the per-tier
                                // progressbar; the tier's API dropID is matched by name as a
                                // best-effort for showing reward metadata in the modal.
                                if (!hasP) {
                                    const cardWrapper = _findPerCardWrapper(img);
                                    if (cardWrapper && document.body.contains(cardWrapper)) {
                                        const cardDropID = _findDropIDByCardName(cardWrapper);
                                        attachDropTooltipAndModal(cardWrapper, cardDropID);
                                    }
                                }
                                const images = container.querySelectorAll("img.inventory-drop-image");
                                images.forEach((im) => {
                                    if (im.classList.contains('inventory-opacity-2')) return;
                                    let imgToRemove = im;
                                    for (let i = 0; i < 6; i++) {
                                        if (imgToRemove.parentElement) imgToRemove = imgToRemove.parentElement;
                                        else { imgToRemove = null; break; }
                                    }
                                    if (imgToRemove && type === "expired") {
                                        const notificationPath = imgToRemove.querySelector(`path[d="${NOTIFICATION_SVG_PATH}"]`);
                                        if (!notificationPath) {
                                            toRemove.push(imgToRemove);
                                        }
                                    }
                                });
                                const buttons = Array.from(container.querySelectorAll("button")).filter((btn) => {
                                    const label = btn.querySelector('[data-a-target="tw-core-button-label-text"]');
                                    const text = (label ? label.textContent : btn.textContent || "").trim().toLowerCase();
                                    const testSelector = (btn.getAttribute('data-test-selector') || '').toLowerCase();
                                    const targetSelector = (btn.getAttribute('data-a-target') || '').toLowerCase();
                                    const innerWithClaim = btn.querySelector('[data-test-selector*="claim"], [data-a-target*="claim"]');
                                    const hasClaimAttr = testSelector.includes('claim') || targetSelector.includes('claim') || !!innerWithClaim;
                                    return text.includes("reclamar") || text.includes("claim") || hasClaimAttr;
                                });
                                if (type === "expired") {
                                    if (buttons.length > 0) {
                                        buttons.forEach((btn, i) => {
                                            if (!btn.dataset.buttonClicked) {
                                                btn.dataset.buttonClicked = "true";
                                                setTimeout(() => { btn.click(); }, i * 150);
                                            }
                                        });
                                    }
                                }
                            }
                        }
                    });
                    toRemove.forEach(function (el) {
                        if (el.parentElement) el.parentElement.removeChild(el);
                    });
                }
                if (attempts >= maxAttempts) clearInterval(checker);
            }, interval);
        }

        // =============================================
        // CICLO DE VIDA / INICIALIZACION
        // =============================================

        // Aqui vivia un overlay a pantalla completa —«Buscando drops...», con un velo
        // negro por encima de toda la pagina— mientras se esperaba a que el DOM
        // pintara los acordeones. Tapaba Twitch hasta 5 s (10 intentos de 500 ms) para
        // decir algo que el propio panel ya dice sin tapar nada: el aviso naranja de
        // «Leyendo cambios en drops desde GQL/API». Dos avisos para lo mismo y solo uno
        // de los dos te dejaba usar la pagina, asi que se queda el que no estorba.
        //
        // Con el se fue su clave i18n `loadingDrops`, que no la usaba nadie mas.

        function waitForDropsFunction() {
            const path = location.pathname;
            const isCampaigns = path.includes("/campaigns");
            const isInventory = path.includes("/inventory");
            actualPath = isCampaigns ? "/drops/campaigns" : isInventory ? "/drops/inventory" : path;

            // Build the floating panel
            const resultsContainer = buildPanel();

            if (isInventory) {
                // ---------------------------------------------
                // AQUI YA NO SE CAMBIA DE PESTAÑA
                // ---------------------------------------------
                // Habia un recorrido que saltaba a campañas, escaneaba y volvia. NO
                // estaba roto —las pestañas de Twitch si son navegacion de SPA, asi
                // que funcionaba—, pero te sacaba del inventario y te devolvia con la
                // pantalla tapada por un overlay durante unos segundos, y todo para
                // leer del DOM algo que la API ya devuelve entero.
                //
                // El panel se llena ahora de ViewerDropsDashboard (ver _apiItemsFor),
                // que es la MISMA consulta que usa la pagina de campañas: las dos
                // solapas en una peticion y sin moverte de donde estabas. Lo que se
                // lee del DOM sigue siendo solo lo que tienes delante, que es lo unico
                // que hace falta para el resaltado sobre las tarjetas.
                //
                // Y el auto-reclamo arranca ya, en vez de esperar a la vuelta: nunca
                // dependio del recorrido, solo del DOM del inventario.
                cleanInventory(cleanExpiredInventoryFlag ? 'expired' : '');
                // Un primer pintado con lo que haya. Si la API todavia no llego se
                // queda el aviso de carga y repinta _refreshPanelAfterLateData.
                _rerenderPanes();
                return;
            }

            _startDropsPolling();
        }

        function _startDropsPolling() {
            let attempts = 0;
            const maxAttempts = 10;
            let waitForDrops = setInterval(() => {
                let found = 0;
                const seenTitlesLocal = new Set();

                document.querySelectorAll("div.accordion-header").forEach((header) => {
                    const titleP = header.querySelector("p");
                    if (!titleP) return;
                    const text = titleP.textContent.trim().toLowerCase();
                    if (!_matchesKeywords(text)) return;
                    if (seenTitlesLocal.has(text)) return;
                    seenTitlesLocal.add(text);
                    found++;
                });

                if (found >= 1) {
                    clearInterval(waitForDrops);
                    highlightAndLinkDrops();
                    // Inject drop names from API into rendered cards
                    _updateAllCardsWithDropNames();
                } else {
                    attempts++;
                    if (attempts >= maxAttempts) {
                        clearInterval(waitForDrops);
                        // Aqui se pintaban tres textos —"Buscando...", "sin resultados"
                        // y el aviso de ir a campañas— y los tres iban DENTRO de
                        // #twitch-drops-results, que se crea con display:none y no se
                        // muestra nunca: no los vio nadie. El "sin resultados" que si se
                        // ve lo pintan los paneles desde renderResults, y el aviso
                        // ademas ya era falso: el panel se llena de la API sin salir del
                        // inventario. Con ellos se fueron sus claves i18n.
                        //
                        // El DOM no dio nada, pero la API puede haber llegado ya: se
                        // pinta lo que haya en vez de dejar el panel en blanco.
                        _rerenderPanes();
                    }
                }
            }, 500);
        }

        // =============================================
        // URL CHANGE OBSERVER (SPA navigation)
        // =============================================

        // Se fue con el recorrido el pestillo `skipNextUrlChange`: existia solo para
        // que los dos saltos que daba el script (a campañas y de vuelta) no se
        // confundieran con una navegacion tuya. Ya no hay saltos propios, asi que todo
        // cambio de URL que llega aqui lo pediste tu.
        let actualPath = "";

        function onUrlChange(callback) {
            const pushState = history.pushState;
            const replaceState = history.replaceState;

            history.pushState = function () {
                pushState.apply(history, arguments);
                callback();
            };
            history.replaceState = function () {
                replaceState.apply(history, arguments);
                callback();
            };

            window.addEventListener("popstate", callback);
        }

        onUrlChange(() => {
            const newPath = location.pathname;
            if (newPath !== actualPath) {
                actualPath = newPath;
                if (newPath.startsWith("/drops/campaigns")) {
                    waitForDropsFunction();
                } else {
                    cleanInventory(cleanExpiredInventoryFlag ? 'expired' : '');
                }
            }
        });

        // Observe theme changes (Twitch toggles data-color-theme on <html>)
        const _themeObserver = new MutationObserver(() => {
            const nowDark = isDarkTheme();
            if (nowDark !== _isDark) {
                _isDark = nowDark;
                colors = _isDark ? {
                    purple: "#9147ff", purpleLight: "#bf94ff", purpleDark: "#772ce8",
                    green: "#00c274", red: "#ff4d4d", gray: "#adadb8", orange: "#ff9900",
                    bg: "#0e0e10", text: "#efeff1", surface: "#18181b", border: "#2f2f35"
                } : {
                    purple: "#9147ff", purpleLight: "#6441a5", purpleDark: "#772ce8",
                    green: "#00a67e", red: "#d92f2f", gray: "#53535f", orange: "#cc7a00",
                    bg: "#ffffff", text: "#0e0e10", surface: "#f7f7f8", border: "#dad8de"
                };
                // Rebuild panel with new colors
                const resultsContainer = buildPanel();
                if (active.length || expired.length) {
                    renderResults(resultsContainer, active, expired);
                    renderNotificationsTab();
                    // Re-inject drop names into new cards
                    _updateAllCardsWithDropNames();
                }
            }
        });
        _themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-color-theme', 'data-theme'] });

        // Start
        waitForDropsFunction();

        // Auto-refresh every 15 minutes
        setInterval(() => {
            location.reload();
        }, 15 * 60 * 1000);
    });
})();
