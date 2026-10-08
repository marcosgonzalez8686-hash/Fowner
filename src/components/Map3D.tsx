import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STANDING, type BuildingKind } from '../game/land';

// Mapa 3D del terreno del club. Se dibuja con three.js y solo se vuelve a pintar
// cuando el usuario mueve la cámara o cambia algo (ahorra batería).

export type TileState = 'owned' | 'buyable' | 'locked';

export interface MapTile {
  x: number;
  y: number;
  state: TileState;
  stadium?: boolean;
  building?: BuildingKind;
  level?: number;
}

export interface MapModel {
  size: number;
  tiles: MapTile[];
  capacity: number;
  /** modelo de estadio (clasico, bol, atletismo, municipal, futurista) */
  stadiumModel?: string;
  standColor: string;
  accentColor: string;
  selected: { x: number; y: number } | null;
}

const TILE = 1;
const COLORS = {
  grass: 0x5fae4e,
  grass2: 0x56a346,
  buyable: 0xd9c78f,
  locked: 0x3b6b3f,
  soil: 0x6b4f35,
  select: 0xffd23f,
};

const mat = (color: THREE.ColorRepresentation, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...extra });

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Textura del césped con las líneas del campo */
function pitchTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 176;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#3f9a3f' : '#4aa84a';
    g.fillRect(i * 32, 0, 32, 176);
  }
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 3;
  g.strokeRect(6, 6, 244, 164);
  g.beginPath();
  g.moveTo(128, 6);
  g.lineTo(128, 170);
  g.stroke();
  g.beginPath();
  g.arc(128, 88, 22, 0, Math.PI * 2);
  g.stroke();
  g.strokeRect(6, 52, 34, 72);
  g.strokeRect(216, 52, 34, 72);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- estadio ----------

/** Contorno de las gradas en anillo: un rectángulo redondeado (r) o un "superóvalo" (r < 0) */
function contorno(hw: number, hd: number, r: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  if (r < 0) {
    // superelipse de grado 4: entre un óvalo y un rectángulo
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      pts.push(new THREE.Vector2(hw * Math.sign(c) * Math.abs(c) ** 0.5, hd * Math.sign(s) * Math.abs(s) ** 0.5));
    }
    return pts;
  }
  const rr = Math.min(r, hw, hd);
  const esquinas: [number, number, number][] = [[hw - rr, hd - rr, 0], [-(hw - rr), hd - rr, 0.5], [-(hw - rr), -(hd - rr), 1], [hw - rr, -(hd - rr), 1.5]];
  for (const [cx, cy, a0] of esquinas) {
    for (let i = 0; i <= 10; i++) {
      const a = (a0 + (i / 10) * 0.5) * Math.PI;
      pts.push(new THREE.Vector2(cx + rr * Math.cos(a), cy + rr * Math.sin(a)));
    }
  }
  return pts;
}

/** Anillo entre dos contornos, de altura h y apoyado en y0 */
function anillo(fuera: THREE.Vector2[], dentro: THREE.Vector2[], h: number, m: THREE.Material, y0 = 0) {
  const shape = new THREE.Shape(fuera);
  shape.holes.push(new THREE.Path(dentro));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.y = y0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Profundidad de la grada según los asientos: crece rápido al principio y luego despacio */
const fondoGrada = (sentados: number) => (sentados <= 0 ? 0 : 0.12 + 0.1 * Math.log2(1 + sentados / 1500));

/** Público de pie en los lados sin grada */
function publicoDePie(lados: number, standColor: string, accent: string) {
  const huecos = [
    { x: 0, z: -0.56, w: 1.4, horiz: true },
    { x: 0, z: 0.56, w: 1.4, horiz: true },
    { x: -0.79, z: 0, w: 0.9, horiz: false },
    { x: 0.79, z: 0, w: 0.9, horiz: false },
  ].slice(lados);
  const porHueco = Math.ceil(70 / 4);
  const total = porHueco * huecos.length;
  const gente = new THREE.InstancedMesh(new THREE.BoxGeometry(0.028, 0.06, 0.028), new THREE.MeshStandardMaterial({ roughness: 0.9 }), total);
  const colores = [new THREE.Color(standColor), new THREE.Color(accent), new THREE.Color(0x2b2b2b), new THREE.Color(0x3d5a80), new THREE.Color(0xe9e2d0)];
  const m4 = new THREE.Matrix4();
  let i = 0;
  huecos.forEach((hu, k) => {
    for (let j = 0; j < porHueco; j++) {
      const t = (j + 0.5) / porHueco - 0.5;
      const fila = (j * 7 + k * 3) % 3;
      const off = (fila - 1) * 0.035;
      const x = hu.horiz ? hu.x + t * hu.w : hu.x + Math.sign(hu.x) * (fila * 0.035);
      const z = hu.horiz ? hu.z + Math.sign(hu.z) * (fila * 0.035) : hu.z + t * hu.w;
      m4.makeTranslation(x + (hu.horiz ? off * 0.3 : 0), 0.03, z + (hu.horiz ? 0 : off * 0.3));
      gente.setMatrixAt(i, m4);
      gente.setColorAt(i, colores[(j * 3 + k) % colores.length]);
      i++;
    }
  });
  gente.castShadow = true;
  return gente;
}

// borde de la valla: las gradas empiezan aquí
const IW = 0.76;
const ID = 0.53;

/** Estadio de tribunas separadas (clásico) o con una tribuna principal (municipal) */
function gradasPorLados(g: THREE.Group, modelo: string, capacity: number, sentados: number, standColor: string, accent: string) {
  const nLados = sentados <= 0 ? 0 : sentados < 1000 ? 1 : sentados < 3500 ? 2 : 4;
  const municipal = modelo === 'municipal';
  const fondo = fondoGrada(sentados);
  const grada = mat(standColor);
  const trasera = mat(0x3a3a3a);
  const franja = mat(accent);
  let alturaMax = 0;
  // lado: dirección hacia fuera (dx, dz) y largo de la tribuna
  const lados: { dx: number; dz: number; largo: number; ini: number }[] = [
    { dx: 0, dz: -1, largo: 2 * IW, ini: ID },
    { dx: 0, dz: 1, largo: 2 * IW, ini: ID },
    { dx: -1, dz: 0, largo: 2 * ID, ini: IW },
    { dx: 1, dz: 0, largo: 2 * ID, ini: IW },
  ];
  lados.slice(0, nLados).forEach((l, k) => {
    // en el municipal solo la principal es grande; en el clásico todas iguales
    const prof = municipal && k > 0 ? fondo * 0.45 : fondo;
    const pasos = THREE.MathUtils.clamp(Math.round(prof / 0.035), 2, 18);
    const pd = prof / pasos;
    const ph = pd * 0.62;
    const horiz = l.dz !== 0;
    for (let i = 0; i < pasos; i++) {
      const grosor = prof - i * pd;
      const centro = l.ini + i * pd + grosor / 2;
      const alto = (i + 1) * ph;
      g.add(horiz ? box(l.largo, alto, grosor, grada, 0, 0, l.dz * centro) : box(grosor, alto, l.largo, grada, l.dx * centro, 0, 0));
    }
    const H = pasos * ph;
    alturaMax = Math.max(alturaMax, H);
    const fuera = l.ini + prof + 0.008;
    g.add(horiz ? box(l.largo, H + 0.03, 0.016, trasera, 0, 0, l.dz * fuera) : box(0.016, H + 0.03, l.largo, trasera, l.dx * fuera, 0, 0));
    // segundo anillo: una franja con el color del club a media altura
    if (sentados >= 20_000 && prof === fondo) {
      const p = l.ini + prof * 0.5;
      g.add(horiz ? box(l.largo, 0.014, 0.01, franja, 0, H * 0.5, l.dz * (p - 0.006)) : box(0.01, 0.014, l.largo, franja, l.dx * (p - 0.006), H * 0.5, 0));
    }
    // cubierta inclinada: la principal desde 4.000 (siempre en el municipal), todas desde 15.000
    const cubierta = municipal ? k === 0 : k === 0 ? capacity >= 4000 : capacity >= 15_000;
    if (cubierta) {
      const vuelo = prof * 0.9;
      const techo = horiz ? box(l.largo + 0.04, 0.02, vuelo, franja) : box(vuelo, 0.02, l.largo + 0.04, franja);
      const c = l.ini + prof - vuelo / 2 + 0.01;
      techo.position.set(l.dx * c, H + 0.1, l.dz * c);
      // a dos aguas: baja un poco hacia el campo
      if (horiz) techo.rotation.x = -l.dz * 0.12;
      else techo.rotation.z = l.dx * 0.12;
      g.add(techo);
      for (const s of [-1, 1]) {
        const px = horiz ? s * (l.largo / 2) : l.dx * (l.ini + prof);
        const pz = horiz ? l.dz * (l.ini + prof) : s * (l.largo / 2);
        g.add(box(0.025, H + 0.1, 0.025, trasera, px, 0, pz));
      }
    }
  });
  if (nLados < 4) g.add(publicoDePie(nLados, standColor, accent));
  return { alturaMax, abiertas: true };
}

/** Estadio en anillo: bol, futurista o con pista de atletismo */
function gradasEnAnillo(g: THREE.Group, modelo: string, capacity: number, sentados: number, standColor: string, accent: string) {
  if (sentados <= 0) {
    g.add(publicoDePie(0, standColor, accent));
    if (modelo === 'atletismo') pista(g);
    return { alturaMax: 0, abiertas: true };
  }
  const fondo = fondoGrada(sentados);
  // contorno interior de la grada para cada modelo
  const forma =
    modelo === 'futurista'
      ? (o: number) => contorno(0.87 + o, 0.62 + o, -1)
      : modelo === 'atletismo'
        ? (o: number) => contorno(1.04 + o, 0.73 + o, 0.73 + o)
        : (o: number) => contorno(IW + 0.02 + o, ID + 0.02 + o, 0.22 + o);
  const rake = modelo === 'atletismo' ? 0.45 : modelo === 'futurista' ? 0.7 : 0.62;
  const pasos = THREE.MathUtils.clamp(Math.round(fondo / 0.035), 2, 18);
  const pd = fondo / pasos;
  const ph = pd * rake;
  const grada = mat(standColor);
  const exterior = forma(fondo);
  for (let i = 0; i < pasos; i++) g.add(anillo(exterior, forma(i * pd), (i + 1) * ph, grada));
  const H = pasos * ph;
  if (sentados >= 20_000) g.add(anillo(forma(fondo * 0.5 + 0.01), forma(fondo * 0.5), 0.014, mat(accent), H * 0.5));
  // muro exterior
  g.add(anillo(forma(fondo + 0.016), exterior, H + 0.03, mat(0x3a3a3a)));
  if (modelo === 'atletismo') {
    pista(g);
    // una marquesina sobre la tribuna principal
    if (capacity >= 4000) {
      const largo = 1.3;
      const vuelo = fondo * 0.85;
      g.add(box(largo, 0.02, vuelo, mat(accent), 0, H + 0.1, -(0.73 + fondo - vuelo / 2 + 0.01)));
      for (const s of [-1, 1]) g.add(box(0.025, H + 0.1, 0.025, mat(0x3a3a3a), s * largo / 2, 0, -(0.73 + fondo)));
    }
    return { alturaMax: H, abiertas: true };
  }
  if (modelo === 'bol') {
    if (capacity < 3000) return { alturaMax: H, abiertas: true };
    // anillo de cubierta con focos en el borde
    const techo = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6, transparent: true, opacity: 0.92 });
    g.add(anillo(forma(fondo + 0.03), forma(fondo * 0.3), 0.022, techo, H + 0.09));
    g.add(anillo(forma(fondo * 0.3 + 0.015), forma(fondo * 0.3), 0.012, mat(0xfff2a0, { emissive: 0xfff2a0, emissiveIntensity: 0.7 }), H + 0.078));
    return { alturaMax: H + 0.1, abiertas: false };
  }
  // futurista: fachada iluminada con los colores del club y cubierta completa
  g.add(anillo(forma(fondo + 0.05), forma(fondo + 0.02), H + 0.14, mat(accent, { emissive: accent, emissiveIntensity: 0.55, transparent: true, opacity: 0.88 })));
  g.add(anillo(forma(fondo + 0.05), forma(fondo * 0.18), 0.026, mat(0xf7f7f7, { metalness: 0.3, roughness: 0.35 }), H + 0.14));
  g.add(anillo(forma(fondo * 0.18 + 0.015), forma(fondo * 0.18), 0.012, mat(standColor, { emissive: standColor, emissiveIntensity: 0.8 }), H + 0.128));
  return { alturaMax: H + 0.15, abiertas: false };
}

/** Pista de atletismo alrededor del campo */
function pista(g: THREE.Group) {
  const roja = new THREE.Mesh(
    (() => {
      const shape = new THREE.Shape(contorno(1.04, 0.73, 0.73));
      shape.holes.push(new THREE.Path(contorno(0.91, 0.6, 0.6)));
      const geo = new THREE.ShapeGeometry(shape);
      geo.rotateX(-Math.PI / 2);
      return geo;
    })(),
    mat(0xb8513a),
  );
  roja.position.y = 0.006;
  roja.receiveShadow = true;
  g.add(roja);
}

function stadium(capacity: number, modelo: string, lado: number, standColor: string, accent: string) {
  const exterior = new THREE.Group();
  const g = new THREE.Group();
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.94), new THREE.MeshStandardMaterial({ map: pitchTexture(), roughness: 1 }));
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.y = 0.01;
  pitch.receiveShadow = true;
  g.add(pitch);

  // valla alrededor del campo
  const valla = mat(0xf2f2f2);
  g.add(box(1.46, 0.035, 0.012, valla, 0, 0, -0.5), box(1.46, 0.035, 0.012, valla, 0, 0, 0.5));
  g.add(box(0.012, 0.035, 1.0, valla, -0.73, 0, 0), box(0.012, 0.035, 1.0, valla, 0.73, 0, 0));

  // aforo de pie fijo (alrededor de la valla) y el resto sentado en gradas
  const sentados = Math.max(0, capacity - STANDING);
  const enAnillo = modelo === 'bol' || modelo === 'futurista' || modelo === 'atletismo';
  const { alturaMax, abiertas } = enAnillo
    ? gradasEnAnillo(g, modelo, capacity, sentados, standColor, accent)
    : gradasPorLados(g, modelo, capacity, sentados, standColor, accent);

  // medidas de lo construido para colocar focos y marcadores y para encajarlo en sus parcelas
  g.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(g);
  const ex = Math.max(-bb.min.x, bb.max.x, 0.75);
  const ez = Math.max(-bb.min.z, bb.max.z, 0.52);
  // marcadores en los fondos para los estadios grandes
  if (sentados >= 25_000) {
    for (const s of [-1, 1]) {
      g.add(box(0.03, 0.12, 0.34, mat(0x1b1b1b), s * (ex - 0.02), alturaMax + 0.02, 0));
      g.add(box(0.006, 0.09, 0.3, mat(0x2a6df4, { emissive: 0x2a6df4, emissiveIntensity: 0.6 }), s * (ex - 0.04), alturaMax + 0.035, 0));
    }
  }
  // torres de focos en las esquinas cuando no hay cubierta que los lleve
  if (capacity >= 2000 && abiertas) {
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const px = x * (ex + 0.05);
      const pz = z * (ez + 0.05);
      g.add(box(0.03, alturaMax + 0.45, 0.03, mat(0x777777), px, 0, pz));
      g.add(box(0.12, 0.06, 0.04, mat(0xfff7c2, { emissive: 0xfff2a0, emissiveIntensity: 0.6 }), px, alturaMax + 0.45, pz));
    }
  }
  // se encaja en sus parcelas: los estadios grandes ocupan más terreno y se ven más grandes
  const disponible = (lado * TILE) / 2 - 0.04;
  const ancho = Math.max(ex, ez * 1.0) + (capacity >= 2000 && abiertas ? 0.08 : 0);
  const fondoZ = ez + (capacity >= 2000 && abiertas ? 0.08 : 0);
  const escala = Math.min(disponible / ancho, disponible / fondoZ, lado <= 2 ? 1 : 1.35);
  g.scale.setScalar(escala);
  exterior.add(g);
  // explanada alrededor del estadio
  if (sentados > 0) {
    const plaza = box(lado * TILE * 0.97, 0.006, lado * TILE * 0.97, mat(0xb9b2a2));
    plaza.castShadow = false;
    exterior.add(plaza);
  }
  return exterior;
}

function building(kind: BuildingKind, level: number, accent: string) {
  const g = new THREE.Group();
  const n = Math.max(1, level);
  const alto = 0.1 + n * 0.07;
  switch (kind) {
    case 'entrenamiento': {
      const campo = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.42), new THREE.MeshStandardMaterial({ map: pitchTexture() }));
      campo.rotation.x = -Math.PI / 2;
      campo.position.set(0, 0.012, 0.15);
      campo.receiveShadow = true;
      g.add(campo);
      g.add(box(0.6, alto * 0.7, 0.18, mat(0xf2f2f2), 0, 0, -0.27));
      g.add(box(0.62, 0.025, 0.2, mat(accent), 0, alto * 0.7, -0.27));
      break;
    }
    case 'cantera':
      g.add(box(0.5, alto, 0.4, mat(0xe8dcc4)));
      g.add(box(0.54, 0.04, 0.44, mat(accent), 0, alto));
      for (let i = 0; i < n; i++) g.add(box(0.08, 0.05, 0.01, mat(0x8fd3ff, { emissive: 0x335577 }), -0.15 + i * 0.075, alto * 0.45, 0.205));
      break;
    case 'parking': {
      const suelo = box(0.8, 0.012, 0.8, mat(0x55585c));
      suelo.castShadow = false;
      g.add(suelo);
      const coches = [0xc8102e, 0x1d4ed8, 0xf5f5f5, 0xf5c542, 0x111111, 0x0f8a3c];
      for (let i = 0; i < n * 2; i++) {
        g.add(box(0.12, 0.07, 0.2, mat(coches[i % coches.length]), -0.27 + (i % 4) * 0.18, 0.012, i < 4 ? -0.18 : 0.18));
      }
      break;
    }
    case 'tienda':
      g.add(box(0.5, alto, 0.4, mat(0xfafafa)));
      g.add(box(0.56, 0.05, 0.14, mat(accent), 0, alto * 0.75, 0.24));
      g.add(box(0.2, 0.12, 0.01, mat(accent, { emissive: accent, emissiveIntensity: 0.3 }), 0, alto * 0.35, 0.205));
      break;
    case 'bar':
      g.add(box(0.45, alto, 0.38, mat(0x8a5a3b)));
      g.add(box(0.5, 0.05, 0.42, mat(0xf26a21), 0, alto));
      for (const x of [-0.25, 0.25]) g.add(box(0.12, 0.05, 0.12, mat(0xffffff), x, 0, 0.32));
      break;
    case 'medico':
      g.add(box(0.5, alto, 0.45, mat(0xffffff)));
      g.add(box(0.2, 0.012, 0.06, mat(0xd62828), 0, alto, 0));
      g.add(box(0.06, 0.012, 0.2, mat(0xd62828), 0, alto, 0));
      break;
    case 'ojeadores':
      g.add(box(0.3, alto + 0.15, 0.3, mat(0x6fb6e8, { metalness: 0.4, roughness: 0.3 })));
      g.add(box(0.5, 0.12, 0.45, mat(0xdddddd)));
      break;
    case 'museo': {
      g.add(box(0.6, 0.05, 0.45, mat(0xd8d2c4)));
      for (let i = 0; i < 4; i++) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, alto, 10), mat(0xf4efe4));
        col.position.set(-0.21 + i * 0.14, 0.05 + alto / 2, 0.17);
        col.castShadow = true;
        g.add(col);
      }
      g.add(box(0.5, alto, 0.25, mat(0xece6d8), 0, 0.05, -0.05));
      const techo = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.14, 4), mat(accent));
      techo.rotation.y = Math.PI / 4;
      techo.scale.set(1, 1, 0.7);
      techo.position.y = 0.05 + alto + 0.07;
      techo.castShadow = true;
      g.add(techo);
      break;
    }
  }
  return g;
}

function trees(x: number, y: number) {
  const g = new THREE.Group();
  const n = ((x * 7 + y * 13) % 3) + 1;
  for (let i = 0; i < n; i++) {
    const ox = (((x * 31 + y * 17 + i * 11) % 7) - 3) * 0.09;
    const oz = (((x * 13 + y * 29 + i * 5) % 7) - 3) * 0.09;
    const tronco = box(0.04, 0.08, 0.04, mat(0x6b4a2f), ox, 0, oz);
    const copa = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 7), mat(0x2e7d32));
    copa.position.set(ox, 0.08 + 0.14, oz);
    copa.castShadow = true;
    g.add(tronco, copa);
  }
  return g;
}

const world = (x: number, y: number, size: number) => new THREE.Vector3((x - (size - 1) / 2) * TILE, 0, (y - (size - 1) / 2) * TILE);

function buildWorld(m: MapModel) {
  const root = new THREE.Group();
  root.add(box(m.size * TILE + 0.3, 0.35, m.size * TILE + 0.3, mat(COLORS.soil), 0, -0.45, 0));

  const pickables: THREE.Object3D[] = [];
  for (const t of m.tiles) {
    const color = t.state === 'owned' ? ((t.x + t.y) % 2 ? COLORS.grass : COLORS.grass2) : t.state === 'buyable' ? COLORS.buyable : COLORS.locked;
    const tile = box(TILE * 0.97, 0.1, TILE * 0.97, mat(color), 0, -0.1, 0);
    tile.position.add(world(t.x, t.y, m.size));
    tile.userData = { x: t.x, y: t.y };
    root.add(tile);
    pickables.push(tile);

    if (t.state !== 'owned') {
      const arboles = trees(t.x, t.y);
      arboles.position.copy(world(t.x, t.y, m.size));
      arboles.traverse((o) => (o.userData = { x: t.x, y: t.y }));
      root.add(arboles);
      pickables.push(arboles);
    }
    if (t.building) {
      const b = building(t.building, t.level ?? 1, m.accentColor);
      b.position.copy(world(t.x, t.y, m.size));
      b.traverse((o) => (o.userData = { x: t.x, y: t.y }));
      root.add(b);
      pickables.push(b);
    }
  }

  // el estadio ocupa un bloque de 2x2, 3x3 o 4x4 parcelas
  const centro = m.tiles.filter((t) => t.stadium);
  if (centro.length) {
    const cx = centro.reduce((a, t) => a + t.x, 0) / centro.length;
    const cy = centro.reduce((a, t) => a + t.y, 0) / centro.length;
    const lado = Math.round(Math.sqrt(centro.length));
    const st = stadium(m.capacity, m.stadiumModel ?? 'clasico', lado, m.standColor, m.accentColor);
    st.position.copy(world(cx, cy, m.size));
    const esquina = { x: Math.min(...centro.map((t) => t.x)), y: Math.min(...centro.map((t) => t.y)) };
    st.traverse((o) => (o.userData = esquina));
    root.add(st);
    pickables.push(st);
  }

  // marco de la parcela seleccionada
  if (m.selected) {
    const sel = m.tiles.find((t) => t.x === m.selected!.x && t.y === m.selected!.y);
    const esEstadio = sel?.stadium;
    const lado = esEstadio ? TILE * Math.round(Math.sqrt(m.tiles.filter((t) => t.stadium).length)) : TILE;
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(lado * 0.98, 0.02, lado * 0.98));
    const marco = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: COLORS.select }));
    const pos = esEstadio
      ? (() => {
          const c = m.tiles.filter((t) => t.stadium);
          return world(c.reduce((a, t) => a + t.x, 0) / c.length, c.reduce((a, t) => a + t.y, 0) / c.length, m.size);
        })()
      : world(m.selected.x, m.selected.y, m.size);
    marco.position.set(pos.x, 0.02, pos.z);
    root.add(marco);
    const brillo = box(lado * 0.97, 0.004, lado * 0.97, new THREE.MeshBasicMaterial({ color: COLORS.select, transparent: true, opacity: 0.28 }), pos.x, 0.005, pos.z);
    brillo.castShadow = false;
    root.add(brillo);
  }
  return { root, pickables };
}

function disposeTree(o: THREE.Object3D) {
  o.traverse((x) => {
    const mesh = x as THREE.Mesh;
    mesh.geometry?.dispose();
    const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(m)) m.forEach((y) => y.dispose());
    else if (m) {
      (m as THREE.MeshStandardMaterial).map?.dispose();
      m.dispose();
    }
  });
}

export default function Map3D({ model, onSelect }: { model: MapModel; onSelect: (x: number, y: number) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engine = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    world: THREE.Group | null;
    pickables: THREE.Object3D[];
    render: () => void;
  } | null>(null);
  const [error, setError] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // montaje: renderer, cámara, luces y controles
  useEffect(() => {
    const host = hostRef.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(7.5, 8.5, 9.5);

    scene.add(new THREE.HemisphereLight(0xdfefff, 0x4a3b2a, 1.1));
    const sol = new THREE.DirectionalLight(0xfff3dd, 2.2);
    sol.position.set(5, 9, 3);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    const sc = sol.shadow.camera as THREE.OrthographicCamera;
    sc.left = -6; sc.right = 6; sc.top = 6; sc.bottom = -6;
    sol.shadow.bias = -0.0008;
    scene.add(sol);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enablePan = false;
    controls.minDistance = 5;
    controls.maxDistance = 18;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = 1.2;

    const render = () => renderer.render(scene, camera);
    controls.addEventListener('change', render);
    controls.update();

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // toque corto = seleccionar parcela; arrastrar = girar la cámara
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(engine.current?.pickables ?? [], true)[0];
      const d = hit?.object.userData as { x?: number; y?: number } | undefined;
      if (d && d.x !== undefined && d.y !== undefined) onSelectRef.current(d.x, d.y);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    engine.current = { renderer, scene, camera, controls, world: null, pickables: [], render };
    resize();

    return () => {
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      controls.dispose();
      if (engine.current?.world) disposeTree(engine.current.world);
      renderer.dispose();
      renderer.domElement.remove();
      engine.current = null;
    };
  }, []);

  // contenido: se rehace cuando cambia el modelo
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    if (e.world) {
      e.scene.remove(e.world);
      disposeTree(e.world);
    }
    const { root, pickables } = buildWorld(model);
    e.world = root;
    e.pickables = pickables;
    e.scene.add(root);
    e.render();
  }, [model]);

  if (error) {
    return <div className="map3d map3d-error">Tu navegador no puede mostrar el mapa 3D. Usa la lista de parcelas de abajo.</div>;
  }
  return <div ref={hostRef} className="map3d" aria-label="Mapa 3D del terreno del club" />;
}
