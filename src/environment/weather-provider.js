const ENDPOINT =
  'https://api.open-meteo.com/v1/forecast';

const LATITUDE = 46.4825;
const LONGITUDE = 30.7233;
const TIME_ZONE = 'Europe/Kyiv';

function conditionFromCode(code) {
  if ([0].includes(code)) return 'clear';
  if ([1, 2].includes(code)) return 'partly-cloudy';
  if ([3].includes(code)) return 'overcast';
  if ([45, 48].includes(code)) return 'fog';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return 'rain';
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'storm';

  return 'cloudy';
}

function buildUrl() {
  const params = new URLSearchParams({
    latitude: String(LATITUDE),
    longitude: String(LONGITUDE),
    timezone: TIME_ZONE,
    current:
      'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day',
    daily: 'sunrise,sunset',
    forecast_days: '1'
  });

  return `${ENDPOINT}?${params.toString()}`;
}

export async function fetchOdesaWeather() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(buildUrl(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Weather request failed: ${response.status}`);
    }

    const data = await response.json();
    const current = data.current || {};

    return {
      source: 'Open-Meteo',
      updatedAt: current.time || null,
      temperature: Number(current.temperature_2m ?? 18),
      apparentTemperature: Number(current.apparent_temperature ?? current.temperature_2m ?? 18),
      humidity: Number(current.relative_humidity_2m ?? 65),
      precipitation: Number(current.precipitation ?? 0),
      rain: Number(current.rain ?? 0),
      snowfall: Number(current.snowfall ?? 0),
      weatherCode: Number(current.weather_code ?? 0),
      condition: conditionFromCode(Number(current.weather_code ?? 0)),
      cloudCover: Number(current.cloud_cover ?? 20),
      windSpeed: Number(current.wind_speed_10m ?? 8),
      windDirection: Number(current.wind_direction_10m ?? 180),
      windGusts: Number(current.wind_gusts_10m ?? current.wind_speed_10m ?? 8),
      isDay: Boolean(current.is_day),
      sunrise: data.daily?.sunrise?.[0] || null,
      sunset: data.daily?.sunset?.[0] || null
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function fallbackWeather() {
  return {
    source: 'fallback',
    updatedAt: null,
    temperature: 18,
    apparentTemperature: 18,
    humidity: 65,
    precipitation: 0,
    rain: 0,
    snowfall: 0,
    weatherCode: 0,
    condition: 'clear',
    cloudCover: 18,
    windSpeed: 7,
    windDirection: 180,
    windGusts: 10,
    isDay: true,
    sunrise: null,
    sunset: null
  };
}
