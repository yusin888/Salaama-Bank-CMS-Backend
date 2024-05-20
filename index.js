const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const prisma = require('./db.js');

const app = express();

// Use CORS middleware
app.use(cors({
  origin: 'http://localhost:5173', // Allow requests from this origin
  methods: 'GET,POST',
  allowedHeaders: 'Content-Type',
}));

app.use(bodyParser.json());

app.listen(3000, () => {
    console.log("Server is now listening at port 3000");
});

// Get all users
app.get('/users', async (req, res) => {
    try {
        const users = await prisma.user.findMany();
        res.json(users);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// User signup
app.post('/signup', async (req, res) => {
    const { username, password, email } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                email
            }
        });
        res.status(201).json(user);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// User login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await prisma.user.findUnique({
            where: {
                username
            }
        });
        if (user && await bcrypt.compare(password, user.password)) {
            res.send('Login successful');
        } else {
            res.status(401).send('Invalid username or password');
        }
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Add process exit event listeners to disconnect Prisma gracefully
process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await prisma.$disconnect();
    process.exit(0);
});

process.on('exit', async () => {
    await prisma.$disconnect();
});
