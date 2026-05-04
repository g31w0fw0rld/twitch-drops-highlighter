// ==UserScript==
// @name         Indiegala Giveaway Bulk Tools (Extra Odds bulk join + Single Ticket queue)
// @namespace    http://tampermonkey.net/
// @version      1.1.7
// @description  Anade dos herramientas a Indiegala Giveaways: (1) compra masiva de boletos en giveaways "Extra Odds" (card y listado); (2) cola de "Single Ticket" desde el listado para entrar a varios giveaways de forma secuencial. Delays humanizados, control de aborto. ⚠️ USO BAJO TU PROPIO RIESGO: viola la politica anti-spam de Indiegala y puede causar ban permanente.
// @match        https://www.indiegala.com/giveaways
// @match        https://www.indiegala.com/giveaways/*
// @author       g31w0fw0rld
// @license      MIT
// @downloadURL  https://github.com/g31w0fw0rld/indiegala-bulk-join/raw/main/indiegala-bulk-join.user.js
// @updateURL    https://github.com/g31w0fw0rld/indiegala-bulk-join/raw/main/indiegala-bulk-join.user.js
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

// =====================================================================
// ⚠️  ADVERTENCIA / WARNING  ⚠️
// =====================================================================
// Este script AUTOMATIZA acciones en Indiegala:
//   1) Compra masiva de boletos en un solo giveaway "Extra Odds".
//   2) Encolar varios "Single Ticket" desde el listado y dispararlos
//      uno tras otro de forma secuencial ("scheduling").
//
// La politica oficial de Indiegala prohibe EXPLICITAMENTE cualquier
// forma de automatizacion, incluso desde la misma cuenta, y reserva el
// derecho de BANEAR PERMANENTEMENTE las cuentas que la violen.
//
//   Politica:  https://docs.indiegala.com/giveaways_auctions_trades/spam.html
//   Cita:      "The use of any form of automation (including scheduling)
//              to enter giveaways (...) even from the same account is not
//              permitted. We reserve the right to permanently ban any
//              account that violates those rules."
//
// "Encolar y ejecutar" entra textualmente en "scheduling". Los delays
// humanizados, simular clicks o validar el estado del boton NO te
// protegen: la regla es categorica y los clicks sinteticos llevan
// event.isTrusted=false (detectable por el sitio).
//
// El autor no se hace responsable de baneos, perdida de saldo, o
// cualquier consecuencia derivada del uso de este script.
//
// USA ESTE SCRIPT BAJO TU PROPIO RIESGO.
// =====================================================================

(function () {
    'use strict';

    const SCRIPT_VERSION = '1.1.7';
    console.log('[IG-BulkTools] cargado. Version:', SCRIPT_VERSION);
    console.warn(
        '[IG-BulkTools] ⚠️ ADVERTENCIA: este script automatiza acciones en Indiegala (bulk join + cola).\n' +
        'La politica de Indiegala prohibe cualquier automatizacion (incluso desde la misma cuenta) y\n' +
        'puede resultar en BAN PERMANENTE. Politica: https://docs.indiegala.com/giveaways_auctions_trades/spam.html\n' +
        'Uso bajo tu propio riesgo.'
    );

    // =============================================
    // INTERNACIONALIZACION (i18n)
    // =============================================

    const userLang = (navigator.language || 'en').split('-')[0];
    const i18n = {
        es: {
            // Bulk join (Extra Odds)
            bulkLabel: '⚠ Bulk JOIN',
            bulkLabelTooltip: '⚠ Riesgo de ban — la política de Indiegala prohíbe la automatización. Uso bajo tu propio riesgo.',
            bulkBadge: '⚠×{n}',
            bulkBadgeTooltip: '⚠ Riesgo de ban — comprar varios boletos (Extra Odds) automáticamente VIOLA la política de Indiegala y puede banear tu cuenta. Máx {n} con tu saldo.',
            modalTitle: 'Compra masiva de boletos',
            modalGiveaway: 'Giveaway',
            modalPrice: 'Precio por boleto',
            modalBalance: 'Saldo GalaSilver',
            modalMax: 'Máximo posible',
            modalCount: 'Cantidad a comprar',
            modalTotalCost: 'Costo total',
            modalDelays: 'Espera entre boletos: 2.5–5 s · pausa larga 10–20 s cada 10',
            modalConfirm: 'Iniciar',
            modalCancel: 'Cancelar',
            invalidCount: 'Cantidad inválida (1 a {max}).',
            notEnough: 'No tienes GalaSilver suficiente para comprar al menos 1 boleto.',
            // Cola (Single Ticket)
            queueAddBtn: '＋',
            queueAddBtnTooltip: '⚠ Riesgo de ban — añadir este giveaway a la cola para entrar automáticamente. Uso bajo tu propio riesgo.',
            queueRemoveBtn: '✓',
            queueRemoveBtnTooltip: 'En cola — clic para quitar',
            queueNoBalance: 'Sin GalaSilver disponible. Recarga para encolar más giveaways.',
            queueNoBalanceTooltip: 'Sin GalaSilver — no puedes encolar este giveaway',
            queuePanelTitle: '⚠ Cola Single Ticket',
            queueTotalCost: '{n} boletos · {cost} iS',
            queueExecuteBtn: '▶ Ejecutar',
            queueClearBtn: '🗑 Vaciar',
            queueClearConfirm: '¿Vaciar toda la cola?',
            queueExecuteConfirmTitle: '⚠️ Confirmar ejecución de cola',
            queueLowBalance: 'Tu saldo ({balance} iS) es menor al costo total ({cost} iS). Algunos joins fallarán. ¿Continuar de todas formas?',
            queueProgressItem: '{title} ({i}/{n})',
            queueDone: 'Listo. {ok} de {n} entradas exitosas.',
            queueModalCount: 'Boletos en cola',
            // Compartido
            warningTitle: '⚠️ RIESGO DE BAN PERMANENTE',
            warningBody: 'La política de Indiegala prohíbe explícitamente cualquier forma de automatización para participar en giveaways, incluso desde la misma cuenta. Indiegala se reserva el derecho de banear permanentemente las cuentas que la violen. Usar este script bajo tu propio riesgo.',
            warningPolicyLink: 'Ver política oficial →',
            warningProgress: '⚠ Automatización en curso — riesgo de ban',
            warningProgressQueue: '⚠ Cola con automatización — riesgo de ban',
            balanceUnknown: 'No pude leer tu saldo de GalaSilver. Abre el menú de usuario una vez (clic en tu avatar) y vuelve a intentarlo.',
            alreadyRunning: 'Ya hay una operación masiva en curso.',
            progressTitle: 'Compra masiva en curso',
            progressTitleQueue: 'Ejecutando cola',
            progressStatus: 'Boleto {i} de {n}',
            progressLongPause: 'Pausa larga…',
            progressErrorDetected: 'Error detectado. Deteniendo.',
            progressTriggerLost: 'No encuentro el botón JOIN. Deteniendo.',
            progressBalanceLow: 'Saldo bajó por debajo del precio. Deteniendo.',
            progressTooFast: 'El servidor pidió bajar el ritmo (too_fast). Deteniendo.',
            progressBanned: 'Cuenta baneada según el servidor. Deteniendo.',
            progressJoinTimeout: 'Sin respuesta del servidor para el join. Deteniendo.',
            progressAborted: 'Detenido por el usuario.',
            progressDone: 'Listo. {ok} boletos comprados.',
            stopBtn: 'Detener',
            closeBtn: 'Cerrar',
            continueBtn: 'Continuar',
            continueTooFastWarning: 'El servidor pidió bajar el ritmo (too_fast). Continuar ahora puede aumentar el riesgo de ban. ¿Estás seguro?',
        },
        en: {
            // Bulk join (Extra Odds)
            bulkLabel: '⚠ Bulk JOIN',
            bulkLabelTooltip: '⚠ Ban risk — Indiegala policy forbids automation. Use at your own risk.',
            bulkBadge: '⚠×{n}',
            bulkBadgeTooltip: '⚠ Ban risk — buying multiple tickets (Extra Odds) automatically VIOLATES Indiegala policy and may ban your account. Max {n} with your balance.',
            modalTitle: 'Bulk ticket purchase',
            modalGiveaway: 'Giveaway',
            modalPrice: 'Price per ticket',
            modalBalance: 'GalaSilver balance',
            modalMax: 'Max possible',
            modalCount: 'Tickets to buy',
            modalTotalCost: 'Total cost',
            modalDelays: 'Wait between tickets: 2.5–5 s · long pause 10–20 s every 10',
            modalConfirm: 'Start',
            modalCancel: 'Cancel',
            invalidCount: 'Invalid amount (1 to {max}).',
            notEnough: 'Not enough GalaSilver to buy at least 1 ticket.',
            // Queue (Single Ticket)
            queueAddBtn: '＋',
            queueAddBtnTooltip: '⚠ Ban risk — add this giveaway to the queue for automatic entry. Use at your own risk.',
            queueRemoveBtn: '✓',
            queueRemoveBtnTooltip: 'In queue — click to remove',
            queueNoBalance: 'No GalaSilver available. Top up to queue more giveaways.',
            queueNoBalanceTooltip: 'No GalaSilver — cannot queue this giveaway',
            queuePanelTitle: '⚠ Single Ticket Queue',
            queueTotalCost: '{n} tickets · {cost} iS',
            queueExecuteBtn: '▶ Execute',
            queueClearBtn: '🗑 Clear',
            queueClearConfirm: 'Clear the entire queue?',
            queueExecuteConfirmTitle: '⚠️ Confirm queue execution',
            queueLowBalance: 'Your balance ({balance} iS) is lower than total cost ({cost} iS). Some joins will fail. Continue anyway?',
            queueProgressItem: '{title} ({i}/{n})',
            queueDone: 'Done. {ok} of {n} entries successful.',
            queueModalCount: 'Tickets queued',
            // Shared
            warningTitle: '⚠️ PERMANENT BAN RISK',
            warningBody: 'Indiegala policy explicitly forbids any form of automation to enter giveaways, even from the same account. Indiegala reserves the right to permanently ban accounts that violate it. Use this script at your own risk.',
            warningPolicyLink: 'See official policy →',
            warningProgress: '⚠ Automation running — ban risk',
            warningProgressQueue: '⚠ Automated queue running — ban risk',
            balanceUnknown: 'Could not read your GalaSilver balance. Open the user menu once (click your avatar) and try again.',
            alreadyRunning: 'A bulk operation is already running.',
            progressTitle: 'Bulk purchase in progress',
            progressTitleQueue: 'Executing queue',
            progressStatus: 'Ticket {i} of {n}',
            progressLongPause: 'Long pause…',
            progressErrorDetected: 'Error detected. Stopping.',
            progressTriggerLost: 'JOIN button not found. Stopping.',
            progressBalanceLow: 'Balance dropped below price. Stopping.',
            progressTooFast: 'Server rate-limited (too_fast). Stopping.',
            progressBanned: 'Account banned per server. Stopping.',
            progressJoinTimeout: 'No response from server for join. Stopping.',
            progressAborted: 'Stopped by user.',
            progressDone: 'Done. {ok} tickets bought.',
            stopBtn: 'Stop',
            closeBtn: 'Close',
            continueBtn: 'Continue',
            continueTooFastWarning: 'Server rate-limited (too_fast). Continuing now may increase ban risk. Are you sure?',
        },
    };
    const T = i18n[userLang] || i18n.en;
    const fmt = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));

    // =============================================
    // CONFIG
    // =============================================
    const CFG = {
        minDelayMs: 2500,
        maxDelayMs: 5000,
        longPauseEvery: 10,
        longPauseMinMs: 10000,
        longPauseMaxMs: 20000,
        joinResponseTimeoutMs: 60000,
    };

    const STORAGE_KEY = 'ig-st-queue';
    const BULK_BTN_CLASS = 'ig-bulk-join-btn';
    const BULK_BADGE_CLASS = 'ig-bulk-join-badge';
    const QBTN_CLASS = 'ig-q-btn';
    const PANEL_ID = 'ig-q-panel';
    const PROGRESS_OVERLAY_ID = 'ig-bulk-progress-overlay';
    const MODAL_ID = 'ig-bulk-modal';

    // =============================================
    // ESTADO
    // =============================================
    let running = false;
    let abortFlag = false;
    let queue = loadQueue();

    // Saldo GalaSilver en memoria. Se inicializa desde el DOM (HTML cargado) la primera
    // vez que se consulta y se decrementa localmente tras cada join exitoso. Al recargar
    // la pagina vuelve a leerse del DOM (las variables del modulo se reinician).
    let currentBalance = null;

    // =============================================
    // STORAGE (persistencia de la cola)
    // =============================================
    function loadQueue() {
        try {
            if (typeof GM_getValue !== 'undefined') {
                const v = GM_getValue(STORAGE_KEY, null);
                if (Array.isArray(v)) return v;
                if (typeof v === 'string') return JSON.parse(v) || [];
            }
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('[IG-BulkTools] loadQueue error:', e);
            return [];
        }
    }
    function saveQueue() {
        try {
            const json = JSON.stringify(queue);
            if (typeof GM_setValue !== 'undefined') GM_setValue(STORAGE_KEY, json);
            localStorage.setItem(STORAGE_KEY, json);
        } catch (e) {
            console.error('[IG-BulkTools] saveQueue error:', e);
        }
    }

    // =============================================
    // UTILIDADES
    // =============================================
    const rand = (min, max) => Math.floor(min + Math.random() * (max - min));
    const sleep = (ms) => new Promise(res => setTimeout(res, ms));

    // Sleep que reacciona a abortFlag cada 100ms
    async function abortableSleep(ms) {
        const step = 100;
        let elapsed = 0;
        while (elapsed < ms) {
            if (abortFlag) return;
            await sleep(Math.min(step, ms - elapsed));
            elapsed += step;
        }
    }

    function makeFakeEvent() {
        return {
            preventDefault: () => {},
            stopPropagation: () => {},
            stopImmediatePropagation: () => {},
            target: null,
        };
    }

    function makeFakeAnchor() {
        const a = document.createElement('a');
        a.setAttribute('href', '#');
        a.setAttribute('data-price', '');
        return a;
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // Lee saldo GalaSilver del DOM. Primera fuente: #galasilver-amount, que es
    // el unico elemento que el sitio actualiza en vivo tras cada respuesta de
    // /giveaways/join (success de joinGiveawayOrAuction). Si no existe (layouts
    // antiguos o paginas sin dropdown renderizado), cae al TreeWalker buscando
    // el texto "GALASILVER … N iS".
    function getGalaSilver() {
        const el = document.getElementById('galasilver-amount');
        if (el) {
            const num = parseInt((el.innerText || el.textContent || '').replace(/[,.\s]/g, ''), 10);
            if (!isNaN(num)) return num;
        }
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: (n) => /galasilver/i.test(n.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
        });
        let node;
        while ((node = walker.nextNode())) {
            let container = node.parentElement;
            for (let i = 0; i < 4 && container; i++) {
                const txt = container.textContent || '';
                const m = txt.match(/galasilver[\s\S]{0,40}?(\d[\d,.]*)\s*iS/i);
                if (m) {
                    const num = parseInt(m[1].replace(/[,.]/g, ''), 10);
                    if (!isNaN(num)) return num;
                }
                container = container.parentElement;
            }
        }
        // Fallback global por si la estructura es distinta
        const all = document.body.textContent || '';
        const m = all.match(/galasilver[\s\S]{0,40}?(\d[\d,.]*)\s*iS/i);
        if (m) {
            const num = parseInt(m[1].replace(/[,.]/g, ''), 10);
            if (!isNaN(num)) return num;
        }
        return null;
    }

    // Devuelve el saldo cacheado o lo inicializa desde el DOM la primera vez.
    // Si el DOM ya muestra un saldo MENOR que el cache (porque hubo joins
    // manuales fuera del script o el sitio refresco la cifra), prefiere el del
    // DOM como verdad mas conservadora; nunca sube por encima de lo que tenia
    // el cache (al revertir, el modal podria mostrar mas iS de los disponibles).
    function getCurrentBalance() {
        const dom = getGalaSilver();
        if (currentBalance == null) {
            currentBalance = dom;
        } else if (dom != null && dom < currentBalance) {
            currentBalance = dom;
        }
        return currentBalance;
    }

    // Decrementa el saldo cacheado tras un join exitoso, sincroniza con el DOM
    // (toma el menor) y refresca badges + estado de los botones de cola.
    function consumeBalance(amount) {
        if (currentBalance == null) {
            currentBalance = getGalaSilver();
        }
        if (currentBalance != null) {
            currentBalance = Math.max(0, currentBalance - (amount || 0));
        }
        // Re-verificar contra el div de info del usuario por si Indiegala ya
        // actualizo el saldo (caso comun: respuesta del servidor llegada antes
        // del siguiente tick) y para protegernos de quedar por encima del real.
        const dom = getGalaSilver();
        if (dom != null) {
            currentBalance = (currentBalance == null) ? dom : Math.min(currentBalance, dom);
        }
        refreshBulkBadges();
        refreshQueueButtonsState();
    }

    // Lee el saldo del DOM y SOBREESCRIBE el cache (puede subir o bajar). A
    // diferencia de getCurrentBalance/consumeBalance, no usa Math.min: aqui se
    // confia en el div del usuario como verdad. Pensado para puntos donde el
    // usuario hace una accion explicita y queremos darle la cifra mas reciente
    // (p.ej. cuando intenta encolar y el cache dice 0).
    function forceReadBalance() {
        const dom = getGalaSilver();
        if (dom != null) {
            currentBalance = dom;
            refreshBulkBadges();
            refreshQueueButtonsState();
        }
        return currentBalance;
    }

    // Re-sincroniza el saldo cacheado con el DOM tras finalizar una ejecucion
    // (cola o bulk). Inmediato + diferido a 3s para captar la respuesta del
    // servidor que pudo actualizar el div del usuario despues del loop.
    // Mantiene comportamiento conservador via Math.min en getCurrentBalance:
    // si el DOM esta stale (mas alto), el cache no sube; si el DOM ya bajo
    // (mas bajo), el cache se ajusta. Asi ningun modal abierto despues mostrara
    // un saldo superior al real.
    function resyncBalanceAfterRun() {
        const apply = () => {
            try {
                getCurrentBalance();
                refreshBulkBadges();
                refreshQueueButtonsState();
            } catch (e) {}
        };
        apply();
        setTimeout(apply, 3000);
    }

    // Cola FIFO de promesas en espera de la siguiente respuesta de /giveaways/join.
    // El loop bulk/cola se suscribe ANTES de disparar fn.call y luego await: cuando
    // ajaxComplete cae, se resuelve el primer waiter con el payload del servidor.
    // Asi el siguiente tick del loop ya tiene saldo y status reales en lugar de
    // continuar a ciegas mientras la respuesta sigue en vuelo.
    const joinResolveQueue = [];
    function awaitNextJoinResponse(timeoutMs) {
        return new Promise((resolve) => {
            let settled = false;
            const resolver = (payload) => {
                if (settled) return;
                settled = true;
                resolve(payload);
            };
            joinResolveQueue.push(resolver);
            setTimeout(() => {
                if (settled) return;
                const idx = joinResolveQueue.indexOf(resolver);
                if (idx >= 0) joinResolveQueue.splice(idx, 1);
                resolver({ timedOut: true, status: null, response: null });
            }, timeoutMs);
        });
    }

    // Engancha jQuery del sitio para capturar el saldo autoritativo que devuelve
    // /giveaways/join en cada respuesta. La pagina ya hace el POST y recibe
    // responseData.silver_tot; aqui solo escuchamos el ajaxComplete para tomar
    // ese numero como verdad y sobreescribir el cache, sin depender del DOM ni
    // del decremento local. Ademas resuelve a cualquier waiter en joinResolveQueue
    // (sea status ok o de error) para que los loops no avancen sin saber el
    // resultado del request anterior.
    function setupAjaxBalanceHook() {
        try {
            const jq = (typeof unsafeWindow !== 'undefined' && unsafeWindow.jQuery) || window.jQuery;
            if (!jq || setupAjaxBalanceHook._done) return;
            setupAjaxBalanceHook._done = true;
            jq(document).ajaxComplete(function (_e, xhr, settings) {
                if (!settings || !settings.url) return;
                if (settings.url.indexOf('/giveaways/join') === -1) return;
                let r = xhr && xhr.responseJSON;
                if (!r && xhr && typeof xhr.responseText === 'string') {
                    try { r = JSON.parse(xhr.responseText); } catch (_) { r = null; }
                }
                if (r && r.status === 'ok' && typeof r.silver_tot === 'number') {
                    currentBalance = r.silver_tot;
                    try { refreshBulkBadges(); } catch (e) {}
                    try { refreshQueueButtonsState(); } catch (e) {}
                }
                if (joinResolveQueue.length > 0) {
                    const resolver = joinResolveQueue.shift();
                    try {
                        resolver({
                            timedOut: false,
                            status: r && r.status,
                            code: r && r.code,
                            response: r,
                        });
                    } catch (_) {}
                }
            });
        } catch (e) {
            console.error('[IG-BulkTools] setupAjaxBalanceHook:', e);
        }
    }

    // Recalcula el "maximo posible" mostrado en cada badge de Extra Odds visible.
    function refreshBulkBadges() {
        const bal = currentBalance;
        document.querySelectorAll('.' + BULK_BADGE_CLASS).forEach(badge => {
            const price = parseInt(badge.dataset.price, 10);
            if (isNaN(price) || price < 1) return;
            const max = bal != null ? Math.floor(bal / price) : 0;
            badge.textContent = fmt(T.bulkBadge, { n: max });
            badge.title = fmt(T.bulkBadgeTooltip, { n: max });
        });
    }

    // Parsea el atributo onclick para extraer gid, segundo argumento de la funcion
    // (fnArg2) y token. Importante: en los Single Ticket el segundo argumento del
    // onclick NO es el precio (siempre vale 0), es un flag de tipo. El precio real
    // en iS hay que leerlo aparte de data-price (ver findDataPrice).
    function parseJoinOnclick(anchor, fnName) {
        const onclick = anchor && anchor.getAttribute && anchor.getAttribute('onclick');
        if (!onclick) return null;
        const re = new RegExp(fnName + '\\s*\\(\\s*this\\s*,\\s*event\\s*,\\s*\'([^\']+)\'\\s*,\\s*(\\d+)\\s*,\\s*\'([^\']+)\'\\s*\\)');
        const m = onclick.match(re);
        if (!m) return null;
        const fnArg2 = parseInt(m[2], 10);
        // params.price arranca con fnArg2 como fallback; cada sitio de inyeccion
        // debe sobreescribirlo con el data-price real.
        return { gid: m[1], price: fnArg2, fnArg2: fnArg2, token: m[3], fnName };
    }

    // Busca el data-price real del card (precio en iS).
    function findDataPrice(scope) {
        if (!scope) return null;
        const sels = [
            '.items-list-item-data-button a[data-price]',
            '.card-join a[data-price]',
            'a[data-price]',
        ];
        for (const sel of sels) {
            const el = scope.querySelector(sel);
            if (el) {
                const v = parseInt(el.getAttribute('data-price'), 10);
                if (!isNaN(v)) return v;
            }
        }
        return null;
    }

    // Re-encuentra el trigger por gid (por si el DOM se actualiza tras cada join)
    function findTrigger(params) {
        if (params.fnName === 'joinGiveawayCard') {
            return document.querySelector('.card-join a[data-price]');
        }
        const all = document.querySelectorAll('a.items-list-item-ticket-click');
        for (const a of all) {
            const onclick = a.getAttribute('onclick') || '';
            if (onclick.indexOf("'" + params.gid + "'") !== -1) return a;
        }
        return null;
    }

    // Detecta si el card mostro un error (el sitio expone .card-error / .items-list-item-error)
    function isErrorVisible(triggerEl) {
        const candidates = [];
        if (triggerEl) {
            let p = triggerEl.parentElement;
            for (let i = 0; i < 8 && p; i++) {
                p.querySelectorAll && p.querySelectorAll('.card-error, .items-list-item-error').forEach(e => candidates.push(e));
                p = p.parentElement;
            }
        }
        if (!candidates.length) {
            document.querySelectorAll('.card-error, .items-list-item-error').forEach(e => candidates.push(e));
        }
        for (const e of candidates) {
            const cs = window.getComputedStyle(e);
            if (cs.display !== 'none' && cs.visibility !== 'hidden' && (e.offsetWidth > 0 || e.offsetHeight > 0)) {
                return true;
            }
        }
        return false;
    }

    // =============================================
    // PATH HELPERS
    // =============================================
    // Cola Single Ticket: solo en /giveaways (no en /giveaways/card/*)
    function isListingRoot() {
        return /^\/giveaways\/?$/.test(location.pathname);
    }
    function isCardDetail() {
        return /^\/giveaways\/card\//.test(location.pathname);
    }

    // =============================================
    // OPERACIONES DE COLA
    // =============================================
    function isInQueue(gid) { return queue.some(q => q.gid === gid); }
    function addToQueue(item) {
        if (isInQueue(item.gid)) return;
        queue.push(item);
        saveQueue();
        renderQueuePanel();
        refreshQueueButtonsState();
    }
    function removeFromQueue(gid) {
        queue = queue.filter(q => q.gid !== gid);
        saveQueue();
        renderQueuePanel();
        refreshQueueButtonsState();
    }
    function clearQueue() {
        queue = [];
        saveQueue();
        renderQueuePanel();
        refreshQueueButtonsState();
    }

    // =============================================
    // ESTILOS
    // =============================================
    function injectStyles() {
        if (document.getElementById('ig-bulk-styles')) return;
        const style = document.createElement('style');
        style.id = 'ig-bulk-styles';
        style.textContent = `
            .${BULK_BTN_CLASS} {
                display: block;
                width: 100%;
                margin-top: 8px;
                padding: 10px 14px;
                font-weight: bold;
                color: #fff;
                background: linear-gradient(90deg, #6a1b9a 0%, #ad1457 100%);
                border: none;
                border-radius: 6px;
                cursor: pointer;
                text-align: center;
                font-size: 14px;
                letter-spacing: 0.5px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.25);
                transition: filter 0.15s;
            }
            .${BULK_BTN_CLASS}:hover { filter: brightness(1.15); }
            .${BULK_BTN_CLASS}:disabled { opacity: 0.5; cursor: not-allowed; }

            .${BULK_BADGE_CLASS} {
                position: absolute;
                top: 6px;
                right: 6px;
                z-index: 50;
                padding: 4px 8px;
                font-size: 11px;
                font-weight: bold;
                color: #fff;
                background: linear-gradient(135deg, #6a1b9a 0%, #ad1457 100%);
                border-radius: 12px;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0,0,0,0.4);
                user-select: none;
                line-height: 1;
            }
            .${BULK_BADGE_CLASS}:hover { filter: brightness(1.2); }

            .${QBTN_CLASS} {
                position: absolute;
                top: 6px;
                left: 6px;
                z-index: 50;
                width: 26px; height: 26px;
                line-height: 24px;
                text-align: center;
                font-size: 14px; font-weight: bold;
                color: #fff;
                background: rgba(70, 70, 70, 0.85);
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0,0,0,0.4);
                user-select: none;
                transition: transform 0.1s, background 0.15s;
            }
            .${QBTN_CLASS}:hover { transform: scale(1.1); }
            .${QBTN_CLASS}.ig-q-btn-active {
                background: linear-gradient(135deg, #2e7d32 0%, #66bb6a 100%);
                border-color: #fff;
            }
            .${QBTN_CLASS}.ig-q-btn-disabled {
                opacity: 0.4;
                cursor: not-allowed;
                background: rgba(40, 40, 40, 0.85);
            }
            .${QBTN_CLASS}.ig-q-btn-disabled:hover { transform: none; }

            #${PANEL_ID} {
                position: fixed;
                bottom: 20px; left: 20px;
                width: 320px;
                background: #1f1f1f; color: #fff;
                border: 2px solid #d32f2f;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                font-family: sans-serif;
                z-index: 99997;
                max-height: 70vh;
                display: flex; flex-direction: column;
            }
            #${PANEL_ID} .ig-q-warning-bar {
                background: #4a1010;
                border-left: 4px solid #ff5252;
                padding: 8px 10px;
                font-size: 11px; color: #ffb3b3;
                line-height: 1.3;
                border-radius: 6px 6px 0 0;
            }
            #${PANEL_ID} h4 {
                margin: 0; padding: 10px 12px 6px;
                font-size: 14px; color: #ff7da6;
            }
            #${PANEL_ID} .ig-q-summary {
                padding: 0 12px 8px;
                font-size: 12px; color: #ccc;
            }
            #${PANEL_ID} .ig-q-list {
                list-style: none; margin: 0;
                padding: 0 4px;
                overflow-y: auto;
                flex: 1;
                max-height: 280px;
            }
            #${PANEL_ID} .ig-q-list li {
                display: flex; align-items: center; gap: 6px;
                padding: 6px 8px;
                font-size: 12px;
                border-bottom: 1px solid #333;
            }
            #${PANEL_ID} .ig-q-it-title {
                flex: 1;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                color: #fff;
            }
            #${PANEL_ID} .ig-q-it-price { color: #ff7da6; font-weight: bold; }
            #${PANEL_ID} .ig-q-it-rem {
                width: 22px; height: 22px;
                border: none; border-radius: 50%;
                background: #c62828; color: #fff;
                cursor: pointer; font-weight: bold;
                font-size: 12px; line-height: 1;
            }
            #${PANEL_ID} .ig-q-actions {
                display: flex; gap: 6px;
                padding: 10px 12px;
                border-top: 1px solid #333;
            }
            #${PANEL_ID} .ig-q-actions button {
                flex: 1;
                padding: 8px;
                border: none; border-radius: 4px;
                font-size: 12px; font-weight: bold;
                cursor: pointer;
            }
            #${PANEL_ID} #ig-q-clear { background: #555; color: #fff; }
            #${PANEL_ID} #ig-q-exec {
                color: #fff;
                background: linear-gradient(90deg, #6a1b9a 0%, #ad1457 100%);
            }
            #${PANEL_ID} #ig-q-exec:disabled { opacity: 0.5; cursor: not-allowed; }

            #${MODAL_ID}-backdrop {
                position: fixed; inset: 0;
                background: rgba(0,0,0,0.6);
                z-index: 99998;
                display: flex; align-items: center; justify-content: center;
            }
            #${MODAL_ID} {
                background: #fff; color: #222;
                border-radius: 8px;
                padding: 20px 24px;
                max-width: 460px; width: 90%;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                font-family: sans-serif;
            }
            #${MODAL_ID} h3 { margin: 0 0 12px; font-size: 18px; color: #ad1457; }
            #${MODAL_ID} .ig-warning {
                background: #fff3cd;
                border: 2px solid #d32f2f;
                border-radius: 6px;
                padding: 10px 12px;
                margin: 0 0 14px;
                color: #5a1010;
                font-size: 12px;
                line-height: 1.4;
            }
            #${MODAL_ID} .ig-warning b { color: #b71c1c; display: block; margin-bottom: 4px; font-size: 13px; }
            #${MODAL_ID} .ig-warning a { color: #b71c1c; font-weight: bold; }
            #${MODAL_ID} .ig-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
            #${MODAL_ID} .ig-row b { color: #444; }
            #${MODAL_ID} input[type="number"] {
                width: 100%;
                padding: 8px 10px;
                margin: 8px 0 4px;
                border: 1px solid #ccc; border-radius: 4px;
                font-size: 16px; text-align: center;
            }
            #${MODAL_ID} .ig-note { font-size: 11px; color: #777; margin: 6px 0 12px; }
            #${MODAL_ID} .ig-actions { display: flex; gap: 8px; margin-top: 12px; }
            #${MODAL_ID} button {
                flex: 1;
                padding: 10px;
                border: none; border-radius: 6px;
                font-weight: bold; cursor: pointer;
                font-size: 14px;
            }
            #${MODAL_ID} .ig-confirm {
                color: #fff;
                background: linear-gradient(90deg, #6a1b9a 0%, #ad1457 100%);
            }
            #${MODAL_ID} .ig-cancel { background: #eee; color: #333; }

            #${PROGRESS_OVERLAY_ID} {
                position: fixed; bottom: 20px; right: 20px;
                background: #1f1f1f; color: #fff;
                padding: 14px 18px;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                z-index: 99999;
                font-family: sans-serif;
                min-width: 280px;
            }
            #${PROGRESS_OVERLAY_ID} h4 {
                margin: 0 0 8px; font-size: 14px;
                color: #ff7da6;
            }
            #${PROGRESS_OVERLAY_ID} .ig-prog-bar {
                width: 100%; height: 6px;
                background: #333; border-radius: 3px;
                overflow: hidden; margin: 8px 0;
            }
            #${PROGRESS_OVERLAY_ID} .ig-prog-fill {
                height: 100%;
                background: linear-gradient(90deg, #6a1b9a 0%, #ad1457 100%);
                width: 0%; transition: width 0.3s;
            }
            #${PROGRESS_OVERLAY_ID} .ig-prog-status { font-size: 12px; color: #ccc; }
            #${PROGRESS_OVERLAY_ID} .ig-prog-warning {
                margin-top: 8px;
                padding: 6px 8px;
                background: #4a1010;
                border-left: 3px solid #ff5252;
                border-radius: 3px;
                font-size: 11px;
                color: #ffb3b3;
                line-height: 1.3;
            }
            #${PROGRESS_OVERLAY_ID} .ig-prog-actions {
                margin-top: 10px;
                display: flex;
                gap: 6px;
            }
            #${PROGRESS_OVERLAY_ID} button {
                padding: 6px 12px;
                font-size: 12px; font-weight: bold;
                border: none; border-radius: 4px;
                cursor: pointer;
                background: #c62828; color: #fff;
            }
            #${PROGRESS_OVERLAY_ID} button.ig-prog-close { background: #444; }
            #${PROGRESS_OVERLAY_ID} button.ig-prog-continue {
                background: linear-gradient(90deg, #6a1b9a 0%, #ad1457 100%);
            }

            #ig-toast-container {
                position: fixed;
                top: 20px; right: 20px;
                z-index: 100000;
                display: flex; flex-direction: column;
                gap: 8px;
                pointer-events: none;
            }
            .ig-toast {
                background: #1f1f1f;
                color: #fff;
                border-left: 4px solid #888;
                border-radius: 6px;
                padding: 12px 16px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.4);
                font-family: sans-serif;
                font-size: 13px;
                line-height: 1.35;
                max-width: 360px;
                min-width: 220px;
                cursor: pointer;
                pointer-events: auto;
                opacity: 0;
                transform: translateX(20px);
                transition: opacity 0.25s, transform 0.25s;
            }
            .ig-toast-visible { opacity: 1; transform: translateX(0); }
            .ig-toast-info { border-left-color: #2196f3; }
            .ig-toast-warn { border-left-color: #ff9800; background: #2a1f10; }
            .ig-toast-error { border-left-color: #d32f2f; background: #2a1010; }

            .ig-confirm-backdrop {
                position: fixed; inset: 0;
                background: rgba(0,0,0,0.65);
                z-index: 100001;
                display: flex; align-items: center; justify-content: center;
            }
            .ig-confirm-modal {
                background: #fff; color: #222;
                border-radius: 8px;
                padding: 20px 24px;
                max-width: 420px; width: 90%;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                font-family: sans-serif;
            }
            .ig-confirm-modal h3 {
                margin: 0 0 10px; font-size: 16px; color: #ad1457;
            }
            .ig-confirm-modal p {
                margin: 0 0 14px; font-size: 14px; line-height: 1.45;
                white-space: pre-wrap;
            }
            .ig-confirm-actions { display: flex; gap: 8px; }
            .ig-confirm-actions button {
                flex: 1;
                padding: 10px;
                border: none; border-radius: 6px;
                font-weight: bold; cursor: pointer;
                font-size: 14px;
            }
            .ig-confirm-cancel { background: #eee; color: #333; }
            .ig-confirm-ok {
                color: #fff;
                background: linear-gradient(90deg, #6a1b9a 0%, #ad1457 100%);
            }

            #${MODAL_ID} .ig-inline-error {
                color: #b71c1c;
                font-size: 12px;
                margin-top: 6px;
                padding: 6px 10px;
                background: #ffebee;
                border: 1px solid #ef9a9a;
                border-radius: 4px;
                display: none;
            }
            #${MODAL_ID} .ig-inline-error.ig-visible { display: block; }
        `;
        document.head.appendChild(style);
    }

    // =============================================
    // TOAST (notificaciones no-bloqueantes)
    // =============================================
    function showToast(message, type) {
        let container = document.getElementById('ig-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'ig-toast-container';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = 'ig-toast ig-toast-' + (type || 'info');
        toast.textContent = message;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('ig-toast-visible'));
        const dismiss = () => {
            toast.classList.remove('ig-toast-visible');
            setTimeout(() => toast.remove(), 300);
        };
        toast.addEventListener('click', dismiss);
        setTimeout(dismiss, 4500);
    }

    // =============================================
    // CONFIRM MODAL (reemplazo de window.confirm)
    // =============================================
    function showConfirm(message, title) {
        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'ig-confirm-backdrop';
            backdrop.innerHTML = `
                <div class="ig-confirm-modal">
                    ${title ? `<h3>${escapeHtml(title)}</h3>` : ''}
                    <p>${escapeHtml(message)}</p>
                    <div class="ig-confirm-actions">
                        <button class="ig-confirm-cancel">${T.modalCancel}</button>
                        <button class="ig-confirm-ok">${T.modalConfirm}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(backdrop);
            const close = (val) => { backdrop.remove(); resolve(val); };
            backdrop.querySelector('.ig-confirm-cancel').addEventListener('click', () => close(false));
            backdrop.querySelector('.ig-confirm-ok').addEventListener('click', () => close(true));
            backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(false); });
            document.addEventListener('keydown', function escHandler(e) {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', escHandler);
                    close(false);
                }
            });
        });
    }

    // =============================================
    // MODAL: BULK JOIN (Extra Odds)
    // =============================================
    function openBulkConfirmModal(params, balance, contextLabel) {
        return new Promise((resolve) => {
            const maxCount = Math.floor(balance / params.price);
            const backdrop = document.createElement('div');
            backdrop.id = MODAL_ID + '-backdrop';
            backdrop.innerHTML = `
                <div id="${MODAL_ID}">
                    <h3>${T.modalTitle}</h3>
                    <div class="ig-warning">
                        <b>${T.warningTitle}</b>
                        ${T.warningBody}
                        <div style="margin-top:6px"><a href="https://docs.indiegala.com/giveaways_auctions_trades/spam.html" target="_blank" rel="noopener">${T.warningPolicyLink}</a></div>
                    </div>
                    <div class="ig-row"><b>${T.modalGiveaway}</b><span>${escapeHtml(contextLabel)}</span></div>
                    <div class="ig-row"><b>${T.modalPrice}</b><span>${params.price} iS</span></div>
                    <div class="ig-row"><b>${T.modalBalance}</b><span>${balance} iS</span></div>
                    <div class="ig-row"><b>${T.modalMax}</b><span>${maxCount}</span></div>
                    <label style="display:block;margin-top:10px;font-size:12px;color:#555">${T.modalCount}:</label>
                    <input type="number" id="ig-bulk-count" min="1" max="${maxCount}" value="${maxCount}">
                    <div class="ig-inline-error" id="ig-bulk-error"></div>
                    <div class="ig-row"><b>${T.modalTotalCost}</b><span id="ig-bulk-total">${maxCount * params.price} iS</span></div>
                    <div class="ig-note">${T.modalDelays}</div>
                    <div class="ig-actions">
                        <button class="ig-cancel">${T.modalCancel}</button>
                        <button class="ig-confirm">${T.modalConfirm}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(backdrop);

            const input = backdrop.querySelector('#ig-bulk-count');
            const totalSpan = backdrop.querySelector('#ig-bulk-total');
            const errorEl = backdrop.querySelector('#ig-bulk-error');
            const updateTotal = () => {
                const v = parseInt(input.value, 10);
                totalSpan.textContent = (isNaN(v) ? 0 : v * params.price) + ' iS';
                errorEl.classList.remove('ig-visible');
            };
            input.addEventListener('input', updateTotal);
            input.focus();
            input.select();

            const close = (val) => { backdrop.remove(); resolve(val); };
            backdrop.querySelector('.ig-cancel').addEventListener('click', () => close(null));
            backdrop.querySelector('.ig-confirm').addEventListener('click', () => {
                const v = parseInt(input.value, 10);
                if (isNaN(v) || v < 1 || v > maxCount) {
                    errorEl.textContent = fmt(T.invalidCount, { max: maxCount });
                    errorEl.classList.add('ig-visible');
                    input.focus();
                    input.select();
                    return;
                }
                close(v);
            });
            backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(null); });
            document.addEventListener('keydown', function escHandler(e) {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', escHandler);
                    close(null);
                }
            });
        });
    }

    // =============================================
    // MODAL: COLA (Single Ticket)
    // =============================================
    function openQueueConfirmModal() {
        return new Promise((resolve) => {
            const balance = getCurrentBalance();
            if (balance == null) { showToast(T.balanceUnknown, 'error'); resolve(false); return; }
            const totalCost = queue.reduce((s, q) => s + (q.price || 0), 0);

            const backdrop = document.createElement('div');
            backdrop.id = MODAL_ID + '-backdrop';
            backdrop.innerHTML = `
                <div id="${MODAL_ID}">
                    <h3>${T.queueExecuteConfirmTitle}</h3>
                    <div class="ig-warning">
                        <b>${T.warningTitle}</b>
                        ${T.warningBody}
                        <div style="margin-top:6px"><a href="https://docs.indiegala.com/giveaways_auctions_trades/spam.html" target="_blank" rel="noopener">${T.warningPolicyLink}</a></div>
                    </div>
                    <div class="ig-row"><b>${T.queueModalCount}</b><span>${queue.length}</span></div>
                    <div class="ig-row"><b>${T.modalTotalCost}</b><span>${totalCost} iS</span></div>
                    <div class="ig-row"><b>${T.modalBalance}</b><span>${balance} iS</span></div>
                    <div class="ig-note">${T.modalDelays}</div>
                    <div class="ig-actions">
                        <button class="ig-cancel">${T.modalCancel}</button>
                        <button class="ig-confirm">${T.modalConfirm}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(backdrop);

            const close = (val) => { backdrop.remove(); resolve(val); };
            backdrop.querySelector('.ig-cancel').addEventListener('click', () => close(false));
            backdrop.querySelector('.ig-confirm').addEventListener('click', async () => {
                if (balance < totalCost) {
                    const ok = await showConfirm(
                        fmt(T.queueLowBalance, { balance, cost: totalCost }),
                        T.warningTitle
                    );
                    if (!ok) return;
                }
                close(true);
            });
            backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(false); });
            document.addEventListener('keydown', function escHandler(e) {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', escHandler);
                    close(false);
                }
            });
        });
    }

    // =============================================
    // OVERLAY DE PROGRESO (compartido)
    // =============================================
    function showProgressOverlay(total, mode) {
        let overlay = document.getElementById(PROGRESS_OVERLAY_ID);
        if (overlay) overlay.remove();
        overlay = document.createElement('div');
        overlay.id = PROGRESS_OVERLAY_ID;
        const title = mode === 'queue' ? T.progressTitleQueue : T.progressTitle;
        const warn = mode === 'queue' ? T.warningProgressQueue : T.warningProgress;
        overlay.innerHTML = `
            <h4>${title}</h4>
            <div class="ig-prog-status" id="ig-prog-status">${fmt(T.progressStatus, { i: 0, n: total })}</div>
            <div class="ig-prog-bar"><div class="ig-prog-fill" id="ig-prog-fill"></div></div>
            <div class="ig-prog-warning">${warn}</div>
            <div class="ig-prog-actions"><button id="ig-prog-stop">${T.stopBtn}</button></div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('ig-prog-stop').addEventListener('click', () => { abortFlag = true; });
    }

    function updateProgress(done, total, statusText) {
        const status = document.getElementById('ig-prog-status');
        const fill = document.getElementById('ig-prog-fill');
        if (status) status.textContent = statusText || fmt(T.progressStatus, { i: done, n: total });
        if (fill) fill.style.width = Math.min(100, Math.round((done / total) * 100)) + '%';
    }

    // Si onContinue es una funcion, se renderiza el boton "Continuar" junto a
    // "Cerrar". Al pulsarlo, se cierra el overlay actual y se invoca el callback
    // (puede mostrar su propia confirmacion antes de re-disparar el loop).
    function finalizeProgress(done, total, finalMsg, onContinue) {
        const overlay = document.getElementById(PROGRESS_OVERLAY_ID);
        if (!overlay) return;
        overlay.querySelector('.ig-prog-status').textContent = finalMsg || fmt(T.progressDone, { ok: done });
        const actions = overlay.querySelector('.ig-prog-actions');
        if (typeof onContinue === 'function') {
            actions.innerHTML = `
                <button class="ig-prog-close">${T.closeBtn}</button>
                <button class="ig-prog-continue">${T.continueBtn}</button>
            `;
            actions.querySelector('.ig-prog-close').addEventListener('click', () => overlay.remove());
            actions.querySelector('.ig-prog-continue').addEventListener('click', async () => {
                overlay.remove();
                try { await onContinue(); } catch (e) { console.error('[IG-BulkTools] onContinue error:', e); }
            });
        } else {
            actions.innerHTML = `<button class="ig-prog-close">${T.closeBtn}</button>`;
            actions.querySelector('.ig-prog-close').addEventListener('click', () => overlay.remove());
        }
    }

    // Reasons que disparan stop con codigo identificable. Mapea status del
    // server (silver/too_fast/banned) y condiciones locales a un codigo
    // interno usado por la logica de "Continuar" (independiente del idioma).
    // 'banned' nunca permite continuar; 'too_fast' pide confirmacion explicita.
    function stopReasonFromCode(code) {
        switch (code) {
            case 'aborted': return T.progressAborted;
            case 'balance_low': return T.progressBalanceLow;
            case 'too_fast': return T.progressTooFast;
            case 'banned': return T.progressBanned;
            case 'timeout': return T.progressJoinTimeout;
            case 'trigger_lost': return T.progressTriggerLost;
            case 'error': return T.progressErrorDetected;
            default: return null;
        }
    }
    function isRecoverableStopCode(code) {
        // 'banned' no es recuperable por politica del servidor; null/undefined
        // significa que el loop termino limpio (no hay nada que continuar).
        return code != null && code !== 'banned';
    }

    // =============================================
    // LOOP: BULK JOIN (Extra Odds — N veces el mismo gid)
    // opts.resumeCount: si viene, se omite el modal y se intentan N iteraciones
    // adicionales (cap a max posible con saldo actual). Lo usa el boton Continuar.
    // =============================================
    async function runBulkJoin(params, contextLabel, opts) {
        opts = opts || {};
        if (running) { showToast(T.alreadyRunning, 'warn'); return; }

        const balance = getCurrentBalance();
        if (balance == null) { showToast(T.balanceUnknown, 'error'); return; }
        if (Math.floor(balance / params.price) < 1) { showToast(T.notEnough, 'warn'); return; }

        let requested;
        if (opts.resumeCount && opts.resumeCount > 0) {
            requested = Math.min(opts.resumeCount, Math.floor(balance / params.price));
            if (requested < 1) { showToast(T.notEnough, 'warn'); return; }
        } else {
            requested = await openBulkConfirmModal(params, balance, contextLabel);
            if (!requested) return;
        }

        running = true;
        abortFlag = false;
        showProgressOverlay(requested, 'bulk');

        let done = 0;
        let stopCode = null;
        try {
            for (let i = 0; i < requested; i++) {
                if (abortFlag) { stopCode = 'aborted'; break; }

                if (i > 0 && i % CFG.longPauseEvery === 0) {
                    updateProgress(done, requested, T.progressLongPause);
                    await abortableSleep(rand(CFG.longPauseMinMs, CFG.longPauseMaxMs));
                    if (abortFlag) { stopCode = 'aborted'; break; }
                }

                const trigger = findTrigger(params);
                if (!trigger) { stopCode = 'trigger_lost'; break; }

                if (isErrorVisible(trigger)) { stopCode = 'error'; break; }

                const balNow = getCurrentBalance();
                if (balNow != null && balNow < params.price) { stopCode = 'balance_low'; break; }

                try {
                    const fn = unsafeWindow[params.fnName];
                    if (typeof fn !== 'function') { stopCode = 'trigger_lost'; break; }
                    // Suscribir ANTES del fn.call para no perder el ajaxComplete
                    // si el sitio responde demasiado rapido. El hook actualiza
                    // currentBalance con r.silver_tot, asi que aqui no se llama
                    // a consumeBalance — duplicaria el decremento.
                    // Forzar el flag global del sitio: si el trigger no esta en
                    // el DOM (p.ej. cambiamos de pagina), los callbacks de
                    // animacion no se ejecutan y el flag queda en false,
                    // bloqueando todas las siguientes iteraciones.
                    try { unsafeWindow.joinGiveawayOrAuctionAJS = true; } catch (_) {}
                    const joinPromise = awaitNextJoinResponse(CFG.joinResponseTimeoutMs);
                    fn.call(trigger, trigger, makeFakeEvent(), params.gid, params.fnArg2, params.token);
                    const result = await joinPromise;
                    if (result.timedOut) { stopCode = 'timeout'; break; }
                    const st = result.status;
                    if (st === 'ok') {
                        done++;
                        updateProgress(done, requested);
                    } else if (st === 'silver') { stopCode = 'balance_low'; break; }
                    else if (st === 'too_fast') { stopCode = 'too_fast'; break; }
                    else if (st === 'banned') { stopCode = 'banned'; break; }
                    else { stopCode = 'error'; break; }
                } catch (e) {
                    console.error('[IG-BulkTools] error en bulk join:', e);
                    stopCode = 'error';
                    break;
                }

                if (i < requested - 1) {
                    await abortableSleep(rand(CFG.minDelayMs, CFG.maxDelayMs));
                }
            }
        } finally {
            running = false;
            const stopReason = stopReasonFromCode(stopCode);
            const finalMsg = stopReason
                ? `${stopReason} (${done}/${requested})`
                : fmt(T.progressDone, { ok: done });

            // Boton "Continuar": solo si la causa es recuperable y aun queda
            // trabajo pendiente. Para too_fast pedimos confirmacion explicita
            // porque continuar pronto eleva el riesgo de ban.
            const remaining = requested - done;
            let onContinue = null;
            if (isRecoverableStopCode(stopCode) && remaining > 0) {
                const codeAtBreak = stopCode;
                onContinue = async () => {
                    if (codeAtBreak === 'too_fast') {
                        const ok = await showConfirm(T.continueTooFastWarning, T.warningTitle);
                        if (!ok) return;
                    }
                    await runBulkJoin(params, contextLabel, { resumeCount: remaining });
                };
            }
            finalizeProgress(done, requested, finalMsg, onContinue);
            resyncBalanceAfterRun();
        }
    }

    // =============================================
    // LOOP: COLA (Single Ticket — N gids distintos, 1 vez cada uno)
    // opts.skipConfirm: si true, no se muestra el modal de confirmacion
    // (lo usa el boton Continuar tras un stop recuperable).
    // =============================================
    async function executeQueue(opts) {
        opts = opts || {};
        if (running) { showToast(T.alreadyRunning, 'warn'); return; }
        if (!queue.length) return;

        if (!opts.skipConfirm) {
            const ok = await openQueueConfirmModal();
            if (!ok) return;
        }

        running = true;
        abortFlag = false;
        renderQueuePanel();

        const items = queue.slice();
        const total = items.length;
        showProgressOverlay(total, 'queue');

        let success = 0;
        let stopCode = null;

        try {
            for (let i = 0; i < items.length; i++) {
                if (abortFlag) { stopCode = 'aborted'; break; }

                const it = items[i];

                if (i > 0 && i % CFG.longPauseEvery === 0) {
                    updateProgress(success, total, T.progressLongPause);
                    await abortableSleep(rand(CFG.longPauseMinMs, CFG.longPauseMaxMs));
                    if (abortFlag) { stopCode = 'aborted'; break; }
                }

                updateProgress(success, total, fmt(T.queueProgressItem, { title: it.title, i: i + 1, n: total }));

                // Refrescar token, fnArg2 y price desde el DOM si el card sigue visible.
                // Si el item de la cola es viejo (sin fnArg2 guardado), caer al precio
                // como fallback (compatibilidad hacia atras con colas persistidas antes
                // de separar fnArg2/price).
                let gid = it.gid;
                let price = it.price;
                let token = it.token;
                let fnArg2 = (it.fnArg2 != null) ? it.fnArg2 : it.price;
                let triggerEl = findTrigger({ gid: it.gid, fnName: 'joinGiveawayOrAuction' });
                if (triggerEl) {
                    const live = parseJoinOnclick(triggerEl, 'joinGiveawayOrAuction');
                    if (live) { gid = live.gid; token = live.token; fnArg2 = live.fnArg2; }
                    const liveItem = triggerEl.closest('.items-list-item');
                    const dp = findDataPrice(liveItem || document);
                    if (dp != null) price = dp;
                    if (isErrorVisible(triggerEl)) { stopCode = 'error'; break; }
                }

                const balNow = getCurrentBalance();
                if (balNow != null && balNow < price) { stopCode = 'balance_low'; break; }

                try {
                    const fn = unsafeWindow.joinGiveawayOrAuction;
                    if (typeof fn !== 'function') { stopCode = 'trigger_lost'; break; }
                    const elForCall = triggerEl || makeFakeAnchor();
                    // Suscribir ANTES del fn.call para no perder el ajaxComplete.
                    // Ya no se llama a consumeBalance: el hook actualiza el saldo
                    // con r.silver_tot autoritativo del servidor.
                    // Forzar el flag global del sitio: si la pagina cambio entre
                    // encolar y ejecutar, el trigger no existe y los callbacks
                    // de animacion no se ejecutan, dejando el flag en false y
                    // bloqueando todas las iteraciones siguientes en silencio.
                    try { unsafeWindow.joinGiveawayOrAuctionAJS = true; } catch (_) {}
                    const joinPromise = awaitNextJoinResponse(CFG.joinResponseTimeoutMs);
                    fn.call(elForCall, elForCall, makeFakeEvent(), gid, fnArg2, token);
                    const result = await joinPromise;
                    if (result.timedOut) { stopCode = 'timeout'; break; }
                    const st = result.status;
                    if (st === 'ok') {
                        success++;
                        removeFromQueue(it.gid);
                        updateProgress(success, total, fmt(T.queueProgressItem, { title: it.title, i: i + 1, n: total }));
                    } else if (st === 'silver') { stopCode = 'balance_low'; break; }
                    else if (st === 'too_fast') { stopCode = 'too_fast'; break; }
                    else if (st === 'banned') { stopCode = 'banned'; break; }
                    else if (st === 'duplicate' || st === 'limit_reached' || st === 'not_available' || st === 'level' || st === 'owner') {
                        // Item invalido para este usuario / no joinable: quitarlo
                        // de la cola y seguir con el siguiente.
                        removeFromQueue(it.gid);
                    }
                    // status === 'server' u otros desconocidos: dejar en cola para reintentar y seguir
                } catch (e) {
                    console.error('[IG-BulkTools] error en queue join:', it, e);
                    // Continuar con el siguiente item
                }

                if (i < items.length - 1) {
                    await abortableSleep(rand(CFG.minDelayMs, CFG.maxDelayMs));
                }
            }
        } finally {
            running = false;
            const stopReason = stopReasonFromCode(stopCode);
            const finalMsg = stopReason
                ? `${stopReason} (${success}/${total})`
                : fmt(T.queueDone, { ok: success, n: total });

            // Boton "Continuar": permitido si la causa es recuperable y aun
            // quedan items en la cola persistida (los procesados con ok ya
            // fueron eliminados, asi que executeQueue procesara los restantes).
            let onContinue = null;
            if (isRecoverableStopCode(stopCode) && queue.length > 0) {
                const codeAtBreak = stopCode;
                onContinue = async () => {
                    if (codeAtBreak === 'too_fast') {
                        const ok = await showConfirm(T.continueTooFastWarning, T.warningTitle);
                        if (!ok) return;
                    }
                    await executeQueue({ skipConfirm: true });
                };
            }
            finalizeProgress(success, total, finalMsg, onContinue);
            renderQueuePanel();
            resyncBalanceAfterRun();
        }
    }

    // =============================================
    // PANEL FLOTANTE DE LA COLA (solo en /giveaways)
    // =============================================
    function renderQueuePanel() {
        const existing = document.getElementById(PANEL_ID);

        // Si no estamos en el listado raiz, ocultar el panel pero mantener la cola persistida
        if (!isListingRoot()) {
            if (existing) existing.remove();
            return;
        }

        let panel = existing;
        if (!panel) {
            panel = document.createElement('div');
            panel.id = PANEL_ID;
            document.body.appendChild(panel);
        }
        if (!queue.length) {
            panel.style.display = 'none';
            panel.innerHTML = '';
            return;
        }
        panel.style.display = '';
        const totalCost = queue.reduce((s, q) => s + (q.price || 0), 0);
        const items = queue.map(q => `
            <li>
                <span class="ig-q-it-title" title="${escapeHtml(q.title)} — ${escapeHtml(q.timeLeft || '')}">${escapeHtml(q.title)}</span>
                <span class="ig-q-it-price">${q.price} iS</span>
                <button class="ig-q-it-rem" data-gid="${escapeHtml(q.gid)}" title="${T.queueRemoveBtnTooltip}">×</button>
            </li>
        `).join('');
        panel.innerHTML = `
            <div class="ig-q-warning-bar">${T.warningProgressQueue}</div>
            <h4>${T.queuePanelTitle}</h4>
            <div class="ig-q-summary">${fmt(T.queueTotalCost, { n: queue.length, cost: totalCost })}</div>
            <ul class="ig-q-list">${items}</ul>
            <div class="ig-q-actions">
                <button id="ig-q-clear">${T.queueClearBtn}</button>
                <button id="ig-q-exec"${running ? ' disabled' : ''}>${T.queueExecuteBtn}</button>
            </div>
        `;
        panel.querySelectorAll('.ig-q-it-rem').forEach(b => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                removeFromQueue(b.dataset.gid);
            });
        });
        panel.querySelector('#ig-q-clear').addEventListener('click', async () => {
            const ok = await showConfirm(T.queueClearConfirm);
            if (ok) clearQueue();
        });
        panel.querySelector('#ig-q-exec').addEventListener('click', executeQueue);
    }

    function refreshQueueButtonsState() {
        const bal = currentBalance; // saldo crudo (no fuerza lectura DOM aqui)
        document.querySelectorAll('.' + QBTN_CLASS).forEach(btn => {
            const gid = btn.dataset.gid;
            const inQ = isInQueue(gid);
            // Solo se "deshabilita" visualmente para AÑADIR; los items ya en cola
            // siempre permiten quitarse aunque el saldo sea 0.
            const noBalance = !inQ && bal != null && bal <= 0;
            btn.classList.toggle('ig-q-btn-active', inQ);
            btn.classList.toggle('ig-q-btn-disabled', noBalance);
            btn.textContent = inQ ? T.queueRemoveBtn : T.queueAddBtn;
            btn.title = inQ
                ? T.queueRemoveBtnTooltip
                : (noBalance ? T.queueNoBalanceTooltip : T.queueAddBtnTooltip);
        });
    }

    // =============================================
    // INYECCION: PAGINA DE CARD (/giveaways/card/*)
    // =============================================
    function injectCardDetail() {
        if (!isCardDetail()) return;

        let isExtraOdds = false;
        document.querySelectorAll('.card-data .card-data-text').forEach(el => {
            if (/^extra\s*odds$/i.test(el.textContent.trim())) isExtraOdds = true;
        });
        if (!isExtraOdds) return;

        const joinAnchor = document.querySelector('.card-join a[data-price]');
        if (!joinAnchor) return;
        const cardJoinDiv = joinAnchor.closest('.card-join');
        if (!cardJoinDiv || cardJoinDiv.parentElement.querySelector('.' + BULK_BTN_CLASS)) return;

        const params = parseJoinOnclick(joinAnchor, 'joinGiveawayCard');
        if (!params) return;
        // En el card detail, joinAnchor es el mismo elemento con data-price
        const dpCard = parseInt(joinAnchor.getAttribute('data-price'), 10);
        if (!isNaN(dpCard)) params.price = dpCard;

        const title = (document.querySelector('.card-title h1') || {}).textContent || `#${params.gid}`;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = BULK_BTN_CLASS;
        btn.textContent = `${T.bulkLabel} (${params.price} iS × N)`;
        btn.title = T.bulkLabelTooltip;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            runBulkJoin(params, title.trim());
        });
        cardJoinDiv.parentElement.appendChild(btn);
    }

    // =============================================
    // INYECCION: PAGINA DE LISTADO (/giveaways*)
    //   - Extra Odds: badge bulk-join (top-right) en cualquier listado
    //   - Single Ticket: boton de cola (top-left) SOLO en /giveaways
    // =============================================
    function injectListing() {
        const onListingRoot = isListingRoot();

        document.querySelectorAll('.items-list-item').forEach(item => {
            const typeEl = item.querySelector('.items-list-item-type');
            if (!typeEl) return;

            const trigger = item.querySelector('a.items-list-item-ticket-click');
            if (!trigger) return;
            const params = parseJoinOnclick(trigger, 'joinGiveawayOrAuction');
            if (!params) return;
            // En el listado el data-price esta en el boton interno, no en el trigger.
            // Para Single Ticket, el segundo arg del onclick es 0; el precio real solo
            // se obtiene de data-price.
            const dpItem = findDataPrice(item);
            if (dpItem != null) params.price = dpItem;

            const titleA = item.querySelector('.items-list-item-title a');
            const title = titleA ? titleA.textContent.trim() : `#${params.gid}`;
            const timeEl = item.querySelector('.items-list-item-data-left-bottom');
            const timeLeft = timeEl ? timeEl.textContent.trim() : '';

            const host = item.querySelector(':scope > .relative') || item;
            const cs = window.getComputedStyle(host);
            if (cs.position === 'static') host.style.position = 'relative';

            const typeText = (typeEl.textContent || '').trim().toLowerCase();
            const isExtraOdds = typeEl.classList.contains('items-list-item-type-indiegala')
                || /extra\s*odds/i.test(typeText);
            const isSingleTicket = /^single\s*ticket/.test(typeText);

            // Extra Odds: badge de bulk-join (en cualquier listado)
            if (isExtraOdds && params.price >= 1 && !host.querySelector('.' + BULK_BADGE_CLASS)) {
                const balance = getCurrentBalance();
                const maxCount = balance != null ? Math.floor(balance / params.price) : 0;

                const badge = document.createElement('div');
                badge.className = BULK_BADGE_CLASS;
                badge.dataset.price = String(params.price);
                badge.textContent = fmt(T.bulkBadge, { n: maxCount });
                badge.title = fmt(T.bulkBadgeTooltip, { n: maxCount });
                badge.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    runBulkJoin(params, title);
                });
                host.appendChild(badge);
            }

            // Single Ticket: boton de cola SOLO en /giveaways
            if (isSingleTicket && onListingRoot && !host.querySelector('.' + QBTN_CLASS)) {
                const btn = document.createElement('div');
                btn.className = QBTN_CLASS;
                btn.dataset.gid = params.gid;
                const inQ = isInQueue(params.gid);
                btn.classList.toggle('ig-q-btn-active', inQ);
                btn.textContent = inQ ? T.queueRemoveBtn : T.queueAddBtn;
                btn.title = inQ ? T.queueRemoveBtnTooltip : T.queueAddBtnTooltip;
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isInQueue(params.gid)) {
                        removeFromQueue(params.gid);
                        return;
                    }
                    // Bloquear encolado cuando no hay GalaSilver disponible.
                    // Si el cache dice 0/null, re-leer DOM y SOBREESCRIBIR (puede
                    // haber cambiado: top-up, premio, etc.). El usuario esta
                    // intentando encolar; le damos la cifra mas reciente.
                    let bal = getCurrentBalance();
                    if (bal == null || bal <= 0) {
                        bal = forceReadBalance();
                    }
                    if (bal == null) { showToast(T.balanceUnknown, 'error'); return; }
                    if (bal <= 0) { showToast(T.queueNoBalance, 'warn'); return; }
                    addToQueue({
                        gid: params.gid,
                        price: params.price,       // costo en iS (data-price)
                        fnArg2: params.fnArg2,     // segundo arg para joinGiveawayOrAuction
                        token: params.token,
                        title: title,
                        timeLeft: timeLeft,
                        addedAt: Date.now(),
                    });
                });
                host.appendChild(btn);
            }
        });
    }

    function injectAll() {
        try { injectStyles(); } catch (e) {}
        try { injectCardDetail(); } catch (e) { console.error('[IG-BulkTools] injectCardDetail:', e); }
        try { injectListing(); } catch (e) { console.error('[IG-BulkTools] injectListing:', e); }
        try { renderQueuePanel(); } catch (e) { console.error('[IG-BulkTools] renderQueuePanel:', e); }
        // Asegurar que botones recien inyectados reflejen el estado de saldo (deshabilitar
        // los ＋ cuando bal=0). Tambien resincroniza con el DOM si Indiegala actualizo iS.
        try { getCurrentBalance(); refreshQueueButtonsState(); refreshBulkBadges(); } catch (e) {}
    }

    // =============================================
    // OBSERVADOR DE DOM (los listados se cargan por AJAX/carrusel)
    // =============================================
    function startObserver() {
        // jQuery del sitio puede no estar listo en el primer tick; reintentar.
        setupAjaxBalanceHook();
        if (!setupAjaxBalanceHook._done) {
            let attempts = 0;
            const t = setInterval(() => {
                attempts++;
                setupAjaxBalanceHook();
                if (setupAjaxBalanceHook._done || attempts > 20) clearInterval(t);
            }, 250);
        }
        injectAll();
        const observer = new MutationObserver(() => {
            if (startObserver._t) return;
            startObserver._t = setTimeout(() => {
                startObserver._t = null;
                injectAll();
            }, 250);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver);
    } else {
        startObserver();
    }
})();
