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
  this._skipscore = false;

  _processArithmOptions(this._options);
}

function _processArithmOptions(options) {
  var reverse = !!options.reverse;
  if (options.gt !== undefined) {
    if (!reverse) {
      options._exclusiveStart = true;
      options.start = options.gt;
    } else {
      options._exclusiveEnd = true;
      options.end = options.gt;
    }
  } else if (options.gte !== undefined) {
    if (!reverse) {
      options.start = options.gte;
    } else {
      options.end = options.gte;
    }
  }
  if (options.lt !== undefined) {
    if (!reverse) {
      options._exclusiveEnd = true;
      options.end = options.lt;
    } else {
      options._exclusiveStart = true;
      options.start = options.lt;
    }
  } else if (options.lte !== undefined) {
    if (!reverse) {
      options.end = options.lte;
    } else {
      options.start = options.lte;
    }
  }
}

Iterator.prototype._next = function (callback) {
  if (this._limit > -1 && this._count >= this._limit) {
    return setImmediate(callback);
  }
  if (this._buffered.length === 0) {
    if (this._cursor === '0' && this._iterations !== 0) {
      return setImmediate(callback);
    }
    this._fetch(callback);
  } else {
    this._shift(callback);
  }
};

Iterator.prototype._fetch = function(callback) {
  var self = this;
  var reverse = !!this._options.reverse;
  if (this._options.start || this._options.end) {
    this._skipscore = false;
    var start = this._options.start !== undefined ? String(this._options.start) : '';
    var end = this._options.end !== undefined ? String(this._options.end) : '';
    if (start !== '' || end !== '') {
      start = start === '' ? (reverse ? '+' : '-') : ((this._options._exclusiveStart ? '(' : '[') + start);
      end   = end   === '' ? (reverse ? '-' : '+') : ((this._options._exclusiveEnd   ? '(' : '[') + end);
      var rangeArgs = [ this.db.location+':z', start, end ];
      if (this._options.limit > -1) {
        rangeArgs.push('LIMIT');
        rangeArgs.push(0);
        rangeArgs.push(this._options.limit);
      }
      this._iterations++;
      var cmd = this._options.reverse ? 'zrevrangebylex' : 'zrangebylex';
      return this.db.db.send_command(cmd, rangeArgs, function(e, reply) {
        if (!reply || reply.length === 0) {
          return setImmediate(callback);
        }
        self._buffered = reply;
        self._shift(callback);
      });
    }
  }

  if (reverse) {
    this._skipscore = false;
    this._iterations++;
    var revArgs = [ this.db.location+':z', 0, -1 ];
    return this.db.db.send_command('zrevrange', revArgs, function(e, reply) {
      if (!reply || reply.length === 0) {
        return setImmediate(callback);
      }
      self._buffered = reply;
      self._shift(callback);
    });
  }
  // this is the only true iterator
  this._skipscore = true;
  var args = [this.db.location+':z', this._cursor ];//, 'COUNT', 1];
  this.db.db.send_command('zscan', args, function(e, reply) {
    if (e || !reply) {
      return callback(self.db.closed ? null : e);
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
  var self = this;
  var _key = self._buffered.shift();
  this.db.db.hget(this.db.location+':h', _key, function(err, rawvalue) {
    if (err) { return callback(self.db.closed ? null : err); }
    var key, value, _value;
    try {
      _value = JSON.parse(rawvalue);
    } catch (e) {
      console.trace(e, _key, 'unable to parse ', rawvalue);
      return callback(e);
    }
    if (self._skipscore) {
      self._buffered.shift(); //skip the score
    }
    // todo: tell redis to return buffers and we have nothing to do?
    if (self._keyAsBuffer) {
      key = new Buffer(_key);
    } else {
      key = _key;
    }
    if (self._valueAsBuffer) {
      value = new Buffer(_value);
    } else {
      value = String(_value);
    }
    self._count++;
    callback(null, key, value);
  });
};
