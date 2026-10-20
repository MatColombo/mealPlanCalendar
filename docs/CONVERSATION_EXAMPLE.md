# Esempio conversazionale — proposta, revisione ed esportazione

Questo dialogo usa **una persona e un profilo completamente fittizi**. Le sue preferenze, allergie dichiarate, abitudini e quantità non descrivono l'utente reale del progetto. L'esempio illustra il funzionamento della skill; non rappresenta una valutazione nutrizionale verificata.

I file finali contengono tre giornate, dal **21 al 23 ottobre 2026**, con quattro pasti al giorno e ingredienti per una sola persona:

- [meal-plan-it.diet](../examples/phase-2/meal-plan-it.diet): piano italiano **dopo la revisione**.
- [meal-plan-en.diet](../examples/phase-2/meal-plan-en.diet): lo stesso piano finale in un file inglese separato.

Il contratto usato è quello di [DIET_FORMAT.md](DIET_FORMAT.md) e [diet.schema.json](../schemas/diet.schema.json), versione 1. Non vengono aggiunti campi al contratto né modificati i file dimostrativi della fase 1.

## 1. Dati già forniti

**Persona fittizia**

> Sono una persona adulta e vorrei organizzare pasti pratici per il 21, 22 e 23 ottobre 2026. Il piano è solo per me e lo voglio in italiano. Lavoro dalle 09:00 alle 18:00 e per preparare la cena vorrei impiegare al massimo 20 minuti. Voglio colazione, pranzo, spuntino e cena; posso mangiare avanzi il giorno dopo. Non ho richieste di calorie o macro. Preferisco al massimo due pasti con formaggio e al massimo due pasti con uova in sette giorni.

**Skill**

> Ho già durata, date, lingua, numero di pasti, orario di lavoro, tempo per la cena e disponibilità agli avanzi. Mi mancano questi dettagli:
>
> 1. Hai allergie, intolleranze, esclusioni alimentari o ingredienti che preferisci evitare?
> 2. A quali orari vuoi i quattro pasti? Per il pranzo in ufficio hai frigorifero o microonde?
> 3. Vuoi fornire i pasti dei giorni precedenti per contestualizzare le frequenze di formaggi e uova? Se non hai lo storico, lavorerò con il solo segmento richiesto, dichiarando il contesto parziale.

La skill non ripete le domande a cui è già stata data risposta e non introduce un obiettivo calorico o di macronutrienti.

**Persona fittizia**

> Non ho allergie, intolleranze o esclusioni; preferisco evitare i peperoni. Colazione alle 07:30, pranzo alle 13:00, spuntino alle 16:30 e cena alle 19:30. In ufficio ho sia frigorifero sia microonde. Non voglio aggiungere lo storico dei giorni precedenti.

## 2. Proposta iniziale leggibile

**Skill**

> Ti propongo questi tre giorni. Le quantità sono sempre per una persona; per alcuni ingredienti pronti è specificato il peso già cotto o sgocciolato. Alterno piatti e ingredienti, con una preparazione condivisa fra la prima cena e il pranzo successivo per ridurre il lavoro in cucina.
>
> I tempi sono stime. La cena del 21 include la preparazione di due porzioni. Le altre quantità descrivono la singola porzione prevista nel rispettivo pasto.

| Data | Ora | Tipo | Proposta iniziale e ingredienti per una persona | Preparazione stimata |
| --- | --- | --- | --- | --- |
| 21 ottobre | 07:30 | Colazione | **Yogurt con avena, pera e noci** — yogurt bianco 170 g, fiocchi d'avena 40 g, pera 1, noci sgusciate 15 g. | 5 min |
| 21 ottobre | 13:00 | Pranzo | **Insalata di farro, pomodorini e cannellini** — farro già cotto 150 g, cannellini sgocciolati 130 g, pomodorini 150 g, olio d'oliva 8 g, basilico 3 g, sale 1 g. | 12 min, con farro già cotto |
| 21 ottobre | 16:30 | Spuntino | **Mela e mandorle** — mela 1, mandorle 20 g. | 2 min |
| 21 ottobre | 19:30 | Cena | **Couscous con ceci e broccoli** — couscous istantaneo secco 70 g, ceci sgocciolati 130 g, broccoli crudi 200 g, olio d'oliva 8 g, succo di limone 10 ml, acqua 90 ml, prezzemolo 2 g, sale 1 g. | 20 min, preparando due porzioni |
| 22 ottobre | 07:30 | Colazione | **Pane integrale con ricotta e kiwi** — pane integrale 70 g, ricotta 80 g, kiwi 1. | 5 min |
| 22 ottobre | 13:00 | Pranzo | **Couscous con ceci e broccoli, porzione preparata** — couscous secco 70 g, ceci sgocciolati 130 g, broccoli crudi 200 g, olio 8 g, succo di limone 10 ml, acqua 90 ml, prezzemolo 2 g, sale 1 g: ingredienti allocati alla seconda porzione della cena precedente. | 5 min per predisporre la porzione |
| 22 ottobre | 16:30 | Spuntino | **Arancia e cioccolato fondente** — arancia 1, cioccolato fondente 15 g. | 2 min |
| 22 ottobre | 19:30 | Cena | **Frittata di spinaci con pane integrale** — uova 2, spinaci freschi 180 g, olio d'oliva 8 g, sale 1 g, pane integrale 60 g. | 18 min |
| 23 ottobre | 07:30 | Colazione | **Porridge con banana e cannella** — fiocchi d'avena 45 g, latte 180 ml, banana 1, cannella 0,5 g. | 8 min |
| 23 ottobre | 13:00 | Pranzo | **Pasta fredda con tonno e pomodorini** — pasta secca 75 g, tonno sgocciolato 100 g, pomodorini 150 g, olio d'oliva 8 g, basilico 3 g, sale 1 g. | 15 min, escluso raffreddamento |
| 23 ottobre | 16:30 | Spuntino | **Yogurt e mirtilli** — yogurt bianco 125 g, mirtilli 100 g. | 2 min |
| 23 ottobre | 19:30 | Cena | **Pollo al limone con carote e pane** — petto di pollo crudo 150 g, carote crude 200 g, pane integrale 60 g, olio d'oliva 8 g, succo di limone 15 ml, origano secco 1 g, sale 1 g. | 20 min, con taglio sottile |

**Skill — contesto della proposta**

> Nei tre giorni proposti compare un pasto con formaggio e uno con uova. Il limite che hai indicato è un massimo in finestre mobili di sette giorni, non una quota da esaurire nei tre giorni. Non ho lo storico esterno a queste date, quindi non posso descrivere come completa una finestra di sette giorni.
>
> Non hai richiesto target calorici o macro e qui non sono disponibili valori nutrizionali da riportare. Puoi rivedere l'intera proposta, un pasto o un ingrediente.

Le due uova della frittata appartengono a **un singolo pasto**. Il formaggio è descritto dal tag assegnato alla colazione con ricotta. L'app non esegue una classificazione o una verifica alimentare di questi pasti: le informazioni appartengono alla proposta della skill.

## 3. Richiesta di sostituzione di un ingrediente

**Persona fittizia**

> Per la cena del 21, sostituisci i broccoli con le zucchine.

**Skill**

> Propongo 250 g di zucchine crude per porzione al posto dei 200 g di broccoli. È una nuova quantità scelta per questo piatto; non la presento come equivalente dal punto di vista calorico o dei macro.
>
> La cena del 21 e il pranzo del 22 provengono dalla stessa preparazione. Cambiando le verdure in entrambi puoi continuare a preparare tutto insieme. Mantenere i broccoli soltanto nel pranzo richiederebbe separare le preparazioni. Preferisci applicare la sostituzione anche al pranzo collegato?

**Persona fittizia**

> Sì, aggiorna anche il pranzo del 22. Preferisco fare una sola preparazione, anche se la base si ripete.

Qui il compromesso è esplicito: la persona accetta la ripetizione di una base per mantenere il vantaggio organizzativo degli avanzi. La skill non estende silenziosamente una modifica richiesta per un solo pasto a un pasto collegato.

## 4. Aggiornamento dei pasti interessati

**Skill**

> Aggiorno la cena del 21 in **Couscous con ceci e zucchine** e il pranzo del 22 in **Couscous con ceci e zucchine — porzione preparata**. Per le zucchine tagliate sottili propongo una stima di 18 minuti per preparare le due porzioni; predisporre il pranzo già preparato rimane stimato in 5 minuti.
>
> Per entrambi i pasti i valori nutrizionali restano non disponibili. Aggiorno quantità, nomi, istruzioni e note della preparazione, senza dedurre valori calorici o macro dalla sostituzione.

### Quantità finali dei due pasti collegati

| Ingrediente | Cena del 21, una porzione | Pranzo del 22, una porzione | Totale delle due porzioni |
| --- | --- | --- | --- |
| Couscous istantaneo, peso secco | 70 g | 70 g | 140 g |
| Ceci, peso sgocciolato | 130 g | 130 g | 260 g |
| **Zucchine, peso crudo** | **250 g** | **250 g** | **500 g** |
| Olio d'oliva | 8 g | 8 g | 16 g |
| Succo di limone | 10 ml | 10 ml | 20 ml |
| Acqua | 90 ml | 90 ml | 180 ml |
| Prezzemolo | 2 g | 2 g | 4 g |
| Sale | 1 g | 1 g | 2 g |

Le due porzioni richiedevano 400 g di broccoli nella proposta iniziale; la revisione richiede 500 g di zucchine. Nei file finali l'ingrediente dei due pasti è `zucchini`, quantità `250`, unità `g`, base `raw`. L'ID del gruppo di preparazione resta `couscous-chickpeas-batch-01`.

Le quantità nel primo pasto non contengono già il totale della preparazione. Entrambi i pasti mantengono la propria allocazione, quindi la spesa per l'intervallo li somma. `preparedServings: 2` descrive la preparazione e non moltiplica nuovamente gli ingredienti del file.

### Riepilogo del piano finale esportato

| Data | Colazione — 07:30 | Pranzo — 13:00 | Spuntino — 16:30 | Cena — 19:30 |
| --- | --- | --- | --- | --- |
| 21 ottobre 2026 | Yogurt con avena, pera e noci | Insalata di farro, pomodorini e cannellini | Mela e mandorle | **Couscous con ceci e zucchine** |
| 22 ottobre 2026 | Pane integrale con ricotta e kiwi | **Couscous con ceci e zucchine — porzione preparata** | Arancia e cioccolato fondente | Frittata di spinaci con pane integrale |
| 23 ottobre 2026 | Porridge con banana e cannella | Pasta fredda con tonno e pomodorini | Yogurt e mirtilli | Pollo al limone con carote e pane |

Le quantità complete sono nel file italiano finale; per i dieci pasti non coinvolti nella revisione corrispondono alla proposta iniziale riportata sopra.

## 5. Richiesta del file

**Persona fittizia**

> Questa versione mi va bene. Genera il file `.diet` in italiano e anche una copia inglese separata.

**Skill**

> Ecco i due file del piano aggiornato:
>
> - [Piano in italiano](../examples/phase-2/meal-plan-it.diet)
> - [Piano in inglese](../examples/phase-2/meal-plan-en.diet)
>
> Ogni file contiene una sola lingua e quattro pasti al giorno per il 21, 22 e 23 ottobre. La data di partenza proposta è il 21 ottobre 2026; sarà da confermare nell'importazione. Ogni pasto descrive una porzione per una persona, comprese le due porzioni collegate preparate insieme.

## 6. Corrispondenza con il contratto

| Aspetto | Rappresentazione nei file finali |
| --- | --- |
| Formato | `format: "meal-planner.diet"`, `schemaVersion: 1`. |
| Identità dei due documenti | `phase-2-demo-it-2026-10-21` e `phase-2-demo-en-2026-10-21`. |
| Lingua dei contenuti | `it` nel primo file, `en` nel secondo; nomi, istruzioni e note sono monolingui. |
| Porzione di base | `baseServings: 1`; nessuna impostazione `cookingServings` viene inserita nel documento. |
| Date | `2026-10-21`, `2026-10-22`, `2026-10-23`, con `suggestedStartDate: "2026-10-21"`. |
| Identificatori degli ingredienti | Stabili e uguali fra le due lingue; il nome leggibile è tradotto. |
| Revisione | Gli stessi `mealId` della cena del 21 e del pranzo del 22 identificano i pasti aggiornati. Entrambi contengono `zucchini` nella nuova quantità. |
| Preferenze di frequenza | Due voci con `subject.kind: "tag"`, `maxMeals: 2`, `period.days: 7` e `period.alignment: "rolling"`. Le note dichiarano il contesto parziale. |
| Obiettivi calorici e macro | Assenti: la persona fittizia non li ha richiesti. |
| Nutrizione non disponibile | `nutrition` è omesso negli altri pasti; nei due pasti rivisti le metriche sono `null` con una nota esplicita. Non viene usato `0` come sostituto di un dato mancante. |
| Tempi | `prepMinutes` contiene stime pratiche. Per la cena rivista la stima è 18; per il pranzo collegato è 5. |
| Avanzi | Stesso `batchId`; ruoli `cook` e `leftover`; `preparedServings: 2` soltanto nel pasto di preparazione. |
| Profilo fittizio | Dichiarato nelle note del piano e nel presente documento. |

L'esempio dimostra una revisione locale con effetto su un pasto collegato. Una revisione dell'intera proposta segue lo stesso principio: mostrare le scelte modificate, mantenere espliciti i compromessi e generare il file della versione richiesta.

Le verifiche ammesse per questi artefatti riguardano parsing JSON, campi del contratto, date e riferimenti tecnici. Non vengono introdotti validatori o test alimentari, delle ricette, delle calorie, dei macro o delle frequenze. La conferma delle date e la gestione delle sovrapposizioni appartengono al flusso di importazione dell'app previsto dalle fasi successive.
