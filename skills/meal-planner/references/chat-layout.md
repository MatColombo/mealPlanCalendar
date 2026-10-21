# Presentare il piano nella chat

La proposta deve essere comprensibile prima di aprire un file. Usare Markdown
leggibile su telefono, titoli brevi, separatori e poche icone coerenti. Non
richiedere una pagina web o uno strumento grafico per capire il piano.

## Indice

- [Intervista](#intervista)
- [Proposta: quattro sezioni](#proposta-quattro-sezioni)
- [Revisione: un prima e dopo concreto](#revisione-un-prima-e-dopo-concreto)

## Intervista

Aprire con una riga su ciò che è già noto e chiedere soltanto ciò che manca.
Usare al massimo dieci blocchi tematici iniziali, anche con sottocampi,
normalmente 2–4 blocchi per turno. Blacklist e whitelist condividono il blocco 8
dello SKILL.md; obiettivo e limiti numerici condividono il blocco 2.
Non riproporre domande risolte. Un rifiuto di fornire un dato è una risposta valida.

Esempio dei dieci blocchi, da ridurre e riordinare secondo il contesto reale:

1. Quali sono età, sesso, peso e altezza? Puoi lasciare un dato non fornito.
2. Qual è l'obiettivo e ci sono limiti per kcal, macro o zuccheri? Specifica le unità e se gli zuccheri sono totali o aggiunti.
3. Per quanti giorni, da quale data e in quale lingua vuoi il piano?
4. Che lavoro fai, con quali orari, turni e matrice? Per un ciclo servono una data di partenza e le eventuali eccezioni.
5. Quali pasti vanno preparati in anticipo o consumati fuori? Per la mensa conosci il range kcal? Hai frigo/microonde al lavoro e vuoi usare avanzi?
6. Quali attrezzature hai e quanto tempo puoi dedicare alla cucina? Ci sono condizioni di budget o spesa?
7. Quali allergie, intolleranze o restrizioni devo considerare?
8. Quali ingredienti e pasti vuoi escludere e quali preferisci? La lista dei preferiti è esclusiva?
9. Quali orari e strutture preferisci: piatto unico, primo e secondo, secondo con contorno o altro?
10. Quali frequenze desiderate o massime vuoi per ingredienti o pasti ogni sette giorni?

Prima della proposta dare priorità a profilo, obiettivo, allergie/restrizioni,
data iniziale e turni/matrice. Chiarire anche le condizioni pratiche che cambiano
i pasti, come mensa, anticipo, trasporto e attrezzatura. Un dato esplicitamente
lasciato ignoto rimane tale nella proposta. Altri chiarimenti mirati sono
possibili quando emergono nuove condizioni, senza un nuovo questionario
completo. Non inventare un profilo perché il modello richiede un campo e non
attribuire all'utente un esempio allegato.

## Proposta: quattro sezioni

### 1. 🧭 Il tuo piano

Usare un'intestazione compatta:

> **Titolo · 3–10 giorni · date suggerite · lingua**  
> Quantità e nutrizione per una persona. Le date si confermano nell'app.

Seguire con una breve tabella di scelte effettivamente utilizzate: obiettivo,
preferenze, orari/turni, preparazione, eventuali limiti e dati mancanti.
Non riscrivere il profilo personale completo quando non aiuta a leggere i pasti.

### 2. 🧺 Organizzazione pratica

Indicare quando preparare i pasti, quali porzioni conservare, quali pasti
esterni sono già previsti e quali attrezzature servono. Per una preparazione
condivisa distinguere quantità da preparare e quote dei singoli consumi.
Segnalare eventuali compromessi reali di tempo, costo o ripetizione.

### 3. 📅 Una sezione per ogni giorno

Separare le giornate con `---` e un titolo come:

**Mercoledì 21 ottobre 2026 · turno notturno, 22:00–06:00 (+1 giorno)**

Usare una piccola tabella di navigazione, massimo tre colonne:

| Ora | Pasto | Proposta |
| --- | --- | --- |
| 08:00 | Colazione | Nome leggibile |
| 13:00 | Pranzo | Nome leggibile |

Subito sotto, una scheda testuale per ciascun pasto:

#### 13:00 · Pranzo — Nome della ricetta

**Piatto unico · tempo di preparazione · 1 persona**

| Ingrediente | Quantità per persona | Base |
| --- | --- | --- |
| Nome | numero + unità | crudo/cotto/scolato, quando noto |

**Preparazione:** passaggi brevi e pratici. Per un pasto esterno descrivere
luogo e vincoli al posto di ingredienti inventati.

**Stima per persona:** energia in kcal · proteine in g · carboidrati in g ·
grassi in g. Zuccheri totali se richiesti, fibre se disponibili. Usare «n.d.»
per un dato mancante e spiegare il motivo vicino al dato.

A fine giornata aggiungere un riepilogo personale. Scrivere chiaramente
«parziale: dati della mensa non disponibili» quando manca un pasto; il range
kcal della mensa rimane separato. Non presentare una somma parziale come un
totale certo. Se non ci sono valori disponibili, dire che il riepilogo non è
disponibile, senza mostrare uno zero.

### 4. ✏️ Revisioni e file

Ricordare in una frase che si può cambiare l'intero piano, un pasto o un
ingrediente. Esempi: «Sostituisci le zucchine a cena del 21»; «Sposta i piatti
caldi nei giorni di riposo». Se il file è già richiesto, generarlo nel medesimo
turno dopo la proposta, senza una conferma aggiuntiva.

Non mostrare JSON grezzo al posto della proposta, salvo richiesta esplicita.
Non usare immagini per rendere informazioni essenziali accessibili.

## Revisione: un prima e dopo concreto

Aprire con ciò che cambia e quali pasti coinvolge. Una tabella breve basta:

| Voce | Prima | Dopo |
| --- | --- | --- |
| Ingrediente del pasto identificato | Nome, quantità, base | Nome, nuova quantità, base |
| Preparazione | Passaggio interessato | Passaggio aggiornato |
| Stime personali | Valori precedenti disponibili | Nuovi valori o n.d. motivato |

Spiegare il compromesso pertinente; non promettere equivalenza nutrizionale
esatta. Se il batch collega un consumo successivo, applicare la revisione
anche a quello solo quando l'ambito è concordato. Aggiornare l'unica proposta
corrente e consegnare l'intero `.diet` quando richiesto.
