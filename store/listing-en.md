# Google Play listing — English (default)

## App name (max 30)

```
Sheep Meadow
```

## Short description (max 80)

```
A cosy match-3 puzzle. Every board is built to be solvable. Offline, no ads.
```

## Full description (max 4000)

```
Sheep Meadow is a quiet match-three puzzle set on a green hillside. Tap a tile that nothing is resting on, gather three of a kind, and empty the board.

EVERY LEVEL IS SOLVABLE — BY CONSTRUCTION, NOT BY LUCK

Most tile-matching games deal out a board and hope it works out. This one does it the other way round: it works out a valid clearing order first, then paints the colours and the special tiles along that order. Getting stuck is always a question of the order you picked, never a board that was impossible from the start.

That has a pleasant consequence. When you lose, the game still has the answer. Tap to watch the reference solution play out on your exact board, tile by tile.

The shuffle item works the same way. It re-solves whatever is left before reshuffling, so what you get back is still winnable. And if a board genuinely cannot be re-solved, it tells you plainly and does not spend your item.

FOUR WAYS TO PLAY

• Campaign — five chapters and fifty levels of designed progression, extending onward to two hundred. Every tenth level is a timed boss; each chapter has a treasure level as a breather.
• Daily Challenge — the same board for everyone, changing each day.
• Weekly Challenge — one rule twist per week: narrow slots, extra colours, fog, wide slots, frost, or blast.
• Endless Meadow — wave after wave, with a boon to pick between each one.

SIX KINDS OF GOAL

Clear the board, clear within a move limit, collect one colour, peel the top layers, rescue a sheep buried at the bottom, or race a timer. One generator, six different kinds of pressure.

ELEVEN SPECIAL TILES

Frozen tiles that need a neighbour cleared first. Chained tiles that open once you have matched enough. Double-layered tiles. Rainbow tiles with their own slots. Bombs that count down while they sit in your row. Mystery tiles with the face hidden. Supply tiles that arrive partway through. And four kinds that simply pay out when you clear them.

A MEADOW WORTH COMING BACK TO

Twenty-four sheep to collect, each with a small story and a passive of its own. Four things to build on your ranch. Thirty-six achievements and twelve titles. Four tile skins.

SHARE A BOARD WITH A FRIEND

Any run packs down into a six-character code. Send it over and your friend plays the exact same board — and the code can carry your time along with it, as a challenge to beat. No server is involved in any of this.

OFFLINE, AND QUIET ABOUT IT

The app asks for no network permission at all. Nothing is uploaded, nothing is collected, and there are no accounts. Your progress is saved on your device, which also means uninstalling the app or clearing its data will lose it.

No advertisements. No in-app purchases.

Available in English, 简体中文 and 繁體中文.
```

## Notes

- Do not mention 羊了个羊 anywhere in the listing. It is a well-known commercial title and
  referencing it risks Play's impersonation / intellectual-property policy.
- "Fifty levels of designed progression, extending onward to two hundred" is the honest
  framing: five chapters × ten levels are the tuned campaign, beyond that the generator
  interpolates up to level 200.
- The offline / no-permission claim is verifiable: the manifest declares no permissions at all
  (`aapt2 dump permissions` returns only the package name), and the build embeds every asset.
- Keep the last two lines accurate — if ads or purchases are ever added, they must be removed.
