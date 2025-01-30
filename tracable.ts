import OpenAI from "openai";
import { traceable } from "langsmith/traceable";
import { wrapOpenAI } from "langsmith/wrappers";
import { RunTree } from "langsmith";

const client = new OpenAI();

const messages = [
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "Hello!" },
];

const traceableCallOpenAI = traceable(
  async (messages: { role: string; content: string }[], model: string) => {
    const completion = await client.chat.completions.create({
      model: model,
      messages: messages,
    });
    return completion.choices[0].message.content;
  },
  {
    run_type: "llm",
    name: "OpenAI Call Traceable",
    project_name: "My Project",
  }
);
// Call the traceable function
await traceableCallOpenAI(messages, "gpt-4o-mini");

// Create and use a RunTree object
const rt = new RunTree({
  runType: "llm",
  name: "OpenAI Call RunTree",
  inputs: { messages },
  project_name: "My Project",
});
await rt.postRun();

// Execute a chat completion and handle it within RunTree
rt.end({ outputs: chatCompletion });
await rt.patchRun();