# Pubblicazione e aggiornamento di Meal Planner

## Destinazione e stato effettivo

Il repository di destinazione è [MatColombo/mealPlanCalendar](https://github.com/MatColombo/mealPlanCalendar). L’indirizzo dell’app deve rimanere:

**https://matcolombo.github.io/mealPlanCalendar/**

Il workflow [Meal Planner Pages](../.github/workflows/pages.yml) pubblica **il contenuto compilato di `dist/` alla radice di questo indirizzo**. `dist` è la cartella locale consegnata al servizio di pubblicazione; non diventa un segmento dell’URL dell’app.

Questa configurazione è stata preparata nel progetto. La sua presenza non significa che sia già stata caricata, eseguita o pubblicata su GitHub. Il completamento del job di deploy e della successiva verifica HTTP è la conferma della pubblicazione della nuova revisione. La configurazione non modifica autonomamente la sorgente Pages del repository.

La copia precedentemente pubblicata dalla radice del repository contiene `sw.js` sorgente, con `RELEASE = null`: il worker deve invece essere generato dalla build. Il workflow risolve il percorso pubblicando gli asset compilati nello stesso indirizzo usato dall’app esistente.

## Attivazione per questo repository

1. Porta i sorgenti aggiornati e il workflow su `main` del repository [MatColombo/mealPlanCalendar](https://github.com/MatColombo/mealPlanCalendar). Verifica in GitHub che esista il file **`.github/workflows/pages.yml`**: il caricamento deve conservare anche questo percorso. La cartella `node_modules` e i log locali non devono essere caricati. `dist/` rimane tracciata nel progetto, ma il workflow la rigenera dai sorgenti del commit.
2. Apri [Settings → Pages](https://github.com/MatColombo/mealPlanCalendar/settings/pages).
3. In **Build and deployment → Source**, seleziona **GitHub Actions**. Non creare un secondo workflow dai modelli suggeriti: il progetto include già `pages.yml`.
4. Apri [Actions → Meal Planner Pages](https://github.com/MatColombo/mealPlanCalendar/actions/workflows/pages.yml), premi **Run workflow**, seleziona il ramo **main** e avvia. Se il push ha già avviato un’esecuzione dopo il cambio di sorgente, puoi seguirne direttamente l’esito. Se era partito prima del cambio, avvia una nuova esecuzione.
5. Attendi che risultino completati **Verify software and build** e **Publish and verify returned URL**, incluso il passo **Verify the returned public URL**. Apri il collegamento dell’ambiente **github-pages** mostrato dall’esecuzione.
6. Verifica che l’indirizzo restituito sia quello riportato sopra e che l’app recuperi lo stato utente già presente. La verifica del workflow controlla le risorse HTTP; la conferma della continuità sul proprio dispositivo richiede l’apertura dell’app su quel dispositivo.

Il passaggio **Settings → Pages → Source → GitHub Actions** richiede accesso alle impostazioni del repository. Quando tale accesso non è disponibile nella sessione di lavoro, rimane un’azione del proprietario e non può essere sostituito dalla sola aggiunta del file YAML. GitHub descrive questa procedura nella [guida alla scelta della sorgente di pubblicazione](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow).

## Controlli e artefatto pubblicato

La pipeline usa Node **24**, le dipendenze fissate da `package-lock.json` e questa sequenza:

```sh
npm ci
npm run check
npm test
npm run build
npm run verify:build
```

Il job **Verify software and build** controlla i sorgenti, esegue i test software, rigenera `dist/` e confronta i file della distribuzione con la release attesa. Il caricamento dell’artefatto avviene soltanto su `main`, dopo il successo dei controlli, con `path: ./dist`. Il marker generato `.nojekyll` è incluso nell’artefatto. Sorgenti di sviluppo, documentazione, dipendenze e backup personali non vengono pubblicati dalla pipeline.

Il job **Publish and verify returned URL** dipende dal primo, ricostruisce la stessa revisione per ottenere i byte attesi, legge la configurazione Pages esistente e pubblica l’artefatto. Usa poi l’URL effettivamente restituito da `deploy-pages` per verificare risposte HTTP, MIME type e hash di tutte le risorse, compreso l’avvio alla radice, il manifest e il service worker compilato.

Le pull request verso `main` eseguono soltanto il primo job e non caricano un artefatto di pubblicazione. Gli avvii manuali pubblicano soltanto quando il ramo selezionato è `main`. Le esecuzioni dello stesso ramo vengono accodate, senza interrompere una pubblicazione in corso.

I permessi globali sono `contents: read`. Soltanto il job di deploy aggiunge `pages: write` e `id-token: write`, usa l’ambiente `github-pages` ed espone l’URL restituito dalla pubblicazione. Sono i permessi previsti dal [modello ufficiale di workflow Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). Non occorre aggiungere un token personale per eseguire questa pipeline. `configure-pages` usa `enablement: false`: la scelta della sorgente rimane quella impostata in Settings.

## Continuità dei dati e aggiornamento della PWA

Il nome dell’archivio IndexedDB contiene il percorso dell’app, come definito in [src/persistence/indexeddb.js](../src/persistence/indexeddb.js). Anche cache e scope del service worker sono legati al percorso. Per conservare la continuità, la nuova distribuzione rimane su **`/mealPlanCalendar/`**. Aprire l’app sotto un percorso aggiuntivo `dist/` userebbe un archivio diverso e non è la procedura di aggiornamento.

Esporta un backup dalle impostazioni prima del primo aggiornamento di questa distribuzione: il backup permette di trasferire o ripristinare lo stato anche quando cambi dispositivo o installazione. Dopo la pubblicazione riapri lo stesso indirizzo o l’installazione esistente, attendi il completamento dei salvataggi ed eventualmente usa il comando di aggiornamento mostrato dalla PWA. L’aggiornamento della cache riguarda le risorse dell’app; piani, calendario, persone e spesa rimangono nel livello di persistenza locale.

Se l’app non mostra immediatamente la nuova versione, verifica l’esito HTTP del workflow e riapri l’app con la rete disponibile. Per questa operazione non serve cancellare i dati del sito, disinstallare la PWA o importare nuovamente tutti i piani. Le verifiche automatiche HTTP non certificano l’installazione, i selettori di file o l’uso offline su iPhone: questi comportamenti richiedono una prova sul dispositivo.

## Aggiornamenti successivi e diagnosi

Per pubblicare una modifica successiva, aggiorna i sorgenti, esegui i controlli locali indicati sopra e porta il commit su `main`. La pipeline genera e pubblica una nuova distribuzione. Le risorse del worker includono hash dei contenuti, per cui il controllo rileva anche asset rimasti a una revisione precedente.

Per confrontare manualmente un sito pubblicato con la copia locale già compilata:

```sh
node scripts/verify-release.mjs --url https://matcolombo.github.io/mealPlanCalendar/
```

Questo comando presuppone che i sorgenti e `dist/` rappresentino esattamente la revisione distribuita. Una copia locale con modifiche successive produrrà discrepanze corrette rispetto al sito precedente.

| Risultato osservato | Passaggio da eseguire |
| --- | --- |
| **Meal Planner Pages** non compare in Actions | Verifica che `.github/workflows/pages.yml` sia presente su `main` e che Actions sia disponibile nel repository. |
| Fallisce **Read the configured Pages site** | Seleziona **GitHub Actions** in Settings → Pages e riavvia il workflow su `main`. |
| Il job di deploy attende un’approvazione | Controlla la richiesta dell’ambiente `github-pages` nell’esecuzione e le regole già impostate dal proprietario. |
| Un controllo o un test fallisce prima dell’upload | Correggi l’errore indicato, senza saltare il controllo, e pubblica la revisione corretta. |
| Il deploy è riuscito ma la verifica HTTP fallisce | Leggi il percorso e il tipo di discrepanza nel log. Una propagazione ancora incompleta può essere ricontrollata sull’URL della stessa release; un hash o MIME ancora errato richiede una correzione. Il deploy riuscito da solo non dimostra che tutte le risorse siano corrette. |
| Lo stato personale sembra assente | Controlla indirizzo, browser e installazione utilizzati. Per un trasferimento fra archivi usa il backup, senza cancellare l’archivio originale. |

## Versioni delle action e fonti

Verificate nelle release e nei manifest ufficiali GitHub il **21 ottobre 2026**. Il workflow fissa SHA completi delle release; il commento accanto alla action riporta la versione leggibile.

| Action | Release verificata |
| --- | --- |
| `actions/checkout` | [v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1) |
| `actions/setup-node` | [v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0) |
| `actions/configure-pages` | [v6.0.0](https://github.com/actions/configure-pages/releases/tag/v6.0.0) |
| `actions/upload-pages-artifact` | [v5.0.0](https://github.com/actions/upload-pages-artifact/releases/tag/v5.0.0) |
| `actions/deploy-pages` | [v5.0.1](https://github.com/actions/deploy-pages/releases/tag/v5.0.1) |

Per aggiornare una action verifica la release ufficiale, il commit corrispondente e gli input supportati, quindi ripeti i controlli della pipeline. La validazione del file YAML e le verifiche locali non sostituiscono un’esecuzione reale in GitHub Actions; il suo risultato deve essere riportato separatamente.
