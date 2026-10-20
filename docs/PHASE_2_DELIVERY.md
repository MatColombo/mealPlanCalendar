# Consegna fase 2 — flusso ChatGPT e generazione `.diet`

## Esito

La fase 2 fornisce la sorgente della skill Meal Planner, una guida completa utilizzabile con allegati nella chat web, un esempio conversazionale e due file `.diet` illustrativi in italiano e inglese.

**L'installazione nativa nel catalogo è bloccata.** La sorgente nel progetto è disponibile, ma non è una skill registrata o pubblicata. Per usare il flusso adesso, allega [CHATGPT_WEB_GUIDE.md](CHATGPT_WEB_GUIDE.md), [DIET_FORMAT.md](DIET_FORMAT.md) e [diet.schema.json](../schemas/diet.schema.json) a una chat web e usa il prompt iniziale della guida.

## Deliverable

I percorsi seguenti sono relativi alla radice del progetto.

| Deliverable | Contenuto e stato |
| --- | --- |
| `skills/meal-planner/SKILL.md` | Procedura conversazionale: contesto, domande mancanti, proposta di 3–10 giorni, revisioni ed esportazione. Creata come sorgente di progetto. |
| `skills/meal-planner/agents/openai.yaml` | Metadati dell'agente per gli ambienti che li utilizzano. Non attestano la registrazione nel catalogo ChatGPT. |
| `skills/meal-planner/references/data-contract.md` | Riferimento autonomo di 159 righe: campi, identità, porzioni, frequenze, avanzi, stato e storico. |
| `skills/meal-planner/references/diet.schema.json` | Copia identica dello schema documentale canonico, disponibile anche quando la skill è usata fuori dal repository. |
| `skills/meal-planner/assets/meal-plan-it.diet` e `meal-plan-en.diet` | Esempi strutturali inclusi nella sorgente della skill. |
| [CHATGPT_WEB_GUIDE.md](CHATGPT_WEB_GUIDE.md) | Procedura completa per l'uso tramite tre allegati, con prompt di avvio, revisione ed esportazione. Utilizzabile senza skill installata. |
| [CONVERSATION_EXAMPLE.md](CONVERSATION_EXAMPLE.md) | Dialogo illustrativo: raccolta delle sole informazioni mancanti, proposta, modifica di un ingrediente e gestione esplicita degli avanzi collegati. |
| [meal-plan-it.diet](../examples/phase-2/meal-plan-it.diet) e [meal-plan-en.diet](../examples/phase-2/meal-plan-en.diet) | File finali del dialogo, in due lingue separate, per il 21–23 ottobre 2026. Profilo e dati fittizi. |
| `docs/PHASE_2_DELIVERY.md` | Questo resoconto del perimetro, delle verifiche e del blocco di installazione. |

Le due copie dimostrative hanno `planId` distinti e conservano gli stessi `mealId` e `ingredientId` delle occorrenze e degli ingredienti corrispondenti; ciascun documento contiene testi in una sola lingua.

## Comportamento coperto

- Intervista mirata, normalmente 2–4 domande per turno e al massimo 10 iniziali; risposte già note, assenza di preferenze e deleghe esplicite non vengono richieste nuovamente.
- Proposta leggibile con date, orari, tipi di pasto, ingredienti, quantità per persona, basi di misura e indicazioni pratiche.
- Eventuali kcal massime e intervalli dei macro conservati soltanto quando concordati; macro del contratto v1 espressi in grammi al giorno.
- Frequenze massime riferite a finestre mobili di sette date, con distinzione fra desiderio e massimo e indicazione del contesto parziale.
- Storico limitato alla chat e agli allegati forniti. Distinzione fra documenti proposti, calendario assegnato e consumo dichiarato.
- Revisioni dell'intero piano, di un pasto o di un ingrediente, con ID stabili per le occorrenze mantenute e aggiornamento esplicito dei collegamenti degli avanzi.
- Esportazione del documento completo aggiornato, una sola lingua per file e `baseServings: 1`; quantità e nutrizione non vengono moltiplicate per le persone impostate nell'app.
- Creazione di un file scaricabile quando gli strumenti della sessione lo permettono; altrimenti JSON completo con indicazioni di salvataggio, senza collegamenti inventati.

Le indicazioni operative sono incluse nella guida allegabile. ChatGPT non deve poter leggere una cartella locale della skill per seguire questo percorso. I progetti ChatGPT conservano file e istruzioni resi disponibili dall'utente, senza dare automaticamente accesso a una cartella del computer. [Fonte ufficiale](https://learn.chatgpt.com/docs/projects).

## Installazione nativa: azioni effettive e blocco

| Passaggio | Esito osservato |
| --- | --- |
| Destinazione nativa richiesta | `/root/.codex/skills/remote-skills/meal-planner`. |
| Lettura Git con escalation | Riuscita; il repository delle skill risultava sul branch `master`. |
| Inizializzazione nativa con `init_skill.py` | **Rifiutata dall'auto-review**. |
| Motivazione del rifiuto | Le scritture con escalation sotto `/root/.codex` sono vietate anche quando autorizzate dall'utente. |
| File scritti nella destinazione nativa | Nessuno. |
| Commit o push nel repository nativo delle skill | Nessuno. |
| Registrazione nel catalogo | Non completata; installazione bloccata. |

L'autorizzazione alla lettura Git non ha reso autorizzabile la successiva scrittura. Il rifiuto automatico è rimasto un vincolo della sessione: non è stato aggirato e non sono stati eseguiti ulteriori tentativi equivalenti di installazione.

La sorgente è stata invece creata nel percorso di progetto autorizzato:

```text
/workspace/scratch/60e6d767d17a/meal-planner/skills/meal-planner
```

Questi file sono versionati nel repository del progetto. Il commit locale della consegna conserva i sorgenti e la documentazione; non equivale a un commit nel repository nativo, a un push delle skill o a una registrazione nel catalogo. Lo stato dell'installazione nel catalogo rimane **BLOCCATO**.

Perciò non viene promesso che Meal Planner compaia nel selettore. In ChatGPT la selezione esplicita di una skill effettivamente esposta avviene tramite `@`; la disponibilità dipende anche dall'ambiente e dalla distribuzione come skill autonoma o tramite plugin. [Fonte ufficiale sulle skill](https://learn.chatgpt.com/docs/build-skills).

## Verifiche svolte e loro significato

| Verifica | Esito e limite |
| --- | --- |
| `quick_validate.py` sulla sorgente della skill | **PASS** per i metadati e la struttura previsti dallo strumento. Non verifica la correttezza di un piano alimentare. |
| Prova conversazionale con unità dei macro mancante | L'agente ha chiesto soltanto l'unità mancante, senza ripetere l'intervista già risolta. È evidenza di quel comportamento nel caso provato. |
| Prova conversazionale di revisione di un orario | Riportando al valore originale soltanto l'orario modificato, il confronto profondo restituisce un piano interamente uguale all'originale: ID e campi sono preservati. La prova riguarda il rispetto dell'ambito della modifica. |
| `npm run check` | **PASS** su 13 moduli JavaScript e 8 file JSON/`.diet`, per gli aspetti tecnici previsti dal comando; nessuna verifica nutrizionale. |
| Copia dello schema nel riferimento della skill | Confronto byte per byte riuscito con `schemas/diet.schema.json`. |
| Esempio e file bilingui | Forniti come dimostrazione del flusso e della rappresentazione dei dati; profilo esplicitamente fittizio. |

Non sono stati aggiunti test o validatori di correttezza nutrizionale, bilanciamento, ricette, kcal, macro o frequenze. Lo schema resta documentale. Le verifiche della fase riguardano metadati della skill, comportamento conversazionale e rappresentazione tecnica, senza certificare alimenti o obiettivi.

## Perimetro della fase

La fase riguarda il lavoro nella chat e la produzione del `.diet`. La creazione di file dipende dagli strumenti disponibili nella sessione; ChatGPT Work documenta l'uso di strumenti approvati per produrre materiali da esaminare e riutilizzare. [Fonte ufficiale](https://learn.chatgpt.com/docs/get-started-with-work).

La PWA conserva il perimetro implementato nella fase 1. Questa consegna non aggiunge calendario modificabile, importazione con sovrapposizioni, IndexedDB, spesa completa, installazione PWA, service worker, disponibilità offline o pubblicazione GitHub Pages. Queste funzionalità restano nelle rispettive fasi del progetto.

Il percorso immediatamente utilizzabile è quello descritto nella [guida web](CHATGPT_WEB_GUIDE.md): tre allegati, intervista mirata, proposta, eventuale revisione e file finale per una persona.
