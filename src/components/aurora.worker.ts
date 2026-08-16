import { Renderer, Program, Mesh, Color, Triangle } from 'ogl';

// Aurora splash render loop, executed inside a dedicated Web Worker against an
// OffscreenCanvas. Because this runs off the main thread, heavy boot work
// (playlist parsing, catalog preparation, TMDB lookups) cannot stall the
// animation — the splash stays smooth no matter how busy the UI thread gets.

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v){
  const vec4 C = vec4(
      0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
      0.5 - vec3(
          dot(x0, x0),
          dot(x12.xy, x12.xy),
          dot(x12.zw, x12.zw)
      ),
      0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop {
  vec3 color;
  float position;
};

#define COLOR_RAMP(colors, factor, finalColor) {              \
  int index = 0;                                            \
  for (int i = 0; i < 2; i++) {                               \
     ColorStop currentColor = colors[i];                    \
     bool isInBetween = currentColor.position <= factor;    \
     index = int(mix(float(index), float(i), float(isInBetween))); \
  }                                                         \
  ColorStop currentColor = colors[index];                   \
  ColorStop nextColor = colors[index + 1];                  \
  float range = nextColor.position - currentColor.position; \
  float lerpFactor = (factor - currentColor.position) / range; \
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);

  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);

  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;

  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);

  vec3 auroraColor = intensity * rampColor;

  fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
}
`;

// Rasterize into a small buffer and let the compositor upscale — the aurora
// is a soft gradient, so this is visually identical yet keeps per-frame GPU
// cost trivial even on integrated GPUs.
const MAX_RENDER_DIM = 480;

interface AuroraWorkerMessage {
  type: 'init' | 'resize' | 'props';
  canvas?: OffscreenCanvas;
  width?: number;
  height?: number;
  amplitude?: number;
  blend?: number;
  time?: number;
  speed?: number;
  colorStops?: string[];
}

interface WorkerScope {
  onmessage: ((e: MessageEvent<AuroraWorkerMessage>) => void) | null;
  requestAnimationFrame?: (cb: (t: number) => void) => number;
  cancelAnimationFrame?: (id: number) => void;
  setTimeout: (cb: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
}

const scope = self as unknown as WorkerScope;

let renderer: Renderer | null = null;
let program: Program | null = null;
let mesh: Mesh | null = null;

let amplitude = 1.0;
let blend = 0.5;
let speed = 1.0;
let timeOverride: number | undefined;
let colorStopsValue: number[][] = [];

// Chromium exposes requestAnimationFrame in dedicated workers; keep a timer
// fallback for engines that do not.
const scheduleFrame = (cb: (t: number) => void): number =>
  scope.requestAnimationFrame
    ? scope.requestAnimationFrame(cb)
    : scope.setTimeout(() => cb(performance.now()), 1000 / 60);

function applyStops(hexes: string[]) {
  colorStopsValue = hexes.map(hex => {
    const c = new Color(hex);
    return [c.r, c.g, c.b];
  });
  if (program) program.uniforms.uColorStops.value = colorStopsValue;
}

function resize(cssW: number, cssH: number) {
  if (!renderer || !program) return;
  const scale = Math.min(1, MAX_RENDER_DIM / Math.max(cssW, cssH));
  const bufW = Math.max(1, Math.round(cssW * scale));
  const bufH = Math.max(1, Math.round(cssH * scale));
  renderer.setSize(bufW, bufH);
  program.uniforms.uResolution.value = [bufW, bufH];
}

const update = (t: number) => {
  scheduleFrame(update);
  if (!renderer || !program || !mesh) return;
  const uniforms = program.uniforms;
  uniforms.uTime.value = (timeOverride ?? t * 0.01) * speed * 0.1;
  uniforms.uAmplitude.value = amplitude;
  uniforms.uBlend.value = blend;
  renderer.render({ scene: mesh });
};

scope.onmessage = (e: MessageEvent<AuroraWorkerMessage>) => {
  const msg = e.data;

  if (msg.type === 'init' && msg.canvas) {
    renderer = new Renderer({
      // ogl only calls getContext on the provided canvas; the type is
      // HTMLCanvasElement but an OffscreenCanvas works identically here.
      canvas: msg.canvas as unknown as HTMLCanvasElement,
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      powerPreference: 'low-power',
      dpr: 1
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const geometry = new Triangle(gl);
    if (geometry.attributes.uv) {
      delete geometry.attributes.uv;
    }

    amplitude = msg.amplitude ?? 1.0;
    blend = msg.blend ?? 0.5;
    speed = msg.speed ?? 1.0;
    timeOverride = msg.time;
    applyStops(msg.colorStops ?? ['#5227FF', '#7cff67', '#5227FF']);

    program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: amplitude },
        uColorStops: { value: colorStopsValue },
        uResolution: { value: [msg.width ?? 1, msg.height ?? 1] },
        uBlend: { value: blend }
      }
    });

    mesh = new Mesh(gl, { geometry, program });
    resize(msg.width ?? 1, msg.height ?? 1);
    scheduleFrame(update);
    return;
  }

  if (msg.type === 'resize') {
    resize(msg.width ?? 1, msg.height ?? 1);
    return;
  }

  if (msg.type === 'props') {
    if (typeof msg.amplitude === 'number') amplitude = msg.amplitude;
    if (typeof msg.blend === 'number') blend = msg.blend;
    if (typeof msg.speed === 'number') speed = msg.speed;
    timeOverride = msg.time;
    if (Array.isArray(msg.colorStops)) applyStops(msg.colorStops);
  }
};
