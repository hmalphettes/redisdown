'use strict';
var inherits = require('util').inherits;
var AbstractIterator = require('abstract-leveldown/abstract-iterator');
inherits(Iterator, AbstractIterator);
module.exports = Iterator;

function goodOptions(opts, name) {
  if (!(name in opts)) {
    return;
  }
  var thing = opts[name];
  if (thing === null) {
    delete opts[name];
    return;
  }
  if (Buffer.isBuffer(thing) || typeof thing === 'string') {
    if (!thing.length) {
      delete opts[name];
    }
  }
}
var names = [
  'start',
  'end',
  'gt',
  'gte',
  'lt',
  'lte'
];

function Iterator(db, options) {
  AbstractIterator.call(this, db);
  options = options || {};
  this._order = !options.reverse;
  this._options = options;
	for (var i = 0; i < options.length; i++) {
		goodOptions(options, i);
	}
  this._count = 0;
  this._limit = options.limit || -1;
  if ('keyAsBuffer' in options) {
    this._keyAsBuffer = options.keyAsBuffer;
  } else {
    this._keyAsBuffer = true;
  }
  if ('valueAsBuffer' in options) {
    this._valueAsBuffer = options.valueAsBuffer;
  } else {
    this._valueAsBuffer = true;
  }

  this._cursor = '0';
  this._iterations = 0;

  this._buffered = [];
}

Iterator.prototype._next = function (callback) {
  if ((this._limit > -1 && this._count >= this._limit) ||
     (this._cursor === '0' && this._iterations !== 0)) {
    return setImmediate(function () {
      callback();
    });
  }
  if (this._buffered.length === 0) {
    this._fetch(callback);
  } else {
    this._shift(callback);
  }
};

Iterator.prototype._fetch = function(callback) {
  var self = this;
  var args = [this.db.location, this._cursor, 'COUNT', 1];
  this.db.redis.send_command('hscan', args, function(e, reply) {
    if (e || !reply) {
      return callback(e);
    }
    self._iterations++;
    self._cursor = reply[0];
    if (reply[1].length === 0 && !self._ended) {
      return self._next(callback);
    }
    self._buffered = reply[1];
    self._shift(callback);
  });
};

Iterator.prototype._shift = function(callback) {
  this._count++;
  var key, value;
  var _key = this._buffered.shift();
  var _value;
  try {
    _value = JSON.parse(this._buffered.shift());
  } catch (e) {
    return callback(e);
  }
  console.log('after shift', this._buffered.length);
  // todo: tell redis tor eturn us buffers and we have nothing to do?
  if (this._keyAsBuffer) {
    key = new Buffer(_key);
  } else {
    key = _key;
  }
  if (this._valueAsBuffer) {
    value = new Buffer(_value);
  } else {
    value = String(_value);
  }
  callback(null, key, value);
};
