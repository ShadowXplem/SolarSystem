import * as THREE from 'three';
import { Orbit_Prediction, Eccentricity_Vector, setGravitationalParameter, setGravitationalConstants, getGravitationalParameter } from './src/orbitCalculations.js';

const pos = new THREE.Vector3(200, 0, 0);
const vel = new THREE.Vector3(0, 0, -2.24);

// create a prediction object using the default mu
const pred = new Orbit_Prediction();

// you can override the gravitational parameter globally or per-instance:
// e.g. for the Sun (in appropriate units) you might do:
// setGravitationalParameter(1.32712440018e11);
// or setGravitationalConstants({g: 6.67430e-11, mass: 1.9885e30});
// const sunPred = new Orbit_Prediction(getGravitationalParameter());

console.log('Initial pos', pos.toArray());
console.log('Initial vel', vel.toArray());

const out = pred.Orbit_Prediction(pos, vel, 1);

console.log('Future pos', out.Future_Position.toArray());
console.log('Future vel', out.Future_Velocity.toArray());
console.log('Eccentricity vector length', Eccentricity_Vector(pos, vel).length());
