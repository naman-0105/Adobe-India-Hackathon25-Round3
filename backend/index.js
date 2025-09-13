import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import dotenv from "dotenv";
import axios from 'axios';
import FormData from "form-data";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();
// Initialize Google Generative AI using only service account credentials
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.warn("GOOGLE_APPLICATION_CREDENTIALS is not defined. Gemini deep search will not work.");
}
let genAI = null;
let model = null;

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  genAI = new GoogleGenerativeAI(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

// Function to refine sections using Gemini
async function refineSectionsWithGemini(sections, persona, job) {
  if (!model) {
    throw new Error(
      "Gemini model not available. Please set GOOGLE_APPLICATION_CREDENTIALS environment variable."
    );
  }

  const prompt = `
You are given ${sections.length} sections of text that were retrieved as relevant to a user's query.
- User Persona: "${persona}"
- User Job/Task: "${job}"

Your task is to quickly analyze these sections and identify the most relevant ones with respect to the query. Just eliminate those sections from json which are not relevant.
Return up to 5 sections that have the most context and relevance to the query.

IMPORTANT REQUIREMENTS:
- Do not generate any new content
- Only select from the provided sections
- Preserve the original text and all fields of each chosen section
- The output must be a single, valid JSON object with a single key "sections" which is an array of up to 5 chosen section objects, exactly matching the input format
- Do not output any other text or markdown

Here are the ${sections.length} sections:
${JSON.stringify(sections, null, 2)}
`;

  try {
    const geminiPromise = model.generateContent(prompt);
    const result = await geminiPromise;
    const text = await result.response.text();

    // Robustly find and parse JSON
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');
    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
      throw new Error("A valid JSON object was not found in the AI model's response.");
    }

    const jsonString = text.substring(startIndex, endIndex + 1);
    const finalJson = JSON.parse(jsonString);
    return finalJson.sections || sections; // fallback
  } catch (error) {
    console.error("Gemini refinement error:", error);
    return sections; // fallback if Gemini fails
  }
}


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.options("*", cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const name = `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`;
    cb(null, name);
  },
});
const upload = multer({ storage });

const PYTHON_BIN = process.platform === "win32" ? "python" : "python3";

app.get("/", (_req, res) => {
  res.send("PDF extraction API is running");
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/extract-headings", upload.single("pdf"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const pdfPath = req.file.path;
  const pdfFilename = req.file.filename;
  const SCRIPT_PATH = path.join(__dirname, "python", "main1.py");

  const formData = new FormData();
  formData.append("file", fs.createReadStream(pdfPath));

  // Process for chat in the background
  axios.post('http://localhost:8000/process-pdf/', formData, {
  headers: formData.getHeaders()},)
    .then(response => {
      console.log('PDF processing started:', response.data);
    })
    .catch(error => {
      console.error('Error starting PDF processing:', error.message);
    });

  try {
    const child = spawn(PYTHON_BIN, [SCRIPT_PATH, pdfPath], {
      cwd: path.dirname(SCRIPT_PATH),
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    const timeoutMs = Number(process.env.EXTRACT_TIMEOUT_MS || 120000);
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        return res.status(500).json({ error: "Python process for headings failed", code, stderr });
      }

      try {
        const json = JSON.parse(stdout.trim());
        return res.json({ ...json, pdfFilename });
      } catch (e) {
        return res.status(500).json({ error: "Failed to parse Python output as JSON", detail: String(e), raw: stdout, stderr });
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error", detail: String(err) });
  }
});


app.post("/api/chat-stream", async (req, res) => {
  const { question, pdfFilename } = req.body;

  if (!question) {
    return res.status(400).json({ error: "question is required" });
  }

  try {
    // Forward the request to the FastAPI streaming endpoint
    const fastApiResponse = await axios.post('http://localhost:8000/chat-stream/', {
      question,
      pdfFilename
    }, {
      responseType: 'stream' // Important: handle the response as a stream
    });

    // Pipe the stream from FastAPI directly back to the client
    res.setHeader('Content-Type', 'text/event-stream');
    fastApiResponse.data.pipe(res);

  } catch (error) {
    // Log the detailed error on the server for debugging
    console.error('Error proxying chat stream:', error.message);
    res.status(500).json({ error: 'Error calling chat stream endpoint', detail: error.message });
  }
});

app.post("/api/podcast-stream", async (req, res) => {
  const { question, pdfFilename } = req.body;

  if (!question) {
    return res.status(400).json({ error: "question is required" });
  }

  try {
    // Forward the request to the FastAPI podcast streaming endpoint
    const fastApiResponse = await axios.post('http://localhost:8000/podcast-stream/', {
      question,
      pdfFilename
    }, {
      responseType: 'stream' // Important: handle the response as a stream
    });

    // Pipe the stream from FastAPI directly back to the client
    res.setHeader('Content-Type', 'text/event-stream');
    fastApiResponse.data.pipe(res);

  } catch (error) {
    // Log the detailed error on the server for debugging
    console.error('Error proxying podcast stream:', error.message);
    res.status(500).json({ error: 'Error calling podcast stream endpoint', detail: error.message });
  }
});

app.post("/api/insights-stream", async (req, res) => {
  const { question, pdfFilename } = req.body;

  if (!question) {
    return res.status(400).json({ error: "question is required" });
  }

  try {
    // Forward the request to the new FastAPI insights streaming endpoint
    const fastApiResponse = await axios.post('http://localhost:8000/insights-stream/', {
      question,
      pdfFilename
    }, {
      responseType: 'stream'
    });

    // Pipe the stream from FastAPI directly back to the client
    res.setHeader('Content-Type', 'text/event-stream');
    fastApiResponse.data.pipe(res);

  } catch (error) {
    console.error('Error proxying insights stream:', error.message);
    res.status(500).json({ error: 'Error calling insights stream endpoint', detail: error.message });
  }
});



app.post("/api/extract-sections", upload.array("pdfs"), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }

  const { persona, job, deepSearch } = req.body;
  if (!persona || !job) {
    return res.status(400).json({ error: "Persona and job are required" });
  }

  const uploadedFiles = req.files.map(file => ({
    file_name: file.originalname,
    document_path: file.path
  }));

  const inputData = {
    documents: uploadedFiles,
    persona: persona,
    job_to_be_done: job,
    deep_search: deepSearch === "true"
  };

  const inputJsonPath = path.join(uploadsDir, `input-${Date.now()}.json`);
  fs.writeFileSync(inputJsonPath, JSON.stringify(inputData, null, 2));

  const SCRIPT_PATH = path.join(__dirname, "python", "main2.py");

  try {
    const child = spawn(PYTHON_BIN, [SCRIPT_PATH, inputJsonPath], {
      cwd: path.dirname(SCRIPT_PATH),
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    const timeoutMs = Number(process.env.EXTRACT_TIMEOUT_MS || 120000);
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("close", async (code) => {
      clearTimeout(timeout);
      uploadedFiles.forEach(file => fs.unlink(file.document_path, () => {}));
      fs.unlink(inputJsonPath, () => {});

      if (code !== 0) {
        return res.status(500).json({ error: "Python process failed", code, stderr });
      }

      try {
        const json = JSON.parse(stdout.trim());

        // If deep search is enabled, refine the sections using Gemini
        if (deepSearch === "true" && json.sections && json.sections.length > 0) {
          try {
            const refinedSections = await refineSectionsWithGemini(json.sections, persona, job);
            return res.json({ sections: refinedSections });
          } catch (geminiError) {
            console.error("Gemini refinement failed:", geminiError);
            // Fallback to original sections if Gemini fails
            return res.json(json);
          }
        }
        return res.json(json);
      } catch (e) {
        console.log("in catch2")
        return res.status(500).json({ error: "Failed to parse Python output as JSON", detail: String(e), raw: stdout, stderr });
      }
    });
  } catch (err) {
    console.log("in catch1");
    uploadedFiles.forEach(file => fs.unlink(file.document_path, () => {}));
    fs.unlink(inputJsonPath, () => {});
    return res.status(500).json({ error: "Server error", detail: String(err) });
  }
});

app.post("/api/text-to-speech", async (req, res) => {
  const { ssml } = req.body;

  if (!ssml) {
    return res.status(400).json({ error: "SSML is required" });
  }

  const subscriptionKey = process.env.AZURE_TTS_KEY ;
  const region = process.env.AZURE_SPEECH_REGION;

  if (!subscriptionKey || !region) {
    return res.status(500).json({ error: "Azure TTS subscription key or region not configured on the server." });
  }

  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const headers = {
    "Ocp-Apim-Subscription-Key": subscriptionKey,
    "Content-Type": "application/ssml+xml",
    "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
    "User-Agent": "gemini-cli",
  };

  try {
    const response = await axios.post(url, ssml, {
      headers,
      responseType: "stream",
    });

    response.data.pipe(res);
  } catch (error) {
    // Log the detailed error on the server for debugging
    console.error("Error proxying TTS request:", error.message);

    // Create a simple, safe error message to send back to the client
    let detailMessage = "An unknown error occurred while contacting the TTS service.";
    if (error.response) {
      // The request was made and the server responded with a status code
      detailMessage = `Azure TTS API responded with status: ${error.response.status}`;
      console.error("Azure TTS Error Status:", error.response.status);
    } else if (error.request) {
      // The request was made but no response was received
      detailMessage = "No response was received from the Azure TTS API.";
    } else {
      // Something else happened
      detailMessage = error.message;
    }
    
    // Send the safe message instead of the complex error object
    res.status(500).json({ error: "Error calling Azure TTS API", detail: detailMessage });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});