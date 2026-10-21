# Contratto operativo `.diet` v1

Riferimento autonomo della skill, sincronizzato con `docs/DIET_FORMAT.md` e
`schemas/diet.schema.json` del progetto. Le estensioni dell'app 1.1 restano
facoltative e compatibili con `schemaVersion: 1`.

## Indice

- [Documento e date](#documento-e-date)
- [Giornata lavorativa](#giornata-lavorativa)
- [Pasti e ricette](#pasti-e-ricette)
- [Ingredienti e nutrizione](#ingredienti-e-nutrizione)
- [Profilo e preferenze](#profilo-e-preferenze)
- [Frequenze](#frequenze)
- [Preparazioni e avanzi](#preparazioni-e-avanzi)
- [Calendario, lingua e revisioni](#calendario-lingua-e-revisioni)
- [Consegna e controlli tecnici](#consegna-e-controlli-tecnici)

## Documento e date

Un `.diet` è JSON UTF-8. La proposta nuova dura 3–10 giorni; il formato accetta
anche esportazioni di periodi differenti, purché `days` non sia vuoto.

| Campo principale | Forma |
| --- | --- |
| `format` | Sempre `"meal-planner.diet"`. |
| `schemaVersion` | Sempre `1`. |
| `planId` | Stringa stabile del piano logico. |
| `title` | Titolo nella lingua scelta. |
| `language` | Tag della lingua dei testi, per esempio `it` o `en`. |
| `createdAt` | Istante ISO con offset o `Z`. |
| `suggestedStartDate` | Prima data suggerita `YYYY-MM-DD`. |
| `baseServings` | Sempre `1`. |
| `days` | Array non vuoto di `{date, meals, workday?}`. |
| `preferences`, `notes` | Metadati facoltativi e nota del piano. |

Date ordinate e distinte; orari civili `HH:mm`. Non convertire una data di
calendario in UTC e non sottrarre ore per un cambio di fuso. Il file contiene
le date proposte: l'utente conferma quelle effettive nell'app.

## Giornata lavorativa

Quando il turno è noto, assegnare **alla giornata**:

```json
{
  "class": "night-shift",
  "startTime": "22:00",
  "endTime": "06:00",
  "endDayOffset": 1,
  "label": "Turno notturno"
}
```

`class` è una stringa non vuota; codici consigliati: `day-shift`,
`morning-shift`, `afternoon-shift`, `night-shift`, `split-shift`, `on-call`,
`remote-work`, `day-off`, `leave`, `other`. I codici sono aperti a estensioni.
`startTime` e `endTime`, se presenti, sono stringhe `HH:mm`; `endDayOffset`
vale `0` o `1`. `label` è facoltativo e usa la lingua del piano.

Assente o `null` significa **sconosciuto**, non riposo. Non mettere `workday`
sul pasto e non chiedere all'app di dedurlo da note o nomi. Un turno spezzato
usa `split-shift` e descrive gli intervalli nella label/metadati del lavoro.
Un pasto delle 02:00 va nella data civile in cui viene consumato.

L'importazione copia il contesto su `state.calendar[date].workday` delle date
assegnate; non ricalcola il calendario reale dei turni quando l'utente cambia
la data iniziale. Per adattarlo a un'altra rotazione serve una revisione in
chat. Spostare un singolo pasto lascia il contesto delle date al suo posto.
L'esportazione del calendario usa il contesto della data effettiva; una data
senza pasti è conservata nel backup ma non aggiunta da sola al `.diet` esportato.

## Pasti e ricette

Ogni pasto richiede `mealId`, `type`, `title`, `time`, `ingredients`.

| Campo | Convenzione |
| --- | --- |
| `mealId` | ID univoco dell'occorrenza nel piano. |
| `recipeId` | Facoltativo, riutilizzabile per la stessa ricetta. |
| `type` | Codice aperto: `breakfast`, `lunch`, `dinner`, `snack`. |
| `title` | Nome leggibile. |
| `time` | Ora civile `HH:mm`. |
| `ingredients` | Array delle quantità di una porzione consumata. |
| `nutrition` | Valori per persona del pasto intero. |
| `instructions` | Array di passaggi testuali. |
| `prepMinutes` | Numero facoltativo. |
| `tags` | Array di codici stabili, anche per gruppi soggetti a frequenze. |
| `structure` | `single-dish`, `first-and-second`, `main-and-side`, `first-main-and-side`, `other`; codici aperti. |
| `preparation` | Collegamento facoltativo a una preparazione condivisa. |
| `externalMeal`, `notes` | Pasto esterno e note facoltativi. |

Ogni ripetizione ha un `mealId` distinto anche se condivide `recipeId`.
Assegnare un nuovo `recipeId` per una variante sostanziale. L'app protegge
comunque varianti con ingredienti diversi sotto lo stesso ID. L'identità della
ricetta non deduplica acquisti e non fonde pasti. Per più portate, elencare una
volta tutte le quantità e dare la nutrizione del pasto completo.

Per mensa o ristorante:

```json
{
  "kind": "canteen",
  "kcalRange": { "min": 550, "max": 700, "unit": "kcal" },
  "note": "Intervallo comunicato dall'utente; composizione non nota."
}
```

`externalMeal.kind` è `canteen`, `restaurant` oppure `other`. Range e nota sono
facoltativi; min/max sono per persona. Se il range è sconosciuto, ometterlo.
Non dedurre un valore esatto dal punto medio. Per un pasto acquistato pronto
usare `ingredients: []`: le righe ingredienti rappresentano cose da procurare.
Composizione nota ma acquistata nel servizio può restare nelle note. Riportare
macro ignoti come `null`, spiegandolo; nessuno zero artificiale o ricetta inventata.

## Ingredienti e nutrizione

Ogni ingrediente richiede `ingredientId`, `name`, `quantity` numerica e `unit`
non vuota. `category`, `basis`, `nutrition`, `unitConversion` sono facoltativi.

- ID inglese stabile, indipendente dalla traduzione; varianti reali distinte.
- Unità: `g`, `kg`, `ml`, `l`, `unit`, o altro codice esplicito.
- Categorie: `produce`, `grains`, `protein`, `dairy`, `pantry`, `other`.
- Basi: `raw`, `cooked`, `drained`, `dry`, `as_sold`; assente resta distinto.

La spesa unisce solo stesso ID, unità compatibili e identica base. Normalizza
kg/g e l/ml. Pezzi e grammi restano separati salvo conversione esplicita sulla
singola riga: `unitConversion: {toUnit: "g", factor: 50}` significa 50 g per
unità di quella voce. Non inventare equivalenze, catene o conversioni crudo/cotto.

Sia il pasto sia la riga ingrediente usano questi nomi esatti:

| Campo | Unità |
| --- | --- |
| `kcal` | kcal |
| `proteinG` | g di proteine |
| `carbohydratesG` | g di carboidrati |
| `fatG` | g di grassi |
| `fiberG` | g di fibre |
| `sugarsG` | g di zuccheri **totali** |
| `note` | Testo sulla natura/provenienza o mancanza dei dati. |

Per ogni pasto nuovo includere kcal e i tre macro principali, anche senza
obiettivi numerici: valore disponibile/stimato oppure `null` motivato. Includere
zuccheri quando richiesti e fibre quando disponibili. Il formato rimane
compatibile con vecchi file privi dei campi. Non attribuire valori a banche dati
mai consultate; non presentare stime come misure.

`ingredient.nutrition` è riferito **alla quantità della riga per una persona**,
mai a 100 g se la riga ne contiene un'altra quantità. `meal.nutrition` è la
porzione completa. Per ogni metrica il valore numerico dichiarato sul pasto
prevale; in sua assenza l'app somma i valori delle righe solo se tutte li
forniscono. Una somma incompleta rimane parziale, senza ingredienti non significa
zero, e non si sommano tra loro dati del pasto e degli ingredienti.

Le persone per cui cucinare non moltiplicano la nutrizione personale. Dopo una
sostituzione aggiornare sia la riga sia il pasto e i riepiloghi interessati,
oppure impostare il dato diventato ignoto a `null` con nota.

## Profilo e preferenze

Metadati facoltativi, conservati senza applicare blocchi nell'app:

| Campo in `preferences` | Forma / significato |
| --- | --- |
| `profile` | `{ageYears, sex, weightKg, heightCm}`; valori dichiarati, `null` se non forniti. |
| `goal` | Obiettivo personale in testo. |
| `maxKcalPerDay` | Eventuale massimo numerico giornaliero. |
| `macros` | `protein`, `carbohydrates`, `fat`: `{min?, max?, unit:"g"}` al giorno. |
| `sugars` | `{min?, max?, unit:"g", basis:"total"|"added"}` al giorno. |
| `allergens`, `restrictions` | Array di testi concordati. |
| `ingredientBlacklist`, `mealBlacklist` | Array di esclusioni. |
| `ingredientWhitelist`, `mealWhitelist` | Array di preferenze; esclusività soltanto se concordata. |
| `mealStructures` | Array dei codici `structure`. |
| `work` | Professione, turni/matrice e dotazioni al lavoro. |
| `cooking` | Attrezzature e organizzazione. |
| `externalMeals` | Array `{date?, time?, type?, externalMeal?}`. |
| `ingredientFrequencyLimits` | Array delle frequenze massime qui sotto. |
| `leftovers` | `{allowed: boolean, notes?: string}`. |
| `workSchedule` | Vecchia descrizione libera; non determina la classe del giorno. |

`work` ammette `occupation`, `timezone`, `notes`, `facilities: {fridge,
microwave}` (booleani o `null`), `roster: [{date, workday}]` e `rotation:
{anchorDate, days: [workday, ...]}`. La rotazione è un ciclo di **giorni**: indice
zero nella data di ancoraggio, indici seguenti nelle date successive, poi
ripetizione. Chiarire le eccezioni prima di espandere il ciclo in `days[].workday`.
L'app conserva la descrizione; non esegue la matrice.

`cooking` ammette `equipment` (array di nomi), `maxMinutesPerMeal`,
`preparationAheadNeeded`, `transportNeeded` (booleani o `null`), `notes`.

I limiti agli zuccheri aggiunti non sono automaticamente confrontabili con
`sugarsG`, che indica zuccheri totali. Nessuna inferenza da un dato all'altro.
Profilo e dati pratici si chiariscono una volta nell'intervista; l'utente può
non fornire un dato o non volerlo nel file. Non usare i profili degli esempi.

## Frequenze

```json
{
  "subject": { "kind": "tag", "id": "contains-eggs", "label": "Pasti con uova" },
  "maxMeals": 3,
  "period": { "days": 7, "alignment": "rolling" }
}
```

`subject.kind`: `ingredient` per un `ingredientId`, `tag` per un codice in
`meal.tags`. Conta un pasto una volta, non righe o persone. Usare finestre
mobili di sette date consecutive, senza azzerare il lunedì. Non proporzionare
un massimo su 3–6 giorni; 8–10 giorni comprendono più finestre interne. I
contorni sconosciuti restano parziali. Una frequenza desiderata non massima
rimane nelle note; non convertirla in un vincolo massimo.

Per continuità usare solo storico nella conversazione o allegato. Un piano
assegnato non dimostra consumo. Nel backup risolvere `state.calendar` tramite
`sourceId`, `sourceDate`, `mealId`; non contare tutti i documenti sorgente né la
cronologia importazioni come pasti attuali. Non usare chat o archivi non forniti.

## Preparazioni e avanzi

`preparation` richiede `batchId` e `role: "cook"|"leftover"`; ammette
`preparedServings` numerico e `note`. Due pasti da 80 g di un ingrediente hanno
**80 g ciascuno**, anche se il primo dice di prepararne 160 g per due consumi.
Le righe contengono solo la quota consumata da una persona nel singolo pasto.

`preparedServings` è informativo e non moltiplica gli acquisti. La spesa non
elimina pasti con lo stesso batch: somma le quote consumate nel periodo. Non
sottrae scorte possedute. Non introdurre una seconda copia degli ingredienti
interi della preparazione. In caso di revisione di una preparazione comune,
chiarire l'ambito delle porzioni coinvolte se l'utente non l'ha già autorizzato.

## Calendario, lingua e revisioni

Il documento originale resta separato dalle assegnazioni. `cookingServings`,
spunte e modalità della spesa appartengono allo stato dell'app. Non esportarli
come moltiplicatori del `.diet`; i pasti iniziano a una persona.

La stessa proposta mantiene `planId` e `createdAt`; la stessa occorrenza mantiene
`mealId`. Ingredienti realmente diversi e varianti significative usano ID
appropriati. Rigenerare il file completo corrente dopo una revisione, senza
patch sparse e senza lasciare stime obsolete. Conservare i campi sconosciuti
ricevuti. La lingua del file è unica per titoli, ingredienti, istruzioni, note,
label del lavoro e metadati leggibili; proprietà JSON e codici restano stabili.

Il `.diet` esportato dal calendario riguarda una sola fonte e materializza
le sue date e ore assegnate. Il backup versionato conserva più fonti, lingue,
contesti giornalieri, impostazioni, persone, spunte e voci manuali. L'app non
traduce un piano quando cambia lingua UI.

## Consegna e controlli tecnici

Generare un file `.diet` completo con gli strumenti disponibili e riferire solo
un link realmente prodotto. Se non è possibile, dichiararlo e fornire JSON
completo salvabile dall'utente, senza un finto allegato. L'app accetta anche il
medesimo JSON con suffisso `.json`; `.diet` rimane il formato di consegna.

Rileggere il JSON e verificare struttura, campi tecnici richiesti, tipi,
serializzazione, date/orari, ID e riferimenti. Non aggiungere né eseguire
validatori o test su validità delle ricette, equilibrio, kcal, macro o frequenze.
