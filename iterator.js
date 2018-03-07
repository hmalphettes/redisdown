'use strict';
var inherits = require('util').inherits;
var AbstractIterator = require('abstract-leveldown/abstract-iterator');
inherits(Iterator, AbstractIterator);
module.exports = Iterator;

var scriptsloader = require('./scriptsloader');

var concatKey = function(prefix, key, force) {
  if (typeof key === 'string' && (force || key.length)) return prefix + key;
  if (Buffer.isBuffer(key) && (force || key.length))
    return Buffer.concat([new Buffer(prefix), key]);
  return key;
};

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
var names = ['start', 'end', 'gt', 'gte', 'lt', 'lte'];

function Iterator(db, options) {
  AbstractIterator.call(this, db);
  options = options || {};
  for (var i = 0; i < options.length; i++) {
    goodOptions(options, i);
  }
  this._count = 0;
  this._limit = isNaN(options.limit) ? -1 : options.limit;

  this._keyAsBuffer = 'keyAsBuffer' in options ? !!options.keyAsBuffer : false;
  this._valueAsBuffer =
    'valueAsBuffer' in options ? !!options.valueAsBuffer : false;
  this._keys = 'keys' in options ? !!options.keys : true;
  this._values = 'values' in options ? !!options.values : true;

  this._iterations = 0;
  this._offset = 0;
  this._highWaterMark = options.highWaterMark || db.highWaterMark || 256;

  this._pointer = 0;
  this._buffered = [];

  _processArithmOptions(options);

  this.prepareQuery(options);
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

Iterator.prototype.prepareQuery = function(options) {
  this._reverse = !!options.reverse;
  if (!this._values) {
    // key streams: no need for lua
    this.cmdName = this._reverse ? 'zrevrangebylex' : 'zrangebylex';
  } else {
    var scriptName;
    if (!this._keys) {
      if (this._reverse) {
        scriptName = 'zhrevvalues-lk';
      } else {
        scriptName = 'zhvalues-lk';
      }
    } else {
      if (this._reverse) {
        scriptName = 'zhrevpairs';
      } else {
        scriptName = 'zhpairs';
      }
    }
    this.sha = scriptsloader.getSha(scriptName);
  }

  var reverse = this._reverse;
  if (options.start || options.end) {
    var start = options.start !== undefined ? options.start : '';
    var end = options.end !== undefined ? options.end : '';
    if (start !== '' || end !== '') {
      this._start =
        start === ''
          ? reverse ? '+' : '-'
          : concatKey(options._exclusiveStart ? '(' : '[', start);
      this._done =
        end === ''
          ? reverse ? '-' : '+'
          : concatKey(options._exclusiveEnd ? '(' : '[', end);
      return;
    }
  }
  this._start = reverse ? '+' : '-';
  this._done = reverse ? '-' : '+';
};

Iterator.prototype.makeRangeArgs = function() {
  if (this.sha) {
    return [this.sha, 1, this.db.location, this._start, this._done, 'LIMIT', 0];
  } else {
    return [this.db.location + ':z', this._start, this._done, 'LIMIT', 0];
  }
};

Iterator.prototype._next = function(callback) {
  if (this._limit > -1 && this._count >= this._limit) {
    return setImmediate(callback);
  }
  if (this._pointer && this._pointer < this._buffered.length) {
    this._shift(callback);
  } else {
    this._fetch(callback);
  }
};

/**
 * Gets a batch of key or values or pairs
 */
Iterator.prototype._fetch = function(callback) {
  if (this.db.closed) {
    return callback();
  }
  var size;
  if (this._limit > -1) {
    var remain = this._limit - this._offset;
    if (remain <= 0) {
      return callback();
    }
    size = remain <= this._highWaterMark ? remain : this._highWaterMark;
  } else {
    size = this._highWaterMark;
  }
  var rangeArgs = this.makeRangeArgs();
  rangeArgs.push(size);

  this._offset += size;
  this._iterations++;

  var self = this;
  function complete(err, reply) {
    if (err) {
      return callback(err);
    }
    if (!reply || reply.length === 0) {
      return setImmediate(callback);
    }
    self._pointer = 0;
    self._buffered = reply;
    if (self._buffered.length) {
      // update _start for the next page fetch
      if (!self._keys) {
        self._start = concatKey('(', self._buffered.pop());
      } else if (!self._values) {
        self._start = concatKey('(', self._buffered[self._buffered.length - 1]);
      } else {
        self._start = concatKey('(', self._buffered[self._buffered.length - 2]);
      }
    }
    self._shift(callback);
  }
  if (this.cmdName) {
    return this.db.db.send_command(this.cmdName, rangeArgs, complete);
  } else {
    this.db.db.evalsha(rangeArgs, complete);
  }
};

/**
 * Gets the next key/value from the buffered keys and values.
 */
Iterator.prototype._shift = function(callback) {
  // todo: tell redis to return buffers and we have less things to do?
  var key, value;
  if (this._keys) {
    var vkey = this._buffered[this._pointer];
    this._pointer++;
    if (vkey !== undefined) {
      if (this._keyAsBuffer) {
        key = new Buffer(vkey);
      } else {
        key = String(vkey);
      }
    }
  }
  if (this._values) {
    var vvalue = this._buffered[this._pointer];
    this._pointer++;
    if (vvalue !== undefined) {
      if (this._valueAsBuffer) {
        value = new Buffer(vvalue);
      } else {
        value = String(vvalue);
      }
    }
  }
  if (key !== undefined || value !== undefined) {
    this._count++;
  }
  callback(null, key, value);
};
