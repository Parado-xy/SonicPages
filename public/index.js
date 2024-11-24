// Constants for better maintainability
const CONSTANTS = {
    PDF_WORKER_URL: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js',
    DEFAULT_SCALE: 1.5,
    LOCAL_STORAGE_KEYS: {
        SELECTED_VOICE: 'selectedVoice',
        BOOK_CACHE: 'bookCache'
    }
};

// DOM element references in a single object for better organization
const elements = {
    pdfUpload: document.getElementById('pdf-upload'),
    uploadButton: document.getElementById('upload-button'),
    canvas: document.getElementById('pdf-canvas'),
    playButton: document.getElementById('play-button'),
    pauseButton: document.getElementById('pause-button'),
    stopButton: document.getElementById('stop-button'),
    prevButton: document.getElementById('prev-page'),
    nextButton: document.getElementById('next-page'),
    voiceSelect: document.getElementById('voice-select'),
    pageCounter: document.getElementById('page-counter'),
    progressBar: document.querySelector('.progress'),
    progressBarInner: document.getElementById('progress-bar'),
    errorAlert: document.getElementById('error-alert'),
    errorMessage: document.getElementById('error-message'),
    autoFlipToggle: document.getElementById('auto-flip')
};

// State management class
class PDFReaderState {
    constructor() {
        this.pdfDoc = null;
        this.currentPage = 1;
        this.utterance = null;
        this.isPlaying = false;
        this.shouldContinueReading = false;
        this.currentFile = null;
        this.bookCache = this.loadBookCache();
    }

    loadBookCache() {
        try {
            return JSON.parse(localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.BOOK_CACHE)) || {};
        } catch (error) {
            console.error('Error loading book cache:', error);
            return {};
        }
    }

    saveBookCache() {
        try {
            localStorage.setItem(CONSTANTS.LOCAL_STORAGE_KEYS.BOOK_CACHE, JSON.stringify(this.bookCache));
        } catch (error) {
            console.error('Error saving book cache:', error);
        }
    }

    updateCurrentPage(page) {
        if (this.currentFile) {
            this.currentPage = page;
            // Handle both File objects and string-based names
            const fileName = this.currentFile.name || this.currentFile;
            this.bookCache[`${fileName}_currentPage`] = page;
            this.saveBookCache();
        }
    }
}

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = CONSTANTS.PDF_WORKER_URL;

// Create state instance
const state = new PDFReaderState();

// Voice management
class VoiceManager {
    static loadVoices() {
        const voices = speechSynthesis.getVoices();
        elements.voiceSelect.innerHTML = '<option value="">Select a voice...</option>';
        
        voices.forEach((voice, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${voice.name} (${voice.lang})`;
            elements.voiceSelect.appendChild(option);
        });

        // Restore saved voice preference
        const savedVoiceIndex = localStorage.getItem(CONSTANTS.LOCAL_STORAGE_KEYS.SELECTED_VOICE);
        if (savedVoiceIndex && savedVoiceIndex < voices.length) {
            elements.voiceSelect.value = savedVoiceIndex;
        }
    }

    static saveVoicePreference(voiceIndex) {
        localStorage.setItem(CONSTANTS.LOCAL_STORAGE_KEYS.SELECTED_VOICE, voiceIndex);
    }
}

// Error handling
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorAlert.style.display = 'block';
}

// Validation function for book names
function isValidBookName(bookName) {
    return bookName && 
           bookName.endsWith('.pdf') && 
           bookName.length < 1000 &&
           !bookName.includes('../'); // Prevent directory traversal
}

// Function to get book name from URL
function getBookNameFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get('bookId');
    if (!bookId) return null;
    
    // Double decode the book ID since it was double encoded when creating the URL
    try {
        return decodeURIComponent(decodeURIComponent(bookId));
    } catch (error) {
        console.error('Error decoding book name:', error);
        return null;
    }
}

// PDF loading from file upload
async function loadPDF(file) {
    try {
        elements.progressBar.style.display = 'flex';
        elements.progressBarInner.style.width = '0%';

        const arrayBuffer = await readFileAsArrayBuffer(file);
        state.pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
        state.currentFile = file;

        // Load saved page or start from beginning
        const savedPage = state.bookCache[`${file.name}_currentPage`] || 1;
        state.currentPage = savedPage;
        await renderPage(savedPage);
        updateControls();

        // Send file to backend
        const formData = new FormData();
        formData.append("pdf", file);

        const response = await fetch("/upload", {
            method: "POST",
            body: formData,
        });

        const result = await response.json();
        if (response.ok) {
            console.log("PDF uploaded and added to Notion successfully!");
        } else {
            throw new Error(result.error || "Unknown error");
        }

    } catch (error) {
        showError(`Error loading PDF: ${error.message}`);
    } finally {
        elements.progressBar.style.display = 'none';
    }
}

// PDF loading from backend
async function loadPDFFromBackend(bookName) {
    try {
        if (!bookName) {
            throw new Error('No book name provided');
        }

        if (!isValidBookName(bookName)) {
            throw new Error('Invalid book name');
        }

        elements.progressBar.style.display = 'flex';
        elements.progressBarInner.style.width = '0%';
        
        // Double encode the book name to handle special characters properly
        const encodedBookName = encodeURIComponent(encodeURIComponent(bookName));
        const response = await fetch(`/processed/${encodedBookName}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch PDF from server: ${response.status} ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        state.pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
        state.currentFile = bookName; // Store the book name as the current file
        
        // Load saved page or start from beginning
        const savedPage = state.bookCache[`${bookName}_currentPage`] || 1;
        state.currentPage = savedPage;
        await renderPage(savedPage);
        updateControls();
        
        // Hide upload button if we successfully loaded a PDF from URL
        if (elements.uploadButton) {
            elements.uploadButton.style.display = 'none';
        }
    } catch (error) {
        showError(`Error loading PDF: ${error.message}`);
        console.error('PDF loading error:', error);
        // Show upload button if loading from URL fails
        if (elements.uploadButton) {
            elements.uploadButton.style.display = 'block';
        }
    } finally {
        elements.progressBar.style.display = 'none';
    }
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onprogress = (event) => {
            if (event.lengthComputable) {
                const percent = (event.loaded / event.total) * 100;
                elements.progressBarInner.style.width = `${percent}%`;
            }
        };

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('File reading failed'));
        reader.readAsArrayBuffer(file);
    });
}

async function renderPage(pageNumber) {
    try {
        const page = await state.pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: CONSTANTS.DEFAULT_SCALE });

        elements.canvas.height = viewport.height;
        elements.canvas.width = viewport.width;

        await page.render({
            canvasContext: elements.canvas.getContext('2d'),
            viewport: viewport
        }).promise;

        const textContent = await page.getTextContent();
        const text = textContent.items.map(item => item.str).join(' ');

        prepareTextToSpeech(text);
        updatePageCounter();

    } catch (error) {
        showError(`Error rendering page: ${error.message}`);
    }
}

// Text-to-Speech functionality
function prepareTextToSpeech(text) {
    speechSynthesis.cancel();
    state.utterance = new SpeechSynthesisUtterance(text);

    const selectedVoice = elements.voiceSelect.value;
    if (selectedVoice) {
        state.utterance.voice = speechSynthesis.getVoices()[selectedVoice];
    }

    state.utterance.onend = handleSpeechEnd;
}

function handleSpeechEnd() {
    state.isPlaying = false;

    if (state.shouldContinueReading && 
        elements.autoFlipToggle.checked && 
        state.currentPage < state.pdfDoc.numPages) {
        
        state.updateCurrentPage(state.currentPage + 1);
        renderPage(state.currentPage).then(() => {
            if (state.shouldContinueReading) {
                state.isPlaying = true;
                speechSynthesis.speak(state.utterance);
            }
        });
    } else {
        state.shouldContinueReading = false;
    }

    updateControls();
}

// UI updates
function updateControls() {
    const hasPDF = state.pdfDoc !== null;
    elements.playButton.disabled = !hasPDF || state.isPlaying;
    elements.pauseButton.disabled = !state.isPlaying;
    elements.stopButton.disabled = !state.isPlaying;
    elements.prevButton.disabled = !hasPDF || state.currentPage <= 1;
    elements.nextButton.disabled = !hasPDF || state.currentPage >= state.pdfDoc?.numPages;
    elements.voiceSelect.disabled = !hasPDF;
}

function updatePageCounter() {
    elements.pageCounter.textContent = `Page ${state.currentPage} of ${state.pdfDoc.numPages}`;
}

// Event listeners
elements.uploadButton?.addEventListener('click', () => elements.pdfUpload.click());

elements.pdfUpload?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadPDF(file);
});

elements.playButton?.addEventListener('click', () => {
    if (state.utterance) {
        state.isPlaying = true;
        state.shouldContinueReading = true;
        speechSynthesis.speak(state.utterance);
        updateControls();
    }
});

elements.pauseButton?.addEventListener('click', () => {
    speechSynthesis.pause();
    state.isPlaying = false;
    state.shouldContinueReading = false;
    updateControls();
});

elements.stopButton?.addEventListener('click', () => {
    speechSynthesis.cancel();
    state.isPlaying = false;
    state.shouldContinueReading = false;
    updateControls();
});

elements.prevButton?.addEventListener('click', () => {
    if (state.currentPage > 1) {
        state.updateCurrentPage(state.currentPage - 1);
        renderPage(state.currentPage);
    }
});

elements.nextButton?.addEventListener('click', () => {
    if (state.currentPage < state.pdfDoc.numPages) {
        state.updateCurrentPage(state.currentPage + 1);
        renderPage(state.currentPage);
    }
});

elements.voiceSelect?.addEventListener('change', () => {
    VoiceManager.saveVoicePreference(elements.voiceSelect.value);
    if (state.utterance) {
        const selectedVoice = elements.voiceSelect.value;
        if (selectedVoice) {
            state.utterance.voice = speechSynthesis.getVoices()[selectedVoice];
        }
    }
});

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize voices
        speechSynthesis.onvoiceschanged = VoiceManager.loadVoices;
        VoiceManager.loadVoices();
        
        // Check for book in URL
        const bookName = getBookNameFromURL();
        if (bookName) {
            console.log('Loading book from URL:', bookName);
            await loadPDFFromBackend(bookName);
        } else {
            console.log('No book specified in URL');
            // Show upload button if no book is specified
            if (elements.uploadButton) {
                elements.uploadButton.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize the PDF viewer');
    }
});