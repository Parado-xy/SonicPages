package com.anonymous.sonicpagesmobile

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors
import kotlin.math.roundToInt

class ReaderMediaModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val executor = Executors.newSingleThreadExecutor()
  private var engine: TextToSpeech? = null
  private var initialized = false
  private val waiting = mutableListOf<(Boolean) -> Unit>()

  override fun getName() = "SonicPagesReaderMedia"

  @ReactMethod
  fun thumbnail(uri: String, promise: Promise) {
    executor.execute {
      try {
        val source = File(Uri.parse(uri).path!!).canonicalFile
        require(source.toPath().startsWith(context.filesDir.canonicalFile.toPath()))
        val target = File.createTempFile("sonic-cover-", ".jpg", context.cacheDir)
        try {
          val descriptor = ParcelFileDescriptor.open(source, ParcelFileDescriptor.MODE_READ_ONLY)
          val renderer = try { PdfRenderer(descriptor) } catch (error: Exception) {
            descriptor.close()
            throw error
          }
          renderer.use {
            it.openPage(0).use { page ->
              val scale = 384.0 / maxOf(page.width, page.height)
              val bitmap = Bitmap.createBitmap((page.width * scale).roundToInt().coerceAtLeast(1),
                (page.height * scale).roundToInt().coerceAtLeast(1), Bitmap.Config.ARGB_8888)
              try {
                bitmap.eraseColor(Color.WHITE)
                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                target.outputStream().use { stream -> check(bitmap.compress(Bitmap.CompressFormat.JPEG, 85, stream)) }
              } finally { bitmap.recycle() }
            }
          }
          promise.resolve(Uri.fromFile(target).toString())
        } catch (error: Exception) {
          target.delete()
          throw error
        }
      } catch (error: Exception) { promise.reject("THUMBNAIL", error) }
    }
  }

  private fun withVoice(action: (TextToSpeech, android.speech.tts.Voice) -> Unit, unavailable: () -> Unit) {
    context.runOnUiQueueThread {
      val callback: (Boolean) -> Unit = { ok ->
        val tts = engine
        val voice = if (ok && tts != null) {
          val current = tts.voice
          val available = tts.voices.orEmpty().filter {
            !it.isNetworkConnectionRequired && !it.features.orEmpty().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)
          }
          available.firstOrNull { it == current }
            ?: available.firstOrNull { it.locale.language == current?.locale?.language }
            ?: available.firstOrNull { it.locale.language == "en" }
        } else null
        if (tts == null || voice == null) unavailable() else action(tts, voice)
      }
      if (initialized) callback(true)
      else {
        waiting.add(callback)
        if (engine == null) engine = TextToSpeech(context) { status ->
          context.runOnUiQueueThread {
            initialized = status == TextToSpeech.SUCCESS
            val callbacks = waiting.toList()
            waiting.clear()
            callbacks.forEach { it(initialized) }
            if (!initialized) { engine?.shutdown(); engine = null }
          }
        }
      }
    }
  }

  @ReactMethod
  fun deviceVoice(promise: Promise) = withVoice(
    { tts, voice -> promise.resolve((tts.defaultEngine ?: "android") + ":" + voice.name) },
    { promise.resolve(null) }
  )

  @ReactMethod
  fun synthesize(text: String, voiceId: String, promise: Promise) = withVoice({ tts, voice ->
    if ((tts.defaultEngine ?: "android") + ":" + voice.name != voiceId) {
      promise.reject("DEVICE_VOICE", "The device voice changed. Select it again.")
      return@withVoice
    }
    val target = File(context.cacheDir, "sonic-tts-${UUID.randomUUID()}.wav")
    val utterance = target.name
    fun failure() {
      target.delete()
      promise.reject("DEVICE_VOICE", "The device voice could not generate audio.")
    }
    tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
      override fun onStart(id: String) {}
      override fun onDone(id: String) { if (id == utterance) promise.resolve(Uri.fromFile(target).toString()) }
      @Deprecated("Android callback")
      override fun onError(id: String) { if (id == utterance) failure() }
      override fun onStop(id: String, interrupted: Boolean) { if (id == utterance) failure() }
    })
    if (tts.setVoice(voice) != TextToSpeech.SUCCESS ||
      tts.synthesizeToFile(text, Bundle(), target, utterance) != TextToSpeech.SUCCESS) failure()
  }, { promise.reject("DEVICE_VOICE", "No installed offline device voice is available.") })

  override fun invalidate() {
    context.runOnUiQueueThread { engine?.shutdown(); engine = null }
    executor.shutdown()
    super.invalidate()
  }
}
