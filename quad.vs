var quad_vertexShaderText = `

precision mediump float;

attribute vec2 a_position;
varying vec2 v_position;
void main() {
  	
  	v_position = a_position;

  	gl_Position = vec4(2.0 * a_position -1.0,0,1);

}

`;