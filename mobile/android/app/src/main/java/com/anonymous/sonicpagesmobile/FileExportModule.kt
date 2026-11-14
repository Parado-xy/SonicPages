package com.anonymous.sonicpagesmobile

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.IOException
import java.util.concurrent.Executors

class FileExportModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private data class Export(val file: File, val promise: Promise)
  private val executor = Executors.newSingleThreadExecutor()
  private var pending: Export? = null
  private val requestCode = 41278
  private val listener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, code: Int, result: Int, data: Intent?) {
      if (code != requestCode) return
      val request = pending ?: return
      if (result != Activity.RESULT_OK) {
        pending = null
        request.promise.resolve(false)
        return
      }
      executor.execute {
        try {
          val uri = data?.data ?: throw IOException("No export destination was selected.")
          val output = context.contentResolver.openOutputStream(uri, "w")
            ?: throw IOException("Could not open the export destination.")
          output.use { stream -> request.file.inputStream().use { it.copyTo(stream) } }
          activity.runOnUiThread {
            pending = null
            request.promise.resolve(true)
          }
        } catch (error: Exception) {
          activity.runOnUiThread {
            pending = null
            request.promise.reject("EXPORT_FAILED", error)
          }
        }
      }
    }
  }

  init { context.addActivityEventListener(listener) }

  override fun getName() = "SonicPagesFileExport"

  @ReactMethod
  fun save(uri: String, name: String, mime: String, promise: Promise) {
    val activity = context.currentActivity
    if (activity == null) {
      promise.reject("EXPORT_FAILED", "Open SonicPages before saving a file.")
      return
    }
    activity.runOnUiThread {
      if (pending != null) {
        promise.reject("EXPORT_BUSY", "Another export is already open.")
        return@runOnUiThread
      }
      try {
        val file = File(Uri.parse(uri).path ?: throw IOException("Missing export file.")).canonicalFile
        if (!file.isFile || listOf(context.cacheDir, context.filesDir).none {
          file.toPath().startsWith(it.canonicalFile.toPath())
        }) throw IOException("The export file could not be opened.")
        pending = Export(file, promise)
        activity.startActivityForResult(Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
          addCategory(Intent.CATEGORY_OPENABLE)
          type = mime
          putExtra(Intent.EXTRA_TITLE, name)
        }, requestCode)
      } catch (error: Exception) {
        pending = null
        promise.reject("EXPORT_FAILED", error)
      }
    }
  }

  override fun invalidate() {
    context.removeActivityEventListener(listener)
    executor.shutdown()
    super.invalidate()
  }
}
