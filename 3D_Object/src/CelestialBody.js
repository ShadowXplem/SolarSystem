import * as THREE from 'three';
import * as OrbitCalcs from './orbitCalculations.js';


export class CelestialBody {

  constructor(config) {
    this.position = config.initialPosition;
    this.velocity = config.initialVelocity;
    this.mass = config.mass || 0;
    this.predictor = config.predictor;

    // 1. Create the visual mesh
    const geometry = new THREE.SphereGeometry(config.radius, 32, 32);
    this.mesh = new THREE.Mesh(geometry, config.material);
    this.mesh.position.copy(this.position);
    
    // 2. Create the (empty) orbit line
    const orbitGeometry = new THREE.BufferGeometry();
    const orbitMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    this.orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
    
    // 3. Automatically calculate the orbit line on creation
    this.calculateOrbit();
  }

  
  calculateOrbit() {
    const initialPosition = this.position;
    const initialVelocity = this.velocity;
    const dt = 1;

    let T = OrbitCalcs.Orbit_Period(OrbitCalcs.SemiMajorAxis(initialPosition, initialVelocity));
    if (OrbitCalcs.Eccentricity_Vector(initialPosition, initialVelocity).length() >= 1) {
      T = 10000;
    }

    const pos = initialPosition.clone();
    const vel = initialVelocity.clone();
    const points = [];
    let currentTime = 0;

    points.push(pos.clone());

    while (currentTime + dt <= T) {
      const { Future_Position, Future_Velocity } = this.predictor.Orbit_Prediction(pos, vel, dt);
      pos.copy(Future_Position);
      vel.copy(Future_Velocity);
      points.push(pos.clone());
      currentTime += dt;
    }

    const dt_final = T - currentTime;
    if (dt_final > 0) {
      const { Future_Position, Future_Velocity } = this.predictor.Orbit_Prediction(pos, vel, dt_final);
      pos.copy(Future_Position);
      vel.copy(Future_Velocity);
      points.push(pos.clone());
    }
    
    // 1. Dispose of the OLD geometry to free up memory
    this.orbitLine.geometry.dispose(); 
    
    // 2. Create a NEW geometry and assign it
    this.orbitLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
  }

  update(timeStep) {
    // 1. Update the "Physics State"
    const { Future_Position, Future_Velocity } = this.predictor.Orbit_Prediction(
      this.position,
      this.velocity,
      timeStep
    );

    this.position.copy(Future_Position);
    this.velocity.copy(Future_Velocity);

    // 2. Sync the "Render State"
    this.mesh.position.copy(this.position);

    //this.calculateOrbit();
  }

  addToScene(scene) {
    scene.add(this.mesh);
    scene.add(this.orbitLine);
  }
}