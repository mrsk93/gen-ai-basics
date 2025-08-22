import { tavily } from '@tavily/core';
import { Groq } from 'groq-sdk';
import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat.mjs';
import NodeCache from 'node-cache';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

const cache = new NodeCache({ stdTTL: 60 * 60 * 24 });

const convBaseMessages: ChatCompletionMessageParam[] = [
    {
        "role": "system",
        "content": `You are mr.sk_GPT, an AI powered Chatbot & a friendly Assistant
        who is well versed with deep knowledge of Software Engineering and Computer
        Science when asked. You can help users with their queries in a simple and clear way.
        You are created by the developer Mr. SK Chalotra.
        
        If you know the answer to a question, answer it directly in plain English.
        If the answer requires real-time, local, or up-to-date information, or if you don’t know the answer, use the available tools to find it.
        You have access to the following tool:
        webSearch(query: string): Use this to search the internet for current or unknown information.
        Decide when to use your own knowledge and when to use the tool.
        Do not mention the tool unless needed.

        Examples:
        Q: What is the capital of France?
        A: The capital of France is Paris.

        Q: What’s the weather in Mumbai right now?
        A: (use the search tool to find the latest weather)

        Q: Who is the Prime Minister of India?
        A: The current Prime Minister of India is Narendra Modi.

        Q: Tell me the latest IT news.
        A: (use the search tool to get the latest news)

        current date and time: ${new Date().toUTCString()}`
    },
]

const tools: Groq.Chat.Completions.ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "webSearch",
            description: "Search the web for the relevant information the user has asked for",
            parameters: {
                type: "object",
                properties: {
                    searchTopic: {
                        type: "string",
                        description: "The topic to search for",
                    }
                },
                required: ["searchTopic"],
            },
        },
    }
];

const webSearch = async (searchTopic: string) => {
    try {
        console.log('Searching the web for information...');
        let webSearchResponses = ``;
        const response = await tvly.search(searchTopic);
        response.results.forEach((result) => {
            webSearchResponses += `${result.content} \n \n`;
        })
        return webSearchResponses;
    } catch (error) {
        console.log('Error: ', error);
        return 'There was some error fetching the results. Please try again.';
    }

}

const availableFunctions: any = {
    "webSearch": webSearch,
};

export const generate = async (userMessage: string, conversationId: string) => {

    const messages = cache.get<ChatCompletionMessageParam[]>(conversationId) ?? convBaseMessages;

    messages.push({
        "role": "user",
        "content": userMessage,
    })
    /*
    MAIN LOOP
    taking user input and calling Chat API
    repeatedly until the user says "bye" or exits
    */
    while (true) {

        if (userMessage.toLowerCase() === "bye") {
            return "Goodbye!";
        }

        /*
        LLM CALL
        Calling Chat API repeatedly until we complete 
        the conversation in one call 
        OR complete all the tool calling
        OR reach max retries count
        */
        const MAX_RETRIES = 5;
        let count = 0;
        while (true) {
            if (count > MAX_RETRIES) {
                return (`Sorry! We couldn't find the answer to your question.Can you retry?`);
            }
            count++;

            const chatCompletion = await groq.chat.completions.create({
                messages,
                "model": "llama-3.3-70b-versatile",
                "temperature": 0.5,
                // "max_completion_tokens": 8192,
                // "top_p": 1,
                // "stream": false,
                // "reasoning_effort": "medium",
                // "stop": null
                "tools": tools,
                "tool_choice": "auto",
            });
            const responseMessage = chatCompletion?.choices?.[0]?.message;
            const toolCalls = responseMessage?.tool_calls ?? [];

            if (responseMessage) {
                messages.push(responseMessage);
            }

            if (toolCalls.length === 0) {
                cache.set(conversationId, messages);
                return `${responseMessage?.content || 'Sorry! Can you retry later ?'}`;
            }

            for (const toolCall of toolCalls) {
                const functionName = toolCall.function.name;
                const functionToCall = availableFunctions[functionName];
                const functionArgs = toolCall.function.arguments;
                const functionResponse = await functionToCall(functionArgs);

                messages.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    content: functionResponse,
                });
            }
        }
    }

}





