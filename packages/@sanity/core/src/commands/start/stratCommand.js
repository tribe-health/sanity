import lazyRequire from '@sanity/util/lib/lazyRequire'

const helpText = `
Notes
  Changing the hostname or port number might require a new CORS-entry to be added.

Options
  --port <port> TCP port to start server on. [default: 3333]
  --host <host> The local network interface at which to listen. [default: "127.0.0.1"]

Examples
  sanity strat --host=0.0.0.0
  sanity strat --port=1942
`

const strat = `
             _
            /;)
           /;(
           >_/
           |-|
           |-|
           |-|
           |-|
           |-|
           |-|
           |-|
       _   |-|
      / \\  |-|   _
     :   \`'|-|  /,\\
     :   ,\`'-'\`'/|:
      \\  \\ ...   ;/
       :  )...  ::
       ; / ...  ::
      / /  ___   \\\\
     :  \`-|||||.  \\:
     :        (\\\`-';
      \`._________,'
`

export default {
  name: 'strat',
  signature: '[--port <port>] [--host <host>]',
  description: 'Starts a web server for the Content Studio',
  action: (args, context) => {
    context.output.print(strat)
    const start = lazyRequire(require.resolve('../../actions/start/startAction'))
    start(args, context)
  },
  helpText,
  hideFromHelp: true,
}
