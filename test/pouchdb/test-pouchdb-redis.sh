#!/bin/sh
#
# sample script showing all the different ways you can
# test your module against pouchdb
#

# leveldown in the client, leveldown in the server
##npm run test-pouchdb

# your module in the client, leveldown in the server
LEVEL_ADAPTER=../../.. npm run test-pouchdb

# leveldown in the client, your module in the server
SERVER_ARGS='--level-backend ../../..' npm run test-pouchdb

# your module in the client, your module in the server
SERVER_ARGS='--level-backend ../../..' LEVEL_ADAPTER=../../.. npm run test-pouchdb

# leveldown in the server, firefox as the client (also available: phantomjs)
CLIENT=selenium:firefox npm run test-pouchdb

# your module in the server, firefox as the client (also available: phantomjs)
#echo 'your module in the server, firefox as the client (also available: phantomjs)'
CLIENT=selenium:firefox SERVER_ARGS='--level-backend ../../..' npm run test-pouchdb
