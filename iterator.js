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

  this._iterations = 0;
  this._offset = 0;
  this._sizeKeys   = this._options.sizeKeys || db.batchSizeKeys || 1024;
  this._sizeValues = this._options.sizeValues || db.batchSizeValues || 128;

  this._keyPointer   = 0;
  this._bufferedKeys = [];
  this._keys         = this._bufferedKeys;

  _processArithmOptions(this._options);
  this.prepareQuery();
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

Iterator.prototype.prepareQuery = function() {
  var reverse = !!this._options.reverse;
  this._reverse = reverse;
  if (this._options.start || this._options.end) {
    var start = this._options.start !== undefined ? String(this._options.start) : '';
    var end = this._options.end !== undefined ? String(this._options.end) : '';
    if (start !== '' || end !== '') {
      this._start = start === '' ? (reverse ? '+' : '-') : ((this._options._exclusiveStart ? '(' : '[') + start);
      this._end   = end   === '' ? (reverse ? '-' : '+') : ((this._options._exclusiveEnd   ? '(' : '[') + end);
      return;
    }
  }
  this._start = reverse ? '+' : '-';
  this._end   = reverse ? '-' : '+';
};

Iterator.prototype._next = function (callback) {
  if (this._limit > -1 && this._count >= this._limit) {
    return setImmediate(callback);
  }
  if (this._valPointer && this._valPointer < this._keys.length) {
    this._shift(callback);
  } else if (!this._bufferedKeys.length || this._keyPointer >= this._bufferedKeys.length) {
    this._fetchKeys(callback);
  } else {
    this._fetchValues(callback);
  }
};

/**
 * Gets a batch of keys
 */
Iterator.prototype._fetchKeys = function(callback) {
  if (this.db.closed) { return callback(); }
  var rangeArgs = [ this.db.location+':z', this._start, this._end ];
  rangeArgs.push('LIMIT');
  rangeArgs.push(this._offset);
  var size;
  if (this._options.limit > -1) {
    var remain = this._options.limit - this._offset;
    if (remain <= 0) {
      return callback();
    }
    size = remain <= this._sizeKeys ? remain : this._sizeKeys;
  } else {
    size = this._sizeKeys;
  }
  this._offset += size;
  rangeArgs.push(size);
  this._iterations++;
  var cmd = this._options.reverse ? 'zrevrangebylex' : 'zrangebylex';
  var self = this;
  return this.db.db.send_command(cmd, rangeArgs, function(e, reply) {
    if (!reply || reply.length === 0) {
      return setImmediate(callback);
    }
    self._keyPointer = 0;
    self._bufferedKeys = reply;
    self._fetchValues(callback);
  });

};

Iterator.prototype._fetchValues = function(callback) {
  if (this.db.closed) { return callback(); }
  var self = this;
  if (this._keyPointer === 0 && this._sizeValues >= this._bufferedKeys.length) {
    this._keys = this._bufferedKeys;
  } else {
    this._keys = this._bufferedKeys.slice(this._keyPointer, this._keyPointer + this._sizeValues);
  }
  this._keyPointer += this._sizeValues;
  this.db.db.hmget(this.db.location+':h', this._keys, function(err, values) {
    if (err) { return callback(self.db.closed ? null : err); }
    self._values = values;
    if (!values.length) {
      return callback();
    }
    self._valPointer = 0;
    self._shift(callback);
  });
};

/**
 * Gets the next key/value from the buffered keys and values.
 */
Iterator.prototype._shift = function(callback) {
    // todo: tell redis to return buffers and we have less things to do?
  var key, value;
  var i = this._valPointer;
  this._valPointer++;
  if (this._keyAsBuffer) {
    key = new Buffer(this._keys[i]);
  } else {
    key = this._keys[i];
  }
  try {
    value = JSON.parse(this._values[i]);
  } catch(x) {
    console.trace('unexpected', this._values[i], x);
  }
  if (this._valueAsBuffer) {
    value = new Buffer(value);
  } else {
    value = String(value);
  }
  this._count++;
  callback(null, key, value);
};
