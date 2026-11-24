extends SceneTree

var failures: Array[String] = []
var seen: Dictionary = {}

func _initialize() -> void:
	check.call_deferred()

func expect(passed: bool, why: String) -> void:
	if not passed:
		failures.append(why)

func check() -> void:
	var scene = load("res://walk.tscn").instantiate()
	root.add_child(scene)
	await process_frame
	var actor: AnimatedSprite2D = scene.get_node("Character")
	actor.frame_changed.connect(func(): seen[actor.frame] = true)
	for index in 2:
		var key := InputEventKey.new()
		key.keycode = KEY_1 + index
		key.pressed = true
		scene._unhandled_key_input(key)
		var who: String = ["dwarf", "demon"][index]
		var pivot: Vector2 = [Vector2(12, 32), Vector2(20, 40)][index]
		var size_px: Vector2 = [Vector2(24, 36), Vector2(40, 44)][index]
		var ms: int = [100, 125][index]
		expect(actor.sprite_frames.resource_path.ends_with(who + ".tres"), who + " selection")
		for facing in ["down", "right", "up", "left"]:
			var action := "ui_" + str(facing)
			var clip := "walk-" + str(facing)
			var before := actor.position
			Input.action_press(action)
			for i in 12:
				await physics_frame
			expect(actor.animation == clip, who + "/" + clip + " input")
			expect(actor.sprite_frames.get_frame_count(clip) == 8 and actor.sprite_frames.get_animation_loop(clip), clip + " loop")
			for i in 8:
				var texture := actor.sprite_frames.get_frame_texture(clip, i)
				expect(texture.get_size() == size_px, clip + " size")
				expect(absf(1000.0 * actor.sprite_frames.get_frame_duration(clip, i) / actor.sprite_frames.get_animation_speed(clip) - ms) < 0.001, clip + " timing")
			# Observe a whole loop in the engine, from its seam back to its seam.
			await actor.animation_looped
			seen = {0: true}
			await actor.animation_looped
			expect(seen.size() == 8, clip + " displayed frames")
			expect(actor.position != before and actor.offset == -pivot, clip + " travel/pivot")
			Input.action_release(action)
			await physics_frame
			await physics_frame
			var stopped := actor.position
			expect(actor.animation == "stand-" + str(facing) and actor.sprite_frames.get_frame_count(actor.animation) == 1, clip + " stop")
			for i in 4:
				await physics_frame
			expect(actor.position == stopped and actor.offset == -pivot, clip + " standing anchor")
	print(JSON.stringify({"characters":2,"walks":8,"standing":8,"failures":failures}))
	quit(0 if failures.is_empty() else 1)
