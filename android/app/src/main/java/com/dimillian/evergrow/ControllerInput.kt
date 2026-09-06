package com.dimillian.evergrow

import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import org.json.JSONArray
import org.json.JSONObject

/** One standard snapshot feeds the same tested TypeScript input owner as browser controllers. */
class ControllerInput {
    private var deviceId = -1
    private val axes = FloatArray(4)
    private val buttons = FloatArray(16)
    private val delivered = FloatArray(16)
    private val edges = ArrayDeque<Pair<Int, Float>>()
    private val keys = mapOf(KeyEvent.KEYCODE_BUTTON_A to 0, KeyEvent.KEYCODE_BUTTON_B to 1,
        KeyEvent.KEYCODE_BUTTON_X to 2, KeyEvent.KEYCODE_BUTTON_Y to 3, KeyEvent.KEYCODE_BUTTON_L1 to 4,
        KeyEvent.KEYCODE_BUTTON_R1 to 5, KeyEvent.KEYCODE_BUTTON_L2 to 6, KeyEvent.KEYCODE_BUTTON_R2 to 7,
        KeyEvent.KEYCODE_BUTTON_SELECT to 8, KeyEvent.KEYCODE_BUTTON_START to 9,
        KeyEvent.KEYCODE_BUTTON_THUMBL to 10, KeyEvent.KEYCODE_BUTTON_THUMBR to 11,
        KeyEvent.KEYCODE_DPAD_UP to 12, KeyEvent.KEYCODE_DPAD_DOWN to 13,
        KeyEvent.KEYCODE_DPAD_LEFT to 14, KeyEvent.KEYCODE_DPAD_RIGHT to 15)
    private fun isController(device: InputDevice?) = device != null &&
        (device.supportsSource(InputDevice.SOURCE_GAMEPAD) || device.supportsSource(InputDevice.SOURCE_JOYSTICK))
    @Synchronized fun key(event: KeyEvent): Boolean {
        if (!isController(event.device)) return false
        val index = keys[event.keyCode] ?: return false
        if (event.action != KeyEvent.ACTION_DOWN && event.action != KeyEvent.ACTION_UP) return false
        select(event.deviceId)
        if (event.repeatCount == 0) button(index, if (event.action == KeyEvent.ACTION_DOWN) 1f else 0f)
        return true
    }
    @Synchronized fun motion(event: MotionEvent): Boolean {
        if (!event.isFromSource(InputDevice.SOURCE_JOYSTICK) || event.action != MotionEvent.ACTION_MOVE) return false
        select(event.deviceId)
        axes[0] = axis(event, MotionEvent.AXIS_X); axes[1] = axis(event, MotionEvent.AXIS_Y)
        axes[2] = axis(event, MotionEvent.AXIS_Z); axes[3] = axis(event, MotionEvent.AXIS_RZ)
        if(hasAxis(event, MotionEvent.AXIS_LTRIGGER) || hasAxis(event, MotionEvent.AXIS_BRAKE)) button(6, maxOf(event.getAxisValue(MotionEvent.AXIS_LTRIGGER),event.getAxisValue(MotionEvent.AXIS_BRAKE)).coerceIn(0f,1f))
        if(hasAxis(event, MotionEvent.AXIS_RTRIGGER) || hasAxis(event, MotionEvent.AXIS_GAS)) button(7, maxOf(event.getAxisValue(MotionEvent.AXIS_RTRIGGER),event.getAxisValue(MotionEvent.AXIS_GAS)).coerceIn(0f,1f))
        val x = event.getAxisValue(MotionEvent.AXIS_HAT_X); val y = event.getAxisValue(MotionEvent.AXIS_HAT_Y)
        if(hasAxis(event, MotionEvent.AXIS_HAT_Y)) { button(12, if (y < -.5) 1f else 0f); button(13, if (y > .5) 1f else 0f) }
        if(hasAxis(event, MotionEvent.AXIS_HAT_X)) { button(14, if (x < -.5) 1f else 0f); button(15, if (x > .5) 1f else 0f) }
        return true
    }
    private fun hasAxis(event: MotionEvent, axis: Int) = event.device?.getMotionRange(axis, event.source) != null
    private fun axis(event: MotionEvent, axis: Int): Float {
        val range = event.device?.getMotionRange(axis, event.source) ?: return 0f
        if (range.range <= 0) return 0f
        return (((event.getAxisValue(axis) - range.min) / range.range) * 2 - 1).coerceIn(-1f,1f)
    }
    private fun select(id: Int) { if(deviceId != id) { reset(); deviceId = id } }
    private fun button(index: Int, value: Float) {
        if ((buttons[index] > .55f) != (value > .55f)) {
            if(edges.size >= 128) { edges.clear(); buttons.copyInto(delivered) }
            edges.addLast(index to value)
        }
        buttons[index] = value
    }
    /** Preserve physical held state on phase changes so neutral rearm still works. */
    @Synchronized fun clearEdges() { edges.clear(); buttons.copyInto(delivered) }
    @Synchronized fun reset() { axes.fill(0f); buttons.fill(0f); delivered.fill(0f); edges.clear() }
    @Synchronized fun snapshot(): String {
        if (InputDevice.getDevice(deviceId) == null) { reset(); deviceId = -1 }
        if (deviceId < 0) deviceId = InputDevice.getDeviceIds().firstOrNull { isController(InputDevice.getDevice(it)) } ?: -1
        val device = InputDevice.getDevice(deviceId) ?: return "null"
        // Keep a quick down/up pair visible across polls instead of losing short taps.
        val seen = mutableSetOf<Int>()
        while(edges.isNotEmpty() && !seen.contains(edges.first().first)) {
            val (index,value) = edges.removeFirst(); delivered[index] = value; seen.add(index)
        }
        val buttonJSON = JSONArray()
        for(i in buttons.indices) {
            val value = if (edges.any { it.first == i }) delivered[i] else buttons[i]
            buttonJSON.put(JSONObject().put("pressed",value > .55f).put("value",value.toDouble()))
        }
        return JSONObject().put("index",0).put("id","android:${device.id}:${device.name}")
            .put("connected",true).put("mapping","standard").put("axes",JSONArray(axes.toList()))
            .put("buttons",buttonJSON).toString()
    }
}
