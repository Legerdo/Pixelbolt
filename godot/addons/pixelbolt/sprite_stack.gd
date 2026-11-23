# Draws a sprite stack from its slices, turned to any heading as the game runs. Export the slices with
# `pixelbolt compile car.stack.json --slices --out car-slices.pixel.json`, which the addon imports as a SpriteFrames
# whose "slices" animation lists them, ground first. Attach this script to a Node2D and give it that SpriteFrames:
#
#   $Car.sprite_frames = preload("res://car-slices.pixel.json")
#   $Car.heading = rad_to_deg(velocity.angle())
#
# The node's position is the stack's pivot on the ground. Each slice is drawn `rise` pixels above the one below, once
# for each of those pixels so the sides are solid, so a tall stack at a large rise costs that many draws. Set the
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

func _draw() -> void:
	if sprite_frames == null or not sprite_frames.has_animation(SLICES):
		return
	var at := origin()
	var flat := ground()
	# Half a pixel on where the pivot is a pixel's centre, so an unturned slice's pixels fall on whole pixels.
	var half := Vector2(fposmod(at.x, 1.0), fposmod(at.y, 1.0))
	for level in sprite_frames.get_frame_count(SLICES):
		var texture := sprite_frames.get_frame_texture(SLICES, level)
		for step in rise:
			draw_set_transform_matrix(Transform2D(flat.x, flat.y, half + Vector2(0, -(level * rise + step))))
			draw_texture(texture, -at)
	draw_set_transform_matrix(Transform2D.IDENTITY)
