'use strict';
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var shasByName;
var namesBySha;
var sourcesBySha;

function computeShas(done) {
  if (shasByName) {
    return done();
  }
  var dir = __dirname + '/luascripts';
  fs.readdir(dir, function(err, files) {
    if (err) {
      return done(err);
    }
    var _shasByName = {};
    var _namesBySha = {};
    var _sourcesByName = {};
    var i = -1;
    processOne();
    function processOne(e) {
      i++;
      if (e || i === files.length) {
        shasByName = _shasByName;
        namesBySha = _namesBySha;
        return done(e);
      }
      var file = files[i];
      if (path.extname(file) !== '.lua') {
        return processOne();
      }
      var filePath = dir + '/' + file;
      computeSha(filePath, _namesBySha, _shasByName, processOne);
    }
  });
}

function computeSha(filePath, _namesBySha, _shasByName, done) {
  var scriptName = path.basename(filePath, '.lua');
  fs.readFile(filePath, 'utf-8', function(err, source) {
    if (err) {
      return done(err);
    }
    var sha = crypto
      .createHash('sha1')
      .update(source, 'utf8')
      .digest('hex');
    _shasByName[scriptName] = sha;
    _namesBySha[sha] = scriptName;
    done();
  });
}

function preload(redis, done) {
  if (!shasByName) {
    return computeShas(function(e) {
      if (e) {
        return done(e);
      }
      preload(redis, done);
    });
  }
  var shas = Object.keys(namesBySha);
  redis.send_command('script', ['exists'].concat(shas), function(err, reply) {
    if (err || !reply.length) {
      return done(err || new Error('no scripts to load'));
    }
    var i = -1;
    function lazyLoad(e) {
      i++;
      if (e || i === reply.length) {
        return done(e);
      }
      var state = reply[i];
      if (state === 1) {
        return lazyLoad();
      }
      load(shas[i]);
    }
    function load(sha) {
      var filePath = __dirname + '/luascripts/' + namesBySha[sha] + '.lua';
      fs.readFile(filePath, 'utf-8', function(err, source) {
        redis.send_command('SCRIPT', ['LOAD', source], function(err, _sha) {
          if (err) {
            return done(err);
          }
          if (sha !== _sha) {
            return done(
              new Error('Incorrect computation of the sha for ' + filePath)
            );
          }
          lazyLoad();
        });
      });
    }
    lazyLoad();
  });
}

function getSha(scriptName) {
  return shasByName[scriptName];
}

/*
var client = require('redis').createClient();
preload(client, function(e) {
  var sha = getSha('zhpairs');
  console.log('ok?', e, 'zhpairs', sha);
  client.evalsha([ sha,
  1,
  '_redisdown_test_db_:3',
  '-',
  '+',
  'LIMIT', 256, 256
   ], function(e, reply) {
    console.log('evalsha', e, reply);
  });
});
*/
exports.preload = preload;
exports.getSha = getSha;
