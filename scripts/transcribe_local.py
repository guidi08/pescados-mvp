#!/usr/bin/env python3
import sys
from faster_whisper import WhisperModel

def main():
    if len(sys.argv) < 2:
        print("Usage: transcribe_local.py /path/to/audio [--model small] [--language pt]")
        sys.exit(1)
    audio = sys.argv[1]
    model_size = "small"
    language = None
    args = sys.argv[2:]
    if "--model" in args:
        i = args.index("--model")
        if i+1 < len(args):
            model_size = args[i+1]
    if "--language" in args:
        i = args.index("--language")
        if i+1 < len(args):
            language = args[i+1]
    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments, info = model.transcribe(audio, language=language)
    out = []
    for s in segments:
        out.append(s.text.strip())
    print(" ".join([t for t in out if t]))

if __name__ == "__main__":
    main()
