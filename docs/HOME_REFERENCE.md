# Home Reference — Moke's House

How the real home (private photos in `reference/home/`, never shipped) becomes the game's connected home. The aim is
**"this feels like our house"**, not an architectural survey: layout, landmarks, colours and dog-height details, in
the game's stylized look. Sizes below are estimates from the photos (furniture of known size, door heights, floor
tiles), not measurements.

## The photos (Phase 4, 2026-09-25)
| File | Shows |
|---|---|
| `family-room/fireplace-tv-wall.jpg` | Fireplace wall: white mantel and raised hearth, big TV above, white built-in shelves, window with the beige couch under it, a monstera in a woven basket, Moke's bowls, toy basket, ukulele |
| `family-room/sectional-and-window-couch.jpg` | The corner: cream sectional (left), beige couch under two windows (right), big monstera, tower fan, white step stool, dark coffee table |
| `family-room/sectional-interior-windows.jpg` | The cream sectional with chaise against three interior windows (the gym room behind), the pink blanket on the floor by the chaise, the dining room through the opening at left |
| `kitchen/kitchen-overview.jpg` | White kitchen: tall wall (microwave over drawers, stainless fridge, double oven), range wall with hood and arabesque tile, big white island with turned legs and five white stools, crystal chandelier; the front hallway and dining room at right |
| `dining-room/dining-room.jpg` | Long whitewashed trestle table, beige upholstered chairs, round crystal chandelier, dark sideboard and two wine fridges with a mirror above, window, big Roman-numeral clock, TV on a stand, plants, sliding doors with white curtains, white wainscoting |
| `connections/island-to-dining-and-hall.jpg` | From the island: the front hallway opening, the wide opening to the dining room, the sectional's interior window |
| `connections/front-door-hallway.jpg` | From the dining table: the front-door hallway between the kitchen (range side) and the dining sideboard |
| `connections/fireplace-hall-kitchen.jpg` | From the fireplace: the bedroom hallway (door with an "I love you all" sign), the kitchen's tall wall, the island |
| `connections/panorama.jpg` | The whole great room in one sweep: couch and window, fireplace, bedroom hall, kitchen, dining room, sectional |

## The real layout (as best the photos show)
One open **great room**: the **family room** and **kitchen** share one space (a soffit/beam marks the boundary); the
**dining room** opens off the kitchen through a wide cased opening; the **front-door hallway** leaves from the
kitchen–dining junction; the **bedroom hallway** leaves from the fireplace wall. In real compass terms (inferred):

```
            N
  built-ins | fireplace+TV | bedroom hall |  kitchen tall wall (microwave · fridge · ovens)
  window                                 |                                          range wall (E):
  + beige   FAMILY ROOM        coffee    |   KITCHEN      [ island + 3 stools ]     counters, range, hood
  couch (W)                    table     |                                          ── front-door hallway → E
  window                                 |
  sectional + interior windows (S)       |   DINING ROOM (S of kitchen): sideboard + wine fridges (E),
  [gym / sunroom behind, not modelled]   |   window + clock + TV (S), sliding doors + curtains (W)
```

## How the game uses it
The existing **living room** (Phases 1–3) stays as the front of the house: it isn't in these photos, so it keeps
its design. **Its hallway becomes the front-door hallway**: the closed door at its end is replaced by an opening
into the great room, where the real hallway meets the kitchen and dining room. To make that join work, the new wing
is placed **rotated 180°** from real north (a rotation, never a mirror, so every "fridge left of the ovens"
relationship stays true). Game coordinates (metres; x east, z south; the living room spans x −3.5…3.5, z −3…3):

| Area | Game extent (x, z; interior faces) | Real-life match |
|---|---|---|
| Hallway (existing) | x 3.5…6.74, z 0.6…1.6 | front-door hallway |
| Kitchen | x 6.74…11.7, z 0.51…5.4 | kitchen |
| Family room | x 11.7…16.9, z 0.51…5.4 | family room (open to the kitchen; a ceiling soffit marks the line) |
| Dining room | x 6.74…10.9, z −4.2…0.39 | dining room, through a 2.9 m cased opening from the kitchen |
| Sunroom (seen only) | x 11.0…16.9, z −4.2…0.39 | the gym/sunroom behind the interior windows and the sliders |

(These are what was built, in `src/world/home/layout.ts`; the dining room ended up 0.3 m deeper than first sketched,
so the human and Moke can get round the ends of the table.)

In the game, walking out of the hallway: the dining room is on your left (north), the kitchen on your right
(south), and the family room straight ahead beyond the island, just as walking in from the real front door.

## Room by room

### Family room (x 11.6…16.8)
- **Fireplace wall** (game south wall, facing north): white mantel with a deep shelf, dark firebox with gas logs,
  raised white hearth; a large black TV above; **white built-in shelves** (east of it) with frames, small plants,
  cabinets below; the **bedroom hallway opening** at its west end with a door and a hand-painted "I love you all"
  sign. **Moke's bowls** (blue slow-feeder, steel water bowl) and a rose-gold **wire toy basket** by the hearth; a
  ukulele leaning on the built-ins.
- **Window wall** (game east): two tall windows with white frames and blinds half-raised, garden beyond; the
  **beige three-seat couch** under them with grey/white trellis-pattern pillows and a knitted throw.
- **Sectional wall** (game north): three **interior windows** (the gym room behind: dim, not modelled) above a
  **cream sectional**, long side along the wall, **chaise at the kitchen end**, fluffy cream throws and pillows;
  **Moke's pink blanket** on the floor at the chaise's end.
- Corners: big **monsteras in woven baskets**; a white tower fan and a white step stool in the sectional/couch
  corner.
- Middle: **dark rustic wood coffee table** with drawers and a lower shelf of books.
- Colours: soft **sage-grey walls** (#a9b7ad), white trim and crown moulding, grey-beige wood-look plank floor.

### Kitchen (x 6.6…11.6)
- **Tall wall** (game south): microwave built in above a stack of drawers, stainless French-door fridge, stainless
  double wall oven, white cabinets to the ceiling with crown moulding.
- **Range wall** (game west, beside the hallway): white shaker cabinets, glass-front uppers, white quartz counters,
  white subway-tile backsplash with a **grey-and-white arabesque tile panel** behind the **range** (red knobs) and
  its stainless **hood**; small appliances (coffee maker, rice cooker).
- **Island**: very large, white, with **turned legs** at the corners, a thick white quartz top, a sink with a tall
  faucet, glass jars of monstera cuttings; **five white upholstered counter stools** with dark legs (three on the
  family-room side, one at each end); a **rectangular crystal chandelier** above. *In the game: only the three on
  the family-room side (the owner had the end stools removed, 2026-09-25).*
- Walls: warm greige (#cfc5b6). Food things happen here.

### Dining room (x 6.6…10.8)
- **Table**: long (≈2.6 m) whitewashed-oak trestle table with an X base; **beige upholstered chairs** with dark
  legs, armchairs at the ends; a flower arrangement in the middle; a **round crystal chandelier**. *In the game:
  three chairs along each side, no armchairs at the ends (removed at the owner's request, 2026-09-25).*
- **Sideboard wall** (game west): dark carved sideboard and **two stainless wine fridges**, bottles on top, a
  **bevelled mirror** above, trailing plants.
- **Window wall** (game north): window with blinds, a **large black Roman-numeral clock**, a TV on a rolling
  stand, potted plants.
- **Slider wall** (game east): tall sliding glass doors with **white curtains** on a black rod.
- **White wainscoting** on the lower walls, sage walls above.

## Scale (estimates)
| Thing | Size |
|---|---|
| Ceiling | 2.6 m (matches the living room) |
| Beige couch | 2.3 m long, seat 0.45 m |
| Sectional | ≈3.2 m long + 1.6 m chaise, seat 0.45 m |
| Coffee table (family) | 1.3 × 0.7 m, 0.47 m high |
| Island | ≈2.6 × 1.3 m, 0.92 m high |
| Counter stools | seat 0.65 m |
| Dining table | ≈2.6 × 1.0 m, 0.76 m high; chairs seat 0.47 m |
| Fridge | 0.92 m wide, 1.78 m high |
| Fireplace surround | ≈1.6 m wide, mantel at 1.25 m; TV ≈1.45 m wide |
| Doorways / openings | 2.05–2.2 m high; dining opening ≈3 m wide |

## Moke-scale features
Dog height is where the fun is:
- **under the dining table** among the chair legs (and under the chairs' seats);
- the gap **under the island's overhang** between the stools' legs;
- **Moke's pink blanket** by the chaise, and his bowls by the hearth (food lives here);
- the **hearth** step and the toy basket;
- behind the coffee table, round the fan and step stool;
- the couches (he can jump onto their seats: 0.45 m) and the family coffee table;
- sunbeams through the windows on the floor (a nap spot).

## What the game built (Phase 4)
All in code (`src/world/home/`), stylized, from the photos above; nothing from the photos is used as a texture.
- **Family room:** the fireplace (white surround, raised hearth Moke can hop onto, a low gas fire, the TV above), the
  built-ins with frames, books, plants and a lamp, the ukulele, the rose-gold toy basket on the hearth, Moke's bowls
  (blue slow feeder, steel water bowl) on a mat, the cream sectional with its chaise and throws, the pink blanket, the
  beige couch with trellis pillows under two windows (a drawn sun patch on it and the floor: the nap spot), the dark
  rustic coffee table with its drawers and shelf of books, two monsteras in woven baskets, the tower fan and step
  stool, the bedroom-hall door with the hand-painted "I love you all" sign, three interior windows into the sunroom.
- **Kitchen:** white shaker cabinets with glass-front uppers, quartz counters, subway tile with the arabesque panel
  behind the stainless range (red knobs) and chimney hood, the tall wall (double ovens, French-door fridge,
  microwave over drawers), the big island with turned legs, a sink, jars of monstera cuttings and a fruit bowl, three
  white upholstered stools along the family-room side, the rectangular crystal chandelier; a coffee maker and rice
  cooker; a treat jar on the counter (**invented:** where the real treats live isn't in the photos).
- **Dining room:** the whitewashed trestle table with flowers, six beige side chairs (no end chairs), the round
  crystal chandelier, the dark carved sideboard between two wine fridges with bottles and the bevelled mirror, the
  window, the big Roman-numeral clock, the TV on its rolling stand, plants, sliding doors with white curtains, white
  wainscoting.
- **Dog-scale:** under the dining table (and between the chairs), under the island's overhang between the stools, up
  on the sofas and the hearth, the pink blanket, round the fan and stool. Moke can't reach the island, counters,
  stools, table, sideboard or mantel (the jump cap, D17). 20 navigation tests pin this.
- **Signs of life:** the TV glows while it's on, a pot steams on the range while dinner cooks, a plate appears at the
  table.

## Uncertain
- The exact room sizes and where walls meet: estimated from photos with wide-angle distortion.
- Whether the kitchen's tall wall and the fireplace wall are in line (the game puts them in line).
- What exactly is behind the sectional's interior windows (a gym/sunroom with its own fireplace) and beyond the
  dining room's sliders (the same space or a patio): the game shows a dim room and a garden, not playable.
- The island's under-side (open between legs, or cabinets): the game gives it a cabinet body with an overhang on
  the stool side.
- The living room in the game is the Phase 1 room, not the real one.

## References that would help
- A photo of the **real front living room** (if there is one) and of the **front door** area, to make the existing
  living room and hallway match.
- Rough **measurements** (or a floor plan) of the great room and dining room.
- The **bedroom hallway** and the **gym/sunroom** behind the interior windows, if they should ever be playable.
- A view of the **island's far side** (sink side) and the **kitchen's hallway corner**.
