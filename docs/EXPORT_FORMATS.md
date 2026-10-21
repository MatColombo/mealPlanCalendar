# Esportazione e portabilità — fasi 4–8

Versione dell'app: **1.1.0**. I formati `.diet`, stato e backup restano alla
**versione 1**. Le aggiunte per storico e annullamento sono facoltative e
compatibili con i documenti delle fasi precedenti.

## Quale download scegliere

| Download nell'app | Contenuto | Uso |
| --- | --- | --- |
| Piano dal calendario — `.diet` | Una sorgente, nell'intervallo scelto, con date e orari effettivi; quantità per una persona. | Riutilizzare in ChatGPT o importare altrove i pasti selezionati. |
| Piano originale — `.diet` | Tutti i valori JSON della sorgente ricevuta, con date e orari suggeriti. | Recuperare il documento di partenza. |
| Backup completo — `.json` | Tutte le sorgenti, assegnazioni, persone, impostazioni, spesa, storico e annullamento. | Trasferire o conservare l'intero archivio. |
| Copia di recupero — `.json` | Backup completo dello stato precedente all'ultimo ripristino riuscito. | Recuperare un archivio sostituito. |
| Archivio originale — `.json`, quando disponibile dopo un errore di apertura | Stato salvato, letto senza migrazione e con la sua versione originale. | Conservare un archivio che richiede un'app compatibile. |
| Lista della spesa — copia o `.txt` | Intervallo, modalità, ingredienti aggregati, quantità calcolate, categorie, spunte e voci manuali. | Portare con sé o condividere una checklist leggibile. |

Il backup è distinto dal piano attraverso il campo `format`, non soltanto
attraverso l'estensione del file. Un backup si apre nel ripristino; un `.diet`
si apre nell'importazione del piano. Questi documenti sono JSON UTF-8 generati
localmente; la lista della spesa è invece testo UTF-8. Il nome del file non
determina identità o versione dei documenti JSON.

Dopo la preparazione offline, lettura e generazione di questi file funzionano
senza rete. I file personali non entrano nella cache del service worker.
Il selettore del sistema deve poter accedere al file scelto: un documento
conservato soltanto su un servizio remoto va prima reso disponibile sul dispositivo.

## Lista della spesa in testo — fase 6

La schermata **Spesa** offre **Copia lista** e **Scarica .txt**. Entrambi usano
una nuova vista del fabbisogno corrente: includono tutte le sorgenti e tutti
i pasti nelle date selezionate, con estremi inclusi, applicando la modalità
attiva. Le righe riportano `[ ]` o `[x]`, nome, quantità e base di misurazione
quando presente. Le quantità aumentate riportano anche il valore precedente.

Le categorie, le date, i numeri e le etichette seguono la lingua dell'interfaccia.
Nomi degli ingredienti e unità personalizzate rimangono quelli forniti. Le
aggiunte manuali compaiono in una sezione distinta con quantità assolute.
La stessa ordinazione per categoria e nome viene usata dalla schermata e
dal testo. Un nome su più righe viene reso su una sola riga di checklist.

Si può copiare o scaricare anche una lista composta soltanto da voci manuali,
senza intervallo. Una lista completamente vuota disabilita i comandi. Se il
browser non rende disponibile la copia negli appunti, una finestra mostra
il testo da selezionare e mantiene il download disponibile. Nessun comando
dell'app invia la lista a un destinatario.

Nome con periodo: `meal-planner-shopping-2026-10-26_2026-10-28-it.txt`.
Senza periodo: `meal-planner-shopping-manual-it.txt`. Il file non è importabile
come `.diet` o backup: rappresenta una fotografia della checklist al momento
del comando. Per ripristinare le spunte interattive si usa il backup completo.

## `.diet` dal calendario

Nella schermata **Esporta** si sceglie una sorgente e un intervallo con estremi
inclusi. L'anteprima mostra giornate, pasti e date effettivamente presenti.
Una selezione senza pasti della sorgente scelta non produce un file vuoto.

L'operazione `exportCalendarDiet`:

1. Risolve i pasti del calendario riferiti alla sorgente selezionata.
2. Usa le date assegnate come `days[].date` e gli orari effettivi come `time`.
3. Conserva gli intervalli fra le date presenti; non crea giornate o pasti mancanti.
4. Imposta `suggestedStartDate` alla prima giornata effettivamente esportata.
5. Crea un nuovo `planId`, un nuovo `createdAt` e `mealId` distinti per le occorrenze.
6. Copia lingua, testi, ingredienti, istruzioni, preferenze ed estensioni della sorgente.
7. Mantiene `baseServings: 1` e tutte le quantità e stime riferite a una persona.

Le persone del calendario, la modalità della spesa e le spunte **non moltiplicano
il contenuto del `.diet`**. Importare questo file crea presenze con una persona
iniziale. Per trasferire anche i moltiplicatori si usa il backup.

Gli `ingredientId` restano stabili. Unità e basi come `raw`, `cooked` e `drained`
rimangono quelle ricevute: l'esportazione non effettua conversioni alimentari
o ricalcoli delle stime nutrizionali. Anche preferenze e note restano metadati
del piano di partenza; una selezione più corta non le trasforma in nuovi obiettivi.
Le eventuali dichiarazioni `unitConversion` restano negli ingredienti originali:
la loro applicazione avviene soltanto nel calcolo della spesa.

### Preparazioni e avanzi

I pasti continuano a descrivere le sole quantità attribuite alle porzioni
consumate. Durante l'esportazione, `preparation.batchId` riceve un nuovo
identificativo, distinguendo ciascuna coppia composta dall'assegnazione
originaria e dal batch di partenza.

Due pasti della medesima preparazione assegnati insieme restano collegati,
anche se uno viene spostato a una data diversa. La presenza conserva
`assignmentId`; per i vecchi stati si usa la provenienza disponibile nello storico.
Due assegnazioni dello stesso piano in settimane diverse ricevono gruppi
distinti, evitando di collegare preparazioni indipendenti. Una selezione può
includere soltanto il pasto con avanzi: il file conserva le informazioni
disponibili senza inventare una nuova preparazione o ripetere l'intera ricetta.

### Una sola sorgente per file

Il `.diet` v1 esportato riguarda una sola `sourcePlan`, anche se il calendario
contiene più piani o lingue. Le preferenze e i testi non vengono fusi o tradotti.
I metadati di ciascuna giornata provengono dal giorno sorgente rappresentato;
se una giornata ospita pasti di più giorni della stessa sorgente, il primo
giorno rappresentato fornisce i metadati giornalieri. I singoli pasti
mantengono comunque le proprie estensioni. Fa eccezione `workday`: viene
sempre letto dalla data effettiva del calendario, e rimosso dal giorno
esportato quando quella data non ha un contesto noto. Lo spostamento di un
pasto non trasporta con sé il turno del giorno originale.

La funzione restituisce una nuova copia e non modifica sorgenti o calendario.
Per tutti i piani insieme, anche in lingue diverse, il formato è il backup.

## `.diet` originale

`exportSourceDiet(state, sourceId)` restituisce una copia del documento salvato
al momento dell'importazione. Date, orari, ingredienti, lingua, metadati e campi
aggiuntivi sono conservati. Si garantisce l'identità dei **valori JSON**:
spazi, indentazione e ordine delle proprietà nel testo scaricato possono
essere diversi dal file caricato.

Riassegnare lo stesso file non crea un secondo originale. Modificare il JSON
mantenendo lo stesso `planId` produce invece una sorgente distinta. In Esporta
restano selezionabili anche sorgenti archiviate non più presenti nel calendario:
il download originale è disponibile, mentre quello dal calendario richiede
almeno un pasto assegnato.

## Backup completo v1

Involucro, con `state` abbreviato soltanto in questo esempio documentale:

```json
{
  "format": "meal-planner.backup",
  "schemaVersion": 1,
  "exportedAt": "2026-10-19T16:00:00Z",
  "state": {
    "format": "meal-planner.state",
    "schemaVersion": 1
  }
}
```

Il frammento non è un backup importabile: lo stato completo contiene i campi
descritti in [STATE_AND_BACKUP.md](STATE_AND_BACKUP.md).

| Informazioni nello stato | Conservate |
| --- | --- |
| Tutti i documenti originali e le loro estensioni | Sì |
| Date assegnate, riferimenti e identità dei pasti | Sì |
| Orari modificati e `cookingServings` | Sì |
| Lingua UI, riduzione delle animazioni e inizio della settimana | Sì |
| Intervallo e modalità della spesa | Sì |
| Spunte delle righe aggregate, quantità registrate e marker di riapertura | Sì |
| Voci manuali con quantità, categoria e spunta | Sì |
| Cronologia delle importazioni e ultimo annullamento disponibile | Sì |
| Vista/data selezionata e metadati dello stato | Sì |
| Modali aperte, bozze non confermate e messaggi UI | No, sono transitori |
| Stato della rete, cache dell'app e prompt di installazione | No, vengono rilevati dal browser |
| Revisione interna IndexedDB e copia pre-ripristino separata | No, non sono campi dello stato esportato |

I campi aggiuntivi dello stato e delle sorgenti vengono mantenuti. L'involucro
esterno viene rigenerato a ogni download: non si promette la conservazione di
eventuali estensioni dell'involucro stesso. Non si devono cambiare manualmente
i numeri di versione per forzare un ripristino.

## Ripristino: cosa accade

Il file viene letto e controllato tecnicamente prima di modificare l'archivio.
La lettura usa la pipeline condivisa di compatibilità dello stato. In questa
versione lo stato rimane v1 e la lista delle migrazioni è vuota. Future
trasformazioni esplicitamente supportate prepareranno soltanto il candidato
in memoria: nessuna scrittura precede la conferma.
L'anteprima confronta il contenuto corrente e quello da ripristinare: numero di
sorgenti, giornate, pasti, spunte, articoli manuali e importazioni.
L'utente può annullare oppure confermare la sostituzione completa.

Dopo la conferma, una transazione salva sia la copia pre-ripristino sia il
nuovo archivio. L'interfaccia cambia solo dopo il completamento riuscito.
Errori JSON, versioni non supportate, riferimenti mancanti, quota insufficiente
o abort della transazione lasciano intatto lo stato corrente.

Le impostazioni ripristinate includono la lingua dell'interfaccia: un backup
con UI inglese può quindi cambiare i controlli in inglese. I testi dei piani
non vengono tradotti. La schermata di esito resta nelle impostazioni, salvo
una navigazione più recente dell'utente durante il salvataggio.

Quando esiste uno stato precedente, **Scarica la copia precedente** produce un
contenitore backup v1 che conserva lo stato originale e la sua versione.
Il file si chiama `meal-planner-previous-archive-AAAA-MM-GG.json`.
Uno stato v1 può attraversare lo stesso flusso di anteprima e ripristino;
eventuali versioni future richiederanno un'app compatibile.
Si mantiene una sola copia di recupero. Un successivo ripristino la sostituisce;
le azioni esplicite di svuotamento o ripristino demo la rimuovono dopo conferma.

## Archivio originale in caso di errore — fase 7

Se il caricamento fallisce, una lettura separata tenta di recuperare il record
originale senza upgrade, migrazione o salvataggio. Quando riesce, il comando
**Scarica archivio originale** genera
`meal-planner-original-archive-AAAA-MM-GG.json`. Il contenitore è
`meal-planner.backup` v1; `state` mantiene il contenuto e la versione salvati.

Il recupero richiede che lo storage sia accessibile e il contenitore fisico
riconoscibile. Non converte per tentativi uno stato sconosciuto, non abilita
le modifiche e non garantisce che l'app attuale possa ripristinarlo. Non
modificare manualmente `schemaVersion`: conservare il file per una versione
compatibile dell'app. La cache offline e gli aggiornamenti non cancellano
questi dati né la copia di recupero. Dettagli e procedura d'uso in
[PHASE_7_PWA.md](PHASE_7_PWA.md).

## File dimostrativi

- [shopping-backup.json](../examples/phase-6/shopping-backup.json):
  lista avanzata del 26–28 ottobre con conversioni, avanzi, basi distinte,
  quantità aumentata riaperta e aggiunte manuali.
- [shopping-list-it.txt](../examples/phase-6/shopping-list-it.txt) e
  [shopping-list-en.txt](../examples/phase-6/shopping-list-en.txt):
  la medesima lista nella UI italiana o inglese; i nomi degli ingredienti
  restano italiani.
- [calendar-assigned-it.diet](../examples/phase-4/calendar-assigned-it.diet):
  calendario esportato per il 27–29 ottobre 2026, con un orario modificato e
  quantità individuali, indipendentemente dalle persone impostate nei pasti.
- [full-backup-with-undo.json](../examples/phase-4/full-backup-with-undo.json):
  una sorgente italiana del 21–23 ottobre; assegnazione al 26–28 e successiva
  riassegnazione al 27–29 con sovrapposizioni; due record di importazione,
  persone e orari modificati, spunta della spesa, due voci manuali e annullamento
  disponibile. UI inglese e contenuti italiani mostrano la separazione delle lingue.

I file sono stati prodotti tramite le funzioni dell'app e riletti tecnicamente.
Contengono dati dichiaratamente fittizi per illustrare i flussi; non sono piani
personalizzati o esempi di correttezza nutrizionale.

## Riferimenti del contratto

- [Formato `.diet`](DIET_FORMAT.md) e [schema documentale](../schemas/diet.schema.json).
- [Stato e backup](STATE_AND_BACKUP.md), [schema dello stato](../schemas/app-state.schema.json)
  e [schema del backup](../schemas/backup.schema.json).
- [Architettura e verifica della fase 4](PHASE_4_STORAGE.md).

## Estensioni 1.1

Gli originali e il backup conservano `recipeId`, metriche per ingrediente,
`externalMeal`, `workday` e i metadati facoltativi del profilo. Il backup conserva
anche i tipi di giornata di date rimaste senza pasti. L’export `.diet` del
calendario continua a selezionare le date con pasti della sorgente scelta;
per trasferire tutto il contesto del calendario usare il backup completo.

La ricerca del ricettario è ricostruita dai piani e dal calendario. Non è un
secondo archivio di ricette modificabili; non duplica i dati nel backup. La
vista `recipes` può essere ripristinata come ultima schermata, mentre i filtri
di ricerca sono temporanei e tornano ai valori iniziali a una nuova apertura.
