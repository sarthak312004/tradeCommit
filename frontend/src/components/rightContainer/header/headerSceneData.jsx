// Calm, minimal header scenes. Every scene is a 1600x160 SVG drawn with preserveAspectRatio "xMidYMax slice", so it
// always fills the full header width and keeps its ground line anchored to the bottom edge, at any screen size.
// Each has a light and a dark palette, picked from the app theme.

export const W = 1600
export const H = 160
// the drawing continues this far past each side of the 1600-wide design, so a wide header (sidebar collapsed, big
// screens) is filled by more of the same landscape instead of by zooming the picture in
export const EXTEND = 3000

// small seeded random generator: the same scene is drawn the same way every time
const rng = (seed) => {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// fixed scatter of stars over the whole extended sky
const STARS = (() => {
  const rand = rng(99)
  return Array.from({ length: 70 }, () => [Math.round(-EXTEND + rand() * (W + EXTEND * 2)), Math.round(72 + rand() * 38)])
})()

// soft rolling line (sum of two sines), closed down to the bottom edge
const rolling = (base, amp, freq, phase = 0) => {
  const pts = []
  for (let x = -EXTEND; x <= W + EXTEND; x += 20) {
    const y = base + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.3 + phase * 1.7) * amp * 0.35
    pts.push(`${x},${y.toFixed(1)}`)
  }
  return `M${-EXTEND},${H} L${pts.join(' L')} L${W + EXTEND},${H} Z`
}

// jagged but gentle mountain ridge
const ridge = (base, amp, seed, step = 110) => {
  const rand = rng(seed)
  const pts = []
  const from = -Math.ceil(EXTEND / step) * step
  for (let x = from; x <= W + EXTEND; x += step) {
    pts.push(`${x},${(base - rand() * amp).toFixed(1)}`)
  }
  return `M${from},${H} L${pts.join(' L')} L${W + EXTEND},${H} Z`
}

// a row of slim pines along a ground line
const pines = (base, size, seed, gap) => {
  const rand = rng(seed)
  let d = ''
  for (let x = -EXTEND; x < W + EXTEND; x += gap * (0.6 + rand() * 0.9)) {
    const h = size * (0.6 + rand() * 0.7)
    const w = h * 0.28
    d += `M${x.toFixed(0)},${base - h} L${(x + w).toFixed(0)},${base} L${(x - w).toFixed(0)},${base} Z `
  }
  return d
}

const sky = (id, from, to) => (
  <>
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={from} />
        <stop offset="1" stopColor={to} />
      </linearGradient>
    </defs>
    <rect x={-EXTEND} y="60" width={W + EXTEND * 2} height="100" fill={`url(#${id})`} />
  </>
)

export const SCENES = [
  {
    id: 'dunes',
    name: 'Dunes',
    render: (p, id) => (
      <>
        {sky(id, p.skyA, p.skyB)}
        <circle cx="1180" cy="92" r="24" fill={p.sun} opacity="0.9" />
        <path d={rolling(112, 14, 0.004, 0.5)} fill={p.l1} />
        <path d={rolling(128, 12, 0.006, 2.4)} fill={p.l2} />
        <path d={rolling(144, 9, 0.008, 4.1)} fill={p.l3} />
      </>
    ),
    light: { skyA: '#fbefe0', skyB: '#f6dcc0', sun: '#f3b98f', l1: '#ecc79f', l2: '#e0b185', l3: '#d19d70' },
    dark: { skyA: '#2a2230', skyB: '#4a3438', sun: '#d89873', l1: '#5b4040', l2: '#493334', l3: '#372729' }
  },
  {
    id: 'mist',
    name: 'Misty peaks',
    render: (p, id) => (
      <>
        {sky(id, p.skyA, p.skyB)}
        <circle cx="1000" cy="86" r="20" fill={p.sun} opacity="0.75" />
        <path d={ridge(112, 38, 7, 130)} fill={p.l1} />
        <path d={ridge(128, 32, 21, 100)} fill={p.l2} />
        <path d={ridge(144, 26, 33, 85)} fill={p.l3} />
      </>
    ),
    light: { skyA: '#eef3f7', skyB: '#dbe6ee', sun: '#fff7e6', l1: '#c3d3e0', l2: '#a6bccd', l3: '#8aa3b8' },
    dark: { skyA: '#141c26', skyB: '#1f2c3b', sun: '#8fa6bd', l1: '#263648', l2: '#1e2c3c', l3: '#162230' }
  },
  {
    id: 'tide',
    name: 'Quiet tide',
    render: (p, id) => (
      <>
        {sky(id, p.skyA, p.skyB)}
        <path d={rolling(96, 6, 0.007, 1)} fill={p.l1} />
        <path d={rolling(113, 7, 0.0055, 3)} fill={p.l2} />
        <path d={rolling(130, 8, 0.0045, 5)} fill={p.l3} />
        <path d={rolling(146, 6, 0.0065, 0.2)} fill={p.l4} />
      </>
    ),
    light: { skyA: '#f1f8f6', skyB: '#dff0ec', l1: '#cae6e0', l2: '#b0d8d1', l3: '#93c8c0', l4: '#78b5ac' },
    dark: { skyA: '#10201f', skyB: '#17302e', l1: '#1c3a38', l2: '#194240', l3: '#14504c', l4: '#0f3f3c' }
  },
  {
    id: 'moon',
    name: 'Moonlit hills',
    render: (p, id) => (
      <>
        {sky(id, p.skyA, p.skyB)}
        <circle cx="1280" cy="88" r="18" fill={p.sun} />
        <circle cx="1280" cy="88" r="32" fill={p.sun} opacity="0.12" />
        {STARS.map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r="1.3" fill={p.sun} opacity="0.7" />
        ))}
        <path d={rolling(118, 16, 0.004, 2)} fill={p.l1} />
        <path d={rolling(138, 12, 0.006, 0.4)} fill={p.l2} />
      </>
    ),
    light: { skyA: '#ece8f6', skyB: '#d9d3ee', sun: '#fffaf0', l1: '#b9b0dc', l2: '#9d92c8' },
    dark: { skyA: '#0f1020', skyB: '#1d1c3a', sun: '#e9e6f7', l1: '#262450', l2: '#1a1938' }
  },
  {
    id: 'pines',
    name: 'Pine mist',
    render: (p, id) => (
      <>
        {sky(id, p.skyA, p.skyB)}
        <path d={ridge(112, 26, 3, 120)} fill={p.l1} />
        <path d={pines(126, 34, 5, 38)} fill={p.l2} />
        <path d={rolling(128, 5, 0.01, 1)} fill={p.fog} opacity="0.55" />
        <path d={pines(152, 48, 11, 46)} fill={p.l3} />
        <rect x={-EXTEND} y="148" width={W + EXTEND * 2} height="12" fill={p.l3} />
      </>
    ),
    light: { skyA: '#f2f5ee', skyB: '#e1e9d9', l1: '#c9d6bf', l2: '#a9bd9f', fog: '#f2f5ee', l3: '#86a07f' },
    dark: { skyA: '#101a14', skyB: '#18281e', l1: '#1f3326', l2: '#1a2c21', fog: '#2c4636', l3: '#12221a' }
  },
  {
    id: 'dawn',
    name: 'First light',
    render: (p, id) => (
      <>
        {sky(id, p.skyA, p.skyB)}
        <circle cx="1240" cy="122" r="40" fill={p.sun} opacity="0.85" />
        <circle cx="1240" cy="122" r="64" fill={p.sun} opacity="0.14" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={1000 + i * 30} y={112 + i * 9} width={480 - i * 60} height="1.5" rx="0.75" fill={p.line} opacity={0.5 - i * 0.12} />
        ))}
        <rect x={-EXTEND} y="118" width={W + EXTEND * 2} height="42" fill={p.ground} />
        <path d={rolling(138, 5, 0.005, 1.3)} fill={p.l1} opacity="0.7" />
      </>
    ),
    light: { skyA: '#fdf1ee', skyB: '#fbdfd2', sun: '#f6b79b', ground: '#f0cfc2', line: '#fff6f0', l1: '#e6bcae' },
    dark: { skyA: '#221a28', skyB: '#4a2f3c', sun: '#e59a82', ground: '#2b1d28', line: '#f2c3b2', l1: '#3a2634' }
  }
]

export const HEADER_SCENES = SCENES.map(({ id, name }) => ({ id, name }))

