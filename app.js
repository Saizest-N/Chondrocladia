const canvas = document.querySelector('#scene');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
const touchInputQuery = matchMedia('(hover: none), (pointer: coarse)');

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
// Temporary review cadence. Set to false after the visual check to restore
// the rare observation timings without changing the scheduler itself.
const REVIEW_EVENT_TIMING = false;
const eventTiming = REVIEW_EVENT_TIMING ? {
  creatureFirst:[8,4], creatureRepeat:[9,2], creatureAfterSwitch:[8,4],
  signalFirst:[27,6], signalRepeat:[27,6], signalAfterSwitch:[27,6]
} : {
  creatureFirst:[55,95], creatureRepeat:[150,420], creatureAfterSwitch:[55,120],
  signalFirst:[360,600], signalRepeat:[360,600], signalAfterSwitch:[300,480]
};
const eventDelay = ([base,jitter]) => base + Math.random() * jitter;
const seeded = (n) => {
  const x = Math.sin(n * 91.731 + 17.13) * 43758.5453;
  return x - Math.floor(x);
};

const cameras = [
  {
    id: '01', species: 'C. lyra', location: 'Northern California Margin', depth: '3,400 m',
    temperatureBase: 1.8, temperatureMin: 1.6, temperatureMax: 2.0, zone: 'America/Los_Angeles', zoneLabel: 'PT',
    currents: ['0.03 m/s', '0.08 m/s', '0.14 m/s'], palette: ['#102c37', '#061720', '#010509'], snowFactor: 1
  },
  {
    id: '02', species: 'C. lampadiglobus', location: 'East Pacific Rise', depth: '2,714 m',
    temperatureBase: 2.1, temperatureMin: 1.9, temperatureMax: 2.3, zone: 'Etc/GMT+6', zoneLabel: 'GALT',
    currents: ['0.02 m/s', '0.06 m/s', '0.11 m/s'], palette: ['#122b35', '#07151c', '#010407'], snowFactor: 1
  },
  {
    id: '03', species: 'C. coronata', location: 'Northwest Guam Seamount', depth: '1,229 m',
    temperatureBase: 3.2, temperatureMin: 3.0, temperatureMax: 3.4, zone: 'Pacific/Guam', zoneLabel: 'ChST',
    currents: ['0.03 m/s', '0.08 m/s', '0.15 m/s'], palette: ['#172b38', '#07141d', '#010407'], snowFactor: 1
  },
  {
    id: '04', species: 'C. grandis', location: 'Northeast Channel, Gulf of Maine', depth: '852 m',
    temperatureBase: 5.0, temperatureMin: 4.8, temperatureMax: 5.2, zone: 'America/Halifax', zoneLabels: ['AST', 'ADT'],
    currents: ['0.03 m/s', '0.07 m/s', '0.13 m/s'], palette: ['#17313a', '#091b24', '#02070b'], snowFactor: 1
  },
  {
    id: '05', species: 'C. virgata', location: 'Strait of Gibraltar', depth: '872 m',
    temperatureBase: 10.2, temperatureMin: 10.1, temperatureMax: 10.3, zone: 'Europe/Gibraltar', zoneLabels: ['CET', 'CEST'],
    currents: ['0.02 m/s', '0.06 m/s', '0.11 m/s'], palette: ['#172d37', '#091820', '#020609'], snowFactor: .82
  }
];

const grandisBulbs = [...Array.from({ length: 18 }, (_, i) => {
  const u = .075 + i / 17 * .84 + (seeded(i + 2100) - .5) * .022;
  const angle = seeded(i + 2130) * TAU;
  const moveToLeft = [2, 7, 10, 14, 17].includes(i);
  const moveToRight = i === 0;
  return {
    u,
    side: moveToRight ? 1 : moveToLeft || Math.cos(angle) < 0 ? -1 : 1,
    reach: 62 + seeded(i + 2160) * 92,
    lift: (seeded(i + 2190) - .5) * 36,
    radius: 25 + seeded(i + 2220) * 18,
    phase: seeded(i + 2250) * TAU,
    depth: (Math.sin(angle) + 1) * .5,
    front: Math.sin(angle) > .14
  };
}),
  // Three terminal bulbs overlap the axis tip so it never reads as cut off.
  { u:.985, side:-1, reach:83, lift:-10, radius:34, phase:.7, depth:.58, front:true },
  { u:.998, side:1, reach:0, lift:-47, radius:38, phase:2.4, depth:.75, front:true },
  { u:.985, side:1, reach:87, lift:-8, radius:32, phase:4.8, depth:.42, front:false }
];

const virgataNodes = [
  { parent:-1, dx:0, dy:-111, w:11, level:0, phase:.1 },
  { parent:0, dx:-6, dy:-94.5, w:9.5, level:1, phase:.8 },
  { parent:1, dx:-78, dy:-92, w:7.3, level:2, phase:1.7 },
  { parent:1, dx:76, dy:-108, w:7.6, level:2, phase:2.8 },
  { parent:2, dx:-92, dy:-82, w:5.7, level:3, phase:3.2 },
  { parent:2, dx:34, dy:-94, w:5.4, level:3, phase:4.1 },
  { parent:3, dx:-30, dy:-101, w:5.6, level:3, phase:5.2 },
  { parent:3, dx:96, dy:-76, w:5.2, level:3, phase:6.0 },
  { parent:4, dx:-63, dy:-66, w:3.7, level:4, phase:.5 },
  { parent:4, dx:28, dy:-73, w:3.5, level:4, phase:1.4 },
  { parent:5, dx:-38, dy:-78, w:3.4, level:4, phase:2.3 },
  { parent:5, dx:57, dy:-60, w:3.2, level:4, phase:3.6 },
  { parent:6, dx:-55, dy:-74, w:3.5, level:4, phase:4.4 },
  { parent:6, dx:38, dy:-80, w:3.3, level:4, phase:5.6 },
  { parent:7, dx:47, dy:-67, w:3.2, level:4, phase:.7 },
  { parent:7, dx:83, dy:-34, w:3.0, level:4, phase:1.9 },
  { parent:8, dx:-32, dy:-43, w:2.1, level:5, phase:2.6 },
  { parent:8, dx:22, dy:-49, w:2.0, level:5, phase:3.8 },
  { parent:9, dx:-19, dy:-47, w:2.0, level:5, phase:4.7 },
  { parent:9, dx:38, dy:-39, w:1.9, level:5, phase:5.8 },
  { parent:10, dx:-31, dy:-45, w:2.0, level:5, phase:.9 },
  { parent:11, dx:34, dy:-38, w:1.8, level:5, phase:2.1 },
  { parent:12, dx:-34, dy:-42, w:2.0, level:5, phase:3.1 },
  { parent:13, dx:27, dy:-48, w:1.9, level:5, phase:4.2 },
  { parent:14, dx:36, dy:-42, w:1.8, level:5, phase:5.3 },
  { parent:15, dx:45, dy:-27, w:1.7, level:5, phase:6.1 },
  { parent:2, dx:-18, dy:-72, w:4.1, level:3, phase:.35 },
  { parent:3, dx:24, dy:-76, w:4.0, level:3, phase:1.15 },
  { parent:4, dx:57, dy:-58, w:3.2, level:4, phase:2.05 },
  { parent:5, dx:-68, dy:-47, w:3.1, level:4, phase:2.95 },
  { parent:6, dx:65, dy:-55, w:3.0, level:4, phase:3.85 },
  { parent:7, dx:-40, dy:-61, w:3.0, level:4, phase:4.75 },
  { parent:8, dx:-49, dy:-34, w:2.0, level:5, phase:5.65 },
  { parent:10, dx:28, dy:-46, w:1.9, level:5, phase:.6 },
  { parent:12, dx:24, dy:-47, w:1.9, level:5, phase:1.55 },
  { parent:14, dx:-25, dy:-45, w:1.8, level:5, phase:2.5 },
  { parent:26, dx:-35, dy:-43, w:2.0, level:5, phase:3.45 },
  { parent:26, dx:29, dy:-47, w:1.9, level:5, phase:4.35 },
  { parent:27, dx:-30, dy:-44, w:1.9, level:5, phase:5.25 },
  { parent:27, dx:36, dy:-40, w:1.8, level:5, phase:6.05 }
];

// Add one fine offshoot to each established branch so the silhouette remains
// tree-like while becoming denser without introducing a second draw system.
const virgataBaseNodeCount = virgataNodes.length;
for (let i = 0; i < virgataBaseNodeCount; i++) {
  const parent = 2 + (i * 7) % (virgataBaseNodeCount - 2);
  const parentNode = virgataNodes[parent];
  const direction = seeded(i + 3500) > .5 ? 1 : -1;
  virgataNodes.push({
    parent,
    dx: direction * (22 + seeded(i + 3530) * 34),
    dy: -(24 + seeded(i + 3560) * 34),
    w: Math.max(1.1, parentNode.w * (.48 + seeded(i + 3590) * .16)),
    level: Math.min(parentNode.level + 1, 6),
    phase: seeded(i + 3620) * TAU
  });
}

const state = {
  camera: 0,
  current: 1,
  light: true,
  sound: false,
  switching: false,
  signalDegraded: false,
  elapsed: 0,
  lastTime: performance.now(),
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches
};

let width = 0;
let height = 0;
let dpr = 1;
let sceneScale = 1;
let snow = [];
let feed = [];
let creatures = [];
let nextCreatureAt = eventDelay(eventTiming.creatureFirst);
let nextAmbientFeedAt = 90 + Math.random() * 150;
let nextSignalDegradeAt = eventDelay(eventTiming.signalFirst);
let signalDegradeEndsAt = 0;
let mobileVirgataPoseTime = -1;
let mobileVirgataPoseCurrent = -1;
let mobileVirgataPose = null;

function resize() {
  width = Math.max(1, Math.round(window.innerWidth));
  height = Math.max(1, Math.round(window.innerHeight));
  document.documentElement.style.setProperty('--app-height', `${height}px`);
  const compactTouch = touchInputQuery.matches && Math.min(width,height) <= 620;
  const resolutionCap = Math.min(2560 / width, 1440 / height);
  const pixelCap = Math.sqrt((compactTouch ? 1800000 : 3686400) / (width * height));
  dpr = Math.min(window.devicePixelRatio || 1, compactTouch ? 1.75 : 2, resolutionCap, pixelCap);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sceneScale = Math.min(width / 1920, height / 1080);
  makeSnow();
}

function makeSnow() {
  const compactTouch = touchInputQuery.matches && Math.min(width,height) <= 620;
  const areaScale = clamp((width * height) / (1920 * 1080), compactTouch ? .32 : .46, 1.45);
  const mobileDensity = compactTouch ? .82 : 1;
  snow = Array.from({ length: Math.round(185 * areaScale * mobileDensity * cameras[state.camera].snowFactor) }, (_, i) => {
    const depthSeed=seeded(i+271);
    const layer=depthSeed<.5?0:depthSeed<.88?1:2;
    const z=layer===0?.12+depthSeed*.32:layer===1?.42+(depthSeed-.5)*.72:.8+(depthSeed-.88)*1.65;
    return {
      x: seeded(i + 3) * width,
      y: seeded(i + 111) * height,
      z,
      layer,
      drift: seeded(i + 92) * TAU,
      shape: seeded(i + 832)
    };
  });
}

function currentFactor() {
  return [.54, 1, 1.62][state.current];
}

function worldScale() {
  const compactLandscape = touchInputQuery.matches && width > height && height <= 620;
  // Mobile browser chrome leaves a very shallow landscape viewport. Let the
  // full 16:9 observation frame fit there instead of enforcing the desktop
  // minimum zoom, with a small margin so tall specimens stay clear of the UI.
  if(compactLandscape){
    const cameraScale=state.camera===0?1.342:1;
    return sceneScale*.94*cameraScale;
  }
  return Math.max(sceneScale,.58);
}

function worldOrigin(s) {
  const compactLyra=touchInputQuery.matches&&width>height&&height<=620&&state.camera===0;
  return {
    x:(width-1920*s)*.5,
    y:(height-1080*s)*.5-(compactLyra?48:0)
  };
}

function beginWorldTransform() {
  const s = worldScale();
  const origin=worldOrigin(s);
  ctx.save();
  ctx.translate(origin.x,origin.y);
  ctx.scale(s, s);
}

function lightStrength() {
  return state.light ? 1 : .095;
}

function drawWater() {
  const cam = cameras[state.camera];
  const glowX = [.55, .45, .58, .54, .57][state.camera];
  const g = ctx.createRadialGradient(width * glowX, height * .48, 4, width * glowX, height * .52, Math.max(width, height) * .82);
  g.addColorStop(0, cam.palette[0]);
  g.addColorStop(.38, cam.palette[1]);
  g.addColorStop(1, cam.palette[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  // A cool depth veil lowers distant contrast without blur or refraction.
  const depth = ctx.createLinearGradient(0, 0, 0, height);
  depth.addColorStop(0, 'rgba(2,10,17,.46)');
  depth.addColorStop(.48, 'rgba(13,38,47,.09)');
  depth.addColorStop(1, 'rgba(1,5,8,.28)');
  ctx.fillStyle=depth; ctx.fillRect(0,0,width,height);

  // Broad, nearly static haze bands give the water column quiet volume.
  const hazeShift=Math.sin(state.elapsed*.012)*width*.012;
  ctx.fillStyle='rgba(91,133,139,.012)';
  ctx.beginPath(); ctx.ellipse(width*.28+hazeShift,height*.33,width*.34,height*.13,-.08,0,TAU); ctx.fill();
  ctx.fillStyle='rgba(64,111,120,.016)';
  ctx.beginPath(); ctx.ellipse(width*.72-hazeShift*.7,height*.56,width*.39,height*.17,.05,0,TAU); ctx.fill();
  const off = 1 - lightStrength();
  if (off > 0) {
    ctx.fillStyle = `rgba(0,2,5,${off * .76})`;
    ctx.fillRect(0, 0, width, height);
  }
}

function drawMidwaterVeil() {
  const veil=ctx.createLinearGradient(0,height*.25,0,height*.9);
  veil.addColorStop(0,'rgba(69,109,118,.018)');
  veil.addColorStop(.58,'rgba(54,92,100,.034)');
  veil.addColorStop(1,'rgba(5,15,20,0)');
  ctx.fillStyle=veil; ctx.fillRect(0,height*.18,width,height*.76);
}

function drawDistantGlow() {
  const chanceSeed = Math.floor(state.elapsed / 24) + state.camera * 19;
  if (seeded(chanceSeed) < .48 || state.light) return;
  const progress = (state.elapsed % 24) / 24;
  const alpha = Math.sin(progress * Math.PI) * .2;
  const x = width * (.15 + seeded(chanceSeed + 8) * .7);
  const y = height * (.18 + seeded(chanceSeed + 3) * .35);
  ctx.save();
  ctx.shadowColor = '#62bad1'; ctx.shadowBlur = 11;
  ctx.fillStyle = `rgba(115,210,225,${alpha})`;
  ctx.beginPath(); ctx.arc(x, y, .8 + seeded(chanceSeed + 1), 0, TAU); ctx.fill();
  ctx.restore();
}

function drawLyraFloor() {
  const lit = lightStrength();
  const g = ctx.createLinearGradient(0, 765, 0, 1080);
  g.addColorStop(0, `rgba(64,76,72,${.56 * lit})`);
  g.addColorStop(1, `rgba(18,22,21,${.95 * lit})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-50, 796);
  ctx.bezierCurveTo(420, 745, 810, 793, 1190, 754);
  ctx.bezierCurveTo(1470, 727, 1740, 766, 1970, 744);
  ctx.lineTo(1970, 1130); ctx.lineTo(-50, 1130); ctx.fill();
  // Soft mottling, shallow hollows and thin sediment trails keep the mud flat
  // broad and quiet while avoiding a single, uniform fill.
  for(let i=0;i<13;i++) {
    const x=seeded(i+1200)*2000-40, y=805+seeded(i+1220)*245;
    const rw=75+seeded(i+1240)*180, rh=10+seeded(i+1260)*27;
    ctx.fillStyle=`rgba(${seeded(i+1270)>.5?'26,34,32':'118,121,103'},${(.018+seeded(i+1280)*.027)*lit})`;
    ctx.beginPath(); ctx.ellipse(x,y,rw,rh,(seeded(i+1290)-.5)*.22,0,TAU); ctx.fill();
  }
  ctx.strokeStyle=`rgba(176,176,151,${.052*lit})`; ctx.lineWidth=1.2;
  for(let i=0;i<9;i++) {
    const y=824+i*25+seeded(i+1310)*9;
    ctx.beginPath(); ctx.moveTo(80+seeded(i+1320)*250,y);
    ctx.bezierCurveTo(520,y-7,1020,y+12,1760+seeded(i+1330)*90,y-4); ctx.stroke();
  }
  for(let i=0;i<7;i++) {
    const x=130+seeded(i+1340)*1690, y=824+seeded(i+1350)*210;
    ctx.fillStyle=`rgba(5,11,12,${(.08+seeded(i+1360)*.07)*lit})`;
    ctx.beginPath(); ctx.ellipse(x,y,12+seeded(i+1370)*25,3+seeded(i+1380)*7,seeded(i+1390)*TAU,0,TAU); ctx.fill();
  }
  ctx.fillStyle = `rgba(179,183,160,${.11 * lit})`;
  for (let i = 0; i < 190; i++) {
    const x = seeded(i + 200) * 2020 - 50;
    const y = 790 + seeded(i + 401) * 280;
    const r = .5 + seeded(i + 903) * 2.1;
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.8, r, seeded(i) * TAU, 0, TAU); ctx.fill();
  }
}

function rockPath(x, y, w, h, seed) {
  ctx.beginPath();
  const points = 9;
  for (let i = 0; i <= points; i++) {
    const a = Math.PI + (i / points) * Math.PI;
    const rx = w * (.46 + seeded(seed + i) * .08);
    const ry = h * (.8 + seeded(seed + i + 20) * .18);
    const px = x + Math.cos(a) * rx;
    const py = y + Math.sin(a) * ry;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function angularRockPath(x,y,w,h,seed) {
  ctx.beginPath();
  ctx.moveTo(x-w*.5,y);
  for(let i=0;i<7;i++) {
    const u=i/6;
    const px=x-w*.43+u*w*.86+(seeded(seed+i)-.5)*w*.09;
    const ridge=Math.sin(u*Math.PI);
    const py=y-ridge*h*(.7+seeded(seed+i+20)*.34)+(seeded(seed+i+40)-.5)*h*.08;
    ctx.lineTo(px,py);
  }
  ctx.lineTo(x+w*.5,y); ctx.closePath();
}

function drawVolcanicFloor() {
  const lit = lightStrength();
  const g = ctx.createLinearGradient(0, 735, 0, 1080);
  g.addColorStop(0, `rgba(25,34,36,${.5 * lit})`);
  g.addColorStop(1, `rgba(5,8,10,${.99 * lit})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-40, 835); ctx.quadraticCurveTo(420, 790, 805, 838); ctx.quadraticCurveTo(1260, 765, 1960, 812); ctx.lineTo(1960, 1100); ctx.lineTo(-40, 1100); ctx.fill();
  // A muted back row establishes distance behind the darker pillow lava.
  [[135,836,190,62,204],[510,822,250,73,214],[890,817,210,58,224],[1320,800,275,78,234],[1760,807,230,67,244]].forEach(([x,y,w,h,s])=>{
    ctx.fillStyle=`rgba(39,55,58,${.19*lit})`; rockPath(x,y,w,h,s); ctx.fill();
  });
  // Overlapping pillow-lava lobes keep this site distinctly volcanic.
  const rocks = [[80,894,310,140,4],[330,870,390,175,14],[650,925,335,125,24],[960,875,440,195,34],[1280,920,345,142,44],[1570,858,470,205,54],[1900,920,390,155,64]];
  rocks.forEach(([x,y,w,h,s]) => {
    const rg = ctx.createLinearGradient(x - w/2, y - h, x + w/2, y);
    rg.addColorStop(0, `rgba(58,72,72,${.44 * lit})`);
    rg.addColorStop(.46, `rgba(23,31,32,${.86 * lit})`);
    rg.addColorStop(1, `rgba(5,8,10,${.98 * lit})`);
    ctx.fillStyle = rg; rockPath(x,y,w,h,s); ctx.fill();
    ctx.strokeStyle = `rgba(117,143,142,${.085 * lit})`; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = `rgba(5,10,12,${.48 * lit})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x-w*.15,y-h*.55); ctx.quadraticCurveTo(x-w*.03,y-h*.3,x+w*.08,y-h*.14); ctx.stroke();
    ctx.strokeStyle=`rgba(101,126,126,${.055*lit})`; ctx.lineWidth=1.1;
    ctx.beginPath(); ctx.moveTo(x-w*.29,y-h*.3); ctx.quadraticCurveTo(x-w*.08,y-h*.48,x+w*.2,y-h*.36); ctx.stroke();
  });
  // Sparse ash and sediment collect in the gaps rather than covering the lava.
  ctx.fillStyle=`rgba(139,137,112,${.07*lit})`;
  [[520,947,115,14],[1110,962,138,16],[1760,955,105,13]].forEach(([x,y,rx,ry])=>{
    ctx.beginPath(); ctx.ellipse(x,y,rx,ry,-.05,0,TAU); ctx.fill();
  });
}

function drawSeamountFloor() {
  const lit = lightStrength();
  const g = ctx.createLinearGradient(0, 690, 0, 1080);
  g.addColorStop(0, `rgba(89,86,73,${.43 * lit})`);
  g.addColorStop(.55, `rgba(48,48,42,${.77 * lit})`);
  g.addColorStop(1, `rgba(16,18,18,${.98 * lit})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-40, 900); ctx.quadraticCurveTo(420, 860, 790, 882); ctx.quadraticCurveTo(1170, 920, 1500, 745); ctx.quadraticCurveTo(1740, 665, 1960, 730); ctx.lineTo(1960, 1100); ctx.lineTo(-40, 1100); ctx.fill();
  // Low-contrast distant outcrops fade into the blue-grey water column.
  [[90,866,220,82,301],[480,862,185,68,311],[910,870,255,94,321],[1260,822,205,82,331],[1780,722,250,105,341]].forEach(([x,y,w,h,s])=>{
    ctx.fillStyle=`rgba(71,77,72,${.2*lit})`; angularRockPath(x,y,w,h,s); ctx.fill();
  });
  // Exposed angular outcrops sit among sandy pockets on the nearer slope.
  [[260,902,360,190,61],[735,927,300,118,71],[1510,786,530,275,81],[1890,885,280,145,91]].forEach(([x,y,w,h,s]) => {
    const rg = ctx.createLinearGradient(x-w/3,y-h,x+w/2,y);
    rg.addColorStop(0, `rgba(111,112,96,${.5 * lit})`);
    rg.addColorStop(.48, `rgba(57,59,53,${.82 * lit})`);
    rg.addColorStop(1, `rgba(20,22,22,${.98 * lit})`);
    ctx.fillStyle = rg; angularRockPath(x,y,w,h,s); ctx.fill();
    ctx.strokeStyle = `rgba(205,199,166,${.1 * lit})`; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle=`rgba(19,23,22,${.38*lit})`; ctx.lineWidth=1.7;
    ctx.beginPath(); ctx.moveTo(x-w*.2,y-h*.42); ctx.lineTo(x-w*.03,y-h*.22); ctx.lineTo(x+w*.12,y-h*.5); ctx.stroke();
  });
  ctx.strokeStyle = `rgba(206,194,158,${.055 * lit})`; ctx.lineWidth = 1.4;
  for (let i=0;i<11;i++) {
    const y=880+i*17;
    ctx.beginPath(); ctx.moveTo(300+seeded(i)*90,y); ctx.quadraticCurveTo(850,y-9,1280+seeded(i+17)*170,y+3); ctx.stroke();
  }
  ctx.fillStyle = `rgba(203,188,148,${.115 * lit})`;
  for (let i=0;i<115;i++) {
    const x=seeded(i+611)*1920, y=835+seeded(i+812)*245;
    ctx.beginPath(); ctx.arc(x,y,.5+seeded(i+22)*1.6,0,TAU); ctx.fill();
  }
  // Small foreground fragments reinforce the rougher seamount terrain.
  for(let i=0;i<10;i++) {
    const x=70+seeded(i+1420)*1800, y=905+seeded(i+1440)*160;
    const w=16+seeded(i+1460)*38, h=8+seeded(i+1480)*24;
    ctx.fillStyle=`rgba(15,19,19,${(.55+seeded(i+1500)*.28)*lit})`;
    angularRockPath(x,y,w,h,i+1510); ctx.fill();
  }
}

function drawGrandisFloor() {
  const lit=lightStrength();
  const g=ctx.createLinearGradient(0,720,0,1080);
  g.addColorStop(0,`rgba(66,86,91,${.42*lit})`);
  g.addColorStop(.56,`rgba(42,55,57,${.72*lit})`);
  g.addColorStop(1,`rgba(15,21,22,${.97*lit})`);
  ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(-40,842);
  ctx.bezierCurveTo(310,790,590,846,900,806);
  ctx.bezierCurveTo(1210,766,1510,834,1960,772);
  ctx.lineTo(1960,1110); ctx.lineTo(-40,1110); ctx.fill();
  // Cold blue-grey sediment with sparse, rounded glacial-looking blocks.
  [[180,868,210,72,2301],[520,846,150,55,2321],[835,866,240,84,2341],[1390,830,190,68,2361],[1780,820,245,82,2381]].forEach(([x,y,w,h,s])=>{
    const rg=ctx.createLinearGradient(x-w*.4,y-h,x+w*.35,y);
    rg.addColorStop(0,`rgba(105,124,124,${.26*lit})`);
    rg.addColorStop(.55,`rgba(54,69,70,${.52*lit})`);
    rg.addColorStop(1,`rgba(22,29,30,${.82*lit})`);
    ctx.fillStyle=rg; rockPath(x,y,w,h,s); ctx.fill();
    ctx.strokeStyle=`rgba(153,174,171,${.07*lit})`; ctx.lineWidth=1.5; ctx.stroke();
  });
  for(let i=0;i<14;i++){
    const x=seeded(i+2400)*1970, y=840+seeded(i+2420)*225;
    ctx.fillStyle=`rgba(${seeded(i+2440)>.52?'126,137,126':'26,37,39'},${(.024+seeded(i+2460)*.04)*lit})`;
    ctx.beginPath(); ctx.ellipse(x,y,45+seeded(i+2480)*125,7+seeded(i+2500)*19,(seeded(i+2520)-.5)*.18,0,TAU); ctx.fill();
  }
  ctx.fillStyle=`rgba(176,189,177,${.085*lit})`;
  for(let i=0;i<125;i++){
    const x=seeded(i+2540)*1940, y=820+seeded(i+2560)*255;
    ctx.beginPath(); ctx.ellipse(x,y,.5+seeded(i+2580)*1.6,.35+seeded(i+2600)*.8,seeded(i+2620)*TAU,0,TAU); ctx.fill();
  }
}

function drawVirgataFloor() {
  const lit=lightStrength();
  const g=ctx.createLinearGradient(0,748,0,1080);
  g.addColorStop(0,`rgba(75,88,88,${.4*lit})`);
  g.addColorStop(.58,`rgba(43,51,51,${.73*lit})`);
  g.addColorStop(1,`rgba(17,21,22,${.97*lit})`);
  ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(-40,838);
  ctx.bezierCurveTo(380,814,720,846,1070,808);
  ctx.bezierCurveTo(1430,770,1650,824,1960,798);
  ctx.lineTo(1960,1110); ctx.lineTo(-40,1110); ctx.fill();
  // Fine Atlantic sediment stays visually quiet; only low outcrops break it.
  [[290,854,175,42,2701],[780,844,125,34,2721],[1510,825,210,53,2741],[1840,842,120,31,2761]].forEach(([x,y,w,h,s])=>{
    const rg=ctx.createLinearGradient(x-w*.4,y-h,x+w*.4,y);
    rg.addColorStop(0,`rgba(93,105,102,${.21*lit})`);
    rg.addColorStop(1,`rgba(29,36,37,${.68*lit})`);
    ctx.fillStyle=rg; angularRockPath(x,y,w,h,s); ctx.fill();
  });
  ctx.strokeStyle=`rgba(184,190,173,${.045*lit})`; ctx.lineWidth=1;
  for(let i=0;i<10;i++){
    const y=846+i*22+seeded(i+2780)*8;
    ctx.beginPath(); ctx.moveTo(70+seeded(i+2800)*210,y); ctx.bezierCurveTo(580,y-5,1210,y+8,1860,y-3); ctx.stroke();
  }
  ctx.fillStyle=`rgba(179,186,173,${.075*lit})`;
  for(let i=0;i<105;i++){
    const x=seeded(i+2820)*1950, y=825+seeded(i+2840)*245;
    ctx.beginPath(); ctx.arc(x,y,.35+seeded(i+2860)*1.2,0,TAU); ctx.fill();
  }
}

function setBioStroke(alpha = 1, widthPx = 2) {
  const lit = lightStrength();
  ctx.strokeStyle = `rgba(220,243,243,${alpha * (.16 + .84 * lit)})`;
  ctx.lineWidth = widthPx;
  ctx.lineCap = 'round';
  ctx.shadowColor = `rgba(126,207,219,${.34 * lit})`;
  ctx.shadowBlur = 7 * lit;
}

function drawLyra(time) {
  const flow = currentFactor();
  ctx.save(); ctx.translate(1040, 844);
  const vanes = [
    // Each entry is one half-harp: its tallest end meets the other vanes at
    // the centre, while its branches taper toward the outer tip. In plan the
    // four rails form a cross, compressed here by the camera perspective.
    { dx: -82, dy: -205, length: 302, count: 15, alpha: .3, bend: -9, order: 0, phase: 1.7 },
    { dx: 238, dy: 116, length: 262, count: 16, alpha: .42, bend: 13, order: 1, phase: 2.6 },
    { dx: -382, dy: -30, length: 286, count: 19, alpha: .64, bend: -20, order: 2, phase: .8 },
    { dx: 414, dy: -8, length: 306, count: 20, alpha: .8, bend: -18, order: 3, phase: 0 }
  ].sort((a, b) => a.order - b.order);
  vanes.forEach((v, vi) => {
    const railPoint = (u) => ({
      x: v.dx * u,
      y: v.dy * u + v.bend * Math.sin(u * Math.PI)
    });
    setBioStroke(v.alpha, 2.35);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(v.dx * .5, v.dy * .5 + v.bend, v.dx, v.dy);
    ctx.stroke();
    for (let i = 0; i < v.count; i++) {
      const edgeU = i / (v.count - 1);
      const jitter = i === 0 || i === v.count - 1 ? 0 : (seeded(i + vi * 61) - .5) * .018;
      const u = clamp(edgeU + jitter, 0, 1);
      const base = railPoint(u);
      // A lyra vane is half of the former mountain profile: high at the
      // central crossing and progressively shorter toward its free end.
      const branchLen = 34 + Math.pow(1-u, .76) * v.length + (seeded(i + vi * 77) - .5) * 15;
      const phase=time*.00038*flow+i*.27+vi*1.4;
      const naturalTilt=(seeded(i+vi*39)-.5)*4.6;
      const sway=Math.sin(phase + v.phase)*(1.3+flow*2.2)+Math.sin(phase*.47)*1.1+naturalTilt;
      setBioStroke(v.alpha*(.8+seeded(i+32)*.2),1.5+seeded(i+19)*.22);
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.bezierCurveTo(base.x, base.y-branchLen*.36, base.x+sway*.35, base.y-branchLen*.74, base.x+sway, base.y-branchLen);
      ctx.stroke();
      // Swellings remain irregular, with roughly twice the previous coverage.
      if (seeded(i+vi*51)>.64) {
        const r=3+seeded(i+vi*93)*2.8;
        ctx.fillStyle=`rgba(224,245,239,${v.alpha*(.25+.64*lightStrength())})`;
        ctx.beginPath(); ctx.ellipse(base.x+sway,base.y-branchLen,r*.84,r,seeded(i)*.4,0,TAU); ctx.fill();
      }
    }
  });
  setBioStroke(.58,1.65);
  for(let i=0;i<11;i++) {
    const a=-2.78+i*.27, len=24+seeded(i+71)*28;
    ctx.beginPath(); ctx.moveTo(0,-2); ctx.quadraticCurveTo(Math.cos(a)*len*.55,Math.sin(a)*len*.45+13,Math.cos(a)*len,Math.sin(a)*len+23); ctx.stroke();
  }
  ctx.restore();
}

function bulbGradient(x,y,r,alpha) {
  const lit=lightStrength();
  const g=ctx.createRadialGradient(x-r*.28,y-r*.28,r*.08,x,y,r);
  g.addColorStop(0,`rgba(235,253,249,${alpha*(.24+.5*lit)})`);
  g.addColorStop(.34,`rgba(151,220,231,${alpha*(.12+.27*lit)})`);
  g.addColorStop(.78,`rgba(83,168,190,${alpha*(.07+.23*lit)})`);
  g.addColorStop(1,`rgba(185,236,239,${alpha*(.18+.35*lit)})`);
  return g;
}

function drawLampadiglobus(time) {
  const flow=currentFactor();
  const stemLean=Math.sin(time*.00027*flow)*15*flow;
  ctx.save(); ctx.translate(930,885);
  // A narrow filled silhouette gives the main axis a subtle base-to-tip
  // taper that a uniform canvas stroke cannot provide.
  ctx.fillStyle=`rgba(220,243,243,${.88*(.16+.84*lightStrength())})`;
  ctx.shadowColor=`rgba(126,207,219,${.34*lightStrength()})`; ctx.shadowBlur=7*lightStrength();
  ctx.beginPath();
  ctx.moveTo(-6.4,0);
  ctx.bezierCurveTo(-12,-230,stemLean*.25-5.7,-430,stemLean-5.3,-612);
  ctx.lineTo(stemLean+5.3,-612);
  ctx.bezierCurveTo(stemLean*.25+5.7,-430,-6.4,-230,6.4,0);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle=`rgba(208,237,231,${.28+.45*lightStrength()})`; ctx.beginPath(); ctx.ellipse(0,4,13,6,0,0,TAU); ctx.fill();
  const bulbs=[[-108,-128,52],[-15,-168,44],[72,-119,57],[151,-42,39],[113,53,52],[34,128,47],[-139,20,42],[-48,44,54,true],[49,38,47,true]];
  const hubY=-610;
  const bulbPos=bulbs.map(([bx,by,br,front=false],i)=>{
    const lag=Math.sin(time*.00027*flow-i*.16)*9*flow;
    return {bx,by,br,front,i,tx:stemLean+bx+lag,ty:hubY+by+Math.sin(time*.00034+i)*2,lag};
  });
  // Draw the complete radial handle structure before the translucent bulbs.
  bulbPos.forEach(({bx,by,tx,ty,lag})=>{
    setBioStroke(.78,2.3);
    ctx.beginPath(); ctx.moveTo(stemLean,hubY); ctx.quadraticCurveTo(stemLean+bx*.48+lag*.2,hubY+by*.5,tx,ty); ctx.stroke();
  });
  const drawBulb=({tx,ty,br,i})=>{
    const rr=br*(.91+seeded(i+88)*.16);
    ctx.fillStyle=bulbGradient(tx,ty,rr,.92); ctx.shadowColor=`rgba(98,194,214,${.32*lightStrength()})`; ctx.shadowBlur=18*lightStrength();
    ctx.beginPath(); ctx.ellipse(tx,ty,rr*(.94+seeded(i)*.09),rr,seeded(i+3)*.3,0,TAU); ctx.fill();
    ctx.strokeStyle=`rgba(211,245,243,${.16+.29*lightStrength()})`; ctx.lineWidth=1.1; ctx.stroke();
    ctx.fillStyle=`rgba(225,250,246,${.16+.35*lightStrength()})`; ctx.beginPath(); ctx.arc(lerp(stemLean,tx,.82),lerp(hubY,ty,.82),2.1,0,TAU); ctx.fill();
  };
  bulbPos.filter(b=>!b.front).forEach(drawBulb);
  ctx.fillStyle=`rgba(221,247,243,${.24+.5*lightStrength()})`; ctx.beginPath(); ctx.ellipse(stemLean,hubY,17,14,0,0,TAU); ctx.fill();
  // Two lower, overlapping bulbs are rendered last to sit visibly in front.
  bulbPos.filter(b=>b.front).forEach(drawBulb);
  ctx.restore();
}

function drawCoronata(time) {
  const flow=currentFactor();
  const stemSway=Math.sin(time*.00022*flow)*5*flow;
  ctx.save(); ctx.translate(1050,874);
  const topY=-640;
  const stemX=(u)=>Math.sin(u*3.1)*5.5+stemSway*Math.pow(u,1.45);
  const stemPoints=Array.from({length:25},(_,i)=>{
    const u=i/24;
    // Reverse taper: about four times the previous visual weight, widening
    // gradually toward the crown while retaining slight organic variation.
    const organicWidth=4.7+u*6.8+Math.sin(u*18.4)*.12;
    return {x:stemX(u),y:topY*u,w:organicWidth};
  });
  ctx.fillStyle=`rgba(224,233,216,${.7*(.16+.84*lightStrength())})`;
  ctx.shadowColor=`rgba(126,207,219,${.3*lightStrength()})`; ctx.shadowBlur=6*lightStrength();
  ctx.beginPath();
  stemPoints.forEach((p,i)=>{if(i===0)ctx.moveTo(p.x-p.w,p.y);else ctx.lineTo(p.x-p.w,p.y);});
  for(let i=stemPoints.length-1;i>=0;i--){const p=stemPoints[i];ctx.lineTo(p.x+p.w,p.y);}
  ctx.closePath(); ctx.fill();
  ctx.fillStyle=`rgba(218,236,230,${.25+.4*lightStrength()})`; ctx.beginPath(); ctx.ellipse(0,3,15,7,-.2,0,TAU); ctx.fill();
  // Independent filaments occur at irregular heights and angles rather than
  // in mirrored horizontal pairs. Their length increases markedly upward.
  for(let i=0;i<108;i++) {
    const u=.04+seeded(i+330)*.9;
    const y=-42-u*552;
    const sx=stemX(u);
    const angle=seeded(i+721)*TAU;
    const depth=(Math.sin(angle)+1)/2;
    const side=Math.cos(angle)<0?-1:1;
    const baseLen=24+Math.pow(u,1.42)*205;
    const len=baseLen*(.72+seeded(i+912)*.52);
    const wave=Math.sin(time*.00046*flow+i*.71)*6.5*flow*(.35+u*.65);
    const projection=(.42+Math.abs(Math.cos(angle))*.58)*side;
    const rise=(seeded(i+117)-.5)*30-Math.sin(angle)*18;
    const ex=sx+projection*len+wave;
    const ey=y+rise;
    setBioStroke(.26+depth*.48,.72+depth*.38);
    ctx.beginPath(); ctx.moveTo(sx,y);
    ctx.quadraticCurveTo(sx+projection*len*.48+wave*.16,y+rise*.32,ex,ey);
    ctx.stroke();
  }
  const cy=topY-10;
  ctx.save(); ctx.translate(stemX(1),cy);
  const cup=ctx.createLinearGradient(0,-34,0,20);
  cup.addColorStop(0,`rgba(220,214,237,${.18+.35*lightStrength()})`);
  cup.addColorStop(.65,`rgba(177,165,203,${.13+.28*lightStrength()})`);
  cup.addColorStop(1,`rgba(225,238,235,${.16+.34*lightStrength()})`);
  ctx.fillStyle=cup; ctx.shadowColor=`rgba(180,174,222,${.26*lightStrength()})`; ctx.shadowBlur=14*lightStrength();
  ctx.beginPath(); ctx.moveTo(-12,17); ctx.bezierCurveTo(-23,1,-31,-16,-36,-29); ctx.quadraticCurveTo(0,-39,37,-29); ctx.bezierCurveTo(31,-14,23,2,12,17); ctx.quadraticCurveTo(0,22,-12,17); ctx.fill();
  ctx.strokeStyle=`rgba(229,225,242,${.24+.39*lightStrength()})`; ctx.lineWidth=1.05;
  ctx.beginPath(); ctx.ellipse(0,-29,36,7.5,0,0,TAU); ctx.stroke();
  for(let i=0;i<19;i++) {
    const a=Math.PI+(i/18)*Math.PI;
    const sx=Math.cos(a)*34.5, sy=-29+Math.sin(a)*6.5;
    const len=20+seeded(i+510)*31, spread=(i-9)/9;
    const wave=Math.sin(time*.0005*flow+i*.55)*3*flow;
    const horizontalReach=spread*len*1.15;
    const verticalReach=len*(.48+.22*(1-Math.abs(spread)));
    setBioStroke(.56,.82+seeded(i+41)*.18);
    ctx.beginPath(); ctx.moveTo(sx,sy); ctx.quadraticCurveTo(sx+horizontalReach*.52+wave*.2,sy-verticalReach*.56,sx+horizontalReach+wave,sy-verticalReach); ctx.stroke();
  }
  ctx.restore(); ctx.restore();
}

function grandisStemX(u,time) {
  const flow=currentFactor();
  const heavyLean=Math.sin(time*.00016*flow)*13*Math.min(flow,1.35);
  return Math.sin(u*5.2)*2.6+heavyLean*Math.pow(u,1.7);
}

function grandisBulbPose(item,index,time) {
  const flow=currentFactor();
  const baseX=grandisStemX(item.u,time);
  const baseY=-item.u*650;
  const branchLag=Math.sin(time*.00016*flow-item.phase*.18)*4.5*flow*Math.pow(item.u,.7);
  const bulbLag=Math.sin(time*.000145*flow-item.phase*.18-.42)*7*flow*Math.pow(item.u,.72);
  return {
    baseX,
    baseY,
    x:baseX+item.side*item.reach+branchLag+bulbLag,
    y:baseY+item.lift+Math.sin(time*.00018*flow+item.phase)*2.4*flow,
    radius:item.radius,
    alpha:.58+item.depth*.3,
    index
  };
}

function grandisBulbGradient(x,y,r,alpha) {
  const lit=lightStrength();
  const g=ctx.createRadialGradient(x-r*.25,y-r*.28,r*.06,x,y,r);
  g.addColorStop(0,`rgba(244,240,236,${alpha*(.28+.48*lit)})`);
  g.addColorStop(.42,`rgba(201,205,216,${alpha*(.16+.3*lit)})`);
  g.addColorStop(.8,`rgba(156,165,190,${alpha*(.09+.24*lit)})`);
  g.addColorStop(1,`rgba(222,218,225,${alpha*(.18+.35*lit)})`);
  return g;
}

function drawGrandis(time) {
  const lit=lightStrength();
  ctx.save(); ctx.translate(1040,900);
  const poses=grandisBulbs.map((item,i)=>({...grandisBulbPose(item,i,time),item}));
  const drawBranch=({baseX,baseY,x,y,alpha,item})=>{
    setBioStroke(alpha*.78,(3.4+item.radius*.018)*1.5);
    ctx.beginPath(); ctx.moveTo(baseX,baseY);
    ctx.quadraticCurveTo(lerp(baseX,x,.52),lerp(baseY,y,.48)-item.lift*.08,x,y); ctx.stroke();
  };
  const drawBulb=({x,y,radius,alpha,index})=>{
    const rx=radius*(.88+seeded(index+2900)*.17);
    ctx.fillStyle=grandisBulbGradient(x,y,radius,alpha);
    ctx.shadowColor=`rgba(154,177,209,${.26*lit})`; ctx.shadowBlur=13*lit;
    ctx.beginPath(); ctx.ellipse(x,y,rx,radius,(seeded(index+2920)-.5)*.28,0,TAU); ctx.fill();
    ctx.strokeStyle=`rgba(234,232,235,${.12+.25*lit})`; ctx.lineWidth=1; ctx.stroke();
  };
  poses.filter(p=>!p.item.front).forEach(drawBranch);
  poses.filter(p=>!p.item.front).forEach(drawBulb);

  // The fleshy axis keeps its weight-bearing silhouette with a slightly
  // slimmer profile, allowing the enlarged lateral stalks to remain clear.
  const points=Array.from({length:29},(_,i)=>{
    const u=i/28;
    return {u,x:grandisStemX(u,time),y:-650*u,w:20-u*4.4+Math.sin(u*17)*.36};
  });
  const stem=ctx.createLinearGradient(-20,0,19.2,0);
  stem.addColorStop(0,`rgba(173,185,180,${.48*(.2+.8*lit)})`);
  stem.addColorStop(.46,`rgba(239,239,226,${.84*(.18+.82*lit)})`);
  stem.addColorStop(1,`rgba(184,187,183,${.56*(.2+.8*lit)})`);
  ctx.fillStyle=stem; ctx.shadowColor=`rgba(133,197,204,${.24*lit})`; ctx.shadowBlur=8*lit;
  ctx.beginPath();
  points.forEach((p,i)=>{if(i===0)ctx.moveTo(p.x-p.w,p.y);else ctx.lineTo(p.x-p.w,p.y);});
  for(let i=points.length-1;i>=0;i--){const p=points[i];ctx.lineTo(p.x+p.w,p.y);}
  ctx.closePath(); ctx.fill();
  const tip=points[points.length-1];
  ctx.fillStyle=stem; ctx.beginPath(); ctx.ellipse(tip.x,tip.y,tip.w,tip.w*.68,0,0,TAU); ctx.fill();
  ctx.fillStyle=`rgba(224,232,219,${.28+.4*lit})`; ctx.beginPath(); ctx.ellipse(0,3,27,10,-.08,0,TAU); ctx.fill();

  poses.filter(p=>p.item.front).forEach(drawBranch);
  poses.filter(p=>p.item.front).forEach(drawBulb);
  ctx.restore();
}

function getVirgataPose(time) {
  const mobileLite=touchInputQuery.matches&&Math.min(width,height)<=620;
  if(mobileLite&&mobileVirgataPoseTime===time&&mobileVirgataPoseCurrent===state.current&&mobileVirgataPose)return mobileVirgataPose;
  const flow=currentFactor();
  const points=[];
  virgataNodes.forEach((node,index)=>{
    const parent=node.parent<0?{x:0,y:0}:points[node.parent];
    const upper=node.level/5;
    const wave=Math.sin(time*.00034*flow+node.phase)*(.004+upper*.043)*flow;
    const cos=Math.cos(wave),sin=Math.sin(wave);
    const branchScale=index>=2?1.1:1;
    const rawDx=node.dx*branchScale,rawDy=node.dy*branchScale;
    const dx=rawDx*cos-rawDy*sin;
    const dy=rawDx*sin+rawDy*cos;
    points.push({sx:parent.x,sy:parent.y,x:parent.x+dx,y:parent.y+dy,node,index});
  });
  if(mobileLite){mobileVirgataPoseTime=time;mobileVirgataPoseCurrent=state.current;mobileVirgataPose=points;}
  return points;
}

function drawVirgata(time) {
  const lit=lightStrength();
  const points=getVirgataPose(time);
  const mobileLite=touchInputQuery.matches&&Math.min(width,height)<=620;
  ctx.save(); ctx.translate(1030,903);
  // The joined hierarchy is drawn first so it reads as trunk -> branch -> twig.
  if(mobileLite){
    // Mobile GPUs handle a few grouped paths much better than dozens of
    // separately blurred strokes. Grouping by level preserves the taper.
    for(let level=0;level<=6;level++){
      const levelPoints=points.filter(p=>p.node.level===level);
      if(!levelPoints.length)continue;
      const averageWidth=levelPoints.reduce((sum,p)=>sum+p.node.w,0)/levelPoints.length;
      ctx.strokeStyle=`rgba(232,235,216,${(.48+level*.035)*(.18+.82*lit)})`;
      ctx.lineWidth=averageWidth; ctx.lineCap='round';
      ctx.shadowColor=`rgba(126,207,219,${.22*lit})`; ctx.shadowBlur=3*lit;
      ctx.beginPath();
      levelPoints.forEach(p=>{
        ctx.moveTo(p.sx,p.sy);
        ctx.quadraticCurveTo(lerp(p.sx,p.x,.48)+(seeded(p.index+3000)-.5)*5,lerp(p.sy,p.y,.5),p.x,p.y);
      });
      ctx.stroke();
    }
  }else{
    points.forEach(p=>{
      setBioStroke(.54+p.node.level*.045,p.node.w);
      ctx.strokeStyle=`rgba(232,235,216,${(.48+p.node.level*.035)*(.18+.82*lit)})`;
      ctx.beginPath(); ctx.moveTo(p.sx,p.sy);
      ctx.quadraticCurveTo(lerp(p.sx,p.x,.48)+(seeded(p.index+3000)-.5)*5,lerp(p.sy,p.y,.5),p.x,p.y); ctx.stroke();
    });
  }
  // Dense, very short projections cling to each branch instead of becoming
  // coronata-like independent filaments.
  const flow=currentFactor();
  if(mobileLite){
    ctx.strokeStyle=`rgba(226,236,218,${.28+.2*lit})`;
    ctx.lineWidth=2.15; ctx.lineCap='round';
    ctx.shadowColor=`rgba(126,207,219,${.16*lit})`; ctx.shadowBlur=2*lit;
    ctx.beginPath();
  }
  points.forEach(p=>{
    const dx=p.x-p.sx,dy=p.y-p.sy,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
    const count=Math.max(5,Math.round(len/(mobileLite?19:13)));
    for(let j=1;j<count;j++){
      const u=j/count;
      const bx=lerp(p.sx,p.x,u),by=lerp(p.sy,p.y,u);
      const tipWave=Math.sin(time*.00048*flow+p.node.phase+j)*.7*flow;
      [-1,1].forEach((side,sideIndex)=>{
        if(seeded(p.index*71+j*3+sideIndex+3050)<(mobileLite?.22:.14))return;
        const spike=3.8+seeded(p.index*61+j*5+sideIndex+3080)*8.8;
        if(!mobileLite){setBioStroke(.31+.13*lit,(.55+seeded(j+p.index+sideIndex)*.32)*3);ctx.beginPath();}
        ctx.moveTo(bx,by); ctx.lineTo(bx+nx*spike*side+tipWave,by+ny*spike*side);
        if(!mobileLite)ctx.stroke();
      });
    }
    if(!mobileLite&&seeded(p.index+3130)>.57){
      ctx.fillStyle=`rgba(235,238,219,${.2+.42*lit})`;
      ctx.beginPath(); ctx.ellipse(p.x,p.y,1.6+seeded(p.index+3150)*2.2,2+seeded(p.index+3170)*2.4,0,0,TAU); ctx.fill();
    }
  });
  if(mobileLite){
    ctx.stroke();
    ctx.fillStyle=`rgba(235,238,219,${.2+.42*lit})`;
    points.forEach(p=>{
      if(seeded(p.index+3130)<=.57)return;
      ctx.beginPath(); ctx.ellipse(p.x,p.y,1.6+seeded(p.index+3150)*2.2,2+seeded(p.index+3170)*2.4,0,0,TAU); ctx.fill();
    });
  }
  ctx.fillStyle=`rgba(226,229,212,${.26+.42*lit})`; ctx.beginPath(); ctx.ellipse(0,3,18,7,-.12,0,TAU); ctx.fill();
  ctx.restore();
}

function spawnCreature() {
  const pools = [
    ['fish','jelly','shrimp'],
    ['ratfish','jelly','siphon'],
    ['fish','comb','siphon'],
    ['ratfish','jelly','shrimp'],
    ['fish','comb','jelly']
  ];
  let kind=pools[state.camera][Math.floor(Math.random()*pools[state.camera].length)];
  if(Math.random()<.035) kind='large';
  creatures.push({kind,x:-260,y:height*(.18+Math.random()*.42),speed:9+Math.random()*13,age:0,phase:Math.random()*TAU});
  nextCreatureAt=state.elapsed+eventDelay(eventTiming.creatureRepeat);
}

function updateCreatures(dt) {
  if(state.elapsed>nextCreatureAt) spawnCreature();
  creatures.forEach(c=>{c.age+=dt; c.x+=c.speed*dt*(width/1920);});
  creatures=creatures.filter(c=>c.x<width+500);
}

function drawCreatures(time) {
  const alpha=state.light?.055:.11;
  creatures.forEach(c=>{
    ctx.save(); ctx.translate(c.x,c.y); ctx.scale(width/1920,width/1920); ctx.translate(0,Math.sin(c.age*.7+c.phase)*8);
    ctx.fillStyle=`rgba(53,80,89,${alpha})`; ctx.strokeStyle=`rgba(70,105,115,${alpha*.8})`; ctx.lineWidth=2;
    if(c.kind==='jelly'||c.kind==='comb'){
      ctx.beginPath(); ctx.ellipse(0,0,36,27,0,Math.PI,TAU); ctx.quadraticCurveTo(0,13,-36,0); ctx.fill();
      for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(i*12,2);ctx.quadraticCurveTo(i*15+Math.sin(time*.001+i)*8,42,i*10,72);ctx.stroke();}
    } else if(c.kind==='siphon'){
      ctx.beginPath(); ctx.moveTo(-130,0); for(let i=0;i<13;i++)ctx.quadraticCurveTo(-110+i*20,Math.sin(i+c.age)*9,-90+i*20,0); ctx.stroke();
    } else if(c.kind==='shrimp'){
      ctx.beginPath(); ctx.ellipse(0,0,18,6,0,0,TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-16,0); ctx.quadraticCurveTo(-32,14,-38,-2); ctx.stroke();
    } else {
      const size=c.kind==='large'?4.2:1; ctx.scale(size,size);
      ctx.beginPath(); ctx.ellipse(0,0,58,18,0,0,TAU); ctx.lineTo(-92,-32); ctx.lineTo(-80,0); ctx.lineTo(-92,30); ctx.closePath(); ctx.fill();
      if(c.kind==='ratfish'){ctx.beginPath();ctx.moveTo(52,0);ctx.quadraticCurveTo(100,4,168,15);ctx.stroke();}
    }
    ctx.restore();
  });
}

function toScreenPoint(x,y) {
  const s=worldScale();
  const origin=worldOrigin(s);
  return {x:origin.x+x*s,y:origin.y+y*s};
}

function feedCatchCandidates(camera) {
  const points=[];
  if(camera===0) {
    const vanes=[
      {dx:-82,dy:-205,length:302,count:15,bend:-9},
      {dx:238,dy:116,length:262,count:16,bend:13},
      {dx:-382,dy:-30,length:286,count:19,bend:-20},
      {dx:414,dy:-8,length:306,count:20,bend:-18}
    ];
    vanes.forEach((v,vi)=>{
      for(let i=2;i<v.count-1;i+=3) {
        const edgeU=i/(v.count-1);
        const u=clamp(edgeU+(seeded(i+vi*61)-.5)*.018,0,1);
        const bx=1040+v.dx*u;
        const by=844+v.dy*u+v.bend*Math.sin(u*Math.PI);
        const len=34+Math.pow(1-u,.76)*v.length+(seeded(i+vi*77)-.5)*15;
        const along=.28+seeded(i+1660+vi*20)*.68;
        points.push(toScreenPoint(bx,by-len*along));
      }
    });
  } else if(camera===1) {
    const bulbs=[[-108,-128],[-15,-168],[72,-119],[151,-42],[113,53],[34,128],[-139,20],[-48,44],[49,38]];
    const hubX=930,hubY=275;
    bulbs.forEach(([bx,by],i)=>{
      const along=.18+seeded(i+1710)*.78;
      points.push({...toScreenPoint(hubX+bx*along,hubY+by*along),follow:'lamp',bx,by,i,along});
    });
  } else if(camera===2) {
    const stemX=u=>Math.sin(u*3.1)*5.5;
    for(let i=3;i<108;i+=7) {
      const u=.04+seeded(i+330)*.9;
      const y=-42-u*552, sx=stemX(u), angle=seeded(i+721)*TAU;
      const side=Math.cos(angle)<0?-1:1;
      const len=(24+Math.pow(u,1.42)*205)*(.72+seeded(i+912)*.52);
      const projection=(.42+Math.abs(Math.cos(angle))*.58)*side;
      const rise=(seeded(i+117)-.5)*30-Math.sin(angle)*18;
      const along=.58+seeded(i+1780)*.34;
      points.push(toScreenPoint(1050+sx+projection*len*along,874+y+rise*along));
    }
    [1,4,7,11,14,17].forEach(i=>{
      const a=Math.PI+(i/18)*Math.PI;
      const sx=Math.cos(a)*34.5, sy=-29+Math.sin(a)*6.5;
      const len=20+seeded(i+510)*31, spread=(i-9)/9;
      const horizontalReach=spread*len*1.15;
      const verticalReach=len*(.48+.22*(1-Math.abs(spread)));
      points.push(toScreenPoint(1050+stemX(1)+sx+horizontalReach*.86,874-650+sy-verticalReach*.86));
    });
  } else if(camera===3) {
    grandisBulbs.forEach((item,i)=>{
      const pose=grandisBulbPose(item,i,state.lastTime);
      points.push({...toScreenPoint(1040+pose.x,900+pose.y),follow:'grandis',i,localRadius:item.radius*.72});
    });
  } else {
    const pose=getVirgataPose(state.lastTime);
    pose.forEach(p=>{
      const length=Math.hypot(p.x-p.sx,p.y-p.sy);
      const steps=Math.max(2,Math.ceil(length/25));
      for(let j=1;j<=steps;j++){
        const along=j/(steps+1);
        points.push({...toScreenPoint(1030+lerp(p.sx,p.x,along),903+lerp(p.sy,p.y,along)),follow:'virgata',i:p.index,along,localRadius:13});
      }
    });
  }
  return points;
}

function resolveCatchTarget(target,time=state.lastTime) {
  if(!target||!target.follow)return target;
  if(target.follow==='lamp'){
    const flow=currentFactor();
    const stemLean=Math.sin(time*.00027*flow)*15*flow;
    const lag=Math.sin(time*.00027*flow-target.i*.16)*9*flow;
    const hubY=-610,tipY=hubY+target.by+Math.sin(time*.00034+target.i)*2;
    const controlX=stemLean+target.bx*.48+lag*.2;
    const controlY=hubY+target.by*.5;
    const tipX=stemLean+target.bx+lag;
    const t=target.along,m=1-t;
    const x=m*m*stemLean+2*m*t*controlX+t*t*tipX;
    const y=m*m*hubY+2*m*t*controlY+t*t*tipY;
    return {...target,...toScreenPoint(930+x,885+y)};
  }
  if(target.follow==='grandis'){
    const pose=grandisBulbPose(grandisBulbs[target.i],target.i,time);
    return {...target,...toScreenPoint(1040+pose.x,900+pose.y),catchRadius:Math.max(6,target.localRadius*worldScale())};
  }
  const pose=getVirgataPose(time)[target.i];
  const t=target.along,m=1-t;
  const controlX=lerp(pose.sx,pose.x,.48)+(seeded(pose.index+3000)-.5)*5;
  const controlY=lerp(pose.sy,pose.y,.5);
  const x=m*m*pose.sx+2*m*t*controlX+t*t*pose.x;
  const y=m*m*pose.sy+2*m*t*controlY+t*t*pose.y;
  return {...target,...toScreenPoint(1030+x,903+y),catchRadius:Math.max(6,target.localRadius*worldScale())};
}

function spawnFeed(count,ambient=false) {
  if(feed.length>0)return false;
  const candidates=feedCatchCandidates(state.camera);
  candidates.forEach(target=>Object.assign(target,resolveCatchTarget(target)));
  for(let i=candidates.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  const allPass=Math.random()<(ambient ? .55 : .32);
  const maxCatch=Math.min(ambient ? 1 : 3,count,candidates.length);
  const catchCount=allPass||maxCatch===0 ? 0 : 1+Math.floor(Math.random()*maxCatch);
  const catchSlots=Array.from({length:count},(_,i)=>i);
  for(let i=catchSlots.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[catchSlots[i],catchSlots[j]]=[catchSlots[j],catchSlots[i]];}
  const assigned=new Map(catchSlots.slice(0,catchCount).map((slot,i)=>[slot,candidates[i]]));
  const targetY=[height*.55,height*.43,height*.49,height*.47,height*.46][state.camera];
  for(let i=0;i<count;i++){
    const x=-20-Math.random()*150,catchTarget=assigned.get(i)||null;
    const y=catchTarget?catchTarget.y+(catchTarget.x-x)*.08+(Math.random()-.5)*7:targetY+(Math.random()-.5)*height*.3;
    feed.push({x,y,z:.5+Math.random()*.5,age:0,caught:false,catchTarget,phase:Math.random()*TAU,fade:1});
  }
  return true;
}

function addFeed() {
  if(!spawnFeed(5+Math.floor(Math.random()*3)))return;
  nextAmbientFeedAt=Math.max(nextAmbientFeedAt,state.elapsed+120+Math.random()*180);
  audio.feedPulse();
}

function updateFeed(dt) {
  if(state.elapsed>=nextAmbientFeedAt) {
    if(spawnFeed(1+Math.floor(Math.random()*3),true))nextAmbientFeedAt=state.elapsed+180+Math.random()*300;
    else nextAmbientFeedAt=state.elapsed+35+Math.random()*45;
  }
  const speed=(33+state.current*23)*(width/1920);
  feed.forEach(f=>{
    f.age+=dt;
    const target=resolveCatchTarget(f.catchTarget);
    if(!f.caught){
      f.x+=speed*dt; f.y-=speed*.08*dt+Math.sin(f.age*2+f.phase)*.1;
      const catchRadius=target?.catchRadius||Math.max(7,30*worldScale());
      if(target&&f.x>=target.x-catchRadius&&f.x<=target.x+Math.max(catchRadius,speed*dt+8)&&Math.abs(f.y-target.y)<catchRadius){
        f.caught=true; f.caughtAt=f.age; f.x=target.x; f.y=target.y;
      }
    } else {
      const elapsed=f.age-f.caughtAt;
      const motion=clamp(1-elapsed/25,.12,1);
      f.x=target.x+Math.sin(f.age*2.7+f.phase)*1.7*motion;
      f.y=target.y+Math.cos(f.age*2.1+f.phase)*.9*motion;
      if(elapsed>34) f.fade=clamp(1-(elapsed-34)/12,0,1);
    }
  });
  feed=feed.filter(f=>f.x<width+80&&f.fade>0);
}

function drawFeed() {
  feed.forEach(f=>{
    const alpha=f.fade*(.2+.7*lightStrength());
    ctx.save(); ctx.translate(f.x,f.y); ctx.rotate(-.1+Math.sin(f.age*1.6+f.phase)*.35);
    ctx.strokeStyle=`rgba(210,223,214,${alpha})`; ctx.fillStyle=`rgba(158,174,165,${alpha})`; ctx.lineWidth=1;
    ctx.beginPath(); ctx.ellipse(0,0,5*f.z,2.5*f.z,0,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-4*f.z,0); ctx.quadraticCurveTo(-11*f.z,5*f.z,-14*f.z,1*f.z); ctx.stroke();
    for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(i*2,1);ctx.lineTo(i*3+2,6*f.z);ctx.stroke();}
    ctx.restore();
  });
}

function updateSnow(dt) {
  const f=currentFactor();
  snow.forEach(p=>{
    const layerSpeed=[.48,.92,1.52][p.layer];
    p.x+=dt*(9+p.z*25)*f*layerSpeed;
    p.y+=dt*(7+p.z*19)*f*layerSpeed;
    const margin=p.layer===2?36:20;
    if(p.x>width+margin)p.x=-margin;
    if(p.y>height+margin)p.y=-margin;
  });
}

function drawSnow(time,layer) {
  const lit=lightStrength();
  const variation=.86+Math.sin(state.elapsed*.018)*.12+Math.sin(state.elapsed*.006)*.08;
  snow.forEach((p,i)=>{
    if(p.layer!==layer)return;
    if(seeded(i+Math.floor(state.elapsed/80))>variation) return;
    const x=p.x+Math.sin(time*.0003+p.drift)*(4+p.z*8);
    const alpha=([.032,.075,.13][layer]+p.z*[.07,.12,.2][layer])*(.18+.82*lit);
    const scale=[.58,1,1.62][layer];
    ctx.fillStyle=`rgba(214,233,229,${alpha})`; ctx.beginPath();
    if(p.shape>.8)ctx.ellipse(x,p.y,(.45+p.z*2.4)*scale,(.25+p.z*.75)*scale,p.drift,0,TAU);
    else ctx.arc(x,p.y,(.28+p.z*1.45)*scale,0,TAU);
    ctx.fill();
  });
}

function drawLightFalloff() {
  if(!state.light)return;
  const lx=width*[.54,.47,.56,.54,.56][state.camera], ly=height*.54;
  ctx.save();
  ctx.globalCompositeOperation='screen';
  const glow=ctx.createRadialGradient(lx,ly,Math.min(width,height)*.04,lx,ly,Math.max(width,height)*.5);
  glow.addColorStop(0,'rgba(142,187,194,.075)'); glow.addColorStop(.48,'rgba(70,122,134,.028)'); glow.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=glow; ctx.fillRect(0,0,width,height);
  ctx.globalCompositeOperation='source-over';
  const edge=ctx.createRadialGradient(lx,ly,Math.min(width,height)*.13,lx,ly,Math.max(width,height)*.72);
  edge.addColorStop(0,'rgba(0,2,5,0)'); edge.addColorStop(.48,'rgba(0,3,6,.05)'); edge.addColorStop(1,'rgba(0,2,5,.42)');
  ctx.fillStyle=edge; ctx.fillRect(0,0,width,height);
  ctx.restore();
}

function drawSignalDegradation(time) {
  if(!state.signalDegraded)return;
  const frame=Math.floor(time/92);
  const flicker=.009+seeded(frame+3300)*.016;
  ctx.save();
  ctx.fillStyle=`rgba(150,170,169,${flicker})`; ctx.fillRect(0,0,width,height);
  const lines=state.reducedMotion?5:11;
  for(let i=0;i<lines;i++){
    const y=seeded(frame*17+i+3320)*height;
    const h=.5+seeded(frame*13+i+3340)*1.8;
    ctx.fillStyle=`rgba(205,215,207,${.012+seeded(i+3360)*.018})`;
    ctx.fillRect(0,y,width,h);
  }
  const specks=state.reducedMotion?28:72;
  ctx.fillStyle='rgba(210,219,211,.035)';
  for(let i=0;i<specks;i++){
    const x=seeded(frame*29+i+3380)*width,y=seeded(frame*31+i+3410)*height;
    ctx.fillRect(x,y,.5+seeded(i+3430)*1.4,.5+seeded(i+3450)*.8);
  }
  ctx.restore();
}

function setSignalDegraded(active) {
  state.signalDegraded=active;
  els.observation.classList.toggle('degraded',active);
  els.linkState.textContent=active?'SIGNAL DEGRADED':'STABLE';
}

function endSignalDegradation(postpone=false) {
  if(state.signalDegraded){setSignalDegraded(false);audio.stopSignalNoise();}
  signalDegradeEndsAt=0;
  nextSignalDegradeAt=state.elapsed+eventDelay(postpone?eventTiming.signalAfterSwitch:eventTiming.signalRepeat);
}

function updateSignalDegradation() {
  if(state.signalDegraded){
    if(state.elapsed>=signalDegradeEndsAt)endSignalDegradation();
    return;
  }
  if(!state.switching&&state.elapsed>=nextSignalDegradeAt){
    const duration=5+Math.random()*5;
    signalDegradeEndsAt=state.elapsed+duration;
    nextSignalDegradeAt=Infinity;
    setSignalDegraded(true);
    audio.signalNoise(duration);
  }
}

function render(time) {
  drawWater(); drawDistantGlow(); drawCreatures(time); drawSnow(time,0);
  beginWorldTransform();
  if(state.camera===0)drawLyraFloor();
  else if(state.camera===1)drawVolcanicFloor();
  else if(state.camera===2)drawSeamountFloor();
  else if(state.camera===3)drawGrandisFloor();
  else drawVirgataFloor();
  ctx.restore();
  drawMidwaterVeil(); drawSnow(time,1);
  beginWorldTransform();
  if(state.camera===0)drawLyra(time);
  else if(state.camera===1)drawLampadiglobus(time);
  else if(state.camera===2)drawCoronata(time);
  else if(state.camera===3)drawGrandis(time);
  else drawVirgata(time);
  ctx.restore();
  drawFeed(); drawSnow(time,2); drawLightFalloff(); drawSignalDegradation(time);
}

function tick(time) {
  const rawDt=Math.min((time-state.lastTime)/1000,.05);
  const dt=rawDt*(state.reducedMotion?.35:1);
  state.lastTime=time; state.elapsed+=rawDt;
  updateSnow(dt); updateFeed(rawDt); updateCreatures(rawDt); updateSignalDegradation(); render(time);
  requestAnimationFrame(tick);
}

class AmbientAudio {
  constructor(){this.context=null;this.master=null;this.volume=.6;this.baseGain=.113;this.signalLayer=null;}
  async on(){
    if(!this.context){
      this.context=new AudioContext(); this.master=this.context.createGain(); this.master.gain.value=this.baseGain*this.volume; this.master.connect(this.context.destination);
      const seconds=3,buffer=this.context.createBuffer(1,this.context.sampleRate*seconds,this.context.sampleRate),data=buffer.getChannelData(0);
      let last=0; for(let i=0;i<data.length;i++){const white=Math.random()*2-1;last=last*.985+white*.015;data[i]=last*.72;}
      const noise=this.context.createBufferSource(); noise.buffer=buffer; noise.loop=true;
      const filter=this.context.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=310; noise.connect(filter); filter.connect(this.master); noise.start();
      const hum=this.context.createOscillator(); hum.type='sine'; hum.frequency.value=43; const hg=this.context.createGain(); hg.gain.value=.06; hum.connect(hg); hg.connect(this.master); hum.start();
    }
    await this.context.resume(); this.master.gain.setTargetAtTime(this.baseGain*this.volume,this.context.currentTime,.4);
  }
  off(){if(this.context)this.master.gain.setTargetAtTime(0,this.context.currentTime,.28);}
  setVolume(value){
    this.volume=clamp(value,0,1);
    if(this.context&&state.sound)this.master.gain.setTargetAtTime(this.baseGain*this.volume,this.context.currentTime,.08);
  }
  pulse(freq,duration=.12,volume=.04){
    if(!this.context||!state.sound)return;
    const now=this.context.currentTime,o=this.context.createOscillator(),g=this.context.createGain(); o.type='sine'; o.frequency.setValueAtTime(freq,now); o.frequency.exponentialRampToValueAtTime(freq*.62,now+duration); g.gain.setValueAtTime(volume,now); g.gain.exponentialRampToValueAtTime(.0001,now+duration); o.connect(g); g.connect(this.master); o.start(now); o.stop(now+duration);
  }
  noiseBurst(){
    if(!this.context||!state.sound)return;
    const duration=.085,length=Math.ceil(this.context.sampleRate*duration);
    const buffer=this.context.createBuffer(1,length,this.context.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/length,1.7);
    const source=this.context.createBufferSource(),filter=this.context.createBiquadFilter(),gain=this.context.createGain(),now=this.context.currentTime;
    source.buffer=buffer; filter.type='bandpass'; filter.frequency.value=1650; filter.Q.value=.72;
    gain.gain.setValueAtTime(.13,now); gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start(now);
  }
  signalNoise(duration){
    if(!this.context||!state.sound)return;
    this.stopSignalNoise();
    const length=Math.ceil(this.context.sampleRate*duration),buffer=this.context.createBuffer(1,length,this.context.sampleRate),data=buffer.getChannelData(0);
    let last=0;
    for(let i=0;i<length;i++){
      const white=Math.random()*2-1; last=last*.78+white*.22;
      const edge=Math.min(1,i/(this.context.sampleRate*.38),(length-i)/(this.context.sampleRate*.42));
      data[i]=last*.23*clamp(edge,0,1);
    }
    const source=this.context.createBufferSource(),filter=this.context.createBiquadFilter(),gain=this.context.createGain(),now=this.context.currentTime;
    source.buffer=buffer; filter.type='bandpass'; filter.frequency.value=720; filter.Q.value=.38; gain.gain.value=.038;
    source.connect(filter); filter.connect(gain); gain.connect(this.master); this.signalLayer={source,gain};
    source.onended=()=>{if(this.signalLayer?.source===source)this.signalLayer=null;}; source.start(now);
  }
  stopSignalNoise(){
    if(!this.context||!this.signalLayer)return;
    const {source,gain}=this.signalLayer,now=this.context.currentTime;
    gain.gain.cancelScheduledValues(now); gain.gain.setTargetAtTime(0,now,.035);
    try{source.stop(now+.16);}catch{}
    this.signalLayer=null;
  }
  switchPulse(){this.noiseBurst();setTimeout(()=>this.pulse(760,.05,.026),72);}
  feedPulse(){this.pulse(145,.22,.08);setTimeout(()=>this.pulse(112,.16,.05),120);}
}
const audio=new AmbientAudio();

const els={
  observation:document.querySelector('#observation'),camTitle:document.querySelector('#cam-title'),species:document.querySelector('#species'),location:document.querySelector('#location'),depth:document.querySelector('#depth'),temperature:document.querySelector('#temperature'),currentValue:document.querySelector('#current-value'),siteTime:document.querySelector('#site-time'),siteZone:document.querySelector('#site-zone'),localTime:document.querySelector('#local-time'),localZone:document.querySelector('#local-zone'),signal:document.querySelector('#signal'),linkState:document.querySelector('#link-state'),controls:document.querySelector('.controls'),light:document.querySelector('#light-button'),current:document.querySelector('#current-button'),soundControl:document.querySelector('.sound-control'),sound:document.querySelector('#sound-button'),volume:document.querySelector('#volume-slider'),feed:document.querySelector('#feed-button')
};

function temperatureAt(cam,index) {
  const span=(cam.temperatureMax-cam.temperatureMin)*.5;
  const slow=Math.sin(state.elapsed/83+index*1.71)*.72+Math.sin(state.elapsed/211+index*.93)*.28;
  return clamp(cam.temperatureBase+slow*span,cam.temperatureMin,cam.temperatureMax).toFixed(1)+'°C';
}

function zoneOffsetMinutes(date,zone) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const values=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
  return (Date.UTC(values.year,values.month-1,values.day,values.hour,values.minute,values.second)-date.getTime())/60000;
}

function siteZoneLabel(cam,now) {
  if(!cam.zoneLabels)return cam.zoneLabel;
  const january=new Date(Date.UTC(now.getUTCFullYear(),0,15,12));
  return Math.abs(zoneOffsetMinutes(now,cam.zone)-zoneOffsetMinutes(january,cam.zone))>30?cam.zoneLabels[1]:cam.zoneLabels[0];
}

function updateTelemetry(){
  const cam=cameras[state.camera];
  els.camTitle.textContent=`CAM ${cam.id}`; els.species.textContent=cam.species; els.location.textContent=cam.location; els.depth.textContent=cam.depth; els.temperature.textContent=temperatureAt(cam,state.camera); els.currentValue.textContent=cam.currents[state.current]; els.siteZone.textContent=siteZoneLabel(cam,new Date());
  document.querySelectorAll('.cam-button').forEach((b,i)=>{b.classList.toggle('active',i===state.camera);b.setAttribute('aria-pressed',String(i===state.camera));});
}

function updateClocks(){
  const now=new Date();
  const time=(zone)=>new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(now);
  const localZone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  els.localTime.textContent=time(localZone);
  els.localZone.textContent=new Intl.DateTimeFormat('en',{timeZoneName:'short'}).formatToParts(now).find(p=>p.type==='timeZoneName')?.value||'LOCAL';
  const cam=cameras[state.camera];
  els.siteTime.textContent=time(cam.zone);
  els.siteZone.textContent=siteZoneLabel(cam,now);
  els.temperature.textContent=temperatureAt(cam,state.camera);
}

function switchCamera(index){
  if(index===state.camera||state.switching)return;
  endSignalDegradation(true);
  state.switching=true; els.signal.textContent=`CAM ${cameras[state.camera].id}  SIGNAL LOST`; els.signal.classList.remove('active'); void els.signal.offsetWidth; els.signal.classList.add('active'); audio.switchPulse();
  setTimeout(()=>{state.camera=index;feed=[];creatures=[];makeSnow();nextCreatureAt=state.elapsed+eventDelay(eventTiming.creatureAfterSwitch);nextAmbientFeedAt=state.elapsed+90+Math.random()*180;updateTelemetry();els.signal.textContent=`CAM ${cameras[index].id}  ONLINE`;},350);
  setTimeout(()=>{state.switching=false;els.signal.classList.remove('active');},740);
}

document.querySelectorAll('.cam-button').forEach(b=>b.addEventListener('click',()=>switchCamera(Number(b.dataset.camera))));
els.light.addEventListener('click',()=>{state.light=!state.light;els.light.querySelector('b').textContent=state.light?'ON':'OFF';els.light.setAttribute('aria-pressed',String(state.light));audio.pulse(state.light?420:250,.08,.04);});
els.current.addEventListener('click',()=>{state.current=(state.current+1)%3;els.current.querySelector('b').textContent=['LOW','MID','HIGH'][state.current];els.currentValue.textContent=cameras[state.camera].currents[state.current];audio.pulse(260+state.current*90,.08,.035);});
els.feed.addEventListener('click',addFeed);
let volumeHideTimer;
function setTouchVolumeOpen(open) {
  if(!touchInputQuery.matches)return;
  clearTimeout(volumeHideTimer);
  els.soundControl.classList.toggle('volume-open',open);
  els.sound.setAttribute('aria-expanded',String(open));
  if(open)volumeHideTimer=setTimeout(()=>setTouchVolumeOpen(false),4800);
}
els.sound.addEventListener('click',async()=>{
  state.sound=!state.sound;
  els.sound.setAttribute('aria-pressed',String(state.sound));
  els.sound.setAttribute('aria-label',`Sound ${state.sound?'on':'off'}`);
  setTouchVolumeOpen(true);
  if(state.sound)await audio.on();else audio.off();
});
els.volume.addEventListener('input',()=>{
  const value=Number(els.volume.value);
  els.volume.setAttribute('aria-valuetext',`${value}%`);
  audio.setVolume(value/100);
  setTouchVolumeOpen(true);
});
els.volume.addEventListener('pointerdown',()=>setTouchVolumeOpen(true),{passive:true});
document.addEventListener('pointerdown',event=>{
  if(touchInputQuery.matches&&!els.soundControl.contains(event.target))setTouchVolumeOpen(false);
},{passive:true});

// Mobile browsers can retain button focus after a tap, leaving the last
// control highlighted even after switching cameras. Release touch focus while
// preserving normal mouse and keyboard focus behaviour on desktop.
els.controls.addEventListener('touchend',event=>{
  const button=event.target.closest('button');
  if(button)requestAnimationFrame(()=>button.blur());
},{passive:true});

let idleTimer;
function wakeControls(){els.controls.classList.remove('idle');clearTimeout(idleTimer);idleTimer=setTimeout(()=>els.controls.classList.add('idle'),5200);}
['pointermove','pointerdown','keydown'].forEach(event=>window.addEventListener(event,wakeControls,{passive:true}));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)state.lastTime=performance.now();});

let resizeFrame=0;
function scheduleResize(){cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(resize);}
resize(); updateTelemetry(); updateClocks(); wakeControls();
window.addEventListener('resize',scheduleResize,{passive:true});
if(window.visualViewport)window.visualViewport.addEventListener('resize',scheduleResize,{passive:true});
window.addEventListener('orientationchange',()=>{scheduleResize();setTimeout(scheduleResize,180);},{passive:true});
setInterval(updateClocks,1000);
requestAnimationFrame(tick);
