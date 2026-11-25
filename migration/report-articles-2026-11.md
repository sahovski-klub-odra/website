# Članci – duplikati fotografija i autori (studeni 2026.)

Generirano skriptama u sklopu uređenja stranice. Tekst članaka nije mijenjan, osim uklanjanja potpisa autora s kraja teksta i dvije umanjene kopije naslovne fotografije (vidi niže).

## 1. Duplikati fotografija

- Pregledano članaka: **442** (svi objavljeni) + 1 skica
- Članaka s duplikatom: **378**, ukupno **398** suvišnih pojavljivanja u tekstu
  - ista datoteka kao naslovna fotografija: 379
  - ista fotografija ponovljena u tekstu: 17
  - umanjena/obrezana kopija naslovne fotografije pod drugim imenom: 2 (uklonjeno iz Markdowna)
- Metoda: ista datoteka, isti sadržaj datoteke (MD5), perceptualni hash (dHash/aHash) i usporedba piksela za umanjene, ponovno spremljene i obrezane kopije.
- Provedba: `src/lib/remark-featured-dedupe.mjs` pri izradi stranice izostavlja naslovnu fotografiju i ponovljene fotografije iz teksta (vrijedi i za nove članke iz CMS-a). Markdown ostaje netaknut, pa se podebljanja i kurzivi oko fotografija ne kvare. Datoteke se ne brišu.
- Opis (alt) uklonjenog pojavljivanja premješten je u `imageAlt`, a potpis fotografije u `imageCaption` (prikazuje se ispod naslovne fotografije).

Obrezane kopije (uklonjene iz teksta):

- `kadetsko-prvenstvo-hrvatske-2025-sah-sunce-i-druzenje-u-trogiru`: `naslovna.jpg` = obrezana/ista fotografija kao naslovna `naslovna3.jpg`
- `kadetsko-prvenstvo-hrvatske-2025-sah-sunce-i-druzenje-u-trogiru`: `naslovna-1.jpg` = obrezana/ista fotografija kao naslovna `naslovna3.jpg`

## 2. Autori članaka

Izdvojeno: **240** članaka. Potpis je uklonjen iz teksta i upisan u polje `author`.

| Autor (prikaz) | Potpis u tekstu | Članaka |
|---|---|---|
| Darko | darko, Darko (jednom na kraju retka s fotografijama) | 130 |
| Ivan M | *IvanM* | 49 |
| Ivan V | **IvanV**, *IvanV*, Ivan V, IvanV | 27 |
| V. D. | v. d., v.d. | 25 |
| Trenić D. | Trenić D. | 6 |
| Darko Vidaković | Darko Vidaković | 2 |
| D. V. | d.v. | 1 |

Napomene: zapis je samo oblikovan (veliko početno slovo, razmak u „Ivan M”/„Ivan V”, inicijali „v.d.” → „V. D.”). Puna imena nisu dodavana. „Darko” i „Darko Vidaković” ostavljeni su kako su potpisani.

### Nejasni slučajevi za ručni pregled (članak nije mijenjan)

- [Ekipno prvenstvo osnovnih škola Grada Zagreba 2018. – kvalifikacije](../src/content/blog/hr/ekipno-prvenstvo-osnovnih-skola-grada-zagreba-2018-kvalifikacije/index.md) – potpis „darko, darko”: nakon potpisa slijedi tekst
- [Kadetsko prvenstvo Hrvatske, Trogir 2020.](../src/content/blog/hr/kadetsko-prvenstvo-hrvatske-trogir-2020/index.md) – potpis „darko”: nakon potpisa slijedi tekst
- [Kadetsko prvenstvo Zagreba](../src/content/blog/hr/kadetsko-prvenstvo-zagreba/index.md) – potpis „Darko”: nakon potpisa slijedi tekst
- [PRVENSTVO OSNOVNIH ŠKOLA NOVOG ZAGREBA  2017/2018](../src/content/blog/hr/prvenstvo-osnovnih-skola-novog-zagreba-20172018/index.md) – potpis „darko”: nakon potpisa slijedi tekst
- [Šahovski festival Zagreb 2016./2017.](../src/content/blog/hr/sahovski-festival-zagreb-2016-2017-najava/index.md) – potpis „darko”: nakon potpisa slijedi tekst
- [XIII. EKIPNO PRVENSTVO OSNOVNIH ŠKOLA NOVOG ZAGREBA](../src/content/blog/hr/xiii-ekipno-prvenstvo-osnovnih-skola-novog-zagreba/index.md) – potpis „darko”: nakon potpisa slijedi tekst
- „(photo by m.i.)” u članku *izvanredna-sjednica-predsjednistva-kluba* – oznaka autora fotografije, ne članka; nije dirano.

### Svi izdvojeni autori

| Članak | Autor |
|---|---|
| `12-prvenstvo-hrvatske-do-8-godina` | V. D. |
| `17-medunarodni-turnir-juniorki-busevec-2018` | Darko |
| `2-domjanicev-sahovski-festival` | Darko |
| `3-a-kadetska-liga-szz-centar-2024` | Ivan V |
| `3-a-kadetska-liga-szz-centar-2025` | Ivan V |
| `3-a-liga-szz-centar-2022` | Darko |
| `3-a-liga-szz-centar-2022-1-do-4-kolo` | Darko |
| `6-memorijalni-turnir-zeljko-matic` | Darko |
| `9-memorijal-zeljka-matica` | Darko |
| `brzopotezni-turnir-prosinac-2015` | Darko |
| `brzopotezni-turnir-sk-odra-1-mk` | Darko |
| `brzopotezni-turnir-u-klubu-luka-uvjerljivo-prvi` | Darko |
| `caissina-cizmica` | Darko |
| `cestitamo` | Darko |
| `cuger-petkom` | Darko |
| `danas-nema-sahovske-skole-petak-24-travnja-2015` | Darko |
| `drzavno-prvenstvo-ssd-republike-hrvatske-2017-2018-djevojcice` | Darko |
| `drzavno-prvenstvo-ssd-republike-hrvatske-2019-2020-djevojcice` | Darko |
| `drzavno-prvenstvo-ucenica-os-2019` | Darko |
| `drzavno-skolsko-prvenstvo-porec-20-22-11-2023` | Ivan M |
| `ekipno-brzopotezno-prvenstvo-hrvatske-2022` | Ivan M |
| `ekipno-prvenstvo-os-grada-zagreba-2015` | Darko |
| `ekipno-prvenstvo-os-grada-zagreba-2021-2022` | Darko |
| `ekipno-prvenstvo-os-grada-zagreba-2022-2023` | Darko |
| `ekipno-prvenstvo-os-grada-zagreba-2023-2024` | Ivan M |
| `ekipno-prvenstvo-os-grada-zagreba-2024-2025` | Ivan M |
| `ekipno-prvenstvo-os-grada-zagreba-2025-2026` | Ivan V |
| `ekipno-prvenstvo-os-n-zagreba-do-cetvrtog-razreda-2017-2018-mini-liga-prvi-krug` | Darko |
| `ekipno-prvenstvo-os-n-zagreba-do-cetvrtog-razreda-drugi-krug` | Darko |
| `ekipno-prvenstvo-os-n-zagreba-do-cetvrtog-razreda-prvi-krug` | Darko |
| `ekipno-prvenstvo-os-novog-zagreba` | Darko |
| `ekipno-prvenstvo-os-zagreba-za-djevojcice` | Trenić D. |
| `ekipno-prvenstvo-osnovnih-skola-grada-zagreba-2018-finale` | Darko |
| `ekipno-prvenstvo-osnovnih-skola-grada-zagreba-za-2014` | V. D. |
| `finale-ekipnog-prvenstva-os-grada-zagreba-2019` | Darko |
| `franka-sretan-rodendan` | Darko |
| `grand-prix-2015-novi-zagreb` | Darko |
| `hask-mladost-ii-sk-odra-2535` | Darko |
| `hask-zagreb-sk-odra-24` | Darko |
| `ii-a-kadetska-liga-2020` | Darko |
| `ii-juniroska-liga-2020` | Ivan M |
| `juniorsko-prvenstvo-hrvatske-split-2021` | Ivan M |
| `juniorsko-prvenstvo-hrvatske-vinkovci-2020` | Ivan M |
| `kadetska-i-juniorska-prvenstva-grada-zagreba-2023` | Darko |
| `kadetska-liga-2-krug-dugo-selo` | V. D. |
| `kadetska-liga-2015-drugi-krug` | Trenić D. |
| `kadetska-liga-treci-krug` | Darko |
| `kadetska-prvenstva-grada-zagreba-2024` | Ivan V |
| `kadetska-prvenstva-grada-zagreba-2025` | Ivan V |
| `kadetska-prvenstva-grada-zagreba-2026` | Ivan V |
| `kadetske-lige-2016` | Darko |
| `kadetske-lige-2016-drugi-krug` | Darko |
| `kadetske-lige-2016-treci-krug` | Darko |
| `kadetske-lige-2018` | Darko |
| `kadetske-lige-prvi-krug` | Darko |
| `kadetski-nastupi-studeni-2016` | Darko |
| `kadetski-turnir-pocetnika-21112015` | Darko |
| `kadetski-turnir-sk-odra-sk2015` | Darko |
| `kadetski-turniri-studeni-prosinac-2015` | Darko |
| `kadetsko-prvenstvo-hrvatske-2015` | Darko |
| `kadetsko-prvenstvo-hrvatske-2022-trogir` | Ivan M |
| `kadetsko-prvenstvo-hrvatske-2024-trogir` | Darko |
| `kadetsko-prvenstvo-hrvatske-2025-sah-sunce-i-druzenje-u-trogiru` | Ivan V |
| `kadetsko-prvenstvo-hrvatske-2026-bronca-za-sk-odru` | Ivan V |
| `kadetsko-prvenstvo-hrvatske-split-2015` | Darko |
| `kadetsko-prvenstvo-hrvatske-trogir-2016` | Darko |
| `kadetsko-prvenstvo-hrvatske-trogir-2017` | Darko |
| `kadetsko-prvenstvo-hrvatske-trogir-2019` | Darko |
| `kadetsko-prvenstvo-hrvatske-trogir-2021` | Darko |
| `kadetsko-prvenstvo-hrvatske-u-sahu-2014` | Darko |
| `kadetsko-prvenstvo-kluba-sijecanj-2017` | Darko |
| `kadetsko-prvenstvo-kluba-veliki-sijecanj-2017` | Darko |
| `kadetsko-prvenstvo-zajednice-zupanije-centar-rovisce-2016` | Darko |
| `karlovacki-sahovski-klub-sk-odra-3525` | V. D. |
| `karlovacki-sahovski-klub-sk-odra-3525-2` | Darko |
| `karlovacki-sk-sk-odra-42` | V. D. |
| `kraj-3-a-seniorske-lige` | Ivan M |
| `ksk-karlovac-ii-sk-odra-ii-3-5-2-5` | Ivan V |
| `ksk-karlovac-sk-odra` | Ivan M |
| `medunarodni-turnir-juniorki-busevec-2017` | Darko |
| `memorijalni-turnir-zeljka-matica-2015` | Darko |
| `memorijalni-turnir-zeljka-matica-2016` | Darko |
| `mini-liga-2017-18` | Darko |
| `mjesecni-kadetski-turnir-busevec` | Darko |
| `najava-kadetskih-turnira` | Darko |
| `najava-turnira` | Darko |
| `najava-turnira-sijecanj-veljaca-2018` | Darko |
| `najava-turnira-za-kadete` | V. D. |
| `najava-turnira-za-kadete-2` | Darko |
| `nastavak-ligaskih-natjecanja` | Darko |
| `nova-adresa-sahovskog-kluba` | Ivan M |
| `novogodisnji-turnir-dom-za-starije-centar` | Darko |
| `otvoreni-kadetski-turnir-u-arena-centru` | Darko |
| `plastificirane-iskaznice` | Darko |
| `plazma-sim-zagreb-2021` | Ivan M |
| `pocelo-je-2` | Trenić D. |
| `pojedinacna-kadetska-prvenstva-zagreba-2019-u9-u11` | Darko |
| `pojedinacna-kadetska-prvenstva-zagreba-2020-u13-u15` | Darko |
| `pojedinacno-juniorsko-i-kadetsko-prvenstvo-zzc-2017` | Darko |
| `pojedinacno-kadetsko-prvenstvo-zagreba-2016-do-9-i-11-godina` | Darko |
| `pojedinacno-kadetsko-prvenstvo-zagreba-2018` | Darko |
| `pojedinacno-kadetsko-prvenstvo-zagreba-do-9-i-11-godina-najava` | Darko |
| `pojedinacno-prvenstvo-hrvatske-u-ubrzanom-sahu-za-kadete-2017-u14` | Darko |
| `pojedinacno-prvenstvo-zagreba-do-9-i-11-rezultati` | Darko |
| `pojedinacno-ubrzano-kadetsko-prvenstvo-hrvatske-2018` | Darko |
| `pozivni-kadetski-turnir-sk-brestje-sesvete-studeni-2015` | Darko |
| `pripremni-turnir-sijecanj-2018` | Darko |
| `proljece-na-mreznici-cuger-u-gradu-na-cetiri-rijeke` | Ivan M |
| `prvenstva-os-drugi-krug-kadetske-lige` | Darko |
| `prvenstvo-hrvatske-za-kadete-i-kadetkinje-2014` | Darko |
| `prvenstvo-osnovnih-skola-grada-zagreba-2016-drugi-krug` | Darko |
| `prvenstvo-osnovnih-skola-grada-zagreba-2016-finale` | V. D. |
| `prvenstvo-osnovnih-skola-grada-zagreba-2016-prvi-krug` | Darko |
| `prvenstvo-osnovnih-skola-grada-zagreba-2016-treci-krug` | Darko |
| `prvenstvo-osnovnih-skola-grada-zagreba-2017-drugi-krug` | Darko |
| `prvenstvo-osnovnih-skola-grada-zagreba-2017-finale` | Darko |
| `prvenstvo-osnovnih-skola-grada-zagreba-najava` | Darko Vidaković |
| `prvenstvo-sk-odra-mladi-kadeti-2015` | Darko |
| `prvenstvo-sk-odra-stariji-kadeti-2015` | Darko |
| `raspored-domaca-zadaca` | Darko |
| `raspored-kadetskih-natjecanja-zima-proljece-2015` | Trenić D. |
| `sah-raspored-vazno` | Darko |
| `sah-raspored-vazno-2` | Darko |
| `sahovska-kadetska-liga-2015` | Darko Vidaković |
| `sahovska-skola` | Darko |
| `sahovska-skola-2` | Darko |
| `sahovska-skola-3` | Trenić D. |
| `sahovski-festival-zagreb-2015` | Darko |
| `sahovski-kadetski-turnir-jankomir-listopad-2016` | Darko |
| `sahovski-kadetski-turnir-sesvetski-kraljevec-rujan-2016` | Darko |
| `sahovski-turnir-u-o-s-sveta-klara` | Darko |
| `sd-sisak-sk-odra-2535` | Ivan M |
| `sd-sisak-sk-odra-3525` | Ivan M |
| `sesvete-2023-vi-otvoreni-kadetski-i-juniorski-sahovski-turnir` | Darko |
| `sk-ban-jelacic-sk-odra-4515` | Ivan M |
| `sk-donja-stubica-sk-odra-2535` | Ivan M |
| `sk-dubrava-sk-odra-1-5` | Ivan M |
| `sk-dugo-selo-ii-sk-odra-ii-24` | Ivan V |
| `sk-dugo-selo-ii-sk-odra-ii-2535` | Ivan V |
| `sk-dugo-selo-sk-odra-1-5` | V. D. |
| `sk-dugo-selo-sk-odra-4515` | Darko |
| `sk-dugo-selo-sk-odra-4515-2` | Darko |
| `sk-hask-sk-odra-ii-24` | Ivan V |
| `sk-ina-sk-odra-15` | V. D. |
| `sk-ina-sk-odra-3-3` | Ivan M |
| `sk-jaska-sk-odra-33` | Darko |
| `sk-jaska-sk-odra-3525` | Darko |
| `sk-jaska-sk-odra-45-15` | V. D. |
| `sk-klaka-sk-odra-42` | V. D. |
| `sk-koncar-ii-sk-odra-2535` | Darko |
| `sk-koncar-sk-odra` | Ivan M |
| `sk-maksimir-sk-odra-1-5` | V. D. |
| `sk-odra-hask-mladost-ii-4515` | Darko |
| `sk-odra-ii-sk-duga-resa-0-55-5` | Ivan V |
| `sk-odra-ii-sk-hask-42` | Ivan V |
| `sk-odra-ii-sk-jakovlje-3-52-5` | Ivan V |
| `sk-odra-ii-sk-maksimir-2535` | Ivan V |
| `sk-odra-ii-sk-maksimir-3-3` | Ivan V |
| `sk-odra-ii-sk-novi-zagreb-ii-33` | Ivan V |
| `sk-odra-ii-sk-sloga-novoselec-kriz-24` | Ivan V |
| `sk-odra-ii-sk-zapresic-ii-4515` | Ivan V |
| `sk-odra-ksk-karlovac` | Ivan M |
| `sk-odra-sd-sisak-24` | Ivan M |
| `sk-odra-sk-ban-jelacic-1545` | Darko |
| `sk-odra-sk-ban-jelacic-42` | V. D. |
| `sk-odra-sk-caissa-2535` | Darko |
| `sk-odra-sk-gaj-3525` | Ivan M |
| `sk-odra-sk-hrt-33` | V. D. |
| `sk-odra-sk-ina-1545` | Darko |
| `sk-odra-sk-ina-5505` | V. D. |
| `sk-odra-sk-ivanic-4515` | Ivan M |
| `sk-odra-sk-jaska-51` | V. D. |
| `sk-odra-sk-koncar-1545` | D. V. |
| `sk-odra-sk-koncar-1545-2` | Ivan M |
| `sk-odra-sk-koncar-2-4` | V. D. |
| `sk-odra-sk-koncar-24` | Ivan M |
| `sk-odra-sk-koncar-25-35` | V. D. |
| `sk-odra-sk-maksimir-42` | V. D. |
| `sk-odra-sk-oroslavje-3525` | Ivan M |
| `sk-odra-sk-polet-4515` | Ivan M |
| `sk-odra-sk-prigorje-markusevec-1545` | Darko |
| `sk-odra-sk-silent-24` | Darko |
| `sk-odra-sk-silent-2535` | Darko |
| `sk-odra-sk-spansko-15` | Darko |
| `sk-odra-sk-spansko-2-4` | V. D. |
| `sk-odra-sk-spansko-33` | Darko |
| `sk-odra-sk-spansko-3525` | Ivan M |
| `sk-odra-sk-spansko-4-2` | Ivan M |
| `sk-odra-sk-stjepan-bosak-35-25` | V. D. |
| `sk-odra-sk-stjepan-bosak-51` | Ivan M |
| `sk-odra-sk-sv-nedelja-ii-3-3` | Darko |
| `sk-odra-sk-sveta-nedelja-ii-33` | Ivan M |
| `sk-odra-sk-travno-2535` | Ivan M |
| `sk-odra-sk-uhbdr-99-brigade-33` | Darko |
| `sk-odra-sk-velika-gorica-24` | Darko |
| `sk-odra-sk-velika-gorica-3525` | Ivan M |
| `sk-odra-sk-zapresic-33-2` | Ivan M |
| `sk-odra-sk-zapresic-4515` | Ivan M |
| `sk-oroslavje-sk-odra-3525` | Ivan M |
| `sk-oroslavje-sk-odra-3525-2` | Ivan M |
| `sk-polet-ii-sk-odra-2-4` | Ivan M |
| `sk-pravi-potez-sk-odra-ii-1-5-4-5` | Ivan V |
| `sk-prigorje-markusevec-sk-odra-51` | Darko |
| `sk-prigorje-markusevec-sk-odra-zagreb-4515` | Darko |
| `sk-ralu-logistika-rugvica-sk-odra-15` | Ivan M |
| `sk-samobor-sk-odra-4515` | Ivan M |
| `sk-silent-sk-odra-ii-1545` | Ivan V |
| `sk-spansko-ii-sk-odra-ii-35-25` | Ivan V |
| `sk-spansko-sk-odra-2-4` | Ivan M |
| `sk-spansko-sk-odra-33-2` | Ivan M |
| `sk-spansko-sk-odra-3525` | Darko |
| `sk-stjepan-bosak-sk-odra-4515` | Ivan M |
| `sk-stjepan-bosak-uriho-sk-odra-51` | Darko |
| `sk-straza-sk-odra-3525` | Ivan M |
| `sk-sveta-nedelja-ii-sk-odra-33` | Ivan M |
| `sk-travno-ii-sk-odra-ii-42` | Ivan V |
| `sk-travno-ii-sk-odra-ii-5-1` | Ivan V |
| `sk-travno-sk-odra-24` | Ivan M |
| `sk-travno-sk-odra-42` | Ivan M |
| `sk-vladimir-ivetic-sk-odra-3525` | Darko |
| `sk-vrbani-sk-odra-25-35` | V. D. |
| `sk-vrbani-sk-odra-3-3` | V. D. |
| `sk-vrbani-sk-odra-33` | Darko |
| `sk-vrbovec-ii-sk-odra-2-535` | V. D. |
| `sk-vrustun-1252-sk-odra-24` | Darko |
| `sk-zapresic-sk-odra-33` | V. D. |
| `sk-zapresic-sk-odra-33-2` | Ivan M |
| `sk-zapresic-sk-odra-3525` | Ivan V |
| `trece-mjesto-prvenstvo-zagreba-2014-do-11-godina` | Darko |
| `turnir-kadeta-pocetnika-sk-odra-2016` | Darko |
| `turnir-pocetnika-sesvetski-kraljevec-svibanj-2015` | Darko |
| `turnir-sahovska-liga-hrvatski-branitelj-2025` | Ivan V |
| `turnir-u-roviscu` | Darko |
| `u-petak-nema-saha` | Darko |
| `vi-otvoreno-kadetsko-prvenstvo-krapinsko-zagorske-zupanije` | Darko |
| `xiv-ekipno-prvenstvo-osnovnih-skola-novog-zagreba` | Darko |
| `xv-ekipno-sahovsko-prvenstvo-osnovnih-skola-novog-zagreba-dugave-open-2016` | Darko |
| `xvi-ekipno-sahovsko-prvenstvo-osnovnih-skola-novog-zagreba-dugave-open-2017` | Darko |
| `zagreb-open-i-memorijal-krunoslava-hulaka-2016` | Darko |
| `zavrseno-je-12-pojedinacno-prvenstvo-hrvatske-za-djecake-i-djevojcice-do-8-godina` | Trenić D. |
