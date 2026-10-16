# Especificaciones del proyecto

## Funcionamiento general de la Aplicación

Aplicación interactiva de manos que genera sonidos continuos y dibujos relacionados en pantalla, con feedback visual de los gestos permitidos.

### Entrada

- Detección de manos mediante webcam usando ml5.
- El sistema reconoce gestos de dedos y la mano (o manos) que los realiza.
- Cada gesto se mantiene activo mientras el usuario sostenga la postura.

### Gestos permitidos (feedback en pantalla)

- Mano abierta
- 1 dedo
- 2 dedos
- 3 dedos
- 4 dedos
- Pellizcar
- Puño cerrado
- Índice arriba, dos dedos del medio abajo, meñique alzado (gesto "rock / cuernos")

### Entradas de audio independientes

- Mano derecha (`RIGHT_HAND`)
- Mano izquierda (`LEFT_HAND`)
- Ambas manos (`BOTH_HANDS`)

### Mapeo de sonido

- Cada combinación (**Gesto + Mano**) dispara un sonido diferente.
- El sonido suena de forma **continua** mientras se mantiene el gesto.
- Al soltar el gesto, el sonido se detiene.

### Salida visual

- Dibujos generados en p5.js relacionados con el sonido activo.
- Indicador en pantalla de los gestos permitidos y del gesto detectado actualmente.

## Tecnología

- **p5.js** — canvas, dibujos, bucle principal.
- **ml5** — detección de manos y reconocimiento de gestos.
- **Audio** — **p5.sound** (osciladores / sintetizador en tiempo real).

### Modelo de detección

- **ml5.handPose** — detecta 21 puntos clave por mano; usado para contar dedos y reconocer posturas de mano.

### Generación de sonidos

- **p5.sound** (osciladores / sintetizador en tiempo real).
- Cada combinación (**Gesto + Mano**) tiene su propio sonido.
- El sonido suena de forma continua mientras se mantiene el gesto.

### Estilo de los dibujos

- Dibujo abstracto generado en p5.js relacionado con el sonido activo.

### Umbral de confianza

- **80 %** de confianza mínimo para validar que un gesto fue detectado.

### Comportamiento sin manos detectadas

- Se detienen todos los sonidos activos.
- Se limpian los dibujos de la pantalla.
- Se muestra una alerta en pantalla indicando que no hay ninguna mano detectada.
