/* Copyright 2025 Google LLC
 *
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file or at
 * https://developers.google.com/open-source/licenses/bsd */

function init_shaders(gl)
{
	var vshdr = gl.createShader(gl.VERTEX_SHADER);
	var fshdr = gl.createShader(gl.FRAGMENT_SHADER);
	var shpr = gl.createProgram();
	var symbs = {a: {}, u: {}};

	gl.shaderSource(vshdr,
`#version 300 es
precision mediump float;

in	vec2	clicoor;
uniform	vec2	cli0;
uniform	vec2	cliclsz;
uniform vec2	celpxsz;
uniform	vec2	tex0;
uniform float	texpxsz;
out 	vec2	texcoor;

void main()
{
	vec2	celloff = clicoor * celpxsz;

	gl_Position	= vec4(	celloff * cliclsz + cli0, 0, 1);

	texcoor		=	celloff * texpxsz + tex0 * texpxsz;
}
`);
	gl.shaderSource(fshdr,
`#version 300 es
precision mediump float;

uniform	int	glymode;
uniform	int	mask;
uniform	float	maxbri;
uniform	float	bridof;
uniform	vec3	bgcolor;
uniform	vec3	fgcolor;
uniform	vec2	tex0;
in	vec2	texcoor;
out	vec4	fragColor;
uniform	vec2	celpxsz;
uniform	float	texpxsz;

uniform	lowp	usampler2D tex;

int texp(int xof)
{
	float xco = texcoor.x + float(xof) * texpxsz;
	int pd;

	pd = xco<tex0.x*texpxsz	? 0
				: int(texture(tex, vec2(xco, texcoor.y)).r);

	return mask & pd;
}

int hshp(int xof)
{
	int hx, hy, bs, bc = 0;

	hx = int(texcoor.x / texpxsz) + xof;
	hy = int(texcoor.y / texpxsz);

	if (hx < 0)	return 0;
	if (hx == 0)	return hy & 1;
	if (hy == 0)	return hx & 1;
	if (hx >= int(celpxsz.x) - 1)	return ~hy & 1;
	if (hy >= int(celpxsz.y) - 1)	return ~hx & 1;
	hx >>= 1;
	hy >>= 1;
	bs = mask * 97 ^ hx * 2957 ^ hy * 4129;
	bs &= 0x7f;
	while (bs != 0) {
		bs &= (bs - 1);
		bc++;
	}
	return (bc >= 4) ? 1 : 0;
}

int renp(int xof) { return mask >= 0 ? texp(xof) : hshp(xof); }

void main()
{
	vec3 acfg, acbg, fragrgb;
	int faint = 0;
	vec2 texoff = texcoor / texpxsz - tex0;
	vec2 atten = mod(texoff, 1.0);

	if (0 != (glymode & ATTR_REVERSE)) {
		acfg = bgcolor;
		acbg = fgcolor;
	}
	else {
		acbg = bgcolor;
		acfg = fgcolor;
	}

	if (	0 != (glymode&ATTR_UNDERLINE)
	&&	texcoor.y/texpxsz - tex0.y >= celpxsz.y - 1.05
	) {
		fragrgb = acfg;
		if (0 == renp(0)) faint = 1;
	} else if (0 != renp(0)) {
		fragrgb = acfg;
	} else if (0 != (ATTR_BOLD & glymode) && 0 != renp(-1)) {
		fragrgb = acfg * 0.8 + acbg * 0.2;
	} else {
		fragrgb = acbg;
	}

	faint |= glymode & ATTR_FAINT;
	if (0 != faint) fragrgb *= 0.8;
	fragrgb *= maxbri - bridof*sqrt(dot(atten, atten));
	fragColor = vec4(min(fragrgb, 1.0), 1.0);
}
`);
	gl.compileShader(vshdr);
	gl.compileShader(fshdr);
	console.log(gl.getShaderInfoLog(vshdr)	|| "vert shader OK");
	console.log(gl.getShaderInfoLog(fshdr)	|| "frag shader OK");

	gl.attachShader(shpr, vshdr);
	gl.attachShader(shpr, fshdr);
	gl.linkProgram(shpr);
	console.log(gl.getProgramInfoLog(shpr)	|| "shader link OK");

	gl.useProgram(shpr);

	symbs.a.clicoor = gl.getAttribLocation(shpr, "clicoor");

	function unif(un) { symbs.u[un] = gl.getUniformLocation(shpr, un) }
	unif("bgcolor");
	unif("fgcolor");
	unif("glymode");
	unif("texpxsz");
	unif("cliclsz");
	unif("celpxsz");
	unif("tex0");
	unif("cli0");
	unif("mask");
	unif("maxbri");
	unif("bridof");

	return symbs;
}
