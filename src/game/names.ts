import { pick } from './rng';

// Nombres de personas inventados (los clubes salen de ciudades reales: places.ts)

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
