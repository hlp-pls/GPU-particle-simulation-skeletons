var vertexShaderText = `

precision mediump float;

uniform sampler2D pos_texture;

attribute vec4 a_position;
varying vec2 v_position;

void main() {
	v_position = a_position.xy;
	vec4 pos = a_position;
	vec2 samplePos = a_position.xy;
	vec4 color = texture2D(pos_texture,samplePos);
	vec2 p = vec2(color.r / 255.0 + color.b, color.g / 255.0 + color.a);
  	gl_Position = vec4(p*2.-1.,0,1.0);
  	gl_PointSize = 1.;
}

`;