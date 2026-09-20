# PixelMaker

Herramienta web para convertir imágenes en pixel art, con un modo cámara que simula una Game Boy Camera en vivo desde la webcam.

Sin frameworks, sin build, sin dependencias. Todo es HTML/CSS/JS plano que corre directo en el navegador.

## Qué hace

- Subís una imagen o usás la cámara en vivo.
- Pixelado ajustable (tamaño de bloque).
- Paletas retro: Game Boy, PICO-8, CGA, C64, 1-bit.
- Dithering ordenado (Bayer), grid, scanlines, aberración cromática.
- Filtros básicos: brillo, contraste, saturación, gris, sepia, invertir.
- Modo cámara con "carrete" tipo Game Boy Camera (hasta 30 fotos) y descarga en PNG.
- En celular abre directo la cámara en vivo, con el look Game Boy puesto por defecto.
- Instalable como PWA y funciona offline.
- Toda la interfaz simula el cuerpo de una Game Boy: D-pad, botones A/B, Start/Select, y cualquiera de esos botones también dispara la foto.
- En mobile los ajustes se abren como un panel deslizable desde abajo.

## Cómo correrlo

Para el modo imagen alcanza con abrir `index.html` directo en el navegador.

Para el modo cámara hace falta https o localhost (el navegador bloquea la webcam en `file://`). Lo más simple:

```bash
python3 -m http.server 8000
```

y entrar a `http://localhost:8000`.

## Stack

HTML + CSS + JavaScript vanilla, nada de npm ni build.

- `index.html` — estructura
- `styles.css` — todo el estilo, incluido el chasis de Game Boy
- `app.js` — motor de pixelado (paletas, dithering, efectos) y modo imagen
- `camera.js` — modo cámara en vivo
