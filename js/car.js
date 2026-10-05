import * as THREE from 'three';

// Car = a 3D mesh built from primitives (body, cabin, wheels, lights, spoiler)
// + a physics model. The physics use a simplified bicycle model with:
//  - engine force vs. speed, braking, rolling + aero drag
//  - steering that scales down with speed
//  - lateral grip with slip so the car can oversteer/drift at the limit
//  - weight-transfer-style body roll/pitch for feel
// Units: metres, seconds. Speed converted to km/h for the HUD.

const MAX_STEER = 0.55;          // radians at the wheels
const ENGINE_FORCE = 9200;
const BRAKE_FORCE = 16000;
const MASS = 1150;
const DRAG = 0.42;               // aero drag coefficient-ish
const ROLL_RESIST = 7.2;
const WHEEL_BASE = 2.6;
const GRIP = 90;                 // lateral grip strength
const MAX_SPEED = 78;            // ~280 km/h cap

export class Car {
  constructor(color = 0xff3b2f) {
    this.group = new THREE.Group();
    this.color = color;

    // Physics state
    this.position = new THREE.Vector3();
    this.heading = 0;            // yaw, radians
    this.velocity = new THREE.Vector3(); // world-space velocity
    this.speed = 0;              // signed scalar along heading
    this.steer = 0;
    this.angularVel = 0;

    this.wheels = [];
    this._buildMesh();
  }

  _buildMesh() {
    const g = this.group;

    // Body — layered boxes with bevelled feel
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.color, roughness: 0.35, metalness: 0.5,
    });
    const lowerMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1f, roughness: 0.6, metalness: 0.3,
    });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 4.4), lowerMat);
    chassis.position.y = 0.55;
    chassis.castShadow = true;
    g.add(chassis);

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.6, 4.0), bodyMat);
    body.position.y = 0.95;
    body.castShadow = true;
    g.add(body);

    // Hood taper + cabin
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x101018, roughness: 0.15, metalness: 0.2,
    });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 1.9), cabinMat);
    cabin.position.set(0, 1.42, -0.1);
    cabin.castShadow = true;
    g.add(cabin);

    // Windshield (angled)
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x88bbff, roughness: 0.05, metalness: 0.1,
      transparent: true, opacity: 0.55,
    });
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.1), glassMat);
    windshield.position.set(0, 1.42, 0.85);
    windshield.rotation.x = -0.5;
    g.add(windshield);

    // Spoiler
    const spoilerMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.5 });
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 0.5), spoilerMat);
    wing.position.set(0, 1.35, -2.0);
    g.add(wing);
    [-0.8, 0.8].forEach((x) => {
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.12), spoilerMat);
      stand.position.set(x, 1.15, -2.0);
      g.add(stand);
    });

    // Headlights
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 1.4,
    });
    [-0.65, 0.65].forEach((x) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), headMat);
      hl.position.set(x, 0.95, 2.02);
      g.add(hl);
    });
    // Tail lights
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 1.0,
    });
    [-0.7, 0.7].forEach((x) => {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), tailMat);
      tl.position.set(x, 0.98, -2.02);
      g.add(tl);
    });

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.42, 18);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.85 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.8 });
    const offsets = [
      [-1.0, 0.5, 1.4],  [1.0, 0.5, 1.4],
      [-1.0, 0.5, -1.4], [1.0, 0.5, -1.4],
    ];
    offsets.forEach((o, i) => {
      const wheel = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, wheelMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.44, 8), rimMat);
      rim.rotation.z = Math.PI / 2;
      wheel.add(tire, rim);
      wheel.position.set(...o);
      wheel.userData.isFront = i < 2;
      wheel.userData.spin = 0;
      g.add(wheel);
      this.wheels.push(wheel);
    });

    g.traverse((o) => { if (o.isMesh) o.receiveShadow = false; });
  }

  reset(position, heading) {
    this.position.copy(position);
    this.heading = heading;
    this.velocity.set(0, 0, 0);
    this.speed = 0;
    this.steer = 0;
    this.angularVel = 0;
    this._syncMesh(0);
  }

  // controls: { throttle: -1..1, brake: 0..1, steer: -1..1 }
  update(dt, controls) {
    dt = Math.min(dt, 0.05); // clamp for stability

    // --- steering (less sensitive at speed) ---
    const speedFactor = 1 - Math.min(Math.abs(this.speed) / MAX_SPEED, 1) * 0.6;
    const targetSteer = controls.steer * MAX_STEER * speedFactor;
    this.steer += (targetSteer - this.steer) * Math.min(1, dt * 8);

    // --- longitudinal forces ---
    let force = 0;
    if (controls.throttle > 0) force += ENGINE_FORCE * controls.throttle;
    else if (controls.throttle < 0) force += ENGINE_FORCE * 0.5 * controls.throttle; // reverse weaker
    if (controls.brake > 0) {
      // brake opposes current motion
      const dir = Math.sign(this.speed) || 1;
      force -= BRAKE_FORCE * controls.brake * dir;
    }

    // drag + rolling resistance
    const drag = -DRAG * this.speed * Math.abs(this.speed);
    const roll = -ROLL_RESIST * this.speed;
    const accel = (force + drag + roll) / MASS;
    this.speed += accel * dt;
    this.speed = THREE.MathUtils.clamp(this.speed, -MAX_SPEED * 0.4, MAX_SPEED);
    if (Math.abs(this.speed) < 0.08 && controls.throttle === 0) this.speed = 0;

    // --- yaw from bicycle model with grip-limited slip ---
    if (Math.abs(this.speed) > 0.3) {
      const turnRadiusYaw = (this.speed / WHEEL_BASE) * Math.tan(this.steer);
      // lateral acceleration demanded
      const latAccel = Math.abs(turnRadiusYaw * this.speed);
      const gripLimit = GRIP; // max lateral accel before sliding
      const slide = latAccel > gripLimit ? gripLimit / latAccel : 1;
      const targetYawRate = turnRadiusYaw * (0.7 + 0.3 * slide);
      this.angularVel += (targetYawRate - this.angularVel) * Math.min(1, dt * 6);
    } else {
      this.angularVel *= 0.85;
    }
    this.heading += this.angularVel * dt;

    // --- integrate position ---
    const forward = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    this.velocity.copy(forward).multiplyScalar(this.speed);
    this.position.addScaledVector(this.velocity, dt);
    this.position.y = 0.0;

    this._syncMesh(dt);
  }

  _syncMesh(dt) {
    this.group.position.set(this.position.x, this.position.y, this.position.z);
    this.group.rotation.y = this.heading;

    // body roll + pitch for feel
    const roll = THREE.MathUtils.clamp(-this.angularVel * 0.25, -0.12, 0.12);
    const pitch = THREE.MathUtils.clamp(-this.speed * 0.0015, -0.05, 0.05);
    this.group.rotation.z = roll;
    this.group.rotation.x = pitch;

    // wheels: steer front + spin
    const spin = (this.speed / 0.5) * dt;
    this.wheels.forEach((w) => {
      w.userData.spin += spin;
      w.rotation.set(0, 0, 0);
      if (w.userData.isFront) w.rotation.y = this.steer;
      w.rotateX(w.userData.spin);
    });
  }

  getSpeedKmh() {
    return Math.abs(this.speed) * 3.6 * 1.4; // scaled for arcade feel
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
  }
}
