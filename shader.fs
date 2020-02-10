var fragmentShaderText = `

precision mediump float;

uniform sampler2D vel_texture;

varying vec2 v_position;

void main() {
	vec4 color = texture2D(vel_texture,v_position);
	vec2 vel = vec2(color.r / 255.0 + color.b, color.g / 255.0 + color.a);
	float n = length(vel)*1000.;

	vec3 col = vec3(0);
	col += sin(n*vec3(1.,0.,0.)*1.0)*0.5+0.5;
	col += sin(n*vec3(0.,1.,0.)*5.0)*0.5+0.5;
	col += sin(n*vec3(0.,0.,1.)*10.0)*0.5+0.5;
	//col = vec3(0);
	col = clamp(normalize(col), 0.0, 1.0);

  	gl_FragColor = vec4(col,1.0);
}

`;