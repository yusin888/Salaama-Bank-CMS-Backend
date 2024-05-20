const client = require('./db.js')
const express = require('express');
const app = express();

app.listen(3000, ()=>{
    console.log("Sever is now listening at port 3000");
})

client.connect();

app.get('/users', (req, res)=>{
    client.query(`Select * from users`, (err, result)=>{
        if(!err){
            res.send(result.rows);
        }
    });
    client.end;
})

// User signup
app.post('/signup', (req, res) => {
    const { username, password, email } = req.body;
    client.query('INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING *', 
                 [username, password, email], (err, result) => {
        if (!err) {
            res.status(201).send(result.rows[0]);
        } else {
            res.status(500).send(err.message);
        }
    });
});

// User login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    client.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password], (err, result) => {
        if (!err && result.rows.length > 0) {
            res.send('Login successful');
        } else {
            res.status(401).send('Invalid username or password');
        }
    });
});

client.on('end', () => {
    console.log('Client disconnected');
});
