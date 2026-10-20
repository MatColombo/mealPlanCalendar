# Fase 6 — lista della spesa

**Versione dell'app: 0.6.0.** La schermata Spesa usa i pasti effettivamente
presenti nel calendario, salva le preferenze e le spunte in IndexedDB e
permette di aggiungere articoli manuali e ottenere una checklist in testo.
Il progetto conserva HTML, CSS e moduli JavaScript nativi, senza nuove
dipendenze runtime. I formati `.diet`, stato e backup rimangono alla versione 1.

Riferimenti: [PROJECT_BRIEF.md](PROJECT_BRIEF.md),
[DIET_FORMAT.md](DIET_FORMAT.md), [STATE_AND_BACKUP.md](STATE_AND_BACKUP.md)
e [EXPORT_FORMATS.md](EXPORT_FORMATS.md).

## Usare la lista

1. Aprire **Spesa** e scegliere la data iniziale e quella finale. Entrambe
   sono incluse nel calcolo. Si può scegliere anche un singolo giorno.
2. Scegliere **Una persona**, **Due persone** oppure la modalità avanzata,
   che usa le persone impostate nei singoli pasti del calendario.
3. Consultare le categorie, le quantità e l'eventuale base di misurazione;
   spuntare gli articoli acquistati. Il progresso comprende sia gli
   ingredienti dei pasti sia le aggiunte manuali.
4. Aggiungere gli articoli extra con nome, quantità, unità e categoria.
5. Usare **Copia lista** oppure **Scarica .txt** per ottenere il testo corrente.

La lista comprende tutti i piani presenti nel periodo, senza limitarsi
all'ultima importazione. Legge le date effettive assegnate nel calendario,
anche quando un pasto è stato spostato rispetto al `.diet` originale.
Le giornate senza pasti non aggiungono quantità. Spostare un pasto dentro o
fuori dal periodo modifica il fabbisogno, senza cambiare il periodo scelto.

La schermata presenta uno stato vuoto quando mancano pasti nell'intervallo.
Le voci manuali restano disponibili anche in quel caso e anche senza un
intervallo impostato. La disposizione dei controlli si adatta alla larghezza
disponibile; restano etichette accessibili, stile arrotondato e riduzione
delle animazioni della fase 3.

## Tre modalità, un solo piano originale

Per ogni ingrediente, `q` è la quantità originale per una persona e `s`
è `cookingServings` della sua presenza nel calendario.

| Modalità | Fattore per ciascun pasto | Quantità prima dell'aggregazione |
| --- | --- | --- |
| Una persona — `one` | 1 | `q` |
| Due persone — `two` | 2 | `q × 2` |
| Avanzata — `advanced` | Persone salvate sul singolo pasto | `q × s` |

Il cambio di modalità salva la scelta e ricalcola la spesa. Non modifica
`cookingServings` nel calendario: tornando alla modalità avanzata, le
impostazioni di ciascun pasto sono ancora disponibili. Gli ingredienti nei
documenti sorgente rimangono individuali. I riepiloghi nutrizionali personali
continuano a usare i dati per una persona, indipendentemente dalla modalità.

Cambiare le persone di un pasto influisce sulla spesa avanzata. Le modalità
con fattore fisso restano rispettivamente a uno e due. La modifica dell'ora
può cambiare l'ordine dei pasti, ma non le quantità da acquistare.

## Identità, unità e base di misurazione

Una riga aggregata è identificata da questa terna:

```js
[ingredientId, unitàCanonica, basis ?? null]
```

Gli ingredienti vengono uniti in base all'identificativo stabile, anche se
il nome visualizzato differisce. Il nome non viene usato per indovinare
equivalenze: due identificativi diversi restano distinti. Nome, categoria e
metadati visualizzati provengono dal primo ingrediente del gruppo.

| Quantità in ingresso | Comportamento |
| --- | --- |
| kg e g, stesso ID e stessa base | Conversione in g e somma. |
| l e ml, stesso ID e stessa base | Conversione in ml e somma. |
| Pezzi e g senza conversione dichiarata | Righe distinte. |
| g e ml senza conversione dichiarata | Righe distinte. |
| Stesso ID e unità, basi `raw` e `cooked` | Righe distinte. |
| Base assente e base dichiarata | Righe distinte. |
| Unità personalizzate uguali e stessa base | Somma nella medesima unità. |

La normalizzazione metrica riconosce anche maiuscole e spazi esterni delle
sigle kg, g, l e ml. Le altre unità rimangono quelle fornite. Non vengono
dedotte densità, pesi dei pezzi o trasformazioni fra crudo, cotto e scolato.

### Conversione esplicita facoltativa

La fase 6 documenta il campo facoltativo `unitConversion` su un ingrediente:

```json
{
  "ingredientId": "apple",
  "name": "Mela",
  "quantity": 1,
  "unit": "unit",
  "basis": "raw",
  "unitConversion": { "toUnit": "g", "factor": 150 }
}
```

In questo esempio software, una unità originale equivale a 150 g. Il fattore
è fornito dal documento e non viene stimato dall'app. La conversione vale
solo per quella riga: un'altra mela in pezzi senza dichiarazione resta in
pezzi. La destinazione viene poi normalizzata se è kg o l. La base resta
quella originale, quindi la conversione non unisce quantità crude e cotte.

Il lettore verifica soltanto che la dichiarazione sia interpretabile:
destinazione testuale non vuota e fattore numerico finito positivo. Non
verifica la plausibilità dell'equivalenza. Il `.diet` originale e il backup
conservano il campo; nella riga derivata il campo viene consumato una sola
volta e rimosso, evitando una seconda applicazione accidentale.

Le somme usano un accumulo compensato per ridurre la perdita di precisione
floating point. Non si arrotondano i dati durante il calcolo. Un risultato
non finito produce un errore tecnico visibile, invece di una quantità
apparentemente valida. Non vengono applicate regole su ricette, bilanciamento,
calorie, macro o frequenze alimentari.

## Avanzi e preparazioni condivise

Il contratto `.diet` attribuisce a ogni pasto solo gli ingredienti della
porzione consumata in quel pasto. La lista somma queste attribuzioni.
`preparation.batchId` collega i pasti della preparazione; `preparedServings`
documenta l'organizzazione della cucina e non è un moltiplicatore della spesa.

Per esempio, una cena contiene 80 g di riso e il pranzo con avanzi del giorno
seguente contiene altri 80 g, entrambi riferiti a una persona. Se entrambi
i pasti rientrano nel periodo, la modalità una persona conta 160 g. Se si
seleziona solo il pranzo, conta 80 g. Non ripete l'intera preparazione e non
elimina il pranzo perché condivide il `batchId` con la cena.

La lista rappresenta le quantità attribuite ai pasti selezionati. Non sposta
automaticamente tutti gli acquisti alla data di preparazione e non sottrae
ingredienti già in dispensa o già cucinati. Le spunte servono a registrare
gli acquisti sulla checklist corrente.

## Spunte e ricalcolo

Ogni gesto esplicito su una spunta registra la quantità corrente e l'unità.
Quel valore è il riferimento per riconoscere aumenti successivi.

| Evento | Effetto sulla checklist |
| --- | --- |
| Quantità richiesta superiore a quella spuntata | La voce torna da acquistare e mostra **Quantità aumentata**, quantità precedente e totale attuale. |
| Quantità ridotta su una voce ancora spuntata | La spunta può rimanere attiva. |
| Quantità ridotta dopo una riapertura automatica | La voce resta aperta; non viene rispuntata automaticamente. |
| Nuovo gesto esplicito sulla spunta | Registra la quantità attuale e rimuove l'indicazione di riapertura. |
| Voce che scompare dal fabbisogno | Il record storico diventa non spuntato; se la voce ritorna, rimane da acquistare. |
| Cambio effettivo dell'intervallo | Inizia una nuova checklist per gli ingredienti dei pasti: le relative spunte si riaprono. |
| Stesso intervallo confermato di nuovo | Nessun azzeramento delle spunte. |
| Cambio di modalità | Usa il confronto delle quantità, conservando le persone nel calendario. |

Il cambio di intervallo conserva quantità e spunte degli articoli manuali.
Questa scelta è spiegata sotto i controlli delle date: una checklist per un
nuovo periodo non eredita automaticamente gli acquisti della precedente.

Esempio: 250 g di mele sono spuntati; il fabbisogno diventa 600 g. La riga
si riapre e mostra entrambi i valori. Il nuovo totale è 600 g; il software
non presenta automaticamente 350 g come quantità residua, perché la spunta
non è un registro delle quantità effettivamente presenti in dispensa.

Il confronto ignora solo pochi errori relativi di rappresentazione dei numeri
in JavaScript. Non usa una tolleranza fissa in grammi o una soglia alimentare.
Il flag facoltativo `reopened` mantiene la spiegazione dopo il salvataggio;
un'eventuale diminuzione può nascondere il badge senza perdere il riferimento
per un nuovo aumento. La lettura della lista applica la medesima politica
anche alle spunte insufficienti di un vecchio backup.

Importazione, annullamento, spostamento di un pasto e modifica delle persone
richiamano la stessa riconciliazione. Righe derivate e conteggi vengono
ricalcolati dallo stato corrente: non esiste una seconda copia dei totali
da aggiornare separatamente.

## Voci manuali e lingua

Il form richiede nome, quantità finita positiva, unità e categoria. Oltre
alle unità proposte, **Altra unità** permette di inserire un testo come
`rotolo` o `confezione`. Le voci hanno un proprio identificativo; nomi uguali
non causano fusioni con altre aggiunte o con gli ingredienti del piano.

Le quantità manuali sono assolute: due sacchetti restano due quando si
passa da una a due persone. Cambiare periodo, pasti o persone non ne cambia
quantità e spunte. Si possono spuntare e rimuovere. Per correggere un articolo
manuale si può rimuoverlo e aggiungerlo nuovamente; questa versione non
include un modulo di modifica della voce esistente.

I vecchi backup v1 che contengono articoli senza quantità restano leggibili.
La schermata indica il dato mancante e consente di spuntare o rimuovere
la voce; non inventa un numero predefinito.

Categorie standard, controlli, messaggi, date e unità note seguono la lingua
italiana o inglese dell'interfaccia. Le categorie personalizzate, i nomi
degli ingredienti, i nomi manuali e le unità personalizzate conservano il
testo fornito. Gli articoli sono ordinati per categoria e nome, con le
aggiunte manuali in una sezione distinta.

La formattazione usa fino a 12 cifre significative. Per quantità non nulle
molto piccole o molto grandi usa la notazione scientifica, evitando di
mostrare zero al posto di un valore finito positivo. La formattazione non
riscrive le quantità nei dati.

## Copia, download e backup

**Copia lista** e **Scarica .txt** producono una fotografia della checklist:
periodo, modalità, pasti inclusi, progresso, categorie e righe con `[ ]` o
`[x]`, quantità e base di misurazione. Le righe riaperte includono anche
il valore precedente. I manuali sono separati e mantengono quantità esplicite.

Il testo include le voci già acquistate, così conserva lo stato completo
della lista. Un nome multilinea viene reso su una riga. È possibile copiare
o scaricare una lista composta soltanto da aggiunte manuali, anche senza
date. Una lista completamente vuota disabilita entrambi i comandi.

Se la copia negli appunti non è disponibile o viene negata, il dialog mostra
il testo selezionabile e un comando di selezione. Il download rimane
disponibile e usa esattamente il testo mostrato nel dialog. Non viene
inviato nulla a un destinatario.

Esempio di nome del file:
`meal-planner-shopping-2026-10-26_2026-10-28-it.txt`.
Senza periodo viene usato `meal-planner-shopping-manual-it.txt`.
Il testo non è un formato importabile. Per trasferire o ripristinare
modalità, intervallo, spunte e voci manuali si usa il **backup completo**.
Il singolo `.diet` conserva il piano per una persona e le sue dichiarazioni
originali, senza incorporare la checklist dell'app.

## Persistenza ed errori

Le operazioni preparano uno stato candidato separato dall'archivio corrente.
La conferma e la nuova vista persistente vengono adottate solo dopo il
completamento della transazione IndexedDB. Una scrittura fallita conserva
lo stato precedente; non mostra come salvata una spunta che non lo è.

Modalità, intervallo, spunte, riferimento delle quantità e voci manuali
vengono ritrovati alla riapertura e nel backup. La struttura documentale
dello stato aggiunge soltanto il flag facoltativo `reopened`, mantenendo
la compatibilità v1.

Gli errori dello storage usano il comportamento già presente: archivio
leggibile in sola lettura, messaggio e riprova, senza passaggio silenzioso
a una memoria volatile. Un errore aritmetico della spesa mostra un avviso,
conserva la consultazione dei manuali e disabilita il download di totali
incompleti. Anche il dettaglio del pasto gestisce un eventuale overflow
delle quantità moltiplicate: mostra l'avviso al posto dell'elenco ingredienti
e mantiene disponibili data, ora, persone e riepilogo nutrizionale personale.

## Esempio completo incluso

| File | Contenuto |
| --- | --- |
| [shopping-demo-it.diet](../examples/phase-6/shopping-demo-it.diet) | Cinque pasti parziali dal 26 al 28 ottobre 2026, con conversioni e avanzi. |
| [shopping-backup.json](../examples/phase-6/shopping-backup.json) | Lo stesso piano assegnato, persone diverse, modalità avanzata, due manuali e una voce riaperta. |
| [shopping-list-it.txt](../examples/phase-6/shopping-list-it.txt) | Esportazione del backup con interfaccia italiana. |
| [shopping-list-en.txt](../examples/phase-6/shopping-list-en.txt) | Stessa checklist con interfaccia inglese; i nomi degli ingredienti rimangono italiani. |

Per provare il piano usare **Importa** e confermare la data suggerita.
Per ritrovare direttamente spunte, modalità e persone aprire
**Impostazioni**, scegliere il backup e leggere il riepilogo prima di
confermare il ripristino. Il ripristino sostituisce l'archivio attivo;
esportare un backup prima di sostituire dati personali da conservare.

Nel backup lo spuntino del 27 ottobre ha due persone e la cena del 28
ne ha tre; gli altri pasti ne hanno una. Il riso crudo è attribuito alla
cena del 26 e al pranzo con avanzi del 27. Il risultato sul periodo completo è:

| Riga | Una persona | Due persone | Avanzata |
| --- | ---: | ---: | ---: |
| Latte, come acquistato | 300 ml | 600 ml | 500 ml |
| Riso crudo | 160 g | 320 g | 160 g |
| Zucchine crude | 300 g | 600 g | 300 g |
| Mela, peso crudo | 250 g | 500 g | 600 g |
| Riso cotto | 150 g | 300 g | 450 g |
| Mela, pezzi senza conversione | 1 pezzo | 2 pezzi | 3 pezzi |

Le mele dello spuntino hanno una conversione esplicita fittizia di 150 g
per pezzo. Quella dichiarazione non viene trasferita alla mela in pezzi
del 28 ottobre. Nel backup i 250 g iniziali di mele sono stati spuntati
prima di passare ad avanzata: i 600 g richiesti mostrano la riapertura.
Il riso crudo resta spuntato a 160 g. **Sacchetti, 2 pezzi** è spuntato;
**Carta forno, 1 rotolo** è aperto. Il progresso finale è 2 voci acquistate
su 8: sei aggregate e due manuali.

I dati sono dimostrativi, le giornate parziali e le equivalenze scelte
per rendere riconoscibili i calcoli. Non sono una proposta alimentare
personalizzata e non includono valori nutrizionali da valutare.

## Moduli e API

| Modulo | Responsabilità |
| --- | --- |
| `src/shopping/quantities.js` | Moltiplicatori, conversione locale esplicita, normalizzazione e aggregazione con somme compensate. |
| `src/shopping/list.js` | Snapshot derivato, regole delle spunte, intervallo, modalità e operazioni sui manuali. |
| `src/data/session.js` | Lettura tecnica del piano e risoluzione dei pasti nell'intervallo effettivo. |
| `src/data/imports.js` | Richiamo della riconciliazione condivisa dopo importazione e annullamento. |
| `src/ui/shopping-output.js` | Ordinamento per categorie, testo della lista e nomi dei download. |
| `src/ui/i18n.js`, `src/ui/locales/` | Quantità leggibili, unità, categorie e messaggi IT/EN. |
| `src/ui/render.js`, `src/ui/styles.css` | Schermata, form, righe riaperte, stati vuoti e dialog di copia. |
| `src/main.js` | Collegamento dei controlli, candidati, salvataggi, copia e download. |
| `src/persistence/` | Repository e commit atomico già introdotti nelle fasi precedenti. |

Le API pure della lista espongono una vista derivata o restituiscono nuovi
candidati, senza scrivere nel repository e senza modificare i piani originali:

```js
getShoppingList(state)
reconcileShoppingChecks(state, { now })
setShoppingRange(state, { startDate, endDate }, { now })
setShoppingMode(state, mode, { now })
setShoppingItemChecked(state, key, checked, { now })
addManualItem(state, item, { itemId, now })
setManualItemChecked(state, itemId, checked, { now })
removeManualItem(state, itemId, { now })
```

Gli oggetti opzione sono facoltativi. Lo snapshot `getShoppingList`
contiene `rows`, `manualItems`, `mode`, `range`, `mealCount`,
`generatedCount`, `manualCount`, `checkedCount`, `totalCount` e
`reopenedCount`. Le righe derivate includono `checked`, `reopened`
e `previousQuantity` per mostrare lo stato effettivo della checklist.

## Verifiche eseguite e limiti

Il controllo `npm run check` ha superato sintassi e riferimenti locali su
**38 moduli JavaScript** e **14 documenti JSON/`.diet`**. La suite completa
contiene **80 casi in 11 file**, tutti superati senza casi saltati.
In questo ambiente è stata eseguita direttamente con:

```bash
node --test --test-isolation=none --test-reporter=tap tests/*.test.mjs
```

I 15 nuovi casi della fase 6 verificano somme e tre moltiplicatori,
intervalli inclusivi con più sorgenti, conversioni esplicite e automatiche,
separazione delle basi, avanzi, immutabilità delle sorgenti, quantità
manuali, spunte e aumenti molto piccoli, spostamenti, backup e annullamento.
Comprendono inoltre un abort della transazione dopo la riuscita della
richiesta `put`, seguito da riprova, e l'output IT/EN con unità personalizzate.
I test IndexedDB usano la dipendenza di sviluppo `fake-indexeddb`.

Le verifiche statiche ad hoc dell'interfaccia, separate dalla suite,
hanno coperto **32 snapshot HTML**, **419 chiavi IT/EN corrispondenti**
con gli stessi parametri e **39 controlli dei formatter**. L'audit ha
verificato ID, etichette, riferimenti ARIA, nomi dei controlli, progresso
e testo del dialog. Sono rappresentati stato vuoto, soli manuali, quantità
riaperte, dati legacy, errori di calcolo, sola lettura e overflow nel dettaglio.

**Limite della verifica:** non è stata eseguita una prova interattiva in un
browser reale. Il controllo browser richiesto dalla skill Sites non è
disponibile in questo ambiente. Gli audit statici non certificano il
rendering sui dispositivi, i controlli nativi, il permesso degli appunti
o la persistenza effettiva di ogni browser. Non vengono dichiarati collaudi
visivi o prove offline non eseguiti.

`npm run build` genera la consegna statica in `dist/`, con percorsi relativi.
Il pacchetto include sorgenti, test, documentazione, esempi e build.
Service worker, installazione PWA e caricamento offline restano nella
fase 7; la pubblicazione su GitHub Pages resta nella fase 8.
