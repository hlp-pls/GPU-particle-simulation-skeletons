var trail_fragmentShaderText = `

precision mediump float;

uniform sampler2D trail_texture;
uniform float opacity;

varying vec2 v_position;

void main() {
  	vec4 color = texture2D(trail_texture, v_position);
    gl_FragColor = vec4(floor(255.0 * color * opacity) / 255.0);	
}

`;