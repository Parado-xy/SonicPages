// Required dependencies

const session = require('express-session');
// const { Client } = require('@notionhq/client');
// const cors = require('cors');





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
                page_id: NOTION_PAGE_ID
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
                Name: { title: {} },
                Email: { email: {} },
                Books: { rich_text: {} },
                LastAccessed: { date: {} },
                Status: { select: {
                    options: [
                        { name: "Active", color: "green" },
                        { name: "Inactive", color: "red" }
                    ]
                }}
            },
        });
        return response;
    } catch (error) {
        console.error('Error creating Notion database:', error);
        throw error;
    }
}


const implimentation =  {

    "register": async (req, res) => {
        console.log(req.body)
        try {
            const { email, password} = req.body;
    
            // Check if user already exists
            if (users.has(email)) {
                return res.status(400).json({ error: 'User already exists' });
            }
    
    
            // Create user database in Notion
            const notionDb = await createUserDatabase(email);
    
            // Store user data
            const userData = {
                email,
                password: hashedPassword,
                notionDatabaseId: notionDb.id
            };
            users.set(email, userData);
    
            // Create session
            req.session.user = {
                email,
                notionDatabaseId: notionDb.id
            };
    
            res.status(201).json({
                message: 'User registered successfully',
                user: {
                    email,
                    notionDatabaseId: notionDb.id
                }
            });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ error: 'Registration failed' });
        }
    },
    

    // User login endpoint
    "login": async (req, res)=> {
        try {
            const { email, password } = req.body;
            const user = users.get(email);
    
            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
    
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
    
            // Create session
            req.session.user = {
                email: user.email,
                notionDatabaseId: user.notionDatabaseId
            };
    
            // Update last accessed in Notion
            await notion.pages.update({
                page_id: user.notionDatabaseId,
                properties: {
                    LastAccessed: {
                        date: {
                            start: new Date().toISOString(),
                        },
                    },
                },
            });
    
            res.json({
                message: 'Login successful',
                // user: {
                //     email: user.email,
                //     name: user.name,
                //     notionDatabaseId: user.notionDatabaseId
                // }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Login failed' });
        }
    }
    

// Check session endpoint
// app.get('/api/check-session', (req, res) => {
//     if (req.session.user) {
//         res.json({ isAuthenticated: true, user: req.session.user });
//     } else {
//         res.json({ isAuthenticated: false });
//     }
// });

// // Logout endpoint
// app.post('/api/logout', (req, res) => {
//     req.session.destroy((err) => {
//         if (err) {
//             return res.status(500).json({ error: 'Logout failed' });
//         }
//         res.json({ message: 'Logged out successfully' });
//     });
// });
}

module.exports = implimentation
