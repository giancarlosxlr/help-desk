const app = require('express')();
const fetch = require('node-fetch');

const server = require('http').Server(app);
const io = require('socket.io')(server);
const credentials = require('./credentials.json');

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
    headers:  {
      'Authorization': access_token ? 'bearer ' + access_token : undefined
    },
    method: method,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();

  if (response.status == 401 && data.code == 1004) {
    let authResponse;
    if (!refresh_token) {
      authResponse = await fetch('http://localhost:3000/oauth/token',{
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

  return {status: response.status, data: data};
}


app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function (socket) {

  socket.on('api_call', function(data, callback){
    request(data.method, data.path, data.params, data.body).then((response)=>{
      callback(response);
    }).catch((e)=>{
      console.log(e);
    });
  });


});

app.get('/webhooks', function (req, res) {
  req.query


  res.status(200);
  res.end();
});

app.post('/webhooks', function (req, res) {
  res.status(200);
  res.end();
});

server.listen(4000);
