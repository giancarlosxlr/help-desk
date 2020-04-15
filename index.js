const app = require('express')();
const fetch = require('node-fetch');
const ngrok = require('ngrok');
const bodyParser = require('body-parser')
const open = require('open');
const server = require('http').Server(app);
const io = require('socket.io')(server);
const credentials = require('./credentials.json');

const sockets = [];

app.use(bodyParser.json());


let access_token, refresh_token;


async function request(method, pathname, params, body) {

  var url = new URL('http://localhost:3000');

  url.pathname = `/api/v1/${pathname}`;

  if (params) {
    for (let param in params) {
      url.searchParams.set(param, params[param]);
    }
  }

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': access_token ? 'bearer ' + access_token : undefined
    },
    method: method,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();

  if (response.status == 401 && (data.code == 1004 || data.code == 1005)) {
    let authResponse;
    if (!refresh_token) {
      authResponse = await fetch('http://localhost:3000/oauth/token', {
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify(credentials)
      });
    } else {
      authResponse = await fetch('http://localhost:3000/oauth/refresh', {
        headers: {
          'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({
          refresh_token: refresh_token
        })
      });
    }
    if (authResponse.status != 200) throw await authResponse.text();

    let json = await authResponse.json();
    refresh_token = json.refresh_token;
    access_token = json.access_token;

    return await request(method, pathname, params, body);
  }

  return { status: response.status, data: data };
}


app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function (socket) {
  sockets.push(socket);
  socket.on('api_call', function (data, callback) {
    request(data.method, data.path, data.params, data.body).then((response) => {
      callback(response);
    }).catch((e) => {
      console.log(e);
    });
  });

  socket.on('disconnect', function () {
    sockets.splice(sockets.indexOf(socket), 1);
  });
});

app.get('/webhooks', function (req, res) {
  res.status(200);
  res.end(req.query.token);
});

app.post('/webhooks', function (req, res) {
  res.status(200);
  sockets.forEach(function (socket) {
    req.body.entry.forEach((event) => {
      socket.emit(event.type, event.data);
    });
  });
  res.end();
});




(async function () {
  server.listen(4000);
  const url = await ngrok.connect(4000);
  const response = await request('post', 'webhook', {}, {
    url: url + "/webhooks",
    secret:'12345'
  });
  if(response.status != 200){
    throw response.data
  }
  await open('http://localhost:4000/');
})().catch(function (e) {
  console.log(e);
  process.exit(1);
});





