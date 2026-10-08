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

// nombres y apellidos de cada nacionalidad (combinaciones inventadas)
const NOMBRES_PAIS: Record<string, [string[], string[]]> = {
  ENG: [['Harry', 'Jack', 'Oliver', 'George', 'Charlie', 'Alfie', 'Freddie', 'Mason', 'Callum', 'Reece', 'Ben', 'Tom', 'Jamie', 'Kyle', 'Declan', 'Conor', 'Ollie', 'Ryan', 'Luke', 'Sam'],
    ['Ashworth', 'Blakeley', 'Carver', 'Dunmore', 'Ellison', 'Fairbank', 'Greaves', 'Hollis', 'Kettering', 'Lanford', 'Marlow', 'Norbury', 'Pemberton', 'Radcliffe', 'Shelby', 'Thornton', 'Wainwright', 'Whitlock', 'Yardley', 'Crowther']],
  ITA: [['Lorenzo', 'Matteo', 'Andrea', 'Federico', 'Alessandro', 'Davide', 'Riccardo', 'Giacomo', 'Nicolò', 'Simone', 'Marco', 'Tommaso', 'Gianluca', 'Pietro', 'Filippo', 'Edoardo', 'Stefano', 'Manuel', 'Daniele', 'Fabio'],
    ['Bellandi', 'Castellani', 'De Santis', 'Ferraresi', 'Galletti', 'Lombardo', 'Mancinelli', 'Orsolini', 'Pellegatti', 'Rinaldi', 'Sartori', 'Tedeschi', 'Valenti', 'Zanetti', 'Morandi', 'Cattaneo', 'Bertolini', 'Fumagalli', 'Guerrieri', 'Pasquali']],
  GER: [['Lukas', 'Jonas', 'Leon', 'Finn', 'Felix', 'Maximilian', 'Niklas', 'Tim', 'Jan', 'Moritz', 'Julian', 'Paul', 'Florian', 'Tobias', 'Kai', 'Lennart', 'Marvin', 'Jannik', 'Philipp', 'Erik'],
    ['Brandner', 'Eckstein', 'Fuchsberger', 'Hartmann', 'Kessler', 'Lindemann', 'Mertens', 'Neubauer', 'Pfeiffer', 'Reinholz', 'Schaller', 'Treiber', 'Voigtländer', 'Wendler', 'Ziegler', 'Holzapfel', 'Baumgart', 'Kranz', 'Seidel', 'Vogt']],
  FRA: [['Lucas', 'Hugo', 'Théo', 'Mathis', 'Nathan', 'Enzo', 'Antoine', 'Maxime', 'Clément', 'Bastien', 'Kylian', 'Rayan', 'Yanis', 'Adrien', 'Florian', 'Romain', 'Quentin', 'Jules', 'Benoît', 'Malik'],
    ['Aubert', 'Bonnard', 'Chevalier', 'Delorme', 'Fontaine', 'Garnier', 'Lacombe', 'Marchand', 'Perrin', 'Rousset', 'Serrault', 'Tessier', 'Vasseur', 'Lemaire', 'Brunet', 'Caron', 'Dufresne', 'Joubert', 'Moreau', 'Kanté']],
  POR: [['João', 'Tiago', 'Rafael', 'Diogo', 'Gonçalo', 'Rúben', 'Bernardo', 'Duarte', 'Francisco', 'Nuno', 'Pedro', 'Vitinha', 'André', 'Ricardo', 'Fábio', 'Hélder', 'Rui', 'Luís', 'Miguel', 'Simão'],
    ['Almeida', 'Barbosa', 'Carvalhal', 'Dourado', 'Fontes', 'Guerreiro', 'Lacerda', 'Magalhães', 'Nogueira', 'Pinheiro', 'Quaresma', 'Rebelo', 'Sampaio', 'Teixeira', 'Valadares', 'Coutinho', 'Monteiro', 'Brandão', 'Cardoso', 'Faria']],
  NED: [['Daan', 'Sem', 'Bram', 'Jesse', 'Luuk', 'Thijs', 'Milan', 'Ruben', 'Stijn', 'Joost', 'Wout', 'Teun', 'Sven', 'Koen', 'Jurriën', 'Mats', 'Niels', 'Jasper', 'Gijs', 'Tijn'],
    ['Van Dam', 'De Bruin', 'Verhoeven', 'Bakker', 'Hoekstra', 'Kuipers', 'Mulder', 'Postma', 'Schouten', 'Terpstra', 'Van Leeuwen', 'Visser', 'Wijnaldum', 'Zwart', 'De Graaf', 'Brouwer', 'Smit', 'Dekker', 'Jansma', 'Koopman']],
  BRA: [['Gabriel', 'Lucas', 'Matheus', 'Vinícius', 'Rodrygo', 'Thiago', 'Danilo', 'Éverton', 'Caio', 'Douglas', 'Wesley', 'Igor', 'Murilo', 'Renan', 'Felipe', 'Paulinho', 'Wellington', 'Juninho', 'Guilherme', 'Rafinha'],
    ['Silveira', 'Andrade', 'Moraes', 'Batista', 'Cavalcanti', 'Damasceno', 'Ferreira', 'Gonçalves', 'Lisboa', 'Medeiros', 'Nascimento', 'Oliveira', 'Prates', 'Rezende', 'Siqueira', 'Toledo', 'Vasconcelos', 'Xavier', 'Bittencourt', 'Macedo']],
  ARG: [['Lautaro', 'Nahuel', 'Facundo', 'Thiago', 'Enzo', 'Julián', 'Agustín', 'Franco', 'Gonzalo', 'Matías', 'Exequiel', 'Valentín', 'Santiago', 'Leandro', 'Rodrigo', 'Ezequiel', 'Lisandro', 'Nicolás', 'Alexis', 'Emiliano'],
    ['Acuña', 'Barrios', 'Correa', 'Domínguez', 'Echeverri', 'Funes', 'Gaitán', 'Ibarra', 'Lencina', 'Medina', 'Ojeda', 'Paredes', 'Quiroga', 'Romero', 'Sosa', 'Vallejos', 'Zárate', 'Almirón', 'Benítez', 'Coronel']],
  BEL: [['Arne', 'Wout', 'Thibaut', 'Romain', 'Jordan', 'Lander', 'Senne', 'Mathias', 'Dries', 'Yannick', 'Maxim', 'Robbe', 'Hans', 'Loïs', 'Jarne', 'Brecht', 'Siebe', 'Ward', 'Cedric', 'Toon'],
    ['Claes', 'Peeters', 'Janssens', 'Maes', 'Wouters', 'Goossens', 'Lambrecht', 'Vermeulen', 'De Smet', 'Willems', 'Dubois', 'Lemmens', 'Verstraete', 'Martens', 'Van Acker', 'Hendrickx', 'Mertens', 'Desmet', 'Noels', 'Pauwels']],
};

/** Nombre de una persona de esa nacionalidad (España si no se indica) */
export function personName(nat?: string) {
  const lista = nat ? NOMBRES_PAIS[nat] : undefined;
  return lista ? `${pick(lista[0])} ${pick(lista[1])}` : `${pick(NOMBRES)} ${pick(APELLIDOS)}`;
}

// pueblos y clubes ficticios de otros países: prefijos, raíces y formas de club
const PUEBLOS_PAIS: Record<string, { pre: string[]; raiz: string[]; formas: string[]; detras?: boolean }> = {
  ENG: { pre: ['Ash', 'King', 'North', 'West', 'Brook', 'Stan', 'Mill', 'Hart', 'Clay', 'Elm', 'Oak', 'Red', 'Black', 'Green', 'Whit', 'Dun', 'Bel', 'Thorn'], raiz: ['ford', 'bridge', 'vale', 'moor', 'field', 'ton', 'wick', 'bury', 'ham', 'ley', 'port', 'stead', 'mouth', 'dale'], formas: ['United', 'City', 'Rovers', 'Athletic', 'Town', 'Albion', 'Wanderers', 'County'], detras: true },
  ITA: { pre: ['Monte', 'Val', 'Porto', 'Castel', 'Borgo', 'Rocca', 'Villa', 'Torre', 'Pian', 'Colle'], raiz: ['fiore', 'verde', 'lago', 'sole', 'mare', 'rosa', 'bruna', 'alta', 'chiara', 'nera', 'luce', 'fonte'], formas: ['AC', 'US', 'SS', 'AS', 'FC', 'Unione', 'Sporting', 'Real'] },
  GER: { pre: ['Rhein', 'Alt', 'Neu', 'Ober', 'Unter', 'Edel', 'Hohen', 'Wald', 'Stein', 'Rosen', 'Linden', 'Hammer'], raiz: ['feld', 'dorf', 'burg', 'hausen', 'heim', 'wald', 'bach', 'berg', 'au', 'stadt'], formas: ['FC', 'SV', 'TSV', 'VfB', 'Borussia', 'Eintracht', 'SC', 'Fortuna'] },
  FRA: { pre: ['Val', 'Mont', 'Belle', 'Beau', 'Clair', 'Roche', 'Mar', 'Font', 'Grand', 'Haute'], raiz: ['mont', 'lieu', 'ville', 'court', 'fort', 'rive', 'bois', 'mare', 'champ', 'lac', 'val', 'pré'], formas: ['Olympique', 'AS', 'FC', 'Racing', 'Stade', 'SC', 'US', 'Girondins de'] },
  POR: { pre: ['Vila ', 'Porto ', 'Alto ', 'Ribeira ', 'Monte ', 'São ', 'Santa ', 'Vale ', 'Ponte ', 'Serra '], raiz: ['Verde', 'Mar', 'Sol', 'Rio', 'Douro', 'Alva', 'Branca', 'Nova', 'Luz', 'Doce', 'Clara', 'Alegre'], formas: ['Sporting', 'FC', 'Vitória de', 'Académica de', 'Desportivo', 'União', 'Atlético', 'Clube de'] },
  NED: { pre: ['Linde', 'Wester', 'Zuid', 'Delf', 'Groen', 'Water', 'Ooster', 'Hoog', 'Berg', 'Noord'], raiz: ['hoven', 'dam', 'burg', 'haven', 'wijk', 'veld', 'meer', 'stad', 'dorp', 'zijl'], formas: ['SC', 'FC', 'VV', 'SV', 'Willem', 'RKC', 'FC Groot', 'Sparta'] },
};

/** n clubes ficticios de un país: nombre y abreviatura */
export function foreignClubs(country: string, n: number) {
  const d = PUEBLOS_PAIS[country];
  const combos = shuffle(d.pre.flatMap((p) => d.raiz.map((r) => (p.endsWith(' ') ? p + r : p + r.toLowerCase())))).slice(0, n);
  return combos.map((pueblo) => {
    const forma = pick(d.formas);
    return { name: d.detras ? `${pueblo} ${forma}` : `${forma} ${pueblo}`, short: pueblo.replace(/^(Vila|Porto|Alto|Ribeira|Monte|São|Santa|Vale|Ponte|Serra) /, '').slice(0, 3).toUpperCase() };
  });
}
