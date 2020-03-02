# RedisDOWN [![Build Status](https://travis-ci.org/hmalphettes/redisdown.svg?branch=master)](https://travis-ci.org/hmalphettes/redisdown)

Redis backend for [LevelUP](https://github.com/rvagg/node-levelup)

Requirements:
* redis-2.8 or more recent.
* node-12.x

Uses a sorted-set to order the keys and a hash to store the values.

Fetches the ordered key value pairs during iterations with a single redis lua call.

[Abstract-LevelDOWN](https://github.com/rvagg/abstract-leveldown) testsuite is green
except for the ['implicit iterator snapshot'](https://github.com/hmalphettes/redisdown/issues/10).

# Warning: data migration from redisdown-v0.1.9
redisdown > v0.1.10 no longer JSON encode/decode itself. Levelup take care of that.
JSON Data written in v0.1.9 is not correctly decoded back to a javascript object in v0.1.10 and above.

This change was introduced to support binary values in redisdown and escaped the fact that it was breaking backward compatibility for the data.

Workaround: https://github.com/hmalphettes/redisdown/issues/24#issuecomment-193076281

# Example

Copied and pasted from the levelup documentation.
Added the db option when creating the db to use redisdown.

```
var levelup = require('levelup')
var redisdown = require('redisdown')

// 1) Create our database, supply location and options.
//    This will create or open the underlying LevelDB store.
var db = levelup('mydb', { db: redisdown, host: 'localhost', port: 6379 })

// If you use sentinel/cluster mode, you must use a single slot to store the values thanks to a `{hash}`
//var db = levelup('{thehash}path', { db: redisdown });

// if you already have a redis client
//var db = levelup('mydb', { db: redisdown, redis: redisClient })

// if you use an URL environment variable
//var db = levelup('mydb', { db: redisdown, url: process.env.REDIS_URL })
// if you use Redis Cloud on Heroku
//var db = levelup('mydb', { db: redisdown, url: process.env.REDISCLOUD_URL })

// 2) put a key & value
db.put('name', 'LevelUP', function (err) {
  if (err) return console.log('Ooops!', err) // some kind of I/O error

  // 3) fetch by key
  db.get('name', function (err, value) {
    if (err) return console.log('Ooops!', err) // likely the key was not found

    // ta da!
    console.log('name=' + value)
  })
})
```

# API
--------------------------------------------------------
<a name="ctor"></a>
### redisdown(location)
<code>redisdown(location)</code> returns a new **RedisDOWN** instance. `location` is a String pointing at the root namespace of the data in redis.

* `location+':h'` is the hash where the values are stored.
* `location+':z'` is the set where the keys are sorted.

--------------------------------------------------------
<a name="redisdown_open"></a>
### redisdown#open([options, ]callback)
<code>open()</code> is an instance method on an existing database object.

options is a hash that is passed to the redis library to create a redis client:

* `highWaterMark` number of values to fetch in one redis call for iteration. Defaults to 256.
* `port` redis port. Defaults to '127.0.0.1'
* `host` redis host. Defaults to 6379
* `redis` already configured redis client. redisDown will not open or close it. host and port and all other redis options are ignored.
* Other options: https://github.com/mranney/node_redis#rediscreateclientport-host-options

-----------------------------------
<a name="redisdown_destroy"></a>
### redisdown.destroy(location, [options, ]callback)
<code>destroy(location)</code> is used to completely delete all data in redis related to the location.

-----------------------------------
<a name="redisdown_batch_prefixes"></a>
### redisdown#batch([{type: 'put', key: 'foo1', value: 'bar1' [, prefix: 'subsection']}, ...])
<code>batch()</code> supports an exra property `prefix` to store/retrieve/delete a key in a specific namespace of the redis DB.
It is useful to support sublevel-ish batch operations: https://github.com/dominictarr/level-sublevel#batches
and is well supported by redis.

By default, the prefix is a string that is the path to the where redis stores the document.
In order to resolve other types of prefixes, one would need to override the `#__getPrefix(prefix)` method.
Passing a levelup instance is demonstrated here: https://github.com/hmalphettes/redisdown/blob/master/test/batch-prefix-test.js#L12

# Pouchdb integrations tests: all 3605 of them
---------------------------------------------------------
`npm run-script test-pouchdb-redis`

The script will install the extra required dependencies.
It works for me.

# LICENSE
redisdown is freely distributable under the term of the MIT License.
Copyright: Sutoiku Inc 2014.

If you need something different, let me know.

# HELP Wanted
- Collation: do we need to worry about this?
