# Fase 8 — verifica dell'integrazione e prove di rilascio

Data della verifica: **19 ottobre 2026**. Versione di consegna: **1.0.0**.
Runtime osservato: **Node.js v24.19.0**.

Questa matrice collega i requisiti al codice e alle prove disponibili. Le
verifiche tecniche comprendono funzioni di produzione, persistenza simulata,
controller e markup generato. **Non sono state eseguite prove in un browser
reale né una pubblicazione su GitHub Pages.** La preparazione della release
e la presenza di un workflow non costituiscono prova di un sito pubblicato.

I riferimenti funzionali sono il [brief](PROJECT_BRIEF.md), il
[contratto .diet](DIET_FORMAT.md), il [formato di stato e backup](STATE_AND_BACKUP.md)
e la [guida PWA della fase 7](PHASE_7_PWA.md). Le guide delle fasi precedenti
descrivono la consegna di ciascuna fase; i loro conteggi storici non vanno
sommati per ottenere il totale della release corrente.

## Come leggere le evidenze

| Livello | Che cosa è stato controllato | Limite della prova |
| --- | --- | --- |
| Logica e flussi Node | Funzioni reali di importazione, calendario, spesa, esportazione e backup, con confronti degli stati prima e dopo le operazioni. | Non esegue click o selettori nativi. |
| Persistenza e PWA simulate | Repository reale con `fake-indexeddb`; client e worker reali con API di rete, cache e ciclo di vita simulate. | Non certifica quote, espulsione dei dati, installazione o ciclo di vita di uno specifico browser. |
| Controller con adapter DOM | `src/main.js` importato ed eseguito, listener reali, risposte clipboard differite, rendering registrato e salvataggi attraverso `fake-indexeddb`. | L'adapter non interpreta HTML e non simula layout, focus, ordine degli eventi nativi o finestre di autorizzazione del sistema. |
| Audit statico UI | Lettura dei collegamenti evento/modello, markup prodotto, dizionari, attributi accessibili e regole CSS. | Non equivale a screenshot, verifica visuale o lettura con screen reader. |
| Collaudo browser | Procedura manuale indicata in fondo a questo documento. | **Da eseguire** su desktop, Android e iOS. |

Le fixture verificano struttura, riferimenti, aritmetica delle quantità e
continuità dello stato. Non sono stati introdotti controlli o test di
correttezza nutrizionale, ricette, bilanciamento, calorie, macro o frequenze
alimentari. Verificare che un valore fornito rimanga invariato al cambio
del numero di persone riguarda il contratto software, non la sua validità
alimentare.

## Matrice — importazione e calendario

| ID | Percorso e comportamento atteso | Evidenze disponibili | Confine della verifica |
| --- | --- | --- | --- |
| I1 | Leggere un `.diet`, mostrare titolo, durata, date suggerite e mappatura senza scrivere l'archivio. | [foundations.test.mjs](../tests/foundations.test.mjs), [import-export.test.mjs](../tests/import-export.test.mjs); `readFile`, `previewPlan` in [main.js](../src/main.js) e `importView` in [render.js](../src/ui/render.js). | Parsing e anteprima testati; scelta del file nel browser da provare. |
| I2 | La data suggerita richiede conferma manuale. Cambiare data o file toglie la conferma precedente; una data non interpretabile impedisce l'applicazione. | Test `imports require manual date confirmation…`; audit di `previewPlan`, `refreshImportPreview` e listener `import-start`. Anche il caricamento di un file non leggibile produce una bozza senza conferma. | Il vincolo dati è testato. Il reset dei controlli UI è verificato nel codice; la sequenza del date picker nativo resta da eseguire. |
| I3 | Conservare ordine, distanza fra giornate e orari nel rimappare le date. | [import-export.test.mjs](../tests/import-export.test.mjs), [release-calendar.test.mjs](../tests/release-calendar.test.mjs): transizioni di 23/25 ore in `Europe/Rome`, cambio anno e febbraio bisestile. | Date civili e testo dell'orario testati in Node. I formati dei selettori dipendono dal browser. |
| I4 | Avvisare soltanto delle date mappate che contengono pasti; sostituire giornate intere solo dopo conferma. Una giornata nell'intervallo ma fuori dalla mappatura resta intatta. | `previewImport`/`prepareImport`, test delle revisioni e dei confini del calendario; audit del dialogo `confirm` con azione `import`. | Sostituzione e atomicità testate. Apertura, annullamento e conferma del dialogo nativo da provare. |
| I5 | Riconoscere file identici senza duplicazioni involontarie e distinguere una revisione dello stesso `planId`. | [import-export.test.mjs](../tests/import-export.test.mjs): nome file/ordine delle chiavi irrilevanti; stessa assegnazione senza modifiche; nuova assegnazione esplicita con sorgente riusata; revisione separata. | Test sullo stato e audit delle etichette di anteprima. |
| I6 | Annullare l'ultima importazione, ripristinando i giorni interessati e conservando modifiche estranee successive. | [workflows.test.mjs](../tests/workflows.test.mjs), [calendar-workflows.test.mjs](../tests/calendar-workflows.test.mjs) e test import/export. Coperti anche pasti importati spostati su date ulteriori e annullamento dopo riapertura. | Logica, backup e persistenza simulata coperti; revisione visuale dell'elenco date e conferma da provare. |
| C1 | Selezionare date passate/future e vuote; tornare a oggi; mantenere selezione del calendario e navigazione. | [navigation.test.mjs](../tests/navigation.test.mjs), `selectDate`, `handleHistory`, azione `go-today`; `getDayEntries` e viste giorno/calendario. | Risoluzione delle rotte testata, inclusa la precedenza dell'URL. Scorrimento, tastiera e Back/Forward reali da provare. |
| C2 | Modificare orario e persone della singola occorrenza, conservando sorgente e altri pasti. | [ui-session.test.mjs](../tests/ui-session.test.mjs), [calendar-data.test.mjs](../tests/calendar-data.test.mjs), [calendar-workflows.test.mjs](../tests/calendar-workflows.test.mjs). | Stato, ordine per ora effettiva e riapertura testati. Input numerici/orario nativi da provare. |
| C3 | Spostare un pasto solo con «Sposta pasto», aggiungendolo a eventuali pasti della destinazione. | `mealMoveForm`, `refreshMealMoveForm`, `moveMeal`; test di spostamento, abort tardivo, esportazione e annullamento. | `input`/`change` aggiornano soltanto feedback e abilitazione del submit; questo collegamento è letto nel codice. Primo click, Enter e date picker richiedono prova browser. |
| C4 | Separare quantità da preparare e valori personali. | `mealDialog`, `ingredientList`, `nutritionSummary`; test tecnici su conservazione della sorgente e moltiplicatori. | La UI usa ingredienti scalati per la preparazione e dati base per il riepilogo personale. Nessuna verifica di correttezza alimentare. |

In caso di errore di salvataggio, `saveCandidate` conserva lo stato visibile
precedente e il chiamante mantiene l'anteprima di importazione/ripristino.
I test verificano anche l'abort successivo al successo della richiesta
`put`: lo stato non viene dichiarato salvato prima del completamento della
transazione. Una riprova dello storage rilegge l'archivio e azzera le
conferme dell'importazione, perché le date occupate possono essere cambiate.

## Matrice — spesa, lingua e backup

| ID | Percorso e comportamento atteso | Evidenze disponibili | Confine della verifica |
| --- | --- | --- | --- |
| S1 | Intervallo inclusivo e modalità una persona, due persone, persone dei singoli pasti. Le modalità fisse non riscrivono i pasti. | [shopping-workflows.test.mjs](../tests/shopping-workflows.test.mjs), [shopping-quantities.test.mjs](../tests/shopping-quantities.test.mjs); listener dei filtri in `main.js`. | Totali e conservazione dello stato testati. Selettori data/radio reali da provare. |
| S2 | Raggruppare identità/unità/base compatibili, usando solo conversioni dichiarate o metriche note. Non contare due volte una preparazione condivisa. | Test delle quantità, conversioni locali, gruppi crudo/cotto/scolato e porzioni consumate. | Verifica aritmetica con dati sintetici; nessuna inferenza di ricette, densità o equivalenze alimentari. |
| S3 | Riaprire una voce quando aumenta la quantità richiesta; cambiare periodo riapre le sole voci generate. | Test `checks reopen…` e `a new period…` in [shopping-workflows.test.mjs](../tests/shopping-workflows.test.mjs); UI quantità precedente/richiesta e badge di aumento. | Stato delle spunte, riduzioni e sparizione/ricomparsa coperti; riconoscibilità visuale da provare. |
| S4 | Aggiungere, spuntare e rimuovere voci manuali assolute, con quantità/unità/categoria; conservare le voci legacy. | Test spesa, backup e output; audit del form manuale e del suo draft. Unità personalizzate preservate anche quando coincidono con nomi di proprietà JavaScript. | Contenuto e persistenza testati. Immissione decimale e tastiere mobili da provare. |
| S5 | Copiare/esportare testo localizzato, anche con sole voci manuali e senza periodo; mostrare fallback quando la clipboard non è disponibile. | [shopping-output.test.mjs](../tests/shopping-output.test.mjs), [release-ui.test.mjs](../tests/release-ui.test.mjs): clipboard assente, negata, riuscita e risposte tardive. | Controller e contenuto coperti con API simulate. Autorizzazioni, selezione/copia di sistema e download `.txt` reali da provare. |
| L1 | Cambiare soltanto lingua UI, lasciando titoli, ingredienti, note e istruzioni nella lingua originale. | [ui-session.test.mjs](../tests/ui-session.test.mjs), [release-continuity.test.mjs](../tests/release-continuity.test.mjs), dizionari IT/EN e rendering con testo escapato. | Conservazione dei dati e markup testati. Pronuncia assistiva dei blocchi con `lang` e impaginazione delle traduzioni da provare. |
| B1 | Esportare sia l'originale sia un `.diet` con date/orari assegnati, sempre con quantità per una persona. | [import-export.test.mjs](../tests/import-export.test.mjs), [release-calendar.test.mjs](../tests/release-calendar.test.mjs), `exportCalendarDiet`/`exportSourceDiet`. | Contenuto esportato testato; creazione e riapertura del file scaricato nel browser da provare. |
| B2 | Backup completo distinto dal piano: impostazioni, date, persone, spunte, manuali, cronologia e annullamento. | [workflows.test.mjs](../tests/workflows.test.mjs), [shopping-workflows.test.mjs](../tests/shopping-workflows.test.mjs), [offline-workflows.test.mjs](../tests/offline-workflows.test.mjs). | Round trip e riapertura testati attraverso il repository simulato. |
| B3 | Prima del ripristino mostrare dati correnti/in arrivo e chiedere conferma; mantenere corrente e recupero se lettura o salvataggio falliscono. | `replacementSummary`/dialogo restore; test backup malformato, riferimenti mancanti, checkpoint atomico e abort tardivo. | La protezione dello stato è testata. Il confronto visuale e la conferma sono audit di codice/markup. |
| B4 | Scaricare la copia precedente o un archivio non aperto da questa versione senza convertirlo per tentativi. | [persistence-migrations.test.mjs](../tests/persistence-migrations.test.mjs), `readStoredBackup`, azioni `download-recovery`/`download-stored-backup`. | Lettura originale e conservazione delle versioni testate; file di recupero sul dispositivo da provare. |

## Matrice — PWA, continuità e accessibilità

| ID | Percorso e comportamento atteso | Evidenze disponibili | Confine della verifica |
| --- | --- | --- | --- |
| P1 | Indicatori rete e preparazione offline distinti. Assenza rete e persistenza non concessa non bloccano le operazioni locali. | [pwa-client.test.mjs](../tests/pwa-client.test.mjs), [offline-workflows.test.mjs](../tests/offline-workflows.test.mjs), audit dei controlli disabilitati per storage/busy. | Nei flussi offline simulati nessun accesso alla rete è necessario per le operazioni sui dati. Avvio reale senza rete da provare dopo cache completa. |
| P2 | Mostrare il prompt solo se ricevuto; istruzioni iOS/menu browser e stato installato secondo le capacità osservate. | Test del client e 34 snapshot PWA IT/EN della fase 7. Un prompt accettato non basta per dichiarare installata l'app. | Rilevamento simulato e markup. Installazione su desktop/Android/iOS **non eseguita**. |
| P3 | La nuova versione resta in attesa; applicarla richiede conferma e nessun salvataggio in corso. Gestire altre schede e timeout senza ricariche tardive. | [pwa-client.test.mjs](../tests/pwa-client.test.mjs), [pwa-worker.test.mjs](../tests/pwa-worker.test.mjs), `applyAppUpdate` in `main.js`. | Protocollo e ricarica simulati; passaggio effettivo tra due release nel browser da provare. |
| P4 | Gli eventi PWA in background lasciano intatti i form non confermati. | Audit di `refreshPwaParts`: modifica solo `data-pwa-status`, `data-pwa-settings` e progressione del dialogo. `presentPwaResult` scarta esiti dopo cambio di route/dialogo o durante I/O. Snapshot dei frammenti PWA. | Separazione del rendering verificata; digitazione, selezione e popup nativi mentre arrivano eventi da provare. |
| P5 | Conservare archivio, sorgenti, modifiche e tre proiezioni della spesa attraverso un aggiornamento e una riapertura offline. | Due scenari in [release-continuity.test.mjs](../tests/release-continuity.test.mjs): release durante un commit; ricerca aggiornamenti pendente/fallita durante un ripristino completo. | Integrazione di componenti reali con browser/IndexedDB simulati. Nessuna attestazione di aggiornamento installato su dispositivo. |
| P6 | Cache completa e coerente con la release; download/cache parziali non sostituiscono la versione utilizzabile. | [pwa-worker.test.mjs](../tests/pwa-worker.test.mjs): digest, inventario, miss coerenti, attivazione e riparazione esplicita. | Cache/rete simulate; headers, MIME e disponibilità del sito pubblico restano da verificare sulla destinazione. |
| P7 | Errori storage espliciti, nessun fallback silenzioso, conflitti fra schede e versioni sconosciute protetti. | [persistence.test.mjs](../tests/persistence.test.mjs), [persistence-migrations.test.mjs](../tests/persistence-migrations.test.mjs). | Repository e migrazioni simulate; quota, modalità privata e cancellazione dati del browser richiedono prova reale. |
| A1 | Navigazione chiara, calendario desktop stretto/mobile compatto, contenuto giornaliero prevalente e riduzione del movimento. | Audit di [styles.css](../src/ui/styles.css), `calendarView`, `render`; breakpoint, focus visibile, selezione non affidata solo al colore e due preferenze di riduzione del movimento. | Implementazione CSS e markup. Nessun giudizio visuale su viewport reali. |
| A2 | Label, ID e riferimenti ARIA coerenti; dialoghi nativi e messaggi accessibili. | Audit statici delle fasi UI; la fase 7 registra 1.266 controlli semantici su 34 HTML. | Non sostituisce un audit con screen reader, zoom, tastiera e albero di accessibilità del browser. |

## Difetto riprodotto e corretto nella fase 8

Una risposta della clipboard poteva arrivare dopo l'apertura della conferma
di aggiornamento, senza che fosse cambiata la schermata Spesa. Il controllo
precedente confrontava richiesta e route, ma non il dialogo corrente né
l'operazione locale in corso. Un rifiuto tardivo apriva il fallback della
clipboard al posto della nuova conferma; anche un successo tardivo provocava
un render completo non necessario.

`copyShoppingList` in [main.js](../src/main.js) ora conserva il riferimento
al dialogo presente all'avvio. Presenta successo o fallback soltanto se
richiesta, route e dialogo sono ancora correnti e l'app non è occupata.
La copia già affidata alla clipboard non viene annullata: viene scartato
soltanto l'esito UI ormai superato.

I **7 test** di [release-ui.test.mjs](../tests/release-ui.test.mjs) esercitano:

- successo e rifiuto tardivi dopo l'apertura di una conferma PWA;
- successo e rifiuto tardivi durante il salvataggio di una spunta manuale;
- fallback normale con clipboard assente o permesso negato;
- copia riuscita nella schermata ancora corrente.

Il controller di produzione viene importato con un adapter DOM minimo;
IndexedDB e API del worker sono simulate. Le regressioni hanno riprodotto
il render indesiderato prima della correzione. Dopo il fix, i sette casi
passano e il fallback ordinario resta disponibile. Non è stata eseguita
una prova del prompt clipboard di un browser reale.

## Risultati riproducibili e conteggi

Per i controlli tecnici della release si usa **Node 24 o successivo**:

```sh
npm ci
npm run check
npm test
npm run build
npm run verify:build
```

Il comando mirato eseguito per la regressione del controller è:

```sh
node --test --test-isolation=none tests/release-ui.test.mjs
```

Esito della suite completa eseguita per questa release: **121 test riusciti,
0 falliti, 0 annullati, 0 saltati**. Il comando `npm test` usa
`node --test --test-isolation=none tests/*.test.mjs`, con i casi riportati
singolarmente. I sette test del controller sono inclusi nel totale, come
le tre nuove verifiche di calendario, le due di continuità e le quattro
di distribuzione. I conteggi delle fasi precedenti non vanno sommati di nuovo.

Il controllo `npm run check` ha verificato la sintassi di **52 moduli JS**
e la lettura tecnica di **15 documenti JSON/.diet**, oltre ai riferimenti
locali della pagina, dei moduli e della shell. La build finale contiene
**39 file**: 37 risorse della shell con hash, il worker compilato e
`.nojekyll`. La release PWA è **`1.0.0+e09efecc821d5246`**.

I quattro casi di [release-distribution.test.mjs](../tests/release-distribution.test.mjs)
verificano il pacchetto minimo, percorsi alla radice e in `/meal-planner/`,
file locali mancanti/alterati/extra e build obsolete. Usano poi risposte
HTTP simulate per controllare status, MIME, hash, worker vecchi e ritentativi
durante la propagazione di una release. Non avviano server né contattano
un sito pubblico. Il controllo locale definitivo `npm run verify:build`
confronta invece tutti i byte della vera cartella `dist/` con i sorgenti
correnti e con il worker rigenerato: **39 file verificati, nessuna discrepanza
e nessuna richiesta HTTP**. Anche il controllo dei **110 riferimenti locali**
nelle sette guide aggiornate e `git diff --check` sono riusciti.

Il workflow [pages.yml](../.github/workflows/pages.yml) è stato letto con
un parser YAML e controllato staticamente: job di verifica prima della
pubblicazione, trigger e condizione limitati a `main` per il deployment,
permessi Pages confinati al job di pubblicazione, artefatto `dist/` e URL
ottenuto da `steps.deployment.outputs.page_url`. **Il workflow non è stato
eseguito su GitHub Actions in questa sessione.** Dopo il deployment userà
quell'URL per verificare via HTTP la stessa release; un successo di questo
controllo resta distinto da un collaudo browser.

L'evidenza statica PWA già prodotta nella fase 7 comprende **34 snapshot
HTML**, **374 asserzioni**, **497 chiavi IT/EN** con gli stessi parametri e
**1.266 controlli semantici**. I riepiloghi `result.json` e `html-audit.json`
sono nella cartella di lavoro `phase-7-ui-qa/`, esterna al repository; la
[guida della fase 7](PHASE_7_PWA.md) ne conserva il riepilogo. Sono risultati
su documenti generati, non screenshot o prove di dispositivi.

## Collaudo browser ancora da eseguire

In questa sessione la skill **Sites** richiede il controllo del browser
gestito tramite `control-browser`, che non è disponibile. Non sono stati
avviati server o usati altri browser come sostituti. Le seguenti attività
sono un piano di collaudo, **non risultati ottenuti**.

Usare una build di prova su HTTPS, registrando URL completo, browser,
versione del sistema e modalità browser/installata. Per ogni prova annotare
atteso, osservato, esito e un'evidenza. Conservare un backup dei dati da
mantenere; usare per le prove gli esempi
[shopping-demo-it.diet](../examples/phase-6/shopping-demo-it.diet) e
[shopping-backup.json](../examples/phase-6/shopping-backup.json).

| Prova manuale | Procedura e risultato da osservare | Stato |
| --- | --- | --- |
| Desktop: importazione completa | Aprire Importa, scegliere il file, confermare una data, cambiarla e verificare il reset; scegliere un nuovo file e ricontrollare. Importare, ripetere lo stesso file, provare overlap con annullamento e sostituzione, quindi annullare l'ultima importazione. | Non eseguita. |
| Calendario e pasto | Navigare tra giorni, settimane, date vuote e oggi; usare frecce/Enter/Tab. Cambiare ora/persone, digitare la data di spostamento e premere una sola volta «Sposta pasto». Verificare destinazione occupata, focus, scorrimento e riapertura. | Non eseguita. |
| Spesa e file | Provare intervallo inclusivo, tre modalità, quantità riaperte, manuali con unità personalizzata, copia concessa/negata, fallback e `.txt`. Aprire i file scaricati e confrontare contenuto e spunte. | Non eseguita. |
| Backup/ripristino | Esportare un backup, modificare lo stato, caricare il file e annullare la prima conferma. Ripristinare, riaprire l'app e scaricare la copia precedente. Provare un file illeggibile e verificare che i dati restino. | Non eseguita. |
| Lingua e accessibilità | Passare IT/EN conservando i testi italiani del piano; controllare zoom, contrasto, focus, Escape, lettura dei dialoghi e riduzione del movimento del dispositivo e dell'app. | Non eseguita. |
| Responsive Android/iOS | Provare viewport stretti, tastiera aperta, orientamento, date picker e scroll della giornata. Controllare che la navigazione fissa non copra pulsanti o ultima voce della lista. | Non eseguita. |
| Installazione e offline | Attendere «Pronta anche offline» al primo accesso online. Installare tramite prompt se ricevuto, Safari iOS o menu previsto; chiudere e riaprire senza rete, quindi modificare e scaricare file locali. | Non eseguita. |
| Nuova release e bozze | Con una bozza non confermata aperta, rendere disponibile una seconda build: il banner non deve interrompere l'immissione. Verificare annullamento del dialogo e aggiornamento esplicito dopo aver completato o scartato le bozze. | Non eseguita. |
| Altre schede e storage | Tentare aggiornamento con due finestre, poi chiuderne una e riprovare. Provare modifiche concorrenti e riprova storage senza sovrascritture silenziose; verificare il messaggio di protezione concessa/non concessa secondo il browser. | Non eseguita. |

L'installazione iOS e una scheda Safari possono usare archivi separati:
questa consegna non dichiara una sincronizzazione tra quelle superfici.
Per trasferire dati tra archivi, browser, dispositivi o URL diversi si usa
il backup completo.

## Stato della pubblicazione

Durante la verifica non risultavano configurati un remote Git utilizzabile,
il comando `gh` o un connettore GitHub disponibile. Non è stata eseguita
alcuna pubblicazione e non esiste un URL di produzione verificato in questa
sessione. Il controllo locale di una build e la preparazione di GitHub
Actions non dimostrano l'esito di un deployment.

Quando sarà disponibile una destinazione autorizzata, andranno registrati
URL pubblico, commit e risultato del workflow; poi eseguiti i controlli
HTTP e il collaudo browser sopra indicato sulla stessa build. Fino ad allora
installazione reale, comportamento dei download e continuità offline sui
dispositivi restano limiti espliciti della verifica.

La [guida GitHub Pages](GITHUB_PAGES.md) descrive i passaggi rimanenti:
creare o scegliere un repository pubblico, caricare i sorgenti su `main`,
selezionare **GitHub Actions** come sorgente Pages e avviare il workflow.
Il suo risultato fornirà l'URL effettivo da registrare e collaudare.
