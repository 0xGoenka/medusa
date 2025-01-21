const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const Groq = require("groq-sdk");
const { GlobalKeyboardListener } = require("node-global-key-listener");
require("dotenv").config();
const keyboard = new GlobalKeyboardListener();
let Mic = require("node-microphone");
let mic = new Mic({
  device: "hw:1,0",
});

// Initialize the Groq client
// Configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY;
console.log(GROQ_API_KEY);
const RECORDING_PATH = path.join(__dirname, "recording.wav");
const HOTKEY = "F9";

// Initialize Groq client
const groq = new Groq({
  apiKey: GROQ_API_KEY,
});

let isRecording = false;
let recordingStream = null;
let fileStream = null;

keyboard.addListener((e) => {
  if (e.name === "F9" && e.state === "DOWN") {
    console.log("F9 was pressed");
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }
  if (e.state === "DOWN") {
    // Check if it's Ctrl+C
    if (e.vKey === 127) {
      console.log("Ctrl+C detected, exiting...");
      process.exit(0);
    }
  }
});

// Record audio
function startRecording() {
  if (isRecording) return;

  isRecording = true;

  // Create a WAV file writer
  const file = fs.createWriteStream(RECORDING_PATH, { encoding: "binary" });

  let micStream = mic.startRecording();
  micStream.pipe(file);

  // const recording = recorder.record();
  // recording.stream().pipe(file);

  // Listen for the end of the recording stream
  micStream.on("end", () => {
    console.log("Recording stream ended.");
    file.end();
  });
}

// Stop recording and process audio
async function stopRecording() {
  if (!isRecording) return;

  isRecording = false;
  console.log("Recording stopped. Processing...");

  // Stop the recording stream

  console.log("Stopping recording stream");
  mic.stopRecording();

  try {
    const transcribedText = await transcribeAudio();
    // const processedText = await processWithGroq(transcribedText);
    await typeText(transcribedText);
  } catch (error) {
    console.error("Error processing audio:", error);
  }
}

// Transcribe audio using Whisper API
async function transcribeAudio() {
  try {
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(RECORDING_PATH), // Required path to audio file - replace with your audio file!
      model: "whisper-large-v3-turbo", // Required model to use for transcription
      prompt: "", // Optional
      response_format: "json", // Optional
      language: "en", // Optional
      temperature: 0.0, // Optional
    });
    console.log(transcription);

    return transcription.text;
  } catch (error) {
    console.error(
      "Transcription error:",
      error.response?.data || error.message
    );
    throw error;
  }
}

// Type text using xdotool
function typeText(text) {
  return new Promise((resolve, reject) => {
    if (!text.trim()) {
      resolve();
      return;
    }

    exec(`xdotool type "${text}" && xdotool key Return`, (error) => {
      if (error) {
        console.error("Error typing text:", error);
        reject(error);
      } else {
        console.log("Typed:", text);
        resolve();
      }
    });
  });
}

// Main process
process.stdin.setRawMode(true);
// Cleanup on exit
process.on("SIGINT", () => {
  if (isRecording && recordingStream) {
    recordingStream.stop();
  }
  if (fileStream) {
    fileStream.end();
  }
  process.exit();
});

// Start the application
console.log("Speech-to-Text Tool with Groq Processing");
console.log("Press F9 to start/stop recording");
console.log("Press 'Pause' to quit");
