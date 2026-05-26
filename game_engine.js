//import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(90, 600/400, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(600, 400);
renderer.setClearColor(0x000000);
document.getElementById('game').appendChild(renderer.domElement);
renderer.domElement.style.borderRadius = '20px';

renderer.setAnimationLoop(animate);

//stores y-coordinate for player paddles
let p1_pos = 1,
    p2_pos = 1;

//store x, y coords for ball
let ball_x = 0,
    ball_y = 0;

//store ball's x, y velocity
let ball_vx = 0.02,
    ball_vy = 0.02;

//player scores
let p1_score = 0,
    p2_score = 0;

//saves movement states for paddles
let p1_move_state = 'neutral',
    p2_move_state = 'netural';

//paddle rendering stuffs
const paddle_geo = new THREE.BoxGeometry(0.25, 1, 0.1);
const paddle_mat = new THREE.MeshBasicMaterial({color: 0xffffff});

const p1_paddle = new THREE.Mesh(paddle_geo, paddle_mat);
p1_paddle.position.y = p1_pos;
p1_paddle.position.x = -6;
scene.add(p1_paddle);

const p2_paddle = new THREE.Mesh(paddle_geo, paddle_mat);
p2_paddle.position.y = p2_pos;
p2_paddle.position.x = 6;
scene.add(p2_paddle);

//game bounds rendering stuffs
const vert_bounds_geo = new THREE.BoxGeometry(16, 0.1, 0.1);
const vert_bounds_mat = new THREE.MeshBasicMaterial({color: 0x0000ff});

const top_vert_bound = new THREE.Mesh(vert_bounds_geo, vert_bounds_mat);
top_vert_bound.position.y = 5;
scene.add(top_vert_bound);

const bot_vert_bound = new THREE.Mesh(vert_bounds_geo, vert_bounds_mat);
bot_vert_bound.position.y = -5;
scene.add(bot_vert_bound);

const horiz_bounds_geo = new THREE.BoxGeometry(0.1, 10, 0.1);
const horiz_bounds_mat = new THREE.MeshBasicMaterial({color: 0x0000ff});

const left_horiz_bound = new THREE.Mesh(horiz_bounds_geo, horiz_bounds_mat);
left_horiz_bound.position.x = -7.5;
scene.add(left_horiz_bound);

const right_horiz_bound = new THREE.Mesh(horiz_bounds_geo, horiz_bounds_mat);
right_horiz_bound.position.x = 7.5;
scene.add(right_horiz_bound);

//create the ball
const ball_geo = new THREE.SphereGeometry(0.25);
const ball_met = new THREE.MeshBasicMaterial({color: 0x00ff00});

const ball = new THREE.Mesh(ball_geo, ball_met);
scene.add(ball);

//zoom out a bit so we can actually see things.
camera.position.z = 5;

function beginGame() {
    console.log('game started..');
    if(game_over_text) {
        game_over_text.visible = false;
        scene.remove(game_over_text);
        game_over_text.geometry.dispose();
        game_over_text = undefined;
    }

//stores y-coordinate for player paddles
    p1_pos = 1,
    p2_pos = 1;

//store x, y coords for ball
    ball_x = 0,
    ball_y = 0;

//store ball's x, y velocity
    ball_vx = 0.02,
    ball_vy = 0.02;

//player scores
    p1_score = 0,
    p2_score = 0;

//saves movement states for paddles
    p1_move_state = 'neutral',
    p2_move_state = 'netural';
}

function goalMade(p_goal_for) {
    /* accepts 'p1' or 'p2' as the player
    that made the goal. */

    if(p_goal_for == 'p1') {
        p1_score += 1;
    }
    else if(p_goal_for == 'p2') {
        p2_score += 1;
    }

    ball_x = 0;
    ball_y = 0;
}

//draw the score
let you_text, opp_text;
async function loadText() {
    const loader = new THREE.FontLoader();
    const font = await loader.loadAsync('https://cdn.jsdelivr.net/npm/three@0.114.0/examples/fonts/helvetiker_regular.typeface.json');
    const you_text_geo = new THREE.TextGeometry('You', {font: font, size: 0.5, height: 0.1});
    const opp_text_geo = new THREE.TextGeometry('Opp', {font: font, size: 0.5, height: 0.1});

    const text_mat = new THREE.MeshBasicMaterial({color: 0xffffff});
    you_text = new THREE.Mesh(you_text_geo, text_mat);
    opp_text = new THREE.Mesh(opp_text_geo, text_mat);

    you_text.position.y = 4;
    opp_text.position.y = 4;
}

loadText();

let font;
async function fontInit() {
    const loader = new THREE.FontLoader();
    font = await loader.loadAsync('https://cdn.jsdelivr.net/npm/three@0.114.0/examples/fonts/helvetiker_regular.typeface.json');
}

fontInit();

let p1_score_text,
    p2_score_text;
async function updateScores(p1_score_given, p2_score_given) {
    if(p1_score_text && p2_score_text) {
        p1_score_text.visible = false;
        p2_score_text.visible = false;
        console.log('goal.');
        scene.remove(p1_score_text); p1_score_text.geometry.dispose();
        scene.remove(p2_score_text); p2_score_text.geometry.dispose();
        p1_score_text = undefined; p2_score_text = undefined;
    }

    const p1_score_geo = new THREE.TextGeometry(String(p1_score_given),
                                                {font: font, size: 0.5, height: 0.1});
    const p2_score_geo = new THREE.TextGeometry(String(p2_score_given),
                                                {font: font, size: 0.5, height: 0.1});

    const text_mat = new THREE.MeshBasicMaterial({color: 0xffffff});

    p1_score_text = new THREE.Mesh(p1_score_geo, text_mat);
    p2_score_text = new THREE.Mesh(p2_score_geo, text_mat);
    scene.add(p1_score_text);
    scene.add(p2_score_text);

    p1_score_text.position.x = -4;
    p1_score_text.position.y = 3;

    p2_score_text.position.x = 4;
    p2_score_text.position.y = 3;
}

let game_over_text;
function gameOver(data) {
    console.log('game over...');

    let gameover_text_geo;
    if(data['victor'] === 'you') {
        gameover_text_geo = new THREE.TextGeometry('you win!',
                                                   {font: font,
                                                    size: 0.5,
                                                    height: 0.1});
    }
    else if(data['victor'] === 'opp') {
        gameover_text_geo = new THREE.TextGeometry('opp wins :\\',
                                                   {font: font,
                                                    size: 0.5,
                                                    height: 0.1});
    }

    const text_mat = new THREE.MeshBasicMaterial({color: 0xffffff});

    game_over_text = new THREE.Mesh(gameover_text_geo,
                                    text_mat);
    scene.add(game_over_text);
}

function updateGameState(data) {
    ball_x = data['ball_x'];
    ball_y = data['ball_y'];

    p1_pos = data['p1_pos'];
    p2_pos = data['p2_pos'];

    p1_score = data['p1_score'];
    p2_score = data['p2_score'];

    updateScores(p1_score, p2_score);

    scene.add(you_text);
    scene.add(opp_text);

    if(data['which_player'] == 'p1') {
        you_text.position.x = -4;
        opp_text.position.x = 4;
    }

    else if(data['which_player'] == 'p2') {
        you_text.position.x = 4;
        opp_text.position.x = -4;
    }
}

function animate(time) {

    //update paddle positions
    p1_paddle.position.y = p1_pos;
    p2_paddle.position.y = p2_pos;

    //update ball position
    ball.position.x = ball_x;
    ball.position.y = ball_y;

    renderer.render(scene, camera);
}

//some callbacks for user input
document.addEventListener('keydown', (e) => {
    if(e.key == 'ArrowUp') {
        socket.emit('paddle_move_state', 'up');
    }
    if(e.key == 'ArrowDown') {
        socket.emit('paddle_move_state', 'down');
    }
});

document.addEventListener('keyup', (e) => {
    if(e.key == 'ArrowUp' || e.key == 'ArrowDown') {
        socket.emit('paddle_move_state', 'netural');
    }
});
