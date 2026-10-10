# LLM Translator — Blue Lemonade integration

Modified 2026-09-24. Based on the existing local 2.1.6 modification of https://github.com/NamelessKkang/llm-translator-custom (original: https://github.com/1234anon/llm-translator). Original AGPL-3.0 LICENSE retained. Host import paths and asset loading adapted; one settings view can appear in the extension drawer or Blue Lemonade; existing storage keys retained.
Modified 2026-10-10 (2.3.0): added translateForSpeech / speechReady / speechModelTag to the Blue Lemonade translator API (speech-translate.js, glossaryLinesFor) so the bundled TTS add-on can read lines in a chosen listening language with this translator's connection; chat translation behaviour unchanged.
Modified 2026-10-10 (2.3.1): translation-segments.js remembers the source-echo comparison key of each text for the rest of the current task (cleared on the next microtask), so end-of-reply echo checks no longer re-normalise the same paragraphs and sentences; results unchanged.
