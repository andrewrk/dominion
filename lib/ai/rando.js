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
    } else if (move.name === 'buy') {
      buyMoves.push(move);
    } else if (move.name === 'discard') {
      discardMoves.push(move);
    }
  }

  if (actionMoves.length > 0) {
    callback(null, actionMoves[state.rng.integer(actionMoves.length)]);
    return;
  }

  if (treasureMoves.length > 0) {
    callback(null, treasureMoves[state.rng.integer(treasureMoves.length)]);
    return;
  }

  if (buyMoves.length > 0) {
    buyMoves.sort(compareCost);
    var real = state.rng.real() * 2;
    var index = Math.min(buyMoves.length - 1, Math.floor(real * buyMoves.length));
    callback(null, buyMoves[index]);
    return;
  }

  if (discardMoves.length > 0) {
    discardMoves.sort(compareDiscardPriority);
    callback(null, discardMoves[0]);
    return;
  }

  var moveIndex = state.rng.integer(moveList.length);
  var selectedMove = moveList[moveIndex];
  callback(null, selectedMove);

  function compareCost(moveA, moveB) {
    var a = getMoveCost(moveA);
    var b = getMoveCost(moveB);
    var cmp = compare(a, b);
    if (cmp !== 0) return cmp;
    return (state.rng.integer(2) === 1) ? -1 : 1;
  }

  function getMoveCost(move) {
    return getMoveCard(move).cost;
  }

  function getMoveCard(move) {
    return dominion.getCard(move.params.card);
  }

  function compareDiscardPriority(moveA, moveB) {
    var a = getDiscardPriority(moveA);
    var b = getDiscardPriority(moveB);
    return compare(a, b);
  }

  function getDiscardPriority(move) {
    var card = getMoveCard(move);
    if (dominion.isCardType(card, 'Curse')) {
      return -2;
    } else if (dominion.isCardType(card, 'Victory')) {
      return -1;
    } else {
      return card.cost;
    }
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
