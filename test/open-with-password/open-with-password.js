const redisdown = require('../..');

const db = redisdown('redis://localhost:6379');

// This open does fail with "Authentication required".
// If the `redisIdOptions` include 'password' in `_makeRedisId`, then it works.
db.open({ password: "mypassword" }, function(e) {
    console.log("Opened");
    console.log(e);
});
db.close(function (e) {
    console.log("Closed");
    console.log(e);
});