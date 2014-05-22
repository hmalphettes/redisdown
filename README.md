# RedisDOWN

Redis backend for [levelup](https://github.com/rvagg/node-levelup)

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
<a name="leveldown_open"></a>
### redisdown#open([options, ]callback)
<code>open()</code> is an instance method on an existing database object.

options is a hash that is passed to the redis library to create a redis client:

* `port` redis port
* `host` redis host
* Other options: https://github.com/mranney/node_redis#rediscreateclientport-host-options


-----------------------------------
### redisdown.destroy(location, callback)
<code>destroy()</code> is used to completely delete all data in redis related to the location.


# TODO
Ranges and Reverse iterations are making a single query to redis.
They should be refactored to fetch the data one little batch at a time.

When results are buffers we should be able to simply pass them from redis to the consumer without traveling though a String.
