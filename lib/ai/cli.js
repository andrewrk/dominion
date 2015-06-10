var readline = require('readline');
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

exports.chooseMove = chooseMove;

function chooseMove(dominion, state, moveList, callback) {
  doPrompt();

  function onUserInput(inputText) {
    var choice = parseInt(inputText, 10);
    var moveIndex = choice - 1;
    if (isNaN(choice) || moveIndex < 0 || moveIndex >= moveList.length) {
      console.log("No.");
      doPrompt();
      return;
    }
    callback(null, moveList[moveIndex]);
  }

  function doPrompt() {
    rl.question("> ", onUserInput);
  }
}
