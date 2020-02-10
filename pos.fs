var pos_fragmentShaderText = `

precision highp float;

uniform sampler2D pos_texture;
uniform sampler2D vel_texture;
uniform vec2 iResolution;
varying vec2 v_position;

float rand(vec2 co) {
    float t = dot(vec2(12.9898, 78.233), co);
    return fract(sin(t) * (4375.85453 + t));
}

vec2 edges(vec2 pos){
	if(pos.x>=1.){
		pos.x -= 1.;
	}else if(pos.x<=0.){
		pos.x += 1.;
	}

	if(pos.y>=1.){
		pos.y -= 1.;
	}else if(pos.y<=0.){
		pos.y += 1.;
	}

	if(rand(pos)>0.996){
		pos.x = rand(vec2(pos.x,0.));
		pos.y = rand(vec2(0.,pos.y));
	}

	return pos;
}

void main() {
	vec4 posColor = texture2D(pos_texture,v_position);
	vec2 pos = vec2(posColor.r / 255.0 + posColor.b, posColor.g / 255.0 + posColor.a);
	vec4 velColor = texture2D(vel_texture,v_position);
	vec2 vel = vec2(velColor.r / 255.0 + velColor.b, velColor.g / 255.0 + velColor.a);
	pos = pos + vel;
	pos = edges(pos);
  	gl_FragColor = vec4(fract(pos * 255.0),floor(pos * 255.0) / 255.0);
}

`;