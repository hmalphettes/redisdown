'use strict';
var redisLib = require('redis');
var AbstractLevelDOWN = require('abstract-leveldown').AbstractLevelDOWN;
var inherits = require('util').inherits;
var url = require('url');

var RDIterator = require('./iterator');
var scriptsloader = require('./scriptsloader');

/**
 * @param location prefix for the database.
 */
function RedisDown(location) {
  if (!(this instanceof RedisDown)) {
    return new RedisDown(location);
  }
  AbstractLevelDOWN.call(this, location);
}

module.exports = RedisDown;

// default number of items fetched at once by an iterator
RedisDown.defaultHighWaterMark = 128;

// our new prototype inherits from AbstractLevelDOWN
inherits(RedisDown, AbstractLevelDOWN);

// host:port -> { db: client, locations: [] }
RedisDown.dbs = {};

// location as passed in the constructor -> connection-options
// Used by pouchdb when calling RedisDown.destroy
RedisDown.connectionByLocation = {};

/**
 * @param options: either one of
 *  - redis-client instance.
 *  - object with { redis: redis-client}
 *  - object with { port: portNumber, host: host, ... other options passed to node-redis }
 *
 * When a client is created it is reused across instances of
 * RedisDOWN unless the option `ownClient` is truthy.
 * For a client to be reused, it requires the same port, host and options.
 */
RedisDown.prototype._open = function(options, callback) {
  this.highWaterMark = options.highWaterMark || RedisDown.defaultHighWaterMark;
  if (typeof options.hget === 'function') {
    this.db = options.hget;
    this.quitDbOnClose = false;
  } else if (options.redis && typeof options.redis.hget === 'function') {
    this.db = options.redis;
    this.quitDbOnClose = false;
  } else if (!options.ownClient) {
    options = _makeRedisId(this.location, options);
    this.redisId = JSON.stringify(options);
    var dbDesc = RedisDown.dbs[this.redisId];
    if (dbDesc) {
      this.db = dbDesc.db;
      dbDesc.locations.push(sanitizeLocation(this.location));
    }
  } else {
    options = _makeRedisId(this.location, options);
    this.quitDbOnClose = true;
  }
  var uriLocation = this.location;
  this.location = sanitizeLocation(this.location);

  if (!this.db) {
    if (options.port || options.host) {
      // Set return_buffers to true by default
      if (options['return_buffers'] !== false) {
        options['return_buffers'] = true;
      }
      this.db = redisLib.createClient(options.port, options.host, options);
    } else {
      this.db = redisLib.createClient({ return_buffers: true });
    }
    if (!options.ownClient) {
      RedisDown.dbs[this.redisId] = { db: this.db, locations: [this.location] };
    }
    // Also store the options to connect to the database for RedisDown.destroy
    RedisDown.connectionByLocation[uriLocation] = options;
  }
  var self = this;

  if (options && options.destroyOnOpen) {
    return this.destroy(false, function() {
      setImmediate(function() {
        callback(null, self);
      });
    });
  }
  scriptsloader.preload(this.db, function() {
    setImmediate(function() {
      callback(null, self);
    });
  });
};

RedisDown.prototype._get = function(key, options, cb) {
  this.db.hget(this.location + ':h', key, function(e, v) {
    if (e) {
      return cb(e);
    }
    if (v === null || v === undefined) {
      return cb(new Error('NotFound error ' + key));
    }

    if (options.asBuffer === false || options.raw) {
      cb(null, String(v || ''));
    } else if (v === null || v === undefined) {
      cb(null, new Buffer(''));
    } else {
      cb(null, new Buffer(v));
    }
  });
};

RedisDown.prototype._put = function(key, rawvalue, opt, cb) {
  if (typeof rawvalue === 'undefined' || rawvalue === null) rawvalue = '';
  this.__exec(this.__appendPutCmd([], key, rawvalue), cb);
};

RedisDown.prototype._del = function(key, opt, cb) {
  this.__exec(this.__appendDelCmd([], key), cb);
};
RedisDown.prototype._batch = function(array, options, callback) {
  var cmds = [];
  for (var i = 0; i < array.length; i++) {
    var op = array[i];
    if (op.type === 'put') {
      this.__appendPutCmd(cmds, op.key, op.value, op.prefix);
    } else if (op.type === 'del') {
      this.__appendDelCmd(cmds, op.key, op.prefix);
    } else {
      return callback(
        new Error('Unknow type of operation ' + JSON.stringify(op))
      );
    }
  }
  this.__exec(cmds, callback);
};

RedisDown.prototype.__getPrefix = function(prefix) {
  return prefix || this.location;
};

RedisDown.prototype.__appendPutCmd = function(cmds, key, value, prefix) {
  var resolvedPrefix = this.__getPrefix(prefix);
  cmds.push([
    'hset',
    resolvedPrefix + ':h',
    key,
    value === undefined ? '' : value
  ]);
  cmds.push(['zadd', resolvedPrefix + ':z', 0, key]);
  return cmds;
};
RedisDown.prototype.__appendDelCmd = function(cmds, key, prefix) {
  var resolvedPrefix = this.__getPrefix(prefix);
  cmds.push(['hdel', resolvedPrefix + ':h', key]);
  cmds.push(['zrem', resolvedPrefix + ':z', key]);
  return cmds;
};
RedisDown.prototype.__exec = function(cmds, callback) {
  this.db.multi(cmds).exec(callback);
};

RedisDown.prototype._close = function(callback) {
  this.closed = true;
  if (this.quitDbOnClose === false) {
    return setImmediate(callback);
  }
  if (this.quitDbOnClose !== true) {
    // close the client only if it is not used by others:
    var dbDesc = RedisDown.dbs[this.redisId];
    if (dbDesc) {
      var location = this.location;
      dbDesc.locations = dbDesc.locations.filter(function(loc) {
        return loc !== location;
      });
      if (dbDesc.locations.length !== 0) {
        // a still used by another RedisDOWN
        return setImmediate(callback);
      }
      delete RedisDown.dbs[this.redisId];
    }
  }
  try {
    this.db.quit();
  } catch (x) {
    console.log('Error attempting to quit the redis client', x);
  }
  setImmediate(callback);
};

RedisDown.prototype._iterator = function(options) {
  return new RDIterator(this, options);
};

// Special operations
/**
 * Opens a new redis client del the hset.
 * Quit the client.
 * Callbacks
 */
RedisDown.destroy = function(location, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = RedisDown.connectionByLocation[location];
  }
  if (!options) {
    return callback(
      new Error('No connection registered for "' + location + '"')
    );
  }
  var sanitizedLocation = sanitizeLocation(location);
  var client = redisLib.createClient(options.port, options.host, options);
  client.del(location + ':h', location + ':z', function(e) {
    client.quit();
    callback(e);
  });
};

/**
 * @param doClose: optional parameter, by default true to close the client
 */
RedisDown.prototype.destroy = function(doClose, callback) {
  if (!callback && typeof doClose === 'function') {
    callback = doClose;
    doClose = true;
  }
  var self = this;
  this.db.del(this.location + ':h', this.location + ':z', function(e) {
    if (doClose) {
      self.close(callback);
    } else {
      callback();
    }
  });
};

/**
 * Internal: generate the options for redis.
 * create an identifier for a redis client from the options passed to _open.
 * when the identifier is identical, it is safe to reuse the same client.
 */
function _makeRedisId(location, options) {
  var redisIdOptions = [
    'host',
    'port',
    'parser',
    'return_buffers',
    'detect_buffers',
    'socket_nodelay',
    'no_ready_check',
    'enable_offline_queue',
    'retry_max_delay',
    'connect_timeout',
    'max_attempts'
  ];
  var redisOptions = {};
  redisIdOptions.forEach(function(opt) {
    if (options[opt] !== undefined && options[opt] !== null) {
      redisOptions[opt] = options[opt];
    }
  });
  if (options.url || (location && location.indexOf('://') !== -1)) {
    var redisURL = url.parse(options.url || location);
    redisOptions.port = redisURL.port;
    redisOptions.host = redisURL.hostname;
    if (redisURL.auth) {
      redisOptions.auth_pass = redisURL.auth.split(':')[1];
    }
  }
  return redisOptions;
}

function sanitizeLocation(location) {
  if (!location) {
    return 'rd';
  }
  if (location.indexOf('://')) {
    location = url.parse(location).pathname || 'rd';
  }
  if (location.charAt(0) === '/') {
    return location.substring(1);
  }
  // Keep the hash delimited by curly brackets safe
  // as it is used by redis-cluster to force the selection of a slot.
  if (location.indexOf('%7B') === 0 && location.indexOf('%7D') > 0) {
    location = location.replace('%7B', '{').replace('%7D', '}');
  }
  return location;
}

RedisDown.reset = function(callback) {
  for (var k in RedisDown.dbs) {
    if (RedisDown.dbs.hasOwnProperty(k)) {
      try {
        var db = RedisDown.dbs[k].db;
        db.quit();
      } catch (x) {}
    }
  }
  if (callback) {
    return callback();
  }
};
