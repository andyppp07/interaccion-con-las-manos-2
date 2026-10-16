# Manos — Sonido y Dibujo Abstracto

Aplicación interactiva basada en las especificaciones de `spec.md`. Detecta gestos de manos con la webcam y genera sonidos continuos y formas geométricas en pantalla.

## Especificaciones implementadas

- **Tecnología:** p5.js, p5.sound, ml5.handPose
- **Entrada:** webcam, detección de 21 keypoints por mano
- **Gestos reconocidos:** mano abierta, 1 dedo, 2 dedos, 3 dedos, 4 dedos, pellizcar, puño cerrado, rock/cuernos
- **Entradas de audio independientes:** RIGHT_HAND, LEFT_HAND, BOTH_HANDS
- **Mapeo de sonido:** cada combinación (Gesto + Mano) tiene su propio sonido continuo con p5.sound
- **Dibujo:** formas geométricas en p5.js según el gesto y la mano activa
- **Umbral de confianza:** 80 % mínimo para validar un gesto
- **Sin manos:** se detienen sonidos, se limpian dibujos y se muestra alerta en pantalla

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `index.html` | Página principal, carga p5.js y ml5 |
| `sketch.js` | Lógica de la aplicación: detección, clasificación de gestos, audio, visuales |
| `style.css` | Estilos de la alerta y panel de información |
| `spec.md` | Especificaciones técnicas del proyecto |
| `README.md` | Este archivo |

## Cómo ejecutar

1. Abrí `index.html` en un navegador moderno.
2. Permití el acceso a la cámara cuando el navegador lo solicite.
3. Hacé clic en la pantalla para iniciar el audio (requisito del navegador).
4. Mostrá tus manos a la cámara y probá los gestos definidos.

## Notas de implementación

- Los sonidos son osciladores p5.sound (tipo `sine`) con frecuencias distintas por combinación (Gesto + Mano).
- El audio se desvanece suavemente al cambiar de gesto para evitar chasquidos.
- El video se muestra espejado (vista selfie) para que el movimiento sea natural.
- Si se detectan ambas manos con el mismo gesto, se usa la entrada `BOTH_HANDS`.
- El umbral de confianza es del 80 % para validar cada keypoint y cada mano.
