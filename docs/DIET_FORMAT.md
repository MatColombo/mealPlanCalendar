# Formato `.diet` — versione 1

Un file `.diet` è un documento JSON UTF-8 che descrive un piano alimentare. Contiene pasti, ingredienti e quantità **per una persona e una porzione consumata**, insieme alle date proposte da ChatGPT. Le date effettivamente assegnate nell'app e le quantità aggiuntive per la spesa appartengono allo stato applicativo.

Il contratto è descritto in [diet.schema.json](../schemas/diet.schema.json). Gli esempi completi sono [example-it.diet](../examples/example-it.diet) e [example-en.diet](../examples/example-en.diet). Sono dati fittizi, con giornate intenzionalmente parziali: illustrano il formato e non rappresentano proposte nutrizionali verificate.

## Contratto e controlli tecnici

Lo schema usa JSON Schema Draft 2020-12 ed è **documentale**. L'app non esegue un validatore JSON Schema e non controlla l'adeguatezza nutrizionale, la correttezza delle ricette o il rispetto dei target del piano. I tipi numerici e le unità descrivono il contratto tecnico dei dati.

Il lettore verifica l'involucro del documento: oggetto JSON, `format` riconosciuto,
`schemaVersion` supportata e `days` come array non vuoto. Il flusso di importazione
verifica inoltre i campi necessari alla visualizzazione, gli identificativi,
le date ordinate e distinte, gli orari e la rappresentazione numerica delle
quantità. Il backup controlla anche l'integrità dei riferimenti fra sorgenti e
calendario. Sono controlli tecnici per leggere e conservare i dati, senza
giudicare alimenti, obiettivi, valori nutrizionali, bilanciamento o ricette.

La generazione di **3–10 giorni** è una convenzione del flusso conversazionale. Il formato e l'esportazione possono rappresentare qualsiasi sequenza non vuota di giorni, inclusa una selezione di un solo giorno o un calendario più lungo.

## Versione ed estensioni

L'involucro riconosciuto è:

```json
{
  "format": "meal-planner.diet",
  "schemaVersion": 1
}
```

Questo frammento mostra soltanto l'involucro, non un piano completo. La versione `1` è l'unica supportata. Un formato o una versione sconosciuti vengono rifiutati dal lettore; non si tenta una migrazione implicita.

Gli oggetti del contratto ammettono proprietà aggiuntive. L'app conserva i campi sconosciuti nel documento importato e nel backup: non ricostruisce il piano usando soltanto una lista di campi conosciuti. Eventuali migrazioni future devono essere esplicite. Gli identificatori `$id` degli schemi sono nomi documentali sotto un dominio `.invalid`; non richiedono accesso a un servizio remoto.

## Documento principale

| Campo | Tipo | Obbligatorio | Significato |
| --- | --- | --- | --- |
| `format` | stringa costante | Sì | `meal-planner.diet`. |
| `schemaVersion` | numero costante | Sì | `1`. |
| `planId` | stringa | Sì | Identità del piano logico. Una revisione può conservare lo stesso ID. |
| `title` | stringa | Sì | Titolo nella lingua del piano. |
| `language` | stringa | Sì | Tag BCP-47 della lingua scelta per i contenuti, per esempio `it`, `en` o `it-IT`. Non è un enum limitato alle lingue UI. |
| `createdAt` | data e ora ISO con offset | Sì | Istante di creazione, per esempio `2026-10-19T14:30:00Z`. |
| `suggestedStartDate` | `YYYY-MM-DD` | Sì | Data proposta per l'inizio, da confermare o cambiare nell'importazione. |
| `baseServings` | numero costante | Sì | Sempre `1`. |
| `notes` | stringa | No | Note del piano. |
| `preferences` | oggetto | No | Preferenze e obiettivi dichiarati nella chat. |
| `days` | array non vuoto | Sì | Giorni del piano, nell'ordine di utilizzo. |

Le date di calendario sono date civili, senza conversioni automatiche di fuso orario. Un `2026-10-21` resta il 21 ottobre. Gli istanti come `createdAt` o `importedAt` includono invece l'offset o `Z`.

### Giorni

| Campo | Tipo | Obbligatorio | Significato |
| --- | --- | --- | --- |
| `days[].date` | `YYYY-MM-DD` | Sì | Data originaria del giorno nel piano. |
| `days[].meals` | array di pasti | Sì | Pasti previsti per quel giorno. |

Il generatore produce date ordinate e distinte per rendere univoche le associazioni al calendario. Lo schema non richiede un numero minimo di pasti giornalieri né verifica la completezza della giornata. Non impone una lunghezza massima a `days`.

### Pasti

| Campo | Tipo | Obbligatorio | Significato |
| --- | --- | --- | --- |
| `mealId` | stringa | Sì | ID stabile e distinto del pasto nel piano. Una modifica del pasto può conservarlo. |
| `type` | stringa aperta | Sì | Codice del tipo di pasto; convenzioni: `breakfast`, `lunch`, `dinner`, `snack`. |
| `title` | stringa | Sì | Nome del pasto nella lingua del piano. |
| `time` | `HH:mm` | Sì | Ora civile proposta, per esempio `13:00`. |
| `ingredients` | array | Sì | Ingredienti necessari alla singola porzione consumata. |
| `nutrition` | oggetto | No | Valori nutrizionali disponibili per una persona. |
| `instructions` | array di stringhe | No | Passaggi della preparazione. |
| `prepMinutes` | numero | No | Tempo di preparazione indicato nel piano. |
| `tags` | array di stringhe | No | Codici stabili usati per descrivere o raggruppare pasti. |
| `preparation` | oggetto | No | Collegamento informativo fra preparazione anticipata e pasti con avanzi. |
| `notes` | stringa | No | Note del singolo pasto. |

`mealId` identifica il pasto nel documento. `entryId`, descritto nello [stato applicativo](STATE_AND_BACKUP.md), identifica una sua specifica presenza nel calendario. Ripetere o spostare un pasto non modifica il documento originale.

### Ingredienti

| Campo | Tipo | Obbligatorio | Significato |
| --- | --- | --- | --- |
| `ingredientId` | stringa | Sì | ID stabile in inglese, indipendente dal nome tradotto; per esempio `chicken-breast`. |
| `name` | stringa | Sì | Nome visualizzato nella lingua del piano. |
| `quantity` | numero | Sì | Quantità necessaria alla porzione di una persona. |
| `unit` | stringa aperta | Sì | Convenzioni: `g`, `kg`, `ml`, `l`, `unit`. |
| `category` | stringa aperta | No | Convenzioni: `produce`, `grains`, `protein`, `dairy`, `pantry`, `other`. |
| `basis` | stringa aperta | No | Base della quantità: `raw`, `cooked`, `drained`, `dry`, `as_sold`, o altro codice esplicito. |
| `unitConversion` | oggetto | No | Conversione esplicita di questa sola voce per il calcolo della spesa; disponibile dalla fase 6. |

Le varianti rilevanti hanno ID diversi: `milk` e `lactose-free-milk`, per esempio, non vengono unite automaticamente. Le traduzioni di uno stesso ingrediente possono conservare lo stesso ID. Il nome, la categoria e una somiglianza testuale non bastano a identificare ingredienti equivalenti.

La chiave della spesa combina **`ingredientId` + unità canonica + `basis` esatta**. Senza dichiarazioni aggiuntive, le conversioni automatiche sono soltanto queste:

| Quantità originaria | Quantità canonica | Conseguenza |
| --- | --- | --- |
| `0.2 kg` | `200 g` | Si può sommare a un'altra quantità in grammi dello stesso ID e della stessa base. |
| `0.5 l` | `500 ml` | Si può sommare a un'altra quantità in millilitri dello stesso ID e della stessa base. |
| `2 unit` | `2 unit` | Rimane un conteggio; non diventa un peso. |
| `1 bunch` | `1 bunch` | L'unità sconosciuta viene conservata e resta distinta dalle altre unità. |

L'app non deduce equivalenze fra peso e volume o fra pezzi e peso. Una relazione
di questo tipo viene applicata soltanto alla voce che contiene `unitConversion`,
descritta qui sotto. Non vengono convertite basi di misurazione: `basis`
assente resta distinto da `raw`, `cooked` e dalle altre basi note. Quindi `80 g`
di riso `dry` e `80 g` di riso `cooked` producono righe separate.

Le unità metriche riconosciute vengono normalizzate anche in presenza di maiuscole o spazi esterni, per esempio ` KG ` diventa `g` dopo la conversione. Le altre stringhe di unità rimangono esattamente come ricevute. Il nome, la categoria e gli eventuali metadati della riga aggregata provengono dalla prima voce corrispondente, con l'eccezione del campo operativo `unitConversion` già applicato; tutte le voci originali rimangono nei documenti sorgente.

#### Conversione dichiarata per una voce

`unitConversion` è un'aggiunta facoltativa al contratto v1. Non modifica
`quantity`, `unit` o `basis` nel piano originale.

| Campo | Tipo | Significato |
| --- | --- | --- |
| `toUnit` | stringa non vuota | Unità nella quale esprimere la quantità per l'aggregazione. |
| `factor` | numero finito positivo | Una unità originale equivale a questo numero di unità di destinazione. |

Esempio di struttura, con equivalenza fittizia dichiarata dal piano:

```json
{
  "ingredientId": "tomato",
  "name": "Pomodoro",
  "quantity": 2,
  "unit": "unit",
  "basis": "raw",
  "category": "produce",
  "unitConversion": { "toUnit": "g", "factor": 50 }
}
```

In modalità `one` questa voce contribuisce 100 g alla spesa; in modalità `two`
200 g. La base di misura resta `raw`. Una diversa voce `tomato` da `1 unit`
senza conversione resta un conteggio separato: l'equivalenza non si propaga in
base al solo ID. Un'altra voce da 100 g `raw` può invece essere sommata al peso
convertito. Le quantità nel dettaglio del pasto continuano a usare le unità
originali, scalate per le persone per cui cucinare.

Il fattore viene applicato una volta, prima della normalizzazione kg/g o l/ml
dell'unità di destinazione. Non esistono catene, tabelle globali, equivalenze
dedotte o trasformazioni crudo/cotto. L'app verifica soltanto che la
dichiarazione sia tecnicamente leggibile e che i calcoli abbiano un risultato
finito; non giudica la plausibilità dell'equivalenza.

Il documento originale, il `.diet` esportato e il backup conservano la
dichiarazione. La riga derivata della spesa non conserva il campo già applicato,
evitando una seconda moltiplicazione accidentale. Per il comportamento completo
della lista vedere [PHASE_6_SHOPPING.md](PHASE_6_SHOPPING.md).

### Dati nutrizionali disponibili

| Campo di `nutrition` | Tipo | Unità e significato |
| --- | --- | --- |
| `kcal` | numero oppure `null` | Energia della porzione di una persona. |
| `proteinG` | numero oppure `null` | Proteine in grammi. |
| `carbohydratesG` | numero oppure `null` | Carboidrati in grammi. |
| `fatG` | numero oppure `null` | Grassi in grammi. |
| `fiberG` | numero oppure `null` | Fibre in grammi. |
| `note` | stringa | Eventuali annotazioni sulla provenienza o natura dei valori. |

Tutti questi campi sono facoltativi. Un campo assente o `null` indica un dato non disponibile; `0` è un valore numerico esplicito. Se manca una metrica in almeno un pasto incluso in un totale, quella metrica totale è `null`, anziché una somma parziale presentata come completa. Le altre metriche possono essere sommate se disponibili in tutti i pasti interessati.

Il calcolo dei totali è aritmetico e mantiene i valori per persona. L'app non ricava valori mancanti dagli ingredienti e non controlla che calorie e macro siano tra loro coerenti.

## Preferenze: metadati della conversazione

| Campo | Tipo | Significato |
| --- | --- | --- |
| `preferences.maxKcalPerDay` | numero | Limite calorico giornaliero dichiarato. |
| `preferences.macros` | oggetto | Contiene gli eventuali intervalli di `protein`, `carbohydrates` e `fat`. |
| `preferences.macros.<macro>.min` | numero facoltativo | Estremo minimo giornaliero dichiarato. |
| `preferences.macros.<macro>.max` | numero facoltativo | Estremo massimo giornaliero dichiarato. |
| `preferences.macros.<macro>.unit` | stringa costante | `g`. |
| `preferences.ingredientFrequencyLimits` | array | Eventuali frequenze massime dichiarate. |
| `preferences.workSchedule` | stringa | Orari e organizzazione del lavoro descritti nella chat. |
| `preferences.leftovers.allowed` | booleano | Disponibilità a usare avanzi; richiesto se l'oggetto `leftovers` è presente. |
| `preferences.leftovers.notes` | stringa facoltativa | Dettagli sulla preferenza per gli avanzi. |

Una voce di `ingredientFrequencyLimits` contiene:

| Campo | Tipo | Significato |
| --- | --- | --- |
| `subject.kind` | `ingredient` oppure `tag` | Tipo del soggetto da conteggiare. |
| `subject.id` | stringa | ID dell'ingrediente, oppure codice presente in `meal.tags`. |
| `subject.label` | stringa facoltativa | Nome leggibile nella lingua del piano. |
| `maxMeals` | intero | Numero massimo di pasti contenenti il soggetto nella finestra indicata. |
| `period.days` | costante numerica | `7`. |
| `period.alignment` | stringa costante | `rolling`: finestra mobile di sette date consecutive. |

Il conteggio riguarda i pasti che contengono il soggetto, non il numero di righe ingrediente né le porzioni cucinate. La stessa voce ripetuta due volte nello stesso pasto conta come un pasto. Un limite riferito a un tag richiede che il generatore assegni quel tag ai pasti pertinenti: l'app non deduce automaticamente che cosa costituisca, per esempio, una famiglia di formaggi.

Questi campi conservano ciò che è stato concordato con ChatGPT. L'app non impone il limite calorico, gli intervalli dei macro o le frequenze; non aggiunge test di validità nutrizionale. Una finestra parzialmente coperta dal file non viene dichiarata completa né convertita automaticamente in una quota proporzionale. Per ragionare su giorni esterni al piano, ChatGPT avrebbe bisogno di quel contesto.

## Preparazioni anticipate e avanzi

| Campo di `preparation` | Tipo | Obbligatorio nell'oggetto | Significato |
| --- | --- | --- | --- |
| `batchId` | stringa | Sì | ID condiviso dai pasti collegati alla stessa preparazione. |
| `role` | `cook` oppure `leftover` | Sì | Pasto della preparazione o consumo di una porzione conservata. |
| `preparedServings` | numero | No | Numero informativo di porzioni preparate; non è un moltiplicatore dell'app. |
| `note` | stringa | No | Indicazioni sulla preparazione o sulla porzione conservata. |

Esempio presente nei due file dimostrativi:

| Pasto | Ruolo | Riso secco per persona | Petto di pollo crudo per persona |
| --- | --- | --- | --- |
| Cena del 21 ottobre | `cook`, `preparedServings: 2` | 80 g | 120 g |
| Pranzo del 22 ottobre | `leftover` | 80 g | 120 g |
| Requisiti dei due pasti selezionati, modalità `one` | Somma delle porzioni | **160 g** | **240 g** |

Entrambi i pasti riportano gli ingredienti della propria porzione consumata. Il primo non contiene già le quantità dell'intera preparazione. `batchId` collega i pasti, ma non autorizza a eliminare gli ingredienti del pasto successivo dalla lista.

Se l'intervallo comprende soltanto il pranzo del 22 ottobre, i requisiti sono 80 g di riso e 120 g di pollo. La lista rappresenta gli ingredienti dei pasti selezionati: non è un registro delle scorte né degli acquisti già effettuati. La disponibilità reale di avanzi o dispensa non viene sottratta automaticamente.

## Lingua e identificatori

L'interfaccia supporta italiano e inglese. I contenuti di ogni file hanno una lingua scelta nella chat, dichiarata in `language`. Cambiare lingua dell'interfaccia non traduce automaticamente titoli, ingredienti, istruzioni o note del piano.

I codici tecnici come `ingredientId`, `type`, `category`, `basis` e i nomi delle proprietà JSON restano stabili. Un piano italiano può avere `name: "Petto di pollo"` e `ingredientId: "chicken-breast"`; quello inglese può avere `name: "Chicken breast"` e lo stesso ID. Questo consente l'aggregazione senza confrontare le traduzioni.

## Calendario ed esportazione

`suggestedStartDate` è una proposta, non un'applicazione automatica al calendario.
Il flusso della fase 4 mostra le date risultanti e richiede la conferma manuale
della data iniziale anche quando coincide con quella suggerita. Conserva le
distanze fra i giorni e gli orari. Le date che contengono già pasti vengono
elencate e possono essere sostituite integralmente soltanto dopo conferma.
Importazione e annullamento vengono salvati in un'unica transazione ciascuno.

Nella versione 1, un'esportazione `.diet` riguarda **una sola `sourcePlan` alla volta**, eventualmente limitata a un sottoinsieme dei suoi pasti. Deve materializzare le **date assegnate e gli orari effettivi**, mantenendo `baseServings: 1` e ingredienti e nutrizione per persona. La nuova copia può ricevere un nuovo `planId` e nuovi `mealId` quando serve rendere uniche le occorrenze esportate. Le modalità `two`/`advanced`, i moltiplicatori, le spunte e gli articoli manuali appartengono al backup completo, non alla conversione delle quantità del piano.

Per esportare insieme più sorgenti, anche in lingue diverse, si usa il backup. L'app non traduce i contenuti né fonde implicitamente preferenze o estensioni di piani differenti. L'esportazione di una singola sorgente conserva i suoi campi di estensione e quelli dei pasti selezionati.

La schermata Esporta distingue il piano con date assegnate dal **piano originale**,
che restituisce gli stessi valori JSON ricevuti. L'esportazione dal calendario
genera nuovi ID per il piano e le occorrenze dei pasti; rende inoltre distinti
i `batchId` di assegnazioni indipendenti dello stesso piano. Gli ingredienti
mantengono i propri ID stabili e tutte le quantità restano per una persona.

Per opzioni di download, selezione delle date ed esempi consultare
[EXPORT_FORMATS.md](EXPORT_FORMATS.md). Per identità, tracciamento delle
importazioni, formule della spesa e ripristino consultare
[STATE_AND_BACKUP.md](STATE_AND_BACKUP.md).
