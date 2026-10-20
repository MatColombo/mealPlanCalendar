# Fase 5 — calendario interattivo e gestione dei pasti

**Versione dell'app: 0.5.0.** Questa fase collega il calendario ai piani importati
e permette di modificare la data, l'ora e le persone del singolo pasto. Riusa
HTML, CSS e moduli JavaScript nativi, senza framework o dipendenze runtime.
La persistenza resta in IndexedDB.

Riferimenti: [PROJECT_BRIEF.md](PROJECT_BRIEF.md),
[DIET_FORMAT.md](DIET_FORMAT.md), [STATE_AND_BACKUP.md](STATE_AND_BACKUP.md)
e [EXPORT_FORMATS.md](EXPORT_FORMATS.md).

## Usare il calendario

1. Importare un `.diet` e confermare manualmente la data iniziale, oppure usare
   il piano dimostrativo disponibile in **Importa**.
2. Aprire **Calendario** e scegliere un giorno. Le schede mostrano nome, tipo,
   ora effettiva e kcal per persona; vengono ordinate per orario. A parità di
   ora l'ordine esistente resta stabile.
3. Aprire il nome del pasto o il pulsante con la freccia. Il dettaglio contiene
   ingredienti, quantità, unità, eventuale stato crudo/cotto/scolato, nutrizione
   disponibile e istruzioni del piano.
4. Usare i controlli descritti nella tabella seguente. Le conferme delle
   modifiche compaiono dopo il completamento del salvataggio.

| Controllo | Comportamento |
| --- | --- |
| Data del pasto | Mostra la data attuale e un'anteprima della destinazione; il pulsante **Sposta pasto** applica la modifica. La sola scelta della data non sposta nulla. |
| Ora del pasto | Salva l'orario modificato nella presenza del calendario; le schede si riordinano. |
| Persone per cui cucinare | Il campo numerico e i pulsanti meno/più aggiornano le quantità complessive da preparare. |
| Giorno precedente/successivo | Seleziona la giornata adiacente, anche se vuota. |
| Settimana precedente/successiva | Sposta la selezione di sette giorni. |
| Selezione diretta della data | Permette di raggiungere giornate passate o future senza scorrere tutto lo storico. |
| Oggi nel calendario | Seleziona la data locale corrente al momento del clic. |
| Navigazione principale Oggi | Mostra la giornata corrente e conserva l'ultima selezione del Calendario. |

La colonna delle date occupa una parte ridotta della vista desktop; il contenuto
della giornata prevale. Su mobile viene usata una striscia compatta delle date,
con il contenuto sotto a scorrimento verticale. Restano lo stile arrotondato,
le icone locali, le transizioni brevi e le preferenze di riduzione del movimento
della fase 3. Le date hanno etichette accessibili; selezionare un giorno aggiorna
il titolo e il messaggio di caricamento. Sui pulsanti delle date, le frecce della
tastiera permettono di muoversi di un giorno o di una settimana.

Le giornate vuote mostrano uno stato esplicito. Nessun limite viene applicato
alla navigazione in base alla durata di un piano; i giorni passati non scadono.

## Quantità da preparare e nutrizione personale

Il dettaglio separa tre informazioni:

- **Quantità da preparare per N persone:** quantità base moltiplicate per le
  persone impostate su quella presenza del pasto.
- **Base per una persona:** quantità originale, visibile sotto ogni ingrediente
  anche quando si cucina per più persone.
- **Nutrizione per 1 persona:** dati nutrizionali del pasto, indipendenti dal
  numero di persone per cui si cucina.

Esempio di sola aritmetica dell'interfaccia: se il file contiene 80 g di un
ingrediente e 500 kcal per un pasto, impostare due persone mostra 160 g da
preparare e mantiene 80 g come base individuale. Le kcal del pasto restano 500
per persona; il suo contributo al riepilogo giornaliero resta 500. Questo esempio
non attribuisce calorie all'ingrediente e non valuta la correttezza del piano.

Le calorie e i macro disponibili vengono letti dal documento. Un valore
mancante resta indicato come non disponibile; il programma non lo inventa.
La modifica delle persone non riscrive ingredienti o nutrizione nella sorgente.
Un pasto spostato contribuisce al riepilogo della destinazione e non più a quello
del giorno di origine.

La lingua dell'interfaccia può essere italiana o inglese. Nomi dei pasti,
ingredienti, note e istruzioni conservano la lingua del piano, anche dopo uno
spostamento o un cambio di lingua dell'app.

## Identità del pasto e salvataggio

`setEntryDate(state, entryId, assignedDate)` produce un nuovo stato candidato.
Sposta la stessa presenza del calendario: conserva `entryId`, `sourceId`,
`sourceDate`, `mealId`, `timeOverride`, `cookingServings` e le proprietà aggiuntive.
Non crea una nuova ricetta e non modifica il `.diet` originale.

La giornata di destinazione conserva tutti i pasti e i propri metadati. Se
non esiste, viene creata. La giornata di origine rimane selezionabile e può
restare vuota, conservando eventuali metadati. Spostare un pasto sulla propria
data è un'operazione senza cambiamenti.

Il controller prepara insieme lo spostamento, la riconciliazione della spesa
e la selezione della data di destinazione. Il repository salva questo candidato
in una sola transazione. Solo al completamento viene adottato come stato
applicativo; un errore o un annullamento della transazione lascia il pasto nella
posizione precedente. L'interfaccia mostra l'errore e mantiene disponibile la
lettura dell'archivio. Quota, conflitti fra schede e riapertura del repository
usano i messaggi e le procedure della [fase 4](PHASE_4_STORAGE.md).

Il campo della nuova data aggiorna solo l'anteprima e il pulsante durante la
digitazione: il form non viene ricreato alla perdita del focus, evitando che
il primo clic su **Sposta pasto** venga perso. Una data non interpretabile viene
segnalata senza modificare il calendario. Sono controlli tecnici, non dietetici.

## Continuità della navigazione

`ui.selectedDate` conserva l'ultima data selezionata nel Calendario. Prima della
prima visita può essere `null`; l'ingresso iniziale usa allora la data corrente.
Visitare Spesa, Impostazioni o Oggi non azzera la selezione.

Alla riapertura si carica prima lo stato salvato. Un URL senza una rotta
riconosciuta ripristina la vista conservata. Una rotta esplicita come
`#calendar/2026-10-29` ha precedenza; `#calendar` senza data riusa la selezione
salvata. Oggi usa l'orologio locale e si aggiorna al successivo rendering,
all'interazione di ritorno a oggi o quando la finestra torna in primo piano.

Indietro/Avanti del browser può cambiare la rotta durante un salvataggio.
Quella navigazione viene conservata e salvata dopo l'operazione in corso:
non viene annullata da una risposta tardiva. La coda usa lo stato più recente.
Un errore del successivo salvataggio della sola navigazione non cambia l'esito
di una modifica del calendario già confermata.

## Collegamento alla spesa

La lista legge le presenze nelle **date effettive**, nell'intervallo selezionato.
Spostare un pasto dentro o fuori da quell'intervallo aggiorna il fabbisogno senza
cambiare automaticamente l'intervallo scelto dall'utente.

| Modalità | Fattore applicato agli ingredienti individuali |
| --- | --- |
| Una persona (`one`) | 1 per ogni pasto nell'intervallo |
| Due persone (`two`) | 2 per ogni pasto nell'intervallo |
| Persone dei singoli pasti (`advanced`) | `cookingServings` della singola presenza |

Cambiare le persone influisce sulla modalità avanzata. Le prime due continuano
a usare il loro fattore fisso. Cambiare l'ora riordina i pasti, mantenendone le
quantità. Se un fabbisogno aumenta, la riconciliazione riapre l'eventuale spunta
associata secondo il comportamento già introdotto nella fase 4. Voci manuali,
preferenze e altre date rimangono nello stato.

Questi collegamenti sono operativi; gli ulteriori strumenti dedicati alla
lista della spesa restano nella fase 6.

## Avanzi, esportazione e annullamento

Le preparazioni condivise continuano a usare gli ingredienti attribuiti alla
porzione consumata in ciascun pasto, come previsto dal contratto `.diet`.
Non viene ripetuta l'intera ricetta quando si sposta un pasto con avanzi.

La fase 5 aggiunge due campi **facoltativi e compatibili con la versione 1**:

| Campo dello stato | Scopo |
| --- | --- |
| `calendar[date].meals[].assignmentId` | Mantiene stabile l'identità dell'assegnazione iniziale anche quando cambia la data del singolo pasto. Nelle nuove importazioni coincide con `importId`. |
| `lastImportUndo.entryIds` | Identifica le presenze create dall'ultima importazione, anche dopo spostamenti fuori dalle date iniziali. |

I backup v1 precedenti restano leggibili. Prima del primo spostamento vengono
ricostruiti i dati di provenienza mancanti usando lo storico disponibile, con
un'identità di compatibilità quando lo storico non è utilizzabile.

L'esportazione del calendario usa l'identità stabile dell'assegnazione per
distinguere i gruppi di preparazione: il collegamento fra preparazione e avanzi
rimane anche se uno dei pasti cambia giorno. Assegnazioni indipendenti dello
stesso piano mantengono gruppi distinti. Il `.diet` esportato conserva quantità
e nutrizione per una persona; il backup completo conserva anche le persone
impostate e l'ultima selezione del Calendario.

La conferma di **Annulla ultima importazione** distingue:

- le date inizialmente toccate, da ripristinare integralmente come già previsto
  dalla fase 4, sostituendo anche le modifiche successive in quelle giornate;
- le ulteriori destinazioni dei pasti spostati, dalle quali rimuovere soltanto
  le presenze di quell'importazione, conservando gli altri pasti e i metadati.

L'originale e il record storico rimangono disponibili. Questo è l'annullamento
dell'ultima importazione, non una cronologia di annullamenti delle singole
modifiche. Per invertire un normale spostamento, si sceglie nuovamente la data
desiderata dal dettaglio del pasto.

## Esempio incluso

[calendar-edits-backup.json](../examples/phase-5/calendar-edits-backup.json)
contiene un archivio dimostrativo completo, costruito con le API dell'app:

- due assegnazioni del piano dimostrativo italiano, con sovrapposizione;
- il pranzo con avanzi del 27 ottobre 2026 spostato al **29 ottobre, ore 14:15**;
- **due persone** su quel pasto, senza modificare la base individuale;
- cinque pasti nella destinazione, quattro dei quali già presenti;
- Calendario selezionato sul 29 ottobre e Spesa avanzata dal 26 al 30 ottobre;
- dati per annullare l'ultima importazione e rimuovere il solo pasto spostato
  dalla destinazione, lasciandovi gli altri quattro pasti.

Per provarlo, aprire **Impostazioni**, selezionare il backup e leggere il
riepilogo della sostituzione prima di confermare. Il ripristino sostituisce
l'archivio attivo; per conservare un archivio personale, esportarne prima un
backup. Aprire poi Calendario per ritrovare la selezione salvata. Gli esempi e
le stime nutrizionali della demo sono fittizi.

## Verifiche eseguite

Sono passati `npm run check` e `npm test`. Il controllo di sintassi ha letto
**33 moduli JavaScript** e **12 documenti JSON/`.diet`**. Gli otto file di test
contengono **65 casi**, tutti eseguiti anche direttamente con Node e superati,
senza casi saltati. I 14 nuovi casi della fase 5 coprono:

- spostamento verso una giornata occupata, identità, ordine e proprietà aperte;
- data non leggibile e spostamento sulla stessa data;
- gruppi di preparazione dopo spostamento ed esportazione;
- annullamento con pasti spostati, anche da un vecchio stato v1;
- ripristino della navigazione, rotta esplicita, ritorno a Oggi e cambio di giorno;
- riapertura del repository, ricalcolo della spesa e spunte;
- transazione annullata dopo la riuscita della singola richiesta di scrittura;
- backup, riapertura e annullamento conservando i pasti estranei all'importazione.

Le verifiche statiche ad hoc eseguite durante lo sviluppo comprendono 44
combinazioni di rendering e otto controlli mirati sull'anteprima dello spostamento;
sono distinte dalla suite `npm test`. I dizionari italiano e inglese
hanno 383 chiavi corrispondenti. L'audit dell'HTML generato non ha trovato ID
duplicati, riferimenti di etichette/ARIA mancanti o pulsanti privi di nome.
Queste verifiche riguardano struttura e comportamento del software; nessun
test valuta ricette, bilanciamento, correttezza nutrizionale o frequenze.
L'ultimo collegamento del pulsante Oggi all'orologio locale è stato controllato
separatamente nei sorgenti.

**Limite della verifica:** IndexedDB viene simulato nei test Node. Non è stata
eseguita una prova interattiva in un browser reale: il controllo browser
richiesto dalla skill Sites non è disponibile in questo ambiente. L'audit
statico non certifica il rendering effettivo sui dispositivi o il comportamento
dei controlli nativi nei vari browser.

## Moduli e consegna

| Area | File principali |
| --- | --- |
| Operazioni sui pasti | `src/data/session.js` |
| Provenienza dell'assegnazione | `src/data/provenance.js` |
| Rotte e selezione persistente | `src/data/navigation.js` |
| Importazione, spesa e annullamento | `src/data/imports.js` |
| Esportazione | `src/data/export.js` |
| Controller e commit UI | `src/main.js` |
| Viste, stile e traduzioni | `src/ui/render.js`, `src/ui/styles.css`, `src/ui/locales/` |
| Repository già esistente | `src/persistence/indexeddb.js`, `src/persistence/commit.js` |

`npm run build` genera i file statici in `dist/`, con percorsi relativi.
La consegna include sorgenti, documentazione, esempio e build. Le revisioni di
ricette e ingredienti restano nel flusso ChatGPT. Service worker, installazione
PWA e avvio offline restano nella fase 7; la pubblicazione su GitHub Pages
resta nella fase 8.
