// Initialize PDF.js worker by setting the path to the worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js';

// Define DOM elements by selecting elements from the HTML document
const pdfUpload = document.getElementById('pdf-upload'),           // PDF file input
      uploadButton = document.getElementById('upload-button'),     // Upload button
      canvas = document.getElementById('pdf-canvas'),              // Canvas for displaying PDF pages
      playButton = document.getElementById('play-button'),         // Play button for TTS
      pauseButton = document.getElementById('pause-button'),       // Pause button for TTS
      stopButton = document.getElementById('stop-button'),         // Stop button for TTS
      prevButton = document.getElementById('prev-page'),           // Button to go to the previous page
      nextButton = document.getElementById('next-page'),           // Button to go to the next page
      voiceSelect = document.getElementById('voice-select'),       // Voice selection dropdown
      pageCounter = document.getElementById('page-counter'),       // Display for page count
      progressBar = document.querySelector('.progress'),           // Progress bar container
      progressBarInner = document.getElementById('progress-bar'),  // Inner progress bar element
      errorAlert = document.getElementById('error-alert'),         // Alert for displaying errors
      errorMessage = document.getElementById('error-message'),     // Error message text
      autoFlipToggle = document.getElementById('auto-flip');       // Toggle for auto page flip

// Define application state variables
let pdfDoc = null;                       // PDF document object
let currentPage = 1;                     // Current page number
let utterance = null;                    // SpeechSynthesis utterance object for TTS
let isPlaying = false;                   // Indicates if TTS is currently playing
let shouldContinueReading = false;       // Indicates if TTS should continue after page flip

// Initialize voice selection for text-to-speech (TTS)
function loadVoices() {
    const voices = speechSynthesis.getVoices();                       // Get available TTS voices
    voiceSelect.innerHTML = '<option value="">Select a voice...</option>';  // Default option for voice selection
    voices.forEach((voice, index) => {                                // Populate dropdown with voices
        const option = document.createElement('option');
        option.value = index;                                         // Set voice index as option value
        option.textContent = `${voice.name} (${voice.lang})`;         // Display voice name and language
        voiceSelect.appendChild(option);                              // Add option to dropdown
    });

    // Retrieve saved voice preference from local storage
    const savedVoiceIndex = localStorage.getItem('selectedVoice');
    if (savedVoiceIndex && savedVoiceIndex < voices.length) {         // Check if saved preference exists
        voiceSelect.value = savedVoiceIndex;                          // Set dropdown to saved voice
    }
}

// Load voices immediately when they’re ready
speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

// Display an error message in the alert box
function showError(message) {
    errorMessage.textContent = message;                               // Set error message text
    errorAlert.style.display = 'block';                               // Show error alert
}

// Function to load PDF from file input
async function loadPDF(file) {
    try {
        progressBar.style.display = 'flex';                           // Show progress bar
        progressBarInner.style.width = '0%';                          // Reset progress bar width

        const reader = new FileReader();                              // Initialize file reader
        reader.onprogress = (event) => {                              // Update progress bar on file load progress
            if (event.lengthComputable) {
                const percent = (event.loaded / event.total) * 100;
                progressBarInner.style.width = percent + '%';         // Set progress bar width
            }
        };

        // Convert file to ArrayBuffer to load it into PDF.js
        const arrayBuffer = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);             // Resolve on successful file load
            reader.onerror = reject;                                  // Reject on error
            reader.readAsArrayBuffer(file);                           // Start reading file as ArrayBuffer
        });

        pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;     // Load PDF document
        currentPage = 1;                                              // Reset to the first page
        renderPage(currentPage);                                      // Render the first page
        updateControls();                                             // Update control button states

    } catch (error) {
        showError('Error loading PDF: ' + error.message);             // Show error message if PDF loading fails
    } finally {
        progressBar.style.display = 'none';                           // Hide progress bar after load
    }
}

// Function to render a specific page of the PDF onto the canvas
async function renderPage(pageNumber) {
    try {
        const page = await pdfDoc.getPage(pageNumber);                // Get specific page from PDF
        const viewport = page.getViewport({ scale: 1.5 });            // Set scale for display

        canvas.height = viewport.height;                              // Set canvas height
        canvas.width = viewport.width;                                // Set canvas width

        // Render PDF page content onto the canvas
        await page.render({
            canvasContext: canvas.getContext('2d'),                   // Get 2D context for canvas
            viewport: viewport                                        // Set viewport for rendering
        }).promise;

        const textContent = await page.getTextContent();              // Extract text content from page
        const text = textContent.items.map(item => item.str).join(' ');  // Concatenate text from items

        // Initialize TTS for the text on this page
        prepareTextToSpeech(text);

        pageCounter.textContent = `Page ${currentPage} of ${pdfDoc.numPages}`;  // Update page counter display
    } catch (error) {
        showError('Error rendering page: ' + error.message);          // Show error if rendering fails
    }
}

// Initialize TTS for the current page text
function prepareTextToSpeech(text) {
    speechSynthesis.cancel();                                         // Cancel any ongoing TTS
    utterance = new SpeechSynthesisUtterance(text);                   // Create new utterance

    const selectedVoice = voiceSelect.value;                          // Get selected voice from dropdown
    if (selectedVoice) {
        utterance.voice = speechSynthesis.getVoices()[selectedVoice]; // Set voice for utterance if selected
    }

    utterance.onend = handleSpeechEnd;                                // Attach handler for end of speech
}

// Handle actions after speech ends
function handleSpeechEnd() {
    isPlaying = false;

    if (shouldContinueReading && autoFlipToggle.checked && currentPage < pdfDoc.numPages) {
        currentPage++;                                                // Move to next page
        renderPage(currentPage).then(() => {                          // Render and speak new page if continuing
            if (shouldContinueReading) {
                isPlaying = true;
                speechSynthesis.speak(utterance);
            }
        });
    } else {
        shouldContinueReading = false;
    }

    updateControls();                                                 // Update control button states
}

// Function to update control button states
function updateControls() {
    const hasPDF = pdfDoc !== null;
    playButton.disabled = !hasPDF || isPlaying;
    pauseButton.disabled = !isPlaying;
    stopButton.disabled = !isPlaying;
    prevButton.disabled = !hasPDF || currentPage <= 1;
    nextButton.disabled = !hasPDF || currentPage >= pdfDoc?.numPages;
    voiceSelect.disabled = !hasPDF;
}

// Event listeners for button and file upload interactions
uploadButton.addEventListener('click', () => pdfUpload.click());      // Trigger file input on button click

pdfUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        loadPDF(file);                                                // Load PDF when file is selected
    }
});

playButton.addEventListener('click', () => {
    if (utterance) {
        isPlaying = true;
        shouldContinueReading = true;
        speechSynthesis.speak(utterance);                             // Start TTS on play
        updateControls();
    }
});

pauseButton.addEventListener('click', () => {
    speechSynthesis.pause();                                          // Pause TTS on pause
    isPlaying = false;
    shouldContinueReading = false;
    updateControls();
});

stopButton.addEventListener('click', () => {
    speechSynthesis.cancel();                                         // Stop TTS on stop
    isPlaying = false;
    shouldContinueReading = false;
    updateControls();
});

prevButton.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;                                                // Go to previous page
        renderPage(currentPage);
    }
});

nextButton.addEventListener('click', () => {
    if (currentPage < pdfDoc.numPages) {
        currentPage++;                                                // Go to next page
        renderPage(currentPage);
    }
});

voiceSelect.addEventListener('change', () => {
    localStorage.setItem('selectedVoice', voiceSelect.value);         // Save selected voice to local storage
    if (utterance) {
        const selectedVoice = voiceSelect.value;
        if (selectedVoice) {
            utterance.voice = speechSynthesis.getVoices()[selectedVoice];  // Update utterance voice
        }
    }
});
