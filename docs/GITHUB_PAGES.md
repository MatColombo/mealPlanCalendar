# Pubblicare e aggiornare Project Meal Planner su GitHub Pages

Versione del progetto: **1.0.0**. Questa guida descrive il workflow consegnato
e i passaggi necessari per usarlo con il proprio repository.

## Stato effettivo della pubblicazione

Alla consegna della fase 8:

- il checkout locale non ha un remoto Git;
- non è stato fornito un repository GitHub di destinazione;
- nell'ambiente non sono disponibili strumenti GitHub collegati o la CLI gh;
- non è stata eseguita una pubblicazione e non esiste un URL verificato
  restituito da questa sessione.

Il codice, il workflow e la distribuzione sono pronti. Rimane da **caricare
i sorgenti nel repository scelto, abilitare Pages da GitHub Actions ed eseguire
il workflow sul ramo main**. I passaggi sono descritti sotto. Un indirizzo
mostrato come esempio non è un sito già pubblicato.

## 1. Preparare i sorgenti sul computer

Estrarre il pacchetto e aprire la cartella meal-planner. Sono inclusi sia
i sorgenti sia dist/. Lo ZIP non contiene un database personale o la cartella
Git con la cronologia del checkout.

Con Node.js 24 o successivo:

~~~bash
npm ci
npm run check
npm test
npm run build
npm run verify:build
~~~

npm ci installa soltanto la dipendenza di sviluppo usata dai test. La build
non necessita di un bundler o di dipendenze runtime. Per vedere l'app in locale:

~~~bash
npm run dev
~~~

Oppure, per controllare la distribuzione già generata:

~~~bash
npm run preview
~~~

Il server usa http://127.0.0.1:5173/. Il protocollo file:// non è un avvio
supportato. Per la PWA pubblicata usare HTTPS.

## 2. Creare o scegliere il repository

Per usare GitHub Pages con GitHub Free, il percorso documentato è un
repository **pubblico**. Chi configura Pages deve avere i permessi appropriati
sul repository. Riferimento:
[GitHub — Configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

Crea un repository vuoto, per esempio con nome meal-planner. Dalla cartella
estratta, se stai iniziando un nuovo checkout, puoi inviare i sorgenti così:

~~~bash
git init -b main
git add .
git commit -m "Release Project Meal Planner 1.0.0"
git remote add origin https://github.com/TUO-ACCOUNT/NOME-REPOSITORY.git
git push -u origin main
~~~

Sostituisci TUO-ACCOUNT e NOME-REPOSITORY con la destinazione reale e usa
l'autenticazione Git configurata sul tuo computer. Questi comandi descrivono
il caricamento iniziale in un repository vuoto. Per un checkout Git già
esistente, usa il suo remoto e la normale procedura di aggiornamento.

Il file package.json, la cartella src e il workflow devono trovarsi nella
radice del repository: non caricare uno ZIP chiuso o un ulteriore contenitore
meal-planner sopra a tutti i file. Includi
[.github/workflows/pages.yml](../.github/workflows/pages.yml).

La cartella dist viene generata dalla pipeline ed è esclusa dai file Git.
Nel repository sono presenti soltanto dati dimostrativi; i propri file
.diet e backup si conservano sul dispositivo e si importano nell'app.

## 3. Abilitare Pages ed eseguire il workflow

Nel repository:

1. Apri **Settings → Pages**.
2. In **Build and deployment → Source**, scegli **GitHub Actions**.
3. Apri **Actions → Verify and publish Meal Planner**.
4. Seleziona **Run workflow**, scegli main e avvia.

Il primo push può aver avviato il workflow prima dell'attivazione di Pages.
Dopo aver configurato la sorgente, l'avvio manuale ripete l'intero percorso.

La selezione della sorgente segue la
[procedura ufficiale GitHub](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
Non è necessario creare un ramo gh-pages o configurare Jekyll.

## 4. Che cosa esegue il workflow

Il workflow ha due job:

| Job | Azioni |
| --- | --- |
| Verify software and build | Checkout, Node 24, npm ci, controllo sorgenti, suite software, build, verifica locale di dist e caricamento dell'artefatto Pages. |
| Publish and verify returned URL | Usa la medesima revisione, ricostruisce i byte attesi, configura Pages, pubblica l'artefatto e verifica l'URL restituito. |

Le pull request verso main eseguono i controlli ma non caricano un artefatto
da pubblicare e non eseguono il job di deploy. La pubblicazione avviene solo
per main, tramite push o avvio manuale. Le pubblicazioni dello stesso ramo
non si interrompono a vicenda mentre sono in corso.

I permessi globali sono di lettura dei contenuti. Il job di pubblicazione
aggiunge pages: write e id-token: write, usa l'ambiente github-pages e mostra
l'URL restituito dal passo deployment. Questi elementi seguono il modello
[GitHub — Using custom workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Le action di checkout e setup-node sono fissate a commit delle release
ufficiali v7.0.1 e v7.1.0. Le action Pages usano configure-pages@v5,
upload-pages-artifact@v4 e deploy-pages@v4. Per aggiornarle, verificare la
documentazione delle action e rieseguire i controlli della pipeline.

## 5. Percorso del repository e contenuto pubblicato

Esempi di indirizzi, da sostituire con quello restituito dal deploy:

~~~text
https://TUO-ACCOUNT.github.io/NOME-REPOSITORY/
https://TUO-ACCOUNT.github.io/
~~~

La stessa build funziona in una sottocartella o nella radice. Manifest,
start_url, scope, icone e registrazione del worker si risolvono nella cartella
dell'app. Non occorre inserire il nome del repository in un file di
configurazione. Le schermate usano frammenti URL, per esempio #calendar,
senza richiedere riscritture lato server.

La build copia solo l'inventario delle risorse pubbliche dell'app, la demo
referenziata dal codice e il worker compilato; aggiunge un marcatore .nojekyll.
Documentazione, skill, test e altri esempi restano nel repository e nel
pacchetto sorgente. Il verificatore locale rifiuta file inattesi in dist.

**La radice dei sorgenti contiene un template sw.js. Pubblicare esclusivamente
la cartella dist generata.** Dopo modifiche a HTML, moduli, CSS, manifest o
icone, rigenerare la build intera per mantenere coerenti file e hash.

La PWA conserva i dati personali in IndexedDB, separato dalle risorse
pubbliche della cache. Il nome dell'archivio include il percorso dell'app:
un cambio di dominio o percorso richiede un trasferimento tramite backup.
Aggiornare i file allo stesso indirizzo conserva il namespace dell'archivio.

## 6. Verificare l'URL restituito

Il workflow usa l'output page_url di deploy-pages, non un indirizzo ricostruito
da nomi presunti. L'ambiente github-pages espone lo stesso URL.

Il controllo HTTP confronta la pagina iniziale, ogni risorsa dell'inventario
e il service worker con la build attesa: stato della risposta, tipo di contenuto
e hash SHA-256. Prevede ritentativi limitati per la propagazione dei file.
Un HTML di errore restituito al posto di un modulo JavaScript, un asset
mancante o una release vecchia non diventano una verifica positiva.

Per ripetere dal checkout corrispondente alla release:

~~~bash
npm run build
npm run verify:deployment -- https://TUO-ACCOUNT.github.io/NOME-REPOSITORY/
~~~

Il comando richiede l'indirizzo reale. Senza pubblicazione non costituisce
una prova dell'esistenza del sito. Il verificatore è stato testato localmente
con risposte HTTP simulate; in questa consegna non è stato invocato contro
un URL pubblico di Meal Planner.

Una verifica HTTP riuscita controlla la distribuzione dei file; **non prova
installazione, service worker nel browser, layout, IndexedDB reale o modalità
aereo**. Dopo la pubblicazione eseguire la procedura sui browser/dispositivi
descritta in [PHASE_8_VERIFICATION.md](PHASE_8_VERIFICATION.md).

Se deploy-pages è riuscito ma il controllo HTTP fallisce, il sito può essere
già pubblicato. Distinguere i due passi nei log: la verifica fallita non
annulla automaticamente la pubblicazione. Conservare l'URL, leggere l'errore
e ripetere la verifica o la pipeline dopo la correzione.

## 7. Distribuire un aggiornamento

Modifica i sorgenti nel repository, esegui i controlli locali e invia le
modifiche a main. Il workflow genera una nuova distribuzione. Per una release
numerata, aggiorna versione in package.json e package-lock.json; il digest
del contenuto distingue comunque le build anche a parità di numero.

Il browser prepara la nuova cache e l'app mostra **Una nuova versione è
pronta**. Con **Aggiorna e ricarica** si passa subito alla versione pronta,
dopo aver concluso le scritture e chiuso le altre finestre. Le bozze non
confermate non fanno parte del salvataggio. Chiudendo tutte le finestre,
il normale ciclo del browser può attivare la release in attesa.

Il service worker non cancella IndexedDB. La compatibilità dello stato è
gestita dal livello di persistenza; lo stato attuale rimane v1. Per dettagli:
[PHASE_7_PWA.md](PHASE_7_PWA.md).

Per correggere una regressione, ripristina o correggi il codice con un nuovo
commit e distribuisci nuovamente. Una versione vecchia dell'app potrebbe non
leggere uno stato evoluto in futuro: la pipeline impedisce il downgrade
silenzioso e rende disponibili i recuperi tecnicamente leggibili.

## 8. Backup, recupero e problemi comuni

| Situazione | Passo utile |
| --- | --- |
| Workflow non disponibile | Controllare che pages.yml sia nella cartella .github/workflows del ramo main. |
| Errore nella configurazione Pages | Verificare Source = GitHub Actions e i permessi sul repository. |
| Modulo/manifest/icona mancanti | Distribuire la build completa e controllare il passo di verifica HTTP. |
| App ancora sulla vecchia versione | Cercare aggiornamenti nelle impostazioni e seguire la conferma. |
| Cache non pronta | Tornare online e usare Riprova preparazione offline. |
| Errore di salvataggio | Usare il messaggio e la riprova dell'archivio; scaricare un backup disponibile. |
| Nuovo browser, dispositivo o indirizzo | Esportare il backup dalla vecchia istanza e ripristinarlo nella nuova. |

Prima di sostituire un archivio, il ripristino mostra l'anteprima. Una
transazione conserva la copia precedente e applica il candidato; un errore
lascia intatto lo stato corrente. La copia locale precedente e il file backup
già scaricato sono strumenti diversi.

La rimozione dei dati del sito può eliminare archivio e cache. Per il recupero
indipendente usare un backup scaricato. Formati e procedure sono descritti in
[EXPORT_FORMATS.md](EXPORT_FORMATS.md) e [STATE_AND_BACKUP.md](STATE_AND_BACKUP.md).

## Riferimenti delle action

- [Checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1).
- [Setup Node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0).
- [Configure Pages](https://github.com/actions/configure-pages).
- [Upload Pages artifact](https://github.com/actions/upload-pages-artifact).
- [Deploy Pages](https://github.com/actions/deploy-pages).

Le indicazioni dei servizi sono state consultate il 19 ottobre 2026.
Il resoconto delle prove effettive è separato dalla configurazione proposta.
