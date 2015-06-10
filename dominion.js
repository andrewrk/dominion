var dominion = importAndProcessCards();
var nextState = 0;
var STATE_ACTION = nextState++;
var STATE_BUY = nextState++;
var moveTable = {
  'playCard': doPlayCardMove,
  'buy': doBuyMove,
};


var readline = require('readline');
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

var state = shuffleAndDeal(2);

userInputPrompt();

function userInputPrompt() {
  printGameState(state);
  console.log("Possible moves:");
  var moves = enumerateMoves(state);
  for (var i = 0; i < moves.length; i += 1) {
    var move = moves[i];
    console.log("(" + (i + 1) + ") " + moveToString(move));
  }
  doPrompt();

  function onUserInput(inputText) {
    var choice = parseInt(inputText, 10);
    var moveIndex = choice - 1;
    if (isNaN(choice) || moveIndex < 0 || moveIndex >= moves.length) {
      console.log("No.");
      doPrompt();
      return;
    }
    performMove(state, moves[moveIndex]);
    userInputPrompt();
  }

  function doPrompt() {
    rl.question("> ", onUserInput);
  }
}

function moveToString(move) {
  switch (move.name) {
    case 'playCard':
      return "Play " + move.params.card;
    case 'buy':
      return "Buy " + move.params.card;
    default:
      throw new Error("moveToString case missing: " + move.name);
  }
}

function enumerateMoves(state) {
  var moves = [];
  var player = state.players[state.currentPlayerIndex];

  switch (state.state) {
    case STATE_ACTION:
      enumerateActionMoves();
      enumerateBuyMoves();
      break;
    case STATE_BUY:
      enumerateBuyMoves();
      break;
    default:
      throw new Error("invalid state");
  }
  return moves;

  function enumerateActionMoves() {
    var seenActions = {};
    for (var i = 0; i < player.hand.length; i += 1) {
      var card = player.hand[i];
      if (isCardType(card, 'Action') || isCardType(card, 'Treasure')) {
        if (seenActions[card.name]) continue;
        seenActions[card.name] = true;
        moves.push({
          name: 'playCard',
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

  state.actionCount -= 1;
  // TODO
}

function doBuyMove(state, params) {
  var gameCard = state.cardTable[params.card];
  if (!gameCard) throw new Error("invalid card name");
  gameCard.count -= 1;
  if (gameCard.count < 0) throw new Error("invalid game card count");
  var player = state.players[state.currentPlayerIndex];
  playerGainCard(state, player, gameCard.card);
  state.buyCount -= 1;
  if (state.buyCount < 0) throw new Error("invalid buy count");
  if ((state.state === STATE_BUY || state.state === STATE_ACTION) && state.buyCount === 0) {
    playerDiscardHand(state, player);
    playerDraw(state, player, 5);
    state.state = STATE_ACTION;
    state.actionCount = 1;
    state.buyCount = 1;
    state.treasureCount = 0;
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
  }
}

function playerDiscardHand(state, player) {
  while (player.inPlay.length > 0) {
    player.discardPile.push(player.inPlay.pop());
  }
  while (player.hand.length > 0) {
    player.discardPile.push(player.hand.pop());
  }
}

function playerDraw(state, player, count) {
  for (var i = 0; i < count; i += 1) {
    if (player.deck.length === 0) {
      if (player.discardPile.length === 0) return;
      while (player.discardPile.length > 0) {
        player.deck.push(player.discardPile.pop());
      }
      shuffleArray(player.deck);
    }
    player.hand.push(player.deck.pop());
  }
}

function playerGainCard(state, player, card) {
  player.discardPile.push(card);
}

function performMove(state, move) {
  var fn = moveTable[move.name];
  if (!fn) throw new Error("illegal move");
  fn(state, move.params);
}

function shuffleAndDeal(howManyPlayers) {
  var i;
  var players = [];
  for (i = 0; i < howManyPlayers; i += 1) {
    players.push(createPlayerState(i));
  }
  var state = {
    currentPlayerIndex: 0,
    state: STATE_ACTION,
    actionCount: 1,
    buyCount: 1,
    treasureCount: 0,
    cardList: [],
    cardTable: {},
    players: players,
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
    var setIndex = Math.floor(Math.random() * dominion.setList.length);
    var set = dominion.setList[setIndex];
    list = listOfCardsPerSet[set.name];
    if (list.length > 0) {
      var listIndex = Math.floor(Math.random() * list.length);
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
      count: card.supply[howManyPlayers],
    };
    state.cardTable[card.name] = gameCard;
    state.cardList.push(gameCard);
  }

  function createPlayerState(playerIndex) {
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
    shuffleArray(deck);
    for (i = 0; i < 5; i += 1) {
      hand.push(deck.pop());
    }
    return {
      index: playerIndex,
      deck: deck,
      hand: hand,
      discardPile: [],
      inPlay: [],
    };
  }
}

function printGameState(state) {
  var i;
  for (i = 0; i < state.cardList.length; i += 1) {
    var card = state.cardList[i];
    console.log("(" + card.card.cost + ") x" + card.count + " " + card.card.name);
  }
  for (i = 0; i < state.players.length; i += 1) {
    var player = state.players[i];
    var vp = calcVictoryPoints(state, player);
    console.log(playerName(state, player.index) + " (" + vp + " victory points):");
    console.log("       in play: " + deckToString(player.inPlay));
    console.log("          deck: " + deckToString(player.deck));
    console.log("          hand: " + deckToString(player.hand));
    console.log("  discard pile: " + deckToString(player.discardPile));
  }
  console.log("Waiting for " + playerName(state, state.currentPlayerIndex) + " to " + stateIndexToString(state.state));
  console.log("Actions: " + state.actionCount +
           "   Buys: " + state.buyCount +
           "   Treasure: " + state.treasureCount);
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
      return "play an action or buy a card";
    case STATE_BUY:
      return "buy a card";
    default:
      throw new Error("missing stateIndexToString for " + stateIndex);
  }
}

function playerName(state, index) {
  return "Player " + (index + 1);
}

function deckToString(deck) {
  if (deck.length === 0) return "(empty)";
  return deck.map(getCardName).join(" ");
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

function shuffleArray(list) {
  var counter = list.length;
  while (counter) {
    var index = Math.floor(Math.random() * counter--);
    var temp = list[counter];
    list[counter] = list[index];
    list[index] = temp;
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
