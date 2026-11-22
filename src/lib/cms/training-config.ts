/**
 * CMS definition of the training schedule (src/data/training.json).
 * Shared by the main admin (/admin/) and the coach admin (/admin/trener/).
 */
import training from '../../data/training.json';

const DAYS: Record<string, string> = {
  monday: 'Ponedjeljak', tuesday: 'Utorak', wednesday: 'Srijeda', thursday: 'Četvrtak',
  friday: 'Petak', saturday: 'Subota', sunday: 'Nedjelja',
};
const q = (v: string) => JSON.stringify(v); // a JSON string is a valid YAML double-quoted scalar

/**
 * "Which training?" for an exception: a dropdown of the regular sessions as they were at the last
 * site build (a session added a minute ago appears after the next build, ~2 minutes after saving).
 */
function sessionOptions(): string {
  const sessions = ((training as { sessions?: { id: string; day: string; startTime: string; group: string }[] }).sessions ?? [])
    .filter((x) => x && x.id);
  if (!sessions.length) return '';
  const opts = sessions.map((x) => `{ label: ${q(`${DAYS[x.day] ?? x.day} ${x.startTime} – ${x.group}`)}, value: ${q(x.id)} }`);
  return `[${opts.join(', ')}]`;
}

export function trainingCollectionYaml(): string {
  const options = sessionOptions();
  const sessionField = options
    ? `{ label: "Koji trening", name: sessionId, widget: select, options: ${options}, hint: "Redoviti trening na koji se iznimka odnosi. Novi redoviti trening pojavi se ovdje nakon sljedeće objave (oko 2 minute nakon spremanja)." }`
    : `{ label: "ID treninga", name: sessionId, widget: string, hint: "ID iz popisa redovitih treninga" }`;
  // inline (flow) list – independent of the indentation where it is inserted
  const statusOptions =
    '[{ label: "Održava se", value: scheduled }, { label: "Otkazano", value: cancelled }, ' +
    '{ label: "Promjena termina", value: rescheduled }, { label: "Najava uskoro", value: pending }]';
  return `
      - name: training
        label: "Raspored treninga"
        file: src/data/training.json
        fields:
          - label: "Obavijesti (iznad rasporeda i na naslovnici)"
            name: announcements
            widget: list
            collapsed: true
            required: false
            summary: "{{fields.from}} – {{fields.until}}: {{fields.text}}"
            hint: "Kratke obavijesti, npr. „Za vrijeme školskih praznika nema treninga.” Prikazuju se samo između datuma Od i Do."
            fields:
              - { label: "Tekst obavijesti", name: text, widget: text }
              - { label: "Tekst (engleski)", name: textEn, widget: text, required: false }
              - { label: "Prikaži od", name: from, widget: datetime, format: "YYYY-MM-DD", time_format: false, required: false, hint: "Prazno = odmah" }
              - { label: "Prikaži do", name: until, widget: datetime, format: "YYYY-MM-DD", time_format: false, required: false, hint: "Prazno = dok je ne uklonite" }
              - { label: "Važno (istaknuto crveno)", name: important, widget: boolean, default: false, required: false }
          - label: "Redoviti tjedni treninzi"
            name: sessions
            widget: list
            collapsed: true
            required: false
            summary: "{{fields.day}} {{fields.startTime}} – {{fields.group}}"
            fields:
              - { label: "ID (jedinstven, bez razmaka)", name: id, widget: string, hint: "npr. pocetnici-utorak. Koristi se za iznimke – ne mijenjajte nakon objave." }
              - label: "Dan"
                name: day
                widget: select
                options:
                  - { label: "Ponedjeljak", value: monday }
                  - { label: "Utorak", value: tuesday }
                  - { label: "Srijeda", value: wednesday }
                  - { label: "Četvrtak", value: thursday }
                  - { label: "Petak", value: friday }
                  - { label: "Subota", value: saturday }
                  - { label: "Nedjelja", value: sunday }
              - { label: "Početak", name: startTime, widget: datetime, format: "HH:mm", date_format: false }
              - { label: "Kraj (neobavezno)", name: endTime, widget: datetime, format: "HH:mm", date_format: false, required: false }
              - { label: "Grupa", name: group, widget: string }
              - { label: "Grupa (engleski)", name: groupEn, widget: string, required: false }
              - { label: "Trener", name: coach, widget: string, required: false }
              - { label: "Mjesto", name: location, widget: string, required: false }
              - label: "Status"
                name: status
                widget: select
                default: scheduled
                options: ${statusOptions}
              - { label: "Napomena", name: note, widget: string, required: false }
              - { label: "Napomena (engleski)", name: noteEn, widget: string, required: false }
              - { label: "Vrijedi od", name: validFrom, widget: datetime, format: "YYYY-MM-DD", time_format: false, required: false }
              - { label: "Vrijedi do", name: validUntil, widget: datetime, format: "YYYY-MM-DD", time_format: false, required: false }
          - label: "Iznimke (otkazivanje ili promjena jednog termina)"
            name: exceptions
            widget: list
            collapsed: true
            required: false
            summary: "{{fields.date}} – {{fields.sessionId}} – {{fields.status}}"
            fields:
              - { label: "Datum treninga", name: date, widget: datetime, format: "YYYY-MM-DD", time_format: false }
              - ${sessionField}
              - label: "Status"
                name: status
                widget: select
                options: ${statusOptions}
              - { label: "Novi datum (ako je promjena termina)", name: newDate, widget: datetime, format: "YYYY-MM-DD", time_format: false, required: false }
              - { label: "Novi početak", name: newStartTime, widget: datetime, format: "HH:mm", date_format: false, required: false }
              - { label: "Novi kraj", name: newEndTime, widget: datetime, format: "HH:mm", date_format: false, required: false }
              - { label: "Zamjenski trener", name: coach, widget: string, required: false }
              - { label: "Napomena", name: note, widget: string, required: false }
              - { label: "Napomena (engleski)", name: noteEn, widget: string, required: false }
          - label: "Jednokratni treninzi i događaji"
            name: extra
            widget: list
            collapsed: true
            required: false
            summary: "{{fields.date}} {{fields.startTime}} – {{fields.group}}"
            fields:
              - { label: "Datum", name: date, widget: datetime, format: "YYYY-MM-DD", time_format: false }
              - { label: "Početak", name: startTime, widget: datetime, format: "HH:mm", date_format: false }
              - { label: "Kraj (neobavezno)", name: endTime, widget: datetime, format: "HH:mm", date_format: false, required: false }
              - { label: "Grupa / naziv", name: group, widget: string }
              - { label: "Grupa (engleski)", name: groupEn, widget: string, required: false }
              - { label: "Trener", name: coach, widget: string, required: false }
              - { label: "Mjesto", name: location, widget: string, required: false }
              - label: "Status"
                name: status
                widget: select
                default: scheduled
                options: ${statusOptions}
              - { label: "Napomena", name: note, widget: string, required: false }`;
}
