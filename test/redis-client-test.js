'use strict';
var db;

module.exports.setUp = function(redisdown, test, testCommon) {
  test('setUp common', testCommon.setUp);
};

module.exports.args = function(redisdown, test, testCommon) {
  test('test shared redis client for 2 redisdown instances', function(t) {
    t.equal(Object.keys(redisdown.dbs).length, 0);
    db = redisdown(testCommon.location());
    db.open({}, function(e) {
      t.notOk(e, 'no error');
      t.equal(Object.keys(redisdown.dbs).length, 1);
      var db2 = redisdown(testCommon.location());
      db2.open({}, function(e) {
        t.notOk(e, 'no error');
        db2.close(function(e) {
          t.notOk(e, 'no error');
          t.equal(Object.keys(redisdown.dbs).length, 1);
          var redis = db.db;
          t.equal(redis.closing, false);
          db.close(function(e) {
            t.notOk(e, 'no error');
            t.equal(redis.closing, true);
            t.equal(Object.keys(redisdown.dbs).length, 0);
            t.end();
          });
        });
      });
    });
  });

  test('reuse a redis client directly', function(t) {
    t.equal(Object.keys(redisdown.dbs).length, 0);
    var redis = require('redis').createClient();
    db = redisdown(testCommon.location());
    db.open({ redis: redis }, function(e) {
      t.notOk(e, 'no error');
      t.equal(Object.keys(redisdown.dbs).length, 0);
      t.equal(db.db, redis);
      db.close(function(e) {
        t.notOk(e, 'no error');
        // the redis client is not managed by redisdown so we dont quit
        t.equal(redis.closing, false);
        redis.quit();
        t.end();
      });
    });
  });
  test('test destroy redis statically by name', function(t) {
    t.equal(Object.keys(redisdown.dbs).length, 0);
    var location = testCommon.location();
    db = redisdown(location);
    db.open({}, function(e) {
      t.notOk(e, 'no error');
      redisdown.destroy(location, function(e) {
        t.notOk(e, 'no error');
        t.end();
      });
    });
  });
};

module.exports.tearDown = function(test, testCommon) {
  test('tearDown', function(t) {
    db.close(testCommon.tearDown.bind(null, t));
  });
};

module.exports.all = function(redisdown, test, testCommon) {
  module.exports.setUp(redisdown, test, testCommon);
  module.exports.args(redisdown, test, testCommon);
  module.exports.tearDown(test, testCommon);
};
