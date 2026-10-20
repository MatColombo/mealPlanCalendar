# Fase 7 — PWA, uso offline e continuità dei dati

**Versione dell'app: 0.7.0.** Meal Planner prepara una copia locale delle
risorse dell'app, presenta l'installazione quando il browser la rende
disponibile e gestisce gli aggiornamenti senza cancellare l'archivio personale.
Calendario, pasti, spesa e file restano gestiti sul dispositivo. L'AI continua
a operare esclusivamente nella chat web di ChatGPT.

Lo stack rimane statico: HTML, CSS e moduli JavaScript nativi. Non sono
richiesti account, servizi remoti o nuove dipendenze runtime. I formati
`.diet`, stato e backup restano alla versione 1. Le verifiche effettuate e
le prove ancora da eseguire su browser sono distinte nella sezione finale.

Riferimenti di progetto: [PROJECT_BRIEF.md](PROJECT_BRIEF.md),
[DIET_FORMAT.md](DIET_FORMAT.md), [PHASE_4_STORAGE.md](PHASE_4_STORAGE.md),
[STATE_AND_BACKUP.md](STATE_AND_BACKUP.md) e
[EXPORT_FORMATS.md](EXPORT_FORMATS.md).

## Primo avvio e disponibilità offline

Aprire il sito con una connessione disponibile e attendere l'indicazione
**Pronta anche offline**. Il primo caricamento della pagina e l'installazione
dell'icona, da soli, non attestano che tutte le risorse siano state conservate.
L'app mostra lo stato di preparazione finché il service worker non conferma
che la copia locale è completa.

| Indicazione | Significato nell'app |
| --- | --- |
| Verifica offline… | L'app controlla il worker e la disponibilità delle risorse. |
| Preparazione offline… | Le risorse sono in preparazione o riparazione; attendere il completamento. |
| Pronta anche offline | Il worker attivo conferma il marcatore della versione e la presenza di tutte le risorse previste. |
| Riapertura offline non disponibile | Il contesto o il browser non espongono il supporto necessario. La pagina già aperta rimane utilizzabile. |
| Preparazione offline da riprovare | La preparazione non è completa o il controllo non è riuscito. In Impostazioni è disponibile la riprova quando supportata. |

**Online** e **Offline** sono indicazioni della rete segnalata dal dispositivo.
Non attestano che un server sia raggiungibile e non determinano l'abilitazione
dei comandi locali. L'app non blocca calendario, importazioni, backup o spesa
perché `navigator.onLine` restituisce `false`.

Con risorse dell'app già conservate e dati locali leggibili, si possono:

- consultare e modificare date, orari e persone dei pasti;
- usare intervallo, modalità, spunte e aggiunte manuali della spesa;
- importare un `.diet`, confermare le date e gestire le sovrapposizioni;
- esportare un piano, la lista in testo o un backup completo;
- leggere e ripristinare un backup dopo la relativa anteprima e conferma;
- cambiare la lingua dell'interfaccia senza tradurre i testi dei piani.

I file scelti devono essere già disponibili sul dispositivo: un eventuale
recupero da un servizio cloud dipende dal fornitore del file. La copia negli
appunti conserva il fallback con testo selezionabile; il download `.txt`
rimane un'alternativa. La ricerca di aggiornamenti e una preparazione offline
da completare richiedono risorse raggiungibili in rete.

## Installare Meal Planner

Aprire **Impostazioni → Sempre a portata di mano**. L'interfaccia sceglie
il percorso sulla base delle capacità osservate dal client:

| Modalità rilevata | Comportamento |
| --- | --- |
| `prompt` | Compare **Installa Meal Planner** soltanto dopo la ricezione di `beforeinstallprompt`. Il click usa l'evento conservato. |
| `ios` | Mostra le istruzioni: aprire in Safari, toccare **Condividi**, scegliere **Aggiungi alla schermata Home** e confermare. |
| `manual` | Suggerisce il menu del browser e le voci di installazione o aggiunta alla Home, quando presenti. |
| `installed` | Mostra **App installata** e non ripropone il pulsante di installazione. |
| `unavailable` | Propone di continuare a usare la pagina nel browser. |

Il pulsante interno non presume che l'evento di installazione sia disponibile:
la sua emissione dipende dal browser e non ha un momento garantito. È il
modello descritto da [MDN: beforeinstallprompt][mdn-install-event].

Accettare il prompt non viene interpretato da solo come prova di installazione
completata. Il client aggiorna lo stato con `appinstalled` oppure rilevando
la modalità standalone, compreso il segnale disponibile in Safari. I menu
effettivi dipendono da browser e sistema operativo; la guida generale è
[MDN: Installing and uninstalling web apps][mdn-installing].

Il manifest dichiara `display: "standalone"`, icone PNG da 192 e 512 pixel e
un'icona maskable da 512 pixel. `index.html` include anche l'icona Apple da
180 pixel e i metadati per l'apertura dalla Home. Questi file descrivono la
configurazione consegnata; l'aspetto reale dell'installazione deve ancora
essere verificato sui dispositivi indicati nella procedura di collaudo.

## Indirizzo del sito, sottocartelle e archivi separati

I riferimenti a manifest, risorse, avvio e scope sono relativi alla cartella
dell'app. Il worker viene registrato nella stessa cartella, con URL stabile
`sw.js`. La navigazione fra le schermate usa il frammento dell'URL: non
richiede riscritture delle route sul server.

Il manifest omette intenzionalmente `id`: l'identità predefinita deriva da
`start_url`, risolto nella cartella dell'app. Un `id: "./"` esplicito sarebbe
invece risolto rispetto all'origine, condividendo l'identità fra sottocartelle.
Riferimento: [W3C, elaborazione del membro id][w3c-id].

Esempio di pubblicazione in una sottocartella GitHub Pages:

| Elemento | Esempio |
| --- | --- |
| App | `https://utente.github.io/meal-planner/` |
| Manifest | `https://utente.github.io/meal-planner/manifest.webmanifest` |
| Worker | `https://utente.github.io/meal-planner/sw.js` |
| Scope | `https://utente.github.io/meal-planner/` |
| Nome dell'archivio IndexedDB | `meal-planner:/meal-planner` |

L'archivio del browser appartiene all'origine del sito. Il nome scelto
dall'app comprende inoltre il percorso base, per separare i diversi progetti
ospitati sulla stessa origine. Anche i nomi delle cache includono il percorso
dello scope. Il worker elimina soltanto le cache con il proprio prefisso.

Un dominio diverso, un altro percorso dell'app, un altro browser o un altro
profilo possono quindi presentare un archivio distinto. Il trasferimento
esplicito si fa esportando e ripristinando un **backup completo**. Le
installazioni create da browser differenti non condividono automaticamente
i dati, come chiarito da [MDN][mdn-installing].

Non viene promessa una sincronizzazione automatica fra scheda Safari, icona
Home e altri browser su iOS. Verificare dove si trova il proprio archivio;
se le istanze sono separate, trasferire i dati mediante backup. Questa fase
non introduce sincronizzazione cloud o ricerca automatica di archivi in
altri percorsi.

### Preparare la pubblicazione

Eseguire dalla radice del progetto:

```sh
npm run build
```

La build genera `dist/`, compreso il worker compilato con l'inventario e gli
hash delle risorse. Pubblicare il contenuto di **`dist/`** sotto l'indirizzo
HTTPS scelto, anche quando è una sottocartella. Il `sw.js` nella radice del
repository è un template: la preparazione offline richiede la versione
generata dalla build. Il codice di sviluppo compila lo stesso template.

Questa guida descrive la preparazione; non attesta una pubblicazione GitHub
Pages o un'installazione su dispositivo già eseguita.

## Cache dell'app e archivio personale

| Livello | Contenuto | Uso |
| --- | --- | --- |
| Cache Storage | Pagina iniziale, manifest, moduli, stili, icone e altre risorse pubbliche dell'inventario; include la demo referenziata dall'interfaccia. | Riaprire e usare l'app senza scaricare nuovamente le risorse. |
| IndexedDB | Piani originali, assegnazioni, impostazioni, persone per pasto, checklist, voci manuali, cronologia e copia di recupero quando presente. | Conservare lo stato personale nel tempo. |
| File esportati | `.diet`, `.txt` e backup scaricati esplicitamente. | Portare fuori dall'app il piano, la lista o l'archivio. |

Il worker non legge IndexedDB, non apre i piani importati e non aggiunge i
backup personali alla cache. Intercetta soltanto richieste `GET` nello scope
per le risorse elencate e per la pagina iniziale, inclusa `index.html`.
Documentazione, percorsi arbitrari ed esportazioni non ricevono un fallback
generico alla pagina dell'app.

La gestione delle risorse offline e quella dei dati hanno errori distinti.
Una preparazione incompleta non viene presentata come perdita dell'archivio.
Un errore IndexedDB mantiene invece i dati disponibili in consultazione e
download, con riprova esplicita e senza passaggio silenzioso a una memoria
temporanea.

### Inventario, hash e riparazione

`scripts/pwa-build.mjs` costruisce un inventario deterministico delle risorse
pubbliche, con hash SHA-256 per ciascun file. La versione della cache combina
la versione del pacchetto con un digest che include inventario e template
del worker: anche una modifica ai file senza incremento manuale della
versione produce un identificativo diverso.

Durante installazione e riparazione, il worker scarica e verifica tutte le
risposte prima della prima scrittura. Rifiuta risposte fallite, opache,
reindirizzate o con un hash diverso da quello previsto. Il marcatore di
completezza viene scritto alla fine. Lo stato **Pronta anche offline**
richiede sia quel marcatore sia la presenza di ogni risorsa prevista.

Il controllo ordinario della prontezza verifica marcatore e presenza; non
ripete il digest di ogni file a ogni interrogazione. Le verifiche degli hash
avvengono quando vengono preparate le risorse e quando una risorsa mancante
deve essere recuperata dalla rete. Sono verifiche tecniche di coerenza della
versione e non riguardano dati alimentari.

Se fallisce una nuova preparazione, l'eventuale cache nuova incompleta viene
rimossa e le versioni precedenti restano intatte. Una riparazione conserva
la cache già esistente, anche se parziale, e prova a completarla con risorse
verificate. Se una risorsa manca durante l'uso, il worker tenta la rete e
serve la risposta soltanto se il suo SHA-256 coincide con quello della
versione corrente. Altrimenti restituisce un errore 503, senza memorizzarla:
evita così di mescolare moduli di una nuova distribuzione con una vecchia
pagina conservata. **Riprova preparazione offline** avvia il percorso di
riparazione; non cancella IndexedDB.

## Protezione dei dati nel browser

All'avvio il client controlla e, se disponibile e necessaria, richiede la
persistenza tramite `navigator.storage.persist()`. Se `persisted()` segnala
che è già concessa, non ripete la richiesta. La procedura è indipendente dal
caricamento dell'archivio: una risposta lenta non impedisce di aprire i dati.

Il browser decide se concedere la richiesta. `true` indica concessione,
`false` una normale mancata concessione; un'eccezione è rappresentata come
un esito distinto. La protezione riguarda la rimozione automatica e non
impedisce all'utente di cancellare esplicitamente i dati del sito. Riferimento:
[MDN: StorageManager.persist()][mdn-persist].

Nelle impostazioni, **Protezione non concessa** e **Protezione gestita dal
browser** non sono errori di salvataggio. Quando la richiesta non è concessa
o fallisce, è disponibile **Richiedi protezione dei dati**. Se l'API manca,
l'app lo spiega senza fingere una concessione o un fallimento di IndexedDB.

Il backup scaricato resta lo strumento per trasferire e recuperare i propri
piani fuori dall'archivio di quel browser. La protezione concessa non crea
un backup remoto e non rende permanenti le copie dopo una cancellazione
esplicita del sito o del profilo.

## Aggiornare senza interrompere il lavoro

Quando una nuova versione completa è in attesa, compare **Una nuova versione
è pronta**. Si può continuare a lavorare e aprire **Vedi aggiornamento**
quando si è pronti. Il dialog:

1. spiega che la pagina verrà ricaricata;
2. distingue i dati già salvati dalle bozze non confermate;
3. offre il download del backup;
4. richiede **Aggiorna e ricarica**.

Una bozza d'importazione, un articolo manuale non ancora aggiunto o altre
modifiche non confermate non fanno parte dell'archivio persistente e vanno
perse con la ricarica. L'aggiornamento non parte durante una lettura o un
salvataggio. Prima di procedere, il controller completa il salvataggio della
navigazione ancora pendente; durante il passaggio impedisce nuove operazioni
concorrenti.

Il worker in attesa accetta l'attivazione richiesta soltanto da una pagina
dell'app, con cache completa e una sola finestra presente nello scope. Se
ci sono altre schede o finestre di Meal Planner, il messaggio invita a
completare le modifiche, chiuderle e riprovare. Il client ricarica dopo che
il worker richiesto ha effettivamente preso il controllo; un normale evento
di controllo, da solo, non causa una ricarica forzata.

La conferma serve per passare subito alla nuova versione mentre l'app è
aperta. Chiudendo tutte le finestre, il ciclo normale del browser può
attivare la versione in attesa per l'apertura successiva. È il comportamento
di attesa descritto in [web.dev: The service worker lifecycle][webdev-lifecycle].

L'URL del worker resta stabile e la registrazione usa `updateViaCache: "none"`.
**Cerca aggiornamenti** avvia una ricerca esplicita e mostra il suo esito.
Un tentativo fallito non elimina la cache attiva utilizzabile. Durante
l'attivazione, le vecchie cache dello stesso progetto vengono ripulite solo
quando non risultano finestre nello scope; possono quindi essere conservate
più a lungo. Le cache degli altri percorsi non vengono eliminate.

Il worker non elimina né migra IndexedDB. La ricarica riapre l'archivio tramite
il livello di persistenza dell'app. Anche gli aggiornamenti degli indicatori
PWA sono separati dal contenuto dei form: il client aggiorna gli slot
`data-pwa-status` e `data-pwa-settings`, con una live region stabile e discreta.

## Compatibilità dello stato e recupero

### Stato v1 e migrazioni future

La versione dell'app, quella del database IndexedDB e quella dello stato
sono distinte. In questa fase `DATABASE_VERSION` e `CURRENT_STATE_VERSION`
sono entrambe 1, mentre `STATE_MIGRATIONS` è vuoto: non viene inventata né
eseguita una migrazione a uno stato v2.

La pipeline in `src/persistence/migrations.js` è predisposta per passi futuri
espliciti da `n` a `n + 1`. Verifica prima che il percorso sia completo,
opera su copie isolate e controlla tecnicamente lo stato risultante. Una
lettura di stato v1 compatibile non riscrive l'archivio e non aggiunge campi
predefiniti agli originali.

Una futura migrazione riuscita dovrà essere salvata con la copia precedente
nello stesso salvataggio atomico; il candidato non viene restituito come
stato corrente prima del completamento. Un passo mancante, una trasformazione
fallita o un errore di salvataggio conservano l'archivio precedente. Il
repository verifica inoltre versione e revisione dentro la scrittura, così
un client vecchio non può sovrascrivere dati di una versione successiva.
Questi controlli riguardano struttura e riferimenti; non valutano ricette,
calorie, macronutrienti, bilanciamento o frequenze alimentari.

Anche `readBackup()` prepara lo stato con questa pipeline. La versione del
contenitore backup viene verificata separatamente; l'anteprima non scrive
nulla nell'archivio. Il ripristino resta subordinato alla conferma e al
salvataggio completo. Un backup con una versione di stato sconosciuta non
viene convertito per tentativi.

### Scaricare un archivio non aperto da questa versione

Se la lettura ordinaria fallisce, il controller tenta una lettura separata
in sola lettura. Quando il database e il contenitore esterno sono ancora
riconoscibili, compare **Scarica archivio originale**, anche se nessun piano
è stato caricato nell'interfaccia.

Il file contiene l'oggetto di stato originale, con la sua versione, dentro
un nuovo contenitore `meal-planner.backup` v1 con data di esportazione. La
procedura non migra lo stato e non sblocca le modifiche. Per riaprirlo può
servire una versione compatibile dell'app. Il comando non è un ripristino
automatico e non è garantito quando lo storage stesso non è accessibile o
il suo contenitore non è riconoscibile. La lettura di recupero non crea un
database mancante.

### Copia precedente al ripristino

La copia di recupero già introdotta nella fase 4 resta disponibile dopo un
ripristino riuscito, quando esisteva uno stato precedente. **Scarica la copia
precedente** usa la lettura originale del record di recupero e ne conserva
la versione, senza migrazione. Il nome del file è
`meal-planner-previous-archive-AAAA-MM-GG.json`. Il ripristino non sostituisce
questa copia o l'archivio corrente se la scrittura fallisce.

Questa copia locale è distinta da un file già scaricato. **Svuota i dati
locali** e la sostituzione con la demo rimuovono anche la copia di recupero,
come dichiarato dalle conferme. La preparazione offline, la riparazione della
cache e il normale aggiornamento dell'app non la cancellano. La pipeline
futura riusa il meccanismo di copia atomica, ma in v1 non applica migrazioni.

## File principali della fase

| File | Responsabilità |
| --- | --- |
| [manifest.webmanifest](../manifest.webmanifest), [index.html](../index.html) | Avvio relativo, modalità standalone, colori, icone e metadati. |
| [src/pwa/client.js](../src/pwa/client.js) | Rilevamento delle capacità, installazione, persistenza richiesta al browser e ciclo di aggiornamento. |
| [sw.js](../sw.js) | Template del worker, cache verificata, readiness, riparazione e attivazione controllata. |
| [scripts/pwa-build.mjs](../scripts/pwa-build.mjs), [scripts/build.mjs](../scripts/build.mjs) | Inventario con digest e generazione della distribuzione statica. |
| [src/persistence/migrations.js](../src/persistence/migrations.js) | Compatibilità v1 e percorso esplicito per migrazioni future. |
| [src/persistence/indexeddb.js](../src/persistence/indexeddb.js) | Scritture atomiche, controllo delle versioni e download dell'archivio originale. |
| [src/ui/render.js](../src/ui/render.js), [src/main.js](../src/main.js) | Slot PWA, impostazioni, conferme e collegamento alle operazioni. |

## Verifiche effettuate e limiti della consegna

L'audit statico dell'interfaccia ha prodotto:

- **34 snapshot HTML** nei due idiomi, dedicati ai nuovi stati PWA;
- **374 asserzioni** su rendering, disponibilità dei comandi, conferme,
  protezione delle bozze durante gli aggiornamenti degli slot e testo escapato;
- **497 chiavi IT/EN** corrispondenti, con gli stessi parametri di sostituzione;
- controllo di ID, etichette, riferimenti ARIA, nomi dei controlli, live region
  stabile e dialog nativi;
- esito positivo di controllo sintattico e `git diff --check` sui file UI.

Gli snapshot e i riepiloghi dell'audit della sessione sono conservati nella
cartella di lavoro `phase-7-ui-qa/`, esterna al repository. Non sono screenshot
di browser. Il controllo della conservazione dei form riguarda la separazione
dei frammenti renderizzati; non sostituisce una prova di digitazione su un
dispositivo reale.

La suite comprende verifiche Node del client PWA, del worker, dei flussi
offline e delle migrazioni, usando oggetti browser/cache simulati e
`fake-indexeddb`. Questi strumenti verificano il comportamento del codice
nei casi modellati, non l'effettiva installazione, riapertura offline,
politica di conservazione o aspetto di un particolare browser.

La suite completa ha superato **105 test su 105**, senza errori o test saltati.
Comprende **25 nuovi test della fase 7**: 11 sul client PWA, 7 sul worker,
5 sulla compatibilità/migrazione dello stato e 2 sui flussi offline completi.
I test dei flussi disabilitano gli accessi alla rete e registrano **zero
tentativi di rete** durante importazione, modifiche, spesa, esportazione,
backup e riapertura. Le versioni future usate nei test delle migrazioni
sono fixture sintetiche: l'app consegnata resta allo stato v1.

Il controllo dell'inventario copre **37 risorse**. Un audit dei **76 riferimenti
locali** di HTML, JavaScript, CSS e icone ne ha verificato la risoluzione sia
in `/` sia in `/meal-planner/`, senza dipendenze richieste fuori scope o assenti
dall'inventario. Si tratta di verifiche statiche, non di una visita a un sito
GitHub Pages già distribuito.

In questa sessione non sono state eseguite prove interattive su browser
desktop, Android o iOS. La skill **Sites** richiede il controllo tramite
`control-browser`, che non era disponibile nell'ambiente. Non sono stati
usati server, Playwright o altri browser come sostituti. L'installabilità e
l'esperienza mobile sui dispositivi reali restano quindi da confermare con
il collaudo della fase 8.

## Procedura manuale per la fase 8 — da eseguire

Usare una distribuzione di prova generata dalla build, annotando browser,
versione del sistema, indirizzo completo e modalità di apertura. Conservare
un backup dei dati che si intendono mantenere. Per popolare l'archivio di
prova si possono usare gli esempi della fase 6:
[shopping-demo-it.diet](../examples/phase-6/shopping-demo-it.diet) e
[shopping-backup.json](../examples/phase-6/shopping-backup.json).

1. **Preparazione:** aprire online il sito nella sottocartella prevista,
   attendere **Pronta anche offline** e controllare manifest, icone e avvio.
2. **Installazione:** seguire il percorso disponibile nel browser o le
   istruzioni Safari. Riaprire dall'icona e registrare quale archivio compare,
   senza presumere condivisione con altre istanze.
3. **Riapertura offline:** disattivare la connessione, chiudere e riaprire
   l'app. Verificare navigazione e dati già salvati. Provare anche un primo
   accesso senza risorse preparate, che non deve essere dichiarato pronto.
4. **Operazioni locali:** usare un file già sul dispositivo; modificare un
   pasto, cambiare modalità della spesa, spuntare una voce, aggiungere un
   manuale ed esportare `.diet`, `.txt` e backup. Riaprire e confrontare i
   dati salvati. Controllare entrambe le lingue e la riduzione delle animazioni.
5. **Nuova versione:** tornare online e pubblicare una seconda build di prova.
   Cercare aggiornamenti, verificare l'attesa e annullare inizialmente la
   conferma. Poi aggiornare e confrontare calendario, spesa e impostazioni.
6. **Altre finestre e bozze:** con una seconda finestra dello stesso scope,
   verificare il messaggio di attesa; chiuderla dopo aver completato il lavoro
   e riprovare. Controllare avviso sulle bozze e blocco durante un salvataggio.
7. **Recupero:** su un archivio di prova, interrompere una preparazione e
   verificare la riprova senza perdita dei dati. Provare backup e copia
   precedente; quando previsto dal caso di compatibilità, scaricare l'archivio
   originale e verificare che la versione dello stato sia conservata.

Registrare risultati e anomalie prima di dichiarare concluso il collaudo.
Questa procedura è una lista di prove previste, non un resoconto di prove
già svolte.

## Fonti ufficiali

Le fonti descrivono le API e i comportamenti generali dei browser. Le scelte
specifiche di Meal Planner sono documentate in base ai file del progetto
elencati sopra.

- [MDN — StorageManager.persist()][mdn-persist]: richiesta di persistenza,
  risultato booleano, decisione del browser ed eccezioni.
- [MDN — Window: beforeinstallprompt event][mdn-install-event]: ricezione e
  conservazione dell'evento prima di mostrare un comando di installazione.
- [MDN — Installing and uninstalling web apps][mdn-installing]: percorsi
  d'installazione e differenze fra istanze create da browser diversi.
- [web.dev — The service worker lifecycle][webdev-lifecycle]: installazione,
  attesa, attivazione e precauzioni sulle cache della stessa origine.
- [W3C — Web Application Manifest, id][w3c-id]: identità dell'app e relazione
  con `start_url` quando il membro `id` è assente.

[mdn-persist]: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
[mdn-install-event]: https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event
[mdn-installing]: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing
[webdev-lifecycle]: https://web.dev/articles/service-worker-lifecycle
[w3c-id]: https://www.w3.org/TR/appmanifest/#id-member
