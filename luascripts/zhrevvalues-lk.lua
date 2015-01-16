--[[
 redis.eval('zhrevvalues', key, max, min, [limit, offset, count])

 Make a reverse range by lex on an order map and return the values
 Note that the last returned value is the key of the last value. Used for the next iteration.

 `redis-cli EVAL "$(cat zhrevvalues.lua)" 1 _redisdown_test_db_:10 ZRANGEBYLEX - +`
]]
local keys = redis.call('zrevrangebylex', KEYS[1]..':z', unpack(ARGV))
if #keys == 0 then
  return keys
end
local vals = redis.call('hmget',KEYS[1]..':h',unpack(keys))
if vals == nil then
  return nil
end
vals[#keys+1] = keys[#keys]
return vals
