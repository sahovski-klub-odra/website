# Upute za urednike i trenere

Stranica nema bazu podataka – sav sadržaj su obične datoteke u GitHub repozitoriju. Svaka spremljena promjena automatski se objavljuje na stranici za **1–2 minute**.

Ako napravite grešku (npr. upišete vrijeme `25:00`), stranica se **neće pokvariti**: objava se zaustavi, a na stranici ostaje prethodna ispravna verzija. U kartici **Actions** na GitHubu vidjet ćete crveni ❌ s opisom greške na hrvatskom.

---

## Način 1: uređivač na stranici (`/admin/`) – preporučeno

### Prijava
1. Otvorite `https://<adresa-stranice>/admin/` (treneri: `https://<adresa-stranice>/admin/trener/`).
2. Kliknite **Prijava pomoću pristupnog tokena** i zalijepite svoj token. Token se izrađuje jednom na GitHubu
   (postupak: `docs/CMS.md` → „Signing in”), a preglednik ga pamti.
3. Na tuđem ili zajedničkom računalu uvijek se odjavite: ikona računa gore desno → **Odjava**.
   Token nikad ne šaljite e-poštom ni porukom.

Uređivač je na hrvatskom. Lijevo su odjeljci: *Novosti*, *Galerija – albumi* i
*Raspored, članovi, videozapisi, postavke*.

### Nova objava (kao u WordPressu)
1. **Novosti** → **Novo**.
2. Upišite **Naslov**. Adresu ne morate upisivati – nastaje iz naslova
   („Božićni turnir 2026” → `bozicni-turnir-2026`).
3. **Kratki opis** (1–2 rečenice, vidi se na karticama i u Googleu) i po želji **SEO naslov**.
4. **Naslovna fotografija** → **Pregledaj** → **Prenesi** → odaberite fotografiju → potvrdite. Upišite i kratki opis
   fotografije (za slabovidne). Naslovna fotografija prikazuje se iznad teksta – istu fotografiju ne treba
   umetati i u tekst (ako je ipak umetnete, na stranici se prikaže samo jednom).
   - **Autor članka** (neobavezno): ime ili inicijali kako se potpisujete, npr. *Darko* ili *Ivan M*.
     Ispod članka prikazuje se kao „Članak napisao: …”, pa potpis ne pišite na kraj teksta.
   - **Album u galeriji** (neobavezno): odaberite postojeći album – fotografije iz članka tada se automatski
     prikazuju i u tom albumu (datoteke se ne kopiraju).
5. **Kategorije** i **Oznake**: upišite jednu, za sljedeću kliknite **Dodaj**.
6. **Tekst** – alatna traka iznad teksta:
   - ¶ izbornik: naslovi (Naslov 2, Naslov 3), **B** podebljano, *I* kurziv, 🔗 poveznica, popisi;
   - gumb **tablica**: odaberite broj redaka i stupaca, pa upisujte u polja (Tab = sljedeće polje).
     Tablicu iz Excela zalijepite preko **Insert → Dodaj tablicu**;
   - gumb **slika**: fotografija u tekstu. **Galerija u članku:** nekoliko fotografija jednu ispod druge,
     bez teksta između – prikažu se kao mreža;
   - **YouTube**: zalijepite poveznicu na video u zaseban redak – na stranici postaje video;
   - **Dodaj šahovsku partiju** / **Dodaj šahovski dijagram**: vidi „Šahovske partije u člancima” niže.
7. Desno je **Pretpregled**.
8. **Objava:**
   - da članak odmah bude na stranici: ostavite *Skica (ne objavljuj)* isključeno i kliknite **Spremi**;
   - samo spremiti (nije vidljivo na stranici): uključite *Skica*, **Spremi**. Kasnije ga otvorite,
     isključite *Skica* i opet **Spremi**;
   - zakazana objava: **Datum objave** postavite u budućnost – članak se pojavi tog jutra.
9. Dolje desno je oznaka stanja: *Objavljivanje u tijeku…* → **Objavljeno na stranici ✓** (oko 2 minute).
   Ako piše *Objava nije uspjela*, kliknite je – GitHub pokazuje što ne valja, a stranica ostaje kakva je bila.

**Izmjena:** otvorite članak s popisa, promijenite, **Spremi**. **Brisanje:** otvorite članak → ⋮ (gore
desno) → **Izbriši**. Adresu objavljenog članka ne mijenjajte (stare poveznice prestale bi raditi).

### Galerija
*Galerija – albumi* → **Novo** → naziv albuma, datum (zadan je današnji), po želji **Kategorija**
(npr. *Turniri*, *Mladi* – na stranici Galerija albumi se mogu filtrirati; pišite je uvijek jednako).
- **Više fotografija odjednom:** *Dodaj više fotografija odjednom* → **Pregledaj** → **Prenesi** → označite sve
  fotografije (Ctrl/Shift, na Macu Cmd) → potvrdite.
- **Fotografija s opisom:** *Fotografije s opisom* → **Dodaj**.
- **Brisanje fotografije:** ✕ uz fotografiju, pa **Spremi** – nestaje sa stranice.
- Prva fotografija je naslovna, osim ako odaberete *Naslovnu fotografiju*.
- **Videozapisi:** *Raspored, članovi, videozapisi, postavke* → *Videozapisi* → **Dodaj** → naslov i YouTube poveznica.

### Članovi kluba
*Raspored, članovi, videozapisi, postavke* → **Članovi kluba**. Svaki član je jedan redak; kliknite ga za uređivanje.
- **Dodaj**: ime, uloga (npr. *Predsjednik*, *Trener* – članovi s ulogom prikazuju se u odjeljku Vodstvo kluba),
  titula, kategorija, rejtinzi, fotografija.
- **Redoslijed** na stranici = redoslijed u popisu: strelice ↑ ↓ ili povlačenje ručice.
- **Uklanjanje**: ✕ na retku člana. *Prikaži na stranici* isključeno = član ostaje zapisan, ali se ne prikazuje.

### Postavke kluba
*… → Postavke kluba i kontakt*: adresa, e-pošta, telefon, kontakt osobe, karta (koordinate),
društvene mreže, tekst „O klubu” i uvodni tekst na naslovnici.

### Raspored treninga (treneri)
Treneri otvaraju **`/admin/trener/`** i vide samo raspored. Administratori ga nalaze i pod
*Raspored, članovi, videozapisi, postavke → Raspored treninga*.
- **Obavijesti**: kratka obavijest iznad rasporeda i na naslovnici (npr. „Za vrijeme praznika nema treninga”),
  s datumima *Prikaži od* / *Prikaži do*. *Važno* = istaknuto crveno.
- **Redoviti tjedni treninzi**: dan, početak, kraj, grupa, trener, mjesto. Promjena vremena = promijenite i spremite.
- **Iznimke** (jedan datum): **Dodaj** → datum, **Koji trening** (odaberite s popisa), status
  *Otkazano* ili *Promjena termina* (+ novi datum/vrijeme), napomena.
- **Jednokratni treninzi i događaji**: turnir, simultanka, dodatni trening.

---

## Način 2: izravno na GitHubu (rezervni način)

### Otkazivanje ili promjena jednog treninga
1. Na GitHubu otvorite datoteku **`src/data/training.json`**.
2. Kliknite ikonu olovke ✏️ (*Edit this file*).
3. U popis `"exceptions"` dodajte zapis. Pazite na zareze između zapisa!

**Otkazivanje** (npr. utorak 1. 12. 2026.):
```json
"exceptions": [
  {
    "date": "2026-12-01",
    "sessionId": "pocetnici-utorak",
    "status": "cancelled",
    "note": "Trener je na turniru."
  }
]
```

**Premještanje** na drugi dan/sat:
```json
  {
    "date": "2026-12-03",
    "sessionId": "napredni-cetvrtak",
    "status": "rescheduled",
    "newDate": "2026-12-04",
    "newStartTime": "18:30",
    "newEndTime": "20:30"
  }
```
4. Dolje kliknite **Commit changes…** → **Commit changes**. Gotovo.

Redoviti utorak i dalje vrijedi za sve ostale tjedne – iznimka vrijedi samo za taj jedan datum.

### Statusi
| Vrijednost | Na stranici |
|---|---|
| `scheduled` | ODRŽAVA SE (zeleno) |
| `cancelled` | OTKAZANO (crveno) |
| `rescheduled` | PROMJENA TERMINA (narančasto) |
| `pending` | NAJAVA USKORO (plavo) |

### Novi redoviti trening
U popis `"sessions"` dodajte:
```json
  {
    "id": "mladi-subota",
    "day": "saturday",
    "startTime": "10:00",
    "endTime": "11:30",
    "group": "Mlađi uzrasti",
    "groupEn": "Juniors",
    "coach": "Ime Prezime",
    "status": "scheduled"
  }
```
- `day`: `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`
- `id`: jedinstven, bez razmaka i dijakritika; ne mijenjajte ga kasnije (iznimke se pozivaju na njega)
- po želji: `"validFrom": "2026-09-01"`, `"validUntil": "2027-06-30"` – trening vrijedi samo u tom razdoblju (npr. školska godina)

### Jednokratni događaj (turnir, simultanka…)
U popis `"extra"`:
```json
  {
    "date": "2026-12-20",
    "startTime": "16:00",
    "endTime": "19:00",
    "group": "Božićni blitz turnir",
    "status": "scheduled"
  }
```

Potpuni primjer svih mogućnosti: `docs/examples/training.example.json`.

---

## Česte greške
- **Zarez:** između zapisa u popisu mora biti zarez, iza zadnjeg zapisa ga ne smije biti.
- **Navodnici:** samo ravni navodnici `"`, ne `„ ”`.
- **Datum:** uvijek `GGGG-MM-DD`, npr. `2026-03-07`.
- **Vrijeme:** uvijek dvije znamenke, npr. `09:00`, ne `9:00`.

Ako niste sigurni, koristite `/admin/` – tamo su polja s padajućim izbornicima i provjerom.

---

## Šahovske partije u člancima

Svaka partija u članku prikazuje se kao interaktivna ploča: popis poteza, gumbi za kretanje, automatska reprodukcija, okretanje ploče i preuzimanje PGN-a. U jednom članku može biti koliko god partija želite.

### U uređivaču (`/admin/`)
1. Otvorite članak i kliknite u odlomak iza kojeg partija treba stajati, pa pritisnite Enter (novi prazan redak).
2. U alatnoj traci iznad teksta kliknite **Dodaj šahovsku partiju** (ikona skakača; na mobitelu i uskom ekranu nalazi se pod **Insert**).
3. Po želji upišite **naslov iznad ploče** (npr. „3. kolo: Horvat – Kovač”).
4. Partiju unesite na jedan od dva načina:
   - **zalijepite PGN** u polje *PGN zapis* (iz ChessBasea, Lichessa, Chess.coma, chess-results.com…), ili
   - kod *PGN datoteka* kliknite **Browse** → **Upload** → odaberite `.pgn` datoteku → **Insert**.
5. Desno u **pregledu** odmah vidite partiju točno onako kako će izgledati na stranici. Iznad ploče je provjera:
   - zeleno **✓ Partija je ispravna** (ili „Obje partije su ispravne”) – sve je u redu;
   - crveno **⚠ Provjerite zapis** – piše koji potez nije ispravan (npr. „Neispravan potez „Ke3” nakon 1... e5”). Ispravite zapis; ako ga objavite takvog, posjetitelji vide partiju do tog poteza.
6. Da nastavite pisati tekst ispod partije, kliknite u prazan redak ispod nje.
7. Kliknite **Save**.

Ako `.pgn` datoteka sadrži više partija (npr. cijelo kolo), posjetitelji ih biraju iz izbornika iznad ploče – i u pregledu i na stranici.

Za **dijagram** (samo pozicija, bez poteza) kliknite **Dodaj šahovski dijagram** i zalijepite FEN (na Lichessu: *Analiza → FEN*). Ako FEN nije ispravan, pregled napiše zašto (npr. „nedostaje bijeli kralj”).

Partiju kasnije mijenjate tako da u tekstu kliknete na nju i ispravite polja. Ostatak članka i ostale partije ostaju netaknuti.

### Ručno (na GitHubu)
PGN stavite između dva retka s tri obrnuta navodnika; tekst iza `pgn` je naslov (neobavezno):

````
```pgn 3. kolo: Horvat – Kovač
[White "Horvat, Ivan"]
[Black "Kovač, Marko"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 {Španjolska partija.} a6 (3... Nf6 4. O-O) 4. Ba4 1-0
```
````

Ili učitajte `.pgn` datoteku u mapu članka i u zaseban redak napišite: `[Partije 3. kola](kolo-3.pgn)`

Za **dijagram** (samo pozicija, bez poteza):

````
```fen
6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1
```
````

### Što je podržano
- komentari `{…}`, varijante `(…)` (i ugniježđene), oznake `!`, `?`, `!?`, `$1`…
- zaglavlja: igrači, rejting (`WhiteElo`), titule (`WhiteTitle`), turnir, kolo, mjesto, datum, otvaranje (`ECO`, `Opening`), rezultat
- početna pozicija iz `[FEN "…"]` (i skraćeni FEN bez brojeva poteza)
- ako potez u zapisu nije ispravan, ploča prikaže sve do tog poteza i jasnu poruku gdje je greška; `npm run verify:migration` također ispisuje takve greške

Primjer s dvije partije, komentarima, varijantama i dijagramom: članak `src/content/blog/hr/demo-sahovske-partije/`. To je **skica** – ne pojavljuje se na javnoj stranici, vidi se samo uz `npm run dev` i u uređivaču. Slobodno ga obrišite kad vam više ne treba.


### Galerija – albumi
- **Novi album:** *Galerija – albumi* → **Novo**. Upišite naziv, datum, po želji **Godinu ili sezonu**
  (npr. `2025.` ili `2024./2025.`), kategoriju (*Liga*, *Kadetska liga*, *Školska prvenstva*, *Turniri*,
  *Klupski život*) i kratki opis.
- **Dodavanje fotografija:** *Dodaj više fotografija odjednom* ili popis *Fotografije s opisom* (s opisom ispod fotografije).
- **Uklanjanje fotografije iz albuma:** obrišite stavku s popisa i spremite. Datoteka se ne briše, pa fotografija
  ostaje u članku u kojem je objavljena.
- **Naslovna fotografija albuma:** polje *Naslovna fotografija* (prazno = prva fotografija).
- Albumi sastavljeni iz arhive članaka pokazuju na fotografije u mapama članaka (`../../blog/hr/…`) –
  te stavke uređujete jednako kao ostale.
- **Fotografije na naslovnici:** naslovnica sama prikazuje najnovije fotografije iz galerije (vodoravne, barem 1000 px široke,
  najviše dvije iz istog albuma). Želite li određenu fotografiju, u albumu kod nje uključite **Istakni na naslovnici** –
  istaknute fotografije prikazuju se prve.

### Karta, zadatak dana i rang-liste na naslovnici
- **Karta:** *Postavke kluba i kontakt* → *Karta (Google Maps)*. Adresu ugrađene karte dobijete na google.com/maps:
  potražite adresu → **Podijeli** → **Ugradi kartu** → kopirajte adresu iz atributa `src`. API ključ nije potreban.
- **Zadatak dana** (Lichess) i **Top 10** (2700chess.com) učitavaju se sami svaki dan – ne treba ih uređivati.
