'use strict';
var db1, db2, db3;
var RedisDown = require('../');

module.exports.setUp = function(redisdown, test, testCommon) {
  test('setUp common', testCommon.setUp);
};

module.exports.args = function(redisdown, test, testCommon) {
  test('batch prefix across redisdown instances', function(t) {
    db1 = redisdown(testCommon.location());
    db1.__getPrefix = function(prefix) {
      if (!prefix) {
        return this.location;
      }
      if (typeof prefix === 'string') {
        return prefix;
      } // string prefix
      if (prefix instanceof RedisDown) {
        return prefix.location;
      } // RedisDown instance
      if (prefix && prefix.toString() === 'LevelUP') {
        // LevelUP instance
        // levelup v2
        if (prefix._db instanceof RedisDown) {
          return prefix._db.location;
        }
        // levelup v1
        if (prefix.options && prefix.options.db) {
          return prefix.location;
        }
      }
      // not applicable to these tests
      t.fail();
    };
    db2 = redisdown(testCommon.location());
    db3 = redisdown(testCommon.location());
    db1.open({}, function(e) {
      t.notOk(e, 'no error');
      db2.open({}, function(e) {
        t.notOk(e, 'no error');
        db3.open({}, function(e) {
          t.notOk(e, 'no error');
          db1.batch(
            [
              { type: 'put', key: 'foo1', value: 'bar1' },
              { type: 'put', key: 'foo2', value: 'bar2', prefix: db2 },
              { type: 'put', key: 'foo3', value: 'bar3', prefix: db3.location }
            ],
            function(e) {
              t.notOk(e, 'no error');
              db1.get('foo1', { asBuffer: false }, function(e, val) {
                t.notOk(e, 'no error');
                t.equal(val, 'bar1');
                db2.get('foo2', { asBuffer: false }, function(e, val) {
                  t.notOk(e, 'no error');
                  t.equal(val, 'bar2');
                  db3.get('foo3', { asBuffer: false }, function(e, val) {
                    t.notOk(e, 'no error');
                    t.equal(val, 'bar3');
                    t.end();
                  });
                });
              });
            }
          );
        });
      });
    });
  });
};

module.exports.tearDown = function(test, testCommon) {
  test('tearDown', function(t) {
    db1.close(function(e) {
      t.notOk(e, 'no error');
      db2.close(function(e) {
        t.notOk(e, 'no error');
        db3.close(function(e) {
          t.notOk(e, 'no error');
          testCommon.tearDown(t);
        });
      });
    });
  });
};

module.exports.all = function(redisdown, test, testCommon) {
  module.exports.setUp(redisdown, test, testCommon);
  module.exports.args(redisdown, test, testCommon);
  module.exports.tearDown(test, testCommon);
};
