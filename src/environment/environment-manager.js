import * as THREE from 'three';
import { getOdesaTime } from './time-provider.js';
import {
  fetchOdesaWeather,
  fallbackWeather
} from './weather-provider.js';
import { getCelestialState } from './celestial-provider.js';

function minutesFromIso(value) {
  if (!value) return null;

  const match = value.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;

  return Number(match[1]) * 60 + Number(match[2]);
}

function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function sunState(time, weather) {
  const now = time.hour * 60 + time.minute;
  const sunrise = minutesFromIso(weather.sunrise) ?? 6 * 60 + 15;
  const sunset = minutesFromIso(weather.sunset) ?? 18 * 60 + 40;
  const civilTwilight = 40;
  const nauticalTwilight = 82;
  const astronomicalTwilight = 118;

  const dayProgress = clamp01(
    (now - sunrise) / Math.max(1, sunset - sunrise)
  );

  let daylight = 0;

  if (now >= sunrise && now <= sunset) {
    daylight = 1;
  } else if (
    now < sunrise &&
    now >= sunrise - astronomicalTwilight
  ) {
    const progress =
      (now - (sunrise - astronomicalTwilight)) /
      astronomicalTwilight;

    daylight = Math.pow(clamp01(progress), 1.35) * 0.72;
  } else if (
    now > sunset &&
    now <= sunset + astronomicalTwilight
  ) {
    const progress =
      (now - sunset) / astronomicalTwilight;

    daylight =
      (1 - Math.pow(clamp01(progress), 1.18)) * 0.72;
  }

  const elevation =
    Math.sin(dayProgress * Math.PI) *
    (Math.PI * 0.38);

  const azimuth =
    THREE.MathUtils.lerp(
      -Math.PI * 0.72,
      Math.PI * 0.72,
      dayProgress
    );

  const dawn =
    now >= sunrise - astronomicalTwilight &&
    now < sunrise + 70;

  const dusk =
    now > sunset - 90 &&
    now <= sunset + astronomicalTwilight;

  const minutesAfterSunset = Math.max(0, now - sunset);
  const nightFactor =
    now <= sunset
      ? 0
      : THREE.MathUtils.smootherstep(
          minutesAfterSunset,
          civilTwilight * 0.45,
          astronomicalTwilight
        );

  return {
    sunrise,
    sunset,
    dayProgress,
    daylight,
    elevation,
    azimuth,
    dawn,
    dusk,
    night: nightFactor > 0.88,
    nightFactor,
    civilTwilight,
    nauticalTwilight,
    astronomicalTwilight
  };
}

function palette(time, weather, sun) {
  const overcast =
    THREE.MathUtils.clamp(
      weather.cloudCover / 100,
      0,
      1
    );

  let top = new THREE.Color(0x4c80b2);
  let horizon = new THREE.Color(0xd8b083);
  let low = new THREE.Color(0xf0c693);

  if (sun.night) {
    top = new THREE.Color(0x081426);
    horizon = new THREE.Color(0x15243c);
    low = new THREE.Color(0x24324a);
  } else if (sun.dawn || sun.dusk) {
    const blueHour =
      THREE.MathUtils.clamp(
        sun.nightFactor ?? 0,
        0,
        1
      );

    top = new THREE.Color(0x4d7099).lerp(
      new THREE.Color(0x13253d),
      blueHour
    );

    const coolBlueHour =
      THREE.MathUtils.smootherstep(
        blueHour,
        0.08,
        0.72
      );

    horizon = new THREE.Color(0xe7835b).lerp(
      new THREE.Color(0x263d58),
      coolBlueHour
    );

    low = new THREE.Color(0xeebc7b).lerp(
      new THREE.Color(0x31465f),
      coolBlueHour
    );
  } else {
    top = new THREE.Color(0x5c91c3);
    horizon = new THREE.Color(0xa9c9da);
    low = new THREE.Color(0xd9d2bd);
  }

  if (
    weather.condition === 'overcast' ||
    weather.condition === 'rain' ||
    weather.condition === 'storm'
  ) {
    const grayTop = new THREE.Color(0x68737d);
    const grayHorizon = new THREE.Color(0x879099);
    const grayLow = new THREE.Color(0xa6a29b);

    top.lerp(grayTop, 0.55 + overcast * 0.35);
    horizon.lerp(grayHorizon, 0.6 + overcast * 0.3);
    low.lerp(grayLow, 0.6 + overcast * 0.3);
  }

  if (weather.condition === 'fog') {
    const fog = new THREE.Color(0xaeb8b9);
    top.lerp(fog, 0.55);
    horizon.lerp(fog, 0.8);
    low.lerp(fog, 0.85);
  }

  if (time.season === 'autumn') {
    low.offsetHSL(0.01, 0.04, -0.025);
  }

  if (time.season === 'winter') {
    top.offsetHSL(0, -0.08, 0.04);
    horizon.offsetHSL(0, -0.12, 0.06);
  }

  return { top, horizon, low };
}

export function createEnvironmentManager({
  scene,
  renderer,
  sky,
  lighting,
  clouds,
  precipitation,
  statusElement,
  sunRays,
  anomalies
}) {
  let weather = fallbackWeather();
  let time = getOdesaTime();
  let sun = sunState(time, weather);
  let colors = palette(time, weather, sun);
  let celestial = getCelestialState();
  let elapsed = 0;

  async function refreshWeather() {
    try {
      weather = await fetchOdesaWeather();
    } catch (error) {
      console.warn('Weather sync failed', error);
      weather = {
        ...weather,
        source: 'fallback'
      };
    }

    updateStatus();
  }

  function updateStatus() {
    if (!statusElement) return;

    const source =
      weather.source === 'fallback'
        ? 'LOCAL'
        : 'LIVE';

    statusElement.textContent =
      `${source} · ${time.label} · ${time.season.toUpperCase()} · ` +
      `${weather.condition.toUpperCase()} · ${Math.round(weather.temperature)}°C`;
  }

  function update(delta) {
    elapsed += delta;

    if (elapsed >= 60) {
      elapsed = 0;
      time = getOdesaTime();
      sun = sunState(time, weather);
      colors = palette(time, weather, sun);
      celestial = getCelestialState();
      updateStatus();
    }

    const cloudFactor =
      THREE.MathUtils.clamp(
        weather.cloudCover / 100,
        0,
        1
      );

    const precipitationStrength =
      THREE.MathUtils.clamp(
        weather.precipitation / 3,
        0,
        1
      );

    sky.update({
      delta,
      topColor: colors.top,
      horizonColor: colors.horizon,
      lowColor: colors.low,
      sun,
      celestial
    });

    lighting.update({
      delta,
      sun,
      weather,
      cloudFactor,
      celestial
    });

    clouds.update(delta, {
      cloudFactor,
      windSpeed: weather.windSpeed,
      windDirection: weather.windDirection,
      windGusts: weather.windGusts,
      humidity: weather.humidity,
      night: sun.night
    });

    precipitation.update(delta, {
      condition: weather.condition,
      strength: precipitationStrength,
      snowfall: weather.snowfall,
      rain: weather.rain
    });

    const anomalyState = anomalies
      ? anomalies.update(delta, {
          condition: weather.condition,
          windGusts: weather.windGusts,
          precipitation: weather.precipitation
        })
      : { gustFactor: 0, wetness: 0 };

    if (sunRays) {
      sunRays.update(delta, {
        sunPosition: sky.sunDisc.position,
        sunlight: sun.daylight,
        cloudFactor,
        dusk: sun.dusk,
        dawn: sun.dawn
      });
    }

    const targetFog =
      weather.condition === 'fog'
        ? 0x9fa9aa
        : weather.condition === 'rain' || weather.condition === 'overcast'
          ? 0x7e8589
          : sun.nightFactor > 0.72
            ? 0x223144
            : sun.dusk
              ? 0x4e5867
              : 0x958c82;

    scene.fog.color.lerp(
      new THREE.Color(targetFog),
      1 - Math.pow(0.025, delta)
    );

    const near =
      weather.condition === 'fog'
        ? 55
        : weather.condition === 'rain'
          ? 100
          : 135;

    const far =
      weather.condition === 'fog'
        ? 260
        : weather.condition === 'rain'
          ? 430
          : weather.condition === 'overcast'
            ? 600
            : 760;

    scene.fog.near = THREE.MathUtils.lerp(
      scene.fog.near,
      near,
      1 - Math.pow(0.05, delta)
    );

    scene.fog.far = THREE.MathUtils.lerp(
      scene.fog.far,
      far,
      1 - Math.pow(0.05, delta)
    );

    const exposure =
      sun.nightFactor > 0.88
        ? 0.9
        : sun.dusk
          ? THREE.MathUtils.lerp(
              1.08,
              0.96,
              sun.nightFactor
            )
          : sun.dawn
            ? 1.08
            : 1.0 - cloudFactor * 0.16;

    renderer.toneMappingExposure =
      THREE.MathUtils.lerp(
        renderer.toneMappingExposure,
        exposure,
        1 - Math.pow(0.02, delta)
      );
  }

  refreshWeather();
  setInterval(refreshWeather, 10 * 60 * 1000);
  updateStatus();

  return {
    update,
    getState() {
      return {
        time,
        weather,
        sun,
        celestial
      };
    }
  };
}
