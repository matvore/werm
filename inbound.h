/* Copyright 2023 Google LLC
 *
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file or at
 * https://developers.google.com/open-source/licenses/bsd */

#include "outstreams.h"

/* Forwards stdin, interpreted as websocket frames, to the given buffer as
   unframed data, otherwise uninterpreted. Will process at least one frame,
   maybe more. */
void fwrd_inbound_frames(Fdbuf dest);
