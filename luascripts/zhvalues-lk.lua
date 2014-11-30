--[[
 redis.eval('zhvalues', key, min, max, [limit, offset, count])

 Make a range query by lex on an ordered map and return the values
 Note that the last returned value is the key of the last value. Used for the next iteration.

 `redis-cli EVAL "$(cat zhvalues.lua)" 1 _redisdown_test_db_:10 ZRANGEBYLEX - +`
]]
local keys = redis.call('zrangebylex', KEYS[1]..':z', unpack(ARGV))
if #keys == 0 then
  return keys
end
local vals redis.call('hmget',KEYS[1]..':h',unpack(keys))
vals[#keys+1] = keys[#keys]
return vals
