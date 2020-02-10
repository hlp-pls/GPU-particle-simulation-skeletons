var vel_fragmentShaderText = `

precision highp float;

uniform sampler2D pos_texture;
uniform sampler2D vel_texture;
uniform float iTime;
uniform vec2 iResolution;
uniform vec2 iMouse;
//uniform vec2 keyPoints[17];
uniform vec2 sk_partA[17];
uniform vec2 sk_partB[17];

varying vec2 v_position;

#define PI 3.14159265359
#define KEYNUM 17
#define SKNUM 17

float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}
float noise(vec3 p){vec3 a = floor(p);vec3 d = p - a;d = d * d * (3.0 - 2.0 * d);vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);vec4 k1 = perm(b.xyxy);vec4 k2 = perm(k1.xyxy + b.zzww);vec4 c = k2 + a.zzzz;vec4 k3 = perm(c);vec4 k4 = perm(c + 1.0);vec4 o1 = fract(k3 * (1.0 / 41.0));vec4 o2 = fract(k4 * (1.0 / 41.0));vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);return o4.y * d.y + o4.x * (1.0 - d.y);}
#define numOctaves 4
float fbm(vec2 x){float G = exp2(-1.);float f = 1.0;float a = 1.0;float t = 0.0;for( int i=0; i<numOctaves; i++ ){t += a*noise(vec3(f*x,iTime*0.001));f *= 2.0;a *= G;}return t;}
float pattern(vec2 p ){vec2 q = vec2( fbm( p + vec2(0.0,0.0) ),fbm( p + vec2(5.2,1.3) ) );vec2 r = vec2( fbm( p + 4.0*q + vec2(1.7,9.2) ),fbm( p + 4.0*q + vec2(8.3,2.8) ) );return fbm( p + 4.0*r );}
mat2 Rot(float a) {float s = sin(a);float c = cos(a);return mat2(c, s, -s, c);}

float rand(vec2 co) {
    float t = dot(vec2(12.9898, 78.233), co);
    return fract(sin(t) * (4375.85453 + t));
}

vec2 updateVel(vec2 p, vec2 v){	
	p *= iResolution.xy / iResolution.y;

	float magnitude = 0.0001;

	float nval = pattern(vec2(p*0.4));
	float angle = nval*PI*2.;
	
	vec2 acceleration = vec2(sin(angle),cos(angle))*magnitude;
	//acceleration = vec2(0);
	//--------acc for keypoints
	/*
		for(int i=0; i<KEYNUM; i++){
			vec2 k = keyPoints[i]/iResolution.xy;
			k.x = k.x * -1. + 1.;
			k.x *= iResolution.x / iResolution.y;
			k.y = k.y * -1. + 1.;
			
			vec2 kf = (magnitude/float(KEYNUM))*normalize(k-p)/(length(k-p));
			kf = Rot(PI/2.)*kf;
			kf += (magnitude/float(KEYNUM))*normalize(k-p)/(length(k-p));
			kf *= 1.8;
			kf *= iResolution.xy / iResolution.y;
			if(length(p-k)<0.1){
				acceleration += kf;
			}
		}
	*/
	//--------acc for skeletons
	for(int i=0; i<SKNUM; i++){
		vec2 A = sk_partA[i] / iResolution.xy;
		vec2 B = sk_partB[i] / iResolution.xy;
		if(A.x>=1.||A.x<=0.||A.y>=1.||A.y<=0.||B.x>=1.||B.x<=0.||B.y>=1.||B.y<=0.){
			//break;
		}else{
			//change the coordinates to fit the screen
			A = (A*-1.+1.) * iResolution.xy / iResolution.y;
			B = (B*-1.+1.) * iResolution.xy / iResolution.y;
			vec2 ab = B-A;
			vec2 ap = p-A;
			float t = dot(ab,ap)/dot(ab,ab);
			t = clamp(t, 0., 1.);

			vec2 c = A + t * ab;
			float d = length(p-c);
			vec2 n = normalize(p-c);

			vec2 f = n/d;
			//rotational vector
			vec2 rf = Rot(PI/2.)*f;

			if(d<0.1){
				acceleration += (0.5*magnitude/float(SKNUM))*(f);
			}
		}
	}

	acceleration *= iResolution.xy / iResolution.y;

	vec2 newVel = v + acceleration;
	/*
	float range = 0.0001;
	float sinacc = length(acceleration)/acceleration.y;
	float cosacc = length(acceleration)/acceleration.x;
	newVel.x = clamp(newVel.x,0.,cosacc*range*iResolution.x / iResolution.y);
	newVel.y = clamp(newVel.y,0.,sinacc*range);
	*/
	newVel = normalize(newVel)*0.0007;
	return newVel;
}

void main() {
	vec4 posColor = texture2D(pos_texture,v_position);
	vec2 pos = vec2(posColor.r / 255.0 + posColor.b, posColor.g / 255.0 + posColor.a);
	vec4 velColor = texture2D(vel_texture,v_position);
	vec2 vel = vec2(velColor.r / 255.0 + velColor.b, velColor.g / 255.0 + velColor.a);
	vel = vel*2.-1.;
	vel = updateVel(pos,vel);
	vel = vel*0.5+0.5;
  	gl_FragColor = vec4(fract(vel * 255.0),floor(vel * 255.0) / 255.0);
}

`;