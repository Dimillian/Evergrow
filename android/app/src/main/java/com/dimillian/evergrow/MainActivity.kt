package com.dimillian.evergrow

import android.annotation.SuppressLint
import android.app.Activity
import android.app.Presentation
import android.content.Context
import android.content.res.Configuration
import android.graphics.Color
import android.hardware.display.DisplayManager
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.*
import android.webkit.*
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.ByteArrayInputStream

class MainActivity : Activity(), DisplayManager.DisplayListener {
    private val handler = Handler(Looper.getMainLooper())
    private val controller = ControllerInput()
    private lateinit var game: WebView
    private lateinit var displays: DisplayManager
    @Volatile private var companion: CompanionPresentation? = null
    @Volatile private var resumed = false
    private var lastSnapshot: String? = null
    private var forwarding = false
    private var pendingSnapshot: String? = null
    private lateinit var audio: AudioManager
    private lateinit var audioRequest: AudioFocusRequest
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.setDecorFitsSystemWindows(false)
        immersive(window)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        game = makeWebView(this, false)
        setContentView(game)
        game.loadUrl(BASE + "index.html")
        displays = getSystemService(DisplayManager::class.java)
        displays.registerDisplayListener(this,handler)
        audio = getSystemService(AudioManager::class.java)
        audioRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
            .setOnAudioFocusChangeListener { focus ->
                if (focus < 0) lifecycle("pause")
                else if (focus == AudioManager.AUDIOFOCUS_GAIN && resumed) lifecycle("resume")
            }.build()
    }
    private fun immersive(window: Window?) {
        window ?: return
        window.decorView.post {
            window.insetsController?.hide(WindowInsets.Type.systemBars())
            window.insetsController?.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }
    /** Per-window request; never changes the user's global display/performance settings. */
    private fun prefer60Hz(window: Window?, display: Display?) {
        if(window == null || display == null) return
        val current = display.mode
        val mode = display.supportedModes.filter {
            it.physicalWidth == current.physicalWidth && it.physicalHeight == current.physicalHeight &&
                kotlin.math.abs(it.refreshRate - 60f) < 1f
        }.minByOrNull { kotlin.math.abs(it.refreshRate - 60f) }
        val attributes = window.attributes
        val modeId = mode?.modeId ?: 0
        if(attributes.preferredDisplayModeId == modeId && attributes.preferredRefreshRate == 60f) return
        attributes.preferredDisplayModeId = modeId
        attributes.preferredRefreshRate = 60f
        window.attributes = attributes
    }
    @SuppressLint("SetJavaScriptEnabled")
    private fun makeWebView(context: Context, secondary: Boolean): WebView {
        val assets = WebViewAssetLoader.Builder().addPathHandler("/assets/",WebViewAssetLoader.AssetsPathHandler(this)).build()
        return WebView(context).apply {
            setBackgroundColor(Color.rgb(7,13,18))
            settings.javaScriptEnabled = true; settings.domStorageEnabled = true
            settings.allowFileAccess = false; settings.allowContentAccess = false
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.mediaPlaybackRequiresUserGesture = false
            settings.textZoom = 100; settings.setSupportZoom(false)
            isFocusableInTouchMode = true
            webViewClient = object: WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse =
                    assets.shouldInterceptRequest(request.url) ?: WebResourceResponse("text/plain","utf-8",403,"Forbidden",emptyMap(),ByteArrayInputStream(byteArrayOf()))
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = !request.url.toString().startsWith(BASE)
                override fun onPageFinished(view: WebView, url: String) {
                    if(secondary) lastSnapshot?.let { forward(it) }
                    else lifecycle(if(resumed) "resume" else "pause")
                }
                override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                    android.util.Log.e("Evergrow", "Web renderer ended; reopen the app to recover the last checkpoint")
                    if(secondary) { companion?.dismiss(); companion = null } else finish()
                    return true
                }
            }
            webChromeClient = object: WebChromeClient() {
                override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                    if(message.messageLevel() == ConsoleMessage.MessageLevel.ERROR) android.util.Log.e("EvergrowJS", "${message.message()} (${message.sourceId()}:${message.lineNumber()})")
                    return true
                }
            }
            if(secondary) addJavascriptInterface(CompanionBridge(),"EvergrowCompanion")
            else addJavascriptInterface(GameBridge(),"EvergrowAndroid")
        }
    }
    inner class GameBridge {
        @JavascriptInterface fun controller(): String = controller.snapshot()
        @JavascriptInterface fun clearController() = controller.clearEdges()
        @JavascriptInterface fun hasCompanion(): Boolean = companion != null && resumed
        @JavascriptInterface fun publish(value: String) {
            if(value.length > 400_000) return
            handler.post { if(resumed) { lastSnapshot=value; forward(value) } }
        }
    }
    inner class CompanionBridge {
        @JavascriptInterface fun ready() { handler.post { lastSnapshot?.let { forward(it) } } }
        @JavascriptInterface fun command(value: String) {
            if(value.length > 1000) return
            val parsed = try { JSONObject(value) } catch(_: Exception) { return }
            if(parsed.optString("type") !in setOf("panel","inspect","equip","zoom","resume","portal","track","closeInspect")) return
            handler.post {
                if(resumed) game.evaluateJavascript("window.dispatchEvent(new CustomEvent('evergrow-native-command',{detail:${JSONObject.quote(value)}}))",null)
            }
        }
    }
    /** One in-flight frame plus the newest replacement; a slow display cannot grow a queue. */
    private fun forward(value: String) {
        if(forwarding) { pendingSnapshot=value; return }
        val view = companion?.web ?: return
        forwarding=true
        view.evaluateJavascript("window.dispatchEvent(new CustomEvent('evergrow-companion-state',{detail:${JSONObject.quote(value)}}))") {
            forwarding=false
            val next=pendingSnapshot; pendingSnapshot=null
            if(next != null) forward(next)
        }
    }
    private fun lifecycle(state: String) {
        if(!::game.isInitialized) return
        controller.reset()
        game.evaluateJavascript("window.dispatchEvent(new CustomEvent('evergrow-native-lifecycle',{detail:'$state'}))",null)
    }
    override fun onResume() {
        super.onResume(); resumed=true
        if(::game.isInitialized) { game.onResume(); immersive(window); prefer60Hz(window,display); lifecycle("resume"); audio.requestAudioFocus(audioRequest) }
        if(::displays.isInitialized) connectCompanion()
    }
    override fun onPause() {
        resumed=false; lifecycle("pause")
        companion?.dismiss(); companion=null; forwarding=false; pendingSnapshot=null
        game.onPause()
        audio.abandonAudioFocusRequest(audioRequest); super.onPause()
    }
    override fun onDestroy() {
        displays.unregisterDisplayListener(this); companion?.dismiss(); companion=null
        game.removeJavascriptInterface("EvergrowAndroid"); game.destroy(); super.onDestroy()
    }
    override fun onConfigurationChanged(config: Configuration) { super.onConfigurationChanged(config); immersive(window); prefer60Hz(window,display); connectCompanion() }
    override fun dispatchKeyEvent(event: KeyEvent): Boolean = if(controller.key(event)) true else super.dispatchKeyEvent(event)
    override fun dispatchGenericMotionEvent(event: MotionEvent): Boolean = if(controller.motion(event)) true else super.dispatchGenericMotionEvent(event)
    @Deprecated("Deprecated in Java") override fun onBackPressed() {
        game.evaluateJavascript("window.dispatchEvent(new CustomEvent('evergrow-native-back'))",null)
    }
    private fun connectCompanion() {
        if(!resumed) return
        val secondary = displays.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION).firstOrNull { it.displayId != display?.displayId }
        if(secondary?.displayId == companion?.display?.displayId) { companion?.web?.onResume(); prefer60Hz(companion?.window,secondary); return }
        companion?.dismiss(); companion=null; forwarding=false; pendingSnapshot=null
        if(secondary != null) {
            try { companion=CompanionPresentation(secondary).also { it.show() } }
            catch(e: WindowManager.InvalidDisplayException) { companion=null; android.util.Log.w("Evergrow","Second display unavailable",e) }
        }
    }
    override fun onDisplayAdded(id: Int) = connectCompanion()
    override fun onDisplayChanged(id: Int) { prefer60Hz(window,display); connectCompanion() }
    override fun onDisplayRemoved(id: Int) { if(companion?.display?.displayId == id) { companion?.dismiss(); companion=null }; connectCompanion() }
    inner class CompanionPresentation(display: Display): Presentation(this@MainActivity,display) {
        lateinit var web: WebView
        override fun onCreate(state: Bundle?) {
            super.onCreate(state)
            window?.addFlags(WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            window?.setDecorFitsSystemWindows(false); immersive(window)
            web=makeWebView(context,true); setContentView(web); prefer60Hz(window,display); web.loadUrl(BASE+"thor.html")
        }
        override fun dismiss() { if(::web.isInitialized) { web.removeJavascriptInterface("EvergrowCompanion"); web.destroy() }; super.dismiss() }
        override fun dispatchKeyEvent(event: KeyEvent) = if(controller.key(event)) true else super.dispatchKeyEvent(event)
        override fun dispatchGenericMotionEvent(event: MotionEvent) = if(controller.motion(event)) true else super.dispatchGenericMotionEvent(event)
    }
    companion object { const val BASE="https://appassets.androidplatform.net/assets/" }
}
