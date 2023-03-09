# node.js image to use.
FROM node:19.7.0-buster-slim

# Set the working directory to /app
WORKDIR /app

# 샾 두개는 일부러 주석 처리한 부분
# copy the requirements file used for dependencies
## COPY requirements.txt .

# Install any needed packages specified in requirements.txt
## RUN pip install --trusted-host pypi.python.org -r requirements.txt

# Copy the rest of the working directory contents into the container at /app
COPY . .

# Run the main file when the container launches
ENTRYPOINT ["npm", "run", "serve"]
