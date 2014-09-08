"use strict";
var tape   = require('tape');
var leveljs = require('../');
var testCommon = require('./testCommon');

var testBuffer = new Buffer('foo');

/*** redis client management */
require('./redis-client-test').all(leveljs, tape, testCommon);

/*** compatibility with basic LevelDOWN API ***/
require('abstract-leveldown/abstract/leveldown-test').args(leveljs, tape, testCommon);
require('abstract-leveldown/abstract/open-test').open(leveljs, tape, testCommon);
require('abstract-leveldown/abstract/put-test').all(leveljs, tape, testCommon);
require('abstract-leveldown/abstract/del-test').all(leveljs, tape, testCommon);
require('abstract-leveldown/abstract/get-test').all(leveljs, tape, testCommon);
require('abstract-leveldown/abstract/put-get-del-test').all(leveljs, tape, testCommon, testBuffer);
require('abstract-leveldown/abstract/batch-test').all(leveljs, tape, testCommon);
require('abstract-leveldown/abstract/chained-batch-test').all(leveljs, tape, testCommon);
require('abstract-leveldown/abstract/close-test').close(leveljs, tape, testCommon);

var iteratorTest = require('abstract-leveldown/abstract/iterator-test');
iteratorTest.allButSnapshot = function (leveldown, test, testCommon) {
  iteratorTest.setUp(leveldown, test, testCommon)
  iteratorTest.args(test)
  iteratorTest.sequence(test)
  iteratorTest.iterator(leveldown, test, testCommon, testCommon.collectEntries)
  // iteratorTest.snapshot(leveldown, test, testCommon)
  iteratorTest.tearDown(test, testCommon)
};
iteratorTest.allButSnapshot(leveljs, tape, testCommon);

require('abstract-leveldown/abstract/ranges-test').all(leveljs, tape, testCommon);

// /*** Test batches */
iteratorTest.allButSnapshot(leveljs, tape, testCommon.smallBatches);
