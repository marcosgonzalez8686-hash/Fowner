import { pick, shuffle } from './rng';

// Todos los nombres son inventados: pueblos, clubes y personas ficticias

const NOMBRES = [
  'Álvaro', 'Hugo', 'Mateo', 'Leo', 'Daniel', 'Pablo', 'Adrián', 'Marcos', 'Iker', 'Unai',
  'Rubén', 'Sergio', 'Diego', 'Javier', 'Raúl', 'Íñigo', 'Óscar', 'Gonzalo', 'Nicolás', 'Martín',
  'Bruno', 'Thiago', 'Izan', 'Aitor', 'Joel', 'Eric', 'Saúl', 'Germán', 'Borja', 'Fermín',
  'Rodrigo', 'Ismael', 'Samuel', 'Gael', 'Lucas', 'Iván', 'Jorge', 'Héctor', 'Tomás', 'Ander',
  'Kevin', 'Yeray', 'Brais', 'Xabi', 'Pol', 'Oriol', 'Nahuel', 'Julen', 'Asier', 'Dario',
  'Moussa', 'Ibrahim', 'Yannick', 'Luca', 'Mattia', 'Rafa', 'Nuno', 'Tiago', 'Kofi', 'Emre',
];

const APELLIDOS = [
  'Arranz', 'Bermejo', 'Cabello', 'Dueñas', 'Escudero', 'Ferrán', 'Galindo', 'Herrero', 'Iglesias', 'Jaén',
  'Lago', 'Maroto', 'Novoa', 'Olmedo', 'Pastor', 'Quintana', 'Robles', 'Salcedo', 'Tejero', 'Ureña',
  'Valle', 'Zamora', 'Alcaide', 'Baena', 'Carmona', 'Durán', 'Esteve', 'Figueroa', 'Gallardo', 'Hidalgo',
  'Lorente', 'Manzano', 'Navas', 'Ocaña', 'Peralta', 'Rivas', 'Soler', 'Toledo', 'Vidal', 'Yuste',
  'Aranda', 'Bustos', 'Cuesta', 'Del Río', 'Espejo', 'Funes', 'Garrido', 'Huertas', 'Lozano', 'Medina',
  'Mollá', 'Pons', 'Requena', 'Sanchís', 'Terán', 'Vela', 'Amor', 'Bravo', 'Cortés', 'Ríos',
];

const PREFIJOS = [
  'Villa', 'Puebla de ', 'Castro', 'Torre', 'Fuente', 'Valde', 'Monte', 'Puerto ', 'Ribera de ', 'Campo',
  'Peña', 'Alto ', 'Vega de ', 'Cerro ', 'Mora', 'Santa ', 'San ', 'Prado', 'Rio', 'Arroyo ',
];

const RAICES = [
  'brava', 'lumbre', 'salitre', 'robledo', 'serena', 'quejigo', 'alondra', 'cardal', 'helechar', 'verdín',
  'nogalejo', 'piedrahita', 'oteruelo', 'mirabel', 'trigal', 'cenizo', 'pinarejo', 'almenar', 'solana', 'aulaga',
  'retamar', 'galayo', 'tornero', 'espliego', 'rocín', 'molinar', 'zarzal', 'lebrel', 'cantueso', 'pedregal',
];

const FORMAS = ['CD', 'UD', 'Atlético', 'Racing', 'Deportivo', 'SD', 'CF', 'Unión', 'Real Club', 'Sporting'];

/** Genera n nombres de pueblos ficticios únicos */
export function townNames(n: number): string[] {
  const set = new Set<string>();
  const combos: string[] = [];
  for (const p of PREFIJOS) for (const r of RAICES) {
    const nombre = p.endsWith(' ') ? p + r[0].toUpperCase() + r.slice(1) : p + r;
    combos.push(nombre);
  }
  shuffle(combos);
  for (const c of combos) {
    if (set.size >= n) break;
    set.add(c);
  }
  return [...set];
}

export function clubName(town: string) {
  return `${pick(FORMAS)} ${town}`;
}

export function shortName(town: string) {
  const limpio = town.replace(/^(Puebla de|Ribera de|Vega de|Puerto|Alto|Cerro|Santa|San|Arroyo) /, '');
  return limpio.slice(0, 3).toUpperCase();
}

export function personName() {
  return `${pick(NOMBRES)} ${pick(APELLIDOS)}`;
}
