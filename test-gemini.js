import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!apiKey) {
  console.error("Error: GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY is not set in this environment.");
  console.log("Please run this script passing the key like this:");
  console.log("  $env:GOOGLE_GENERATIVE_AI_API_KEY='your_key_here'; node test-gemini.js");
  process.exit(1);
}

console.log("Found API Key starting with:", apiKey.substring(0, 6) + "...");

async function testModel(modelName) {
  console.log(`\nTesting model name: "${modelName}"...`);
  try {
    const google = createGoogleGenerativeAI({ apiKey });
    const result = await generateText({
      model: google(modelName),
      prompt: "Hello! Reply with just 'OK' if you can read this.",
    });
    console.log(`  Success! Response: ${JSON.stringify(result.text.trim())}`);
    return true;
  } catch (err) {
    console.error(`  Failed: ${err.message}`);
    return false;
  }
}

async function listModelsDirectly() {
  console.log("\nQuerying Google Models API directly for accessible models...");
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
    if (!res.ok) {
      const text = await res.text();
      console.error(`  Direct API call failed with status ${res.status}: ${text}`);
      return;
    }
    const data = await res.json();
    console.log("  Successfully retrieved accessible models:");
    const models = data.models || [];
    if (models.length === 0) {
      console.log("  No models returned.");
    } else {
      models.forEach(m => {
        console.log(`  - Name: ${m.name} (Supported actions: ${m.supportedGenerationMethods.join(", ")})`);
      });
    }
  } catch (err) {
    console.error(`  Direct API call error: ${err.message}`);
  }
}

async function run() {
  const modelsToTest = [
    "gemini-2.5-flash",
    "gemini-3.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash-latest"
  ];

  for (const model of modelsToTest) {
    await testModel(model);
  }

  await listModelsDirectly();
}

run();
