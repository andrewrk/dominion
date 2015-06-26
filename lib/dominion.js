var dominion = importAndProcessCards();
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var RNG = require('./rng');
var nextState = 0;
var STATE_ACTION = nextState++;
var STATE_TREASURE = nextState++;
var STATE_BUY = nextState++;
var STATE_DISCARD_THEN_DRAW = nextState++;
var STATE_GAIN_CARD = nextState++;
var STATE_PUT_CARDS_ON_DECK = nextState++;
var STATE_TRASH = nextState++;
var STATE_REACTION = nextState++;
var STATE_DISCARD_DECK = nextState++;
var STATE_DISCARD_DOWN_TO = nextState++;
var STATE_PLUS_ACTION = nextState++;
var STATE_PLUS_TREASURE = nextState++;
var STATE_PLUS_BUY = nextState++;
var STATE_PLUS_CARD = nextState++;
var STATE_TRASH_THIS_CARD = nextState++;
var STATE_REVEAL_HAND = nextState++;
var STATE_REVEAL_THIS_CARD = nextState++;
var STATE_UNAFFECTED_BY_ATTACK = nextState++;
var STATE_OTHER_PLAYERS_DRAW = nextState++;
var STATE_SPY = nextState++;
var STATE_SPY_REVEAL = nextState++;
var STATE_REVEAL_UNTIL_CARD = nextState++;
var STATE_PUT_REVEALED_CARDS_INTO_HAND = nextState++;
var STATE_DISCARD_REVEALED_CARDS = nextState++;
var moveTable = {
  'play': doPlayCardMove,
  'buy': doBuyMove,
  'endTurn': doEndTurn,
  'discard': doDiscardMove,
  'doneDiscarding': doDoneDiscardingMove,
  'gain': doGainCardMove,
  'putOnDeck': doPutCardOnDeckMove,
  'trash': doTrashMove,
  'doneTrashing': doDoneTrashingMove,
  'reaction': doReactionMove,
  'doneReacting': doDoneReactingMove,
  'discardDeck': doDiscardDeckMove,
  'noDiscardDeck': doNotDiscardDeckMove,
  'discardRevealed': doDiscardRevealedMove,
  'putBack': doPutBackMove,
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
  'trashCards': doTrashCardsEffect,
  'revealThisCard': doRevealThisCardEffect,
  'unaffectedByAttack': doUnaffectedByAttackEffect,
  'discardDeck': doDiscardDeckEffect,
  'attackDiscardDownTo': doAttackDiscardDownTo,
  'attackGainCard': doAttackGainCard,
  'otherPlayersDraw': doOtherPlayersDrawEffect,
  'attackSpy': doAttackSpy,
  'revealUntilCard': doRevealUntilCard,
  'putRevealedCardsIntoHand': doPutRevealedCardsIntoHand,
  'discardRevealedCards': doDiscardRevealedCards,
};
var ais = {
  'naive': require('./ai/naive'),
  'bigmoney': require('./ai/bigmoney'),
  'cli': require('./ai/cli'),
};

exports.dominion = dominion;
exports.ais = ais;
exports.DominionGame = DominionGame;
exports.playerName = playerName;
exports.moveToString = moveToString;
exports.getCardName = getCardName;

util.inherits(DominionGame, EventEmitter);
function DominionGame(players, seed) {
  EventEmitter.call(this);
  this.shuffleAndDeal(players, seed);
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
    case 'trash':
      return "Trash " + move.params.card;
    case 'doneTrashing':
      return "Done trashing";
    case 'reaction':
      return "Activate " + move.params.card;
    case 'doneReacting':
      return "Done playing reactions";
    case 'discardDeck':
      return "Discard deck";
    case 'noDiscardDeck':
      return "Do not discard deck";
    case 'discardRevealed':
      return "Discard revealed card(s)";
    case 'putBack':
      return "Put revealed card(s) back on deck";
    default:
      throw new Error("moveToString case missing: " + move.name);
  }
}

DominionGame.prototype.enumerateMoves = function() {
  return enumerateMoves(this);
};

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
      moves.push({ name: 'doneDiscarding' });
      addDiscardMoves();
      break;
    case STATE_GAIN_CARD:
      addGainCardMoves();
      break;
    case STATE_PUT_CARDS_ON_DECK:
      addPutCardsOnDeckMoves();
      break;
    case STATE_TRASH:
      addTrashMoves();
      break;
    case STATE_REACTION:
      addReactionMoves();
      break;
    case STATE_DISCARD_DECK:
      addDiscardDeckMoves();
      break;
    case STATE_DISCARD_DOWN_TO:
      addDiscardMoves();
      break;
    case STATE_SPY:
      addSpyMoves();
      break;
    default:
      throw new Error("invalid state");
  }
  return moves;

  function addSpyMoves() {
    moves.push({name: 'discardRevealed'});
    moves.push({name: 'putBack'});
  }

  function addDiscardDeckMoves() {
    moves.push({name: 'discardDeck'});
    moves.push({name: 'noDiscardDeck'});
  }

  function addReactionMoves() {
    moves.push({name: 'doneReacting'});
    var reactionCardNames = {};
    for (var i = 0; i < state.playableReactionCards.length; i += 1) {
      var card = state.playableReactionCards[i];
      reactionCardNames[card.name] = true;
    }
    for (var reactionCardName in reactionCardNames) {
      moves.push({
        name: 'reaction',
        params: {
          card: reactionCardName,
        },
      });
    }
  }

  function addTrashMoves() {
    if (!state.trashMandatory) {
      moves.push({ name: 'doneTrashing' });
    }
    var matchingCardNames = getMatchingCardsInHand(state, player, {
      type: state.trashType,
      name: state.trashName,
    });
    for (var i = 0; i < matchingCardNames.length; i += 1) {
      moves.push({
        name: 'trash',
        params: {
          card: matchingCardNames[i],
        }
      });
    }
  }

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
    var costingUpTo = state.gainCardCostingUpTo;
    if (state.gainCardCostingUpToMoreThanTrashed != null) {
      if (state.costOfRecentlyTrashedCard === -1) throw new Error("invalid costOfRecentlyTrashedCard");
      costingUpTo = state.costOfRecentlyTrashedCard + state.gainCardCostingUpToMoreThanTrashed;
    }
    var matchingCards = getMatchingCards(state, {
      costingUpTo: costingUpTo,
      name: state.gainCardName,
      type: state.gainCardType,
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
  if (state.state !== STATE_ACTION && state.state !== STATE_TREASURE) {
    throw new Error("invalid state for playing a card");
  }

  var card = dominion.cardTable[params.card];
  var player = getCurrentPlayer(state);

  if (state.actionCount < 1 && isCardType(card, 'Action')) {
    throw new Error("not enough actions to play a card");
  }

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
  doEffects(state, player, card, player.inPlay, card.effects);
}

function doEffects(state, player, card, cardLocationList, effectsList) {
  if (effectsList) {
    // since we're using a stack based solution we need to do the effects in reverse order
    for (var i = card.effects.length - 1; i >= 0; i -= 1) {
      var effect = card.effects[i];
      doEffect(state, player, card, player.inPlay, effect);
    }
  }
  checkActionsOver(state, player);
}

function doEffect(state, player, card, cardLocationList, effect) {
    var fn = effectTable[effect.name];
    if (!fn) throw new Error("unrecognized effect: " + effect.name);
    fn(state, player, card, cardLocationList, effect.params);
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
      doEffect(state, player, null, null, elseClause);
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
  var matchingCards;
  if (state.isAttack && state.unaffectedByAttack) {
    popState(state);
    return;
  }

  if (state.state === STATE_SPY_REVEAL) {
    playerRevealCards(state, getSpyTargetPlayer(state), 1);
    state.state = STATE_SPY;
    return;
  }
  if (state.state === STATE_OTHER_PLAYERS_DRAW) {
    for (var i = 1; i < state.players.length; i += 1) {
      var otherPlayerIndex = euclideanMod(player.index + i, state.players.length);
      var otherPlayer = state.players[otherPlayerIndex];
      playerDraw(state, otherPlayer, state.otherPlayersDrawAmount);
    }
    popState(state);
    return;
  }
  if (state.state === STATE_REVEAL_THIS_CARD) {
    state.emit('reveal', player, state.revealCardName);
    popState(state);
    return;
  }
  if (state.state === STATE_REVEAL_HAND) {
    state.emit('revealHand', player);
    popState(state);
    return;
  }
  if (state.state === STATE_TRASH_THIS_CARD) {
    state.trash.push(removeCardFromList(state.cardLocationList, state.trashName));
    popState(state);
    return;
  }
  if (state.state === STATE_PLUS_ACTION) {
    state.actionCount += state.plusActionCount;
    popState(state);
    return;
  }
  if (state.state === STATE_PLUS_TREASURE) {
    if (!state.plusTreasureIfYouDidTrash || state.costOfRecentlyTrashedCard >= 0) {
      state.treasureCount += state.plusTreasureCount;
    }
    popState(state);
    return;
  }
  if (state.state === STATE_PLUS_BUY) {
    state.buyCount += state.plusBuyCount;
    popState(state);
    return;
  }
  if (state.state === STATE_PLUS_CARD) {
    playerDraw(state, player, state.plusCardCount);
    popState(state);
    return;
  }
  if (state.state === STATE_REVEAL_UNTIL_CARD) {
    revealUntilMatching(state, player, {
      type: state.revealUntilCardType,
      count: state.revealUntilCardCount,
    });
    popState(state);
    return;
  }
  if (state.state === STATE_PUT_REVEALED_CARDS_INTO_HAND) {
    putRevealedCardsIntoHand(state, player, state.putRevealedCardsIntoHandType);
    popState(state);
    return;
  }
  if (state.state === STATE_DISCARD_REVEALED_CARDS) {
    while (player.revealedCards.length > 0) {
      player.discardPile.push(player.revealedCards.pop());
    }
    popState(state);
    return;
  }

  if (state.state === STATE_GAIN_CARD) {
    var costingUpTo = state.gainCardCostingUpTo;
    if (state.gainCardCostingUpToMoreThanTrashed != null) {
      if (state.costOfRecentlyTrashedCard === -1) {
        popState(state);
        return;
      }
      costingUpTo = state.costOfRecentlyTrashedCard + state.gainCardCostingUpToMoreThanTrashed;
    }
    matchingCards = getMatchingCards(state, {
      costingUpTo: state.gainCardCostingUpTo,
      name: state.gainCardName,
      type: state.gainCardType,
      countGreaterEqual: 1,
    });
    if (matchingCards.length === 0) {
      popState(state);
      return;
    }
  }
  if (state.state === STATE_TRASH) {
    var doneWithState = false;
    if (state.trashActionsLeft === 0) {
      doneWithState = true;
    } else {
      matchingCards = getMatchingCardsInHand(state, player, {
        type: state.trashType,
        name: state.trashName,
      });
      if (matchingCards.length === 0) {
        doneWithState = true;
      }
    }
    if (doneWithState) {
      var prevStackFrame = state.stateStack[state.stateStack.length - 1];
      prevStackFrame.costOfRecentlyTrashedCard = state.costOfRecentlyTrashedCard;
      popState(state);
      return;
    }
  }
  if (state.state === STATE_GAIN_CARD) {
    matchingCards = getMatchingCards(state, {
      costingUpTo: state.gainCardCostingUpTo,
      name: state.gainCardName,
      countGreaterEqual: 1,
    });
    if (matchingCards.length === 0) {
      popState(state);
      return;
    }
  }
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
  playerGainCard(state, player, gameCard, false, false);
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
    case STATE_DISCARD_DOWN_TO:
      playerDiscardCardName(state, player, params.card);
      if (player.hand.length <= state.discardDownTo) {
        popState(state);
      }
      break;
    default:
      throw new Error("unexpected state: " + stateIndexToString(state));
  }
}

function doDoneDiscardingMove(state, params) {
  var player = getCurrentPlayer(state);
  playerDraw(state, player, state.discardCount);
  popState(state);
}

function doGainCardMove(state, params) {
  var player = getCurrentPlayer(state);
  switch (state.state) {
    case STATE_GAIN_CARD:
      var gameCard = state.cardTable[params.card];
      playerGainCard(state, player, gameCard, state.gainCardOnTopOfDeck, state.gainCardIntoHand);
      popState(state);
      break;
    default:
      throw new Error("unexpected state: " + stateIndexToString(state));
  }
}

function doPutCardOnDeckMove(state, params) {
  var player = getCurrentPlayer(state);
  switch (state.state) {
    case STATE_PUT_CARDS_ON_DECK:
      state.emit('putOnDeck', player, params.card);
      player.deck.push(removeCardFromHand(player, params.card));
      state.putCardsOnDeckCount -= 1;
      if (state.putCardsOnDeckCount < 0) throw new Error("invalid putCardsOnDeckCount");
      handleNextPutCardsOnDeck(state);
      break;
    default:
      throw new Error("unexpected state: " + stateIndexToString(state));
  }
}

function doTrashMove(state, params) {
  var player = getCurrentPlayer(state);
  var card = removeCardFromHand(player, params.card);
  state.costOfRecentlyTrashedCard = card.cost;
  state.trashActionsLeft -= 1;
  state.trash.push(card);
}

function doDoneTrashingMove(state, params) {
  popState(state);
}

function doReactionMove(state, params) {
  var player = getCurrentPlayer(state);
  var card = removeCardFromList(state.playableReactionCards, params.card);
  doEffects(state, player, card, player.hand, card.condition.effects);
}

function doDoneReactingMove(state, params) {
  popState(state);
}

function doDiscardDeckMove(state, params) {
  var player = getCurrentPlayer(state);
  while (player.deck.length > 0) {
    player.discardPile.push(player.deck.pop());
  }
  popState(state);
}

function doNotDiscardDeckMove(state, params) {
  popState(state);
}

function doDiscardRevealedMove(state, params) {
  var player = getSpyTargetPlayer(state);
  while (player.revealedCards.length > 0) {
    player.discardPile.push(player.revealedCards.pop());
  }
  popState(state);
}

function doPutBackMove(state, params) {
  var player = getSpyTargetPlayer(state);
  while (player.revealedCards.length > 0) {
    player.deck.push(player.revealedCards.pop());
  }
  popState(state);
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
  state.emit('gameOver', state.players);

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

function playerMoveFromDeck(state, player, count, destList) {
  for (var i = 0; i < count; i += 1) {
    if (player.deck.length === 0) {
      if (player.discardPile.length === 0) return;
      while (player.discardPile.length > 0) {
        player.deck.push(player.discardPile.pop());
      }
      state.rng.shuffle(player.deck);
    }
    destList.push(player.deck.pop());
  }
}

function playerRevealCards(state, player, count) {
  playerMoveFromDeck(state, player, count, player.revealedCards);
  var slice = player.revealedCards.slice(player.revealedCards.length - count);
  state.emit('revealCardsFromDeck', player, slice);
}

function playerDraw(state, player, count) {
  state.emit('draw', player, count);
  playerMoveFromDeck(state, player, count, player.hand);
}

function playerGainCard(state, player, gameCard, topOfDeck, intoHand) {
  state.emit('gainCard', player, gameCard.card.name, topOfDeck, intoHand);
  if (!gameCard) throw new Error("invalid card name");
  gameCard.count -= 1;
  if (gameCard.count < 0) throw new Error("invalid game card count");
  if (topOfDeck) {
    player.deck.push(gameCard.card);
  } else if (intoHand) {
    player.hand.push(gameCard.card);
  } else {
    player.discardPile.push(gameCard.card);
  }
}

DominionGame.prototype.performMove = function(move) {
  return performMove(this, move);
};

function performMove(state, move) {
  var fn = moveTable[move.name];
  if (!fn) throw new Error("illegal move");
  fn(state, move.params);
  checkActionsOver(state, getCurrentPlayer(state));
}

DominionGame.prototype.shuffleAndDeal = function(playerAiList, seed) {
  var rng = new RNG(seed);
  var i;
  var players = [];
  for (i = 0; i < playerAiList.length; i += 1) {
    players.push(createPlayerState(i, playerAiList[i]));
  }
  this.currentPlayerIndex = 0;
  this.turnIndex = 0;
  this.roundIndex = 0;
  this.seed = seed;
  this.rng = rng;
  this.actionCount = 1;
  this.buyCount = 1;
  this.treasureCount = 0;
  this.cardList = [];
  this.cardTable = {};
  this.trash = [];
  this.players = players;
  // state items
  this.stateStack = [];
  this.state = STATE_ACTION;
  this.discardCount = 0;
  this.gainCardOnTopOfDeck = false;
  this.gainCardCostingUpTo = 0;
  this.gainCardCostingUpToMoreThanTrashed = null;
  this.gainCardIntoHand = false;
  this.gainCardType = null;
  this.gainCardName = null;
  this.putCardsOnDeckType = null;
  this.putCardsOnDeckCount = -1;
  this.putCardsOnDeckElse = null;
  this.waitingOnPlayerIndex = -1;
  this.trashActionsLeft = 0;
  this.trashMandatory = false;
  this.trashType = null;
  this.trashName = null;
  this.trashCardLocationList = null;
  this.costOfRecentlyTrashedCard = -1;
  this.isAttack = false;
  this.unaffectedByAttack = false;
  this.playableReactionCards = [];
  this.plusActionCount = 0;
  this.plusTreasureCount = 0;
  this.plusBuyCount = 0;
  this.plusCardCount = 0;
  this.revealCardName = 0;
  this.otherPlayersDrawAmount = 0;
  this.plusTreasureIfYouDidTrash = false;
  this.spyTargetPlayerIndex = -1;
  this.revealUntilCardCount = -1;
  this.revealUntilCardType = -1;
  this.putRevealedCardsIntoHandType = null;

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
      addCard(this, card);
    }
  }

  for (i = 0; i < kingdomCards.length; i += 1) {
    addCard(this, kingdomCards[i]);
  }

  this.cardList.sort(compareCostThenName);

  function addCard(state, card) {
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
      revealedCards: [],
    };
  }
}

function pushState(state, newStateIndex) {
  state.stateStack.push({
    state: state.state,
    discardCount: state.discardCount,
    gainCardOnTopOfDeck: state.gainCardOnTopOfDeck,
    gainCardIntoHand: state.gainCardIntoHand,
    gainCardCostingUpTo: state.gainCardCostingUpTo,
    gainCardCostingUpToMoreThanTrashed: state.gainCardCostingUpToMoreThanTrashed,
    gainCardType: state.gainCardType,
    gainCardName: state.gainCardName,
    putCardsOnDeckType: state.putCardsOnDeckType,
    putCardsOnDeckCount: state.putCardsOnDeckCount,
    putCardsOnDeckElse: state.putCardsOnDeckElse,
    waitingOnPlayerIndex: state.waitingOnPlayerIndex,
    trashActionsLeft: state.trashActionsLeft,
    trashMandatory: state.trashMandatory,
    trashType: state.trashType,
    trashName: state.trashName,
    trashCardLocationList: state.trashCardLocationList,
    costOfRecentlyTrashedCard: state.costOfRecentlyTrashedCard,
    isAttack: state.isAttack,
    unaffectedByAttack: state.unaffectedByAttack,
    playableReactionCards: state.playableReactionCards.concat([]),
    plusActionCount: state.plusActionCount,
    plusTreasureCount: state.plusTreasureCount,
    plusBuyCount: state.plusBuyCount,
    plusCardCount: state.plusCardCount,
    revealCardName: state.revealCardName,
    otherPlayersDrawAmount: state.otherPlayersDrawAmount,
    plusTreasureIfYouDidTrash: state.plusTreasureIfYouDidTrash,
    spyTargetPlayerIndex: state.spyTargetPlayerIndex,
    revealUntilCardCount: state.revealUntilCardCount,
    revealUntilCardType: state.revealUntilCardType,
    putRevealedCardsIntoHandType: state.putRevealedCardsIntoHandType,
  });
  state.state = newStateIndex;
  state.isAttack = false;
}

function popState(state) {
  if (state.stateStack.length <= 0) throw new Error("state stack empty");
  var o = state.stateStack.pop();
  state.state = o.state;
  state.discardCount = o.discardCount;
  state.gainCardOnTopOfDeck = o.gainCardOnTopOfDeck;
  state.gainCardIntoHand = o.gainCardIntoHand;
  state.gainCardCostingUpTo = o.gainCardCostingUpTo;
  state.gainCardCostingUpToMoreThanTrashed = o.gainCardCostingUpToMoreThanTrashed;
  state.gainCardName = o.gainCardName;
  state.gainCardType = o.gainCardType;
  state.putCardsOnDeckType = o.putCardsOnDeckType;
  state.putCardsOnDeckCount = o.putCardsOnDeckCount;
  state.putCardsOnDeckElse = o.putCardsOnDeckElse;
  state.waitingOnPlayerIndex = o.waitingOnPlayerIndex;
  state.trashActionsLeft = o.trashActionsLeft;
  state.trashMandatory = o.trashMandatory;
  state.trashType = o.trashType;
  state.trashName = o.trashName;
  state.trashCardLocationList = o.trashCardLocationList;
  state.costOfRecentlyTrashedCard = o.costOfRecentlyTrashedCard;
  state.isAttack = o.isAttack;
  state.unaffectedByAttack = o.unaffectedByAttack;
  state.playableReactionCards = o.playableReactionCards;
  state.plusActionCount = o.plusActionCount;
  state.plusBuyCount = o.plusBuyCount;
  state.plusTreasureCount = o.plusTreasureCount;
  state.plusCardCount = o.plusCardCount;
  state.revealCardName = o.revealCardName;
  state.otherPlayersDrawAmount = o.otherPlayersDrawAmount;
  state.plusTreasureIfYouDidTrash = o.plusTreasureIfYouDidTrash;
  state.spyTargetPlayerIndex = o.spyTargetPlayerIndex;
  state.revealUntilCardCount = o.revealUntilCardCount;
  state.revealUntilCardType = o.revealUntilCardType;
  state.putRevealedCardsIntoHandType = o.putRevealedCardsIntoHandType;
  var player = getCurrentPlayer(state);
  checkActionsOver(state, player);
}

DominionGame.prototype.getCurrentPlayer = function() {
  return getCurrentPlayer(this);
};

function getCurrentPlayerIndex(state) {
  return (state.waitingOnPlayerIndex === -1) ? state.currentPlayerIndex : state.waitingOnPlayerIndex;
}

function getCurrentPlayer(state) {
  var index = getCurrentPlayerIndex(state);
  var player = state.players[index];
  if (!player) throw new Error("invalid player");
  return player;
}

function getSpyTargetPlayer(state) {
  if (state.spyTargetPlayerIndex < 0) {
    throw new Error("expected spyTargetPlayerIndex to be >= 0");
  }
  var player = state.players[state.spyTargetPlayerIndex];
  if (!player) throw new Error("invalid player");
  return player;
}

DominionGame.prototype.playerCardCount = function(player) {
  return playerCardCount(this, player);
};

function playerCardCount(state, player) {
  return player.hand.length +
    player.inPlay.length +
    player.deck.length +
    player.discardPile.length +
    player.revealedCards.length;
}

function iterateAllPlayerCards(player, onCard) {
  player.deck.forEach(onCard);
  player.discardPile.forEach(onCard);
  player.hand.forEach(onCard);
  player.inPlay.forEach(onCard);
  player.revealedCards.forEach(onCard);
}

DominionGame.prototype.calcVictoryPoints = function(player) {
  return calcVictoryPoints(this, player);
};

function calcVictoryPoints(state, player) {
  var vp = 0;
  var cardCount = playerCardCount(state, player);
  iterateAllPlayerCards(player, onCard);
  return vp;
  function onCard(card) {
    if (!card.victory) return;
    for (var i = 0; i < card.victory.length; i += 1) {
      var victoryObj = card.victory[i];
      if (victoryObj.type === 'constant') {
        vp += victoryObj.params.value;
      } else if (victoryObj.type === 'perCardInDeck') {
        vp += victoryObj.params.multiplier * Math.floor(cardCount / victoryObj.params.divisor);
      } else {
        throw new Error("invalid victory type: " + victoryObj.type);
      }
    }
  }
}

DominionGame.prototype.stateIndexToString = function() {
  return stateIndexToString(this);
};

function stateIndexToString(state) {
  switch (state.state) {
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
      return "put on deck a card";
    case STATE_TRASH:
      return "trash a card";
    case STATE_REACTION:
      return "play a reaction";
    case STATE_DISCARD_DECK:
      return "choose whether to discard deck";
    case STATE_DISCARD_DOWN_TO:
      return "discard down to " + state.discardDownTo + " cards";
    case STATE_SPY:
      return "choose whether to discard or return revealed card";
    default:
      throw new Error("missing stateIndexToString for " + state.state);
  }
}

function playerName(player) {
  return "Player " + (player.index + 1);
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
    getCard: getCard,
  };
  var cardsJson = require('./cards');

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

function doDiscardThenDraw(state, player, card, cardLocationList, params) {
  if (state.discardCount !== 0) throw new Error("unexpected discardCount value");
  pushState(state, STATE_DISCARD_THEN_DRAW);
  state.waitingOnPlayerIndex = player.index;
}

function doGainCardEffect(state, player, card, cardLocationList, params) {
  pushState(state, STATE_GAIN_CARD);
  state.gainCardOnTopOfDeck = !!params.onTopOfDeck;
  state.gainCardIntoHand = !!params.intoHand;
  state.gainCardCostingUpTo = params.costingUpTo;
  state.gainCardCostingUpToMoreThanTrashed = params.costingUpToMoreThanTrashed;
  state.gainCardName = params.name;
  state.gainCardType = params.type;
  state.waitingOnPlayerIndex = player.index;
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
    if (query.type != null && !isCardType(gameCard.card, query.type)) {
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

function doAttackPutCardsOnDeck(state, player, card, cardLocationList, params) {
  var attackerIndex = getCurrentPlayerIndex(state);
  for (var i = 0; i < state.players.length - 1; i += 1) {
    pushState(state, STATE_PUT_CARDS_ON_DECK);
    state.waitingOnPlayerIndex = euclideanMod(attackerIndex - i - 1, state.players.length);
    state.putCardsOnDeckType = params.type;
    state.putCardsOnDeckCount = params.amount;
    state.putCardsOnDeckElse = params['else'];
    attackPlayer(state, state.players[state.waitingOnPlayerIndex]);
  }
}

function doAttackDiscardDownTo(state, player, card, cardLocationList, params) {
  var attackerIndex = getCurrentPlayerIndex(state);
  for (var i = 0; i < state.players.length - 1; i += 1) {
    pushState(state, STATE_DISCARD_DOWN_TO);
    state.waitingOnPlayerIndex = euclideanMod(attackerIndex - i - 1, state.players.length);
    state.discardDownTo = params.amount;
    attackPlayer(state, state.players[state.waitingOnPlayerIndex]);
  }
}

function doAttackGainCard(state, player, card, cardLocationList, params) {
  var attackerIndex = getCurrentPlayerIndex(state);
  for (var i = 0; i < state.players.length - 1; i += 1) {
    pushState(state, STATE_GAIN_CARD);
    state.waitingOnPlayerIndex = euclideanMod(attackerIndex - i - 1, state.players.length);

    state.gainCardOnTopOfDeck = !!params.onTopOfDeck;
    state.gainCardCostingUpTo = params.costingUpTo;
    state.gainCardName = params.name;
    attackPlayer(state, state.players[state.waitingOnPlayerIndex]);
  }
}

function doAttackSpy(state, player, card, cardLocationList, params) {
  var attackerIndex = getCurrentPlayerIndex(state);
  for (var i = 0; i < state.players.length - 1; i += 1) {
    pushState(state, STATE_SPY_REVEAL);

    state.spyTargetPlayerIndex = euclideanMod(attackerIndex - i - 1, state.players.length);
    attackPlayer(state, state.players[state.spyTargetPlayerIndex]);
  }
  pushState(state, STATE_SPY_REVEAL);
  state.spyTargetPlayerIndex = attackerIndex;
}

function attackPlayer(state, victimPlayer) {
  state.isAttack = true;
  triggerCondition(state, victimPlayer, 'onAttack');
}

function triggerCondition(state, player, conditionName) {
  var playableReactionCards = [];
  for (var cardI = 0; cardI < player.hand.length; cardI += 1) {
    var card = player.hand[cardI];
    if (!card.condition) continue;
    if (card.condition.name === conditionName) {
      playableReactionCards.push(card);
      break;
    }
  }
  if (playableReactionCards.length > 0) {
    pushState(state, STATE_REACTION);
    state.playableReactionCards = playableReactionCards;
  }
}

function doTrashThisCardEffect(state, player, card, cardLocationList, params) {
  pushState(state, STATE_TRASH_THIS_CARD);
  state.trashCardLocationList = cardLocationList;
  state.trashName = card.name;
  state.waitingOnPlayerIndex = player.index;
}

function doRevealHandEffect(state, player, card, cardLocationList, params) {
  pushState(state, STATE_REVEAL_HAND);
  state.waitingOnPlayerIndex = player.index;
}

function doTrashCardsEffect(state, player, card, cardLocationList, params) {
  pushState(state, STATE_TRASH);
  state.trashMandatory = !!params.mandatory
  state.trashActionsLeft = params.amount;
  state.trashType = params.type;
  state.trashName = params.name;
  state.waitingOnPlayerIndex = player.index;
}

function doRevealThisCardEffect(state, player, card, cardLocationList, params) {
  pushState(state, STATE_REVEAL_THIS_CARD);
  state.revealCardName = card.name;
  state.waitingOnPlayerIndex = player.index;
}

function doUnaffectedByAttackEffect(state, player, card, cardLocationList, params) {
  var prevStackFrame = state.stateStack[state.stateStack.length - 1];
  prevStackFrame.unaffectedByAttack = true;
}

function doDiscardDeckEffect(state, player, card, cardLocationList, params) {
  pushState(state, STATE_DISCARD_DECK);
  state.waitingOnPlayerIndex = player.index;
}

function doOtherPlayersDrawEffect(state, player, card, cardLocationList, params) {
  if (!params.amount) throw new Error("missing amount parameter");
  pushState(state, STATE_OTHER_PLAYERS_DRAW);
  state.otherPlayersDrawAmount = params.amount;
}

function doPlusAction(state, player, card, cardLocationList, params) {
  if (!params.amount) throw new Error("missing amount parameter");
  pushState(state, STATE_PLUS_ACTION);
  state.plusActionCount = params.amount;
  state.waitingOnPlayerIndex = player.index;
}

function doPlusTreasure(state, player, card, cardLocationList, params) {
  if (!params.amount) throw new Error("missing amount parameter");
  pushState(state, STATE_PLUS_TREASURE);
  state.plusTreasureIfYouDidTrash = !!params.ifYouDidTrash;
  state.plusTreasureCount = params.amount;
  state.waitingOnPlayerIndex = player.index;
}

function doPlusBuy(state, player, card, cardLocationList, params) {
  if (!params.amount) throw new Error("missing amount parameter");
  pushState(state, STATE_PLUS_BUY);
  state.plusBuyCount = params.amount;
  state.waitingOnPlayerIndex = player.index;
}

function doPlusCard(state, player, card, cardLocationList, params) {
  if (!params.amount) throw new Error("missing amount parameter");
  pushState(state, STATE_PLUS_CARD);
  state.plusCardCount = params.amount;
  state.waitingOnPlayerIndex = player.index;
}

function doRevealUntilCard(state, player, card, cardLocationList, params) {
  pushState(state, STATE_REVEAL_UNTIL_CARD);
  state.revealUntilCardCount = params.amount;
  state.revealUntilCardType = params.type;
  state.waitingOnPlayerIndex = player.index;
}

function doPutRevealedCardsIntoHand(state, player, card, cardLocationList, params) {
  pushState(state, STATE_PUT_REVEALED_CARDS_INTO_HAND);
  state.putRevealedCardsIntoHandType = params.type;
  state.waitingOnPlayerIndex = player.index;
}

function doDiscardRevealedCards(state, player, card, cardLocationList, params) {
  pushState(state, STATE_DISCARD_REVEALED_CARDS);
  state.waitingOnPlayerIndex = player.index;
}

function revealUntilMatching(state, player, params) {
  var amountFound = 0;
  while (player.deck.length + player.discardPile.length > 0 && amountFound < params.count) {
    playerRevealCards(state, player, 1);
    var revealedCard = player.revealedCards[player.revealedCards.length - 1];
    if (isCardType(revealedCard, params.type)) {
      amountFound += 1;
    }
  }
}

function putRevealedCardsIntoHand(state, player, cardType) {
  var i = 0;
  for (; i < player.revealedCards.length;) {
    var card = player.revealedCards[i];
    if (isCardType(card, cardType)) {
      player.revealedCards.splice(i, 1);
      player.hand.push(card);
      continue;
    }
    i += 1;
  }
}

function euclideanMod(numerator, denominator) {
  var result = numerator % denominator;
  return result < 0 ? result + denominator : result;
}
