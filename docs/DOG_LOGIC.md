# Dog Logic (Phase 4)

What Moke works out about the world, one little equation at a time. Phase 3 had one (SOCK = TREAT); Phase 4 makes it
a small system, lightweight on purpose: **every entry is backed by something he actually did**, nothing is a stat or
a score, and there's no menu of them to grind.

| Equation | How he learns it | Where |
|---|---|---|
| SOCK = TREAT | Trade the sock for a treat and eat it (Sock Heist) | `SockHeistController` |
| SNIFF = TREAT | Sniff out a hidden treat and eat it (Treat Hunt) | `TreatHunt` → `Game` |
| BED = NAP | Nap in his bed or his pink bed by the fire | `PerfectNap` |
| SUN + SOFT = NAP | Nap somewhere sunny and soft (his bed, the sunny couch) | `PerfectNap` |
| HUMAN + BALL = PLAY | Get the human to throw the ball (Make Human Play) | `MakeHumanPlay` |
| HUMAN + TOY = PLAY | Win tug-of-war with the rope toy | `MakeHumanPlay` |
| MOKE = STRONGEST | Hold the rope until the human gives up | `MakeHumanPlay` |
| BARK = ATTENTION | Bark at the human until they give in | `HumanReactions` → `Game` |
| KITCHEN = FOOD? | Hang about the stove while dinner cooks (3 s within 2.2 m) | `Game.updateDogActivities` |
| BARK = PROTECTOR | Bark at the ringing door and let the human receive the delivery | `DoorDelivery` → `Game` |
| BEG + KITCHEN = FOOD | Wait beside the chopping human, beg, then eat their carrot reward | `KitchenBeg` → `Game` |
| PILLOWS = FUN TO MOVE | Dig under the couch's throw pillows and toss them onto the floor | `PillowDig` → `Game` |
| MALIBU = FRIEND | Go up to the bird cage in the gym and "Play with Malibu": he stands on his hind legs, Malibu bounces and chirps | `Game.playWithMalibu` |

## How it works
- **Registry:** `config/dogLogic.ts` → `DOG_LOGIC`: an id (`'sun+soft=nap'`), the terms (word + icon) left of the
  "=", the result, and how it's learned. Adding one: an entry here, an icon in `index.html`'s sprite, and a
  `discover('id')` where it happens.
- **Memory:** `DogLogicMemory` (`heist/DogLogic.ts`, from Phase 3) remembers what he knows in this browser
  (`localStorage` key `imdog.dogLogic`); storage trouble just means he "rediscovers" things.
- **Announcing:** `DogLogicBook.discover(id, oncePerSession?)` (`activities/DogActivityDirector.ts`) learns it and
  emits `DOG_LOGIC_DISCOVERED`; the game shows the card: "Dog Logic!", the equation drawn from the entry (icons and
  words), and "Moke has learned something very important." the first time or "Still true. Moke checked." after.
  Several at once take turns. SOCK = TREAT and SNIFF = TREAT show each time they're re-earned (the moment is the
  point of those activities); the rest show once a session, so they don't nag.
- **Icons:** original SVG symbols in `index.html` (`icon-nose`, `icon-bed`, `icon-sun`, `icon-soft`, `icon-human`,
  `icon-ball`, `icon-toy`, `icon-kitchen`, `icon-food`, `icon-heart`, `icon-nap`, `icon-play`, plus Phase 3's sock,
  treat and bark).

## Not done (on purpose)
No list or collection screen yet, no progression, no rewards beyond the moment itself.
