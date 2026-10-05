import * as THREE from 'three';

// Builds the world around a track: sky gradient, ground plane, fog, lighting
// (sun + ambient), and themed scenery (trees, rocks, or neon buildings).

export class Environment {
  constructor(scene, theme) {
    this.scene = scene;
    this.theme = theme;
    this.group = new THREE.Group();
    this._build();
  }

  _build() {
    const t = this.theme;

    // Sky dome with vertical gradient
    this.scene.background = this._skyTexture(t.sky, t.horizon);
    this.scene.fog = new THREE.FogExp2(t.fog, t.fogDensity);

    // Ground
    const groundMat = new THREE.MeshStandardMaterial({
      color: t.ground, roughness: 1.0, metalness: 0.0,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.group.add(ground);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, t.ambient ?? 0.5);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(t.sky, t.ground, 0.5);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(t.sunColor ?? 0xffffff, 1.3);
    sun.position.set(...(t.sunPos ?? [100, 120, 60]));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const d = 260;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 600;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
    this.sun = sun;

    if (t.neon) this._buildCity();
    else this._buildNature();

    this.scene.add(this.group);
  }

  _skyTexture(top, bottom) {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#' + new THREE.Color(top).getHexString());
    grad.addColorStop(1, '#' + new THREE.Color(bottom).getHexString());
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _buildNature() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 1 });
    const leafMats = [0x2e7d32, 0x388e3c, 0x43a047, 0x1b5e20].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })
    );
    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 4, 6);
    const leafGeo = new THREE.ConeGeometry(3, 7, 7);
    const rockGeo = new THREE.DodecahedronGeometry(1.6, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a7a7a, roughness: 1 });

    for (let i = 0; i < 220; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 150 + Math.random() * 500;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.random() < 0.75) {
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 2; trunk.castShadow = true;
        const leaves = new THREE.Mesh(leafGeo, leafMats[i % leafMats.length]);
        leaves.position.y = 6.5; leaves.castShadow = true;
        tree.add(trunk, leaves);
        const s = 0.7 + Math.random() * 1.3;
        tree.scale.setScalar(s);
        tree.position.set(x, 0, z);
        this.group.add(tree);
      } else {
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set(x, 0.6, z);
        rock.scale.setScalar(0.6 + Math.random() * 2);
        rock.castShadow = true;
        this.group.add(rock);
      }
    }
  }

  _buildCity() {
    const neonColors = [0x22d3ee, 0xff5a1f, 0xa855f7, 0xec4899, 0x34d399];
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 160; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 170 + Math.random() * 450;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const h = 20 + Math.random() * 110;
      const w = 10 + Math.random() * 20;
      const emissive = neonColors[i % neonColors.length];
      const mat = new THREE.MeshStandardMaterial({
        color: 0x0b1020,
        emissive,
        emissiveIntensity: 0.35 + Math.random() * 0.5,
        roughness: 0.4, metalness: 0.6,
      });
      const b = new THREE.Mesh(boxGeo, mat);
      b.scale.set(w, h, w);
      b.position.set(x, h / 2, z);
      b.castShadow = true;
      this.group.add(b);
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
  }
}
