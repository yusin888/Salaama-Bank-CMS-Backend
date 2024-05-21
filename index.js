const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('./db.js');

const app = express();
const secretKey = 'your_secret_key'; // Use a strong secret key

// Use CORS middleware
app.use(cors({
  origin: 'http://localhost:5173', // Allow requests from this origin
  methods: 'GET,POST',
  allowedHeaders: 'Content-Type, Authorization', // Add Authorization to allowed headers
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
        const token = jwt.sign({ userId: user.id }, secretKey);
        res.status(201).json({ user, token });
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
            const token = jwt.sign({ userId: user.id }, secretKey);
            res.json({ user, token });
        } else {
            res.status(401).send('Invalid username or password');
        }
    } catch (error) {
        res.status (500).send(error.message);
    }
});

app.get('/user-details', async (req, res) => {
  const authToken = req.headers.authorization.split(' ')[1];

  try {
    const decoded = jwt.verify(authToken, secretKey);
    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
      },
    });

    if (user) {
      res.json({ username: user.username });
    } else {
      res.status(404).send('User not found');
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
