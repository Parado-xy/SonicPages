// Install pdf-poppler
const pdfPoppler = require('pdf-poppler');


// Function to generate a thumbnail from a PDF file
/**
 * Generates the thumbnail for the file
 * @param {} pdfPath 
 * @param {*} fileName 
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
        await pdfPoppler.convert(pdfPath, options);

        console.log('Thumbnail generated:', outputImagePath);

    } catch (error) {
        console.error('Error generating thumbnail:', error);
    }
};

/**Extract File Name */
function extractTextFromFilename(filename) {

    const nonTextRegex = /[^a-zA-Z0-9_\s\-.]/g;
    const sanitizedFilename = filename.replace(nonTextRegex, "");
    const words = sanitizedFilename.split(/[_\- ]+/);
    return words.join(' ');
};
module.exports = {generateThumbnail, extractTextFromFilename};