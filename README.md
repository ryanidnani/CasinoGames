# Reveal

A casino decision lab. You play the hand, then see what the choice was worth before the next card was drawn.

## Blackjack

Deal from a shoe and choose hit, stand, double, split, or surrender before any price is shown. The ticket then prices every legal action from thousands of shuffles of the unseen cards. Later decisions inside those shuffles follow basic strategy for the rules on the table.

After 20 hands, the lesson lists the three spots where your choices gave up the most expected value. The line to remember: a correct decision can still lose.

Rules you can change: decks, dealer soft 17, double after split, late surrender, and blackjack paying 3:2 or 6:5. Free bet matches a double on hard 9, 10, or 11 and a split of any pair except tens, and a dealer 22 pushes. No bust turns a player total over 21 into a push. The lesson is saved in this browser.

## Baccarat

The question on the page is the simulator. Flat betting, Martingale, and following the shoe play identical shoes with the same bankroll, table limits, and walk-away rules. The chart is there to show how a system can win a lot of sessions and still lose money. Banker wins pay 95¢ on the dollar.

Under that, a shoe shows its running mix: the percentage of Banker, Player, and Tie so far. The hands after a cutoff are scored against shoes that had the same opening mix, and a Banker bet on that remainder is priced per dollar.

## Hold’em

Price a call against two ranges at once. The opening hand is a flush draw facing a half-pot bet: calling needs 25% equity. Tighten or widen either range and the two prices move with it.

## Run

```bash
npm install
npm test
npm run dev
```

Open the local URL Vite prints. `npm run build` typechecks and writes `dist/`.
