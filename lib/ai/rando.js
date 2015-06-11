exports.chooseMove = chooseMove;

function chooseMove(dominion, state, moveList, callback) {
  var playMoves = [];
  var buyMoves = [];
  var i, move, card;
  for (i = 0; i < moveList.length; i += 1) {
    move = moveList[i];
    if (move.name === 'play') {
      playMoves.push(move);
    } else if (move.name === 'buy') {
      buyMoves.push(move);
    }
  }

  if (playMoves.length > 0) {
    callback(null, playMoves[state.rng.integer(playMoves.length)]);
    return;
  }

  if (buyMoves.length > 0) {
    buyMoves.sort(compareCost);
    var real = state.rng.real() * 2;
    var index = Math.min(buyMoves.length - 1, Math.floor(real * buyMoves.length));
    callback(null, buyMoves[index]);
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
    var card = dominion.getCard(move.params.card);
    return card.cost;
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
