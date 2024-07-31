import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { WebSocketServer } from 'ws';
import { SessionManager } from './dist/esm/src/services/sessions/sessions.js';
import { SessionService } from './dist/esm/src/services/sessions/sessions.service.js';


// Server configuration
const serverConfig = {
  protocol: 'http',
  host: 'localhost',
  port: 8080,
  startpage: 'index.html',
  headers: { 'Access-Control-Allow-Origin': '*' }
};

// Define mime types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.svg': 'application/image/svg+xml',
};

// Utility to read environment variables
function getEnvVar(name, defaultValue) {
  return process.env[name] || defaultValue;
}

// Function to handle incoming requests
function onRequest(request, response, cfg) {
  let requestURL = '.' + request.url;

  if (requestURL === './') {
    requestURL += cfg.startpage;
  }

  let headers = {}; // 200 response

  if (cfg.headers) {
    Object.assign(headers, cfg.headers);
  }

  // Read the file on the server
  if (fs.existsSync(requestURL)) {
    fs.readFile(requestURL, (error, content) => {
      if (error) {
        response.writeHead(500);
        response.end('Internal Server Error');
      } else {
        const extname = String(path.extname(requestURL)).toLowerCase();
        const contentType = mimeTypes[extname] || 'application/octet-stream';
        Object.assign(headers, { 'Content-Type': contentType });
        response.writeHead(200, headers);
        response.end(content, 'utf-8');
      }
    });
  } else {
    response.writeHead(404, { 'Content-Type': 'text/html' });
    response.end('404 Not Found', 'utf-8');
  }
}

// Function to create and start the server
function createServer(cfg) {
  if (cfg.protocol === 'http') {
    return http.createServer((request, response) => onRequest(request, response, cfg));
  } else if (cfg.protocol === 'https') {
    const options = {
      key: fs.readFileSync(cfg.keypath),
      cert: fs.readFileSync(cfg.certpath)
    };
    return https.createServer(options, (request, response) => onRequest(request, response, cfg));
  }
  throw new Error('Invalid protocol specified');
}
// Start the server
function startServer(cfg) {
  cfg.port = getEnvVar('PORT', cfg.port);

  let server = createServer(cfg);
  const wss = new WebSocketServer({ server });


  // server.on('upgrade', function upgrade(request, socket, head) { 
  //   wss.handleUpgrade(request, socket, head, function done(ws) {
  //     wss.emit('connection', ws, request);
  //   });
  // })

  const sessionPolling = 10;

  const sessions = new SessionService(
    undefined,
    sessionPolling
  );

  wss.on('connection', (ws) => {
    console.log("New Connection!");
    ws.on('message', (message) => {
      const data = JSON.parse(message);
      if (data?.route) {
        //console.log(data.route, data.args);
        if (data.route === 'setSessionToken') {
          let userId = data.args[0];
          sessions.users[userId] = {
            send: (data) => {
              if (typeof data !== "string")
                data = JSON.stringify(data);
              ws.send(data);
            }
          }
        }
        sessions.receive(data);
      }
      //console.log('Received message:', route, args);
    });

    ws.on('close', () => {
      // Handle user disconnection if needed
    });
  });

  server.listen(cfg.port, cfg.host, () => {
    console.log(`Server running at ${cfg.protocol}://${cfg.host}:${cfg.port}/`);
  });

  return server;
}


// Load configuration and start server
startServer(serverConfig);
