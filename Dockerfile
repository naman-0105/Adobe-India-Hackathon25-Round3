FROM node:20-bullseye

# Set working directory
WORKDIR /app

# -------------------------------
# Step 1: Copy dependency files only (for caching)
# -------------------------------
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
COPY backend/python/requirements.txt ./backend/python/

# -------------------------------
# Step 2: Install dependencies
# -------------------------------

# Frontend Node.js deps
WORKDIR /app/frontend
RUN npm install

# Backend Node.js deps
WORKDIR /app/backend
RUN npm install

# Python deps
WORKDIR /app/backend/python
RUN apt-get update && apt-get install -y python3 python3-pip
RUN pip3 install --no-cache-dir -r requirements.txt
RUN pip3 install --no-cache-dir pydub
RUN pip3 install "numpy<2"
RUN pip3 install faiss-cpu


# -------------------------------
# Step 3: Copy all source code
# -------------------------------
WORKDIR /app
COPY . .

# Ensure script.sh is executable
RUN chmod +x /app/script.sh

# Expose container ports
EXPOSE 8080 3001 8000

# -------------------------------
# Step 4: Run your script to start all servers
# -------------------------------
CMD ["/app/script.sh"]
