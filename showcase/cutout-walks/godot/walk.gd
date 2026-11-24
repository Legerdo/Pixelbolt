extends Node2D

const NAMES := ["dwarf", "demon"]
@onready var actor: AnimatedSprite2D = $Character
var actor_name := ""
var facing := "down"
var ground_position := Vector2(120, 90)
var atlas: Dictionary

func _ready() -> void:
	select_character(0)

func select_character(index: int) -> void:
	actor_name = NAMES[index]
	var base := "res://characters/%s/%s" % [actor_name, actor_name]
	actor.sprite_frames = load(base + ".tres")
	atlas = JSON.parse_string(FileAccess.get_file_as_string(base + ".atlas.json"))
	play_clip("stand-" + facing)
	actor.position = ground_position.round()

func play_clip(clip: String) -> void:
	actor.play(clip)
	var frame_name: String = atlas.animations[clip].frames[actor.frame]
	var pivot: Dictionary = atlas.frames[frame_name].anchorPx
	actor.offset = -Vector2(pivot.x, pivot.y)

func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.keycode in [KEY_1, KEY_2]:
		select_character(event.keycode - KEY_1)

func _physics_process(delta: float) -> void:
	var movement := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	if movement == Vector2.ZERO:
		play_clip("stand-" + facing)
		return
	var horizontal := absf(movement.x) > absf(movement.y)
	if horizontal:
		facing = "right" if movement.x > 0 else "left"
	else:
		facing = "down" if movement.y > 0 else "up"
	play_clip("walk-" + facing)
	var stride := 2 if horizontal and actor_name == "demon" else 1
	var frame_ms: float = atlas.frames[atlas.animations[actor.animation].frames[0]].duration
	var speed := 500.0 * stride / frame_ms
	ground_position = (ground_position + movement * speed * delta).clamp(Vector2(22, 44), get_viewport_rect().size - Vector2(22, 4))
	actor.position = ground_position.round()
