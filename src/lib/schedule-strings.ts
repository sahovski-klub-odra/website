import { useTranslations, locales, type Lang } from '../i18n/ui';
import type { ScheduleStrings } from './schedule-render';

export function scheduleStrings(lang: Lang): ScheduleStrings {
  const t = useTranslations(lang);
  const fmt = new Intl.DateTimeFormat(locales[lang], { weekday: 'short', timeZone: 'UTC' });
  // 2024-01-01 was a Monday
  const weekdaysShort = Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i))));
  return {
    lang,
    locale: locales[lang],
    status: {
      scheduled: t('schedule.status.scheduled'),
      cancelled: t('schedule.status.cancelled'),
      rescheduled: t('schedule.status.rescheduled'),
      pending: t('schedule.status.pending'),
    },
    none: t('schedule.none'),
    empty: t('schedule.empty'),
    group: t('schedule.group'),
    coach: t('schedule.coach'),
    time: t('schedule.time'),
    newTerm: t('schedule.newTerm'),
    movedFrom: t('schedule.movedFrom'),
    prevMonth: t('schedule.prevMonth'),
    nextMonth: t('schedule.nextMonth'),
    nextHeld: 'Sljedeći održani trening',
    offNote: 'Trening se ne održava',
    weekdaysShort,
  };
}
