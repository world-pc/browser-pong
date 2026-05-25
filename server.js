const http = require('http');
const {Server} = require('socket.io');
const fs = require('fs');
const argon2 = require('argon2');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const sessions = {};
const connected_users = {};
let conn;

async function doesUserExist(given_username, conn) {
    const [rows] = await conn.query("SELECT 1 FROM users WHERE username=?", [given_username]);
    return rows.length > 0;
}

let io;

async function main() {
    //let's connect to the mysql user database
    conn = await mysql.createConnection({
        host: 'localhost',
        user: 'librarian',
        database: 'my_user_db'
    });

    //this will serve the login webpage or game webpage depending on user authentication
    const server = http.createServer((req, res) => {
        if(req.url === '/nodejs_pong' && req.method === 'GET') {
            const cookies = req.headers.cookie;
            console.log(cookies);
            //if user's been authenticated, they get the game page
            if(sessions[cookies?.split('=')[1]]) {
                    console.log('serving game...');
                    res.writeHead(200, {'Content-Type': 'text/html'});
                    fs.createReadStream('./game.html').pipe(res);
            }
            //else if the user hasn't been auth'd, they get the login page
            else {
                console.log('serving login...');
                res.writeHead(200, {'Content-Type': 'text/html'});
                fs.createReadStream('./login.html').pipe(res);
            }
        }

        if(req.url === '/nodejs_pong/game_engine.js' && req.method === 'GET') {
            console.log('game_engine.js HIT!');
            res.writeHead(200, {'Content-Type': 'application/javascript'});
            fs.createReadStream('./game_engine.js').pipe(res);
        }

        if(req.url === '/nodejs_pong/game_event_listeners.js' && req.method === 'GET') {
            console.log('game_event_listeners.js HIT!');
            res.writeHead(200, {'Content-Type': 'application/javascript'});
            fs.createReadStream('./game_event_listeners.js').pipe(res);
        }

        if(req.url === '/nodejs_pong/login' && req.method === 'POST') {
            console.log('login attempt...');

            let body = '';

            req.on('data', chunk => {body += chunk;});
            req.on('end', async() => {
                const data = JSON.parse(body);

                //look up the user that client's trying to login as
                const [rows] = await conn.query("SELECT * FROM users WHERE username=?", [data['username']]);
                if(rows.length > 0) {
                    const user = rows[0];

                    const correct_pwd = await argon2.verify(user.password, data['password']);

                    if(correct_pwd) {
                        //setup the session cookie here and for client.
                        const sessionId = crypto.randomUUID();
                        sessions[sessionId] = data['username'];

                        res.writeHead(200, {'Content-Type': 'application/json',
                                            'Set-Cookie': `sessionId=${sessionId}; HttpOnly; SameSite=Lax; Path=/`});
                        res.end(JSON.stringify({login_successful: true}));
                    }
                    else {
                        res.writeHead(401, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify({login_successful: false}));
                    }
                }
                else {
		    res.writeHead(401, {'Content-Type': 'application/json'});
		    res.end(JSON.stringify({login_successful: false}));
                }
            });
        }


        if(req.url === '/nodejs_pong/register' && req.method === 'POST') {
            let body = '';

            req.on('data', chunk => {body += chunk;});
            req.on('end', async () =>  {
                const data = JSON.parse(body);

                //make sure the username's legal. no spaces allowed.
                if(data['username'].includes(' ')) {
                    console.log('no spaces allowed in usernames!');
                    res.writeHead(422, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({bad_username: true}));
                    return 0;
                }

                //check for existing user
                const user_exists = await doesUserExist(data['username'], conn);
                if(!user_exists) {
                    console.log('creating new user...');

                    const pwd_hash = await argon2.hash(data['password']);

                    conn.query("INSERT INTO users (username, password) VALUES (?, ?)",
                               [data['username'], pwd_hash]);

                    res.writeHead(201, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({username_taken: false}));
                }
                else {
                    console.log('user already exists...');

                    res.writeHead(409, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({username_taken: true}));
                }
            });
        }

        if(req.url === '/nodejs_pong/get_stats' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {body += chunk});
            req.on('end', async () => {
                const data = JSON.parse(body);

                const [rows] = await conn.query('SELECT * FROM users WHERE username = ?', [connected_users[data['target_user']].split(' ')[0]]);
                console.log('stat string info!');
                console.log(rows);

                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({stat_string: rows[0].wins + 'W / ' + rows[0].losses + 'L'}));
            });
        }

    });

    //socket stuff!
    io = new Server(server);

    let chat_log = '';

    io.on('connection', (socket) => {
        console.log('all cookies:', socket.handshake.headers.cookie);
        console.log('all headers:', socket.handshake.headers);
        const cookieHeader = socket.handshake.headers.cookie;
        const sessionid = cookieHeader?.split('=')[1];
        let username = sessions[sessionid];

        //we'll count how many connected users have this username
        //and append (n) to the username to differentiate them.
        let dup_count = 0;
        for(const [key, val] of Object.entries(connected_users)) {
            if(val === username) {
                dup_count += 1;
            }
        }

        if(dup_count > 0 ) {
            username += ' ('+dup_count+')';
        }

        connected_users[socket.id] = username;

        io.emit('lobby', Object.entries(connected_users));

	    //let the connecting user know what their username is.
	    //just in case they connect multiple times.
        socket.emit('ur_username', username);
	
        socket.emit('chatlog', chat_log);

        socket.on('disconnect', () => {
            //remove disconnecting client from lobby.
            delete connected_users[socket.id];
            io.emit('lobby', Object.entries(connected_users));

            //give the win to the disconnected client's opponent.
            for(let i = 0; i < matches.length; ++i) {
                if(matches[i].p1_sid == socket.id) {
                    matches[i].p2_score = 5;
                    io.to(matches[i].p2_sid).emit('opp_disconn', true);

                    addAWin(connected_users[matches[i].p2_sid], conn);
                    addALoss(connected_users[matches[i].p1_sid], conn);
                }
                else if(matches[i].p2_sid == socket.id) {
                    matches[i].p1_score = 5;
                    io.to(matches[i].p1_sid).emit('opp_disconn', true);

                    addAWin(connected_users[matches[i].p1_sid], conn);
                    addALoss(connected_users[matches[i].p2_sid], conn);
                }
            }

            //remove disconnecting client from lobby.
            delete connected_users[socket.id];
            io.emit('lobby', Object.entries(connected_users));
        });

        socket.on('challenge_request', (data) => {

            //we can't let a user challenge themselves
            if(connected_users[data].split(" ")[0] == connected_users[socket.id].split(" ")[0]) {
                console.log("users can't challenge themselves..");
            }
            else {
                console.log('received "challenge_request" from '+socket.id);
                console.log('sending "challenge_request" to '+data);
                io.to(data).emit('challenge_request', [socket.id, connected_users[socket.id]]);
            }
        });

        //here data is the user that sent the original challenge.
        socket.on('challenge_accept', (data) => {
            console.log(socket.id + ' has accepted '+data+"'s challenge.");
            console.log('sending both parties the "challenge_start".');

            socket.emit('challenge_start', [data, connected_users[data]]);
            io.to(data).emit('challenge_start', [socket.id, connected_users[socket.id]]);

            startNewMatch(data, socket.id);
        });

        //listening for player changing their paddle move state
        socket.on('paddle_move_state', (data) => {
            updatePaddleMoveState(socket.id, data);
        });

        //listening for incoming messages to general chat from users
        socket.on('general_message', (data) => {
            chat_log += connected_users[socket.id] + ": " + data + '<br />';
            io.emit('chatlog', chat_log);
        });
    });

    server.listen(3000);
    setInterval(gameLoop, 1000/60);
}

function addAWin(given_username, conn) {
    /* accepts a username & mysql server connection and increments their 'wins' field in the database */

    const username = given_username.split(' ')[0]; //handle duplicate users.

    conn.query("UPDATE users SET wins = wins + 1 WHERE username = ?", [given_username]);
}

function addALoss(given_username, conn) {
    /* accepts a username & mysql server connection and increments their 'losses' field in the database */

    const username = given_username.split(' ')[0]; //handle duplicate users.
    
    conn.query("UPDATE users SET losses = losses + 1 WHERE username = ?", [given_username]);
}

let matches = []
function startNewMatch(p1_sid, p2_sid) {
    matches.push(new Match(p1_sid, p2_sid));
}

class Match {
    constructor(p1_sid, p2_sid) {
        this.p1_sid = p1_sid;
        this.p2_sid = p2_sid;

        this.p1_pos = 0;
        this.p2_pos = 0;

        this.ball_x = 0;
        this.ball_y = 0;

        this.ball_vx = 0.03;
        this.ball_vy = 0.03;

        this.p1_score = 0;
        this.p2_score = 0;

        this.p1_move_state = 'netural';
        this.p2_move_state = 'neutral';

        this.ball_colls = 0;
    }

    resetBallAndPaddles() {
        this.ball_x = 0;
        this.ball_y = 0;
        this.p1_pos = 0;
        this.p2_pos = 0;
        this.ball_colls = 0;
        this.ball_vx = 0.03;
        this.ball_vy = 0.03;
    }

    updateGameState() {
        //ball out of bounds
        if(this.ball_y >= 4.5 || this.ball_y <= -4.5) {
            this.ball_vy *= -1;
        }

        //check for goal
        if(this.ball_x <= -6.9) {
            this.p2_score += 1;
            this.resetBallAndPaddles();
        }

        if(this.ball_x >= 6.9) {
            this.p1_score += 1;
            this.resetBallAndPaddles();
        }

        //check for gameover
        if(this.p1_score >= 5) {
            io.to(this.p1_sid).emit('gameover', {victor: 'you'});
            io.to(this.p2_sid).emit('gameover', {victor: 'opp'});
            this.ball_x = 0;
            this.ball_y = 0;
            this.ball_vx = 0;
            this.ball_vy = 0;

            addAWin(connected_users[this.p1_sid], conn);
            addALoss(connected_users[this.p2_sid], conn);

            matches = matches.filter(item => item !== this);
        }
        else if(this.p2_score >= 5) {
            io.to(this.p1_sid).emit('gameover', {victor: 'opp'});
            io.to(this.p2_sid).emit('gameover', {victor: 'you'});
            this.ball_x = 0;
            this.ball_y = 0;
            this.ball_vx = 0;
            this.ball_vy = 0;

            addAWin(connected_users[this.p1_sid], conn);
            addALoss(connected_users[this.p2_sid], conn);

            matches = matches.filter(item => item !== this);
        }

        //update velocity after so many paddle-ball collisions
        if((this.ball_colls + 1)%4 == 0) {
            this.ball_colls = 0;
            this.ball_vx *= 1.5;
            this.ball_vy *= 1.5;
        }

        //update ball position from velocity
        this.ball_x += this.ball_vx;
        this.ball_y += this.ball_vy;

        //ball and paddle collision physics
        if(this.ball_vx > 0) {
            if((this.ball_y > this.p2_pos-0.5) && (this.ball_y < this.p2_pos+0.5)) {
                if((this.ball_x > 6-0.5) && (this.ball_x < 6+0.5)) {
                    this.ball_vx *= -1;
                    this.ball_x -= 0.5;
                    this.ball_colls += 1;
                }
            }
        }

        if(this.ball_vx < 0) {
            if((this.ball_y > this.p1_pos-0.5) && (this.ball_y < this.p1_pos+0.5)) {
                if((this.ball_x > -6-0.5) && (this.ball_x < -6+0.5)) {
                    this.ball_vx *= -1;
                    this.ball_x += 0.5;
                    this.ball_colls += 1;
                }
            }
        }

        //paddle movement
        if(this.p1_move_state == 'up') {
            if(this.p1_pos < 4.5) {
                this.p1_pos += 0.1;
            }
        }
        else if(this.p1_move_state == 'down') {
            if(this.p1_pos > -4.5) {
                this.p1_pos -= 0.1;
            }
        }

        if(this.p2_move_state == 'up') {
            if(this.p2_pos < 4.5) {
                this.p2_pos += 0.1;
            }
        }
        else if(this.p2_move_state == 'down') {
            if(this.p2_pos > -4.5) {
                this.p2_pos -= 0.1;
            }
        }
    }

    updateClients() {
        let game_data = {p1_pos: this.p1_pos,
                         p2_pos: this.p2_pos,

                         ball_x: this.ball_x,
                         ball_y: this.ball_y,

                         p1_score: this.p1_score,
                         p2_score: this.p2_score,

                         which_player: 'p1'};

        io.to(this.p1_sid).emit('game_state', game_data);

        game_data['which_player'] = 'p2';

        io.to(this.p2_sid).emit('game_state', game_data);
    }
}

function updatePaddleMoveState(sid, data) {
    for(let i = 0; i < matches.length; i += 1) {
        if(matches[i].p1_sid == sid) {
            matches[i].p1_move_state = data;
            break;
        }
        else if(matches[i].p2_sid == sid) {
            matches[i].p2_move_state = data;
            break;
        }
    }
}

function gameLoop() {
    for(let i = 0; i < matches.length; i += 1) {
        matches[i].updateGameState();

        //if statement in case .updateGameState() removed this match.
        if(matches[i]) {
            matches[i].updateClients();
        }
    }
}

main();
