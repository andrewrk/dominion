exports.chooseMove = chooseMove;

function chooseMove(dominion, state, moveList, callback) {
  var actionMoves = [];
  var treasureMoves = [];
  var buyMoves = [];
  var discardMoves = [];
  var i, move, card;
  for (i = 0; i < moveList.length; i += 1) {
    move = moveList[i];
    if (move.name === 'play') {
      card = dominion.cardTable[move.params.card];
      if (dominion.isCardType(card, 'Treasure')) {
        treasureMoves.push(move);
      } else {
        actionMoves.push(move);
      }
    } else if (move.name === 'buy' || move.name === 'endTurn') {
      buyMoves.push(move);
    } else if (move.name === 'discard') {
      discardMoves.push(move);
    }
  }

  if (actionMoves.length > 0) {
    callback(null, findBest(actionMoves, scoreActionMove));
    return;
  }

  if (treasureMoves.length > 0) {
    callback(null, findBest(treasureMoves, scoreTreasureMove));
    return;
  }

  if (buyMoves.length > 0) {
    callback(null, findBest(buyMoves, scoreBuyMove));
    return;
  }

  if (discardMoves.length > 0) {
    callback(null, findBest(discardMoves, scoreDiscardMove));
    return;
  }

  var moveIndex = state.rng.integer(moveList.length);
  var selectedMove = moveList[moveIndex];
  callback(null, selectedMove);

  function scoreActionMove(move) {
    var card = dominion.getCard(move.params.card);
    if (card.name === 'Throne Room') {
      return 14;
    } else if (cardPlusActionCount(card) >= 1) {
      return 13;
    } else if (state.actionCount >= 2 && cardPlusCardCount(card)) {
      return 12;
    } else {
      return card.cost;
    }
  }

  function scoreTreasureMove(move) {
    var card = dominion.getCard(move.params.card);
    return card.cost;
  }

  function scoreBuyMove(move) {
    if (move.name === 'endTurn') {
      return 0;
    } else {
      var card = dominion.getCard(move.params.card);
      if (dominion.isCardType(card, 'Curse')) {
        return -1;
      } else {
        return card.cost;
      }
    }
  }

  function scoreDiscardMove(move) {
    var card = dominion.getCard(move.params.card);
    if (dominion.isCardType(card, 'Curse')) {
      return 2;
    } else if (dominion.isCardType(card, 'Victory')) {
      return 1;
    } else {
      return -card.cost;
    }
  }

  function findBest(list, scoreFn) {
    if (list.length === 0) throw new Error("need at least 1 item");
    var bestItems = [list[0]];
    var bestScore = scoreFn(list[0]);
    for (var i = 1; i < list.length; i += 1) {
      var thisItem = list[i];
      var thisScore = scoreFn(thisItem);
      if (thisScore > bestScore) {
        bestItems = [thisItem];
        bestScore = thisScore;
      } else if (thisScore === bestScore) {
        bestItems.push(thisItem);
      }
    }
    return bestItems[state.rng.integer(bestItems.length)];
  }
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

function cardPlusActionCount(card) {
  if (!card.effects) return 0;
  var plusActionCount = 0;
  for (var i = 0; i < card.effects.length; i += 1) {
    var effect = card.effects[i];
    if (effect.name === 'plusAction') {
      plusActionCount += effect.params.amount;
    }
  }
  return plusActionCount;
}

function cardPlusCardCount(card) {
  if (!card.effects) return 0;
  var plusCardCount = 0;
  for (var i = 0; i < card.effects.length; i += 1) {
    var effect = card.effects[i];
    if (effect.name === 'plusCard') {
      plusCardCount += effect.params.amount;
    }
  }
  return plusCardCount;
}
