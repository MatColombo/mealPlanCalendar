# Formato `.diet` — versione 1

Un file `.diet` è un documento JSON UTF-8 che descrive un piano alimentare. Contiene pasti, ingredienti e quantità **per una persona e una porzione consumata**, insieme alle date proposte da ChatGPT. Le date effettivamente assegnate nell'app e le quantità aggiuntive per la spesa appartengono allo stato applicativo.

Il contratto è descritto in [diet.schema.json](../schemas/diet.schema.json). Gli esempi completi sono [example-it.diet](../examples/example-it.diet) e [example-en.diet](../examples/example-en.diet). Sono dati fittizi, con giornate intenzionalmente parziali: illustrano il formato e non rappresentano proposte nutrizionali verificate.

L'aggiornamento dell'app 1.1 aggiunge campi **facoltativi e compatibili con `schemaVersion: 1`**: contesto lavorativo della giornata, identità della ricetta, nutrizione delle righe ingrediente, zuccheri e metadati pratici. I nuovi esempi [italiano](../examples/release-1.1/meal-plan-it.diet) e [inglese](../examples/release-1.1/meal-plan-en.diet) illustrano queste estensioni. Un file precedente continua a essere importabile: ciò che non contiene rimane sconosciuto.

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
| `days[].workday` | oggetto oppure `null` | No | Classe esplicita del giorno lavorativo, con eventuali orari. Assente o `null` significa sconosciuta. |

Il generatore produce date ordinate e distinte per rendere univoche le associazioni al calendario. Lo schema non richiede un numero minimo di pasti giornalieri né verifica la completezza della giornata. Non impone una lunghezza massima a `days`.

#### Tipo di giornata lavorativa

`workday` è un dato della **giornata**, separato dai pasti e dalle note. Quando presente come oggetto richiede `class`, una stringa non vuota. I codici consigliati sono:

| `class` | Significato |
| --- | --- |
| `day-shift` | Turno diurno. |
| `morning-shift` | Turno del mattino. |
| `afternoon-shift` | Turno pomeridiano. |
| `night-shift` | Turno notturno. |
| `split-shift` | Giornata con turno spezzato. |
| `on-call` | Reperibilità. |
| `remote-work` | Lavoro da remoto. |
| `day-off` | Riposo. |
| `leave` | Ferie o permesso. |
| `other` | Altro tipo dichiarato, descritto in `label`. |

I codici restano aperti a future estensioni. `startTime` e `endTime`, quando presenti, sono stringhe `HH:mm`; `endDayOffset` vale `0` o `1`. Per un turno dalle 22:00 alle 06:00 del giorno successivo usare `{"class":"night-shift","startTime":"22:00","endTime":"06:00","endDayOffset":1}`. L'eventuale `label` è un testo nella lingua del piano: può descrivere il turno, ma non sostituisce la classe. Per un turno spezzato descrivere gli intervalli in `label` e nei metadati del lavoro senza inventare un unico turno continuo.

L'agente assegna la classe a partire dai turni o dalla matrice confermati dall'utente. L'app traduce i codici conosciuti e non cerca parole come «notte» nelle descrizioni per classificare la giornata. Sconosciuto non equivale a riposo.

Il piano conserva il contesto originario. L'importazione copia `workday` sulla giornata assegnata in `state.calendar[date].workday`, anche quando rimappa le date; non ricalcola automaticamente una matrice lavorativa esterna. Se il piano viene spostato a un periodo con turni differenti, aggiornarlo nella chat. Spostare un singolo pasto lascia il contesto sulle rispettive giornate. L'esportazione del calendario usa soltanto il contesto della **data effettiva**, senza ereditare il turno del giorno d'origine; backup e annullamento conservano questo dato. Le date già contenenti un contesto lavorativo conosciuto richiedono la medesima conferma di sostituzione prevista per i giorni con pasti.

### Pasti

| Campo | Tipo | Obbligatorio | Significato |
| --- | --- | --- | --- |
| `mealId` | stringa | Sì | ID stabile e distinto del pasto nel piano. Una modifica del pasto può conservarlo. |
| `recipeId` | stringa non vuota | No | Identità riutilizzabile della ricetta, distinta dall'occorrenza `mealId`. |
| `type` | stringa aperta | Sì | Codice del tipo di pasto; convenzioni: `breakfast`, `lunch`, `dinner`, `snack`. |
| `title` | stringa | Sì | Nome del pasto nella lingua del piano. |
| `time` | `HH:mm` | Sì | Ora civile proposta, per esempio `13:00`. |
| `ingredients` | array | Sì | Ingredienti necessari alla singola porzione consumata. |
| `nutrition` | oggetto | No | Valori nutrizionali disponibili per una persona. |
| `instructions` | array di stringhe | No | Passaggi della preparazione. |
| `prepMinutes` | numero | No | Tempo di preparazione indicato nel piano. |
| `tags` | array di stringhe | No | Codici stabili usati per descrivere o raggruppare pasti. |
| `preparation` | oggetto | No | Collegamento informativo fra preparazione anticipata e pasti con avanzi. |
| `structure` | stringa aperta | No | Struttura del pasto: `single-dish`, `first-and-second`, `main-and-side`, `first-main-and-side`, `other`. |
| `externalMeal` | oggetto | No | Pasto esterno, con eventuale intervallo calorico dichiarato e note pratiche. |
| `notes` | stringa | No | Note del singolo pasto. |

`mealId` identifica il pasto nel documento. `entryId`, descritto nello [stato applicativo](STATE_AND_BACKUP.md), identifica una sua specifica presenza nel calendario. Ripetere o spostare un pasto non modifica il documento originale.

Conservare `recipeId` quando viene ripetuta la medesima ricetta; usare un nuovo ID per una variante significativa. Il ricettario distingue comunque contenuti diversi con lo stesso ID, evitando di perdere una revisione. L'ID non provoca fusioni dei pasti nel calendario e non deduplica gli ingredienti della spesa. Per un pasto a più portate, `ingredients` contiene una sola volta tutte le quantità della porzione completa; `nutrition` descrive l'intero pasto, mentre titolo e istruzioni distinguono le portate.

`externalMeal` richiede `kind` (`canteen`, `restaurant` oppure `other`); ammette `note` e `kcalRange: {"min":550,"max":700,"unit":"kcal"}`. Gli estremi sono facoltativi e documentano il range comunicato dall'utente o dal servizio, per persona. Non trasformare un intervallo in un valore puntuale inventato. Se la composizione non è nota, usare `ingredients: []`, macro `null` e una nota: il pasto resta nel calendario, senza ingredienti fittizi nella spesa. Gli ingredienti eventualmente elencati sono sempre quantità da procurare per quel pasto; se il pasto è acquistato pronto, lasciare vuoto l'elenco degli acquisti e descrivere la composizione nota nelle note.

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
| `nutrition` | oggetto | No | Valori personali attribuiti alla **quantità di questa riga**; stessi campi di `meal.nutrition`. Non sono valori per 100 g. |

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
| `sugarsG` | numero oppure `null` | Zuccheri totali in grammi; non significa automaticamente zuccheri aggiunti. |
| `note` | stringa | Eventuali annotazioni sulla provenienza o natura dei valori. |

Questi campi restano facoltativi nel formato per leggere i file precedenti. Il generatore aggiornato include sempre `kcal`, `proteinG`, `carbohydratesG` e `fatG` per ogni pasto: stime dichiarate, oppure `null` con una motivazione in `note`. Include `sugarsG` quando richiesto e `fiberG` quando disponibile. Non omette i macro solo perché l'utente non ha impostato obiettivi numerici. Un campo assente o `null` indica un dato non disponibile; `0` è un valore esplicito.

Per ciascuna metrica l'app usa prima il valore numerico di `meal.nutrition`. In sua assenza somma i valori di `ingredient.nutrition` soltanto quando **tutte le righe** hanno quella metrica disponibile. Una somma di righe incomplete non diventa un totale completo, e un pasto senza ingredienti non produce automaticamente zero. Non vengono sommati insieme il valore del pasto e quelli dei suoi ingredienti.

I riepiloghi personali sommano i pasti con dati disponibili e distinguono le somme parziali dai totali completi. Un dato mancante non viene nascosto come zero. Nessun valore viene moltiplicato per le persone per cui cucinare; cambiano le quantità da preparare e la spesa. L'app svolge aritmetica sui valori forniti e non usa tabelle alimentari per inventare dati mancanti, né controlla coerenza tra energia e macro.

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
| `preferences.profile` | oggetto | `ageYears`, `sex`, `weightKg`, `heightCm`, dichiarati dall'utente; i numeri possono essere `null` quando non forniti. |
| `preferences.goal` | stringa | Obiettivo personale espresso nella chat. |
| `preferences.work` | oggetto | Professione, fuso, turni espliciti o matrice e dotazioni al lavoro. |
| `preferences.cooking` | oggetto | Attrezzatura, tempo, necessità di preparare in anticipo o trasportare pasti. |
| `preferences.allergens`, `preferences.restrictions` | array di stringhe | Allergeni e restrizioni dichiarati. |
| `preferences.ingredientBlacklist`, `preferences.mealBlacklist` | array di stringhe | Ingredienti e pasti esclusi. |
| `preferences.ingredientWhitelist`, `preferences.mealWhitelist` | array di stringhe | Ingredienti e pasti graditi; non implicano esclusività se non concordata. |
| `preferences.mealStructures` | array di codici | Strutture preferite, con gli stessi codici di `meal.structure`. |
| `preferences.sugars` | oggetto | Eventuali `min`, `max`, `unit: "g"` e `basis: "total"` oppure `"added"`, per giorno. |
| `preferences.externalMeals` | array di oggetti | Appuntamenti esterni noti, con data, tipo, orario e `externalMeal`. |

Tutti i nuovi metadati sono facoltativi e descrittivi. L'intervista deve chiarire il profilo e le condizioni pratiche anche quando poi l'utente preferisce non conservarli nel file. Non inventare dati personali e considerare valida una risposta «non desidero fornirlo».

In `work`, usare `occupation`, `timezone`, `notes` e `facilities: {"fridge":true,"microwave":false}`; `null` indica una dotazione sconosciuta. `roster` contiene oggetti `{date, workday}` per date note. Se l'utente fornisce una matrice ripetitiva, `rotation: {anchorDate, days:[workday, ...]}` descrive un ciclo giornaliero: indice 0 nella data di ancoraggio, indici successivi nei giorni seguenti, poi ripetizione. L'agente espande solo i dati effettivamente noti in `days[].workday`, chiarendo eccezioni e ancoraggio; l'app non esegue la matrice. La vecchia stringa `workSchedule` rimane leggibile, ma non determina il tipo di giornata.

In `cooking`, usare `equipment` (array di nomi), `maxMinutesPerMeal`, `preparationAheadNeeded`, `transportNeeded` e `notes`. In `externalMeals`, usare `date`, `time`, `type` ed `externalMeal`; il singolo pasto conserva a sua volta `externalMeal`. Descrizioni e preferenze usano la lingua del piano. Un limite agli zuccheri aggiunti non può essere confrontato automaticamente con `nutrition.sugarsG`, che indica zuccheri totali. L'agente chiarisce la distinzione senza inventare la componente aggiunta.

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
