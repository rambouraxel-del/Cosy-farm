// Données d'équilibrage et constantes du jeu. Aucune logique ici.
export const SAVE_VERSION = 2;
export const MAX_ENERGY = 15;
export const ENERGY_MS = 10 * 60 * 1000; // 1 énergie / 10 minutes réelles
export const START_COINS = 280;
export const WEEK = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export const EGG_REF_PRICE = [3, 4, 5]; // prix de référence hebdomadaire possible
export const FEED_BAG = { price: 10, rations: 20 };
export const FEEDER_CAPACITY = 40;
export const WATER_CAPACITY = 30;
export const CARE_PRICE = 16;
export const MAX_HENS = 30;

export const GROW_AGE = 18; // un poussin devient jeune poule
export const LAY_AGE = 20; // âge minimum de ponte
export const BROOD_DAYS = 7; // jours de couvaison avant éclosion
export const OLD_AGE = 1500; // âge à partir duquel la mortalité naturelle (si activée) s'applique
export const PET_CAP = { affection: 4, trust: 3 }; // gains quotidiens maximum

// Bâtiments. Les niveaux 2 et 3 sont des extensions payantes.
export const BUILDINGS = {
  pen: {
    name: "Enclos",
    desc: "Délimite l'espace des poules. Agrandissable.",
    levels: [
      { price: 35, half: 5, cap: 8 },
      { price: 50, half: 7, cap: 14 },
      { price: 90, half: 9, cap: 22 },
    ],
  },
  coop: {
    name: "Poulailler",
    desc: "Abri de nuit avec des nids de ponte. Agrandissable.",
    levels: [
      { price: 95, cap: 6, nests: 3 },
      { price: 110, cap: 10, nests: 5 },
      { price: 180, cap: 14, nests: 7 },
    ],
    size: [1.9, 1.7],
  },
  feeder: { name: "Mangeoire", desc: "Contient les graines des poules.", levels: [{ price: 25 }], size: [1.0, 0.8] },
  water: { name: "Abreuvoir", desc: "Contient l'eau fraîche.", levels: [{ price: 20 }], size: [1.0, 0.8] },
};

export const ANIMALS = {
  rescue: { name: "Poule de réforme", price: 18, age: [540, 700], desc: "Âgée, attachante, ponte rare." },
  young: { name: "Jeune poule", price: 40, age: [20, 26], desc: "Pond dès les premières nuits." },
  chick: { name: "Poussin", price: 15, age: [2, 4], desc: "Pond après environ 2 semaines." },
};

// Personnalités : multiplicateurs appliqués aux comportements.
export const TRAITS = {
  curieuse: { label: "Curieuse", trust: 1.2, aff: 1, appetite: 1, stress: 1, social: 1, explore: 1.6 },
  timide: { label: "Timide", trust: 0.6, aff: 0.9, appetite: 1, stress: 1.4, social: 0.8, explore: 0.5 },
  gourmande: { label: "Gourmande", trust: 1, aff: 1.1, appetite: 1.25, stress: 1, social: 1, explore: 1 },
  sociable: { label: "Sociable", trust: 1.1, aff: 1.2, appetite: 1, stress: 1, social: 1.4, explore: 1 },
  calme: { label: "Calme", trust: 1, aff: 1, appetite: 0.9, stress: 0.6, social: 0.9, explore: 0.7 },
  indépendante: { label: "Indépendante", trust: 0.9, aff: 0.7, appetite: 1, stress: 0.9, social: 0.4, explore: 1.3 },
};

export const HEN_NAMES = [
  "Marguerite", "Praline", "Plume", "Cannelle", "Noisette", "Colette", "Rosie", "Pistache",
  "Mirabelle", "Caramel", "Perle", "Poppy", "Fleur", "Clémentine", "Suzette", "Gaufrette",
  "Violette", "Câline", "Tartine", "Bobinette", "Églantine", "Madeleine", "Bluette", "Zinnia",
  "Nougat", "Capucine", "Mimosa", "Brindille", "Pâquerette", "Réglisse",
];
export const CUSTOMER_NAMES = [
  "Mme Lemoine", "M. Garnier", "Camille", "Sacha", "Mamie Odette", "Le boulanger", "Inès", "Léo",
  "M. Bouvier", "Nora", "La voisine", "Tom", "Mme Perrin", "Yanis", "Chloé", "Papi René",
];
export const SYMPTOMS = ["tousse un peu", "a les plumes ternes", "boite légèrement", "est fatiguée", "a l'œil qui coule"];
