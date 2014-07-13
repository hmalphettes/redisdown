--[[
 redis.eval('zhrevvalues', key, max, min, [limit, offset, count])

 Make a reverse range by lex on an order map and return the values

 `redis-cli EVAL "$(cat zhrevvalues.lua)" 1 _redisdown_test_db_:10 ZRANGEBYLEX - +`
]]
local keys = redis.call('zrevrangebylex', KEYS[1]..':z', unpack(ARGV))
if #keys == 0 then
  return keys
end
return redis.call('hmget',KEYS[1]..':h',unpack(keys))
