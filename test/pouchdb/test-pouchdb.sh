#!/bin/sh
#
# run a single pouchdb test, using pouchdb-server
# in the server running on port 6984
#
# This is just for sanity checking.
#

if [ ! -e 'node_modules/pouchdb' ]; then
  npm install 'pouchdb@pouchdb/pouchdb#2415' # until 3.0.0 comes out
  npm install pouchdb-server
fi
./node_modules/.bin/pouchdb-server -p 6984 $SERVER_ARGS &
POUCHDB_SERVER_PID=$!

cd node_modules/pouchdb/
[ ! -e node_modules/mocha ] && npm install

COUCH_HOST=http://localhost:6984 npm test

EXIT_STATUS=$?
if [[ ! -z $POUCHDB_SERVER_PID ]]; then
  kill $POUCHDB_SERVER_PID
fi
exit $EXIT_STATUS