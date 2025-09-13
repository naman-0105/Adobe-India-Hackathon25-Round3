A modern PDF reader application with intelligent heading extraction and navigation capabilities. Built with React, TypeScript, Node.js, Express, Python (FastAPI), and Vite.

## Setup

### Installation

1. **Install Frontend Dependencies**:
    ```bash
    cd frontend
    npm install
    cd ..
    ```

2. **Install Backend Dependencies**:
    ```bash
    cd backend
    npm install
    pip install -r python/requirements.txt
    ```

3. **Environment Variables**:
    - Create `.env` in `frontend/`:
      ```
      ADOBE_EMBED_API_KEY=<your_adobe_embed_api_key>
      ```  

### Running the Application

#### Docker

1. **Build the Container**:
    ```bash
    docker build -t final_iiitians_backend:latest .
    ```
    
2. **Run the Container**:
    ```bash
    docker run --rm -v $(pwd)/backend/python/faiss_cache:/app/backend/faiss_cache -v $(pwd)/backend/uploads:/app/backend/uploads -v $(pwd)/backend/credentials:/credentials -e ADOBE_EMBED_API_KEY==<ADOBE_EMBED_API_KEY> -e LLM_PROVIDER=gemini -e GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials:/credentials -e GEMINI_MODEL=gemini-2.5-flash -e TTS_PROVIDER=azure -e AZURE_TTS_KEY=<TTS_KEY> -e AZURE_SPEECH_REGION=<SPEECH_REGION> -p 8080:8080 -p 3001:3001 -p 8000:8000 final_iiitians_backend:latest
    ```

