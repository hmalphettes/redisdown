'use strict';
var test = require('tape');
var leveljs = require('../');
var testCommon = require('abstract-leveldown/testCommon');

/*** redis client management */
require('./redis-client-test').all(leveljs, test, testCommon);
require('./batch-prefix-test').all(leveljs, test, testCommon);

/*** compatibility with basic LevelDOWN API ***/
require('abstract-leveldown/abstract/leveldown-test').args(
  leveljs,
  test,
  testCommon
);
require('abstract-leveldown/abstract/open-test').open(
  leveljs,
  test,
  testCommon
);

require('abstract-leveldown/abstract/del-test').all(leveljs, test);

require('abstract-leveldown/abstract/get-test').all(leveljs, test);

require('abstract-leveldown/abstract/put-test').all(leveljs, test);

require('abstract-leveldown/abstract/put-get-del-test').all(leveljs, test);

require('abstract-leveldown/abstract/batch-test').all(leveljs, test);
require('abstract-leveldown/abstract/chained-batch-test').all(leveljs, test);

require('abstract-leveldown/abstract/close-test').close(leveljs, test);

var iteratorTest = require('abstract-leveldown/abstract/iterator-test');
iteratorTest.allButSnapshot = function(leveldown, test, testCommon) {
  iteratorTest.setUp(leveldown, test, testCommon);
  iteratorTest.args(test);
  iteratorTest.sequence(test);
  iteratorTest.iterator(leveldown, test, testCommon, testCommon.collectEntries);
  // iteratorTest.snapshot(leveldown, test, testCommon)
  iteratorTest.tearDown(test, testCommon);
};
iteratorTest.allButSnapshot(leveljs, test, testCommon);

require('abstract-leveldown/abstract/iterator-range-test').all(
  leveljs,
  test,
  testCommon
);

testCommon.setUp = function(t) {
  leveljs.defaultHighWaterMark = 3;
  testCommon.cleanup(function(err) {
    t.notOk(err, 'cleanup returned an error');
    t.end();
  });
};
/*** Test batches */
iteratorTest.allButSnapshot(leveljs, test, testCommon);
