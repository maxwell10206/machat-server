var TLS_PORT = 443;
var HTTP_PORT = 3000;

var fs = require('fs');
var app = require('express')();
var sslOptions = {
    key: fs.readFileSync('./server.key'),
    cert: fs.readFileSync('./server.crt'),
    ca: fs.readFileSync('./ca.crt'),
    requestCert: true,
    rejectUnauthorized: false
};
var https = require('https');
var http = require('http');
var secureServer = https.createServer(sslOptions,app).listen(TLS_PORT, function(){
    console.log("Secure Express server listening on port " + TLS_PORT);
});

var httpServer = http.createServer(app).listen(HTTP_PORT, function(){
	console.log("HTTP server listening on port "  + HTTP_PORT);
});

var io = require('socket.io')(httpServer);
var db = require('./database');
var clientCMD = require('./ClientCMD');

io.on('connection', function (socket) {
    clientCMD(io, db, socket);
});

var secureIO = require('socket.io')(secureServer);

secureIO.on('connection', function (socket) {
    clientCMD(secureIO, db, socket);
 });

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});