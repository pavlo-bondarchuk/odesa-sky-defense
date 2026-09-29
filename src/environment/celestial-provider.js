import SunCalcModule from 'https://cdn.jsdelivr.net/npm/suncalc@1.9.0/+esm';

const SunCalc =
  SunCalcModule?.default ||
  SunCalcModule;

const LATITUDE = 46.4825;
const LONGITUDE = 30.7233;

export function getCelestialState(date = new Date()) {
  if (
    !SunCalc ||
    typeof SunCalc.getPosition !== 'function' ||
    typeof SunCalc.getMoonPosition !== 'function' ||
    typeof SunCalc.getMoonIllumination !== 'function'
  ) {
    return {
      sun: {
        altitude: 0.35,
        azimuth: 0
      },
      moon: {
        altitude: -0.4,
        azimuth: Math.PI,
        distance: 384400,
        parallacticAngle: 0,
        fraction: 0.5,
        phase: 0.5,
        angle: 0
      }
    };
  }

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
