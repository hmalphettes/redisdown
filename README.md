# RedisDOWN

Redis backend for [LevelUP](https://github.com/rvagg/node-levelup)

Requirements: redis-2.8 or more recent.

Uses a sorted-set to order the keys and a hash to store the values.

[Abstract-LevelDOWN](https://github.com/rvagg/abstract-leveldown) testsuite is green.

# Example

Copied and pasted from the levelup documentation.
Added the db option when creating the db to use redisdown.

```
var levelup = require('levelup')
var redisdown = require('redisdown')

// 1) Create our database, supply location and options.
//    This will create or open the underlying LevelDB store.
var db = levelup('mydb', { db: redisdown, host: 'localhost', port: 6379 })

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
<code>redisdown()</code> returns a new **RedisDOWN** instance. `location` is a String pointing at the root namespace of the data in redis.

* `location+':h'` is the hash where the values are stored.
* `location+':z'` is the set where the keys are sorted.

--------------------------------------------------------
<a name="redisdown_open"></a>
### redisdown#open([options, ]callback)
<code>open()</code> is an instance method on an existing database object.

options is a hash that is passed to the redis library to create a redis client:

* `batchSizeKeys` number of keys to fetch at once during an iteration. Defaults to 1024.
* `batchSizeValues` number of values to fetch at once during an iteration. Defaults to 128.
* `port` redis port
* `host` redis host
* Other options: https://github.com/mranney/node_redis#rediscreateclientport-host-options

-----------------------------------
<a name="redisdown_destroy"></a>
### redisdown.destroy(location, [options, ]callback)
<code>destroy()</code> is used to completely delete all data in redis related to the location.

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
- When results are buffers we should be able to simply pass them from redis to the consumer without traveling though a String.
- Use a lua script to load the value and the key at once?
- Collation: do we need to worry about this?
