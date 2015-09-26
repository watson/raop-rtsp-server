#!/usr/bin/env node
'use strict'

var server = require('../')
var stdout = process.argv[2] === '--stdout'

server.sessions.on('new', function (session) {
  if (stdout) session.pipe(process.stdout)
  else session.resume()
})

server.start()
