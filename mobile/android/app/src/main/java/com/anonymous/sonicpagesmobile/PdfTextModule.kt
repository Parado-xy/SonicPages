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
import java.io.File
import java.io.IOException
import java.io.Writer

class PdfTextPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
    listOf(PdfTextModule(context), FileExportModule(context), ReaderMediaModule(context))

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}

class PdfTextModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "SonicPagesPdfText"

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

    override fun write(buffer: CharArray, offset: Int, length: Int) {
      if (text.length + length > 4_000_000) throw IOException("This PDF contains too much text to import")
      text.append(buffer, offset, length)
    }

    override fun flush() {}
    override fun close() {}
    override fun toString() = text.toString()
  }
}
