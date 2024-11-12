const express = require('express'),
    path = require('path');

const server = express()

server.use(express.static(path.join(__dirname, 'public')))

port = process.env.PORT || 3000

// Home Page route.
server.get('/', (req,res)=> {
    res.sendFile('index.html',{root:'./'})
})

server.listen(port, ()=>{
    console.log(`App live on: http://localhost:${port}`)
})