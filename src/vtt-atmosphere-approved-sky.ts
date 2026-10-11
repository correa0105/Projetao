// Keep the approved sky shader byte-for-byte: changing neighboring shader branches
// changes native GPU arithmetic, even when this mode's formula stays the same.
export const approvedSkyFragment = `
precision highp float;
varying vec2 uv;
uniform vec4 view;
uniform vec2 wind;
uniform float time,density,mode,vortexSize;
uniform vec3 pigment;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+vec2(3.7,8.9);a*=.5;}return n;}
void main(){
 vec2 world=mix(view.xy,view.zw,vec2(uv.x,1.-uv.y));
 vec2 p=world/460.;
 vec2 drift=wind*time*.055;
 if(mode>1.5&&mode<2.5){vec2 d=(uv-vec2(.52,.5))*vec2(1.35,1.);float r=length(d),a=atan(d.y,d.x)+time*.38-r*10.;p=vec2(cos(a),sin(a))*r*4.+vec2(time*.02);}
 vec2 warp=vec2(fbm(p+drift+time*.024),fbm(p-drift*.3+vec2(5.,9.)-time*.018));
 float far=fbm(p*.85+drift*.45+warp*2.4),near=fbm(p*2.4+drift+warp*1.8);
 float field=smoothstep(.18,.74,far*.6+near*.4);
 float opacity=(.13+field*.8)*density;
 vec3 color=pigment*(.77+near*.44);
 float rim=clamp((fbm(p*.85+vec2(.12,-.07)+drift*.45+warp*2.4)-far)*4.,0.,.18);
 color+=vec3(rim*.75,rim*.85,rim);
 if(mode>.5&&mode<1.5){opacity=smoothstep(.32,.70,far*.8+near*.2)*density;color=pigment*(.5+near*.3);}
 if(mode>1.5&&mode<2.5){vec2 d=(uv-vec2(.52,.5))*vec2(1.35,1.);float r=length(d),a=atan(d.y,d.x);float spiral=sin(a*3.+r*22.-time*.7+near*5.)*.5+.5;opacity*=smoothstep(.02,.10,r)*(1.-smoothstep(vortexSize*.55,vortexSize,r))*(.55+spiral*.7);}
 if(mode>2.5){float wave=uv.y-.42-sin(uv.x*4.+time*.11)*.12-fbm(vec2(uv.x*3.,time*.035))*.13;float curtain=exp(-abs(wave)*11.)*(.3+.7*pow(sin(uv.x*65.+time*.5+near*8.)*.5+.5,2.));opacity=curtain*density;color=mix(vec3(.16,.94,.65),vec3(.65,.28,.95),sin(uv.x*7.+time*.13)*.5+.5);}
 opacity=clamp(opacity,0.,.82);
 gl_FragColor=vec4(color*opacity,opacity);
}`;
