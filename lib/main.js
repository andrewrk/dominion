var dominion = require('./dominion');

var args = processCommandLineArgs();
console.log("seed: " + args.seed);

var game = new dominion.DominionGame(args.players, args.seed);
game.on('reveal', function(player, cardName) {
  console.log(dominion.playerName(player) + " reveals " + cardName);
});
game.on('revealCardsFromDeck', function(player, revealedCards) {
  console.log(dominion.playerName(player) + " reveals from deck " + deckToString(revealedCards));
});
game.on('revealHand', function(player) {
  console.log(dominion.playerName(player) + " reveals hand");
});
game.on('putOnDeck', function(player, cardName) {
  console.log(dominion.playerName(player) + " puts on deck " + cardName);
});
game.on('gameOver', function(players) {
  var i;
  console.log("\nGame Log:");
  for (i = 0; i < game.log.length; i += 1) {
    var logEntry = game.log[i];
    var playerName;
    if (logEntry.name === 'shuffle') {
      playerName = dominion.playerName(game.players[logEntry.params.player]);
      console.log(playerName + " shuffle");
    } else if (logEntry.name === 'move') {
      playerName = dominion.playerName(game.players[logEntry.params.player]);
      console.log(playerName + " " + dominion.moveToString(logEntry.params.move));
    } else {
      console.log(logEntry.name);
    }
  }
  console.log("\nScore:");
  for (i = 0; i < players.length; i += 1) {
    var player = players[i];
    console.log(player.rank + " " + dominion.playerName(player) + " VP: " + player.vp + " turns: " + player.turnCount);
  }
  setImmediate(function() {
    process.exit(0);
  });
});
game.on('draw', function(player, count) {
  console.log(dominion.playerName(player) + " draws " + count + " cards");
});
game.on('gainCard', function(player, cardName, topOfDeck, intoHand) {
  var topOfDeckText = topOfDeck ? " on top of deck" : "";
  var intoHandText = intoHand ? " into hand" : "";
  console.log(dominion.playerName(player) + " gains a " + cardName + topOfDeckText + intoHandText);
});

mainLoop(game);

function mainLoop(game) {
  printGameState(game);
  var player = game.getCurrentPlayer();
  var moveList = game.enumerateMoves();
  printPossibleMoves(moveList);
  if (moveList.length === 0) {
    throw new Error("no move possible");
  }
  var onMoveChosenCalled = false;
  if (moveList.length === 1) {
    onMoveChosen(null, moveList[0]);
  } else {
    player.ai.chooseMove(dominion.dominion, game, moveList, onMoveChosen);
  }
  function onMoveChosen(err, move) {
    if (onMoveChosenCalled) throw new Error("callback called twice");
    onMoveChosenCalled = true;
    if (err) throw err;
    if (!move) throw new Error("invalid move");
    console.log(dominion.playerName(player) + " chooses: " + dominion.moveToString(move));
    game.performMove(move);
    setImmediate(function() {
      mainLoop(game);
    });
  }
}

function processCommandLineArgs() {
  var args = {
    players: [],
    seed: +(new Date()),
  };
  var aiNames = [];
  var i, aiName;
  for (i = 2; i < process.argv.length; i += 1) {
    var arg = process.argv[i];
    if (/^--/.test(arg)) {
      if (i + 1 >= process.argv.length) argParseError("expected argument after " + arg);
      var nextArg = process.argv[++i];
      if (arg === '--player') {
        aiNames.push(nextArg);
      } else if (arg === '--seed') {
        args.seed = parseInt(nextArg, 10);
        if (isNaN(args.seed)) argParseError("invalid seed");
      } else {
        argParseError("unrecognized argument: " + arg);
      }
    } else {
      argParseError("unrecognized argument: " + arg);
    }
  }
  if (aiNames.length < 2 || aiNames.length > 4) {
    argParseError("Dominion is 2-4 players. Use a correct number of --player arguments.");
  }
  for (i = 0; i < aiNames.length; i += 1) {
    aiName = aiNames[i];
    var ai = dominion.ais[aiName];
    if (!ai) {
      argParseError("Invalid AI name: " + aiName);
    }
    args.players.push(ai);
  }
  return args;
}

function argParseError(msg) {
  console.error("Usage: " + process.argv[0] + " " + process.argv[1] + " [--player <AI_Name>] [--seed <seed>]");
  console.error("AIs available:\n  " + Object.keys(dominion.ais).join("\n  "));
  console.error("Sets available:")
  for (var i = 0; i < dominion.dominion.setList.length; i += 1) {
    console.error("  " + dominion.dominion.setList[i].name);
  }
  console.error(msg);
  process.exit(1);
}

function printPossibleMoves(moveList) {
  console.log("Possible moves:");
  for (var i = 0; i < moveList.length; i += 1) {
    var move = moveList[i];
    console.log("(" + (i + 1) + ") " + dominion.moveToString(move));
  }
  if (moveList.length === 0) {
    console.log("(none)");
  }
}

function printGameState(state) {
  console.log("");
  console.log("Round " + (state.roundIndex + 1) + ", turn " + (state.turnIndex + 1));
  var i;
  for (i = 0; i < state.cardList.length; i += 1) {
    var gameCard = state.cardList[i];
    console.log("(" + gameCard.card.cost + ") " + gameCard.count + "_" + gameCard.card.name);
  }
  console.log("Trash: " + deckToString(state.trash, true));
  for (i = 0; i < state.players.length; i += 1) {
    var player = state.players[i];
    var vp = state.calcVictoryPoints(player);
    var cardCount = state.playerCardCount(player);
    console.log(dominion.playerName(player) + " (" + vp + " victory points, " + cardCount + " cards):");
    console.log("      revealed: " + deckToString(player.revealedCards, false));
    console.log("       in play: " + deckToString(player.inPlay, false));
    console.log("          deck: " + deckToString(player.deck, true));
    console.log("          hand: " + deckToString(player.hand, true));
    console.log("  discard pile: " + deckToString(player.discardPile, true));
  }
  console.log("Waiting for " + dominion.playerName(state.getCurrentPlayer()) + " to " + state.stateIndexToString());
  console.log("Actions: " + state.actionCount +
           "   Buys: " + state.buyCount +
           "   Treasure: " + state.treasureCount);
}

function deckToString(deck, compress) {
  if (deck.length === 0) return "(empty)";
  if (!compress) {
    return deck.map(dominion.getCardName).join(" ");
  }
  var counts = {};
  for (var i = 0; i < deck.length; i += 1) {
    var card = deck[i];
    counts[card.name] = (counts[card.name] == null) ? 1 : (counts[card.name] + 1);
  }
  var names = Object.keys(counts);
  names.sort(compare);
  for (i = 0; i < names.length; i += 1) {
    var count = counts[names[i]];
    if (count > 1) {
      names[i] = counts[names[i]] + "_" + names[i];
    }
  }
  return names.join(" ");
}

function compare(a, b){
  if (a === b) {
    return 0;
  } else if (a < b) {
    return -1;
  } else {
    return 1;
  }
}
