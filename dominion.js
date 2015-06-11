var dominion = importAndProcessCards();
var RNG = require('./lib/rng');
var nextState = 0;
var STATE_ACTION = nextState++;
var STATE_TREASURE = nextState++;
var STATE_BUY = nextState++;
var STATE_DISCARD_THEN_DRAW = nextState++;
var STATE_GAIN_CARD = nextState++;
var STATE_PUT_CARDS_ON_DECK = nextState++;
var moveTable = {
  'play': doPlayCardMove,
  'buy': doBuyMove,
  'endTurn': doEndTurn,
  'discard': doDiscardMove,
  'doneDiscarding': doDoneDiscardingMove,
  'gain': doGainCardMove,
  'putOnDeck': doPutCardOnDeckMove,
};
var effectTable = {
  'plusAction': doPlusAction,
  'plusBuy': doPlusBuy,
  'plusTreasure': doPlusTreasure,
  'plusCard': doPlusCard,
  'discardThenDraw': doDiscardThenDraw,
  'gainCard': doGainCardEffect,
  'attackPutCardsOnDeck': doAttackPutCardsOnDeck,
  'trashThisCard': doTrashThisCardEffect,
  'revealHand': doRevealHandEffect,
};
var ais = {
  'rando': require('./lib/ai/rando'),
  'bigmoney': require('./lib/ai/bigmoney'),
  'cli': require('./lib/ai/cli'),
};

var args = processCommandLineArgs();
var state = shuffleAndDeal(args.players, args.seed);
console.log("seed: " + args.seed);
mainLoop(state);

function mainLoop(state) {
  printGameState(state);
  var player = getCurrentPlayer(state);
  var moveList = enumerateMoves(state);
  printPossibleMoves(moveList);
  if (moveList.length === 0) {
    throw new Error("no move possible");
  }
  if (moveList.length === 1) {
    onMoveChosen(null, moveList[0]);
  } else {
    player.ai.chooseMove(dominion, state, moveList, onMoveChosen);
  }
  function onMoveChosen(err, move) {
    if (err) throw err;
    if (!move) throw new Error("invalid move");
    console.log(playerName(player) + " chooses: " + moveToString(move));
    performMove(state, move);
    setImmediate(function() {
      mainLoop(state);
    });
  }
}

function moveToString(move) {
  switch (move.name) {
    case 'play':
      return "Play " + move.params.card;
    case 'buy':
      return "Buy " + move.params.card;
    case 'endTurn':
      return "End turn";
    case 'discard':
      return "Discard " + move.params.card;
    case 'doneDiscarding':
      return "Done discarding";
    case 'gain':
      return "Gain " + move.params.card;
    case 'putOnDeck':
      return "Put on deck " + move.params.card;
    default:
      throw new Error("moveToString case missing: " + move.name);
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
    var ai = ais[aiName];
    if (!ai) {
      argParseError("Invalid AI name: " + aiName);
    }
    args.players.push(ai);
  }
  return args;
}

function argParseError(msg) {
  console.error("Usage: " + process.argv[0] + " " + process.argv[1] + " [--player <AI_Name>] [--seed <seed>]");
  console.error("AIs available: " + Object.keys(ais).join(" "));
  console.error(msg);
  process.exit(1);
}

function enumerateMoves(state) {
  var moves = [];
  var player = getCurrentPlayer(state);

  switch (state.state) {
    case STATE_ACTION:
      enumerateActionMoves(true);
      enumerateBuyMoves();
      addEndTurn();
      break;
    case STATE_TREASURE:
      enumerateActionMoves(false);
      enumerateBuyMoves();
      addEndTurn();
      break;
    case STATE_BUY:
      enumerateBuyMoves();
      addEndTurn();
      break;
    case STATE_DISCARD_THEN_DRAW:
      addDiscardMoves();
      break;
    case STATE_GAIN_CARD:
      addGainCardMoves();
      break;
    case STATE_PUT_CARDS_ON_DECK:
      addPutCardsOnDeckMoves();
      break;
    default:
      throw new Error("invalid state");
  }
  return moves;

  function addPutCardsOnDeckMoves() {
    var matchingCardNames = getMatchingCardsInHand(state, player, {
      type: state.putCardsOnDeckType,
    });
    for (var i = 0; i < matchingCardNames.length; i += 1) {
      var cardName = matchingCardNames[i];
      moves.push({
        name: 'putOnDeck',
        params: {
          card: cardName,
        },
      });
    }
  }

  function addGainCardMoves() {
    var matchingCards = getMatchingCards(state, {
      costingUpTo: state.gainCardCostingUpTo,
      name: state.gainCardName,
      countGreaterEqual: 1,
    });
    for (var i = 0; i < matchingCards.length; i += 1) {
      var gameCard = matchingCards[i];
      moves.push({
        name: 'gain',
        params: {
          card: gameCard.card.name,
        },
      });
    }
  }

  function addEndTurn() {
    moves.push({ name: 'endTurn' });
  }

  function addDiscardMoves() {
    var seenActions = {};
    moves.push({ name: 'doneDiscarding' });
    for (var i = 0; i < player.hand.length; i += 1) {
      var card = player.hand[i];
      if (seenActions[card.name]) continue;
      seenActions[card.name] = true;
      moves.push({
        name: 'discard',
        params: {
          card: card.name,
        }
      });
    }
  }

  function enumerateActionMoves(includeNonTreasure) {
    var seenActions = {};
    for (var i = 0; i < player.hand.length; i += 1) {
      var card = player.hand[i];
      if ((includeNonTreasure && isCardType(card, 'Action')) || isCardType(card, 'Treasure')) {
        if (seenActions[card.name]) continue;
        seenActions[card.name] = true;
        moves.push({
          name: 'play',
          params: {
            card: card.name,
          },
        });
      }
    }
  }

  function enumerateBuyMoves() {
    for (var i = 0; i < state.cardList.length; i += 1) {
      var gameCard = state.cardList[i];
      if (gameCard.count > 0 && state.treasureCount >= gameCard.card.cost) {
        moves.push({
          name: 'buy',
          params: {
            card: gameCard.card.name,
          },
        });
      }
    }
  }
}

function doPlayCardMove(state, params) {
  var card = dominion.cardTable[params.card];
  var player = getCurrentPlayer(state);

  if (card.treasure) {
    state.treasureCount += card.treasure;
    if (state.state === STATE_ACTION) {
      state.state = STATE_TREASURE;
    }
  }
  if (isCardType(card, 'Action')) {
    state.actionCount -= 1;
  }
  player.inPlay.push(removeCardFromHand(player, card.name));
  if (card.effects) {
    for (var i = 0; i < card.effects.length; i += 1) {
      var effect = card.effects[i];
      doEffect(state, player, card, effect);
    }
  }

  checkActionsOver(state, player);
}

function doEffect(state, player, card, effect) {
    var fn = effectTable[effect.name];
    if (!fn) throw new Error("unrecognized effect: " + effect.name);
    fn(state, player, card, effect.params);
}

function handleNextPutCardsOnDeck(state) {
  var player = getCurrentPlayer(state);
  var matchingCardNames = getMatchingCardsInHand(state, player, {
    type: state.putCardsOnDeckType,
  });
  if (matchingCardNames.length === 0 && state.putCardsOnDeckCount > 0) {
    state.putCardsOnDeckCount = 0;
    var elseClause = state.putCardsOnDeckElse;
    if (elseClause) {
      doEffect(state, player, null, elseClause);
      checkActionsOver(state, player);
    } else {
      popState(state);
    }
  } else if (matchingCardNames.length === 1 && state.putCardsOnDeckCount > 0) {
    doPutCardOnDeckMove(state, {card: matchingCardNames[0]});
    return;
  } else if (state.putCardsOnDeckCount === 0) {
    popState(state);
  }
}

function checkActionsOver(state, player) {
  if (state.state === STATE_PUT_CARDS_ON_DECK) {
    handleNextPutCardsOnDeck(state);
    return;
  }
  if (state.state === STATE_ACTION) {
    if (state.actionCount < 0) throw new Error("invalid action count");
    if (state.actionCount === 0) {
      state.state = STATE_TREASURE;
    }
  }
  if (state.state === STATE_TREASURE && playerHandTreasureCardCount(state, player) === 0) {
    state.state = STATE_BUY;
  }
}

function playerHandTreasureCardCount(state, player) {
  var count = 0;
  for (var i = 0; i < player.hand.length; i += 1) {
    var card = player.hand[i];
    if (isCardType(card, 'Treasure')) {
      count += 1;
    }
  }
  return count;
}

function removeCardFromList(list, cardName) {
  var index = findCardInList(list, cardName);
  var card = list[index];
  list.splice(index, 1);
  return card;
}

function removeCardFromInPlay(player, cardName) {
  return removeCardFromList(player.inPlay, cardName);
}

function removeCardFromHand(player, cardName) {
  return removeCardFromList(player.hand, cardName);
}

function findCardInList(list, cardName) {
  for (var i = 0; i < list.length; i += 1) {
    if (list[i].name === cardName) {
      return i;
    }
  }
  throw new Error("card not found: " + cardName);
}

function doBuyMove(state, params) {
  if (state.state === STATE_ACTION || state.state === STATE_TREASURE) {
    state.state = STATE_BUY;
  }
  var gameCard = state.cardTable[params.card];
  var player = getCurrentPlayer(state);
  playerGainCard(state, player, gameCard, false);
  state.buyCount -= 1;
  state.treasureCount -= gameCard.card.cost;
  if (state.buyCount < 0) throw new Error("invalid buy count");
  if (state.state === STATE_BUY && state.buyCount === 0) {
    endTurn(state, player);
  }
}

function doEndTurn(state, params) {
  var player = getCurrentPlayer(state);
  endTurn(state, player);
}

function doDiscardMove(state, params) {
  var player = getCurrentPlayer(state);
  switch (state.state) {
    case STATE_DISCARD_THEN_DRAW:
      state.discardCount += 1;
      playerDiscardCardName(state, player, params.card);
      break;
    default:
      throw new Error("unexpected state: " + stateIndexToString(state.state));
  }
}

function doDoneDiscardingMove(state, params) {
  var player = getCurrentPlayer(state);
  playerDraw(state, player, state.discardCount);
  state.discardCount = 0;
  popState(state);
}

function doGainCardMove(state, params) {
  var player = getCurrentPlayer(state);
  switch (state.state) {
    case STATE_GAIN_CARD:
      var gameCard = state.cardTable[params.card];
      playerGainCard(state, player, gameCard, state.gainCardOnTopOfDeck);
      popState(state);
      break;
    default:
      throw new Error("unexpected state: " + stateIndexToString(state.state));
  }
}

function doPutCardOnDeckMove(state, params) {
  var player = getCurrentPlayer(state);
  switch (state.state) {
    case STATE_PUT_CARDS_ON_DECK:
      console.log(playerName(player) + " puts on deck " + params.card);
      player.deck.push(removeCardFromHand(player, params.card));
      state.putCardsOnDeckCount -= 1;
      if (state.putCardsOnDeckCount < 0) throw new Error("invalid putCardsOnDeckCount");
      handleNextPutCardsOnDeck(state);
      break;
    default:
      throw new Error("unexpected state: " + stateIndexToString(state.state));
  }
}

function playerDiscardCardName(state, player, cardName) {
  player.discardPile.push(removeCardFromHand(player, cardName));
}

function checkEndOfGame(state) {
  var pilesEmpty = 0;
  var provinceGone = false;
  var i;
  for (i = 0; i < state.cardList.length; i += 1) {
    var gameCard = state.cardList[i];
    if (gameCard.count === 0) {
      pilesEmpty += 1;
      if (gameCard.card.name === 'Province') {
        provinceGone = true;
      }
    }
  }
  if (pilesEmpty < 3 && !provinceGone) {
    return;
  }

  var player;
  for (i = 0; i < state.players.length; i += 1) {
    player = state.players[i];
    player.vp = calcVictoryPoints(state, player);
    player.turnCount = state.roundIndex + 1;
    if (state.currentPlayerIndex < player.index) player.turnCount -= 1;
  }
  state.players.sort(compareVpThenTurns);
  var nextRank = 1;
  var prev = null;
  for (i = 0; i < state.players.length; i += 1) {
    player = state.players[i];
    if (prev) {
      if (compareVpThenTurns(player, prev) !== 0) {
        nextRank += 1;
      }
    }
    player.rank = nextRank;
    prev = player;
  }
  for (i = 0; i < state.players.length; i += 1) {
    player = state.players[i];
    console.log(player.rank + " " + playerName(player) + " VP: " + player.vp + " turns: " + player.turnCount);
  }

  process.exit(0);

  function compareVpThenTurns(a, b) {
    var cmp = compare(b.vp, a.vp);
    return (cmp === 0) ? compare(a.turnCount, b.turnCount) : cmp;
  }
}

function endTurn(state, player) {
  playerCleanUpHand(state, player);
  playerDraw(state, player, 5);

  // calls process.exit if game over
  checkEndOfGame(state);

  state.state = STATE_ACTION;
  state.actionCount = 1;
  state.buyCount = 1;
  state.treasureCount = 0;
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  state.turnIndex += 1;
  if (state.currentPlayerIndex === 0) state.roundIndex += 1;
}

function playerCleanUpHand(state, player) {
  while (player.inPlay.length > 0) {
    player.discardPile.push(player.inPlay.pop());
  }
  while (player.hand.length > 0) {
    player.discardPile.push(player.hand.pop());
  }
}

function playerDraw(state, player, count) {
  console.log(playerName(player) + " draws " + count + " cards");
  for (var i = 0; i < count; i += 1) {
    if (player.deck.length === 0) {
      if (player.discardPile.length === 0) return;
      while (player.discardPile.length > 0) {
        player.deck.push(player.discardPile.pop());
      }
      state.rng.shuffle(player.deck);
    }
    player.hand.push(player.deck.pop());
  }
}

function playerGainCard(state, player, gameCard, topOfDeck) {
  var topOfDeckText = topOfDeck ? " on top of deck" : "";
  console.log(playerName(player) + " gains a " + gameCard.card.name + topOfDeckText);
  if (!gameCard) throw new Error("invalid card name");
  gameCard.count -= 1;
  if (gameCard.count < 0) throw new Error("invalid game card count");
  if (topOfDeck) {
    player.deck.push(gameCard.card);
  } else {
    player.discardPile.push(gameCard.card);
  }
}

function performMove(state, move) {
  var fn = moveTable[move.name];
  if (!fn) throw new Error("illegal move");
  fn(state, move.params);
}

function shuffleAndDeal(playerAiList, seed) {
  var rng = new RNG(seed);
  var i;
  var players = [];
  for (i = 0; i < playerAiList.length; i += 1) {
    players.push(createPlayerState(i, playerAiList[i]));
  }
  var state = {
    currentPlayerIndex: 0,
    turnIndex: 0,
    roundIndex: 0,
    seed: seed,
    rng: rng,
    actionCount: 1,
    buyCount: 1,
    treasureCount: 0,
    cardList: [],
    cardTable: {},
    trash: [],
    players: players,
    // state items
    stateStack: [],
    state: STATE_ACTION,
    discardCount: 0,
    gainCardOnTopOfDeck: false,
    gainCardCostingUpTo: 0,
    putCardsOnDeckType: null,
    putCardsOnDeckCount: -1,
    putCardsOnDeckElse: null,
    waitingOnPlayerIndex: -1,
  };

  var listOfCardsPerSet = {};
  var list, card;
  for (i = 0; i < dominion.cardList.length; i += 1) {
    card = dominion.cardList[i];
    if (!card.set) continue;
    list = listOfCardsPerSet[card.set.name] || (listOfCardsPerSet[card.set.name] = []);
    list.push(card);
  }

  var kingdomCards = [];
  while (kingdomCards.length < 10) {
    var setIndex = rng.integer(dominion.setList.length);
    var set = dominion.setList[setIndex];
    list = listOfCardsPerSet[set.name];
    if (list.length > 0) {
      var listIndex = rng.integer(list.length);
      card = list[listIndex];
      list.splice(listIndex, 1);
      kingdomCards.push(card);
    }
  }

  for (i = 0; i < dominion.cardList.length; i += 1) {
    card = dominion.cardList[i];
    if (card.includeCondition === 'always') {
      addCard(card);
    }
  }

  for (i = 0; i < kingdomCards.length; i += 1) {
    addCard(kingdomCards[i]);
  }

  state.cardList.sort(compareCostThenName);

  return state;

  function addCard(card) {
    var gameCard = {
      card: card,
      count: card.supply[playerAiList.length],
    };
    state.cardTable[card.name] = gameCard;
    state.cardList.push(gameCard);
  }

  function createPlayerState(playerIndex, ai) {
    var estateCard = getCard('Estate');
    var copperCard = getCard('Copper');
    var deck = [];
    var hand = [];
    var i;
    for (i = 0; i < 7; i += 1) {
      deck.push(copperCard);
    }
    for (; i < 10; i += 1) {
      deck.push(estateCard);
    }
    rng.shuffle(deck);
    for (i = 0; i < 5; i += 1) {
      hand.push(deck.pop());
    }
    return {
      ai: ai,
      index: playerIndex,
      deck: deck,
      hand: hand,
      discardPile: [],
      inPlay: [],
    };
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
    var vp = calcVictoryPoints(state, player);
    console.log(playerName(player) + " (" + vp + " victory points):");
    console.log("       in play: " + deckToString(player.inPlay, false));
    console.log("          deck: " + deckToString(player.deck, true));
    console.log("          hand: " + deckToString(player.hand, true));
    console.log("  discard pile: " + deckToString(player.discardPile, true));
  }
  console.log("Waiting for " + playerName(getCurrentPlayer(state)) + " to " + stateIndexToString(state.state));
  console.log("Actions: " + state.actionCount +
           "   Buys: " + state.buyCount +
           "   Treasure: " + state.treasureCount);
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

function getCurrentPlayer(state) {
  var index = (state.waitingOnPlayerIndex === -1) ? state.currentPlayerIndex : state.waitingOnPlayerIndex;
  var player = state.players[index];
  if (!player) throw new Error("invalid player");
  return player;
}

function calcVictoryPoints(state, player) {
  var vp = 0;
  iterateAllPlayerCards(player, onCard);
  return vp;
  function onCard(card) {
    if (!card.victory) return;
    for (var i = 0; i < card.victory.length; i += 1) {
      var victoryObj = card.victory[i];
      if (victoryObj.type === 'constant') {
        var value = parseInt(victoryObj.params.value, 10);
        if (isNaN(value)) throw new Error("invalid victory point value");
        vp += value;
      } else {
        throw new Error("invalid victory type: " + victoryObj.type);
      }
    }
  }
}

function iterateAllPlayerCards(player, onCard) {
  player.deck.forEach(onCard);
  player.discardPile.forEach(onCard);
  player.hand.forEach(onCard);
  player.inPlay.forEach(onCard);
}

function stateIndexToString(stateIndex) {
  switch (stateIndex) {
    case STATE_ACTION:
      return "play an action, treasure, or buy a card";
    case STATE_TREASURE:
      return "play a treasure or buy a card";
    case STATE_BUY:
      return "buy a card";
    case STATE_DISCARD_THEN_DRAW:
      return "discard cards before drawing";
    case STATE_GAIN_CARD:
      return "gain a card";
    case STATE_PUT_CARDS_ON_DECK:
      return "put cards on deck";
    default:
      throw new Error("missing stateIndexToString for " + stateIndex);
  }
}

function playerName(player) {
  return "Player " + (player.index + 1);
}

function deckToString(deck, compress) {
  if (deck.length === 0) return "(empty)";
  if (!compress) {
    return deck.map(getCardName).join(" ");
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

function getCardName(card) {
  return card.name;
}

function importAndProcessCards() {
  var data = {
    setTable: {},
    setList: [],
    cardTable: {},
    cardList: [],
    isCardType: isCardType,
    moveToString: moveToString,
  };
  var cardsJson = require('./lib/cards');

  for (var cardName in cardsJson.cards) {
    var card = cardsJson.cards[cardName];
    card.name = cardName;
    data.cardTable[cardName] = card;
    data.cardList.push(card);

    var setName = card.set;
    if (!setName) continue;
    var set;
    if (data.setTable[setName]) {
      set = data.setTable[setName];
    } else {
      set = {
        name: setName,
        cardTable: {},
        cardList: [],
      };
      data.setList.push(set);
      data.setTable[setName] = set;
    }
    set.cardTable[cardName] = card;
    set.cardList.push(card);
    card.set = set;
  }
  
  return data;
}

function compareCostThenName(a, b) {
  var cmp = compare(a.card.cost, b.card.cost);
  return (cmp === 0) ? compare(a.card.name, b.card.name) : cmp;
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

function getCard(name) {
  var card = dominion.cardTable[name];
  if (!card) throw new Error("card not found: " + name);
  return card;
}

function isCardType(card, typeName) {
  return !!card.type[typeName];
}

function pushState(state, newStateIndex) {
  state.stateStack.push({
    state: state.state,
    discardCount: state.discardCount,
    gainCardOnTopOfDeck: state.gainCardOnTopOfDeck,
    gainCardCostingUpTo: state.gainCardCostingUpTo,
    putCardsOnDeckType: state.putCardsOnDeckType,
    putCardsOnDeckCount: state.putCardsOnDeckCount,
    putCardsOnDeckElse: state.putCardsOnDeckElse,
    waitingOnPlayerIndex: state.waitingOnPlayerIndex,
  });
  state.state = newStateIndex;
}

function popState(state, newStateIndex) {
  if (state.stateStack.length <= 0) throw new Error("state stack empty");
  var o = state.stateStack.pop();
  state.state = o.state;
  state.discardCount = o.discardCount;
  state.gainCardOnTopOfDeck = o.gainCardOnTopOfDeck;
  state.gainCardCostingUpTo = o.gainCardCostingUpTo;
  state.putCardsOnDeckType = o.putCardsOnDeckType;
  state.putCardsOnDeckCount = o.putCardsOnDeckCount;
  state.putCardsOnDeckElse = o.putCardsOnDeckElse;
  state.waitingOnPlayerIndex = o.waitingOnPlayerIndex;
  var player = getCurrentPlayer(state);
  checkActionsOver(state, player);
}

function doDiscardThenDraw(state, player, card, params) {
  if (state.discardCount !== 0) throw new Error("unexpected discardCount value");
  pushState(state, STATE_DISCARD_THEN_DRAW);
}

function doGainCardEffect(state, player, card, params) {
  var matchingCards = getMatchingCards(state, {
    costingUpTo: params.costingUpTo,
    name: params.name,
    countGreaterEqual: 1,
  });
  if (matchingCards.length === 0) {
    // no card to gain, we're done.
    return;
  }
  if (matchingCards.length === 1) {
    // no need to prompt for action.
    playerGainCard(state, player, matchingCards[0], !!params.onTopOfDeck);
    return;
  }
  pushState(state, STATE_GAIN_CARD);
  state.gainCardOnTopOfDeck = !!params.onTopOfDeck;
  state.gainCardCostingUpTo = params.costingUpTo;
  state.gainCardName = params.name;
}

function getMatchingCardsInHand(state, player, query) {
  var results = {};
  for (var i = 0; i < player.hand.length; i += 1) {
    var card = player.hand[i];
    var match = true;
    if (query.name != null && card.name !== query.name) {
      match = false;
    }
    if (query.costingUpTo != null && card.cost > query.costingUpTo) {
      match = false;
    }
    if (query.type != null && !isCardType(card, query.type)) {
      match = false;
    }
    if (match) {
      results[card.name] = card;
    }
  }
  return Object.keys(results);
}
function getMatchingCards(state, query) {
  var results = [];
  for (var i = 0; i < state.cardList.length; i += 1) {
    var gameCard = state.cardList[i];
    var match = true;
    if (query.countGreaterEqual != null && gameCard.count < query.countGreaterEqual) {
      match = false;
    }
    if (query.name != null && gameCard.card.name !== query.name) {
      match = false;
    }
    if (query.costingUpTo != null && gameCard.card.cost > query.costingUpTo) {
      match = false;
    }
    if (match) {
      results.push(gameCard);
    }
  }
  return results;
}

function doAttackPutCardsOnDeck(state, player, card, params) {
  for (var i = 0; i < state.players.length - 1; i += 1) {
    pushState(state, STATE_PUT_CARDS_ON_DECK);
    state.waitingOnPlayerIndex = euclideanMod(state.currentPlayerIndex - i - 1, state.players.length);
    state.putCardsOnDeckType = params.type;
    state.putCardsOnDeckCount = params.count;
    state.putCardsOnDeckElse = params['else'];
  }
}

function doTrashThisCardEffect(state, player, card, params) {
  state.trash.push(removeCardFromInPlay(player, card.name));
}

function doRevealHandEffect(state, player, card, params) {
  console.log(playerName(player) + " reveals hand");
}

function doPlusAction(state, player, card, params) {
  if (!params.amount) throw new Error("missing amount parameter");
  state.actionCount += params.amount;
}

function doPlusTreasure(state, player, card, params) {
  if (!params.amount) throw new Error("missing amount parameter");
  state.treasureCount += params.amount;
}

function doPlusBuy(state, player, card, params) {
  if (!params.amount) throw new Error("missing amount parameter");
  state.buyCount += params.amount;
}

function doPlusCard(state, player, card, params) {
  if (!params.amount) throw new Error("missing amount parameter");
  playerDraw(state, player, params.amount);
}

function euclideanMod(numerator, denominator) {
  var result = numerator % denominator;
  return result < 0 ? result + denominator : result;
}
