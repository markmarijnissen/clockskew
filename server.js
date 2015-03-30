var http = require('http');
var WebSocket = require('faye-websocket');
var now = Date.now; 
if(require('./package.json').hrtime === true) {
	console.log('Using high performance time process.hrtime()');
	now = require("performance-now");
}

var server = http.createServer();
server.addListener('request', function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end(now()+'');
});

server.on('upgrade', function(request, socket, body) {
  if (WebSocket.isWebSocket(request)) {
    var ws = new WebSocket(request, socket, body);

    ws.on('message', function(event) {
      ws.send(now());
    });

    ws.on('close', function(event) {
      ws = null;
    });
  }
});

var port = process.env.PORT || 9999;
console.log('Listening on '+port);
server.listen(port, '0.0.0.0');
