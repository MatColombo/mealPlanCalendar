# Contratto dati per il generatore Meal Planner

Usa questo riferimento per costruire o rivedere documenti `.diet` v1 in ChatGPT.
Consulta lo schema documentale incluso [diet.schema.json](diet.schema.json); non introdurre validatori o test di correttezza alimentare, delle ricette o nutrizionale.
Produci JSON UTF-8 con numeri JSON, senza commenti o delimitatori Markdown nel file.

Indice: [Documento](#documento) · [Giorni e pasti](#giorni-e-pasti) · [Ingredienti](#ingredienti) · [Nutrizione e preferenze](#nutrizione-e-preferenze) · [Frequenze](#frequenze) · [Preparazioni e avanzi](#preparazioni-e-avanzi) · [Revisioni, stato e storico](#revisioni-stato-e-storico).

## Documento

Genera normalmente 3–10 date consecutive; il formato ammette qualsiasi sequenza non vuota per le esportazioni.
Usa una sola lingua per titoli, nomi, istruzioni e note; la lingua dell'interfaccia rimane indipendente.

| Campo | Obbligatorio | Tipo e istruzione |
| --- | --- | --- |
| `format` | Sì | Stringa costante `meal-planner.diet`. |
| `schemaVersion` | Sì | Numero costante `1`; non usarlo come numero di revisione. |
| `planId` | Sì | Stringa non vuota; identifica il piano logico. |
| `title` | Sì | Stringa nella lingua scelta per il piano. |
| `language` | Sì | Tag BCP-47, per esempio `it`, `en`, `it-IT`; non limitato alle lingue UI. |
| `createdAt` | Sì | Istante di creazione RFC 3339 con `Z` oppure offset. |
| `suggestedStartDate` | Sì | Data civile `YYYY-MM-DD`; nella nuova proposta falla coincidere con il primo giorno. |
| `baseServings` | Sì | Numero costante `1`: una porzione consumata da una persona. |
| `notes` | No | Stringa per condizioni concordate, contesto e preferenze non rappresentate da altri campi. |
| `preferences` | No | Oggetto dei target e delle preferenze esplicitamente concordati. |
| `days` | Sì | Array non vuoto, ordinato per date distinte. |

Mantieni `planId` quando rivedi la stessa proposta; assegna un nuovo ID a un piano logico nuovo.
Conserva le estensioni già presenti negli oggetti; non ricostruire gli allegati eliminando campi sconosciuti.

## Giorni e pasti

Nelle tabelle, «obbligatorio» si riferisce all'oggetto contenitore, anche quando quell'oggetto è facoltativo.

| Campo | Obbligatorio | Tipo e istruzione |
| --- | --- | --- |
| `days[].date` | Sì | Data civile `YYYY-MM-DD`, senza conversione di fuso orario. |
| `days[].meals` | Sì | Array dei pasti del giorno. |
| `meals[].mealId` | Sì | Stringa non vuota, stabile e distinta nel piano. |
| `meals[].type` | Sì | Codice aperto; preferisci `breakfast`, `lunch`, `dinner`, `snack` quando appropriati. |
| `meals[].title` | Sì | Nome del pasto nella lingua del documento. |
| `meals[].time` | Sì | Ora civile locale `HH:mm`, da `00:00` a `23:59`. |
| `meals[].ingredients` | Sì | Array degli ingredienti della singola porzione consumata. |
| `meals[].nutrition` | No | Oggetto dei valori disponibili per quella porzione; vedi sotto. |
| `meals[].instructions` | No | Array di stringhe con i passaggi di preparazione. |
| `meals[].prepMinutes` | No | Numero di minuti indicato per la preparazione. |
| `meals[].tags` | No | Array di codici stabili; inserisci i tag pertinenti alle frequenze concordate. |
| `meals[].preparation` | No | Oggetto informativo per preparazione condivisa e avanzi. |
| `meals[].notes` | No | Stringa di note del pasto. |

Tratta `mealId` come identità dell'occorrenza logica, anche se ne cambi ingredienti, titolo, data o ora.
Una ricetta ripetuta in un altro pasto riceve un altro `mealId`; non rinumerare gli ID esistenti dopo inserimenti o spostamenti.
Mantieni stabili anche i codici `type`, `tags`, `category` e `basis` durante una traduzione.

## Ingredienti

| Campo di `ingredients[]` | Obbligatorio | Tipo e istruzione |
| --- | --- | --- |
| `ingredientId` | Sì | Stringa non vuota; usa uno slug inglese stabile e indipendente dal nome visualizzato. |
| `name` | Sì | Nome nella lingua del documento. |
| `quantity` | Sì | Numero per una sola porzione consumata; non una stringa come `80 g`. |
| `unit` | Sì | Stringa aperta; convenzioni `g`, `kg`, `ml`, `l`, `unit`. |
| `category` | No | Codice aperto; convenzioni `produce`, `grains`, `protein`, `dairy`, `pantry`, `other`. |
| `basis` | No | Codice aperto, per esempio `raw`, `cooked`, `drained`, `dry`, `as_sold`. |

Riutilizza l'ID per lo stesso ingrediente, anche in lingue diverse; distingui varianti come `milk` e `lactose-free-milk`.
Usa una base esplicita e coerente quando necessaria a interpretare la quantità; una base assente non equivale a `raw`.
La spesa raggruppa per `ingredientId` + unità canonica + `basis` esatta, usando il nome della prima voce corrispondente.
Le sole conversioni sono kg→g e l→ml; g/ml riconosciuti vengono normalizzati anche con maiuscole o spazi esterni.
Le unità sconosciute restano come ricevute; non convertire implicitamente pezzi in peso, peso in volume o crudo in cotto.
Tutte le quantità rimangono per persona anche quando l'utente cucina per più persone: quei moltiplicatori appartengono all'app.

## Nutrizione e preferenze

Fornisci soltanto i dati disponibili; un campo numerico nutrizionale assente o `null` non significa zero.

| Campo di `nutrition` | Obbligatorio | Tipo e significato |
| --- | --- | --- |
| `kcal` | No | Numero oppure `null`, energia della porzione per persona. |
| `proteinG` | No | Numero oppure `null`, proteine della porzione in grammi. |
| `carbohydratesG` | No | Numero oppure `null`, carboidrati della porzione in grammi. |
| `fatG` | No | Numero oppure `null`, grassi della porzione in grammi. |
| `fiberG` | No | Numero oppure `null`, fibre della porzione in grammi. |
| `note` | No | Stringa sulla provenienza, natura o disponibilità dei valori. |

L'app somma valori per persona e ignora `cookingServings`; una metrica mancante in un pasto rende quel totale `null`.
Non inventare valori per completare un totale: l'app non li ricava dagli ingredienti e non confronta i totali con i target.

| Campo di `preferences` | Obbligatorio | Tipo e istruzione |
| --- | --- | --- |
| `maxKcalPerDay` | No | Numero: limite giornaliero dichiarato dall'utente. |
| `macros` | No | Oggetto con eventuali intervalli `protein`, `carbohydrates`, `fat`. |
| `macros.<macro>` | No | Oggetto dell'intervallo giornaliero del macro scelto. |
| `macros.<macro>.min` | No | Numero: estremo minimo concordato in grammi al giorno. |
| `macros.<macro>.max` | No | Numero: estremo massimo concordato in grammi al giorno. |
| `macros.<macro>.unit` | Sì | Stringa costante `g`, quando l'oggetto del macro è presente. |
| `ingredientFrequencyLimits` | No | Array dei massimi espliciti di frequenza; vedi sotto. |
| `workSchedule` | No | Stringa con orari e organizzazione del lavoro dichiarati. |
| `leftovers` | No | Oggetto della preferenza sugli avanzi. |
| `leftovers.allowed` | Sì | Booleano, quando l'oggetto `leftovers` è presente. |
| `leftovers.notes` | No | Stringa con dettagli concordati sugli avanzi. |

Chiarisci unità mancanti, percentuali o g/kg prima di rappresentare un target come g/giorno; non assegnare estremi non concordati.
Conserva restrizioni, preferenze e condizioni pratiche senza un campo dedicato nelle `notes` appropriate.

## Frequenze

| Campo di `ingredientFrequencyLimits[]` | Obbligatorio | Tipo e istruzione |
| --- | --- | --- |
| `subject` | Sì | Oggetto del soggetto della frequenza. |
| `subject.kind` | Sì | `ingredient` oppure `tag`. |
| `subject.id` | Sì | `ingredientId` esatto oppure codice presente nei `meal.tags` pertinenti. |
| `subject.label` | No | Stringa leggibile nella lingua del piano. |
| `maxMeals` | Sì | Intero: massimo concordato di pasti che contengono il soggetto. |
| `period` | Sì | Oggetto della finestra temporale. |
| `period.days` | Sì | Numero costante `7`. |
| `period.alignment` | Sì | Stringa costante `rolling`. |

Usa finestre mobili di sette date consecutive; non azzerare il conteggio al lunedì o all'inizio del file.
Un soggetto presente più volte nello stesso pasto conta una volta; il numero di persone non cambia il conteggio.
Per un gruppo come i formaggi, assegna esplicitamente il tag ai pasti pertinenti: l'app non ricava famiglie dai nomi.
Registra le frequenze desiderate che non sono massimi nelle `notes` del piano; non trasformarle implicitamente in `maxMeals`.
Per 3–6 giorni, descrivi la copertura parziale senza convertire il massimo settimanale in una quota proporzionale.
Per 7–10 giorni, considera le finestre mobili coperte e segnala i bordi per cui manca contesto; non presumere pasti esterni assenti.
Usa soltanto chat e allegati per conoscere giorni precedenti o successivi: applica le regole di storico della sezione finale.

## Preparazioni e avanzi

| Campo di `preparation` | Obbligatorio | Tipo e istruzione |
| --- | --- | --- |
| `batchId` | Sì | Stringa non vuota condivisa dai pasti della stessa preparazione. |
| `role` | Sì | `cook` per la preparazione, `leftover` per il consumo conservato. |
| `preparedServings` | No | Numero informativo di porzioni preparate, senza effetto sui moltiplicatori dell'app. |
| `note` | No | Stringa su preparazione, conservazione o porzione collegata. |

Assegna un `mealId` distinto a ogni consumo e mantieni lo stesso `batchId` soltanto per la stessa preparazione.
Ogni pasto riporta esclusivamente i propri ingredienti per persona: due consumi da 80 g richiedono 160 g complessivi.
Non inserire l'intera preparazione nel pasto `cook` e non azzerare il pasto `leftover`; il batch non deduplica la spesa.
Se cambi una preparazione condivisa, adatta i pasti collegati interessati oppure rendi esplicito un nuovo collegamento.
Il contratto prevede un solo oggetto `preparation` per pasto; descrivi altri collegamenti nelle note senza cambiarne il tipo.
Scorte già pronte o preparazioni esterne all'intervallo non vengono sottratte automaticamente dalla spesa.

## Revisioni, stato e storico

Rivedi l'ultima proposta disponibile conservando `planId`, gli ID delle occorrenze mantenute, `createdAt` ed estensioni esistenti.
Non aggiungere campi di timestamp o numero di revisione; distingui i file, per esempio `piano-2026-10-21-r02.diet`.
Esporta il documento completo aggiornato quando l'utente cambia un pasto: una patch implicita potrebbe sostituire un'intera giornata nell'app.
Non promettere fusioni per ID: ogni importazione può ricevere un `sourceId` distinto e conserva uno snapshot originale separato.
`entryId` identifica una presenza nel calendario; `sourceId`, `sourceDate`, `mealId` ne indicano la sorgente, senza modificare il piano originale.
La data assegnata è la chiave di `state.calendar`; l'ora effettiva è `timeOverride` quando presente, altrimenti l'ora sorgente.
Un `.diet` esportato dal calendario materializza date e ore effettive di una sola sorgente, mantenendo quantità e nutrizione per persona.
Per occorrenze duplicate l'esportazione può creare nuovi `planId`/`mealId`; conserva le estensioni dei dati copiati.
Modalità spesa, `cookingServings`, spunte, articoli manuali, impostazioni, più sorgenti e storico completo viaggiano nel backup.
Il backup usa `format: "meal-planner.backup"`, `schemaVersion: 1`, `exportedAt` e `state`; non trattarlo come un piano `.diet`.
Leggi uno storico soltanto se già fornito nella chat o negli allegati; non presumere accesso al database locale della PWA.
Un `.diet` originale mostra date proposte; un calendario assegnato mostra pasti pianificati, senza dimostrare che siano stati consumati.
Se l'utente allega un backup, ricava le occorrenze da `state.calendar` risolvendo i riferimenti ai `sourcePlans` incorporati.
Non contare tutte le sorgenti archiviate o la sola mappatura iniziale `imports`: possono contenere revisioni o date poi spostate.
Mantieni distinti pasti dichiarati consumati, pasti pianificati e giorni ignoti; chiedi solo il contesto che manca alla richiesta corrente.
