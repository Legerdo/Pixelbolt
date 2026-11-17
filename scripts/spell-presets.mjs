// Reviewed pixelforge-fx effects built from shape layers: twelve spells (the fireball a seamless loop in eight directions)
// and a set of cel-shaded water effects, written to examples/<name>.fx.json by scripts/generate-examples.js. Their
// compiled pixels are pinned in test/shapes.test.js.
export const spellPresets = {
  'slash-hit': {
    "format": "pixelforge-fx",
    "version": 1,
    "name": "slash-hit",
    "width": 80,
    "height": 64,
    "palette": {
      "k": "#16182e",
      "b": "#2f4fb3",
      "c": "#4fa3f7",
      "p": "#aee6ff",
      "W": "#ffffff",
      "y": "#ffe066",
      "o": "#ff9a3c"
    },
    "symbols": { "spark": ["W"], "spark-y": ["y"], "spark-o": ["o"] },
    "effects": {
      "slash-hit": {
        "frames": 9,
        "duration": { "from": 40, "to": 90, "ease": "in" },
        "seed": 3,
        "looks": {
          "steel": { "colors": ["b", "c", "p", "W"], "thresholds": [0.15, 0.4, 0.65, 0.88] },
          "flash": { "colors": ["o", "y", "W"], "thresholds": [0.2, 0.5, 0.8] }
        },
        "cleanup": { "corners": true, "strays": true },
        "layers": [
          {
            "kind": "slash",
            "look": "steel",
            "at": [38, 42],
            "frames": [0, 8],
            "radius": 32,
            "width": [15, 11],
            "arc": [195, 345],
            "squash": [1, 0.68],
            "tilt": -16,
            "reveal": 0.3
          },
          {
            "kind": "star",
            "look": "flash",
            "at": [64, 27],
            "frames": [1, 6],
            "radius": [14, 5],
            "width": [3, 1],
            "points": 8,
            "ratio": 0.5,
            "power": [1.3, 0.6],
            "cue": "hit"
          },
          {
            "kind": "ring",
            "look": "flash",
            "at": [64, 27],
            "frames": [2, 7],
            "radius": [4, 13],
            "width": [4, 3, 2],
            "noise": 0.85,
            "scale": 4,
            "power": [1.2, 0.9, 0.3]
          }
        ],
        "emitters": [
          {
            "at": [64, 27],
            "burst": 12,
            "start": 2,
            "angle": [150, 390],
            "speed": [1.5, 2.9],
            "gravity": [0, 0.25],
            "drag": 0.05,
            "life": [4, 7],
            "shapes": ["spark", "spark-y", "spark-o"],
            "trail": { "color": "o", "length": 1 }
          }
        ]
      }
    }
  },
  'fire-explosion': {
    "format": "pixelforge-fx",
    "version": 1,
    "name": "fire-explosion",
    "width": 96,
    "height": 96,
    "palette": {
      "W": "#fffbe6",
      "y": "#ffd34d",
      "o": "#ff8a2b",
      "r": "#d6402b",
      "R": "#8f2a2e",
      "s": "#b3a5ad",
      "S": "#867882",
      "k": "#5a4e5b",
      "d": "#3b3140"
    },
    "symbols": {
      "ember-big": [
        "yW",
        "oy"
      ],
      "ember": ["y"],
      "ember-dim": ["o"],
      "ember-end": ["r"]
    },
    "effects": {
      "fire-explosion": {
        "frames": 16,
        "duration": { "from": 45, "to": 100, "ease": "in" },
        "seed": 7,
        "looks": {
          "shock": { "colors": ["o", "y", "W"], "thresholds": [0.25, 0.5, 0.8] },
          "fire": { "colors": ["R", "r", "o", "y", "W"], "thresholds": [0.18, 0.32, 0.46, 0.64, 0.84] },
          "smoke": {
            "colors": ["k", "S"],
            "thresholds": [0.3, 0.75],
            "lit": { "colors": ["s"], "thresholds": [0.2] },
            "shade": { "colors": ["k"], "thresholds": [0.15] },
            "outline": "d"
          }
        },
        "cleanup": { "corners": true, "strays": true },
        "layers": [
          {
            "kind": "ring",
            "look": "shock",
            "at": [48, 62],
            "frames": [1, 8],
            "radius": [10, 46],
            "width": [9, 5, 3],
            "squash": [1, 0.42],
            "noise": 0.85,
            "scale": 5,
            "power": [1.3, 0.9, 0.3]
          },
          {
            "kind": "star",
            "look": "fire",
            "at": [48, 56],
            "frames": [0, 2],
            "radius": [26, 14],
            "points": 8,
            "width": [4, 3],
            "ratio": 0.5,
            "power": 1.2,
            "cue": "boom"
          },
          {
            "kind": "burst",
            "look": "fire",
            "at": [48, 56],
            "frames": [0, 9],
            "radius": [10, 24, 26],
            "noise": 0.75,
            "scale": 5,
            "power": [1.5, 1.15, 0.5, 0.2]
          }
        ],
        "emitters": [
          {
            "name": "smoke",
            "at": [48, 48],
            "area": [32, 14],
            "burst": 18,
            "start": 4,
            "angle": [240, 300],
            "speed": [0.3, 0.9],
            "gravity": [0, -0.05],
            "drag": 0.1,
            "life": [10, 14],
            "blob": { "look": "smoke", "radius": [4, 8, 7, 2.5] }
          },
          {
            "at": [48, 56],
            "burst": 14,
            "start": 1,
            "angle": [190, 350],
            "speed": [1.8, 3.6],
            "gravity": [0, 0.3],
            "drag": 0.03,
            "life": [7, 12],
            "floor": 78,
            "bounce": 0.3,
            "shapes": ["ember-big", "ember", "ember-dim", "ember-end"],
            "trail": { "color": "r", "length": 1 }
          }
        ]
      }
    }
  },
  'fireball': {
    "format": "pixelforge-fx",
    "version": 1,
    "name": "fireball",
    "width": 56,
    "height": 56,
    "palette": { "W": "#fffbe6", "y": "#ffd34d", "o": "#ff8a2b", "r": "#d6402b", "R": "#8f2a2e" },
    "symbols": { "ember-big": ["yW", "oy"], "ember": ["y"], "ember-dim": ["o"], "ember-end": ["r"] },
    "anchor": [28, 28],
    "effects": {
      "fireball": {
        "frames": 8,
        "duration": 60,
        "loop": true,
        "seed": 4,
        "turn": { "angles": [0, 45, 90, 135, 180, 225, 270, 315], "about": [28, 28] },
        "looks": {
          "fire": { "colors": ["R", "r", "o", "y", "W"], "thresholds": [0.12, 0.3, 0.5, 0.7, 0.88] }
        },
        "cleanup": { "corners": true, "strays": true },
        "layers": [
          {
            "kind": "beam",
            "look": "fire",
            "at": [29, 28],
            "to": [5, 28],
            "width": 12,
            "fade": 0.9,
            "wobble": 0.25,
            "wavelength": 7,
            "waves": 2,
            "noise": 0.5,
            "scale": 3,
            "power": 1.3
          },
          {
            "kind": "burst",
            "look": "fire",
            "at": [29, 28],
            "radius": 7.5,
            "noise": 0.3,
            "boil": 6,
            "power": 1.12,
            "seed": 4
          }
        ],
        "emitters": [
          {
            "at": [17, 28],
            "area": [14, 8],
            "rate": 0.7,
            "angle": [160, 200],
            "speed": [0.5, 1.3],
            "drag": 0.04,
            "life": [5, 8],
            "shapes": ["ember-big", "ember", "ember-dim", "ember-end"]
          }
        ]
      }
    }
  },
  'lightning-strike': {
    "format": "pixelforge-fx",
    "version": 1,
    "name": "lightning-strike",
    "width": 96,
    "height": 104,
    "palette": { "g": "#2b2433", "v": "#3b2a8c", "b": "#4f7cff", "c": "#8fe9ff", "W": "#ffffff" },
    "symbols": { "spark": ["W"], "spark-c": ["c"], "spark-b": ["b"] },
    "effects": {
      "lightning-strike": {
        "frames": 12,
        "edges": ["top"],
        "duration": { "from": 40, "to": 90, "ease": "in" },
        "seed": 5,
        "looks": {
          "scorch": { "colors": ["g"], "thresholds": [0.3] },
          "bolt": { "colors": ["v", "b", "c", "W"], "thresholds": [0.12, 0.3, 0.55, 0.85] }
        },
        "cleanup": { "corners": true },
        "layers": [
          {
            "kind": "ring",
            "look": "scorch",
            "at": [48, 85],
            "frames": [2, 12],
            "radius": 9,
            "width": 3,
            "fill": 1,
            "squash": [1, 0.35],
            "noise": 0.3,
            "power": [1, 1, 0.6]
          },
          {
            "kind": "bolt",
            "look": "bolt",
            "at": [52, 0],
            "to": [48, 82],
            "frames": [0, 6],
            "width": [3, 2, 1],
            "glow": [2, 1],
            "jag": 0.4,
            "branches": 3,
            "reroll": 2,
            "reveal": 0.25,
            "flicker": 0.35,
            "noise": 0.5,
            "scale": 3,
            "power": [1.4, 1.1, 0.45]
          },
          {
            "kind": "ring",
            "look": "bolt",
            "at": [48, 84],
            "frames": [1, 8],
            "radius": [3, 30],
            "width": [5, 4, 3],
            "squash": [1, 0.35],
            "noise": 0.85,
            "scale": 4,
            "power": [1.3, 0.8, 0.15]
          },
          {
            "kind": "star",
            "look": "bolt",
            "at": [48, 82],
            "frames": [1, 5],
            "radius": [20, 6],
            "points": 8,
            "width": [3, 1],
            "ratio": 0.45,
            "power": [1.3, 0.7],
            "cue": "strike"
          }
        ],
        "emitters": [
          {
            "at": [48, 82],
            "burst": 12,
            "start": 1,
            "angle": [200, 340],
            "speed": [1.4, 3],
            "gravity": [0, 0.3],
            "life": [6, 10],
            "floor": 86,
            "bounce": 0.4,
            "shapes": ["spark", "spark-c", "spark-b"]
          }
        ]
      }
    }
  },
  'healing-circle': {
    "format": "pixelforge-fx",
    "version": 1,
    "name": "healing-circle",
    "width": 96,
    "height": 72,
    "palette": {
      "d": "#14432f",
      "g": "#2a8a4f",
      "m": "#5fd37a",
      "l": "#b6f5a0",
      "W": "#f4ffe8",
      "y": "#ffe07a",
      "Y": "#fff6c4"
    },
    "symbols": {
      "sparkle-big": [
        ".Y.",
        "YWY",
        ".Y."
      ],
      "sparkle": ["Y"],
      "sparkle-dim": ["y"]
    },
    "effects": {
      "healing-circle": {
        "frames": 18,
        "duration": 70,
        "seed": 2,
        "looks": {
          "rune": { "colors": ["d", "g", "m", "l"], "thresholds": [0.1, 0.35, 0.6, 0.82], "dither": 0.8 },
          "light": { "colors": ["g", "m", "l", "W"], "thresholds": [0.1, 0.35, 0.6, 0.85], "dither": 0.3 }
        },
        "cleanup": { "corners": true },
        "layers": [
          {
            "kind": "glyph",
            "look": "rune",
            "at": [48, 52],
            "frames": [0, 18],
            "radius": 36,
            "inner": 0.64,
            "squash": [1, 0.42],
            "runes": 10,
            "double": true,
            "points": 4,
            "step": 1,
            "spin": [0, 24],
            "reveal": 0.35,
            "glow": 0,
            "power": [1, 1, 0.9, 0],
            "fill": [0, 0.06, 0.06, 0],
            "ease": "linear"
          },
          {
            "kind": "ring",
            "look": "rune",
            "at": [48, 52],
            "frames": [6, 12],
            "radius": [36, 44],
            "width": [5, 2],
            "squash": [1, 0.42],
            "noise": 0.5,
            "power": [0.9, 0.3]
          },
          {
            "kind": "beam",
            "look": "light",
            "at": [48, 52],
            "to": [48, 2],
            "frames": [5, 16],
            "width": [0, 18, 14, 0],
            "reveal": 0.25,
            "wobble": 0.06,
            "wavelength": 10,
            "waves": -4,
            "fade": 0.85,
            "power": [0.65, 0.65, 0.35],
            "ease": "linear",
            "squash": [1, 0.42]
          }
        ],
        "emitters": [
          {
            "at": [48, 48],
            "area": [56, 7],
            "rate": 0.6,
            "start": 4,
            "end": 16,
            "angle": [265, 275],
            "speed": [0.8, 1.4],
            "life": [6, 10],
            "shapes": ["sparkle-big", "sparkle", "sparkle-dim"],
            "behind": true
          },
          {
            "at": [48, 56],
            "area": [56, 7],
            "rate": 0.6,
            "start": 4,
            "end": 16,
            "angle": [265, 275],
            "speed": [0.8, 1.4],
            "life": [6, 10],
            "shapes": ["sparkle-big", "sparkle", "sparkle-dim"]
          }
        ]
      }
    }
  },
  'water': {
    "format": "pixelforge-fx",
    "version": 1,
    "name": "water",
    "width": 64,
    "height": 68,
    "palette": { "o": "#123c40", "d": "#2a7f86", "m": "#4fb3b5", "b": "#9fe3e0", "h": "#e8fffb" },
    "effects": {
      "geyser": {
        "frames": 16,
        "duration": 83,
        "seed": 6,
        "looks": {
          "water": {
            "colors": ["m", "b"],
            "thresholds": [0.2, 0.55],
            "light": [-1, -1],
            "lit": { "colors": ["h"], "thresholds": [0.45] },
            "shade": { "colors": ["d"], "thresholds": [0.4] },
            "outline": "o"
          }
        },
        "cleanup": { "corners": true, "strays": true },
        "layers": [
          {
            "kind": "stream",
            "at": [32, 58],
            "through": [[32, 34], [33, 10]],
            "frames": [0, 12],
            "width": [6, 11, 9, 5],
            "taper": [1, 0.8, 0.55, 0],
            "head": [0.25, 1, 1, 0.35],
            "tail": 0,
            "sway": 1.5,
            "wavelength": 18,
            "waves": 2,
            "noise": 0.7,
            "scale": 5,
            "power": [1.3, 1.3, 1.1, 0.4],
            "ease": "linear"
          },
          {
            "kind": "ring",
            "at": [32, 58],
            "frames": [1, 15],
            "radius": [5, 22],
            "width": [4, 2],
            "squash": [1, 0.28],
            "noise": 0.7,
            "power": [1.3, 0.25]
          }
        ],
        "emitters": [
          {
            "name": "crown",
            "at": [33, 12],
            "area": [6, 3],
            "burst": 10,
            "start": 6,
            "angle": [200, 340],
            "speed": [0.9, 2],
            "gravity": [0, 0.24],
            "floor": 58,
            "life": [9, 11],
            "blob": { "radius": [2.6, 2.2, 1.4] }
          },
          {
            "name": "spray",
            "at": [32, 40],
            "line": { "to": [33, 16] },
            "burst": 6,
            "start": 8,
            "angle": [180, 360],
            "speed": [0.3, 0.9],
            "gravity": [0, 0.2],
            "floor": 58,
            "life": [6, 9],
            "blob": { "radius": [1.9, 1.2] }
          }
        ]
      },
      "whip": {
        "frames": 14,
        "duration": 83,
        "seed": 4,
        "looks": {
          "water": {
            "colors": ["m", "b"],
            "thresholds": [0.2, 0.55],
            "light": [-1, -1],
            "lit": { "colors": ["h"], "thresholds": [0.45] },
            "shade": { "colors": ["d"], "thresholds": [0.4] },
            "outline": "o"
          }
        },
        "cleanup": { "corners": true, "strays": true },
        "layers": [
          {
            "kind": "stream",
            "at": [6, 46],
            "through": [[20, 30], [36, 36], [50, 22], [58, 10]],
            "frames": [0, 12],
            "width": [7, 9, 6],
            "taper": [0, 1, 0.6, 0],
            "head": [0.15, 1, 1],
            "tail": [0, 0.15, 1],
            "sway": 2.5,
            "wavelength": 20,
            "waves": 1.5,
            "noise": 0.6,
            "scale": 5,
            "power": [1.3, 1.2, 0.5],
            "ease": "linear"
          }
        ],
        "emitters": [
          {
            "name": "shed",
            "at": [14, 36],
            "line": { "to": [54, 16] },
            "burst": 10,
            "start": 6,
            "angle": [200, 340],
            "speed": [0.3, 1.1],
            "gravity": [0, 0.18],
            "life": [6, 8],
            "blob": { "radius": [2.2, 1.2] }
          }
        ]
      },
      "ring": {
        "frames": 14,
        "duration": 83,
        "seed": 2,
        "looks": {
          "water": {
            "colors": ["m", "b"],
            "thresholds": [0.2, 0.55],
            "light": [-1, -1],
            "lit": { "colors": ["h"], "thresholds": [0.45] },
            "shade": { "colors": ["d"], "thresholds": [0.4] },
            "outline": "o"
          }
        },
        "cleanup": { "corners": true, "strays": true },
        "layers": [
          {
            "kind": "ring",
            "at": [32, 32],
            "frames": [0, 11],
            "radius": [5, 17, 21],
            "width": [7, 6, 4],
            "noise": 1,
            "scale": 5,
            "power": [1.5, 1.2, 0.22]
          }
        ],
        "emitters": [
          {
            "name": "spray",
            "at": [32, 32],
            "ring": { "radius": 20, "outward": true },
            "burst": 12,
            "start": 7,
            "angle": [-20, 20],
            "speed": [0.4, 1],
            "gravity": [0, 0.1],
            "drag": 0.05,
            "life": [6, 7],
            "blob": { "radius": [2.4, 1.4] }
          }
        ]
      },
      "dome": {
        "frames": 16,
        "duration": 83,
        "seed": 8,
        "looks": {
          "water": {
            "colors": ["m", "b"],
            "thresholds": [0.2, 0.55],
            "light": [-1, -1],
            "lit": { "colors": ["h"], "thresholds": [0.45] },
            "shade": { "colors": ["d"], "thresholds": [0.4] },
            "outline": "o"
          },
          "shine": { "colors": ["h"], "thresholds": [0.4] }
        },
        "cleanup": { "corners": true, "strays": true },
        "layers": [
          {
            "kind": "burst",
            "look": "water",
            "at": [32, 56],
            "frames": [0, 8],
            "radius": [3, 14, 16],
            "noise": 0.08,
            "scale": 6,
            "boil": 0,
            "floor": 56,
            "power": [1.5, 1.4, 1.3]
          },
          {
            "kind": "burst",
            "look": "shine",
            "at": [28, 50],
            "frames": [2, 8],
            "radius": [2, 3.4],
            "noise": 0,
            "boil": 0,
            "drift": [0, -1]
          },
          {
            "kind": "ring",
            "at": [32, 56],
            "frames": [8, 16],
            "radius": [14, 28],
            "width": [4, 2],
            "squash": [1, 0.25],
            "noise": 0.7,
            "power": [1.3, 0.25],
            "look": "water"
          }
        ],
        "emitters": [
          {
            "name": "pop",
            "at": [32, 56],
            "ring": { "radius": 15, "arc": [190, 350], "even": true, "outward": true },
            "burst": 11,
            "start": 8,
            "angle": [-10, 10],
            "speed": [1.2, 2],
            "gravity": [0, 0.22],
            "floor": 57,
            "life": [7, 9],
            "blob": { "radius": [2.6, 1.6], "look": "water" }
          }
        ]
      },
      "curl": {
        "frames": 14,
        "duration": 83,
        "seed": 3,
        "looks": {
          "water": {
            "colors": ["m", "b"],
            "thresholds": [0.2, 0.55],
            "light": [-1, -1],
            "lit": { "colors": ["h"], "thresholds": [0.45] },
            "shade": { "colors": ["d"], "thresholds": [0.4] },
            "outline": "o"
          }
        },
        "cleanup": { "corners": true, "strays": true },
        "layers": [
          {
            "kind": "stream",
            "at": [8, 54],
            "through": [[34, 52], [50, 38], [44, 20], [30, 22], [32, 32]],
            "frames": [0, 12],
            "width": [8, 12, 9],
            "taper": [0.5, 1, 0.7, 0],
            "head": [0.2, 1, 1],
            "tail": [0, 0.1, 0.85],
            "noise": 0.6,
            "scale": 5,
            "power": [1.3, 1.2, 0.45],
            "ease": "linear"
          }
        ],
        "emitters": [
          {
            "name": "crest",
            "at": [42, 18],
            "area": [10, 4],
            "burst": 8,
            "start": 6,
            "angle": [200, 290],
            "speed": [0.5, 1.4],
            "gravity": [0, 0.18],
            "life": [6, 8],
            "blob": { "radius": [2.2, 1.3] }
          }
        ]
      }
    }
  },
  // A looping vortex: a boiling aura ring round a dark core, motes that swirl in (attract swirl) and wisps that
  // wander inside it (turbulence) and cool as they fade (blob power), drawn over the motes (front).
  'vortex': {
    "format": "pixelforge-fx",
    "version": 1,
    "name": "vortex",
    "width": 64,
    "height": 64,
    "anchor": [
      32,
      56
    ],
    "palette": {
      "k": "#140a26",
      "d": "#2b1452",
      "v": "#5a2a9c",
      "m": "#9a4ad8",
      "p": "#d58cff",
      "W": "#fbeaff",
      "o": "#3a1d66"
    },
    "symbols": {
      "mote": [
        "W"
      ],
      "mote-dim": [
        "p"
      ],
      "spark": [
        ".W.",
        "WpW",
        ".W."
      ],
      "fleck": [
        "m"
      ]
    },
    "effects": {
      "vortex": {
        "frames": 16,
        "duration": 70,
        "loop": true,
        "seed": 5,
        "looks": {
          "core": {
            "colors": [
              "k",
              "d"
            ],
            "thresholds": [
              0.15,
              0.5
            ]
          },
          "rim": {
            "colors": [
              "v",
              "m",
              "p",
              "W"
            ],
            "thresholds": [
              0.2,
              0.45,
              0.7,
              0.9
            ],
            "dither": 0.4,
            "outline": "o"
          },
          "wisp": {
            "colors": [
              "v",
              "m",
              "p"
            ],
            "thresholds": [
              0.3,
              0.6,
              0.9
            ],
            "front": true
          }
        },
        "layers": [
          {
            "kind": "burst",
            "look": "core",
            "at": [
              32,
              32
            ],
            "radius": 13,
            "squash": [
              0.62,
              1
            ],
            "noise": 0.35,
            "scale": 5,
            "boil": 6
          },
          {
            "kind": "aura",
            "look": "rim",
            "at": [
              32,
              32
            ],
            "around": [
              9,
              14
            ],
            "width": 3,
            "rise": 1,
            "noise": 0.5,
            "scale": 4,
            "boil": 8
          }
        ],
        "emitters": [
          {
            "at": [
              32,
              32
            ],
            "ring": {
              "radius": [
                17,
                24
              ],
              "outward": true
            },
            "angle": [
              80,
              100
            ],
            "rate": 2.6,
            "speed": [
              0.7,
              1
            ],
            "life": [
              10,
              14
            ],
            "attract": {
              "at": [
                32,
                32
              ],
              "strength": 0.24,
              "swirl": 0.2
            },
            "drag": 0.04,
            "trail": {
              "color": "v",
              "length": 2
            },
            "shapes": [
              "mote",
              "mote-dim",
              "fleck"
            ]
          },
          {
            "at": [
              32,
              32
            ],
            "ring": {
              "radius": [
                5,
                8
              ]
            },
            "rate": 0.9,
            "angle": [
              0,
              360
            ],
            "speed": [
              0.2,
              0.4
            ],
            "life": [
              10,
              14
            ],
            "drag": 0.06,
            "attract": {
              "at": [
                32,
                32
              ],
              "strength": 0.02,
              "swirl": 0.12
            },
            "turbulence": {
              "strength": 0.08,
              "scale": 7
            },
            "blob": {
              "look": "wisp",
              "radius": [
                2,
                2.8,
                1.6
              ],
              "power": [
                1.2,
                0.55
              ]
            }
          },
          {
            "at": [
              32,
              32
            ],
            "area": [
              12,
              22
            ],
            "rate": 0.25,
            "life": [
              3,
              4
            ],
            "speed": 0,
            "shapes": [
              "spark"
            ]
          }
        ]
      }
    }
  },
  // A one-shot meteor: a head that shares its path and window with the trail emitters, so smoke, a fire tail of
  // cooling blobs (blob power) and embers keep pace with it, then an impact with fiery debris, rock chips that tumble
  // (spin) and rising smoke (keyed rate).
  'meteor': {
    "format": "pixelforge-fx",
    "version": 1,
    "name": "meteor",
    "width": 64,
    "height": 64,
    "anchor": [
      40,
      54
    ],
    "palette": {
      "r": "#8a2a1a",
      "o": "#e0661e",
      "y": "#ffc23a",
      "W": "#fff6d8",
      "s": "#5e5458",
      "g": "#8a8084",
      "l": "#b8b0b0",
      "k": "#3e3438"
    },
    "symbols": {
      "ember": [
        "y"
      ],
      "ember-dim": [
        "o"
      ],
      "ember-out": [
        "r"
      ],
      "chip": [
        ".s",
        "sg"
      ],
      "chip-big": [
        ".ss",
        "sgg",
        "sg."
      ]
    },
    "effects": {
      "meteor": {
        "frames": 22,
        "edges": ["top"],
        "duration": 60,
        "seed": 3,
        "looks": {
          "smoke": {
            "colors": [
              "s",
              "g",
              "l"
            ],
            "thresholds": [
              0.3,
              0.6,
              0.95
            ],
            "lit": {
              "colors": [
                "l"
              ],
              "thresholds": [
                0.35
              ]
            },
            "shade": {
              "colors": [
                "k"
              ],
              "thresholds": [
                0.45
              ]
            },
            "reach": 2
          },
          "fire": {
            "colors": [
              "r",
              "o",
              "y",
              "W"
            ],
            "thresholds": [
              0.2,
              0.42,
              0.66,
              0.86
            ],
            "dither": 0.3
          }
        },
        "layers": [
          {
            "kind": "burst",
            "look": "fire",
            "path": [
              [
                6,
                4
              ],
              [
                22,
                26
              ],
              [
                40,
                54
              ]
            ],
            "frames": [
              0,
              9
            ],
            "radius": [
              4.5,
              6
            ],
            "noise": 0.3,
            "ease": "linear",
            "power": 1.4
          },
          {
            "kind": "burst",
            "look": "fire",
            "at": [
              40,
              54
            ],
            "frames": [
              8,
              15
            ],
            "radius": [
              4,
              13,
              9
            ],
            "noise": [
              0.2,
              0.7
            ],
            "hole": [
              0,
              0,
              0.6
            ],
            "power": [
              1.4,
              0.4
            ],
            "squash": [
              1,
              0.7
            ],
            "cue": "impact"
          },
          {
            "kind": "ring",
            "look": "fire",
            "at": [
              40,
              55
            ],
            "frames": [
              9,
              15
            ],
            "radius": [
              4,
              22
            ],
            "width": [
              4,
              2
            ],
            "squash": [
              1,
              0.35
            ],
            "noise": 0.5,
            "power": [
              1.1,
              0.5
            ]
          }
        ],
        "emitters": [
          {
            "path": [
              [
                6,
                4
              ],
              [
                22,
                26
              ],
              [
                40,
                54
              ]
            ],
            "rate": [
              1.4,
              3
            ],
            "end": 9,
            "angle": [
              250,
              290
            ],
            "speed": [
              0.1,
              0.25
            ],
            "life": [
              8,
              12
            ],
            "drag": 0.1,
            "turbulence": {
              "strength": 0.08,
              "scale": 6
            },
            "blob": {
              "look": "smoke",
              "radius": [
                1.8,
                3,
                2.2
              ],
              "size": [
                0.8,
                1.3
              ]
            }
          },
          {
            "path": [
              [
                6,
                4
              ],
              [
                22,
                26
              ],
              [
                40,
                54
              ]
            ],
            "rate": 3,
            "end": 9,
            "angle": [
              215,
              245
            ],
            "speed": [
              0.4,
              0.8
            ],
            "life": [
              3,
              5
            ],
            "drag": 0.1,
            "blob": {
              "look": "fire",
              "radius": [
                2.4,
                1.2
              ],
              "power": [
                1.5,
                0.3
              ]
            }
          },
          {
            "path": [
              [
                6,
                4
              ],
              [
                22,
                26
              ],
              [
                40,
                54
              ]
            ],
            "rate": 1,
            "end": 9,
            "angle": [
              200,
              250
            ],
            "speed": [
              0.5,
              1
            ],
            "life": [
              3,
              6
            ],
            "shapes": [
              "ember",
              "ember-dim",
              "ember-out"
            ]
          },
          {
            "at": [
              40,
              52
            ],
            "area": [
              6,
              2
            ],
            "burst": 14,
            "start": 9,
            "angle": [
              195,
              345
            ],
            "speed": [
              1.2,
              2.6
            ],
            "life": [
              8,
              13
            ],
            "gravity": [
              0,
              0.22
            ],
            "floor": 56,
            "bounce": 0.3,
            "blob": {
              "look": "fire",
              "radius": 1.3,
              "power": [
                1.6,
                0.5
              ]
            }
          },
          {
            "at": [
              40,
              52
            ],
            "area": [
              8,
              2
            ],
            "burst": 6,
            "start": 9,
            "angle": [
              200,
              340
            ],
            "speed": [
              1.4,
              2.4
            ],
            "life": [
              8,
              11
            ],
            "gravity": [
              0,
              0.25
            ],
            "floor": 57,
            "bounce": 0.25,
            "spin": [
              -90,
              90
            ],
            "shapes": [
              [
                "chip"
              ],
              [
                "chip-big"
              ]
            ],
            "dissolve": 0.4
          },
          {
            "at": [
              40,
              52
            ],
            "area": [
              18,
              3
            ],
            "rate": [
              3,
              0
            ],
            "start": 10,
            "end": 16,
            "angle": [
              255,
              285
            ],
            "speed": [
              0.5,
              0.9
            ],
            "life": [
              6,
              9
            ],
            "drag": 0.06,
            "turbulence": {
              "strength": 0.1,
              "scale": 7
            },
            "blob": {
              "look": "smoke",
              "radius": [
                2.4,
                4,
                1
              ],
              "size": [
                0.7,
                1.4
              ]
            }
          }
        ]
      }
    }
  },
  // A looping shield bubble: a ring whose breaks churn (boil) with a dithered glow round it (halo), a highlight arc,
  // glints spread evenly inside (ring fill) and motes that drift round it (attract swirl).
  'shield': {
    "format": "pixelforge-fx",
    "version": 1,
    "name": "shield",
    "width": 48,
    "height": 48,
    "anchor": [
      24,
      40
    ],
    "palette": {
      "n": "#1b2f6b",
      "b": "#2f6fd6",
      "c": "#5fc8ff",
      "W": "#e8fbff",
      "d": "#16244f"
    },
    "symbols": {
      "glint": [
        ".W.",
        "WcW",
        ".W."
      ],
      "mote": [
        "c"
      ],
      "mote-hot": [
        "W"
      ]
    },
    "effects": {
      "shield": {
        "frames": 12,
        "duration": 80,
        "loop": true,
        "seed": 4,
        "looks": {
          "bubble": {
            "colors": [
              "n",
              "b",
              "c",
              "W"
            ],
            "thresholds": [
              0.18,
              0.4,
              0.68,
              0.9
            ],
            "dither": 0.35,
            "halo": {
              "color": "d",
              "width": 2
            }
          },
          "shine": {
            "colors": [
              "c",
              "W"
            ],
            "thresholds": [
              0.3,
              0.75
            ]
          }
        },
        "layers": [
          {
            "kind": "ring",
            "look": "bubble",
            "at": [
              24,
              24
            ],
            "radius": 16,
            "width": 3,
            "noise": 0.45,
            "scale": 5,
            "boil": 10
          },
          {
            "kind": "slash",
            "look": "shine",
            "at": [
              24,
              24
            ],
            "radius": 13,
            "width": 2.5,
            "arc": [
              195,
              255
            ],
            "reveal": 0
          }
        ],
        "emitters": [
          {
            "at": [
              24,
              24
            ],
            "ring": {
              "radius": [
                6,
                15
              ],
              "fill": true
            },
            "rate": 0.4,
            "life": [
              3,
              4
            ],
            "speed": 0,
            "shapes": [
              "glint"
            ]
          },
          {
            "at": [
              24,
              24
            ],
            "ring": {
              "radius": 17,
              "outward": true
            },
            "angle": 90,
            "rate": 1.2,
            "speed": [
              0.6,
              0.9
            ],
            "life": [
              6,
              9
            ],
            "attract": {
              "at": [
                24,
                24
              ],
              "strength": 0.06,
              "swirl": 0.05
            },
            "shapes": [
              "mote-hot",
              "mote"
            ]
          }
        ]
      }
    }
  },
  // A looping portal in a stone arch, lit by its own light (shine): a glow that hugs the arch's frame (an aura round
  // the stones beside the opening, half of it hidden under the arch drawn over it) on a dark fill, with wisps and
  // sparks inside. The arch is drawn as it looks fully lit and is solid to the light, so its inner faces are lit,
  // the stone darkens further in and its outer side is left dark.
  'stone-portal': {
    "format": "pixelforge-fx",
    "version": 1,
    "name": "stone-portal",
    "width": 72,
    "height": 88,
    "anchor": [36, 87],
    "palette": {
      "S": "#a9b0c9",
      "s": "#7f87a6",
      "t": "#5f6789",
      "j": "#3b4162",
      "o": "#22263d",
      "k": "#140a26",
      "d": "#2b1452",
      "v": "#5a2a9c",
      "m": "#9a4ad8",
      "p": "#d58cff",
      "W": "#fbeaff",
      "D": "#0d0b2099",
      "u": "#0d0b2066",
      "n": "#0d0b2033",
      "z": "#00000000",
      "h": "#9a5cff4d",
      "i": "#b47cff80"
    },
    "symbols": {
      "arch": [
        ".............................oooooooooo.............................",
        "..........................oooSSSSSSSsSsooo..........................",
        ".......................oooSsSSsssStssssSSSooo.......................",
        "......................ooSSssSstsSsssssssssSSoo......................",
        "....................oojjsssssSsssssssssSssssjjoo....................",
        "...................ooSSjssssssssSssssssssstsjSSoo...................",
        "..................oSSssjjssSssstsssssssssssjjssSSo..................",
        ".................oSSssstjssssssssssssssssssjsSssSSo.................",
        "................osSssssssjssssssssssssssssjssssssSSo................",
        "...............ojjsssssssjjsssstsssssssssjjsssstssjjo...............",
        "..............oossjsstssssjsssstssssssStsjSstssssjsSoo..............",
        "..............oSsssjjtssssjjs..........sjjsSsssjjsssSo..............",
        ".............oSSssssjjsssss..............SssssjjssstSSo.............",
        ".............osssssttjjsss................sssjjssSsssso.............",
        "............oSSssstsssjjs..................SjjssssSssSSo............",
        "............ojtsssssstsS....................ssssssssssjo............",
        "............ojjjjstSsss......................Ssssssjjjjo............",
        "...........osSssjjjsss........................sssjjjtsSSo...........",
        "...........oSssssssjjj........................jjjtsssssSo...........",
        "...........oSssssSSssj........................jssssSsssSo...........",
        "...........ossssssSss..........................ssssssssSo...........",
        "...........oSssssssss..........................ssssssssSo...........",
        "...........oSssStssss..........................ssssssssSo...........",
        "...........oSSSSSSsSS..........................SSsSSSSsSo...........",
        "...........osssssSsss..........................ssttssssso...........",
        "...........osssssssss..........................ssssssssso...........",
        "...........ossSssssSs..........................ssssssssso...........",
        "...........osssssssss..........................sstssSSsso...........",
        "...........osssssssss..........................ssssssssso...........",
        "...........ojjjjjjjjj..........................jjjjjjjjjo...........",
        "...........oSSSSjSSSS..........................SSsSjSSSSo...........",
        "...........osSssjsSss..........................ssSsjssSso...........",
        "...........ossssjtsss..........................sssSjstsso...........",
        "...........ossssjstss..........................sstsjsSsso...........",
        "...........ossssjstss..........................ssssjsssso...........",
        "...........osstsjssts..........................ssssjsSsso...........",
        "...........ojjjjjjjjj..........................jjjjjjjjjo...........",
        "...........oSsssSSSsS..........................sSSsSsSSSo...........",
        "...........otssssssss..........................sSstsSssso...........",
        "...........osssSssssS..........................tsssssssso...........",
        "...........osssstssst..........................ssstssssso...........",
        "...........ossssssSst..........................ssssssssso...........",
        "...........osssssssss..........................ssssSsstso...........",
        "...........ojjjjjjjjj..........................jjjjjjjjjo...........",
        "...........oSSSSjSsSS..........................sSSsjSsSSo...........",
        "...........ossssjssss..........................sSssjsSsso...........",
        "...........ossssjssSs..........................ssssjsssso...........",
        "...........osstsjssss..........................stssjtssso...........",
        "...........ossstjssts..........................sSSsjsssso...........",
        "...........ottSsjSsss..........................ssssjsssso...........",
        "...........ojjjjjjjjj..........................jjjjjjjjjo...........",
        "...........oSSSsSSSSS..........................SSsSSSSSSo...........",
        "...........oSssssssss..........................SSssssssso...........",
        "...........osstsssSss..........................ssssssssso...........",
        "...........osstsssSss..........................sstSssssto...........",
        "...........ostststssS..........................ssssssssso...........",
        "...........osSsssssss..........................ssssssstso...........",
        "...........ojjjjjjjjj..........................jjjjjjjjjo...........",
        "...........oSSSSjSSSS..........................SSSsjSSSSo...........",
        "...........ostssjssSS..........................ssssjtssso...........",
        "...........oSsssjssss..........................ssssjstsso...........",
        "...........ossssjssss..........................ssssjsssso...........",
        "...........oSsssjssss..........................ssssjsssso...........",
        "...........ossssjssss..........................sStsjssSso...........",
        "...........ojjjjjjjjj..........................jjjjjjjjjo...........",
        "....oSSSSjSsssSSSsSsSjSSSSSSSSSSSjSSsSsSSSSSsjSsSsSSSSSsSjSsSSso....",
        "....ossssjstsssssstssjsssstssssssjstssstsssssjssssssSsttsjsSssso....",
        "....ossssjsssssssssssjsssssssstssjssssssSssssjsssssssssssjssssso....",
        "....ojjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjo....",
        "oSsjsSSSssSsSSsjSSSSSSSSSsSjsSSSSSSsSSSjSSSsSsSSSSSjSSSsSSSSSSSjSSSo",
        "otsjsstssssssssjtssssssSsstjsSssssssSssjssssstsssssjsssssssStssjssso",
        "ossjsssssssSsssjsssssssstssjsstssssssssjsssssssssssjsssssssssssjssso",
        "oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo"
      ],
      "frame": [
        "..........oooooooooo..........",
        "........oooooooooooooo........",
        "......oooo..........oooo......",
        ".....ooo..............ooo.....",
        "....ooo................ooo....",
        "...ooo..................ooo...",
        "..ooo....................ooo..",
        "..oo......................oo..",
        ".oo........................oo.",
        ".oo........................oo.",
        ".oo........................oo.",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oo..........................oo",
        "oooooooooooooooooooooooooooooo",
        "oooooooooooooooooooooooooooooo"
      ],
      "mote": ["W"],
      "mote-dim": ["p"],
      "fleck": ["m"],
      "spark": [
        ".W.",
        "WpW",
        ".W."
      ]
    },
    "effects": {
      "stone-portal": {
        "frames": 24,
        "duration": 70,
        "loop": true,
        "seed": 5,
        "edges": ["bottom"],
        "looks": {
          "void": { "colors": ["k"], "thresholds": [0.3] },
          "swirl": { "colors": ["d", "v"], "thresholds": [0.3, 0.72] },
          "rim": { "colors": ["v", "m", "p", "W"], "thresholds": [0.14, 0.36, 0.6, 0.84], "dither": 0.4 },
          "wisp": { "colors": ["v", "m", "p"], "thresholds": [0.3, 0.6, 0.9] }
        },
        "layers": [
          { "kind": "ring", "look": "void", "at": [35.5, 52], "radius": 36, "width": 3, "fill": 1, "squash": [0.62, 1] },
          {
            "kind": "burst",
            "look": "swirl",
            "at": [35.5, 52],
            "radius": 17,
            "squash": [0.6, 1],
            "noise": 0.6,
            "scale": 6,
            "boil": 6
          },
          {
            "kind": "aura",
            "look": "rim",
            "symbol": "frame",
            "at": [21, 24],
            "width": 6,
            "rise": 1,
            "noise": 0.6,
            "scale": 4,
            "boil": 8
          }
        ],
        "emitters": [
          { "name": "arch", "at": [2, 15], "sprite": { "symbol": "arch", "draw": true } },
          {
            "at": [35.5, 52],
            "ring": { "radius": [3, 9] },
            "rate": 0.75,
            "angle": [0, 360],
            "speed": [0.2, 0.4],
            "life": [10, 14],
            "drag": 0.06,
            "attract": { "at": [35.5, 52], "strength": 0.02, "swirl": 0.12 },
            "turbulence": { "strength": 0.08, "scale": 7 },
            "blob": { "look": "wisp", "radius": [2, 2.8, 1.6], "power": [1.2, 0.55] }
          },
          { "at": [35.5, 50], "area": [16, 40], "rate": 0.3, "life": [3, 4], "speed": 0, "shapes": ["spark"] },
          {
            "at": [35.5, 77],
            "area": [20, 3],
            "rate": 0.5,
            "angle": [260, 280],
            "speed": [0.5, 0.9],
            "life": [8, 12],
            "sway": { "amplitude": [1, 0], "period": 8 },
            "shapes": ["mote", "mote-dim", "fleck"]
          }
        ],
        "shine": {
          "keys": { "W": 1.5, "p": 1, "m": 0.6, "v": 0.2, "d": 0, "k": 0 },
          "reach": 26,
          "depth": 8,
          "ease": 0.5,
          "thresholds": [0.1, 0.22, 0.38, 0.56, 0.76],
          "colors": ["u", "n", "z", "h", "i"],
          "dark": "D",
          "solid": ["arch"],
          "dither": 0.45
        }
      }
    }
  },
  // A frost nova on open ground, seen from above and in front: a flash where the caster stands, a ring of frost that
  // runs out and leaves a see-through sheet of it on the ground, small ice popping up behind the front, and a crown
  // of tall ice where the front stops. The sheet melts from the middle out and the crown last. The ice is drawn as
  // symbols, one per step of a cluster's life (up past its full height, settled, standing, sinking and dulling), and
  // `ground: 0` stands every step on the row its particle was born on. Each half of the ellipse has its own emitters,
  // the far half first, so near ice is drawn over far ice. Drawn under a character it needs no parts.
  'frost-nova': {
    "format": "pixelforge-fx",
    "version": 1,
    "name": "frost-nova",
    "width": 144,
    "height": 96,
    "anchor": [72, 62],
    "palette": {
      "W": "#ffffff",
      "p": "#d8f6ff",
      "c": "#8fe0ff",
      "b": "#4aa8e8",
      "B": "#2f5fb3",
      "f": "#2f7fd866",
      "g": "#5cbcf58c",
      "h": "#aee8ffbf"
    },
    "symbols": {
      "glint-1": ["p"],
      "glint-3": [
        ".c.",
        "cWc",
        ".c."
      ],
      "glint-5": [
        "..c..",
        "..p..",
        "cpWpc",
        "..p..",
        "..c.."
      ],
      "fleck": ["c"],
      "fleck-dim": ["b"],
      "tall-0": [
        ".....W.......",
        ".....Wb......",
        "....WbB......",
        "....WcbB.....",
        "....pcbB.Wb..",
        ".Wb.pcbB.WbB.",
        ".pB.pcBB.pBB."
      ],
      "tall-1": [
        "....W........",
        "....W........",
        "....p........",
        "....Wb.......",
        "....Wb.......",
        "....WbB......",
        "....WbB......",
        "...WcbB......",
        "...pcbB......",
        "...pcbbB...W.",
        "...pcbbB..Wb.",
        "W..pcbbB..Wb.",
        "Wb.pcbbB.WbB.",
        "Wb.pcbbB.pcbB",
        "pbBpcbbBpcbB.",
        "pbBpcbbBpcbB.",
        ".pBBpcBBBcBB."
      ],
      "tall-2": [
        "....W........",
        "....W........",
        "....p........",
        "...Wb........",
        "...Wb........",
        "...Wb........",
        "...WbB.......",
        "...WbB.......",
        "...WbB.......",
        "...WcbB......",
        "...WcbB......",
        "..WcbbB......",
        "...pcbbB...W.",
        "...pcbbB...W.",
        "..pccbbB...p.",
        "..pccbbB..Wb.",
        "W.pccbbB..Wb.",
        "W.pccbbB..WbB",
        "Wb.pccbbBpbB.",
        "Wb.pccbbBpcbB",
        "WbBpccbbBpcbB",
        "pbBpccbbBcbB.",
        "pbBpccbbBcbB.",
        "pbBpccbbBcbB.",
        ".pBBccBBBcBB."
      ],
      "tall-3": [
        "....W........",
        "....W........",
        "....p........",
        "...Wb........",
        "...Wb........",
        "...WbB.......",
        "...WbB.......",
        "...WcbB......",
        "...WcbB......",
        "...WcbB......",
        "...pcbbB.....",
        "...pcbbB...W.",
        "..pccbbB...W.",
        "..pccbbB..Wb.",
        "W.pccbbB..Wb.",
        "W.pccbbB..WbB",
        "Wb.pccbbBpcbB",
        "Wb.pccbbBpcbB",
        "pbBpccbbBpcbB",
        "pbBpccbbBcbB.",
        "pbBpccbbBcbB.",
        ".pBBccBBBcBB."
      ],
      "tall-4": [
        "....W........",
        "....W........",
        "....p........",
        "...Wb........",
        "....Wb.......",
        "...WbB.......",
        "...WbB.......",
        "...WcbB......",
        "...WcbB......",
        "...WcbbB.....",
        "...pcbbB.....",
        "..pccbbB...W.",
        "..pccbbB...W.",
        "W.pccbbB..Wb.",
        "W.pccbbB..WbB",
        "Wb.pccbbBWbB.",
        "Wb.pccbbBpcbB",
        "pbBpccbbBpcbB",
        "pbBpccbbBcbB.",
        "pbBpccbbBcbB.",
        ".pBBccBBBcBB."
      ],
      "tall-5": [
        "....p........",
        "....p........",
        "....pb.......",
        "....pb.......",
        "...pbB.......",
        "...pbB.......",
        "...pcbB......",
        "...pcbB......",
        "...pcbbB.....",
        "...ccbbB...p.",
        "..cccbbB...p.",
        "p.cccbbB..pb.",
        "p..cccbbBpbB.",
        "pb.cccbbBpcbB",
        "pbBcccbbBccbB",
        "cbBcccbbBcbB.",
        "cbBcccbbBcbB.",
        ".cBBccBBBcBB."
      ],
      "tall-6": [
        "....p........",
        "....p........",
        "....pb.......",
        "....pb.......",
        "....pbB......",
        "....pbB......",
        "...pcbB......",
        "...ccbbB...p.",
        "...ccbbB..p..",
        ".p.ccbbB..pb.",
        ".p.ccbbB.pbB.",
        ".pbccbbB.cbB.",
        ".cbccbbB.cbB.",
        ".cB.ccBBBcBB."
      ],
      "tall-7": [
        ".....c.......",
        ".....c.......",
        "....cb.......",
        "....cbB......",
        "....cbbB.....",
        "....cbbB..c..",
        ".c..cbbB.cb..",
        ".cb.cbbB.cbB.",
        ".cB.cbBB.cBB."
      ],
      "tall-8": [
        ".....cb......",
        "....cbB......",
        ".cb.cbbB.cb..",
        ".cB.cbBB.cBB."
      ],
      "lean-0": [
        ".....W.....",
        ".....Wb....",
        ".W..WbB....",
        ".Wb.pbB....",
        ".pB.pBB...."
      ],
      "lean-1": [
        ".......W...",
        "......W....",
        "......p....",
        "......Wb...",
        ".....Wb....",
        ".....WbB...",
        ".....WbB...",
        "W...pcbB...",
        "W...pcbB...",
        "Wb..pcbB...",
        "WbBpcbB....",
        "pbBpcbB....",
        "pbBpcbB....",
        ".pBpcBB...."
      ],
      "lean-2": [
        ".......W...",
        ".......W...",
        ".......p...",
        "......Wb...",
        "......Wb...",
        "......Wb...",
        "......WbB..",
        ".....WbB...",
        ".....WbB...",
        ".....WcbB..",
        "....pcbB...",
        "W...pcbbB..",
        "W...pcbbB..",
        "p...pcbbB..",
        "Wb.pcbbB...",
        "Wb.pcbbB...",
        "pbBpcbbB...",
        "pbBpcbbB...",
        "pbBpcbbB...",
        "pbBpcbbB...",
        ".pBpcBBB..."
      ],
      "lean-3": [
        ".......W...",
        ".......W...",
        ".......p...",
        "......Wb...",
        "......Wb...",
        "......WbB..",
        ".....WbB...",
        ".....WcbB..",
        ".....WcbB..",
        "W...pcbB...",
        "W...pcbbB..",
        "Wb..pcbbB..",
        "Wb.pcbbB...",
        "WbBpcbbB...",
        "pbBpcbbB...",
        "pbBpcbbB...",
        "pbBpcbbB...",
        ".pBpcBBB..."
      ],
      "lean-4": [
        ".......W...",
        ".......W...",
        ".......p...",
        "......Wb...",
        "......Wb...",
        ".....WbB...",
        ".....WbB...",
        ".....WcbB..",
        "W...pcbB...",
        "W...pcbbB..",
        "Wb..pcbbB..",
        "Wb.pcbbB...",
        "WbBpcbbB...",
        "pbBpcbbB...",
        "pbBpcbbB...",
        "pbBpcbbB...",
        ".pBpcBBB..."
      ],
      "lean-5": [
        ".......p...",
        ".......p...",
        "......pb...",
        "......pb...",
        ".....pbB...",
        ".....pbB...",
        "....pcbB...",
        "....ccbB...",
        "p..ccbbB...",
        "p..ccbbB...",
        "pb.ccbbB...",
        "pbBccbbB...",
        "cbBccbbB...",
        "cbBccbbB...",
        ".cBccBBB..."
      ],
      "lean-6": [
        "......p....",
        "......p....",
        ".....pb....",
        ".....pb....",
        ".....pbB...",
        "p...ccbB...",
        ".p..ccbB...",
        "pb..ccbB...",
        ".cbccbB....",
        ".cbccbB....",
        ".cBccBB...."
      ],
      "lean-7": [
        "......c....",
        ".....cb....",
        "....cbB....",
        ".c..cbbB...",
        ".cbcbbB....",
        ".cbcbbB....",
        ".cBcbBB...."
      ],
      "lean-8": [
        ".....c.....",
        "....cb.....",
        ".cb.cbB....",
        ".cB.cBB...."
      ],
      "twin-0": [
        "..W........",
        "..Wb....W..",
        ".WbB...Wb..",
        ".pbB...pbB.",
        "..pBB..pBB."
      ],
      "twin-1": [
        ".W.........",
        ".W.........",
        ".Wb......W.",
        ".Wb......W.",
        ".WbB....Wb.",
        "pcbB...WbB.",
        "pcbB...WcbB",
        ".pcbB..pcbB",
        ".pcbB.pcbB.",
        ".pcbB.pcbB.",
        ".pcBB.pcBB."
      ],
      "twin-2": [
        ".W.........",
        ".W.........",
        ".p.........",
        "Wb.......W.",
        ".Wb......W.",
        "WbB......p.",
        "WbB.....Wb.",
        "WcbB....Wb.",
        "pcbB....WbB",
        "pcbbB...WbB",
        "pcbbB..pcbB",
        "pcbbB..pcbB",
        "pcbbB..pcbB",
        "pcbbB.pcbB.",
        "pcbbB.pcbB.",
        "pcbbB.pcbB.",
        ".pcBBBpcBB."
      ],
      "twin-3": [
        ".W.........",
        ".W.........",
        "Wb.........",
        ".Wb......W.",
        "WbB......W.",
        "WbB......Wb",
        "WcbB....Wb.",
        "pcbB....WbB",
        "pcbbB...WbB",
        "pcbbB..pcbB",
        "pcbbB..pcbB",
        "pcbbB..pcbB",
        "pcbbB.pcbB.",
        "pcbbB.pcbB.",
        ".pcBBBpcBB."
      ],
      "twin-4": [
        ".W.........",
        ".W.........",
        ".Wb........",
        ".Wb......W.",
        "WbB......W.",
        "WbB.....Wb.",
        "WcbB....Wb.",
        "pcbbB...WbB",
        "pcbbB..pcbB",
        "pcbbB..pcbB",
        "pcbbB..pcbB",
        "pcbbB.pcbB.",
        "pcbbB.pcbB.",
        ".pcBBBpcBB."
      ],
      "twin-5": [
        ".p.........",
        ".p.........",
        ".pb......p.",
        "pbB......p.",
        ".pbB....pb.",
        "pcbB...pbB.",
        "ccbbB..pbB.",
        "ccbbB..ccbB",
        "ccbbB.ccbB.",
        "ccbbB.ccbB.",
        "ccbbB.ccbB.",
        ".ccBBBccBB."
      ],
      "twin-6": [
        ".p.........",
        "..p........",
        ".pb......p.",
        ".pbB....p..",
        "pcbB....pb.",
        ".ccbB..pbB.",
        ".ccbB..cbB.",
        ".ccbB..cbB.",
        ".ccBB..cBB."
      ],
      "twin-7": [
        "..c........",
        ".cb.....c..",
        ".cbB...cb..",
        ".cbbB..cbB.",
        ".cbbB..cbB.",
        ".cbBB..cBB."
      ],
      "twin-8": [
        "..cb.......",
        ".cbB...cb..",
        "..cBB..cBB."
      ],
      "mid-0": [
        ".....W.....",
        "....Wb.....",
        ".Wb.pbB....",
        ".pB.pBB...."
      ],
      "mid-1": [
        ".....W.....",
        ".....W.....",
        ".....Wb....",
        "....WbB....",
        ".W.WcbB....",
        ".WbpcbB....",
        "WbBpcbB....",
        "pbBpcbB....",
        ".pBBcBB...."
      ],
      "mid-2": [
        ".....W.....",
        ".....W.....",
        ".....p.....",
        ".....Wb....",
        ".....Wb....",
        "....WbB....",
        "....WbB....",
        ".W.pcbB....",
        ".W.pcbB....",
        "Wb.pcbB....",
        "WbBpcbB....",
        "pbBpcbB....",
        "pbBpcbB....",
        ".pBBcBB...."
      ],
      "mid-3": [
        ".....W.....",
        ".....W.....",
        ".....Wb....",
        ".....Wb....",
        "....WbB....",
        "....WbB....",
        ".W.pcbB....",
        "Wb.pcbB....",
        ".WbpcbB....",
        "pbBpcbB....",
        "pbBpcbB....",
        ".pBBcBB...."
      ],
      "mid-4": [
        ".....W.....",
        ".....W.....",
        ".....Wb....",
        ".....Wb....",
        "....WbB....",
        ".W.pcbB....",
        "Wb.pcbB....",
        ".WbpcbB....",
        "pbBpcbB....",
        "pbBpcbB....",
        ".pBBcBB...."
      ],
      "mid-5": [
        ".....p.....",
        ".....p.....",
        ".....pb....",
        "....pbB....",
        "....pbB....",
        ".p.ccbB....",
        ".pbccbB....",
        "pbBccbB....",
        "cbBccbB....",
        ".cBBcBB...."
      ],
      "mid-6": [
        ".....p.....",
        ".....p.....",
        "....pb.....",
        ".p..pbB....",
        ".pb.cbB....",
        ".cb.cbB....",
        ".cB.cBB...."
      ],
      "mid-7": [
        ".....c.....",
        "....cb.....",
        "....cbB....",
        ".cb.cbB....",
        ".cB.cBB...."
      ],
      "mid-8": [
        "....cb.....",
        ".cB.cBB...."
      ],
      "low-0": [
        "..WbWb.",
        "..pBpB."
      ],
      "low-1": [
        "..W....",
        "..Wb.W.",
        ".WbBWb.",
        ".pbBpbB",
        "..pBpBB"
      ],
      "low-2": [
        "..W....",
        "..W....",
        ".Wb..W.",
        "..Wb.Wb",
        ".pbB.Wb",
        ".pbBpbB",
        ".pbBpbB",
        "..pBpBB"
      ],
      "low-3": [
        "..W....",
        "..W....",
        ".Wb..W.",
        ".WbB.Wb",
        ".pbBWbB",
        ".pbBpbB",
        "..pBpBB"
      ],
      "low-4": [
        "..W....",
        "..W....",
        ".Wb..W.",
        ".WbB.Wb",
        ".pbBWbB",
        ".pbBpbB",
        "..pBpBB"
      ],
      "low-5": [
        "..p....",
        ".pb....",
        "..pb.p.",
        ".cbBpb.",
        ".cbBcbB",
        "..cBcBB"
      ],
      "low-6": [
        "..p....",
        "..pb.p.",
        "..cbpb.",
        "..cBcB."
      ],
      "low-7": [
        "..c....",
        "..cbcb.",
        "..cBcB."
      ],
      "low-8": ["..cBcB."],
      "nub-0": [
        "Wb.",
        "pB."
      ],
      "nub-1": [
        ".W.",
        "Wb.",
        "WbB",
        "pbB",
        "pBB"
      ],
      "nub-2": [
        ".W.",
        ".W.",
        ".Wb",
        "WbB",
        "pbB",
        "pbB",
        "pBB"
      ],
      "nub-3": [
        ".W.",
        ".Wb",
        ".Wb",
        "pbB",
        "pbB",
        "pBB"
      ],
      "nub-4": [
        ".W.",
        ".Wb",
        "Wb.",
        "pbB",
        "pbB",
        "pBB"
      ],
      "nub-5": [
        ".p.",
        "pb.",
        "pbB",
        "cbB",
        "cBB"
      ],
      "nub-6": [
        ".p.",
        "pb.",
        "cb.",
        "cB."
      ],
      "nub-7": [
        "cb.",
        "cB."
      ],
      "nub-8": ["cB."]
    },
    "effects": {
      "frost-nova": {
        "frames": 24,
        "duration": { "from": 45, "to": 95, "ease": "in" },
        "seed": 4,
        "looks": {
          "sheet": { "colors": ["f", "g", "h"], "thresholds": [0.2, 0.5, 0.82] },
          "front": { "colors": ["B", "b", "c", "p", "W"], "thresholds": [0.16, 0.32, 0.5, 0.7, 0.88] }
        },
        "cleanup": { "corners": true, "strays": true },
        "layers": [
          {
            "kind": "burst",
            "look": "sheet",
            "at": [72, 62],
            "frames": [1, 23],
            "radius": [10, 54, 59, 60, 60],
            "squash": [1, 0.4],
            "hole": [0, 0, 0.3, 0.62, 0.9],
            "noise": 0.5,
            "scale": 7,
            "boil": 1,
            "power": [1.4, 1.4, 1.2, 0.9, 0.25],
            "ease": "linear"
          },
          {
            "kind": "ring",
            "look": "front",
            "at": [72, 62],
            "frames": [1, 11],
            "radius": [8, 60],
            "width": [9, 7, 4],
            "squash": [1, 0.4],
            "noise": [0.15, 0.4, 0.95],
            "scale": 5,
            "power": [1.6, 1.35, 0.45]
          },
          {
            "kind": "burst",
            "look": "front",
            "at": [72, 62],
            "frames": [0, 4],
            "radius": [6, 13, 7],
            "squash": [1, 0.55],
            "noise": 0.2,
            "scale": 4,
            "power": [1.6, 1.2, 0.4],
            "cue": "cast"
          },
          {
            "kind": "star",
            "look": "front",
            "at": [72, 62],
            "frames": [0, 5],
            "points": 4,
            "radius": [20, 8],
            "width": [4, 1],
            "core": 3,
            "squash": [1, 0.75],
            "power": [1.5, 0.5]
          }
        ],
        "emitters": [
          {
            "name": "crown-far",
            "at": [72, 62],
            "ring": { "radius": [51, 59], "squash": [1, 0.4], "arc": [196, 344], "even": true },
            "burst": 5,
            "start": 7,
            "speed": [0, 0],
            "life": [12, 15],
            "ground": 0,
            "play": "life",
            "shapes": [
              [
                "tall-0",
                "tall-1",
                "tall-2",
                "tall-3",
                "tall-3",
                "tall-3",
                "tall-3",
                "tall-3",
                "tall-4",
                "tall-5",
                "tall-6",
                "tall-7",
                "tall-8"
              ],
              [
                "tall-0",
                "tall-1",
                "tall-2",
                "tall-3",
                "tall-3",
                "tall-3",
                "tall-3",
                "tall-3",
                "tall-4",
                "tall-5",
                "tall-6",
                "tall-7",
                "tall-8"
              ],
              [
                "lean-0",
                "lean-1",
                "lean-2",
                "lean-3",
                "lean-3",
                "lean-3",
                "lean-3",
                "lean-3",
                "lean-4",
                "lean-5",
                "lean-6",
                "lean-7",
                "lean-8"
              ],
              [
                "twin-0",
                "twin-1",
                "twin-2",
                "twin-3",
                "twin-3",
                "twin-3",
                "twin-3",
                "twin-3",
                "twin-4",
                "twin-5",
                "twin-6",
                "twin-7",
                "twin-8"
              ]
            ]
          },
          {
            "name": "beside-far",
            "at": [72, 62],
            "ring": { "radius": [51, 59], "squash": [1, 0.4], "arc": [207, 319], "even": true },
            "burst": 4,
            "start": 8,
            "speed": [0, 0],
            "life": [12, 15],
            "ground": 0,
            "play": "life",
            "shapes": [
              [
                "mid-0",
                "mid-1",
                "mid-2",
                "mid-3",
                "mid-3",
                "mid-3",
                "mid-3",
                "mid-3",
                "mid-4",
                "mid-5",
                "mid-6",
                "mid-7",
                "mid-8"
              ],
              [
                "mid-0",
                "mid-1",
                "mid-2",
                "mid-3",
                "mid-3",
                "mid-3",
                "mid-3",
                "mid-3",
                "mid-4",
                "mid-5",
                "mid-6",
                "mid-7",
                "mid-8"
              ],
              [
                "low-0",
                "low-1",
                "low-2",
                "low-3",
                "low-3",
                "low-3",
                "low-3",
                "low-3",
                "low-4",
                "low-5",
                "low-6",
                "low-7",
                "low-8"
              ],
              [
                "twin-0",
                "twin-1",
                "twin-2",
                "twin-3",
                "twin-3",
                "twin-3",
                "twin-3",
                "twin-3",
                "twin-4",
                "twin-5",
                "twin-6",
                "twin-7",
                "twin-8"
              ]
            ]
          },
          {
            "name": "ripple-far",
            "at": [72, 62],
            "ring": { "radius": 60, "squash": [1, 0.4], "arc": [180, 360], "grow": [0.18, 0.82] },
            "rate": [2.2, 2.2, 1.6, 0],
            "start": 1,
            "end": 8,
            "ease": "out",
            "speed": [0, 0],
            "life": [5, 8],
            "ground": 0,
            "play": "life",
            "shapes": [
              [
                "mid-0",
                "mid-1",
                "mid-2",
                "mid-3",
                "mid-3",
                "mid-3",
                "mid-3",
                "mid-3",
                "mid-4",
                "mid-5",
                "mid-6",
                "mid-7",
                "mid-8"
              ],
              [
                "low-0",
                "low-1",
                "low-2",
                "low-3",
                "low-3",
                "low-3",
                "low-3",
                "low-3",
                "low-4",
                "low-5",
                "low-6",
                "low-7",
                "low-8"
              ],
              [
                "low-0",
                "low-1",
                "low-2",
                "low-3",
                "low-3",
                "low-3",
                "low-3",
                "low-3",
                "low-4",
                "low-5",
                "low-6",
                "low-7",
                "low-8"
              ],
              [
                "nub-0",
                "nub-1",
                "nub-2",
                "nub-3",
                "nub-3",
                "nub-3",
                "nub-3",
                "nub-3",
                "nub-4",
                "nub-5",
                "nub-6",
                "nub-7",
                "nub-8"
              ],
              [
                "nub-0",
                "nub-1",
                "nub-2",
                "nub-3",
                "nub-3",
                "nub-3",
                "nub-3",
                "nub-3",
                "nub-4",
                "nub-5",
                "nub-6",
                "nub-7",
                "nub-8"
              ]
            ]
          },
          {
            "name": "ripple-near",
            "at": [72, 62],
            "ring": { "radius": 60, "squash": [1, 0.4], "arc": [0, 180], "grow": [0.18, 0.82] },
            "rate": [2.2, 2.2, 1.6, 0],
            "start": 1,
            "end": 8,
            "ease": "out",
            "speed": [0, 0],
            "life": [5, 8],
            "ground": 0,
            "play": "life",
            "shapes": [
              [
                "mid-0",
                "mid-1",
                "mid-2",
                "mid-3",
                "mid-3",
                "mid-3",
                "mid-3",
                "mid-3",
                "mid-4",
                "mid-5",
                "mid-6",
                "mid-7",
                "mid-8"
              ],
              [
                "low-0",
                "low-1",
                "low-2",
                "low-3",
                "low-3",
                "low-3",
                "low-3",
                "low-3",
                "low-4",
                "low-5",
                "low-6",
                "low-7",
                "low-8"
              ],
              [
                "low-0",
                "low-1",
                "low-2",
                "low-3",
                "low-3",
                "low-3",
                "low-3",
                "low-3",
                "low-4",
                "low-5",
                "low-6",
                "low-7",
                "low-8"
              ],
              [
                "nub-0",
                "nub-1",
                "nub-2",
                "nub-3",
                "nub-3",
                "nub-3",
                "nub-3",
                "nub-3",
                "nub-4",
                "nub-5",
                "nub-6",
                "nub-7",
                "nub-8"
              ],
              [
                "nub-0",
                "nub-1",
                "nub-2",
                "nub-3",
                "nub-3",
                "nub-3",
                "nub-3",
                "nub-3",
                "nub-4",
                "nub-5",
                "nub-6",
                "nub-7",
                "nub-8"
              ]
            ]
          },
          {
            "name": "beside-near",
            "at": [72, 62],
            "ring": { "radius": [51, 59], "squash": [1, 0.4], "arc": [28, 138], "even": true },
            "burst": 4,
            "start": 8,
            "speed": [0, 0],
            "life": [12, 15],
            "ground": 0,
            "play": "life",
            "shapes": [
              [
                "mid-0",
                "mid-1",
                "mid-2",
                "mid-3",
                "mid-3",
                "mid-3",
                "mid-3",
                "mid-3",
                "mid-4",
                "mid-5",
                "mid-6",
                "mid-7",
                "mid-8"
              ],
              [
                "mid-0",
                "mid-1",
                "mid-2",
                "mid-3",
                "mid-3",
                "mid-3",
                "mid-3",
                "mid-3",
                "mid-4",
                "mid-5",
                "mid-6",
                "mid-7",
                "mid-8"
              ],
              [
                "low-0",
                "low-1",
                "low-2",
                "low-3",
                "low-3",
                "low-3",
                "low-3",
                "low-3",
                "low-4",
                "low-5",
                "low-6",
                "low-7",
                "low-8"
              ],
              [
                "twin-0",
                "twin-1",
                "twin-2",
                "twin-3",
                "twin-3",
                "twin-3",
                "twin-3",
                "twin-3",
                "twin-4",
                "twin-5",
                "twin-6",
                "twin-7",
                "twin-8"
              ]
            ]
          },
          {
            "name": "crown-near",
            "at": [72, 62],
            "ring": { "radius": [51, 59], "squash": [1, 0.4], "arc": [14, 166], "even": true },
            "burst": 5,
            "start": 8,
            "speed": [0, 0],
            "life": [12, 15],
            "ground": 0,
            "play": "life",
            "shapes": [
              [
                "tall-0",
                "tall-1",
                "tall-2",
                "tall-3",
                "tall-3",
                "tall-3",
                "tall-3",
                "tall-3",
                "tall-4",
                "tall-5",
                "tall-6",
                "tall-7",
                "tall-8"
              ],
              [
                "tall-0",
                "tall-1",
                "tall-2",
                "tall-3",
                "tall-3",
                "tall-3",
                "tall-3",
                "tall-3",
                "tall-4",
                "tall-5",
                "tall-6",
                "tall-7",
                "tall-8"
              ],
              [
                "lean-0",
                "lean-1",
                "lean-2",
                "lean-3",
                "lean-3",
                "lean-3",
                "lean-3",
                "lean-3",
                "lean-4",
                "lean-5",
                "lean-6",
                "lean-7",
                "lean-8"
              ],
              [
                "twin-0",
                "twin-1",
                "twin-2",
                "twin-3",
                "twin-3",
                "twin-3",
                "twin-3",
                "twin-3",
                "twin-4",
                "twin-5",
                "twin-6",
                "twin-7",
                "twin-8"
              ]
            ]
          },
          {
            "name": "chips",
            "at": [72, 62],
            "ring": { "radius": 60, "squash": [1, 0.4], "grow": [0.2, 1], "outward": true },
            "rate": [3, 3, 2, 0],
            "start": 1,
            "end": 10,
            "ease": "out",
            "angle": [-25, 25],
            "speed": [0.8, 1.8],
            "kick": [0, -1.6],
            "gravity": [0, 0.3],
            "ground": 0,
            "life": [4, 7],
            "play": "life",
            "shapes": [["fleck", "fleck", "fleck-dim"], ["glint-1", "fleck", "fleck-dim"]],
            "trail": { "color": "b", "length": 1 }
          },
          {
            "name": "glints",
            "at": [72, 62],
            "ring": { "radius": [10, 56], "squash": [1, 0.4], "fill": true },
            "rate": [0, 1.6, 1.6, 1.2, 0.8, 0],
            "start": 2,
            "end": 18,
            "angle": [255, 285],
            "speed": [0.3, 0.9],
            "drag": 0.03,
            "life": [4, 6],
            "play": "life",
            "shapes": [
              ["glint-1", "glint-3", "glint-5", "glint-3", "glint-1"],
              ["glint-1", "glint-3", "glint-1"],
              ["fleck", "glint-3", "fleck", "fleck-dim"]
            ]
          }
        ]
      }
    }
  },
  // A character arriving: two circles draw in to the spot while light gathers from round about, a thread of light
  // stands up and thickens into a column, the column flashes (the `arrive` cue, where a game shows the character),
  // and it bursts away in rays while a ring runs out over the ground. The column runs off the top edge: a beam's far
  // end is round, and a column of light has no cap. `wobble: 0` keeps its sides straight.
  'teleport-in': {
    "format": "pixelforge-fx",
    "version": 1,
    "name": "teleport-in",
    "width": 96,
    "height": 128,
    "anchor": [48, 110],
    "palette": {
      "W": "#ffffff",
      "y": "#e4fbff",
      "c": "#9be8ff",
      "b": "#49b8f0",
      "v": "#5a6cf0",
      "d": "#3a3aa8",
      "s": "#49b8f040",
      "t": "#7fd8ff66",
      "u": "#c8f4ff99"
    },
    "symbols": {
      "mote": ["c"],
      "mote-hot": ["W"],
      "mote-dim": ["v"],
      "glint-3": [
        ".c.",
        "cWc",
        ".c."
      ],
      "glint-5": [
        "..c..",
        "..y..",
        "cyWyc",
        "..y..",
        "..c.."
      ],
      "dash": [
        "W",
        "y",
        "c"
      ],
      "dash-dim": [
        "c",
        "b"
      ],
      "bit": ["y"]
    },
    "effects": {
      "teleport-in": {
        "frames": 23,
        "duration": 60,
        "seed": 7,
        "edges": ["top"],
        "looks": {
          "floor": { "colors": ["d", "v", "b", "c", "W"], "thresholds": [0.14, 0.3, 0.48, 0.68, 0.88] },
          "shaft": { "colors": ["s", "t", "u"], "thresholds": [0.14, 0.4, 0.7] },
          "core": { "colors": ["b", "c", "y", "W"], "thresholds": [0.3, 0.5, 0.7, 0.88] }
        },
        "cleanup": { "corners": true, "strays": true },
        "layers": [
          {
            "kind": "ring",
            "look": "floor",
            "at": [48, 110],
            "frames": [0, 12],
            "radius": [42, 15],
            "width": [2, 3, 5],
            "squash": [1, 0.36],
            "noise": [0.5, 0.1],
            "scale": 5,
            "power": [0.9, 1.2, 1.5],
            "ease": "in"
          },
          {
            "kind": "ring",
            "look": "floor",
            "at": [48, 110],
            "frames": [2, 11],
            "radius": [28, 7],
            "width": [2, 3],
            "squash": [1, 0.36],
            "noise": [0.4, 0.1],
            "scale": 5,
            "power": [0.7, 1.3],
            "ease": "in"
          },
          {
            "kind": "burst",
            "look": "floor",
            "at": [48, 110],
            "frames": [6, 17],
            "radius": [6, 14, 19, 12],
            "squash": [1, 0.36],
            "noise": 0.25,
            "scale": 4,
            "boil": 2,
            "power": [0.9, 1.4, 1.6, 0.5],
            "ease": "linear"
          },
          {
            "kind": "beam",
            "look": "shaft",
            "at": [48, 110],
            "to": [48, -28],
            "frames": [2, 12],
            "width": [2, 6, 10, 15, 22],
            "reveal": 0.3,
            "fade": 0.7,
            "wobble": 0,
            "power": [0.8, 1, 1.1, 1.2],
            "ease": "linear",
            "squash": [1, 0.36]
          },
          {
            "kind": "beam",
            "look": "core",
            "at": [48, 110],
            "to": [48, -28],
            "frames": [2, 12],
            "width": [1, 2, 4, 7, 11],
            "reveal": 0.3,
            "fade": 0.55,
            "wobble": 0.06,
            "wavelength": 28,
            "waves": -2,
            "power": [1, 1.1, 1.2, 1.3],
            "ease": "linear",
            "squash": [1, 0.36]
          },
          {
            "kind": "beam",
            "look": "shaft",
            "at": [48, 110],
            "to": [48, -28],
            "frames": [12, 16],
            "width": [36, 40, 22, 8],
            "fade": 0.7,
            "wobble": 0,
            "noise": [0, 0.2, 0.7],
            "scale": 5,
            "power": [1.5, 1.3, 0.8, 0.35],
            "ease": "linear",
            "squash": [1, 0.36]
          },
          {
            "kind": "beam",
            "look": "core",
            "at": [48, 110],
            "to": [48, -28],
            "frames": [12, 16],
            "width": [24, 20, 7, 2],
            "fade": 0.55,
            "wobble": 0,
            "noise": [0, 0.2, 0.8],
            "scale": 4,
            "power": [1.8, 1.5, 1, 0.5],
            "ease": "linear",
            "squash": [1, 0.36]
          },
          {
            "kind": "star",
            "look": "core",
            "at": [48, 78],
            "frames": [12, 16],
            "points": 8,
            "ratio": 0.7,
            "radius": [38, 14],
            "width": [5, 1],
            "core": [5, 1],
            "power": [1.7, 0.5],
            "cue": "arrive"
          },
          {
            "kind": "ring",
            "look": "floor",
            "at": [48, 110],
            "frames": [13, 22],
            "radius": [12, 45],
            "width": [7, 3],
            "squash": [1, 0.36],
            "noise": [0.2, 0.95],
            "scale": 5,
            "power": [1.6, 0.35]
          }
        ],
        "emitters": [
          {
            "name": "gather",
            "at": [48, 78],
            "ring": { "radius": [34, 46] },
            "rate": [5, 5, 4, 0],
            "start": 0,
            "end": 10,
            "speed": [0, 0.4],
            "attract": { "at": [48, 92], "strength": 0.6, "swirl": 0.3 },
            "drag": 0.1,
            "life": [6, 9],
            "play": "life",
            "shapes": [["mote", "mote", "mote-hot", "mote-hot"], ["mote-dim", "mote", "mote", "glint-3"]],
            "trail": { "color": "b", "length": 3 }
          },
          {
            "name": "rise",
            "at": [42, 108],
            "line": { "to": [54, 108] },
            "rate": [1, 2.5, 3, 0],
            "start": 4,
            "end": 14,
            "angle": [269, 271],
            "speed": [3.5, 6],
            "life": [5, 8],
            "play": "life",
            "shapes": [["dash", "dash", "dash-dim"], ["dash-dim", "dash", "dash-dim"]]
          },
          {
            "name": "rays",
            "at": [48, 78],
            "ring": { "radius": [3, 7], "arc": [152, 388], "even": true, "outward": true },
            "burst": 14,
            "start": 12,
            "angle": [-7, 7],
            "speed": [6.5, 12],
            "drag": 0.2,
            "life": [5, 8],
            "shapes": ["bit"],
            "tint": [{}, { "y": "W" }, {}, { "y": "c" }, { "y": "b" }, { "y": "v" }],
            "trail": { "color": "b", "length": 3 }
          },
          {
            "name": "scatter",
            "at": [48, 100],
            "line": { "to": [48, 34] },
            "burst": 14,
            "start": 13,
            "angle": [198, 342],
            "speed": [1.4, 3.8],
            "drag": 0.1,
            "gravity": [0, -0.03],
            "life": [6, 9],
            "play": "life",
            "shapes": [
              ["mote-hot", "mote", "mote", "mote-dim"],
              ["mote-hot", "glint-3", "mote", "mote-dim"],
              ["dash", "dash-dim", "mote-dim"]
            ]
          },
          {
            "name": "after",
            "at": [48, 84],
            "area": [48, 60],
            "rate": [0, 2.2, 1.6, 0],
            "start": 13,
            "end": 17,
            "angle": [262, 278],
            "speed": [0.3, 0.9],
            "life": [4, 6],
            "play": "life",
            "shapes": [
              ["mote", "glint-3", "glint-5", "glint-3", "mote-dim"],
              ["mote", "glint-3", "mote-dim"],
              ["mote-hot", "mote", "mote-dim"]
            ]
          }
        ]
      }
    }
  },
  // A coin picked up: a white star for two frames, a gold ring that breaks into dashes, and sparkles thrown out
  // that hang and twinkle as they go out. The sparkles are `behind`, so the ones born inside the flash come out from
  // under it instead of speckling its white middle.
  'coin-sparkle': {
    "format": "pixelforge-fx",
    "version": 1,
    "name": "coin-sparkle",
    "width": 64,
    "height": 64,
    "anchor": [32, 34],
    "palette": { "W": "#ffffff", "y": "#fff3b0", "g": "#ffd23f", "o": "#f59b1c" },
    "symbols": {
      "tw-1": ["y"],
      "tw-1d": ["o"],
      "tw-3": [
        ".g.",
        "gWg",
        ".g."
      ],
      "tw-5": [
        "..g..",
        "..y..",
        "gyWyg",
        "..y..",
        "..g.."
      ],
      "tw-7": [
        "...o...",
        "...g...",
        "..gyg..",
        "ogyWygo",
        "..gyg..",
        "...g...",
        "...o..."
      ],
      "tw-9": [
        "....o....",
        "....g....",
        "....y....",
        "...gWg...",
        "ogyWWWygo",
        "...gWg...",
        "....y....",
        "....g....",
        "....o...."
      ]
    },
    "effects": {
      "coin-sparkle": {
        "frames": 14,
        "duration": { "from": 40, "to": 75, "ease": "in" },
        "seed": 2,
        "looks": { "flash": { "colors": ["o", "g", "y", "W"], "thresholds": [0.22, 0.4, 0.62, 0.86] } },
        "cleanup": { "corners": true, "strays": true },
        "layers": [
          {
            "kind": "star",
            "look": "flash",
            "at": [32, 34],
            "frames": [0, 4],
            "points": 8,
            "ratio": 0.42,
            "radius": [13, 24, 9],
            "width": [5, 2],
            "core": [4, 1],
            "power": [1.7, 1.5, 0.6],
            "cue": "grab"
          },
          {
            "kind": "burst",
            "look": "flash",
            "at": [32, 34],
            "frames": [0, 4],
            "radius": [5, 8, 4],
            "noise": 0.15,
            "scale": 4,
            "power": [1.6, 1.2, 0.4]
          },
          {
            "kind": "ring",
            "look": "flash",
            "at": [32, 34],
            "frames": [1, 8],
            "radius": [5, 26],
            "width": [3, 2],
            "noise": [0.1, 0.95],
            "scale": 4,
            "power": [1.5, 0.35]
          }
        ],
        "emitters": [
          {
            "name": "thrown",
            "at": [32, 34],
            "ring": { "radius": [4, 6], "even": true, "outward": true },
            "burst": 8,
            "start": 1,
            "behind": true,
            "angle": [-12, 12],
            "speed": [3, 5],
            "drag": 0.2,
            "kick": [0, -0.5],
            "life": [9, 12],
            "play": "life",
            "shapes": [
              ["tw-3", "tw-7", "tw-9", "tw-7", "tw-9", "tw-7", "tw-5", "tw-3", "tw-1"],
              ["tw-3", "tw-5", "tw-7", "tw-5", "tw-7", "tw-5", "tw-3", "tw-1", "tw-1d"]
            ]
          },
          {
            "name": "between",
            "at": [32, 34],
            "ring": { "radius": [3, 5], "even": true, "outward": true },
            "burst": 7,
            "start": 2,
            "behind": true,
            "angle": [10, 40],
            "speed": [1.6, 3.4],
            "drag": 0.2,
            "kick": [0, -0.4],
            "life": [7, 10],
            "play": "life",
            "shapes": [
              ["tw-1", "tw-3", "tw-5", "tw-3", "tw-5", "tw-3", "tw-1", "tw-1d"],
              ["tw-1", "tw-3", "tw-1", "tw-3", "tw-1", "tw-1d"]
            ]
          },
          {
            "name": "glitter",
            "at": [32, 34],
            "ring": { "radius": [8, 22], "fill": true },
            "rate": [0, 1.2, 1, 0],
            "start": 5,
            "end": 9,
            "speed": [0, 0.2],
            "life": [3, 5],
            "play": "life",
            "shapes": [["tw-1", "tw-3", "tw-5", "tw-3", "tw-1"], ["tw-1", "tw-3", "tw-1"]]
          }
        ]
      }
    }
  }
};
