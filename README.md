# Twitch Drops Highlighter + Keywords

Userscript de Tampermonkey que clasifica y resalta drops/campañas en Twitch según tus palabras clave. / Tampermonkey userscript that classifies and highlights drops/campaigns on Twitch based on your keywords.

## Español

**Qué hace:** en la página de drops de **Twitch** clasifica y **resalta** las campañas según una lista de palabras clave persistente y editable, para localizar de un vistazo las que te interesan. Incluye tooltips e info por drop.

**Características:**
- Palabras clave personalizables y persistentes.
- Interfaz multiidioma.

**Instalación:**
1. Instala [Tampermonkey](https://www.tampermonkey.net/).
2. Abre el instalador: [twitch-drops-highlighter.user.js](https://github.com/g31w0fw0rld/twitch-drops-highlighter/raw/main/twitch-drops-highlighter.user.js) (también en [GreasyFork](https://greasyfork.org/es-419/users/1590477-g31w) y [OpenUserJS](https://openuserjs.org/users/g31w0fw0rldgmail.com/scripts)).

**Sitio:** `twitch.tv/drops/*`

## English

**What it does:** on the **Twitch** drops page it classifies and **highlights** campaigns based on a persistent, editable keyword list, so you can spot the ones you care about at a glance. Includes per-drop tooltips and info.

**Features:**
- Customizable, persistent keywords.
- Multi-language interface.

**Install:**
1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Open the installer: [twitch-drops-highlighter.user.js](https://github.com/g31w0fw0rld/twitch-drops-highlighter/raw/main/twitch-drops-highlighter.user.js) (also on [GreasyFork](https://greasyfork.org/es-419/users/1590477-g31w) and [OpenUserJS](https://openuserjs.org/users/g31w0fw0rldgmail.com/scripts)).

**Site:** `twitch.tv/drops/*`

## Privacidad / Privacy

**ES:** tus keywords y ajustes se guardan solo en tu navegador, en el almacenamiento del gestor de userscripts (keywords, drops descartados del inventario, notificaciones ya mostradas y preferencias del panel). Las consultas de drops van a `gql.twitch.tv` reusando **tu propia sesión**: el script toma el token OAuth y las cabeceras de integridad de las peticiones que la propia página hace a Twitch, las mantiene **solo en memoria** —nunca las escribe en disco, y además borra la clave `__twitch_gql_state__` que versiones antiguas dejaban en `localStorage`— y solo las captura cuando la URL es exactamente `gql.twitch.tv/gql`, nunca de peticiones a terceros. Si esa consulta falla, cae a la API pública `twitch-drops-api.sunkwi.com`, que recibe una petición **sin ningún dato tuyo**. Los avisos son notificaciones locales del navegador. No se envía nada al autor del script.

**EN:** your keywords and settings stay in your browser only, in the userscript manager's storage (keywords, drops dismissed from the inventory, notifications already shown and panel preferences). Drop queries go to `gql.twitch.tv` reusing **your own session**: the script takes the OAuth token and integrity headers from the requests the page itself makes to Twitch, keeps them **in memory only** —never written to disk, and it also deletes the `__twitch_gql_state__` key that older versions left in `localStorage`— and only captures them when the URL is exactly `gql.twitch.tv/gql`, never from third-party requests. If that query fails, it falls back to the public `twitch-drops-api.sunkwi.com` API, which receives a request with **none of your data**. Alerts are local browser notifications. Nothing is sent to the script author.

## Apoyar / Support

Esto es parte de algo que estoy construyendo para crecer. Si te sirve y quieres apoyar, puedes invitarme un café en **[Ko-fi](https://ko-fi.com/g31w0fw0rld)** —solo si quieres—; y si hay una causa que lo necesite más que yo, ayúdala a ella.

This is part of something I'm building to grow. If it helps you and you'd like to support it, you can tip me on **[Ko-fi](https://ko-fi.com/g31w0fw0rld)** —only if you want—; and if a cause needs it more than I do, help that one instead.

---
Autor / Author: **g31w0fw0rld** · Licencia / License: **MIT**
