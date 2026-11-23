# Looks a Pixelbolt SpriteFrames up by heading. A recipe's `headings` (a sprite stack's turn, and its animations at
# each heading) are exported as the resource's "headings" metadata; these read it. No node or autoload is needed:
#
#   const Headings := preload("res://addons/pixelbolt/headings.gd")
#   var facing := Headings.toward(sprite.sprite_frames, velocity, &"walk")
#   sprite.play(Headings.animation(sprite.sprite_frames, &"walk", facing))
#
# A heading is a whole number of degrees from 0 to 359. Every function returns its "none" value (-1, [] or &"") for a
# SpriteFrames without the metadata or a name it does not list, so a missing lookup never raises an error.
extends RefCounted

# The headings listed for the still frames, or with a name ("walk") for that animation.
static func _listed(frames: SpriteFrames, name: StringName) -> Dictionary:
	var meta: Dictionary = frames.get_meta("headings", {})
	if name == &"":
		return meta.get("frames", {})
	return meta.get("animations", {}).get(String(name), {})

# The listed heading nearest `degrees`, which may be any number: headings go round at 360. Of two equally near, the
# lower. -1 when none is listed.
static func nearest(frames: SpriteFrames, degrees: float, name: StringName = &"") -> int:
	var at := fposmod(degrees, 360.0)
	var best := -1
	var least := INF
	var keys := _listed(frames, name).keys()
	keys.sort()
	for heading in keys:
		var apart := absf(float(heading) - at)
		var gap := minf(apart, 360.0 - apart)
		if gap < least:
			least = gap
			best = heading
	return best

# The still frame at the heading nearest `degrees`, as [animation, frame index]: stop the sprite, then set its
# `animation` and `frame` to these. [] when none is listed.
static func frame(frames: SpriteFrames, degrees: float) -> Array:
	return _listed(frames, &"").get(nearest(frames, degrees), [])

# The animation that plays `name` at the heading nearest `degrees`: &"walk" at 270 is &"walk-se". &"" when none is.
static func animation(frames: SpriteFrames, name: StringName, degrees: float) -> StringName:
	return _listed(frames, name).get(nearest(frames, degrees, name), &"")

# The heading at which the subject faces most nearly along `direction` on screen (y down): the way it moves, or from
# a turret to its target. Of the still frames' headings, or of an animation's. -1 for a zero direction, or when the
# resource does not say which way its headings face.
static func toward(frames: SpriteFrames, direction: Vector2, name: StringName = &"") -> int:
	var faces: Dictionary = frames.get_meta("headings", {}).get("toward", {})
	if direction == Vector2.ZERO:
		return -1
	var best := -1
	var most := -INF
	var keys := _listed(frames, name).keys()
	keys.sort()
	for heading in keys:
		if not faces.has(heading):
			continue
		var along: float = (faces[heading] as Vector2).dot(direction)
		if along > most:
			most = along
			best = heading
	return best
