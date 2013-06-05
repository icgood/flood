About
=====

For performance testing, it is generally necessary to configure many machines
generating simultaneous load against an endpoint. With servers these days
having many CPU cores, a good tool should utilize all cores.

Flood has simplified the process of aggregating test counters across many
machines with many CPUs.

Installation
============

To install the package globally, run:

    # npm install flood -g

This will add two commands to your system, `flood` and `flood-watch`.

Configuration
=============

### `flood`

Machines that will actually generate the load by spawning worker threads will
be running the `flood` command. This service listens for jobs and executes
them. An HTTP-like listener is opened on port 5143, where clients may submit
jobs and wait for completion. Here is an example in curl:

    curl -i -X POST \
        -H 'Content-Type: text/javascript' \
        -H 'X-Signature: XXXXXXXXXXXX' \
        -d @mytest.js \
        http://localhost:5143/test/mytest.js

The test file `mytest.js` simply needs to define `exports.counters` and
`exports.run`. The `exports.counters` is an array of counter names the test can
then increment. The `exports.run` is a function that is called which should run
indefinitely, incrementing counters.

    exports.counters = ['beeps'];

    exports.run = function (snapshot) {
      function beep() {
        snapshot.counterInc('beeps');
        setImmediate(beep);
      }
      beep();
    };

Along with the `counterInc()` function, there is a `counterAdd()` function that
will produce slightly different behavior but is useful for finding averages of
arbitrary data produced by your tests, such as the time in milliseconds requests
take to run.

    exports.counters = ['timers'];

    exports.run = function (snapshot) {
      function stuff() {
        var start = getMilliseconds();
        // do stuff...
        var end = getMilliseconds();
        snapshot.counterAdd('timers', (end-start));
        setImmediate(stuff);
      }
      stuff();
    };

Optionally, `exports.setUp` may be a function that initializes the test, before
snapshot timers begin. It must call its `callback` argument when complete.
Additional arguments passed to `callback` will be given to `exports.run`:

    exports.counters = ['beeps'];

    exports.setUp = function (callback) {
      require('fs').readFile('beeps.txt', function (err, beepsData) {
        callback(beepsData);
      }
    };

    exports.run = function (snapshot, beepsData) {
      function beep() {
        snapshot.counterInc('beeps');
        setImmediate(beep);
      }
      beep();
    };

The service configuration file, `flood.conf.json`, is installed into the
`etc` directory of the node package (likely `/usr/lib/node_modules/flood/`).
This file has several options:

 * `clientPort`: The port to listen for connections on.

 * `urlPrefix`: The expected prefix for every POST, without trailing slash.

 * `publicKeyFile`: The public key file used to verify digital signatures of
   incoming test scripts. Must correspond to the `privateKeyFile` option
   given in `flood-watch` configuration.

### `flood-watch`

The intention of the `flood-watch` process is to connect to all the `flood`
processes and aggregate all their counters over a set time. A single argument
with the JSON configuration file is passed to `flood-watch`, which looks
something like this:

    {
      "clients": [
        "localhost"
      ],
      "clientPort": 5143,
      "dependencies": [],
      "privateKeyFile": "/etc/flood/private.pem",
      "snapshots": 10,
      "interval": 1000,
      "workerModule": "beeps.js",
      "numWorkers": 0
    }

The options are:

 * `clients`: A socket connection is initiated to the `flood` service on each
   host in the list to run the test.

 * `clientPort`: The port to use for client connections.

 * `dependencies`: An array of packages to be installed locally by npm before
   running the test.

 * `privateKeyFile`: A private key file used to generate a digital signature
   of the the test file. Verification of the signature by the `flood` service
   prevents execution of malicious scripts.

 * `snapshots`: Number of counter snapshots to gather for the test.
   Corresponds to the `X-Snapshots` header to the `flood` service.

 * `interval`: The length, in milliseconds, of each snapshot window. The
   entire run-length of the test is given by `interval * snapshots`.
   Corresponds to the `X-Snapshot-Length` header.

 * `workerModule`: This file is read in and passed to the `flood` service as
   the test file.

 * `numworkers`: The number of worker threads created by each machine running
   the `flood` service. Positive numbers indicate an exact number of threads,
   while zero and negatives will subtract from the number of CPU cores.
   Corresponds to the `X-Workers` header.

### Public and Private Keys

To streamline the process of generating private and public keys for digital
content signatures, flood installs a script called `flood-genkeys`. This
script will generate `private.pem` and `public.pem` in the directory
specified by the first given argument (defaults to `/etc/flood`).

Don't forget the private key only needs to be accessible by the machine
running `flood-watch`, and the public key only needs to be accessible by the
machines running `flood`.
