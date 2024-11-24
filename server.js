const express = require('express'),
    path = require('path'),
    multer = require('multer'),
    pdfParse = require('pdf-parse'),
    fs = require('fs'),
    session = require('express-session'),
    ejs = require('ejs');

const { Client } = require("@notionhq/client");
const image_services = require('./image-services');
const saveUser = require('./saveuser');

const NOTION_TOKEN = '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';
const notion = new Client({ auth: NOTION_TOKEN });
const pageId = '1476201e6d54800f8988dc36c703e092';

const server = express();

server.use(express.static(path.join(__dirname, 'public')));
server.use(session({
    secret: 'sonic-pages',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60000 }
}));
server.use(express.urlencoded({ extended: true }));
server.set('view engine', 'ejs');

server.use((req, res, next) => {
    console.log(req.url);
    next();
});

// In-memory user store (replace with a real database in production)
const users = new Map();

// Database configuration
const NOTION_PAGE_ID = '1476201e6d54800f8988dc36c703e092';

// Create user database in Notion
async function createUserDatabase(userName) { 
    try {
        const response = await notion.databases.create({
            parent: {
                type: "page_id",
                page_id: NOTION_PAGE_ID, // Replace with your actual Notion page ID
            },
            title: [
                {
                    type: "text",
                    text: {
                        content: `Sonic - ${userName}'s Library`,
                    },
                },
            ],
            properties: {
                Name: { title: {} }, // Property for the book's name
                Pages: { number: {} }, // Property for the total number of pages in the book
                CurrentPage: { number: {} }, // Property for tracking the current page being read
            },
        });
        return response;
    } catch (error) {
        console.error('Error creating Notion database:', error);
        throw error;
    }
}


port = process.env.PORT || 3000;

// Configure Multer for file uploads
const upload = multer({ dest: "uploads/" });

// Make userData a global variable
global.userData = null;

// Home Page route
server.get('/', (req, res) => {
    global.userData = req.session.user || null; // Retrieve user from session
    res.render('index', { userData: global.userData }); // Pass userData to the EJS view
});

// Upload Book Route
server.get('/add-book', (req, res) => {
    res.sendFile('reader.html', { root: './' });
});

// Sign-on Page
server.get('/sign-on', (req, res) => {
    res.sendFile('signon.html', { root: './' });
});

server.post('/user-data', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user already exists
        if (users.has(email)) {
            // Create session and redirect
            req.session.user = users.get(email);
            global.userData = req.session.user; // Set global userData
            return res.render('index', { userData: global.userData });
        }

        // Create user database in Notion
        const notionDb = await createUserDatabase(email);

        // Store user data
        const userData = {
            email,
            password,
            notionDatabaseId: notionDb.id
        };
        users.set(email, userData);

        // Create session
        req.session.user = userData;
        global.userData = userData; // Set global userData

        res.render('index', { userData: global.userData })
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});


// Serve the processed PDFs from the 'processed' directory
const decodeURIPlus = (str) => decodeURIComponent(str.replace(/\+/g, ' '));

function processedUrlMiddleware(req, res, next) {
    // Only process URLs containing '/processed/'
    if (req.url.includes('/processed/')) {
        try {
            // Get the encoded filename part after '/processed/'
            const encodedFilename = req.url.split('/processed/')[1];
            
            // Double decode to handle potential double encoding
            const decodedOnce = decodeURIPlus(encodedFilename);
            const decodedTwice = decodeURIPlus(decodedOnce);
            
            // Use the most decoded version that's still valid
            const cleanedFilename = decodedTwice !== 'undefined' ? decodedTwice : decodedOnce;
            
            // Reconstruct the URL
            req.url = `/processed/${cleanedFilename}`;
            
            console.log('Processed URL:', req.url);
        } catch (error) {
            console.error('Error processing URL:', error);
        }
    }
    next();
}

// Add this middleware before your static file serving
server.use(processedUrlMiddleware);
server.use('/processed', express.static(path.join(__dirname, 'processed')));

server.get('/api/notion/books', async (req, res)=> {

        const { user } = req.session; // Ensure user is authenticated
        if (!user || !user.notionDatabaseId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
    
        const { q } = req.query;
    
        try {
            const response = await notion.databases.query({
                database_id: user.notionDatabaseId,
                filter: q
                    ? {
                          or: [
                              { property: 'Name', title: { contains: q } },
                              { property: 'Pages', number: { equals: q } },
                              { property: 'CurrentPage', number: { equals: q } },
                          ],
                      }
                    : undefined,
            });
    
            const books = response.results.map((page) => ({
                id: page.id,
                name: page.properties.Name.title[0].text.content,
                pages: page.properties.Pages.number || 0,
                currentPage: page.properties.CurrentPage.number || 0,
            }));
    
            res.json(books);
        } catch (error) {
            console.error('Failed to query books:', error);
            res.status(500).json({ error: 'Failed to fetch books.' });
        }
    });

server.post("/upload", upload.single("pdf"), async (req, res) => {
    const tempPath = req.file.path; // Temporary path
    const fileName = image_services.extractTextFromFilename(req.file.originalname);
    const destinationDir = path.join(__dirname, "processed"); // Destination directory
    const destinationPath = path.join(destinationDir, fileName); // Full destination path

    const { user } = req.session; // Ensure user is authenticated
    if (!user || !user.notionDatabaseId) {
        return res.sendFile('signon.html',{'root':'./'});
    }

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
        database_id: userData.notionDatabaseId, // Use this as the database ID
    },
    properties: {
        Name: {
            title: [
                {
                    text: {
                        content: fileName, // Name of the book (fileName)
                    },
                },
            ],
        },
        Pages: {
            number: pageCount, // Total number of pages in the book
        },
        CurrentPage: {
            number: 1, // Start at page 1 when the book is first uploaded
        }

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


server.listen(port, () => {
    console.log(`App live on: http://localhost:${port}`);
});
