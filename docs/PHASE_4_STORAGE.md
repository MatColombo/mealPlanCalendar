# Fase 4 — persistenza locale e importazione/esportazione

Versione **0.4.0**, 19 ottobre 2026. Riferimenti di prodotto:
[PROJECT_BRIEF.md](PROJECT_BRIEF.md), [DIET_FORMAT.md](DIET_FORMAT.md) e
[STATE_AND_BACKUP.md](STATE_AND_BACKUP.md).

## Risultato

Le schermate della fase 3 sono collegate a un archivio IndexedDB. Piani
originali, calendario, impostazioni, persone e orari dei pasti, spesa e
cronologia sopravvivono alla ricarica. L'importazione è atomica e annullabile;
l'esportazione distingue piano originale, calendario assegnato e backup.
Il ripristino conserva una copia dell'archivio sostituito.

Il frontend mantiene HTML, CSS e moduli JavaScript statici, senza backend,
dipendenze runtime, CDN o chiamate a servizi AI. Italiano e inglese coprono
anche conferme, cronologia, errori di salvataggio e recupero. La lingua dei
documenti rimane indipendente dall'interfaccia.

La fase 4 conserva dati locali; manifest, service worker, installazione e
caricamento dell'app senza rete appartengono alla fase 7. Una persistenza dei
dati funzionante non implica che la pagina sia già disponibile offline.

## Primo utilizzo

1. Avvia il progetto con `npm run dev` e apri l'indirizzo locale mostrato.
2. Il primo archivio è vuoto. Apri **Importa** e scegli un `.diet`, oppure
   carica il piano dimostrativo riconoscibile dell'interfaccia.
3. Leggi titolo, durata e data proposta. Scegli la data iniziale e seleziona
   la relativa conferma, anche se mantieni la data suggerita.
4. Controlla intervallo e sovrapposizioni; applica l'importazione.
5. Modifica orari o persone, scegli la modalità della spesa e aggiungi/spunta
   articoli. Ogni operazione riuscita viene salvata.
6. Usa **Esporta → Backup completo** per conservare o trasferire l'archivio.

La demo non viene caricata automaticamente all'avvio e non sostituisce dati
esistenti. L'azione esplicita di ripristino della demo, nelle impostazioni,
mostra la data locale di partenza e richiede conferma della sostituzione.

## Dati conservati e responsabilità

| Modulo | Responsabilità |
| --- | --- |
| `src/data/diet.js`, `session.js` | Lettura del piano e accesso tecnico alle presenze, agli orari e alle quantità. |
| `src/data/validation.js` | Integrità JSON dello stato e dei riferimenti necessari a calendario, storico, spesa e annullamento. |
| `src/data/imports.js` | Anteprima, riconoscimento del contenuto, candidato di importazione, annullamento e riconciliazione delle spunte. |
| `src/data/export.js` | `.diet` originale oppure materializzato dalle date del calendario. |
| `src/data/backup.js` | Involucro del backup completo e lettura del candidato al ripristino. |
| `src/persistence/indexeddb.js` | Transazioni, revisioni, copie isolate, stato corrente e copia pre-ripristino. |
| `src/persistence/commit.js` | Restituisce il candidato applicabile all'UI solo dopo il salvataggio riuscito. |
| `src/main.js` | Collega controlli e conferme alle operazioni persistenti; gestisce stati di attesa ed errore. |
| `src/ui/render.js`, `locales/` | Viste riutilizzabili e testi IT/EN, senza scritture autonome nel database. |

`AppState` contiene documenti sorgente separati dal calendario. Ogni presenza
conserva `sourceId`, `sourceDate`, `mealId`, `entryId`, `timeOverride` e
`cookingServings`. La spesa conserva intervallo, modalità, spunte e voci
manuali. Lo storico e `lastImportUndo` sono parte dello stesso snapshot.

Le quantità e le stime restano individuali. Le tre modalità moltiplicano i
soli fabbisogni della spesa per 1, 2 oppure per le persone dei singoli pasti.
I controlli tecnici non valutano ricette, pasti, bilanciamento, calorie,
macronutrienti o frequenze, né li confrontano con le preferenze.

## Importazione, passo per passo

### Lettura e anteprima

La lettura usa il JSON e il formato versionato. Il flusso controlla i campi
necessari alla UI, identificativi, date ordinate e distinte, orari e tipi delle
quantità. Un errore lascia intatto l'archivio. Il file rimane un candidato
transitorio finché non viene confermato.

La data selezionata corrisponde al primo giorno del documento. Uno stesso
scarto viene applicato a tutte le date: un piano del 21, 23 e 24 ottobre,
assegnato dal 26 ottobre, occupa 26, 28 e 29 ottobre. Il 27 rimane invariato.
Gli orari non vengono traslati e le date civili non dipendono da cambi di fuso
o giornate con ora legale.

La conferma della data è separata dal pulsante di importazione. Cambiare data,
caricare un altro file o ricaricare l'archivio azzera tale conferma. Le date
risultanti e quelle già contenenti pasti sono visibili prima della scrittura.

### Duplicati, revisioni e sovrapposizioni

| Situazione | Comportamento |
| --- | --- |
| JSON nuovo | Nuova sorgente immutabile e nuove presenze. |
| Stessi valori JSON e stesse assegnazioni già presenti | Nessuna nuova operazione; orari, persone, storico e annullamento rimangono invariati. |
| Stesso contenuto, altre date o assegnazione non più completa | Conferma aggiuntiva di riutilizzo; stessa sorgente, nuove presenze e nuovo record storico. |
| Stesso `planId`, JSON diverso | Revisione segnalata e conservata come sorgente distinta. |
| Date mappate che contengono già pasti | Conferma della sostituzione completa di quelle giornate. |

La comparazione ignora nome del file, indentazione e ordine delle proprietà,
ma considera tutti i valori, le estensioni e l'ordine degli array. Non usa
il solo titolo o `planId` come identità del file.

L'utente può modificare la data, annullare oppure confermare. La sostituzione
di una giornata elimina da quella data tutte le presenze precedenti, anche
se appartenevano ad altri piani; i documenti originali restano archiviati.
I giorni fuori dalla mappatura rimangono intatti.

### Scrittura e annullamento

`prepareImport` prepara un candidato completo senza mutare lo stato corrente:
sorgente, giornate, storico, spesa e dati per l'annullamento. Il repository
scrive questo candidato in una sola transazione. La UI lo adotta solo dopo
il completamento e rende disponibile **Annulla ultima importazione**.

L'annullamento sopravvive a riapertura e backup. Prima di applicarlo la UI
mostra i giorni coinvolti e spiega che anche eventuali modifiche successive
entro quei giorni saranno sostituite dalle copie precedenti. Le altre
giornate, le impostazioni e gli articoli manuali rimangono.

Le sole modifiche automatiche a intervallo e spunte vengono invertite quando
non sono state successivamente modificate. Lo storico marca l'importazione
come annullata e conserva la sorgente. Una nuova importazione effettiva
sostituisce la possibilità di annullare quella precedente.

## IndexedDB: transazioni e concorrenza

Il database usa la versione interna `1` e un object store `snapshots`.
La chiave `current` contiene `{ revision, state }`; `recovery` contiene lo stato
precedente a un ripristino, nello stesso involucro fisico. Il nome include il
percorso di base dell'app, così due repository GitHub Pages sullo stesso
dominio non usano accidentalmente lo stesso archivio.

È una scelta semplice per un archivio personale: salvare l'intero snapshot
consente di conservare insieme sorgenti, riferimenti e annullamento. Il costo
di clonazione e scrittura cresce con l'archivio; una futura separazione in
più store richiederebbe una migrazione esplicita e nuove verifiche di atomicità.

Le operazioni nel repository sono serializzate. Una scrittura richiede una
lettura precedente riuscita e confronta la revisione attesa con quella nel
database **nella stessa transazione di scrittura**. Se un'altra scheda ha
salvato nel frattempo, l'app segnala il conflitto e propone di rileggere:
non sovrascrive silenziosamente i dati dell'altra scheda.

Il successo di una singola richiesta `put()` non basta a confermare la
modifica. Il repository attende `IDBTransaction.complete`, che segnala il
commit riuscito dell'intera transazione. Riferimento:
[MDN — IDBTransaction: complete event](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event).

Le modifiche ai dati vengono costruite su copie. Durante il salvataggio la
pagina mantiene i dati precedenti e blocca ulteriori comandi di modifica.
L'eventuale navigazione tramite cronologia browser resta distinta dai dati:
un commit non riporta l'utente su un percorso precedente. I file in anteprima,
le modali e i messaggi sono transitori, fuori da `AppState`.

## Ripristino e copia di recupero

Il backup viene letto e controllato prima di aprire la transazione di scrittura.
L'anteprima e la conferma confrontano stato corrente e candidato, indicando
ciò che verrà sostituito. `save(candidate, { checkpoint: true })` copia il
precedente `current` in `recovery` e sostituisce `current` nella medesima
transazione. Un errore ripristina entrambe le chiavi alla condizione precedente.

La copia di recupero è scaricabile come backup completo e rimane disponibile
dopo la riapertura. Le normali modifiche la conservano; il ripristino successivo
la sostituisce. Svuotamento dell'archivio e ripristino della demo la rimuovono
insieme ai dati sostituiti, con indicazione nella conferma. Non si crea una
copia scaricabile quando non esisteva uno stato precedente salvato.

Il backup ordinario include l'annullamento dell'importazione, ma non annida
la copia fisica di recupero. I dettagli e gli esempi sono in
[EXPORT_FORMATS.md](EXPORT_FORMATS.md).

## Errori e disponibilità

| Condizione | Risposta dell'app |
| --- | --- |
| IndexedDB assente o accesso negato | Messaggio esplicito; nessuna finta conferma di salvataggio. |
| Apertura bloccata da un'altra scheda | Messaggio con riprova; le connessioni tardive abbandonate vengono chiuse. |
| Versione del database cambiata o connessione chiusa | Connessione invalidata e ricaricamento esplicito dell'archivio. |
| Errore di lettura o stato non interpretabile | Ultimo stato leggibile preservato; nessun reset automatico. |
| Quota insufficiente, richiesta fallita o transazione abortita | Candidato non applicato; messaggio e riprova. |
| Revisione cambiata in un'altra scheda | Conflitto esplicito e rilettura prima di altre modifiche. |

In errore l'app conserva l'ultimo snapshot leggibile, consente navigazione e
download disponibili e disabilita le modifiche persistenti. **Riprova** riapre
e rilegge l'archivio; non reinvia automaticamente una vecchia importazione o
una sostituzione. Le conferme della data vengono rinnovate sulla situazione
appena letta. Se non è stato possibile leggere dati, l'app non propone un
backup vuoto come se fosse il backup dell'archivio esistente.

Lo storage locale appartiene al browser e all'origine/percorso dell'app.
Cambiare browser, dispositivo o indirizzo richiede importazione del backup.
La cancellazione dei dati del sito e le politiche di quota/rimozione del
browser possono eliminare l'archivio; questa fase non richiede automaticamente
il permesso di storage persistente. Riferimento:
[MDN — Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

Le versioni del database, dello stato, del backup e del `.diet` sono distinte.
I nuovi campi facoltativi rimangono nel contratto v1; una versione sconosciuta
viene rifiutata, senza cancellazioni o migrazioni implicite.

## Verifiche tecniche

Comandi riproducibili da una copia del progetto:

```bash
npm ci
npm run check
npm test
npm run build
```

Le cinque suite comprendono 51 casi tecnici, di cui 31 aggiunti nella fase 4.
La verifica finale di sintassi ha controllato 28 moduli JavaScript e 11
documenti JSON/`.diet`; tutti i riferimenti locali richiesti risultano presenti.
Sono stati inoltre verificati 68 rendering statici e 369 chiavi corrispondenti
nei dizionari italiano e inglese.

L'unica dipendenza aggiunta è `fake-indexeddb@6.2.5`, esclusivamente nei test.
Il lockfile fissa le dipendenze; sviluppo e build restano script Node senza
bundler. Nessuno dei test esprime un giudizio nutrizionale.

| Gruppo | Copertura |
| --- | --- |
| Fondamenta e sessione UI già esistenti | Date civili, isolamento dei documenti, quantità, riferimenti, localizzazione e interazioni del modello. |
| `import-export.test.mjs` | Conferme, intervalli, sovrapposizioni, duplicati, revisioni, annullamento, export effettivo, metadati ed errori tecnici dei backup. |
| `persistence.test.mjs` | Riapertura, isolamento, attesa del commit, quota/errori, rollback, conflitti, blocchi e versioni della connessione. |
| `workflows.test.mjs` | Quattro flussi fra dati e persistenza: riapertura, annullamento, backup/ripristino e fallimento senza perdita dello stato. |
| Rendering statico IT/EN | Viste e conferme nei diversi stati, parità dei dizionari, identificatori, etichette e riferimenti ARIA. |

Il caso di rollback comprende l'abort **dopo** il successo delle richieste di
scrittura di `current` e `recovery`: entrambe devono rimanere inalterate.
I workflow verificano inoltre che un duplicato non crei sorgenti o storico e
che un annullamento dopo riapertura conservi le modifiche estranee alle date
interessate. Gli esempi delle fasi precedenti rimangono tecnicamente leggibili.

Le verifiche IndexedDB sono state eseguite in Node con simulazione dell'API.
Non sono una certificazione di comportamento nei singoli browser. In questa
sessione non è stata eseguita una prova interattiva o visiva in un browser reale:
la skill Sites richiede il controllo browser dedicato, non disponibile
nell'ambiente corrente. Non sono state avviate alternative di automazione.

La verifica in browser resta da eseguire sui dispositivi di destinazione,
in particolare per selettori di file e download, focus delle modali, riapertura
reale del sito e messaggi generati dal browser in condizioni di storage limitato.
Installazione, cache e prova offline appartengono alla fase PWA successiva.
