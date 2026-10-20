# Stato applicativo e backup — versione 1

Lo stato conserva tre livelli distinti: il **documento `.diet` originale**, le sue **presenze nel calendario** e lo **stato dell'app**. Questa separazione permette di cambiare date, orari e quantità da preparare mantenendo disponibili i valori originali per una persona. Dalla fase 4 lo stato viene conservato in IndexedDB.

I contratti documentali sono [app-state.schema.json](../schemas/app-state.schema.json) e [backup.schema.json](../schemas/backup.schema.json). La struttura dei piani incorporati è descritta in [DIET_FORMAT.md](DIET_FORMAT.md).

## Stato iniziale

Questo è un esempio completo di stato vuoto, con istanti fittizi:

```json
{
  "format": "meal-planner.state",
  "schemaVersion": 1,
  "settings": {
    "uiLanguage": "it",
    "reducedMotion": false,
    "weekStartsOn": 1
  },
  "sourcePlans": {},
  "calendar": {},
  "imports": [],
  "shopping": {
    "mode": "one",
    "range": { "startDate": null, "endDate": null },
    "checked": {},
    "manualItems": []
  },
  "ui": { "view": "today", "selectedDate": null },
  "meta": {
    "createdAt": "2026-10-19T14:30:00Z",
    "updatedAt": "2026-10-19T14:30:00Z"
  }
}
```

| Campo | Tipo | Significato |
| --- | --- | --- |
| `format` | costante | `meal-planner.state`. |
| `schemaVersion` | costante numerica | `1`. |
| `settings` | oggetto | Preferenze dell'app. |
| `sourcePlans` | mappa per `sourceId` | Copie complete dei documenti importati. |
| `calendar` | mappa per data assegnata | Giorni effettivi e riferimenti ai pasti. |
| `imports` | array | Traccia delle importazioni e della mappatura iniziale delle date. |
| `lastImportUndo` | oggetto facoltativo oppure `null` | Dati per annullare l'ultima importazione; aggiunta compatibile della fase 4. |
| `shopping` | oggetto | Modalità, intervallo, spunte e articoli manuali. |
| `ui` | oggetto | Vista e data selezionata. |
| `meta` | oggetto | Istanti di creazione e aggiornamento dello stato. |

Gli oggetti sono estensibili. La garanzia di conservazione dei campi sconosciuti riguarda `AppState` e i documenti sorgente incorporati: tali campi devono restare nelle copie, nella serializzazione e nello stato contenuto nel backup, anche quando l'interfaccia corrente non li usa. L'involucro esterno del backup viene invece rigenerato a ogni esportazione; le sue eventuali proprietà aggiuntive non hanno una garanzia di conservazione dopo lettura e nuova esportazione.

### Impostazioni, interfaccia e metadati

| Campo | Tipo | Valore iniziale o comportamento |
| --- | --- | --- |
| `settings.uiLanguage` | `it` oppure `en` | `it`; non modifica la lingua dei piani importati. |
| `settings.reducedMotion` | booleano | `false`; conserva la preferenza sulle animazioni. |
| `settings.weekStartsOn` | `0` oppure `1` | `1`, lunedì. `0` indica domenica. |
| `ui.view` | stringa | `today`. |
| `ui.selectedDate` | `YYYY-MM-DD` oppure `null` | Ultima data selezionata nel Calendario; `null` prima della prima visita. Oggi usa la data locale corrente e conserva questa selezione. |
| `meta.createdAt` | data e ora con offset | Creazione dello stato. |
| `meta.updatedAt` | data e ora con offset | Ultimo aggiornamento dello stato. |

I valori `default` presenti nello schema sono annotazioni documentali. La creazione dello stato applica esplicitamente i valori iniziali: lo schema non inserisce dati a runtime.

## Piani originali e identità delle importazioni

Ogni `sourcePlans[sourceId]` contiene:

| Campo | Tipo | Significato |
| --- | --- | --- |
| `sourceId` | stringa | ID dell'istantanea importata; coincide con la chiave della mappa. |
| `document` | documento `.diet` | Copia completa del contenuto originale, comprese preferenze ed estensioni. |
| `importedAt` | data e ora con offset | Istante dell'importazione. |
| `fileName` | stringa facoltativa | Nome del file usato nell'importazione. |

`planId` appartiene al documento prodotto nella chat. `sourceId` appartiene all'app
ed è distinto per ogni istantanea di contenuto. Due revisioni con lo stesso
`planId` vengono conservate senza sovrascrivere il primo documento. Assegnare
nuovamente lo stesso contenuto a date diverse riusa invece il `sourceId`.

Il riconoscimento confronta tutti i valori JSON, comprese le estensioni,
ignorando spazi, ordine delle chiavi degli oggetti e nome del file. L'ordine
degli array resta significativo. Un file identico è un'operazione senza effetti
quando i pasti presenti nelle date mappate corrispondono esattamente alla sua
assegnazione: non crea sorgenti, importazioni o un nuovo annullamento e conserva
orari e persone modificati. Un'ulteriore assegnazione richiede una conferma
esplicita e un nuovo record di importazione.

I documenti vengono clonati e congelati ricorsivamente negli snapshot
applicativi. Cambiare data, ora o persone di una presenza non modifica
l'originale. Le letture del repository restituiscono copie isolate; le scritture
copiano il candidato prima di salvarlo. Questo evita modifiche involontarie
attraverso riferimenti condivisi.

## Calendario: date e orari effettivi

Ogni `calendar[assignedDate]` contiene:

| Campo | Tipo | Significato |
| --- | --- | --- |
| `date` | `YYYY-MM-DD` | Data effettiva; coincide con la chiave della mappa. |
| `meals` | array | Presenze dei pasti in quel giorno. |

Ogni presenza contiene:

| Campo | Tipo | Significato |
| --- | --- | --- |
| `entryId` | stringa | Identità unica della presenza nel calendario. |
| `sourceId` | stringa | Istantanea importata da cui proviene il pasto. |
| `sourceDate` | `YYYY-MM-DD` | Data del giorno nel documento originale. |
| `mealId` | stringa | ID del pasto originale da risolvere entro quella sorgente e quel giorno. |
| `cookingServings` | numero | Moltiplicatore usato per la spesa in modalità `advanced`; inizialmente `1`. |
| `timeOverride` | `HH:mm` oppure `null` | Orario modificato, oppure `null` per usare `meal.time` originale. |
| `assignmentId` | stringa facoltativa | Identità stabile dell'assegnazione iniziale; nelle nuove importazioni coincide con `importId`. Mantiene distinti i gruppi di preparazione anche dopo uno spostamento. |

La chiave del calendario controlla la data effettiva. La coppia `sourceDate`/`mealId` conserva il riferimento al pasto originale. L'orario effettivo è `timeOverride` quando presente; altrimenti è `time` nel documento sorgente.

La fase 5 sposta la stessa presenza fra due giornate conservando `entryId`,
riferimenti, `assignmentId`, orario, persone ed eventuali estensioni. I pasti
della destinazione restano presenti, ordinati per ora effettiva. Il giorno di
origine può restare vuoto, conservando i propri metadati; è ancora selezionabile.

Nei vecchi stati v1 privi di `assignmentId`, la provenienza viene dedotta dallo
storico disponibile, con un identificativo di compatibilità quando non esiste
uno storico utilizzabile. Il primo spostamento la fissa prima di cambiare data.
La sorgente rimane immutata. Per il flusso UI vedere
[PHASE_5_CALENDAR.md](PHASE_5_CALENDAR.md).

### Esempio di assegnazione

Il file dimostrativo propone il 21 ottobre 2026. L'utente sceglie di iniziare il 26 ottobre:

| Data nel documento | Data assegnata | Giorni di spostamento |
| --- | --- | --- |
| `2026-10-21` | `2026-10-26` | +5 |
| `2026-10-22` | `2026-10-27` | +5 |
| `2026-10-23` | `2026-10-28` | +5 |

Per assegnare un piano completo, la data scelta corrisponde al primo giorno del documento e si conservano le distanze fra le date originali, inclusi eventuali intervalli. `suggestedStartDate` fornisce il valore proposto all'utente. Non si convertono queste date civili tramite il fuso orario.

La presenza della cena del primo giorno può essere rappresentata da questo frammento di `calendar`:

```json
{
  "2026-10-26": {
    "date": "2026-10-26",
    "meals": [
      {
        "entryId": "entry-01-dinner",
        "sourceId": "source-it-01",
        "sourceDate": "2026-10-21",
        "mealId": "day-01-dinner",
        "cookingServings": 2,
        "timeOverride": "20:30"
      }
    ]
  }
}
```

Questo frammento presume che `sourcePlans["source-it-01"]` contenga l'esempio italiano. Il pasto originale resta alle `20:00` del `2026-10-21`; la presenza effettiva è alle `20:30` del `2026-10-26`. Gli ingredienti e i valori nutrizionali della sorgente restano per una persona.

L'importazione interattiva richiede la conferma della data, mostra l'intervallo
risultante e le date che contengono già pasti. La conferma della sovrapposizione
autorizza la sostituzione **completa dei soli giorni mappati**. I giorni non
presenti nel piano, anche se interni all'intervallo, rimangono invariati.
Lo storico conserva la mappatura iniziale; il calendario rappresenta le
successive modifiche. Tutta l'operazione viene salvata in una sola transazione.

### Traccia delle importazioni

| Campo di `imports[]` | Tipo | Significato |
| --- | --- | --- |
| `importId` | stringa | ID dell'operazione di importazione. |
| `sourceId` | stringa | Istantanea associata. |
| `importedAt` | data e ora con offset | Istante dell'operazione. |
| `startDate` | `YYYY-MM-DD` | Data di partenza scelta. |
| `dayMappings` | array | Mappatura iniziale dei giorni. |
| `dayMappings[].sourceDate` | `YYYY-MM-DD` | Data nel documento. |
| `dayMappings[].assignedDate` | `YYYY-MM-DD` | Data assegnata nell'importazione. |
| `endDate` | data facoltativa | Ultima data assegnata. |
| `fileName` | stringa facoltativa | Nome del file per questa specifica operazione. |
| `status` | `applied` oppure `undone`, facoltativo | Stato dell'operazione; assente nei backup precedenti. |
| `undoneAt` | timestamp facoltativo | Presente quando l'importazione è stata annullata. |
| `duplicate` | booleano facoltativo | Il contenuto era già presente fra le sorgenti. |
| `revision` | booleano facoltativo | Contenuto diverso con un `planId` già presente. |
| `overwrittenDates` | array facoltativo di date | Date che contenevano già pasti prima dell'importazione. |

Esempio del record associato alla tabella precedente:

```json
{
  "importId": "import-it-01",
  "sourceId": "source-it-01",
  "importedAt": "2026-10-19T14:35:00Z",
  "startDate": "2026-10-26",
  "dayMappings": [
    { "sourceDate": "2026-10-21", "assignedDate": "2026-10-26" },
    { "sourceDate": "2026-10-22", "assignedDate": "2026-10-27" },
    { "sourceDate": "2026-10-23", "assignedDate": "2026-10-28" }
  ]
}
```

### Annullamento dell'ultima importazione

`lastImportUndo` è facoltativo per mantenere compatibili i backup v1 precedenti.
Una nuova importazione effettiva lo sostituisce; una reimportazione senza effetti
lo lascia intatto. Il valore viene conservato in IndexedDB e nei backup.

| Campo | Significato |
| --- | --- |
| `importId` | Record dell'ultima importazione effettiva. |
| `beforeDays` | Mappa delle sole date toccate: giorno precedente completo, oppure `null` se assente. |
| `entryIds` | Array facoltativo degli ID delle presenze create dall'importazione. Dalla fase 5 consente di ritrovarle anche dopo lo spostamento in altre date. |
| `shopping.range.before` / `after` | Intervallo della spesa prima e dopo l'importazione. |
| `shopping.checked[key].before` / `after` | Stato precedente e successivo delle sole spunte modificate dall'importazione; `null` significa voce assente. |

La conferma di annullamento mostra le date coinvolte. Il ripristino sostituisce
quelle giornate con le copie precedenti, comprese le loro persone e gli orari;
elimina le date che prima non esistevano. Eventuali modifiche successive
**all'interno di quelle giornate** vengono quindi sostituite, come indicato
nella conferma. Le impostazioni e gli articoli manuali restano.

Se un pasto di quell'importazione è stato spostato fuori dalle date iniziali,
l'annullamento rimuove soltanto quella presenza dalla destinazione. Gli altri
pasti e i metadati della giornata restano. La conferma distingue le giornate
da ripristinare integralmente dalle date aggiuntive in cui rimuovere i soli
pasti importati. Il primo spostamento su un vecchio backup v1 prepara gli
`entryIds` mancanti prima di cambiare le appartenenze alle giornate.

Le modifiche automatiche a intervallo e spunte vengono invertite soltanto se
il valore corrente coincide ancora con quello lasciato dall'importazione.
Successive modifiche esplicite a questi controlli vengono conservate. La spesa
viene poi riconciliata con il fabbisogno risultante.

La sorgente originale e il record storico non vengono eliminati: il record
riceve `status: "undone"` e `undoneAt`; `lastImportUndo` diventa `null`.
Non è una cronologia infinita di annullamenti. Un eventuale conflitto tecnico
tra identità delle presenze impedisce la scrittura, lasciando intatto lo stato.

## Quantità: una persona, due persone e modalità avanzata

Sia `q` la quantità di un ingrediente nella porzione originale, già espressa nell'unità finale dopo le eventuali conversioni, e sia `s` il valore `cookingServings` della sua presenza nel calendario. La quantità richiesta dalla lista è:

| Modalità della spesa | Moltiplicatore | Quantità del singolo ingrediente | Valori nutrizionali visualizzati per persona |
| --- | --- | --- | --- |
| `one` | `1` per tutti i pasti | `q` | Valori originali. |
| `two` | `2` per tutti i pasti | `q × 2` | Valori originali. |
| `advanced` | `s` per ciascun pasto | `q × s` | Valori originali. |

La quantità aggregata è la somma delle quantità moltiplicate dei pasti compresi nell'intervallo selezionato. Il raggruppamento usa `ingredientId`, unità canonica e `basis`. Le regole di conversione sono descritte in [DIET_FORMAT.md](DIET_FORMAT.md).

Per esempio, un ingrediente da 80 g produce 80 g in `one`, 160 g in `two` e 240 g in `advanced` quando `cookingServings` è `3`. Cambiare modalità non riscrive `quantity` nella sorgente e non trasforma un apporto nutrizionale personale in quello di due o tre persone. I valori avanzati possono essere conservati anche mentre è selezionata una modalità diversa.

La lista somma le porzioni **consumate nei pasti selezionati**, comprese quelle indicate come `leftover`. `preparedServings` è informativo; `batchId` non introduce deduplicazione degli ingredienti. La lista non registra automaticamente ciò che è già stato cucinato, acquistato o conservato in dispensa.

### Stato della spesa

| Campo | Tipo | Significato |
| --- | --- | --- |
| `shopping.mode` | `one`, `two`, `advanced` | Modalità attiva; valore iniziale `one`. |
| `shopping.range.startDate` | data oppure `null` | Primo giorno dell'intervallo, incluso. |
| `shopping.range.endDate` | data oppure `null` | Ultimo giorno dell'intervallo, incluso. |
| `shopping.checked` | mappa | Stato delle spunte per chiave di aggregazione. |
| `shopping.manualItems` | array | Articoli aggiunti manualmente. |

Una voce di `shopping.checked` contiene:

| Campo | Tipo | Significato |
| --- | --- | --- |
| `checked` | booleano | Stato della spunta. |
| `quantity` | numero | Quantità alla quale si riferiva la spunta. |
| `unit` | stringa | Unità relativa alla quantità registrata. |
| `updatedAt` | data e ora con offset | Ultimo aggiornamento della voce. |
| `reopened` | booleano facoltativo | Un ricalcolo ha riaperto la voce per aumento del fabbisogno; aggiunta compatibile v1 della fase 6. |

La chiave è prodotta dalla regola di aggregazione e va trattata come un
identificatore opaco. Quando il fabbisogno cresce oltre la quantità spuntata,
la riga viene riaperta e la nuova condizione salvata con `reopened: true`.
La quantità registrata resta quella dell'ultima azione esplicita sulla spunta:
permette di mostrare il precedente acquisto e il nuovo totale richiesto.
Il confronto tollera soltanto pochi errori relativi di rappresentazione
floating point; non usa una soglia alimentare o un arrotondamento di acquisto.

Ridurre il fabbisogno può mantenere una spunta già attiva, ma non rispunta
automaticamente una riga riaperta. Il marker interno può rimanere dopo una
diminuzione; il badge appare solo quando la quantità attuale supera quella
registrata. Un gesto esplicito sulla spunta aggiorna quantità/unità e cancella
il marker. Se una voce scompare dalla lista o l'unità diventa incomparabile,
rimane nello storico senza spunta né marker; se ricompare, è da acquistare.

Un cambiamento effettivo delle date del periodo riapre le sole voci
automatiche, preservando quelle manuali e le loro spunte. Reinserire le stesse
date non azzera nulla. Cambiare modalità conserva le persone dei pasti e usa
il confronto delle quantità. Questa politica è indicata sotto il selettore
del periodo. La riconciliazione opera anche dopo importazione, annullamento,
spostamento di pasti e modifica delle persone.

`getShoppingList` deriva una vista senza modificare lo stato. Anche un vecchio
backup con una quantità spuntata insufficiente viene mostrato con la riga
aperta; le successive operazioni che ricalcolano la spesa usano la stessa regola. Il backup
conserva i record originari e tutti gli aggiornamenti salvati.

Una voce di `shopping.manualItems` contiene:

| Campo | Tipo | Obbligatorio | Significato |
| --- | --- | --- | --- |
| `itemId` | stringa | Sì | ID dell'articolo manuale. |
| `name` | stringa | Sì | Testo inserito dall'utente. |
| `quantity` | numero | No | Quantità inserita. |
| `unit` | stringa | No | Unità inserita. |
| `category` | stringa | No | Categoria inserita. |
| `checked` | booleano | Sì | Stato della spunta. |

Gli articoli manuali conservano la propria identità e quantità assolute.
Non vengono associati a un ingrediente del piano soltanto perché hanno un
nome simile, né moltiplicati quando cambia modalità o numero di persone.
Quantità/unità restano facoltative nel contratto di lettura per i vecchi backup;
il form e l'API di aggiunta della fase 6 richiedono una quantità finita positiva.
Il form richiede anche un'unità e permette di specificarne una personalizzata.
Le voci precedenti senza quantità restano visibili, con indicazione esplicita
del dato mancante. Si possono spuntare o rimuovere.

La copia e il download `.txt` sono viste della lista corrente, con categorie,
quantità localizzate e spunte. Le voci manuali formano una sezione distinta.
Non sono un nuovo formato di backup importabile. Vedere
[PHASE_6_SHOPPING.md](PHASE_6_SHOPPING.md).

## Backup completo

Un esempio completo, con documenti sorgente, calendario, spesa e annullamento,
è disponibile in [full-backup-with-undo.json](../examples/phase-4/full-backup-with-undo.json).
Il precedente [example-backup.json](../examples/example-backup.json) resta
compatibile pur non contenendo i campi facoltativi della fase 4.

| Campo | Tipo | Significato |
| --- | --- | --- |
| `format` | stringa costante | `meal-planner.backup`. |
| `schemaVersion` | numero costante | `1`. |
| `exportedAt` | data e ora con offset | Istante della creazione del backup. |
| `state` | oggetto `AppState` | Stato completo incorporato. |

Il backup incorpora i documenti sorgente originali, le date assegnate, i
riferimenti ai pasti, gli orari modificati, `cookingServings`, lo storico delle
importazioni, l'eventuale `lastImportUndo`, la modalità e l'intervallo della
spesa, le spunte, gli articoli manuali, le impostazioni UI e i metadati. Le
preferenze del piano sono conservate nei documenti sorgente, senza riferimenti
a file esterni necessari al ripristino.

La lettura restituisce lo stato incorporato, comprese le sue estensioni. Una successiva esportazione crea un nuovo involucro con `format`, `schemaVersion`, `exportedAt` e `state`. Eventuali campi aggiuntivi del precedente involucro esterno possono quindi non ricomparire: la garanzia di conservazione riguarda il contenuto di `state` e i suoi documenti sorgente.

Gli schemi rimangono documentali. Il lettore verifica involucri, versioni,
strutture JSON, date, identità e riferimenti fra sorgenti, calendario, storico
e annullamento, oltre ai tipi necessari a impostazioni e spesa. Non esegue
controlli di validità nutrizionale o delle ricette. Backup e stato hanno una
propria versione: una versione sconosciuta viene rifiutata, senza modificarne
il numero o tentare una migrazione implicita. Dalla fase 7 il caricamento locale
e la lettura del backup usano la stessa pipeline di compatibilità descritta
di seguito; nello stato v1 non viene eseguita alcuna trasformazione.

### Ripristino atomico e recupero

La lettura prepara uno stato candidato senza alterare quello corrente.
L'interfaccia confronta numero di sorgenti, giornate, pasti, importazioni,
spunte e articoli manuali. La conferma chiarisce che vengono sostituiti anche
impostazioni e persone per pasto.

Una sola transazione IndexedDB conserva lo stato precedente nella chiave
`recovery` e scrive il candidato in `current`. Soltanto il completamento
riuscito della transazione cambia lo stato visibile. Se lettura, verifica
tecnica o scrittura falliscono, lo stato corrente resta intatto; una
transazione abortita conserva anche l'eventuale copia di recupero precedente.

Il comando **Scarica la copia precedente** esporta lo stato pre-ripristino
nel contenitore backup v1, conservandone la versione originale. Uno stato v1
rimane importabile dall'app attuale; una futura versione dello stato richiederà
un'app compatibile. Il download non migra la copia. Un successivo ripristino
sostituisce questa singola copia; le normali modifiche non la cancellano. Se prima del
primo ripristino non esisteva un archivio salvato, non c'è uno stato precedente
da scaricare. Le azioni esplicite di svuotamento e ripristino della demo
eliminano anche la copia di recupero, come indicato nella conferma.

La revisione interna del database e la copia `recovery` non sono campi di
`AppState` e non vengono annidate nel backup ordinario. La copia di recupero
ha un proprio download, evitando catene ricorsive di backup.

## Esportazione `.diet` e backup: contenuti diversi

| Informazione | `.diet` esportato dal calendario | Backup completo |
| --- | --- | --- |
| Pasti e ingredienti per persona | Sì. | Sì, nei documenti sorgente. |
| Date assegnate | Materializzate in `days[].date`. | Conservate nel calendario insieme alle date originali. |
| Orari modificati | Materializzati in `meals[].time`. | Conservati come override. |
| Identità dell'assegnazione e preparazioni | Gruppi di preparazione distinti e collegamenti conservati dopo gli spostamenti. | `assignmentId` conservato nelle presenze, quando disponibile. |
| `baseServings` | Sempre `1`. | I piani incorporati restano con `baseServings: 1`. |
| Moltiplicatori `cookingServings` e modalità spesa | Non trasformano le porzioni del `.diet`. | Conservati. |
| Spunte e articoli manuali | Non sono campi del piano base. | Conservati. |
| Originali e storico delle importazioni | Non costituisce un archivio completo dello stato. | Conservati. |

Nella versione 1, un file `.diet` ricavato dal calendario contiene i pasti selezionati di **una sola `sourcePlan`**, con date e orari effettivi e quantità per persona. Importarlo nuovamente riparte dai moltiplicatori iniziali di una persona; per trasferire anche le impostazioni delle porzioni si usa il backup completo. Una nuova esportazione non deve alterare in memoria i documenti originali.

Per garantire l'unicità delle occorrenze, la nuova copia esportata può ricevere un nuovo `planId` e nuovi `mealId`, mantenendo i campi di estensione della sorgente e dei pasti copiati. L'esportazione di più sorgenti o lingue insieme usa il backup completo: non vengono eseguite traduzioni o fusioni implicite di metadati. La regola evita conflitti fra preferenze, lingue ed estensioni dei piani originali.

## Persistenza IndexedDB — fase 4

Il repository in `src/persistence/indexeddb.js` usa il database
`meal-planner:<percorso-base-app>`, versione interna `1`, e l'object store
`snapshots`. IndexedDB separa già le origini; il percorso distingue inoltre
progetti GitHub Pages ospitati sotto lo stesso dominio.

Ogni record fisico contiene `{ revision, state }`. Una scrittura confronta
la revisione letta in precedenza e salva la nuova revisione nella stessa
transazione. Un'altra scheda che abbia nel frattempo scritto produce un
conflitto esplicito, senza sovrascrittura o fusione automatica. Il pulsante
di riprova rilegge l'archivio corrente.

`load()` deve riuscire prima di `save()`; le operazioni sono serializzate.
`save(state, { checkpoint: true })` crea la copia pre-ripristino atomicamente.
`loadRecovery()` legge tale copia senza alterare la revisione attesa per lo
stato corrente. Lo svuotamento tecnico mantiene una revisione incrementata
anche quando lo stato è assente, per riconoscere le scritture da vecchie schede.

L'app non passa silenziosamente a un archivio volatile quando IndexedDB
fallisce. Mostra l'errore, conserva l'ultimo stato leggibile, disabilita le
modifiche persistenti e offre la riprova e i download disponibili. Il modello
UI contiene inoltre dati transitori non inclusi nel backup: file in anteprima,
modali, messaggi, errori e campi ancora da confermare.

Il contratto asincrono della fase 1 rimane disponibile come adattatore in
memoria per gli esempi e i test precedenti; `src/main.js` usa esclusivamente
il repository IndexedDB. Per errori, transazioni e verifica consultare
[PHASE_4_STORAGE.md](PHASE_4_STORAGE.md).

### Adattatore in memoria delle fondamenta

| Elemento del contratto | Risultato | Comportamento |
| --- | --- | --- |
| `kind` | `memory` | Identifica l'adattatore della fase 1. |
| `await load()` | Copia dello stato oppure `null` | Legge una nuova istantanea indipendente. |
| `await save(state)` | Nessun valore | Copia il nuovo stato e sostituisce l'istantanea in memoria. |
| `await clear()` | Nessun valore | Svuota l'istantanea in memoria. |

La copia viene completata prima di sostituire lo stato in memoria, così un errore di copia conserva quello precedente. I documenti sorgente delle istantanee vengono anche congelati per impedire modifiche accidentali. Le operazioni si attendono con `await`; il completamento di `save` conferma la scrittura nell'adattatore corrente.

L'adattatore in memoria non conserva i dati dopo il ricaricamento della pagina
o la chiusura dell'app. Il frontend della fase 4 usa invece IndexedDB per
salvataggio e ripristino persistenti. Dalla fase 7 l'app usa anche una cache
separata per aprire l'interfaccia offline. Il worker non contiene o modifica
lo stato personale.

## Compatibilità dello stato e migrazioni — fase 7

La versione della distribuzione, quella fisica di IndexedDB e `schemaVersion`
dello stato sono distinte. L'app 1.0.0 conserva database e stato alla versione 1.
In `src/persistence/migrations.js`, `CURRENT_STATE_VERSION` vale `1` e
`STATE_MIGRATIONS` è vuoto: gli archivi v1 compatibili si aprono senza una
riscrittura, senza inserire campi predefiniti negli originali e senza sostituire
la copia di recupero.

`createStateMigrationPipeline()` definisce un percorso di trasformazioni
esplicite da una versione alla successiva. Verifica che tutti i passi necessari
esistano, opera su copie e controlla tecnicamente il risultato. Non interpreta
obiettivi, frequenze o contenuti nutrizionali. Una versione futura non supportata,
una trasformazione fallita o un percorso incompleto producono un errore.

`loadCompatibleState(repository)` legge lo stato e prepara il risultato. Quando
una futura migrazione registrata sarà necessaria, chiama
`save(candidate, { checkpoint: true })`: archivio precedente e candidato vengono
scritti nella stessa transazione. Restituisce il candidato soltanto dopo il
completamento. Un fallimento mantiene sia l'archivio corrente sia la precedente
copia di recupero. Una lettura compatibile non scrive nulla.

Il repository verifica nuovamente versione e revisione dentro la transazione
di scrittura. Impedisce downgrade e migrazioni senza checkpoint, anche quando
un'altra scheda ha modificato la versione senza aggiornare correttamente la
revisione. Gli aggiornamenti dei file dell'app non eseguono direttamente queste
operazioni: lo stato si apre attraverso il livello di persistenza.

Anche `readBackup()` usa la pipeline per preparare l'anteprima. Un'eventuale
trasformazione supportata avviene in memoria; non modifica IndexedDB prima
della conferma del ripristino. Il contenitore del backup ha una verifica di
versione distinta. Non si cambiano numeri di versione per forzare la lettura.

### Download originale in caso di incompatibilità

`readStoredBackup()` apre l'archivio in sola lettura, senza chiedere un upgrade
fisico e senza creare un database assente. Se store e record sono riconoscibili,
può estrarre lo stato originale anche quando la sua versione non è supportata
dall'app corrente. Il risultato è un contenitore backup v1 con lo stato e la
versione originali; non viene eseguita una migrazione.

Se la lettura ordinaria fallisce e questo recupero riesce, l'interfaccia offre
**Scarica archivio originale** anche senza piani caricati. Il download permette
di conservare una copia per un'app compatibile; non sblocca le modifiche e
non garantisce il recupero di uno storage inaccessibile o di una struttura
fisica sconosciuta. La stessa lettura conserva la versione del record `recovery`
nel comando **Scarica la copia precedente**.

### Continuità offline

Lingua, giorno selezionato, impostazioni, persone e configurazione della spesa
rimangono in `AppState` e vengono recuperati da IndexedDB. Stato della rete,
versione della cache, disponibilità di un aggiornamento e prompt di installazione
sono transitori e non fanno parte del backup. Manifest, moduli, traduzioni e
icone sono risorse pubbliche conservate in Cache Storage.

La richiesta di persistenza al browser è separata dal salvataggio. Una mancata
concessione non è un errore IndexedDB e non blocca le operazioni. Anche quando
è concessa, la protezione non impedisce la cancellazione esplicita dei dati
del sito: il backup scaricato rimane il mezzo di recupero indipendente.
Per installazione, aggiornamenti, limiti e fonti delle API consultare
[PHASE_7_PWA.md](PHASE_7_PWA.md).
