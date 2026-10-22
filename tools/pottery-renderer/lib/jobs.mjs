// Every deliverable: output path, scene spec and a one-line description (alt text).
// Units are centimetres; the camera is auto-framed unless target/dist are given.
export const GROUPS = ['products', 'hero', 'sequence', 'collection', 'texture', 'categories', 'extras'];

const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));

function product(slug, objects, desc, o = {}) {
  return {
    group: 'products', file: `products/${slug}/1.png`, desc, seed: hashStr(slug),
    spec: {
      width: 1600, height: 1600, mode: 'opaque', objects,
      camera: { elev: 12, fov: 20, fill: 0.7, ...(o.camera || {}) },
      post: { grain: 1.0, ...(o.post || {}) }, ...(o.spec || {}),
    },
  };
}
function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 100000; }

const KULHADS = [
  { model: 'kulhad', x: -5.6, z: 3.4, rot: 20, seed: 31 },
  { model: 'kulhad', x: 3.2, z: 4.6, rot: 140, seed: 32, scale: 1.03 },
  { model: 'kulhad', x: -2.0, z: -4.6, rot: 75, seed: 33, scale: 0.97 },
  { model: 'kulhad', x: 6.4, z: -3.2, rot: 250, seed: 34 },
];
const DIYAS = [
  { model: 'diya', x: -9.6, z: 6.2, rot: 30, seed: 41, opts: { lit: false } },
  { model: 'diya', x: -0.4, z: 8.4, rot: -8, seed: 43, opts: { lit: false } },
  { model: 'diya', x: 9.4, z: 6.0, rot: -35, seed: 45, opts: { lit: false } },
  { model: 'diya', x: -6.6, z: -3.0, rot: 12, seed: 42, opts: { lit: true } },
  { model: 'diya', x: 4.8, z: -2.4, rot: -18, seed: 44, opts: { lit: true } },
  { model: 'diya', x: -0.6, z: -11.4, rot: -5, seed: 46, opts: { lit: false } },
];
const DIYA_SPEC = { exposure: 0.66, post: { bloom: { sigma: 0.006, strength: 0.18 } } };

export function productJobs() {
  return [
    product('classic-clay-matka', [{ model: 'classicMatka', rot: 0 }], 'Round terracotta matka with a ringed lid, round knob and a cream zigzag band between dotted rows'),
    product('black-clay-matka', [{ model: 'blackMatka', rot: 15 }], 'Burnished black clay matka with a ringed lid and finely etched line and zigzag bands'),
    product('plain-terracotta-matka', [{ model: 'plainMatka', rot: 0 }], 'Unpainted natural terracotta water matka with a rolled rim and visible wheel-throwing lines'),
    product('matka-with-tap', [{ model: 'tapMatka', rot: -38 }], 'Terracotta water-dispenser matka with a lid, cream painted band and a brass tap near the base'),
    product('clay-surahi', [{ model: 'surahi', rot: 0 }], 'Long-necked terracotta surahi water carafe with a round body decorated in cream dots'),
    product('clay-water-bottle', [{ model: 'waterBottle', rot: 0 }], 'Terracotta clay water bottle with a clay stopper cap and incised rings'),
    product('clay-handi-with-lid', [{ model: 'handi', rot: 0 }], 'Wide dark-fired clay cooking handi with a domed lid and small knob'),
    product('clay-kadai', [{ model: 'kadai', rot: 0 }], 'Wide shallow clay kadai with two loop handles', { camera: { elev: 20 } }),
    product('clay-curd-pot', [{ model: 'curdPot', rot: 0 }], 'Small wide-mouthed terracotta curd pot', { camera: { elev: 16 } }),
    product('painted-decorative-vase', [{ model: 'vase', rot: 0 }], 'Tall slender terracotta vase hand-painted with a cream leaf vine on a black band'),
    product('folk-art-round-pot', [{ model: 'folkPot', rot: 0 }], 'Round terracotta pot with multi-colour folk painting in black, cream and mustard'),
    product('cylinder-planter-with-saucer', [{ model: 'cylinderPlanter', rot: 0 }], 'Terracotta cylinder planter with a rim band, standing on a matching saucer', { camera: { elev: 15 } }),
    product('tapered-terracotta-planter', [{ model: 'taperedPlanter', rot: 0 }], 'Classic tapered terracotta flower pot with a thick rim', { camera: { elev: 15 } }),
    product('bowl-planter', [{ model: 'bowlPlanter', rot: 0 }], 'Wide shallow terracotta bowl planter on a low foot', { camera: { elev: 18 } }),
    product('kulhad-set', KULHADS, 'Set of four handmade terracotta kulhad cups', { camera: { elev: 16, fill: 0.62 } }),
    product('clay-gullak', [{ model: 'gullak', rot: 0 }], 'Round terracotta gullak money bank with a coin slot, top knob and cream painted bands'),
    product('diya-set', DIYAS, 'Set of six terracotta oil diyas, two lit with warm glowing flames', { camera: { elev: 26, fill: 0.62, fillW: 0.84 }, spec: DIYA_SPEC, post: DIYA_SPEC.post }),
    product('decorated-festive-kalash', [{ model: 'kalash', rot: 0 }], 'Festive kalash painted red with mustard-gold and white motifs, topped with a coconut and mango leaves'),
  ];
}

function heroJobs() {
  const base = { width: 1600, height: 2000, objects: [{ model: 'classicMatka', rot: 0 }], camera: { elev: 6, fov: 18, fill: 0.85, centerY: -0.02 } };
  return [
    { group: 'hero', file: 'hero/matka.png', alpha: true, desc: 'Terracotta matka with lid and cream zigzag band, transparent background (hero cutout)', spec: { ...base, mode: 'cutout' } },
    { group: 'hero', file: 'hero/matka-shadow.png', alpha: true, desc: 'Soft contact shadow layer that aligns under the hero matka cutout', spec: { ...base, mode: 'shadow' } },
  ];
}

function sequenceJobs() {
  const out = [];
  const N = 60;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const e = ease(t);
    out.push({
      group: 'sequence', file: `sequence/frame-${String(i).padStart(3, '0')}.png`, alpha: true,
      desc: `Scroll sequence frame ${i + 1}/${N}: camera pulls back from the painted band to the full matka`,
      spec: {
        width: 1600, height: 1000, mode: 'cutshadow', lightAzim: 0,
        objects: [{ model: 'classicMatka', rot: -100 * (1 - e) }],
        camera: { fov: 26, path: { t, target0: [0, 13.95, -14.95], dist0: 9.5, elev0: 4, elev1: 14, fill: 0.75 } },
      },
    });
  }
  return out;
}

function collectionJobs() {
  return [{
    group: 'collection', file: 'collection/group.png', desc: 'Collection of handmade terracotta pottery — matka, surahi, vase, handi, folk-art pot, kulhad and curd pot — in warm late-afternoon light',
    spec: {
      width: 2400, height: 1350, mode: 'opaque', rig: 'afternoon', exposure: 0.74,
      objects: [
        { model: 'classicMatka', x: 0, z: 8, rot: 12 },
        { model: 'surahi', x: -44, z: 30, rot: 0 },
        { model: 'vase', x: 25, z: 34, rot: 20 },
        { model: 'handi', x: 31, z: -2, rot: 30 },
        { model: 'folkPot', x: -25, z: 1, rot: -20 },
        { model: 'kulhad', x: -10, z: -19, rot: 40, seed: 71 },
        { model: 'curdPot', x: 12, z: -21, rot: 0 },
      ],
      camera: { elev: 14, fov: 24, fill: 0.66, fillW: 0.86, centerY: -0.03 },
      post: { grain: 1.0, edgeMargin: 0.05 },
    },
  }];
}

function textureJobs() {
  return [
    {
      group: 'texture', file: 'texture/clay-grain.png', desc: 'Macro close-up of unglazed terracotta showing wheel-throwing lines and fine grog grain',
      spec: {
        width: 2000, height: 1250, mode: 'opaque', objects: [{ model: 'plainMatka', rot: 30 }],
        rigOverride: { key: { dir: [-0.95, 0.42, 0.12], col: [1.0, 0.95, 0.88], E: 2.8, w: 0.18 } },
        camera: { target: [0, 26.0, -10.9], dist: 24, elev: 24, azim: 0, fov: 24 },
        post: { grain: 0.8, edge: false, dof: { focus: 24, strength: 0.09, max: 0.008 } },
      },
    },
    {
      group: 'texture', file: 'texture/pattern-band.png', desc: 'Close-up of the hand-painted cream zigzag band with dot rows on a terracotta matka',
      spec: {
        width: 2000, height: 1250, mode: 'opaque', objects: [{ model: 'classicMatka', rot: 8 }],
        camera: { target: [0, 13.9, -14.9], dist: 26, elev: 5, azim: 0, fov: 24 },
        post: { grain: 0.8, edge: false, dof: { focus: 26, strength: 0.08, max: 0.007 } },
      },
    },
    {
      group: 'texture', file: 'texture/rim-detail.png', desc: 'Detail of the matka lid with stacked rings, round knob and rolled rim',
      spec: {
        width: 2000, height: 1250, mode: 'opaque', objects: [{ model: 'classicMatka', rot: 0 }],
        camera: { target: [0, 26.2, -4.5], dist: 30, elev: 20, azim: -10, fov: 26 },
        post: { grain: 0.8, edge: false, dof: { focus: 30, strength: 0.1, max: 0.008 } },
      },
    },
  ];
}

function category(slug, objects, desc, o = {}) {
  return {
    group: 'categories', file: `categories/${slug}.png`, desc,
    spec: {
      width: 1200, height: 1500, mode: 'opaque', objects,
      camera: { elev: 16, fov: 22, fill: 0.68, fillW: 0.9, centerY: -0.04, ...(o.camera || {}) },
      post: { grain: 1.0, ...(o.post || {}) }, ...(o.spec || {}),
    },
  };
}
function categoryJobs() {
  return [
    category('clay-matkas', [
      { model: 'classicMatka', x: 2, z: -6, rot: 0 }, { model: 'blackMatka', x: 21, z: 20, rot: 30 }, { model: 'plainMatka', x: -19, z: 22, rot: 0 },
    ], 'Three clay matkas: painted terracotta, burnished black and plain natural clay'),
    category('earthen-water-pots', [
      { model: 'tapMatka', x: 3, z: 14, rot: -30 }, { model: 'surahi', x: -17, z: -3, rot: 0 }, { model: 'waterBottle', x: 15, z: -9, rot: 0 },
    ], 'Earthen water pots: a matka with brass tap, a surahi and a clay water bottle'),
    category('clay-cookware', [
      { model: 'handi', x: -5, z: 14, rot: 0 }, { model: 'kadai', x: 8, z: -12, rot: 15 }, { model: 'curdPot', x: -18, z: -13, rot: 0 },
    ], 'Clay cookware: a handi with lid, a kadai with loop handles and a curd pot', { camera: { elev: 22 } }),
    category('decorative-pots', [
      { model: 'vase', x: -9, z: 9, rot: 0 }, { model: 'folkPot', x: 10, z: -7, rot: 0 },
    ], 'Decorative pots: a painted vase and a folk-art round pot'),
    category('planters', [
      { model: 'taperedPlanter', x: -12, z: 12, rot: 0 }, { model: 'cylinderPlanter', x: 12, z: 10, rot: 0 }, { model: 'bowlPlanter', x: 0, z: -15, rot: 0 },
    ], 'Terracotta planters: a tapered pot, a cylinder planter with saucer and a bowl planter', { camera: { elev: 20 } }),
    category('handcrafted-pottery', [
      { model: 'gullak', x: -7, z: 6, rot: 0 }, { model: 'kulhad', x: 9, z: 9, rot: 30, seed: 81 }, { model: 'kulhad', x: 6, z: -5, rot: 200, seed: 82 },
    ], 'Handcrafted pottery: a painted gullak money bank and two kulhad cups'),
    category('festival-collection', [
      { model: 'kalash', x: 0, z: 10, rot: 0 },
      { model: 'diya', x: -11, z: -12, rot: 20, seed: 91, opts: { lit: true } },
      { model: 'diya', x: 1, z: -16, rot: -5, seed: 92, opts: { lit: false } },
      { model: 'diya', x: 12, z: -11, rot: -25, seed: 93, opts: { lit: true } },
    ], 'Festival collection: a decorated kalash with coconut and mango leaves, and lit clay diyas', { spec: DIYA_SPEC, post: DIYA_SPEC.post }),
    category('other-products', [
      { model: 'stonewareJar', x: -5, z: 6, rot: 0 }, { model: 'smallBowl', x: 9, z: -7, rot: 0 },
    ], 'Understated still life of a speckled stoneware jar and a small clay bowl', { camera: { fill: 0.5 } }),
  ];
}

function extraJobs() {
  const ex = (slug, n, objects, camera, desc, post = {}) => ({
    group: 'extras', file: `products/${slug}/${n}.png`, desc,
    spec: { width: 1600, height: 1600, mode: 'opaque', objects, camera, post: { grain: 1.0, ...post } },
  });
  const dof = (focus, strength = 0.05, max = 0.006) => ({ edge: false, dof: { focus, strength, max } });
  return [
    ex('classic-clay-matka', 2, [{ model: 'classicMatka', rot: 0 }], { elev: 32, azim: 35, fov: 20, fill: 0.7 }, 'Classic terracotta matka seen from a higher three-quarter angle, showing the ringed lid'),
    ex('classic-clay-matka', 3, [{ model: 'classicMatka', rot: 0 }], { target: [-3, 17.5, -13.5], dist: 46, elev: 10, azim: 0, fov: 20 }, 'Close detail of the cream hand-painted zigzag band and rolled rim', dof(46)),
    ex('matka-with-tap', 2, [{ model: 'tapMatka', rot: -38 }], { elev: 30, azim: 30, fov: 20, fill: 0.7 }, 'Water-dispenser matka from a higher three-quarter angle with the brass tap'),
    ex('matka-with-tap', 3, [{ model: 'tapMatka', rot: -38 }], { target: [-6.5, 7.6, -11.5], dist: 34, elev: 12, azim: -20, fov: 20 }, 'Close detail of the brass tap on the terracotta water matka', dof(34, 0.07)),
    ex('clay-surahi', 2, [{ model: 'surahi', rot: 0 }], { elev: 30, azim: 30, fov: 20, fill: 0.7 }, 'Terracotta surahi from a higher three-quarter angle'),
    ex('clay-surahi', 3, [{ model: 'surahi', rot: 0 }], { target: [0, 21.5, -6], dist: 42, elev: 10, azim: 0, fov: 20 }, 'Close detail of the surahi neck and painted dots', dof(42)),
    ex('clay-handi-with-lid', 2, [{ model: 'handi', rot: 0 }], { elev: 34, azim: 30, fov: 20, fill: 0.7 }, 'Clay handi with lid from a higher three-quarter angle'),
    ex('clay-handi-with-lid', 3, [{ model: 'handi', rot: 0 }], { target: [0, 16.2, -7], dist: 38, elev: 22, azim: 0, fov: 20 }, 'Close detail of the handi lid, knob and rim', dof(38)),
    ex('painted-decorative-vase', 2, [{ model: 'vase', rot: 0 }], { elev: 28, azim: 30, fov: 20, fill: 0.7 }, 'Painted decorative vase from a higher three-quarter angle'),
    ex('painted-decorative-vase', 3, [{ model: 'vase', rot: 0 }], { target: [0, 13.2, -7.3], dist: 30, elev: 6, azim: 0, fov: 20 }, 'Close detail of the hand-painted leaf vine on the vase', dof(30)),
    ex('cylinder-planter-with-saucer', 2, [{ model: 'cylinderPlanter', rot: 0 }], { elev: 34, azim: 30, fov: 20, fill: 0.7 }, 'Cylinder planter with saucer from a higher three-quarter angle'),
    ex('cylinder-planter-with-saucer', 3, [{ model: 'cylinderPlanter', rot: 0 }], { target: [0, 9.5, -9.5], dist: 38, elev: 22, azim: 0, fov: 20 }, 'Close detail of the planter rim band and saucer', dof(38)),
  ];
}

export function allJobs() {
  return [...productJobs(), ...heroJobs(), ...sequenceJobs(), ...collectionJobs(), ...textureJobs(), ...categoryJobs(), ...extraJobs()];
}
