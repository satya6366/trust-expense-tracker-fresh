require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://tfdxzakwlhzsmwwwmull.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZHh6YWt3bGh6c213d3dtdWxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MDAxMzEsImV4cCI6MjA3MDA3NjEzMX0.8ixbymPA53SChvcYk_Y-xX-6xI8006bDF7oi0UAmjgo'
);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://satya6366:Nani123@cluster0.mevmafw.mongodb.net/trust_expense_tracker?retryWrites=true&w=majority', {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  maxPoolSize: 10,
  tls: true,
})
.then(() => console.log('Connected to MongoDB Atlas'))
.catch((error) => console.error('MongoDB connection error:', error));

// Schemas
const trustBalanceSchema = new mongoose.Schema({
  balance: { type: Number, default: 0 },
});

const loanSchema = new mongoose.Schema({
  user_id: String,
  borrower: String,
  amount: Number,
  interest_amount: Number,
  due_date: Date,
  created_at: { type: Date, default: Date.now },
  is_collected: { type: Boolean, default: false },
});

const expenseSchema = new mongoose.Schema({
  description: String,
  amount: Number,
  created_at: { type: Date, default: Date.now },
});

const donationSchema = new mongoose.Schema({
  description: String,
  amount: Number,
  created_at: { type: Date, default: Date.now },
});

const userSchema = new mongoose.Schema({
  user_id: String,
  role: { type: String, default: 'user' },
});

const TrustBalance = mongoose.model('TrustBalance', trustBalanceSchema);
const Loan = mongoose.model('Loan', loanSchema);
const Expense = mongoose.model('Expense', expenseSchema);
const Donation = mongoose.model('Donation', donationSchema);
const User = mongoose.model('User', userSchema);

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Trust Expense Tracker API. Use /api endpoints to interact.' });
});

app.get('/api/trust/balance', async (req, res) => {
  try {
    let trustBalance = await TrustBalance.findOne();
    if (!trustBalance) {
      trustBalance = new TrustBalance({ balance: 0 });
      await trustBalance.save();
    }
    res.json({ balance: trustBalance.balance });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/loans', async (req, res) => {
  try {
    const loans = await Loan.find();
    res.json(loans);
  } catch (error) {
    console.error('Error fetching loans:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/loans/user/:userId', async (req, res) => {
  try {
    const loans = await Loan.find({ user_id: req.params.userId });
    res.json(loans);
  } catch (error) {
    console.error('Error fetching user loans:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/loans', async (req, res) => {
  try {
    const { user_id, borrower, amount, interest_amount } = req.body;
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('user_id', user_id)
      .maybeSingle();
    if (error || !data || data.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can add loans' });
    }
    if (!user_id || !borrower || !amount || !interest_amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + 1);
    const loan = new Loan({ 
      user_id, 
      borrower, 
      amount: parseFloat(amount), 
      interest_amount: parseFloat(interest_amount), 
      due_date: dueDate,
      is_collected: false 
    });
    await loan.save();
    
    try {
      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id,
        message: `Loan of ₹${amount} with interest ₹${interest_amount} due on ${dueDate.toLocaleDateString()}`,
      });
      if (notificationError) console.error('Notification error:', notificationError);
    } catch (err) {
      console.error('Non-blocking notification error:', err);
    }
    res.json(loan);
  } catch (error) {
    console.error('Error adding loan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/loans/:id', async (req, res) => {
  try {
    const { user_id, borrower, amount, interest_amount, due_date } = req.body;
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('user_id', user_id)
      .maybeSingle();
    if (error || !data || data.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can edit loans' });
    }
    if (!user_id || !borrower || !amount || !interest_amount || !due_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const loan = await Loan.findByIdAndUpdate(
      req.params.id,
      { 
        user_id, 
        borrower, 
        amount: parseFloat(amount), 
        interest_amount: parseFloat(interest_amount), 
        due_date: new Date(due_date) 
      },
      { new: true }
    );
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }
    
    try {
      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id,
        message: `Loan of ₹${amount} to ${borrower} updated`,
      });
      if (notificationError) console.error('Notification error:', notificationError);
    } catch (err) {
      console.error('Non-blocking notification error:', err);
    }
    res.json(loan);
  } catch (error) {
    console.error('Error editing loan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/loans/:id/collect', async (req, res) => {
  try {
    const { user_id, amount, interest_amount } = req.body;
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('user_id', user_id)
      .maybeSingle();
    if (error || !data || data.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can mark loans as collected' });
    }
    if (!user_id || !amount || !interest_amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }
    if (loan.is_collected) {
      return res.status(400).json({ error: 'Loan already collected' });
    }
    const updatedLoan = await Loan.findByIdAndUpdate(
      req.params.id,
      { is_collected: true },
      { new: true }
    );
    let trustBalance = await TrustBalance.findOne();
    if (!trustBalance) {
      trustBalance = new TrustBalance({ balance: 0 });
    }
    trustBalance.balance += parseFloat(amount) + parseFloat(interest_amount);
    await trustBalance.save();
    
    try {
      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id,
        message: `Loan of ₹${amount} with interest ₹${interest_amount} marked as collected`,
      });
      if (notificationError) console.error('Notification error:', notificationError);
    } catch (err) {
      console.error('Non-blocking notification error:', err);
    }
    res.json(updatedLoan);
  } catch (error) {
    console.error('Error marking loan as collected:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/loans/:id', async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('user_id', user_id)
      .maybeSingle();
    if (error || !data) {
      return res.status(403).json({ error: 'Invalid user' });
    }
    if (data.role !== 'admin' && loan.user_id !== user_id) {
      return res.status(403).json({ error: 'You can only delete your own loans or be an admin' });
    }
    await Loan.deleteOne({ _id: req.params.id });
    
    try {
      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id: loan.user_id,
        message: `Loan of ₹${loan.amount} deleted`,
      });
      if (notificationError) console.error('Notification error:', notificationError);
    } catch (err) {
      console.error('Non-blocking notification error:', err);
    }
    res.json({ message: 'Loan deleted' });
  } catch (error) {
    console.error('Error deleting loan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/expenses', async (req, res) => {
  try {
    const expenses = await Expense.find();
    res.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/expenses', async (req, res) => {
  try {
    const { user_id, description, amount } = req.body;
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('user_id', user_id)
      .maybeSingle();
    if (error || !data || data.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can add expenses' });
    }
    if (!description || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const expense = new Expense({ description, amount: parseFloat(amount) });
    await expense.save();
    let trustBalance = await TrustBalance.findOne();
    if (!trustBalance) {
      trustBalance = new TrustBalance({ balance: 0 });
    }
    trustBalance.balance -= parseFloat(amount);
    await trustBalance.save();
    
    try {
      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id,
        message: `Expense of ₹${amount} added: ${description}`,
      });
      if (notificationError) console.error('Notification error:', notificationError);
    } catch (err) {
      console.error('Non-blocking notification error:', err);
    }
    res.json(expense);
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('user_id', user_id)
      .maybeSingle();
    if (error || !data || data.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete expenses' });
    }
    await Expense.deleteOne({ _id: req.params.id });
    let trustBalance = await TrustBalance.findOne();
    if (!trustBalance) {
      trustBalance = new TrustBalance({ balance: 0 });
    }
    trustBalance.balance += parseFloat(expense.amount);
    await trustBalance.save();
    
    try {
      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id,
        message: `Expense of ₹${expense.amount} deleted: ${expense.description}`,
      });
      if (notificationError) console.error('Notification error:', notificationError);
    } catch (err) {
      console.error('Non-blocking notification error:', err);
    }
    res.json({ message: 'Expense deleted' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/donations', async (req, res) => {
  try {
    const donations = await Donation.find();
    res.json(donations);
  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/donations', async (req, res) => {
  try {
    const { user_id, description, amount } = req.body;
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('user_id', user_id)
      .maybeSingle();
    if (error || !data || data.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can add donations' });
    }
    if (!description || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const donation = new Donation({ description, amount: parseFloat(amount) });
    await donation.save();
    let trustBalance = await TrustBalance.findOne();
    if (!trustBalance) {
      trustBalance = new TrustBalance({ balance: 0 });
    }
    trustBalance.balance += parseFloat(amount);
    await trustBalance.save();
    
    try {
      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id,
        message: `Donation of ₹${amount} added: ${description}`,
      });
      if (notificationError) console.error('Notification error:', notificationError);
    } catch (err) {
      console.error('Non-blocking notification error:', err);
    }
    res.json(donation);
  } catch (error) {
    console.error('Error adding donation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/donations/:id', async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    const donation = await Donation.findById(req.params.id);
    if (!donation) {
      return res.status(404).json({ error: 'Donation not found' });
    }
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('user_id', user_id)
      .maybeSingle();
    if (error || !data || data.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete donations' });
    }
    await Donation.deleteOne({ _id: req.params.id });
    let trustBalance = await TrustBalance.findOne();
    if (!trustBalance) {
      trustBalance = new TrustBalance({ balance: 0 });
    }
    trustBalance.balance -= parseFloat(donation.amount);
    await trustBalance.save();
    
    try {
      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id,
        message: `Donation of ₹${donation.amount} deleted: ${donation.description}`,
      });
      if (notificationError) console.error('Notification error:', notificationError);
    } catch (err) {
      console.error('Non-blocking notification error:', err);
    }
    res.json({ message: 'Donation deleted' });
  } catch (error) {
    console.error('Error deleting donation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/users/:userId/role', async (req, res) => {
  try {
    console.log(`Fetching role for user_id: ${req.params.userId}`);
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('user_id', req.params.userId)
      .maybeSingle();
    if (error) {
      console.error('Supabase error fetching user role:', error);
      return res.status(500).json({ error: 'Failed to fetch role' });
    }
    console.log('Supabase response:', data);
    res.json({ role: data ? data.role : 'user' });
  } catch (error) {
    console.error('Unexpected error fetching user role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});