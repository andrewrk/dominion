var dominion = importAndProcessCards();
var nextState = 0;
var STATE_ACTION = nextState++;
var STATE_BUY = nextState++;

var state = shuffleAndDeal(2);
console.log(enumerateMoves(state));
printGameState(state);

function enumerateMoves(state) {
}

function shuffleAndDeal(howManyPlayers) {
  var i;
  var players = [];
  for (i = 0; i < howManyPlayers; i += 1) {
    players.push(createPlayerState(i));
  }
  var state = {
    currentPlayerIndex: 0,
    state: STATE_BUY,
    actionCount: 0,
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
    };
  }
}

function printGameState(state) {
  var i;
  for (i = 0; i < state.cardList.length; i += 1) {
    var card = state.cardList[i];
    console.log("(" + card.card.cost + ") " + card.card.name + " x" + card.count);
  }
  for (i = 0; i < state.players.length; i += 1) {
    printPlayerState(state.players[i]);
  }

  function printPlayerState(player) {
    console.log("Player " + (player.index + 1) + ":");
    console.log("  deck: " + deckToString(player.deck));
    console.log("  hand: " + deckToString(player.hand));
  }
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
