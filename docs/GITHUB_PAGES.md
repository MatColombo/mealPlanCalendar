# GitHub Pages — versione 1.1

La guida operativa aggiornata è [DEPLOYMENT.md](DEPLOYMENT.md).

Repository: [MatColombo/mealPlanCalendar](https://github.com/MatColombo/mealPlanCalendar).
URL esistente: **https://matcolombo.github.io/mealPlanCalendar/**.

Per questa release occorre aggiornare `main`, includere il workflow
`.github/workflows/pages.yml`, selezionare **Settings → Pages → Source →
GitHub Actions**, quindi eseguire **Actions → Meal Planner Pages → Run workflow**.
Il workflow costruisce e pubblica il contenuto di `dist/` nello stesso URL.
I dettagli sui permessi, sugli SHA delle action e sulla verifica HTTP sono
nella guida operativa.

La versione pubblicata dalla radice del repository serve un service worker
sorgente. Il nuovo workflow distribuisce quello compilato. Non spostare
l’indirizzo dell’app sotto `/dist/`: il percorso fa parte dell’identità del
salvataggio locale.

Per verificare un checkout con Node 24:

```sh
npm ci
npm run check
npm test
npm run build
npm run verify:build
npm run verify:deployment -- https://matcolombo.github.io/mealPlanCalendar/
```

L’ultimo comando ha successo solo quando l’URL serve la stessa release della
build locale. Il suo fallimento prima del nuovo deploy non dimostra un errore
nella build: può indicare che è ancora online la release precedente.

Il resoconto di questa consegna è [RELEASE_1_1.md](RELEASE_1_1.md); non considerare
la presenza del workflow una conferma di pubblicazione.
