import * as THREE from 'three'

// default gravitational constants; these may be reassigned via helpers below
let G = 0.1;
let M = 10000;
let Mu = G * M;

// recalc Mu when G or M change
function updateMu() {
  Mu = G * M;
}

//Math function
export function position_Z_up(vector) {
  return new THREE.Vector3(vector.x, vector.z, vector.y);
}

export function velocity_Z_up(vector) {
  return new THREE.Vector3(vector.x, vector.z, vector.y);
}


//Orbit information
export function Angular_Momentum(Position, Velocity) {
  const pos = position_Z_up(Position).clone();
  const vel = velocity_Z_up(Velocity).clone();

  const h = new THREE.Vector3().crossVectors(pos, vel);
  return h; // Vector3
}


export function Absolute_TrueAnomaly(Position, Velocity) {
  const ecc_vector = Eccentricity_Vector(Position, Velocity);
  const ecc = ecc_vector.length();
  const pos = position_Z_up(Position);

  const dot = ecc_vector.dot(pos);

  const Absolute_TrueAnomaly = 180 / Math.PI * (Math.acos((dot / (ecc * pos.length()))));

  return Absolute_TrueAnomaly;
}

export function Eccentricity_Vector(Position, Velocity) {
  const pos = position_Z_up(Position).clone();
  const vel = velocity_Z_up(Velocity).clone();
  const h = Angular_Momentum(Position, Velocity);

  // v × h / mu
  const cross = vel.clone().cross(h).divideScalar(Mu);

  // e = (v × h)/mu - r/|r|
  const e = cross.sub(pos.clone().normalize());
  return e; // Vector3
}

export function SemiMajorAxis(position, velocity) {
  // a is semi-major-axis
  const r = position.length();
  const v = velocity.length();
  
  const a = 1 / ( (2 / r) - (v * v) / Mu );
  return a;
}

export function Orbit_Period(SMA) {
  return 2 * Math.PI * Math.sqrt(Math.pow(SMA, 3) / Mu);
}

// helper APIs for consumers
export function setGravitationalConstants({ g, mass }) {
  if (typeof g === 'number') G = g;
  if (typeof mass === 'number') M = mass;
  updateMu();
}

export function setGravitationalParameter(mu) {
  if (typeof mu !== 'number') return;
  Mu = mu;
}

export function getGravitationalParameter() {
  return Mu;
}

export function Inclination(position, velocity) {

  const h = new THREE.Vector3().crossVectors(position, velocity);

  const h_mag = h.length();

  const i_rad = Math.acos(h.y / h_mag);

  return i_rad * (180 / Math.PI);
}

export function TrueAnomaly(Position, Velocity) {
  const pos = position_Z_up(Position);
  const vel = velocity_Z_up(Velocity);
  const dot = pos.dot(vel);

  let TrueAnomaly;

  if (dot < 0) {
    TrueAnomaly = 360 - Absolute_TrueAnomaly(Position, Velocity);
  } else {
    TrueAnomaly = Absolute_TrueAnomaly(Position, Velocity);
  }

  return TrueAnomaly;
}


export class Orbit_Prediction {
  constructor(mu) {
    // allow per-instance gravitational parameter or fall back to global
    this.mu = typeof mu === 'number' ? mu : Mu;
  }

  Stump_S(z) {
    if (z > 0) {
      // Elliptic orbit
      let sqrtZ = Math.sqrt(z);
      return (sqrtZ - Math.sin(sqrtZ)) / Math.pow(sqrtZ, 3);
    } else if (z < 0) {
      // Hyperbolic orbit
      let sqrtNegZ = Math.sqrt(-z);
      return (Math.sinh(sqrtNegZ) - sqrtNegZ) / Math.pow(sqrtNegZ, 3);
    } else {
      // Parabolic orbit (z == 0)
      return 1 / 6;
    }
  }

  Stump_C(z) {
    if (z > 0) {
      // Elliptic orbit
      return (1 - Math.cos(Math.sqrt(z))) / z;
    } else if (z < 0) {
      // Hyperbolic orbit
      return (Math.cosh(Math.sqrt(-z)) - 1) / (-z);
    } else {
      // Parabolic orbit (z == 0)
      return 1 / 2;
    }
  }

  Universal_Anomaly(position, velocity, deltaTime) {
    let Error = 0.00000001;
    let Nmax = 1000;
    let ro = position.length();
    let vro = (position.dot(velocity)) / ro;
    let DeltaTime = deltaTime;
    
    let x = ((Math.sqrt(this.mu)) * Math.abs(this.alpha)) * DeltaTime;
    let n = 0;
    let ratio = 1;

    while (Math.abs(ratio) > Error && n <= Nmax) {
      n += 1;
      let z = this.alpha * x * x;
      let C = this.Stump_C(z);
      let S = this.Stump_S(z);
      
      let F = ((((ro * vro) / Math.sqrt(this.mu)) * (x * x * C)) + ((1 - (this.alpha * ro)) * (x * x * x * S) + ro * x)) - (Math.sqrt(this.mu) * DeltaTime);
      let dFdx = (((ro * vro) / Math.sqrt(this.mu)) * (x * (1 - (z * S)))) + ((1 - (this.alpha * ro)) * (x * x * C)) + ro;
      
      ratio = F / dFdx;
      x = x - ratio;
    }

    this.UniversalAnomaly = x;
  }

  F_and_G_from_Universal(anomaly, position_scalar, deltaTime) {
    // Note: 'position_scalar' is the magnitude 'ro'
    let ro = position_scalar;
    let x = anomaly;
    let z = this.alpha * (x ** 2);
    let f = 1 - ((x ** 2) / ro) * this.Stump_C(z);
    let g = deltaTime - ((x ** 3) / Math.sqrt(this.mu)) * this.Stump_S(z);

    this.f = f;
    this.g = g;
  }

  F_and_G_from_Universal_dot(anomaly, position1_scalar, position2_scalar) {
    // input: Universal Anomaly, ro, r.
    let ro = position1_scalar;
    let r = position2_scalar;
    let x = anomaly;
    let z = this.alpha * (x ** 2);

    let fdot = (Math.sqrt(this.mu) / (r * ro)) * (((this.alpha * (x ** 3)) * this.Stump_S(z)) - x);
    let gdot = 1 - (((x ** 2) / r) * this.Stump_C(z));

    this.fdot = fdot;
    this.gdot = gdot;
  }

  Orbit_Prediction(Position, Velocity, t) {
    let DeltaTime = t;
    let ro = Position.length();
    let vo = Velocity.length();
    let vro = (Position.dot(Velocity)) / ro;
    
    let alpha = (2 / ro) - ((vo ** 2) / Mu);
    this.alpha = alpha;

    this.Universal_Anomaly(Position, Velocity, DeltaTime);
    this.F_and_G_from_Universal(this.UniversalAnomaly, ro, DeltaTime);

    let vectorR2 = Position.clone().multiplyScalar(this.f).add(Velocity.clone().multiplyScalar(this.g));

    let r = vectorR2.length();

    this.F_and_G_from_Universal_dot(this.UniversalAnomaly, ro, r, DeltaTime);

    let vectorV2 = Position.clone().multiplyScalar(this.fdot).add(Velocity.clone().multiplyScalar(this.gdot));

    return { Future_Position: vectorR2, Future_Velocity: vectorV2 }
  }
}