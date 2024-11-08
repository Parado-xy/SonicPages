

---

# Sonic Pages

Sonic Pages is a web-based application that allows users to upload PDF documents and convert them into audio. The app provides a smooth, user-friendly interface with options to select different voices, navigate through pages, and toggle auto-flipping for a seamless listening experience.

## Features

- **PDF to Speech Conversion**: Upload any PDF, and Sonic Pages will read the content aloud.
- **Customizable Voices**: Choose from a selection of voices to personalize the audio playback.
- **Page Navigation**: Control the page flow using "Previous," "Next," and "Auto Flip" options.
- **Playback Controls**: Start, pause, stop, and resume audio playback easily.
- **Error Handling**: Provides clear error alerts if a file is invalid or any issues arise.

## Tech Stack

- HTML, CSS (Bootstrap 5), and JavaScript
- [PDF.js](https://mozilla.github.io/pdf.js/) for rendering PDF pages
- Web Speech API for text-to-speech functionality
- SVG icons for an intuitive control panel

## Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Parado-xy/sonic-pages.git
   cd sonic-pages
   ```

2. **Run the Application**:
   Open `index.html` in your browser to test the application locally. No additional server setup is required.

## Usage

1. **Upload PDF**: Click on "Upload PDF" to select a file. A preview of the document will appear on the screen.
2. **Select Voice**: Choose a preferred voice from the dropdown menu for text-to-speech playback.
3. **Playback Control**: Use "Play," "Pause," "Stop," and navigation buttons to control the audio.
4. **Page Auto-Flip**: Enable or disable the auto-flip feature for continuous reading.

## Future Development

1. **Backend Integration for File Processing**: Move file processing to a server backend to enhance performance and allow additional file types like .txt and .docx.
2. **Google Sign-In Authentication**: Add secure Google OAuth login for user access and to enable personalized experiences.
3. **Audio Download Feature**: Allow users to download audio in chunks, with options for saving the entire document or specific sections.
4. **Caching and Thumbnail Generation**: Implement a caching system to avoid repeated processing of previously parsed pages and generate PDF thumbnails.
5. **Additional File Format Support**: Expand support to other file formats like .txt and .docx to enhance versatility.
6. **Optimized Voice Selection**: Implement advanced voice options and settings, including pitch and speed customization.

## License

MIT License

---

