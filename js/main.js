'use strict';

//controls object stores input state
var controls_enabled = false;
var controls = {
    up: false,
    left: false,
    down: false,
    right: false
};

///
var lock_pointer = 'pointerLockElement' in document ||
                      'moxPointerLockElement' in document ||
                      'webkitPointerLockElement' in document;
//If so, then lock it.
if(lock_pointer){
    //The dom element we want to lock the pointer to, in this case the body.
    var element = document.body;

    //Callback function to enable and disable controls
    var pointerLockChange = function(event){
        if(document.pointerLockElement === element){
            controls_enabled = true;
        }else{
            controls_enabled = false;
        }
    }

    //Event Listeners
    document.addEventListener('pointerlockchange', pointerLockChange, false);
    document.body.addEventListener('click', function(event){
        element.requestPointerLock = element.requestPointerLock ||
                                 element.mozRequestPointerLock ||
                                 element.webkitRequestPointerLock;

        element.requestPointerLock();
    }, false);
}
///

var WIDTH = window.innerWidth;
var HEIGHT = window.innerHeight;

var VIEW_ANGLE = 75,
    ASPECT = WIDTH/HEIGHT,
    NEAR = 0.1,
    FAR = 10000;

var container, controls;
var scene, camera, renderer;
var controls;

var pointLight;

var cube;
var mesh, texture;

var terrainWidth = 128, terrainDepth = 128;

var skybox_geom = new THREE.SphereGeometry(3000, 60, 40);
var uniforms = {
    texture: {type: 't', value: loadTexture('./res/imgs/skybox.jpg')}
};

var skybox_mat = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: document.getElementById('sky-vertex').textContent,
    fragmentShader: document.getElementById('sky-fragment').textContent
});

var skybox_mesh = new THREE.Mesh(skybox_geom, skybox_mat);
skybox_mesh.scale.set(-1, 1, 1);
skybox_mesh.rotation.order = 'XZY';
skybox_mesh.renderOrder = 1000.0;

var player, shoulder;
var move_direction;
var can_move = true;

var tree_geom, tree_mat;
var trees = [];

var pillar_geom, pillar_mat;
var pillars = [];

var grass_geom, grass_mat;
var grasses = [];

var options, spawnerOptions, particleSystem;
var shouldEmit = false;

var audio = document.createElement('audio');
var source = document.createElement('source');
source.src = './res/sounds/walk.wav';
audio.appendChild(source);

var ambaudio = document.createElement('audio');
var ambsource = document.createElement('source');
ambsource.src = './res/sounds/ambient.mp3';
ambaudio.appendChild(ambsource);
ambaudio.play();

var clock = new THREE.Clock();

window.addEventListener('resize', onWindowResize, false);
window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('keydown', onKeyDown, false);
window.addEventListener('keyup', onKeyUp, false);

init();
run();

function init(){
    container = document.getElementById('container');
    container.innerHTML = "";

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.025);

    camera = new THREE.PerspectiveCamera(VIEW_ANGLE, ASPECT, NEAR, FAR);
    camera.position.set(0, 0, 0.1);
    camera.lookAt(scene.position);

    renderer = new THREE.WebGLRenderer();
    renderer.setSize(WIDTH, HEIGHT);
    renderer.setClearColor(0x336699);
    container.appendChild(renderer.domElement);

    pointLight = new THREE.PointLight(0xffffff);
    pointLight.intensity = 0.25;
    pointLight.position.set(0, 3, 0);
    //scene.add(pointLight);

    //controls = new THREE.OrbitControls(camera);
    //controls.addEventListener('change', render);

    cube = new THREE.Mesh(new THREE.CubeGeometry(1, 1, 1), new THREE.MeshLambertMaterial({color: 0xff0000}));
    scene.add(cube);

    var data = generateHeightmapData(terrainWidth, terrainDepth);

    var geometry = new THREE.PlaneBufferGeometry(terrainWidth*8, terrainDepth*8, terrainWidth-1, terrainDepth-1);
    geometry.rotateX(-Math.PI/2);

    var vertices = geometry.attributes.position.array;

    for(var i = 0, j = 0, l = vertices.length; i < l; i++, j += 3){
        vertices[j+1] = data[i];
    }

    geometry.computeFaceNormals();
    geometry.computeVertexNormals();

    //texture = new THREE.CanvasTexture(generateTexture(data, terrainWidth, terrainDepth));
    //texture.wrapS = THREE.ClampToEdgeWrapping;
    //texture.wrapT = THREE.ClampToEdgeWrapping;

    mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({color: 0x00aa00}));
    scene.add(mesh);

    scene.add(skybox_mesh);

    //player
    player = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1),
                                new THREE.MeshLambertMaterial({color: 0xff0000}));
    player.position.set(0, 75, 0);
    player.duck = false;
    player.add(pointLight);
    scene.add(player);

    shoulder = new THREE.Object3D();
    shoulder.position.set(0, 0.5, 0);
    shoulder.add(camera);
    player.add(shoulder);


    move_direction = new THREE.Vector3();

    var tree_texture = new THREE.ImageUtils.loadTexture('./res/imgs/tree_texture.png');
    tree_texture.wrapS = THREE.ClampToEdgeWrapping;
    tree_texture.wrapT = THREE.ClampToEdgeWrapping;
    tree_texture.magFilter = THREE.NearestFilter;
    tree_texture.minFilter = THREE.NearestFilter;

    tree_geom = new THREE.CubeGeometry(7.5, 15, 0.01);
    tree_mat = new THREE.MeshLambertMaterial({map: tree_texture, transparent: true});

    for(var i = 0; i < 1000; i++){
        var rx = (Math.random() * (terrainWidth-1)*8) - ((terrainWidth-1)*8/2);
        var ry = (Math.random() * (terrainDepth-1)*8) - ((terrainDepth-1)*8/2);
        var height = getHeightAt(rx, ry);

        var treemesh = new THREE.Mesh(tree_geom, tree_mat);
        treemesh.position.set(rx, height+7, ry);
        trees.push(treemesh);
        scene.add(treemesh);
    }

    //pillars
    var pillar_texture = new THREE.ImageUtils.loadTexture('./res/imgs/pillar_texture.png');
    pillar_texture.wrapS = THREE.ClampToEdgeWrapping;
    pillar_texture.wrapT = THREE.ClampToEdgeWrapping;
    pillar_texture.magFilter = THREE.NearestFilter;
    pillar_texture.minFilter = THREE.NearestFilter;

    pillar_geom = new THREE.CubeGeometry(0.75, 1, 0.01);
    pillar_mat = new THREE.MeshLambertMaterial({map: pillar_texture, transparent: true});

    for(var i = 0; i < 100; i++){
        var rx = (Math.random() * (terrainWidth-1)*8) - ((terrainWidth-1)*8/2);
        var ry = (Math.random() * (terrainDepth-1)*8) - ((terrainDepth-1)*8/2);
        var height = getHeightAt(rx, ry);

        var pillarmesh = new THREE.Mesh(pillar_geom, pillar_mat);
        pillarmesh.position.set(rx, height+0.5, ry);
        pillarmesh.collected = false;
        pillarmesh.health = 100;
        pillars.push(pillarmesh);
        scene.add(pillarmesh);
    }

    //grasses
    //pillars
    var grass_texture = new THREE.ImageUtils.loadTexture('./res/imgs/grass_texture.png');
    grass_texture.wrapS = THREE.ClampToEdgeWrapping;
    grass_texture.wrapT = THREE.ClampToEdgeWrapping;
    grass_texture.magFilter = THREE.NearestFilter;
    grass_texture.minFilter = THREE.NearestFilter;

    grass_geom = new THREE.CubeGeometry(2, 2, 0.01);
    grass_mat = new THREE.MeshLambertMaterial({map: grass_texture, transparent: true});

    for(var i = 0; i < 200; i++){
        var rx = (Math.random() * (terrainWidth-1)*8) - ((terrainWidth-1)*8/2);
        var ry = (Math.random() * (terrainDepth-1)*8) - ((terrainDepth-1)*8/2);
        var height = getHeightAt(rx, ry);

        var grassmesh = new THREE.Mesh(grass_geom, grass_mat);
        grassmesh.position.set(rx, height+1, ry);
        grassmesh.collected = false;
        grassmesh.health = 100;
        grasses.push(grassmesh);
        scene.add(grassmesh);
    }

    particleSystem = new THREE.GPUParticleSystem({
        maxParticles: 5000
    });
    scene.add(particleSystem);

    options = {
        position: new THREE.Vector3(),
        positionRandomness: .5,
        velocity: new THREE.Vector3(0, 1, 0),
        velocityRandomness: .5,
        color: 0xaa0000,
        colorRandomness: .5,
        turbulence: .25,
        lifetime: 3,
        size: 25,
        sizeRandomness: 1
    };

    spawnerOptions = {
        spawnRate: 500,
        horizontalSpeed: 0.75,
        verticalSpeed: 1.33,
        timeScale: 1
    };

    
}

var tick = 0;
function run(){
    requestAnimationFrame(run);

    var delta = clock.getDelta() * spawnerOptions.timeScale;
    tick += delta;

    if(tick < 0) tick = 0;

    if(delta > 0){
        var mx = controls.left ? 1 : controls.right ? -1 : 0;
        var my = 0;
        var mz = controls.up ? 1 : controls.down ? -1 : 0;

        move_direction.set(mx, my, mz);
        move_direction.normalize();

        var dir = new THREE.Vector3().copy(player.position).sub(new THREE.Vector3(0, 0, 1));

        if(can_move){
            player.translateX(-move_direction.x * 15 * delta);
            player.translateZ(-move_direction.z * 15 * delta);
        }

        if(player.duck){
            player.position.y = getHeightAt(player.position.x, player.position.z) + 0.5;
        }else{
            player.position.y = getHeightAt(player.position.x, player.position.z) + 1;
        }

        for(var i = 0; i < trees.length; i++){
            var pos = new THREE.Vector3(player.position.x, trees[i].position.y, player.position.z);
            trees[i].lookAt(pos);
        }

        for(var i = 0; i < pillars.length; i++){
            var pos = new THREE.Vector3(player.position.x, pillars[i].position.y, player.position.z);
            pillars[i].lookAt(pos);
        }

        for(var i = 0; i < grasses.length; i++){
            var pos = new THREE.Vector3(player.position.x, grasses[i].position.y, player.position.z);
            grasses[i].lookAt(pos);
        }

        //options.position.copy(player.position);
        //options.position.set(0, getHeightAt(0, 0), 0);

        if(shouldEmit){
            for(var x = 0; x < spawnerOptions.spawnRate * delta; x++){
                particleSystem.spawnParticle(options);
            }
        }
    }

    particleSystem.update(tick);

    render();

    if(ambaudio.paused){
        ambaudio.play();
    }
}

function render(){
    renderer.render(scene, camera);
}

function onWindowResize(){
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(event){
    //event.preventDefault();
    if(controls_enabled){
        player.rotation.y -= event.movementX * 0.002;
        shoulder.rotation.x -= event.movementY * 0.002;

        var pitchAngle = shoulder.rotation.x * (180/Math.PI);
        var minPitch = -90;
        var maxPitch = 90;
        if(pitchAngle < minPitch){
            shoulder.rotation.x = minPitch * (Math.PI/180);
        }else if(pitchAngle > maxPitch){
            shoulder.rotation.x = maxPitch * (Math.PI/180);
        }
    }
}

function onKeyDown(event){
    //event.preventDefault();
    switch(event.keyCode){
        case 38: /*up*/
        case 87: /*W*/
            controls.up = true;
            shouldEmit = false;
            audio.play();
            break;
        case 37: /*left*/
        case 65: /*A*/
            controls.left = true;
            shouldEmit = false;
            audio.play();
            break;
        case 40: /*down*/
        case 83: /*S*/
            controls.down = true;
            shouldEmit = false;
            audio.play();
            break;
        case 39: /*right*/
        case 68: /*D*/
            controls.right = true;
            shouldEmit = false;
            audio.play();
            break;
        case 32: /*space*/
            break;
        case 69: //E
            //if player is close to a pillar 
            for(var i = 0; i < pillars.length; i++){
                var pillar = pillars[i];
                if(distanceBetween(player.position, pillar.position) < 5){
                    console.log('collected!');
                    pillar.health -= 1;
                    console.log(pillar.health);
                    options.position.copy(pillar.position);
                    shouldEmit = true;
                    player.duck = true;
                    can_move = false;
                    if(pillar.health <= 0){
                        pillar.health = 0;
                        pillar.collected = true;
                        shouldEmit = false;
                        can_move = true;
                        player.duck = false;
                    }
                }
            }
            break;
    }
    //console.log(event.keyCode);
}

function onKeyUp(event){
    //event.preventDefault();
    switch(event.keyCode){
        case 38: /*up*/
        case 87: /*W*/
            controls.up = false;
            break;
        case 37: /*left*/
        case 65: /*A*/
            controls.left = false;
            break;
        case 40: /*down*/
        case 83: /*S*/
            controls.down = false;
            break;
        case 39: /*right*/
        case 68: /*D*/
            controls.right = false;
            break;
        case 32:
            break;
        case 69:
            shouldEmit = false;
            can_move = true;
            player.duck = false;
            break;
    }  
}

function generateHeightmapData(width, depth){
    var size = width * depth, data = new Uint8Array( size ),
    perlin = new ImprovedNoise(), quality = 1.0, z = Math.random() * 100.0;

    for ( var j = 0; j < 4; j ++ ) {
        for ( var i = 0; i < size; i ++ ) {
            var x = i % width + '.0', y = ~~ ( i / width ) + '.0';
            data[ i ] += Math.abs( perlin.noise( x / quality, y / quality, z ) * quality * .5 );
        }
        quality *= 5;
    }
    return data;
}

function generateTexture( data, width, height ) {

    var canvas, canvasScaled, context, image, imageData,
    level, diff, forwardVector, sunVector, shade;

    forwardVector = new THREE.Vector3( 0, 0, 0 );

    sunVector = new THREE.Vector3( 1, 1, 1 );
    sunVector.normalize();

    canvas = document.createElement( 'canvas' );
    canvas.width = width;
    canvas.height = height;

    context = canvas.getContext( '2d' );
    context.fillStyle = '#000';
    context.fillRect( 0, 0, width, height );

    image = context.getImageData( 0, 0, canvas.width, canvas.height );
    imageData = image.data;

    for ( var i = 0, j = 0, l = imageData.length; i < l; i += 4, j ++ ) {

        forwardVector.x = data[ j - 2 ] - data[ j + 2 ];
        forwardVector.y = 2;
        forwardVector.z = data[ j - width * 2 ] - data[ j + width * 2 ];
        forwardVector.normalize();

        shade = forwardVector.dot( sunVector );

        imageData[ i ] = ( 96 + shade * 128 ) * ( 0.5 + data[ j ] * 0.007 );
        imageData[ i + 1 ] = ( 32 + shade * 96 ) * ( 0.5 + data[ j ] * 0.007 );
        imageData[ i + 2 ] = ( shade * 96 ) * ( 0.5 + data[ j ] * 0.007 );

    }

    context.putImageData( image, 0, 0 );

    // Scaled 4x

    canvasScaled = document.createElement( 'canvas' );
    canvasScaled.width = width * 4;
    canvasScaled.height = height * 4;

    context = canvasScaled.getContext( '2d' );
    context.scale( 4, 4 );
    context.drawImage( canvas, 0, 0 );

    image = context.getImageData( 0, 0, canvasScaled.width, canvasScaled.height );
    imageData = image.data;

    for ( var i = 0, l = imageData.length; i < l; i += 4 ) {

        var v = ~~ ( Math.random() * 5 );

        imageData[ i ] += v;
        imageData[ i + 1 ] += v;
        imageData[ i + 2 ] += v;

    }

    context.putImageData( image, 0, 0 );

    return canvasScaled;
}

function loadTexture(path){
    var texture = THREE.ImageUtils.loadTexture(path);

    texture.wrapS = THREE.ClampToEdgeWrapping; // THREE.Repeat;
    texture.wrapT = THREE.ClampToEdgeWrapping; // THREE.Repeat;
    texture.magFilter = THREE.NearestFilter;             // THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter; // THREE.NearestFilter;

    return texture;
}

function getHeightAt(x, y){
    var highpoint = new THREE.Vector3(x, 150, y);
    var downraycast = new THREE.Raycaster();
    downraycast.ray.origin.copy(highpoint);
    downraycast.ray.direction = new THREE.Vector3(0, -1, 0).normalize();

    var intersections = downraycast.intersectObject(mesh);

    return intersections[0].point.y;
}

function distanceBetween(v1, v2){
    var dx = v1.x - v2.x;
    var dy = v1.y - v2.y;
    var dz = v1.z - v2.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}