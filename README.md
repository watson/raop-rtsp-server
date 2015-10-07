# raop-rtsp-server

An attempt to create a RAOP (AirTunes) server in Node.js.

**This project is highly work-in-progress - use it at your own risk!**

Known compatibility issues:

- Currently this module will only compile on Node.js v0.10. Hopefully
  this will be fixed soon.

[![Build status](https://travis-ci.org/watson/raop-rtsp-server.svg?branch=master)](https://travis-ci.org/watson/raop-rtsp-server)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard)

## Tips

If using this module to output raw [PCM
audio](https://en.wikipedia.org/wiki/Pulse-code_modulation) to STDOUT,
I've found the following useful:

I've tried quite a few different audio players but I've only managed to
get [sox](http://sox.sourceforge.net) to play back to PCM audio.

Install via Homebrew:

```
brew install sox
```

FFmpeg should also be able to parse PCM audio if you like that program
better.

## Installation

For standalone usage, run:

```
npm install --global raop-rtsp-server
```

For programmatic usage, run:

```
npm install raop-rtsp-server
```

## CLI usage

If the `speaker` module can compile on your system, you should just be
able to start the server without any arguments:

```
raop-rtsp-server
```

If you'd rather pipe the PCM audio to another player, you can so so
using the `--stdout` argument:

```
raop-rtsp-server --stdout | sox -traw -L -c2 -r44100 -b16 -e signed-integer - -tcoreaudio
```

For `sox` to be able to interpret the raw ALAC audio data, you need to
help it a little. These are the command line arguments given in the
example above:

- `-t raw` - Set input type to `raw`. This means that sox shouldn't
  expect any headers in the data - just raw audio
- `-L` - The audio data is formatted using native byte ordering, which
  is little endian on Intel CPU's. Your system might use `-B` for big
  endian
- `-c 2` - Use 2 audio channels
- `-r 44100` - Use a 44.1khz sample rate
- `-b 16` - Use a bit-depth of 16
- `-e signed-integer` - The audio encoding type
- `-` - Set input source to STDIN
- `-t coreaudio` - Set output type to `coreaudio` (your system might
  differ, but this must always come after your input source)

### Debugging

To run in debug mode, use the `DEBUG` environment variable:

```
DEBUG=* raop-rtsp-server
```

## Programmatic usage

The module can also be access programmatically:

```js
var server = require('raop-rtsp-server')

server.sessions.on('new', function (session) {
  session.on('data', function (chunk) {
    console.log('received %d audio bytes on session %s', chunk.length, session.id)
  })
})

server.start({ name: 'NodeTunes' })
```

The `server.start()` function takes an optional options object:

- `name` - The name that the RAOP server (this will be shown on your
  iDevices). Defaults to `raop-rtsp-server`
- `port` - The port that the server should listen on. Defaults to `5000`

### Session

The `session` object emitted by the `new` event is a readable stream and
will output raw PCM audio data.

#### Properties

- `volume` - A float between 0 and 1 representing the current volume
  level (0 being muted and 1 being full volume)
- `volumeDb` - A float value representing the audio attenuation in dB.
  It ranges from `-30` (lowest) to `0` (highest). A special number
  `-144` represents mute.

#### Events

Besides the normal readable stream API, the session also emits the
following events:

##### `volume`

Emitted when ever the client changes the volume. The value emitted is
the volume as a float value representing the audio attenuation in dB. It
ranges from `-30` (lowest) to `0` (highest). A special number `-144`
represents mute.

## License

MIT
