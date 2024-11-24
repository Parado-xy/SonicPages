// Install pdf-poppler
const pdfPoppler = require('pdf-poppler');
const fs = require('fs');
const path = require('path');

// Function to generate a thumbnail from a PDF file
/**
 * Generates the thumbnail for the file
 * @param {string} pdfPath - The path to the PDF file.
 * @param {string} fileName - The name of the file to be used for the thumbnail.
 */
const generateThumbnail = async (pdfPath, fileName) => {
    try {
        const outputDir = 'C:/Users/HP/Documents/SonicPages/public/thumbnails';
        const outputImagePath = `${outputDir}/${fileName}.png`;

        // Set options for Poppler to generate the first page as an image
        const options = {
            format: 'png',
            out_dir: outputDir,
            out_prefix: fileName,
            page: 1,
            scale: 1024,
        };

        // Convert PDF to image using Poppler
        await pdfPoppler.convert(pdfPath, options)
        .then(re=> {console.log(re)})

        // Get the generated file path (it might have a suffix like -001, -1, etc.)
        const tempImagePath = `${outputDir}/${fileName}-001.png`;

        // Function to normalize file name (removes suffix like -001, -01, -1, etc.)
        const normalizeFileName = (filename) => {
            const normalizedFileName = filename.replace(/-\d+$/, ''); // Remove suffix like -001, -1, etc.
            return normalizedFileName;
        };

        // Normalize the file name by removing any suffix
        const normalizedFileName = normalizeFileName(fileName);

        // Rename the file to remove the suffix (e.g., -001)
        const newImagePath = `${outputDir}/${normalizedFileName}.png`;

        // Ensure the file exists before renaming
        if (fs.existsSync(tempImagePath)) {
            fs.renameSync(tempImagePath, newImagePath);  // Rename the file
            console.log('Thumbnail generated:', newImagePath);
        } else {
            console.error('Error: Generated thumbnail file does not exist:', tempImagePath);
        }

    } catch (error) {
        console.error('Error generating thumbnail:', error);
    }
};

/** Extract File Name */
function extractTextFromFilename(filename) {
    const nonTextRegex = /[^a-zA-Z0-9_\s\-.]/g;
    const sanitizedFilename = filename.replace(nonTextRegex, "");
    const words = sanitizedFilename.split(/[_\- ]+/);
    return words.join(' ');
}

module.exports = { generateThumbnail, extractTextFromFilename };
