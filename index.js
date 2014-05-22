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
	this.redis = redisLib.createClient(options.port, options.host, options);
	callback();
};

RedisDown.prototype._get = function (key, options, cb) {
	this.redis.hget(this.location, key, function(e, v) {
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
	var value = JSON.stringify(rawvalue);
	this.redis.hset(this.location, key, value, cb);
};

RedisDown.prototype._del = function (key, opt, cb) {
	this.redis.hdel(this.location, key, cb);
};
RedisDown.prototype._batch = function (array, options, callback) {
	// var multi = this.redis.multi();
	// for (var i = 0; i < array.length; i++) {
	// 	var op = array[i];
	// 	if (op.type === 'put') {
	// 		multi.hset(this.location, op.key, op.value);
	// 	} else if (op.type === 'del') {
	// 		multi.hdel(this.location, op.key);
	// 	}
	// }
	// console.log('multi', multi);
	var cmds = [];
	for (var i = 0; i < array.length; i++) {
		var op = array[i];
		if (op.type === 'put') {
			cmds.push(['hset', this.location, op.key, JSON.stringify(op.value) ]);
		} else if (op.type === 'del') {
			cmds.push(['hdel', this.location, op.key ]);
		} else {
			return callback(new Error('Unknow type of operation ' + JSON.stringify(op)));
		}
	}
	var multi = this.redis.multi(cmds);
	multi.exec(callback);
};
RedisDown.prototype._close = function (callback) {
	try {
  	this.redis.quit();
	} catch(x) {
		console.log('hum', x);
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
  var client = this.redis;
  client.del(location, function(e) {
    client.quit();
    callback(e);
  });
};

