# Reveal

A casino decision lab. You play the hand, then see what the choice was worth before the next card was drawn.

## Blackjack

Deal from a shoe and choose hit, stand, double, split, or surrender before any price is shown. The ticket then prices every legal action from thousands of shuffles of the unseen cards. Later decisions inside those shuffles follow basic strategy for the rules on the table.

After 20 hands, the lesson lists the three spots where your choices gave up the most expected value. The line to remember: a correct decision can still lose.

Rules you can change: decks, dealer soft 17, double after split, late surrender, and blackjack paying 3:2 or 6:5. The lesson is saved in this browser.

## Baccarat

The question on the page is the simulator. Flat betting, Martingale, and following the shoe play identical shoes with the same bankroll, table limits, and walk-away rules. The chart is there to show how a system can win a lot of sessions and still lose money. Banker wins pay 95¢ on the dollar.

Under that, the shoe is read for memory. After each run of Banker or Player, the next hand is scored against the shoe’s usual rate, and a bet on the side of the run is priced per dollar. Ties push and do not break a run.

## Hold’em

Price a call against two ranges at once. The opening hand is a flush draw facing a half-pot bet: calling needs 25% equity. Tighten or widen either range and the two prices move with it.

## Run

```bash
npm install
npm test
npm run dev
```

Open the local URL Vite prints. `npm run build` typechecks and writes `dist/`.
