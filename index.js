const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const secretKey = 'your_secret_key'; // Use a strong secret key

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
        email,
        balance: 0.0, // Initialize balance to 0
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
      where: { username }
    });
    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ userId: user.id }, secretKey);
      res.json({ user, token });
    } else {
      res.status(401).send('Invalid username or password');
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Get user details
app.get('/user-details', async (req, res) => {
  const authToken = req.headers.authorization.split(' ')[1];
  try {
    const decoded = jwt.verify(authToken, secretKey);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });
    if (user) {
      res.json({ username: user.username, balance: user.balance });
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Create a transaction
app.post('/transaction', async (req, res) => {
  const { type, amount } = req.body;
  const authToken = req.headers.authorization.split(' ')[1];
  try {
    const decoded = jwt.verify(authToken, secretKey);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });
    if (user) {
      let newBalance;
      if (type === 'Withdraw' || type === 'Transfer Money') {
        if (user.balance < amount) {
          return res.status(400).send('Insufficient balance');
        }
        newBalance = user.balance - amount;
      } else if (type === 'Cashing in Cheque' || type === 'Loans') {
        newBalance = user.balance + amount;
      } else {
        return res.status(400).send('Invalid transaction type');
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { balance: newBalance },
      });
      const transaction = await prisma.transaction.create({
        data: {
          userId: user.id,
          type,
          amount,
        },
      });
      res.status(201).json(transaction);
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});
// Transfer funds between customers
app.post('/transfer-funds', async (req, res) => {
    const { amount, recipientUsername } = req.body;
    const authToken = req.headers.authorization.split(' ')[1];
  
    try {
      const decoded = jwt.verify(authToken, secretKey);
      const sender = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });
      const recipient = await prisma.user.findUnique({
        where: { username: recipientUsername },
      });
  
      if (!sender) {
        return res.status(404).send('Sender not found');
      }
      if (!recipient) {
        return res.status(404).send('Recipient not found');
      }
      if (sender.balance <= -5000) {
        return res.status(400).send('Your balance is too low to make a transfer');
      }
      if (sender.balance - amount < -5000) {
        return res.status(400).send('Insufficient balance. Cannot go below -5000');
      }
  
      await prisma.$transaction([
        prisma.user.update({
          where: { id: sender.id },
          data: { balance: sender.balance - amount },
        }),
        prisma.user.update({
          where: { id: recipient.id },
          data: { balance: recipient.balance + amount },
        }),
        prisma.transaction.create({
          data: {
            userId: sender.id,
            type: 'Transfer Money Sent',
            amount: -amount,
          },
        }),
        prisma.transaction.create({
          data: {
            userId: recipient.id,
            type: 'Transfer Money Received',
            amount,
          },
        }),
      ]);
  
      res.status(201).send('Transfer successful');
    } catch (error) {
      res.status(500).send(error.message);
    }
  });
  
// Get user details and transaction history
app.get('/account-statement', async (req, res) => {
    const authToken = req.headers.authorization.split(' ')[1];
  
    try {
      const decoded = jwt.verify(authToken, secretKey);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { transactions: true },
      });
  
      if (!user) {
        return res.status(404).send('User not found');
      }
  
      // Ensure transactions have the correct date format
      const formattedTransactions = user.transactions.map(transaction => ({
        ...transaction,
        createdAt: new Date(transaction.transactionDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        })
      }));
  
      res.json({
        username: user.username,
        email: user.email,
        balance: user.balance,
        createdAt: new Date(user.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }),
        accountNumber: user.id, // Assuming the user ID is used as account number
        transactions: formattedTransactions,
      });
    } catch (error) {
      res.status(500).send(error.message);
    }
  });
  
  
// Withdraw endpoint
app.post('/withdraw', async (req, res) => {
  const { amount, method} = req.body;
  const authToken = req.headers.authorization.split(' ')[1];

  try {
    const decoded = jwt.verify(authToken, secretKey);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(404).send('User not found');
    }

    if (!amount || amount <= 0) {
      return res.status(400).send('Invalid amount');
    }

    let newBalance = user.balance - amount;
    if (newBalance < -5000) {
      return res.status(400).send('Balance cannot go below -5000');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { balance: newBalance },
    });

    await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: -amount,
        type: method === 'Mpesa' ? 'Withdraw (Mpesa)' : 'Withdraw (ATM)',
        transactionDate: new Date(),
      },
    });

    res.status(201).send('Withdrawal successful');
  } catch (error) {
    res.status(500).send('Server error');
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
