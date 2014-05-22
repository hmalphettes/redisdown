'use strict';
var redisLib = require('redis');
//require('redis-scanstreams')(redisLib); // Add the ?scan* methods to redis clients

var AbstractLevelDOWN = require('abstract-leveldown').AbstractLevelDOWN;
var inherits = require('util').inherits;

var RDIterator = require('./iterator');

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
// our new prototype inherits from AbstractLevelDOWN
inherits(RedisDown, AbstractLevelDOWN);

RedisDown.prototype._open = function (options, callback) {
	this.db = redisLib.createClient(options.port, options.host, options);
  var self = this;
  setImmediate(function () { callback(null, self); });
};

RedisDown.prototype._get = function (key, options, cb) {
	this.db.hget(this.location+':h', key, function(e, v) {
		if (e) { return cb(e); }
		if (!v) { return cb(new Error('NotFound error ' + key)); }
		var json;
		try {
			json = JSON.parse(v);
		} catch(e) {
			return cb(e);
		}
	  var asBuffer = true;
	  if (options.asBuffer === false || options.raw) {
	    cb(null, json);
	  } else {
			cb(null, new Buffer(json));
		}
	});
};

RedisDown.prototype._put = function (key, rawvalue, opt, cb) {
	this.__exec(this.__appendPutCmd([], key, rawvalue), cb);
};

RedisDown.prototype._del = function (key, opt, cb) {
	this.__exec(this.__appendDelCmd([], key), cb);
};
RedisDown.prototype._batch = function (array, options, callback) {
	var cmds = [];
	for (var i = 0; i < array.length; i++) {
		var op = array[i];
		if (op.type === 'put') {
      this.__appendPutCmd(cmds, op.key, op.value);
		} else if (op.type === 'del') {
      this.__appendDelCmd(cmds, op.key);
		} else {
			return callback(new Error('Unknow type of operation ' + JSON.stringify(op)));
		}
	}
  this.__exec(cmds, callback);
};

RedisDown.prototype.__appendPutCmd = function(cmds, key, value) {
	cmds.push(['hset', this.location+':h', key, JSON.stringify(value) ]);
	cmds.push(['zadd', this.location+':z', 0, key ]);
  return cmds;
};
RedisDown.prototype.__appendDelCmd = function(cmds, key) {
	cmds.push(['hdel', this.location+':h', key ]);
	cmds.push(['zrem', this.location+':z', key ]);
  return cmds;
};
RedisDown.prototype.__exec = function(cmds, callback) {
	this.db.multi(cmds).exec(callback);
};

RedisDown.prototype._close = function (callback) {
	try {
  	this.db.quit();
	} catch(x) {
		console.log('Error attempting to quit the redis client', x);
	}
	callback();
};

RedisDown.prototype.iterator = function (options) {
  return new RDIterator(this, options);
};

// Special operations
/**
 * Opens a new redis client del the hset.
 * Quit the client.
 * Callbacks
 */
RedisDown.destroy = function (location, options, callback) {
  var client = redisLib.createClient(options);
  client.del(location, function(e) {
    client.quit();
    callback(e);
  });
};
/**
 * @param location: optional parameter, by default the location of the current db
 */
RedisDown.prototype.destroy = function (location, callback) {
  if (!callback && typeof location === 'function') {
    callback = location;
    location = this.location;
  }
  location = location || this.location;
  var client = this.db;
  client.del(location, function(e) {
    client.quit();
    callback(e);
  });
};

