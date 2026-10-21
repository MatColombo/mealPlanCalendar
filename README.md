# Project Meal Planner

**Versione 1.1.0 — ricettario, comandi rapidi, turni lavorativi e agente aggiornato.**

PWA personale per importare piani creati in ChatGPT web, organizzare i pasti
nel calendario e calcolare la spesa. Interfaccia italiana e inglese, stile
colorato, dati locali e continuità offline dopo la preparazione iniziale.

**App esistente:** [matcolombo.github.io/mealPlanCalendar](https://matcolombo.github.io/mealPlanCalendar/).
La versione 1.1 è preparata in questo progetto; non è ancora pubblicata da questa
sessione. Il repository è leggibile, ma il tentativo Git di verifica dei permessi
di invio non dispone di credenziali. La procedura per aggiornare lo stesso URL,
includendo il service worker compilato, è in [DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Novità della versione 1.1

- Comandi persone `− / +` direttamente sui pasti di Oggi e Calendario, con coda
  per tocchi rapidi, salvataggio locale e feedback animato.
- Ricettario dei piani importati: ricerca per ricetta o ingrediente, filtri per
  tipo di pasto, categoria e presenza nel calendario; conteggi e collegamenti
  alle date passate, da oggi in avanti e complessive.
- Macro per pasto, ingredienti e giornata: i valori dichiarati prevalgono; in
  loro assenza si sommano i contributi disponibili degli ingredienti. I dati
  parziali sono indicati esplicitamente e non diventano zeri.
- Tipo di giornata strutturato: `workday.class`, con orari facoltativi. Il turno
  resta sulla data quando si sposta un pasto.
- Selettore file senza filtro di estensione per consentire `.diet` anche su
  iOS, contenimenti dei componenti e transizioni elastiche con lieve tilt.
- Intervista dell’agente estesa a profilo, rotazione lavorativa, mensa e range
  kcal, attrezzatura, preferenze e struttura dei pasti; proposta in sezioni.

Dettagli, verifiche eseguite e prove ancora necessarie:
[RELEASE_1_1.md](docs/RELEASE_1_1.md).

## Avvio e sviluppo locale

Richiede **Node.js 24 o successivo**. HTML, CSS e moduli JavaScript non hanno
dipendenze runtime, CDN, API AI o backend. Node serve agli strumenti locali.

~~~bash
npm run dev
~~~

Apri http://127.0.0.1:5173/. Il primo archivio è vuoto. L'apertura diretta
di index.html tramite file:// non è supportata: moduli e PWA richiedono
un contesto web appropriato.

| Comando | Funzione |
| --- | --- |
| `npm run dev` | Server locale dei sorgenti; compila il worker al momento della richiesta. |
| `npm run dev -- --port 8080` | Stesso server su un'altra porta. |
| `npm ci` | Installa la dipendenza di sviluppo fissata nel lockfile per i test IndexedDB. |
| `npm test` | Esegue la suite software con il runner Node, senza isolamento fra processi. |
| `npm run check` | Controlla sintassi, riferimenti, manifest, icone e inventario PWA. |
| `npm run build` | Genera la distribuzione statica minima in dist/. |
| `npm run verify:build` | Confronta dist/ con i sorgenti e con il worker compilato atteso. |
| `npm run preview` | Serve dist/ in locale. |
| `npm run verify:deployment -- URL` | Controlla via HTTP l'URL pubblicato rispetto alla build locale. |

Per i test eseguire prima npm ci. La sola dipendenza, fake-indexeddb, simula
IndexedDB; non viene distribuita nell'app. Il comando npm test esegue i casi
nello stesso processo in modo seriale; i test ripristinano le API globali
temporaneamente sostituite. Le prove eseguite qui usano Node 24.19.0.

Durante lo sviluppo, un service worker già attivo può continuare a servire
la sua release. Usa **Impostazioni → Cerca aggiornamenti** per passare alla
build nuova. Gli strumenti del browser permettono anche di gestire il worker
del solo sito di sviluppo; conserva un backup prima di cancellare dati del sito.

## Creare e rivedere un piano in ChatGPT

Apri ChatGPT web e allega:

1. [CHATGPT_WEB_GUIDE.md](docs/CHATGPT_WEB_GUIDE.md).
2. [DIET_FORMAT.md](docs/DIET_FORMAT.md).
3. [diet.schema.json](schemas/diet.schema.json), come schema documentale.

La guida contiene il prompt iniziale e il flusso completo. Raccoglie solo
le informazioni mancanti, propone 3–10 giorni e consente revisioni dell'intero
piano, di un pasto o di un ingrediente. Richiedi il file .diet quando la
proposta è pronta. Per la continuità, allega il piano o lo storico pertinente.

La skill sorgente è presente nel progetto, ma **non è stata installata nel
catalogo personale**: resta valido il percorso con allegati. L'esito precedente
è in [PHASE_2_DELIVERY.md](docs/PHASE_2_DELIVERY.md). La PWA non legge questa
conversazione e ChatGPT non modifica automaticamente il calendario.

## Importare un file .diet

1. Apri **Importa**, scegli il file o la demo inclusa.
2. Leggi titolo, durata, data suggerita e intervallo risultante.
3. Scegli la data iniziale e confermala manualmente, anche mantenendo quella
   suggerita. Cambiare data azzera la conferma.
4. Se sono presenti pasti o un tipo di giornata nelle date interessate, esamina le sovrapposizioni
   e conferma esplicitamente la sostituzione completa di quei giorni.
5. Applica l'importazione oppure annulla. L'ultima importazione resta
   annullabile anche dopo la riapertura.

La rimappatura mantiene ordine, distanza fra giornate e orari civili.
Un giorno intermedio non incluso nel piano resta intatto. Originale e
assegnazione effettiva sono separati. Importare lo stesso JSON sulle medesime
assegnazioni non duplica pasti né azzera modifiche; un'altra assegnazione
richiede una conferma distinta.

## Calendario, quantità e spesa

Oggi, Calendario, Spesa e Ricettario condividono i dati di IndexedDB. I comandi
per le persone sono sulle schede principali; nel dettaglio puoi modificare
anche data e ora. La destinazione conserva
gli altri pasti e li ordina per orario. Il Calendario mantiene la data
selezionata; Oggi usa la data locale senza cancellare quella selezione.

**Ingredienti e nutrizione nel piano sono sempre per una persona.**
Le persone del singolo pasto scalano le quantità da preparare, mantenendo
inalterati i valori di base e il riepilogo nutrizionale personale.

| Modalità della spesa | Calcolo per ogni pasto del periodo |
| --- | --- |
| Una persona | Quantità base × 1. |
| Due persone | Quantità base × 2. |
| Avanzata | Quantità base × persone salvate su quel pasto. |

Il periodo include entrambi gli estremi. Cambiare modalità non modifica
le persone nel calendario. La lista aggrega ingredienti con ID, unità
compatibili e base di misura uguali: kg/g e l/ml si normalizzano, mentre
pezzi/grammi e crudo/cotto restano distinti senza conversioni applicabili.

Le preparazioni con avanzi contano le quantità attribuite alle porzioni
consumate, senza ripetere l'intera ricetta. La spesa non è un inventario
della dispensa e non sottrae automaticamente scorte o preparazioni già fatte.

Puoi spuntare le righe, aggiungere articoli manuali e copiare o scaricare la
lista .txt. Le quantità manuali sono esplicite e non si moltiplicano.
Un aumento del fabbisogno riapre una voce già spuntata; periodo, modalità,
spunte e manuali vengono salvati.

Il cambio IT/EN localizza controlli, date, categorie e numeri. Nomi dei pasti,
ingredienti e istruzioni rimangono nella lingua scelta nella chat.

## Esportazione, backup e ripristino

**Esporta** offre il piano originale, un .diet del calendario con date/orari
effettivi e il backup completo. Il .diet esportato riguarda una sorgente
alla volta e conserva quantità individuali; non trasferisce le persone,
la checklist o l'intero archivio. Per questi dati usa il backup.

Il backup comprende tutte le sorgenti, assegnazioni, persone, impostazioni,
selezione del Calendario, spesa, cronologia e ultimo annullamento.
In **Impostazioni**, scegli il backup, confronta l'anteprima e conferma la
sostituzione. Un'unica transazione conserva anche la copia precedente.
Errori di lettura o scrittura lasciano intatto l'archivio corrente.

**Scarica la copia precedente** permette di recuperare lo stato sostituito.
Se una versione dell'archivio non è compatibile ma resta tecnicamente
leggibile, **Scarica archivio originale** ne conserva una copia senza
migrazione. Formati e stato rimangono v1; la pipeline per evoluzioni future
è esplicita e non riscrive i dati v1 al solo avvio.

L'archivio appartiene al browser e all'indirizzo dell'app. Per cambiare
browser, dispositivo, dominio o percorso, trasferisci un backup.
Dettagli in [EXPORT_FORMATS.md](docs/EXPORT_FORMATS.md) e
[STATE_AND_BACKUP.md](docs/STATE_AND_BACKUP.md).

## Installazione PWA e uso offline

Al primo accesso online attendi **Pronta anche offline**. Questo stato
conferma la presenza delle risorse della release, comprese traduzioni e
icone. **Impostazioni** mostra l'installazione disponibile nel browser,
le istruzioni alternative, la richiesta di protezione dei dati e i controlli
per riprovare la preparazione o cercare aggiornamenti.

Una volta preparata la cache, calendario, modifiche ai pasti, spesa e file
locali non dipendono dalla rete. I dati personali restano in IndexedDB;
il service worker conserva soltanto le risorse pubbliche dell'app.

La richiesta di persistenza non garantisce la concessione da parte del
browser e non impedisce la cancellazione esplicita dei dati del sito.
Il backup scaricato rimane il mezzo di recupero indipendente.

Una nuova release completa viene proposta senza ricaricare automaticamente
la pagina durante il lavoro. **Aggiorna e ricarica** attende le scritture,
avverte sulle bozze non confermate e richiede di chiudere le altre finestre
dell'app. Il normale ciclo del browser può attivare la release in attesa
quando tutte le finestre sono state chiuse. L'aggiornamento non elimina IndexedDB.

Guida completa, limiti delle API e fonti:
[PHASE_7_PWA.md](docs/PHASE_7_PWA.md).

## Pubblicazione su GitHub Pages

Il workflow [pages.yml](.github/workflows/pages.yml) verifica e costruisce
ogni push o pull request verso main. Solo main può pubblicare; una pull
request esegue i controlli senza distribuire. Il workflow manuale permette
di ripetere la pubblicazione dopo aver configurato Pages.

Per completare la pubblicazione dal progetto consegnato:

1. Aggiorna il repository MatColombo/mealPlanCalendar con i sorgenti della
   versione 1.1, includendo `.github/workflows/pages.yml`.
2. In **Settings → Pages → Build and deployment → Source**, scegli
   **GitHub Actions**.
3. In **Actions**, esegui **Meal Planner Pages** sul ramo main.
4. Attendi il deploy e il controllo HTTP sull'URL restituito.

GitHub Pages è disponibile sui repository pubblici con GitHub Free;
la selezione della sorgente e i workflow sono descritti nella
[documentazione ufficiale](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

La build distribuisce solo risorse dell'app, demo referenziata e worker
compilato. Documentazione, test, skill e altri esempi rimangono nel repository.
**Pubblicare dist/, non il worker template nella radice dei sorgenti.**
I percorsi si adattano anche a /NOME-REPOSITORY/ senza configurare un base URL.

Per successive modifiche, aggiorna i sorgenti e inviali a main: la pipeline
ricostruisce la release. L'hash cambia anche se il numero di versione rimane
uguale; nessuna modifica va applicata a mano ai file distribuiti dopo la build.
Procedura Git, aggiornamenti, verifica dell'URL e recupero:
[GITHUB_PAGES.md](docs/GITHUB_PAGES.md).

## Verifiche e limiti della consegna

Le verifiche coprono importazione e conferme, confini di calendario e ora
legale Europe/Rome, sovrascrittura/undo, pasti, tre modalità della spesa,
persistenza, backup, cambio lingua, continuità offline e aggiornamenti.
Il resoconto aggiornato è in [RELEASE_1_1.md](docs/RELEASE_1_1.md); il resoconto storico della fase 8 è
[PHASE_8_VERIFICATION.md](docs/PHASE_8_VERIFICATION.md).

Sono stati usati Node e simulazioni delle API browser. Il supervisore
per l’anteprima interattiva non è disponibile: layout e animazioni su browser
reali, installazione PWA e selettore File iOS richiedono ancora il collaudo
indicato nel resoconto 1.1. L’URL esistente è raggiungibile; la nuova release
non è stata inviata al repository o pubblicata da questa sessione.

**Nessun test valuta ricette, adeguatezza dei pasti, bilanciamento, kcal,
macro o frequenze alimentari.** Schemi e verifiche riguardano soltanto
struttura, integrità dei dati e comportamento del software.

## Documentazione e dati dimostrativi

- [PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md): requisiti e decisioni.
- [DIET_FORMAT.md](docs/DIET_FORMAT.md): contratto .diet.
- [CONVERSATION_EXAMPLE.md](docs/CONVERSATION_EXAMPLE.md): dialogo con sostituzione.
- [PHASE_5_CALENDAR.md](docs/PHASE_5_CALENDAR.md): calendario e persone.
- [PHASE_6_SHOPPING.md](docs/PHASE_6_SHOPPING.md): quantità, categorie e checklist.
- [Piano italiano](examples/release-1.1/meal-plan-it.diet) e
  [piano inglese](examples/release-1.1/meal-plan-en.diet).
- [Demo spesa](examples/phase-6/shopping-demo-it.diet) e
  [backup dimostrativo completo](examples/phase-6/shopping-backup.json).

Gli esempi e le fixture sono fittizi. Nessun piano personale dell'utente è
stato inserito nel repository o nella distribuzione.

## Struttura

~~~text
src/data/          documenti, import/export, calendario e stato
src/ui/            componenti, stili, icone e dizionari
src/persistence/   IndexedDB, transazioni, compatibilità e migrazioni
src/shopping/      aggregazione e checklist
src/pwa/           installazione, persistenza richiesta e aggiornamenti
scripts/           sviluppo, build e verifica della distribuzione
tests/             verifiche software
docs/              guide, contratti e resoconti
schemas/           schemi documentali
examples/          piani e backup dimostrativi
skills/            sorgente della skill conversazionale
~~~
