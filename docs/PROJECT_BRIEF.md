# Project Meal Planner — specifica di progetto

Versione della specifica: 1.1.0 · Fasi realizzate: 1–8, aggiornamento 21 ottobre 2026.
Repository: MatColombo/mealPlanCalendar. L’app 1.0 è già pubblicata; la consegna
1.1 aggiorna sorgenti, formato documentale, skill e distribuzione. Lo stato
reale del nuovo deploy è registrato in RELEASE_1_1.md.

## 1. Prodotto e ambito

Project Meal Planner è una PWA personale per conservare piani alimentari,
organizzarli nel calendario e ricavare una lista della spesa. La destinazione
prevista è GitHub Pages con pubblicazione statica. L'interfaccia è italiana e
inglese, con stile colorato e cartoony, navigazione chiara e animazioni allegre.

L'AI lavora esclusivamente nella chat web di ChatGPT. La chat raccoglie le
esigenze, presenta una proposta modificabile e genera un file `.diet` contenente
JSON. Il sito legge il file sul dispositivo. Il frontend non richiede API AI,
chiavi, account, servizi di generazione o un backend.

La fase 1 definisce il contratto e lo scheletro eseguibile. La fase 3 aggiunge
le viste responsive; la fase 4 le collega a IndexedDB, importazioni atomiche,
esportazioni e backup. La fase 5 aggiunge spostamento dei pasti e continuità
della selezione del Calendario. La fase 6 completa il motore della spesa,
le voci manuali e copia/esportazione della checklist.
La fase 7 aggiunge installazione PWA, risorse disponibili offline,
aggiornamenti controllati e compatibilità dello stato locale.
La fase 8 integra le verifiche dei percorsi completi, corregge i difetti
osservati e prepara workflow GitHub Pages, distribuzione minima e controllo
dell'URL pubblicato. Le prove su browser/dispositivi non disponibili sono
separate dai risultati Node e dalle simulazioni.

## 2. Principi vincolanti

| Decisione | Significato operativo |
| --- | --- |
| Uso personale e libertà | Le preferenze guidano la proposta, senza blocchi alimentari nell'app. |
| Dati alimentari affidati all'agente | Non implementare validatori o test di correttezza nutrizionale, bilanciamento, ricette, calorie, macro o frequenze. |
| Controlli tecnici ammessi | Sintassi JSON, envelope del formato, gestione delle date, integrità dello stato, calcoli delle quantità e backup. |
| Porzione di base | Tutte le quantità e la nutrizione nel piano descrivono sempre una porzione consumata da una persona. |
| Persone per pasto | Lo stato del calendario contiene `cookingServings`, inizialmente 1. |
| Nutrizione personale | Il riepilogo personale somma i valori base dei pasti della giornata e ignora `cookingServings`. |
| Lingue indipendenti | `settings.uiLanguage` controlla l'interfaccia; `document.language` descrive i contenuti generati in ChatGPT. |
| Memoria e portabilità | Il prodotto finale conserva uno storico locale ed esporta dati e impostazioni in un backup completo. |

Le verifiche software non confrontano valori nutrizionali con obiettivi e non
giudicano gli alimenti. Gli schemi JSON descrivono strutture e tipi: non sono
un motore di valutazione della dieta e non vengono eseguiti dal frontend.

## 3. Flusso della skill in ChatGPT

La skill della fase 2 deve raccogliere solo le informazioni mancanti:

- Età, sesso, peso e altezza, senza inventare un dato non fornito: registrare
  eventuali rifiuti o indisponibilità e chiarire come procedere.
- Obiettivi, preferenze, restrizioni, allergie e limiti per macro e zuccheri.
- Blacklist e whitelist esplicite di ingredienti e pasti; strutture preferite
  (piatto unico, primo e secondo, secondo e contorno o altre varianti).
- Professione, turni, orari, matrice/rotazione lavorativa e data di ancoraggio,
  incluse eccezioni e turni che terminano il giorno seguente.
- Orari dei pasti, necessità di preparazioni anticipate, pasti esterni o mensa;
  per pasti inevitabili a composizione ignota chiedere il range kcal dichiarato.
- Frigorifero e microonde al lavoro, dispositivi di cucina a casa e tempo
  disponibile nei diversi tipi di giornata.
- Durata richiesta, da 3 a 10 giorni, e date suggerite.
- Lingua del piano.
- Eventuale limite di kcal giornaliere.
- Intervalli minimi e massimi dei macro, con unità esplicite. Il contratto v1
  rappresenta tali intervalli in grammi al giorno.
- Frequenze desiderate degli ingredienti o gruppi di ingredienti, per esempio
  formaggi in massimo tre pasti su sette giorni.
- Disponibilità a consumare avanzi o preparare porzioni in anticipo.
- Altre condizioni pratiche, quando utili: budget, attrezzatura, ingredienti disponibili.

L'obiettivo della skill è proporre pasti vari e bilanciati secondo le esigenze
raccolte e rispettare le preferenze di frequenza concordate; questa
responsabilità resta nella chat, senza validazioni automatiche nell'app.

L'utente può rivedere tutta la proposta, sostituire un pasto o modificare un
ingrediente. La skill adatta la proposta e genera il file quando richiesto.
Le frequenze v1 sono riferite a finestre mobili di sette giorni; la skill
esplicita quando dispone soltanto di un periodo parziale. L'eventuale storico
deve essere presente in chat o fornito dall'utente, senza presumere accesso al
database locale della PWA.

I 3–10 giorni sono una convenzione della generazione conversazionale. Il
formato strutturale `.diet` ammette una sequenza non vuota anche per permettere
esportazioni di intervalli diversi. L'app non blocca un piano in base
alla sua durata o ai suoi obiettivi alimentari.

## 4. Tre livelli di dati

### Piano originale

Il documento `.diet` contiene i giorni e gli orari proposti. Una copia isolata
è conservata in `sourcePlans[sourceId].document`. `sourceId` identifica lo
snapshot importato e non coincide necessariamente con `planId`: importazioni
diverse dello stesso piano possono conservare versioni originali diverse.

### Assegnazioni nel calendario

Il calendario è indicizzato dalla data effettiva. Ogni occorrenza del pasto
ha un `entryId` e riferimenti a `sourceId`, `sourceDate` e `mealId`.
`timeOverride` conserva un eventuale nuovo orario; `cookingServings` conserva
il numero di persone. Spostare il pasto cambia la sua collocazione, mantenendo
identità, riferimenti e data originale. `assignmentId`, facoltativo nel
contratto v1, identifica la stessa assegnazione anche dopo gli spostamenti e
mantiene i collegamenti delle preparazioni nell'esportazione.

### Stato dell'app

Lo stato comprende sorgenti, calendario, cronologia delle importazioni,
impostazioni, selezione corrente, spesa e annullamento dell'ultima importazione.
Il backup include tutti questi dati. Il repository IndexedDB salva una copia
isolata dello stato completo per transazione e conferma la modifica all'UI
soltanto dopo il completamento della scrittura.

## 5. Importazione e calendario

1. Leggere il file con controlli tecnici minimi.
2. Presentare titolo, durata e data suggerita.
3. Richiedere la conferma manuale della data iniziale.
4. Calcolare le date assegnate con lo stesso scarto di giorni per tutto il piano.
5. Mostrare tutte le sovrapposizioni prima della scrittura.
6. Consentire annullamento, cambio data o sostituzione completa dei giorni confermati.
7. Applicare l'operazione interamente e offrire l'annullamento dell'ultima importazione.

Questi passaggi sono implementati nella fase 4. La conferma della data non è
preselezionata e viene azzerata quando cambia la data scelta. Le sovrapposizioni
riguardano le date importate che contengono già pasti o un `workday` esplicito: i giorni negli
eventuali intervalli del piano restano invariati.

Lo stesso contenuto JSON, anche con un nome file o una formattazione diversa,
viene riconosciuto. Se è già assegnato alle medesime date, l'app non crea una
nuova importazione e conserva orari e persone modificati. Se viene assegnato
ad altre date, richiede conferma e riusa la sorgente. Revisioni diverse dello
stesso `planId` restano sorgenti distinte. L'annullamento ripristina i soli giorni
coinvolti e lascia intatte le modifiche estranee all'importazione. Dalla fase 5
riconosce anche i pasti dell'importazione spostati in altre date: li rimuove
individualmente, conservando gli altri pasti delle giornate di destinazione.

Date dei pasti: `YYYY-MM-DD` come date di calendario. Orari: `HH:mm` locali.
I timestamp di creazione e importazione sono separati, in formato RFC 3339.
Le operazioni sul calendario non devono dipendere dalla durata di 24 ore del
giorno locale durante il cambio dell'ora.

La vista giornaliera mostra i pasti in ordine di orario, con nome, tipo, ora e
kcal per persona. Il dettaglio contiene ingredienti, quantità, unità, macro
disponibili e istruzioni. Consente di modificare la data del singolo pasto,
l'ora e le persone. Lo spostamento richiede un comando esplicito e aggiunge
il pasto agli altri della destinazione senza sostituirli.

Il calendario mantiene lo storico e le giornate future, con ritorno rapido a
oggi. `ui.selectedDate` conserva l'ultima data del Calendario: visitare Oggi
non la sovrascrive. Alla riapertura un URL con una data esplicita prevale;
altrimenti viene riusata la selezione salvata. Su desktop il riferimento è una
colonna calendario intorno al 15% e contenuto giornaliero intorno all'85%;
su mobile il selettore date resta compatto e prevale il contenuto a scorrimento
verticale. La proporzione si adatta alla leggibilità del dispositivo.

## 6. Quantità e tre modalità della spesa

Dato `q`, quantità di un ingrediente per una persona:

| Modalità | Moltiplicatore di ogni pasto selezionato |
| --- | --- |
| `one` — una persona | 1 |
| `two` — due persone | 2 |
| `advanced` — avanzata | `cookingServings` del singolo pasto |

La seconda modalità è interpretata come due persone per tutto l'intervallo.
Cambiare modalità non sovrascrive le impostazioni dei pasti.

La spesa seleziona un intervallo con estremi inclusi e somma i fabbisogni dei
pasti effettivamente assegnati. L'identità di aggregazione include ingrediente,
unità canonica e base di misurazione. Le conversioni kg/g e l/ml sono
deterministiche; grammi e pezzi rimangono separati senza conversione dichiarata.
Il campo facoltativo `unitConversion: { toUnit, factor }` applica una relazione
esplicita alla sola voce che la contiene, senza cambiare base di misura o
propagarla ad altri ingredienti. Le quantità originali restano individuali.

Le voci manuali hanno quantità assolute e non cambiano con il moltiplicatore.
Spunte, intervallo e modalità appartengono allo stato applicativo. La fase 4
li conserva in IndexedDB e riapre una voce se il fabbisogno cresce oltre la
quantità già spuntata. La fase 6 mostra quantità precedente e totale aumentato,
riapre le voci automatiche quando cambia il periodo e conserva le manuali.
Lo stesso periodo non azzera le spunte; cambiare modalità applica soltanto il
confronto con la quantità già acquistata. Una voce uscita dalla lista torna
da acquistare se ricompare.

La schermata raggruppa gli ingredienti per categoria, localizza quantità e
controlli e conserva i nomi ricevuti dai piani. Il form manuale richiede nome,
quantità e unità, permette una categoria e unità personalizzate. Copia e
download `.txt` includono la lista calcolata, le spunte e le aggiunte manuali;
sono disponibili anche con sole voci manuali. Se la copia negli appunti non
è disponibile, il testo selezionabile resta accessibile in una finestra.

La fase 1 contiene il contratto e le funzioni pure di moltiplicazione. La
fase 3 le collega alla lista dimostrativa. Non è un inventario della dispensa.

## 7. Avanzi e preparazioni condivise

Ogni pasto contiene soltanto gli ingredienti della porzione effettivamente
consumata da una persona. I metadati `preparation` possono collegare più
pasti con lo stesso `batchId` e descrivere le porzioni preparate in anticipo.

Esempio: due porzioni consumate in due pasti contengono ognuna 80 g di un
ingrediente. La spesa del periodo è 160 g per una persona, non 320 g. Non
occorre eliminare il secondo pasto dal conteggio: il `batchId` informa la
preparazione e non costituisce una chiave di deduplicazione della spesa.

Il calcolo descrive gli ingredienti dei pasti selezionati. Eventuali scorte
già preparate, porzioni destinate a date esterne al periodo o acquisti già
effettuati non vengono dedotti automaticamente.

## 8. Localizzazione e presentazione

L'interfaccia v1 supporta italiano e inglese. Testi dei pasti, ingredienti,
note e istruzioni rimangono quelli del documento. Un cambio di lingua UI
non riscrive il piano.

Tipi di pasto e categorie possono usare codici stabili con etichette UI
localizzate; valori personalizzati restano rappresentabili. Le quantità
sono numeri nel JSON e vengono formattate secondo la lingua dell'interfaccia.

Lo stile usa colori caldi, schede arrotondate, disegni leggeri, buona leggibilità
e movimenti brevi. Le interazioni devono essere accessibili da tastiera e
rispettare la preferenza di riduzione delle animazioni.

## 9. Stack e separazione dei moduli

Stack scelto: HTML, CSS e JavaScript con ES modules e annotazioni JSDoc.
Nessuna dipendenza runtime o CDN. Node.js 24 o successivo è usato soltanto
dagli strumenti locali per avvio, verifica, test e copia della build.
`fake-indexeddb` è una dipendenza di sviluppo per i test delle transazioni;
non viene distribuita con il frontend.

| Percorso | Responsabilità |
| --- | --- |
| `src/data/` | Envelope .diet, stato, riferimenti, backup e date |
| `src/ui/` | Componenti, viste, icone, stili e dizionari EN/IT |
| `src/persistence/` | Repository IndexedDB, copie isolate, transazioni e migrazioni esplicite dello stato |
| `src/pwa/` | Capacità del browser, installazione, persistenza richiesta e aggiornamenti |
| `src/shopping/` | Moltiplicatori, conversioni, aggregazione, stato della checklist e voci manuali |
| `src/main.js` | Composizione dell'app, navigazione e operazioni persistenti delle schermate |
| `schemas/` | Schemi JSON documentali versionati |
| `examples/` | Dati illustrativi privi di informazioni personali |
| `scripts/` | Avvio locale, build statica e verifica locale/HTTP della distribuzione |
| `tests/` | Verifiche tecniche essenziali, senza valutazioni della dieta |

Gli asset usano percorsi relativi. La build copia le sole risorse dell'app
e la demo referenziata in `dist/` e compila
il service worker con un inventario verificabile tramite hash SHA-256.
Non sono richiesti rendering server, routing lato server o riscritture URL.
Il workflow GitHub Pages pubblica il contenuto di `dist/` da `main`, dopo i
controlli software, e verifica via HTTP l'URL restituito. Una pull request
esegue i controlli senza pubblicare. Documentazione, test, skill e altri
esempi rimangono nel repository. Non sono inclusi dati personali dell'utente.

## 10. Stato delle fasi

**Consegnato:** documenti, schemi, esempi, funzioni di base, repository in memoria,
strumenti di sviluppo e una pagina eseguibile che illustra il contratto.

**Fase 2:** skill conversazionale nel progetto, guida per ChatGPT web,
esempio con sostituzione di ingrediente e due piani dimostrativi monolingui.
Il salvataggio nel catalogo personale delle skill è bloccato dalla policy
dell'ambiente; vedere [PHASE_2_DELIVERY.md](PHASE_2_DELIVERY.md). La guida
permette di usare il flusso mediante allegati nella chat web.

**Fase 3:** interfaccia responsive per Oggi, Calendario, dettaglio pasto,
Spesa, Importa, Esporta e Impostazioni; localizzazione completa dell'UI,
riduzione del movimento e interazioni in memoria. Il download del piano
originale e il backup hanno etichette distinte; la conferma delle date di
importazione opera nella sessione. Vedere [PHASE_3_UI.md](PHASE_3_UI.md).

**Fase 4:** archivio IndexedDB con errori espliciti e protezione dai conflitti
fra schede; importazione atomica con conferma della data, riconoscimento dei
duplicati e annullamento persistente; esportazione del calendario e degli
originali; backup completo e ripristino atomico con copia di recupero.
Vedere [PHASE_4_STORAGE.md](PHASE_4_STORAGE.md) e [EXPORT_FORMATS.md](EXPORT_FORMATS.md).

**Fase 5:** pasti ordinati, modifica della data del singolo pasto, orario e
persone; distinzione visibile fra quantità complessive e nutrizione personale;
selezione del Calendario persistente; integrazione di spesa, esportazione e
annullamento dopo spostamenti. Vedere [PHASE_5_CALENDAR.md](PHASE_5_CALENDAR.md).

**Fase 6:** lista completa con intervallo inclusivo e tre moltiplicatori,
conversioni metriche ed esplicite, separazione delle basi, avanzi come quantità
attribuite, categorie, spunte sensibili al fabbisogno, voci manuali persistenti
e copia/download testuale. Vedere [PHASE_6_SHOPPING.md](PHASE_6_SHOPPING.md).

**Fase 7:** manifest e icone di installazione, avvio standalone, risorse offline
complete comprese entrambe le lingue, richiesta di protezione dello storage e
aggiornamenti che conservano IndexedDB. La cache dipende dalla versione
dell'app; i dati personali hanno un contratto distinto. La pipeline conserva
la versione dello stato a 1 e predispone migrazioni future atomiche, senza
trasformazioni implicite. Backup e file locali restano accessibili offline.
Vedere [PHASE_7_PWA.md](PHASE_7_PWA.md), comprese le verifiche effettuate e
i controlli su browser e dispositivi ancora da eseguire.

**Fase 8:** verifiche mirate di integrazione, inclusi confini di mese/anno,
ora legale Europe/Rome e aggiornamenti con stato persistente. È corretto
il caso in cui una risposta tardiva alla copia della spesa sostituiva un
dialogo più recente o interferiva con un salvataggio. Consegnati workflow
GitHub Pages, build minima, verifica locale e controllo HTTP riusabile.
Vedere [PHASE_8_VERIFICATION.md](PHASE_8_VERIFICATION.md) e
[GITHUB_PAGES.md](GITHUB_PAGES.md).

**Stato effettivo:** repository remoto e accesso GitHub non disponibili;
nessuna pubblicazione o verifica di un URL Meal Planner eseguita qui.
Installazione, layout e continuità offline su browser e dispositivi reali
restano nel collaudo documentato, perché il browser supportato dall'ambiente
non è disponibile. Il progetto è consegnato pronto per questi passaggi.

Gli esempi sono dichiaratamente illustrativi. Le verifiche della fase 1
accertano il comportamento del software, senza valutare alimenti o obiettivi.

## 10. Estensioni 1.1

Il `.diet` rimane a `schemaVersion: 1`: `days[].workday`, `meal.recipeId`,
`meal.externalMeal` e `ingredient.nutrition` sono facoltativi. Le metriche
comprendono `kcal`, `proteinG`, `carbohydratesG`, `fatG`, `fiberG`, `sugarsG`.
Ogni valore dell’ingrediente riguarda la quantità della riga per una persona,
non 100 g. L’app usa numeri disponibili e segnala somme incomplete. Non ricava
valori dal nome dell’alimento, non trasforma un range in una stima puntuale e
non valuta obiettivi o qualità alimentare.

`workday.class` è un codice esplicito, non un testo estratto da descrizioni.
Viene assegnato alla data, conservato nel backup e ripristinato dall’undo. Lo
spostamento del pasto non sposta il contesto lavorativo. In assenza del campo
il tipo di giornata rimane sconosciuto.

Il Ricettario indicizza gli originali importati e mostra le occorrenze
attualmente assegnate al calendario. Le varianti con contenuti differenti
rimangono separate. I filtri sono locali; oggi appartiene alla sezione delle
date future. Le date originali suggerite non sono conteggiate come assegnazioni.

Le animazioni mantengono lo scorrimento nativo. Ingresso, lieve inclinazione e
assestamento aiutano il passaggio fra viste e i feedback. Le preferenze di
riduzione del movimento dell’app e del sistema disattivano gli effetti.


## Aggiornamento 1.2

Spesa con esclusioni facoltative di colazioni e spuntini; categorie orizzontali con elenchi verticali; schede compatte e controllo persone sotto avatar. Oggi è una sequenza completa verticale e statica, Calendario usa un carosello orizzontale dei pasti. Navigazione in cinque destinazioni, inclusa Impostazioni con Importa/Esporta. Il ricettario antepone gli ingredienti trovati con le occorrenze alle ricette. Specifiche e verifiche: [RELEASE_1_2.md](RELEASE_1_2.md).
