const TIME_ZONE = 'Europe/Kyiv';

function parts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
}

export function getOdesaTime(date = new Date()) {
  const p = parts(date);
  const month = Number(p.month);

  return {
    timeZone: TIME_ZONE,
    year: Number(p.year),
    month,
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
    label: `${p.hour}:${p.minute}`,
    season:
      month === 12 || month <= 2
        ? 'winter'
        : month <= 5
          ? 'spring'
          : month <= 8
            ? 'summer'
            : 'autumn'
  };
}
