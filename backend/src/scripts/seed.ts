import { pbkdf2Sync, randomBytes } from 'node:crypto';

import { AppDataSource } from '../data-source';
import { Business } from '../modules/businesses/business.entity';
import { Product } from '../modules/products/product.entity';
import { User, UserRole } from '../modules/users/user.entity';
import type { Repository } from 'typeorm';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

type SeedUser = {
  email: string;
  username: string;
  fullName: string;
  roles: UserRole[];
};

type SeedProduct = {
  name: string;
  category: string;
  description: string;
  priceCents: number;
  imageQuery: string;
};

type SeedBusiness = {
  ownerEmail: string;
  name: string;
  description: string;
  address: string;
  logoQuery: string;
  deliveryTime: number;
  rating: number;
  minimumOrder: number;
  products: SeedProduct[];
};

function businessImageUrl(seed: string) {
  return flickrImageUrl(`business:${seed}`, businessImageTerms(seed));
}

function productImageUrl(seed: string) {
  return flickrImageUrl(`product:${seed}`, productImageTerms(seed));
}

function flickrImageUrl(seed: string, terms: string[]) {
  const keywords = [...new Set(terms.flatMap((term) => normalizeTermParts(term)).filter(Boolean))];
  const lock = stableLock(seed);

  return `https://loremflickr.com/900/600/${keywords.map(encodeURIComponent).join(',')}?lock=${lock}`;
}

function stableLock(seed: string) {
  let hash = 0;

  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return (hash % 900000) + 100000;
}

function normalizeTermParts(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length > 1);
}

function productImageTerms(seed: string) {
  if (matches(seed, ['pastor', 'bistec', 'taco'])) return ['taco', 'mexican food'];
  if (matches(seed, ['gringa', 'quesadilla'])) return ['quesadilla', 'mexican food'];
  if (matches(seed, ['volcan', 'arrachera'])) return ['steak', 'mexican food'];
  if (matches(seed, ['cebollitas'])) return ['grilled onions', 'mexican food'];
  if (matches(seed, ['horchata'])) return ['horchata', 'drink'];
  if (matches(seed, ['jamaica'])) return ['hibiscus tea', 'drink'];
  if (matches(seed, ['nachos'])) return ['nachos', 'mexican food'];

  if (matches(seed, ['pizza'])) return ['pizza', 'food'];
  if (matches(seed, ['pasta', 'alfredo', 'bolonesa'])) return ['pasta', 'italian food'];
  if (matches(seed, ['pan-ajo'])) return ['garlic bread', 'food'];
  if (matches(seed, ['refresco'])) return ['soda', 'drink'];

  if (matches(seed, ['roll', 'sushi', 'tampico'])) return ['sushi', 'japanese food'];
  if (matches(seed, ['spicy-tuna'])) return ['tuna sushi', 'japanese food'];
  if (matches(seed, ['tempura'])) return ['shrimp tempura', 'japanese food'];
  if (matches(seed, ['yakimeshi', 'arroz'])) return ['fried rice', 'food'];
  if (matches(seed, ['poke'])) return ['poke bowl', 'food'];
  if (matches(seed, ['gyozas'])) return ['gyoza', 'dumplings'];
  if (matches(seed, ['edamames'])) return ['edamame', 'japanese food'];
  if (matches(seed, ['te-verde'])) return ['iced tea', 'drink'];

  if (matches(seed, ['burger'])) return ['hamburger', 'food'];
  if (matches(seed, ['papas'])) return ['french fries', 'food'];
  if (matches(seed, ['aros'])) return ['onion rings', 'food'];
  if (matches(seed, ['malteada'])) return ['milkshake', 'drink'];
  if (matches(seed, ['limonada'])) return ['lemonade', 'drink'];

  if (matches(seed, ['picada', 'garnacha', 'molote'])) return ['mexican food', 'street food'];
  if (matches(seed, ['empanada'])) return ['empanada', 'food'];
  if (matches(seed, ['tostada'])) return ['tostada', 'mexican food'];
  if (matches(seed, ['platanos'])) return ['fried plantains', 'food'];
  if (matches(seed, ['cafe-olla', 'americano', 'latte', 'capuchino', 'cold-brew'])) return ['coffee', 'cafe'];
  if (matches(seed, ['atole'])) return ['hot chocolate', 'drink'];

  if (matches(seed, ['croissant'])) return ['croissant', 'bakery'];
  if (matches(seed, ['pan-elote'])) return ['corn bread', 'bakery'];
  if (matches(seed, ['bagel'])) return ['bagel', 'breakfast'];
  if (matches(seed, ['yogurt', 'parfait'])) return ['yogurt parfait', 'breakfast'];
  if (matches(seed, ['sandwich'])) return ['sandwich', 'food'];
  if (matches(seed, ['smoothie'])) return ['smoothie', 'drink'];

  if (matches(seed, ['camaron', 'camarones'])) return ['shrimp', 'seafood'];
  if (matches(seed, ['ceviche'])) return ['ceviche', 'seafood'];
  if (matches(seed, ['atun'])) return ['tuna', 'seafood'];
  if (matches(seed, ['aguachile'])) return ['shrimp ceviche', 'seafood'];
  if (matches(seed, ['filete'])) return ['fish fillet', 'seafood'];
  if (matches(seed, ['michelada'])) return ['michelada', 'drink'];
  if (matches(seed, ['agua-mineral', 'agua-alcalina'])) return ['bottled water', 'drink'];

  if (matches(seed, ['pollo', 'combo-familiar'])) return ['roasted chicken', 'food'];
  if (matches(seed, ['alitas'])) return ['chicken wings', 'food'];
  if (matches(seed, ['nuggets'])) return ['chicken nuggets', 'food'];
  if (matches(seed, ['ensalada-col'])) return ['coleslaw', 'food'];
  if (matches(seed, ['tortillas'])) return ['tortillas', 'mexican food'];
  if (matches(seed, ['salsa'])) return ['salsa', 'mexican food'];

  if (matches(seed, ['bowl'])) return ['healthy bowl', 'food'];
  if (matches(seed, ['ensalada'])) return ['salad', 'food'];
  if (matches(seed, ['wrap'])) return ['wrap', 'food'];
  if (matches(seed, ['jugo-verde'])) return ['green juice', 'drink'];
  if (matches(seed, ['jugo-naranja'])) return ['orange juice', 'drink'];

  if (matches(seed, ['waffle'])) return ['waffle', 'dessert'];
  if (matches(seed, ['crepa'])) return ['crepe', 'dessert'];
  if (matches(seed, ['helado'])) return ['ice cream', 'dessert'];
  if (matches(seed, ['brownie'])) return ['brownie', 'dessert'];
  if (matches(seed, ['cheesecake'])) return ['cheesecake', 'dessert'];
  if (matches(seed, ['fresas'])) return ['strawberries cream', 'dessert'];
  if (matches(seed, ['frappe'])) return ['frappe', 'drink'];
  if (matches(seed, ['churros'])) return ['churros', 'dessert'];

  return ['restaurant food'];
}

function businessImageTerms(seed: string) {
  if (matches(seed, ['taqueria', 'antojitos'])) return ['taqueria', 'mexican food'];
  if (matches(seed, ['pizza'])) return ['pizzeria', 'pizza'];
  if (matches(seed, ['sushi'])) return ['sushi restaurant', 'japanese food'];
  if (matches(seed, ['burger'])) return ['burger restaurant', 'hamburger'];
  if (matches(seed, ['cafe'])) return ['coffee shop', 'cafe'];
  if (matches(seed, ['mariscos'])) return ['seafood restaurant', 'seafood'];
  if (matches(seed, ['pollo'])) return ['roasted chicken', 'restaurant'];
  if (matches(seed, ['verde'])) return ['healthy restaurant', 'salad'];
  if (matches(seed, ['dulce'])) return ['dessert shop', 'bakery'];

  return ['restaurant', 'food'];
}

function matches(seed: string, keywords: string[]) {
  const normalized = seed.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

const seedUsers: SeedUser[] = [
  {
    email: 'cliente1@rapiv.local',
    username: 'cliente1',
    fullName: 'Cliente Uno',
    roles: ['CUSTOMER'],
  },
  {
    email: 'cliente2@rapiv.local',
    username: 'cliente2',
    fullName: 'Cliente Dos',
    roles: ['CUSTOMER'],
  },
  {
    email: 'repartidor1@rapiv.local',
    username: 'repartidor1',
    fullName: 'Repartidor Uno',
    roles: ['COURIER'],
  },
  {
    email: 'repartidor2@rapiv.local',
    username: 'repartidor2',
    fullName: 'Repartidor Dos',
    roles: ['COURIER'],
  },
  ...Array.from({ length: 10 }, (_, index) => ({
    email: `negocio${index + 1}@rapiv.local`,
    username: `negocio${index + 1}`,
    fullName: `Dueño Negocio ${index + 1}`,
    roles: ['BUSINESS_OWNER'] as UserRole[],
  })),
];

const businesses: SeedBusiness[] = ([
  {
    ownerEmail: 'negocio1@rapiv.local',
    name: 'Taqueria El Puerto',
    description: 'Tacos, gringas y aguas frescas al momento.',
    address: 'Centro, Vega de Alatorre',
    logoQuery: 'taqueria-puerto',
    deliveryTime: 22,
    rating: 4.7,
    minimumOrder: 120,
    products: [
      ['Taco al pastor', 'Tacos', 'Tortilla maiz, pastor, piña y cilantro.', 1800, 'taco-pastor'],
      ['Taco de bistec', 'Tacos', 'Bistec asado con cebolla y salsa verde.', 2200, 'taco-bistec'],
      ['Gringa de pastor', 'Especiales', 'Queso, pastor y tortilla de harina.', 5200, 'gringa-pastor'],
      ['Volcan de arrachera', 'Especiales', 'Tostada crujiente con arrachera y queso.', 5800, 'volcan-arrachera'],
      ['Quesadilla sencilla', 'Quesadillas', 'Queso fundido en tortilla de harina.', 3000, 'quesadilla'],
      ['Orden de cebollitas', 'Complementos', 'Cebollitas asadas con limon.', 2500, 'cebollitas'],
      ['Agua de horchata', 'Bebidas', 'Horchata fria de la casa.', 2500, 'horchata'],
      ['Agua de jamaica', 'Bebidas', 'Jamaica natural sin gas.', 2200, 'jamaica'],
      ['Torta de pastor', 'Tortas', 'Pastor, queso, aguacate y salsa.', 6500, 'torta-pastor'],
      ['Nachos con carne', 'Especiales', 'Totopos, queso, frijol y bistec.', 7800, 'nachos-carne'],
    ],
  },
  {
    ownerEmail: 'negocio2@rapiv.local',
    name: 'Pizza Brava',
    description: 'Pizzas artesanales, pastas y entradas para compartir.',
    address: 'Avenida Hidalgo 42',
    logoQuery: 'pizza-brava',
    deliveryTime: 30,
    rating: 4.6,
    minimumOrder: 180,
    products: [
      ['Pizza margarita', 'Pizza', 'Pomodoro, mozzarella y albahaca.', 14900, 'pizza-margarita'],
      ['Pizza pepperoni', 'Pizza', 'Pepperoni dorado y extra queso.', 16900, 'pizza-pepperoni'],
      ['Pizza hawaiana', 'Pizza', 'Jamón, piña y mozzarella.', 15900, 'pizza-hawaiana'],
      ['Pizza cuatro quesos', 'Pizza', 'Mezcla de quesos y orilla crujiente.', 18500, 'pizza-quesos'],
      ['Pizza vegetariana', 'Pizza', 'Pimientos, champiñones, cebolla y aceitunas.', 17500, 'pizza-vegetariana'],
      ['Pasta alfredo', 'Pasta', 'Fettuccine con salsa cremosa.', 12500, 'pasta-alfredo'],
      ['Pasta boloñesa', 'Pasta', 'Salsa de tomate y carne.', 13500, 'pasta-bolonesa'],
      ['Pan de ajo', 'Entradas', 'Pan horneado con ajo y mantequilla.', 4900, 'pan-ajo'],
      ['Ensalada cesar', 'Ensaladas', 'Lechuga, crutones y aderezo cesar.', 8900, 'ensalada-cesar'],
      ['Refresco 600 ml', 'Bebidas', 'Refresco frio embotellado.', 3000, 'refresco'],
    ],
  },
  {
    ownerEmail: 'negocio3@rapiv.local',
    name: 'Sushi Laguna',
    description: 'Rollos frescos, bowls y entradas japonesas.',
    address: 'Colonia Norte',
    logoQuery: 'sushi-laguna',
    deliveryTime: 35,
    rating: 4.8,
    minimumOrder: 200,
    products: [
      ['California roll', 'Sushi', 'Surimi, pepino y aguacate.', 9900, 'california-roll'],
      ['Spicy tuna roll', 'Sushi', 'Atun picante con ajonjoli.', 14500, 'spicy-tuna'],
      ['Camaron tempura roll', 'Sushi', 'Camaron tempura y queso crema.', 13900, 'tempura-roll'],
      ['Philadelphia roll', 'Sushi', 'Salmon, queso crema y aguacate.', 14900, 'philadelphia-roll'],
      ['Yakimeshi mixto', 'Arroz', 'Arroz frito con pollo, res y verduras.', 12900, 'yakimeshi'],
      ['Poke salmon', 'Bowls', 'Arroz, salmon, aguacate y soya.', 16500, 'poke-salmon'],
      ['Gyozas', 'Entradas', 'Empanaditas japonesas al vapor.', 8900, 'gyozas'],
      ['Edamames', 'Entradas', 'Edamames con sal de mar.', 6900, 'edamames'],
      ['Tampico extra', 'Extras', 'Porcion de tampico para rollos.', 2500, 'tampico'],
      ['Te verde frio', 'Bebidas', 'Te verde embotellado.', 3500, 'te-verde'],
    ],
  },
  {
    ownerEmail: 'negocio4@rapiv.local',
    name: 'Burger Costa',
    description: 'Hamburguesas jugosas y papas crujientes.',
    address: 'Boulevard Costero',
    logoQuery: 'burger-costa',
    deliveryTime: 25,
    rating: 4.5,
    minimumOrder: 150,
    products: [
      ['Burger clasica', 'Hamburguesas', 'Carne, queso, lechuga y tomate.', 9900, 'burger-clasica'],
      ['Cheese burger', 'Hamburguesas', 'Doble queso americano.', 11500, 'cheese-burger'],
      ['Bacon burger', 'Hamburguesas', 'Tocino crujiente y salsa BBQ.', 13500, 'bacon-burger'],
      ['Burger hawaiana', 'Hamburguesas', 'Piña asada, jamon y queso.', 12900, 'burger-hawaiana'],
      ['Chicken burger', 'Hamburguesas', 'Pollo empanizado y aderezo.', 10900, 'chicken-burger'],
      ['Papas clasicas', 'Papas', 'Papas a la francesa.', 4900, 'papas'],
      ['Papas con queso', 'Papas', 'Papas con queso cheddar.', 6900, 'papas-queso'],
      ['Aros de cebolla', 'Complementos', 'Aros crujientes con dip.', 5900, 'aros-cebolla'],
      ['Malteada vainilla', 'Bebidas', 'Malteada cremosa de vainilla.', 6900, 'malteada'],
      ['Limonada mineral', 'Bebidas', 'Limonada fresca con gas.', 4500, 'limonada'],
    ],
  },
  {
    ownerEmail: 'negocio5@rapiv.local',
    name: 'Antojitos Lupita',
    description: 'Garnachas, picadas y antojitos tradicionales.',
    address: 'Mercado Municipal',
    logoQuery: 'antojitos-lupita',
    deliveryTime: 20,
    rating: 4.9,
    minimumOrder: 100,
    products: [
      ['Picada roja', 'Picadas', 'Salsa roja, queso y crema.', 1800, 'picada-roja'],
      ['Picada verde', 'Picadas', 'Salsa verde, queso y cebolla.', 1800, 'picada-verde'],
      ['Garnacha sencilla', 'Garnachas', 'Carne, papa y salsa.', 2000, 'garnacha'],
      ['Empanada de queso', 'Empanadas', 'Masa frita rellena de queso.', 2800, 'empanada-queso'],
      ['Empanada de carne', 'Empanadas', 'Rellena de carne molida.', 3200, 'empanada-carne'],
      ['Tostada de pollo', 'Tostadas', 'Pollo, lechuga, crema y queso.', 3500, 'tostada-pollo'],
      ['Molote de papa', 'Antojitos', 'Molote frito con papa.', 3000, 'molote'],
      ['Platanos fritos', 'Postres', 'Con crema y queso.', 4500, 'platanos'],
      ['Cafe de olla', 'Bebidas', 'Cafe especiado tradicional.', 2500, 'cafe-olla'],
      ['Atole de vainilla', 'Bebidas', 'Atole caliente de vainilla.', 3000, 'atole'],
    ],
  },
  {
    ownerEmail: 'negocio6@rapiv.local',
    name: 'Cafe Marea',
    description: 'Cafe, pan dulce y desayunos ligeros.',
    address: 'Plaza Principal',
    logoQuery: 'cafe-marea',
    deliveryTime: 18,
    rating: 4.7,
    minimumOrder: 90,
    products: [
      ['Americano', 'Cafe', 'Cafe americano caliente.', 3500, 'americano'],
      ['Latte', 'Cafe', 'Espresso con leche vaporizada.', 5200, 'latte'],
      ['Capuchino', 'Cafe', 'Espuma cremosa y cacao.', 5200, 'capuchino'],
      ['Cold brew', 'Cafe frio', 'Cafe infusionado en frio.', 5900, 'cold-brew'],
      ['Croissant', 'Panaderia', 'Croissant de mantequilla.', 4500, 'croissant'],
      ['Pan de elote', 'Panaderia', 'Rebanada dulce de elote.', 4800, 'pan-elote'],
      ['Bagel con queso', 'Desayunos', 'Bagel tostado con queso crema.', 6900, 'bagel'],
      ['Yogurt con fruta', 'Desayunos', 'Yogurt natural, fruta y granola.', 7500, 'yogurt'],
      ['Sandwich pavo', 'Sandwiches', 'Pavo, queso y vegetales.', 8900, 'sandwich-pavo'],
      ['Smoothie mango', 'Bebidas', 'Mango natural y yogurt.', 6500, 'smoothie'],
    ],
  },
  {
    ownerEmail: 'negocio7@rapiv.local',
    name: 'Mariscos La Barra',
    description: 'Cocteles, tostadas y ceviches frescos.',
    address: 'Carretera a la playa',
    logoQuery: 'mariscos-barra',
    deliveryTime: 32,
    rating: 4.8,
    minimumOrder: 220,
    products: [
      ['Coctel de camaron', 'Cocteles', 'Camaron, catsup, aguacate y galletas.', 14500, 'coctel-camaron'],
      ['Ceviche de pescado', 'Ceviches', 'Pescado fresco con limon.', 12500, 'ceviche'],
      ['Tostada de atun', 'Tostadas', 'Atun fresco con salsa negra.', 11500, 'tostada-atun'],
      ['Tostada de camaron', 'Tostadas', 'Camaron, aguacate y pico de gallo.', 10500, 'tostada-camaron'],
      ['Aguachile verde', 'Aguachiles', 'Camaron en salsa verde picante.', 16500, 'aguachile'],
      ['Filete empanizado', 'Platillos', 'Filete con arroz y ensalada.', 15500, 'filete'],
      ['Camarones al mojo', 'Platillos', 'Camarones con ajo y mantequilla.', 18500, 'mojo-ajo'],
      ['Orden de arroz', 'Complementos', 'Arroz blanco con verduras.', 4500, 'arroz'],
      ['Michelada preparada', 'Bebidas', 'Preparada con salsas y limon.', 6500, 'michelada'],
      ['Agua mineral', 'Bebidas', 'Agua mineral fria.', 3000, 'agua-mineral'],
    ],
  },
  {
    ownerEmail: 'negocio8@rapiv.local',
    name: 'Pollo Dorado',
    description: 'Pollo rostizado, combos familiares y salsas.',
    address: 'Avenida Morelos',
    logoQuery: 'pollo-dorado',
    deliveryTime: 24,
    rating: 4.4,
    minimumOrder: 160,
    products: [
      ['Pollo entero', 'Pollos', 'Pollo rostizado con tortillas y salsa.', 18900, 'pollo-entero'],
      ['Medio pollo', 'Pollos', 'Medio pollo con guarnicion.', 10900, 'medio-pollo'],
      ['Cuarto de pollo', 'Pollos', 'Cuarto pierna o pechuga.', 6900, 'cuarto-pollo'],
      ['Combo familiar', 'Combos', 'Pollo entero, arroz, ensalada y refresco.', 25900, 'combo-familiar'],
      ['Alitas BBQ', 'Alitas', 'Alitas bañadas en BBQ.', 11900, 'alitas-bbq'],
      ['Nuggets de pollo', 'Complementos', 'Nuggets con aderezo.', 7900, 'nuggets'],
      ['Arroz rojo', 'Guarniciones', 'Arroz rojo casero.', 3500, 'arroz-rojo'],
      ['Ensalada de col', 'Guarniciones', 'Col cremosa estilo casa.', 3500, 'ensalada-col'],
      ['Tortillas extra', 'Extras', 'Paquete de tortillas calientes.', 1500, 'tortillas'],
      ['Salsa macha', 'Extras', 'Salsa macha artesanal.', 2000, 'salsa-macha'],
    ],
  },
  {
    ownerEmail: 'negocio9@rapiv.local',
    name: 'Verde Bowl',
    description: 'Ensaladas, bowls saludables y jugos naturales.',
    address: 'Zona Centro',
    logoQuery: 'verde-bowl',
    deliveryTime: 21,
    rating: 4.6,
    minimumOrder: 130,
    products: [
      ['Bowl de pollo', 'Bowls', 'Pollo, arroz, verduras y aderezo.', 11900, 'bowl-pollo'],
      ['Bowl vegetariano', 'Bowls', 'Garbanzo, quinoa y vegetales.', 10900, 'bowl-veggie'],
      ['Ensalada griega', 'Ensaladas', 'Pepino, jitomate, aceituna y queso.', 9800, 'ensalada-griega'],
      ['Ensalada pollo chipotle', 'Ensaladas', 'Pollo, lechuga y aderezo chipotle.', 11500, 'ensalada-chipotle'],
      ['Wrap de atun', 'Wraps', 'Atun, verduras y tortilla integral.', 9900, 'wrap-atun'],
      ['Wrap de pollo', 'Wraps', 'Pollo, queso panela y vegetales.', 10500, 'wrap-pollo'],
      ['Jugo verde', 'Jugos', 'Piña, apio, espinaca y limon.', 5500, 'jugo-verde'],
      ['Jugo naranja', 'Jugos', 'Naranja natural recien exprimida.', 5000, 'jugo-naranja'],
      ['Parfait granola', 'Postres', 'Yogurt, fruta y granola.', 6500, 'parfait'],
      ['Agua alcalina', 'Bebidas', 'Agua embotellada alcalina.', 2800, 'agua-alcalina'],
    ],
  },
  {
    ownerEmail: 'negocio10@rapiv.local',
    name: 'Dulce Rincon',
    description: 'Postres, helados y bebidas dulces.',
    address: 'Calle Juarez 18',
    logoQuery: 'dulce-rincon',
    deliveryTime: 19,
    rating: 4.9,
    minimumOrder: 80,
    products: [
      ['Waffle fresa', 'Waffles', 'Waffle con fresas y crema.', 8900, 'waffle-fresa'],
      ['Crepa nutella', 'Crepas', 'Crepa con nutella y platano.', 8500, 'crepa-nutella'],
      ['Helado vainilla', 'Helados', 'Dos bolas de vainilla.', 4900, 'helado-vainilla'],
      ['Helado chocolate', 'Helados', 'Dos bolas de chocolate.', 4900, 'helado-chocolate'],
      ['Brownie', 'Postres', 'Brownie tibio con nuez.', 6500, 'brownie'],
      ['Cheesecake', 'Postres', 'Rebanada de cheesecake.', 7500, 'cheesecake'],
      ['Fresas con crema', 'Postres', 'Fresas naturales con crema.', 7000, 'fresas-crema'],
      ['Malteada chocolate', 'Bebidas', 'Malteada espesa de chocolate.', 6900, 'malteada-chocolate'],
      ['Frappé caramelo', 'Bebidas', 'Frappé frio con caramelo.', 7200, 'frappe'],
      ['Churros con cajeta', 'Postres', 'Churros crujientes con cajeta.', 5900, 'churros'],
    ],
  },
] as Array<Omit<SeedBusiness, 'products'> & {
  products: Array<[string, string, string, number, string]>;
}>).map((business) => ({
  ...business,
  products: business.products.map(([name, category, description, priceCents, imageQuery]) => ({
    name,
    category,
    description,
    priceCents,
    imageQuery,
  })),
}));

async function upsertUser(userRepository: Repository<User>, input: SeedUser, passwordHash: string) {
  const existing = await userRepository.findOne({ where: { email: input.email } });

  if (existing) {
    existing.username = input.username;
    existing.fullName = input.fullName;
    existing.roles = input.roles;
    return userRepository.save(existing);
  }

  return userRepository.save(userRepository.create({ ...input, passwordHash }));
}

async function upsertBusiness(
  businessRepository: Repository<Business>,
  ownerUserId: string,
  input: SeedBusiness
) {
  const existing = await businessRepository.findOne({ where: { name: input.name } });
  const business = existing ?? businessRepository.create();

  business.ownerUserId = ownerUserId;
  business.name = input.name;
  business.description = input.description;
  business.address = input.address;
  business.logo = businessImageUrl(input.logoQuery);
  business.rating = input.rating;
  business.deliveryTime = input.deliveryTime;
  business.minimumOrder = input.minimumOrder;
  business.isOpen = true;
  business.latitude = 20.0289;
  business.longitude = -96.6472;

  return businessRepository.save(business);
}

async function upsertProduct(
  productRepository: Repository<Product>,
  businessId: string,
  input: SeedProduct
) {
  const existing = await productRepository.findOne({ where: { businessId, name: input.name } });
  const product = existing ?? productRepository.create();

  product.businessId = businessId;
  product.name = input.name;
  product.description = input.description;
  product.category = input.category;
  product.priceCents = input.priceCents;
  product.image = productImageUrl(input.imageQuery);
  product.available = true;
  product.stock = 100;

  return productRepository.save(product);
}

async function seed() {
  await AppDataSource.initialize();

  try {
    const userRepository = AppDataSource.getRepository(User);
    const businessRepository = AppDataSource.getRepository(Business);
    const productRepository = AppDataSource.getRepository(Product);
    const passwordHash = hashPassword('password');
    const usersByEmail = new Map<string, User>();

    for (const user of seedUsers) {
      usersByEmail.set(user.email, await upsertUser(userRepository, user, passwordHash));
    }

    let productCount = 0;

    for (const businessInput of businesses) {
      const owner = usersByEmail.get(businessInput.ownerEmail);

      if (!owner) {
        throw new Error(`Missing owner ${businessInput.ownerEmail}`);
      }

      const business = await upsertBusiness(businessRepository, owner.id, businessInput);

      for (const productInput of businessInput.products) {
        await upsertProduct(productRepository, business.id, productInput);
        productCount += 1;
      }
    }

    console.log(`Seed completado: ${businesses.length} negocios y ${productCount} productos disponibles.`);
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
