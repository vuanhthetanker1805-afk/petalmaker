/**
 * Copied verbatim from Client/StaticData.cc:3-25 (0xAARRGGBB).
 * Index order is the RarityID enum in Shared/StaticDefinitions.hh.
 */
export const RARITY_COLORS: number[] = [
  0xff7eef6d, // Common    green
  0xffffe65d, // Unusual   yellow
  0xff4d52e3, // Rare      blue
  0xff861fde, // Epic      purple
  0xffde1f1f, // Legendary red
  0xff1fdbde, // Mythic    cyan
  0xffff2b75, // Ultra     pink
  0xfff70fb6, // Super     magenta
  0xffffb700, // Omega     orange
  0xffde1f65, // Unique    crimson
];

/** Client/StaticData.cc:9-11 -- yellow, grey, blue, red. */
export const FLOWER_COLORS: number[] = [
  0xffffe763, 0xff999999, 0xff689ce2, 0xffec6869,
];

export const RARITY_NAMES = [
  "Common",
  "Unusual",
  "Rare",
  "Epic",
  "Legendary",
  "Mythic",
  "Ultra",
  "Super",
  "Omega",
  "Unique",
] as const;

/** A few real petal fills from Petal.cc, handy as editor swatches. */
export const PALETTE: { name: string; c: number }[] = [
  { name: "Petal white", c: 0xffffffff },
  { name: "Petal grey", c: 0xffcfcfcf },
  { name: "Heavy grey", c: 0xffbbbbbb },
  { name: "Stinger black", c: 0xff333333 },
  { name: "Leaf green", c: 0xff39b54a },
  { name: "Golden", c: 0xffebeb34 },
  { name: "Rose pink", c: 0xffff94c9 },
  { name: "Egg cream", c: 0xfffff0b8 },
  { name: "Amber", c: 0xffe89b1c },
  { name: "Quartz", c: 0xffe8f0f5 },
  { name: "Outline dark", c: 0xff222222 },
];
