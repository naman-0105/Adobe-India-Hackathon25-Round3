import os
import asyncio
import fitz  # PyMuPDF
import json
from fastapi import FastAPI, UploadFile, File, HTTPException
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.vectorstores import FAISS
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.chains.question_answering import load_qa_chain
from langchain.prompts import PromptTemplate
from langchain_community.embeddings import HuggingFaceEmbeddings
import google.generativeai as genai
from dotenv import load_dotenv
from fastapi.responses import StreamingResponse


from starlette.responses import JSONResponse
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from pydantic import BaseModel
from typing import Optional
import io


# Adding some imports

import requests
from pydub import AudioSegment
from bs4 import BeautifulSoup

# ------------------------------- 

# Load environment variables
# ------------------------------- 

load_dotenv()
api_key = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if not api_key:
    raise ValueError("GOOGLE_APPLICATION_CREDENTIALS environment variable not set.")
genai.configure(api_key=api_key)

class ChatRequest(BaseModel):
    question: str
    pdfFilename: Optional[str] = None

class TTSRequest(BaseModel):
    ssml: str

# ------------------------------- 

# Constants
# ------------------------------- 

CACHE_DIR = "faiss_cache"
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads")
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# ------------------------------- 

# FastAPI App Initialization
# ------------------------------- 

app = FastAPI()

# ------------------------------- 

# Global Variables
# ------------------------------- 

embeddings = None
vector_store: Optional[FAISS] = None
chain = None

# ------------------------------- 

# PDF Processing
# ------------------------------- 

async def process_single_pdf_and_update_index(pdf_file: str):
    """
    Process a single PDF, extract text, split into chunks,
    embed, and update FAISS index incrementally.
    """
    global vector_store
    if not os.path.exists(UPLOAD_DIR):
        return

    file_path = os.path.join(UPLOAD_DIR, pdf_file)
    if not os.path.exists(file_path):
        return

    # Read PDF
    with open(file_path, "rb") as f:
        pdf_bytes = f.read()
    pdf_doc = UploadFile(filename=pdf_file, file=io.BytesIO(pdf_bytes))

    # Extract text
    raw_text = await extract_text_from_pdf_async(pdf_doc)
    if not raw_text.strip():
        return

    # Split into chunks
    if len(raw_text) < 5000:
        text_chunks = [raw_text]
    else:
        text_chunks = await asyncio.to_thread(
            lambda: RecursiveCharacterTextSplitter(
                chunk_size=5000, chunk_overlap=500
            ).split_text(raw_text)
        )

    # Update or create FAISS index
    if vector_store is None:
        vector_store = FAISS.from_texts(text_chunks, embedding=embeddings)
    else:
        vector_store.add_texts(text_chunks)

    # Save FAISS index to disk
    vector_store.save_local(CACHE_DIR)


# ------------------------------- 

# File Watcher
# ------------------------------- 

class PDFFileHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory or not event.src_path.endswith(".pdf"):
            return
        pdf_file = os.path.basename(event.src_path)
        asyncio.run(process_single_pdf_and_update_index(pdf_file))

# ------------------------------- 

# FastAPI Events
# ------------------------------- 

@app.on_event("startup")
async def startup_event():
    if not os.path.exists(os.getenv("GOOGLE_APPLICATION_CREDENTIALS")):
        raise RuntimeError("GOOGLE_APPLICATION_CREDENTIALS file not found.")
    global embeddings, vector_store, chain
    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={'device': 'cpu'},
        encode_kwargs={'batch_size': 64}
    )

    chain = get_conversational_chain()

    event_handler = PDFFileHandler()
    observer = Observer()
    observer.schedule(event_handler, UPLOAD_DIR, recursive=False)
    observer.start()

# Load existing FAISS index if available
    if os.path.exists(CACHE_DIR) and os.listdir(CACHE_DIR):
        vector_store = FAISS.load_local(CACHE_DIR, embeddings, allow_dangerous_deserialization=True)
# ------------------------------- 

# Utility functions
# ------------------------------- 

async def extract_text_from_pdf_async(pdf_doc: UploadFile):

    def open_pdf_and_extract_text():
        pdf_bytes = pdf_doc.file.read()
        with fitz.open(stream=pdf_bytes, filetype="pdf") as document:
            return "".join(page.get_text() for page in document)
    return await asyncio.to_thread(open_pdf_and_extract_text)

def get_conversational_chain():
    prompt_template = """
    Answer the question as detailed as possible from the provided context.
    If the answer is not in the provided context,
    say: "The answer is not available in the provided documents."

    Context:\n{context}\n
    Question:\n{question}\n
    Answer:
    """
    # model = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.3)
    model = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0.3,
    google_application_credentials=os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
)

    prompt = PromptTemplate(template=prompt_template, input_variables=["context", "question"])
    return load_qa_chain(model, chain_type="stuff", prompt=prompt)

# ------------------------------- 

# FastAPI Endpoints
# ------------------------------- 

@app.post("/process-pdf/")
async def process_pdf_endpoint(file: UploadFile = File(...)):
    try:
        # Save uploaded PDF
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as f:
            f.write(await file.read())

        # Process only this file
        await process_single_pdf_and_update_index(file.filename)
        return JSONResponse(content={"message": f"{file.filename} processed and indexed."})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def astream_chat_generator(request: ChatRequest):
    """Generator function for streaming chat responses."""
    global vector_store, chain
    if vector_store is None:
        yield "data: " + json.dumps({"error": "PDFs not processed yet."}) + "\n\n"
        return

    docs = vector_store.similarity_search(request.question, k=3)
    
    context = "\n".join(doc.page_content for doc in docs)
    
    prompt_template = """
    You are a strict question-answering assistant.
    Your task is to answer the user’s question using ONLY the information from the provided context.  

    Very Important Rules:  
    - Do NOT add information that is not present in the context.
    - Do NOT make assumptions or guesses.  
    - You may rephrase sentences for clarity, but the factual details must remain unchanged.

    Context:
    {context}

    Question:
    {question}

    Answer:
    """
    
    formatted_prompt = prompt_template.format(context=context, question=request.question)

    model = chain.llm_chain.llm
    
    async for chunk in model.astream(formatted_prompt):
        content = chunk.content
        if content:
            yield "data: " + json.dumps({"output_text": content}) + "\n\n"

@app.post("/chat-stream/")
async def chat_stream_endpoint(request: ChatRequest):
    """Endpoint to handle streaming chat."""
    return StreamingResponse(
        astream_chat_generator(request),
        media_type="text/event-stream"
    )

async def astream_podcast_generator(request: ChatRequest):
    """Generator function for streaming podcast scripts."""
    global vector_store, chain
    if vector_store is None:
        yield "data: " + json.dumps({"error": "PDFs not processed yet."}) + "\n\n"
        return

    docs = vector_store.similarity_search(request.question, k=3)
    
    context = "\n".join(doc.page_content for doc in docs)
    
    podcast_prompt_template = """
    You are an expert podcast scriptwriter. Your task is to create an engaging and informative podcast script with two hosts, Speaker A and Speaker B, based on the provided text.

    **Instructions:**
    1.  **Strictly adhere** to the format "Speaker A: [dialogue]" and "Speaker B: [dialogue]". Each line of dialogue MUST start with the speaker's name.
    2.  The conversation should begin with the question and context provided by the user
    3.  The discussion should be informative, natural, and engaging, where both speakers can bring up any of the following: (Key takeaways, Did you know facts, Contradictions or counterparts, Examples, Connections between different documents or concepts)
    4.  Continue with a natural, conversational dialogue where both speakers discuss the insights, details, and implications of the text.
    5.  Ensure the conversation flows logically and provides value to the listener.
    6.  The tone should be conversational, as if two people are exchanging insights rather than reading a script.
    7.  Either speaker can introduce any of the above points (not restricted to one speaker).
    8.  The discussion should be between 250 and 500 words.
    9.  Ensure the flow feels like a podcast episode, weaving facts, insights, and counterpoints smoothly.
    10. Do not add any text or formatting other than the "Speaker A:" and "Speaker B:" dialogue lines.


    **Provided Text:**
    {context}

    **Podcast Script:**
    """
    
    formatted_prompt = podcast_prompt_template.format(context=context, question=request.question)

    model = chain.llm_chain.llm
    
    async for chunk in model.astream(formatted_prompt):
        content = chunk.content
        if content:
            yield "data: " + json.dumps({"output_text": content}) + "\n\n"


@app.post("/podcast-stream/")
async def podcast_stream_endpoint(request: ChatRequest):
    """Endpoint to handle streaming podcast script generation."""
    return StreamingResponse(
        astream_podcast_generator(request),
        media_type="text/event-stream"
    )

async def astream_insights_generator(request: ChatRequest):
    """Generator function for streaming insights."""
    global vector_store, chain
    if vector_store is None:
        yield "data: " + json.dumps({"error": "PDFs not processed yet."}) + "\n\n"
        return

    # The user's selected text from the PDF comes in the 'question' field
    selected_text = request.question
    docs = vector_store.similarity_search(selected_text, k=3)
    
    context = "\n".join(doc.page_content for doc in docs)
    
    # Define the insights prompt template directly on the backend
    insights_prompt_template = """
    You are an expert analyst. Your task is to provide deep insights based on the provided text.
    Analyze the following context and generate a concise, insightful summary.
    Focus on the key arguments, surprising findings, and potential implications.

    Context:
    {context}

    User's Selected Text (for additional focus):
    {question}

    Your Insightful Analysis:
    """
    
    formatted_prompt = insights_prompt_template.format(context=context, question=selected_text)

    model = chain.llm_chain.llm
    
    async for chunk in model.astream(formatted_prompt):
        content = chunk.content
        if content:
            yield "data: " + json.dumps({"output_text": content}) + "\n\n"


@app.post("/insights-stream/")
async def insights_stream_endpoint(request: ChatRequest):
    """Endpoint to handle streaming insights generation."""
    return StreamingResponse(
        astream_insights_generator(request),
        media_type="text/event-stream"
    )

def fetch_audio_chunk(text: str, voice: str) -> bytes:
    """Fetches a single audio chunk from Azure OpenAI TTS."""
    api_key = os.getenv("AZURE_TTS_KEY")
    endpoint = os.getenv("AZURE_TTS_ENDPOINT")
    deployment = os.getenv("AZURE_TTS_DEPLOYMENT")
    api_version = "2024-02-15-preview"

    url = f"{endpoint}/openai/deployments/{deployment}/audio/speech?api-version={api_version}"
    headers = {"api-key": api_key, "Content-Type": "application/json"}
    payload = {"model": deployment, "input": text, "voice": voice, "response_format": "mp3"}

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=20)
        response.raise_for_status()  # Raise an exception for bad status codes
        return response.content
    except requests.exceptions.RequestException as e:
        print(f"Error fetching audio for text '{text[:30]}...': {e}")
        return None

@app.post("/text-to-speech/")
async def text_to_speech_endpoint(request: TTSRequest):
    """
    Receives SSML, generates audio for each voice part with alternating
    voices, merges them, and streams the final audio.
    """
    # 1. PARSE SSML to get dialogue chunks
    soup = BeautifulSoup(request.ssml, "html.parser")
    dialogue_chunks = [tag.get_text(strip=True) for tag in soup.find_all("voice") if tag.get_text(strip=True)]

    if not dialogue_chunks:
        raise HTTPException(status_code=400, detail="No valid text found in SSML voice tags.")

    # 2. GENERATE AUDIO FOR EACH CHUNK IN PARALLEL
    voices = ['nova', 'alloy']  # Speaker A: nova, Speaker B: alloy
    
    # Create a list of tasks to run in parallel threads
    loop = asyncio.get_event_loop()
    tasks = []
    for i, text in enumerate(dialogue_chunks):
        voice = voices[i % 2]
        task = loop.run_in_executor(None, fetch_audio_chunk, text, voice)
        tasks.append(task)
        
    # Wait for all TTS API calls to complete
    audio_results = await asyncio.gather(*tasks)
    
    valid_audio_chunks = [chunk for chunk in audio_results if chunk is not None]

    if not valid_audio_chunks:
        raise HTTPException(status_code=500, detail="Failed to generate any audio chunks from TTS provider.")

    # 3. COMBINE AUDIO FILES IN-MEMORY using pydub
    # This is cleaner as it avoids writing temporary files to disk
    combined_audio = AudioSegment.empty()
    for audio_bytes in valid_audio_chunks:
        segment = AudioSegment.from_file(io.BytesIO(audio_bytes), format="mp3")
        combined_audio += segment

    # 4. PREPARE FINAL AUDIO FOR STREAMING
    final_audio_buffer = io.BytesIO()
    combined_audio.export(final_audio_buffer, format="mp3")
    final_audio_buffer.seek(0)

    return StreamingResponse(final_audio_buffer, media_type="audio/mpeg")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)