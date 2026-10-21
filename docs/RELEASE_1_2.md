# Meal Planner 1.2.0

Aggiornamento dell'interfaccia e della lista della spesa. Formati `.diet`, stato e backup ancora **v1**.

## Stato della consegna

Sorgenti e distribuzione compilata pronti. **Questa release non è stata pubblicata dalla sessione.** La base utilizzata è il pacchetto 1.1.0 consegnato in precedenza, non una copia sincronizzata del ramo remoto. Le personalizzazioni del workflow fatte successivamente su GitHub non vengono sostituite dal pacchetto incrementale. Non si dichiara risolto o ricollaudato il precedente errore HTTP su `sw.js`.

## Cosa cambia

| Area | Comportamento |
| --- | --- |
| Spesa | Checkbox indipendenti **Escludi spuntini** e **Escludi colazioni**. |
| Categorie | Sezioni affiancate con scorrimento orizzontale; elenco di ogni categoria scorre in verticale. Pulsanti categoria e frecce utilizzabili anche senza gesto touch. |
| Pasti | Schede compatte, macro `P: / G: / C:` in una riga. Sotto l'avatar: icona persone, controllo meno/numero/più e minuti di preparazione quando dichiarati. |
| Oggi | Riepilogo e schede complete impilate verticalmente; ingredienti e istruzioni visibili. Nessuna inclinazione, rimbalzo o animazione di ingresso. Lo scorrimento della pagina è nativo. |
| Calendario | Schede dei pasti in un carosello orizzontale; dettaglio completo apribile dal titolo. Selezione date e modifiche persistenti restano disponibili. |
| Testata | Icona e nome app, nome pagina, occhiello breve; rimosse le informazioni ripetitive. |
| Navigazione | Oggi, Calendario, Spesa, Ricettario, Impostazioni. Importa ed Esporta sono dentro **Impostazioni → File e dati**. Restano i collegamenti contestuali quando utili, come l'importazione da un calendario vuoto. |
| Ricettario | La ricerca per ingrediente mostra prima il gruppo ingrediente con nomi dei pasti, date effettive, orari e conteggi; seguono le ricette pertinenti. |

Gli stati ordinari di salvataggio restano annunciati alle tecnologie assistive senza aggiungere una riga alla testata. Errori, offline e aggiornamenti disponibili non vengono nascosti. Stato PWA dettagliato, lingua, backup e impostazioni sono nella pagina Impostazioni.

## Esclusioni e quantità

I filtri usano i codici strutturati `meal.type === "breakfast"` e `meal.type === "snack"`. Non cercano parole nel titolo e non rimuovono globalmente gli ingredienti condivisi.

Esempio aritmetico: un ingrediente presente per 10 g a colazione e 30 g a pranzo contribuisce per **30 g** dopo l'esclusione della colazione. Il pranzo resta nella lista. La modalità a due persone porta quel contributo a 60 g, senza cambiare il numero di persone salvato nel calendario.

Sono considerate le date effettive e gli estremi inclusivi dell'intervallo. Voci manuali, persone dei pasti e sorgenti originali rimangono invariati. I filtri vengono salvati con lo stesso percorso atomico IndexedDB dello stato; sono inclusi nel backup, non nel piano `.diet`.

```json
"shopping": {
  "mode": "advanced",
  "excludedMealTypes": ["breakfast", "snack"]
}
```

Il frammento illustra soltanto i campi interessati, non un backup completo. Nei backup precedenti il campo può mancare: equivale a nessuna esclusione. Non è necessaria una migrazione dello schema.

Quando un pasto torna incluso e aumenta una quantità già acquistata, la voce viene riaperta usando la precedente quantità confermata. Le esclusioni compaiono anche nel testo copiato o esportato. Voci manuali visibili nella propria categoria non vengono duplicate; l'esportazione mantiene una sezione manuale distinta con quantità assolute.

## Perché alcune liste erano tutte in Altro

La categoria è un metadato della riga ingrediente. In assenza di `category`, l'app precedente usava `other`. Non era un errore delle somme.

La presentazione 1.2 usa questa precedenza:

1. Categoria esplicita non vuota nel file: rispettata, anche se personalizzata o uguale a `other`.
2. Categoria associata all'`ingredientId` esatto nel piccolo catalogo offline `src/shopping/categories.js`.
3. `other` per un ID non conosciuto.

Il catalogo copre alcuni ingredienti comuni; non è un classificatore universale. Non usa somiglianze di nome per indovinare prodotti e non modifica i documenti importati. Le categorie standard sono `produce`, `grains`, `protein`, `dairy`, `pantry`, `other`. Per i nuovi piani, chiedere all'agente di scrivere `category` su ogni riga.

Il ripiego è applicato a vista e testo esportato e funziona anche sui piani già importati, senza una nuova importazione. L'aggregazione continua a distinguere ID, unità compatibili e base crudo/cotto/scolato; la categoria non definisce equivalenze di prodotto.

## Scorrimento e schede

I caroselli sono contenitori di scorrimento nativo con CSS scroll snap di prossimità. Non si intercettano wheel o touch per simulare trascinamenti. Ogni categoria ha il proprio elenco verticale, accessibile da tastiera. La posizione orizzontale e la posizione verticale degli elenchi sono conservate durante i ridisegni dell'interfaccia, per esempio quando si spunta un articolo. Il form per una voce manuale resta aperto mentre si cambia unità o si salva.

Le posizioni di scorrimento sono **memoria temporanea della sessione**, non dati del backup; i filtri, le spunte e le voci manuali sono invece persistenti. La memoria delle posizioni è limitata, per non accumulare dati navigando anni di calendario.

I pulsanti persone mantengono nomi accessibili completi anche quando il testo visivo è sostituito dall'icona. Le abbreviazioni macro hanno etichette accessibili; in inglese si usa `F:` per i grassi. Minuti, macro sconosciuti e dati parziali non vengono inventati.

## Ricerca ingrediente

Con ambito **Ingredienti**, oppure **Tutto** quando il testo corrisponde a un ingrediente, i risultati iniziano con gli ingredienti distinti per ID. Per ciascuno si vedono le ricette e le occorrenze effettive, deduplicate per `entryId`, nelle sezioni da oggi in avanti, passato e totale. Le occorrenze indicano il nome del pasto oltre alla data e all'orario.

Sotto vengono mostrate le schede delle ricette. I filtri di tipo, categoria e presenza restano disponibili. Cliccare il nome di un ingrediente in una ricetta apre una ricerca con ID esatto, evitando corrispondenze accidentali con nomi simili. Digitando una nuova ricerca, l'ID precedente viene rimosso. Ricette non assegnate possono essere trovate ma non generano date fittizie. I testi del piano restano nella loro lingua originale.

## Verifiche effettivamente eseguite

- **118 test software passati**, in 17 file indipendenti da `fake-indexeddb`, con Node 22.16.0. Di questi, 12 casi sono nuovi per esclusioni, categorie, backup, ricerca ingrediente e nuova struttura delle viste. Le asserzioni UI preesistenti sono state aggiornate solo per i cambiamenti intenzionali di markup.
- **50 combinazioni di layout** in Chromium: Oggi, Calendario, Spesa, Ricettario, Impostazioni; lingue IT/EN; larghezze 320, 375, 390, 768, 1280 pixel. Nessun overflow orizzontale della pagina, comandi persone contenuti, macro su una sola riga e ID HTML unici.
- **10 controlli DOM/scorrimento**: scroll orizzontale categorie e pasti calendario, scroll verticale degli item, navigazione categorie, indicatore categoria attiva, mantenimento posizioni dopo ridisegno, form manuale aperto, checkbox indipendenti, scorrimento nativo da tastiera e assenza di animazioni/transizioni CSS in Oggi.
- Verifica di sintassi, riferimenti, inventario offline, build e corrispondenza dei file distribuiti.

Le prove Chromium usano HTML prodotto dai componenti reali e CSS reale, caricati in una pagina vuota con `set_content`; il modulo di scorrimento viene eseguito sul DOM. **Non sono un collaudo end-to-end dell'app completa.** La navigazione del browser verso il server locale era bloccata dalla configurazione dell'ambiente.

La dipendenza `fake-indexeddb` non era disponibile e non poteva essere scaricata. Gli altri 8 file di test che la richiedono **non sono stati rieseguiti**. Il normale workflow Node 24 deve eseguire `npm ci`, `npm run check`, `npm test`, build e verifica completa. Il test del nuovo campo attraverso backup e repository in memoria non costituisce da solo una prova di persistenza reale IndexedDB.

Non verificati: Safari/iPhone, installazione PWA, selettore File iOS, rete realmente disconnessa, conservazione IndexedDB dopo chiusura e aggiornamento della release pubblica. Nessun test valuta validità di ricette, bilanciamento, adeguatezza nutrizionale o rispetto di obiettivi alimentari.

## Aggiornare il repository

Conservare un backup dall'app prima di aggiornare. Applicare i file del pacchetto incrementale alla radice del repository (la stessa cartella di `package.json`), senza rimuovere gli altri file. Il pacchetto non contiene `.github/workflows/pages.yml`: le correzioni locali del workflow restano intatte.

Per una verifica locale su Node 24:

```bash
npm ci
npm run check
npm test
npm run build
npm run verify:build
```

Pubblicare l'artefatto **`dist/`**, non il template `sw.js` dei sorgenti. Non cambiare l'URL dell'app o il namespace IndexedDB per applicare questo aggiornamento. Dopo un deploy riuscito, usare Impostazioni per cercare l'aggiornamento e confermarlo.

Il pacchetto incrementale include anche la build precompilata; il workflow deve comunque rigenerarla e verificarla. Il progetto completo conserva la configurazione di base 1.1: non sovrascrivere con essa personalizzazioni del workflow fatte dopo quella consegna.

I dati personali usati per l'analisi locale non sono inclusi nei sorgenti, nelle demo, nella build o nei pacchetti. Gli esempi pubblici restano esclusivamente dimostrativi.
