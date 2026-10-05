import * as THREE from 'three';

// Builds a smooth, closed-loop road from a level's control points using a
// Catmull-Rom spline. Produces: the road ribbon mesh, edge lines, barriers,
// an ordered list of checkpoints (for lap validation + wrong-way detection),
// and the start transform.

export class Track {
  constructor(level) {
    this.level = level;
    this.group = new THREE.Group();
    this.checkpoints = [];   // [{ pos: Vector3, dir: Vector3, index }]
    this.startPosition = new THREE.Vector3();
    this.startHeading = 0;
    this.curve = null;
    this.roadWidth = level.roadWidth || 12;

    this._build();
  }

  _build() {
    const pts = this.level.points.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);

    const segments = Math.max(200, pts.length * 24);
    const samples = this.curve.getSpacedPoints(segments);

    this._buildRoad(samples);
    this._buildEdges(samples);
    this._buildCheckpoints(samples);
    this._setStart(samples);
  }

  _frameAt(samples, i) {
    const p = samples[i];
    const next = samples[(i + 1) % samples.length];
    const forward = new THREE.Vector3().subVectors(next, p).normalize();
    const left = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
    return { p, forward, left };
  }

  _buildRoad(samples) {
    const w = this.roadWidth;
    const positions = [];
    const uvs = [];
    const indices = [];
    const n = samples.length;

    for (let i = 0; i < n; i++) {
      const { p, left } = this._frameAt(samples, i);
      const l = new THREE.Vector3().copy(p).addScaledVector(left, w / 2);
      const r = new THREE.Vector3().copy(p).addScaledVector(left, -w / 2);
      positions.push(l.x, 0.02, l.z);
      positions.push(r.x, 0.02, r.z);
      const v = i / 8;
      uvs.push(0, v, 1, v);
    }
    for (let i = 0; i < n; i++) {
      const a = (i * 2) % (n * 2);
      const b = (i * 2 + 1) % (n * 2);
      const c = ((i + 1) * 2) % (n * 2);
      const d = ((i + 1) * 2 + 1) % (n * 2);
      indices.push(a, c, b);
      indices.push(b, c, d);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const tex = this._asphaltTexture();
    const mat = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.95, metalness: 0.0, color: 0x9aa0aa,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.group.add(mesh);

    // Center dashed line
    this._buildCenterLine(samples);
  }

  _asphaltTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2b2f38';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 2400; i++) {
      const g = 30 + Math.random() * 55;
      ctx.fillStyle = `rgb(${g},${g + 4},${g + 10})`;
      ctx.fillRect(Math.random() * 128, Math.random() * 128, 1.4, 1.4);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 1);
    tex.anisotropy = 8;
    return tex;
  }

  _buildCenterLine(samples) {
    const n = samples.length;
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf4e04d });
    for (let i = 0; i < n; i += 6) {
      const { p, forward } = this._frameAt(samples, i);
      const geo = new THREE.PlaneGeometry(0.5, 3.2);
      const dash = new THREE.Mesh(geo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.rotation.z = -Math.atan2(forward.z, forward.x) + Math.PI / 2;
      dash.position.set(p.x, 0.04, p.z);
      this.group.add(dash);
    }
  }

  _buildEdges(samples) {
    const w = this.roadWidth;
    const n = samples.length;
    const leftPts = [];
    const rightPts = [];
    const kerbGroup = new THREE.Group();
    const kerbGeo = new THREE.BoxGeometry(1.0, 0.3, 2.2);
    const kerbMatA = new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.6 });
    const kerbMatB = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.6 });

    for (let i = 0; i < n; i++) {
      const { p, left, forward } = this._frameAt(samples, i);
      const l = new THREE.Vector3().copy(p).addScaledVector(left, w / 2 + 0.4);
      const r = new THREE.Vector3().copy(p).addScaledVector(left, -w / 2 - 0.4);
      leftPts.push(l.clone().setY(0.3));
      rightPts.push(r.clone().setY(0.3));

      if (i % 3 === 0) {
        const mat = (i % 6 === 0) ? kerbMatA : kerbMatB;
        const yaw = -Math.atan2(forward.z, forward.x) + Math.PI / 2;
        [l, r].forEach((edge) => {
          const kerb = new THREE.Mesh(kerbGeo, mat);
          kerb.position.set(edge.x, 0.12, edge.z);
          kerb.rotation.y = yaw;
          kerb.castShadow = true;
          kerbGroup.add(kerb);
        });
      }
    }
    this.group.add(kerbGroup);

    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.8 });
    [leftPts, rightPts].forEach((pts) => {
      const g = new THREE.BufferGeometry().setFromPoints([...pts, pts[0]]);
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffffff }));
      this.group.add(line);
    });
    // store edges for off-track detection
    this._leftEdge = leftPts;
    this._rightEdge = rightPts;
  }

  _buildCheckpoints(samples) {
    const count = 24;
    const n = samples.length;
    for (let k = 0; k < count; k++) {
      const i = Math.floor((k / count) * n);
      const { p, forward } = this._frameAt(samples, i);
      this.checkpoints.push({
        pos: p.clone(),
        dir: forward.clone(),
        index: k,
      });
    }
  }

  _setStart(samples) {
    const { p, forward } = this._frameAt(samples, 0);
    this.startPosition.copy(p).setY(0.5);
    this.startHeading = Math.atan2(forward.x, forward.z);

    // Start/finish gate
    const w = this.roadWidth;
    const { left } = this._frameAt(samples, 0);
    const gateMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
    const postGeo = new THREE.BoxGeometry(0.6, 7, 0.6);
    [-1, 1].forEach((s) => {
      const post = new THREE.Mesh(postGeo, gateMat);
      const off = left.clone().multiplyScalar(s * (w / 2 + 0.6));
      post.position.set(p.x + off.x, 3.5, p.z + off.z);
      post.castShadow = true;
      this.group.add(post);
    });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 1.2, 0.6), gateMat);
    beam.position.set(p.x, 7, p.z);
    beam.rotation.y = Math.atan2(left.x, left.z);
    this.group.add(beam);

    // Checkered start line
    this._buildStartLine(p, left, w);
  }

  _buildStartLine(p, left, w) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 16;
    const ctx = c.getContext('2d');
    const sq = 8;
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#ffffff' : '#111111';
        ctx.fillRect(x * sq, y * sq, sq, sq);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const geo = new THREE.PlaneGeometry(w, 3);
    const line = new THREE.Mesh(geo, mat);
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = Math.atan2(left.x, left.z);
    line.position.set(p.x, 0.05, p.z);
    this.group.add(line);
  }

  // Nearest point on the curve; returns distance from centerline (for off-track).
  distanceFromRoad(position) {
    let min = Infinity;
    const n = this.checkpoints.length;
    for (let i = 0; i < n; i++) {
      const d = this.checkpoints[i].pos.distanceTo(position);
      if (d < min) min = d;
    }
    return min;
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
