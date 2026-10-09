// Política de privacidad: el mismo texto se muestra en el juego y en public/privacidad.html

export const APP_VERSION = '1.0.0';
export const PRIVACY_UPDATED = '9 de octubre de 2026';

export const PRIVACY: { title: string; body: string[] }[] = [
  {
    title: 'En resumen',
    body: [
      'Fowner no tiene cuentas de usuario y no recoge datos personales. Tus partidas se guardan solo en tu dispositivo.',
    ],
  },
  {
    title: 'Tus partidas',
    body: [
      'Las partidas (incluidos los nombres que escribes, como el tuyo o el de tu club) se guardan en el almacenamiento del navegador de tu dispositivo. No se envían a ningún servidor.',
      'Si guardas una copia en un archivo, ese archivo es tuyo: se queda donde lo guardes y nosotros no lo recibimos.',
      'Si borras los datos del navegador o desinstalas la aplicación, las partidas se pierden salvo que tengas una copia.',
    ],
  },
  {
    title: 'Estadísticas de uso',
    body: [
      'Para saber cuánta gente juega usamos GoatCounter, un servicio de estadísticas que no usa cookies ni identifica a las personas.',
      'Se cuenta cada visita y algunos eventos del juego (partida nueva y su dificultad, temporada cerrada, ascensos), junto con datos técnicos generales: país aproximado, tipo de navegador y dispositivo, tamaño de pantalla e idioma, y la página desde la que llegas.',
      'GoatCounter no guarda tu dirección IP ni crea perfiles. Puedes bloquearlo con cualquier bloqueador de contenidos y el juego funciona igual.',
    ],
  },
  {
    title: 'Publicidad y pagos',
    body: ['Esta versión no tiene publicidad ni pagos dentro del juego. Si se añaden, esta política se actualizará antes.'],
  },
  {
    title: 'Menores',
    body: ['El juego no pide ni recoge datos de nadie, tampoco de menores.'],
  },
  {
    title: 'Tus derechos y contacto',
    body: [
      'Como no guardamos datos personales tuyos, no hay datos que consultar, corregir o borrar en nuestros sistemas. Para cualquier duda sobre privacidad, escríbenos a través de la ficha del juego en la tienda o en la página donde lo descargaste.',
    ],
  },
];

export const ABOUT = [
  'Fowner es un juego de gestión en el que eres el dueño de un club de fútbol.',
  'Todos los clubes, jugadores, entrenadores y competiciones son inventados. Las ciudades reales se usan solo como nombres de lugar: el juego no tiene relación con ningún club, liga o federación real.',
];
