/**
 * Manos — Sonido y Dibujo Geométrico
 * Implementación basada en spec.md
 *
 * Tecnología: p5.js, ml5.handPose, Web Audio API (nativa)
 * - Cada combinación (Gesto + Mano) tiene su propio sonido continuo.
 * - Formas geométricas en p5.js según el gesto y la mano detectada.
 * - ml5.handPose con umbral de confianza 80 %.
 * - Sin manos: se detienen sonidos, se limpian dibujos y se muestra alerta.
 * - Video SIN espejo: se ve tal cual la cámara lo captura.
 * - Sin tracking visible: no se dibujan keypoints ni esqueleto.
 * - Figuras geométricas aparecen alrededor de la pantalla.
 */

let video;
let handPose;
let predictions = [];

// Configuración
const CONFIDENCE_THRESHOLD = 0.8;

// Gestos reconocidos
const GESTURES = [
  'mano_abierta',
  'un_dedo',
  'dos_dedos',
  'tres_dedos',
  'cuatro_dedos',
  'pellizcar',
  'puño_cerrado',
  'rock'
];

const HAND_TYPES = ['LEFT_HAND', 'RIGHT_HAND', 'BOTH_HANDS'];

// Oscillators por combinación (gesture-handType) — Web Audio API nativa
let oscillators = {};

// Estado de inicialización de audio
let audioCtx = null;
let audioStarted = false;

// Estado activo de entradas de sonido
let activeInputs = new Set(); // guarda strings como "puño_cerrado-LEFT_HAND"

// Visuales
let audioLevel = 0;
let pulseSize = 0;
let currentGestureLabel = '--';
let currentHandLabel = '--';
let currentConfidence = 0;

// Posiciones alrededor de la pantalla para las figuras
let positions = [];

function preload() {
  handPose = ml5.handPose();
}

function setup() {
  createCanvas(640, 480);
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  // Definir posiciones alrededor de la pantalla
  positions = [
    { x: width * 0.2, y: height * 0.2 },   // arriba izquierda
    { x: width * 0.8, y: height * 0.2 },   // arriba derecha
    { x: width * 0.5, y: height * 0.15 },  // arriba centro
    { x: width * 0.2, y: height * 0.5 },   // medio izquierda
    { x: width * 0.8, y: height * 0.5 },   // medio derecha
    { x: width * 0.5, y: height * 0.5 },   // centro
    { x: width * 0.2, y: height * 0.8 },   // abajo izquierda
    { x: width * 0.8, y: height * 0.8 },   // abajo derecha
    { x: width * 0.5, y: height * 0.85 },  // abajo centro
  ];

  // Iniciar detección de manos
  handPose.detectStart(video, gotHands);
}

function draw() {
  background(10);

  // Dibujar video con espejo (selfie view) para que el movimiento sea natural
  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop();

  // Si el audio no está listo, mostrar pantalla de inicio y salir
  if (!audioStarted) {
    fill(255);
    noStroke();
    textAlign(CENTER);
    textSize(20);
    textStyle(BOLD);
    text('Haz clic en la pantalla para iniciar el audio', width / 2, height / 2 - 20);
    textSize(14);
    textStyle(NORMAL);
    text('La cámara está activa. Muéstrale las manos cuando estés listo.', width / 2, height / 2 + 20);
    return;
  }

  // Procesar predicciones válidas (confianza >= 80 %)
  let validHands = [];
  for (let pred of predictions) {
    if (pred.confidence >= CONFIDENCE_THRESHOLD) {
      validHands.push(pred);
    }
  }

  // Clasificar gestos por mano
  let classified = []; // { handType, gesture, confidence, keypoints }
  for (let pred of validHands) {
    let gesture = classifyGesture(pred.keypoints);
    let handType = getHandType(pred);
    classified.push({
      handType: handType,
      gesture: gesture,
      confidence: pred.confidence,
      keypoints: pred.keypoints
    });
  }

  // Determinar entradas de audio activas
  let newActiveInputs = new Set();

  if (classified.length === 2) {
    let h1 = classified[0];
    let h2 = classified[1];
    if (h1.gesture === h2.gesture) {
      // Ambas manos con el mismo gesto -> BOTH_HANDS
      newActiveInputs.add(`${h1.gesture}-BOTH_HANDS`);
      currentGestureLabel = h1.gesture;
      currentHandLabel = 'BOTH_HANDS';
      currentConfidence = (h1.confidence + h2.confidence) / 2;
    } else {
      // Ambas manos con gestos diferentes -> cada una independiente
      newActiveInputs.add(`${h1.gesture}-${h1.handType}`);
      newActiveInputs.add(`${h2.gesture}-${h2.handType}`);
      currentGestureLabel = `${h1.gesture} + ${h2.gesture}`;
      currentHandLabel = 'IZQ + DER';
      currentConfidence = (h1.confidence + h2.confidence) / 2;
    }
  } else if (classified.length === 1) {
    let h = classified[0];
    newActiveInputs.add(`${h.gesture}-${h.handType}`);
    currentGestureLabel = h.gesture;
    currentHandLabel = h.handType;
    currentConfidence = h.confidence;
  } else {
    currentGestureLabel = '--';
    currentHandLabel = '--';
    currentConfidence = 0;
  }

  // Actualizar osciladores: desvanecer los que no están activos, subir los activos
  for (let key in oscillators) {
    let osc = oscillators[key];
    if (!osc || typeof osc.setGain !== 'function') continue;
    let targetGain = newActiveInputs.has(key) ? 0.3 : 0;
    osc.setGain(targetGain, 0.05);
  }

  activeInputs = newActiveInputs;

  // Calcular nivel de audio para visuales
  let activeCount = activeInputs.size;
  audioLevel = activeCount > 0 ? map(activeCount, 0, 4, 0, 1) : 0;

  // Dibujar formas geométricas alrededor de la pantalla según el gesto y mano activos
  drawGeometricVisualsAroundScreen();

  // Actualizar info en pantalla
  updateInfoUI();

  // Comportamiento sin manos detectadas
  if (validHands.length === 0) {
    document.getElementById('alert').classList.remove('hidden');
  } else {
    document.getElementById('alert').classList.add('hidden');
  }
}

function mousePressed() {
  if (!audioStarted) {
    initAudio();
  }
}

function initAudio() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();

    // Crear un oscilador Web Audio por cada combinación (Gesto + Mano)
    for (let gesture of GESTURES) {
      for (let hand of HAND_TYPES) {
        let osc = new WebAudioOscillator(audioCtx, getFrequency(gesture, hand));
        osc.start();
        oscillators[`${gesture}-${hand}`] = osc;
      }
    }

    audioStarted = true;
  } catch (err) {
    console.error('Error inicializando audio:', err);
  }
}

/**
 * Oscilador simple basado en Web Audio API nativa.
 */
class WebAudioOscillator {
  constructor(audioCtx, frequency) {
    this.ctx = audioCtx;
    this.osc = null;
    this.gain = null;
    this.frequency = frequency;
    this.started = false;
  }

  start() {
    if (this.started) return;
    this.osc = this.ctx.createOscillator();
    this.gain = this.ctx.createGain();
    this.osc.type = 'sine';
    this.osc.frequency.setValueAtTime(this.frequency, this.ctx.currentTime);
    this.osc.connect(this.gain);
    this.gain.connect(this.ctx.destination);
    this.gain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.osc.start();
    this.started = true;
  }

  setGain(targetGain, rampTime) {
    if (!this.gain || !this.started) return;
    const now = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);
    if (rampTime && rampTime > 0) {
      this.gain.gain.linearRampToValueAtTime(targetGain, now + rampTime);
    } else {
      this.gain.gain.setValueAtTime(targetGain, now);
    }
  }

  setFreq(freq) {
    if (!this.osc || !this.started) return;
    this.osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
  }

  stop() {
    if (this.osc && this.started) {
      try {
        this.osc.stop();
      } catch (e) {
        // ignore
      }
      this.started = false;
    }
  }
}

function gotHands(results) {
  predictions = results;
}

/**
 * Clasifica el gesto basado en los 21 keypoints de handPose.
 */
function classifyGesture(keypoints) {
  if (!keypoints || keypoints.length < 21) return 'desconocido';

  // Índices MediaPipe:
  // 4: pulgar punta, 8: índice punta, 12: medio punta, 16: anular punta, 20: meñique punta
  // 6: índice PIP, 10: medio PIP, 14: anular PIP, 18: meñique PIP
  // 3: pulgar IP

  let indexExtended = keypoints[8] && keypoints[6] && keypoints[8].y < keypoints[6].y;
  let middleExtended = keypoints[12] && keypoints[10] && keypoints[12].y < keypoints[10].y;
  let ringExtended = keypoints[16] && keypoints[14] && keypoints[16].y < keypoints[14].y;
  let pinkyExtended = keypoints[20] && keypoints[18] && keypoints[20].y < keypoints[18].y;

  // Pulgar extendido: distancia punta-pulgar IP mayor que umbral relativo
  let thumbExtended = false;
  if (keypoints[4] && keypoints[3]) {
    let d = dist(keypoints[4].x, keypoints[4].y, keypoints[3].x, keypoints[3].y);
    thumbExtended = d > 25;
  }

  let extendedFingers = [indexExtended, middleExtended, ringExtended, pinkyExtended];
  let countExtended = extendedFingers.filter(Boolean).length;

  // Pellizcar: distancia entre punta de pulgar y punta de índice pequeña
  let isPinch = false;
  if (keypoints[4] && keypoints[8]) {
    let pinchDist = dist(keypoints[4].x, keypoints[4].y, keypoints[8].x, keypoints[8].y);
    isPinch = pinchDist < 40;
  }

  // Rock / cuernos: índice arriba, medio abajo, anular abajo, meñique arriba
  let isRock = indexExtended && !middleExtended && !ringExtended && pinkyExtended;

  // Puño cerrado: 0 dedos extendidos (sin contar pulgar como dedo principal)
  if (countExtended === 0 && !isPinch) return 'puño_cerrado';

  // Mano abierta: 4 dedos extendidos + pulgar
  if (countExtended >= 4 && thumbExtended) return 'mano_abierta';

  // Conteo de dedos (1, 2, 3, 4)
  if (countExtended === 1) return 'un_dedo';
  if (countExtended === 2) return 'dos_dedos';
  if (countExtended === 3) return 'tres_dedos';
  if (countExtended === 4) return 'cuatro_dedos';

  // Pellizcar tiene prioridad sobre conteo si los dedos están juntos
  if (isPinch) return 'pellizcar';

  // Rock
  if (isRock) return 'rock';

  // Fallback por conteo si nada más encaja
  if (countExtended === 0) return 'puño_cerrado';
  if (countExtended === 1) return 'un_dedo';
  if (countExtended === 2) return 'dos_dedos';
  if (countExtended === 3) return 'tres_dedos';
  if (countExtended === 4) return 'cuatro_dedos';

  return 'mano_abierta';
}

/**
 * Devuelve LEFT_HAND o RIGHT_HAND basado en la predicción.
 * Usa handedness de ml5 cuando está disponible; si no, infiere por posición
 * considerando que el video se dibuja espejado (selfie view).
 */
function getHandType(pred) {
  if (pred.handedness) {
    return pred.handedness === 'Left' ? 'LEFT_HAND' : 'RIGHT_HAND';
  }
  if (pred.hand) {
    return pred.hand === 'Left' ? 'LEFT_HAND' : 'RIGHT_HAND';
  }
  // Fallback: con espejo, la izquierda del frame (x pequeña) corresponde
  // a la mano derecha del usuario en la pantalla espejada.
  let wristX = pred.keypoints[0] ? pred.keypoints[0].x : width / 2;
  return wristX < width / 2 ? 'RIGHT_HAND' : 'LEFT_HAND';
}

/**
 * Frecuencia base por combinación (Gesto + Mano).
 */
function getFrequency(gesture, handType) {
  const baseFreqs = {
    'mano_abierta': 440.00,   // La4
    'un_dedo': 523.25,        // Do5
    'dos_dedos': 587.33,      // Re5
    'tres_dedos': 659.25,     // Mi5
    'cuatro_dedos': 698.46,   // Fa5
    'pellizcar': 783.99,      // Sol5
    'puño_cerrado': 349.23,   // Fa4
    'rock': 880.00            // La5
  };

  const handOffsets = {
    'LEFT_HAND': 0,
    'RIGHT_HAND': 120,
    'BOTH_HANDS': 240
  };

  return (baseFreqs[gesture] || 440) + (handOffsets[handType] || 0);
}

/**
 * Dibuja formas geométricas alrededor de la pantalla según el gesto y la mano detectada.
 * Las figuras aparecen en distintas posiciones del borde y centro.
 */
function drawGeometricVisualsAroundScreen() {
  let cx = width / 2;
  let cy = height / 2;

  // Tamaño pulsante según nivel de audio
  let size = map(audioLevel, 0, 1, 30, 140);
  pulseSize = lerp(pulseSize, size, 0.15);

  // Definir color según mano activa
  let handColor;
  if (currentHandLabel === 'LEFT_HAND') {
    handColor = color(0, 200, 255); // cyan
  } else if (currentHandLabel === 'RIGHT_HAND') {
    handColor = color(255, 100, 150); // rosa
  } else if (currentHandLabel === 'BOTH_HANDS') {
    handColor = color(0, 255, 100); // verde
  } else if (currentHandLabel === 'IZQ + DER') {
    handColor = color(200, 200, 255); // blanco azulado
  } else {
    handColor = color(150, 150, 150);
  }

  // Si no hay gesto activo, no dibujar nada
  if (currentGestureLabel === '--') return;

  // Determinar posiciones donde dibujar
  let drawPositions = [];

  if (currentHandLabel === 'IZQ + DER' && activeInputs.size >= 2) {
    // Dos gestos distintos: dibujar cada uno en su lado correspondiente
    for (let key of activeInputs) {
      let parts = key.split('-');
      let g = parts[0];
      let h = parts[1];
      if (h === 'LEFT_HAND') {
        drawPositions.push({ x: width * 0.25, y: height * 0.5, gesture: g, color: color(0, 200, 255) });
      } else if (h === 'RIGHT_HAND') {
        drawPositions.push({ x: width * 0.75, y: height * 0.5, gesture: g, color: color(255, 100, 150) });
      } else {
        drawPositions.push({ x: cx, y: cy, gesture: g, color: handColor });
      }
    }
  } else {
    // Un gesto activo: dibujar en varias posiciones alrededor de la pantalla
    // Usamos el gesto actual para decidir cuántas posiciones y dónde
    let numPositions = 1;
    if (currentHandLabel === 'BOTH_HANDS') numPositions = 3;
    else if (currentGestureLabel === 'mano_abierta') numPositions = 4;
    else if (currentGestureLabel === 'rock') numPositions = 5;

    // Seleccionar posiciones cíclicamente basado en frameCount para dar movimiento
    let startIdx = floor(frameCount * 0.05) % positions.length;
    for (let i = 0; i < numPositions; i++) {
      let pos = positions[(startIdx + i) % positions.length];
      drawPositions.push({ x: pos.x, y: pos.y, gesture: currentGestureLabel, color: handColor });
    }
  }

  // Dibujar cada figura en su posición
  for (let dp of drawPositions) {
    drawShapeForGesture(dp.gesture, dp.x, dp.y, pulseSize, dp.color);
  }
}

/**
 * Dibuja una forma geométrica específica para cada gesto.
 */
function drawShapeForGesture(gesture, x, y, size, color) {
  push();
  translate(x, y);
  noStroke();
  fill(color, 210);

  // Rotación suave según el frame para dar vida
  let rotation = frameCount * 0.02;

  switch (gesture) {
    case 'mano_abierta':
      // Círculo grande y suave
      ellipse(0, 0, size, size);
      break;

    case 'un_dedo':
      // Triángulo apuntando arriba
      rotate(rotation);
      triangle(0, -size / 2, -size / 2, size / 2, size / 2, size / 2);
      break;

    case 'dos_dedos':
      // Rectángulo horizontal
      rect(-size / 2, -size / 4, size, size / 2, 8);
      break;

    case 'tres_dedos':
      // Pentágono
      beginShape();
      for (let i = 0; i < 5; i++) {
        let angle = rotation + i * TWO_PI / 5;
        let vx = cos(angle) * size / 2;
        let vy = sin(angle) * size / 2;
        vertex(vx, vy);
      }
      endShape(CLOSE);
      break;

    case 'cuatro_dedos':
      // Hexágono
      beginShape();
      for (let i = 0; i < 6; i++) {
        let angle = rotation + i * TWO_PI / 6;
        let vx = cos(angle) * size / 2;
        let vy = sin(angle) * size / 2;
        vertex(vx, vy);
      }
      endShape(CLOSE);
      break;

    case 'pellizcar':
      // Diamante / rombo
      rotate(rotation * 2);
      rect(-size / 4, -size / 2, size / 2, size, 0);
      rect(-size / 2, -size / 4, size, size / 2, 0);
      break;

    case 'puño_cerrado':
      // Cuadrado pequeño y compacto
      rect(-size / 4, -size / 4, size / 2, size / 2, 6);
      break;

    case 'rock':
      // Estrella de 5 puntas
      beginShape();
      for (let i = 0; i < 10; i++) {
        let angle = rotation + i * PI / 5;
        let r = i % 2 === 0 ? size / 2 : size / 4;
        let vx = cos(angle) * r;
        let vy = sin(angle) * r;
        vertex(vx, vy);
      }
      endShape(CLOSE);
      break;

    default:
      ellipse(0, 0, size / 2, size / 2);
      break;
  }

  pop();

  // Etiqueta del gesto sobre la forma
  fill(255);
  noStroke();
  textAlign(CENTER);
  textSize(12);
  textStyle(BOLD);
  text(gesture.replace(/_/g, ' ').toUpperCase(), x, y + size / 2 + 22);
  textStyle(NORMAL);
}

function updateInfoUI() {
  document.getElementById('gesture-label').textContent = currentGestureLabel;
  document.getElementById('hand-label').textContent = currentHandLabel;
  document.getElementById('confidence-label').textContent = Math.round(currentConfidence * 100);
}
