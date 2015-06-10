exports.chooseMove = chooseMove;

function chooseMove(dominion, state, moveList, callback) {
  var moveIndex = state.rng.integer(moveList.length);
  var selectedMove = moveList[moveIndex];
  callback(null, selectedMove);
}
