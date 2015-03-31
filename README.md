# clockskew

A smart algorithm to calculate clock skew from a timeserver.

Use it to synchronize your apps with millisecond accuracy.

[See demo of synchronized note playing](http://lab.madebymark.nl/chords/) (open multiple tabs, modern browser required).

## Time Server

```
# get the code
git clone git@github.com:markmarijnissen/clockskew.git
# run the server
node server
# or run online
modules deploy
```

## Client
```
var ClockSkew = require('clockskew/client');
# or just include the file 

var clockSkew = new ClockSkew({
	// REQUIRED :

	getServerTime: ClockSkew.getSocketTime('ws://...'),
	# or use HTTP protocol
	getServerTime: ClockSkew.getHttpTime.bind(null,'http://'),
	# or use Firebase
	getServerTime: ClockSkew.getFirebaseTime.bind(null,'https://xxx.firebaseio.com')

	// OPTIONAL:

	getTime: function(){...}, // get local time in ms.
	timeout: 10000, // ping timeout
	interval: 1000, // ping interval
	history: 10, 
	tolerance: 2, // is standard deviation of last `history` average skew is less then tolerance, wait longer before pinging.
	waitInteval: 30000, // wait interval
	minSkewValues: 5, // minimum values before averaging
	minRttValues: 5 // minimum Round-Trip-Time values before rejecting RTTs that are more than 1 standard deviation slower
	setTimeout: ... // custom setTimeout Implementation
	clearTimeout: ... // custom clearTimeout implementation
});

clockSkew.start();
clockSkew.stop();
```

## Changelog

0.2.0 - Changed `ClockSkew.js` into `client.js`

## Contribute

Feel free to contribute to this project in any way. The easiest way to support this project is by giving it a star.

## Contact
-   @markmarijnissen
-   http://www.madebymark.nl
-   info@madebymark.nl

© 2015 - Mark Marijnissen