# RedisDOWN

Redis backend for [LevelUP](https://github.com/rvagg/node-levelup)

Requirements: redis-2.8 or more recent.

Uses a sorted-set to order the keys and a hash to store the values.

[Abstract-LevelDOWN](https://github.com/rvagg/abstract-leveldown) testsuite is green.

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

* `port` redis port
* `host` redis host
* Other options: https://github.com/mranney/node_redis#rediscreateclientport-host-options


-----------------------------------
<a name="redisdown_destroy"></a>
### redisdown.destroy(location, [options, ]callback)
<code>destroy()</code> is used to completely delete all data in redis related to the location.

# Pouchdb integrations tests: all 3605 of them
---------------------------------------------------------
`npm test-pouchdb-redis`
The script will install the extra required dependencies.
It works for me.

# LICENSE
redisdown is freely distributable under the term of the MIT License.
Copyright: Sutoiku Inc 2014.

If you need something different, let me know.

# HELP Wanted
Ranges and Reverse iterations are making a single query to redis.
They should be refactored to fetch the data one little batch at a time.
Let me know if you have figured out what the redis query should look like:

When results are buffers we should be able to simply pass them from redis to the consumer without traveling though a String.
