export function timeOfDay(now, weather) {
  const timezone = weather?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now),
  );
  const solar = weather?.solarDays?.find(
    (day) => now >= day.sunrise - 6 * 3600000 && now < day.sunset + 6 * 3600000,
  );
  if (solar && Number.isFinite(solar.sunrise) && Number.isFinite(solar.sunset)) {
    if (now < solar.sunrise - 30 * 60000 || now >= solar.sunset + 90 * 60000) return 'night';
    if (now >= solar.sunset - 90 * 60000) return 'evening';
    if (now < solar.sunrise + 4 * 3600000) return 'morning';
    return 'day';
  }
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'evening';
  return 'night';
}
