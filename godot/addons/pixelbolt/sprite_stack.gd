# Draws a sprite stack from its slices, turned to any heading as the game runs. Export the slices with
# `pixelbolt compile car.stack.json --slices --out car-slices.pixel.json`, which the addon imports as a SpriteFrames
# whose "slices" animation lists them, ground first. Attach this script to a Node2D and give it that SpriteFrames:
#
#   $Car.sprite_frames = preload("res://car-slices.pixel.json")
#   $Car.heading = rad_to_deg(velocity.angle())
#
# The node's position is the stack's pivot on the ground. Each slice is drawn `rise` pixels above the one below, once
# for each of those pixels and once more at its top so the sides are solid, so a tall stack at a large rise costs that many draws. Set the
# node's Texture → Filter to Nearest (or the project's default) to keep the pixels square.
@tool
extends Node2D

## The slices, as imported from a slice sheet: its "slices" animation, ground first.
@export var sprite_frames: SpriteFrames:
	set(value):
		sprite_frames = value
		queue_redraw()

## Degrees, turning as the stack's baked frames do. An isometric baked heading h is this heading h + 45.
@export var heading := 0.0:
	set(value):
		heading = value
		queue_redraw()

## Pixels from one slice up to the next, in the node's own units. Scale the node to enlarge the whole stack.
@export_range(1, 64) var rise := 1:
	set(value):
		rise = value
		queue_redraw()

## How far the ground is flattened: 1 looks straight down, 0.5 is the 2:1 of an isometric view.
@export_range(0.05, 1.0) var squash := 1.0:
	set(value):
		squash = value
		queue_redraw()

## The point of a slice the stack turns about. (-1, -1) takes it from the sheet, or else the slice's middle.
@export var pivot := Vector2(-1, -1):
	set(value):
		pivot = value
		queue_redraw()

const SLICES := &"slices"

# The point the slices turn about, in a slice's own pixels.
func origin() -> Vector2:
	if pivot.x >= 0.0 and pivot.y >= 0.0:
		return pivot
	if sprite_frames == null or not sprite_frames.has_animation(SLICES) or sprite_frames.get_frame_count(SLICES) == 0:
		return Vector2.ZERO
	if sprite_frames.has_meta("stack_pivot"):
		return sprite_frames.get_meta("stack_pivot")
	return sprite_frames.get_frame_texture(SLICES, 0).get_size() / 2.0

# The ground of the stack as drawn: turned to the heading, then flattened.
func ground() -> Transform2D:
	return Transform2D(Vector2(1, 0), Vector2(0, squash), Vector2.ZERO) * Transform2D(deg_to_rad(heading), Vector2.ZERO)

# A pixel's centre can fall exactly on the line between two slice pixels (a pivot at a pixel's centre, a squashed
# slice). A baked frame settles each one: across, it takes the slice pixel further along the slice's own axis, and down,
# the one above, with nothing under a side's last line. So the slices are moved a part of a pixel, less than any centre
# is from a line it is not on: back along the slice's axis, and down, except the copy that stands on the level below,
# which is moved up. Lines repeat every 1/d of a pixel, d the least count of slice pixels that is whole pixels. As
# `drawStack` in player.js.
func nudge() -> Vector2:
	var d := 1
	while d < 8 and absf(squash * d - roundf(squash * d)) > 1e-9:
		d += 1
	# At the quarter turns nearest 90 and 180 degrees the slice's axis across the screen runs right to left.
	var along := -1.0 if posmod(roundi(heading / 90.0), 4) in [1, 2] else 1.0
	return Vector2(-along / 4.0, 1.0 / (4.0 * d))

func _draw() -> void:
	if sprite_frames == null or not sprite_frames.has_animation(SLICES):
		return
	var at := origin()
	var flat := ground()
	var moved := nudge()
	for level in sprite_frames.get_frame_count(SLICES):
		var texture := sprite_frames.get_frame_texture(SLICES, level)
		# A slice is `rise` pixels thick, from its own level up to the next slice's: a copy at each, both ends counted.
		for step in rise + 1:
			draw_set_transform_matrix(Transform2D(flat.x, flat.y, Vector2(moved.x, (moved.y if step else -moved.y) - (level * rise + step))))
			draw_texture(texture, -at)
	draw_set_transform_matrix(Transform2D.IDENTITY)
