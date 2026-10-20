# Fase 3 — interfaccia, navigazione e localizzazione

## Risultato e perimetro

Il progetto usa lo stack delle fondamenta: HTML, CSS e JavaScript con ES modules,
senza dipendenze runtime, CDN, font remoti o servizi AI. Questa fase realizza
l'interfaccia del prodotto con interazioni dimostrative nella sessione corrente.

La barra «Dati dimostrativi» rende esplicito che le modifiche durano fino alla
ricarica. Il repository è ancora quello in memoria. È possibile scaricare e
ripristinare un backup della sessione; IndexedDB, migrazioni e disponibilità
offline restano nelle fasi dedicate.

## Schermate

| Schermata | Interazioni disponibili |
| --- | --- |
| Oggi | Giornata locale del dispositivo, pasti selezionabili e riepilogo dei valori disponibili per persona. |
| Calendario | Settimana selezionabile, passaggio fra giorni e settimane, salto a una data e contenuto giornaliero corrispondente. |
| Dettaglio pasto | Ingredienti, basi di misura, istruzioni, note, orario modificabile e persone; quantità aggiornate senza alterare la sorgente. |
| Spesa | Intervallo inclusivo, tre modalità, raggruppamento per categoria, spunte e aggiunte manuali. |
| Importa | Lettura locale di un file oppure esempio, riepilogo, data iniziale, mappatura delle date e conferma esplicita delle sovrapposizioni. |
| Esporta | Download della copia originale di una sorgente oppure backup completo della sessione. |
| Impostazioni | Lingua, riduzione del movimento, inizio della settimana, backup, ripristino, svuotamento e ripartenza dalla demo. |

L'importazione applicata nella sessione sostituisce giornate intere soltanto
dopo la conferma delle date sovrapposte. Le sorgenti precedenti restano separate.
La procedura non offre ancora il flusso persistente e l'annullamento
dell'importazione previsti dalla fase 4.

Il comando **Piano originale** scarica intenzionalmente il documento importato,
con date e orari originali: l'etichetta e il testo di aiuto lo dichiarano.
Per conservare assegnazioni, orari modificati, persone, spunte e impostazioni
si usa il **backup**. L'esportazione .diet con date assegnate, descritta nel
contratto generale, resta da integrare nel flusso della fase 4.

## Direzione visiva e comportamento responsive

La palette combina carta crema, testo verde scuro, giallo, menta, corallo e
lavanda. Schede arrotondate, contorni leggibili, ombre leggere e illustrazioni
SVG locali formano un unico linguaggio visivo. Le immagini decorative non
aggiungono testo alle letture degli screen reader.

La navigazione principale contiene **Oggi, Calendario e Spesa**. Importa,
Esporta e Impostazioni sono accessibili dalla testata. Su mobile la navigazione
principale si trova in basso, con spazio riservato per non coprire il contenuto.

Il calendario usa una colonna settimanale stretta su desktop, ispirata al
rapporto 15%/85%, con una larghezza minima per conservare controlli comodi.
Una griglia mensile di sette colonne dentro il 15% avrebbe reso i pulsanti
troppo piccoli: per questo i sette giorni sono disposti in verticale.
Su mobile diventano una striscia compatta in alto, che rimane raggiungibile
durante lo scorrimento. Il contenuto della giornata occupa lo spazio principale
a scorrimento verticale. La data selezionata viene riportata nella parte
visibile della striscia anche sugli schermi più stretti.

La selezione di un giorno aggiorna data, elenco dei pasti e riepilogo.
Frecce, selettore data e navigazione da tastiera permettono di passare anche a
giorni vuoti. Lo stato selezionato non si affida soltanto al colore.

Le transizioni sono brevi e accompagnano il cambio di vista, l'apertura del
dettaglio e le azioni sui controlli. La preferenza CSS
`prefers-reduced-motion: reduce` e l'impostazione manuale dell'app disattivano
il movimento. La preferenza del dispositivo non viene annullata da quella
dell'app. Il comportamento segue le indicazioni
[MDN sulle preferenze di movimento](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion).

## Componenti e responsabilità

| File o cartella | Responsabilità |
| --- | --- |
| `src/main.js` | Eventi delegati, navigazione a frammenti URL, stato delle finestre, focus, lettura/download file e repository di sessione. |
| `src/ui/render.js` | Composizione delle viste e dei dialoghi, senza mutare lo stato. |
| `src/ui/components.js` | Pulsanti, azioni a icona, schede pasto, riepilogo, ingredienti e stati vuoti riutilizzabili. |
| `src/ui/icons.js` | Icone e illustrazioni vettoriali coerenti. |
| `src/ui/tokens.css` | Colori, tipografia, raggi, ombre e movimento. |
| `src/ui/styles.css` | Layout, componenti, breakpoint, focus e riduzione delle animazioni. |
| `src/ui/locales/it.js`, `en.js` | Dizionari dell'interfaccia. |
| `src/ui/i18n.js` | Testi con parametri, date, orari, numeri, unità e codici localizzati. |
| `src/data/demo.js` | Inizializzazione del calendario dimostrativo dalla data locale corrente. |
| `src/data/session.js` | Risoluzione delle presenze, anteprima/importazione in memoria e modifiche delle occorrenze. |
| `src/shopping/quantities.js` | Funzioni aritmetiche delle fondamenta, riutilizzate per quantità e aggregazione. |
| `src/persistence/repository.js` | Adattatore asincrono in memoria già presente. |
| `examples/phase-3/ui-demo-it.diet` | Dati dichiaratamente fittizi per mostrare tutte le viste. |

Le rotte sono frammenti come `#today`, `#calendar/2026-10-21`,
`#shopping` e `#settings`. Non richiedono riscritture lato server e mantengono
la compatibilità con un percorso di progetto su GitHub Pages.

## Italiano e inglese

Il cambio di lingua aggiorna navigazione, messaggi, date, numeri, unità,
categorie note, tipi di pasto, basi di misura, controlli e testi accessibili.
Il documento originale non viene tradotto o riscritto.

Titoli, ingredienti, note e istruzioni rimangono nella lingua del piano. I
codici personalizzati che non hanno un'etichetta nel dizionario rimangono
rappresentabili con il loro valore originale. I testi importati sono inseriti
come testo HTML escapato, anche negli attributi.

La demo usa un piano italiano: selezionare English permette di osservare
direttamente il confine fra interfaccia tradotta e contenuti invariati.

## Stato dei dati e quantità

La prima data della sorgente dimostrativa viene assegnata al giorno locale
corrente. Le date originali restano nel documento congelato; il calendario
contiene i riferimenti e gli eventuali override.

Le persone iniziano a 1. Modificarle aggiorna gli ingredienti del dettaglio
e il calcolo della spesa avanzata. Le modalità «una persona» e «due persone»
usano invece i rispettivi moltiplicatori fissi per tutto l'intervallo.
Le aggiunte manuali contengono quantità assolute.

Il riepilogo nutrizionale usa i valori base dei pasti. Una metrica mancante
resta non disponibile anche nel totale, secondo il contratto. I numeri della
demo sono fittizi e servono a illustrare la presentazione: non sono una
proposta personalizzata né una valutazione dei pasti.

## Accessibilità e conferme

- Elementi HTML nativi per pulsanti, campi, checkbox e dialoghi.
- Etichette accessibili e focus visibile; ritorno del focus dopo la chiusura.
- Chiusura dei dialoghi con Escape.
- Messaggi di stato e indicazione della giornata selezionata.
- Conferma prima di sostituire giorni, ripristinare un backup o svuotare la sessione.
- Stati vuoti per giornate, spesa, importazione ed esportazione.
- Errori tecnici localizzati senza esporre messaggi interni in inglese.

I dialoghi usano `showModal()`: il browser gestisce il livello modale e
l'interazione con il contenuto circostante. Riferimento:
[MDN — elemento dialog](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog).

## Verifica

Le verifiche della consegna riguardano sintassi, riferimenti, struttura dei
dizionari, rappresentazione dei dati, conservazione delle sorgenti e
interazioni di sessione. Non vengono introdotti validatori o test di ricette,
bilanciamento, calorie, macro, frequenze o correttezza alimentare.

Risultati della verifica tecnica della fase 3:

| Controllo | Esito |
| --- | --- |
| Sintassi e riferimenti locali | 20 moduli JavaScript e 9 documenti JSON/.diet leggibili; riferimenti presenti. |
| Test delle fondamenta e della sessione | Entrambi i file di test superati; nessun errore. |
| Dizionari | 280 chiavi corrispondenti in italiano e inglese. |
| Composizione statica delle viste | 52 combinazioni fra lingue, schermate, stati e dialoghi senza eccezioni. |
| Collegamenti nel markup | Nessun ID duplicato, label senza destinazione, pulsante senza nome o riferimento ARIA assente nei casi esaminati. |

Il controllo del markup include 544 occorrenze di ID, 236 destinazioni di
etichette e 538 pulsanti. Si tratta di verifiche del documento generato,
non dell'albero di accessibilità o dell'impaginazione di un browser.

In questo ambiente la skill Sites consente il controllo del browser gestito
soltanto tramite la skill `control-browser`, che non è disponibile.
Non sono quindi stati eseguiti screenshot o prove in un browser reale.
I layout e le regole responsive sono implementati; la verifica visuale su
dispositivi reali resta un limite esplicito della consegna.

Per eseguire il progetto: `npm run dev`. Per i controlli tecnici:
`npm run check` e `npm test`. `npm run build` produce la cartella statica `dist/`.
