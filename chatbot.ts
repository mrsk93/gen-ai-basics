import { tavily } from '@tavily/core';
import { Groq } from 'groq-sdk';
import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat.mjs';
import readline from 'node:readline/promises';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

const messages: ChatCompletionMessageParam[] = [
    {
        "role": "system",
        "content": `You are mr.sk_GPT, an AI powered Chatbot & a friendly Assistant
        (for Sumit Chalotra) who is well versed with deep knowledge of Software 
        Engineering and Computer Science when asked. You can help users with their queries
        in a simple and clear way.
        
        You also have access to following tools:
        1.webSearch(searchTopic:string) - Search the web for realtime data and
         relevant information the user has asked for.`
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
        console.log('Erorr: ', error);
        return 'There was some error fetching the results. Please try again.';
    }

}

const availableFunctions: any = {
    "webSearch": webSearch,
};

export const generate = async (userMessage: string, conversationId: string) => {

    /*
    MAIN LOOP
    taking user input and calling Chat API
    repeatedly until the user says "bye" or exits
    */
    while (true) {

        if (userMessage.toLowerCase() === "bye") {
            return "Goodbye!";
        }

        messages.push({
            "role": "user",
            "content": userMessage,
        })

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





