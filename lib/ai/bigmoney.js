exports.chooseMove = chooseMove;

var wantedCards = {
  'Province': 2,
  'Silver': 1,
  'Gold': 0,
};

function chooseMove(dominion, state, moveList, callback) {
  // try to play a treasure card
  var i, move, card;
  for (i = 0; i < moveList.length; i += 1) {
    move = moveList[i];
    if (move.name === 'playCard') {
      card = dominion.cardTable[move.params.card];
      if (dominion.isCardType(card, 'Treasure')) {
        callback(null, move);
        return;
      }
    }
  }

  var bestPriority = -1;
  var bestMove = null;
  for (i = 0; i < moveList.length; i += 1) {
    move = moveList[i];
    var priority = getMovePriority(move);
    if (!bestMove || priority > bestPriority) {
      bestMove = move;
      bestPriority = priority;
    }
  }
  callback(null, bestMove);
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

function getMovePriority(move) {
  if (move.name === 'buy') {
    var priority = wantedCards[move.params.card];
    return (priority == null) ? -1 : priority;
  } else {
    return -1;
  }
}
