import * as SunCalc from 'https://cdn.jsdelivr.net/npm/suncalc@1.9.0/+esm';

const LATITUDE = 46.4825;
const LONGITUDE = 30.7233;

export function getCelestialState(date = new Date()) {
  const sun = SunCalc.getPosition(
    date,
    LATITUDE,
    LONGITUDE
  );

  const moon = SunCalc.getMoonPosition(
    date,
    LATITUDE,
    LONGITUDE
  );

  const illumination = SunCalc.getMoonIllumination(date);

  return {
    sun: {
      altitude: sun.altitude,
      azimuth: sun.azimuth
    },
    moon: {
      altitude: moon.altitude,
      azimuth: moon.azimuth,
      distance: moon.distance,
      parallacticAngle: moon.parallacticAngle,
      fraction: illumination.fraction,
      phase: illumination.phase,
      angle: illumination.angle
    }
  };
}
