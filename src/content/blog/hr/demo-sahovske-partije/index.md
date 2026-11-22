---
title: "Demonstracija: interaktivni prikaz šahovskih partija"
slug: "demo-sahovske-partije"
description: "Probni članak koji pokazuje kako se šahovske partije prikazuju na stranici – s pločom, popisom poteza, komentarima i varijantama."
pubDate: 2026-11-21T12:00:00Z
categories: ["Upute"]
tags: ["pgn", "partije"]
draft: true
---
Ovaj članak služi za isprobavanje prikaza partija. Označen je kao **skica** (`draft: true`), pa se ne objavljuje na stvarnoj stranici kluba – vidljiv je samo u lokalnom razvoju (`npm run dev`). Prikazane su poznate povijesne partije, ne partije članova kluba.

Kliknite bilo koji potez u popisu, koristite gumbe ispod ploče ili tipke **←** i **→**. Gumb ▶ pokreće automatsku reprodukciju, a brzinu možete promijeniti pokraj njega.

## Partija s komentarima i varijantama

Prva partija upisana je izravno u članak, kao PGN blok. Sadrži komentare i dvije varijante (sive linije ispod poteza 3… Lg4 i 4… Lxf3).

```pgn Morphy – vojvoda od Braunschweiga i grof Isouard, Pariz 1858.
[Event "Pariška opera"]
[Site "Pariz FRA"]
[Date "1858.11.02"]
[Round "?"]
[White "Morphy, Paul"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]
[ECO "C41"]

{Jedna od najpoznatijih partija u povijesti šaha – odigrana u loži pariške opere.}
1. e4 e5 2. Nf3 d6 {Philidorova obrana.} 3. d4 Bg4?! {Gubi tempo – bolje je 3...exd4.}
(3... exd4 4. Nxd4 Nf6 5. Nc3 Be7 {s mirnom pozicijom.})
4. dxe5 Bxf3 (4... dxe5 5. Qxd8+ Kxd8 6. Nxe5 {i bijeli dobiva pješaka.}) 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5! cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7! Rxd7 14. Rd1 Qe6
15. Bxd7+ Nxd7 16. Qb8+!! {Spektakularna žrtva dame.} 16... Nxb8 17. Rd8# 1-0
```

## Više partija iz jedne PGN datoteke

Druga ploča učitava priloženu datoteku `anderssen-partije.pgn` s dvije partije – odaberite partiju iz izbornika iznad ploče. Tako se mogu objaviti sve partije jednog kola turnira.

[Anderssenove besmrtne partije](anderssen-partije.pgn)

## Pozicija (dijagram)

Za prikaz jedne pozicije dovoljan je FEN zapis:

```fen
6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1
```

Bijeli na potezu daje mat u jednom potezu: 1. Td8#.

## Kako dodati partiju

- **U uređivaču (`/admin/`):** u tekstu članka odaberite *Insert → Šahovska partija*, zalijepite PGN ili učitajte `.pgn` datoteku.
- **Ručno u Markdownu:** napišite PGN između redaka ```` ```pgn ```` i ```` ``` ````, ili u zaseban redak stavite poveznicu na `.pgn` datoteku koja se nalazi u mapi članka.
