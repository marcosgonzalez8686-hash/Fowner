import { shuffle } from './rng';

// Ciudades y pueblos reales para los clubes: los de las categorías altas salen de las ciudades
// más grandes y los de las bajas, de las más pequeñas. Los nombres de club se forman con la
// ciudad y una fórmula (CD, Racing, Rovers...) evitando las combinaciones de clubes reales.

/** España por tamaño: una lista por categoría (de Primera a la última), de mayor a menor */
const ESPANA: string[][] = [
  // grandes ciudades
  ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Murcia', 'Palma', 'Las Palmas', 'Bilbao', 'Alicante',
    'Córdoba', 'Valladolid', 'Vigo', 'Gijón', "L'Hospitalet", 'Vitoria', 'A Coruña', 'Elche', 'Granada', 'Terrassa', 'Badalona'],
  // ciudades de 100.000 a 200.000 habitantes
  ['Sabadell', 'Madrid', 'Barcelona', 'Oviedo', 'Cartagena', 'Móstoles', 'Jerez', 'Pamplona', 'Santa Cruz de Tenerife', 'Almería', 'Alcalá de Henares',
    'Fuenlabrada', 'Leganés', 'San Sebastián', 'Getafe', 'Burgos', 'Albacete', 'Castellón', 'Santander', 'Alcorcón', 'La Laguna',
    'Logroño', 'Badajoz', 'Marbella', 'Salamanca', 'Huelva', 'Lleida', 'Tarragona', 'Dos Hermanas', 'Torrejón', 'Parla', 'Mataró'],
  // ciudades medianas
  ['León', 'Madrid', 'Valencia', 'Sevilla', 'Bilbao', 'Algeciras', 'Santa Coloma', 'Alcobendas', 'Cádiz', 'Jaén', 'Ourense', 'Reus', 'Telde', 'Barakaldo', 'Lugo', 'Girona',
    'Santiago', 'Cáceres', 'Lorca', 'Coslada', 'Talavera', 'El Puerto', 'Cornellà', 'Las Rozas', 'Orihuela', 'Avilés', 'Palencia',
    'Getxo', 'Guadalajara', 'Pozuelo', 'Torrevieja', 'Toledo', 'Pontevedra', 'Ponferrada', 'Zamora', 'Ferrol', 'Gandia',
    'Benidorm', 'Ciudad Real', 'Alcoy', 'Ávila'],
  // ciudades pequeñas y cabeceras de comarca
  ['Segovia', 'Cuenca', 'Huesca', 'Soria', 'Teruel', 'Mérida', 'Linares', 'Motril', 'Ronda', 'Plasencia', 'Don Benito', 'Villena',
    'Úbeda', 'Antequera', 'Lucena', 'Puertollano', 'Tomelloso', 'Valdepeñas', 'Alcázar', 'Aranda de Duero', 'Miranda de Ebro',
    'Tudela', 'Calahorra', 'Alzira', 'Xàtiva', 'Ontinyent', 'Sagunto', 'Elda', 'Manresa', 'Vic', 'Igualada', 'Figueres', 'Manacor',
    'Dénia', 'Tortosa', 'Yecla', 'Cieza', 'Hellín', 'Durango', 'Almansa', 'Ciutadella', 'Benavente', 'Monforte'],
  // pueblos
  ['Sigüenza', 'Cangas de Onís', 'Laredo', 'Potes', 'Cazorla', 'Aracena', 'Zafra', 'Trujillo', 'Almagro', 'Béjar', 'Peñafiel', 'Haro',
    'Tarazona', 'Jaca', 'Barbastro', 'Llanes', 'Ribadesella', 'Navia', 'Tineo', 'Sahagún', 'La Bañeza', 'Toro', 'Tordesillas',
    'Cuéllar', 'Arévalo', 'Piedrahíta', 'Hervás', 'Llerena', 'Olvera', 'Vejer', 'Nerja', 'Órgiva', 'Huéscar', 'Mula', 'Requena',
    'Morella', 'Segorbe', 'Sóller', 'Pollença', 'Ripoll', 'Puigcerdà', 'Solsona', 'Berga', 'Gandesa', 'Aínsa', 'Sabiñánigo', 'Caspe',
    'Daroca', 'Estella', 'Sangüesa', 'Tolosa', 'Bermeo', 'Laguardia', 'Medina de Pomar', 'Lerma', 'Almazán', 'Ágreda', 'Pastrana',
    'Brihuega', 'Belmonte', 'San Clemente', 'La Roda', 'Consuegra', 'Oropesa', 'Guadalupe', 'Coria', 'Olivenza', 'Comillas'],
];

const FORMAS_ESP = ['CD', 'UD', 'CF', 'SD', 'Atlético', 'Racing', 'Deportivo', 'Real', 'Unión', 'Sporting', 'Recreativo', 'Juventud', 'Club', 'Arenas', 'CP'];

/** Clubes reales que no queremos repetir tal cual */
const REALES = new Set([
  'Real Madrid', 'Atlético Madrid', 'Real Betis', 'Sevilla FC', 'Valencia CF', 'Real Zaragoza', 'Málaga CF', 'Real Murcia', 'RCD Mallorca',
  'UD Las Palmas', 'Athletic Bilbao', 'Hércules CF', 'Córdoba CF', 'Real Valladolid', 'RC Celta', 'Real Sporting', 'Sporting Gijón',
  'Deportivo Alavés', 'Deportivo La Coruña', 'Deportivo A Coruña', 'Elche CF', 'Granada CF', 'Terrassa FC', 'CF Badalona', 'CE Sabadell',
  'Real Oviedo', 'FC Cartagena', 'CD Móstoles', 'Xerez CD', 'CA Osasuna', 'CD Tenerife', 'UD Almería', 'RSD Alcalá', 'CF Fuenlabrada',
  'CD Leganés', 'Real Sociedad', 'Getafe CF', 'Burgos CF', 'Real Burgos', 'CD Castellón', 'Racing Santander', 'AD Alcorcón', 'CD Logroñés',
  'UD Logroñés', 'CD Badajoz', 'Marbella FC', 'UD Salamanca', 'Recreativo Huelva', 'UE Lleida', 'CD Lugo', 'Cultural Leonesa',
  'Algeciras CF', 'Cádiz CF', 'Real Jaén', 'CD Ourense', 'UD Ourense', 'CF Reus', 'SD Compostela', 'Lorca FC', 'CF Talavera',
  'Racing Ferrol', 'Pontevedra CF', 'SD Ponferradina', 'Zamora CF', 'CD Guadalajara', 'CD Toledo', 'CF Gandia', 'Real Ávila', 'CD Teruel',
  'SD Huesca', 'CD Numancia', 'Linares Deportivo', 'CD Calahorra', 'UD Alzira', 'CE Manresa', 'UE Figueres', 'Real Avilés', 'CD Palencia',
  'CD Alcoyano', 'Real Unión', 'Arenas Club', 'SD Eibar', 'CD Tudelano', 'CD Eldense', 'Club Getxo', 'Arenas Getxo', 'CD Mirandés',
  'Deportivo Aragón', 'CD Ebro', 'Real Jaén CF', 'CD Toledo SAD', 'Sporting Huelva', 'Recreativo Granada', 'Atlético Baleares',
  'UD Melilla', 'CP Cacereño', 'CD Don Benito', 'Mérida AD', 'Atlético Antoniano', 'Real Santander', 'Racing Murcia', 'Juventud Torremolinos',
  // otros países
  'Manchester United', 'Manchester City', 'Liverpool FC', 'Leeds United', 'Sheffield United', 'Sheffield Wednesday', 'Bristol City',
  'Bristol Rovers', 'Newcastle United', 'Nottingham Forest', 'Notts County', 'Leicester City', 'Coventry City', 'Bradford City',
  'Southampton FC', 'Portsmouth FC', 'Plymouth Argyle', 'Derby County', 'Brighton Albion', 'Wolverhampton Wanderers', 'Hull City',
  'Stoke City', 'Sunderland AFC', 'Reading FC', 'Norwich City', 'Ipswich Town', 'Oxford United', 'Cambridge United', 'York City',
  'Exeter City', 'Birmingham City', 'Cambridge City', 'Oxford City', 'London City', 'Liverpool City', 'Leeds City', 'Bradford Park Avenue',
  'AS Roma', 'AC Milano', 'SSC Napoli', 'Torino FC', 'US Palermo', 'Bologna FC', 'AS Bari', 'FC Bari', 'Venezia FC', 'Hellas Verona',
  'Calcio Padova', 'Brescia Calcio', 'Parma Calcio', 'AC Parma', 'FC Taranto', 'AC Prato', 'Modena FC', 'AC Perugia', 'AS Livorno',
  'US Livorno', 'Ravenna FC', 'FC Catania', 'AC Reggiana', 'US Catania', 'AC Venezia', 'AC Firenze', 'Genova FC',
  'Hertha Berlin', 'Union Berlin', 'FC Berlin', 'Hamburger SV', 'Bayern München', 'TSV München', '1. FC Köln', 'Fortuna Köln',
  'Eintracht Frankfurt', 'FSV Frankfurt', 'VfB Stuttgart', 'Fortuna Düsseldorf', 'Borussia Dortmund', 'Rot-Weiß Essen', 'Werder Bremen',
  'Dynamo Dresden', 'MSV Duisburg', 'VfL Bochum', 'Wuppertaler SV', 'Arminia Bielefeld', 'Bonner SC', 'Preußen Münster', 'Karlsruher SC',
  'SV Mannheim', 'FC Augsburg', 'SV Wiesbaden', 'Holstein Kiel', 'Hansa Rostock', 'SC Freiburg', '1. FC Nürnberg', 'FC Nürnberg',
  'VfL Wolfsburg', 'SC Paderborn', 'Eintracht Braunschweig', 'TSV Hannover', 'SV Hannover', 'Borussia Mönchengladbach', '1. FC Kiel',
  'Paris FC', 'Racing Paris', 'Olympique Marseille', 'Olympique Lyon', 'Toulouse FC', 'OGC Nice', 'FC Nantes', 'RC Strasbourg',
  'Racing Strasbourg', 'Lille OSC', 'Stade Rennes', 'Stade Reims', 'SC Toulon', 'Sporting Toulon', 'AS Saint-Étienne', 'Le Havre AC',
  'Dijon FC', 'Angers SC', 'Nîmes Olympique', 'Clermont Foot', 'Le Mans FC', 'Stade Brest', 'Tours FC', 'Amiens SC', 'Limoges FC',
  'FC Metz', 'Racing Besançon', 'US Orléans', 'Stade Bordeaux', 'FC Grenoble', 'AS Nancy', 'AS Monaco', 'FC Lorient', 'Stade Lavallois',
  'Sporting Lisboa', 'FC Porto', 'SC Braga', 'Sporting Braga', 'Vitória de Setúbal', 'Académica de Coimbra', 'Vitória de Guimarães',
  'SC Farense', 'Lusitano de Évora', 'FC Barreirense', 'GD Chaves', 'Desportivo de Chaves', 'FC Famalicão', 'CD Tondela',
  'Sporting da Covilhã', 'SC Covilhã', 'Desportivo de Beja', 'União de Leiria', 'Académico de Viseu', 'SC Beira-Mar', 'FC Penafiel',
  'Sparta Rotterdam', 'FC Utrecht', 'FC Groningen', 'NAC Breda', 'FC Twente', 'FC Zwolle', 'FC Dordrecht', 'FC Emmen', 'SC Heerenveen',
  'HFC Haarlem', 'FC Den Haag', 'FC Amsterdam', 'SC Cambuur', 'Go Ahead Deventer', 'Fortuna Sittard', 'FC Eindhoven', 'SC Eindhoven',
  'FC Den Bosch', 'FC Volendam', 'VV Venlo', 'Quick Den Haag', 'Sparta Nijmegen', 'RKC Waalwijk',
]);

/** País: sus ciudades de mayor a menor y cómo se forman los nombres de club */
const PAISES: Record<string, { ciudades: string[]; formas: string[]; detras?: boolean }> = {
  ENG: {
    ciudades: ['London', 'Birmingham', 'Manchester', 'Liverpool', 'Leeds', 'Sheffield', 'Bristol', 'Newcastle', 'London',
      'Nottingham', 'Leicester', 'Coventry', 'Bradford', 'Manchester', 'Southampton', 'Portsmouth', 'Plymouth',
      'London', 'Derby', 'Brighton', 'Liverpool', 'Wolverhampton', 'Hull', 'Stoke', 'Sunderland', 'Reading',
      'Norwich', 'Ipswich', 'Oxford', 'Cambridge', 'York', 'Exeter'],
    formas: ['United', 'City', 'Rovers', 'Athletic', 'Town', 'Albion', 'Wanderers', 'County', 'FC'],
    detras: true,
  },
  ITA: {
    ciudades: ['Roma', 'Milano', 'Napoli', 'Torino', 'Palermo', 'Genova', 'Bologna', 'Milano', 'Firenze', 'Bari', 'Roma',
      'Catania', 'Venezia', 'Verona', 'Messina', 'Torino', 'Padova', 'Trieste', 'Brescia', 'Genova', 'Parma',
      'Taranto', 'Prato', 'Modena', 'Reggio Calabria', 'Perugia', 'Livorno', 'Cagliari', 'Ravenna'],
    formas: ['AC', 'US', 'SS', 'AS', 'FC', 'Unione', 'Sporting', 'Real', 'Atletico', 'Polisportiva'],
  },
  GER: {
    ciudades: ['Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Dortmund',
      'Essen', 'Berlin', 'Bremen', 'Dresden', 'Hannover', 'Nürnberg', 'München', 'Duisburg', 'Bochum', 'Wuppertal',
      'Bielefeld', 'Hamburg', 'Bonn', 'Münster', 'Karlsruhe', 'Mannheim', 'Augsburg', 'Wiesbaden', 'Kiel',
      'Rostock', 'Freiburg'],
    formas: ['FC', 'SV', 'TSV', 'VfB', 'VfL', 'SC', 'Sportfreunde', 'Eintracht', 'Fortuna', 'Union', 'Borussia', 'Viktoria'],
  },
  FRA: {
    ciudades: ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Montpellier', 'Strasbourg', 'Bordeaux', 'Paris',
      'Lille', 'Rennes', 'Reims', 'Toulon', 'Saint-Étienne', 'Le Havre', 'Grenoble', 'Dijon', 'Lyon', 'Angers',
      'Nîmes', 'Clermont', 'Le Mans', 'Aix', 'Brest', 'Tours', 'Amiens', 'Limoges', 'Metz', 'Perpignan'],
    formas: ['Olympique', 'AS', 'FC', 'Racing', 'Stade', 'SC', 'US', 'AC', 'Sporting', 'Union'],
  },
  POR: {
    ciudades: ['Lisboa', 'Porto', 'Braga', 'Setúbal', 'Lisboa', 'Coimbra', 'Funchal', 'Amadora', 'Almada', 'Porto',
      'Guimarães', 'Aveiro', 'Lisboa', 'Viseu', 'Leiria', 'Faro', 'Évora', 'Barreiro', 'Póvoa de Varzim',
      'Vila do Conde', 'Portimão', 'Chaves', 'Famalicão', 'Tondela', 'Covilhã', 'Beja'],
    formas: ['Sporting', 'FC', 'Vitória de', 'Académica de', 'Desportivo de', 'União de', 'Atlético', 'Clube de', 'SC', 'GD'],
  },
  NED: {
    ciudades: ['Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht', 'Eindhoven', 'Groningen', 'Tilburg', 'Almere', 'Breda',
      'Rotterdam', 'Nijmegen', 'Apeldoorn', 'Haarlem', 'Amsterdam', 'Arnhem', 'Enschede', 'Amersfoort', 'Zwolle',
      'Leiden', 'Maastricht', 'Dordrecht', 'Alkmaar', 'Deventer', 'Venlo', 'Leeuwarden', 'Heerenveen', 'Emmen'],
    formas: ['SC', 'FC', 'VV', 'SV', 'Sparta', 'Quick', 'DOS', 'Be Quick', 'Fortuna', 'Victoria'],
  },
};

/** Nombre de club para una ciudad sin repetir un club real (prueba fórmulas hasta dar con una libre) */
function nombreClub(ciudad: string, formas: string[], usados: Set<string>, detras = false) {
  // una ciudad grande puede tener varios clubes: nunca con el mismo nombre
  for (const forma of shuffle([...formas])) {
    const nombre = detras ? `${ciudad} ${forma}` : `${forma} ${ciudad}`;
    if (!REALES.has(nombre) && !usados.has(nombre)) {
      usados.add(nombre);
      return nombre;
    }
  }
  for (let n = 2; ; n++) {
    const nombre = detras ? `${ciudad} Sporting ${n}` : `Sporting ${ciudad} ${n}`;
    if (!usados.has(nombre)) {
      usados.add(nombre);
      return nombre;
    }
  }
}

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Abreviatura de tres letras sin repetir otra ya usada */
function abreviatura(ciudad: string, usadas: Set<string>) {
  const limpio = sinTildes(ciudad).replace(/^(L'|A |El |La |Las |Los |Den |Le |Saint-|Santa |San )\s*/i, '').replace(/[^A-Za-z]/g, '').toUpperCase();
  // la primera letra y dos más de la ciudad, en orden (LON, LND, LOD...)
  const candidatas = [limpio.slice(0, 3)];
  for (let i = 1; i < limpio.length; i++) for (let j = i + 1; j < limpio.length; j++) candidatas.push(limpio[0] + limpio[i] + limpio[j]);
  const ab = candidatas.find((c) => c.length === 3 && !usadas.has(c)) ?? limpio.slice(0, 2) + String(usadas.size % 10);
  usadas.add(ab);
  return ab;
}

/** Clubes españoles: una lista por categoría, de mayor a menor ciudad. `evitar`: el nombre de nuestro club */
export function spanishClubs(porCategoria: number, evitar = '') {
  const usadas = new Set<string>();
  const nombres = new Set<string>();
  const nuestro = sinTildes(evitar).toLowerCase();
  return ESPANA.map((lista) => {
    // dentro de cada categoría salen unas ciudades u otras en cada partida, pero siempre de su tamaño
    // por posiciones de la lista: una ciudad con dos clubes aparece dos veces
    const posibles = lista.map((c, i) => [c, i] as const).filter(([c]) => !nuestro.includes(sinTildes(c).toLowerCase()));
    const elegidas = shuffle([...posibles]).slice(0, porCategoria).sort((a, b) => a[1] - b[1]).map(([c]) => c);
    return elegidas.map((c) => ({ town: c, name: nombreClub(c, FORMAS_ESP, nombres), short: abreviatura(c, usadas) }));
  });
}

/** n clubes de un país, de las ciudades más grandes y ordenados de mayor a menor */
export function foreignClubs(country: string, n: number) {
  const d = PAISES[country];
  const usadas = new Set<string>();
  const nombres = new Set<string>();
  const elegidas = shuffle(d.ciudades.slice(0, n + 5).map((c, i) => [c, i] as const)).slice(0, n).sort((a, b) => a[1] - b[1]).map(([c]) => c);
  return elegidas.map((c) => ({ name: nombreClub(c, d.formas, nombres, d.detras), short: abreviatura(c, usadas) }));
}
