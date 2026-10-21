# Esempio conversazionale — turni, mensa e sostituzione

Questo dialogo è dimostrativo. Profilo, quantità e valori numerici sono fittizi:
illustrano conversazione e contratto software, senza costituire una proposta
personale o una verifica nutrizionale. I file finali corrispondono alla versione
**dopo** la sostituzione e si trovano in `examples/release-1.1/`.

## 1. La richiesta e le sole domande mancanti

**Utente**

> Vorrei organizzare tre giorni di pasti, dal 20 al 22 ottobre 2026, in italiano.
> L'obiettivo è gestire meglio i turni; non ho un target kcal o macro. Preferisco
> vedere comunque kcal, proteine, carboidrati e grassi. Poi vorrei anche una
> copia inglese del file.

**Agente**

Periodo, lingua e obiettivo sono già chiari. Mi servono questi dettagli:

1. Quali sono età, sesso, peso e altezza? Puoi non fornire singoli dati.
2. Che lavoro fai e quali turni avrai in queste date? Se seguono una matrice, qual è la sequenza e da quale data parte?
3. Devi preparare o trasportare pasti in anticipo? Ci sono pasti esterni inevitabili e conosci il range kcal della mensa? Al lavoro hai frigo e microonde, e accetti avanzi?
4. Quali dispositivi hai a casa, quanto tempo vuoi cucinare e ci sono condizioni di budget?
5. Hai allergie, intolleranze o restrizioni?
6. Quali ingredienti e pasti vuoi escludere e quali preferisci? I preferiti sono esclusivi?
7. Quali orari e strutture dei pasti preferisci?
8. Hai limiti agli zuccheri o frequenze massime per ingredienti/pasti? C'è uno storico vicino a queste date da considerare?

**Utente**

> Sono una donna di 35 anni, 68 kg, alta 169 cm. Lavoro come tecnica di laboratorio.
> Il 20 faccio 09:00–18:00, il 21 faccio 22:00–06:00 del giorno dopo e il 22 riposo.
> Ho solo questi turni confermati, nessuna matrice ripetitiva da applicare.
> Il 20 pranzo in mensa: mi è stato indicato un intervallo di 550–700 kcal,
> ma non so ancora i piatti. Al lavoro ho frigo e microonde. Accetto avanzi:
> prepara il pranzo del 21 insieme alla cena del 20.
> A casa ho piano cottura, forno, microonde e bollitore; fino a 30 minuti per pasto.
> Nessun budget preciso, nessuna allergia o restrizione. Escludi i peperoni;
> preferisco ceci, cous cous e piatti da preparare prima, senza una lista esclusiva.
> Preferisco piatti unici o secondo con contorno. Colazione alle 08:00, pranzo
> alle 13:00, cena alle 19:30; spuntino alle 16:30, ma il 21 alle 23:30 al lavoro.
> Come richiesta sugli zuccheri: massimo 60 g totali al giorno. Uova in massimo
> tre pasti ogni sette giorni. Non ho uno storico da allegare.

**Agente**

Uso i tre turni confermati, con `night-shift` e fine al giorno successivo per
il 21. Il limite alle uova è riferito ai pasti in finestre mobili di sette giorni:
il piano ne copre solo tre e lo storico esterno rimane sconosciuto. Il range
della mensa resta separato dai valori puntuali; non invento i piatti che servirà.

L'estratto seguente mostra il pasto che sarà modificato. La presentazione completa
della proposta aggiornata compare nella sezione 3.

### Estratto iniziale · Cena del 20 e pranzo del 21

**Cous cous con ceci e broccoli · piatto unico · quantità per una persona**

| Ingrediente | Quantità | Base |
| --- | --- | --- |
| Cous cous | 80 g | Secco |
| Ceci | 130 g | Scolati |
| Broccoli | 200 g | Crudi |
| Olio di oliva | 10 g | Come acquistato |

Valori dimostrativi della singola porzione: **608 kcal · proteine 24 g ·
carboidrati 89 g · grassi 15 g · zuccheri totali 6 g**.
Le due occorrenze hanno ID pasto distinti e condividono una preparazione.
La scheda della cena contiene solo la propria quota; le istruzioni indicano
di prepararne due, una per ciascun consumo.

## 2. La sostituzione

**Utente**

> Sostituisci i broccoli con le zucchine sia nella cena del 20 sia nel pranzo
> collegato del 21. Aggiorna anche i valori e genera i due file completi,
> uno italiano e uno inglese.

**Agente**

Aggiorno entrambi i consumi della preparazione, come richiesto. Propongo 250 g
di zucchine per persona al posto di 200 g di broccoli: cambia la quantità e
la consistenza del piatto; non è una dichiarazione di equivalenza nutrizionale.

| Voce di ogni porzione | Prima | Dopo |
| --- | --- | --- |
| Verdura | Broccoli, 200 g crudi | Zucchine, 250 g crude |
| Energia dimostrativa | 608 kcal | 585 kcal |
| Proteine dimostrative | 24 g | 22 g |
| Carboidrati dimostrativi | 89 g | 85 g |
| Grassi dimostrativi | 15 g | 15 g |
| Zuccheri totali dimostrativi | 6 g | 8 g |

La riga ingrediente passa da `broccoli` a `zucchini`; le occorrenze mantengono
`mealId`, il batch rimane collegato e la variante usa
`recipeId: "couscous-chickpeas-zucchini"`. Aggiorno istruzioni, dati delle righe,
dei pasti e riepiloghi. Le altre occorrenze restano nella proposta corrente.

## 3. Proposta aggiornata per sezioni

### 🧭 Il tuo piano

**Tre giorni fra turni e riposo · 20–22 ottobre 2026 · italiano**

Quantità e nutrizione si riferiscono a **una persona**. La data iniziale sarà
confermata nella PWA. Tutti i numeri di questo esempio sono dimostrativi.

| Scelta | Organizzazione concordata |
| --- | --- |
| Obiettivo | Organizzare pasti attorno ai turni; nessun target kcal o macro. |
| Preferenze | Ceci e cous cous; esclusi i peperoni; whitelist non esclusiva. |
| Struttura | Piatto unico oppure secondo con contorno. |
| Zuccheri e frequenze | Richieste registrate nei metadati, senza valutatori nell'app. |
| Contesto incompleto | Piatti della mensa e storico esterno al periodo non disponibili. |

### 🧺 Organizzazione pratica

La cena del 20 produce due porzioni della preparazione: una per la cena stessa
e una per il pranzo del 21. Gli ingredienti nei due pasti rappresentano le
singole quote consumate; la spesa le somma una volta ciascuna. Il pranzo del
20 viene acquistato in mensa e non aggiunge ingredienti fittizi alla spesa.
Il turno notturno è classificato sulla giornata del 21; lo spuntino delle
23:30 appartiene ancora alla data civile del 21.

### 📅 Le giornate


---

### Martedì 20 ottobre 2026 · turno diurno 09:00–18:00

| Ora | Pasto | Proposta |
| --- | --- | --- |
| 08:00 | Colazione | Avena con latte e banana |
| 13:00 | Pranzo | Pranzo in mensa da scegliere sul posto |
| 16:30 | Spuntino | Mela e mandorle |
| 19:30 | Cena | Cous cous con ceci e zucchine |

#### 08:00 · Colazione — Avena con latte e banana

**Piatto unico · 8 minuti · una persona**

| Ingrediente | Quantità per persona | Base |
| --- | --- | --- |
| Fiocchi di avena | 50 g | Secco |
| Latte | 180 ml | Come acquistato |
| Banana | 100 g | Crudo |

**Preparazione:** Scalda il latte, aggiungi l’avena e cuoci fino alla consistenza desiderata. Completa con la banana a fette.

**Valori dimostrativi per persona:** 365 kcal · proteine 14 g · carboidrati 60 g · grassi 7 g · zuccheri totali 22 g.

#### 13:00 · Pranzo — Pranzo in mensa da scegliere sul posto

**Pasto esterno · una persona**

Intervallo dichiarato: **550–700 kcal**. Proteine, carboidrati, grassi e zuccheri non disponibili. La composizione sarà nota sul posto; gli ingredienti sono compresi nel servizio e non generano voci della spesa.

#### 16:30 · Spuntino — Mela e mandorle

**Piatto unico · 2 minuti · una persona**

| Ingrediente | Quantità per persona | Base |
| --- | --- | --- |
| Mela | 150 g | Crudo |
| Mandorle | 20 g | Come acquistato |

**Preparazione:** Lava la mela e prepara le mandorle in un contenitore.

**Valori dimostrativi per persona:** 198 kcal · proteine 4 g · carboidrati 20 g · grassi 10 g · zuccheri totali 16 g.

#### 19:30 · Cena — Cous cous con ceci e zucchine

**Piatto unico · 20 minuti · una persona**

| Ingrediente | Quantità per persona | Base |
| --- | --- | --- |
| Cous cous | 80 g | Secco |
| Ceci | 130 g | Scolato |
| Zucchine | 250 g | Crudo |
| Olio di oliva | 10 g | Come acquistato |

**Preparazione:** Prepara due porzioni: usa il doppio delle quantità della scheda, che descrivono un solo consumo. Cuoci le zucchine a pezzi con l’olio, prepara il cous cous seguendo la confezione e unisci i ceci scolati. Dividi la preparazione: una porzione per questa cena e una per il pranzo del 21 ottobre. Organizza la conservazione secondo le indicazioni degli ingredienti.

**Valori dimostrativi per persona:** 585 kcal · proteine 22 g · carboidrati 85 g · grassi 15 g · zuccheri totali 8 g.

**Riepilogo personale parziale — mensa esclusa:** 1148 kcal · proteine 40 g · carboidrati 165 g · grassi 32 g · zuccheri totali 46 g. Numeri dimostrativi.
Il range di 550–700 kcal della mensa resta separato. Questa somma non descrive l’intera giornata.

---

### Mercoledì 21 ottobre 2026 · turno notturno 22:00–06:00 (+1 giorno)

| Ora | Pasto | Proposta |
| --- | --- | --- |
| 08:00 | Colazione | Yogurt, pane e frutti di bosco |
| 13:00 | Pranzo | Cous cous con ceci e zucchine |
| 19:30 | Cena | Pollo con patate e carote |
| 23:30 | Spuntino | Mela e mandorle |

#### 08:00 · Colazione — Yogurt, pane e frutti di bosco

**Piatto unico · 5 minuti · una persona**

| Ingrediente | Quantità per persona | Base |
| --- | --- | --- |
| Yogurt bianco | 170 g | Come acquistato |
| Pane integrale | 60 g | Come acquistato |
| Frutti di bosco | 100 g | Crudo |

**Preparazione:** Servi lo yogurt con i frutti di bosco e il pane a parte.

**Valori dimostrativi per persona:** 305 kcal · proteine 15 g · carboidrati 43 g · grassi 7 g · zuccheri totali 15 g.

#### 13:00 · Pranzo — Cous cous con ceci e zucchine

**Piatto unico · 5 minuti · una persona**

| Ingrediente | Quantità per persona | Base |
| --- | --- | --- |
| Cous cous | 80 g | Secco |
| Ceci | 130 g | Scolato |
| Zucchine | 250 g | Crudo |
| Olio di oliva | 10 g | Come acquistato |

**Preparazione:** Usa la porzione attribuita a questo pranzo, preparata con la cena del 20 ottobre. La scheda indica la sua quota di ingredienti, senza aggiungere l’intera preparazione.

**Valori dimostrativi per persona:** 585 kcal · proteine 22 g · carboidrati 85 g · grassi 15 g · zuccheri totali 8 g.

#### 19:30 · Cena — Pollo con patate e carote

**Secondo con contorno · 30 minuti · una persona**

| Ingrediente | Quantità per persona | Base |
| --- | --- | --- |
| Petto di pollo | 150 g | Crudo |
| Patate | 250 g | Crudo |
| Carote | 180 g | Crudo |
| Olio di oliva | 10 g | Come acquistato |

**Preparazione:** Taglia le patate e le carote, condiscile con l’olio e cuocile in forno. Cuoci il pollo e servi con le verdure. Segui le indicazioni di cottura del prodotto.

**Valori dimostrativi per persona:** 515 kcal · proteine 40 g · carboidrati 56 g · grassi 13 g · zuccheri totali 10 g.

#### 23:30 · Spuntino — Mela e mandorle

**Piatto unico · 2 minuti · una persona**

| Ingrediente | Quantità per persona | Base |
| --- | --- | --- |
| Mela | 150 g | Crudo |
| Mandorle | 20 g | Come acquistato |

**Preparazione:** Lava la mela e prepara le mandorle in un contenitore.

**Valori dimostrativi per persona:** 198 kcal · proteine 4 g · carboidrati 20 g · grassi 10 g · zuccheri totali 16 g.

**Riepilogo personale dei pasti elencati:** 1603 kcal · proteine 81 g · carboidrati 204 g · grassi 45 g · zuccheri totali 49 g. Numeri dimostrativi.

---

### Giovedì 22 ottobre 2026 · riposo

| Ora | Pasto | Proposta |
| --- | --- | --- |
| 08:00 | Colazione | Avena con latte e banana |
| 13:00 | Pranzo | Riso con tonno e pomodori |
| 16:30 | Spuntino | Arancia e semi di zucca |
| 19:30 | Cena | Uova con spinaci e pane |

#### 08:00 · Colazione — Avena con latte e banana

**Piatto unico · 8 minuti · una persona**

| Ingrediente | Quantità per persona | Base |
| --- | --- | --- |
| Fiocchi di avena | 50 g | Secco |
| Latte | 180 ml | Come acquistato |
| Banana | 100 g | Crudo |

**Preparazione:** Scalda il latte, aggiungi l’avena e cuoci fino alla consistenza desiderata. Completa con la banana a fette.

**Valori dimostrativi per persona:** 365 kcal · proteine 14 g · carboidrati 60 g · grassi 7 g · zuccheri totali 22 g.

#### 13:00 · Pranzo — Riso con tonno e pomodori

**Piatto unico · 20 minuti · una persona**

| Ingrediente | Quantità per persona | Base |
| --- | --- | --- |
| Riso | 80 g | Secco |
| Tonno al naturale | 100 g | Scolato |
| Pomodori | 200 g | Crudo |
| Olio di oliva | 10 g | Come acquistato |

**Preparazione:** Cuoci il riso seguendo la confezione. Unisci tonno scolato, pomodori a pezzi e olio.

**Valori dimostrativi per persona:** 521 kcal · proteine 33 g · carboidrati 68 g · grassi 12 g · zuccheri totali 5 g.

#### 16:30 · Spuntino — Arancia e semi di zucca

**Piatto unico · 3 minuti · una persona**

| Ingrediente | Quantità per persona | Base |
| --- | --- | --- |
| Arancia | 160 g | Crudo |
| Semi di zucca | 20 g | Come acquistato |

**Preparazione:** Sbuccia l’arancia e servi con i semi a parte.

**Valori dimostrativi per persona:** 185 kcal · proteine 7 g · carboidrati 18 g · grassi 9 g · zuccheri totali 13 g.

#### 19:30 · Cena — Uova con spinaci e pane

**Secondo con contorno · 15 minuti · una persona**

| Ingrediente | Quantità per persona | Base |
| --- | --- | --- |
| Uova | 2 pezzi | Crudo |
| Spinaci | 200 g | Crudo |
| Pane integrale | 70 g | Come acquistato |
| Olio di oliva | 5 g | Come acquistato |

**Preparazione:** Cuoci gli spinaci in padella con l’olio. Prepara le uova nella stessa padella e servi con il pane.

**Valori dimostrativi per persona:** 415 kcal · proteine 24 g · carboidrati 36 g · grassi 18 g · zuccheri totali 3 g.

**Riepilogo personale dei pasti elencati:** 1486 kcal · proteine 78 g · carboidrati 182 g · grassi 46 g · zuccheri totali 43 g. Numeri dimostrativi.

### ✏️ File e modifiche successive

I due file contengono la proposta completa dopo la sostituzione, con `baseServings: 1`, stessi ID tecnici delle occorrenze e una sola lingua per ogni documento. L’app inizializza a una persona tutti i pasti.

- [File italiano](../examples/release-1.1/meal-plan-it.diet).
- [File inglese](../examples/release-1.1/meal-plan-en.diet).

Questi collegamenti sono agli esempi realmente presenti nel repository. In una chat operativa l’agente deve creare gli allegati con gli strumenti disponibili e fornire soltanto il collegamento effettivamente prodotto.

Una successiva richiesta può modificare un’altra ricetta, un ingrediente o l’intero piano. La lingua UI non traduce questi testi; per una nuova traduzione si genera un altro file nella chat. Il numero di persone da cucinare cambia le quantità della preparazione e della spesa, mantenendo personali tutti i riepiloghi nutrizionali.
