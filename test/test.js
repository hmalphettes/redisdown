const leveljs = require('../');

const test = require('tape');
const tempy = require('tempy');
const suite = require('abstract-leveldown/test');

suite({
  test: test,
  factory: function () {
    return new leveljs(tempy.directory());
  },
  // Opt-out of unsupported features
  createIfMissing: false,
  errorIfExists: false,
  snapshots: false,
  seek: false
});

var testCommon = require('./testCommon');

/*** redis client management */
require('./redis-client-test').all(leveljs, test, testCommon);
require('./batch-prefix-test').all(leveljs, test, testCommon);

