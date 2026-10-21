# Meal Planner 1.1 — consegna e verifiche

Data: **21 ottobre 2026**. Base recuperata dal repository pubblico
[MatColombo/mealPlanCalendar](https://github.com/MatColombo/mealPlanCalendar),
commit `e6a7adc6a2b789f6256532db851503ee56815f69`.

## Stato della pubblicazione

L’app esistente risponde a
**https://matcolombo.github.io/mealPlanCalendar/**.
L’esecuzione segnalata dall’utente
[39428835445](https://github.com/MatColombo/mealPlanCalendar/actions/runs/39428835445)
risulta completata con successo, usando il workflow generato da Pages per
pubblicare la radice del ramo. L’ispezione HTTP della copia esistente ha rilevato
`RELEASE = /*__MEAL_PLANNER_RELEASE__*/ null` nel worker alla radice, mentre
`dist/sw.js` contiene il worker compilato. Il successo del job precedente non
attesta quindi la disponibilità offline all’indirizzo principale.

La consegna 1.1 include `.github/workflows/pages.yml`: pubblica soltanto la
build `dist/` nello stesso percorso `/mealPlanCalendar/` e verifica i byte
all’URL restituito. Non sposta l’app in un nuovo sottopercorso.

**La nuova release non è stata pubblicata da questa sessione.** La verifica
Git di invio in modalità `--dry-run` si è fermata con «unable to get password
from user»: non sono state inviate modifiche. È stata proposta l’integrazione
GitHub, senza dichiararla installata o collegata. È consegnato un pacchetto
completo pronto da applicare al repository. I passaggi esatti sono in
[DEPLOYMENT.md](DEPLOYMENT.md).

## Modifiche per i punti richiesti

| Area | Risultato |
| --- | --- |
| Overflow PWA | Contenimenti su griglie, form, modali, quantità, toolbar e controlli date/time; layout adattivo anche sotto 420px; nessun occultamento globale dell’overflow del body. |
| Persone rapide | Stepper sulle schede di Oggi e Calendario, anche nel dettaglio; tocchi accodati, numeri provvisori con stato busy, conferma animata e messaggi live dentro il dialog. |
| Movimento | Ingressi sfalsati, lieve tilt, elasticità al passaggio e allo scroll, assestamento neutro; gesto di scroll nativo e riduzione del movimento app/sistema. |
| `.diet` su iPhone | Rimosso `accept` dal selettore dei piani e backup; lettura JSON e controlli tecnici rimangono attivi. Il selettore nativo non deve filtrare una sconosciuta estensione `.diet`. |
| Macro | Valori dichiarati per pasto oppure contributi degli ingredienti, senza doppio conteggio; riepiloghi personali, fibre/zuccheri quando forniti, segnalazione dei dati parziali. |
| Ricettario | Shortcut toolbar e tab mobile; ricerca ricette/ingredienti, categorie, tipi e presenza temporale; sezioni future incl. oggi, passate e totali con conteggi e apertura del pasto effettivo. |
| Giornata lavorativa | `workday.class` esplicita sulla data, etichetta e orari quando noti; conservazione in import, undo, export e backup, senza dedurre informazioni dai testi. |
| Agente | Profilo e dati pratici richiesti, turni/matrice, mensa/range, attrezzatura, obiettivi, allergie, limiti, whitelist/blacklist, struttura e frequenze; proposta per sezioni, revisioni e demo IT/EN. |

Le quantità alimentari e le stime sono per una persona. Cambiare le persone
influisce sulle quantità da preparare e sulla spesa avanzata; i valori
nutrizionali giornalieri personali non si moltiplicano.

Il contratto resta a `schemaVersion: 1`, con campi aggiuntivi facoltativi.
I vecchi file si leggono ancora: i macro o i turni mancanti non vengono
inventati o completati automaticamente. Per completarli, chiedere una nuova
revisione all’agente e importare il file aggiornato con le normali conferme.

## Verifiche eseguite

- **152 test software superati**, zero fallimenti. Runner Node con
  `fake-indexeddb`, DOM adapter e API browser simulate dove dichiarato dai test.
- Sintassi JS, JSON, riferimenti locali, manifest e dimensioni delle icone.
- Build minima: **44 file**, con **42 risorse** elencate e hash nel worker.
- `npm run verify:build`: file distribuiti confrontati con i sorgenti attesi.
- Distribuzione a radice e sottopercorso verificata nei test del server HTTP;
  nessuna di queste prove equivale al deploy pubblico della release 1.1.
- File `.diet` dimostrativi IT/EN letti attraverso le stesse funzioni tecniche
  dell’app; riferimenti degli schemi e copie allineati.
- Skill: generatore ufficiale dei metadati e `quick_validate.py` riusciti.
- Prova conversazionale indipendente mediante un agente con contesto nuovo:
  intervista di un lavoratore a turni, riuso delle risposte già note,
  chiarimento dei dati mancanti senza inventare lo storico. Non è una prova
  di installazione della skill nel catalogo ChatGPT.
- `git diff --check` pulito.

### Regressioni mirate

I test nuovi coprono l’accodamento di tocchi rapidi, modifica dell’orario e
persone immediatamente dopo la navigazione, mantenimento dei valori originali,
ricerca per accenti/ID/categorie, varianti della stessa ricetta, occorrenze
spostate, oggi incluso nelle date future, scambio IT/EN, metadati lavorativi
sulle date effettive, sovrapposizioni dei giorni senza pasti ma con un turno,
undo, backup, precedenza dei numeri forniti, somme parziali e riduzione del
movimento con pulizia degli effetti in corso.

La suite preesistente continua a coprire importazioni, conferma delle date,
cambi di mese/anno/ora legale, sovrascrittura e annullamento, tre modalità
della spesa, checklist, manuali, transazioni fallite, ripristino, conflitti
fra sessioni, cache offline e aggiornamenti senza perdita dell’archivio.

**Nessun test giudica ricette, adeguatezza alimentare, bilanciamento, obiettivi
di calorie, macro, zuccheri o frequenze.** Le somme di numeri forniti sono
controllate esclusivamente come logica software.

## Verifiche ancora necessarie su browser e dispositivi

Il supervisore di anteprima di questo ambiente non è disponibile: sia start
sia status riportano l’assenza della sua mailbox. Le istruzioni del relativo
ambiente vietano di sostituirlo con un server alternativo. Non sono quindi
state eseguite né dichiarate prove visive in un browser reale in questa sessione.
La libreria per una validazione formale completa JSON Schema non è installata;
gli schemi restano documentali e i JSON sono stati letti tecnicamente.

Dopo il deploy, provare almeno:

1. Safari iPhone e PWA installata: File → selezionare direttamente `.diet`,
   confermare la data, aprire pasti e backup. Nessuna rinomina in `.json`.
2. Larghezze 320/375/390/430 px, landscape e testo ingrandito: campi nativi,
   toolbar, stepper, macro, ricettario e dialog devono rimanere nel contenitore.
3. Tocchi rapidi `+ + −`, apertura da ricettario e modifica di ora/data,
   ritorno alla giornata: quantità, selezione e ordine devono essere conservati.
4. Movimento normale e ridotto: scroll naturale, inclinazioni leggere e
   assestamento; nessun movimento con preferenza di riduzione attiva.
5. VoiceOver/TalkBack: etichette dello stepper, messaggio di salvataggio nel
   dialog, focus dopo chiusura, navigazione e sezioni del ricettario.
6. Dopo «Pronta anche offline», chiudere e riaprire senza rete; modificare pasti,
   utilizzare spesa, importare/esportare file locali e ripristinare un backup.
7. Applicare un aggiornamento dallo stesso indirizzo e verificare sul dispositivo
   lingua, date, persone, spunte e manuali; controllare installazione iOS/Android.

## Aggiornare l’agente nella chat

Sostituire i precedenti allegati con `docs/CHATGPT_WEB_GUIDE.md`,
`docs/DIET_FORMAT.md` e `schemas/diet.schema.json`, quindi usare il prompt della
guida. Le istruzioni aggiornate sono anche nei sorgenti `skills/meal-planner/`.
Il sito non aggiorna automaticamente le istruzioni della chat e questa
consegna non dichiara una nuova installazione nel catalogo nativo.

Le demo `examples/release-1.1/meal-plan-it.diet` e `meal-plan-en.diet` contengono
soltanto dati fittizi, inclusi profilo e stime. La demo dell’app usa ora quella
italiana 1.1. Nessun file personale è stato aggiunto al repository.
