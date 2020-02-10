"use strict";

var PNUM = 512;
var video;

let poses = [];
let keyPoints = [];
let skeleton_partA = [], skeleton_partB = [];
let copy_skeletons = [];
let copy_keyPoints = [];
let poseNet;

let predict_count = 0;

var shader_canvas;
var webcam_canvas;

var gl;
var vertexShader,fragmentShader,program;
var quad_vertexShader,
    pos_fragmentShader,pos_program,
    vel_fragmentShader,vel_program,
    trail_fragmentShader,trail_program;

var positionLocation, pos_positionLocation, vel_positionLocation, trail_positionLocation;

var iTimeUniform, 
    pos_iTimeUniform, pos_iResolution, 
    vel_iTimeUniform, vel_iResolution, vel_iMouse, vel_keyPoints, vel_sk_partA, vel_sk_partB, 
    trail_opacity;

var program_postexUniform, program_veltexUniform,
    pos_program_postexUniform, pos_program_veltexUniform, 
    vel_program_postexUniform, vel_program_veltexUniform,
    trail_program_texUniform;

var positionBuffer;
var quad_positionBuffer;

var pos_textures = [], pos_framebuffers = [];

var vel_textures = [], vel_framebuffers = [];

var trail_textures = [], trail_framebuffers = [];

var opacity;

function setup(){
  //pixelDensity(displayDensity());
  webcam_canvas = createCanvas(displayWidth*0.15,displayHeight*0.15);
  webcam_canvas.style('position','fixed');
  webcam_canvas.style('top','0px');
  webcam_canvas.style('left','0px');
  shader_canvas = document.getElementById("c");
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();
  noStroke();

  gl = shader_canvas.getContext("webgl");
  if (!gl) {
    return;
  }

  //set up shader program
  {
    vertexShader = CreateShader(gl, gl.VERTEX_SHADER,vertexShaderText);
    fragmentShader = CreateShader(gl, gl.FRAGMENT_SHADER,fragmentShaderText);
    program = CreateProgram(gl,vertexShader,fragmentShader);
  }

  //shader file to draw a quad in vertexshader
  {
    quad_vertexShader = CreateShader(gl, gl.VERTEX_SHADER,quad_vertexShaderText);
  }

  //set up shader program used to update position storing textures
  {
    pos_fragmentShader = CreateShader(gl, gl.FRAGMENT_SHADER,pos_fragmentShaderText);
    pos_program = CreateProgram(gl,quad_vertexShader,pos_fragmentShader);
  }

  //set up shader program used to update velocity storing textures 
  {
    vel_fragmentShader = CreateShader(gl, gl.FRAGMENT_SHADER,vel_fragmentShaderText);
    vel_program = CreateProgram(gl,quad_vertexShader,vel_fragmentShader);
  }

  //shader program to draw trail textures
  {
    trail_fragmentShader = CreateShader(gl, gl.FRAGMENT_SHADER,trail_fragmentShaderText);
    trail_program = CreateProgram(gl,quad_vertexShader,trail_fragmentShader);
  }

  // look up where the vertex data needs to go.
  {
    positionLocation = gl.getAttribLocation(program, "a_position");
    pos_positionLocation = gl.getAttribLocation(pos_program, "a_position");
    vel_positionLocation = gl.getAttribLocation(vel_program, "a_position");
    trail_positionLocation = gl.getAttribLocation(trail_program, "a_position");
  }

  // lookup uniforms
  {
    iTimeUniform = gl.getUniformLocation(program, "iTime");
    pos_iTimeUniform = gl.getUniformLocation(pos_program, "iTime");
    pos_iResolution = gl.getUniformLocation(pos_program, "iResolution");
    vel_iTimeUniform = gl.getUniformLocation(vel_program, "iTime");
    vel_iResolution = gl.getUniformLocation(vel_program, "iResolution");
    vel_iMouse = gl.getUniformLocation(vel_program, "iMouse");
    vel_keyPoints = gl.getUniformLocation(vel_program, "keyPoints");
    vel_sk_partA = gl.getUniformLocation(vel_program, "sk_partA");
    vel_sk_partB = gl.getUniformLocation(vel_program, "sk_partB");
    trail_opacity = gl.getUniformLocation(trail_program, "opacity");
  }

  //lookup texture uniforms
  {
    program_postexUniform = gl.getUniformLocation(program, "pos_texture");
    program_veltexUniform = gl.getUniformLocation(program, "vel_texture");
    pos_program_postexUniform = gl.getUniformLocation(pos_program, "pos_texture");
    pos_program_veltexUniform = gl.getUniformLocation(pos_program, "vel_texture");
    vel_program_postexUniform = gl.getUniformLocation(vel_program, "pos_texture");
    vel_program_veltexUniform = gl.getUniformLocation(vel_program, "vel_texture");
    trail_program_texUniform = gl.getUniformLocation(trail_program, "trail_texture");
  }

  // Create a buffer for positions
  positionBuffer = gl.createBuffer();
  // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  // Put the positions in the buffer
  var grid = [];
  for(let i=0; i<PNUM; i++){
    for(let j=0; j<PNUM; j++){
      grid.push(i/PNUM);
      grid.push(j/PNUM);
    }
  }
  setGeometry(gl,grid);

  var quadpos = new Float32Array(
    [
      0, 0,
      1, 0,
      0, 1,
      0, 1,
      1, 0,
      1, 1
    ]);
  //Create a position buffer for a quad
  quad_positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,quad_positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, quadpos, gl.STATIC_DRAW);

  //make a texture for initial position coordinates
  var posTexture = gl.createTexture();
  var scale = floor(pow(255, 2) / max(gl.canvas.width,gl.canvas.height));
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, posTexture);
  {
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = PNUM;
    const height = PNUM;
    const border = 0;
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;
    // Set initial Texcoords.
    var pos = [];
    webglUtils.resizeCanvasToDisplaySize(gl.canvas);
    for(let i=0; i<PNUM*PNUM*4; i+=4){
      let x = random()*gl.canvas.width; //x -->r,g
      let y = random()*gl.canvas.height; //y -->b,a
      //encode picked values
      let posx = encode(x,scale);
      let posy = encode(y,scale);
      //x
      pos[i] = posx[0]; //r
      pos[i+1] = posx[1]; //g
      //y
      pos[i+2] = posy[0]; //b
      pos[i+3] = posy[1]; //a
    }
    console.log(pos.length);
    const data = new Uint8Array(pos);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border,
                  format, type, data);

    // set the filtering so we don't need mips and it's not filtered
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  {
    // Create and bind the framebuffer
    var posfb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, posfb);

    // attach the texture as the first color attachment
    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    const level = 0;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, posTexture, level);
  }

  

  //-------->part to setup two additional textures and framebuffer to pingpong for positions
  { 
    // create 2 textures and attach them to framebuffers.
    pos_textures = [];
    pos_framebuffers = [];
    for (var ii = 0; ii < 2; ii++) {
      var pos_texture = createAndSetupTexture(gl,0);
      pos_textures.push(pos_texture);
   
      // make the texture the same size as posTexture
      gl.texImage2D(
          gl.TEXTURE_2D, 0, gl.RGBA, PNUM, PNUM, 0,
          gl.RGBA, gl.UNSIGNED_BYTE, null);
   
      // Create a framebuffer
      var pos_fbo = gl.createFramebuffer();
      pos_framebuffers.push(pos_fbo);
      gl.bindFramebuffer(gl.FRAMEBUFFER, pos_fbo);
   
      // Attach a texture to it.
      gl.framebufferTexture2D(
          gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pos_texture, 0
      );
    }
  }

  //-------->part to setup two additional textures and framebuffer to pingpong for velocity
  {
    // create 2 textures and attach them to framebuffers.
    vel_textures = [];
    vel_framebuffers = [];
    for (var ii = 0; ii < 2; ii++) {
      var vel_texture = createAndSetupTexture(gl,2);
      vel_textures.push(vel_texture);
   
      // make the texture the same size as posTexture
      gl.texImage2D(
          gl.TEXTURE_2D, 0, gl.RGBA, PNUM, PNUM, 0,
          gl.RGBA, gl.UNSIGNED_BYTE, null);
   
      // Create a framebuffer
      var vel_fbo = gl.createFramebuffer();
      vel_framebuffers.push(vel_fbo);
      gl.bindFramebuffer(gl.FRAMEBUFFER, vel_fbo);
   
      // Attach a texture to it.
      gl.framebufferTexture2D(
          gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, vel_texture, 0
      );
    }
  }

  //-------->part to setup two additional textures and framebuffer to pingpong to draw trails
  {
    // create 2 textures and attach them to framebuffers.
    trail_textures = [];
    trail_framebuffers = [];
    for (var ii = 0; ii < 2; ii++) {
      var trail_texture = createAndSetupTexture(gl,1);
      trail_textures.push(trail_texture);
      webglUtils.resizeCanvasToDisplaySize(gl.canvas);
      // make the texture the same size as canvas
      gl.texImage2D(
          gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0,
          gl.RGBA, gl.UNSIGNED_BYTE, null);
   
      // Create a framebuffer
      var trail_fbo = gl.createFramebuffer();
      trail_framebuffers.push(trail_fbo);
      gl.bindFramebuffer(gl.FRAMEBUFFER, trail_fbo);
   
      // Attach a texture to it.
      gl.framebufferTexture2D(
          gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, trail_texture, 0
      );
    }
    
  }

  opacity = 0.96;

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, posTexture);

  let options = {
    imageScaleFactor: 0.3,
    inputImageResolution: 200,
    outputStride: 16,
    minConfidence: 0.5,
    maxPoseDetections: 2,
    scoreThreshold: 0.5,
    nmsRadius: 20,
    detectionType: 'single',
    multiplier: 0.50,
    quantBytes: 2
  };
  
  poseNet = ml5.poseNet(video, options, modelReady);

  poseNet.on('pose', getResults);
}

function getResults(results){
  poses = results;
}

function setFramebuffer(fbo) {
    // make this the framebuffer we are rendering to.
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
   
    // Tell webgl the viewport setting needed for framebuffer.
    gl.viewport(0, 0, PNUM, PNUM);
}

//set up textures
function createAndSetupTexture(gl,unit){
    var texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
   
    // Set up texture so we can render any size image and so we are
    // working with pixels.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
   
    return texture;
}

function modelReady(){
  console.log('model loaded.');
}

function draw(){
  //console.log(frameRate());
  //-------------draw web cam
  
  push();
  translate(width,0);
  scale(-1,1);
  image(video,0,0,width,height);
  drawKeypoints();    
  drawSkeleton();
  pop();
  
  
  //draw keypoints on webcam canvas
  if(poses.length>0){
    
    /*
    copy_keyPoints = [];
    for(let i=0; i<keyPoints.length; i++){
      copy_keyPoints.push(keyPoints[i].x*gl.canvas.width/width);
      copy_keyPoints.push(keyPoints[i].y*gl.canvas.height/height);
    }
    */
    skeleton_partA = [];
    skeleton_partB = [];
    copy_skeletons = [];
    //--->for the time being, lets use just one skeleton
  
    copy_skeletons = poses[0].skeleton;
    for(let j=0; j<copy_skeletons.length; j++){
      let partA = copy_skeletons[j][0];
      let partB = copy_skeletons[j][1];
      //----------------make partA and partB into a 1 dimensional array
      skeleton_partA.push(partA.position.x*gl.canvas.width/width);
      skeleton_partA.push(partA.position.y*gl.canvas.height/height);

      skeleton_partB.push(partB.position.x*gl.canvas.width/width);
      skeleton_partB.push(partB.position.y*gl.canvas.height/height);
    }
  }
  
  let time = millis()*0.001;
  //render trails to textures----------------------------
  drawTrails(gl,time);
  //render to textures-----------------------------------
  updateTextures(gl,time);
  //draw particles to canvas-----------------------------
  drawParticles(gl,time);
  
}

// A function to draw ellipses over the detected keypoints
function drawKeypoints()  {
  // Loop through all the poses detected
  for (let i = 0; i < poses.length; i++) {
    // For each pose detected, loop through all the keypoints
    let pose = poses[i].pose;
    for (let j = 0; j < pose.keypoints.length; j++) {
      // A keypoint is an object describing a body part (like rightArm or leftShoulder)
      let keypoint = pose.keypoints[j];
      keyPoints[j] = pose.keypoints[j].position;
      // Only draw an ellipse is the pose probability is bigger than 0.2
      if (keypoint.score > 0.2) {
        fill(255, 255, 0);
        noStroke();
        ellipse(keypoint.position.x, keypoint.position.y, 10, 10);
      }
    }
  }
}

// A function to draw the skeletons
function drawSkeleton() {
    // Loop through all the skeletons detected
    for (let i = 0; i < poses.length; i++) {
        let skeleton = poses[i].skeleton;
        // For every skeleton, loop through all body connections
        for (let j = 0; j < skeleton.length; j++) {
            let partA = skeleton[j][0];
            let partB = skeleton[j][1];
            stroke(255,255,0);
            strokeWeight(2);
            line(partA.position.x, partA.position.y, partB.position.x, partB.position.y);
        }
    }
}

//-------------------------------------------------------------
function CreateShader(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }

  console.log(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
}
function CreateProgram(gl, vertexShader, fragmentShader) {
  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  var success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}
//-------------------------------------------------------------
function setGeometry(gl,grid) {
  var positions = new Float32Array(grid);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
}
//-------------------------------------------------------------
function encode(value, scale) {
    var b = 255;
    value = value * scale + b * b / 2;
    var pair = [
        Math.floor((value % b) / b * 255),
        Math.floor(Math.floor(value / b) / b * 255)
    ];
    return pair;
}
//-------------------------------------------------------------
function drawToPosTexture(gl,time){
    gl.useProgram(pos_program);
    gl.enableVertexAttribArray(pos_positionLocation);
    // Bind the position buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, quad_positionBuffer);

    // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
      pos_positionLocation, size, type, normalize, stride, offset
    );

    gl.uniform1i(pos_program_postexUniform,0);
    gl.uniform1i(pos_program_veltexUniform,2);
    gl.uniform1f(pos_iTimeUniform,time);
    gl.uniform2fv(pos_iResolution,[gl.canvas.width,gl.canvas.height]);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function drawToVelTexture(gl,time){
    gl.useProgram(vel_program);
    gl.enableVertexAttribArray(vel_positionLocation);
    // Bind the position buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, quad_positionBuffer);

    // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
      vel_positionLocation, size, type, normalize, stride, offset
    );

    gl.uniform1i(vel_program_postexUniform,0);
    gl.uniform1i(vel_program_veltexUniform,2);
    gl.uniform1f(vel_iTimeUniform,time);
    gl.uniform2fv(vel_iResolution,[gl.canvas.width,gl.canvas.height]);
    gl.uniform2fv(vel_iMouse,[mouseX,mouseY]);
    /*
    if(copy_keyPoints.length>16){
      gl.uniform2fv(vel_keyPoints,new Float32Array(copy_keyPoints));
    }
    */
    //pass skeleton uniforms
    
    if(copy_skeletons.length>0){
      gl.uniform2fv(vel_sk_partA, new Float32Array(skeleton_partA));
      gl.uniform2fv(vel_sk_partB, new Float32Array(skeleton_partB));
    }
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

//make a function to update textures
function updateTextures(gl,time){
    gl.activeTexture(gl.TEXTURE2);
    for(let ii=0; ii<2; ii++){
      setFramebuffer(vel_framebuffers[ii % 2]);
      //------> down here we need code that renders to textures
      drawToVelTexture(gl,time);  
      //for the next draw, use the texture that we've rendered
      gl.bindTexture(gl.TEXTURE_2D, vel_textures[ii % 2]);
    }

    gl.activeTexture(gl.TEXTURE0);
    for(let ii=0; ii<2; ii++){
      setFramebuffer(pos_framebuffers[ii % 2]);
      //------> down here we need code that renders to textures
      drawToPosTexture(gl,time);  
      //for the next draw, use the texture that we've rendered
      gl.bindTexture(gl.TEXTURE_2D, pos_textures[ii % 2]);
    }    
}

//A function that draws to screen textures
function drawToScreenTexture(gl,time){
    gl.useProgram(program);
    // Turn on the position attribute
    gl.enableVertexAttribArray(positionLocation);

    // Bind the position buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
      positionLocation, size, type, normalize, stride, offset
    );

    gl.uniform1i(program_postexUniform,0);
    //gl.uniform1i(program_veltexUniform,2);

    gl.uniform1f(iTimeUniform,time);

    gl.drawArrays(gl.POINTS, 0, PNUM*PNUM);
}

//A function to draw trails
function drawTrails(gl,time){
    for(let ii=0; ii<2; ii++){
      // make this the framebuffer we are rendering to.
      gl.bindFramebuffer(gl.FRAMEBUFFER, trail_framebuffers[ii % 2]);  
      // Tell webgl the viewport setting needed for framebuffer.
      webglUtils.resizeCanvasToDisplaySize(gl.canvas);
      // Tell WebGL how to convert from clip space to pixels
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      //------> down here we need code that renders to textures
      drawScreen(gl);
      drawToScreenTexture(gl,time);
      //for the next draw, use the texture that we've rendered
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, trail_textures[ii % 2]);
    }
    
    webglUtils.resizeCanvasToDisplaySize(gl.canvas);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); 
    drawScreen(gl);
}

//function to draw screen
function drawScreen(gl){
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.useProgram(trail_program);
    gl.enableVertexAttribArray(trail_positionLocation);
    // Bind the position buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, quad_positionBuffer);

    // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
      trail_positionLocation, size, type, normalize, stride, offset
    );

    gl.uniform1i(trail_program_texUniform,1);
    gl.uniform1f(trail_opacity,opacity);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function drawParticles(gl,time){
    webglUtils.resizeCanvasToDisplaySize(gl.canvas);
    // render to the canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.useProgram(program);

    // Turn on the position attribute
    gl.enableVertexAttribArray(positionLocation);

    // Bind the position buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
      positionLocation, size, type, normalize, stride, offset
    );

    gl.uniform1i(program_postexUniform,0);
    gl.uniform1i(program_veltexUniform,2);
    gl.uniform1f(iTimeUniform,time);

    gl.drawArrays(gl.POINTS, 0, PNUM*PNUM);
}