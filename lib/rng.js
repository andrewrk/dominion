var Random = require('random-js');

Math.random = function() {
  throw new Error("nope. you gotta use a seeded RNG.");
};

module.exports = RNG;

function RNG(seed) {
  if (!seed) throw new Error("need seed");
  this.seed = seed;
  this.mt = Random.engines.mt19937();
  this.mt.seed(this.seed);
}

RNG.prototype.real = function() {
  return Random.realZeroToOneExclusive(this.mt);
};

RNG.prototype.integer = function(upperBound) {
  return Math.floor(this.real() * upperBound);
};

RNG.prototype.shuffle = function(list) {
  var counter = list.length;
  while (counter) {
    var index = Math.floor(this.real() * counter--);
    var temp = list[counter];
    list[counter] = list[index];
    list[index] = temp;
  }
};
