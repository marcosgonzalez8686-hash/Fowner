# Fowner ⚽🏟️

Juego de gestión de fútbol para móvil en el que **eres el dueño del club**.

Empiezas con un club humilde en la última de **5 divisiones de 20 equipos** (liga a ida y vuelta, 38 jornadas,
3 ascensos y 3 descensos) y tu objetivo es llevarlo a Primera sin arruinarlo.

## La idea: tú decides cuánto delegas

Como presidente controlas siempre el dinero: estadio, precio de las entradas, instalaciones y límites de gasto.
La parte deportiva puedes llevarla tú o contratar un **director deportivo** y decidir, tarea a tarea, cómo trabaja:

| Tarea | 🧑‍💼 Manual | ✅ Propone y apruebo | 🤖 Automático |
|---|---|---|---|
| Fichajes | Fichas tú en Mercado | Te propone y tú decides | Ficha él solo |
| Ventas | Vendes tú | Te propone | Vende él solo |
| Renovaciones | Renuevas tú | Te propone | Renueva él solo |
| Cantera | Subes tú a los juveniles | Te propone | Decide él |

Cada director tiene **calidad (1-5 ★)**, que influye en lo bien que valora a los jugadores y en cómo negocia,
y un **estilo** (equilibrado, ahorrador, cantera, estrellas). Los buenos son caros.

## Tecnología (coste cero)

- React + TypeScript + Vite, sin servidor ni base de datos.
- La partida se guarda en el propio móvil (`localStorage`).
- Es una PWA: se puede "instalar" en la pantalla de inicio y funciona sin conexión.
- Todos los clubes, pueblos y jugadores son ficticios.

## Desarrollo

```bash
npm install
npm run dev        # servidor local (abre la URL de "Network" desde el móvil en la misma wifi)
npm run build      # genera dist/
npm test           # simula varias temporadas sin interfaz: npm test -- auto 5  |  npm test -- manual 3
```

## Publicarlo gratis

Cualquiera de estos sirve con el plan gratuito y repositorio privado:

- **Netlify** o **Cloudflare Pages**: conectar el repo, comando `npm run build`, carpeta `dist`.
- **Vercel**: importar el repo; detecta Vite solo.

(GitHub Pages solo es gratis si el repositorio es público.)

## Estructura

```
src/game/      motor del juego (sin React): generación, partidos, temporada, mercado, director deportivo
src/screens/   pantallas: Inicio, Liga, Plantilla, Mercado, Club, Director
scripts/       simulador por consola para probar el equilibrio
```
