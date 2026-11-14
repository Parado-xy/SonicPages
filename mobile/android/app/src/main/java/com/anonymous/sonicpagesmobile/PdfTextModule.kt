package com.anonymous.sonicpagesmobile

import android.net.Uri
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
      if (!file.toPath().startsWith(context.cacheDir.canonicalFile.toPath()) || !file.isFile) {
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
        val stripper = PDFTextStripper()
        stripper.sortByPosition = true
        stripper.setPageEnd("\n\n")
        stripper.writeText(document, output)
        promise.resolve(output.toString())
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
