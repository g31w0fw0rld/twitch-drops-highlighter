# Twitch Drops Highlighter + Keywords

Tampermonkey userscript that classifies and highlights drops/campaigns on Twitch based on your keywords. / Userscript de Tampermonkey que clasifica y resalta drops/campañas en Twitch según tus palabras clave.

> [!NOTE]
> **THE INVENTORY CHECKBOX ALSO CLAIMS / LA CASILLA DEL INVENTARIO TAMBIÉN RECLAMA:** *hide expired/completed* turns on automatic claiming as well, which its label does not say. It claims by clicking Twitch's own Claim buttons for drops you already earned by watching: the script's own requests to Twitch are read-only, nothing is sent to claim, and it grants you nothing you could not click yourself. It is still automation, which Twitch's terms may not permit, so decide with that in mind. / *Ocultar cerrados/completados* activa además la reclamación automática, algo que su etiqueta no dice. Reclama pulsando los propios botones «Reclamar» de Twitch, sobre drops que ya te ganaste viendo: las peticiones propias del script a Twitch son de solo lectura, no se envía nada para reclamar, y no te da nada que no pudieras pulsar tú. Sigue siendo automatización, que las condiciones de Twitch pueden no permitir, así que decide sabiéndolo.

![The panel next to the campaigns list, with matching campaigns outlined in purple](docs/screenshot-campaigns.png)

*Campaigns: matching campaigns get outlined **purple** on the page itself, and the panel lists them with their rewards and the hours needed for each. / Campañas: las campañas que coinciden se enmarcan en **morado** en la propia página, y el panel las lista con sus recompensas y las horas que pide cada una.*

![The expired tab, with the matching closed campaigns outlined in red](docs/screenshot-expired.png)

*Expired: same idea in **red**, so a campaign that closed is obvious rather than something you find out by clicking. / Cerrados: lo mismo en **rojo**, para que una campaña que ya cerró se vea, en vez de descubrirlo al hacer clic.*

![The inventory tab, with the exact time remaining shown next to an in-progress drop](docs/screenshot-inventory.png)

*Inventory: hovering a drop in progress shows **exactly how much watch time is left** — Twitch only gives you a bar and a rounded "1% of 1 hour". Each entry also gets an ✕ to take it out of the view. In the panel beside it, **the rewards you already own are ticked and struck through**, and a badge with nothing left to earn drops its watch time. / Inventario: al pasar el ratón por un drop en progreso sale **cuánto tiempo de visualización falta exactamente** — Twitch solo te da una barra y un "1% of 1 hour" redondeado. Cada entrada tiene además una ✕ para sacarla de la vista. En el panel de al lado, **las recompensas que ya tienes van con ✓ y tachadas**, y el badge que no tiene nada pendiente se queda sin su tiempo.*

<img src="docs/screenshot-drop-details.png" width="380" alt="The drop details popover showing progress, time remaining and the Accept button">

*Clicking that same drop opens the full detail: progress in minutes and percent, plus the time remaining. / Al hacer clic en ese mismo drop se abre el detalle completo: progreso en minutos y porcentaje, más el tiempo restante.*

## English

### What it does

**Highlighting**
- Marks the campaigns on Twitch's Drops & Rewards page that match your keywords, **on the page itself** — purple for open, red for closed — so you spot them while scrolling instead of opening each one.
- Campaigns that match nothing are left exactly as they were.

**The panel**
- A floating panel, collapsible and remembered, listing what matched split into **Active** and **Expired**, each with a count so you know at a glance whether it is worth looking.
- Every entry shows the campaign, the studio, the exact window it runs, the keyword that matched it and **each reward with the hours needed to unlock it** — the thing Twitch makes you click through to find.
- **Rewards you already own are marked** — ticked, struck through and dimmed, one by one, so what is left to earn is what stands out. Two rewards that ask for the same watch time are not the same drop, so each one is checked separately, and when every reward on a badge is already yours the badge drops the watch time it asked for and says **Claimed** on hover instead.
- **Reload drops** re-queries without a page refresh, and also brings back anything you dismissed from the inventory.

**Keywords**
- The list ships with about 30 popular franchises and it is yours to change.
- **Click a chip to delete it**, **+** to add, **Edit Keywords** to rewrite the whole list as one comma-separated line, and **Reset to Default** to start over. Each change reloads so the highlighting is rebuilt.

**Inventory**
- **Hide expired/completed from the inventory** — one checkbox that also turns on **automatic claiming** of drops you have already finished. Read the warning above before ticking it.
- **Hover a drop in progress and it tells you the exact watch time left.** Twitch gives you a bar and a rounded percentage; the script turns that into minutes you can actually plan around.
- **Click the same drop for the full detail:** progress in minutes and percent, plus the time remaining. If the progress cannot be worked out, the click is passed through to Twitch untouched rather than swallowed.
- **Dismiss any entry with ✕** to clear the clutter of things you do not care about; *Reload drops* brings them all back.

**Change notifications**
- Watches the campaign list and flags what changed since you last looked. The 🔔 tab carries a **pending count** and lists the affected campaigns by name.
- **A 🔔 also lands on the campaign's own card** on the page, so a change is visible where you are already looking and not only inside the panel.
- **The 👁️ button marks one as seen and takes you to it** — on the campaigns view it scrolls the campaign into the centre of the screen, and from the inventory it switches to the campaigns view first and then goes to it, so you never have to hunt for it. **Mark all as seen** clears the lot in one click.
- **Notifications are pruned with your keywords.** Delete a keyword and its pending alerts go with it; rewrite the list and anything that no longer matches is dropped, so the 🔔 count never counts things you stopped caring about.
- **A campaign that is finished stops alerting.** Twitch's own API is the source, so once a campaign has no active drops left —because you claimed them or because it ended— it no longer raises change notifications.
- It also raises a **desktop notification** with the pending count, asking for permission the first time, and falls back to the userscript manager's own notification if the browser API is unavailable.

**Language:** 16 languages — Spanish, English, German, French, Portuguese, Russian, Turkish, Japanese, Korean, Polish, Finnish, Vietnamese, Chinese, Arabic, Hindi and Indonesian — following the language Twitch serves the page in, falling back to English.

**Install:**
1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Open the installer: [twitch-drops-highlighter.user.js](https://github.com/g31w0fw0rld/twitch-drops-highlighter/raw/main/twitch-drops-highlighter.user.js) (also on [GreasyFork](https://greasyfork.org/es-419/users/1590477-g31w) and [OpenUserJS](https://openuserjs.org/users/g31w0fw0rldgmail.com/scripts)).

**Site:** `twitch.tv/drops/*`

## Español

### Qué hace

**Resaltado**
- Marca las campañas de la página de Drops y recompensas de Twitch que coinciden con tus palabras clave, **en la propia página** —morado las abiertas, rojo las cerradas—, así las ves mientras haces scroll en vez de abrir una por una.
- Las campañas que no coinciden con nada se quedan exactamente como estaban.

**El panel**
- Un panel flotante, plegable y recordado, que lista lo que coincidió separado en **Abiertos** y **Cerrados**, cada uno con su cuenta para saber de un vistazo si vale la pena mirar.
- Cada entrada muestra la campaña, el estudio, la ventana exacta en que corre, la palabra clave que la encontró y **cada recompensa con las horas que hacen falta para desbloquearla** — justo lo que Twitch te obliga a buscar clic a clic.
- **Las recompensas que ya tienes vienen marcadas** —con ✓, tachadas y atenuadas, una por una—, así lo que resalta es lo que te falta por conseguir. Dos recompensas que piden el mismo tiempo no son el mismo drop, así que cada una se comprueba por separado, y cuando todas las de un badge ya son tuyas el badge deja de mostrar el tiempo que pedía y dice **Reclamados** al pasar el ratón.
- **Recargar drops** vuelve a consultar sin refrescar la página, y además devuelve lo que hayas descartado del inventario.

**Palabras clave**
- La lista viene con unas 30 franquicias populares y es tuya para cambiarla.
- **Haz clic en una etiqueta para borrarla**, **+** para añadir, **Editar Keywords** para reescribir la lista entera como una línea separada por comas, y **Restaurar Predeterminadas** para empezar de cero. Cada cambio recarga, así que el resaltado se rehace.

**Inventario**
- **Ocultar cerrados/completados del inventario** — una sola casilla que además activa la **reclamación automática** de los drops que ya terminaste. Lee el aviso de arriba antes de marcarla.
- **Pasa el ratón por un drop en progreso y te dice el tiempo de visualización que falta exactamente.** Twitch te da una barra y un porcentaje redondeado; el script lo convierte en minutos con los que se puede planificar.
- **Haz clic en ese mismo drop para el detalle completo:** progreso en minutos y porcentaje, más el tiempo restante. Si el progreso no se puede calcular, el clic se deja pasar a Twitch tal cual en vez de tragárselo.
- **Descarta cualquier entrada con la ✕** para quitarte de encima lo que no te interesa; *Recargar drops* las trae todas de vuelta.

**Avisos de cambios**
- Vigila la lista de campañas y marca lo que cambió desde la última vez que miraste. La pestaña 🔔 lleva una **cuenta de pendientes** y lista las campañas afectadas por su nombre.
- **Además cae un 🔔 en la propia tarjeta de la campaña** en la página, así un cambio se ve donde ya estás mirando y no solo dentro del panel.
- **El botón 👁️ la marca como vista y te lleva hasta ella** — en la vista de campañas desplaza la campaña al centro de la pantalla, y desde el inventario cambia primero a campañas y luego va a ella, así nunca tienes que buscarla. **Marcar todas como vistas** limpia el lote de un clic.
- **Los avisos se limpian junto con tus palabras clave.** Borra una palabra y sus avisos pendientes se van con ella; reescribe la lista y lo que ya no coincide se descarta, así la cuenta del 🔔 nunca cuenta cosas que dejaron de interesarte.
- **Una campaña terminada deja de avisar.** La fuente es la propia API de Twitch, así que cuando una campaña ya no tiene drops activos —porque los reclamaste o porque acabó— deja de generar avisos de cambio.
- También levanta una **notificación de escritorio** con la cuenta de pendientes, pidiendo permiso la primera vez, y cae al sistema de avisos del propio gestor de userscripts si la API del navegador no está disponible.

**Idioma:** 16 idiomas —español, inglés, alemán, francés, portugués, ruso, turco, japonés, coreano, polaco, finés, vietnamita, chino, árabe, hindi e indonesio—, siguiendo el idioma con el que Twitch sirve la página, con inglés como respaldo.

**Instalación:**
1. Instala [Tampermonkey](https://www.tampermonkey.net/).
2. Abre el instalador: [twitch-drops-highlighter.user.js](https://github.com/g31w0fw0rld/twitch-drops-highlighter/raw/main/twitch-drops-highlighter.user.js) (también en [GreasyFork](https://greasyfork.org/es-419/users/1590477-g31w) y [OpenUserJS](https://openuserjs.org/users/g31w0fw0rldgmail.com/scripts)).

**Sitio:** `twitch.tv/drops/*`

## Privacy / Privacidad

**EN:** your keywords and settings stay in your browser only, in the userscript manager's storage (keywords, drops dismissed from the inventory, notifications already shown and panel preferences). Drop queries go to `gql.twitch.tv` reusing **your own session**, and are **read-only** — three GraphQL queries (`ViewerDropsDashboard`, `DropCampaignDetails`, `Inventory`) and no mutation, so the script never writes anything to your account: the script takes the OAuth token and integrity headers from the requests the page itself makes to Twitch, keeps them **in memory only** —never written to disk, and it also deletes the `__twitch_gql_state__` key that older versions left in `localStorage`— and only captures them when the URL is exactly `gql.twitch.tv/gql`, never from third-party requests. If that query fails, it falls back to the public `twitch-drops-api.sunkwi.com` API, which receives a request with **none of your data**. Alerts are local browser notifications. Nothing is sent to the script author.

**ES:** tus keywords y ajustes se guardan solo en tu navegador, en el almacenamiento del gestor de userscripts (keywords, drops descartados del inventario, notificaciones ya mostradas y preferencias del panel). Las consultas de drops van a `gql.twitch.tv` reusando **tu propia sesión**, y son de **solo lectura** —tres consultas GraphQL (`ViewerDropsDashboard`, `DropCampaignDetails`, `Inventory`) y ninguna mutación, así que el script nunca escribe nada en tu cuenta—: el script toma el token OAuth y las cabeceras de integridad de las peticiones que la propia página hace a Twitch, las mantiene **solo en memoria** —nunca las escribe en disco, y además borra la clave `__twitch_gql_state__` que versiones antiguas dejaban en `localStorage`— y solo las captura cuando la URL es exactamente `gql.twitch.tv/gql`, nunca de peticiones a terceros. Si esa consulta falla, cae a la API pública `twitch-drops-api.sunkwi.com`, que recibe una petición **sin ningún dato tuyo**. Los avisos son notificaciones locales del navegador. No se envía nada al autor del script.

## Support / Apoyar

This is part of something I'm building to grow. If it helps you and you'd like to support it, you can tip me on **[Ko-fi](https://ko-fi.com/g31w0fw0rld)** —only if you want—; and if a cause needs it more than I do, help that one instead.

Esto es parte de algo que estoy construyendo para crecer. Si te sirve y quieres apoyar, puedes invitarme un café en **[Ko-fi](https://ko-fi.com/g31w0fw0rld)** —solo si quieres—; y si hay una causa que lo necesite más que yo, ayúdala a ella.

---
Author / Autor: **g31w0fw0rld** · License / Licencia: **MIT**
