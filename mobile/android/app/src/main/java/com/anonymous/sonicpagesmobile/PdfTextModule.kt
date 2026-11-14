package com.anonymous.sonicpagesmobile

import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.io.MemoryUsageSetting
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDPage
import com.tom_roush.pdfbox.pdmodel.encryption.InvalidPasswordException
import com.tom_roush.pdfbox.text.PDFTextStripper
import com.tom_roush.pdfbox.text.TextPosition
import java.io.File
import java.io.IOException
import java.io.Writer
import java.util.concurrent.Executors

class PdfTextPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
    listOf(PdfTextModule(context), FileExportModule(context), ReaderMediaModule(context))

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}

class PdfTextModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val geometryExecutor = Executors.newSingleThreadExecutor()

  override fun getName() = "SonicPagesPdfText"

  override fun invalidate() {
    geometryExecutor.shutdownNow()
    super.invalidate()
  }

  @ReactMethod
  fun pageTextGeometry(uri: String, index: Int, promise: Promise) {
    geometryExecutor.execute {
      try {
        val file = File(Uri.parse(uri).path ?: error("Missing PDF path")).canonicalFile
        require(file.isFile && file.toPath().startsWith(context.filesDir.canonicalFile.toPath()))
        PDFBoxResourceLoader.init(context)
        val memory = MemoryUsageSetting.setupMixed(8L * 1024 * 1024, 128L * 1024 * 1024)
        memory.setTempDir(context.cacheDir)
        PDDocument.load(file, memory).use { document ->
          require(index in 0 until document.numberOfPages)
          require(!document.isEncrypted || document.currentAccessPermission.canExtractContent())
          val page = document.getPage(index)
          val rotated = page.rotation % 180 != 0
          val width = if (rotated) page.cropBox.height else page.cropBox.width
          val height = if (rotated) page.cropBox.width else page.cropBox.height
          require(width > 0 && height > 0)
          val writer = BoundedTextWriter()
          val spans = Arguments.createArray()
          val stripper = object : PDFTextStripper() {
            override fun writeString(value: String, positions: MutableList<TextPosition>) {
              val start = writer.length
              super.writeString(value, positions)
              if (positions.isEmpty() || value.isBlank()) return
              val left = positions.minOf { it.x }.coerceIn(0f, width)
              val right = positions.maxOf { it.x + it.width }.coerceIn(0f, width)
              val top = positions.minOf { it.y - it.height }.coerceIn(0f, height)
              val bottom = positions.maxOf { it.y + it.height * 0.15f }.coerceIn(0f, height)
              if (right <= left || bottom <= top) return
              spans.pushMap(Arguments.createMap().apply {
                putInt("start", start)
                putInt("end", writer.length)
                putDouble("x", left.toDouble() / width)
                putDouble("y", top.toDouble() / height)
                putDouble("width", (right - left).toDouble() / width)
                putDouble("height", (bottom - top).toDouble() / height)
              })
            }
          }
          stripper.sortByPosition = true
          stripper.startPage = index + 1
          stripper.endPage = index + 1
          stripper.setPageEnd("\u000c")
          stripper.writeText(document, writer)
          promise.resolve(Arguments.createMap().apply {
            putString("text", writer.toString().removeSuffix("\u000c"))
            putArray("spans", spans)
          })
        }
      } catch (error: Exception) {
        promise.reject("PDF_GEOMETRY", error)
      }
    }
  }

  @ReactMethod
  fun extract(uri: String, promise: Promise) {
    try {
      val path = Uri.parse(uri).path ?: throw IOException("Missing PDF path")
      val file = File(path).canonicalFile
      if (!file.isFile || listOf(context.cacheDir, context.filesDir).none { file.toPath().startsWith(it.canonicalFile.toPath()) }) {
        throw IOException("The selected PDF could not be opened")
      }
      if (file.length() > 50L * 1024 * 1024) throw IOException("This PDF exceeds the 50 MB import limit")
      PDFBoxResourceLoader.init(context)
      val memory = MemoryUsageSetting.setupMixed(8L * 1024 * 1024, 128L * 1024 * 1024)
      memory.setTempDir(context.cacheDir)
      PDDocument.load(file, memory).use { document ->
        if (document.isEncrypted && !document.currentAccessPermission.canExtractContent()) {
          promise.reject("PDF_PROTECTED", "This PDF restricts text extraction.")
          return
        }
        if (document.numberOfPages > 2000) throw IOException("This PDF exceeds the 2,000 page import limit")
        val output = BoundedTextWriter()
        var lastPage = 0
        val stripper = object : PDFTextStripper() {
          override fun startPage(page: PDPage) {
            repeat(currentPageNo - lastPage - 1) { output.write("\u000c") }
            lastPage = currentPageNo
            super.startPage(page)
          }
        }
        stripper.sortByPosition = true
        stripper.setPageEnd("\u000c")
        stripper.writeText(document, output)
        repeat(document.numberOfPages - lastPage) { output.write("\u000c") }
        val pages = Arguments.createArray()
        output.toString().split('\u000c').dropLast(1).forEach { pages.pushString(it) }
        val result = Arguments.createMap()
        result.putArray("pages", pages)
        result.putString("title", document.documentInformation.title)
        result.putString("author", document.documentInformation.author)
        promise.resolve(result)
      }
    } catch (error: InvalidPasswordException) {
      promise.reject("PDF_PROTECTED", "This PDF requires a password.", error)
    } catch (error: Exception) {
      promise.reject("PDF_READ_FAILED", "Could not read PDF: ${error.message}", error)
    }
  }

  private class BoundedTextWriter : Writer() {
    private val text = StringBuilder()
    val length: Int get() = text.length

    override fun write(buffer: CharArray, offset: Int, length: Int) {
      if (text.length + length > 4_000_000) throw IOException("This PDF contains too much text to import")
      text.append(buffer, offset, length)
    }

    override fun flush() {}
    override fun close() {}
    override fun toString() = text.toString()
  }
}
