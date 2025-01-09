/* Copyright 2023 Google LLC
 *
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file or at
 * https://developers.google.com/open-source/licenses/bsd */

#include "inbound.h"
#include <arpa/inet.h>
#include <string.h>
#include <stdint.h>
#include <stdlib.h>
#include <errno.h>
#include <stdio.h>

static unsigned char pongmsg[2] = {0x8a, 0x00};

static unsigned char buf[512], mask[4];
static unsigned bfi, bfsz;
static uint64_t datalen;
static int unmaskof, state, datpart;

static int mkeaval(int c)
{
	ssize_t redn;
	unsigned bleft = bfsz - bfi;

	if (c > sizeof(buf)) abort();

	if (bleft >= c) return 1;

	bfsz = bleft;
	memmove(buf, buf+bfi, bfsz);
	bfi = 0;

	do {
		redn=read(0, buf + bfsz, sizeof(buf) - bfsz);
		if (0 > redn) {
			if (	errno == EAGAIN
			||	errno == EINTR
			||	errno == EWOULDBLOCK
			) return 0;

			perror("read stdin mid-frame");
			abort();
		}
		if (!redn) abort();
		bfsz += redn;
	}
	while (bfsz < c);

	return 1;
}

static unsigned char *forceinby(int c)
{
	if (!mkeaval(c)) return 0;
	bfi += c;
	return buf + bfi - c;
}

/* Expects stdin to be non-blocking, and supports returning and continuing in
the middle of a frame. This is important since the client may stop writing in
the middle of a frame, and we need terminal output to continue to be sent to the
client until attach terminates. Otherwise, the terminal may block its output
indefinitely while attach is waiting on a read from stdin. */
void fwrd_inbound_frames(Fdbuf dest)
{
	uint32_t datalen32;
	uint16_t datalen16;
	int unmaski;
	unsigned char *bfc;

	if (!state && bfi != bfsz) abort();

	for (;;) switch (state) {
	case 'P':
		/* pinged, so respond with pong */
		full_write(&(struct wrides){1}, pongmsg, sizeof(pongmsg));

	case 0: state = 0; if ( !(bfc = forceinby(1)) ) return;

		/* We don't care whether continuation or FIN */
		*bfc &= 0x7f;

		switch (*bfc) {
		case 0: case 1: case 2:	state = 'L';	continue;
		case 9:			state = 'P';	continue;

		/* close, pong, or reserved code */
		default: 		state = 0;	continue;
		}

		/* Payload len for data frame */
	case 'L': state='L'; if ( !(bfc = forceinby(1)) ) return;

		datalen = *bfc & 0x7f;

		/* Should always send mask */
		if (!(*bfc & 0x80)) abort();

		/* Client should not send large frames that require
		 * extended payload length. */
		if (datalen == 126) {
	case 'X': state='X'; if ( !(bfc = forceinby(2)) ) return;

			memcpy(&datalen16, bfc, 2);

			datalen = ntohs(datalen16);
		}
		else if (datalen == 127) {
	case 'Y': state='Y'; if ( !(bfc = forceinby(8)) ) return;

			memcpy(&datalen32, bfc, 4);
			datalen = ntohl(datalen32);
			datalen <<= 32;

			memcpy(&datalen32, bfc + 4, 4);
			datalen |= ntohl(datalen32);
		}

	case 'M': state='M'; if ( !(bfc = forceinby(4)) ) return;

		/* Read the mask */
		memcpy(mask, bfc, 4);

		unmaskof = 0;
		while (datalen) {
			datpart = sizeof(buf);
			if (datpart > datalen) datpart = datalen;

	case 'D': state='D'; if ( !(bfc = forceinby(datpart)) ) return;

			for (unmaski = 0; unmaski < datpart; unmaski++) {
				bfc[unmaski] ^= mask[unmaskof++];
				unmaskof &= 3;
			}

			fdb_apnd(dest, bfc, datpart);

			datalen -= datpart;
		}

		state = 0;
	}
}
