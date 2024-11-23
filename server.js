const express = require('express'),
    path = require('path'),
    multer = require('multer'),
    pdfParse = require('pdf-parse'),
    fs = require('fs')
    
const { Client } = require("@notionhq/client");
const image_services = require('./image-services')



const NOTION_TOKEN = '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'
const notion = new Client({ auth: NOTION_TOKEN });
console.log(process.env.NOTION_TOKEN)
const pageId = '1476201e6d54800f8988dc36c703e092'




const server = express()

server.use(express.static(path.join(__dirname, 'public'))) 

server.use((req, res, next)=> {
    console.log(req.url)
    next()
})

port = process.env.PORT || 3000

// Configure Multer for file uploads
const upload = multer({ dest: "uploads/" });

// Home Page route.
server.get('/', (req,res)=> {
    res.sendFile('index.html',{root:'./'})
})

server.get('/add-book', (req, res)=>{
    res.sendFile('reader.html',{root:'./'})
})




server.post("/upload", upload.single("pdf"), async (req, res) => {
    const tempPath = req.file.path; // Temporary path
    const fileName = image_services.extractTextFromFilename(req.file.originalname);
    const destinationDir = path.join(__dirname, "processed"); // Destination directory
    const destinationPath = path.join(destinationDir, fileName); // Full destination path

    try {
        // Ensure destination directory exists
        if (!fs.existsSync(destinationDir)) {
            fs.mkdirSync(destinationDir);
        }

        // Move the file to the new location
        fs.renameSync(tempPath, destinationPath);

        // Parse the PDF file to extract text and metadata
        const data = await pdfParse(destinationPath);

        // Extract metadata for Notion
        const pageCount = data.numpages || 0;

        // Send data to Notion
        const response = await notion.pages.create({
            parent: { 
                database_id: '1476201e6d54812ca00df7f37936f7a2', // Use this as the database ID
            },
            properties: {
                Name: {
                    title: [
                        {
                            text: {
                                content: fileName,
                            },
                        },
                    ],
                },
                "Page Count": {
                    number: pageCount,
                },
                "Current Page": {
                    number: 1,
                },
                Uploaded: {
                    date: {
                        start: new Date().toISOString(),
                    },
                },
            },
        });

        // Generate Thumbnail
        image_services.generateThumbnail(destinationPath, fileName);

        // Respond with success
        res.status(200).json({ message: "PDF uploaded, moved, and added to Notion successfully!", notionResponse: response });
    } catch (error) {
        console.error("Error processing the file:", error.message);

        // Clean up temporary file if an error occurs
        fs.unlink(tempPath, (unlinkError) => {
            if (unlinkError) console.error("Failed to delete temporary file:", unlinkError);
        });

        res.status(500).json({ error: "Failed to process the PDF or upload to Notion." });
    }
});


server.listen(port, ()=>{
    console.log(`App live on: http://localhost:${port}`)
})