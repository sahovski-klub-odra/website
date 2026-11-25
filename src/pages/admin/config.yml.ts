/**
 * CMS configuration, generated at build time so the repository name and site URL
 * are always correct (GITHUB_REPOSITORY is set automatically inside GitHub Actions).
 */
import type { APIContext } from 'astro';
import site from '../../data/site.json';
import { trainingCollectionYaml } from '../../lib/cms/training-config';

/** Optional separate repository that holds only the training schedule (coach permissions, see docs/CMS.md). */
export const scheduleRepo = () => process.env.SCHEDULE_REPO || '';

export function GET({ site: siteUrl }: APIContext) {
  const repo = process.env.GITHUB_REPOSITORY || site.repository;
  const branch = process.env.CMS_BRANCH || 'main';
  const authUrl = process.env.CMS_AUTH_URL; // optional OAuth helper (Cloudflare Worker), see docs/CMS.md
  const base = import.meta.env.BASE_URL;
  const url = new URL(base, siteUrl).href;

  const trainingCollection = trainingCollectionYaml();
  const blog = (lang: 'hr', label: string) => `
  - name: blog-${lang}
    label: "${label}"
    label_singular: "Objava"
    folder: src/content/blog/${lang}
    path: "{{slug}}/index"
    media_folder: ""
    public_folder: ""
    create: true
    # folder (and, unless "Adresa" is filled in, the web address) comes from the title: "Božićni turnir" → bozicni-turnir
    slug: "{{slug}}"
    identifier_field: title
    summary: "{{title}} – {{pubDate | date('YYYY-MM-DD')}}"
    sortable_fields: [pubDate, title]
    view_filters:
      - { label: "Skice", field: draft, pattern: true }
    fields:
      - { label: "Naslov", name: title, widget: string }
      - { label: "Adresa (neobavezno)", name: slug, widget: string, required: false, pattern: ["^([a-z0-9]+(-[a-z0-9]+)*)?$", "Samo mala slova bez dijakritika, brojke i crtice, npr. bozicni-turnir-2026"], hint: "Ostavite prazno – adresa nastaje iz naslova. Upišite samo ako želite drukčiju, npr. bozicni-turnir-2026. Ne mijenjajte kod objavljenih članaka." }
      - { label: "Kratki opis (SEO opis)", name: description, widget: text, required: false, hint: "1–2 rečenice (do ~160 znakova). Prikazuje se na karticama i kao opis u Googleu." }
      - { label: "SEO naslov (neobavezno)", name: seoTitle, widget: string, required: false, hint: "Naslov u Googleu i na kartici preglednika, ako treba biti drukčiji od naslova članka (do ~50 znakova; „| ŠK Odra” dodaje se automatski)." }
      - { label: "Datum objave", name: pubDate, widget: datetime, format: "YYYY-MM-DDTHH:mm:ssZ", default: "{{now}}", hint: "Budući datum = zakazana objava: članak se pojavi tog dana (stranica se osvježava svako jutro)." }
      - { label: "Naslovna fotografija", name: image, widget: image, accept: "image/jpeg,image/png,image/webp,image/gif", required: false }
      - { label: "Opis naslovne fotografije (za slabovidne)", name: imageAlt, widget: string, required: false }
      - { label: "Potpis ispod naslovne fotografije (neobavezno)", name: imageCaption, widget: string, required: false }
      - { label: "Autor članka (neobavezno)", name: author, widget: string, required: false, hint: "Ime ili inicijali kako se autor potpisuje, npr. Darko ili Ivan M. Prikazuje se ispod članka kao „Članak napisao”." }
      - { label: "Album u galeriji (neobavezno)", name: album, widget: relation, collection: albums, value_field: "{{slug}}", search_fields: [title], display_fields: [title], required: false, hint: "Fotografije iz ovog članka automatski se prikazuju i u odabranom albumu galerije (datoteke se ne kopiraju)." }
      - { label: "Kategorije", name: categories, widget: list, required: false, default: [] }
      - { label: "Oznake", name: tags, widget: list, required: false, default: [] }
      - { label: "Skica (ne objavljuj)", name: draft, widget: boolean, default: false, required: false, hint: "Uključeno = spremljeno, ali nije vidljivo na stranici. Isključite i spremite za objavu." }
      - { label: "Tekst", name: body, widget: markdown, hint: "Naslovna fotografija prikazuje se iznad teksta – ne umećite je ponovno u tekst (ako je umetnete, na stranici se prikazuje samo jednom). Fotografije: gumb za sliku. Galerija: nekoliko fotografija jednu ispod druge. YouTube: zalijepite poveznicu u zaseban redak. Tablica, šahovska partija i dijagram: gumbi u alatnoj traci ili izbornik Insert." }`;

  const yml = `# Generated at build time by src/pages/admin/config.yml.ts – edit that file, not this output.
backend:
  name: github
  repo: ${repo}
  branch: ${branch}${authUrl ? `\n  base_url: ${authUrl}` : ''}
  # the "GitHub" button works only with the OAuth helper (CMS_AUTH_URL); without it, offer the token only
  auth_methods: ${authUrl ? '[oauth, token]' : '[token]'}
  commit_messages:
    create: "Novo: {{collection}} „{{slug}}”"
    update: "Izmjena: {{collection}} „{{slug}}”"
    delete: "Brisanje: {{collection}} „{{slug}}”"
    uploadMedia: "Upload: {{path}}"
    deleteMedia: "Brisanje datoteke: {{path}}"

site_url: ${url}
display_url: ${url}
logo:
  src: ${url}favicon.svg
media_folder: public/images/uploads
public_folder: /images/uploads
# Photos are converted in the browser before upload: WebP, at most 2400 px, quality 85.
# (No AVIF anywhere on the site – some services that display or share the site do not accept it.)
media_libraries:
  default:
    config:
      max_file_size: 26214400
      transformations:
        raster_image: { format: webp, quality: 85, width: 2400, height: 2400 }
# web addresses from titles: lower case, no diacritics ("Đurđevački šahovski turnir" → durdevacki-sahovski-turnir)
slug:
  encoding: ascii
  clean_accents: true
  sanitize_replacement: "-"

collections:${blog('hr', 'Novosti')}

  - name: albums
    label: "Galerija – albumi"
    label_singular: "Album"
    folder: src/content/gallery
    path: "{{slug}}/index"
    media_folder: ""
    public_folder: ""
    create: true
    slug: "{{year}}-{{slug}}"
    sortable_fields: [date, title]
    fields:
      - { label: "Naziv albuma", name: title, widget: string }
      - { label: "Datum", name: date, widget: datetime, format: "YYYY-MM-DD", time_format: false, default: "{{now}}" }
      - { label: "Opis", name: description, widget: text, required: false }
      - { label: "Godina ili sezona (neobavezno)", name: season, widget: string, required: false, hint: "npr. 2024. ili 2023./2024. Prikazuje se uz naziv albuma." }
      - { label: "Kategorija", name: category, widget: string, required: false, hint: "npr. Turniri, Liga, Mladi, Druženja. Na stranici Galerija albumi se mogu filtrirati po kategoriji. Pazite da istu kategoriju pišete uvijek jednako." }
      - { label: "Naslovna fotografija", name: cover, widget: image, accept: "image/jpeg,image/png,image/webp,image/gif", required: false, hint: "Ako je prazno, koristi se prva fotografija." }
      - { label: "Dodaj više fotografija odjednom", name: images, widget: image, accept: "image/jpeg,image/png,image/webp,image/gif", multiple: true, required: false, hint: "Browse → Upload → označite sve fotografije (Ctrl/Shift ili Cmd) → Insert. Za opis pojedine fotografije koristite popis ispod." }
      - label: "Fotografije s opisom"
        name: photos
        widget: list
        collapsed: true
        required: false
        summary: "{{fields.caption}}"
        hint: "Uklonjena fotografija nestaje sa stranice nakon spremanja."
        fields:
          - { label: "Fotografija", name: image, widget: image, accept: "image/jpeg,image/png,image/webp,image/gif" }
          - { label: "Opis", name: caption, widget: string, required: false }
      - { label: "Skica (ne objavljuj)", name: draft, widget: boolean, default: false, required: false }

  - name: data
    label: "Raspored, članovi, videozapisi, postavke"
    editor: { preview: false }
    files:
${scheduleRepo() ? '' : trainingCollection}
      - name: members
        label: "Članovi kluba"
        file: src/data/members.json
        fields:
          - { label: "Popis ažuriran (GGGG-MM-DD)", name: updated, widget: string, required: false }
          - label: "Članovi"
            name: members
            widget: list
            collapsed: true
            required: false
            summary: "{{fields.name}} {{fields.role}}"
            hint: "Redoslijed na stranici = redoslijed u ovom popisu (povucite ručicu ⋮⋮ za premještanje). Članovi s ulogom prikazuju se u odjeljku Vodstvo kluba."
            fields:
              - { label: "Ime i prezime", name: name, widget: string }
              - { label: "Uloga", name: role, widget: string, required: false, hint: "npr. Predsjednik, Trener, Igrač" }
              - label: "Titula"
                name: title
                widget: select
                required: false
                default: ""
                options: ["", GM, IM, FM, CM, WGM, WIM, WFM, WCM, NM, MK, KM]
              - { label: "Kategorija (MK, I, II, III, IV, V, vk)", name: category, widget: string, required: false }
              - { label: "FIDE rejting – standard", name: rating, widget: number, value_type: int, required: false }
              - { label: "FIDE rejting – ubrzani (rapid)", name: ratingRapid, widget: number, value_type: int, required: false }
              - { label: "FIDE rejting – brzopotezni (blitz)", name: ratingBlitz, widget: number, value_type: int, required: false }
              - { label: "FIDE ID", name: fideId, widget: string, required: false, hint: "Broj s ratings.fide.com – otvara FIDE profil." }
              - { label: "Matični broj (MB)", name: registrationNumber, widget: string, required: false }
              - { label: "Godište", name: birthYear, widget: number, value_type: int, required: false }
              - { label: "Fotografija", name: image, widget: image, accept: "image/jpeg,image/png,image/webp,image/gif", required: false, media_folder: /public/images/members, public_folder: /images/members }
              - { label: "Kratka biografija", name: bio, widget: text, required: false }
              - { label: "Prikaži na stranici", name: active, widget: boolean, default: true }

      - name: videos
        label: "Videozapisi"
        file: src/data/videos.json
        fields:
          - label: "Videozapisi"
            name: videos
            widget: list
            collapsed: true
            required: false
            summary: "{{fields.title}}"
            fields:
              - { label: "Naslov", name: title, widget: string }
              - { label: "Opis", name: description, widget: text, required: false }
              - { label: "YouTube poveznica", name: youtube, widget: string }
              - { label: "Datum (GGGG-MM-DD)", name: date, widget: string, required: false }

      - name: site
        label: "Postavke kluba i kontakt"
        file: src/data/site.json
        fields:
          - { label: "Naziv kluba", name: name, widget: string }
          - { label: "Kratki naziv", name: shortName, widget: string }
          - { label: "Logo – prvi redak", name: logoLine1, widget: string }
          - { label: "Logo – drugi redak", name: logoLine2, widget: string }
          - { label: "Uvodni tekst na naslovnici (ispod naslova)", name: tagline, widget: text, required: false }
          - { label: "O klubu", name: about, widget: text }
          - label: "Adresa"
            name: address
            widget: object
            fields:
              - { label: "Ulica i broj", name: street, widget: string, required: false }
              - { label: "Poštanski broj", name: postalCode, widget: string, required: false }
              - { label: "Naselje / kvart", name: locality, widget: string, required: false }
              - { label: "Grad", name: city, widget: string, required: false }
              - { label: "Država", name: country, widget: string, required: false }
          - { label: "Naziv prostora (npr. Društveni dom Mala Mlaka)", name: venue, widget: string, required: false }
          - { label: "E-pošta kluba", name: email, widget: string, required: false }
          - { label: "Telefon kluba", name: phone, widget: string, required: false }
          - label: "Kontakt osobe"
            name: contacts
            widget: list
            collapsed: true
            required: false
            summary: "{{fields.name}} – {{fields.phone}}"
            fields:
              - { label: "Ime i prezime", name: name, widget: string }
              - { label: "Uloga", name: role, widget: string, required: false }
              - { label: "Telefon", name: phone, widget: string, required: false }
              - { label: "E-pošta", name: email, widget: string, required: false }
          - { label: "OIB", name: oib, widget: string, required: false }
          - label: "Karta (OpenStreetMap)"
            name: map
            widget: object
            hint: "Koordinate: na openstreetmap.org desni klik na lokaciju → Show address."
            fields:
              - { label: "Geografska širina (npr. 45.7)", name: lat, widget: number, value_type: float, required: false }
              - { label: "Geografska dužina (npr. 15.9)", name: lon, widget: number, value_type: float, required: false }
              - { label: "Uvećanje", name: zoom, widget: number, value_type: int, default: 16 }
          - label: "Društvene mreže"
            name: social
            widget: object
            fields:
              - { label: "Facebook", name: facebook, widget: string, required: false }
              - { label: "Instagram", name: instagram, widget: string, required: false }
              - { label: "YouTube", name: youtube, widget: string, required: false }
              - { label: "Lichess (tim)", name: lichess, widget: string, required: false }
              - { label: "Chess.com (klub)", name: chesscom, widget: string, required: false }
          - label: "Kontakt obrazac"
            name: contactForm
            widget: object
            fields:
              - { label: "Servis", name: provider, widget: select, options: [none, formspree, web3forms, custom], default: none }
              - { label: "Adresa obrasca (endpoint)", name: endpoint, widget: string, required: false }
              - { label: "Pristupni ključ (Web3Forms)", name: accessKey, widget: string, required: false }
          - { label: "GitHub repozitorij", name: repository, widget: string, required: false }
          - { label: "Stara WordPress adresa", name: wordpressUrl, widget: string, required: false }
`;
  return new Response(yml, { headers: { 'Content-Type': 'text/yaml; charset=utf-8' } });
}
