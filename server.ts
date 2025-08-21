import express from 'express';
import cors from 'cors';
import { generate } from './chatbot.ts';

const app = express();
const port = 3001;
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Welcome to mr.sk GPT!');
});

app.post('/chat', async (req, res) => {
    const { message, conversationId } = req.body;
    // todo: validate above fields

    if (!message || !conversationId) {
        res.status(400).json({ message: 'Bad request! Please provide required fields' });
        return;
    }

    console.log('Message', message);

    const result = await generate(message, conversationId);
    res.json({ message: result });
});

app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
});