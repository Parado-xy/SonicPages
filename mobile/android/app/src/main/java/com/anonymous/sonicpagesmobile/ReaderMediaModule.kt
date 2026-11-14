package com.anonymous.sonicpagesmobile

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.Bundle
import android.os.Build
import com.facebook.react.bridge.Arguments
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
  fun thumbnail(uri: String, promise: Promise) = render(uri, 0, 384, promise, true)

  @ReactMethod
  fun pdfPage(uri: String, page: Int, promise: Promise) = render(uri, page, 1440, promise, false)

  @ReactMethod
  fun pdfHighlight(uri: String, page: Int, query: String, promise: Promise) {
    executor.execute {
      val result = Arguments.createArray()
      try {
        if (Build.VERSION.SDK_INT >= 35 && query.trim().length >= 3) {
          openPdf(uri).use { pdf -> pdf.openPage(page).use { sheet ->
            val matches = sheet.searchText(query.trim())
            if (matches.size == 1) matches[0].bounds.forEach { bounds ->
              val rect = Arguments.createMap()
              rect.putDouble("x", bounds.left.toDouble() / sheet.width)
              rect.putDouble("y", bounds.top.toDouble() / sheet.height)
              rect.putDouble("width", bounds.width().toDouble() / sheet.width)
              rect.putDouble("height", bounds.height().toDouble() / sheet.height)
              result.pushMap(rect)
            }
          } }
        }
        promise.resolve(result)
      } catch (error: Exception) { promise.reject("PDF_HIGHLIGHT", error) }
    }
  }

  @ReactMethod
  fun pdfContents(uri: String, promise: Promise) {
    executor.execute {
      try {
        val source = File(Uri.parse(uri).path ?: error("Missing PDF path")).canonicalFile
        require(source.toPath().startsWith(context.filesDir.canonicalFile.toPath()))
        com.tom_roush.pdfbox.android.PDFBoxResourceLoader.init(context)
        val memory = com.tom_roush.pdfbox.io.MemoryUsageSetting.setupMixed(8L * 1024 * 1024, 128L * 1024 * 1024)
        memory.setTempDir(context.cacheDir)
        val result = Arguments.createArray()
        com.tom_roush.pdfbox.pdmodel.PDDocument.load(source, memory).use { document ->
          var count = 0
          fun collect(parent: com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.outline.PDOutlineNode, depth: Int) {
            if (depth > 24) return
            var item = parent.firstChild
            while (item != null && count++ < 2000) {
              val bookmark = item
              val destination = runCatching { bookmark.findDestinationPage(document) }.getOrNull()
              val page = destination?.let { document.pages.indexOf(it) } ?: -1
              val title = bookmark.title?.trim().orEmpty()
              if (page >= 0 && title.isNotEmpty()) result.pushMap(Arguments.createMap().apply {
                putString("title", title)
                putInt("depth", depth)
                putInt("page", page)
              })
              collect(bookmark, depth + 1)
              item = bookmark.nextSibling
            }
          }
          document.documentCatalog.documentOutline?.let { collect(it, 0) }
        }
        promise.resolve(result)
      } catch (error: Exception) { promise.reject("PDF_CONTENTS", error) }
    }
  }

  private fun openPdf(uri: String): PdfRenderer {
    val source = File(Uri.parse(uri).path!!).canonicalFile
    require(source.toPath().startsWith(context.filesDir.canonicalFile.toPath()))
    val descriptor = ParcelFileDescriptor.open(source, ParcelFileDescriptor.MODE_READ_ONLY)
    return try { PdfRenderer(descriptor) } catch (error: Exception) {
      descriptor.close()
      throw error
    }
  }

  private fun render(uri: String, pageIndex: Int, size: Int, promise: Promise, thumbnail: Boolean) {
    executor.execute {
      try {
        val target = File.createTempFile("sonic-page-", ".jpg", context.cacheDir)
        var aspect = 1.0
        try {
          openPdf(uri).use {
            it.openPage(pageIndex).use { page ->
              aspect = page.width.toDouble() / page.height
              val scale = size.toDouble() / maxOf(page.width, page.height)
              val bitmap = Bitmap.createBitmap((page.width * scale).roundToInt().coerceAtLeast(1),
                (page.height * scale).roundToInt().coerceAtLeast(1), Bitmap.Config.ARGB_8888)
              try {
                bitmap.eraseColor(Color.WHITE)
                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                target.outputStream().use { stream -> check(bitmap.compress(Bitmap.CompressFormat.JPEG, 85, stream)) }
              } finally { bitmap.recycle() }
            }
          }
          val output = Uri.fromFile(target).toString()
          if (thumbnail) promise.resolve(output)
          else promise.resolve(Arguments.createMap().apply {
            putString("uri", output)
            putDouble("aspect", aspect)
          })
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
