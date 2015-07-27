# Dominion

Node.js module and command line program to play Dominion, the card game by
Donald X. Vaccarino.

## Features

 * Shuffler picks random cards to play with.
 * Supports Base Set. Other sets in progress.
 * You can choose CLI to play a command line interface game against an AI.
 * [Big Money strategy](http://wiki.dominionstrategy.com/index.php/Big_Money) is implemented.
 * Naive strategy - play +Actions first, then action cards, then buy the most
   expensive card, choosing randomly when there is a tie. Never buy Curses.
   Tries to do the best thing given the available moves, but does no planning
   or reacting to opponent.

## Command Line Usage

```
Usage: dominion-cli [--player <AI_Name>] [--seed <seed>]
AIs available:
  naive
  bigmoney
  cli
Sets available:
  Base Set
  Intrigue
  Adventures
Dominion is 2-4 players. Use a correct number of --player arguments.
```

## Node.js Module Usage

See lib/main.js for API example. Documentation is prioritized after getting
all the cards from all the sets working.
