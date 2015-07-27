var dominion = importAndProcessCards();
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var RNG = require('./rng');
var nextState = 0;
var STATE_INVALID = nextState++;
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
var STATE_SPY = nextState++;
var STATE_SPY_REVEAL = nextState++;
var STATE_EFFECT = nextState++;
var STATE_THIEF_REVEAL = nextState++;
var STATE_THIEF_TRASH = nextState++;
var STATE_THIEF_GAIN = nextState++;
var STATE_PLAY_ACTION_CARD = nextState++;
var STATE_LIBRARY_DRAW = nextState++;
var STATE_LIBRARY_CHOOSE = nextState++;
var STATE_DONE_RESOLVING_ACTION = nextState++;
var moveTable = {
  'play': doPlayCardMove,
  'buy': doBuyMove,
  'endTurn': doEndTurn,
  'discard': doDiscardMove,
  'doneDiscarding': doDoneDiscardingMove,
  'gain': doGainCardMove,
  'doneGaining': doDoneGainingMove,
  'putOnDeck': doPutCardOnDeckMove,
  'trash': doTrashMove,
  'doneTrashing': doDoneTrashingMove,
  'reaction': doReactionMove,
  'doneReacting': doDoneReactingMove,
  'discardDeck': doDiscardDeckMove,
  'noDiscardDeck': doNotDiscardDeckMove,
  'discardRevealed': doDiscardRevealedMove,
  'putBack': doPutBackMove,
  'keep': doKeepMove,
  'setAside': doSetAsideMove,
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
  'attackThief': doAttackThief,
  'playOtherCard': doPlayOtherCard,
  'libraryDraw': doLibraryDraw,
  'putCardsOnDeck': doPutCardsOnDeck,
  'putInTavern': doPutInTavern,
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
    case 'doneGaining':
      return "Done gaining cards";
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
    case 'keep':
      return "Keep";
    case 'setAside':
      return "Set aside";
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
      enumeratePlayMoves('Action');
      enumeratePlayMoves('Treasure');
      enumerateBuyMoves();
      addEndTurn();
      break;
    case STATE_TREASURE:
      enumeratePlayMoves('Treasure');
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
    case STATE_THIEF_TRASH:
      addThiefTrashMoves();
      break;
    case STATE_THIEF_GAIN:
      addThiefGainMoves();
      break;
    case STATE_PLAY_ACTION_CARD:
      enumeratePlayMoves('Action');
      break;
    case STATE_LIBRARY_CHOOSE:
      moves.push({name: "keep"});
      moves.push({name: "setAside"});
      break;
    default:
      throw new Error("invalid state");
  }
  return moves;

  function addThiefGainMoves() {
    moves.push({ name: 'doneGaining' });
    var seenActions = {};
    for (var i = 0; i < state.thiefPile.length; i += 1) {
      var thiefCard = state.thiefPile[i];
      if (seenActions[thiefCard.name]) continue;
      if (isCardInTrash(state, thiefCard)) {
        seenActions[thiefCard.name] = true;
        moves.push({
          name: 'gain',
          params: {
            card: thiefCard.name,
          },
        });
      }
    }
  }

  function addThiefTrashMoves() {
    var victimPlayer = getVictimPlayer(state);
    var trashCandidates = getMatchingRevealedCards(state, victimPlayer, { type: 'Treasure' });
    for (var i = 0; i < trashCandidates.length; i += 1) {
      moves.push({
        name: 'trash',
        params: {
          card: trashCandidates[i],
        }
      });
    }
  }

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
      costExact: state.gainCardCostExact,
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

  function enumeratePlayMoves(typeName) {
    var seenActions = {};
    for (var i = 0; i < player.hand.length; i += 1) {
      var card = player.hand[i];
      if (isCardType(card, typeName)) {
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
  if (state.state !== STATE_ACTION &&
      state.state !== STATE_TREASURE &&
      state.state !== STATE_PLAY_ACTION_CARD)
  {
    throw new Error("invalid state for playing a card");
  }

  var card = dominion.cardTable[params.card];
  var player = getCurrentPlayer(state);

  if (state.state !== STATE_PLAY_ACTION_CARD) {
    if (state.actionCount < 1 && isCardType(card, 'Action')) {
      throw new Error("not enough actions to play a card");
    }

    if (card.treasure) {
      state.treasureCount += card.treasure;
      if (state.state === STATE_ACTION) {
        popState(state);
      }
    }
    if (isCardType(card, 'Action')) {
      state.actionCount -= 1;
    }
  }
  state.effectDone = true;

  if (isCardType(card, 'Action')) {
    pushState(state, STATE_DONE_RESOLVING_ACTION);
    state.effectDone = false;
  }

  player.inPlay.push(removeCardFromHand(player, card.name));
  var amount = (state.state === STATE_PLAY_ACTION_CARD) ? state.playActionCardAmount : 1;
  for (var i = 0; i < amount; i += 1) {
    doEffects(state, player, card, player.inPlay, card.effects);
  }
  checkActionsOver(state);
}

function doEffects(state, player, card, cardLocationList, effectsList) {
  if (!effectsList)
    return;
  // since we're using a stack based solution we need to do the effects in reverse order
  for (var i = effectsList.length - 1; i >= 0; i -= 1) {
    var effect = effectsList[i];
    putEffectOnStack(state, player, card, player.inPlay, effect);
  }
}

function putEffectOnStack(state, player, card, cardLocationList, effect) {
    var fn = effectTable[effect.name];
    if (!fn) throw new Error("unrecognized effect: " + effect.name);
    pushState(state, STATE_EFFECT);
    state.effectDone = false;
    state.effectFn = fn;
    state.effectPlayer = player;
    state.effectCard = card;
    state.effectCardLocationList = cardLocationList;
    state.effectParams = effect.params;
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
      putEffectOnStack(state, player, null, null, elseClause);
      checkActionsOver(state);
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

function checkActionsOver(state) {
  if (state.gameOver) return;

  var player = getCurrentPlayer(state);
  var matchingCards;
  var prevStackFrame, victimPlayer;
  if (state.isAttack && state.unaffectedByAttack) {
    popState(state);
    return;
  }

  if (state.state === STATE_DONE_RESOLVING_ACTION) {
    if (state.effectDone) {
      popState(state);
    } else {
      state.effectDone = true;
      triggerCondition(state, player, 'afterResolvingAction');
    }
    checkActionsOver(state);
    return;
  }
  if (state.state === STATE_SPY_REVEAL) {
    victimPlayer = getVictimPlayer(state);
    playerRevealCards(state, victimPlayer, 1);
    state.state = STATE_SPY;
    return;
  }
  if (state.state === STATE_EFFECT) {
    if (state.effectDone) {
      if (state.effectFn === doTrashCardsEffect) {
        prevStackFrame = state.stateStack[state.stateStack.length - 1];
        prevStackFrame.costOfRecentlyTrashedCard = state.costOfRecentlyTrashedCard;
      }
      popState(state);
      return;
    }
    state.effectDone = true;
    state.effectFn(state, state.effectPlayer, state.effectCard, state.effectCardLocationList, state.effectParams);
    checkActionsOver(state);
    return;
  }

  if (state.state === STATE_LIBRARY_DRAW) {
    var prevHandSize = player.hand.length;
    if (prevHandSize >= 7) {
      discardRevealedCards(state, player);
      popState(state);
      return;
    }
    playerDraw(state, player, 1);
    if (player.hand.length !== prevHandSize + 1) {
      discardRevealedCards(state, player);
      popState(state);
      return;
    }
    var drawnCard = player.hand[player.hand.length - 1];
    if (isCardType(drawnCard, 'Action')) {
      pushState(state, STATE_LIBRARY_CHOOSE);
      return;
    }
    checkActionsOver(state);
    return;
  }
  if (state.state === STATE_PLAY_ACTION_CARD) {
    if (state.effectDone) {
      popState(state);
      return;
    }
    matchingCards = getMatchingCardsInHand(state, player, {type: 'Action'});
    if (matchingCards.length === 0) {
      popState(state);
    }
    return;
  }
  if (state.state === STATE_THIEF_REVEAL) {
    victimPlayer = getVictimPlayer(state);
    playerRevealCards(state, victimPlayer, 2);
    if (victimPlayer.revealedCards.length !== 2) throw new Error("expected 2 revealed cards");
    var trashCandidates = getMatchingRevealedCards(state, victimPlayer, { type: 'Treasure' });
    if (trashCandidates.length === 0) {
      discardRevealedCards(state, victimPlayer);
      popState(state);
      return;
    }
    state.state = STATE_THIEF_TRASH;
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
      costingUpTo: costingUpTo,
      costExact: state.gainCardCostExact,
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
      prevStackFrame = state.stateStack[state.stateStack.length - 1];
      prevStackFrame.costOfRecentlyTrashedCard = state.costOfRecentlyTrashedCard;
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
      popState(state);
      checkActionsOver(state);
    }
    return;
  }
  if (state.state === STATE_TREASURE && playerHandTreasureCardCount(state, player) === 0) {
    popState(state);
    checkActionsOver(state);
    return;
  }
  if (state.state === STATE_INVALID) {
    throw new Error("invalid state");
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

function removeExactCardFromList(list, card) {
  var index = list.indexOf(card);
  if (index < 0) throw new Error("card not found in list");
  list.splice(index, 1);
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

function removeCardFromRevealed(player, cardName) {
  return removeCardFromList(player.revealedCards, cardName);
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
  if (state.state === STATE_ACTION) {
    popState(state);
    popState(state);
  } else if (state.state === STATE_TREASURE) {
    popState(state);
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
      throw new Error("unexpected state: " + state);
  }
}

function doDoneDiscardingMove(state, params) {
  var player = getCurrentPlayer(state);
  playerDraw(state, player, state.discardCount);
  popState(state);
}

function doDoneGainingMove(state, params) {
  switch (state.state) {
    case STATE_THIEF_GAIN:
      state.thiefPile = state.thiefPiles.pop();
      popState(state);
      return;
    default:
      throw new Error("unexpected state: " + state);
  }
}

function doGainCardMove(state, params) {
  var player = getCurrentPlayer(state);
  switch (state.state) {
    case STATE_GAIN_CARD:
      var gameCard = state.cardTable[params.card];
      playerGainCard(state, player, gameCard, state.gainCardOnTopOfDeck, state.gainCardIntoHand);
      popState(state);
      return;
    case STATE_THIEF_GAIN:
      var card = removeCardFromList(state.thiefPile, params.card);
      removeExactCardFromList(state.trash, card);
      player.discardPile.push(card);
      break;
    default:
      throw new Error("unexpected state: " + state);
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
      throw new Error("unexpected state: " + state);
  }
}

function doTrashMove(state, params) {
  var card;
  if (state.state === STATE_THIEF_TRASH) {
    var victimPlayer = getVictimPlayer(state);
    card = removeCardFromRevealed(victimPlayer, params.card);
    state.trash.push(card);
    state.thiefPile.push(card);
    discardRevealedCards(state, victimPlayer);
    popState(state);
  } else {
    var player = getCurrentPlayer(state);
    card = removeCardFromHand(player, params.card);
    state.costOfRecentlyTrashedCard = card.cost;
    state.trashActionsLeft -= 1;
    state.trash.push(card);
  }
}

function doDoneTrashingMove(state, params) {
  popState(state);
}

function doReactionMove(state, params) {
  var player = getCurrentPlayer(state);
  var card = removeCardFromList(state.playableReactionCards, params.card);
  var cardLocationList, effects;
  if (card.condition && card.tavernCondition) {
    throw new Error("game engine weakness: can't handle both condition and tavernCondition");
  } else if (card.condition) {
    cardLocationList = player.hand;
    effects = card.condition.effects;
  } else if (card.tavernCondition) {
    cardLocationList = player.tavern;
    effects = card.tavernCondition.effects;
  } else {
    throw new Error("reaction happened with no condition");
  }
  doEffects(state, player, card, cardLocationList, effects);
  if (card.tavernCondition) {
    // call the reserve card
    player.inPlay.push(removeCardFromList(player.tavern, card.name));
  }
  checkActionsOver(state);
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
  var player = getVictimPlayer(state);
  while (player.revealedCards.length > 0) {
    player.discardPile.push(player.revealedCards.pop());
  }
  popState(state);
}

function doPutBackMove(state, params) {
  var player = getVictimPlayer(state);
  while (player.revealedCards.length > 0) {
    player.deck.push(player.revealedCards.pop());
  }
  popState(state);
}

function doKeepMove(state, params) {
  popState(state);
}

function doSetAsideMove(state, params) {
  var player = getCurrentPlayer(state);
  player.revealedCards.push(player.hand.pop());
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
  state.rankedPlayers = state.players.concat([]);
  state.rankedPlayers.sort(compareVpThenTurns);
  var nextRank = 1;
  var prev = null;
  for (i = 0; i < state.rankedPlayers.length; i += 1) {
    player = state.rankedPlayers[i];
    if (prev) {
      if (compareVpThenTurns(player, prev) !== 0) {
        nextRank += 1;
      }
    }
    player.rank = nextRank;
    prev = player;
  }
  state.gameOver = true;
  state.emit('gameOver', state.rankedPlayers);

  function compareVpThenTurns(a, b) {
    var cmp = compare(b.vp, a.vp);
    return (cmp === 0) ? compare(a.turnCount, b.turnCount) : cmp;
  }
}

function endTurn(state, player) {
  playerCleanUpHand(state, player);
  playerDraw(state, player, 5);

  checkEndOfGame(state);
  if (state.gameOver) return;

  resetStack(state);
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  state.turnIndex += 1;
  if (state.currentPlayerIndex === 0) state.roundIndex += 1;
  addTurnState(state);
}

function addTurnState(state) {
  pushState(state, STATE_BUY);
  pushState(state, STATE_TREASURE);
  pushState(state, STATE_ACTION);

  state.actionCount = 1;
  state.buyCount = 1;
  state.treasureCount = 0;
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
      log(state, 'shuffle', {
        player: player.index,
        deck: serializeDeck(player.deck),
      });
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
  log(state, 'move', {
    player: getCurrentPlayerIndex(state),
    move: move,
  });
  fn(state, move.params);
  checkActionsOver(state);
}

DominionGame.prototype.shuffleAndDeal = function(playerAiList, seed) {
  var rng = new RNG(seed);
  var i;
  var players = [];
  for (i = 0; i < playerAiList.length; i += 1) {
    players.push(createPlayerState(i, playerAiList[i]));
  }
  this.gameOver = false;
  this.currentPlayerIndex = 0;
  this.turnIndex = 0;
  this.roundIndex = 0;
  this.seed = seed;
  this.rng = rng;
  this.cardList = [];
  this.cardTable = {};
  this.trash = [];
  this.players = players;
  this.thiefPile = null;
  this.thiefPiles = [];
  // state items
  resetStack(this);
  addTurnState(this);

  var listOfCardsPerSet = {};
  var list, card;
  for (i = 0; i < dominion.cardList.length; i += 1) {
    card = dominion.cardList[i];
    if (!card.set) continue;
    list = listOfCardsPerSet[card.set.name] || (listOfCardsPerSet[card.set.name] = []);
    list.push(card);
  }

  var prosperityKingdomCardCount = 0;

  var kingdomCards = [];
  while (kingdomCards.length < 10) {
    var setIndex = rng.integer(dominion.setList.length);
    var set = dominion.setList[setIndex];
    list = listOfCardsPerSet[set.name];
    if (list.length > 0) {
      var listIndex = rng.integer(list.length);
      card = list[listIndex];
      if (card.set === 'Prosperity') {
        prosperityKingdomCardCount += 1;
      }
      list.splice(listIndex, 1);
      kingdomCards.push(card);
    }
  }

  var prosperityOn = (rng.real() < prosperityKingdomCardCount / 10);

  for (i = 0; i < dominion.cardList.length; i += 1) {
    card = dominion.cardList[i];
    if (card.includeCondition === 'always' ||
        (card.includeCondition === 'prosperity' && prosperityOn))
    {
      addCard(this, card);
    }
  }


  for (i = 0; i < kingdomCards.length; i += 1) {
    addCard(this, kingdomCards[i]);
  }

  this.cardList.sort(compareCostThenName);

  this.initialState = {
    cardTable: cloneCardTable(this.cardTable),
    players: getInitialStatePlayers(this.players),
  };
  this.log = [];

  function getInitialStatePlayers(players) {
    var result = [];
    for (var i = 0; i < players.length; i += 1) {
      var player = players[i];
      result.push({
        deck: player.deck.concat(player.hand),
      });
    }
    return result;
  }

  function cloneCardTable(cardTable) {
    var result = {};
    for (var cardName in cardTable) {
      result[cardName] = {
        card: cardTable[cardName].card,
        count: cardTable[cardName].count,
      };
    }
    return result;
  }

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
      tavern: [],
    };
  }
}

function resetStack(state) {
  state.stateStack = [];
  state.state = STATE_INVALID;
  state.effectDone = false;
  state.effectFn = null;
  state.effectPlayer = null;
  state.effectCard = null;
  state.effectCardLocationList = null;
  state.effectParams = null;
  state.discardCount = 0;
  state.gainCardOnTopOfDeck = false;
  state.gainCardCostingUpTo = 0;
  state.gainCardCostingUpToMoreThanTrashed = null;
  state.gainCardIntoHand = false;
  state.gainCardType = null;
  state.gainCardName = null;
  state.gainCardCostExact = null;
  state.putCardsOnDeckType = null;
  state.putCardsOnDeckCount = -1;
  state.putCardsOnDeckElse = null;
  state.waitingOnPlayerIndex = -1;
  state.trashActionsLeft = 0;
  state.trashMandatory = false;
  state.trashType = null;
  state.trashName = null;
  state.costOfRecentlyTrashedCard = -1;
  state.isAttack = false;
  state.unaffectedByAttack = false;
  state.playableReactionCards = [];
  state.victimPlayerIndex = -1;
  state.revealUntilCardCount = -1;
  state.revealUntilCardType = -1;
  state.playActionCardAmount = 0;
}

function pushState(state, newStateIndex) {
  state.stateStack.push({
    state: state.state,
    effectDone: state.effectDone,
    effectFn: state.effectFn,
    effectPlayer: state.effectPlayer,
    effectCard: state.effectCard,
    effectCardLocationList: state.effectCardLocationList,
    effectParams: state.effectParams,
    discardCount: state.discardCount,
    gainCardOnTopOfDeck: state.gainCardOnTopOfDeck,
    gainCardIntoHand: state.gainCardIntoHand,
    gainCardCostingUpTo: state.gainCardCostingUpTo,
    gainCardCostingUpToMoreThanTrashed: state.gainCardCostingUpToMoreThanTrashed,
    gainCardType: state.gainCardType,
    gainCardName: state.gainCardName,
    gainCardCostExact: state.gainCardCostExact,
    putCardsOnDeckType: state.putCardsOnDeckType,
    putCardsOnDeckCount: state.putCardsOnDeckCount,
    putCardsOnDeckElse: state.putCardsOnDeckElse,
    waitingOnPlayerIndex: state.waitingOnPlayerIndex,
    trashActionsLeft: state.trashActionsLeft,
    trashMandatory: state.trashMandatory,
    trashType: state.trashType,
    trashName: state.trashName,
    costOfRecentlyTrashedCard: state.costOfRecentlyTrashedCard,
    isAttack: state.isAttack,
    unaffectedByAttack: state.unaffectedByAttack,
    playableReactionCards: state.playableReactionCards.concat([]),
    victimPlayerIndex: state.victimPlayerIndex,
    revealUntilCardCount: state.revealUntilCardCount,
    revealUntilCardType: state.revealUntilCardType,
    playActionCardAmount: state.playActionCardAmount,
  });
  state.state = newStateIndex;
  state.isAttack = false;
}

function onlyPopState(state) {
  if (state.stateStack.length <= 0) throw new Error("state stack empty");
  var o = state.stateStack.pop();
  state.state = o.state;
  state.effectDone = o.effectDone;
  state.effectFn = o.effectFn;
  state.effectPlayer = o.effectPlayer;
  state.effectCard = o.effectCard;
  state.effectCardLocationList = o.effectCardLocationList;
  state.effectParams = o.effectParams;
  state.discardCount = o.discardCount;
  state.gainCardOnTopOfDeck = o.gainCardOnTopOfDeck;
  state.gainCardIntoHand = o.gainCardIntoHand;
  state.gainCardCostingUpTo = o.gainCardCostingUpTo;
  state.gainCardCostingUpToMoreThanTrashed = o.gainCardCostingUpToMoreThanTrashed;
  state.gainCardName = o.gainCardName;
  state.gainCardType = o.gainCardType;
  state.gainCardCostExact = o.gainCardCostExact;
  state.putCardsOnDeckType = o.putCardsOnDeckType;
  state.putCardsOnDeckCount = o.putCardsOnDeckCount;
  state.putCardsOnDeckElse = o.putCardsOnDeckElse;
  state.waitingOnPlayerIndex = o.waitingOnPlayerIndex;
  state.trashActionsLeft = o.trashActionsLeft;
  state.trashMandatory = o.trashMandatory;
  state.trashType = o.trashType;
  state.trashName = o.trashName;
  state.costOfRecentlyTrashedCard = o.costOfRecentlyTrashedCard;
  state.isAttack = o.isAttack;
  state.unaffectedByAttack = o.unaffectedByAttack;
  state.playableReactionCards = o.playableReactionCards;
  state.victimPlayerIndex = o.victimPlayerIndex;
  state.revealUntilCardCount = o.revealUntilCardCount;
  state.revealUntilCardType = o.revealUntilCardType;
  state.playActionCardAmount = o.playActionCardAmount;
}

function popState(state) {
  onlyPopState(state);
  checkActionsOver(state);
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

function getVictimPlayer(state) {
  if (state.victimPlayerIndex < 0) {
    throw new Error("expected victimPlayerIndex to be >= 0");
  }
  var player = state.players[state.victimPlayerIndex];
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
    player.tavern.length +
    player.revealedCards.length;
}

function iterateAllPlayerCards(player, onCard) {
  player.deck.forEach(onCard);
  player.discardPile.forEach(onCard);
  player.hand.forEach(onCard);
  player.inPlay.forEach(onCard);
  player.tavern.forEach(onCard);
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
    case STATE_THIEF_TRASH:
      return "choose which of the opponent's revealed cards to trash";
    case STATE_THIEF_GAIN:
      return "choose which stolen cards to gain";
    case STATE_PLAY_ACTION_CARD:
      return "choose an action card to play";
    case STATE_LIBRARY_DRAW:
      return "draw until 7 cards in hand";
    case STATE_LIBRARY_CHOOSE:
      return "choose whether to keep or set aside drawn card";
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
  state.gainCardCostExact = !!params.costExact;
  state.waitingOnPlayerIndex = player.index;
}

function getMatchingCardsInList(state, list, query) {
  var results = {};
  for (var i = 0; i < list.length; i += 1) {
    var card = list[i];
    var match = true;
    if (query.name != null && card.name !== query.name) {
      match = false;
    }
    if (query.costingUpTo != null && card.cost > query.costingUpTo) {
      match = false;
    }
    if (query.costingUpTo != null && query.costExact && card.cost !== query.costingUpTo) {
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

function getMatchingCardsInHand(state, player, query) {
  return getMatchingCardsInList(state, player.hand, query);
}

function getMatchingRevealedCards(state, player, query) {
  return getMatchingCardsInList(state, player.revealedCards, query);
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
    if (query.costingUpTo != null && query.costExact && gameCard.card.cost !== query.costingUpTo) {
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

function doAttackThief(state, player, card, cardLocationList, params) {
  var attackerIndex = getCurrentPlayerIndex(state);
  pushState(state, STATE_THIEF_GAIN);
  state.thiefPiles.push(state.thiefPile = []);

  for (var i = 0; i < state.players.length - 1; i += 1) {
    pushState(state, STATE_THIEF_REVEAL);

    state.victimPlayerIndex = euclideanMod(attackerIndex - i - 1, state.players.length);
    attackPlayer(state, state.players[state.victimPlayerIndex]);
  }
}

function doAttackSpy(state, player, card, cardLocationList, params) {
  var attackerIndex = getCurrentPlayerIndex(state);
  for (var i = 0; i < state.players.length - 1; i += 1) {
    pushState(state, STATE_SPY_REVEAL);

    state.victimPlayerIndex = euclideanMod(attackerIndex - i - 1, state.players.length);
    attackPlayer(state, state.players[state.victimPlayerIndex]);
  }
  pushState(state, STATE_SPY_REVEAL);
  state.victimPlayerIndex = attackerIndex;
}

function attackPlayer(state, victimPlayer) {
  state.isAttack = true;
  triggerCondition(state, victimPlayer, 'onAttack');
}

function triggerCondition(state, player, conditionName) {
  var playableReactionCards = [];
  var cardI, card;
  for (cardI = 0; cardI < player.hand.length; cardI += 1) {
    card = player.hand[cardI];
    if (card.condition && card.condition.name === conditionName) {
        playableReactionCards.push(card);
    }
  }
  for (cardI = 0; cardI < player.tavern.length; cardI += 1) {
    card = player.tavern[cardI];
    if (card.tavernCondition && card.tavernCondition.name === conditionName) {
      playableReactionCards.push(card);
    }
  }
  if (playableReactionCards.length > 0) {
    pushState(state, STATE_REACTION);
    state.playableReactionCards = playableReactionCards;
  }
}

function doTrashThisCardEffect(state, player, card, cardLocationList, params) {
  state.trash.push(removeCardFromList(cardLocationList, card.name));
}

function doPutInTavern(state, player, card, cardLocationList, params) {
  player.tavern.push(removeCardFromList(cardLocationList, card.name));
}

function doRevealHandEffect(state, player, card, cardLocationList, params) {
  state.emit('revealHand', player);
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
  state.emit('reveal', player, card.name);
}

function doUnaffectedByAttackEffect(state, player, card, cardLocationList, params) {
  var prevStackFrame = state.stateStack[state.stateStack.length - 1];
  if (!prevStackFrame.isAttack) throw new Error("moat affected wrong stack frame");
  prevStackFrame.unaffectedByAttack = true;
}

function doDiscardDeckEffect(state, player, card, cardLocationList, params) {
  pushState(state, STATE_DISCARD_DECK);
  state.waitingOnPlayerIndex = player.index;
}

function doOtherPlayersDrawEffect(state, player, card, cardLocationList, params) {
  if (!params.amount) throw new Error("missing amount parameter");
  for (var i = 1; i < state.players.length; i += 1) {
    var otherPlayerIndex = euclideanMod(player.index + i, state.players.length);
    var otherPlayer = state.players[otherPlayerIndex];
    playerDraw(state, otherPlayer, params.amount);
  }
}

function doPlusAction(state, player, card, cardLocationList, params) {
  if (!params.amount) throw new Error("missing amount parameter");
  state.actionCount += params.amount;
}

function doPlusTreasure(state, player, card, cardLocationList, params) {
  if (!params.amount) throw new Error("missing amount parameter");
  if (!params.ifYouDidTrash || state.costOfRecentlyTrashedCard >= 0) {
    state.treasureCount += params.amount;
  }
}

function doPlusBuy(state, player, card, cardLocationList, params) {
  if (!params.amount) throw new Error("missing amount parameter");
  state.buyCount += params.amount;
}

function doPlusCard(state, player, card, cardLocationList, params) {
  if (!params.amount) throw new Error("missing amount parameter");
  playerDraw(state, player, params.amount);
}

function doRevealUntilCard(state, player, card, cardLocationList, params) {
  var amountFound = 0;
  while (player.deck.length + player.discardPile.length > 0 && amountFound < params.amount) {
    playerRevealCards(state, player, 1);
    var revealedCard = player.revealedCards[player.revealedCards.length - 1];
    if (isCardType(revealedCard, params.type)) {
      amountFound += 1;
    }
  }
}

function doPutRevealedCardsIntoHand(state, player, card, cardLocationList, params) {
  var i = 0;
  for (; i < player.revealedCards.length;) {
    var revealedCard = player.revealedCards[i];
    if (isCardType(revealedCard, params.type)) {
      player.revealedCards.splice(i, 1);
      player.hand.push(revealedCard);
      continue;
    }
    i += 1;
  }
}

function doDiscardRevealedCards(state, player, card, cardLocationList, params) {
  discardRevealedCards(state, player);
}

function doPlayOtherCard(state, player, card, cardLocationList, params) {
  pushState(state, STATE_PLAY_ACTION_CARD);
  state.playActionCardAmount = params.amount;
  state.effectDone = false;
}

function doLibraryDraw(state, player, card, cardLocationList, params) {
  pushState(state, STATE_LIBRARY_DRAW);
}

function doPutCardsOnDeck(state, player, card, cardLocationList, params) {
  pushState(state, STATE_PUT_CARDS_ON_DECK);
  state.putCardsOnDeckType = params.type;
  state.putCardsOnDeckCount = params.amount;
  state.putCardsOnDeckElse = params['else'];
}

function discardRevealedCards(state, player) {
  while (player.revealedCards.length > 0) {
    player.discardPile.push(player.revealedCards.pop());
  }
}

function euclideanMod(numerator, denominator) {
  var result = numerator % denominator;
  return result < 0 ? result + denominator : result;
}

function isCardInTrash(state, card) {
  return state.trash.indexOf(card) >= 0;
}

function log(state, name, args) {
  state.emit('log', name, args);
  state.log.push({
    name: name,
    params: args,
  });
}

function serializeDeck(deck) {
  return deck.map(getCardName);
}
