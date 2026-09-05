/** Review-only chassis. The shared controls and resource glass are drawn over it. */
export function drawThornbound(c: CanvasRenderingContext2D, time: number): void {
  const t = Number.isFinite(time) ? time : 0;
  const path = (data: string, fill: string | CanvasGradient, stroke = '', width = 1) => {
    const p = new Path2D(data);
    c.fillStyle = fill; c.fill(p);
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(p); }
  };
  const line = (data: string, color: string, width = 1) => {
    c.strokeStyle = color; c.lineWidth = width; c.stroke(new Path2D(data));
  };
  const wood = c.createLinearGradient(0, 25, 0, 143);
  wood.addColorStop(0, '#41473a'); wood.addColorStop(.25, '#252f29');
  wood.addColorStop(.55, '#151e1c'); wood.addColorStop(.82, '#232920'); wood.addColorStop(1, '#0b1413');
  const bronze = c.createLinearGradient(0, 33, 0, 126);
  bronze.addColorStop(0, '#a49370'); bronze.addColorStop(.2, '#635f49');
  bronze.addColorStop(.45, '#394e43'); bronze.addColorStop(.67, '#76664a'); bronze.addColorStop(1, '#2b3028');

  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  // Glass always owns these circles. Even soft ornamental light stays outside.
  const boundary = new Path2D(); boundary.rect(0, 0, 520, 150);
  boundary.moveTo(97.7, 79); boundary.arc(61, 79, 36.7, 0, Math.PI * 2);
  boundary.moveTo(495.7, 79); boundary.arc(459, 79, 36.7, 0, Math.PI * 2);
  c.clip(boundary, 'evenodd');

  const spine = new Path2D(`M99 73 C113 63 127 65 140 61
    C152 57 163 58 176 52 C178 42 179 32 189 25
    C205 26 218 29 237 26 C248 25 251 23 260 22
    C269 23 272 25 283 26 C302 29 315 26 331 25
    C341 32 342 42 344 52 C357 58 368 57 380 61
    C393 65 407 63 421 73 L418 105
    C408 114 402 128 389 133 C372 138 351 135 332 136
    C307 140 286 134 260 140 C234 134 213 140 188 136
    C169 135 148 138 131 133 C118 128 112 114 102 105 Z`);
  c.save(); c.translate(0, 3); c.fillStyle = '#020807b8'; c.fill(spine); c.restore();
  c.fillStyle = wood; c.fill(spine); c.strokeStyle = '#060d0b'; c.lineWidth = 4; c.stroke(spine);
  c.strokeStyle = '#69705a55'; c.lineWidth = 1; c.stroke(spine);

  // Long fibres, not a tiled wood texture: the growth follows the shoulders.
  c.save(); c.clip(spine);
  for (let i = 0; i < 11; i++) {
    const y = 66 + i * 6.2;
    line(`M105 ${y + 4} C161 ${y - 11} 193 ${y + 6} 257 ${y - 2}
      C303 ${y - 9} 364 ${y + 8} 418 ${y - 2}`, i % 3 ? '#57644e15' : '#0008054a', i % 3 ? .7 : 1.2);
  }
  line('M166 61 C184 58 190 54 192 39 C205 36 223 35 244 31', '#9a9f7940');
  line('M354 61 C336 58 330 54 328 39 C315 36 297 35 276 31', '#92957230');
  c.restore();

  // A thin bronze bridge cradles the shortcut rail without making a separate box.
  path(`M175 58 C181 52 181 34 187 28 C205 29 220 31 239 28
    C250 27 255 24 260 24 C265 24 270 27 281 28 C300 31 315 29 333 28
    C339 34 339 52 345 58 L337 58 C334 49 335 36 330 33
    C302 36 287 31 260 30 C233 31 218 36 190 33 C185 36 186 49 183 58 Z`, bronze, '#111a13', .8);
  line('M189 29 C214 32 234 28 260 25 C286 28 306 32 331 29', '#beaa7d77', .75);
  line('M192 56 C218 61 241 57 260 59 C279 57 302 61 328 56', '#89947a66');
  line('M203 59 C223 65 241 60 260 62 C279 60 297 65 317 59', '#020b0780', 1.7);

  // Root tendons turn up at the end of each skill bank; wells cover their center.
  path('M109 87 C119 81 123 73 137 69 C167 64 189 66 212 65 C243 62 250 64 260 65 C270 64 277 62 308 65 C331 66 353 64 383 69 C397 73 401 81 411 87 L405 100 C394 86 393 81 382 79 C342 73 300 77 260 73 C220 77 178 73 138 79 C127 81 126 86 115 100 Z', '#18241e', '#070e0a', 1.5);
  line('M118 86 C132 68 162 71 187 69 M333 69 C358 71 388 68 402 86', '#8e95715e', 1.15);
  path('M115 114 C127 126 132 127 149 128 C181 130 225 127 260 131 C295 127 339 130 371 128 C388 127 393 126 405 114 L398 129 C377 141 352 134 329 139 C308 136 279 139 260 144 C241 139 212 136 191 139 C168 134 143 141 122 129 Z', wood, '#050d09', 1.6);
  line('M126 130 C154 137 171 130 195 135 C221 132 241 137 260 140 C279 137 299 132 325 135 C349 130 366 137 394 130', '#88927555', .85);
  line('M142 133 C172 141 188 137 211 141 M309 141 C332 137 348 141 378 133', '#354c3c', .9);

  const shoulder = (right: boolean) => {
    c.save(); if (right) { c.translate(520, 0); c.scale(-1, 1); }
    // The outer bough is broken and tapered. Its open forks are the silhouette.
    path(`M29 108 C17 106 12 95 13 80 C15 67 17 58 14 45
      C12 32 8 25 5 16 C15 23 18 32 20 42
      C22 35 22 29 20 23 C28 33 24 46 27 51
      C29 46 31 42 34 40 C29 52 22 62 22 76
      C20 91 28 99 38 104 L35 115
      C26 118 19 122 16 132 C14 121 19 112 29 108 Z`, wood, '#050d09', 1.7);
    line('M7 20 C18 39 16 50 20 56 C22 74 12 91 25 104', '#a1a48752', 1.05);
    line('M16 43 C22 56 18 63 18 75 M18 88 C21 103 29 108 25 113', '#080f0a', 1.6);
    line('M17 126 C23 113 28 115 32 111', '#737e6055', .8);

    // Inner antler sweeps above the socket, then rejoins the skill-bank root.
    path(`M85 112 C99 106 106 95 107 79 C106 67 103 58 104 47
      C105 35 107 26 115 17 C110 32 112 39 113 44
      C119 36 122 31 124 23 C127 34 122 45 119 51
      C125 49 131 42 134 33 C136 46 126 56 121 61
      C117 69 117 78 119 84 C123 79 128 78 133 78
      C124 87 121 100 112 109 C110 119 116 126 123 130
      C111 130 105 123 101 118 C97 123 94 130 89 135
      C92 124 90 119 85 112 Z`, wood, '#050d09', 1.8);
    line('M113 23 C104 45 109 55 112 64 C113 79 114 96 102 111', '#a9ad875e', 1.15);
    line('M123 29 C125 41 114 51 114 57 M132 41 C130 51 119 55 116 65', '#7b89684d', .85);
    line('M113 67 C119 91 104 102 104 116 C108 121 111 126 118 127', '#020b08', 1.5);
    line('M108 98 C107 108 99 111 96 120', '#73896b55');

    // A dark, irregular root cup and fine interrupted metal lips frame the glass.
    c.beginPath(); c.arc(61, 79, 39.6, 0, Math.PI * 2);
    c.strokeStyle = '#040b09'; c.lineWidth = 8; c.stroke();
    c.beginPath(); c.arc(61, 79, 40.1, .06, Math.PI * 1.96);
    c.strokeStyle = bronze; c.lineWidth = 3.8; c.stroke();
    c.beginPath(); c.arc(61, 79, 37.4, .17, Math.PI * 1.9);
    c.strokeStyle = '#bcb08a80'; c.lineWidth = .7; c.stroke();
    c.beginPath(); c.arc(61, 79, 42.4, 3.48, 5.84);
    c.strokeStyle = '#82907777'; c.lineWidth = 1; c.stroke();
    c.beginPath(); c.arc(61, 79, 42, .1, 2.81);
    c.strokeStyle = '#4c604746'; c.lineWidth = 1.4; c.stroke();

    // Bronze bands bind the living wood: short clasps, not a complete gold bezel.
    for (const a of [-2.1, -.79, 1.22, 2.85]) {
      c.save(); c.translate(61, 79); c.rotate(a);
      path('M37 -5 C40 -5 44 -4 46 -2 L46 2 C43 4 40 5 37 5 L37 2 C40 2 41 1 42 0 C41 -1 40 -2 37 -2 Z', bronze, '#07100a', .8);
      line('M38 -4 C41 -4 43 -3 44 -2', '#d0b58488', .65);
      line('M39 3 L43 2', '#91a07a44', .6);
      c.fillStyle = '#1a271e'; c.beginPath(); c.arc(43, 0, 1.05, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    // Root veins and lichen stay sparse so the ornament reads at game scale.
    line('M29 58 C33 48 42 41 51 40 M74 40 C84 43 91 49 97 59', '#9ca27b48', .8);
    line('M30 96 C38 109 43 110 51 116 M75 116 C84 112 90 106 94 101', '#506e5055', 1.3);
    path('M105 70 C111 72 113 77 112 84 C108 81 107 77 105 70 Z', '#48684b', '#142e22', .7);
    line('M108 74 L111 81', '#adc1916b', .65);
    if (right) {
      line('M15 74 C8 72 7 68 8 62 M10 68 L5 65', '#394a37', 1.5);
      path('M119 113 C126 113 130 119 129 124 C123 122 121 118 119 113 Z', '#344f3c');
      line('M123 116 L127 121', '#71846b66', .75);
    } else {
      path('M25 48 C23 43 24 39 27 37 C29 41 28 46 25 48 Z', '#506c46');
      line('M24 47 L27 41', '#91a17277', .7);
      line('M121 86 C125 87 129 88 134 84', '#6a745453', .85);
    }
    c.restore();
  };
  shoulder(false); shoulder(true);

  // A split seed clasp identifies this direction without a crest or a label.
  path('M247 135 C251 136 255 135 260 133 C265 135 269 136 273 135 C271 141 266 146 260 148 C254 146 249 141 247 135 Z', bronze, '#08120c', 1);
  line('M250 137 C254 141 257 143 260 146 C263 143 266 141 270 137', '#b3ad8270', .7);
  path('M260 136 C264 139 263 142 260 145 C257 142 256 139 260 136 Z', '#456e55', '#142d20', .7);
  line('M260 138 L260 142', '#b5d1a3a0', .85);

  // Small sap catches move in luminance only; the carved chassis stays still.
  for (const [x, y, phase] of [[109, 80, 0], [411, 80, 2.5], [260, 140, 1.2]]) {
    const alpha = .11 + (Math.sin(t * .8 + phase) * .5 + .5) * .055;
    const sap = c.createRadialGradient(x, y, .1, x, y, 5);
    sap.addColorStop(0, `rgba(169,209,143,${alpha})`); sap.addColorStop(1, 'rgba(73,113,72,0)');
    c.fillStyle = sap; c.fillRect(x - 5, y - 5, 10, 10);
  }
  c.restore();
}
