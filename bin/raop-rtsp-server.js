#!/usr/bin/env node
'use strict'

var server = require('../')
var stdout = process.argv[2] === '--stdout'

server.sessions.on('new', function (session) {
  if (!stdout) return session.resume()

  session.on('data', function (chunk) {
    for (var offset = 0, blocks = chunk.length; offset < blocks; offset += 2) {
      chunk.writeInt16LE(Math.round(chunk.readInt16LE(offset) * session.volume), offset)
    }
    process.stdout.write(chunk)
  })
})

server.start()
