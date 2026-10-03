# Home Reference — Moke's House (in the game)

The game's connected house: its layout, what's in each room, sizes and the dog-height details. It's a cozy,
stylized family home, built entirely in code (`src/world/home/`, `src/world/Home.ts`) with no image textures. Private
reference photos (`reference/home/`) stay local and are never shipped (see `AGENTS.md`).

## Layout
The **living room** (Phases 1–3) is the front of the house. **Its hallway** opens into a **great room**: the
**kitchen** and **family room** share one open space (a ceiling soffit marks the line), the **dining room** opens
off the kitchen through a wide cased opening, and the **home gym** opens off the dining room. Game coordinates
(metres; x east, z south; the living room spans x −3.5…3.5, z −3…3):

| Area | Game extent (x, z; interior faces) | Notes |
|---|---|---|
| Hallway | x 3.5…6.74, z 0.6…1.6 | the small bathroom opens off it |
| Kitchen | x 6.74…11.7, z 0.51…5.4 | open to the family room |
| Family room | x 11.7…16.9, z 0.51…5.4 | |
| Dining room | x 6.74…10.9, z −4.2…0.39 | through a 2.9 m cased opening from the kitchen |
| Home gym | x 11.0…16.9, z −4.2…0.39 | open from the dining room; big glass doors onto the backyard (scenery) |

(As built in `src/world/home/layout.ts`; the dining room is deep enough for the human and Moke to get round the
ends of the table.) Walking out of the hallway: the dining room is on your left (north), the kitchen on your right
(south), and the family room straight ahead beyond the island.

## Room by room

### Family room
- **Fireplace wall** (south): a white surround with a deep mantel, a dark firebox with a low gas fire, a raised
  white hearth Moke can hop onto, and a big TV above; **white built-in shelves** beside it with frames, books, plants
  and a lamp; a ukulele; the bedroom-hall door with a hand-painted sign.
- **Window wall** (east): two tall windows looking onto the backyard; a **beige three-seat couch** under them with
  trellis-pattern pillows (a sun patch on it and the floor: a nap spot).
- **Sectional wall** (north): three **interior windows** into the gym above a **cream sectional** with its chaise at
  the kitchen end, throws and pillows; a white two-step stool beside it.
- **Moke's things:** his bowls (a blue slow feeder and a steel water bowl) on a mat, a rose-gold wire toy basket on
  the hearth, a pink dog bed in front of the fire (a nap spot), the squeaky fish toy on the floor.
- **Middle:** a dark rustic coffee table with drawers and a lower shelf of books, a little east of centre so there's
  a way past it. Monsteras in woven baskets, a tower fan.
- Colours: soft **sage-grey walls** (#a9b7ad), white trim and crown moulding, a grey-beige plank floor (the same
  floor runs through the whole house).

### Kitchen
- **Tall wall** (south): a microwave over a stack of drawers, a stainless French-door fridge, a stainless double
  wall oven, white cabinets to the ceiling.
- **Range wall** (west, beside the hallway): white shaker cabinets with glass-front uppers, white quartz counters,
  subway tile with a grey-and-white arabesque panel behind the **range** (red knobs) and its stainless **hood**; a
  coffee maker, a rice cooker, and the **treat jar**.
- **Island**: big and white, with turned legs, a quartz top, a sink, jars of monstera cuttings and a fruit bowl;
  **three white upholstered stools** on the family-room side; a rectangular crystal chandelier above.
- Walls: warm greige (#cfc5b6). Food things happen here.

### Dining room
- **Table:** a long (≈2.6 m) whitewashed trestle table with an X base and flowers; three **beige upholstered
  chairs** along each side; a round crystal chandelier.
- **Sideboard wall** (west): a dark carved sideboard between **two wine fridges**, bottles on top, a bevelled
  mirror above.
- **Window wall** (north): a window, a big Roman-numeral clock, a TV on a rolling stand, potted plants.
- **East wall:** the wide doorway into the gym.
- **White wainscoting** on the lower walls, sage above.

### Home gym and backyard
- **South wall:** a stationary bike facing the backyard, and a two-tier hex dumbbell rack with two kettlebells, on
  black rubber mats (`GYM` in `layout.ts`).
- **East wall:** big sliding glass doors (fixed pane / two sliders / fixed pane) in warm off-white frames
  (`OPENINGS.backyardDoors`). Solid: Moke can look, not go out.
- **Far corner, beside the glass:** Malibu the green-cheeked conure's flight cage on a stand, with perches, a swing,
  cups and toys (`ConureView`). A potted plant in the near corner.
- **The backyard (scenery only):** a flagstone patio, a stone BBQ island with a grill and covered bar chairs under a
  white umbrella, a long bench with pillows, an ottoman and two wicker lounge chairs under a big cantilever umbrella,
  pots with small trees, then lawn, hedges with bougainvillea, trees, a fence and sky.

## Scale
| Thing | Size |
|---|---|
| Ceiling | 2.6 m (matches the living room) |
| Beige couch | 2.3 m long, seat 0.45 m |
| Sectional | ≈3.4 m long + chaise, seat 0.45 m |
| Coffee table (family room) | 1.3 × 0.7 m, 0.45 m high |
| Island | ≈2.6 × 1.3 m, 0.92 m high |
| Counter stools | seat 0.65 m |
| Dining table | ≈2.6 × 1.0 m, 0.76 m high; chairs seat 0.47 m |
| Fridge | 0.92 m wide, 1.78 m high |
| Fireplace surround | ≈1.8 m wide, mantel at 1.3 m |
| Doorways / openings | 2.05–2.2 m high; dining opening ≈2.9 m wide |

## Moke-scale features
Dog height is where the fun is:
- **under the dining table** among the chair legs, and between the chairs;
- the gap **under the island's overhang** between the stools' legs;
- his pink bed by the fire, and his bowls (food lives here);
- the **hearth** step and the toy basket;
- behind the coffee table, round the fan and the step stool;
- up on the couches (their seats: 0.45 m) and the family coffee table;
- sunbeams on the floor and the couch (nap spots).

Moke can't reach the island, counters, stools, table, sideboard or mantel (the jump cap, D17); navigation tests in
`src/world/Home.test.ts` pin this.

## Signs of life
Each TV plays a different show, swapping now and then (`world/tv/`), and now and then a special broadcast takes over
all three; a pot steams on the range while dinner cooks, and a plate appears at the table.
