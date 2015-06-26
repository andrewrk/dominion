# Dominion

Playing around with text-based Dominion card game.

## What Does It Do

```
$ node lib/main.js
Usage: node dominion.js [--player <AI_Name>] [--seed <seed>]
AIs available: rando bigmoney cli
Dominion is 2-4 players. Use a correct number of --player arguments.
$ node dominion.js --player bigmoney --player bigmoney --seed 0
seed: 0

Round 1, turn 1
(0) x60 Copper
(0) x10 Curse
(2) x8 Estate
(2) x10 Moat
(3) x40 Silver
(3) x10 Village
(4) x10 Bureaucrat
(4) x10 Militia
(4) x10 Remodel
(4) x10 Smithy
(4) x10 Thief
(4) x10 Throne Room
(5) x8 Duchy
(5) x10 Festival
(5) x10 Witch
(6) x30 Gold
(8) x8 Province
Player 1 (3 victory points):
       in play: (empty)
          deck: Copper Copper Copper Copper Copper
          hand: Estate Copper Copper Estate Estate
  discard pile: (empty)
Player 2 (3 victory points):
       in play: (empty)
          deck: Copper Copper Copper Estate Copper
          hand: Copper Copper Copper Estate Estate
  discard pile: (empty)
Waiting for Player 1 to play an action, treasure, or buy a card
Actions: 1   Buys: 1   Treasure: 0
Possible moves:
(1) Play Copper
(2) Buy Copper
(3) Buy Curse
(4) End turn
Player 1 chooses: Play Copper

Round 1, turn 1
(0) x60 Copper
(0) x10 Curse
...
1st Player 2 VP: 27 turns: 23
2nd Player 1 VP: 27 turns: 24
```

 * You can choose CLI to play a command line interface game against an AI.
 * [Big Money strategy](http://wiki.dominionstrategy.com/index.php/Big_Money) is implemented.
 * Naive strategy - play +Actions first, then action cards, then buy the most
   expensive card, choosing randomly when there is a tie. Never buy Curses.
   Tries to do the best thing given the available moves, but does no planning
   or reacting to opponent.


## TODO

 * Base Set
   - ~Thief
   - ~Throne Room
   - Library
 * Refactor a bunch of states into `STATE_EFFECT` and have that one call the `doBlahEffect`
   functions directly. That will save a lot of boilerplate.
 * Add log and initial state so that we can completely reproduce a game
 * Web server so players can play each other or AIs.
